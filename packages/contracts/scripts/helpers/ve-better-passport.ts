import { VeBetterPassport__factory } from "../../typechain-types"
import { chunk } from "./chunk"
import { type TransactionClause, Clause, ABIContract, Address } from "@vechain/sdk-core"
import { TransactionUtils } from "@repo/utils"
import { TestPk } from "./seedAccounts"
import { getConfig } from "@repo/config"
import { ThorClient } from "@vechain/sdk-network"

const thorClient = ThorClient.at(getConfig().nodeUrl)

export const whitelist = async (accounts: string[], admin: TestPk, veBetterPassportAddress: string) => {
  console.log(`Whitelisting accounts...`)

  const accountChunks = chunk(accounts, 200)

  for (const accountChunk of accountChunks) {
    const clauses: TransactionClause[] = []

    accountChunk.forEach(account => {
      clauses.push(
        Clause.callFunction(
          Address.of(veBetterPassportAddress),
          ABIContract.ofAbi(VeBetterPassport__factory.abi).getFunction("whitelist"),
          [account],
        ),
      )
    })

    await TransactionUtils.sendTx(thorClient, clauses, admin.pk)
  }
}
