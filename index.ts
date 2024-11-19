import mainnetAddresses from "./addresses/mainnet.json"
import testnetAddresses from "./addresses/testnet.json"

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
  NodeManagement__factory,
  X2EarnCreator__factory,
  VeBetterPassport__factory,
} from "./typechain-types"

export const B3TR = {
  abi: B3TR__factory.abi,
  address: {
    mainnet: mainnetAddresses.B3TR,
    testnet: testnetAddresses.B3TR,
  },
  interface: B3TR__factory.createInterface(),
}
export const B3TRGovernor = {
  abi: B3TRGovernor__factory.abi,
  address: {
    mainnet: mainnetAddresses.B3TRGovernor,
    testnet: testnetAddresses.B3TRGovernor,
  },
  interface: B3TRGovernor__factory.createInterface(),
}
export const Emissions = {
  abi: Emissions__factory.abi,
  address: {
    mainnet: mainnetAddresses.Emissions,
    testnet: testnetAddresses.Emissions,
  },
  interface: Emissions__factory.createInterface(),
}
export const GalaxyMember = {
  abi: GalaxyMember__factory.abi,
  address: {
    mainnet: mainnetAddresses.GalaxyMember,
    testnet: testnetAddresses.GalaxyMember,
  },
  interface: GalaxyMember__factory.createInterface(),
}
export const TimeLock = {
  abi: TimeLock__factory.abi,
  address: {
    mainnet: mainnetAddresses.TimeLock,
    testnet: testnetAddresses.TimeLock,
  },
  interface: TimeLock__factory.createInterface(),
}
export const Treasury = {
  abi: Treasury__factory.abi,
  address: {
    mainnet: mainnetAddresses.Treasury,
    testnet: testnetAddresses.Treasury,
  },
  interface: Treasury__factory.createInterface(),
}
export const VOT3 = {
  abi: VOT3__factory.abi,
  address: {
    mainnet: mainnetAddresses.VOT3,
    testnet: testnetAddresses.VOT3,
  },
  interface: VOT3__factory.createInterface(),
}
export const VoterRewards = {
  abi: VoterRewards__factory.abi,
  address: {
    mainnet: mainnetAddresses.VoterRewards,
    testnet: testnetAddresses.VoterRewards,
  },
  interface: VoterRewards__factory.createInterface(),
}
export const X2EarnApps = {
  abi: X2EarnApps__factory.abi,
  address: {
    mainnet: mainnetAddresses.X2EarnApps,
    testnet: testnetAddresses.X2EarnApps,
  },
  interface: X2EarnApps__factory.createInterface(),
}
export const X2EarnRewardsPool = {
  abi: X2EarnRewardsPool__factory.abi,
  address: {
    mainnet: mainnetAddresses.X2EarnRewardsPool,
    testnet: testnetAddresses.X2EarnRewardsPool,
  },
  interface: X2EarnRewardsPool__factory.createInterface(),
}
export const XAllocationPool = {
  abi: XAllocationPool__factory.abi,
  address: {
    mainnet: mainnetAddresses.XAllocationPool,
    testnet: testnetAddresses.XAllocationPool,
  },
  interface: XAllocationPool__factory.createInterface(),
}
export const XAllocationVoting = {
  abi: XAllocationVoting__factory.abi,
  address: {
    mainnet: mainnetAddresses.XAllocationVoting,
    testnet: testnetAddresses.XAllocationVoting,
  },
  interface: XAllocationVoting__factory.createInterface(),
}
export const NodeManagement = {
  abi: NodeManagement__factory.abi,
  address: {
    mainnet: mainnetAddresses.NodeManagement,
    testnet: testnetAddresses.NodeManagement,
  },
  interface: NodeManagement__factory.createInterface(),
}
export const X2EarnCreator = {
  abi: X2EarnCreator__factory.abi,
  address: {
    mainnet: mainnetAddresses.X2EarnCreator,
    testnet: testnetAddresses.X2EarnCreator,
  },
  interface: X2EarnCreator__factory.createInterface(),
} 
export const VeBetterPassport = {
  abi: VeBetterPassport__factory.abi,
  address: {
    mainnet: mainnetAddresses.VeBetterPassport,
    testnet: testnetAddresses.VeBetterPassport,
  },
  interface: VeBetterPassport__factory.createInterface(),
}
