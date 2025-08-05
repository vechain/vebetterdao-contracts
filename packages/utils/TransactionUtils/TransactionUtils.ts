import { type TransactionClause, type TransactionBody, Transaction, Address } from "@vechain/sdk-core"
import { ThorClient } from "@vechain/sdk-network"

let chainTag: number

export const getBestBlockRef = async (thorClient: ThorClient): Promise<string> => {
  const blockRef = await thorClient.blocks.getBestBlockRef()

  if (!blockRef) {
    throw new Error("Block ref not found")
  }

  return blockRef
}

export const getChainTag = async (thorClient: ThorClient): Promise<number> => {
  if (chainTag) {
    return chainTag
  }

  const genesisBlock = await thorClient.blocks.getGenesisBlock()

  if (!genesisBlock) {
    throw new Error("Genesis block not found")
  }

  chainTag = Number(`0x${genesisBlock.id.slice(64)}`)
  return chainTag
}

export const buildTxBody = async (
  thorClient: ThorClient,
  clauses: TransactionClause[],
  senderAddress: Address,
  expiration: number,
  gas?: number,
): Promise<TransactionBody> => {
  if (!gas) {
    // Get gas estimate
    const gasResult = await thorClient.gas.estimateGas(clauses, senderAddress.toString())

    if (gasResult.reverted) {
      throw new Error(`Gas estimation failed: ${gasResult.revertReasons} - ${gasResult.vmErrors}`)
    }

    gas = gasResult.totalGas + 200_000
  }

  const body: TransactionBody = {
    chainTag: await getChainTag(thorClient),
    blockRef: await getBestBlockRef(thorClient),
    expiration,
    clauses,
    gasPriceCoef: 0,
    gas,
    dependsOn: null,
    nonce: Math.floor(Math.random() * 10000000),
  }

  return body
}

const signAndSendTx = async (thorClient: ThorClient, body: TransactionBody, pk: Uint8Array) => {
  const signedTx = Transaction.of(body).sign(Buffer.from(pk))

  const sendTransactionResult = await thorClient.transactions.sendTransaction(signedTx)

  const txReceipt = await thorClient.transactions.waitForTransaction(sendTransactionResult.id)

  if (!txReceipt) {
    throw new Error("Transaction failed")
  }
  if (txReceipt.reverted) {
    throw new Error("Transaction reverted")
  }
}

export const sendTx = async (
  thorClient: ThorClient,
  clauses: TransactionClause[],
  pk: Uint8Array,
  retries: number = 5,
) => {
  const signerAddress = Address.ofPrivateKey(pk)

  const actualRetries = Math.max(0, retries) // Ensure retries is not negative

  for (let attempt = 1; attempt < actualRetries + 1; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`Attempt ${attempt} of ${actualRetries}: Sending transaction...`)
      }
      // Rebuild the transaction body for each attempt to get fresh gas, nonce, and blockRef.
      const body: TransactionBody = await buildTxBody(thorClient, clauses, signerAddress, 32)

      await signAndSendTx(thorClient, body, pk) // This function signs the body and sends the transaction
      return // Transaction was successful, exit the function
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`Attempt ${attempt} of ${actualRetries + 1} failed: ${errorMessage}`)

      if (attempt >= actualRetries) {
        console.error(`All ${actualRetries + 1} attempts to send transaction failed. Rethrowing last error.`)
        throw error // All retries failed, rethrow the last encountered error
      }

      // Linear backoff delay (e.g., 1s, 2s, 3s...)
      const delayMs = 1000 * attempt
      console.log(`Waiting ${delayMs / 1000} second(s) before next attempt...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}
