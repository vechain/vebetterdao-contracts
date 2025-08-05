import { Emissions__factory, VoterRewards, VoterRewards__factory } from "../../typechain-types"
import { type TransactionClause, Clause, Address, ABIContract } from "@vechain/sdk-core"
import { TransactionUtils } from "@repo/utils"
import { TestPk } from "./seedAccounts"
import { getConfig } from "@repo/config"
import { ThorClient } from "@vechain/sdk-network"

const thorClient = ThorClient.at(getConfig().nodeUrl)

export const bootstrapEmissions = async (contractAddress: string, admin: TestPk) => {
  console.log("Bootstrapping emissions...")

  const clauses: TransactionClause[] = []

  clauses.push(
    Clause.callFunction(
      Address.of(contractAddress),
      ABIContract.ofAbi(Emissions__factory.abi).getFunction("bootstrap"),
      [],
    ),
  )

  await TransactionUtils.sendTx(thorClient, clauses, admin.pk)
}

export const startEmissions = async (contractAddress: string, acct: TestPk) => {
  console.log("Starting emissions...")

  const clauses: TransactionClause[] = []

  clauses.push(
    Clause.callFunction(
      Address.of(contractAddress),
      ABIContract.ofAbi(Emissions__factory.abi).getFunction("start"),
      [],
    ),
  )

  await TransactionUtils.sendTx(thorClient, clauses, acct.pk)
}

export const toggleQuadraticRewarding = async (voterRewards: VoterRewards, acct: TestPk) => {
  console.log("Toggling quadratic rewarding...")

  const clauses: TransactionClause[] = []

  clauses.push(
    Clause.callFunction(
      Address.of(await voterRewards.getAddress()),
      ABIContract.ofAbi(VoterRewards__factory.abi).getFunction("toggleQuadraticRewarding"),
      [],
    ),
  )

  await TransactionUtils.sendTx(thorClient, clauses, acct.pk)
}

export const distributeEmissions = async (contractAddress: string, acct: TestPk) => {
  console.log("Distributing emissions...")

  const clauses: TransactionClause[] = []

  clauses.push(
    Clause.callFunction(
      Address.of(contractAddress),
      ABIContract.ofAbi(Emissions__factory.abi).getFunction("distribute"),
      [],
    ),
  )

  await TransactionUtils.sendTx(thorClient, clauses, acct.pk)
}
