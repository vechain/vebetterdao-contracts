import { getConfig } from "@repo/config"
import { saveLibrariesToFile, upgradeProxy } from "../../../helpers"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { X2EarnApps } from "../../../../typechain-types"
import { ethers } from "hardhat"
import { x2EarnLibraries } from "../../../libraries/x2EarnLibraries"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const deployer = (await ethers.getSigners())[0]

  console.log(
    `Deploying X2EarnApps libraries on network: ${config.network.name} (env: ${config.environment}) with account: ${deployer.address}`,
  )
  const { AdministrationUtils, EndorsementUtils, VoteEligibilityUtils } = await x2EarnLibraries()

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

  // Check if the node management contract is deployed
  if (!config.nodeManagementContractAddress) {
    console.log("NodeManagement contract not deployed, please deploy it first")
    process.exit(1)
  }

  const nodeManagementContract = await ethers.getContractAt("NodeManagement", config.nodeManagementContractAddress)
  try {
    await nodeManagementContract.version()
  } catch (e) {
    console.log("NodeManagement contract is not deployed")
    console.log("Please deploy the NodeManagement contract first")
    process.exit(1)
  }

  const x2EarnAppsV2 = (await upgradeProxy(
    "X2EarnAppsV1",
    "X2EarnApps",
    config.x2EarnAppsContractAddress,
    [
      contractsConfig.XAPP_GRACE_PERIOD,
      config.nodeManagementContractAddress,
      config.veBetterPassportContractAddress,
      config.x2EarnCreatorContractAddress,
    ],
    {
      version: 2,
      libraries: {
        AdministrationUtils: await AdministrationUtils.getAddress(),
        EndorsementUtils: await EndorsementUtils.getAddress(),
        VoteEligibilityUtils: await VoteEligibilityUtils.getAddress(),
      },
    },
  )) as X2EarnApps

  console.log(`X2EarnApps upgraded`)

  // check that upgrade was successful
  const version = await x2EarnAppsV2.version()
  console.log(`New X2EarnApps version: ${version}`)

  if (parseInt(version) !== 2) {
    throw new Error(`X2EarnApps version is not 2: ${version}`)
  }

  console.log("Execution completed")

  await saveLibrariesToFile(libraries)
  process.exit(0)
}

// Execute the main function
main()
