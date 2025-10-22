import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { XAllocationVoting, RelayerRewardsPool } from "../../../../typechain-types"
import { autoVotingLibraries } from "../../../libraries/autoVotingLibraries"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  // Verify RelayerRewardsPool exists in config
  if (!config.relayerRewardsPoolContractAddress) {
    throw new Error("RelayerRewardsPool contract address not found in config. Please deploy RelayerRewardsPool first.")
  }

  const { AutoVotingLogic } = await autoVotingLibraries()
  console.log("AutoVotingLogic Library deployed address: ", await AutoVotingLogic.getAddress())

  console.log(
    `Upgrading XAllocationVoting contract at address: ${config.xAllocationVotingContractAddress} on network: ${config.network.name}`,
  )

  const xAllocationVotingV8 = (await upgradeProxy(
    "XAllocationVotingV7",
    "XAllocationVoting",
    config.xAllocationVotingContractAddress,
    [],
    {
      version: 8,
      libraries: {
        AutoVotingLogic: await AutoVotingLogic.getAddress(),
      },
    },
  )) as XAllocationVoting

  console.log(`XAllocationVoting upgraded`)

  // check that upgrade was successful
  const version = await xAllocationVotingV8.version()
  console.log(`New XAllocationVoting version: ${version}`)

  if (parseInt(version) !== 8) {
    throw new Error(`XAllocationVoting version is not 8: ${version}`)
  }

  // Set up auto-voting integration with RelayerRewardsPool
  console.log("Setting up auto-voting integration...")

  const deployer = (await ethers.getSigners())[0]

  // Set RelayerRewardsPool address in XAllocationVoting
  console.log("Setting RelayerRewardsPool address in XAllocationVoting...")
  await xAllocationVotingV8
    .connect(deployer)
    .setRelayerRewardsPoolAddress(config.relayerRewardsPoolContractAddress)
    .then(async tx => await tx.wait())

  // Grant POOL_ADMIN_ROLE to XAllocationVoting in RelayerRewardsPool
  console.log("Granting POOL_ADMIN_ROLE to XAllocationVoting in RelayerRewardsPool...")
  const relayerRewardsPool = (await ethers.getContractAt(
    "RelayerRewardsPool",
    config.relayerRewardsPoolContractAddress,
  )) as unknown as RelayerRewardsPool
  const POOL_ADMIN_ROLE = await relayerRewardsPool.POOL_ADMIN_ROLE()

  await relayerRewardsPool
    .connect(deployer)
    .grantRole(POOL_ADMIN_ROLE, config.xAllocationVotingContractAddress)
    .then(async tx => await tx.wait())

  // Verify the role was granted successfully
  const hasRole = await relayerRewardsPool.hasRole(POOL_ADMIN_ROLE, config.xAllocationVotingContractAddress)
  if (!hasRole) {
    throw new Error("Failed to grant POOL_ADMIN_ROLE to XAllocationVoting in RelayerRewardsPool")
  }

  console.log("XAllocationVoting v8 upgrade and auto-voting integration completed successfully")
  console.log("Next step: Run VoterRewards v6 upgrade")
  console.log("Execution completed")
  process.exit(0)
}

main()
