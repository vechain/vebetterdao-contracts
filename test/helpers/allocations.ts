const SCALING_FACTOR: bigint = BigInt(1_000_000)

/**
 * Calculates the next X allocation for the next cycle.
 * @param cycle
 * @param initialAllocation
 * @param decayPeriod
 * @param decayPercentage
 * @param lastCycleEmissions
 * @returns The next X allocation as a BigInt.
 */
export function calculateNextXAllocation(
  cycle: number,
  initialAllocation: bigint,
  decayPeriod: number,
  decayPercentage: bigint,
  lastCycleEmissions?: bigint,
): bigint {
  if (!lastCycleEmissions) {
    return initialAllocation
  }

  let scaledValue = lastCycleEmissions * SCALING_FACTOR

  // Check if we need to decay again by getting the modulus
  if (cycle > 1 && (cycle - 1) % decayPeriod === 0) {
    scaledValue = (scaledValue * (100n - decayPercentage)) / 100n
  }
  return scaledValue / SCALING_FACTOR
}

/**
 * Calculates the number of decay periods that have passed since the start of the emissions.
 * @param cycle
 * @param decayPeriod
 * @returns The number of decay periods as a number.
 */
function calculateVote2EarnDecayPeriods(cycle: number, decayPeriod: number): number {
  if (cycle <= 1) {
    return 0
  }
  return Math.floor((cycle - 1) / decayPeriod)
}

/**
 * Calculates the Vote2Earn decay percentage for the next cycle.
 * @param cycle
 * @param decayPeriod
 * @param decayPercentage
 * @param maxDecay
 * @returns The decay percentage as a number.
 */
function calculateVote2EarnDecayPercentage(
  cycle: number,
  decayPeriod: number,
  decayPercentage: bigint,
  maxDecay: bigint,
): bigint {
  const vote2earnDecayPeriods = calculateVote2EarnDecayPeriods(cycle, decayPeriod)
  const percentageToDecay = decayPercentage * BigInt(vote2earnDecayPeriods)

  return percentageToDecay > maxDecay ? maxDecay : percentageToDecay
}

/**
 * Calculates the Vote2Earn allocation for the next cycle.
 * @param cycle
 * @param xAllocation
 * @param decayPeriod
 * @param decayPercentage
 * @param maxDecay
 * @returns vote2EarnAllocation as a BigInt
 */
export function calculateVote2Earn(
  cycle: number,
  xAllocation: bigint,
  decayPeriod: number,
  decayPercentage: bigint,
  maxDecay: bigint,
): bigint {
  const vote2EarnDecay: bigint = calculateVote2EarnDecayPercentage(cycle, decayPeriod, decayPercentage, maxDecay)

  let scaledValue = xAllocation * SCALING_FACTOR

  scaledValue = (scaledValue * (100n - vote2EarnDecay)) / 100n

  return scaledValue / SCALING_FACTOR
}

/**
 * Calculates the treasury allocation for the next cycle.
 * @param xAllocation
 * @param vote2EarnAllocation
 * @returns treasuryAllocation as a BigInt
 */
export function calculateTreasuryAllocation(
  xAllocation: bigint,
  vote2EarnAllocation: bigint,
  treasuryPercentage: bigint,
): bigint {
  let scaledValue = (xAllocation + vote2EarnAllocation) * SCALING_FACTOR

  scaledValue = (scaledValue * treasuryPercentage) / 10000n

  return scaledValue / SCALING_FACTOR
}
