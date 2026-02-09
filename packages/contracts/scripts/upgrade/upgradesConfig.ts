export interface UpgradeContract {
  name: string
  configAddressField: string
  versions: readonly string[]
  descriptions: Record<string, string>
}

export const upgradeConfig: Record<string, UpgradeContract> = {
  "Voter Rewards": {
    name: "voter-rewards",
    configAddressField: "voterRewardsContractAddress",
    versions: ["v2", "v3", "v4", "v5", "v6"],
    descriptions: {
      v2: "Add the ability to toggle quadratic rewarding on and off.",
      v3: "Vechain Nodes x GM upgrades feature",
      v4: "Update GalaxyMember interface to use version 3",
      v5: "Proposal Execution: Add GM Pool for GM Holder Rewards",
      v6: "Integrate Auto-voting relayer rewards pool and fees",
    },
  },
  B3TRGovernor: {
    name: "b3tr-governor",
    versions: ["v2", "v3", "v4", "v5", "v6", "v7", "v8"],
    configAddressField: "b3trGovernorAddress",
    descriptions: {
      v2: "Give ability to contract admins to call governance only functions",
      v3: "Add the ability to toggle quadratic voting on and off.",
      v4: "Integrate VeBetterPassport contract",
      v5: "Vechain Nodes x GM upgrades feature",
      v6: "Proposal Execution: Add GM Pool for GM Holder Rewards (Align IVoterRwards)",
      v7: "Proposal Execution + Grants Feature: Add extra voting power based on support tokens + deposit threshold cap + proposal type concept",
      v8: "Give ability to mark proposals as in development/completed",
    },
  },
  XAllocationVoting: {
    name: "x-allocation-voting",
    configAddressField: "xAllocationVotingContractAddress",
    versions: ["v2", "v3", "v4", "v5", "v6", "v7", "v8"],
    descriptions: {
      v2: "Integrate VeBetterPassport contract",
      v3: "Update X2Earn interface to include new endorsement feature",
      v4: "Update X2Earn interface to include node cooldown feature",
      v5: "Fix casting votes multiple times for same app in single transaction",
      v6: "Proposal Execution: Add GM Pool for GM Holder Rewards (Align IVoterRwards and IEmissions)",
      v7: "Proposal Execution: Count proposal deposits to x-allocation voting power",
      v8: "Add Auto-Voting functionality",
    },
  },
  "XAllocation Pool": {
    name: "x-allocation-pool",
    configAddressField: "xAllocationPoolContractAddress",
    versions: ["v2", "v3", "v4", "v5", "v6", "v7"],
    descriptions: {
      v2: "Add the abilty to toggle quadratic funding on and off.",
      v3: "Update X2Earn interface to include new endorsement feature",
      v4: "Update X2Earn interface to include node cooldown feature",
      v5: "Updated X2EarnRewardsPool interface to support app rewards management feature",
      v6: "Proposal Execution: Add GM Pool for GM Holder Rewards (Align IEmissions)",
      v7: "Proposal Execution: Store unallocated funds for each round",
    },
  },
  X2EarnApps: {
    name: "x2-earn-apps",
    configAddressField: "x2EarnAppsContractAddress",
    versions: ["v2", "v3", "v4", "v5", "v6", "v7"],
    descriptions: {
      v2: "Add xapp endorsement module",
      v3: "Add node cooldown feature",
      v4: "Enabling by default the rewards pool for new apps submitted",
      v5: "Restricting one app per creator holding a creator NFT",
      v6: "Use NodeManagementV3",
      v7: "Replace NodeManagement with StargateNFT",
    },
  },
  "X2Earn Rewards Pool": {
    name: "x2-earn-rewards-pool",
    configAddressField: "x2EarnRewardsPoolContractAddress",
    versions: ["v2", "v3", "v4", "v5", "v6", "v7"],
    descriptions: {
      v2: "Add onchain impacts and proof generation",
      v3: "Integrate VeBetterPassport contract",
      v4: "Update X2Earn interface to include new endorsement feature",
      v5: "Update X2Earn interface to include node cooldown feature",
      v6: "Add onchain metadata for rewards",
      v7: "Add optional dual-pool balance to manage rewards and treasury separately",
    },
  },
  Emissions: {
    name: "emissions",
    configAddressField: "emissionsContractAddress",
    versions: ["v2", "v3"],
    descriptions: {
      v2: "Aligns the emissions with the expected B3TR emissions schedule",
      v3: "Proposal Execution: Add GM Pool for GM Holder Rewards",
    },
  },
  "VeBetter Passport": {
    name: "vebetter-passport",
    configAddressField: "veBetterPassportContractAddress",
    versions: ["v2", "v3", "v4"],
    descriptions: {
      v2: "Prevent delegation of passports to entities",
      v3: "Add GM level to personhood check",
      v4: "Add RESET_SIGNALER_ROLE, improve signaling management, and remove redundant app signal counters",
    },
  },
  "Galaxy Member": {
    name: "galaxy-member",
    configAddressField: "galaxyMemberContractAddress",
    versions: ["v2", "v3", "v4", "v5", "v6"],
    descriptions: {
      v2: "Vechain Nodes x GM upgrades feature",
      v3: "Add functions to checkpoint GM selection",
      v4: "Add event to emit GM Level when Node is Attached or Detached",
      v5: "Use NodeManagementV3, avoid calls to legacy VeChain Nodes contract",
      v6: "Replace NodeManagement with StargateNFT",
    },
  },
  "Node Management": {
    name: "node-management",
    configAddressField: "nodeManagementContractAddress",
    versions: ["v2"],
    descriptions: {
      v2: "Vechain Nodes x GM upgrades feature",
    },
  },
  "DBA Pool": {
    name: "dba-pool",
    configAddressField: "dbaPoolContractAddress",
    versions: ["v2"],
    descriptions: {
      v2: "Add tracking of DBA rewards per app per round and seed function for historical data",
    },
  },
  "Grants Manager": {
    name: "grants-manager",
    configAddressField: "grantsManagerContractAddress",
    versions: ["v2"],
    descriptions: {
      v2: "Align with B3TRGovernor v8 new proposal state management",
    },
  },
  "X2Earn Creator": {
    name: "x2-earn-creator",
    configAddressField: "x2EarnCreatorContractAddress",
    versions: ["v2"],
    descriptions: {
      v2: "Add self-minting functionality gated by admin-controlled flag",
    },
  },
} as const
