import { getConfig } from "@repo/config"
import { EnvConfig } from "@repo/config/contracts"
import { ethers, network } from "hardhat"
import * as path from "path"
import * as fs from "fs"

import { B3TRGovernor, B3TRGovernor__factory } from "../../../typechain-types"
import {
  ThorClient,
  ProviderInternalBaseWallet,
  VeChainProvider,
  signerUtils,
  VeChainSigner,
} from "@vechain/sdk-network"
import { ABIContract, Address, Clause, Mnemonic, TransactionClause } from "@vechain/sdk-core"
import BigNumber from "bignumber.js"
import { AddressUtils } from "@repo/utils"

interface UserDeposit {
  walletAddress: string
  totalDepositAmount: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  validDeposits: UserDeposit[]
}

async function getUserVotingPower(b3trGovernor: B3TRGovernor, walletAddress: string) {
  const currentBlock = await b3trGovernor.clock()
  const votingPower = await b3trGovernor.getDepositVotingPower(walletAddress, currentBlock)
  return votingPower
}

async function loadStuckDepositsData(filePath: string): Promise<UserDeposit[]> {
  console.log("\n📂 Loading stuck deposits data...")

  if (!fs.existsSync(filePath)) {
    throw new Error(`Stuck deposits data file not found: ${filePath}`)
  }

  const fileContent = fs.readFileSync(filePath, "utf8")
  return JSON.parse(fileContent) as UserDeposit[]
}

async function previewRunOfScript(stuckDeposits: UserDeposit[]) {
  // Show preview of raw stuck deposits to be seeded
  console.log("\n📋 Preview of stuck deposits to be seeded:")
  for (let i = 0; i < Math.min(10, stuckDeposits.length); i++) {
    const entry = stuckDeposits[i]
    console.log(
      `  ${i + 1}. Wallet: ${entry.walletAddress.slice(0, 8)}... | Amount: ${ethers.formatEther(entry.totalDepositAmount)} VOT3`,
    )
  }
  if (stuckDeposits.length > 10) {
    console.log(`  ... and ${stuckDeposits.length - 10} more entries`)
  }
}

/**
 * Validates the deposits before processing them
 */
async function validateDeposits(
  stuckDeposits: UserDeposit[],
  b3trGovernor: B3TRGovernor,
  deployerAddress: string,
): Promise<ValidationResult> {
  const errors: string[] = []
  const validDeposits: UserDeposit[] = []
  const currentBlock = await b3trGovernor.clock()
  console.log(`\n🔍 Validating deposits on block ${currentBlock}...`)

  // Check if deployer has the required role
  try {
    const DEFAULT_ADMIN_ROLE = await b3trGovernor.DEFAULT_ADMIN_ROLE()
    const hasRole = await b3trGovernor.hasRole(DEFAULT_ADMIN_ROLE, deployerAddress)

    if (!hasRole) {
      errors.push(`Deployer ${deployerAddress} does not have DEFAULT_ADMIN_ROLE`)
    }
  } catch (error) {
    errors.push(`Failed to check deployer role: ${error}`)
  }

  // Validate each deposit
  for (let i = 0; i < stuckDeposits.length; i++) {
    const deposit = stuckDeposits[i]

    try {
      // Check if wallet address is valid
      if (!AddressUtils.isValid(deposit.walletAddress) || deposit.walletAddress === ethers.ZeroAddress) {
        errors.push(`Invalid wallet address at index ${i}: ${deposit.walletAddress}`)
        continue
      }

      // Check if deposit amount is valid and > 0
      const amount = new BigNumber(deposit.totalDepositAmount.toString())
      if (amount.isNaN() || amount.isLessThanOrEqualTo(0)) {
        errors.push(`Invalid deposit amount at index ${i}: ${deposit.totalDepositAmount}`)
        continue
      }

      // Check current voting power (optional - for logging)
      try {
        const currentVotingPower = await getUserVotingPower(b3trGovernor, deposit.walletAddress)
        console.log(
          `  ✅ ${deposit.walletAddress.slice(0, 8)}... | Current: ${currentVotingPower} VOT3 | To Add: ${amount.toString()} VOT3`,
        )
      } catch (error) {
        // Non-critical error, just log it
        console.log(`  ⚠️  Could not check current voting power for ${deposit.walletAddress}: ${error}`)
      }

      validDeposits.push(deposit)
    } catch (error) {
      errors.push(`Validation error for deposit at index ${i}: ${error}`)
    }
  }

  const isValid = errors.length === 0 && validDeposits.length > 0

  return {
    isValid,
    errors,
    validDeposits,
  }
}

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV environment variable")
  }

  if (!process.env.MNEMONIC) {
    throw new Error("Missing MNEMONIC environment variable")
  }
  const CHUNK_SIZE = 50
  const environment = process.env.NEXT_PUBLIC_APP_ENV as EnvConfig
  const config = getConfig(environment)

  // Setup SDK
  const thor = ThorClient.at(config.nodeUrl)
  const listOfWords = process.env.MNEMONIC.split(" ")
  const privateKey = Mnemonic.toPrivateKey(listOfWords)
  const address = Address.ofPrivateKey(privateKey)
  const wallet = new ProviderInternalBaseWallet([
    {
      privateKey: privateKey,
      address: address.toString(),
    },
  ])
  const provider = new VeChainProvider(thor, wallet, false)
  const signer = await provider.getSigner(address.toString())

  if (!signer) {
    throw new Error("Failed to get signer")
  }

  console.log("\n=== Stuck Deposits Voting Power Seeding Script ===")
  console.log(`Environment: ${environment}`)
  console.log(`Network: ${config.network.name} (${network.name})`)
  console.log(`Signer address: ${await signer.getAddress()}`)
  console.log(`B3TR Governor contract: ${config.b3trGovernorAddress}`)
  console.log(`Chunk size: ${CHUNK_SIZE}`)

  // Get contract instance
  const b3trGovernor = (await ethers.getContractAt("B3TRGovernor", config.b3trGovernorAddress)) as B3TRGovernor

  // Load stuck deposits data
  const filePath = path.join(__dirname, "cleaned", `moneyStuck-${environment}.json`)
  const stuckDeposits = await loadStuckDepositsData(filePath)

  //Show a preview of the wallets and amounts to be seeded
  previewRunOfScript(stuckDeposits)

  // Validate deposits
  //Check if the deployer has the DEFAULT_ADMIN_ROLE
  //Check if any invalid or 0x0 addresses are present
  //Check if seeding amount is a number and greater than 0
  const validation = await validateDeposits(stuckDeposits, b3trGovernor, address.toString())

  if (!validation.isValid) {
    console.error("\n❌ Validation failed:")
    validation.errors.forEach((error, index) => console.error(`  • [${index + 1}] --->  ${error}`))
    process.exit(1)
  }

  //Process and send transactions in chunks
  await processAndSendInChunks(
    validation.validDeposits,
    thor,
    signer,
    address,
    config.b3trGovernorAddress,
    CHUNK_SIZE,
    environment,
  )
}

const processAndSendInChunks = async (
  validDeposits: UserDeposit[],
  thor: ThorClient,
  signer: VeChainSigner,
  address: Address,
  b3trGovernorAddress: string,
  chunkSize: number = 4,
  environment: EnvConfig,
) => {
  //Array to store reverted transactions
  const revertedUserDeposits: UserDeposit[] = []

  //Loop over all the valid deposits and send them in chunks
  for (let i = 0; i < validDeposits.length; i += chunkSize) {
    //Slice the valid deposits in chunks of CHUNK_SIZE
    const slicedValidDeposits = validDeposits.slice(i, i + chunkSize)
    const clausesForThisBatch = slicedValidDeposits.map(deposit =>
      Clause.callFunction(
        Address.of(b3trGovernorAddress),
        ABIContract.ofAbi(B3TRGovernor__factory.abi).getFunction("seedVotingPower"),
        [deposit.walletAddress, deposit.totalDepositAmount],
      ),
    )
    const currentBatch = i / chunkSize + 1
    const totalBatches = Math.ceil(validDeposits.length / chunkSize)

    console.log(`\n====================== Start Batch ${currentBatch} of ${totalBatches} ======================`)
    console.log(`  ⏳ Sending a transaction with ${clausesForThisBatch.length} clauses `)

    const tx = await buildAndSendTransaction(clausesForThisBatch, thor, signer, address)
    const txReceipt = await thor.transactions.waitForTransaction(tx.id)

    if (txReceipt?.reverted) {
      //If the transaction is reverted, add the deposits to the revertedUserDeposits array and log the error
      revertedUserDeposits.push(...slicedValidDeposits)
      console.error(`  ❌ Transaction ${tx.id} reverted for batch ${currentBatch}`)
      console.error(`\n====================== End of batch ${currentBatch} of ${totalBatches} ======================`)
    } else {
      //If the transaction is successful, log the success and end the batch
      console.log(`    ✅ Transaction ID: ${tx.id}`)
      console.log(`    ✅ Batch ${currentBatch} completed!`)
      console.log(`\n====================== End of batch ${currentBatch} of ${totalBatches} ======================`)
    }
  }

  //Check if the wallets are seeded and matched the expected voting power from the seed file
  const b3trGovernor = (await ethers.getContractAt("B3TRGovernor", b3trGovernorAddress)) as B3TRGovernor
  const { successDeposits, failedDeposits } = await checkIfWalletsAreSeeded(validDeposits, b3trGovernor)

  //Save reverted deposits that were not successfully seeded to file and the transaction reverted
  fs.writeFileSync(
    path.join(__dirname, "output", `reverted-${environment}-${new Date().toISOString()}.json`),
    JSON.stringify(revertedUserDeposits, null, 2),
  )
  //Save successful seeds that were successfully and matched the expected voting power from the seed file
  fs.writeFileSync(
    path.join(__dirname, "output", `success-${environment}-${new Date().toISOString()}.json`),
    JSON.stringify(successDeposits, null, 2),
  )
  //Save successful seeds that failed to match the expected voting power from the seed file
  fs.writeFileSync(
    path.join(__dirname, "output", `failed-validation-${environment}-${new Date().toISOString()}.json`),
    JSON.stringify(failedDeposits, null, 2),
  )
}

const checkIfWalletsAreSeeded = async (seedFile: UserDeposit[], b3trGovernor: B3TRGovernor) => {
  console.log(`\n🔍 Checking if wallets are seeded...`)
  const successDeposits: UserDeposit[] = []
  const failedDeposits: UserDeposit[] = []
  for (const deposit of seedFile) {
    //Get index wallet current voting power
    const currentVotingPower = await getUserVotingPower(b3trGovernor, deposit.walletAddress)

    if (currentVotingPower.toString() === deposit.totalDepositAmount) {
      console.log(`  ✅ ${deposit.walletAddress.slice(0, 8)}... seeded correctly`)
      successDeposits.push(deposit)
    } else {
      console.log(
        `  ❌ ${deposit.walletAddress.slice(0, 8)}... | Current: ${currentVotingPower} VOT3 | Expected: ${deposit.totalDepositAmount} VOT3`,
      )
      failedDeposits.push(deposit)
    }
  }
  return { successDeposits, failedDeposits }
}

const buildAndSendTransaction = async (
  clauses: TransactionClause[],
  thor: ThorClient,
  signer: VeChainSigner,
  address: Address,
) => {
  const gasResult = await thor.gas.estimateGas(clauses, address.toString(), {
    gasPadding: 1, //100% padding
  })

  const txBody = await thor.transactions.buildTransactionBody(clauses, gasResult.totalGas)

  const txInput = signerUtils.transactionBodyToTransactionRequestInput(txBody, address.toString())

  const rawSignedTransaction = await signer.signTransaction(txInput)

  const tx = await thor.transactions.sendRawTransaction(rawSignedTransaction)

  return tx
}

// Handle errors
main().catch(error => {
  console.error("\n❌ Error during seeding:", error)
  process.exit(1)
})
