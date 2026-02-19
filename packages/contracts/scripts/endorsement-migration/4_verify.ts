import { getX2EarnAppsContract, loadMigrationData, validateMigrationData } from "./helpers"
import type { EndorsementSnapshot } from "./types"

async function main() {
  const data = loadMigrationData()
  validateMigrationData(data)
  const x2EarnApps = await getX2EarnAppsContract()

  const expectedAppScore = new Map<string, number>()
  const expectedAppNodes = new Map<string, Set<string>>()

  for (const e of data.endorsements) {
    expectedAppScore.set(e.appId, (expectedAppScore.get(e.appId) ?? 0) + e.points)
    if (!expectedAppNodes.has(e.appId)) expectedAppNodes.set(e.appId, new Set())
    expectedAppNodes.get(e.appId)!.add(e.nodeId)
  }

  let failed = false

  for (const appId of expectedAppScore.keys()) {
    const expectedSum = expectedAppScore.get(appId) ?? 0
    const onChainScore = Number(await x2EarnApps.getScore(appId))
    if (onChainScore !== expectedSum) {
      console.error(`App ${appId}: getScore()=${onChainScore}, expected=${expectedSum}`)
      failed = true
    }

    const expectedNodes = [...(expectedAppNodes.get(appId) ?? [])].sort()
    const onChainNodes = (await x2EarnApps.getEndorserNodes(appId)).map((n: bigint) => n.toString())
    onChainNodes.sort()
    const nodesMatch =
      expectedNodes.length === onChainNodes.length && expectedNodes.every((n, i) => n === onChainNodes[i])
    if (!nodesMatch) {
      console.error(
        `App ${appId}: getEndorserNodes() mismatch. expected=${expectedNodes.join(",")} onChain=${onChainNodes.join(",")}`,
      )
      failed = true
    }
  }

  for (const e of data.endorsements) {
    const onChain = Number(await x2EarnApps.getNodePointsForApp(BigInt(e.nodeId), e.appId))
    if (onChain !== e.points) {
      console.error(`Node ${e.nodeId} app ${e.appId}: getNodePointsForApp()=${onChain}, expected=${e.points}`)
      failed = true
    }
  }

  const paused = await x2EarnApps.endorsementsPaused()
  console.log("endorsementsPaused():", paused)

  if (failed) {
    console.log("Verification: FAIL")
    process.exit(1)
  }
  console.log("Verification: PASS")
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
