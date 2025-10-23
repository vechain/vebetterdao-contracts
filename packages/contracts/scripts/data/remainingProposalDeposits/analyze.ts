import { ethers, network } from "hardhat"
import { getConfig } from "@repo/config"
import { B3TRGovernor } from "../../../typechain-types"
import { readFileSync, writeFileSync } from "fs"
import BigNumber from "bignumber.js"
import { clean } from "./clean"
import { resolve } from "path"

// VARIABLES RAW
const config = getConfig()
const VERBOSE = true
const REVALIDATE_AND_CLEAN = true
// Conditional logging function
const log = (...args: any[]) => {
  if (VERBOSE) {
    console.log(...args)
  }
}

const stuckDeposits: { walletAddress: string; proposalId: string; depositAmount: string }[] = []

// Initialize signer and governor contract once for reuse
let governorContract: B3TRGovernor

const getUserDeposit = async (walletAddress: string, proposalId: string): Promise<void> => {
  const deposit = await governorContract.getUserDeposit(proposalId, walletAddress)
  if (deposit !== ethers.toBigInt(0)) {
    stuckDeposits.push({
      walletAddress,
      proposalId,
      depositAmount: deposit.toString(),
    })
    log(`💰 User ${walletAddress} has ${ethers.formatEther(deposit)} B3TR stuck in proposal ${proposalId}`)
  }
}

// Helper function to fetch events in blocks chunks
async function fetchEventsInChunks(
  contract: any,
  filter: any,
  fromBlock: number,
  toBlock: number,
  chunkSize: number = 100000,
): Promise<any[]> {
  const allEvents: any[] = []
  let currentBlock = fromBlock
  const totalBlocks = toBlock - fromBlock + 1
  let processedBlocks = 0

  log(`    📊 Processing ${totalBlocks} blocks in chunks of ${chunkSize}...`)

  while (currentBlock <= toBlock) {
    const endChunk = Math.min(currentBlock + chunkSize - 1, toBlock)
    const chunkBlocks = endChunk - currentBlock + 1
    processedBlocks += chunkBlocks

    const progress = ((processedBlocks / totalBlocks) * 100).toFixed(1)
    log(`    📡 [${progress}%] Fetching events from block ${currentBlock} to ${endChunk}...`)

    const events = await contract.queryFilter(filter, currentBlock, endChunk)
    allEvents.push(...events)

    if (events.length > 0) {
      log(`    ✅ Found ${events.length} events in this chunk`)
    }

    currentBlock = endChunk + 1
  }

  return allEvents
}

async function checkDepositStuckInChunks(
  depositCheckTasks: Array<{ depositorAddress: string; proposalId: string }>,
  totalChecks: number,
  chunkSize: number = 300,
) {
  // Process in batches to avoid memory issues
  let processedCount = 0

  log(`🧠 Memory optimization: Processing in batches of ${chunkSize} to prevent OOM errors`)
  log(`⏱️  Estimated batches: ${Math.ceil(depositCheckTasks.length / chunkSize)}`)

  for (let i = 0; i < depositCheckTasks.length; i += chunkSize) {
    const batch = depositCheckTasks.slice(i, i + chunkSize)
    const batchNumber = Math.floor(i / chunkSize) + 1
    const totalBatches = Math.ceil(depositCheckTasks.length / chunkSize)

    log(`⚡ Processing batch ${batchNumber}/${totalBatches} (${batch.length} requests)...`)

    // Process batch in parallel
    await Promise.all(batch.map(({ depositorAddress, proposalId }) => getUserDeposit(depositorAddress, proposalId)))

    processedCount += batch.length
    const progress = ((processedCount / totalChecks) * 100).toFixed(1)
    log(`✅ Batch ${batchNumber} completed! Progress: ${progress}% (${processedCount}/${totalChecks})`)
  }
}

export async function main() {
  const startTime = Date.now()
  const fileName = `moneyStuck-${config.environment}.json`

  // Display startup banner
  log(`\n${"=".repeat(80)}`)
  log(`🔍 B3TR GOVERNANCE STUCK DEPOSITS ANALYSIS`)
  log(`${"=".repeat(80)}`)
  log(`🔗 Network: ${network.name}`)
  log(`📋 Environment: ${config.environment}`)
  log(`🏛️ Governor Address: ${config.b3trGovernorAddress}`)

  // Environment variables
  const startBlock = 18868871 // B3TRGovernor was deployed at 18,868,871, but only on 19,820,936 (V4 Upgrade) the withdraw event was added
  const currentBlock = await ethers.provider.getBlockNumber()
  const endBlock = currentBlock

  log(`📊 Block Range: ${startBlock.toLocaleString()} → ${endBlock.toLocaleString()}`)
  log(`📈 Total Blocks to Analyze: ${(endBlock - startBlock).toLocaleString()}`)
  log(`${"=".repeat(80)}`)

  // Get contract instances
  const b3trGovernor = (await ethers.getContractAt("B3TRGovernor", config.b3trGovernorAddress!)) as B3TRGovernor

  // Initialize the global governor contract for reuse in getUserDeposit
  governorContract = b3trGovernor

  const depositEventFilter = b3trGovernor.filters.ProposalDeposit()
  const proposalCreatedEventFilter = b3trGovernor.filters.ProposalCreated()

  // Step 1: Fetch all relevant events in parallel
  log(`\n📊 Step 1: Fetching blockchain events...`)
  const [depositEvents, proposalCreatedEvents] = await Promise.all([
    fetchEventsInChunks(b3trGovernor, depositEventFilter, startBlock, endBlock, 100000),
    fetchEventsInChunks(b3trGovernor, proposalCreatedEventFilter, startBlock, endBlock, 100000),
  ])

  log(`✅ Deposit Events Found: ${depositEvents.length}`)
  log(`✅ Proposal Created Events Found: ${proposalCreatedEvents.length}`)

  // Step 2: Process and organize events by depositor
  log(`\n📊 Step 2: Processing and organizing events by depositor...`)

  const uniqueDepositors = new Set<string>()
  const proposalIds: string[] = []

  // Extract unique depositors
  for (const event of depositEvents) {
    const depositorAddress = event.args.depositor.toLowerCase()
    uniqueDepositors.add(depositorAddress)
  }

  // Extract all proposal IDs
  for (const event of proposalCreatedEvents) {
    proposalIds.push(event.args.proposalId.toString())
  }

  log(`👥 Found ${uniqueDepositors.size} unique depositors`)
  log(`📋 Found ${proposalIds.length} total proposals`)

  // Check each depositor against each proposal for stuck deposits
  log(`\n🔍 Step 3: Analyzing stuck deposits with batched parallel processing...`)
  const totalChecks = uniqueDepositors.size * proposalIds.length
  log(`🚀 Processing ${totalChecks} deposit checks in batches...`)

  // Create all tasks
  const depositCheckTasks: Array<{ depositorAddress: string; proposalId: string }> = []
  for (const depositorAddress of uniqueDepositors) {
    for (const proposalId of proposalIds) {
      depositCheckTasks.push({ depositorAddress, proposalId })
    }
  }
  // Check for stuck deposits in chunks of 100
  await checkDepositStuckInChunks(depositCheckTasks, totalChecks, 100)

  log(`🎉 All ${totalChecks} deposit checks completed successfully!`)

  // Save all stuck deposits to file
  const path = resolve(__dirname, "raw", fileName)
  writeFileSync(path, JSON.stringify(stuckDeposits, null, 2))
  log(`💾 Saved ${stuckDeposits.length} stuck deposits to ${path}`)

  // Calculate and display summary
  const summary = await calculateStuckDepositsSummary(fileName)

  // If you want to revalidate and clean the data, getting the rounds and total sum
  if (REVALIDATE_AND_CLEAN) {
    await clean(fileName)
  }

  const executionTime = (Date.now() - startTime) / 1000
  log(`\n⏱️  EXECUTION TIME: ${executionTime.toFixed(2)}s (${(executionTime / 60).toFixed(2)} minutes)`)

  return summary
}

interface StuckDepositSummary {
  totalStuckAmount: string
  totalStuckAmountFormatted: string
  stuckDepositsCount: number
  affectedWallets: number
  affectedProposals: number
}

export const calculateStuckDepositsSummary = async (fileName: string): Promise<StuckDepositSummary> => {
  try {
    const path = resolve(__dirname, "raw", fileName)
    const stuckDepositsData = await readFileSync(path, "utf8")
    const stuckDepositsArray = JSON.parse(stuckDepositsData)

    // Calculate total stuck amount in wei
    const totalStuckAmountWei = stuckDepositsArray.reduce((acc: BigNumber, item: { depositAmount: string }) => {
      return acc.plus(new BigNumber(item.depositAmount))
    }, new BigNumber(0))

    // Get unique wallets and proposals affected
    const uniqueWallets = new Set(stuckDepositsArray.map((item: { walletAddress: string }) => item.walletAddress))
    const uniqueProposals = new Set(stuckDepositsArray.map((item: { proposalId: string }) => item.proposalId))

    const summary: StuckDepositSummary = {
      totalStuckAmount: totalStuckAmountWei.toString(),
      totalStuckAmountFormatted: totalStuckAmountWei.dividedBy("1e18").toFixed(4),
      stuckDepositsCount: stuckDepositsArray.length,
      affectedWallets: uniqueWallets.size,
      affectedProposals: uniqueProposals.size,
    }

    // Display comprehensive summary
    log(`\n${"=".repeat(60)}`)
    log(`📊 STUCK DEPOSITS ANALYSIS SUMMARY`)
    log(`${"=".repeat(60)}`)
    log(`💰 Total Stuck Amount: ${summary.totalStuckAmountFormatted} B3TR`)
    log(`📈 Total Stuck Deposits: ${summary.stuckDepositsCount}`)
    log(`👥 Affected Wallets: ${summary.affectedWallets}`)
    log(`📋 Affected Proposals: ${summary.affectedProposals}`)
    log(`${"=".repeat(60)}`)

    return summary
  } catch (error) {
    log(`❌ Error calculating stuck deposits summary: ${error}`)
    return {
      totalStuckAmount: "0",
      totalStuckAmountFormatted: "0",
      stuckDepositsCount: 0,
      affectedWallets: 0,
      affectedProposals: 0,
    }
  }
}

// Execute the analysis
main().catch(console.error)
