import { getConfig } from "@repo/config"
import { deployProxy, updateConfig } from "../../helpers"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { NodeManagement } from "../../../typechain-types"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const deployer = (await ethers.getSigners())[0]

  console.log(
    `================  Deploying contracts on ${config.network.name} (${config.nodeUrl}) with ${config.environment} configurations `,
  )
  console.log(`================  Address used to deploy: ${deployer.address}`)

  const TEMP_ADMIN = config.network.name === "solo" ? contractsConfig.CONTRACTS_ADMIN_ADDRESS : deployer.address
  console.log("================================================================================")
  console.log("Temporary admin set to ", TEMP_ADMIN)
  console.log("Final admin will be set to ", contractsConfig.CONTRACTS_ADMIN_ADDRESS)
  console.log("================================================================================")

  console.log(`Deploying NodeManagement contract`)

  // Deploy NodeManagement
  const nodeManagement = (await deployProxy("NodeManagement", [
    contractsConfig.VECHAIN_NODES_CONTRACT_ADDRESS,
    TEMP_ADMIN,
    TEMP_ADMIN,
  ])) as NodeManagement

  console.log(`NodeManagement deployed at: ${await nodeManagement.getAddress()}`)

  // check that upgrade was successful
  const version = await nodeManagement.version()
  console.log(`NodeManagement version: ${version}`)

  console.log("================================================================================")
  console.log(`Updating the config file with the new NodeManagement contract address`)
  try {
    Object.assign(config, { nodeManagementContractAddress: await nodeManagement.getAddress() })
    await updateConfig(config, "nodeManagementContract")
    console.log("Config file updated successfully")
  } catch (e) {
    console.error("Failed to update config file, update it manually")
  }

  console.log(`Update .../deploy_output/contracts.txt file with new NodeManagement contract address`)

  console.log("================================================================================")

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
