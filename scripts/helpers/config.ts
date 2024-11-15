import { AppConfig } from "../../config"
import path from "path"
import fs from "fs"

export async function updateConfig(config: AppConfig, contractAddressName: string) {
  const toWrite = `import { AppConfig } from \".\" \n const config: AppConfig = ${JSON.stringify(config, null, 2)};
      export default config;`

  let fileToWrite: string
  switch (config.network.name) {
    case "solo":
      fileToWrite = "local.ts"
      break
    case "solo-staging":
      fileToWrite = "solo-staging.ts"
      break
    case "testnet":
      fileToWrite = "testnet.ts"
      break
    case "main":
      fileToWrite = "mainnet.ts"
      break
    default:
      throw new Error("Invalid network name")
  }

  const localConfigPath = path.resolve(`../config/${fileToWrite}`)
  console.log(`Adding ${contractAddressName} to config file: ${localConfigPath}`)
  fs.writeFileSync(localConfigPath, toWrite)
}
