import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "@vechain/sdk-hardhat-plugin"
import "hardhat-contract-sizer"
import "hardhat-ignore-warnings"
import { getConfig } from "@repo/config"
import "solidity-coverage"
import "solidity-docgen"
import { EnvConfig } from "@repo/config/contracts"
import "@nomicfoundation/hardhat-verify"
import { getMnemonic } from "./scripts/helpers/env"
import { HDKey } from "@vechain/sdk-core"

const getSoloUrl = () => {
  const url = process.env.NEXT_PUBLIC_APP_ENV
    ? getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig).network.urls[0]
    : "http://localhost:8669"
  return url
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
          evmVersion: "paris",
        },
      },
    ],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    except: ["mocks", "deprecated", "interfaces", "test", "templates", "openzeppelin"],
  },
  mocha: {
    timeout: 1800000,
    grep: process.env.SHARD || undefined,
  },
  gasReporter: {
    enabled: false,
    excludeContracts: ["mocks", "deprecated", "interfaces", "test", "templates"],
  },
  defaultNetwork: process.env.IS_TEST_COVERAGE ? "hardhat" : "vechain_solo",
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        count: 20,
        accountsBalance: "1000000000000000000000000", // 1,000,000 ETH per account (100x default)
      },
    },
    vechain_solo: {
      url: getSoloUrl(),
      accounts: {
        mnemonic: getMnemonic(false), // Not required for compilation
        count: 20,
        path: HDKey.VET_DERIVATION_PATH,
        accountsBalance: "1000000000000000000000000",
      },
      gas: 10000000,
    },
    vechain_testnet: {
      url: "https://testnet.vechain.org",
      chainId: 100010,
      accounts: {
        mnemonic: getMnemonic(false), // Not required for compilation
        count: 20,
        path: HDKey.VET_DERIVATION_PATH,
      },
      gas: 10000000,
    },
    vechain_mainnet: {
      url: "https://mainnet.vechain.org",
      chainId: 100009,
      accounts: {
        mnemonic: getMnemonic(false), // Not required for compilation
        count: 20,
        path: HDKey.VET_DERIVATION_PATH,
      },
      gas: 10000000,
    },
  },
  docgen: {
    pages: "files",
  },
}

export default config
