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

  console.log(
    `Upgrading VoterRewards contract at address: ${config.voterRewardsContractAddress} on network: ${config.network.name}`,
  )

  const galaxyMemberContract = await ethers.getContractAt("GalaxyMember", config.galaxyMemberContractAddress)

  const gmVersion = await galaxyMemberContract.version()
  if (parseInt(gmVersion) !== 3) {
    console.log(`GalaxyMember version is not 3: ${gmVersion}`)
    console.log("Please upgrade GalaxyMember contract first")
    process.exit(1)
  }

  const voterRewardsV4 = (await upgradeProxy("VoterRewardsV3", "VoterRewards", config.voterRewardsContractAddress, [], {
    version: 4,
  })) as VoterRewards

  console.log(`VoterRewards upgraded`)

  // check that upgrade was successful
  const version = await voterRewardsV4.version()
  console.log(`New VoterRewards version: ${version}`)

  if (parseInt(version) !== 4) {
    throw new Error(`VoterRewards version is not 4: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
