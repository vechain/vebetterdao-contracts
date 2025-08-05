import { ethers } from "hardhat"
import fs from "fs"
import path from "path"
import {
  Emissions__factory,
  X2EarnApps__factory,
  XAllocationPool__factory,
  XAllocationVotingGovernor__factory,
} from "../../typechain-types"
import { getConfig } from "@repo/config"

/**
 * Interface representing allocation data for an app in a specific round
 */
interface AppShareData {
  /** Round identifier */
  roundId: number
  /** Unique identifier for the app */
  appId: string
  /** Human-readable name of the app */
  appName: string
  /** App's allocation shares (out of 10000) */
  shares: string
  /** Rewards amount including base allocation, in tokens */
  rewardsWithBaseAllocation: string
  /** Rewards amount without base allocation, in tokens */
  rewardsWithoutBaseAllocation: string
  /** Total emission amount for the round, in tokens */
  totalEmission: string
  /** Base allocation percentage for the round */
  baseAllocationPercent: string
}

/**
 * Fetches app allocation data for the specified number of recent rounds
 * @param lastNRounds Number of past rounds to retrieve data for
 */
export const getAppShares = async (lastNRounds: number = 1): Promise<void> => {
  // Initialize signer and display start message
  const [signer] = await ethers.getSigners()
  console.log("Fetching app shares data for the last", lastNRounds, "rounds...")

  // Initialize contract connections
  const xAllocationVoting = XAllocationVotingGovernor__factory.connect(
    getConfig().xAllocationVotingContractAddress,
    signer,
  )

  const xAllocationPool = XAllocationPool__factory.connect(getConfig().xAllocationPoolContractAddress, signer)

  const xApps = X2EarnApps__factory.connect(getConfig().x2EarnAppsContractAddress, signer)

  const emissions = Emissions__factory.connect(getConfig().emissionsContractAddress, signer)

  // Get current round information
  const currentRoundId = Number(await xAllocationVoting.currentRoundId())
  const appsFullInfo = await xApps.apps()
  const allData: AppShareData[] = []

  // Process each round
  for (let roundOffset = 1; roundOffset <= lastNRounds; roundOffset++) {
    const roundId = currentRoundId - roundOffset

    // Skip non-existent rounds
    if (roundId < 0) {
      console.log(`Warning: Skipping round ${roundId} (does not exist)`)
      continue
    }

    console.log(`Processing round ${roundId}...`)

    try {
      // Fetch round-specific data
      const apps = await xAllocationVoting.getAppIdsOfRound(roundId)
      const baseAllocation = await xAllocationPool.baseAllocationAmount(roundId)
      const totalEmission = await emissions.getXAllocationAmount(roundId)
      const baseAllocationPercentage = await xAllocationVoting.getRoundBaseAllocationPercentage(roundId)

      // Calculate allocation distribution amounts
      const variablePercentage = BigInt(100) - baseAllocationPercentage
      const availableVariable = (totalEmission * variablePercentage) / BigInt(100)

      // Process data for each app in the round
      for (const appId of apps) {
        const appShares = await xAllocationPool.getAppShares(roundId, appId)
        const appInfo = appsFullInfo.filter(appInfo => appInfo[0] === appId)[0]
        const appName = appInfo ? appInfo[2] : "Unknown App"

        // Calculate rewards with base allocation
        const rewardAmount = (availableVariable * appShares[0]) / BigInt(10000)
        const totalAmount = rewardAmount + baseAllocation

        // Calculate rewards without base allocation
        const rewardAmountWithoutBaseAllocation = (totalEmission * appShares[0]) / BigInt(10000)

        // Add to the collected data
        allData.push({
          roundId,
          appId,
          appName,
          shares: appShares[0].toString(),
          rewardsWithBaseAllocation: ethers.formatEther(totalAmount.toString()),
          rewardsWithoutBaseAllocation: ethers.formatEther(rewardAmountWithoutBaseAllocation.toString()),
          totalEmission: ethers.formatEther(totalEmission.toString()),
          baseAllocationPercent: baseAllocationPercentage.toString(),
        })
      }
    } catch (error) {
      console.error(`Error processing round ${roundId}:`, error)
    }
  }

  // Generate output
  printDataSummary(allData, lastNRounds)
  exportToCsv(allData)
}

/**
 * Prints a well-formatted summary of the allocation data to the console
 * @param data Collected app share data
 * @param lastNRounds Number of rounds that were processed
 */
const printDataSummary = (data: AppShareData[], lastNRounds: number): void => {
  console.log(`\n======== Summary of App Shares for Last ${lastNRounds} Rounds ========\n`)

  // Group data by round
  const roundsMap = new Map<number, AppShareData[]>()
  data.forEach(item => {
    if (!roundsMap.has(item.roundId)) {
      roundsMap.set(item.roundId, [])
    }
    roundsMap.get(item.roundId)?.push(item)
  })

  // Sort rounds in descending order (newest first)
  const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) => b - a)

  // For each round, print the data in a formatted table
  for (const roundId of sortedRounds) {
    const roundData = roundsMap.get(roundId) || []
    const baseAllocationPercent = roundData.length > 0 ? roundData[0].baseAllocationPercent : "0"
    const totalEmission = roundData.length > 0 ? roundData[0].totalEmission : "0"

    console.log(`\n----- ROUND ${roundId} -----`)
    console.log(`Base Allocation: ${baseAllocationPercent}%`)
    console.log(`Total Emission: ${totalEmission} tokens\n`)

    // Format data in columns
    console.log("APP NAME".padEnd(25) + "SHARES".padEnd(15) + "REWARDS (W/ BASE)".padEnd(20) + "REWARDS (W/O BASE)")
    console.log("─".repeat(80))

    // Sort apps by shares (descending)
    const sortedApps = [...roundData].sort((a, b) => Number(b.shares) - Number(a.shares))

    sortedApps.forEach(app => {
      console.log(
        app.appName.padEnd(25) +
          app.shares.padEnd(15) +
          app.rewardsWithBaseAllocation.padEnd(20) +
          app.rewardsWithoutBaseAllocation,
      )
    })

    if (roundId !== sortedRounds[sortedRounds.length - 1]) {
      console.log("\n" + "=".repeat(80))
    }
  }

  console.log("\n" + "=".repeat(80))
}

/**
 * Exports allocation data to CSV files (one per round plus a summary)
 * @param data Collected app share data
 */
const exportToCsv = (data: AppShareData[]): void => {
  // Create a unique directory name with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outputDir = path.join(__dirname, "../../output", `app-shares-${timestamp}`)

  // Create the output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Group data by round
  const roundsMap = new Map<number, AppShareData[]>()
  data.forEach(item => {
    if (!roundsMap.has(item.roundId)) {
      roundsMap.set(item.roundId, [])
    }
    roundsMap.get(item.roundId)?.push(item)
  })

  // Sort rounds in descending order (newest first)
  const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) => b - a)

  // Create a summary CSV file with basic metrics for all rounds
  let summaryContent = "Round ID,Base Allocation %,Total Emission,Number of Apps\n"
  for (const roundId of sortedRounds) {
    const roundData = roundsMap.get(roundId) || []
    if (roundData.length > 0) {
      const baseAllocationPercent = roundData[0].baseAllocationPercent
      const totalEmission = roundData[0].totalEmission
      summaryContent += `${roundId},${baseAllocationPercent},${totalEmission},${roundData.length}\n`
    }
  }
  fs.writeFileSync(path.join(outputDir, "00-summary.csv"), summaryContent)

  // Export each round to a separate CSV file
  for (const roundId of sortedRounds) {
    const roundData = roundsMap.get(roundId) || []
    if (roundData.length === 0) continue

    // Sort apps by shares (descending) within each round
    const sortedApps = [...roundData].sort((a, b) => Number(b.shares) - Number(a.shares))

    // Create header with round information
    let csvContent = `Round ${roundId} Allocation Data\n`
    csvContent += `Base Allocation: ${roundData[0].baseAllocationPercent}%\n`
    csvContent += `Total Emission: ${roundData[0].totalEmission} tokens\n\n`

    // Add column headers
    csvContent += "App Name,App ID,Shares,Rewards With Base Allocation,Rewards Without Base Allocation\n"

    // Add app data
    for (const app of sortedApps) {
      csvContent += `"${app.appName}",${app.appId},${app.shares},${app.rewardsWithBaseAllocation},${app.rewardsWithoutBaseAllocation}\n`
    }

    // Add totals row
    const totalShares = sortedApps.reduce((sum, app) => sum + Number(app.shares), 0)
    const totalRewardsWithBase = sortedApps
      .reduce((sum, app) => sum + Number(app.rewardsWithBaseAllocation), 0)
      .toFixed(18)
    const totalRewardsWithoutBase = sortedApps
      .reduce((sum, app) => sum + Number(app.rewardsWithoutBaseAllocation), 0)
      .toFixed(18)
    csvContent += `\nTOTALS,,${totalShares},${totalRewardsWithBase},${totalRewardsWithoutBase}\n`

    // Write file with padded round number for better sorting
    const filename = `round-${roundId.toString().padStart(3, "0")}.csv`
    fs.writeFileSync(path.join(outputDir, filename), csvContent)
  }

  console.log(`\nCSV files exported to: ${outputDir}`)
  console.log(`Summary file: 00-summary.csv`)
  console.log(`Individual round files: round-XXX.csv`)
}

/**
 * Parse command line arguments and execute the app shares calculation
 * Default to 10 rounds if no argument is provided
 */
const numRounds = process.argv[2] ? parseInt(process.argv[2]) : 10

getAppShares(numRounds)
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
