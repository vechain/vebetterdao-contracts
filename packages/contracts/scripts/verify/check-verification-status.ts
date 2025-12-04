import { getConfig } from "@repo/config"
import { EnvConfig } from "@repo/config/contracts"
import { ethers } from "hardhat"

import {
  ContractInfo,
  getAllContracts,
  getImplementationAddress,
  getLibraryAddresses,
  getVerificationStatus,
  hasLibraries,
} from "./verify-utils"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV environment variable")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const network = await ethers.provider.getNetwork()

  console.log(`\n${config.network.name} (Chain ID: ${network.chainId})\n`)

  const contracts = getAllContracts(config)

  const contractsInfo: ContractInfo[] = []

  console.log("Checking verification status...\n")

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
  }

  console.table(contractsInfo)

  const failed = contractsInfo.filter(c => c.Implementation === "Not found").length
  const fullyVerified = contractsInfo.filter(c => c.Status === "Fully Verified").length
  const partiallyVerified = contractsInfo.filter(c => c.Status === "Partially Verified").length
  const notVerified = contractsInfo.filter(c => c.Status === "Not Verified").length

  console.log(`\n${"=".repeat(80)}`)
  console.log("SUMMARY")
  console.log("=".repeat(80))
  console.log(`Total Contracts: ${contractsInfo.length}`)
  console.log(`Implementations Found: ${contractsInfo.length - failed}/${contractsInfo.length}`)
  console.log(`Fully Verified: ${fullyVerified}`)
  console.log(`Partially Verified: ${partiallyVerified}`)
  console.log(`Not Verified: ${notVerified}`)
  console.log("=".repeat(80) + "\n")

  if (failed > 0 || notVerified > 0) {
    process.exit(1)
  }
}

main().catch(error => {
  console.error("Error:", error.message)
  process.exit(1)
})
