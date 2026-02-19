# VeBetterDAO Smart Contracts

Open-source repository that houses the smart contracts powering the decentralized VeBetterDAO on the VeChain Thor blockchain.

The complete documentation for the VeBetterDAO and the contracts can be found [on the official documentation website](https://docs.vebetterdao.org) and [here](https://vechain.github.io/vebetterdao-contracts) for the latest documentation extracted from the contracts source code.

## Changelog

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
  "RelayerRewardsPool": "0x34b56f892c9e977b9ba2e43ba64c27d368ab3c86"
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

## Install via NPM

You can install the package via NPM to get the ABIs, contract addresses and interfaces:

```bash
yarn add @vechain/vebetterdao-contracts
```

Make sure you include the line below in your .yarnrc.yml for code editors to recognize types.

```
nodeLinker: node-modules
```

#### Usage (with [SDK](https://docs.vechain.org/developer-resources/sdks-and-providers/sdk)):

```javascript
import { B3TR_factory } from "@vechain/vebetterdao-contracts"

const res = await thor.contracts.load(B3TR_factory.address, B3TR_factory.abi).read.balanceOf(address)
```
