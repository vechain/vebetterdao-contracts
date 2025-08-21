import { ethers, network } from "hardhat"
import { deployAll } from "./deploy/deployAll"
import { getConfig, getContractsConfig } from "@repo/config"
import { AppConfig } from "@repo/config"
import fs from "fs"
import path from "path"
import { Network } from "@repo/constants"
import { AppEnv } from "@repo/config/contracts"

const config = getConfig()
const env = config.environment
if (!env) throw new Error("NEXT_PUBLIC_APP_ENV env variable must be set")

const isSoloNetwork = network.name === "vechain_solo"
const isStagingEnv = process.env.NEXT_PUBLIC_APP_ENV === AppEnv.TESTNET_STAGING
const isGalacticaTestNetwork = process.env.NEXT_PUBLIC_APP_ENV === AppEnv.GALACTICA_TEST

async function main() {
  console.log(`Checking contracts deployment on ${network.name} (${config.network.urls[0]})...`)
  await checkContractsDeployment()
  process.exit(0)
}

// check if the contracts specified in the config file are deployed on the network, if not, deploy them (only on solo network)
export async function checkContractsDeployment() {
  try {
    // if contract address is not set or it does not exist on the network, consider it as not deployed
    const code = config.b3trContractAddress === "" ? "0x" : await ethers.provider.getCode(config.b3trContractAddress)
    if (code === "0x") {
      console.log(`B3tr contract not deployed at address ${config.b3trContractAddress}`)
      if (isSoloNetwork || isStagingEnv || isGalacticaTestNetwork) {
        // deploy the contracts and override the config file
        const newAddresses = await deployAll(getContractsConfig(env))

        return await overrideLocalConfigWithNewContracts(newAddresses)
      } else console.log(`Skipping deployment on ${network.name}`)
    } else console.log(`B3tr contract already deployed`)
  } catch (e) {
    console.log(e)
  }
}

async function overrideLocalConfigWithNewContracts(contracts: Awaited<ReturnType<typeof deployAll>>) {
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
    x2EarnRewardsPoolContractAddress: await contracts.x2EarnRewardsPool.getAddress(),
    x2EarnCreatorContractAddress: await contracts.x2EarnCreator.getAddress(),
    nodeManagementContractAddress: await contracts.vechainNodeManagement.getAddress(),
    veBetterPassportContractAddress: await contracts.veBetterPassport.getAddress(),
    grantsManagerContractAddress: await contracts.grantsManager.getAddress(),
    b3trGovernorLibraries: {
      governorClockLogicAddress: await contracts.libraries.governorClockLogic.getAddress(),
      governorConfiguratorAddress: await contracts.libraries.governorConfigurator.getAddress(),
      governorDepositLogicAddress: await contracts.libraries.governorDepositLogic.getAddress(),
      governorFunctionRestrictionsLogicAddress:
        await contracts.libraries.governorFunctionRestrictionsLogic.getAddress(),
      governorProposalLogicAddressAddress: await contracts.libraries.governorProposalLogic.getAddress(),
      governorQuorumLogicAddress: await contracts.libraries.governorQuorumLogic.getAddress(),
      governorStateLogicAddress: await contracts.libraries.governorStateLogic.getAddress(),
      governorVotesLogicAddress: await contracts.libraries.governorVotesLogic.getAddress(),
    },
    passportLibraries: {
      passportChecksLogicAddress: await contracts.libraries.passportChecksLogic.getAddress(),
      passportConfiguratorAddress: await contracts.libraries.passportConfigurator.getAddress(),
      passportEntityLogicAddress: await contracts.libraries.passportEntityLogic.getAddress(),
      passportDelegationLogicAddress: await contracts.libraries.passportDelegationLogic.getAddress(),
      passportPersonhoodLogicAddress: await contracts.libraries.passportPersonhoodLogic.getAddress(),
      passportPoPScoreLogicAddress: await contracts.libraries.passportPoPScoreLogic.getAddress(),
      passportSignalingLogicAddress: await contracts.libraries.passportSignalingLogic.getAddress(),
      passportWhitelistAndBlacklistLogicAddress:
        await contracts.libraries.passportWhitelistAndBlacklistLogic.getAddress(),
    },
  }

  // eslint-disable-next-line
  const toWrite = `import { AppConfig } from \".\" \n const config: AppConfig = ${JSON.stringify(newConfig, null, 2)};
  export default config;`

  let fileToWrite: string
  switch (env) {
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
    case AppEnv.GALACTICA_TEST:
      fileToWrite = "galactica-test.ts"
      break
    default:
      throw new Error(`Unsupported NEXT_PUBLIC_APP_ENV ${env}`)
  }

  const localConfigPath = path.resolve(`../config/${fileToWrite}`)
  console.log(`Writing new config file to ${localConfigPath}`)
  fs.writeFileSync(localConfigPath, toWrite)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error)
  process.exit(1)
})
