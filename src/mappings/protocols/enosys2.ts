import {
  Swap,
} from "../../../generated/enosys6/enosys2"
import {
  SwapTransaction
} from "../../../generated/schema"
import { getOrCreateAccount, createUniqueId } from "../sflr";

export function handleSwap(event: Swap): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.sender.toHexString()

  let transaction = new SwapTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.fromAddress = userAddress
  transaction.toAddress = event.params.to.toHexString()
  transaction.type = "swap"
  transaction.fromAmount = event.params.amount1In.neg()
  transaction.toAmount = event.params.amount0Out
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}