import { AppConfig } from "@repo/config"
import path from "path"
import fs from "fs"
import { AppEnv } from "../../../config/contracts"

export async function updateConfig(config: AppConfig, contractAddressName: string) {
  const toWrite = `import { AppConfig } from "." \n const config: AppConfig = ${JSON.stringify(config, null, 2)};
      export default config;`

  let fileToWrite: string
  switch (config.environment) {
    case AppEnv.LOCAL:
      fileToWrite = "local.ts"
      break
    case AppEnv.TESTNET_STAGING:
      fileToWrite = "testnet-staging.ts"
      break
    case AppEnv.TESTNET:
      fileToWrite = "testnet.ts"
      break
    case AppEnv.MAINNET:
      fileToWrite = "mainnet.ts"
      break
    default:
      throw new Error(`Invalid or unsupported environment for config file generation: ${config.environment}`)
  }

  const localConfigPath = path.resolve(`../config/${fileToWrite}`)
  console.log(
    `Updating config for ${config.environment} environment, setting ${contractAddressName}, writing to: ${localConfigPath}`,
  )
  fs.writeFileSync(localConfigPath, toWrite)
}
