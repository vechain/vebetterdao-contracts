# VeBetterDAO Smart Contracts 🌟

                                     #######
                                ################
                              ####################
                            ###########   #########
                           #########      #########
         #######          #########       #########
         #########       #########      ##########
          ##########     ########     ####################
           ##########   #########  #########################
             ################### ############################
              #################  ##########          ########
                ##############      ###              ########
                 ############                       #########
                   ##########                     ##########
                    ########                    ###########
                      ###                    ############
                                         ##############
                                   #################
                                  ##############
                                  #########

[![codecov](https://codecov.io/gh/vechain/vebetterdao-contracts/graph/badge.svg?token=3OMYFKUMS9)](https://app.codecov.io/gh/vechain/vebetterdao-contracts)

Welcome to the VeBetterDAO Smart Contracts repository! This open-source repository houses the smart contracts powering the decentralized VeBetterDAO on the VeChain Thor blockchain. Dive into a world of transparent and auditable governance mechanisms, leveraging Solidity, Hardhat, and more to ensure robust decentralized operations.

The complete documentation for the VeBetterDAO and the contracts can be found [here](https://docs.vebetterdao.org).
Or visit the [Github Pages](https://vechain.github.io/vebetterdao-contracts) for the latest documentation extracted from the contracts source code.

Our contracts are upgradeable and versioned. See the [contracts changelog](/packages/contracts/CONTRACTS_CHANGELOG.md) for more information on the changes introduced in each of new upgraded version.

## Mainnet contract addresses

```
  "B3TR": "0x5ef79995FE8a89e0812330E4378eB2660ceDe699",
  "B3TRGovernor": "0x1c65C25fABe2fc1bCb82f253fA0C916a322f777C",
  "Emissions": "0xDf94739bd169C84fe6478D8420Bb807F1f47b135",
  "GalaxyMember": "0x93B8cD34A7Fc4f53271b9011161F7A2B5fEA9D1F",
  "TimeLock": "0x7B7EaF620d88E38782c6491D7Ce0B8D8cF3227e4",
  "Treasury": "0xD5903BCc66e439c753e525F8AF2FeC7be2429593",
  "VOT3": "0x76Ca782B59C74d088C7D2Cce2f211BC00836c602",
  "VoterRewards": "0x838A33AF756a6366f93e201423E1425f67eC0Fa7",
  "X2EarnApps": "0x8392B7CCc763dB03b47afcD8E8f5e24F9cf0554D",
  "X2EarnRewardsPool": "0x6Bee7DDab6c99d5B2Af0554EaEA484CE18F52631",
  "XAllocationPool": "0x4191776F05f4bE4848d3f4d587345078B439C7d3",
  "XAllocationVoting": "0x89A00Bb0947a30FF95BEeF77a66AEdE3842Fe5B7",
  "VeBetterPassport": "0x35a267671d8EDD607B2056A9a13E7ba7CF53c8b3",
  "RelayerRewardsPool": "0x34b56f892c9e977b9ba2e43ba64c27d368ab3c86",
  "DynamicBaseAllocationPool": "0x98c1d097c39969bb5de754266f60d22bd105b368"
```

## Testnet contract addresses

```
"B3TR": "0x95761346d18244bb91664181bf91193376197088",
"B3TRGovernor": "0xc30b4d0837f7e3706749655d8bde0c0f265dd81b",
"Emissions": "0x66898f98409db20ed6a1bf0021334b7897eb0688",
"GalaxyMember": "0x38a59fa7fd7039884465a0ff285b8c4b6fe394ca",
"TimeLock": "0x835509222aa67c333a1cbf29bd341e014aba86c9",
"Treasury": "0x3d531a80c05099c71b02585031f86a2988e0caca",
"VOT3": "0x6e8b4a88d37897fc11f6ba12c805695f1c41f40e",
"VoterRewards": "0x851ef91801899a4e7e4a3174a9300b3e20c957e8",
"X2EarnApps": "0x0b54a094b877a25bdc95b4431eaa1e2206b1ddfe",
"X2EarnRewardsPool": "0x2d2a2207c68a46fc79325d7718e639d1047b0d8b",
"XAllocationPool": "0x6f7b4bc19b4dc99005b473b9c45ce2815bbe7533",
"XAllocationVoting": "0x8800592c463f0b21ae08732559ee8e146db1d7b2"
```

Notice: _VeBetter Passport contract deployed only on mainnet._

## Audit

The VeBetterDAO smart contracts have undergone a comprehensive audit by [Hacken](https://hacken.io/). The audit report (`Hacken_Vechain Foundation_[SCA] VeChain _ VeBetter DAO _ May2024_P-2024-304_1_20240621 16_17`) can be found in the root of the repo.

## Install via NPM

You can install the package via NPM to get the ABIs, contract addresses and interfaces:

```bash
yarn add @vechain/vebetterdao-contracts
```

## Requirements

Before contributing or deploying, ensure your environment meets the following specifications:

- **Node.js (v20 or later):** [Download Node.js](https://nodejs.org/en/download/package-manager) 📥
- **Docker:** [Install Docker](https://docs.docker.com/get-docker/) for running isolated contract environments 🐳
- **Hardhat:** Essential for smart contract compilation and deployment. [Start with Hardhat](https://hardhat.org/getting-started/) ⛑️

## Repository Structure

This is a turbo monorepo setup, and the contracts are located in the `packages/contracts` directory.

### Contracts (/packages/contracts) 📜

Core smart contracts written in Solidity. Managed with Hardhat, these contracts are ready for deployment on the VeChain Thor blockchain.

### Artifacts (/packages/contracts/artifacts) 🏺

Automatically generated contract artifacts post-compilation. Contains ABI and contract bytecode.

### TypeChain Types (/packages/contracts/typechain-types) 📚

TypeScript typings for smart contracts, generated to enhance developer experience by providing strong typing for contract interactions.

## Getting Started 🏁

Note: all commands should be run from the root of the project.

Clone the repository and install dependencies with ease:

```bash
yarn install # Run this at the root level of the project
```

If you encounter any issues with the installation related to your node version look in the `.nvmrc` file to see which version of node is required, or if you use nvm you can run `nvm use`.

Create a `.env` file at the root of the project and add the following variables:

```bash
cp .env.example .env
```

## Compilation and Testing 🛠️

Compile contracts and generate necessary artifacts and types:

```bash
yarn contracts:compile
```

### Testing on Hardhat Network

```bash
yarn contracts:test
```

### Testing on Thor Solo Network

```bash
yarn contracts:test:thor-solo
```

### Code coverage

You can generate code coverage reports using the following command:

```bash
yarn test:coverage:solidity
```

A folder named `coverage` will be created in the `packages/contracts` directory with the coverage report. Open `index.html` in your browser to view the report.

Additionally a report is generated each time a PR is merged on main and can be found [here](https://app.codecov.io/gh/vechain/vebetterdao-contracts).

### Documentation

To generate the solidity documentation:

```bash
yarn contracts:generate-docs
```

The same documentation is available at github pages: [GithubPages](https://vechain.github.io/vebetterdao-contracts/)

### Publish package

Publish all the ABIs on NPM so we can do `yarn install @vechain/vebetter-contracts` and then have all the ABIs and contract addresses there.

To publish the package to npm first increase the version in the `package.json` file and then run the following command:

```bash
cd packages/contracts
npm publish
```

# Disclaimer

This repository is for educational and demonstration purposes. The maintainers are not liable for any misuse or faults within the code.
