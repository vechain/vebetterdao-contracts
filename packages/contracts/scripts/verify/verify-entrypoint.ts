#!/usr/bin/env ts-node

// Wrapper script for mainnet verification that handles argument order correctly
// Usage: ts-node verify-mainnet.ts <contract-address> [contract-name] [--partial-match]

import { execSync } from "child_process"
import * as path from "path"

const args = process.argv.slice(2)

if (args.length < 1) {
  console.error("Usage from root: yarn contracts:verify:{network} <contract-address> [contract-name] [--partial-match]")
  console.error("Example: yarn contracts:verify:mainnet 0x123... StargateDelegation")
  console.error("")
  console.error("Options:")
  console.error("  --partial-match  Use 'match' verification instead of 'exact_match' (Sourcify v2 terminology)")
  console.error("")
  console.error("Match Types (Sourcify v2):")
  console.error("  exact_match     Full bytecode verification (default)")
  console.error("  match          Metadata-only verification (with --partial-match flag)")
  process.exit(1)
}

const contractAddress = args[0]
const contractName = args[1] || ""
const additionalFlags = args.slice(2).join(" ")

const network = process.env.VITE_APP_ENV

// Build the command with correct argument order: <address> <network> <contract-name> <flags>
const verifyScriptPath = path.join(__dirname, "verify-contract.ts")
const command =
  `ts-node "${verifyScriptPath}" "${contractAddress}" ${network} ${contractName} ${additionalFlags}`.trim()

console.log(`🚀 Verifying contract on ${network} using Sourcify v2 API...`)
console.log(`📋 Contract Address: ${contractAddress}`)
if (contractName) {
  console.log(`📄 Contract Name: ${contractName}`)
}
if (additionalFlags.includes("--partial-match")) {
  console.log(`🔧 Match Type: match (metadata-only)`)
} else {
  console.log(`🔧 Match Type: exact_match (full bytecode)`)
}
console.log(`\nExecuting: ${command}`)
console.log("")

try {
  execSync(command, { stdio: "inherit" })
} catch (error) {
  process.exit(1)
}
