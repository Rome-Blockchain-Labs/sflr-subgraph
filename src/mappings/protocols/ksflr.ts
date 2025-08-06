import { BigInt } from "@graphprotocol/graph-ts"
import {
  Mint, Redeem
} from "../../../generated/kineticProtocol/ksflr"
import {
  ProtocolTransaction
} from "../../../generated/schema"
import { getOrCreateAccount, createUniqueId } from "../sflr";

export function handleMint(event: Mint): void {
  let userAddress = event.params.minter.toHexString()
  let transaction = new ProtocolTransaction(createUniqueId(event.block.timestamp, event.transaction.hash.toHex(), "kinetic_mint"))
  transaction.user = userAddress
  transaction.type = "kinetic_mint"
  transaction.flrAmount = event.params.mintAmount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()

  // Update locked balance when sFLR is deposited to Kinetic
  let account = getOrCreateAccount(userAddress)
  account.balance = account.balance.minus(event.params.mintAmount) // sFLR leaves wallet
  account.lockedBalance = account.lockedBalance.plus(event.params.mintAmount) // sFLR is now locked
  account.lastUpdated = event.block.timestamp
  account.save()
}

export function handleRedeem(event: Redeem): void {
  let userAddress = event.params.redeemer.toHexString()
  let transaction = new ProtocolTransaction(createUniqueId(event.block.timestamp, event.transaction.hash.toHex(), "kinetic_redeem"))
  transaction.user = userAddress
  transaction.type = "kinetic_redeem"
  transaction.flrAmount = event.params.redeemAmount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()

  // Update balances when sFLR is withdrawn from Kinetic
  let account = getOrCreateAccount(userAddress)
  account.balance = account.balance.plus(event.params.redeemAmount) // sFLR returns to wallet
  account.lockedBalance = account.lockedBalance.minus(event.params.redeemAmount) // sFLR no longer locked
  account.lastUpdated = event.block.timestamp
  account.save()
}
