import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { X2EarnRewardsPool } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading X2EarnRewardsPool contract at address: ${config.x2EarnRewardsPoolContractAddress} on network: ${config.network.name}`,
  )

  const x2EarnRewardsPool = (await upgradeProxy(
    "X2EarnRewardsPoolV1",
    "X2EarnRewardsPool",
    config.x2EarnRewardsPoolContractAddress,
    [contractsConfig.CONTRACTS_ADMIN_ADDRESS, contractsConfig.X_2_EARN_INITIAL_IMPACT_KEYS],
    {
      version: 2,
    },
  )) as X2EarnRewardsPool

  console.log(`X2EarnRewardsPool upgraded`)

  // check that upgrade was successful
  const version = await x2EarnRewardsPool.version()
  console.log(`New X2EarnRewardsPool version: ${version}`)

  if (parseInt(version) !== 2) {
    throw new Error(`X2EarnRewardsPool version is not the expected one: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
