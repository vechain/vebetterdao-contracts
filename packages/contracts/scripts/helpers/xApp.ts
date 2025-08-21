import {
  VOT3,
  X2EarnApps__factory,
  XAllocationVoting,
  XAllocationVoting__factory,
  X2EarnApps,
  TokenAuction,
  StargateNFT,
} from "../../typechain-types"
import { type TransactionClause, Clause, Address, ABIContract } from "@vechain/sdk-core"
import { TransactionUtils } from "@repo/utils"
import { SeedAccount, TestPk } from "./seedAccounts"
import { chunk } from "./chunk"
import { getContractsConfig } from "@repo/config"
import { EnvConfig } from "@repo/config/contracts"
import { getConfig } from "@repo/config"
import { ThorClient } from "@vechain/sdk-network"

const thorClient = ThorClient.at(getConfig().nodeUrl)

export type App = {
  admin: string
  teamWalletAddress: string
  name: string
  metadataURI: string
}

export const registerXDapps = async (contractAddress: string, accounts: TestPk[], apps: App[]) => {
  console.log("Adding x-apps...")

  const appChunks = chunk(apps, 50)

  for (const appChunk of appChunks) {
    // For each apps
    for (let i = 0; i < appChunk.length; i++) {
      const app = appChunk[i]
      const account = accounts[i % accounts.length] // Unique signer for each app

      const clause = Clause.callFunction(
        Address.of(contractAddress),
        ABIContract.ofAbi(X2EarnApps__factory.abi).getFunction("submitApp"),
        [app.teamWalletAddress, app.admin, app.name, app.metadataURI],
      )

      await TransactionUtils.sendTx(thorClient, [clause], account.pk)
    }
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

  // 8 apps
  for (let i = 0; i < apps.length; i++) {
    const owner = endorsers[i].key.address
    const nodeId = await vechainNodesMock.ownerToId(owner.toString())
    const clause = Clause.callFunction(
      Address.of(await x2EarnApps.getAddress()),
      ABIContract.ofAbi(X2EarnApps__factory.abi).getFunction("endorseApp"),
      [apps[i], nodeId],
    )

    await TransactionUtils.sendTx(thorClient, [clause], endorsers[i].key.pk)
  }

  console.log("x-apps endorsed.")
}

export const castVotesToXDapps = async (
  vot3: VOT3,
  xAllocationVoting: XAllocationVoting,
  accounts: SeedAccount[],
  roundId: number,
  apps: string[],
  ignoreErrors: boolean = false,
) => {
  console.log("Casting votes to xDapps...")
  if (apps.length === 0) {
    throw new Error("No xDapps to vote for.")
  }

  const chunks = chunk(accounts, 50)
  const contractAddress = await xAllocationVoting.getAddress()

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async account => {
        try {
          const clauses: TransactionClause[] = []
          const votePower = BigInt(await vot3.balanceOf(account.key.address.toString()))

          const splits: { app: string; weight: bigint }[] = []

          // eslint-disable-next-line no-unused-vars
          let randomDappsToVote = apps.filter(_ => Math.floor(Math.random() * 2) == 0)
          if (!randomDappsToVote.length) randomDappsToVote = apps

          // Get the vote power per xDapp rounding down
          const votePowerPerApp = votePower / BigInt(randomDappsToVote.length)

          randomDappsToVote.forEach(app => splits.push({ app: app, weight: votePowerPerApp }))

          clauses.push(
            Clause.callFunction(
              Address.of(contractAddress),
              ABIContract.ofAbi(XAllocationVoting__factory.abi).getFunction("castVote"),
              [roundId, splits.map(split => split.app), splits.map(split => split.weight)],
            ),
          )

          console.log(
            `Casting round ${roundId} votes for ${account.key.address} with ${splits.map(
              split => split.weight,
            )} votes to ${splits.map(split => split.app)}`,
          )
          await TransactionUtils.sendTx(thorClient, clauses, account.key.pk)
        } catch (e) {
          if (ignoreErrors) {
            console.error(`Error casting vote for account ${account.key.address}:`, e)
          } else {
            throw e
          }
        }
      }),
    )
  }
  console.log("Votes cast.")
}
