import { VECHAIN_URL_SOLO, VECHAIN_URL_MAINNET, VECHAIN_URL_TESTNET } from "@vechain/hardhat-vechain"
import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "@nomiclabs/hardhat-truffle5"
import "@vechain/hardhat-vechain"
import "@vechain/hardhat-ethers"
import "hardhat-contract-sizer"
import "hardhat-ignore-warnings"
import { getConfig } from "./config"
import "solidity-coverage"
import "solidity-docgen"
import { EnvConfig } from "./config/contracts"

const config: HardhatUserConfig = {
  solidity: "0.8.20",
}

const getEnvMnemonic = () => {
  const mnemonic = process.env.MNEMONIC

  return mnemonic ?? ""
}

console.log(process.env.NEXT_PUBLIC_APP_ENV)

const getSoloUrl = () => {
  const url = process.env.NEXT_PUBLIC_APP_ENV
    ? getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig).network.urls[0]
    : VECHAIN_URL_SOLO
  return url
}

module.exports = {
  solidity: {
    version: "0.8.20",
    evmVersion: "paris",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  mocha: {
    timeout: 1800000,
  },
  defaultNetwork: process.env.IS_TEST_COVERAGE ? "hardhat" : "vechain_solo",
  networks: {
    hardhat: {
      chainId: 1337,
    },
    vechain_solo: {
      url: getSoloUrl(),
      accounts: {
        mnemonic: getEnvMnemonic(),
        count: 20,
        path: "m/44'/818'/0'/0",
      },
      restful: true,
      gas: 10000000,
    },
    vechain_testnet: {
      url: VECHAIN_URL_TESTNET,
      accounts: {
        mnemonic: getEnvMnemonic(),
        count: 20,
        path: "m/44'/818'/0'/0",
      },
      restful: true,
      gas: 10000000,
    },
    vechain_mainnet: {
      url: VECHAIN_URL_MAINNET,
      accounts: {
        mnemonic: getEnvMnemonic(),
        count: 1,
        path: "m/44'/818'/0'/0",
      },
      restful: true,
      gas: 10000000,
    },
  },
  docgen: {
    pages: "files",
  },
}

export default config
