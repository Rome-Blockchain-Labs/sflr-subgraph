import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  AccrueRewards,
  Submitted,
  UnlockRequested,
  Redeem,
  Transfer,
  CooldownPeriodUpdated,
  RedeemPeriodUpdated,
  ExchangeRateUpdate,
  SFLR
} from "../../generated/SFLRContract/SFLR"
import {
  ExchangeRate,
  AccrueReward,
  DailySnapshot,
  TotalStats,
  UserPosition,
  UnstakeRequest
} from "../../generated/schema"

function getOrCreateTotalStats(): TotalStats {
  let stats = TotalStats.load("1")
  if (stats == null) {
    stats = new TotalStats("1")
    stats.totalPooledFlr = BigInt.fromI32(0)
    stats.totalShares = BigInt.fromI32(0)
    stats.stakerCount = BigInt.fromI32(0)
    stats.cooldownPeriod = BigInt.fromI32(0)
    stats.redeemPeriod = BigInt.fromI32(0)
    stats.totalRewardsDistributed = BigInt.fromI32(0)
  }
  return stats as TotalStats
}

function getOrCreateUserPosition(address: Bytes): UserPosition {
  let id = address.toHexString()
  let position = UserPosition.load(id)
  if (position == null) {
    position = new UserPosition(id)
    position.user = address
    position.shares = BigInt.fromI32(0)
    position.sharesInCustody = BigInt.fromI32(0)
  }
  return position as UserPosition
}

function getOrCreateDailySnapshot(timestamp: BigInt): DailySnapshot {
  let dayID = timestamp.div(BigInt.fromI32(86400)).toString()
  let snapshot = DailySnapshot.load(dayID)
  if (snapshot == null) {
    snapshot = new DailySnapshot(dayID)
    snapshot.date = timestamp.div(BigInt.fromI32(86400)).times(BigInt.fromI32(86400))
    snapshot.totalStaked = BigInt.fromI32(0)
    snapshot.totalUnstaked = BigInt.fromI32(0)
    snapshot.exchangeRate = BigInt.fromI32(0)
    snapshot.totalRewards = BigInt.fromI32(0)
    snapshot.stakerCount = BigInt.fromI32(0)
  }
  return snapshot as DailySnapshot
}

export function handleAccrueRewards(event: AccrueRewards): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let accrueReward = new AccrueReward(id)
  accrueReward.timestamp = event.block.timestamp
  accrueReward.userRewardAmount = event.params.userRewardAmount
  accrueReward.protocolRewardAmount = event.params.protocolRewardAmount
  accrueReward.save()

  let stats = getOrCreateTotalStats()
  stats.totalPooledFlr = stats.totalPooledFlr.plus(event.params.userRewardAmount)
  stats.totalRewardsDistributed = stats.totalRewardsDistributed.plus(event.params.userRewardAmount).plus(event.params.protocolRewardAmount)
  stats.save()

  let snapshot = getOrCreateDailySnapshot(event.block.timestamp)
  snapshot.totalRewards = snapshot.totalRewards.plus(event.params.userRewardAmount).plus(event.params.protocolRewardAmount)
  snapshot.save()

  updateExchangeRate(event.block.timestamp)
}

export function handleSubmitted(event: Submitted): void {
  let stats = getOrCreateTotalStats()
  stats.totalPooledFlr = stats.totalPooledFlr.plus(event.params.flrAmount)
  stats.totalShares = stats.totalShares.plus(event.params.shareAmount)
  stats.save()

  let userPosition = getOrCreateUserPosition(event.params.user)
  userPosition.shares = userPosition.shares.plus(event.params.shareAmount)
  userPosition.save()

  let snapshot = getOrCreateDailySnapshot(event.block.timestamp)
  snapshot.totalStaked = snapshot.totalStaked.plus(event.params.flrAmount)
  snapshot.save()

  updateExchangeRate(event.block.timestamp)
}

export function handleUnlockRequested(event: UnlockRequested): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let unstakeRequest = new UnstakeRequest(id)
  unstakeRequest.user = event.params.user
  unstakeRequest.startedAt = event.block.timestamp
  unstakeRequest.shareAmount = event.params.shareAmount
  unstakeRequest.save()

  let userPosition = getOrCreateUserPosition(event.params.user)
  userPosition.sharesInCustody = userPosition.sharesInCustody.plus(event.params.shareAmount)
  userPosition.save()
}

export function handleRedeem(event: Redeem): void {
  let stats = getOrCreateTotalStats()
  stats.totalPooledFlr = stats.totalPooledFlr.minus(event.params.flrAmount)
  stats.totalShares = stats.totalShares.minus(event.params.shareAmount)
  stats.save()

  let userPosition = getOrCreateUserPosition(event.params.user)
  userPosition.sharesInCustody = userPosition.sharesInCustody.minus(event.params.shareAmount)
  userPosition.save()

  let snapshot = getOrCreateDailySnapshot(event.block.timestamp)
  snapshot.totalUnstaked = snapshot.totalUnstaked.plus(event.params.flrAmount)
  snapshot.save()

  updateExchangeRate(event.block.timestamp)
}

export function handleTransfer(event: Transfer): void {
  let fromUserPosition = getOrCreateUserPosition(event.params.from)
  let toUserPosition = getOrCreateUserPosition(event.params.to)

  fromUserPosition.shares = fromUserPosition.shares.minus(event.params.value)
  toUserPosition.shares = toUserPosition.shares.plus(event.params.value)

  fromUserPosition.save()
  toUserPosition.save()

  let stats = getOrCreateTotalStats()
  if (fromUserPosition.shares.equals(BigInt.fromI32(0))) {
    stats.stakerCount = stats.stakerCount.minus(BigInt.fromI32(1))
  }
  if (toUserPosition.shares.equals(event.params.value)) {
    stats.stakerCount = stats.stakerCount.plus(BigInt.fromI32(1))
  }
  stats.save()

  let snapshot = getOrCreateDailySnapshot(event.block.timestamp)
  snapshot.stakerCount = stats.stakerCount
  snapshot.save()
}

export function handleCooldownPeriodUpdated(event: CooldownPeriodUpdated): void {
  let stats = getOrCreateTotalStats()
  stats.cooldownPeriod = event.params.newCooldownPeriod
  stats.save()
}

export function handleRedeemPeriodUpdated(event: RedeemPeriodUpdated): void {
  let stats = getOrCreateTotalStats()
  stats.redeemPeriod = event.params.newRedeemPeriod
  stats.save()
}

export function handleExchangeRateUpdate(event: ExchangeRateUpdate): void {
  let contract = SFLR.bind(event.address)
  let oneShare = BigInt.fromI32(10).pow(18) // 1 SFLR with 18 decimals
  let flrAmount = contract.getPooledFlrByShares(oneShare)

  let exchangeRate = new ExchangeRate(event.transaction.hash.toHex())
  exchangeRate.rate = flrAmount
  exchangeRate.timestamp = event.block.timestamp
  exchangeRate.save()

  let snapshot = getOrCreateDailySnapshot(event.block.timestamp)
  snapshot.exchangeRate = flrAmount
  snapshot.save()
}

function updateExchangeRate(timestamp: BigInt): void {
  let stats = getOrCreateTotalStats()
  if (stats.totalShares.notEqual(BigInt.fromI32(0))) {
    let rate = stats.totalPooledFlr.times(BigInt.fromI32(10).pow(18)).div(stats.totalShares)
    let exchangeRate = new ExchangeRate(timestamp.toString())
    exchangeRate.rate = rate
    exchangeRate.timestamp = timestamp
    exchangeRate.save()

    let snapshot = getOrCreateDailySnapshot(timestamp)
    snapshot.exchangeRate = rate
    snapshot.save()
  }
}
