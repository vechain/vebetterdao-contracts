export * from "./type"

import { createLocalConfig } from "./envs/local"
import { createTestnetStagingConfig } from "./envs/testnetStaging"
import { createE2EConfig } from "./envs/e2e"
import { createTestnetConfig } from "./envs/testnet"
import { createMainnetConfig } from "./envs/mainnet"
import { createGalacticaTestConfig } from "./envs/galactica-test"

export const AppEnv = {
  LOCAL: "local",
  E2E: "e2e",
  TESTNET_STAGING: "testnet-staging",
  TESTNET: "testnet",
  MAINNET: "mainnet",
  GALACTICA_TEST: "galactica-test",
} as const

export const EnvConfigValues = Object.values(AppEnv)
export type EnvConfig = (typeof EnvConfigValues)[number]

export function getContractsConfig(env: EnvConfig) {
  switch (env) {
    case AppEnv.LOCAL:
      return createLocalConfig()
    case AppEnv.E2E:
      return createE2EConfig()
    case AppEnv.TESTNET_STAGING:
      return createTestnetStagingConfig()
    case AppEnv.TESTNET:
      return createTestnetConfig()
    case AppEnv.MAINNET:
      return createMainnetConfig()
    case AppEnv.GALACTICA_TEST:
      return createGalacticaTestConfig()

    default:
      throw new Error(`Invalid ENV "${env}"`)
  }
}

export function shouldEndorseXApps() {
  return process.env.ENDORSE_XAPPS === "true"
}

export function shouldNotUpgradeContracts() {
  return process.env.DO_NOT_UPGRADE === "true"
}

export function isE2E() {
  return process.env.NEXT_PUBLIC_APP_ENV == "e2e"
}
