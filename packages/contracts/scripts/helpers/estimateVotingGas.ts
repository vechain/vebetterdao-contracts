import { getConfig } from "@repo/config"
import { ThorClient } from "@vechain/sdk-network"
import { ABIContract, Address, Clause } from "@vechain/sdk-core"
import { X2EarnApps__factory, XAllocationVoting__factory } from "../../typechain-types"
import { formatEther } from "ethers"
import { ethers } from "hardhat"

const VECHAIN_GAS_PRICE = 1e-5 //Current gas price in VTHO 10^5

async function main() {
  const [voter] = await ethers.getSigners()

  console.log("\n=== VOTING GAS ESTIMATION ===")
  console.log("Gas Price:", VECHAIN_GAS_PRICE, "VTHO")
  console.log("Voter Wallet Address:", voter.address)

  const config = getConfig()

  // Initialize Thor client
  const thor = ThorClient.at(config.nodeUrl, {
    isPollingEnabled: false,
  })

  // Get current round ID using thor client
  const currentRoundId = await thor.contracts.executeCall(
    config.xAllocationVotingContractAddress,
    ABIContract.ofAbi(XAllocationVoting__factory.abi).getFunction("currentRoundId"),
    [],
  )
  const roundSnapshot = await thor.contracts.executeCall(
    config.xAllocationVotingContractAddress,
    ABIContract.ofAbi(XAllocationVoting__factory.abi).getFunction("currentRoundSnapshot"),
    [],
  )
  const roundId = currentRoundId.result?.array?.[0]?.toString() ?? "0"
  const roundSnapshotBlock = roundSnapshot.result?.array?.[0]?.toString() ?? "0"

  console.log("\n=== ROUND INFO ===")
  console.log("Round ID:", roundId)
  console.log("Snapshot Block:", roundSnapshotBlock)

  // Get wallet votes on snapshot
  const walletVotes = await thor.contracts.executeCall(
    config.xAllocationVotingContractAddress,
    ABIContract.ofAbi(XAllocationVoting__factory.abi).getFunction("getVotes"),
    [voter.address, roundSnapshotBlock],
  )
  const walletVotesInRound = BigInt(walletVotes.result?.array?.[0]?.toString() ?? "0")

  // Get all eligible apps using thor client
  const allAppsResult = await thor.contracts.executeCall(
    config.x2EarnAppsContractAddress,
    ABIContract.ofAbi(X2EarnApps__factory.abi).getFunction("allEligibleApps"),
    [],
  )
  const allApps = (allAppsResult.result?.array?.[0] ?? []) as string[]
  console.log("Total Apps:", allApps.length)
  console.log("Wallet Voting Power:", formatEther(walletVotesInRound))

  console.log("\n=== GAS ESTIMATES ===")
  console.log("Batch Size | Total Gas | VTHO Cost")
  console.log("-----------|-----------|-----------")

  // Create test batches
  const batchSizes = [1, 5, 10, 25, 50, 75, 100, allApps.length].sort((a, b) => a - b)

  for (const batchSize of batchSizes) {
    if (batchSize > allApps.length) {
      console.log(`Skipping batch size ${batchSize} - exceeds total apps (${allApps.length})`)
      continue
    }

    // Take first batchSize apps
    const appsToVote = allApps.slice(0, batchSize)

    // Calculate vote weights as strings to maintain precision
    const voteWeightPerApp = (walletVotesInRound / BigInt(batchSize)).toString()
    const voteWeights = Array(batchSize).fill(voteWeightPerApp)

    try {
      // Create the clause for voting
      const clause = Clause.callFunction(
        Address.of(config.xAllocationVotingContractAddress),
        ABIContract.ofAbi(XAllocationVoting__factory.abi).getFunction("castVote"),
        [roundId, appsToVote, voteWeights],
      )

      // Estimate gas using the same method as lambda
      const gasResult = await thor.gas.estimateGas([clause], voter.address)
      const vthoEstimated = (gasResult.totalGas * VECHAIN_GAS_PRICE).toFixed(2)

      // Print results in table format
      console.log(
        `${batchSize.toString().padEnd(10)} | ${
          gasResult?.reverted ? "(REVERTED)".padEnd(9) : gasResult.totalGas.toString().padEnd(9)
        } | ${vthoEstimated} VTHO`,
      )

      if (batchSize === allApps.length) {
        console.log("\n=== FINAL SUMMARY ===")
        console.log(`Total apps: ${allApps.length}`)
        console.log(`Max gas needed: ${gasResult.totalGas}`)
      }
    } catch (error: any) {
      console.error(`Error for batch size ${batchSize}:`, error)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("\n=== ERROR ===")
    console.error(error)
    process.exit(1)
  })
