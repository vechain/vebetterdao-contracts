export * from "./type"

import { createLocalConfig } from "./envs/local"

export const EnvConfigValues = ["local", "e2e", "testnet"] as const
export type EnvConfig = (typeof EnvConfigValues)[number]

export function getContractsConfig(env: EnvConfig) {
  switch (env) {
    case "local":
      return createLocalConfig()

    default:
      throw new Error(`Invalid ENV "${env}"`)
  }
}

export function shouldRunSimulation() {
  return process.env.NEXT_PUBLIC_APP_ENV == "local" && process.env.RUN_SIMULATION === "true"
}
