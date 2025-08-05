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
  const deployer = (await ethers.getSigners())[0]

  console.log(
    `Upgrading X2EarnRewardsPool contract at address: ${config.b3trGovernorAddress} on network: ${config.network.name} (env: ${config.environment}) with account: ${deployer.address}`,
  )

  const x2EarnRewardsPool = (await upgradeProxy(
    "X2EarnRewardsPoolV2",
    "X2EarnRewardsPool",
    config.x2EarnRewardsPoolContractAddress,
    [config.veBetterPassportContractAddress],
    {
      version: 3,
    },
  )) as X2EarnRewardsPool

  console.log(`X2EarnRewardsPool upgraded`)

  // check that upgrade was successful
  const version = await x2EarnRewardsPool.version()
  console.log(`New X2EarnRewardsPool version: ${version}`)

  if (parseInt(version) !== 3) {
    throw new Error(`X2EarnRewardsPool version is not the expected one: ${version}`)
  }

  // We need to assign the ACTION_REGISTRAR_ROLE inside VeBetterPassport to the X2EarnRewardsPool contract
  console.log("Assigning ACTION_REGISTRAR_ROLE to X2EarnRewardsPool contract")
  const veBetterPassport = await ethers.getContractAt("VeBetterPassport", config.veBetterPassportContractAddress)
  const ACTION_REGISTRAR_ROLE = await veBetterPassport.ACTION_REGISTRAR_ROLE()
  await veBetterPassport
    .connect(deployer)
    .grantRole(ACTION_REGISTRAR_ROLE, config.x2EarnRewardsPoolContractAddress)
    .then(async tx => await tx.wait())

  // check that the role was assigned successfully
  const hasRole = await veBetterPassport.hasRole(ACTION_REGISTRAR_ROLE, config.x2EarnRewardsPoolContractAddress)
  if (!hasRole) {
    throw new Error(`Failed to assign ACTION_REGISTRAR_ROLE to X2EarnRewardsPool contract`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
