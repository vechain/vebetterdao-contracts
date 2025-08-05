import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { VoterRewards } from "../../../../typechain-types"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading VoterRewards contract at address: ${config.voterRewardsContractAddress} on network: ${config.network.name}`,
  )

  const emissionsContract = await ethers.getContractAt("Emissions", config.emissionsContractAddress)
  const emissionsVersion = await emissionsContract.version()
  if (parseInt(emissionsVersion) !== 3) {
    console.log(`Emissions version is not 3: ${emissionsVersion}`)
    console.log("Please upgrade Emissions contract first")
    process.exit(1)
  }

  const voterRewardsV5 = (await upgradeProxy(
    "VoterRewardsV4",
    "VoterRewards",
    config.voterRewardsContractAddress,
    [contractsConfig.VOTER_REWARDS_LEVELS_V2, contractsConfig.GM_MULTIPLIERS_V2],
    {
      version: 5,
    },
  )) as VoterRewards

  console.log(`VoterRewards upgraded`)

  // check that upgrade was successful
  const version = await voterRewardsV5.version()
  console.log(`New VoterRewards version: ${version}`)

  if (parseInt(version) !== 5) {
    throw new Error(`VoterRewards version is not 5: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
