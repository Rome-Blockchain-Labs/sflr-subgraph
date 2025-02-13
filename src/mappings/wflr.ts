import { BigInt } from "@graphprotocol/graph-ts"
import {
  Deposit,
  Transfer,
  Withdraw
} from "../../generated/SFLRContract/SFLR"
import {
  StakingTransaction,
} from "../../generated/schema"
import { createUniqueId, getOrCreateAccount } from "./sflr";

export function handleWrapFLR(event: Deposit): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.user.toHexString()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "wrappedDeposit"
  transaction.flrAmount = event.params.amount
  transaction.sflrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}

export function handleUnwrapFLR(event: Withdraw): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.user.toHexString()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "wrappedWithdraw"
  transaction.flrAmount = event.params.amount
  transaction.sflrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}

export function handleWrappedTransfer(event: Transfer): void {
  let fromAddress = event.params.from.toHexString()
  let toAddress = event.params.to.toHexString()

  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())

  let transaction = new StakingTransaction(uniqueId)
  transaction.type = "wrappedTransfer"
  transaction.user = fromAddress
  transaction.fromAddress = fromAddress
  transaction.toAddress = toAddress
  transaction.flrAmount = event.params.value
  transaction.sflrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}