import * as fs from "fs"
import * as path from "path"
import axios from "axios"
import { glob } from "glob"

interface NetworkInfo {
  id: string
  name: string
}

interface ContractInfo {
  name: string
  path: string
  fullPath: string
}

interface VerificationJob {
  jobId: string
  status: "pending" | "processing" | "completed" | "failed"
  result?: any
  error?: string
}

// Network mappings
const NETWORKS: Record<string, NetworkInfo> = {
  mainnet: { id: "100009", name: "VeChain Mainnet" },
  testnet: { id: "100010", name: "VeChain Testnet" },
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error("Usage: ts-node verify-contract.ts <contract-address> <network> [contract-name] [--partial-match]")
    console.error("Available networks: mainnet, testnet")
    console.error("Example: ts-node verify-contract.ts 0x123... mainnet StargateNFT")

    process.exit(1)
  }

  const contractAddress = args[0]
  const network = args[1]
  let contractName: string | null = null

  // Parse the remaining arguments
  for (let i = 2; i < args.length; i++) {
    if (!args[i].startsWith("--")) {
      contractName = args[i]
    }
  }

  // Validate network
  if (!NETWORKS[network]) {
    console.error(`Error: Network '${network}' not supported.`)
    console.error("Available networks: mainnet, testnet")
    process.exit(1)
  }

  // Discover available contracts
  const availableContracts = discoverContracts()

  if (availableContracts.length === 0) {
    console.error("No contracts found in the contracts directory.")
    process.exit(1)
  }

  // If no contract name provided, show available contracts
  if (!contractName) {
    console.error("Please specify a contract name.")
    console.error("Available contracts:")
    availableContracts.forEach(contract => {
      console.error(`  - ${contract.name} (${contract.path})`)
    })
    process.exit(1)
  }

  // Find the specified contract
  const targetContract = availableContracts.find(c => c.name === contractName)

  if (!targetContract) {
    console.error(`Error: Contract '${contractName}' not found.`)
    console.error("Available contracts:")
    availableContracts.forEach(contract => {
      console.error(`  - ${contract.name} (${contract.path})`)
    })
    process.exit(1)
  }

  const chainId = NETWORKS[network].id
  const networkName = NETWORKS[network].name

  console.log(`Verifying ${contractName} at ${contractAddress} on ${networkName} (chainId: ${chainId})...`)
  console.log(`Contract path: ${targetContract.path}`)

  // Get dynamic paths based on where script is running from
  const { contractsDir, packageDir } = getProjectPaths()

  // Paths for temporary files
  const tempDir = path.join(packageDir, `temp-verify-${contractAddress}`)
  const contractsBaseDir = contractsDir

  // Create temp directory if it doesn't exist
  if (fs.existsSync(tempDir)) {
    console.log("Cleaning up existing temp directory...")
    fs.rmSync(tempDir, { recursive: true, force: true })
  }

  fs.mkdirSync(tempDir, { recursive: true })

  // Extract metadata from compiled artifacts
  console.log(`Extracting metadata for ${contractName}...`)

  const metadata = findContractMetadata(targetContract.path, contractName)

  if (!metadata) {
    console.error(`Metadata for ${contractName} not found in any build-info file.`)
    console.error("Make sure the contract has been compiled successfully.")
    process.exit(1)
  }

  // Save metadata to temp directory
  const metadataPath = path.join(tempDir, "metadata.json")
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

  // Copy source files based on metadata
  const copiedFiles = copySourceFiles(metadata, tempDir, contractsBaseDir)

  if (copiedFiles.length === 0) {
    console.error("No source files were copied. Cannot proceed with verification.")
    process.exit(1)
  }

  console.log(`📁 Prepared ${copiedFiles.length} source files for verification`)

  try {
    // Check verification status
    console.log("\n🔍 Checking if contract is already verified...")

    const checkResult = await checkVerificationStatusV2(chainId, contractAddress)

    if (checkResult.isVerified && checkResult.data) {
      const matchType = checkResult.data.match || "unknown"
      console.log(`\n✅ Contract is already verified on Sourcify! (Match type: ${matchType})`)
      console.log(`   Verified at: ${checkResult.data.verifiedAt || "unknown"}`)
      console.log(`   View contract: https://sourcify.dev/lookup/${chainId}/${contractAddress}`)
      console.log(`   API v2 lookup: https://sourcify.dev/server/v2/contract/${chainId}/${contractAddress}?fields=all`)
      return
    }

    // Proceed with verification
    const verificationResult = await verifyContractV2(
      chainId,
      contractAddress,
      metadata,
      copiedFiles,
      tempDir,
      contractName,
    )

    if (verificationResult.success) {
      console.log(`\n🎉 Verification successful using Sourcify v2!`)
      console.log(`📊 Contract: ${contractName}`)
      console.log(`🌐 View verified contract: https://repo.sourcify.dev/${chainId}/${contractAddress}`)

      // Display verification result details if available
      if (verificationResult.data) {
        console.log("\n📋 Verification details:", JSON.stringify(verificationResult.data, null, 2))
      }
    }
  } catch (err) {
    const error = err as any

    // Handle timeout errors
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      console.error("\n⏰ Request timed out!")
      console.error("This can happen when:")
      console.error("1. Sourcify servers are experiencing high load")
      console.error("2. Network connectivity is slow")
      console.error("3. The contract is complex and requires more processing time")
      console.error("\n🔄 Try running the command again in a few minutes.")
      return
    }

    // Handle network errors
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      console.error("\nNetwork connection error!")
      console.error("Please check your internet connection and try again.")
      console.error("If the problem persists, Sourcify servers might be temporarily unavailable.")
      return
    }

    if (error.response) {
      console.error("Verification failed with status:", error.response.status)
      console.error("Error message:", JSON.stringify(error.response.data, null, 2))

      // Handle bytecode mismatch error
      if (
        error.response.data &&
        typeof error.response.data === "object" &&
        error.response.data.error &&
        (error.response.data.error.includes("bytecode length doesn't match") ||
          error.response.data.error === "The recompiled bytecode length doesn't match the onchain bytecode length.")
      ) {
        console.log("\nBytecode mismatch detected!")
        console.log("This can happen if:")
        console.log("1. The contract was deployed with a different compiler version or settings")
        console.log("2. The contract was deployed with constructor parameters")
        console.log("3. The contract was deployed from a different source code than what you're trying to verify")
      }

      // Handle already verified
      if (
        error.response.data &&
        typeof error.response.data === "string" &&
        error.response.data.includes("already verified")
      ) {
        console.log("\nThe contract seems to be already verified on Sourcify.")
        console.log(`You can check it here: https://sourcify.dev/lookup/${chainId}/${contractAddress}`)
        console.log(`API v2 lookup: https://sourcify.dev/server/v2/contract/${chainId}/${contractAddress}?fields=all`)
      }
    } else {
      console.error("Error:", error.message)
    }
  } finally {
    // Clean up the temp directory
    console.log("Cleaning up temporary files...")
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

/**
 * Determines the base paths for the project based on current working directory
 */
function getProjectPaths() {
  // Check if we're running from root (has packages/contracts) or from packages/contracts
  const cwd = process.cwd()
  const isRunningFromRoot = fs.existsSync(path.join(cwd, "packages/contracts"))

  if (isRunningFromRoot) {
    return {
      contractsDir: path.join(cwd, "packages/contracts/contracts"),
      artifactsDir: path.join(cwd, "packages/contracts/artifacts"),
      packageDir: path.join(cwd, "packages/contracts"),
    }
  } else {
    // Running from packages/contracts or packages/contracts/scripts/verify
    const contractsExists = fs.existsSync(path.join(__dirname, "../../contracts"))
    if (contractsExists) {
      return {
        contractsDir: path.join(__dirname, "../../contracts"),
        artifactsDir: path.join(__dirname, "../../artifacts"),
        packageDir: path.join(__dirname, "../.."),
      }
    } else {
      throw new Error(
        "Could not determine project structure. Please run from project root or packages/contracts directory.",
      )
    }
  }
}

/**
 * Discovers all available contracts in the contracts directory
 */
function discoverContracts(): ContractInfo[] {
  const { contractsDir } = getProjectPaths()
  const contracts: ContractInfo[] = []

  // Find all .sol files recursively
  const solidityFiles = glob.sync("**/*.sol", {
    cwd: contractsDir,
    ignore: ["node_modules/**", "test/**", "mocks/**"],
  })

  for (const filePath of solidityFiles) {
    const fullPath = path.join(contractsDir, filePath)
    const fileName = path.basename(filePath, ".sol")

    // Skip files that start with lowercase (likely libraries or interfaces)
    if (fileName[0] === fileName[0].toLowerCase()) {
      continue
    }

    contracts.push({
      name: fileName,
      path: filePath,
      fullPath: fullPath,
    })
  }

  return contracts
}

/**
 * Finds contract metadata in build-info files
 */
function findContractMetadata(contractPath: string, contractName: string): any {
  const { artifactsDir } = getProjectPaths()
  const buildInfoDir = path.join(artifactsDir, "build-info")

  if (!fs.existsSync(buildInfoDir)) {
    throw new Error("Build info directory not found. Make sure you have compiled the contracts.")
  }

  const buildInfoFiles = fs.readdirSync(buildInfoDir).filter(file => file.endsWith(".json"))

  if (buildInfoFiles.length === 0) {
    throw new Error("No build-info files found. Make sure you have compiled the contracts.")
  }

  // Try different path formats
  const possiblePaths = [
    contractPath,
    `contracts/${contractPath}`,
    contractPath.replace(/\\/g, "/"), // Normalize path separators
  ]

  for (const file of buildInfoFiles) {
    const buildInfoPath = path.join(buildInfoDir, file)
    const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"))

    if (buildInfo.output && buildInfo.output.contracts) {
      for (const tryPath of possiblePaths) {
        if (buildInfo.output.contracts[tryPath] && buildInfo.output.contracts[tryPath][contractName]) {
          const contractOutput = buildInfo.output.contracts[tryPath][contractName]
          if (contractOutput.metadata) {
            console.log(`Found metadata in ${file} under path: ${tryPath}`)
            return JSON.parse(contractOutput.metadata)
          }
        }
      }
    }
  }

  return null
}

/**
 * Copies source files based on metadata sources
 */
function copySourceFiles(metadata: any, tempDir: string, contractsBaseDir: string): string[] {
  const copiedFiles: string[] = []

  if (!metadata.sources) {
    throw new Error("No sources found in metadata")
  }

  console.log("Contract sources found in metadata:")

  for (const [sourcePath, sourceInfo] of Object.entries(metadata.sources)) {
    console.log(` - ${sourcePath}`)

    // Skip node_modules dependencies - these are handled by Sourcify automatically
    if (sourcePath.includes("node_modules") || sourcePath.startsWith("@")) {
      continue
    }

    // Determine the source file location
    let sourceFilePath: string

    if (path.isAbsolute(sourcePath)) {
      sourceFilePath = sourcePath
    } else {
      // Try multiple resolution strategies
      const { packageDir } = getProjectPaths()

      const possiblePaths = [
        // 1. Try relative to package directory (handles "contracts/DBAPool.sol")
        path.join(packageDir, sourcePath),
        // 2. Try relative to contracts directory (handles "DBAPool.sol")
        path.join(contractsBaseDir, sourcePath),
        // 3. Try stripping "contracts/" prefix if present (handles "contracts/DBAPool.sol" when contractsBaseDir already includes "contracts")
        sourcePath.startsWith("contracts/")
          ? path.join(contractsBaseDir, sourcePath.replace(/^contracts\//, ""))
          : null,
      ].filter(Boolean) as string[]

      // Find the first path that exists
      sourceFilePath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0]
    }

    if (fs.existsSync(sourceFilePath)) {
      // Create destination directory structure
      const destPath = path.join(tempDir, sourcePath)
      const destDir = path.dirname(destPath)

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }

      // Copy the file
      fs.copyFileSync(sourceFilePath, destPath)
      copiedFiles.push(sourcePath)
      console.log(`   ✓ Copied: ${sourcePath}`)
    } else {
      console.error(`   ✗ ERROR: Source file not found: ${sourceFilePath}`)
      console.error(`     Tried paths:`)
      const { packageDir } = getProjectPaths()
      const attemptedPaths = [
        path.join(packageDir, sourcePath),
        path.join(contractsBaseDir, sourcePath),
        sourcePath.startsWith("contracts/")
          ? path.join(contractsBaseDir, sourcePath.replace(/^contracts\//, ""))
          : null,
      ].filter(Boolean) as string[]
      attemptedPaths.forEach(p => console.error(`       - ${p}`))
    }
  }

  return copiedFiles
}

/**
 * Checks verification status using v2 API
 */
async function checkVerificationStatusV2(
  chainId: string,
  contractAddress: string,
  timeout: number = 15000,
): Promise<{ isVerified: boolean; data?: any }> {
  const checkUrl = `https://sourcify.dev/server/v2/contract/${chainId}/${contractAddress}`

  // Request compilation info in addition to default fields
  const params = new URLSearchParams({
    fields: "compilation",
  })

  console.log(`🔍 Checking verification status: ${checkUrl}?${params}`)

  try {
    const response = await axios.get(`${checkUrl}?${params}`, {
      timeout,
      headers: {
        "User-Agent": "Contract-Verification-Script/2.0",
      },
    })

    const data = response.data
    console.log("✅ Contract verification status retrieved")
    console.log(`   Match type: ${data.match || "unknown"}`)
    console.log(`   Creation match: ${data.creationMatch || "unknown"}`)
    console.log(`   Runtime match: ${data.runtimeMatch || "unknown"}`)
    console.log(`   Verified at: ${data.verifiedAt || "unknown"}`)

    if (data.compilation) {
      console.log(`   Contract name: ${data.compilation.name || "unknown"}`)
      console.log(`   Compiler: ${data.compilation.compilerVersion || "unknown"}`)
    }

    return { isVerified: true, data }
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log("📝 Contract not verified yet")
      return { isVerified: false }
    }
    throw error
  }
}

/**
 * Submits verification job using v2 API
 */
async function submitVerificationJobV2(
  chainId: string,
  contractAddress: string,
  metadata: any,
  copiedFiles: string[],
  tempDir: string,
  timeout: number = 60000,
): Promise<VerificationJob> {
  console.log("📤 Submitting verification job to Sourcify v2...")

  try {
    // Use the metadata-based v2 endpoint
    const url = `https://sourcify.dev/server/v2/verify/metadata/${chainId}/${contractAddress}`

    // Prepare sources object
    const sources: Record<string, string> = {}

    for (const file of copiedFiles) {
      const filePath = path.join(tempDir, file)
      if (fs.existsSync(filePath)) {
        sources[file] = fs.readFileSync(filePath, "utf8")
      }
    }

    // Prepare the request body according to v2 specification
    const requestBody = {
      sources: sources,
      metadata: metadata,
    }

    console.log(`📄 Sources: ${Object.keys(sources).length} files`)

    const response = await axios.post(url, requestBody, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Contract-Verification-Script/2.0",
      },
      timeout,
    })

    // v2 returns a verification job with verificationId
    const data = response.data

    if (response.status === 202 && data.verificationId) {
      return {
        jobId: data.verificationId,
        status: "pending",
        result: undefined,
      }
    }

    throw new Error(`Unexpected v2 response: ${JSON.stringify(data)}`)
  } catch (error: any) {
    if (error.response?.status === 409) {
      // Contract already verified
      throw new Error("ALREADY_VERIFIED")
    }
    throw error
  }
}

/**
 * Polls verification job status using v2 endpoint
 */
async function pollVerificationJob(
  verificationId: string,
  maxWaitTime: number = 150000, // 2.5 minutes
  pollInterval: number = 3000, // 3 seconds
): Promise<any> {
  console.log(`🔄 Polling verification job: ${verificationId}`)

  const startTime = Date.now()
  let attempts = 0

  while (Date.now() - startTime < maxWaitTime) {
    attempts++

    try {
      // Use the correct v2 job status endpoint
      const response = await axios.get(`https://sourcify.dev/server/v2/verify/${verificationId}`, {
        timeout: 15000,
        headers: {
          "User-Agent": "Contract-Verification-Script/2.0",
        },
      })

      const data = response.data
      console.log(`   📊 Job status (attempt ${attempts}): ${data.isJobCompleted ? "completed" : "pending"}`)

      if (data.isJobCompleted) {
        if (data.contract && data.contract.match) {
          console.log("✅ Verification job completed successfully")
          return data.contract
        } else if (data.error) {
          console.error("❌ Verification job failed")
          throw new Error(data.error.message || "Verification job failed")
        } else {
          console.error("❌ Verification job completed but without success")
          throw new Error("Verification failed - no match found")
        }
      }

      // Job is still pending/processing, continue polling
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Verification job ${verificationId} not found`)
      }
      console.warn(`⚠️  Error polling job status: ${error.message}`)
      throw error
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error(`Verification job timed out after ${maxWaitTime / 1000}s`)
}

/**
 * Verifies contract using v2 API
 */
async function verifyContractV2(
  chainId: string,
  contractAddress: string,
  metadata: any,
  copiedFiles: string[],
  tempDir: string,
  contractName: string,
): Promise<{ success: boolean; data?: any }> {
  console.log("🚀 Starting contract verification with Sourcify v2...")

  try {
    // Submit verification job
    const job = await submitVerificationJobV2(chainId, contractAddress, metadata, copiedFiles, tempDir)

    if (job.jobId) {
      // Job-based verification - poll for completion
      const result = await pollVerificationJob(job.jobId)
      return { success: true, data: result }
    }

    throw new Error("Invalid job response")
  } catch (error: any) {
    if (error.message === "ALREADY_VERIFIED") {
      console.log("✅ Contract is already verified on Sourcify!")
      return { success: true, data: { alreadyVerified: true } }
    }

    throw error
  }
}

main().catch((err: unknown) => {
  console.error("Error during verification:", err)
  process.exit(1)
})
