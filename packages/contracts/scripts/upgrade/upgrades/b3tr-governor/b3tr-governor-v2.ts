import { getConfig } from "@repo/config"
import { EnvConfig } from "@repo/config/contracts"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Checking 'upgradeToAndCall' function is whitlisted for B3TRGovernor: ${config.b3trGovernorAddress} on network: ${config.network.name}`,
  )

  // Check if the function is whitelisted
  const b3trGovernor = await ethers.getContractAt("B3TRGovernor", config.b3trGovernorAddress)
  const funcSig = b3trGovernor.interface.getFunction("upgradeToAndCall")?.selector
  const isWhitelisted = await b3trGovernor.isFunctionWhitelisted(config.b3trGovernorAddress, funcSig)

  if (!isWhitelisted) {
    console.log("Function 'upgradeToAndCall' is not whitelisted for B3TRGovernor, whitelisting it now...")
    const tx = await b3trGovernor.setWhitelistFunction(config.b3trGovernorAddress, funcSig, true)
    await tx.wait()

    const isWhitelistedAfter = await b3trGovernor.isFunctionWhitelisted(config.b3trGovernorAddress, funcSig)
    if (!isWhitelistedAfter) {
      throw new Error("Failed to whitelist 'upgradeToAndCall' function for B3TRGovernor")
    }
  }

  console.log("Function 'upgradeToAndCall' is whitelisted for B3TRGovernor")

  console.log("-----------------------------")

  console.log(
    `Deploying V2 implementation address for B3TRGovernor ${config.b3trGovernorAddress} on network: ${config.network.name}`,
  )

  // Deploy the implementation contract
  const B3TRGovernorV2 = await ethers.getContractFactory("B3TRGovernor", {
    libraries: {
      GovernorClockLogic: config.b3trGovernorLibraries.governorClockLogicAddress,
      GovernorConfigurator: config.b3trGovernorLibraries.governorConfiguratorAddress,
      GovernorDepositLogic: config.b3trGovernorLibraries.governorDepositLogicAddress,
      GovernorFunctionRestrictionsLogic: config.b3trGovernorLibraries.governorFunctionRestrictionsLogicAddress,
      GovernorProposalLogic: config.b3trGovernorLibraries.governorProposalLogicAddressAddress,
      GovernorQuorumLogic: config.b3trGovernorLibraries.governorQuorumLogicAddress,
      GovernorStateLogic: config.b3trGovernorLibraries.governorStateLogicAddress,
      GovernorVotesLogic: config.b3trGovernorLibraries.governorVotesLogicAddress,
    },
  })

  const b3trGovernorV2Impl = await B3TRGovernorV2.deploy()
  await b3trGovernorV2Impl.waitForDeployment()

  console.log(`B3TRGovernor V2 implementation deployed at address: ${await b3trGovernorV2Impl.getAddress()}`)
  console.log("-----------------------------")

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
