# VeBetterDAO Smart Contracts Repository 🌟

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

Welcome to the VeBetterDAO Smart Contracts repository! This open-source repository houses the smart contracts powering the decentralized VeBetterDAO on the VeChain Thor blockchain. Dive into a world of transparent and auditable governance mechanisms, leveraging Solidity, Hardhat, and more to ensure robust decentralized operations.

## Requirements

Before contributing or deploying, ensure your environment meets the following specifications:

- **Node.js (v20 or later):** [Download Node.js](https://nodejs.org/en/download/package-manager) 📥
- **Docker:** [Install Docker](https://docs.docker.com/get-docker/) for running isolated contract environments 🐳
- **Hardhat:** Essential for smart contract compilation and deployment. [Start with Hardhat](https://hardhat.org/getting-started/) ⛑️

## Repository Structure

### Contracts (contracts/) 📜

Core smart contracts written in Solidity. Managed with Hardhat, these contracts are ready for deployment on the VeChain Thor blockchain.

### Artifacts (artifacts/) 🏺

Automatically generated contract artifacts post-compilation. Contains ABI and contract bytecode.

### TypeChain Types (typechain-types/) 📚

TypeScript typings for smart contracts, generated to enhance developer experience by providing strong typing for contract interactions.

## Environment Setup ⚙️

Set up your environment to integrate smoothly with the blockchain:

- **MNEMONIC:** Store the mnemonic for the deploying wallet in a `.env` file at the root to maintain security and ease of use.

## Getting Started 🏁

Clone the repository and install dependencies with ease:
```bash
yarn install # Run this at the root level of the project
```

## Compilation and Testing 🛠️

Compile contracts and generate necessary artifacts and types:

```bash
yarn compile
```

### Testing on Hardhat Network

```bash
yarn test:hardhat
```

### Testing on Thor Solo Network

```bash
yarn test:thor-solo
```

# Disclaimer

This repository is for educational and demonstration purposes. Please review and test the code thoroughly before using it in a production environment. The maintainers are not liable for any misuse or faults within the code.