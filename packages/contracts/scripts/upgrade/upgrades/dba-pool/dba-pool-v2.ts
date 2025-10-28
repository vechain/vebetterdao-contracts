import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { DBAPool } from "../../../../typechain-types"
import { ethers } from "hardhat"

/**
 * Fetches all FundsDistributedToApp events from the DBAPool contract
 * @param dbaPoolAddress The address of the DBAPool contract
 * @param startBlock The block number to start fetching events from
 * @returns Arrays of roundIds, appIds, and amounts
 */
async function fetchHistoricalDBAEvents(dbaPoolAddress: string, startBlock: number) {
  console.log(`Fetching historical FundsDistributedToApp events from block ${startBlock}...`)

  const dbaPool = await ethers.getContractAt("DBAPoolV1", dbaPoolAddress)

  // Get the event filter
  const filter = dbaPool.filters.FundsDistributedToApp()

  // Fetch events in chunks to avoid RPC limits
  const currentBlock = await ethers.provider.getBlockNumber()
  const chunkSize = 10000 // Adjust based on your RPC provider limits
  const allEvents = []

  for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock)
    console.log(`Fetching events from block ${fromBlock} to ${toBlock}...`)

    const events = await dbaPool.queryFilter(filter, fromBlock, toBlock)
    allEvents.push(...events)

    console.log(`Found ${events.length} events in this chunk`)
  }

  console.log(`Total events found: ${allEvents.length}`)

  // Extract data from events
  const roundIds: bigint[] = []
  const appIds: string[] = []
  const amounts: bigint[] = []

  for (const event of allEvents) {
    if (event.args) {
      appIds.push(event.args.appId)
      amounts.push(event.args.amount)
      roundIds.push(event.args.roundId)
      console.log(
        `Event: Round ${event.args.roundId}, App ${event.args.appId}, Amount ${ethers.formatEther(event.args.amount)}`,
      )
    }
  }

  return { roundIds, appIds, amounts }
}

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading DBAPool contract at address: ${config.dbaPoolContractAddress} on network: ${config.network.name}`,
  )

  // Get the distributionStartRound from DBAPool
  console.log("\n=== Getting Distribution Start Round ===")
  let dbaPool = (await ethers.getContractAt("DBAPool", config.dbaPoolContractAddress)) as DBAPool
  const distributionStartRound = await dbaPool.distributionStartRound()
  console.log(`Distribution start round: ${distributionStartRound}`)

  // Get the roundSnapshot block from XAllocationVoting for the distributionStartRound
  console.log("\n=== Getting Round Snapshot Block ===")
  const xAllocationVoting = await ethers.getContractAt("XAllocationVoting", config.xAllocationVotingContractAddress)
  const roundSnapshotBlock = await xAllocationVoting.roundSnapshot(distributionStartRound)
  console.log(`Round ${distributionStartRound} snapshot block: ${roundSnapshotBlock}`)

  // Fetch all historical events from the beginning
  console.log("\n=== Fetching Historical DBA Rewards Data ===")
  const { roundIds, appIds, amounts } = await fetchHistoricalDBAEvents(
    config.dbaPoolContractAddress,
    Number(roundSnapshotBlock),
  )

  console.log(`Total events found: ${roundIds.length}`)

  // Perform the upgrade
  console.log("\n=== Upgrading Contract ===")
  dbaPool = (await upgradeProxy(
    "DBAPoolV1",
    "DBAPool",
    config.dbaPoolContractAddress,
    [], // No initialization args for V2
    {
      version: 2,
    },
  )) as DBAPool

  console.log(`DBAPool upgraded successfully`)

  // Check that upgrade was successful
  const version = await dbaPool.version()
  console.log(`New DBAPool version: ${version}`)

  if (parseInt(version) !== 2) {
    throw new Error(`DBAPool version is not 2: ${version}`)
  }

  // Seed historical data if events were found
  if (roundIds.length > 0) {
    console.log(`\n=== Seeding ${roundIds.length} Historical Rewards ===`)

    // Seed in batches to avoid gas limits
    const batchSize = 50 // Adjust based on gas limits
    for (let i = 0; i < roundIds.length; i += batchSize) {
      const batchRoundIds = roundIds.slice(i, i + batchSize)
      const batchAppIds = appIds.slice(i, i + batchSize)
      const batchAmounts = amounts.slice(i, i + batchSize)

      console.log(`Seeding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(roundIds.length / batchSize)}...`)

      const tx = await dbaPool.seedDBARewardsForApps(batchRoundIds, batchAppIds, batchAmounts)
      await tx.wait()

      console.log(`Batch ${Math.floor(i / batchSize) + 1} seeded successfully`)
    }

    console.log("All historical data seeded successfully")
  } else {
    console.log("No historical events found to seed")
  }

  console.log("\n=== Upgrade and Seeding Completed Successfully ===")
  process.exit(0)
}

// Execute the main function
main()
