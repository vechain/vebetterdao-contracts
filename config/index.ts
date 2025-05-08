import localConfig from "./local"
import { EnvConfig, getContractsConfig } from "./contracts"
import { Network } from "../constants"

export type AppConfig = {
  environment: EnvConfig
  basePath?: string
  mixPanelProjectToken?: string
  b3trContractAddress: string
  vot3ContractAddress: string
  b3trGovernorAddress: string
  timelockContractAddress: string
  xAllocationPoolContractAddress: string
  xAllocationVotingContractAddress: string
  emissionsContractAddress: string
  voterRewardsContractAddress: string
  galaxyMemberContractAddress: string
  treasuryContractAddress: string
  x2EarnAppsContractAddress: string
  nodeUrl: string
  network: Network
  veBetterPassportContractAddress: string
}

export const getConfig = (env?: EnvConfig): AppConfig => {
  const appEnv = env || process.env.NEXT_PUBLIC_APP_ENV
  if (!appEnv) throw new Error("NEXT_PUBLIC_APP_ENV env variable must be set or a type must be passed to getConfig()")
  if (appEnv === "local") return localConfig
  throw new Error(`Unsupported NEXT_PUBLIC_APP_ENV ${appEnv}`)
}

export { getContractsConfig }
