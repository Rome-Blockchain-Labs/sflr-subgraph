import {
  DepositAdded,
  BalanceWithdrawn,
  CurrencyDepositAdded,
  CurrencyBalanceWithdrawn,
} from "../../../generated/xdfi/xdfi"
import {
  ProtocolTransaction,
} from "../../../generated/schema"
import { getOrCreateAccount, createUniqueId } from "../sflr";

export function handleDeposit(event: DepositAdded): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.account.toHexString()

  let transaction = new ProtocolTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.fromAddress = userAddress
  transaction.type = "xdfiDeposit"
  transaction.flrAmount = event.params.amount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}

export function handleWithdraw(event: BalanceWithdrawn): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.account.toHexString()

  let transaction = new ProtocolTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.fromAddress = userAddress
  transaction.type = "xdfiWithdraw"
  transaction.flrAmount = event.params.amount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}

export function handleCurrencyDeposit(event: CurrencyDepositAdded): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.account.toHexString()

  let transaction = new ProtocolTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.fromAddress = userAddress
  transaction.type = "xdfiCurrencyDeposit"
  transaction.flrAmount = event.params.amount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}

export function handleCurrencyWithdraw(event: CurrencyBalanceWithdrawn): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let userAddress = event.params.account.toHexString()

  let transaction = new ProtocolTransaction(uniqueId)
  transaction.user = getOrCreateAccount(userAddress).id
  transaction.fromAddress = userAddress
  transaction.type = "xdfiCurrencyWithdraw"
  transaction.flrAmount = event.params.amount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
}
