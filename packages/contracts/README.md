# B3TR Contracts

### Overview

This repository contains the smart contracts for the B3TR project.
`Hardhat` and `Thor Solo node` is used as the development environment.

## Setup

### Requirements

```
yarn
node: ^18.13.0 || >=20.9.0
docker
docker-compose
```

## Monorepo

Since we are using a monorepo architecture please refer to the `README.md` in the root folder to know how to run test and deploy commands. If you cd inside this folder you can only run the `yarn compile` command.

## Contracts

Contracts are written using latest solidity version but compiled against "Paris" evm compiler to be compatible with Vechain Thor network.

You can run the following command to generate the documentation for the contracts:

```
yarn docs
```

You can see the generated documentation in the `docs` folder.

# Hardhat

This is a forked version of Hardhat with additional features for vechain.

## Additional Hardhat features for vechain

### Fee delegation

Fee delegation can be configured by providing optional `delegate` config which has required `url` and optional `signer` field. Url needs to point to delegation a valid
delegation service, for example `https://sponsor-testnet.vechain.energy/by/${projectId}`.

```js
module.exports = {
  solidity: {
    version: "0.8.17",
  },
  networks: {
    vechain: {
      url: "https://testnet.veblocks.net/",
      delegate: {
        url: "${feeDelegationServiceUrl}",
        signer: "${optionalSigner}",
      },
    },
  },
}
```

### Clauses support

Vechain Thor network supports sending multiple clauses as part of one transaction. Clauses are then executed atomically on
a chain. Hardhat plugin supports Vechain tx construction with multiple clauses. Example code:

```js
const clauseBuilder = new ClausesBuilder(baseContract)
const tx = await clauseBuilder
  .withClause({
    args: [1],
    abi: JSON.stringify([{ type: "function", name: "method1" }]),
    method: "method1",
  })
  .withClause({
    args: [2],
    abi: JSON.stringify([{ type: "function", name: "method2" }]),
    method: "method2",
  })
  .send()
```
