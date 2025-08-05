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
    versions: ["v2", "v3", "v4", "v5"],
    descriptions: {
      v2: "Add the ability to toggle quadratic rewarding on and off.",
      v3: "Vechain Nodes x GM upgrades feature",
      v4: "Update GalaxyMember interface to use version 3",
      v5: "Proposal Execution: Add GM Pool for GM Holder Rewards",
    },
  },
  B3TRGovernor: {
    name: "b3tr-governor",
    versions: ["v2", "v3", "v4", "v5", "v6"],
    configAddressField: "b3trGovernorAddress",
    descriptions: {
      v2: "Give ability to contract admins to call governance only functions",
      v3: "Add the ability to toggle quadratic voting on and off.",
      v4: "Integrate VeBetterPassport contract",
      v5: "Vechain Nodes x GM upgrades feature",
      v6: "Proposal Execution: Add GM Pool for GM Holder Rewards (Align IVoterRwards)",
    },
  },
  XAllocationVoting: {
    name: "x-allocation-voting",
    configAddressField: "xAllocationVotingContractAddress",
    versions: ["v2", "v3", "v4", "v5", "v6"],
    descriptions: {
      v2: "Integrate VeBetterPassport contract",
      v3: "Update X2Earn interface to include new endorsement feature",
      v4: "Update X2Earn interface to include node cooldown feature",
      v5: "Fix casting votes multiple times for same app in single transaction",
      v6: "Proposal Execution: Add GM Pool for GM Holder Rewards (Align IVoterRwards and IEmissions)",
    },
  },
  "XAllocation Pool": {
    name: "x-allocation-pool",
    configAddressField: "xAllocationPoolContractAddress",
    versions: ["v2", "v3", "v4", "v5", "v6"],
    descriptions: {
      v2: "Add the abilty to toggle quadratic funding on and off.",
      v3: "Update X2Earn interface to include new endorsement feature",
      v4: "Update X2Earn interface to include node cooldown feature",
      v5: "Updated X2EarnRewardsPool interface to support app rewards management feature",
      v6: "Proposal Execution: Add GM Pool for GM Holder Rewards (Align IEmissions)",
    },
  },
  X2EarnApps: {
    name: "x2-earn-apps",
    configAddressField: "x2EarnAppsContractAddress",
    versions: ["v2", "v3", "v4", "v5"],
    descriptions: {
      v2: "Add xapp endorsement module",
      v3: "Add node cooldown feature",
      v4: "Enabling by default the rewards pool for new apps submitted",
      v5: "Restricting one app per creator holding a creator NFT",
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
    versions: ["v2", "v3", "v4"],
    descriptions: {
      v2: "Vechain Nodes x GM upgrades feature",
      v3: "Add functions to checkpoint GM selection",
      v4: "Add event to emit GM Level when Node is Attached or Detached",
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
} as const
