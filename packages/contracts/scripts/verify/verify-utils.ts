import { ethers } from "hardhat"
import * as fs from "fs"
import * as path from "path"
import axios from "axios"
import { AppConfig } from "@repo/config"

//typed contract names
export type ContractName =
  | "VOT3"
  | "B3TRGovernor"
  | "GalaxyMember"
  | "X2EarnApps"
  | "VeBetterPassport"
  | "Emissions"
  | "TimeLock"
  | "XAllocationPool"
  | "XAllocationVoting"
  | "VoterRewards"
  | "Treasury"
  | "X2EarnRewardsPool"
  | "X2EarnCreator"
  | "GrantsManager"
  | "DBAPool"
  | "RelayerRewardsPool"

export const PROXY_ABI = ["event Upgraded(address indexed implementation)"]

/**
 * Get the standardized list of all contracts with their proxy addresses
 * @param config - The environment configuration containing contract addresses
 * @returns Array of contract proxy addresses and names
 */
export function getAllContracts(config: AppConfig): Array<{ proxy: string; name: ContractName }> {
  return [
    { proxy: config.vot3ContractAddress, name: "VOT3" },
    { proxy: config.b3trGovernorAddress, name: "B3TRGovernor" },
    { proxy: config.galaxyMemberContractAddress, name: "GalaxyMember" },
    { proxy: config.x2EarnAppsContractAddress, name: "X2EarnApps" },
    { proxy: config.veBetterPassportContractAddress, name: "VeBetterPassport" },
    { proxy: config.emissionsContractAddress, name: "Emissions" },
    { proxy: config.timelockContractAddress, name: "TimeLock" },
    { proxy: config.xAllocationPoolContractAddress, name: "XAllocationPool" },
    { proxy: config.xAllocationVotingContractAddress, name: "XAllocationVoting" },
    { proxy: config.voterRewardsContractAddress, name: "VoterRewards" },
    { proxy: config.treasuryContractAddress, name: "Treasury" },
    { proxy: config.x2EarnRewardsPoolContractAddress, name: "X2EarnRewardsPool" },
    { proxy: config.x2EarnCreatorContractAddress, name: "X2EarnCreator" },
    { proxy: config.grantsManagerContractAddress, name: "GrantsManager" },
    { proxy: config.dbaPoolContractAddress, name: "DBAPool" },
    { proxy: config.relayerRewardsPoolContractAddress, name: "RelayerRewardsPool" },
  ]
}

export interface ContractInfo {
  Contract: ContractName
  Proxy: string
  Implementation: string
  Libraries: string
  Status: string
}

export interface LibraryInfo {
  name: string
  address: string
}

export async function getImplementationAddress(proxyAddress: string): Promise<string | null> {
  try {
    const proxyContract = await ethers.getContractAt(PROXY_ABI, proxyAddress)
    const events = await proxyContract.queryFilter(proxyContract.filters.Upgraded(), 0, "latest")
    if (events.length === 0) return null
    const latestEvent = events[events.length - 1]
    // Type guard to check if event is EventLog (has args property)
    if ("args" in latestEvent) {
      return latestEvent.args?.implementation || latestEvent.args?.[0] || null
    }
    return null
  } catch (error) {
    return null
  }
}

export async function getVerificationMatch(address: string, chainId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://sourcify.dev/server/v2/contract/${chainId}/${address}`)
    if (!response.ok) return null
    const data = (await response.json()) as { runtimeMatch?: string }
    return data.runtimeMatch || null
  } catch {
    return null
  }
}

/**
 * Recursively search for a contract artifact file
 * @param dir - Directory to search in
 * @param contractName - The name of the contract
 * @returns The path to the artifact file or null if not found
 */
export function findArtifactFile(dir: string, contractName: string): string | null {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const found = findArtifactFile(fullPath, contractName)
        if (found) return found
      } else if (entry.isFile() && entry.name === `${contractName}.json`) {
        // Found the artifact file
        return fullPath
      }
    }
  } catch (error) {
    // Ignore errors (e.g., permission denied)
  }

  return null
}

/**
 * Get project paths dynamically
 */
export function getProjectPaths() {
  const cwd = process.cwd()
  const isRunningFromRoot = fs.existsSync(path.join(cwd, "packages/contracts"))

  if (isRunningFromRoot) {
    return {
      contractsDir: path.join(cwd, "packages/contracts/contracts"),
      artifactsDir: path.join(cwd, "packages/contracts/artifacts"),
      packageDir: path.join(cwd, "packages/contracts"),
    }
  } else {
    const contractsExists = fs.existsSync(path.join(__dirname, "../../contracts"))
    if (contractsExists) {
      return {
        contractsDir: path.join(__dirname, "../../contracts"),
        artifactsDir: path.join(__dirname, "../../artifacts"),
        packageDir: path.join(__dirname, "../.."),
      }
    } else {
      throw new Error("Could not determine project structure")
    }
  }
}

/**
 * Get the artifact path for a contract dynamically
 * @param contractName - The name of the contract
 * @returns The path to the artifact file
 */
export function getArtifactPath(contractName: ContractName | string): string {
  const { artifactsDir } = getProjectPaths()
  const contractsDir = path.join(artifactsDir, "contracts")

  const artifactPath = findArtifactFile(contractsDir, contractName)

  if (!artifactPath) {
    throw new Error(`Artifact not found for contract: ${contractName}`)
  }

  return artifactPath
}

/**
 * Extract library names from contract artifacts by reading linkReferences
 * @param contractName - The name of the contract
 * @returns Array of library names used by the contract
 */
export function discoverLibrariesFromArtifact(contractName: ContractName): string[] {
  try {
    const artifactPath = getArtifactPath(contractName)

    if (!fs.existsSync(artifactPath)) {
      console.warn(`Artifact not found for ${contractName}: ${artifactPath}`)
      return []
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"))

    if (!artifact.linkReferences) {
      return []
    }

    const libraries: string[] = []

    // linkReferences structure: { "path/to/Library.sol": { "LibraryName": [...] } }
    for (const filePath of Object.keys(artifact.linkReferences)) {
      const fileLibraries = artifact.linkReferences[filePath]
      for (const libraryName of Object.keys(fileLibraries)) {
        libraries.push(libraryName)
      }
    }

    return libraries
  } catch (error) {
    console.warn(`Error reading artifact for ${contractName}:`, error)
    return []
  }
}

/**
 * Extract library addresses from deployed bytecode using deployedLinkReferences
 * @param implementationAddress - The deployed implementation contract address
 * @param contractName - The contract name
 * @returns Map of library names to their deployed addresses
 */
export async function extractLibraryAddresses(
  implementationAddress: string,
  contractName: ContractName,
): Promise<Map<string, string>> {
  try {
    const artifactPath = getArtifactPath(contractName)

    if (!fs.existsSync(artifactPath)) {
      return new Map()
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"))

    if (!artifact.deployedLinkReferences || Object.keys(artifact.deployedLinkReferences).length === 0) {
      return new Map()
    }

    // Get the deployed bytecode from the blockchain
    const deployedBytecode = await ethers.provider.getCode(implementationAddress)

    if (deployedBytecode === "0x") {
      console.warn(`No bytecode found at ${implementationAddress}`)
      return new Map()
    }

    const libraryAddresses = new Map<string, string>()

    // deployedLinkReferences structure: { "path/to/Library.sol": { "LibraryName": [{ start: X, length: 20 }] } }
    for (const [filePath, libraries] of Object.entries(artifact.deployedLinkReferences)) {
      for (const [libraryName, positions] of Object.entries(
        libraries as Record<string, Array<{ start: number; length: number }>>,
      )) {
        // Get the first position where this library is linked
        if (positions.length > 0) {
          const position = positions[0]
          // Bytecode is hex string: "0x" + bytes
          // Each byte is 2 hex chars, so position in hex string is: 2 + (start * 2)
          const startPos = 2 + position.start * 2
          const endPos = startPos + position.length * 2

          if (endPos <= deployedBytecode.length) {
            // Extract the address (20 bytes = 40 hex chars)
            const addressHex = deployedBytecode.slice(startPos, endPos)
            const address = "0x" + addressHex
            libraryAddresses.set(libraryName, address)
          }
        }
      }
    }

    return libraryAddresses
  } catch (error) {
    console.warn(`Error extracting library addresses for ${contractName}:`, error)
    return new Map()
  }
}

/**
 * Get detailed library information (name and address) for contracts that use libraries
 * Dynamically discovers libraries from compiled artifacts and extracts addresses from deployed bytecode
 * @param contractName - The name of the contract to check
 * @param implementationAddress - The deployed implementation contract address
 * @returns Array of LibraryInfo objects containing library names and addresses
 */
export async function getContractLibraries(
  contractName: ContractName,
  implementationAddress: string | null,
): Promise<LibraryInfo[]> {
  const libraryNames = discoverLibrariesFromArtifact(contractName)

  if (libraryNames.length === 0 || !implementationAddress) {
    return []
  }

  const libraryAddresses = await extractLibraryAddresses(implementationAddress, contractName)
  return libraryNames.map(name => ({
    name,
    address: libraryAddresses.get(name) || "Not found in bytecode",
  }))
}

export async function getLibraryAddresses(
  contractName: ContractName,
  implementationAddress: string | null,
): Promise<string[]> {
  const libraries = await getContractLibraries(contractName, implementationAddress)
  return libraries.map(lib => lib.address)
}

export async function getVerificationStatus(
  proxyAddress: string,
  implementationAddress: string | null,
  libraryAddresses: string[],
  chainId: bigint,
): Promise<string> {
  const chainIdStr = chainId.toString()
  const checks: Array<{ type: string; match: string | null }> = []

  const proxyMatch = await getVerificationMatch(proxyAddress, chainIdStr)
  checks.push({ type: "Proxy", match: proxyMatch })

  if (implementationAddress) {
    const implMatch = await getVerificationMatch(implementationAddress, chainIdStr)
    checks.push({ type: "Implementation", match: implMatch })
  }

  for (const libAddress of libraryAddresses) {
    const libMatch = await getVerificationMatch(libAddress, chainIdStr)
    checks.push({ type: "Library", match: libMatch })
  }

  const exactMatches = checks.filter(c => c.match === "exact_match").length
  const total = checks.length

  if (exactMatches === total) return "Fully Verified"
  if (exactMatches > 0) return "Partially Verified"
  return "Not Verified"
}

export function hasLibraries(contractName: ContractName): string {
  const libraryNames = discoverLibrariesFromArtifact(contractName)
  return libraryNames.length > 0 ? "Yes" : "No"
}

/**
 * Display detailed library information for a specific contract
 * @param contractName - The name of the contract
 * @param implementationAddress - The deployed implementation contract address
 */
export async function displayLibraryInfo(
  contractName: ContractName,
  implementationAddress: string | null,
): Promise<void> {
  const libraries = await getContractLibraries(contractName, implementationAddress)

  if (libraries.length === 0) {
    console.log(`\n${contractName}: No libraries`)
    return
  }

  console.log(`\n${contractName} Libraries (${libraries.length} found):`)
  console.log("─".repeat(80))
  libraries.forEach((lib, index) => {
    const status = lib.address.startsWith("0x") && !lib.address.includes("Not found") ? "✓" : "✗"
    console.log(`${status} ${index + 1}. ${lib.name}`)
    console.log(`     Address: ${lib.address}`)
  })
  console.log("─".repeat(80))
}

/**
 * Dynamically get contract file name from contract name by searching build-info files
 */
export function getContractFileName(contractName: ContractName | string): string {
  const { artifactsDir } = getProjectPaths()
  const buildInfoDir = path.join(artifactsDir, "build-info")

  if (!fs.existsSync(buildInfoDir)) {
    throw new Error("build-info directory not found")
  }

  const buildInfoFiles = fs.readdirSync(buildInfoDir).filter(file => file.endsWith(".json"))

  if (buildInfoFiles.length === 0) {
    throw new Error("No build-info files found")
  }

  // Search through all build-info files to find the contract
  for (const file of buildInfoFiles) {
    const buildInfoPath = path.join(buildInfoDir, file)
    const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"))

    if (buildInfo.output && buildInfo.output.contracts) {
      // Iterate through all contract paths in the build info
      for (const [contractPath, contracts] of Object.entries(buildInfo.output.contracts)) {
        // Check if this path contains our contract
        if (contracts && typeof contracts === "object" && contractName in contracts) {
          // Found the contract! Extract the file path
          // contractPath might be like "contracts/VOT3.sol" or "contracts/ve-better-passport/VeBetterPassport.sol"
          // We need to normalize it relative to the contracts directory
          let normalizedPath = contractPath
          if (normalizedPath.startsWith("contracts/")) {
            normalizedPath = normalizedPath.replace(/^contracts\//, "")
          }

          return normalizedPath
        }
      }
    }
  }

  throw new Error(`Could not find contract ${contractName} in build-info files`)
}

/**
 * Find contract metadata from build-info files
 */
export function findContractMetadata(contractFileName: string, contractName: string): any | null {
  const { artifactsDir } = getProjectPaths()

  // Generate possible source file paths
  const possiblePaths = [
    `contracts/${contractFileName}`,
    contractFileName.startsWith("contracts/") ? contractFileName : `contracts/${contractFileName}`,
    contractFileName,
    contractFileName.replace(/\\/g, "/"), // Normalize path separators
  ]

  const buildInfoDir = path.join(artifactsDir, "build-info")

  if (!fs.existsSync(buildInfoDir)) {
    return null
  }

  const buildInfoFiles = fs.readdirSync(buildInfoDir).filter(file => file.endsWith(".json"))

  if (buildInfoFiles.length === 0) {
    return null
  }

  for (const file of buildInfoFiles) {
    const buildInfoPath = path.join(buildInfoDir, file)
    const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"))

    if (buildInfo.output && buildInfo.output.contracts) {
      for (const tryPath of possiblePaths) {
        if (buildInfo.output.contracts[tryPath] && buildInfo.output.contracts[tryPath][contractName]) {
          const contractOutput = buildInfo.output.contracts[tryPath][contractName]
          if (contractOutput.metadata) {
            return JSON.parse(contractOutput.metadata)
          }
        }
      }
    }
  }

  return null
}

/**
 * Copy source files based on metadata
 */
export function copySourceFiles(metadata: any, tempDir: string, contractsBaseDir: string): string[] {
  const copiedFiles: string[] = []

  if (!metadata.sources) {
    return copiedFiles
  }

  for (const [sourcePath, sourceInfo] of Object.entries(metadata.sources)) {
    if (sourcePath.includes("node_modules") || sourcePath.startsWith("@")) {
      continue
    }

    let sourceFilePath: string

    if (path.isAbsolute(sourcePath)) {
      sourceFilePath = sourcePath
    } else {
      const { packageDir } = getProjectPaths()
      const possiblePaths = [
        path.join(packageDir, sourcePath),
        path.join(contractsBaseDir, sourcePath),
        sourcePath.startsWith("contracts/")
          ? path.join(contractsBaseDir, sourcePath.replace(/^contracts\//, ""))
          : null,
      ].filter(Boolean) as string[]

      sourceFilePath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0]
    }

    if (fs.existsSync(sourceFilePath)) {
      const destPath = path.join(tempDir, sourcePath)
      const destDir = path.dirname(destPath)

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }

      fs.copyFileSync(sourceFilePath, destPath)
      copiedFiles.push(sourcePath)
    }
  }

  return copiedFiles
}

/**
 * Submit verification to Sourcify v2 API
 */
export async function submitVerification(
  chainId: string,
  contractAddress: string,
  metadata: any,
  copiedFiles: string[],
  tempDir: string,
): Promise<{ success: boolean; verificationId?: string; error?: string }> {
  try {
    const url = `https://sourcify.dev/server/v2/verify/metadata/${chainId}/${contractAddress}`

    const sources: Record<string, string> = {}
    for (const file of copiedFiles) {
      const filePath = path.join(tempDir, file)
      if (fs.existsSync(filePath)) {
        sources[file] = fs.readFileSync(filePath, "utf8")
      }
    }

    const requestBody = {
      sources: sources,
      metadata: metadata,
    }

    const response = await axios.post(url, requestBody, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Contract-Verification-Script/2.0",
      },
      timeout: 60000,
    })

    if (response.status === 202 && response.data.verificationId) {
      return {
        success: true,
        verificationId: response.data.verificationId,
      }
    }

    return { success: false, error: "Unexpected response" }
  } catch (error: any) {
    if (error.response?.status === 409) {
      return { success: true, error: "ALREADY_VERIFIED" }
    }
    return { success: false, error: error.message }
  }
}

/**
 * Poll verification job status
 */
export async function pollVerificationJob(
  verificationId: string,
  maxWaitTime: number = 120000,
  pollInterval: number = 3000,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await axios.get(`https://sourcify.dev/server/v2/verify/${verificationId}`, {
        timeout: 15000,
        headers: {
          "User-Agent": "Contract-Verification-Script/2.0",
        },
      })

      const data = response.data

      if (data.isJobCompleted) {
        if (data.contract && data.contract.match) {
          return { success: true, data: data.contract }
        } else if (data.error) {
          return { success: false, error: data.error.message || "Verification failed" }
        } else {
          return { success: false, error: "No match found" }
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { success: false, error: "Job not found" }
      }
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  return { success: false, error: "Timeout" }
}

/**
 * Dynamically find library contract file path by searching build-info files
 */
export function getLibraryContractInfo(libraryName: string): { fileName: string; contractName: string } | null {
  const { artifactsDir } = getProjectPaths()
  const buildInfoDir = path.join(artifactsDir, "build-info")

  if (!fs.existsSync(buildInfoDir)) {
    return null
  }

  const buildInfoFiles = fs.readdirSync(buildInfoDir).filter(file => file.endsWith(".json"))

  if (buildInfoFiles.length === 0) {
    return null
  }

  // Search through all build-info files to find the library
  for (const file of buildInfoFiles) {
    const buildInfoPath = path.join(buildInfoDir, file)
    const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"))

    if (buildInfo.output && buildInfo.output.contracts) {
      // Iterate through all contract paths in the build info
      for (const [contractPath, contracts] of Object.entries(buildInfo.output.contracts)) {
        // Check if this path contains our library
        if (contracts && typeof contracts === "object" && libraryName in contracts) {
          // Found the library! Extract the file path
          // contractPath might be like "contracts/governance/libraries/GovernorClockLogic.sol"
          // We need to normalize it relative to the contracts directory
          let normalizedPath = contractPath
          if (normalizedPath.startsWith("contracts/")) {
            normalizedPath = normalizedPath.replace(/^contracts\//, "")
          }

          return {
            fileName: normalizedPath,
            contractName: libraryName,
          }
        }
      }
    }
  }

  return null
}
