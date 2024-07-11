import B3TRAbi from "./abis/B3TR.json"
import B3TRGovernorAbi from "./abis/B3TRGovernor.json"
import EmissionsAbi from "./abis/Emissions.json"
import GalaxyMemberAbi from "./abis/GalaxyMember.json"
import TimeLockAbi from "./abis/TimeLock.json"
import TreasuryAbi from "./abis/Treasury.json"
import VOT3Abi from "./abis/VOT3.json"
import VoterRewardsAbi from "./abis/VoterRewards.json"
import X2EarnAppsAbi from "./abis/X2EarnApps.json"
import X2EarnRewardsPoolAbi from "./abis/X2EarnRewardsPool.json"
import XAllocationPoolAbi from "./abis/XAllocationPool.json"
import XAllocationVotingAbi from "./abis/XAllocationVoting.json"

import mainnetAddresses from "./addresses/mainnet.json"

export {
  VOT3__factory,
  VoterRewards__factory,
  B3TR__factory,
  GalaxyMember__factory,
  Emissions__factory,
  B3TRGovernor__factory,
  TimeLock__factory,
  XAllocationPool__factory,
  XAllocationVoting__factory,
  XAllocationVotingGovernor__factory,
  X2EarnApps__factory,
  Treasury__factory,
} from "./typechain-types"

export const B3TR = { abi: B3TRAbi, mainnet: mainnetAddresses.B3TR }
export const B3TRGovernor = { abi: B3TRGovernorAbi, mainnet: mainnetAddresses.B3TRGovernor }
export const Emissions = { abi: EmissionsAbi, mainnet: mainnetAddresses.Emissions }
export const GalaxyMember = { abi: GalaxyMemberAbi, mainnet: mainnetAddresses.GalaxyMember }
export const TimeLock = { abi: TimeLockAbi, mainnet: mainnetAddresses.TimeLock }
export const Treasury = { abi: TreasuryAbi, mainnet: mainnetAddresses.Treasury }
export const VOT3 = { abi: VOT3Abi, mainnet: mainnetAddresses.VOT3 }
export const VoterRewards = { abi: VoterRewardsAbi, mainnet: mainnetAddresses.VoterRewards }
export const X2EarnApps = { abi: X2EarnAppsAbi, mainnet: mainnetAddresses.X2EarnApps }
export const X2EarnRewardsPool = { abi: X2EarnRewardsPoolAbi, mainnet: mainnetAddresses.X2EarnRewardsPool }
export const XAllocationPool = { abi: XAllocationPoolAbi, mainnet: mainnetAddresses.XAllocationPool }
export const XAllocationVoting = { abi: XAllocationVotingAbi, mainnet: mainnetAddresses.XAllocationVoting }
