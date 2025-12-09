import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  Transfer,
  IncreaseLiquidity,
  DecreaseLiquidity,
  Collect,
  NonfungiblePositionManager
} from "../../../generated/sparkdexNFTManager/NonfungiblePositionManager"
import { LiquidityPosition } from "../../../generated/schema"
import { getOrCreateAccount } from "../sflr"

function getPositionId(protocol: string, tokenId: BigInt): string {
  return protocol + "-" + tokenId.toString()
}

function getOrCreatePosition(
  protocol: string,
  tokenId: BigInt,
  managerAddress: Address,
  timestamp: BigInt,
  txHash: string
): LiquidityPosition {
  let id = getPositionId(protocol, tokenId)
  let position = LiquidityPosition.load(id)

  if (!position) {
    position = new LiquidityPosition(id)
    position.tokenId = tokenId
    position.protocol = protocol
    position.liquidity = BigInt.fromI32(0)
    position.depositedToken0 = BigInt.fromI32(0)
    position.depositedToken1 = BigInt.fromI32(0)
    position.withdrawnToken0 = BigInt.fromI32(0)
    position.withdrawnToken1 = BigInt.fromI32(0)
    position.collectedFees0 = BigInt.fromI32(0)
    position.collectedFees1 = BigInt.fromI32(0)
    position.createdAt = timestamp
    position.createdTxHash = txHash

    // Fetch position details from contract
    let manager = NonfungiblePositionManager.bind(managerAddress)
    let positionData = manager.try_positions(tokenId)

    if (!positionData.reverted) {
      position.token0 = positionData.value.value2.toHexString()
      position.token1 = positionData.value.value3.toHexString()
      position.fee = positionData.value.value4
      position.tickLower = positionData.value.value5
      position.tickUpper = positionData.value.value6
      // Compute pool address or store as empty for now
      position.pool = ""
    } else {
      position.token0 = ""
      position.token1 = ""
      position.fee = 0
      position.tickLower = 0
      position.tickUpper = 0
      position.pool = ""
    }

    // Owner will be set by Transfer event
    position.owner = "0x0000000000000000000000000000000000000000"
  }

  position.lastUpdated = timestamp
  return position
}

// SparkDex handlers
export function handleSparkdexTransfer(event: Transfer): void {
  let position = getOrCreatePosition(
    "sparkdex",
    event.params.tokenId,
    event.address,
    event.block.timestamp,
    event.transaction.hash.toHex()
  )

  let toAddress = event.params.to.toHexString()

  // Skip burns (to zero address)
  if (toAddress != "0x0000000000000000000000000000000000000000") {
    position.owner = getOrCreateAccount(toAddress).id
    position.save()
  }
}

export function handleSparkdexIncreaseLiquidity(event: IncreaseLiquidity): void {
  let position = getOrCreatePosition(
    "sparkdex",
    event.params.tokenId,
    event.address,
    event.block.timestamp,
    event.transaction.hash.toHex()
  )

  position.liquidity = position.liquidity.plus(event.params.liquidity)
  position.depositedToken0 = position.depositedToken0.plus(event.params.amount0)
  position.depositedToken1 = position.depositedToken1.plus(event.params.amount1)
  position.save()
}

export function handleSparkdexDecreaseLiquidity(event: DecreaseLiquidity): void {
  let position = getOrCreatePosition(
    "sparkdex",
    event.params.tokenId,
    event.address,
    event.block.timestamp,
    event.transaction.hash.toHex()
  )

  position.liquidity = position.liquidity.minus(event.params.liquidity)
  position.withdrawnToken0 = position.withdrawnToken0.plus(event.params.amount0)
  position.withdrawnToken1 = position.withdrawnToken1.plus(event.params.amount1)
  position.save()
}

export function handleSparkdexCollect(event: Collect): void {
  let position = getOrCreatePosition(
    "sparkdex",
    event.params.tokenId,
    event.address,
    event.block.timestamp,
    event.transaction.hash.toHex()
  )

  position.collectedFees0 = position.collectedFees0.plus(event.params.amount0)
  position.collectedFees1 = position.collectedFees1.plus(event.params.amount1)
  position.save()
}

// Enosys handlers (identical logic, different protocol string)
export function handleEnosysTransfer(event: Transfer): void {
  let position = getOrCreatePosition(
    "enosys",
    event.params.tokenId,
    event.address,
    event.block.timestamp,
    event.transaction.hash.toHex()
  )

  let toAddress = event.params.to.toHexString()
  if (toAddress != "0x0000000000000000000000000000000000000000") {
    position.owner = getOrCreateAccount(toAddress).id
    position.save()
  }
}

export function handleEnosysIncreaseLiquidity(event: IncreaseLiquidity): void {
  let position = getOrCreatePosition(
    "enosys",
    event.params.tokenId,
    event.address,
    event.block.timestamp,
    event.transaction.hash.toHex()
  )

  position.liquidity = position.liquidity.plus(event.params.liquidity)
  position.depositedToken0 = position.depositedToken0.plus(event.params.amount0)
  position.depositedToken1 = position.depositedToken1.plus(event.params.amount1)
  position.save()
}

export function handleEnosysDecreaseLiquidity(event: DecreaseLiquidity): void {
  let position = getOrCreatePosition(
    "enosys",
    event.params.tokenId,
    event.address,
    event.block.timestamp,
    event.transaction.hash.toHex()
  )

  position.liquidity = position.liquidity.minus(event.params.liquidity)
  position.withdrawnToken0 = position.withdrawnToken0.plus(event.params.amount0)
  position.withdrawnToken1 = position.withdrawnToken1.plus(event.params.amount1)
  position.save()
}

export function handleEnosysCollect(event: Collect): void {
  let position = getOrCreatePosition(
    "enosys",
    event.params.tokenId,
    event.address,
    event.block.timestamp,
    event.transaction.hash.toHex()
  )

  position.collectedFees0 = position.collectedFees0.plus(event.params.amount0)
  position.collectedFees1 = position.collectedFees1.plus(event.params.amount1)
  position.save()
}
