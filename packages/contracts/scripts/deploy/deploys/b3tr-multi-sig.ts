import { getConfig } from "@repo/config"
import { deployProxy, updateConfig } from "../../helpers"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { B3TRMultiSig } from "../../../typechain-types"
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

  console.log(`Deploying B3TRMultiSig contract`)

  // Deploy B3TRMultiSig
  const B3TRMultiSig = await ethers.getContractFactory("B3TRMultiSig")
  const b3TRMultiSig = await B3TRMultiSig.deploy(contractsConfig.MULTI_SIG_SIGNERS, 2)

  console.log(`B3TRMultiSig deployed at: ${await b3TRMultiSig.getAddress()}`)

  // check that upgrade was successful

  console.log("================================================================================")
  console.log(`Updating the config file with the new B3TRMultiSig contract address`)
  try {
    Object.assign(config, { b3TRMultiSig: await b3TRMultiSig.getAddress() })
    await updateConfig(config, "b3TRMultiSig")
    console.log("Config file updated successfully")
  } catch (e) {
    console.error("Failed to update config file, update it manually")
  }

  console.log(`Update .../deploy_output/contracts.txt file with new B3TRMultiSig contract address`)

  console.log("================================================================================")

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
