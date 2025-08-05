import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { NodeManagement } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading NodeManagement contract at address: ${config.nodeManagementContractAddress} on network: ${config.network.name}`,
  )

  const nodeManagementV2 = (await upgradeProxy(
    "NodeManagementV1",
    "NodeManagement",
    config.nodeManagementContractAddress,
    [],
    {
      version: 2,
    },
  )) as NodeManagement

  console.log(`NodeManagement upgraded`)

  // check that upgrade was successful
  const version = await nodeManagementV2.version()
  console.log(`New NodeManagement version: ${version}`)

  if (parseInt(version) !== 2) {
    throw new Error(`NodeManagement version is not 2: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
