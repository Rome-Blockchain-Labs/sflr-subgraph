import { BigInt } from "@graphprotocol/graph-ts"
import { AccrueRewards } from "../../generated/SFLRContract/SFLR"
import { ExchangeRate, AccrueReward } from "../../generated/schema"
import { SFLR } from "../../generated/SFLRContract/SFLR"

// Handle Accrue Rewards and update exchange rate
export function handleAccrueRewards(event: AccrueRewards): void {
  let contract = SFLR.bind(event.address)
  let oneShare = BigInt.fromI32(10).pow(18) // 1 SFLR with 18 decimals
  let flrAmount = contract.getPooledFlrByShares(oneShare)

  // Update ExchangeRate entity (use AccrueRewards event to update exchange rate)
  let exchangeRate = new ExchangeRate(event.transaction.hash.toHex())
  exchangeRate.rate = flrAmount
  exchangeRate.timestamp = event.block.timestamp
  exchangeRate.save()

  // Handle AccrueReward entity
  let accrueReward = new AccrueReward(event.transaction.hash.toHex())
  accrueReward.timestamp = event.block.timestamp
  accrueReward.userRewardAmount = event.params.userRewardAmount
  accrueReward.protocolRewardAmount = event.params.protocolRewardAmount
  accrueReward.save()
}
