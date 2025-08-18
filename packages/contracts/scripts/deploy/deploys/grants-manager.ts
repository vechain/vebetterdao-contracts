import { getConfig } from "@repo/config"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { deployProxy } from "../../helpers"
import { GrantsManager } from "../../../typechain-types"
import { ethers } from "hardhat"
import { updateConfig } from "../../helpers/config"

export async function deployGrantsManager() {
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

  const B3TR_GOVERNOR_ADDRESS = envConfig.b3trGovernorAddress
  const TREASURY_ADDRESS = envConfig.treasuryContractAddress
  const B3TR_CONTRACT_ADDRESS = envConfig.b3trContractAddress
  const MINIMUM_MILESTONE_COUNT = contractsConfig.MINIMUM_MILESTONE_COUNT

  console.log("Deploying proxy for Grants Manager with params:")
  console.log("B3TR Governor Address: ", B3TR_GOVERNOR_ADDRESS)
  console.log("Treasury Address: ", TREASURY_ADDRESS)
  console.log("B3TR Contract Address: ", B3TR_CONTRACT_ADDRESS)
  console.log("Minimum Milestone Count: ", MINIMUM_MILESTONE_COUNT)

  const grantsManager = (await deployProxy("GrantsManager", [
    B3TR_GOVERNOR_ADDRESS,
    TREASURY_ADDRESS,
    TEMP_ADMIN,
    B3TR_CONTRACT_ADDRESS,
    MINIMUM_MILESTONE_COUNT,
  ])) as GrantsManager

  console.log(`================  Contract deployed at ${await grantsManager.getAddress()}`)

  const governor = await grantsManager.getGovernorContract()
  const treasury = await grantsManager.getTreasuryContract()
  const b3tr = await grantsManager.getB3trContract()
  const minimumMilestoneCount = await grantsManager.getMinimumMilestoneCount()

  if (
    governor.toLowerCase() !== envConfig.b3trGovernorAddress.toLowerCase() ||
    treasury.toLowerCase() !== envConfig.treasuryContractAddress.toLowerCase() ||
    b3tr.toLowerCase() !== envConfig.b3trContractAddress.toLowerCase() ||
    minimumMilestoneCount !== BigInt(contractsConfig.MINIMUM_MILESTONE_COUNT)
  ) {
    console.log("ERROR: Params are not set correctly")
    process.exit(1)
  }

  console.log("================  Configuring roles")
  console.log(
    "INFO: roles will not be set automatically in this script, allowing the deployer to handle possible issues in the next days",
  )

  console.log("================================================================================")
  console.log(`Updating the config file with the new Grants Manager contract address`)
  try {
    Object.assign(envConfig, { grantsManagerContractAddress: await grantsManager.getAddress() })
    await updateConfig(envConfig, "GrantsManager")
    console.log("Config file updated successfully")
  } catch (e) {
    console.error("Failed to update config file, update it manually")
  }

  console.log("================================================================================")
  console.log("Grants Manager address: ", await grantsManager.getAddress())
  console.log("================  Execution completed")
  process.exit(0)
}

// Execute the main function
deployGrantsManager()
