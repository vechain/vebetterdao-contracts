# Smart Contracts Changelog

This document provides a detailed log of upgrades to the smart contract suite, ensuring clear tracking of changes, improvements, bug fixes, and versioning across all contracts.

## Version History

| Date                | Contract(s)                                                                                                                   | Summary                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 31th March 2025  | `X2EarnRewardsPool` version `7`, `X2Earn Apps` version `4`, `XAllocationPool` version `5`                                                                                      | Added optional dual-pool balance to manage rewards and app treasury separately, with distribution pausability option.      
| 27th February 2025  | `X2EarnRewardsPool` version `6`                                                                                               | Added support for rewards distribution with metadata.                                          |
| 13th January 2025   | `XAllocationVoting` version `5`                                                                                               | Fixed issue with duplicate app voting in the same transaction.                                 |
| 4th December 2024   | `X2EarnApps` version `3`, `XAllocationVoting` version `4`, `XAllocationPool` version `4`, and `X2EarnRewardsPool` version `5` | Added endorsement cooldown feature to X2Earn contracts.                                        |
| 29th November 2024  | `VeBetterPassport` version `3`, `GalaxyMember` version `3`, and `VoterRewards` version 4                                      | Added GM level as personhood check in VeBetter passport.                                       |
| 28th November 2024  | `NodeManagement` version `2`                                                                                                  | Added new functions to check node delegation status and improved node management capabilities. |
| 15th November 2024  | `GalaxyMember` version `2`, `VoterRewards` version `3`, `B3TRGovernor` version `5`                                            | Added Vechain Node Binding with Galaxy Member feature                                          |
| 15th November 2024  | `X2EarnApps` version `2`                                                                                                      | Added X2Earn Apps Vechain Node Endorsement feature                                             |
| 21th October 2024   | `VeBetterPassport` version `2`                                                                                                | Check if the entity is a delegatee when request is created                                     |
| 11th October 2024   | `XAllocationVoting` version `2`                                                                                               | Check isPerson when casting vote & fixed weight during vote                                    |
| 11th October 2024   | `B3TRGovernor` version `4`                                                                                                    | Check isPerson when casting vote                                                               |
| 11th October 2024   | `X2EarnRewardsPool` version `3`                                                                                               | Register action in VeBetter Passport contract                                                  |
| 27th September 2024 | `Emissions` version `2`                                                                                                       | Aligned emissions with the expected schedule                                                   |
| 13th September 2024 | `B3TRGovernor` version `3`, `XAllocationPool` version `2`                                                                     | - Added toggling of quadratic voting and funding                                               |
| 4th September 2024  | `X2EarnRewardsPool` version `2`                                                                                               | - Added impact key management and proof building                                               |
| 31st August 2024    | `VoterRewards` version `2`                                                                                                    | - Added quadratic rewarding features                                                           |
| 29th August 2024    | `B3TRGovernor` version `2`                                                                                                    | Updated access control modifiers                                                               |

---

## Upgrade `X2EarnRewardsPool` to Version 7

This upgrade introduces an optional dual-pool mechanism that gives app admin more control over rewards distribution, and a pause option for reward distribution. When enabled, this feature creates a clear separation between funds for rewards and withdrawals.

### Key Updates 🗂
It separates app funds into two distinct pools (rewards pool for distributors and available funds pool for admin withdrawals), enhances access control by restricting withdrawals to app admins only, and maintains backward compatibility through an optional implementation that preserves existing behavior unless explicitly enabled. It allow app admin to pause or unpause reward distribution for their app. Once paused, if the rewards pool is enabled, the app admin won't be able to move funds from one pool to another.

### Changes 🚀

- **Upgraded Contract(s):**
  - `X2EarnRewardsPool.sol` to version `7`
  - `XAllocationVoting.sol` to version `5`
  - `X2EarnApps.sol` to version `4`

### Storage Changes 📦

- **`X2EarnRewardsPool`**:
  - Added `rewardsPoolBalance` to store the balance for rewards distribution 
  - Added `isRewardsPoolEnabled` to store whether the rewards pool is enabled or not.
  - Added `distributionPaused` to store whether the rewards distribution is paused or not.

- **`X2EarnApps`**:
  - Added `x2EarnRewardsPoolContract` to AdministrationUpgradeable librarie. 

### New Features 🚀

- **`X2EarnRewardsPool`**:
  - **Access Control**: Modified withdrawal permissions - only app admins can withdraw funds
  - Added `toggleRewardsPoolBalance()` to enable/disable the dual-pool feature for an app
  - Added `increaseRewardsPoolBalance()` to move funds from available pool to rewards pool 
  - Added `decreaseRewardsPoolBalance()` to move funds from rewards pool back to available pool
  - Added `isRewardsPoolEnabled()` getter to check if the dual-pool feature is enabled for an app
  - Added `rewardsPoolBalance()` getter to check the current rewards pool balance
  - Added `totalBalance()` getter to check the total balance of the app, considering both available funds and rewards pool if the feature is enabled
  - Added `pauseDistribution()` setter to pause reward distribution for an app
  - Added `unpauseDistribution()` setter to unpause reward distribution for an app
  - Added `onlyX2EarnApps` modifier, to only let x2EarnApps contract to enable rewards pool for new app
  - Added `isDistributionPaused` getter to check whether the rewards pool is paused or not.

- **`X2EarnApps`**:
  - Added `setX2EarnRewardsPoolContract` to set the x2EarnRewardsPoolContract 
  - Added `enableRewardsPoolForNewApp` to enabled rewards pool by default on submit app


### Bug Fixes 🐛

- None.
---

## Upgrade `X2EarnRewardsPool` to Version 6

This upgrade introduces the ability for XApps to include metadata in the reward distribution process, enabling richer and more context-specific information to be stored and emitted during events. A new function, `distributeRewardWithProofAndMetadata`, has been added for this purpose.

### Key Updates

- **Backward Compatibility Preserved**: The original `distributeRewardWithProof` function remains unchanged and continues to work as before for apps that do not wish to use metadata.
- **New Metadata Functionality**: The `distributeRewardWithProofAndMetadata` function accepts a string intended to be a JSON representation. A dedicated event, `RewardMetadata`, is emitted to store this information, following the established internal standards of `_emitProof`.

---

### Changes 🚀

- **Upgraded Contracts:**
  - `X2EarnRewardsPool.sol` updated to version `6`.

---

### Storage Changes 📦

- None.

---

### New Features 🚀

- **`X2EarnRewardsPool`:**
  - Added `distributeRewardWithProofAndMetadata()`, which accepts a string intended to be a JSON representation and emits a new event, `RewardMetadata`, containing this information.
  - Updated internal logic with `_emitMetadata`, following the `_emitProof` pattern, to emit the event with the JSON data.

---

### Bug Fixes 🐛

- None.

---

## Upgrade `XAllocationVoting` to Version 5

Fixed issue with duplicate app voting in the same transaction.

### Changes 🚀

- **Upgraded Contract(s):**
  - `XAllocationVoting.sol` to version `5`

### Storage Changes 📦

- None.

### New Features 🚀

- None.

### Bug Fixes 🐛

- **`RoundVotesCountingUpgradeable.sol`**:
  - Updated `_countVote` function to check each app against all previous apps in the transaction to prevent duplicate voting.
  - Added new `DuplicateAppVote` error

---

## Upgrade `X2EarnApps` to Version 3, `XAllocationVoting` to version `4`, `XAllocationPool` to version `4`, and `X2EarnRewardsPool` to version `5`

Added new endorsement cooldown feature to X2EarnApps, in which vechain nodes enter a cooldown period after endorsing an XApp.
<br>
Updated `XAllocationVoting`, `XAllocationPool` and `X2EarnRewardsPool` to use version `3` of `X2EarnApps` interface.

### Changes 🚀

- **Upgraded Contract(s):**
  - `X2EarnApps.sol` to version `3`
  - `XAllocationVoting.sol` to version `4`
  - `XAllocationPool.sol` to version `4`
  - `X2EarnRewardsPool.sol` to version `5`

### Storage Changes 📦

- **`X2EarnApps`**:
  - Added `_endorsementRound` to store latest round Vechain Node endorsed an XApp.
  - Added `_cooldownPeriod` to store cooldown period in terms of rounds.
  - Added `_xAllocationVotingGovernor` to store `XAllocationVoting` address.

### New Features 🚀

- **`X2EarnApps`**:
  - Added `checkCooldown()` to check if a vechain node is currently in cooldown period, this is a public function that is also used inside `endorseApp()` and `unendorseApp()`.
  - Added `getXAllocationVotingGovernor()` to get the address of the `XAllocationVoting` contract.
  - Added `cooldownPeriod()` to get the cooldown period in rounds.
  - Added `setXAllocationVotingGovernor()` to set `XAllocationVoting` address.
  - Added `updateCooldownPeriod()` to update cooldown period.

### Bug Fixes 🐛

- None.

---

## Upgrade `VeBetterPassport` to Version 3, and `GalaxyMember` to Version 3

Added new personhood check in VeBetter passport, if a user owns a GM with a level greater than 1 they are considered a person.
<br>
Updated `GalaxyMember` to checkpoint selected GM NFT and allow admin to select token for user for GM levels go live.
<br>
Updated `VoterRewards` to use version `3` of `GalaxyMember` interface.

### Changes 🚀

- **Upgraded Contract(s):**
  - `VeBetterPassport.sol` to version `3`
  - `GalaxyMember.sol` to version `3`
  - `VoterRewards.sol` to version `4`

### Storage Changes 📦

- **`GalaxyMember`**:
  - Added `_selectedTokenIDCheckpoints` to store checkpoints for selected GM token ID of the user.

### New Features 🚀

- **`VeBetterPassport`**:
  - Updated `PassportPersonhoodLogic.sol` library's function `_checkPassport()` to include check for GM level.
- **`GalaxyMember`**:
  - Added `selectFor()` function to allow the admin to select a token for the user.
  - Added `clock()` and `CLOCK_MODE()` functions to allow for custom time tracking.
  - Added `getSelectedTokenIdAtBlock()` to get the selected GM token ID for the user at a specific block number.
  - Updated Node Management interface to include new getters of Node Management V2 contract.

### Bug Fixes 🐛

- None.

---

## Upgrade `NodeManagement` to Version 2

Added new functions to check node delegation status and improved node management capabilities.

### Changes 🚀

- **Upgraded Contract(s):**
  - `NodeManagement.sol` to version `2`

### Storage Changes 📦

- None.

### New Features 🚀

- **`NodeManagement`**:
  - Added `isNodeDelegated()` to check if a specific node ID is delegated
  - Added `isNodeDelegator()` to check if a user has delegated their node
  - Added `getDirectNodeOwnership()` to check direct node ownership without delegation
  - Added `isNodeHolder()` to check if a user is a node holder (both directly owned and indirectly through delegation)
  - Added `getUserNodes()` to get comprehensive node information including:
    - Node ID
    - Node level
    - Owner address
    - Node holder status
    - Delegation status
    - Delegator status
    - Delegatee status
    - Delegatee address

### Bug Fixes 🐛

- None.

---

## Upgrade `GalaxyMember` to Version 2

Introduced a composition pattern to attach and detach Vechain nodes to/from Galaxy Member (GM) NFTs. This feature allows GM NFTs to dynamically acquire or lose levels based on the attached node's capabilities.

### Changes 🚀

- **Upgraded Contract(s):**
  - `GalaxyMember.sol` to version `2`
  - `VoterRewards.sol` to version `3`
  - `B3TRGovernor.sol` to version `5`

### Storage Changes 📦

- **`GalaxyMember.sol`**:
  - Added `vechainNodes` to store the address of the Vechain Nodes contract.
  - Added `nodeManagement` to store the address of the Node Management contract.
  - Added `_nodeToTokenId` to track the XNode tied to the GM token ID.
  - Added `_tokenIdToNode` to track the GM token ID tied to the XNode token ID.
  - Added `_nodeToFreeUpgradeLevel` to track the GM level that can be upgraded for free for a given Vechain node level.
  - Added `_tokenIdToB3TRdonated` to store the mapping from GM Token ID to B3TR donated for upgrading.
  - Added `_selectedTokenID` to store the mapping from user address to selected GM token ID.
- **`VoterRewards.sol`**:
  - Added `proposalToGalaxyMemberToHasVoted` to keep track of whether a galaxy member has voted in a proposal.
  - Added `proposalToNodeToHasVoted` to keep track of whether a vechain node has been used while attached to a galaxy member NFT when voting for a proposal.

### New Features 🚀

- **`GalaxyMember.sol`**:
  - Added `attachNode()` function to attach Vechain Node to GM NFT.
  - Added `detachNode()` function to detach Vechain Node from GM NFT.
  - Added `setVechainNodes()` function to update the Vechain Nodes contract address.
  - Added `setNodeToFreeUpgradeLevel()` to set the levelin which a Vechain Node can upgrade to for free.
  - Added `levelOf()` to get the level of GM token.
  - Added `getB3TRtoUpgradeToLevel()` to get the required B3TR to upgrade GM NFT to certain level.
  - Added `getB3TRtoUpgrade()` to get the required B3TR to upgrade GM NFT to the next level.
  - Added `getNodeLevelOf()` to get the level of a give Vechain node.
  - Added `getLevelAfterAttachingNode()` to get level of GM NFT after attaching particular GM NFT.
  - Added `getIdAttachedToNode()` to get GM NFT attached to Vechain node.
  - Added `getIdAttachedToNode()` to get Vechain node attached to GM NFT.
  - Added `getNodeToFreeLevel()` to get level in which GM NFT can be upgraded to for free if particular Vechain node is attached.
  - Added `getB3TRdonated()` to get the B3TR donated by a GM NFT so far to reach ther aquired level.
  - Added `getTokenInfoByTokenId()` to get infomation on particular GM NFT.
  - Added `getSelectedTokenInfoByOwner()` to get GM NFT user is using for rewards boosts.
  - Added `getTokensInfoByOwner()` to get infomation on GM NFTs owned by a particular address.
- **`VoterRewards.sol`**:
  - Added `getMultiplier()` to get the reward multiplier for a user in a specific proposal.
  - Added `hasNodeVoted()` to check if a Vechain Node has voted on a proposal.
  - Added `hasTokenVoted()` to check if a GM NFT has voted on a proposal.
- **`GovernorVotesLogic.sol`**:
  - Updated `castVote()` to pass proposalId instead of snapshot to Voter Rewards `registerVote()` function.

### Bug Fixes 🐛

- **`GalaxyMember.sol`**:
  - In Version 1, transfers that occur from an approved address are subject to underflow issues when updating the `_ownedLevels` map. This is fixed with Version 2 by also asserting updates are made on the owner of the token ID rather than the auth of the internal `_update` function.

---

## Upgrade `X2EarnApps` to Version 2

Added Vechain Node XApp Endorsement feature.

### Changes 🚀

- **Upgraded Contract(s):**
  - `X2EarnApps.sol` to version `2`

### Storage Changes 📦

- **`EndorsementUpgradeable.sol`**:
  - Added `_unendorsedApps` to store the list of apps pending endorsement.
  - Added `_unendorsedAppsIndex` to store mapping from app ID to index in the \_unendorsedApps array.
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

- - Added libraries `AdministrationUtils.sol`, `EndorsementUtils.sol`, `AppStorageUtils.sol` and `VoteEligibilityUtils.sol` to store some of the logic for the X2EarnApps contracts modules to reduce contract size.

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
