import { ethers } from "hardhat"
import {
  VOT3,
  X2EarnApps__factory,
  XAllocationVoting,
  XAllocationVoting__factory,
  X2EarnApps,
  Stargate,
} from "../../typechain-types"
import { type TransactionClause, Clause, Address, ABIContract } from "@vechain/sdk-core"
import { TransactionUtils } from "@repo/utils"
import { SeedAccount, TestPk } from "./seedAccounts"
import { chunk } from "./chunk"
import { getContractsConfig } from "@repo/config"
import { EnvConfig } from "@repo/config/contracts"
import { getConfig } from "@repo/config"
import { ThorClient } from "@vechain/sdk-network"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { uploadBlobToIPFS } from "./ipfs"

const thorClient = ThorClient.at(getConfig().nodeUrl)

export type App = {
  admin: string
  teamWalletAddress: string
  name: string
  metadataURI: string
  categories?: string[]
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
  endorsers: HardhatEthersSigner[],
  x2EarnApps: X2EarnApps,
  apps: string[],
  stargateMock: Stargate,
): Promise<void> => {
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  if (contractsConfig.X2EARN_NODE_COOLDOWN_PERIOD > 1) {
    return console.warn("Endorsement cooldown period is greater than 1. Skipping endorsement.")
  }

  const maxPointsPerNode = Number(await x2EarnApps.maxPointsPerNodePerApp())
  const threshold = Number(await x2EarnApps.endorsementScoreThreshold())

  console.log(`\n========== Endorsing ${apps.length} x-apps ==========`)
  console.log(`  Threshold: ${threshold} pts | Max per node per app: ${maxPointsPerNode} pts`)
  console.log(`  Endorsers available: ${endorsers.length}`)

  const stargateNFTAddress = await stargateMock.stargateNFT()
  const stargateNFT = await ethers.getContractAt("StargateNFT", stargateNFTAddress)

  // Build a map of endorser -> nodeIds
  const endorserNodes: { signer: HardhatEthersSigner; nodeIds: bigint[] }[] = []
  for (const endorser of endorsers) {
    const nodeIds = await stargateNFT.idsOwnedBy(endorser.address)
    if (nodeIds.length > 0) {
      endorserNodes.push({ signer: endorser, nodeIds: [...nodeIds] })
    }
  }

  console.log(
    `  Endorsers with nodes: ${endorserNodes.length} (total nodes: ${endorserNodes.reduce((sum, e) => sum + e.nodeIds.length, 0)})`,
  )

  // For each app, use multiple endorsers to reach the threshold
  for (const appId of apps) {
    const appInfo = await x2EarnApps.app(appId)
    const appName = appInfo.name || appId.slice(0, 10) + "..."

    let totalPoints = 0
    const endorsements: string[] = []

    // Round-robin through endorsers, using their available nodes
    for (const endorser of endorserNodes) {
      if (totalPoints >= threshold) break

      for (const nodeId of endorser.nodeIds) {
        if (totalPoints >= threshold) break

        const remaining = threshold - totalPoints
        const points = Math.min(remaining, maxPointsPerNode)

        try {
          await x2EarnApps.connect(endorser.signer).endorseApp(appId, nodeId, points)
          totalPoints += points
          endorsements.push(`    node #${nodeId} (${endorser.signer.address.slice(0, 8)}...) -> ${points} pts`)
        } catch {
          // Node may have hit its cap for this app, skip
        }
      }
    }

    const status = totalPoints >= threshold ? "ENDORSED" : "PARTIAL"
    console.log(`\n  [${status}] ${appName} — ${totalPoints}/${threshold} pts`)
    endorsements.forEach(line => console.log(line))
  }

  console.log(`\n========== Endorsement complete ==========\n`)
}

export const assignAppCategories = async (
  x2EarnApps: X2EarnApps,
  deployer: HardhatEthersSigner,
  apps: App[],
): Promise<void> => {
  const config = getConfig()
  const baseURI = await x2EarnApps.baseURI()
  const allAppIds = await x2EarnApps.apps()
  const appsWithCategories = apps.filter(a => a.categories && a.categories.length > 0)

  if (appsWithCategories.length === 0) {
    console.log("No apps with categories to assign, skipping...")
    return
  }

  console.log(`\n========== Assigning categories to ${appsWithCategories.length} apps ==========`)

  for (const app of appsWithCategories) {
    const appEntry = allAppIds.find((a: any) => a.name === app.name)
    if (!appEntry) {
      console.log(`  [SKIP] ${app.name} — not found on-chain`)
      continue
    }
    const appId = appEntry.id

    // Fetch current metadata from IPFS
    const metadataUri = await x2EarnApps.metadataURI(appId)
    const fullUri = `${baseURI}${metadataUri}`
    const fetchUrl = fullUri.replace("ipfs://", `${config.ipfsFetchingService}/`)

    let metadata: Record<string, any> = {}
    try {
      const response = await fetch(fetchUrl)
      if (response.ok) {
        metadata = (await response.json()) as Record<string, any>
      }
    } catch {
      // If fetch fails, start with minimal metadata
      metadata = { name: app.name }
    }

    // Add categories
    metadata.categories = app.categories

    // Upload updated metadata to IPFS
    const blob = new Blob([JSON.stringify(metadata)], { type: "application/json" })
    const newCid = await uploadBlobToIPFS(blob, `${app.name}-metadata.json`)

    // Update metadata on-chain (deployer has DEFAULT_ADMIN_ROLE)
    await x2EarnApps.connect(deployer).updateAppMetadata(appId, newCid)

    console.log(`  [OK] ${app.name} — categories: [${app.categories!.join(", ")}] — CID: ${newCid}`)
  }

  console.log(`\n========== Categories assigned ==========\n`)
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
