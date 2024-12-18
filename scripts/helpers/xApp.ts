import {
  VOT3,
  X2EarnApps__factory,
  XAllocationVoting,
  XAllocationVoting__factory,
  X2EarnApps,
  TokenAuction,
} from "../../typechain-types"
import { clauseBuilder, type TransactionClause, type TransactionBody, coder, FunctionFragment } from "@vechain/sdk-core"
import { buildTxBody, signAndSendTx } from "./txHelper"
import { SeedAccount, TestPk } from "./seedAccounts"
import { chunk } from "./chunk"
import { EnvConfig, getContractsConfig } from "../../config/contracts"

export type App = {
  admin: string
  teamWalletAddress: string
  name: string
  metadataURI: string
}

export const registerXDapps = async (contractAddress: string, account: TestPk, apps: App[]) => {
  console.log("Adding x-apps...")

  const appChunks = chunk(apps, 50)

  for (const appChunk of appChunks) {
    const clauses: TransactionClause[] = []

    appChunk.map(app => {
      clauses.push(
        clauseBuilder.functionInteraction(
          contractAddress,
          coder.createInterface(JSON.stringify(X2EarnApps__factory.abi)).getFunction("submitApp") as FunctionFragment,
          [app.teamWalletAddress, app.admin, app.name, app.metadataURI],
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

export const endorseXApps = async (
  endorsers: SeedAccount[],
  x2EarnApps: X2EarnApps,
  apps: string[],
  vechainNodesMock: TokenAuction,
): Promise<void> => {
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  if (contractsConfig.X2EARN_NODE_COOLDOWN_PERIOD > 1) {
    return console.warn("Endorsement cooldown period is greater than 1. Skipping endorsement.")
  }
  console.log("Endorsing x-apps...")

  for (let i = 0; i < apps.length; i++) {
    const owner = endorsers[i].key.address
    const nodeId = await vechainNodesMock.ownerToId(owner)
    const clause = clauseBuilder.functionInteraction(
      await x2EarnApps.getAddress(),
      coder.createInterface(JSON.stringify(X2EarnApps__factory.abi)).getFunction("endorseApp") as FunctionFragment,
      [apps[i], nodeId],
    )

    try {
      const body: TransactionBody = await buildTxBody([clause], owner, 32)
      await signAndSendTx(body, endorsers[i].key.pk)
    } catch (e) {
      console.log("Endorsing x-apps failed with error: ", e)
    }
  }

  console.log("x-apps endorsed.")
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

        console.log(
          `Casting votes for ${roundId} with ${splits.map(split => split.weight)} votes to ${splits.map(split => split.app)}`,
        )
        const body: TransactionBody = await buildTxBody(clauses, account.key.address, 32, 250_000 * splits.length)

        await signAndSendTx(body, account.key.pk)
        console.log("Votes cast fro account", account.key.address)
      }),
    )
  }
  console.log("Votes cast.")
}
