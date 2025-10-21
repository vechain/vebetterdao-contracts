import { deployAndInitializeLatest } from "../../helpers"
import { XAllocationVoting } from "../../../typechain-types"
import { getConfig } from "@repo/config"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { ethers } from "hardhat"
import { autoVotingLibraries } from "../../libraries/autoVotingLibraries"

/**
 * This script is used to deploy the XAllocationVoting contract that is not associated with contracts.
 * This is for those who only cares about testing the XAllocationVoting specific storage or features.
 */
export async function main() {
  const config = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const envConfig = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const deployer = (await ethers.getSigners())[0]

  const TEMP_ADMIN = envConfig.network.name === "solo" ? config.CONTRACTS_ADMIN_ADDRESS : deployer.address

  console.log(
    `================  Deploying contracts on ${envConfig.network.name} (${envConfig.nodeUrl}) with ${envConfig.environment} configurations `,
  )
  console.log(`================  Address used to deploy: ${deployer.address}`)

  const vot3TokenAddress = ethers.ZeroAddress
  const timelockAddress = ethers.ZeroAddress
  const voterRewardsAddress = ethers.ZeroAddress
  const emissionsAddress = ethers.ZeroAddress
  const x2EarnAppsAddress = ethers.ZeroAddress
  const veBetterPassportAddress = ethers.ZeroAddress

  const { AutoVotingLogic } = await autoVotingLibraries()

  const xAllocationVoting = (await deployAndInitializeLatest(
    "XAllocationVoting",
    [
      {
        name: "initialize",
        args: [
          {
            vot3Token: vot3TokenAddress,
            quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE,
            initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1,
            timeLock: timelockAddress,
            voterRewards: voterRewardsAddress,
            emissions: emissionsAddress,
            admins: [timelockAddress, TEMP_ADMIN],
            upgrader: TEMP_ADMIN,
            contractsAddressManager: TEMP_ADMIN,
            x2EarnAppsAddress: x2EarnAppsAddress,
            baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
            appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
            votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
          },
        ],
      },
      {
        name: "initializeV2",
        args: [veBetterPassportAddress],
      },
    ],
    {
      AutoVotingLogic: await AutoVotingLogic.getAddress(),
    },
    true,
  )) as XAllocationVoting

  await xAllocationVoting.waitForDeployment()

  console.log("XAllocationVoting address: ", await xAllocationVoting.getAddress())

  console.log("================  Execution completed")
  process.exit(0)
}

main()
