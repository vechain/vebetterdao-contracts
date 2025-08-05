export interface CallInfo {
  file: string
  name: string
  contractName: string
  configAddressField: string
  description: string
}

export const functionConfig: Record<string, CallInfo> = {
  "Set B3TR cost to upgrade GMs": {
    file: "b3tr-to-upgrade-gm",
    name: "setB3TRtoUpgradeToLevel()",
    contractName: "GalaxyMember",
    configAddressField: "galaxyMemberContractAddress",
    description: "Proposal Execution: Reduce the cost to upgrade GM by 50%",
  },
} as const
