import {
  Mint,
  Swap,
  Collect
} from "../../../generated/enosys1/enosys"
import {
  ProtocolTransaction,
  SwapTransaction
} from "../../../generated/schema"

import { getOrCreateAccount, createUniqueId } from "../sflr";

export function handleMint(event: Mint): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.sender.toHexString()

  let transaction = new ProtocolTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "enosysMint"
  transaction.fromAddress = userAddress
  transaction.flrAmount = event.params.amount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}

export function handleSwap(event: Swap): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.sender.toHexString()

  let transaction = new SwapTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.fromAddress = userAddress
  transaction.toAddress = event.params.recipient.toHexString()
  transaction.type = "swap"
  transaction.fromAmount = event.params.amount0
  transaction.toAmount = event.params.amount1
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}

export function handleCollect(event: Collect): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.owner.toHexString()

  let transaction = new ProtocolTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.type = "sparkdexWithdraw"
  transaction.fromAddress = userAddress
  transaction.flrAmount = event.params.amount0
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}
