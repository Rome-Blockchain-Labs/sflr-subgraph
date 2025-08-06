import { BigInt, log } from "@graphprotocol/graph-ts"
import { Transfer } from "../../generated/kSFLRContract/ERC20"
import { StakingTransaction, Account } from "../../generated/schema"
import { getOrCreateAccount, createUniqueId, getOrCreateUserMetric } from "./sflr"

export function handleKSFLRTransfer(event: Transfer): void {
  let from = event.params.from.toHexString()
  let to = event.params.to.toHexString()
  let amount = event.params.value
  
  // Skip zero transfers
  if (amount.equals(BigInt.fromI32(0))) return
  
  // Create transaction record
  let uniqueId = createUniqueId(event.block.timestamp, event.transaction.hash.toHex(), "ksflr")
  let transaction = new StakingTransaction(uniqueId)
  transaction.user = from
  transaction.type = "ksflr_transfer"
  transaction.fromAddress = from
  transaction.toAddress = to
  transaction.sflrAmount = amount
  transaction.flrAmount = BigInt.fromI32(0)
  transaction.exchangeRate = BigInt.fromI32(0)
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.transactionHash = event.transaction.hash.toHex()
  transaction.status = "completed"
  transaction.save()
  
  // Update locked balances - this tracks sFLR that's locked in Kinetic
  if (from != "0x0000000000000000000000000000000000000000") {
    let fromAccount = getOrCreateAccount(from)
    fromAccount.lockedBalance = fromAccount.lockedBalance.minus(amount)
    fromAccount.lastUpdated = event.block.timestamp
    fromAccount.save()
    
    let fromMetric = getOrCreateUserMetric(from)
    fromMetric.lastInteractionTime = event.block.timestamp
    fromMetric.transactionCount = fromMetric.transactionCount.plus(BigInt.fromI32(1))
    fromMetric.save()
  }
  
  if (to != "0x0000000000000000000000000000000000000000") {
    let toAccount = getOrCreateAccount(to)
    toAccount.lockedBalance = toAccount.lockedBalance.plus(amount)
    toAccount.lastUpdated = event.block.timestamp
    toAccount.save()
    
    let toMetric = getOrCreateUserMetric(to)
    toMetric.lastInteractionTime = event.block.timestamp
    toMetric.transactionCount = toMetric.transactionCount.plus(BigInt.fromI32(1))
    toMetric.save()
  }
  
  log.info("kSFLR transfer (liquidation/collateral movement): {} from {} to {}", [
    amount.toString(), 
    from, 
    to
  ])
}
