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

  console.log("Hardhat network name:", network.name)

  console.log(
    `Upgrading GalaxyMember contract at address: ${config.galaxyMemberContractAddress} on network: ${config.network.name}`,
  )

  console.log(`StargateNFT contract address: ${config.stargateNFTContractAddress}`)

  const galaxyMemberV6 = (await upgradeProxy(
    "GalaxyMemberV5",
    "GalaxyMember",
    config.galaxyMemberContractAddress,
    [config.stargateNFTContractAddress],
    {
      version: 6,
    },
  )) as GalaxyMember

  console.log(`GalaxyMember upgraded`)

  // check that upgrade was successful
  const version = await galaxyMemberV6.version()
  console.log(`New GalaxyMember version: ${version}`)

  if (parseInt(version) !== 6) {
    throw new Error(`GalaxyMember version is not 6: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
