// We recommend this pattern to be able to use async/await everywhere

import { getContractsConfig } from "../../config"
import { EnvConfig } from "../../config/contracts"
import { deployAll } from "./deploy"

// and properly handle errors.
const execute = async () => {
  await deployAll(getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig))
}

execute()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
