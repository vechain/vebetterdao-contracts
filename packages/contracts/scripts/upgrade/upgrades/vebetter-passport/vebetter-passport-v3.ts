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
  } = await passportLibraries({ logOutput: true, latestVersionOnly: true })

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

  const veBetterPassport = (await upgradeProxy(
    "VeBetterPassportV2",
    "VeBetterPassport",
    config.veBetterPassportContractAddress,
    [],
    {
      version: 3,
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

  if (parseInt(version) !== 3) {
    throw new Error(`VeBetterPassport version is not the expected one: ${version}`)
  }

  console.log("Execution completed")

  await saveLibrariesToFile(libraries)
  process.exit(0)
}

// Execute the main function
main()
