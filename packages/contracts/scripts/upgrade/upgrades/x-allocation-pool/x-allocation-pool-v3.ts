import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { XAllocationPool } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading XAllocationPool contract at address: ${config.xAllocationPoolContractAddress} on network: ${config.network.name}`,
  )

  const xAllocationPoolV2 = (await upgradeProxy(
    "XAllocationPoolV2",
    "XAllocationPool",
    config.xAllocationPoolContractAddress,
    [],
    {
      version: 3,
    },
  )) as XAllocationPool

  console.log(`XAllocationPool upgraded`)

  // check that upgrade was successful
  const version = await xAllocationPoolV2.version()
  console.log(`New XAllocationPool version: ${version}`)

  if (parseInt(version) !== 3) {
    throw new Error(`XAllocationPool version is not 3: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
