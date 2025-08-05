import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { GalaxyMember } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading GalaxyMember contract at address: ${config.galaxyMemberContractAddress} on network: ${config.network.name}`,
  )

  const galaxyMemberV4 = (await upgradeProxy("GalaxyMemberV3", "GalaxyMember", config.galaxyMemberContractAddress, [], {
    version: 4,
  })) as GalaxyMember

  console.log(`GalaxyMember upgraded`)

  // check that upgrade was successful
  const version = await galaxyMemberV4.version()
  console.log(`New GalaxyMember version: ${version}`)

  if (parseInt(version) !== 4) {
    throw new Error(`GalaxyMember version is not 4: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
