import {
  B3TR__factory,
  B3TRGovernor__factory,
  Emissions__factory,
  GalaxyMember__factory,
  TimeLock__factory,
  Treasury__factory,
  VOT3__factory,
  VoterRewards__factory,
  X2EarnApps__factory,
  X2EarnRewardsPool__factory,
  XAllocationPool__factory,
  XAllocationVoting__factory,
} from "./typechain-types"

import mainnetAddresses from "./addresses/mainnet.json"

export const B3TR = { abi: B3TR__factory.abi, address: mainnetAddresses.B3TR }
export const B3TRGovernor = { abi: B3TRGovernor__factory.abi, address: mainnetAddresses.B3TRGovernor }
export const Emissions = { abi: Emissions__factory.abi, address: mainnetAddresses.Emissions }
export const GalaxyMember = { abi: GalaxyMember__factory.abi, address: mainnetAddresses.GalaxyMember }
export const TimeLock = { abi: TimeLock__factory.abi, address: mainnetAddresses.TimeLock }
export const Treasury = { abi: Treasury__factory.abi, address: mainnetAddresses.Treasury }
export const VOT3 = { abi: VOT3__factory.abi, address: mainnetAddresses.VOT3 }
export const VoterRewards = { abi: VoterRewards__factory.abi, address: mainnetAddresses.VoterRewards }
export const X2EarnApps = { abi: X2EarnApps__factory.abi, address: mainnetAddresses.X2EarnApps }
export const X2EarnRewardsPool = { abi: X2EarnRewardsPool__factory.abi, address: mainnetAddresses.X2EarnRewardsPool }
export const XAllocationPool = { abi: XAllocationPool__factory.abi, address: mainnetAddresses.XAllocationPool }
export const XAllocationVoting = { abi: XAllocationVoting__factory.abi, address: mainnetAddresses.XAllocationVoting }
