import { getConfig } from "@repo/config"
import { EnvConfig } from "@repo/config/contracts"
import { RelayerRewardsPool } from "../../../../typechain-types"
import { upgradeProxy } from "../../../helpers"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const deployer = (await ethers.getSigners())[0]

  const relayerRewardsPoolV1 = await ethers.getContractAt(
    "RelayerRewardsPoolV1",
    config.relayerRewardsPoolContractAddress,
  )
  const currentVersion = await relayerRewardsPoolV1.version()
  console.log("Current contract version:", currentVersion)

  console.log(
    `Upgrading RelayerRewardsPool contract at address: ${config.relayerRewardsPoolContractAddress} on network: ${config.network.name} with account: ${deployer.address}`,
  )

  const relayerRewardsPoolV2 = (await upgradeProxy(
    "RelayerRewardsPoolV1",
    "RelayerRewardsPool",
    config.relayerRewardsPoolContractAddress,
    [],
    { version: 2 },
  )) as RelayerRewardsPool

  console.log("RelayerRewardsPool upgraded")

  const version = await relayerRewardsPoolV2.version()
  console.log(`New RelayerRewardsPool version: ${version}`)

  if (parseInt(version) !== 2) {
    throw new Error(`RelayerRewardsPool version is not 2: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

main()
