# Smart Contracts Changelog

This document provides a detailed log of upgrades to the smart contract suite, ensuring clear tracking of changes, improvements, bug fixes, and versioning across all contracts.

## Version History

| Date                | Contract(s)                                                                                                                   | Summary                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 3 December 2025     | `GalaxyMember` version `6` and `X2EarnApps` version `7`                                                                       | Replace Node Management Contract with Stargate NFT
| 27 October 2025     | `B3TRGovernor` version `8` and `GrantsManager` version `2`                                                                    | Give ability to mark proposals as in development/completed                                                                                   |
| 27 October 2025     | `DBAPool` version `2`                                                                                                         | Add tracking of DBA rewards per app per round and seed function for historical data                                                          |
| 21 October 2025     | `XAllocationVoting` version `8`, `VoterRewards` version `6`, `RelayerRewardsPool` version `1`                                 | Added auto-voting functionality with relayer rewards system and early access period                                                          |
| 23 October 2025     | `XAllocationPool` version `7`, `DBAPool` version `1`                                                                          | Store unallocated funds for each round and deployed new contract                                                                             |
| 6 August 2025       | `B3TRGovernor` version `7`, `XAllocationVoting` version `7`                                                                   | Added grant proposal type with separate thresholds, added deposit threshold cap, and enabled deposit-based voting power in allocation voting |
| 1 July 2025         | `GalaxyMember` version `5`, `NodeManagement` version `3`                                                                      | Use NodeManagementV3, avoid calls to legacy VeChain Nodes contract                                                                           |
| 9 May 2025          | `Emissions` version `3`, `GalaxyMember` version `4`, `VoterRewards` version `5`                                               | Restoring the GM NFT System - Proposal Execution                                                                                             |
| 2 May 2025          | `X2EarnApps` version `5`                                                                                                      | Restricting to submit one app for each creator NFT received>                                                                                 |
| 02 May 2025         | `VeBetterPassport` version `4`                                                                                                | Added RESET_SIGNALER_ROLE and fixed arithmetic underflow when resetting signals.                                                             |
| 25 March 2025       | `X2EarnRewardsPool` version `7`, `X2EarnApps` version `4`, `XAllocationPool` version `5`                                      | Added optional dual-pool balance to manage rewards and app treasury separately                                                               |
| 27th February 2025  | `X2EarnRewardsPool` version `6`                                                                                               | Added support for rewards distribution with metadata.                                                                                        |
| 13th January 2025   | `XAllocationVoting` version `5`                                                                                               | Fixed issue with duplicate app voting in the same transaction.                                                                               |
| 4th December 2024   | `X2EarnApps` version `3`, `XAllocationVoting` version `4`, `XAllocationPool` version `4`, and `X2EarnRewardsPool` version `5` | Added endorsement cooldown feature to X2Earn contracts.                                                                                      |
| 29th November 2024  | `VeBetterPassport` version `3`, `GalaxyMember` version `3`, and `VoterRewards` version 4                                      | Added GM level as personhood check in VeBetter passport.                                                                                     |
| 28th November 2024  | `NodeManagement` version `2`                                                                                                  | Added new functions to check node delegation status and improved node management capabilities.                                               |
| 15th November 2024  | `GalaxyMember` version `2`, `VoterRewards` version `3`, `B3TRGovernor` version `5`                                            | Added Vechain Node Binding with Galaxy Member feature                                                                                        |
| 15th November 2024  | `X2EarnApps` version `2`                                                                                                      | Added X2Earn Apps Vechain Node Endorsement feature                                                                                           |
| 21th October 2024   | `VeBetterPassport` version `2`                                                                                                | Check if the entity is a delegatee when request is created                                                                                   |
| 11th October 2024   | `XAllocationVoting` version `2`                                                                                               | Check isPerson when casting vote & fixed weight during vote                                                                                  |
| 11th October 2024   | `B3TRGovernor` version `4`                                                                                                    | Check isPerson when casting vote                                                                                                             |
| 11th October 2024   | `X2EarnRewardsPool` version `3`                                                                                               | Register action in VeBetter Passport contract                                                                                                |
| 27th September 2024 | `Emissions` version `2`                                                                                                       | Aligned emissions with the expected schedule                                                                                                 |
| 13th September 2024 | `B3TRGovernor` version `3`, `XAllocationPool` version `2`                                                                     | - Added toggling of quadratic voting and funding                                                                                             |
| 4th September 2024  | `X2EarnRewardsPool` version `2`                                                                                               | - Added impact key management and proof building                                                                                             |
| 31st August 2024    | `VoterRewards` version `2`                                                                                                    | - Added quadratic rewarding features                                                                                                         |
| 29th August 2024    | `B3TRGovernor` version `2`                                                                                                    | Updated access control modifiers                                                                                                             |

---

## Upgrade `GalaxyMember` to Version `6`

Migrates GalaxyMember from legacy VeChain nodes infrastructure to Stargate NFT ecosystem, replacing NodeManagement and TokenAuction contract dependencies with the unified StargateNFT contract for node management and level tracking.

---

### Changes 🚀

* **Upgraded Contract(s):**
  * `GalaxyMember.sol` to version `6`

---

### Storage Changes 📦

* **`GalaxyMember`**:

  **➕ Added (V6)**

  * `stargateNFT` (IStargateNFT) → Reference to the Stargate NFT contract for node management

  **⚠️ Deprecated (Retained for Backward Compatibility)**

  * `vechainNodes` (ITokenAuction) → Legacy VeChain nodes contract (no longer actively used but kept in storage)
  * `nodeManagement` (INodeManagementV3) → Legacy node management contract (no longer actively used but kept in storage)

---

### Migration Requirements ⚠️

* **Node Holders**: Users with nodes attached to Galaxy Member NFTs must migrate their nodes from the legacy TokenAuction contract to Stargate before upgrading to V6
* **Impact if Not Migrated**:
  - Node attachments will be automatically reset/cleared
  - Galaxy Member NFTs will revert to base level (level determined by B3TR donated only)
  - Users can re-attach their nodes after migration

---

### New Features 🚀

* **`GalaxyMember`**:

  #### Stargate NFT Integration:

  **Updated Core Functions:**
  - `attachNode()` - Now validates node ownership using `stargateNFT.getTokenManager()` instead of `nodeManagement.getNodeManager()`
  - `detachNode()` - Now checks permissions using `stargateNFT.isTokenManager()` and `stargateNFT.ownerOf()` instead of NodeManagement contract
  - `getNodeLevelOf()` - Now retrieves node levels via `stargateNFT.getTokenLevel()` instead of `nodeManagement.getNodeLevel()`

  **Internal Logic Updates:**
  - `_getNodeIdAttached()` - Now uses `stargateNFT.tokenExists()` and `stargateNFT.getTokenManager()` to validate node attachments
  - `_getIdAttachedToNode()` - Now uses `stargateNFT.tokenExists()` for node existence validation
  - `_getLevelOfAndB3TRleft()` - Now uses `stargateNFT.getTokenManager()` to verify node management rights for level calculation

  #### New Management Functions:
  - `setStargateNFTAddress(address _stargateNFT)` - Allows the `CONTRACTS_ADDRESS_MANAGER_ROLE` to update the StargateNFT contract address
    - Emits `StargateNFTAddressUpdated` event
  - `stargateNFT()` - View function to retrieve the current StargateNFT contract address

  #### API Mapping Changes:
  ```
  Legacy (V5)                           → Stargate (V6)
  ────────────────────────────────────────────────────────────────
  nodeManagement.getNodeManager()       → stargateNFT.getTokenManager()
  nodeManagement.getNodeOwner()         → stargateNFT.ownerOf()
  nodeManagement.getNodeLevel()         → stargateNFT.getTokenLevel()
  nodeManagement.isNodeDelegator()      → stargateNFT.isTokenManager()
  ```

---

### Events 📣

* **New Events:**
  - `StargateNFTAddressUpdated(address indexed newAddress, address indexed oldAddress)` - Emitted when the StargateNFT contract address is updated

---

### Backward Compatibility ♻️

* All existing Galaxy Member NFTs and their properties (token IDs, levels, B3TR donated) are preserved
* Existing storage mappings (`_nodeToTokenId`, `_tokenIdToNode`, `_nodeToFreeUpgradeLevel`) remain intact
* Token selection checkpoints maintained across upgrade
* Node attachment storage preserved (for migrated nodes)

---

## Upgrade `X2EarnApps` to Version `7`

Migrates X2EarnApps endorsement system from legacy NodeManagement infrastructure to Stargate NFT ecosystem, replacing NodeManagement contract dependencies with the unified StargateNFT contract for node verification and endorsement scoring.

---

### Changes 🚀

* **Upgraded Contract(s):**
  * `X2EarnApps.sol` to version `7`

* **Updated Modules:**
  * `EndorsementUpgradeable.sol` - Stargate NFT integration
  * `EndorsementUtils.sol` - Replaced NodeManagement calls with StargateNFT calls

---

### Storage Changes 📦

* **`EndorsementUpgradeable` (X2EarnApps Module)**:

  **➕ Added (V7)**

  * `_stargateNFT` (IStargateNFT) → Reference to the Stargate NFT contract for node management and endorsement validation

  **⚠️ Deprecated (Retained for Backward Compatibility)**

  * `_nodeManagementContract` (INodeManagementV3) → Legacy node management contract (no longer actively used but kept in storage)

---

### Library Changes 📚

* **`EndorsementUtils`**:

  **➕ Added Data Types (V7)**

  * `NodeStrengthLevel` enum → Local definition of node strength levels (replaces `VechainNodesDataTypes.NodeStrengthLevel`)
  * `NodeStrengthScores` struct → Local definition of node strength scores (replaces `VechainNodesDataTypes.NodeStrengthScores`)
  * `NodeSource` enum → Source identifier for nodes (None, VeChainNodes, StargateNFT)

  **🔄 Removed Dependencies**

  * Removed import of `VechainNodesDataTypes` from NodeManagement
  * Now self-contained with its own data type definitions

---

### New Features 🚀

* **`X2EarnApps`**:

  #### Stargate NFT Integration:

  **New Initializer:**
  - `initializeV7(address _stargateNft)` - Initializes V7 upgrade with Stargate NFT contract address

  **New Management Functions:**
  - `setStargateNFT(address _stargateNft)` - Allows the `DEFAULT_ADMIN_ROLE` to update the Stargate NFT contract address
  - `getStargateNFT()` - View function to retrieve the current Stargate NFT contract address

  **🗑️ Removed Functions:**
  - `setNodeManagementContract(address)`
  - `getNodeManagementContract()`

---

* **`EndorsementUpgradeable` Module**:

  #### Updated Core Functions:

  - `endorseApp()` - Now validates node management using `stargateNFT.isTokenManager()`
  - `unendorseApp()` - Now validates node management using `stargateNFT.isTokenManager()`
  - `getNodeEndorsementScore()` - Now retrieves node levels via `stargateNFT.getTokenLevel()`
  - `getUsersEndorsementScore()` - Now uses `stargateNFT` for score calculation
  - `getEndorsers()` - Now uses `stargateNFT` to retrieve endorser information

---

* **`EndorsementUtils` Library**:

  #### API Mapping Changes:
  ```
  Legacy (V6)                                  → Stargate (V7)
  ────────────────────────────────────────────────────────────────────────────
  nodeManagement.isNodeManager()              → stargateNFT.isTokenManager()
  nodeManagement.getNodeManager()             → stargateNFT.getTokenManager()
  nodeManagement.getNodeLevel()               → stargateNFT.getTokenLevel()
  nodeManagement.getUsersNodeLevels()         → stargateNFT.tokensManagedBy()
  VechainNodesDataTypes.NodeStrengthLevel     → EndorsementUtils.NodeStrengthLevel
  VechainNodesDataTypes.NodeStrengthScores    → EndorsementUtils.NodeStrengthScores
  ```

---

## Upgrade `B3TRGovernor` to Version `8` and `GrantsManager` to Version `2`

Introduces proposal development lifecycle tracking with dedicated states for in-development and completed proposals, enabling better governance visibility and management of proposal implementation status.

---

### Changes 🚀

- **Upgraded Contract(s):**
  - `B3TRGovernor.sol` to version `8`
  - `GrantsManager.sol` to version `2`

---

### Storage Changes 📦

- **`B3TRGovernor`**:

  **➕ Added (V8)**
  - `proposalDevelopmentState` → Mapping to track the development status of executed proposals (`proposalId => ProposalDevelopmentState`)
    - `PendingDevelopment`: Proposal is not in a development phase
    - `InDevelopment`: Development phase is in progress
    - `Completed`: Development phase is completed

  **🔐 New Role**
  - `PROPOSAL_STATE_MANAGER_ROLE` → Allows marking proposals as in development or completed

  **📦 Size Optimization**
  - Removed deprecated initializers (`initialize()`, `initializeV4()`, `initializeV7()`) to reduce contract size

---

### New Features 🚀

- **`B3TRGovernor`**:

  #### New Proposal States:
  - `InDevelopment` - Indicates proposal implementation is actively being developed
  - `Completed` - Indicates proposal implementation has been finished

  #### Key Functions Added:
  - `markAsInDevelopment(uint256 proposalId)` - Mark an executed/succeeded proposal as in development
  - `markAsCompleted(uint256 proposalId)` - Mark an in-development proposal as completed
  - `resetDevelopmentState(uint256 proposalId)` - Reset the development state of a proposal back to pending development

  #### State Transition Flow:

  ```
  Executed/Succeeded → InDevelopment → Completed
  ```

  #### Enhanced Cancel Logic:
  - Proposals in `InDevelopment`, `Completed`, `DepositNotMet`, or `Defeated` states **cannot** be canceled
  - Only `active`, `pending`, `queued`, or `succeeded` proposals can be canceled

---

- **`GrantsManager`**:

  #### Updated Functions:
  - `isGrantInDevelopment()` - Now considers `InDevelopment` and `Completed` states in addition to `Executed`
  - `isGrantCompleted()` - Now considers `InDevelopment` and `Completed` states in addition to `Executed`

  #### Integration:
  - Aligns with B3TRGovernor's new development state tracking
  - Milestone management reflects proposal development lifecycle

---

## Upgrade `XAllocationVoting` to Version `8`, `VoterRewards` to Version `6`, and introduce `RelayerRewardsPool` Version `1`

Added auto-voting functionality allowing users to enable automatic voting with predefined app preferences. Relayers perform voting/claiming actions during an early access period and receive proportional rewards from fees.

### Changes 🚀

- **Upgraded Contract(s):**
  - `XAllocationVoting.sol` to version `8`
  - `VoterRewards.sol` to version `6`
- **New Contract(s):**
  - `RelayerRewardsPool.sol` version `1`
- **New Modules/Libraries:**
  - `AutoVotingLogicUpgradeable.sol` module for XAllocationVoting
  - `AutoVotingLogic.sol` library with core auto-voting logic
  - `XAllocationVotingDataTypes.sol` library defining AutoVotingStorage struct

### Storage Changes 📦

- **`XAllocationVoting`**:
  - Added `AutoVotingLogicUpgradeable` module with `AutoVotingStorage` struct
  - Added `_autoVotingEnabled` checkpoints to track auto-voting status per user
  - Added `_userVotingPreferences` to store app preferences for auto-voting
  - Added `_totalAutoVotingUsers` checkpoints to track total users with auto-voting enabled

- **`VoterRewards`**:
  - Added `xAllocationVoting` to store XAllocationVoting contract address
  - Added `relayerRewardsPool` to store RelayerRewardsPool contract address

- **`RelayerRewardsPool`**:
  - `totalRewards` mapping to track rewards per round
  - `relayerActions` and `relayerWeightedActions` mappings for action tracking
  - `totalActions` and `totalWeightedActions` for expected actions per round
  - `completedActions` and `completedWeightedActions` for completed actions tracking
  - `claimed` mapping to prevent double claiming
  - `registeredRelayers` mapping and `relayerAddresses` array for relayer management
  - `voteWeight` and `claimWeight` for weighted action calculations
  - `earlyAccessBlocks` for early access period duration
  - `relayerFeePercentage`, `relayerFeeDenominator`, and `feeCap` for fee configuration

### New Features 🚀

- **`XAllocationVoting`**:
  - Added `toggleAutoVoting()` to enable/disable auto-voting
  - Added `setUserVotingPreferences()` to set app preferences (max 15 apps)
  - Added `isUserAutoVotingEnabled()` and timepoint-based variants for checking auto-voting status
  - Added `getUserVotingPreferences()` to query user preferences
  - Added `getTotalAutoVotingUsersAtRoundStart()` and timepoint-based variant
  - Auto-voting users have votes cast automatically by relayers during early access period

- **`AutoVotingLogic` library**:
  - Added `prepareAutoVoteArrays()` to filter eligible apps and calculate equal vote weights
  - Added validation logic for personhood, voting power (min 1 VOT3), and app preferences
  - Added duplicate app detection and app existence validation

- **`VoterRewards`**:
  - Added relayer fee calculation and deduction from rewards for auto-voting users
  - Added `claimReward()` integration with `RelayerRewardsPool` for fee distribution
  - Added `getRelayerFee()` to query fee amount
  - Added `setXAllocationVoting()` and `setRelayerRewardsPool()` for contract configuration
  - Added `initializeV6()` for contract upgrade initialization
  - Early access validation prevents auto-voting users from self-voting/claiming during early access

- **`RelayerRewardsPool`**:
  - Added `registerRelayer()` and `unregisterRelayer()` for relayer management
  - Added `setTotalActionsForRound()` to configure expected actions based on auto-voting users
  - Added `reduceExpectedActionsForRound()` to adjust for users unable to vote
  - Added `registerRelayerAction()` to track relayer actions with weighted scoring
  - Added `claimRewards()` for relayers to claim proportional rewards
  - Added `deposit()` for funding relayer rewards pool
  - Added `calculateRelayerFee()` to compute fee with cap
  - Added `validateVoteDuringEarlyAccess()` and `validateClaimDuringEarlyAccess()` for access control
  - Added `isVoteEarlyAccessActive()` and `isClaimEarlyAccessActive()` for period checking
  - Added `getMissedAutoVotingUsersCount()` to track missed users
  - Added configurable weights (`setVoteWeight()`, `setClaimWeight()`) for different action types
  - Added fee configuration functions (`setRelayerFeePercentage()`, `setFeeCap()`, etc.)
  - Added early access period configuration (`setEarlyAccessBlocks()`)
  - Added contract address setters for B3TR, Emissions, and XAllocationVoting

### Bug Fixes 🐛

- None.

---

## Upgrade `B3TRGovernor` to Version `7` and `XAllocationVoting` to Version `7`

Introduces grant proposal support with dedicated governance parameters, deposit-based voting power, and capped deposit thresholds.

Proposed changes for the following proposal:
["Change the rules to create and support governance proposals"](https://governance.vebetterdao.org/proposals/16456558618029822768724567372248444488437431846368752919370485354508180864756)

### Changes 🚀

- **Upgraded Contract(s):**
  - `B3TRGovernor.sol` to version `7`
  - `XAllocationVoting.sol` to version `7`

### Storage Changes 📦

- **`B3TRGovernor`**:

  **➕ Added (V7)**
  - `proposalType` → Stores the proposal type for each proposal.
  - `proposalTypeDepositThresholdPercentage` → Deposit threshold % per proposal type.
  - `proposalTypeVotingThreshold` → Voting threshold per proposal type.
  - `proposalTypeQuorum` → Quorum history checkpoints per proposal type.
  - `proposalTypeDepositThresholdCap` → Maximum deposit threshold per proposal type.
  - `requiredGMLevelByProposalType` → GM level requirement per proposal type.
  - `depositsVotingPower` → Checkpoints to track deposit-based voting power per user.

  **➖ Deprecated**
  - `depositThresholdPercentage` → Replaced by `proposalTypeDepositThresholdPercentage`.
  - `votingThreshold` → Replaced by `proposalTypeVotingThreshold`.
  - `deposits` → Updated to include proposal ID as first key (`proposalId => user => amount`) for deposit tracking per proposal.

  **📌 Reason for Deprecation**
  - Previous mappings were **global** and did not support proposal-type-specific governance.
  - V7 introduces **type-based governance** (Standard vs Grant), requiring **separate thresholds, quorums, and deposit tracking**.

### New Features 🚀

- **`B3TRGovernor`**:
  - Added `ProposalType.Grant` with dedicated governance parameters.
  - Added deposit-based voting power with checkpoint tracking (`depositsVotingPower`).
  - Implemented deposit threshold caps for standard and grant proposals.
  - Added proposal creation with type specification (`proposeGrant()`).
  - Added GM-level requirements per proposal type (`requiredGMLevelByProposalType`).
  - Integrated `GrantsManager` contract for grant proposals.

- **`XAllocationVoting`**:
  - Updated `_getVotingPower()` to include deposit-based voting power.
  - Added `getDepositVotingPower()` to query deposit-based voting power per user.

### Bug Fixes 🐛

- None.

---

## Upgrade `GalaxyMember` to version `5`, `NodeManagement` to version `3`

Use NodeManagementV3, avoid calls to legacy VeChain Nodes contract

### Changes 🚀

- **Upgraded Contract(s):**
  - `GalaxyMember.sol` to version `5`
  - `NodeManagement.sol` to version `3`

---

## Upgrade `Emissions` to version `3`, `GalaxyMember` to version `4`, `VoterRewards` to version `5`

Added new emissions pool called for GM rewards, that takes 25% of the treasury emissions each round. GM Holders will now be rewarded directly from this pool and GM multipliers are no longer taken into account for regular vote2Earn rewards.
<br>
Updated `XAllocationPool`, `XAllocationVoting` and `B3TRGovernor` to use versionlatest versions of `Emissions` and `VoterRewards`

### Changes 🚀

- **Upgraded Contract(s):**
  - `Emissions.sol` to version `3`
  - `GalaxyMember.sol` to version `4`
  - `VoterRewards.sol` to version `5`

### Storage Changes 📦

- **`Emissions`**:
  - Added `gmPercentage` to store percentage of the treasury that will be used for GM Holder Rewards.
  - Added `gmEmissions` to store GM emissions for each cycle.

- **`VoterRewards`**:
  - Added `cycleToTotalGMWeight` to store total GM Weight used for rewards in the cycle.
  - Added `cycleToVoterToGMWeight` to store total GM Weight used for rewards in the cycle.
  - Added `cycleToIncomingGMMultipliers` to store Incoming GM Multipliers, these are the multipliers that will be used for the next cycle.

### New Features 🚀

- **`Emissions`**:
  - `_calculateTreasuryAmount()` is now `_calculateTreasuryAndGMAmount()` and is used to calculate Treasury and GM Emissions for cycle.
  - Added `getGMAmount()` to get the GM Pool amount for cycle.
  - Added `gmPercentage()` to get the GM Percentage of the Treasury pool.
  - Updated `emissions()` to return GM pool too.
  - Added `setGmPercentage()` to update GM Percentage of the Treasury pool.

- **`Emissions`**:
  - Added `getGMReward()` to get the GM reward for a user for a cycle.
  - Added `cycleToVoterToGMWeight()` to get the total GM Weight for a user in a specific cycle.
  - Updated `cycleToTotalGMWeight()` to get the total GM Weight in a specific cycle.
  - Added `setLevelToMultiplierNow()` to update GM Multipliers on the spot.

### Bug Fixes 🐛

- None.

---

## Upgrade `X2EarnApps` to Version 5

### Key Updates 🗂

Restriction on creators who have already submitted an app. Any creator added to an xApp (via the `_addCreator` function) will be considered as someone who has already submitted an app, preventing them from creating multiple applications.

### Changes 🚀

- `x2EarnApps` updated to version `5`

### Storage Changes 📦

- None.

### New Features 🚀

- **`X2EarnApps`**:
  - Added `isCreatorOfAnyApp` check based on `_creatorApps[creator]` counter.
  - Added `CreatorNFTAlreadyUsed` error, trigger when a creator try to submit an app while having already submitted an app

### Bug Fixes 🐛

- None.

---

## Upgrade `VeBetterPassport` to Version 4

This upgrade adds a new role for signal reset functionality and improves access control for signaling functions. It also fixes an arithmetic underflow issue when resetting signals.

### Changes 🚀

- **Upgraded Contract(s):**
  - `VeBetterPassport.sol` to version `4`

### Storage Changes 📦

- None.

### New Features 🚀

- **`VeBetterPassport`**:
  - Added `RESET_SIGNALER_ROLE` initialization
  - Extended `resetUserSignalsWithReason` function to be used by the `RESET_SIGNALER_ROLE`
  - Restricted `signalUser` function to `DEFAULT_ADMIN_ROLE`
  - Restricted `signalUserWithReason` function to `SIGNALER_ROLE`
  - Renamed `resetUserSignalsByAppAdminWithReason` to `resetUserSignalsByAppWithReason` to be used by `SIGNALER_ROLE`
  - Added `initializeV4()` function to initialize the new role

### Bug Fixes 🐛

- **`VeBetterPassport`**:
  - Fixed arithmetic underflow when resetting signals, which could occur when app admin resets signal count after default admin in sequence

---

## Upgrade `X2EarnRewardsPool` to Version 6

This upgrade introduces the ability for XApps to include metadata in the reward distribution process, enabling richer and more context-specific information to be stored and emitted during events. A new function, `distributeRewardWithProofAndMetadata`, has been added for this purpose.

### Key Updates

- **Backward Compatibility Preserved**: The original `distributeRewardWithProof` function remains unchanged and continues to work as before for apps that do not wish to use metadata.
- **New Metadata Functionality**: The `distributeRewardWithProofAndMetadata` function accepts a string intended to be a JSON representation. A dedicated event, `RewardMetadata`, is emitted to store this information, following the established internal standards of `_emitProof`.

### Changes 🚀

- **Upgraded Contracts:**
  - `X2EarnRewardsPool.sol` updated to version `6`.

### Storage Changes 📦

- None.

### New Features 🚀

- **`X2EarnRewardsPool`:**
  - Added `distributeRewardWithProofAndMetadata()`, which accepts a string intended to be a JSON representation and emits a new event, `RewardMetadata`, containing this information.
  - Updated internal logic with `_emitMetadata`, following the `_emitProof` pattern, to emit the event with the JSON data.

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
