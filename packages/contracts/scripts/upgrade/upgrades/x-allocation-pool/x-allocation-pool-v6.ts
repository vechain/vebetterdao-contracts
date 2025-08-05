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

  const xAllocationPoolV5 = (await upgradeProxy(
    "XAllocationPoolV5",
    "XAllocationPool",
    config.xAllocationPoolContractAddress,
    [],
    {
      version: 6,
    },
  )) as XAllocationPool

  console.log(`XAllocationPool upgraded`)

  // check that upgrade was successful
  const version = await xAllocationPoolV5.version()
  console.log(`New XAllocationPool version: ${version}`)

  if (parseInt(version) !== 6) {
    throw new Error(`XAllocationPool version is not 6: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
