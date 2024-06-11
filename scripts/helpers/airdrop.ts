import { B3TR, Treasury__factory } from "../../typechain-types"
import {
  clauseBuilder,
  type TransactionClause,
  type TransactionBody,
  coder,
  FunctionFragment,
  VTHO_ADDRESS,
  unitsUtils,
} from "@vechain/sdk-core"
import { buildTxBody, signAndSendTx } from "./txHelper"
import { SeedAccount, TestPk } from "./seedAccounts"
import { chunk } from "./chunk"

export const airdropVTHO = async (accounts: SeedAccount[], signingAcct: TestPk) => {
  console.log(`Airdropping VTHO...`)

  const accountChunks = chunk(accounts, 200)

  for (const accountChunk of accountChunks) {
    const clauses: TransactionClause[] = []

    accountChunk.map(account => {
      clauses.push(clauseBuilder.transferToken(VTHO_ADDRESS, account.key.address, unitsUtils.parseVET("200000")))
    })

    const body: TransactionBody = await buildTxBody(clauses, signingAcct.address, 32)

    if (!signingAcct.pk) {
      throw new Error("Account does not have a private key")
    }
    await signAndSendTx(body, signingAcct.pk)
  }
}

/**
 * Transfer ERC20 tokens
 */
export const transferErc20 = async (tokenAddress: string, sender: TestPk, recipient: string, amount: bigint) => {
  const clauses: TransactionClause[] = []

  clauses.push(clauseBuilder.transferToken(tokenAddress, recipient, amount))

  const body: TransactionBody = await buildTxBody(clauses, sender.address, 32)

  await signAndSendTx(body, sender.pk)
}

/**
 *  Airdrop B3TR from treasury to a list of accounts
 */
export const airdropB3trFromTreasury = async (treasuryAddress: string, admin: TestPk, accounts: SeedAccount[]) => {
  console.log(`Airdropping B3TR...`)

  const accountChunks = chunk(accounts, 100)

  for (const accountChunk of accountChunks) {
    const clauses: TransactionClause[] = []

    accountChunk.map(account => {
      clauses.push(
        clauseBuilder.functionInteraction(
          treasuryAddress,
          coder.createInterface(JSON.stringify(Treasury__factory.abi)).getFunction("transferB3TR") as FunctionFragment,
          [account.key.address, account.amount],
        ),
      )
    })

    const body: TransactionBody = await buildTxBody(clauses, admin.address, 32)

    if (!admin.pk) {
      throw new Error("Account does not have a private key")
    }
    await signAndSendTx(body, admin.pk)
  }
}
