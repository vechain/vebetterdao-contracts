import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { Emissions } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading Emissions contract at address: ${config.emissionsContractAddress} on network: ${config.network.name}`,
  )

  const emissions = (await upgradeProxy(
    "EmissionsV2",
    "Emissions",
    config.emissionsContractAddress,
    [contractsConfig.GM_PERCENTAGE_OF_TREASURY],
    {
      version: 3,
    },
  )) as Emissions

  console.log(`Emissions upgraded`)

  // check that upgrade was successful
  const version = await emissions.version()
  console.log(`New Emissions version: ${version}`)

  if (parseInt(version) !== 3) {
    throw new Error(`Emissions version is not the expected one: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
