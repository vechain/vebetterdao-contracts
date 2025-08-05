import { getConfig } from "@repo/config"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { deployProxy } from "../../helpers"
import { X2EarnCreator } from "../../../typechain-types"
import { ethers } from "hardhat"
import { updateConfig } from "../../helpers/config"

export async function main() {
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

  console.log("Deploying proxy for X2EarnCreator")

  const x2EarnCreator = (await deployProxy("X2EarnCreator", [
    contractsConfig.CREATOR_NFT_URI,
    TEMP_ADMIN,
  ])) as X2EarnCreator

  console.log(`================  Contract deployed `)
  console.log(`================  Configuring contract `)

  console.log("Checking that params are set correctly")
  const name = await x2EarnCreator.name()
  console.log("Contract name: ", name)
  const symbol = await x2EarnCreator.symbol()
  console.log("Contract symbol: ", symbol)

  if (name !== "X2EarnCreator" || symbol !== "X2C") {
    console.log("ERROR: Params are not set correctly")
  }

  console.log("================  Configuring roles")
  console.log(
    "INFO: roles will not be set automatically in this script, allowing the deployer to handle possible issues in the next days",
  )

  console.log("================================================================================")
  console.log(`Updating the config file with the new X2EarnCreator contract address`)
  try {
    Object.assign(envConfig, { x2EarnCreatorContractAddress: await x2EarnCreator.getAddress() })
    await updateConfig(envConfig, "x2EarnCreatorContract")
    console.log("Config file updated successfully")
  } catch (e) {
    console.error("Failed to update config file, update it manually")
  }

  console.log(`TODO: Update .../deploy_output/contracts.txt file with new X2EarnCreator contract address`)

  console.log("================================================================================")
  console.log("X2EarnCreator address: ", await x2EarnCreator.getAddress())
  console.log("================  Execution completed")
  process.exit(0)
}

// Execute the main function
main()
