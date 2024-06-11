import { VOT3, X2EarnApps__factory, XAllocationVoting, XAllocationVoting__factory } from "../../typechain-types"
import { clauseBuilder, type TransactionClause, type TransactionBody, coder, FunctionFragment } from "@vechain/sdk-core"
import { buildTxBody, signAndSendTx } from "./txHelper"
import { SeedAccount, TestPk } from "./seedAccounts"
import { chunk } from "./chunk"

export type App = {
  address: string
  name: string
  metadataURI: string
}

export const addXDapps = async (contractAddress: string, account: TestPk, apps: App[]) => {
  console.log("Adding x-apps...")

  const appChunks = chunk(apps, 50)

  for (const appChunk of appChunks) {
    const clauses: TransactionClause[] = []

    appChunk.map(app => {
      clauses.push(
        clauseBuilder.functionInteraction(
          contractAddress,
          coder.createInterface(JSON.stringify(X2EarnApps__factory.abi)).getFunction("addApp") as FunctionFragment,
          [app.address, app.address, app.name, app.metadataURI],
        ),
      )
    })

    const body: TransactionBody = await buildTxBody(clauses, account.address, 32)

    if (!account.pk) {
      throw new Error("Account does not have a private key")
    }

    await signAndSendTx(body, account.pk)
  }
}

export const castVotesToXDapps = async (
  vot3: VOT3,
  xAllocationVoting: XAllocationVoting,
  accounts: SeedAccount[],
  roundId: number,
  apps: string[],
) => {
  console.log("Casting votes to xDapps...")
  const chunks = chunk(accounts, 50)
  const contractAddress = await xAllocationVoting.getAddress()

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async account => {
        const clauses: TransactionClause[] = []
        const votePower = BigInt(await vot3.balanceOf(account.key.address))

        const splits: { app: string; weight: bigint }[] = []

        // eslint-disable-next-line no-unused-vars
        let randomDappsToVote = apps.filter(_ => Math.floor(Math.random() * 2) == 0)
        if (!randomDappsToVote.length) randomDappsToVote = apps

        // Get the vote power per xDapp rounding down
        const votePowerPerApp = votePower / BigInt(randomDappsToVote.length)

        randomDappsToVote.forEach(app => splits.push({ app: app, weight: votePowerPerApp }))

        clauses.push(
          clauseBuilder.functionInteraction(
            contractAddress,
            coder
              .createInterface(JSON.stringify(XAllocationVoting__factory.abi))
              .getFunction("castVote") as FunctionFragment,
            [roundId, splits.map(split => split.app), splits.map(split => split.weight)],
          ),
        )
        const body: TransactionBody = await buildTxBody(clauses, account.key.address, 32, 250_000 * splits.length)

        await signAndSendTx(body, account.key.pk)
      }),
    )
  }
  console.log("Votes cast.")
}
