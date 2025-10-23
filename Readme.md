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
  "B3TR": "0xbf64cf86894Ee0877C4e7d03936e35Ee8D8b864F",
  "B3TRGovernor": "0xDF5E114D391CAC840529802fe8D01f6bdeBE41eC",
  "Emissions": "0x148d21032F4a7b4aeF236E2E9C0c5bF62d10f8EB",
  "GalaxyMember": "0xCf73039913e05aa1838d5869E72290d2b454C1E8",
  "TimeLock": "0x30ee94F303643902a68aD8A7A6456cA69d763192",
  "Treasury": "0x039893EBe092A2D22B08E2b029735D211bfF7F50",
  "VOT3": "0xa704c45971995467696EE9544Da77DD42Bc9706E",
  "VoterRewards": "0x2E47fc4aabB3403037fB5E1f38995E7a91Ce8Ed2",
  "X2EarnApps": "0xcB23Eb1bBD5c07553795b9538b1061D0f4ABA153",
  "X2EarnRewardsPool": "0x5F8f86B8D0Fa93cdaE20936d150175dF0205fB38",
  "XAllocationPool": "0x9B9CA9D0C41Add1d204f90BA0E9a6844f1843A84",
  "XAllocationVoting": "0x5859ff910d8b0c127364c98E24233b0af7443c1c",
  "RelayerRewardsPool": "0x92b5a7484970d9b2ad981e8135ff14e6f996dc04",
  "DynamicBaseAllocationPool": "0xf710edf9c2f5e00563034a8954f8733d04fd9943",
  "B3TRFaucet": "0x5e9c1F0f52aC6b5004122059053b00017EAfB561"
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
