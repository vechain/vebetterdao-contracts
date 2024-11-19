# Smart Contracts Changelog

This document provides a detailed log of upgrades to the smart contract suite, ensuring clear tracking of changes, improvements, bug fixes, and versioning across all contracts.

## Version History

| Date                | Contract(s)                                               | Summary                                                     |
| ------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| 15th November 2024  | `X2EarnApps` version `2`                                  | Added X2Earn Apps Vechain Node Endorsement feature          |
| 21th October 2024   | `VeBetterPassport` version `2`                            | Check if the entity is a delegatee when request is created  |
| 11th October 2024   | `XAllocationVoting` version `2`                           | Check isPerson when casting vote & fixed weight during vote |
| 11th October 2024   | `B3TRGovernor` version `4`                                | Check isPerson when casting vote                            |
| 11th October 2024   | `X2EarnRewardsPool` version `3`                           | Register action in VeBetter Passport contract               |
| 27th September 2024 | `Emissions` version `2`                                   | Aligned emissions with the expected schedule                |
| 13th September 2024 | `B3TRGovernor` version `3`, `XAllocationPool` version `2` | - Added toggling of quadratic voting and funding              |
| 4th September 2024  | `X2EarnRewardsPool` version `2`                           | - Added impact key management and proof building              |
| 31st August 2024    | `VoterRewards` version `2`                                | - Added quadratic rewarding features                          |
| 29th August 2024    | `B3TRGovernor` version `2`                                | Updated access control modifiers                            |

---

## Upgrade `X2EarnApps` to Version 2

Added Vechain Node XApp Endorsement feature.

### Changes 🚀

- **Upgraded Contract(s):**
  - `X2EarnApps.sol` to version `2`

### Storage Changes 📦

- **`EndorsementUpgradeable.sol`**:
    - Added `_unendorsedApps` to store the list of apps pending endorsement.
    - Added `_unendorsedAppsIndex` to store mapping from app ID to index in the _unendorsedApps array.
    - Added `_appEndorsers` to store the mapping of each app ID to an array of node IDs that have endorsed it.
    - Added `_nodeEnodorsmentScore` to score the endorsement score for each node level.
    - Added `_appGracePeriodStart` to store the grace period elapsed by the app since endorsed.
    - Added `_nodeToEndorsedApp` to store the mapping of a node ID to the app it currently endorses.
    - Added `_gracePeriodDuration` to store the grace period threshold for no endorsement in blocks.
    - Added `_endorsementScoreThreshold` to store the endorsement score threshold for an app to be eligible for voting.
    - Added `_appScores` to store the score of each app.
    - Added `_appSecurity` to store the security score of each app.
    - Added `_nodeManagementContract` to store the node management contract address.
    - Added `_veBetterPassport` to store the VeBetterPassport contract address.
- **`EndorsementUpgradeable.sol`**: 
    - Added `_creators` to store a mapping of addresses that have a creators NFT and can manage interactions with Node holders for a specifc XApp.
    - Added `_creatorApps` to store the number of apps created by a creator.
    - Added `_x2EarnCreatorContract` to store the address of the X2Earn Creators contract.
 - **`VoteEligibilityUpgradeable.sol`**: 
    - Added `_blackList` to store a record blacklisted X2Earn appIds.

### New Features 🚀

- Added `EndorsementUpgradeable.sol` module which makes up all X2EarnApps endorsement logic and functions (see docs for more info).
- Replaced `appApp()` with `submitApp()`.
- Added getter `isBlacklisted()` to check if XApp is blacklisted.
- Added `removeAppCreator()`, `appCreators()`, `isAppCreator()` and `creatorApps()` to manage and get info on X2Earn app creators. 

### Bug Fixes 🐛

- - Added libraries `AdministrationUtils.sol`, `EndorsementUtils.sol`, `AppStorageUtils.sol` and `VoteEligibilityUtils.sol` to store some of the logic for the  X2EarnApps contracts modules to reduce contract size. 

---

## Upgrade `VeBetterPassport` to Version 2

Added check to ensure entity is not a delegatee or pending delegatee when making entity link request.

### Changes 🚀

- **Upgraded Contract(s):**
  - `VeBetterPassport.sol` to version `2`

### Storage Changes 📦

- None.

### New Features 🚀

- None.

### Bug Fixes 🐛

- **`VeBetterPassport.sol`**:
  - Added check to ensure entity is not a delegatee or pending delegatee when making entity link request.

---

## Upgrade `XAllocationVoting` to Version 2, `B3TRGovernor` to version 4, and `X2EarnRewardsPool` to version 3 (9th October 2024)

This upgrade ensures that the `isPerson` check is performed when casting a vote in the `XAllocationVoting` and `B3TRGovernor` contracts. Additionally, the `X2EarnRewardsPool` contract now registers actions in the `VeBetter Passport` contract.

Another change in the `XAllocationVoting` contract is the fixed weight during the vote, ensuring that the weight cannot be lower than 1.

### Changes 🚀

- **Upgraded Contract(s):**
  - `XAllocationVoting.sol` to version `2`
  - `B3TRGovernor.sol` to version `4`
  - `X2EarnRewardsPool.sol` to version `3`

### Storage Changes 📦

- **`XAllocationVoting.sol`**:
  - Added veBetterPassport contract address.
- **`B3TRGovernor.sol`**:
  - Added veBetterPassport contract address.
- **`X2EarnRewardsPool.sol`**:
  - Added veBetterPassport contract address.

### New Features 🚀

- **`XAllocationVoting.sol`**:
  - Added `isPerson` check when casting a vote.
- **`B3TRGovernor.sol`**:
  - Added `isPerson` check when casting a vote.
- **`X2EarnRewardsPool.sol`**:
  - Register actions in the `VeBetter Passport` contract.

### Bug Fixes 🐛

- **`XAllocationVoting.sol`**:
  - Fixed weight during vote to ensure it cannot be lower than 1.

---

## Upgrade `Emissions` to Version 2 (27th September 2024)

This upgrade aligns the emissions with the expected schedule by correcting previous configuration errors.

### Changes 🚀

- **Upgraded Contract(s):** `Emissions.sol` to version `2`

### Storage Changes 📦

- Added `_isEmissionsNotAligned` to store the emissions alignment status.

### New Features 🚀

- In `_calculateNextXAllocation` function, added logic to calculate the next X Allocation based on the emissions alignment status.

### Bug Fixes 🐛

- Corrected `xAllocationsDecay` from `912` to `12`, fixing the erroneous value set in version `1`.
- Applied a reduction of `200,000` B3TR emissions for round `14` to align with the expected emissions schedule.

---

## Upgrade `B3TRGovernor` to Version 3 and `XAllocationPool` to Version 2 (13th September 2024)

This upgrade adds the ability to toggle quadratic voting and quadratic funding on or off, providing greater control over governance and allocation mechanisms.

### Changes 🚀

- **Upgraded Contract(s):**
  - `B3TRGovernor.sol` to version `3`
  - `XAllocationPool.sol` to version `2`

### Storage Changes 📦

- **`B3TRGovernor.sol`**:
  - Added `quadraticVotingDisabled` checkpoints to store the quadratic voting disabled status.
- **`XAllocationPool.sol`**:
  - Added `quadraticFundingDisabled` checkpoints to store the quadratic funding disabled status.

### New Features 🚀

- **`B3TRGovernor`**:
  - Ability to toggle quadratic voting on or off.
- **`XAllocationPool`**:
  - Ability to toggle quadratic funding on or off.

### Bug Fixes 🐛

- None.

---

## Upgrade `X2EarnRewardsPool` to Version 2 (4th September 2024)

This upgrade introduces impact key management and the ability to build proofs of sustainable impact.

### Changes 🚀

- **Upgraded Contract(s):** `X2EarnRewardsPool.sol` to version `2`

### Storage Changes 📦

- Added `impactKeyIndex` to store allowed impact keys index for proof of sustainable impact building.
- Added `allowedImpactKeys` to store the array of allowed impact keys.

### New Features 🚀

- Introduced the `IMPACT_KEY_MANAGER_ROLE` to manage allowed impact keys.
- Introduced the `onlyRoleOrAdmin` modifier to restrict access to the `IMPACT_KEY_MANAGER_ROLE` or admin.
- Added `buildProof` function to build proof of sustainable impact.

### Bug Fixes 🐛

- None.

---

## Upgrade `VoterRewards` to Version 2 (31st August 2024)

This upgrade adds the ability to disable quadratic rewarding for specific cycles, providing greater flexibility in reward distribution. Introduced as first step of sybil mitigation.

### Changes 🚀

- **Upgraded Contract(s):** `VoterRewards.sol` to version `2`

### Storage Changes 📦

- Added `quadraticRewardingDisabled` checkpoints to store the quadratic rewarding status for each cycle.

### New Features 🚀

- Added functions to:
  - Disable or re-enable quadratic rewarding for specific cycles.
  - Check if quadratic rewarding is disabled at a specific block number or for the current cycle.
- Added the `clock` function to get the current block number.

### Bug Fixes 🐛

- None.

---

## Upgrade `B3TRGovernor` to Version 2 (29th August 2024)

This upgrade enhances access control by allowing the `DEFAULT_ADMIN_ROLE` to execute critical functions without requiring a governance proposal.

### Changes 🚀

- **Upgraded Contract(s):** `B3TRGovernor.sol` to version `2`

### Storage Changes 📦

- **Storage Changes:** None.

### New Features 🚀

- Updated functions previously restricted by `onlyGovernance` to use `onlyRoleOrGovernance`, permitting `DEFAULT_ADMIN_ROLE` direct access.

### Bug Fixes 🐛

- None.

---

## Glossary

- **Quadratic Voting**: A voting system where the cost of votes increases quadratically with the number of votes cast.
- **Quadratic Funding**: A funding mechanism that allocates resources based on the square of contributions received.
- **Checkpoint**: A recorded state at a specific point in time for tracking changes or status.
