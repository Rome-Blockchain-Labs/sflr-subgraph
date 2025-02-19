import { BigInt } from "@graphprotocol/graph-ts"
import {
  Deposit,
  Transfer,
  Withdraw,
  Approval
} from "../../generated/WFLRContract/WFLR"
import {
  StakingTransaction,
  Allowance,
} from "../../generated/schema"
import { getOrCreateAccount, createUniqueId, getOrCreateUserMetric } from "./sflr";

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

  let account = getOrCreateAccount(userAddress)
  account.totalWrappedFlr = account.totalWrappedFlr.plus(event.params.amount)
  account.lastUpdated = event.block.timestamp
  account.save()

  let metric = getOrCreateUserMetric(userAddress)
  metric.lastInteractionTime = event.block.timestamp
  metric.transactionCount = metric.transactionCount.plus(BigInt.fromI32(1))
  if (metric.firstInteractionTime.equals(BigInt.fromI32(0))) {
    metric.firstInteractionTime = event.block.timestamp
  }
  metric.save()
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

  let account = getOrCreateAccount(userAddress)
  account.totalWrappedFlr = account.totalWrappedFlr.minus(event.params.amount)
  account.lastUpdated = event.block.timestamp
  account.save()

  let metric = getOrCreateUserMetric(userAddress)
  metric.lastInteractionTime = event.block.timestamp
  metric.transactionCount = metric.transactionCount.plus(BigInt.fromI32(1))
  if (metric.firstInteractionTime.equals(BigInt.fromI32(0))) {
    metric.firstInteractionTime = event.block.timestamp
  }
  metric.save()
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

  let fromAccount = getOrCreateAccount(fromAddress)
  fromAccount.totalWrappedFlr = fromAccount.totalWrappedFlr.minus(event.params.value)
  fromAccount.totalTransferredWrapped = fromAccount.totalTransferredWrapped.plus(event.params.value)
  fromAccount.lastUpdated = event.block.timestamp
  fromAccount.save()

  let toAccount = getOrCreateAccount(toAddress)
  toAccount.totalWrappedFlr = toAccount.totalWrappedFlr.plus(event.params.value)
  toAccount.totalReceivedWrapped = toAccount.totalReceivedWrapped.plus(event.params.value)
  toAccount.lastUpdated = event.block.timestamp
  toAccount.save()

  let fromMetric = getOrCreateUserMetric(fromAddress)
  fromMetric.lastInteractionTime = event.block.timestamp
  fromMetric.transactionCount = fromMetric.transactionCount.plus(BigInt.fromI32(1))
  fromMetric.totalTransferCount = fromMetric.totalTransferCount.plus(BigInt.fromI32(1))
  if (fromMetric.firstInteractionTime.equals(BigInt.fromI32(0))) {
    fromMetric.firstInteractionTime = event.block.timestamp
  }
  fromMetric.save()

  let toMetric = getOrCreateUserMetric(toAddress)
  toMetric.lastInteractionTime = event.block.timestamp
  toMetric.transactionCount = toMetric.transactionCount.plus(BigInt.fromI32(1))
  toMetric.totalTransferCount = toMetric.totalTransferCount.plus(BigInt.fromI32(1))
  if (toMetric.firstInteractionTime.equals(BigInt.fromI32(0))) {
    toMetric.firstInteractionTime = event.block.timestamp
  }
  toMetric.save()
}

export function handleApproval(event: Approval): void {
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
  let ownerAddress = event.params.owner.toHexString()
  let spenderAddress = event.params.spender.toHexString()

  let allowanceId = ownerAddress.concat('-').concat(spenderAddress)
  let allowance = Allowance.load(allowanceId)
  if (!allowance) {
    allowance = new Allowance(allowanceId)
    allowance.owner = ownerAddress
    allowance.spender = spenderAddress
  }
  allowance.amount = event.params.value
  allowance.lastUpdated = event.block.timestamp
  allowance.save()

  let transaction = new StakingTransaction(uniqueId)
  transaction.user = getOrCreateAccount(ownerAddress).id
  transaction.type = "wrappedApproval"
  transaction.spender = spenderAddress
  transaction.flrAmount = event.params.value
  transaction.sflrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()

  let metric = getOrCreateUserMetric(ownerAddress)
  metric.lastInteractionTime = event.block.timestamp
  metric.transactionCount = metric.transactionCount.plus(BigInt.fromI32(1))
  if (metric.firstInteractionTime.equals(BigInt.fromI32(0))) {
    metric.firstInteractionTime = event.block.timestamp
  }
  metric.save()
}
