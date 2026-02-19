import fs from "fs"
import path from "path"
import { getX2EarnAppsContract, loadMigrationData } from "./helpers"
import type { EndorsementSnapshot } from "./types"

const REPORT_PATH = path.join(__dirname, "data", "simulation-report.md")

const THRESHOLD = 100
const DEFAULT_MAX_POINTS_PER_APP = 110

function key(nodeId: string, appId: string): string {
  return `${nodeId}:${appId}`
}

function currentPoints(e: EndorsementSnapshot): number {
  return e.currentPoints ?? e.points
}

async function main() {
  const data = loadMigrationData()
  const { endorsements } = data

  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const e of endorsements) {
    const k = key(e.nodeId, e.appId)
    if (seen.has(k)) duplicates.push(k)
    seen.add(k)
  }
  if (duplicates.length > 0) {
    console.error("Duplicate (nodeId, appId) pairs:", duplicates)
    process.exit(1)
  }

  let maxPointsPerApp = DEFAULT_MAX_POINTS_PER_APP
  let usedDefaultMaxPointsPerApp = true
  try {
    const x2EarnApps = await getX2EarnAppsContract()
    maxPointsPerApp = Number(await x2EarnApps.maxPointsPerApp())
    usedDefaultMaxPointsPerApp = false
  } catch {
    console.warn("maxPointsPerApp() reverted, using default", DEFAULT_MAX_POINTS_PER_APP)
  }

  const appCurrentSum = new Map<string, number>()
  const appPostSum = new Map<string, number>()
  const appEndorserCount = new Map<string, number>()
  const appNameByAppId = new Map<string, string>()
  const nodeSums = new Map<string, number>()

  for (const e of endorsements) {
    const cur = currentPoints(e)
    const post = e.points
    appCurrentSum.set(e.appId, (appCurrentSum.get(e.appId) ?? 0) + cur)
    appPostSum.set(e.appId, (appPostSum.get(e.appId) ?? 0) + post)
    appEndorserCount.set(e.appId, (appEndorserCount.get(e.appId) ?? 0) + 1)
    if (e.appName !== undefined) appNameByAppId.set(e.appId, e.appName)
    nodeSums.set(e.nodeId, (nodeSums.get(e.nodeId) ?? 0) + post)
  }

  const appViolations: string[] = []
  for (const [appId, sum] of appPostSum) {
    if (sum > maxPointsPerApp) appViolations.push(`${appId}: ${sum} > ${maxPointsPerApp}`)
  }
  if (appViolations.length > 0) {
    if (usedDefaultMaxPointsPerApp) {
      console.warn(
        "Per-app sum exceeds maxPointsPerApp (post-migration) — would fail on-chain. Consider capping before seed:",
        appViolations,
      )
    } else {
      console.error("Per-app sum exceeds maxPointsPerApp (post-migration):", appViolations)
      process.exit(1)
    }
  }

  let x2EarnApps: Awaited<ReturnType<typeof getX2EarnAppsContract>> | null = null
  try {
    x2EarnApps = await getX2EarnAppsContract()
  } catch {
    console.warn("Skipping per-node validation and all-apps list (contract not reachable)")
  }

  const blacklistedApps = new Set<string>()
  if (x2EarnApps && typeof x2EarnApps.isBlacklisted === "function") {
    for (const appId of new Set(endorsements.map(e => e.appId))) {
      try {
        if (await x2EarnApps.isBlacklisted(appId)) blacklistedApps.add(appId)
      } catch {
        // skip
      }
    }
  }
  if (x2EarnApps) {
    const nodeIds = [...new Set(endorsements.map(e => e.nodeId))]
    const nodeViolations: string[] = []
    for (const nodeId of nodeIds) {
      const sum = nodeSums.get(nodeId) ?? 0
      const nodeScore = await x2EarnApps.getNodeEndorsementScore(nodeId)
      if (sum > Number(nodeScore)) nodeViolations.push(`nodeId ${nodeId}: ${sum} > ${Number(nodeScore)}`)
    }
    if (nodeViolations.length > 0) {
      console.error("Per-node sum exceeds node score:", nodeViolations)
      process.exit(1)
    }
  }

  let appIds = [...new Set(endorsements.map(e => e.appId))]
  if (data.allApps && data.allApps.length > 0) {
    appIds = data.allApps.map(a => a.appId)
    for (const a of data.allApps) {
      appNameByAppId.set(a.appId, a.appName)
    }
  } else if (x2EarnApps) {
    try {
      const appsList = await x2EarnApps.apps()
      const allAppsFromChain: { appId: string; appName: string }[] = []
      for (const a of appsList as unknown[]) {
        const id = (a as { id?: string }).id ?? (a as string[])[0]
        const name = (a as { name?: string }).name ?? (a as string[])[2] ?? ""
        allAppsFromChain.push({ appId: String(id), appName: String(name ?? "") })
      }
      if (allAppsFromChain.length > 0) {
        appIds = allAppsFromChain.map(a => a.appId)
        for (const a of allAppsFromChain) {
          appNameByAppId.set(a.appId, a.appName)
        }
      }
    } catch (err) {
      console.warn("apps() failed, showing only apps with endorsements:", (err as Error).message)
    }
  }

  if (x2EarnApps && typeof x2EarnApps.isBlacklisted === "function") {
    for (const appId of appIds) {
      if (blacklistedApps.has(appId)) continue
      try {
        if (await x2EarnApps.isBlacklisted(appId)) blacklistedApps.add(appId)
      } catch {
        // skip
      }
    }
  }

  const onChainScore = new Map<string, number>()
  if (x2EarnApps && typeof x2EarnApps.getScore === "function") {
    for (const appId of appIds) {
      try {
        const score = Number((await x2EarnApps.getScore(appId)) as bigint)
        onChainScore.set(appId, score)
      } catch {
        // skip
      }
    }
  }

  const rowsCurrent: { appId: string; appName: string; points: number; endorsers: number; status: string }[] = []
  const rowsPost: { appId: string; appName: string; points: number; endorsers: number; status: string }[] = []
  for (const appId of appIds) {
    const name = appNameByAppId.get(appId) ?? appId.slice(0, 10) + "..."
    const endorsers = appEndorserCount.get(appId) ?? 0
    const jsonSum = appCurrentSum.get(appId) ?? 0
    const curPoints = onChainScore.has(appId) ? (onChainScore.get(appId) ?? 0) : jsonSum
    if (onChainScore.has(appId) && (onChainScore.get(appId) ?? 0) !== jsonSum) {
      console.warn(
        `App ${name} (${appId.slice(0, 10)}..): JSON sum=${jsonSum}, getScore=${onChainScore.get(appId)} (using getScore for current table)`,
      )
    }
    const postPoints = appPostSum.get(appId) ?? 0
    const isBlacklisted = blacklistedApps.has(appId)
    rowsCurrent.push({
      appId,
      appName: name,
      points: curPoints,
      endorsers,
      status: isBlacklisted ? "blacklisted" : curPoints >= THRESHOLD ? "endorsed" : "not endorsed",
    })
    rowsPost.push({
      appId,
      appName: name,
      points: postPoints,
      endorsers,
      status: isBlacklisted ? "blacklisted" : postPoints >= THRESHOLD ? "endorsed" : "not endorsed",
    })
  }
  rowsCurrent.sort((a, b) => b.points - a.points)
  rowsPost.sort((a, b) => b.points - a.points)

  const col = (s: string, w: number) => s.padEnd(w).slice(0, w)
  const num = (n: number, w: number) => n.toString().padStart(w)
  const wId = 12
  const wName = 28
  const wPoints = 8
  const wEndorsers = 10
  const wStatus = 14

  const currentEndorsed = rowsCurrent.filter(r => r.status === "endorsed").length
  const currentBlacklisted = rowsCurrent.filter(r => r.status === "blacklisted").length
  const postEndorsed = rowsPost.filter(r => r.status === "endorsed").length
  const postBlacklisted = rowsPost.filter(r => r.status === "blacklisted").length

  const mdTable = (rows: typeof rowsCurrent) =>
    [
      "| appId | appName | points | #endorsers | status |",
      "|-------|---------|--------|------------|--------|",
      ...rows.map(
        r =>
          `| ${r.appId.slice(0, 10)}.. | ${(r.appName || "").replace(/\|/g, "\\|")} | ${r.points} | ${r.endorsers} | ${r.status} |`,
      ),
    ].join("\n")

  const md = [
    "# Endorsement migration simulation",
    "",
    `**Network:** ${data.network} | **Block:** ${data.blockNumber}`,
    "",
    "## Current state (pre-migration)",
    "",
    mdTable(rowsCurrent),
    "",
    "## Post-migration state",
    "",
    mdTable(rowsPost),
    "",
    "## Summary",
    "",
    `- Total endorsements: ${endorsements.length}`,
    `- Unique apps: ${appIds.length}`,
    `- maxPointsPerApp: ${maxPointsPerApp}`,
    `- Threshold: ${THRESHOLD}`,
    `- Current: ${currentEndorsed} apps endorsed, ${rowsCurrent.length - currentEndorsed - currentBlacklisted} not endorsed, ${currentBlacklisted} blacklisted`,
    `- Post-migration: ${postEndorsed} apps endorsed, ${rowsPost.length - postEndorsed - postBlacklisted} not endorsed, ${postBlacklisted} blacklisted`,
    "",
  ].join("\n")

  const reportDir = path.dirname(REPORT_PATH)
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
  fs.writeFileSync(REPORT_PATH, md, "utf-8")
  console.log("Report written to", REPORT_PATH)

  console.log("--- Current state (pre-migration) ---")
  console.log(
    col("appId", wId) +
      col("appName", wName) +
      col("points", wPoints) +
      col("#endorsers", wEndorsers) +
      col("status", wStatus),
  )
  console.log("-".repeat(wId + wName + wPoints + wEndorsers + wStatus))
  for (const r of rowsCurrent) {
    console.log(
      col(r.appId.slice(0, wId - 2) + "..", wId) +
        col(r.appName.slice(0, wName - 1), wName) +
        num(r.points, wPoints) +
        num(r.endorsers, wEndorsers) +
        col(r.status, wStatus),
    )
  }

  console.log("")
  console.log("--- Post-migration state ---")
  console.log(
    col("appId", wId) +
      col("appName", wName) +
      col("points", wPoints) +
      col("#endorsers", wEndorsers) +
      col("status", wStatus),
  )
  console.log("-".repeat(wId + wName + wPoints + wEndorsers + wStatus))
  for (const r of rowsPost) {
    console.log(
      col(r.appId.slice(0, wId - 2) + "..", wId) +
        col(r.appName.slice(0, wName - 1), wName) +
        num(r.points, wPoints) +
        num(r.endorsers, wEndorsers) +
        col(r.status, wStatus),
    )
  }

  console.log("")
  console.log("--- Summary ---")
  console.log("Network:", data.network)
  console.log("Block:", data.blockNumber)
  console.log("Total endorsements:", endorsements.length)
  console.log("Unique apps:", appIds.length)
  console.log("maxPointsPerApp:", maxPointsPerApp)
  console.log(`Threshold: ${THRESHOLD}`)
  console.log(
    `Current: ${currentEndorsed} apps endorsed, ${rowsCurrent.length - currentEndorsed - currentBlacklisted} not endorsed, ${currentBlacklisted} blacklisted`,
  )
  console.log(
    `Post-migration: ${postEndorsed} apps endorsed, ${rowsPost.length - postEndorsed - postBlacklisted} not endorsed, ${postBlacklisted} blacklisted`,
  )
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
