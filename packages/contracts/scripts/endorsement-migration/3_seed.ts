import { ethers } from "hardhat"
import { getX2EarnAppsContract, loadMigrationData, validateMigrationData } from "./helpers"

async function main() {
  const data = loadMigrationData()
  validateMigrationData(data)
  const x2EarnApps = await getX2EarnAppsContract()
  const signer = (await ethers.getSigners())[0]
  if (!signer) throw new Error("No signer")

  const paused = await x2EarnApps.endorsementsPaused()
  if (!paused) {
    console.error("endorsementsPaused() is false. Pause endorsements before seeding.")
    process.exit(1)
  }

  const completed = await x2EarnApps.migrationCompleted()
  if (completed) {
    console.error("migrationCompleted() is true. Migration already done.")
    process.exit(1)
  }

  const MIGRATION_ROLE = await x2EarnApps.MIGRATION_ROLE()
  const hasRole = await x2EarnApps.hasRole(MIGRATION_ROLE, signer.address)
  if (!hasRole) {
    console.error("Caller does not have MIGRATION_ROLE.")
    process.exit(1)
  }

  const blacklistedApps = new Set<string>()
  if (typeof x2EarnApps.isBlacklisted === "function") {
    for (const appId of new Set(data.endorsements.map(e => e.appId))) {
      try {
        if (await x2EarnApps.isBlacklisted(appId)) blacklistedApps.add(appId)
      } catch {
        // skip
      }
    }
    if (blacklistedApps.size > 0) {
      console.log(`Skipping ${blacklistedApps.size} blacklisted app(s)`)
    }
  }

  const endorsements = data.endorsements.filter(e => !blacklistedApps.has(e.appId))
  const total = endorsements.length
  let seeded = 0
  let skipped = 0
  for (let i = 0; i < total; i++) {
    const e = endorsements[i]
    const onChainPoints = Number(await x2EarnApps.getNodePointsForApp(BigInt(e.nodeId), e.appId))
    if (onChainPoints === e.points) {
      skipped++
      console.log(`[${i + 1}/${total}] Already seeded, skipping nodeId=${e.nodeId} appId=${e.appId}`)
      continue
    }
    try {
      const tx = await x2EarnApps.seedEndorsement(e.appId, BigInt(e.nodeId), e.points)
      await tx.wait()
      seeded++
      console.log(`[${i + 1}/${total}] Seeded nodeId=${e.nodeId} -> appId=${e.appId} with ${e.points} points`)
    } catch (err) {
      console.error(`[${i + 1}/${total}] Failed nodeId=${e.nodeId} appId=${e.appId} points=${e.points}:`, err)
      console.error(`Resume by re-running the script — already-seeded entries will be skipped.`)
      process.exit(1)
    }
  }
  console.log(`Done. Seeded: ${seeded}, skipped (already seeded): ${skipped}, total: ${total}`)
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
