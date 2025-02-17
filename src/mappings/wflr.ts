import { BigInt } from "@graphprotocol/graph-ts"
import {
  Approval,
  Deposit,
  Transfer,
  Withdraw
} from "../../generated/SFLRContract/SFLR"
import {
  WrappedAllowance,
  StakingTransaction,
} from "../../generated/schema"
import { createUniqueId, getOrCreateAccount, getOrCreateUserMetric } from "./sflr";

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

  let metric = getOrCreateUserMetric(userAddress)
  metric.totalWrappedFlr = metric.totalWrappedFlr.plus(event.params.amount)
  metric.lastInteractionTime = event.block.timestamp
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

  let metric = getOrCreateUserMetric(userAddress)
  metric.totalWrappedFlr = metric.totalWrappedFlr.minus(event.params.amount)
  metric.lastInteractionTime = event.block.timestamp
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

  let fromMetric = getOrCreateUserMetric(fromAddress)
  fromMetric.totalWrappedFlr = fromMetric.totalWrappedFlr.minus(event.params.value)
  fromMetric.lastInteractionTime = event.block.timestamp
  if (fromMetric.firstInteractionTime.equals(BigInt.fromI32(0))) {
    fromMetric.firstInteractionTime = event.block.timestamp
  }
  fromMetric.save()

  let toMetric = getOrCreateUserMetric(toAddress)
  toMetric.totalWrappedFlr = fromMetric.totalWrappedFlr.minus(event.params.value)
  toMetric.lastInteractionTime = event.block.timestamp
  if (toMetric.firstInteractionTime.equals(BigInt.fromI32(0))) {
    toMetric.firstInteractionTime = event.block.timestamp
  }
  toMetric.save()

  let fromAccount = getOrCreateAccount(fromAddress)
  fromAccount.totalTransferredWrapped = fromAccount.totalTransferredWrapped.minus(event.params.value)

  let toAccount = getOrCreateAccount(toAddress)
  toAccount.totalReceivedWrapped = toAccount.totalReceivedWrapped.plus(event.params.value)
}

export function handleApproval(event: Approval): void {
  let owner = event.params.owner.toHexString()
  let spender = event.params.spender.toHexString()

  let allowanceId = owner.concat('-').concat(spender)
    let allowance = WrappedAllowance.load(allowanceId)
    if (!allowance) {
      allowance = new WrappedAllowance(allowanceId)
      allowance.owner = owner
      allowance.spender = spender
    }
    allowance.amount = event.params.value
    allowance.lastUpdated = event.block.timestamp
    allowance.save()

    let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex())
    let transaction = new StakingTransaction(uniqueId)
    transaction.type = "approveWrapped"
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
