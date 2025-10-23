import { getConfig } from "@repo/config"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { deployProxy } from "../../helpers"
import { DBAPool } from "../../../typechain-types"
import { ethers } from "hardhat"
import { updateConfig } from "../../helpers/config"

export async function deployDBAPool() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const envConfig = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const deployer = (await ethers.getSigners())[0]

  console.log(
    `================  Deploying contracts on ${envConfig.network.name} (${envConfig.nodeUrl}) with ${envConfig.environment} configurations `,
  )
  console.log(`================  Address used to deploy: ${deployer.address}`)

  // We use a temporary admin to deploy and initialize contracts then transfer role to the real admin
  // Also we have many roles in our contracts but we currently use one wallet for all roles
  const TEMP_ADMIN = envConfig.network.name === "solo" ? contractsConfig.CONTRACTS_ADMIN_ADDRESS : deployer.address
  console.log("================================================================================")
  console.log("Temporary admin set to ", TEMP_ADMIN)
  console.log("Final admin will be set to ", contractsConfig.CONTRACTS_ADMIN_ADDRESS)
  console.log("================================================================================")

  const X2_EARN_APPS_ADDRESS = envConfig.x2EarnAppsContractAddress
  const X_ALLOCATION_POOL_ADDRESS = envConfig.xAllocationPoolContractAddress
  const X2_EARN_REWARDS_POOL_ADDRESS = envConfig.x2EarnRewardsPoolContractAddress
  const B3TR_CONTRACT_ADDRESS = envConfig.b3trContractAddress
  const DISTRIBUTION_START_ROUND = contractsConfig.DBA_DISTRIBUTION_START_ROUND

  console.log("Deploying proxy for DBA Pool with params:")
  console.log("X2EarnApps Address: ", X2_EARN_APPS_ADDRESS)
  console.log("XAllocationPool Address: ", X_ALLOCATION_POOL_ADDRESS)
  console.log("X2EarnRewardsPool Address: ", X2_EARN_REWARDS_POOL_ADDRESS)
  console.log("B3TR Contract Address: ", B3TR_CONTRACT_ADDRESS)
  console.log("Distribution Start Round: ", DISTRIBUTION_START_ROUND)

  const dbaPool = (await deployProxy("DBAPool", [
    {
      admin: TEMP_ADMIN,
      x2EarnApps: X2_EARN_APPS_ADDRESS,
      xAllocationPool: X_ALLOCATION_POOL_ADDRESS,
      x2earnRewardsPool: X2_EARN_REWARDS_POOL_ADDRESS,
      b3tr: B3TR_CONTRACT_ADDRESS,
      distributionStartRound: DISTRIBUTION_START_ROUND,
    },
  ])) as DBAPool

  console.log(`================  Contract deployed at ${await dbaPool.getAddress()}`)

  console.log("Checking that params are set correctly")
  const x2EarnApps = await dbaPool.x2EarnApps()
  const xAllocationPool = await dbaPool.xAllocationPool()
  const x2EarnRewardsPool = await dbaPool.x2EarnRewardsPool()
  const b3tr = await dbaPool.b3tr()
  const distributionStartRound = await dbaPool.distributionStartRound()

  if (
    x2EarnApps.toLowerCase() !== X2_EARN_APPS_ADDRESS.toLowerCase() ||
    xAllocationPool.toLowerCase() !== X_ALLOCATION_POOL_ADDRESS.toLowerCase() ||
    x2EarnRewardsPool.toLowerCase() !== X2_EARN_REWARDS_POOL_ADDRESS.toLowerCase() ||
    b3tr.toLowerCase() !== B3TR_CONTRACT_ADDRESS.toLowerCase() ||
    distributionStartRound !== BigInt(DISTRIBUTION_START_ROUND)
  ) {
    console.log("ERROR: Params are not set correctly")
    process.exit(1)
  }

  console.log("================  Configuring roles")
  console.log(
    "INFO: roles will not be set automatically in this script, allowing the deployer to handle possible issues in the next days",
  )
  console.log("INFO: Remember to grant UPGRADER_ROLE and DISTRIBUTOR_ROLE to the appropriate addresses")

  console.log("================================================================================")
  console.log(`Updating the config file with the new DBA Pool contract address`)
  try {
    Object.assign(envConfig, { dbaPoolContractAddress: await dbaPool.getAddress() })
    await updateConfig(envConfig, "DBAPool")
    console.log("Config file updated successfully")
  } catch (e) {
    console.error("Failed to update config file, update it manually")
  }

  console.log("================================================================================")
  console.log("DBA Pool address: ", await dbaPool.getAddress())
  console.log("================  Execution completed")
  process.exit(0)
}

// Execute the main function
deployDBAPool()
