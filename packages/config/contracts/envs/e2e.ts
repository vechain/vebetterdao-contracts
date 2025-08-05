import { createLocalConfig } from "./local"
export function createE2EConfig() {
  console.log("Creating E2E config...")
  const localConfig = createLocalConfig()
  localConfig.EMISSIONS_CYCLE_DURATION = process.env.GITHUB_RUN_ID ? 24 : 16 // 24 blocks in CI (4 mins) minutes, 12 blocks in local (2 mins)
  localConfig.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE = 20 // 20 -> Need 20% of total supply to succeed = 100 votes
  return localConfig
}
