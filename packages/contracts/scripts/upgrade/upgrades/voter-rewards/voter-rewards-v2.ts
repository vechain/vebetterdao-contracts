import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { VoterRewards } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading VoterRewards contract at address: ${config.voterRewardsContractAddress} on network: ${config.network.name}`,
  )

  const voterRewardsV2 = (await upgradeProxy("VoterRewardsV1", "VoterRewards", config.voterRewardsContractAddress, [], {
    version: 2,
  })) as VoterRewards

  console.log(`VoterRewards upgraded`)

  // check that upgrade was successful
  const version = await voterRewardsV2.version()
  console.log(`New VoterRewards version: ${version}`)

  if (parseInt(version) !== 2) {
    throw new Error(`VoterRewards version is not 2: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
