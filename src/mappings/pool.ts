import { BigInt } from "@graphprotocol/graph-ts"
import {
  Deposit,
  Transfer,
  Withdrawal,
} from "../../generated/WFLRContract/WFLR"
import {
  StakingTransaction,
} from "../../generated/schema"
import { getOrCreateAccount, createUniqueId, getOrCreateUserMetric } from "./sflr";

export function handleDeposit(event: Deposit): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.user.toHexString()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "poolDeposit"
  transaction.flrAmount = event.params.amount
  transaction.sflrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}
