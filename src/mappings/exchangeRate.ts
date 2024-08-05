import { BigInt } from "@graphprotocol/graph-ts"
import { ExchangeRateUpdate } from "../../generated/SFLRContract/SFLR"
import { ExchangeRate } from "../../generated/schema"
import { SFLR } from "../../generated/SFLRContract/SFLR"

export function handleExchangeRateUpdate(event: ExchangeRateUpdate): void {
  let contract = SFLR.bind(event.address)
  let oneShare = BigInt.fromI32(10).pow(18) // 1 SFLR with 18 decimals
  let flrAmount = contract.getPooledFlrByShares(oneShare)

  let exchangeRate = new ExchangeRate(event.transaction.hash.toHex())
  exchangeRate.rate = flrAmount
  exchangeRate.timestamp = event.block.timestamp
  exchangeRate.save()
}