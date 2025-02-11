import { BigInt } from "@graphprotocol/graph-ts"
import {
  Deposit,
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
    transaction.type = "deposit"
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
    transaction.type = "withdraw"
    transaction.flrAmount = BigInt.fromI32(0)
    transaction.sflrAmount = event.params.amount
    transaction.exchangeRate = BigInt.fromI32(0)
    transaction.timestamp = event.block.timestamp
    transaction.blockNumber = event.block.number
    transaction.transactionHash = event.transaction.hash.toHex()
    transaction.status = "completed"
    transaction.save()
}
