import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { GrantsManager } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading GrantsManager contract at address: ${config.grantsManagerContractAddress} on network: ${config.network.name}`,
  )

  const grantsManager = (await upgradeProxy(
    "GrantsManagerV1",
    "GrantsManager",
    config.grantsManagerContractAddress,
    [],
    {
      version: 2,
    },
  )) as GrantsManager

  console.log(`GrantsManager upgraded`)

  // check that upgrade was successful
  const version = await grantsManager.version()
  console.log(`New GrantsManager version: ${version}`)

  if (BigInt(version) !== 2n) {
    throw new Error(`GrantsManager version is not the expected one: ${version}`)
  }

  console.log("Execution completed")

  process.exit(0)
}

// Execute the main function
main()
