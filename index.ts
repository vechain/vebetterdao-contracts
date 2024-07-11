import mainnetAddresses from "./addresses/mainnet.json"

import {
  VOT3__factory,
  VoterRewards__factory,
  B3TR__factory,
  GalaxyMember__factory,
  Emissions__factory,
  B3TRGovernor__factory,
  TimeLock__factory,
  XAllocationPool__factory,
  XAllocationVoting__factory,
  X2EarnRewardsPool__factory,
  X2EarnApps__factory,
  Treasury__factory,
} from "./typechain-types"

export const B3TR = {
  abi: B3TR__factory.abi,
  address: mainnetAddresses.B3TR,
  interface: B3TR__factory.createInterface(),
}
export const B3TRGovernor = {
  abi: B3TRGovernor__factory.abi,
  address: mainnetAddresses.B3TRGovernor,
  interface: B3TRGovernor__factory.createInterface(),
}
export const Emissions = {
  abi: Emissions__factory.abi,
  address: mainnetAddresses.Emissions,
  interface: Emissions__factory.createInterface(),
}
export const GalaxyMember = {
  abi: GalaxyMember__factory.abi,
  address: mainnetAddresses.GalaxyMember,
  interface: GalaxyMember__factory.createInterface(),
}
export const TimeLock = {
  abi: TimeLock__factory.abi,
  address: mainnetAddresses.TimeLock,
  interface: TimeLock__factory.createInterface(),
}
export const Treasury = {
  abi: Treasury__factory.abi,
  address: mainnetAddresses.Treasury,
  interface: Treasury__factory.createInterface(),
}
export const VOT3 = {
  abi: VOT3__factory.abi,
  address: mainnetAddresses.VOT3,
  interface: VOT3__factory.createInterface(),
}
export const VoterRewards = {
  abi: VoterRewards__factory.abi,
  address: mainnetAddresses.VoterRewards,
  interface: VoterRewards__factory.createInterface(),
}
export const X2EarnApps = {
  abi: X2EarnApps__factory.abi,
  address: mainnetAddresses.X2EarnApps,
  interface: X2EarnApps__factory.createInterface(),
}
export const X2EarnRewardsPool = {
  abi: X2EarnRewardsPool__factory.abi,
  address: mainnetAddresses.X2EarnRewardsPool,
  interface: X2EarnRewardsPool__factory.createInterface(),
}
export const XAllocationPool = {
  abi: XAllocationPool__factory.abi,
  address: mainnetAddresses.XAllocationPool,
  interface: XAllocationPool__factory.createInterface(),
}
export const XAllocationVoting = {
  abi: XAllocationVoting__factory.abi,
  address: mainnetAddresses.XAllocationVoting,
  interface: XAllocationVoting__factory.createInterface(),
}
