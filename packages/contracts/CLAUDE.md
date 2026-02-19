# Smart Contract Development

Instructions specific to `packages/contracts` directory.

## Important Notes

If you figure new rules out, or important things to remember for next time you will work on smart contracts changes, told to you by the devs, please add them to the file.

## Domain Knowledge

### VeBetterDAO Overview

VeBetterDAO is a DAO supporting sustainable applications (XApps) and community governance on VeChain. It incentivizes participation through rewards.

### Tokens

- **B3TR**: Reward token earned by interacting with XApps. Can be swapped for VOT3.
- **VOT3**: Governance token used to vote on proposals and allocation rounds.

### XApps (Sustainable Applications)

Smart contract-based apps that reward users with B3TR for sustainable actions. Example: Mugshot rewards users for using reusable mugs (AI verifies photo submissions).

XApps may have limitations (daily action limits, qualification requirements).

### Rounds & Voting

Governance operates on **weekly rounds** (Monday-Sunday):

- **Proposals**: Users propose platform changes. Accepted if minimum VOT3 allocated before round ends.
- **Allocation Rounds**: Users vote for favorite XApps → DAO distributes treasury B3TR to apps based on vote percentages → Apps use B3TR to reward their users.

### XApp Onboarding Flow

1. **Creator NFT**: Submit app for approval → receive Creator NFT → can deploy XApps
2. **Endorsement**: Listed XApp needs **100 endorsement points** to participate in rounds. Only **XNode holders** can endorse.
3. **Rounds**: If 100 points reached before round ends → included in next round → users can vote for it

### Key Terminology

| Term               | Meaning                                      |
| ------------------ | -------------------------------------------- |
| Round              | Weekly governance cycle (Mon-Sun)            |
| Cycle              | Same as round (used interchangeably in code) |
| Allocation         | B3TR distribution to XApps based on votes    |
| Emissions          | B3TR released from treasury each round       |
| Snapshot           | Block number when voting power is measured   |
| XNode              | VeChain node that grants endorsement rights  |
| Creator NFT        | Required to submit XApps to platform         |
| Endorsement Points | XApps need 100 to participate in rounds      |
| VeWorld            | VeChain's wallet (like MetaMask)             |

## Stack

- Solidity 0.8.20 with Paris EVM
- Hardhat + VeChain SDK plugin
- OpenZeppelin Contracts 5.0.2 (upgradeable)
- TypeChain for type generation

## Getting Contract Documentation

If you need more details about a specific contract, generate and read the NatSpec docs:

```bash
yarn contracts:generate-docs
```

Then read the generated documentation in `packages/contracts/docs/`.

## Commands

**Run all commands from monorepo root**, not from `packages/contracts`:

```bash
yarn contracts:compile          # Compile contracts
yarn contracts:test             # Run tests (Hardhat network)
yarn contracts:test:thor-solo   # Run tests (Thor solo - requires make solo-up)
yarn contracts:upgrade:<env>    # Interactive upgrade
yarn contracts:call:<env>       # Interactive contract call
yarn contracts:generate-docs    # Generate NatSpec docs
```

Run single test: `yarn contracts:test --grep "test name"`

## Contract Structure

```
contracts/
├── *.sol                    # Main contracts (current versions)
├── deprecated/V1/           # V1 contracts (reference only)
├── deprecated/V2/           # V2 contracts (reference only)
├── governance/libraries/    # Governor logic libraries
├── ve-better-passport/      # Passport contract + libraries
├── x-2-earn-apps/          # X2Earn apps modules
├── x-allocation-voting-governance/  # Allocation voting modules
├── interfaces/             # Contract interfaces
├── libraries/              # Shared libraries
└── mocks/                  # Test mocks
```

## Deployment Scripts

### Key Files to Keep in Sync

When upgrading contracts, **always update both**:

1. **`scripts/deploy/deployAll.ts`** - Production deployment
   - Used by `yarn contracts:deploy`
   - Auto-runs via `yarn dev` if contracts not deployed

2. **`test/helpers/deploy.ts`** - Test fixture deployment
   - Similar structure but with test-specific roles/variables
   - Used by all contract tests

These files must stay aligned - changes to one usually require changes to the other.

### Adding a New Contract

When adding a completely new contract, also update:

1. **`packages/config/scripts/generateMockLocalConfig.mjs`** - Add mock address for local config generation
2. **`packages/contracts/scripts/checkContractsDeployment.ts`** - Add deployment check for the new contract

### Library Deployment

Specific scripts exist for deploying contract libraries:

- `scripts/libraries/governanceLibraries.ts`
- `scripts/libraries/passportLibraries.ts`
- `scripts/libraries/x2EarnLibraries.ts`
- `scripts/libraries/autoVotingLibraries.ts`

### Custom Proxy Deployment

**Always use helpers in `scripts/helpers/upgrades.ts`** for deployment.

**Note:** `StargateProxy` is only for mocking Stargate contracts (external VeChain project). Use `B3TRProxy` for all other contracts.

```typescript
import { deployProxy, deployProxyOnly, initializeProxy, upgradeProxy } from "../helpers"

// Deploy proxy + implementation together
const contract = await deployProxy("ContractName", [initArg1, initArg2])

// Or deploy proxy first, then initialize separately
const proxy = await deployProxyOnly("ContractName")
await initializeProxy("ContractName", await proxy.getAddress(), [initArg1, initArg2])

// Upgrade existing contract
const upgraded = await upgradeProxy("OldVersion", "NewVersion", proxyAddress, [reinitArgs], { version: N })
```

## Upgrade Rules

### CRITICAL: Storage Safety

- **NEVER modify existing storage variable order** - causes storage collision
- **NEVER remove storage variables** - only add new ones at the end
- **NEVER change types of existing variables**

### Version Pattern

1. Copy current contract to `deprecated/V{N}/` before modifying
2. Increment `version()` return value
3. Create upgrade script: `scripts/upgrade/upgrades/{contract}/{contract}-v{N}.ts`
4. Register in `scripts/upgrade/upgradesConfig.ts` for CLI selection
5. Update `scripts/deploy/deployAll.ts` with new deployment logic
6. Update `test/helpers/deploy.ts` to mirror deployment changes
7. Create upgrade test: `test/{contract}/v{N}-upgrade.test.ts`
8. Create compatibility test: `test/{contract}/v{N}-compatibility.test.ts`

### Why Keep Deprecated Versions Locally?

Deprecated versions in `contracts/deprecated/V{N}/` enable **upgrade tests that verify no storage corruption**:

```typescript
// Deploy previous version first
const v5 = await deployProxy("GalaxyMemberV5", [...])
await v5.someAction() // Create state

// Upgrade to new version
const v6 = await upgradeProxy("GalaxyMemberV5", "GalaxyMember", await v5.getAddress(), [...])

// Verify state preserved correctly
expect(await v6.existingData()).to.equal(expectedValue)
```

### CRITICAL: Upgrade Test Version Mismatch Pattern

When working with upgrade tests, watch for this common bug:

```typescript
// Comment says V4 → V5
// Upgrade X2EarnAppsV4 to X2EarnAppsV5
const x2EarnAppsV5 = (await upgradeProxy("X2EarnAppsV4", "X2EarnApps", ...)) as X2EarnApps
//                                                        ^^^^^^^^^^^ WRONG!
```

**Problem**: The test was written when V5 was the latest version. `"X2EarnApps"` referred to V5 back then. Now that we're at V8, `"X2EarnApps"` refers to V8, so this test incorrectly upgrades from V4 → V8, skipping V5/V6/V7.

**Fix**: Always use explicit version names for intermediate upgrades:

```typescript
// Correct: explicit version
const x2EarnAppsV5 = (await upgradeProxy("X2EarnAppsV4", "X2EarnAppsV5", ...)) as X2EarnAppsV5
```

**Rule**: Only use `"ContractName"` (without version suffix) when upgrading TO the latest version. For intermediate versions, always use `"ContractNameVN"`.

### Library Redeployment

**Always redeploy all libraries when upgrading.** Libraries are redeployed fresh with each contract upgrade - there's no library versioning or reuse.

### CLI Upgrade System

Upgrades are executed via interactive CLI:

```bash
yarn contracts:upgrade:<env>  # env: local, testnet-staging, testnet, mainnet
```

This runs `scripts/upgrade/select-and-upgrade.ts` which reads from `upgradesConfig.ts` to present available upgrades.

### Upgrade Script Template

```typescript
import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { ethers } from "hardhat"

async function main() {
  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  // Check current version
  const contract = await ethers.getContractAt("ContractName", config.contractAddress)
  const currentVersion = await contract.version()
  console.log("Current version:", currentVersion)

  // Upgrade
  const upgraded = await upgradeProxy(
    "ContractNameV{N-1}", // Previous version
    "ContractName", // New version
    config.contractAddress,
    [initArg1, initArg2], // reinitializer args
    { version: N },
  )

  // Verify
  const newVersion = await upgraded.version()
  if (parseInt(newVersion) !== N) throw new Error("Upgrade failed")
}
```

### Reinitializer Pattern

Use `reinitializer(N)` for upgrade initialization:

```solidity
function initializeV2(address newParam) public reinitializer(2) {
    _newStorage = newParam;
}
```

## Test Writing Guide

### Running Tests

Run single test file from monorepo root:

```bash
yarn contracts:test --grep "test name"
```

Or directly (from `packages/contracts`):

```bash
NEXT_PUBLIC_APP_ENV=local npx hardhat test --network hardhat test/YourTest.test.ts
```

### Test File Naming

- `{Contract}.test.ts` - Main contract tests
- `{contract}/v{N}-upgrade.test.ts` - Upgrade tests
- `{contract}/v{N}-compatibility.test.ts` - Backward compatibility tests
- `{contract}/{feature}.test.ts` - Feature-specific tests

### CI Unit Test Shards

Unit tests run in parallel via shards in `.github/workflows/unit-tests.yml`. Each shard has a `label` and runs tests matched by `grep` on that label. Test describe blocks use `@shard15x` (or similar) in their name to match.

**When adding a new test shard** (e.g. for a new feature or coverage-focused suite):

1. Add `@shard15x` (or next available) to the describe block name in the test file
2. **Add the shard to `.github/workflows/unit-tests.yml`** in the `strategy.matrix` - otherwise CI will not run it

Example matrix entry:

```yaml
- shard: shard15f
  label: X-Apps - V8 Upgrade
- shard: shard15g
  label: X-Apps - EndorsementUtils Coverage
```

Shard assignments are documented in `packages/contracts/test/README.md`.

### Helper Functions

Import from `./helpers`:

```typescript
import {
  getOrDeployContractInstances,
  bootstrapAndStartEmissions,
  waitForRoundToEnd,
  waitForNextCycle,
  getVot3Tokens,
  endorseApp,
} from "./helpers"
```

### Upgrade Test Pattern

```typescript
describe("ContractName V{N} Upgrade", () => {
  it("should upgrade from V{N-1} to V{N}", async () => {
    // Deploy V{N-1}
    const v1 = await deployProxy("ContractNameV{N-1}", [...])

    // Upgrade to V{N}
    const v2 = await upgradeProxy("ContractNameV{N-1}", "ContractName", await v1.getAddress(), [...])

    // Verify state preserved
    expect(await v2.existingData()).to.equal(expectedValue)

    // Verify new functionality
    expect(await v2.newFunction()).to.equal(expectedResult)
  })
})
```

## Common Patterns & Gotchas

### Creating X2Earn Apps

Each app requires a **unique creator** with their own **X2EarnCreator NFT**:

```typescript
// WRONG - one creator can only create one app
await x2EarnCreator.safeMint(owner.address)
await x2EarnApps.connect(owner).submitApp(owner.address, owner.address, "App1", "uri")
await x2EarnApps.connect(owner).submitApp(owner.address, owner.address, "App2", "uri") // FAILS!

// CORRECT - each app needs different creator with own NFT
const appCreator1 = otherAccounts[10]
const appCreator2 = otherAccounts[11]

await x2EarnCreator.safeMint(appCreator1.address)
await x2EarnCreator.safeMint(appCreator2.address)

await x2EarnApps.connect(appCreator1).submitApp(appCreator1.address, appCreator1.address, "App1", "uri")
await x2EarnApps.connect(appCreator2).submitApp(appCreator2.address, appCreator2.address, "App2", "uri")

// Don't forget to endorse apps (use different endorsers)
await endorseApp(app1Id, otherAccounts[12])
await endorseApp(app2Id, otherAccounts[13])
```

### Claiming Rewards - Cycle Must Be Ended

Rewards can only be claimed **after the cycle ends**:

```typescript
// Start round and vote
await bootstrapAndStartEmissions()
const roundId = await xAllocationVoting.currentRoundId()
// ... voting happens ...

// Wait for round to end
await waitForRoundToEnd(Number(roundId))

// Distribute emissions (starts new cycle)
await emissions.connect(minterAccount).distribute()

// Claim for the ENDED cycle (roundId), not getCurrentCycle()
// getCurrentCycle() returns the NEW cycle that just started
const cycleToClaimFor = roundId
await voterRewards.claimReward(cycleToClaimFor, voter.address)
```

### X2EarnCreator NFT - Check Before Minting

```typescript
// Prevent "AlreadyOwnsNFT" error
if ((await x2EarnCreator.balanceOf(user.address)) === 0n) {
  await x2EarnCreator.connect(owner).safeMint(user.address)
}
```

### Voting Power at Snapshot

For voting and rewards, power is measured at the **round snapshot**, not current block:

```typescript
const snapshot = await xAllocationVoting.roundSnapshot(roundId)
const votingPower = await navigator.getNavigatorVotingPower(navigatorAddress, snapshot)
```

### Personhood Checks

Some functions require whitelisting in VeBetterPassport:

```typescript
await veBetterPassport.connect(owner).whitelist(voter.address)
await veBetterPassport.connect(owner).toggleCheck(1) // Enable whitelist check
```

## Debugging Tips

- Add `console.log` statements liberally to understand flow
- Use `describe.only()` to run single test suite
- Check role assignments if getting "AccessControl" errors
- Verify contract addresses are set correctly before operations

## Block-Based Timing

Rounds are **block-based**, not time-based. In local/test environment:

- 1 round = 24 blocks
- Tests mine blocks to advance rounds using `waitForRoundToEnd()` helper
- Production has longer rounds (configured per environment)

## Creating New Contracts

### Base Template

Use `contracts/templates/BaseUpgradeable.sol` as the standard template for new upgradeable contracts:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract MyNewContract is AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    error UnauthorizedUser(address user);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ---------- Storage ------------ //
    // Use namespaced storage pattern (ERC-7201)
    struct MyContractStorage {
        // your storage variables
    }

    bytes32 private constant MyContractStorageLocation =
        0x...; // keccak256(abi.encode(uint256(keccak256("storage.MyContract")) - 1)) & ~bytes32(uint256(0xff))

    function _getMyContractStorage() private pure returns (MyContractStorage storage $) {
        assembly {
            $.slot := MyContractStorageLocation
        }
    }

    function initialize(address _upgrader, address[] memory _admins) external initializer {
        require(_upgrader != address(0), "MyContract: upgrader is the zero address");

        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(UPGRADER_ROLE, _upgrader);
        for (uint256 i; i < _admins.length; i++) {
            require(_admins[i] != address(0), "MyContract: admin address cannot be zero");
            _grantRole(DEFAULT_ADMIN_ROLE, _admins[i]);
        }
    }

    modifier onlyRoleOrAdmin(bytes32 role) {
        if (!hasRole(role, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedUser(msg.sender);
        }
        _;
    }

    function _authorizeUpgrade(address) internal virtual override onlyRole(UPGRADER_ROLE) {}

    function version() public pure virtual returns (string memory) {
        return "1";
    }
}
```

### Contract Size Management

- **Small/simple contracts**: Libraries not required
- **Large contracts**: Extract logic into libraries to avoid 24KB contract size limit

When to use libraries:

- Contract approaching size limit (check with `yarn contracts:compile` - shows sizes)
- Reusable logic shared across multiple contracts
- Complex calculations that can be isolated

## Security Requirements

### CRITICAL: Non-Negotiable Rules

1. **Reentrancy Guards** - Always use `nonReentrant` modifier on external functions that transfer funds or modify state:

   ```solidity
   import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

   function claimRewards() external nonReentrant {
       // ...
   }
   ```

2. **Overflow/Underflow Checks** - Solidity 0.8+ has built-in checks, but be explicit with critical math:

   ```solidity
   // Use SafeMath patterns for critical calculations
   require(balance >= amount, "Insufficient balance");
   uint256 newBalance = balance - amount; // Safe in 0.8+, but validate first
   ```

3. **Double Vote Prevention** - Always track and verify voting status:

   ```solidity
   mapping(uint256 => mapping(address => bool)) private _hasVoted;

   function vote(uint256 roundId, ...) external {
       require(!_hasVoted[roundId][msg.sender], "Already voted");
       _hasVoted[roundId][msg.sender] = true;
       // ... voting logic
   }
   ```

4. **Double Claim Prevention** - Track claimed rewards per cycle/round:

   ```solidity
   mapping(uint256 => mapping(address => bool)) private _hasClaimed;

   function claimReward(uint256 cycleId) external {
       require(!_hasClaimed[cycleId][msg.sender], "Already claimed");
       _hasClaimed[cycleId][msg.sender] = true;
       // ... claim logic
   }
   ```

### Preserve Core Logic

**CRITICAL: Existing tests define expected behavior.** Before modifying any contract:

1. Run `yarn contracts:test` to ensure all tests pass
2. Read related test files to understand expected behavior
3. Do NOT change logic that would break existing tests without explicit approval
4. New features must have corresponding tests before merging

### Security Checklist

Before submitting contract changes:

- [ ] Reentrancy guard on all external state-changing functions
- [ ] No double vote/claim vulnerabilities
- [ ] Access control on admin functions (`onlyRole`)
- [ ] Events emitted for all state changes
- [ ] Input validation on all parameters
- [ ] All existing tests still pass
- [ ] New functionality has test coverage

## Code Style

### NatSpec Documentation

All public/external functions require NatSpec:

```solidity
/// @notice Brief description
/// @dev Implementation details
/// @param paramName Parameter description
/// @return Description of return value
function myFunction(uint256 paramName) external returns (uint256) {
```

### Events

Emit events for all state changes:

```solidity
event ActionPerformed(address indexed user, uint256 amount);

function performAction(uint256 amount) external {
    // ... logic
    emit ActionPerformed(msg.sender, amount);
}
```

### Access Control

Use OpenZeppelin AccessControl roles:

```solidity
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

function adminOnly() external onlyRole(ADMIN_ROLE) {
```

### Error Handling

Use custom errors (gas efficient):

```solidity
error InvalidAmount(uint256 provided, uint256 minimum);

function deposit(uint256 amount) external {
    if (amount < MIN_AMOUNT) revert InvalidAmount(amount, MIN_AMOUNT);
}
```

## Libraries Pattern

External libraries for code reuse and size reduction:

```solidity
// libraries/MyLogic.sol
library MyLogic {
    function calculate(uint256 a) internal pure returns (uint256) {
        return a * 2;
    }
}

// Contract.sol
import { MyLogic } from "./libraries/MyLogic.sol";

contract MyContract {
    using MyLogic for uint256;

    function doCalc(uint256 x) external pure returns (uint256) {
        return x.calculate();
    }
}
```

Deploy libraries separately and link during upgrade.

## Slither

Slither runs in CI on contract changes. Mark false positives in `slither.config.json`:

```json
{
  "suppressions": [
    {
      "check": "reentrancy-eth",
      "file": "contracts/MyContract.sol",
      "function": "myFunction(uint256)",
      "reason": "CEI pattern followed"
    }
  ]
}
```
