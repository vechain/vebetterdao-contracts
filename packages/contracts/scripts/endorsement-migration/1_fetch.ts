/**
 * Fetches endorsement state for migration. Frontend uses the same source of truth:
 * - Score: getScore(appId) (useAppEndorsementScore)
 * - Endorsers list/count: getEndorsers(appId) which filters getEndorserNodes by tokenExists (useAppEndorsers)
 * This script aligns with that by filtering to getEndorserNodes when the contract supports it and by normalizing appId in event keys.
 *
 * Event signatures: Only two AppEndorsed shapes exist (V2–V7: bytes32,uint256,bool | V8: bytes32,uint256,address,uint256).
 * Both are queried below. See EVENT_SIGNATURES.md for the full history across deprecated contracts.
 */
import { ethers } from "hardhat"
import { getMigrationConfig, getX2EarnAppsContract, saveMigrationData } from "./helpers"
import type { AppInfo, EndorsementSnapshot, MigrationData } from "./types"

const DEFAULT_CAP = 49
const CHUNK_BLOCKS = 500_000
const MAX_APP_SCORE = 110
const MIN_POINTS_PER_ENDORSER = 1

function applyReductionRules(endorsements: EndorsementSnapshot[]): void {
  const byApp = new Map<string, EndorsementSnapshot[]>()
  for (const e of endorsements) {
    const list = byApp.get(e.appId) ?? []
    list.push(e)
    byApp.set(e.appId, list)
  }
  for (const [, list] of byApp) {
    const currentScore = list.reduce((s, e) => s + e.points, 0)
    if (currentScore <= MAX_APP_SCORE) continue
    const totalRefund = currentScore - MAX_APP_SCORE
    const reducible = list.map(e => Math.max(0, e.points - MIN_POINTS_PER_ENDORSER))
    const totalReducible = reducible.reduce((a, b) => a + b, 0)
    if (totalReducible === 0) continue
    const share = reducible.map(r => r / totalReducible)
    const reduction = share.map(s => Math.floor(s * totalRefund))
    let totalReduction = reduction.reduce((a, b) => a + b, 0)
    let remainingReducible = reducible.map((r, i) => r - reduction[i])
    while (totalReduction < totalRefund) {
      let best = -1
      for (let i = 0; i < list.length; i++) {
        if (remainingReducible[i] > 0 && (best === -1 || remainingReducible[i] > remainingReducible[best])) best = i
      }
      if (best === -1) break
      reduction[best] += 1
      totalReduction += 1
      remainingReducible[best] -= 1
    }
    for (let i = 0; i < list.length; i++) {
      list[i].points = Math.max(MIN_POINTS_PER_ENDORSER, list[i].points - reduction[i])
    }
  }
}

function normalizeAppId(appId: string | bigint): string {
  const raw = typeof appId === "bigint" ? "0x" + appId.toString(16).padStart(64, "0") : String(appId)
  const hex = raw.startsWith("0x") ? raw : "0x" + raw
  const padded = hex.length >= 66 ? hex.slice(0, 66) : "0x" + hex.slice(2).padStart(64, "0")
  return padded.toLowerCase()
}

const V7_ABI = [
  "event AppEndorsed(bytes32 indexed id, uint256 nodeId, bool endorsed)",
  "function getNodeEndorsementScore(uint256 nodeId) view returns (uint256)",
  "function app(bytes32 appId) view returns (bytes32 id, address teamWalletAddress, string name, string metadataURI, uint256 createdAtTimestamp, bool appAvailableForAllocationVoting)",
]

const V8_ABI = [
  "event AppEndorsed(bytes32 indexed appId, uint256 indexed nodeId, address endorser, uint256 points)",
  "event AppUnendorsed(bytes32 indexed appId, uint256 indexed nodeId, uint256 points)",
]

async function queryFilterChunked(
  contract: {
    queryFilter: (f: never, from: number, to: number) => Promise<Array<{ topics: readonly string[]; data: string }>>
  },
  filter: never,
  fromBlock: number,
  toBlock: number,
): Promise<Array<{ topics: readonly string[]; data: string }>> {
  const allLogs: Array<{ topics: readonly string[]; data: string }> = []
  for (let start = fromBlock; start <= toBlock; start += CHUNK_BLOCKS) {
    const end = Math.min(start + CHUNK_BLOCKS - 1, toBlock)
    const logs = await contract.queryFilter(filter, start, end)
    allLogs.push(...logs)
    if (logs.length >= 9999) {
      console.warn(`Chunk [${start}-${end}] returned ${logs.length} logs; some may be truncated.`)
    }
  }
  return allLogs
}

async function main() {
  const config = getMigrationConfig()
  const provider = (await ethers.getSigners())[0]?.provider ?? ethers.provider
  const address = config.x2EarnAppsContractAddress

  const latestBlock = await provider.getBlockNumber()
  const v7Contract = new ethers.Contract(address, V7_ABI, provider)
  const v8Contract = new ethers.Contract(address, V8_ABI, provider)
  const v7Interface = new ethers.Interface(V7_ABI)
  const v8Interface = new ethers.Interface(V8_ABI)

  const v7Events = await queryFilterChunked(
    v7Contract as Parameters<typeof queryFilterChunked>[0],
    v7Contract.filters.AppEndorsed() as never,
    0,
    latestBlock,
  )
  const v8EndorsedEvents = await queryFilterChunked(
    v8Contract as Parameters<typeof queryFilterChunked>[0],
    v8Contract.filters.AppEndorsed() as never,
    0,
    latestBlock,
  )
  const v8UnendorsedEvents = await queryFilterChunked(
    v8Contract as Parameters<typeof queryFilterChunked>[0],
    v8Contract.filters.AppUnendorsed() as never,
    0,
    latestBlock,
  )

  const nodeToApp = new Map<string, string>()
  for (const log of v7Events) {
    const parsed = v7Interface.parseLog({ topics: log.topics, data: log.data })
    if (!parsed || parsed.name !== "AppEndorsed") continue
    const appId = normalizeAppId(parsed.args.id as string | bigint)
    const nodeId = (parsed.args.nodeId as bigint).toString()
    const endorsed = parsed.args.endorsed as boolean
    if (endorsed) {
      nodeToApp.set(nodeId, appId)
    } else {
      nodeToApp.delete(nodeId)
    }
  }

  const v8Points = new Map<string, number>()
  const v8Key = (nodeId: string, appId: string) => `${nodeId}:${normalizeAppId(appId)}`
  for (const log of v8EndorsedEvents) {
    const parsed = v8Interface.parseLog({ topics: log.topics, data: log.data })
    if (!parsed || parsed.name !== "AppEndorsed") continue
    const appId = normalizeAppId(parsed.args.appId as string | bigint)
    const nodeId = (parsed.args.nodeId as bigint).toString()
    const points = Number(parsed.args.points as bigint)
    const k = v8Key(nodeId, appId)
    v8Points.set(k, (v8Points.get(k) ?? 0) + points)
  }
  for (const log of v8UnendorsedEvents) {
    const parsed = v8Interface.parseLog({ topics: log.topics, data: log.data })
    if (!parsed || parsed.name !== "AppUnendorsed") continue
    const appId = normalizeAppId(parsed.args.appId as string | bigint)
    const nodeId = (parsed.args.nodeId as bigint).toString()
    const points = Number(parsed.args.points as bigint)
    const k = v8Key(nodeId, appId)
    const cur = v8Points.get(k) ?? 0
    v8Points.set(k, Math.max(0, cur - points))
  }

  let appContract: typeof v7Contract | Awaited<ReturnType<typeof getX2EarnAppsContract>> = v7Contract
  try {
    appContract = await getX2EarnAppsContract()
  } catch {
    console.warn("getX2EarnAppsContract() failed, using V7 ABI for app() only.")
  }
  const appNameCache = new Map<string, string>()
  const getAppName = async (appId: string): Promise<string> => {
    const cached = appNameCache.get(appId)
    if (cached !== undefined) return cached
    try {
      const appData = await appContract.app(appId)
      const name =
        (appData as unknown as Record<string, unknown>).name ??
        (typeof (appData as unknown[])[2] === "string" ? (appData as unknown[])[2] : "")
      const nameStr = typeof name === "string" ? name : ""
      appNameCache.set(appId, nameStr)
      return nameStr
    } catch (err) {
      console.warn(`app(${appId}) failed:`, (err as Error).message)
      appNameCache.set(appId, "")
      return ""
    }
  }

  const endorsements: EndorsementSnapshot[] = []
  const useV8State = v8Points.size > 0 && [...v8Points.values()].some(p => p > 0)
  console.log(
    `V7 AppEndorsed events: ${v7Events.length}, V8 AppEndorsed: ${v8EndorsedEvents.length}, V8 AppUnendorsed: ${v8UnendorsedEvents.length}. Using ${useV8State ? "V8" : "V7"} state.`,
  )

  if (useV8State) {
    for (const [key, currentPoints] of v8Points) {
      if (currentPoints <= 0) continue
      const idx = key.indexOf(":")
      const nodeId = key.slice(0, idx)
      const appId = key.slice(idx + 1)
      const points = Math.min(currentPoints, DEFAULT_CAP)
      const appName = await getAppName(appId)
      endorsements.push({
        appId,
        appName,
        nodeId,
        currentPoints,
        points,
      })
    }
    let contractV8: Awaited<ReturnType<typeof getX2EarnAppsContract>> | undefined
    try {
      contractV8 = await getX2EarnAppsContract()
    } catch {
      contractV8 = undefined
    }
    if (contractV8 && typeof contractV8.getEndorserNodes === "function" && typeof contractV8.getScore === "function") {
      const allowedNodeIdsByApp = new Map<string, Set<string>>()
      for (const appId of new Set(endorsements.map(e => e.appId))) {
        try {
          const nodeIds = (await contractV8.getEndorserNodes(appId)) as bigint[]
          allowedNodeIdsByApp.set(appId, new Set(nodeIds.map((n: bigint) => n.toString())))
        } catch {
          // skip: do not filter this app so we keep event-derived endorsements
        }
      }
      const beforeFilter = endorsements.length
      endorsements.splice(
        0,
        endorsements.length,
        ...endorsements.filter(e => {
          const allowed = allowedNodeIdsByApp.get(e.appId)
          return allowed === undefined || allowed.has(e.nodeId)
        }),
      )
      if (endorsements.length < beforeFilter) {
        console.log(
          `Filtered ${beforeFilter - endorsements.length} endorsement(s) to match getEndorserNodes (excludes burned nodes).`,
        )
      }
      for (const appId of new Set(endorsements.map(e => e.appId))) {
        try {
          const onChainScore = Number((await contractV8.getScore(appId)) as bigint)
          const eventSum = endorsements.filter(e => e.appId === appId).reduce((s, e) => s + (e.currentPoints ?? 0), 0)
          if (eventSum !== onChainScore) {
            console.warn(`App ${appId}: event sum=${eventSum}, getScore=${onChainScore} (frontend uses getScore).`)
          }
        } catch {
          // ignore
        }
      }
    }
  } else {
    for (const [nodeId, appId] of nodeToApp) {
      const currentPoints = Number(await v7Contract.getNodeEndorsementScore(nodeId))
      const points = Math.min(currentPoints, DEFAULT_CAP)
      const appName = await getAppName(appId)
      endorsements.push({
        appId,
        appName,
        nodeId,
        currentPoints,
        points,
      })
    }
  }

  applyReductionRules(endorsements)

  const blockNumber = latestBlock
  let allApps: AppInfo[] | undefined
  try {
    const contract = await getX2EarnAppsContract()
    const appsList = await contract.apps()
    allApps = (appsList as unknown[]).map((a: unknown) => {
      const row = a as { id?: string; name?: string } & unknown[]
      const appId = row.id ?? row[0]
      const appName = row.name ?? row[2] ?? ""
      return { appId: String(appId), appName: String(appName) }
    })
  } catch {
    console.warn(
      "Could not fetch all apps list (e.g. pre-upgrade); only apps with endorsements will appear in reports.",
    )
  }

  const data: MigrationData = {
    network: config.network.name,
    fetchedAt: new Date().toISOString(),
    blockNumber,
    x2EarnAppsAddress: address,
    endorsements,
    ...(allApps && allApps.length > 0 ? { allApps } : {}),
  }
  saveMigrationData(data)
  console.log(`Fetched ${endorsements.length} endorsements at block ${blockNumber}. Written to data/endorsements.json`)
  if (allApps?.length) {
    console.log(
      `Total apps on chain: ${allApps.length} (${new Set(endorsements.map(e => e.appId)).size} with endorsements)`,
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
