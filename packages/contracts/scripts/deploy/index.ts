// We recommend this pattern to be able to use async/await everywhere

import { getContractsConfig } from "@repo/config"
import { deployAll } from "./deployAll"
import { deployLatest } from "./deployLatest"
import { EnvConfig } from "@repo/config/contracts"

// and properly handle errors.
const execute = async () => {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  if (process.env.NEXT_DEPLOY_LATEST_ONLY) {
    await deployLatest(getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig))
  } else {
    await deployAll(getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig))
  }
}

execute()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
