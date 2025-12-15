import fs from "fs"
import path from "path"

/**
 * Generates a mock local config file if it does not exist yet
 * This is needed and executed in the dev pipeline to avoid versioning local.ts
 */
export const generateMockLocalConfig = () => {
  console.log("Checking if @repo/config/local.ts exists...")
  const localConfigPath = path.resolve("./local.ts")
  if (fs.existsSync(localConfigPath)) {
    console.log(`${localConfigPath} exists, skipping...`)
    return
  }

  console.log(`${localConfigPath} does not exist, generating mock...`)
  const toWrite = `import { AppConfig } from "." \n const config: AppConfig = {
    basePath: "http://localhost:3000",
    environment: "local",
    ipfsPinningService: "https://api.dev.gateway-proxy.vechain.org/api/v1/pinning/pinFileToIPFS",
    ipfsFetchingService: "https://api.dev.gateway-proxy.vechain.org/ipfs",
    b3trContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    vot3ContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    b3trGovernorAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    timelockContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    xAllocationPoolContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    xAllocationVotingContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    emissionsContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    voterRewardsContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    galaxyMemberContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    treasuryContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    x2EarnAppsContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    tokenAuctionContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    x2EarnRewardsPoolContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    dbaPoolContractAddress: "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    "nodeManagementContractAddress": "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    "veBetterPassportContractAddress": "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    "x2EarnCreatorContractAddress": "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    "stargateNFTContractAddress": "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    "stargateContractAddress": "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    "grantsManagerContractAddress": "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    "relayerRewardsPoolContractAddress": "0x45d5CA3f295ad8BCa291cC4ecd33382DE40E4FAc",
    "indexerUrl": "https://indexer.testnet.vechain.org/api/v1",
    "nodeUrl": "http://localhost:8669",
    "network": {
      "id": "solo",
      "name": "solo",
      "type": "solo",
      "defaultNet": true,
      "urls": [
        "http://localhost:8669"
      ],
      "explorerUrl": "https://explore-testnet.vechain.org",
      "blockTime": 1000 * 10,
      "genesis": {
        "number": 0,
        "id": "0x00000000c05a20fbca2bf6ae3affba6af4a74b800b585bf7a4988aba7aea69f6",
        "size": 170,
        "parentID": "0xffffffff53616c757465202620526573706563742c20457468657265756d2100",
        "timestamp": 1530316800,
        "gasLimit": 10000000,
        "beneficiary": "0x0000000000000000000000000000000000000000",
        "gasUsed": 0,
        "totalScore": 0,
        "txsRoot": "0x45b0cfc220ceec5b7c1c62c4d4193d38e4eba48e8815729ce75f9c0ab0e4c1c0",
        "txsFeatures": 0,
        "stateRoot": "0x93de0ffb1f33bc0af053abc2a87c4af44594f5dcb1cb879dd823686a15d68550",
        "receiptsRoot": "0x45b0cfc220ceec5b7c1c62c4d4193d38e4eba48e8815729ce75f9c0ab0e4c1c0",
        "signer": "0x0000000000000000000000000000000000000000",
        "isTrunk": true,
        "transactions": []
      }
    },
    "b3trGovernorLibraries": {
      "governorClockLogicAddress": "0x5036111024873CDEdb5112626E30fc6E16bd4364",
      "governorConfiguratorAddress": "0x76924CcDF0234635944229180DFACfa5133f79cA",
      "governorDepositLogicAddress": "0x71F4Da0291CC79189d8E87F2B7ECDD441A4189f4",
      "governorFunctionRestrictionsLogicAddress": "0x0256e9a6040EC87cacf92eD5D868905C80dE0A2C",
      "governorProposalLogicAddressAddress": "0x3380211819C2dF57Dc577d06956889374255Df52",
      "governorQuorumLogicAddress": "0xAD2765a76243CcDB4b49e7957CF3C5F5a68F388C",
      "governorStateLogicAddress": "0x64378225012ABA6569Bf20643561fac66BB69e99",
      "governorVotesLogicAddress": "0x45290a8969f2E5396a7770a21a90aE6B7708ef8F"
    },
    passportLibraries: {
      passportChecksLogicAddress: "0x5036111024873CDEdb5112626E30fc6E16bd4364",
      passportConfiguratorAddress: "0x5036111024873CDEdb5112626E30fc6E16bd4364",
      passportEntityLogicAddress: "0x5036111024873CDEdb5112626E30fc6E16bd4364",
      passportDelegationLogicAddress: "0x5036111024873CDEdb5112626E30fc6E16bd4364",
      passportPersonhoodLogicAddress: "0x5036111024873CDEdb5112626E30fc6E16bd4364",
      passportPoPScoreLogicAddress: "0x5036111024873CDEdb5112626E30fc6E16bd4364",
      passportSignalingLogicAddress: "0x5036111024873CDEdb5112626E30fc6E16bd4364",
      passportWhitelistAndBlacklistLogicAddress: "0x5036111024873CDEdb5112626E30fc6E16bd4364",
    },
    xAllocationVotingLibraries: {
      autoVotingLogicAddress: "0x5036111024873CDEdb5112626E30fc6E16bd4364",
    },
    }
    export default config;
    `

  console.log(`Writing mock config file to ${localConfigPath}`)
  fs.writeFileSync(localConfigPath, toWrite)
  console.log("Done!")
}

generateMockLocalConfig()
