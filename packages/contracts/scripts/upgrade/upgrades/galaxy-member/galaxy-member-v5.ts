import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { GalaxyMember } from "../../../../typechain-types"
import { network } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log("Hardhat network name:", network.name, network)

  console.log(
    `Upgrading GalaxyMember contract at address: ${config.galaxyMemberContractAddress} on network: ${config.network.name}`,
  )

  const galaxyMemberV5 = (await upgradeProxy("GalaxyMemberV4", "GalaxyMember", config.galaxyMemberContractAddress, [], {
    version: 5,
  })) as GalaxyMember

  console.log(`GalaxyMember upgraded`)

  // check that upgrade was successful
  const version = await galaxyMemberV5.version()
  console.log(`New GalaxyMember version: ${version}`)

  if (parseInt(version) !== 5) {
    throw new Error(`GalaxyMember version is not 5: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
