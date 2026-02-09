import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { AppEnv, EnvConfig } from "@repo/config/contracts"
import { X2EarnCreator } from "../../../../typechain-types"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const deployer = (await ethers.getSigners())[0]

  const x2EarnCreator = await ethers.getContractAt("X2EarnCreatorV1", config.x2EarnCreatorContractAddress)
  const currentVersion = await x2EarnCreator.version()
  console.log("Current contract version:", currentVersion)
  if (parseInt(currentVersion) === 2) {
    console.log("X2EarnCreator is already at version 2, you are upgrading to the same version")
  }

  console.log(
    `Upgrading X2EarnCreator contract at address: ${config.x2EarnCreatorContractAddress} on network: ${config.network.name} (env: ${config.environment}) with account: ${deployer.address}`,
  )

  const x2EarnCreatorV2 = (await upgradeProxy(
    "X2EarnCreatorV1",
    "X2EarnCreator",
    config.x2EarnCreatorContractAddress,
    [config.environment === AppEnv.TESTNET_STAGING ? true : false],
    { version: 2 },
  )) as X2EarnCreator

  console.log(`X2EarnCreator upgraded`)

  const version = await x2EarnCreatorV2.version()
  console.log(`New X2EarnCreator version: ${version}`)

  if (parseInt(version) !== 2) {
    throw new Error(`X2EarnCreator version is not 2: ${version}`)
  }

  const selfMintEnabled = await x2EarnCreatorV2.selfMintEnabled()
  console.log(`selfMintEnabled: ${selfMintEnabled}`)

  const expectedSelfMintEnabled = config.environment === AppEnv.TESTNET_STAGING ? true : false

  if (selfMintEnabled !== expectedSelfMintEnabled) {
    throw new Error(`selfMintEnabled should be ${expectedSelfMintEnabled} after upgrade`)
  }

  console.log("Execution completed")
  process.exit(0)
}

main()
