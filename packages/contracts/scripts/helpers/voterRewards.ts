import { VoterRewards, VoterRewards__factory } from "../../typechain-types"
import { type TransactionClause, Clause, ABIContract, Address } from "@vechain/sdk-core"
import { TransactionUtils } from "@repo/utils"
import { SeedAccount, TestPk } from "./seedAccounts"
import { chunk } from "./chunk"
import { getConfig } from "@repo/config"
import { ThorClient } from "@vechain/sdk-network"

const thorClient = ThorClient.at(getConfig().nodeUrl)

export const claimVoterRewards = async (
  voterRewards: VoterRewards,
  roundId: number,
  signingAcct: TestPk,
  accounts: SeedAccount[],
  ignoreErrors: boolean = false,
) => {
  console.log("Claiming voter rewards...")

  const contractAddress = await voterRewards.getAddress()
  const accountChunks = chunk(accounts, 50)

  for (const accountChunk of accountChunks) {
    try {
      const clauses: TransactionClause[] = []

      accountChunk.forEach(account => {
        clauses.push(
          Clause.callFunction(
            Address.of(contractAddress),
            ABIContract.ofAbi(VoterRewards__factory.abi).getFunction("claimReward"),
            [roundId, account.key.address.toString()],
          ),
        )
      })

      await TransactionUtils.sendTx(thorClient, clauses, signingAcct.pk)

      console.log(`Rewards claimed for chunk starting with account ${accountChunk[0]?.key.address.toString()}`)
    } catch (e) {
      if (ignoreErrors) {
        console.error(
          `Error claiming rewards for chunk starting with account ${accountChunk[0]?.key.address.toString()}:`,
          e,
        )
      } else {
        throw e
      }
    }
  }
  console.log("Finished attempting to claim voter rewards.")
}
