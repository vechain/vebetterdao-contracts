import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { X2EarnRewardsPool } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading X2EarnRewardsPool contract at address: ${config.x2EarnRewardsPoolContractAddress} on network: ${config.network.name}`,
  )

  const x2EarnRewardsPool = (await upgradeProxy(
    "X2EarnRewardsPoolV5",
    "X2EarnRewardsPool",
    config.x2EarnRewardsPoolContractAddress,
    [],
    {
      version: 6,
    },
  )) as X2EarnRewardsPool

  console.log(`X2EarnRewardsPool upgraded`)

  // check that upgrade was successful
  const version = await x2EarnRewardsPool.version()
  console.log(`New X2EarnRewardsPool version: ${version}`)

  if (parseInt(version) !== 6) {
    throw new Error(`X2EarnRewardsPool version is not the expected one: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
