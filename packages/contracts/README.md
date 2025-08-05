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
  "VeBetterPassport": "0x35a267671d8EDD607B2056A9a13E7ba7CF53c8b3"
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
  "B3TRFaucet": "0x5e9c1F0f52aC6b5004122059053b00017EAfB561"
```

Notice: _VeBetter Passport contract deployed only on mainnet._

## Install via NPM

You can install the package via NPM to get the ABIs, contract addresses and interfaces:

```bash
yarn add @vechain/vebetterdao-contracts
```

#### Usage (with [SDK](https://docs.vechain.org/developer-resources/sdks-and-providers/sdk)):

```javascript
import { B3TR_factory } from "@vechain/vebetterdao-contracts"

const res = await thor.contracts.load(B3TR_factory.address, B3TR_factory.abi).read.balanceOf(address)
```
