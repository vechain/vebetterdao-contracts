import { ContractsConfig } from "@repo/config/contracts"
import { B3TRGovernor } from "../../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { ethers } from "hardhat"

/**
 * Set the whitelisted functions from config
 * Performs the following steps for each contract:
 *    1. Get the function signatures from the contract factory
 *    2. Set the whitelisted functions in the governor contract
 *
 * @param contractAddresses - Addresses of the deployed contracts
 * @param config - Contracts configuration
 * @param governor - B3TRGovernor contract instance
 * @param admin - Admin signer
 *
 * @note - For ambiguous functions (functions with same name), the function signature is used to differentiate them
 * e.g., instead of using "setVoterRewards", we use "setVoterRewards(address)" in the config
 */
export const setWhitelistedFunctions = async (
  contractAddresses: Record<string, string>,
  config: ContractsConfig,
  governor: B3TRGovernor,
  admin: HardhatEthersSigner,
  libraries: Record<string, Record<string, string>>,
  logOutput = false,
) => {
  if (logOutput) console.log("================ Setting whitelisted functions in B3TRGovernor contract")

  const { B3TR_GOVERNOR_WHITELISTED_METHODS } = config

  for (const [contract, functions] of Object.entries(B3TR_GOVERNOR_WHITELISTED_METHODS)) {
    // Check if the contract address exists
    const contractAddress = contractAddresses[contract]
    if (!contractAddress) {
      if (logOutput) console.log(`Skipping ${contract} as it does not exist in contract addresses`)
      continue // Skip this contract if address does not exist
    }
    // Check if the current contract requires linking with any libraries
    const contractLibraries = libraries[contract]

    // Getting the contract factory with or without libraries as needed
    const contractFactory = contractLibraries
      ? await ethers.getContractFactory(contract, { libraries: contractLibraries })
      : await ethers.getContractFactory(contract)

    const whitelistFunctionSelectors = []

    for (const func of functions) {
      const sig = contractFactory.interface.getFunction(func)?.selector

      if (sig) whitelistFunctionSelectors.push(sig)
    }

    if (whitelistFunctionSelectors.length !== 0) {
      await governor
        .connect(admin)
        .setWhitelistFunctions(contractAddresses[contract], whitelistFunctionSelectors, true)
        .then(async tx => await tx.wait())

      if (logOutput) console.log(`Whitelisted functions set for ${contract} in B3TRGovernor contract`)
    }
  }
}
