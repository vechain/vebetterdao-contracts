import { ethers, network } from "hardhat"
import { deployAll } from "./deploy/deploy"
import { getConfig, getContractsConfig } from "../config"
import { AppConfig } from "../config"
import fs from "fs"
import path from "path"
import { Network } from "../constants"
import { EnvConfig } from "../config/contracts"

const env = process.env.NEXT_PUBLIC_APP_ENV as EnvConfig
if (!env) throw new Error("NEXT_PUBLIC_APP_ENV env variable must be set")
const config = getConfig()

const isSoloNetwork = network.name === "vechain_solo"

async function main() {
  console.log(`Checking contracts deployment on ${network.name} (${config.network.urls[0]})...`)
  await checkContractsDeployment()
  process.exit(0)
}

// check if the contracts specified in the config file are deployed on the network, if not, deploy them (only on solo network)
async function checkContractsDeployment() {
  try {
    const code = await ethers.provider.getCode(config.b3trContractAddress)
    if (code === "0x") {
      console.log(`B3tr contract not deployed at address ${config.b3trContractAddress}`)
      if (isSoloNetwork) {
        // deploy the contracts and override the config file
        const newAddresses = await deployAll(getContractsConfig(env))

        return await overrideLocalConfigWithNewContracts(newAddresses, config.network)
      } else console.log(`Skipping deployment on ${network.name}`)
    } else console.log(`B3tr contract already deployed`)
  } catch (e) {
    console.log(e)
  }
}

async function overrideLocalConfigWithNewContracts(contracts: Awaited<ReturnType<typeof deployAll>>, network: Network) {
  const newConfig: AppConfig = {
    ...config,
    b3trContractAddress: await contracts.b3tr.getAddress(),
    vot3ContractAddress: await contracts.vot3.getAddress(),
    b3trGovernorAddress: await contracts.governor.getAddress(),
    timelockContractAddress: await contracts.timelock.getAddress(),
    xAllocationPoolContractAddress: await contracts.xAllocationPool.getAddress(),
    xAllocationVotingContractAddress: await contracts.xAllocationVoting.getAddress(),
    emissionsContractAddress: await contracts.emissions.getAddress(),
    voterRewardsContractAddress: await contracts.voterRewards.getAddress(),
    galaxyMemberContractAddress: await contracts.galaxyMember.getAddress(),
    treasuryContractAddress: await contracts.treasury.getAddress(),
    x2EarnAppsContractAddress: await contracts.x2EarnApps.getAddress(),
  }

  // eslint-disable-next-line
  const toWrite = `import { AppConfig } from \".\" \n const config: AppConfig = ${JSON.stringify(newConfig, null, 2)};
  export default config;`

  const fileToWrite = network.name === "solo" ? "local.ts" : "testnet.ts"
  const localConfigPath = path.resolve(__dirname, `../config/${fileToWrite}`)
  console.log(`Writing new config file to ${localConfigPath}`)
  fs.writeFileSync(localConfigPath, toWrite)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error)
  process.exit(1)
})
