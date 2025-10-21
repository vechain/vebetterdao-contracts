import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { VoterRewards } from "../../../../typechain-types"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  // Verify required contracts are upgraded/deployed
  console.log("Verifying prerequisites...")

  // Check XAllocationVoting is v8
  const xAllocationVoting = await ethers.getContractAt("XAllocationVoting", config.xAllocationVotingContractAddress)
  const xAllocationVotingVersion = await xAllocationVoting.version()
  if (parseInt(xAllocationVotingVersion) !== 8) {
    console.log(`XAllocationVoting version is not 8: ${xAllocationVotingVersion}`)
    console.log("Please upgrade XAllocationVoting contract to v8 first")
    process.exit(1)
  }
  console.log(`XAllocationVoting is at version: ${xAllocationVotingVersion}`)

  // Check RelayerRewardsPool exists
  if (!config.relayerRewardsPoolContractAddress) {
    throw new Error("RelayerRewardsPool contract address not found in config. Please deploy RelayerRewardsPool first.")
  }

  // Verify RelayerRewardsPool is accessible
  const relayerRewardsPool = await ethers.getContractAt("RelayerRewardsPool", config.relayerRewardsPoolContractAddress)
  const relayerRewardsPoolVersion = await relayerRewardsPool.version()
  console.log(`RelayerRewardsPool found at version: ${relayerRewardsPoolVersion}`)

  console.log(
    `Upgrading VoterRewards contract at address: ${config.voterRewardsContractAddress} on network: ${config.network.name}`,
  )

  const voterRewardsV6 = (await upgradeProxy(
    "VoterRewardsV5",
    "VoterRewards",
    config.voterRewardsContractAddress,
    [config.xAllocationVotingContractAddress, config.relayerRewardsPoolContractAddress],
    {
      version: 6,
    },
  )) as VoterRewards

  console.log(`VoterRewards upgraded`)

  // check that upgrade was successful
  const version = await voterRewardsV6.version()
  console.log(`New VoterRewards version: ${version}`)

  if (parseInt(version) !== 6) {
    throw new Error(`VoterRewards version is not 6: ${version}`)
  }

  // Set up VoterRewards integration
  console.log("Setting up VoterRewards auto-voting integration...")

  const deployer = (await ethers.getSigners())[0]

  // Grant POOL_ADMIN_ROLE to VoterRewards in RelayerRewardsPool
  console.log("Granting POOL_ADMIN_ROLE to VoterRewards in RelayerRewardsPool...")
  const POOL_ADMIN_ROLE = await relayerRewardsPool.POOL_ADMIN_ROLE()

  await relayerRewardsPool
    .connect(deployer)
    .grantRole(POOL_ADMIN_ROLE, config.voterRewardsContractAddress)
    .then(async tx => await tx.wait())

  // Verify the role was granted successfully
  const hasRole = await relayerRewardsPool.hasRole(POOL_ADMIN_ROLE, config.voterRewardsContractAddress)
  if (!hasRole) {
    throw new Error("Failed to grant POOL_ADMIN_ROLE to VoterRewards in RelayerRewardsPool")
  }

  console.log("VoterRewards v6 upgrade and auto-voting integration completed successfully")
  console.log("Auto-voting system is now fully operational!")
  console.log("Execution completed")
  process.exit(0)
}

main()
