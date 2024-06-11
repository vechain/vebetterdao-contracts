import fs from "fs"
import path from "path"
/**
 * Generates a mock local config file if it does not exist yet
 * This is needed and executed in the dev pipeline to avoid versioning local.ts
 */
export const generateMockLocalConfig = () => {
  console.log("Checking if @repo/config/local.ts exists...")
  const localConfigPath = path.resolve(__dirname, "../local.ts")
  if (fs.existsSync(localConfigPath)) {
    console.log(`${localConfigPath} exists, skipping...`)
    return
  }

  console.log(`${localConfigPath} does not exist, generating mock...`)
  const toWrite = `import { AppConfig } from "." \n const config: AppConfig = {
    basePath: "http://localhost:3000",
    environment: "local",
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
    }
    }
    export default config;
    `

  console.log(`Writing mock config file to ${localConfigPath}`)
  fs.writeFileSync(localConfigPath, toWrite)
  console.log("Done!")
}

generateMockLocalConfig()
