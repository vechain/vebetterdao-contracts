import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { XAllocationPool } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading XAllocationPool contract at address: ${config.xAllocationPoolContractAddress} on network: ${config.network.name}`,
  )

  console.log(
    "XAllocationPool unallocated funds round IDs to seed: ",
    contractsConfig.X_ALLOCATION_POOL_UNALLOCATED_FUNDS_ROUND_IDS,
  )
  console.log(
    "XAllocationPool unallocated funds V7 amounts to seed: ",
    contractsConfig.X_ALLOCATION_POOL_UNALLOCATED_FUNDS_V7,
  )

  const xAllocationPool = (await upgradeProxy(
    "XAllocationPoolV6",
    "XAllocationPool",
    config.xAllocationPoolContractAddress,
    [
      contractsConfig.X_ALLOCATION_POOL_UNALLOCATED_FUNDS_ROUND_IDS,
      contractsConfig.X_ALLOCATION_POOL_UNALLOCATED_FUNDS_V7,
    ],
    {
      version: 7,
    },
  )) as XAllocationPool

  console.log(`XAllocationPool upgraded`)

  // check that upgrade was successful
  const version = await xAllocationPool.version()
  console.log(`New XAllocationPool version: ${version}`)

  if (parseInt(version) !== 7) {
    throw new Error(`XAllocationPool version is not 7: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
