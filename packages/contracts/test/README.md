# Smart Contract Tests

Each test describe block is marked with a shard name. This is needed to split large test suites into smaller, parallel runs for faster CI execution and to prevent timeouts.

## Active Shards

All active shards are listed in `.github/workflows/unit-tests.yml`.

## Shard Assignments

- **shard0**: B3TR Token, B3TR Multi Sig
- **shard2**: Emissions
- **shard3a**: Galaxy Member
- **shard3b**: Galaxy Member - V6 Upgrade
- **shard3c**: Galaxy Member - V6 Compatibility
- **shard4a**: Governance - Governor and TimeLock
- **shard4b**: Governance - Voting power with proposal deposit
- **shard4c**: Governance - Milestone Creation
- **shard4d**: Governance - Proposer Requirement
- **shard4e**: Governance - V7 Compatibility & Thresholds
- **shard4f**: Governance - V7 Upgrade
- **shard4g**: Governance - V8 Upgrade
- **shard4h**: Governance - V8 Compatibility
- **shard4i**: Governance - Grants Manager V2 Upgrade
- **shard4j**: Governance - Grants Manager V2 Compatibility
- **shard6**: TimeLock
- **shard7**: Treasury
- **shard7b**: Dynamic Base Allocation Pool
- **shard8-core**: VeBetterPassport - Core (Contract parameters, Checks, Configurator, Clock)
- **shard8a**: VeBetterPassport - Upgrade
- **shard8b**: VeBetterPassport - Signaling
- **shard8c**: VeBetterPassport - Reset Signal Count
- **shard8d**: VeBetterPassport - Upgrades
- **shard8e**: VeBetterPassport - Entities
- **shard8f**: VeBetterPassport - Delegation
- **shard9**: VOT3
- **shard10-core**: VoterRewards
- **shard10a**: VoterRewards - Upgrade
- **shard10b**: VoterRewards - Relayer Claim Rewards
- **shard11**: X2EarnCreator
- **shard12**: X2EarnRewardsPool
- **shard13**: X-Allocation Pool
- **shard14-core**: X-Allocation Voting
- **shard14a**: X-Allocation Voting - Upgrade
- **shard14b**: X-Allocation Voting - Auto Voting
- **shard15a**: X-Apps - Core Features
- **shard15b**: X-Apps - Team Management
- **shard15c**: X-Apps - Metadata and Endorsement
- **shard15d**: X-Apps - V7 Upgrade
- **shard15e**: X-Apps - Upgradeability
- **shard15f**: X-Apps - V8 Upgrade
- **shard15g**: X-Apps - EndorsementUtils Coverage
- **shard16-pop**: VeBetterPassport - PoP Score
- **shard16a**: VeBetterPassport - Whitelisting
- **shard16b**: VeBetterPassport - GM & Governance
- **shard17a**: X-Apps (additional tests)
- **shard17b**: X-Apps (additional tests)
- **shard18**: RelayerRewardsPool

When adding new tests, assign them to an appropriate shard to maintain balanced execution times across all shards.
