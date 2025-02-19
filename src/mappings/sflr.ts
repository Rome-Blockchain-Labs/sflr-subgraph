import { BigInt, log, store, ethereum, Address } from "@graphprotocol/graph-ts"
import {
  SFLR,
  AccrueRewards,
  AccrueRewardsExt,
  Approval,
  CooldownPeriodUpdated,
  Deposit,
  MintingPaused,
  MintingResumed,
  ProtocolRewardShareRecipientUpdated,
  ProtocolRewardShareUpdated,
  Redeem,
  RedeemOverdueShares,
  RedeemPeriodUpdated,
  Submitted,
  TotalPooledFlrCapUpdated,
  Transfer,
  UnlockCancelled,
  UnlockRequested,
  Withdraw
} from "../../generated/SFLRContract/SFLR"
import {
  ExchangeRate,
  AccrueReward,
  StakingState,
  InvalidRewardTypeCounter,
  StakingTransaction,
  Account,
  Allowance,
  UnlockRequest,
  UserMetric,
  UserReward,
  ProtocolConfig,
  ConfigChange
} from "../../generated/schema"

// Constants for reward types
const REWARD_TYPE_UNKNOWN = 0;
const REWARD_TYPE_FLAREDROPS_P_CHAIN = 1;
const REWARD_TYPE_FLAREDROPS_C_CHAIN = 2;
const REWARD_TYPE_STAKING_REWARDS_P_CHAIN = 3;
const REWARD_TYPE_DELEGATION_REWARDS_C_CHAIN = 4;
const REWARD_TYPE_BUYIN_STAKING_FEES = 5;

const SCHEMA_VERSION = 1;

// helper functions
export function createUniqueId(timestamp: BigInt, txHash: string, suffix: string = ""): string {
  return timestamp.toString()
    .concat("-")
    .concat(txHash)
    .concat(suffix ? "-" + suffix : "");
}

export function createRewardId(timestamp: BigInt, txHash: string, isExt: boolean): string {
  return createUniqueId(timestamp, txHash, isExt ? "ext" : "base");
}

export function getOrCreateAccount(address: string): Account {
  let account = Account.load(address)
  if (!account) {
    account = new Account(address)
    account.balance = BigInt.fromI32(0)
    account.totalWrappedFlr = BigInt.fromI32(0)
    account.totalTransferred = BigInt.fromI32(0)
    account.totalTransferredWrapped = BigInt.fromI32(0)
    account.totalReceived = BigInt.fromI32(0)
    account.totalReceivedWrapped = BigInt.fromI32(0)
    account.lastUpdated = BigInt.fromI32(0)
    account.save()
  }
  return account
}

export function getOrCreateUserMetric(address: string): UserMetric {
  let metric = UserMetric.load(address)
  if (!metric) {
    metric = new UserMetric(address)
    metric.currentShares = BigInt.fromI32(0)
    metric.totalStaked = BigInt.fromI32(0)
    metric.totalUnstaked = BigInt.fromI32(0)
    metric.totalRewardsEarned = BigInt.fromI32(0)
    metric.lastInteractionTime = BigInt.fromI32(0)
    metric.transactionCount = BigInt.fromI32(0)
    metric.custodiedShares = BigInt.fromI32(0)
    metric.activeUnlockRequestCount = 0
    metric.totalTransferCount = BigInt.fromI32(0)
    metric.totalRewardsClaimed = BigInt.fromI32(0)
    metric.firstInteractionTime = BigInt.fromI32(0)
    metric.save()
  }
  return metric
}

export function getOrCreateProtocolConfig(): ProtocolConfig {
  let config = ProtocolConfig.load("current")
  if (!config) {
    config = new ProtocolConfig("current")
    config.timestamp = BigInt.fromI32(0)
    config.cooldownPeriod = BigInt.fromI32(0)
    config.redeemPeriod = BigInt.fromI32(0)
    config.totalPooledFlrCap = BigInt.fromI32(0)
    config.protocolRewardShare = BigInt.fromI32(0)
    config.protocolRewardRecipient = ""
    config.mintingPaused = false
    config.buyInStakingFee = BigInt.fromI32(0)
    config.save()
  }
  return config
}

export function createHourlyTimestampId(timestamp: BigInt): string {
  // round down to the nearest hour by dividing by 3600 (seconds in an hour)
  let hourlyTimestamp = timestamp.div(BigInt.fromI32(3600)).times(BigInt.fromI32(3600))
  return hourlyTimestamp.toString()
}

export function handleCommonState(contract: SFLR, timestamp: BigInt, txHash: string): void {
  const SCALING_FACTOR = BigInt.fromI32(10).pow(18);
  const currentRate = contract.getPooledFlrByShares(SCALING_FACTOR);

  // store immutable state immediately
  const stakingState = new StakingState(createUniqueId(timestamp, txHash));
  stakingState.timestamp = timestamp;
  stakingState.totalShares = contract.totalShares();
  stakingState.totalPooledFlr = contract.totalPooledFlr();
  stakingState.stakerCount = contract.stakerCount();
  stakingState.save();
  // track the latest rate in a singleton
  const LATEST_RATE_ID = "latest";
  let latestRate = ExchangeRate.load(LATEST_RATE_ID);
  // store new rate if it's the first one or if changed
  if (!latestRate || !latestRate.rate.equals(currentRate)) {
    const newRate = new ExchangeRate(createUniqueId(timestamp, txHash));
    newRate.rate = currentRate;
    newRate.timestamp = timestamp;
    newRate.save();
    // update latest rate tracker
    if (!latestRate) {
      latestRate = new ExchangeRate(LATEST_RATE_ID);
    }
    latestRate.rate = currentRate;
    latestRate.timestamp = timestamp;
    latestRate.save();
  }
}

// core staking event handlers
export function handleSubmitted(event: Submitted): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.user.toHexString()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "stake"
  transaction.flrAmount = event.params.flrAmount
  transaction.sflrAmount = event.params.shareAmount
  transaction.exchangeRate = calculateExchangeRate(event.params.flrAmount, event.params.shareAmount)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()

  let metric = getOrCreateUserMetric(userAddress)
  metric.currentShares = metric.currentShares.plus(event.params.shareAmount)
  metric.totalStaked = metric.totalStaked.plus(event.params.flrAmount)
  metric.lastInteractionTime = event.block.timestamp
  if (metric.firstInteractionTime.equals(BigInt.fromI32(0))) {
    metric.firstInteractionTime = event.block.timestamp
  }
  metric.transactionCount = metric.transactionCount.plus(BigInt.fromI32(1))
  metric.save()

  let account = getOrCreateAccount(userAddress)
  account.balance = account.balance.plus(event.params.shareAmount)
  account.lastUpdated = event.block.timestamp
  account.save()
}

export function handleUnlockRequested(event: UnlockRequested): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.user.toHexString()
  let cooldownPeriod = contract.cooldownPeriod()
  let redeemPeriod = contract.redeemPeriod()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "unlock_requested"
  transaction.sflrAmount = event.params.shareAmount
  transaction.flrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.unlockStartedAt = event.block.timestamp
  transaction.redeemableAt = event.block.timestamp.plus(cooldownPeriod)
  transaction.expiresAt = event.block.timestamp.plus(cooldownPeriod).plus(redeemPeriod)
  transaction.status = "pending"
  transaction.save()

  // create unlock request
  let unlockRequest = new UnlockRequest(uniqueId)
  unlockRequest.user = getOrCreateAccount(userAddress).id
  unlockRequest.startedAt = event.block.timestamp
  unlockRequest.shareAmount = event.params.shareAmount
  unlockRequest.status = "pending"
  unlockRequest.redeemableAt = event.block.timestamp.plus(cooldownPeriod)
  unlockRequest.expiresAt = event.block.timestamp.plus(cooldownPeriod).plus(redeemPeriod)
  unlockRequest.transaction = transaction.id
  unlockRequest.save()

  let metric = getOrCreateUserMetric(userAddress)
  metric.currentShares = metric.currentShares.minus(event.params.shareAmount)
  metric.custodiedShares = metric.custodiedShares.plus(event.params.shareAmount)
  metric.activeUnlockRequestCount = metric.activeUnlockRequestCount + 1
  metric.lastInteractionTime = event.block.timestamp
  metric.transactionCount = metric.transactionCount.plus(BigInt.fromI32(1))
  metric.save()
}

export function handleUnlockCancelled(event: UnlockCancelled): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.params.unlockRequestedAt, event.transaction.hash.toHex())
  let userAddress = event.params.user.toHexString()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "unlock_cancelled"
  transaction.sflrAmount = event.params.shareAmount
  transaction.flrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.unlockStartedAt = event.params.unlockRequestedAt
  transaction.status = "cancelled"
  transaction.save()

  // update unlock request status
  let unlockRequest = UnlockRequest.load(uniqueId)
  if (unlockRequest) {
    unlockRequest.status = "cancelled"
    unlockRequest.save()
  }

  let metric = getOrCreateUserMetric(userAddress)
  metric.currentShares = metric.currentShares.plus(event.params.shareAmount)
  metric.custodiedShares = metric.custodiedShares.minus(event.params.shareAmount)
  metric.activeUnlockRequestCount = metric.activeUnlockRequestCount - 1
  metric.lastInteractionTime = event.block.timestamp
  metric.transactionCount = metric.transactionCount.plus(BigInt.fromI32(1))
  metric.save()
}

export function handleRedeem(event: Redeem): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.params.unlockRequestedAt, event.transaction.hash.toHex())
  let userAddress = event.params.user.toHexString()

  // create transaction record
  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "redeem"
  transaction.flrAmount = event.params.flrAmount
  transaction.sflrAmount = event.params.shareAmount
  transaction.exchangeRate = calculateExchangeRate(event.params.flrAmount, event.params.shareAmount)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.unlockStartedAt = event.params.unlockRequestedAt
  transaction.status = "completed"
  transaction.save()

  // update unlock status
  let unlockRequest = UnlockRequest.load(uniqueId)
  if (unlockRequest) {
    unlockRequest.status = "completed"
    unlockRequest.redemptionTransaction = transaction.id
    unlockRequest.save()
  }

  let metric = getOrCreateUserMetric(userAddress)
  metric.custodiedShares = metric.custodiedShares.minus(event.params.shareAmount)
  metric.totalUnstaked = metric.totalUnstaked.plus(event.params.flrAmount)
  metric.activeUnlockRequestCount = metric.activeUnlockRequestCount - 1
  metric.lastInteractionTime = event.block.timestamp
  metric.transactionCount = metric.transactionCount.plus(BigInt.fromI32(1))
  metric.save()
}

export function handleRedeemOverdueShares(event: RedeemOverdueShares): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.user.toHexString()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "redeem_overdue"
  transaction.sflrAmount = event.params.shareAmount
  transaction.flrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()

  let metric = getOrCreateUserMetric(userAddress)
  metric.currentShares = metric.currentShares.plus(event.params.shareAmount)
  metric.custodiedShares = metric.custodiedShares.minus(event.params.shareAmount)
  metric.lastInteractionTime = event.block.timestamp
  metric.transactionCount = metric.transactionCount.plus(BigInt.fromI32(1))
  metric.save()
}

// reward handlers
export function handleAccrueRewards(event: AccrueRewards): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createRewardId(event.block.timestamp, event.transaction.hash.toHex(), false)

  // check if there's already an extended version of this reward
  let extendedId = createRewardId(event.block.timestamp, event.transaction.hash.toHex(), true)
  let extendedReward = AccrueReward.load(extendedId)

  // only create base reward if no extended version exists
  if (extendedReward == null) {
    let accrueReward = new AccrueReward(uniqueId)
    accrueReward.timestamp = event.block.timestamp
    accrueReward.blockNumber = event.block.number
    accrueReward.transactionHash = event.transaction.hash.toHex()
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
    log.warning('Invalid reward type received: {}', [event.params.rewardType.toString()])
    incrementInvalidRewardTypeCounter()
    return
  }

  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createRewardId(event.block.timestamp, event.transaction.hash.toHex(), true)

  // delete the base version if it exists
  let baseId = createRewardId(event.block.timestamp, event.transaction.hash.toHex(), false)
  let baseReward = AccrueReward.load(baseId)
  if (baseReward != null) {
    store.remove('AccrueReward', baseId)
  }

  let accrueReward = new AccrueReward(uniqueId)
  accrueReward.timestamp = event.block.timestamp
  accrueReward.blockNumber = event.block.number
  accrueReward.transactionHash = event.transaction.hash.toHex()
  accrueReward.userRewardAmount = event.params.userRewardAmount
  accrueReward.protocolRewardAmount = event.params.protocolRewardAmount
  accrueReward.rewardType = event.params.rewardType
  accrueReward.isExtended = true
  accrueReward.schemaVersion = SCHEMA_VERSION
  accrueReward.save()
}

// Transfer and Approval handlers
export function handleTransfer(event: Transfer): void {
  let fromAddress = event.params.from.toHexString()
  let toAddress = event.params.to.toHexString()

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())

  let transaction = new StakingTransaction(uniqueId)
  transaction.type = "transfer"
  transaction.user = fromAddress
  transaction.fromAddress = fromAddress
  transaction.toAddress = toAddress
  transaction.sflrAmount = event.params.value
  transaction.flrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()

  let fromAccount = getOrCreateAccount(fromAddress)
  fromAccount.balance = fromAccount.balance.minus(event.params.value)
  fromAccount.totalTransferred = fromAccount.totalTransferred.plus(event.params.value)
  fromAccount.lastUpdated = event.block.timestamp
  fromAccount.save()

  let toAccount = getOrCreateAccount(toAddress)
  toAccount.balance = toAccount.balance.plus(event.params.value)
  toAccount.totalReceived = toAccount.totalReceived.plus(event.params.value)
  toAccount.lastUpdated = event.block.timestamp
  toAccount.save()

  let fromMetric = getOrCreateUserMetric(fromAddress)
  fromMetric.currentShares = fromMetric.currentShares.minus(event.params.value)
  fromMetric.totalTransferCount = fromMetric.totalTransferCount.plus(BigInt.fromI32(1))
  fromMetric.lastInteractionTime = event.block.timestamp
  fromMetric.save()

  let toMetric = getOrCreateUserMetric(toAddress)
  toMetric.currentShares = toMetric.currentShares.plus(event.params.value)
  toMetric.totalTransferCount = toMetric.totalTransferCount.plus(BigInt.fromI32(1))
  toMetric.lastInteractionTime = event.block.timestamp
  if (toMetric.firstInteractionTime.equals(BigInt.fromI32(0))) {
    toMetric.firstInteractionTime = event.block.timestamp
  }
  toMetric.save()
}

export function handleApproval(event: Approval): void {
  let owner = event.params.owner.toHexString()
  let spender = event.params.spender.toHexString()

  let allowanceId = owner.concat('-').concat(spender)
  let allowance = Allowance.load(allowanceId)
  if (!allowance) {
    allowance = new Allowance(allowanceId)
    allowance.owner = owner
    allowance.spender = spender
  }
  allowance.amount = event.params.value
  allowance.lastUpdated = event.block.timestamp
  allowance.save()

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let transaction = new StakingTransaction(uniqueId)
  transaction.type = "approve"
  transaction.user = owner
  transaction.spender = spender
  transaction.sflrAmount = event.params.value
  transaction.flrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}

export function handleCooldownPeriodUpdated(event: CooldownPeriodUpdated): void {
  let config = getOrCreateProtocolConfig()
  config.cooldownPeriod = event.params.newCooldownPeriod
  config.timestamp = event.block.timestamp
  config.save()
}

export function handleRedeemPeriodUpdated(event: RedeemPeriodUpdated): void {
  let config = getOrCreateProtocolConfig()
  config.redeemPeriod = event.params.newRedeemPeriod
  config.timestamp = event.block.timestamp
  config.save()
}

export function handleTotalPooledFlrCapUpdated(event: TotalPooledFlrCapUpdated): void {
  let config = getOrCreateProtocolConfig()
  config.totalPooledFlrCap = event.params.newTotalPooledFlrCap
  config.timestamp = event.block.timestamp
  config.save()
}

export function handleProtocolRewardShareRecipientUpdated(event: ProtocolRewardShareRecipientUpdated): void {
  let config = getOrCreateProtocolConfig()
  config.protocolRewardRecipient = event.params.newProtocolRewardShareRecipient.toHexString()
  config.timestamp = event.block.timestamp
  config.save()
}

export function handleProtocolRewardShareUpdated(event: ProtocolRewardShareUpdated): void {
  let config = getOrCreateProtocolConfig()
  config.protocolRewardShare = event.params.newProtocolRewardShare
  config.timestamp = event.block.timestamp
  config.save()
}

export function handleMintingPaused(event: MintingPaused): void {
  let config = getOrCreateProtocolConfig()
  config.mintingPaused = true
  config.timestamp = event.block.timestamp
  config.save()

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let configChange = new ConfigChange(uniqueId)
  configChange.timestamp = event.block.timestamp
  configChange.blockNumber = event.block.number
  configChange.parameter = "minting"
  configChange.oldValue = "false"
  configChange.newValue = "true"
  configChange.transactionHash = event.transaction.hash.toHex()
  configChange.save()
}

export function handleMintingResumed(event: MintingResumed): void {
  let config = getOrCreateProtocolConfig()
  config.mintingPaused = false
  config.timestamp = event.block.timestamp
  config.save()

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let configChange = new ConfigChange(uniqueId)
  configChange.timestamp = event.block.timestamp
  configChange.blockNumber = event.block.number
  configChange.parameter = "minting"
  configChange.oldValue = "true"
  configChange.newValue = "false"
  configChange.transactionHash = event.transaction.hash.toHex()
  configChange.save()
}

export function handleWithdraw(event: Withdraw): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.user.toHexString()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "withdraw"
  transaction.flrAmount = event.params.amount
  transaction.sflrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()

  let metric = getOrCreateUserMetric(userAddress)
  metric.lastInteractionTime = event.block.timestamp
  metric.transactionCount = metric.transactionCount.plus(BigInt.fromI32(1))
  metric.save()
}

export function handleDeposit(event: Deposit): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.user.toHexString()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "deposit"
  transaction.flrAmount = event.params.amount
  transaction.sflrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()

  let metric = getOrCreateUserMetric(userAddress)
  metric.lastInteractionTime = event.block.timestamp
  metric.transactionCount = metric.transactionCount.plus(BigInt.fromI32(1))
  metric.save()
}

// helper export function to increment invalid reward type counter
export function incrementInvalidRewardTypeCounter(): void {
  let counter = InvalidRewardTypeCounter.load("global")
  if (!counter) {
    counter = new InvalidRewardTypeCounter("global")
    counter.count = BigInt.fromI32(0)
  }
  counter.count = counter.count.plus(BigInt.fromI32(1))
  counter.save()
}

// helper export function to validate reward types
export function isValidRewardType(rewardType: number): boolean {
  return rewardType >= REWARD_TYPE_UNKNOWN && rewardType <= REWARD_TYPE_BUYIN_STAKING_FEES
}

export function calculateExchangeRate(flrAmount: BigInt, shareAmount: BigInt): BigInt {
  if (shareAmount.equals(BigInt.fromI32(0))) {
    return BigInt.fromI32(0);
  }
  return flrAmount.times(BigInt.fromI32(10).pow(18)).div(shareAmount);
}
