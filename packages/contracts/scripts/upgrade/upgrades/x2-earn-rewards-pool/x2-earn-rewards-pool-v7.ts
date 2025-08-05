import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { X2EarnRewardsPool } from "../../../../typechain-types"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading X2EarnRewardsPool contract at address: ${config.x2EarnRewardsPoolContractAddress} on network: ${config.network.name}`,
  )
  const x2EarnRewardsPoolCurrent = await ethers.getContractAt(
    "X2EarnRewardsPool",
    config.x2EarnRewardsPoolContractAddress,
  )
  const currentVersion = await x2EarnRewardsPoolCurrent.version()
  console.log("Current contract version:", currentVersion)
  if (parseInt(currentVersion) === 7) {
    console.log("X2EarnRewardsPool is already at version 7, skipping upgrade")
    process.exit(0)
  }

  const x2EarnRewardsPool = (await upgradeProxy(
    "X2EarnRewardsPoolV6",
    "X2EarnRewardsPool",
    config.x2EarnRewardsPoolContractAddress,
    [],
    {
      version: 7,
    },
  )) as X2EarnRewardsPool

  console.log(`X2EarnRewardsPool upgraded`)

  // check that upgrade was successful
  const version = await x2EarnRewardsPool.version()
  console.log(`New X2EarnRewardsPool version: ${version}`)

  if (parseInt(version) !== 7) {
    throw new Error(`X2EarnRewardsPool version is not the expected one: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
