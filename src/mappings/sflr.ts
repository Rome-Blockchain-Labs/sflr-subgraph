import { BigInt, log } from "@graphprotocol/graph-ts"
import {
  AccrueRewards,
  AccrueRewardsExt
} from "../../generated/SFLRContract/SFLR"
import {
  ExchangeRate,
  AccrueReward,
  StakingState
  InvalidRewardTypeCounter
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

function isValidRewardType(rewardType: i32): boolean {
  return rewardType >= REWARD_TYPE_UNKNOWN && rewardType <= REWARD_TYPE_BUYIN_STAKING_FEES;
}

function createUniqueId(timestamp: BigInt, txHash: string): string {
  return timestamp.toString().concat("-").concat(txHash);
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

export function handleAccrueRewards(event: AccrueRewards): void {
  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  
  let accrueReward = new AccrueReward(uniqueId)
  accrueReward.timestamp = event.block.timestamp
  accrueReward.userRewardAmount = event.params.userRewardAmount
  accrueReward.protocolRewardAmount = event.params.protocolRewardAmount
  accrueReward.isExtended = false
  accrueReward.rewardType = REWARD_TYPE_UNKNOWN
  accrueReward.schemaVersion = SCHEMA_VERSION
  accrueReward.save()
}

export function handleAccrueRewardsExt(event: AccrueRewardsExt): void {
  if (!isValidRewardType(event.params.rewardType)) {
    log.warning('Invalid reward type received: {}', [event.params.rewardType.toString()]);
    incrementInvalidRewardTypeCounter();
    return;
  }

  let contract = SFLR.bind(event.address)
  handleCommonState(contract, event.block.timestamp, event.transaction.hash.toHex())

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  
  let accrueReward = new AccrueReward(uniqueId)
  accrueReward.timestamp = event.block.timestamp
  accrueReward.userRewardAmount = event.params.userRewardAmount
  accrueReward.protocolRewardAmount = event.params.protocolRewardAmount
  accrueReward.rewardType = event.params.rewardType
  accrueReward.isExtended = true
  accrueReward.schemaVersion = SCHEMA_VERSION
  accrueReward.save()
}
