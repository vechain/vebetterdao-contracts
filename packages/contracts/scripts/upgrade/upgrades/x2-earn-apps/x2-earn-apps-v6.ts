import { getConfig } from "@repo/config"
import { saveLibrariesToFile, upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { X2EarnApps } from "../../../../typechain-types"
import { ethers } from "hardhat"
import { x2EarnLibraries } from "../../../libraries/x2EarnLibraries"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const deployer = (await ethers.getSigners())[0]

  // check if already at the desired version
  const x2EarnApps = await ethers.getContractAt("X2EarnApps", config.x2EarnAppsContractAddress)
  const currentVersion = await x2EarnApps.version()
  console.log("Current contract version:", currentVersion)
  if (parseInt(currentVersion) === 6) {
    console.log("X2EarnApps is already at version 6, you are upgrading to the same version")
  }

  console.log(
    `Deploying X2EarnApps libraries on network: ${config.network.name} (env: ${config.environment}) with account: ${deployer.address}`,
  )
  const { AdministrationUtils, EndorsementUtils, VoteEligibilityUtils } = await x2EarnLibraries(true)

  const libraries: {
    X2EarnApps: Record<string, string>
  } = {
    X2EarnApps: {
      AdministrationUtils: await AdministrationUtils.getAddress(),
      EndorsementUtils: await EndorsementUtils.getAddress(),
      VoteEligibilityUtils: await VoteEligibilityUtils.getAddress(),
    },
  }

  console.log("Libraries deployed")
  console.log("Libraries", libraries)

  console.log(
    `Upgrading X2EarnApps contract at address: ${config.x2EarnAppsContractAddress} on network: ${config.network.name}`,
  )

  const x2EarnAppsV6 = (await upgradeProxy("X2EarnAppsV5", "X2EarnApps", config.x2EarnAppsContractAddress, [], {
    version: 6,
    libraries: {
      AdministrationUtils: await AdministrationUtils.getAddress(),
      EndorsementUtils: await EndorsementUtils.getAddress(),
      VoteEligibilityUtils: await VoteEligibilityUtils.getAddress(),
    },
  })) as X2EarnApps

  console.log(`X2EarnApps upgraded`)

  // check that upgrade was successful
  const version = await x2EarnAppsV6.version()
  console.log(`New X2EarnApps version: ${version}`)

  if (parseInt(version) !== 6) {
    throw new Error(`X2EarnApps version is not 6: ${version}`)
  }

  console.log("Execution completed")

  await saveLibrariesToFile(libraries)
  process.exit(0)
}

// Execute the main function
main()
