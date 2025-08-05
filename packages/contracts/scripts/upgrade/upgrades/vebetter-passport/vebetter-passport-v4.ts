import { getConfig } from "@repo/config"
import { saveLibrariesToFile, upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { VeBetterPassport } from "../../../../typechain-types"
import { ethers } from "hardhat"
import { passportLibraries } from "../../../libraries"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const deployer = (await ethers.getSigners())[0]

  console.log(
    `Deploying new version of VeBetterPassport libraries on network: ${config.network.name} (env: ${config.environment}) with account: ${deployer.address}`,
  )
  const {
    PassportChecksLogic,
    PassportConfigurator,
    PassportEntityLogic,
    PassportDelegationLogic,
    PassportPersonhoodLogic,
    PassportPoPScoreLogic,
    PassportSignalingLogic,
    PassportWhitelistAndBlacklistLogic,
  } = await passportLibraries()

  const libraries: {
    VeBetterPassport: Record<string, string>
  } = {
    VeBetterPassport: {
      PassportChecksLogic: await PassportChecksLogic.getAddress(),
      PassportConfigurator: await PassportConfigurator.getAddress(),
      PassportEntityLogic: await PassportEntityLogic.getAddress(),
      PassportDelegationLogic: await PassportDelegationLogic.getAddress(),
      PassportPersonhoodLogic: await PassportPersonhoodLogic.getAddress(),
      PassportPoPScoreLogic: await PassportPoPScoreLogic.getAddress(),
      PassportSignalingLogic: await PassportSignalingLogic.getAddress(),
      PassportWhitelistAndBlacklistLogic: await PassportWhitelistAndBlacklistLogic.getAddress(),
    },
  }

  console.log("Libraries deployed")
  console.log("Libraries", libraries)

  console.log(
    `Upgrading VeBetterPassport contract at address: ${config.veBetterPassportContractAddress} on network: ${config.network.name} (env: ${config.environment}) with account: ${deployer.address}`,
  )

  const RESET_SIGNALER_WALLET = "0x12a7f82621d518aed6bbadc7f9d6d2814934b259" // More info can be found in 1Password (b3tr)
  const veBetterPassport = (await upgradeProxy(
    "VeBetterPassportV3",
    "VeBetterPassport",
    config.veBetterPassportContractAddress,
    [RESET_SIGNALER_WALLET],
    {
      version: 4,
      libraries: {
        PassportChecksLogic: await PassportChecksLogic.getAddress(),
        PassportConfigurator: await PassportConfigurator.getAddress(),
        PassportEntityLogic: await PassportEntityLogic.getAddress(),
        PassportDelegationLogic: await PassportDelegationLogic.getAddress(),
        PassportPersonhoodLogic: await PassportPersonhoodLogic.getAddress(),
        PassportPoPScoreLogic: await PassportPoPScoreLogic.getAddress(),
        PassportSignalingLogic: await PassportSignalingLogic.getAddress(),
        PassportWhitelistAndBlacklistLogic: await PassportWhitelistAndBlacklistLogic.getAddress(),
      },
    },
  )) as VeBetterPassport

  console.log(`VeBetterPassport upgraded`)

  // check that upgrade was successful
  const version = await veBetterPassport.version()
  console.log(`New VeBetterPassport version: ${version}`)

  if (parseInt(version) !== 4) {
    throw new Error(`VeBetterPassport version is not the expected one: ${version}`)
  }

  console.log("Execution completed")

  await saveLibrariesToFile(libraries)
  process.exit(0)
}

// Execute the main function
main()
