import { BigInt, log, store } from "@graphprotocol/graph-ts"
import {
  AccrueRewards,
  AccrueRewardsExt,
  Submitted,
  UnlockRequested,
  UnlockCancelled,
  Redeem
} from "../../generated/SFLRContract/SFLR"
import {
  ExchangeRate,
  AccrueReward,
  StakingState,
  InvalidRewardTypeCounter,
  StakingTransaction
} from "../../generated/schema"
import { SFLR } from "../../generated/SFLRContract/SFLR"

// Constants for reward types
const REWARD_TYPE_UNKNOWN = 0;
const REWARD_TYPE_FLAREDROPS_P_CHAIN = 1;
const REWARD_TYPE_FLAREDROPS_C_CHAIN = 2;
const REWARD_TYPE_STAKING_REWARDS_P_CHAIN = 3;
const REWARD_TYPE_DELEGATION_REWARDS_C_CHAIN = 4;
const REWARD_TYPE_BUYIN_STAKING_FEES = 5;

const SCHEMA_VERSION = 1;

function isValidRewardType(rewardType: number): boolean {
  return rewardType >= REWARD_TYPE_UNKNOWN && rewardType <= REWARD_TYPE_BUYIN_STAKING_FEES;
}

function createUniqueId(timestamp: BigInt, txHash: string, suffix: string = ""): string {
  return timestamp.toString()
    .concat("-")
    .concat(txHash)
    .concat(suffix ? "-" + suffix : "");
}

function createRewardId(timestamp: BigInt, txHash: string, isExt: boolean): string {
  return createUniqueId(timestamp, txHash, isExt ? "ext" : "base");
}

function incrementInvalidRewardTypeCounter(): void {
  let counter = InvalidRewardTypeCounter.load("global");
  if (!counter) {
    counter = new InvalidRewardTypeCounter("global");
    counter.count = BigInt.fromI32(0);
  }
  counter.count = counter.count.plus(BigInt.fromI32(1));
  counter.save();
}

function handleCommonState(contract: SFLR, timestamp: BigInt, txHash: string): void {
  let oneShare = BigInt.fromI32(10).pow(18)
  let totalShares = contract.totalShares()
  let flrAmount = contract.getPooledFlrByShares(oneShare)

  let uniqueId = createUniqueId(timestamp, txHash)

  let stakingState = new StakingState(uniqueId)
  stakingState.totalShares = totalShares
  stakingState.timestamp = timestamp
  stakingState.save()

  let exchangeRate = new ExchangeRate(uniqueId)
  exchangeRate.rate = flrAmount
  exchangeRate.timestamp = timestamp
  exchangeRate.save()
}

function calculateExchangeRate(flrAmount: BigInt, shareAmount: BigInt): BigInt {
  if (shareAmount.equals(BigInt.fromI32(0))) {
    return BigInt.fromI32(0)
  }
  return flrAmount.times(BigInt.fromI32(10).pow(18)).div(shareAmount)
}

export function handleSubmitted(event: Submitted): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = event.params.user.toHexString()
  transaction.type = "stake"
  transaction.flrAmount = event.params.flrAmount
  transaction.sflrAmount = event.params.shareAmount
  transaction.exchangeRate = calculateExchangeRate(event.params.flrAmount, event.params.shareAmount)
  transaction.timestamp = event.block.timestamp
  transaction.transactionHash = event.transaction.hash.toHexString()
  transaction.status = "completed"
  transaction.save()
}

export function handleUnlockRequested(event: UnlockRequested): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let cooldownPeriod = contract.cooldownPeriod()
  let redeemPeriod = contract.redeemPeriod()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = event.params.user.toHexString()
  transaction.type = "unlock_requested"
  transaction.sflrAmount = event.params.shareAmount
  transaction.flrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.transactionHash = event.transaction.hash.toHexString()
  transaction.unlockStartedAt = event.block.timestamp
  transaction.redeemableAt = event.block.timestamp.plus(cooldownPeriod)
  transaction.expiresAt = event.block.timestamp.plus(cooldownPeriod).plus(redeemPeriod)
  transaction.status = "pending"
  transaction.save()
}

export function handleUnlockCancelled(event: UnlockCancelled): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.params.unlockRequestedAt, event.transaction.hash.toHex())

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = event.params.user.toHexString()
  transaction.type = "unlock_cancelled"
  transaction.sflrAmount = event.params.shareAmount
  transaction.flrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.transactionHash = event.transaction.hash.toHexString()
  transaction.unlockStartedAt = event.params.unlockRequestedAt
  transaction.status = "cancelled"
  transaction.save()
}

export function handleRedeem(event: Redeem): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.params.unlockRequestedAt, event.transaction.hash.toHex())

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = event.params.user.toHexString()
  transaction.type = "redeem"
  transaction.flrAmount = event.params.flrAmount
  transaction.sflrAmount = event.params.shareAmount
  transaction.exchangeRate = calculateExchangeRate(event.params.flrAmount, event.params.shareAmount)
  transaction.timestamp = event.block.timestamp
  transaction.transactionHash = event.transaction.hash.toHexString()
  transaction.unlockStartedAt = event.params.unlockRequestedAt
  transaction.status = "completed"
  transaction.save()
}

export function handleAccrueRewards(event: AccrueRewards): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createRewardId(event.block.timestamp, event.transaction.hash.toHex(), false)
  
  // Check if there's already an extended version of this reward
  let extendedId = createRewardId(event.block.timestamp, event.transaction.hash.toHex(), true)
  let extendedReward = AccrueReward.load(extendedId)
  
  // Only create base reward if no extended version exists
  if (extendedReward == null) {
    let accrueReward = new AccrueReward(uniqueId)
    accrueReward.timestamp = event.block.timestamp
    accrueReward.userRewardAmount = event.params.userRewardAmount
    accrueReward.protocolRewardAmount = event.params.protocolRewardAmount
    accrueReward.isExtended = false
    accrueReward.rewardType = REWARD_TYPE_UNKNOWN
    accrueReward.schemaVersion = SCHEMA_VERSION
    accrueReward.save()
  }
}

export function handleAccrueRewardsExt(event: AccrueRewardsExt): void {
  if (!isValidRewardType(event.params.rewardType)) {
    log.warning('Invalid reward type received: {}', [event.params.rewardType.toString()]);
    incrementInvalidRewardTypeCounter();
    return;
  }

  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createRewardId(event.block.timestamp, event.transaction.hash.toHex(), true)
  
  // Delete the base version if it exists
  let baseId = createRewardId(event.block.timestamp, event.transaction.hash.toHex(), false)
  let baseReward = AccrueReward.load(baseId)
  if (baseReward != null) {
    store.remove('AccrueReward', baseId)
  }

  let accrueReward = new AccrueReward(uniqueId)
  accrueReward.timestamp = event.block.timestamp
  accrueReward.userRewardAmount = event.params.userRewardAmount
  accrueReward.protocolRewardAmount = event.params.protocolRewardAmount
  accrueReward.rewardType = event.params.rewardType
  accrueReward.isExtended = true
  accrueReward.schemaVersion = SCHEMA_VERSION
  accrueReward.save()
}
