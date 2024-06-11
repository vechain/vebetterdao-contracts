import { VoterRewards, VoterRewards__factory } from "../../typechain-types"
import { clauseBuilder, type TransactionClause, type TransactionBody, coder, FunctionFragment } from "@vechain/sdk-core"
import { buildTxBody, signAndSendTx } from "./txHelper"
import { SeedAccount, TestPk } from "./seedAccounts"
import { chunk } from "./chunk"

export const claimVoterRewards = async (
  voterRewards: VoterRewards,
  roundId: number,
  signingAcct: TestPk,
  accounts: SeedAccount[],
) => {
  console.log("Claiming voter rewards...")

  const contractAddress = await voterRewards.getAddress()
  const accountChunks = chunk(accounts, 50)

  for (const accountChunk of accountChunks) {
    const clauses: TransactionClause[] = []

    accountChunk.map(account => {
      clauses.push(
        clauseBuilder.functionInteraction(
          contractAddress,
          coder
            .createInterface(JSON.stringify(VoterRewards__factory.abi))
            .getFunction("claimReward") as FunctionFragment,
          [roundId, account.key.address],
        ),
      )
    })

    const body: TransactionBody = await buildTxBody(clauses, signingAcct.address, 32)

    if (!signingAcct.pk) {
      throw new Error("Account does not have a private key")
    }

    await signAndSendTx(body, signingAcct.pk)
  }
}
