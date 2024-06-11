import fs from "fs/promises"
import { ethers } from "hardhat"
import { calculateNextXAllocation, calculateTreasuryAllocation, calculateVote2Earn } from "./allocations"
import { ContractsConfig } from "../../config/contracts"

/**
 * Interface for the token allocations.
 * Each allocation represents the distribution of tokens for a given cycle.
 * Note: BigInt is not directly JSON serializable, conversion required before saving.
 */
interface Allocation {
  cycle: number
  xAllocation: bigint
  vote2EarnAllocation: bigint
  treasuryAllocation: bigint
}

/**
 * Saves the given allocations to a file in JSON format.
 * @param allocations Array of Allocation objects to save.
 * @param path Name of the file to save the allocations to.
 */
async function saveAllocationsToFile(allocations: Allocation[], path: string): Promise<void> {
  await fs.writeFile(
    path,
    JSON.stringify(
      allocations,
      (_, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
      2,
    ),
  )
  console.log(`Cycles' allocations saved to ${path}`)
}

/**
 * Generates token allocations based on predetermined decay cycles and percentages.
 * @returns A Promise that resolves to an array of Allocation objects.
 */
export async function generateB3trAllocations(config: ContractsConfig, path?: string): Promise<Allocation[]> {
  const xAllocations: Allocation[] = []

  const b3trCap = ethers.parseEther(config.B3TR_CAP.toString())
  let b3trSupply: bigint = config.MIGRATION_AMOUNT
  let cycle: number = 1
  let lastCycleEmissions: bigint | undefined = undefined

  while (b3trSupply < b3trCap) {
    const xAllocation: bigint = calculateNextXAllocation(
      cycle,
      config.INITIAL_X_ALLOCATION,
      config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
      BigInt(config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE),
      lastCycleEmissions,
    )
    const vote2EarnAllocation: bigint = calculateVote2Earn(
      cycle,
      xAllocation,
      config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
      BigInt(config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE),
      BigInt(config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE),
    )
    const treasuryAllocation: bigint = calculateTreasuryAllocation(
      xAllocation,
      vote2EarnAllocation,
      BigInt(config.EMISSIONS_TREASURY_PERCENTAGE),
    )

    xAllocations.push({ cycle, xAllocation, vote2EarnAllocation, treasuryAllocation })

    b3trSupply += xAllocation + vote2EarnAllocation + treasuryAllocation

    lastCycleEmissions = xAllocation
    cycle++
  }

  // If the b3trSupply exceeds the MAX_SUPPLY, remove the last allocation
  if (b3trSupply > b3trCap) {
    xAllocations.pop()
  }

  // Save the allocations to a file
  if (path) {
    await saveAllocationsToFile(xAllocations, path)
  }

  return xAllocations
}
