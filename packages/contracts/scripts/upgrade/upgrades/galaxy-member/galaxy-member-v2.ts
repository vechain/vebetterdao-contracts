import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { GalaxyMember } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading GalaxyMember contract at address: ${config.galaxyMemberContractAddress} on network: ${config.network.name}`,
  )

  const galaxyMemberV2 = (await upgradeProxy(
    "GalaxyMemberV1",
    "GalaxyMember",
    config.galaxyMemberContractAddress,
    [
      contractsConfig.VECHAIN_NODES_CONTRACT_ADDRESS,
      config.nodeManagementContractAddress,
      contractsConfig.CONTRACTS_ADMIN_ADDRESS,
      contractsConfig.GM_NFT_NODE_TO_FREE_LEVEL,
    ],
    {
      version: 2,
    },
  )) as GalaxyMember

  console.log(`GalaxyMember upgraded`)

  // check that upgrade was successful
  const version = await galaxyMemberV2.version()
  console.log(`New GalaxyMember version: ${version}`)

  if (parseInt(version) !== 2) {
    throw new Error(`GalaxyMember version is not 2: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
