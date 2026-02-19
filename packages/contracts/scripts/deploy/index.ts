// We recommend this pattern to be able to use async/await everywhere

import { getContractsConfig } from "@repo/config"
import { deployAll } from "./deployAll"
import { EnvConfig } from "@repo/config/contracts"
import { overrideLocalConfigWithNewContracts } from "../checkContractsDeployment"

// and properly handle errors.
const execute = async () => {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const newContracts = await deployAll(getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig))
  await overrideLocalConfigWithNewContracts(newContracts)
  return newContracts
}

execute()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
