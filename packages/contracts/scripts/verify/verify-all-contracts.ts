import { getConfig } from "@repo/config"
import { EnvConfig } from "@repo/config/contracts"
import { ethers } from "hardhat"
import * as fs from "fs"
import * as path from "path"
import {
  ContractInfo,
  ContractName,
  copySourceFiles,
  findContractMetadata,
  getAllContracts,
  getContractFileName,
  getContractLibraries,
  getImplementationAddress,
  getLibraryAddresses,
  getLibraryContractInfo,
  getProjectPaths,
  getVerificationMatch,
  getVerificationStatus,
  hasLibraries,
  pollVerificationJob,
  submitVerification,
} from "./verify-utils"

/**
 * Verify a single contract
 */
async function verifySingleContract(
  contractAddress: string,
  contractFileName: string,
  contractName: string,
  chainId: string,
): Promise<boolean> {
  console.log(`   Verifying ${contractName} at ${contractAddress}...`)

  try {
    // Check if already verified
    const checkMatch = await getVerificationMatch(contractAddress, chainId)
    if (checkMatch === "exact_match") {
      console.log(`   ✓ Already verified`)
      return true
    }

    // Find contract metadata
    const metadata = findContractMetadata(contractFileName, contractName)
    if (!metadata) {
      console.log(`   ✗ Metadata not found for ${contractName}`)
      return false
    }

    // Setup temp directory
    const { contractsDir, packageDir } = getProjectPaths()
    const tempDir = path.join(packageDir, `temp-verify-${contractAddress}`)

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    fs.mkdirSync(tempDir, { recursive: true })

    try {
      // Copy source files
      const copiedFiles = copySourceFiles(metadata, tempDir, contractsDir)
      if (copiedFiles.length === 0) {
        console.log(`   ✗ No source files copied`)
        return false
      }

      // Submit verification
      const submitResult = await submitVerification(chainId, contractAddress, metadata, copiedFiles, tempDir)

      if (!submitResult.success) {
        if (submitResult.error === "ALREADY_VERIFIED") {
          console.log(`   ✓ Already verified`)
          return true
        }
        console.log(`   ✗ Submission failed: ${submitResult.error}`)
        return false
      }

      if (submitResult.verificationId) {
        // Poll for completion
        const pollResult = await pollVerificationJob(submitResult.verificationId)
        if (pollResult.success) {
          console.log(`   ✓ Verification successful`)
          return true
        } else {
          console.log(`   ✗ Verification failed: ${pollResult.error}`)
          return false
        }
      }

      return false
    } finally {
      // Cleanup
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    }
  } catch (error: any) {
    console.log(`   ✗ Error: ${error.message}`)
    return false
  }
}

/**
 * Verify all components of a contract (proxy, implementation, libraries)
 */
async function verifyContractComponents(
  contractName: ContractName,
  proxyAddress: string,
  implementationAddress: string | null,
  chainId: string,
): Promise<void> {
  console.log(`\nVerifying ${contractName} components...`)

  // 1. Verify Proxy as B3TRProxy
  console.log(`\n1. Proxy (B3TRProxy):`)
  await verifySingleContract(proxyAddress, "B3TRProxy.sol", "B3TRProxy", chainId)

  // 2. Verify Implementation
  if (implementationAddress) {
    console.log(`\n2. Implementation (${contractName}):`)
    const fileName = getContractFileName(contractName)
    await verifySingleContract(implementationAddress, fileName, contractName, chainId)

    // 3. Verify Libraries if any
    const libraries = await getContractLibraries(contractName, implementationAddress)
    if (libraries.length > 0) {
      console.log(`\n3. Libraries (${libraries.length} found):`)
      for (const lib of libraries) {
        if (lib.address.startsWith("0x") && !lib.address.includes("Not found")) {
          const libInfo = getLibraryContractInfo(lib.name)
          if (libInfo) {
            await verifySingleContract(lib.address, libInfo.fileName, libInfo.contractName, chainId)
          } else {
            console.log(`   ⚠ Library mapping not found for ${lib.name}`)
          }
        }
      }
    }
  } else {
    console.log(`\n✗ Cannot verify implementation - address not found`)
  }
}

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV environment variable")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const network = await ethers.provider.getNetwork()

  console.log(`\n${config.network.name} (Chain ID: ${network.chainId})\n`)

  const contracts = getAllContracts(config)

  const contractsInfo: ContractInfo[] = []
  const contractsWithImpl: Array<{ name: ContractName; implementation: string | null }> = []

  for (const contract of contracts) {
    const implementation = await getImplementationAddress(contract.proxy)
    const libraryAddresses = await getLibraryAddresses(contract.name, implementation)
    const status = await getVerificationStatus(contract.proxy, implementation, libraryAddresses, network.chainId)

    contractsInfo.push({
      Contract: contract.name,
      Proxy: contract.proxy,
      Implementation: implementation || "Not found",
      Libraries: hasLibraries(contract.name),
      Status: status,
    })

    contractsWithImpl.push({
      name: contract.name,
      implementation: implementation,
    })
  }

  console.table(contractsInfo)

  const failed = contractsInfo.filter(c => c.Implementation === "Not found").length
  console.log(`\n${contractsInfo.length - failed}/${contractsInfo.length} implementations found\n`)

  console.log("\n" + "═".repeat(80))
  console.log("AUTO-VERIFICATION FOR UNVERIFIED CONTRACTS")
  console.log("═".repeat(80))

  const unverifiedContracts = contractsInfo.filter(
    c => c.Status === "Not Verified" || c.Status === "Partially Verified",
  )

  if (unverifiedContracts.length === 0) {
    console.log("\n✓ All contracts are fully verified!")
  } else {
    console.log(`\nFound ${unverifiedContracts.length} contracts that need verification\n`)

    for (const contractInfo of unverifiedContracts) {
      const contractData = contracts.find(c => c.name === contractInfo.Contract)
      const implData = contractsWithImpl.find(c => c.name === contractInfo.Contract)

      if (contractData && implData) {
        console.log("\n" + "─".repeat(80))
        await verifyContractComponents(
          contractData.name,
          contractData.proxy,
          implData.implementation,
          network.chainId.toString(),
        )
      }
    }

    console.log("\n" + "═".repeat(80))
    console.log("AUTO-VERIFICATION COMPLETED")
    console.log("═".repeat(80) + "\n")
  }
  const contractsAfterVerification: ContractInfo[] = []
  for (const contract of contracts) {
    const implementation = await getImplementationAddress(contract.proxy)
    const libraryAddresses = await getLibraryAddresses(contract.name, implementation)
    const status = await getVerificationStatus(contract.proxy, implementation, libraryAddresses, network.chainId)

    contractsAfterVerification.push({
      Contract: contract.name,
      Proxy: contract.proxy,
      Implementation: implementation || "Not found",
      Libraries: hasLibraries(contract.name),
      Status: status,
    })
  }
  console.table(contractsAfterVerification)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(error => {
  console.error("Error:", error.message)
  process.exit(1)
})
