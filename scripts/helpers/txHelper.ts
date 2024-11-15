import { getConfig } from "@repo/config"
import { TransactionHandler, type TransactionClause, type TransactionBody } from "@vechain/sdk-core"
import { HttpClient, ThorClient } from "@vechain/sdk-network"

const thorNetwork = new HttpClient(getConfig().nodeUrl)
const thorClient = new ThorClient(thorNetwork)
let chainTag: number

export const getBestBlockRef = async (): Promise<string> => {
  const blockRef = await thorClient.blocks.getBestBlockRef()

  if (!blockRef) {
    throw new Error("Block ref not found")
  }

  return blockRef
}

export const getChainTag = async (): Promise<number> => {
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
  clauses: TransactionClause[],
  senderAddress: string,
  expiration: number,
  gas?: number,
): Promise<TransactionBody> => {
  if (!gas) {
    // Get gas estimate
    const gasResult = await thorClient.gas.estimateGas(clauses, senderAddress)

    if (gasResult.reverted) {
      throw new Error(`Gas estimation failed: ${gasResult.revertReasons} - ${gasResult.vmErrors}`)
    }

    gas = gasResult.totalGas + 200_000
  }

  const body: TransactionBody = {
    chainTag: await getChainTag(),
    blockRef: await getBestBlockRef(),
    expiration,
    clauses,
    gasPriceCoef: 0,
    gas,
    dependsOn: null,
    nonce: Math.floor(Math.random() * 10000000),
  }

  return body
}

export const signAndSendTx = async (body: TransactionBody, pk: Uint8Array) => {
  const signedTx = TransactionHandler.sign(body, Buffer.from(pk))

  const sendTransactionResult = await thorClient.transactions.sendTransaction(signedTx)

  const txReceipt = await thorClient.transactions.waitForTransaction(sendTransactionResult.id)
  // console.log(`Transaction receipt: ${JSON.stringify(txReceipt)}`)

  if (!txReceipt) {
    throw new Error("Transaction failed")
  }
  if (txReceipt.reverted) {
    throw new Error("Transaction reverted")
  }
}
