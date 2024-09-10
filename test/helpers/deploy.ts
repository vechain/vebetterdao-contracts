import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { ContractFactory, ContractTransactionResponse } from "ethers"
import { ethers } from "hardhat"
import {
  B3TR,
  TimeLock,
  VOT3,
  GalaxyMember,
  Emissions,
  XAllocationVoting,
  XAllocationPool,
  VoterRewards,
  Treasury,
  B3TRGovernor,
  X2EarnApps,
  GovernorClockLogic,
  GovernorConfigurator,
  GovernorDepositLogic,
  GovernorFunctionRestrictionsLogic,
  GovernorGovernanceLogic,
  GovernorProposalLogic,
  GovernorQuorumLogic,
  GovernorStateLogic,
  GovernorVotesLogic,
  X2EarnRewardsPool,
  MyERC721,
  MyERC1155,
  VoterRewardsV1,
  X2EarnRewardsPoolV1,
} from "../../typechain-types"
import { createLocalConfig } from "../../config/contracts/envs/local"
import { deployProxy, upgradeProxy } from "../../scripts/helpers"
import { setWhitelistedFunctions } from "../../scripts/deploy/deploy"
import { bootstrapAndStartEmissions as callBootstrapAndStartEmissions } from "./common"

interface DeployInstance {
  B3trContract: ContractFactory
  b3tr: B3TR & { deploymentTransaction(): ContractTransactionResponse }
  vot3: VOT3
  timeLock: TimeLock
  governor: B3TRGovernor
  galaxyMember: GalaxyMember
  x2EarnApps: X2EarnApps
  xAllocationVoting: XAllocationVoting
  xAllocationPool: XAllocationPool
  emissions: Emissions
  voterRewards: VoterRewards
  voterRewardsV1: VoterRewardsV1
  treasury: Treasury
  x2EarnRewardsPool: X2EarnRewardsPool
  owner: HardhatEthersSigner
  otherAccount: HardhatEthersSigner
  minterAccount: HardhatEthersSigner
  timelockAdmin: HardhatEthersSigner
  otherAccounts: HardhatEthersSigner[]
  governorClockLogicLib: GovernorClockLogic
  governorConfiguratorLib: GovernorConfigurator
  governorDepositLogicLib: GovernorDepositLogic
  governorFunctionRestrictionsLogicLib: GovernorFunctionRestrictionsLogic
  governorGovernanceLogicLib: GovernorGovernanceLogic
  governorProposalLogicLib: GovernorProposalLogic
  governorQuorumLogicLib: GovernorQuorumLogic
  governorStateLogicLib: GovernorStateLogic
  governorVotesLogicLib: GovernorVotesLogic
  myErc721: MyERC721 | undefined
  myErc1155: MyERC1155 | undefined
}

export const NFT_NAME = "GalaxyMember"
export const NFT_SYMBOL = "GM"
export const DEFAULT_MAX_MINTABLE_LEVEL = 1

// // Voter Rewards
export const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] // Galaxy Member contract levels
export const multipliers = [0, 10, 20, 50, 100, 150, 200, 400, 900, 2400] // Galaxy Member contract percentage multipliers (in basis points)

let cachedDeployInstance: DeployInstance | undefined = undefined
export const getOrDeployContractInstances = async ({
  forceDeploy = false,
  config = createLocalConfig(),
  maxMintableLevel = DEFAULT_MAX_MINTABLE_LEVEL,
  bootstrapAndStartEmissions = false,
  deployMocks = false,
}) => {
  if (!forceDeploy && cachedDeployInstance !== undefined) {
    return cachedDeployInstance
  }

  // Contracts are deployed using the first signer/account by default
  const [owner, otherAccount, minterAccount, timelockAdmin, ...otherAccounts] = await ethers.getSigners()

  // ---------------------- Deploy Libraries ----------------------
  // Deploy Governor Clock Logic
  const GovernorClockLogic = await ethers.getContractFactory("GovernorClockLogic")
  const GovernorClockLogicLib = await GovernorClockLogic.deploy()
  await GovernorClockLogicLib.waitForDeployment()

  // Deploy Governor Configurator
  const GovernorConfigurator = await ethers.getContractFactory("GovernorConfigurator")
  const GovernorConfiguratorLib = await GovernorConfigurator.deploy()
  await GovernorConfiguratorLib.waitForDeployment()

  // Deploy Governor Function Restrictions Logic
  const GovernorFunctionRestrictionsLogic = await ethers.getContractFactory("GovernorFunctionRestrictionsLogic")
  const GovernorFunctionRestrictionsLogicLib = await GovernorFunctionRestrictionsLogic.deploy()
  await GovernorFunctionRestrictionsLogicLib.waitForDeployment()

  // Deploy Governor Governance Logic
  const GovernorGovernanceLogic = await ethers.getContractFactory("GovernorGovernanceLogic")
  const GovernorGovernanceLogicLib = await GovernorGovernanceLogic.deploy()
  await GovernorGovernanceLogicLib.waitForDeployment()

  // Deploy Governor Quorum Logic
  const GovernorQuorumLogic = await ethers.getContractFactory("GovernorQuorumLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorQuorumLogicLib = await GovernorQuorumLogic.deploy()
  await GovernorQuorumLogicLib.waitForDeployment()

  // Deploy Governor Proposal Logic
  const GovernorProposalLogic = await ethers.getContractFactory("GovernorProposalLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorProposalLogicLib = await GovernorProposalLogic.deploy()
  await GovernorProposalLogicLib.waitForDeployment()

  // Deploy Governor Votes Logic
  const GovernorVotesLogic = await ethers.getContractFactory("GovernorVotesLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorVotesLogicLib = await GovernorVotesLogic.deploy()
  await GovernorVotesLogicLib.waitForDeployment()

  // Deploy Governor Deposit Logic
  const GovernorDepositLogic = await ethers.getContractFactory("GovernorDepositLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorDepositLogicLib = await GovernorDepositLogic.deploy()
  await GovernorDepositLogicLib.waitForDeployment()

  // Deploy Governor State Logic
  const GovernorStateLogic = await ethers.getContractFactory("GovernorStateLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorStateLogicLib = await GovernorStateLogic.deploy()
  await GovernorStateLogicLib.waitForDeployment()

  // ---------------------- Deploy Contracts ----------------------
  // Deploy B3TR
  const B3trContract = await ethers.getContractFactory("B3TR")
  const b3tr = await B3trContract.deploy(owner, minterAccount, owner)

  // Deploy VOT3
  const vot3 = (await deployProxy("VOT3", [
    owner.address,
    owner.address,
    owner.address,
    await b3tr.getAddress(),
  ])) as VOT3

  // Deploy TimeLock
  const timeLock = (await deployProxy("TimeLock", [
    config.TIMELOCK_MIN_DELAY, //0 seconds delay for immediate execution
    [],
    [],
    timelockAdmin.address,
    timelockAdmin.address,
  ])) as TimeLock

  // Deploy Treasury
  const treasury = (await deployProxy("Treasury", [
    await b3tr.getAddress(),
    await vot3.getAddress(),
    owner.address,
    owner.address,
    owner.address,
    owner.address,
    config.TREASURY_TRANSFER_LIMIT_VET,
    config.TREASURY_TRANSFER_LIMIT_B3TR,
    config.TREASURY_TRANSFER_LIMIT_VOT3,
    config.TREASURY_TRANSFER_LIMIT_VTHO,
  ])) as Treasury

  // Deploy GalaxyMember
  const galaxyMember = (await deployProxy("GalaxyMember", [
    {
      name: NFT_NAME,
      symbol: NFT_SYMBOL,
      admin: owner.address,
      upgrader: owner.address,
      pauser: owner.address,
      minter: owner.address,
      contractsAddressManager: owner.address,
      maxLevel: maxMintableLevel,
      baseTokenURI: config.GM_NFT_BASE_URI,
      b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
      b3tr: await b3tr.getAddress(),
      treasury: await treasury.getAddress(),
    },
  ])) as GalaxyMember

  // Deploy X2EarnApps
  const x2EarnApps = (await deployProxy("X2EarnApps", [
    "ipfs://",
    [await timeLock.getAddress(), owner.address],
    owner.address,
    owner.address,
  ])) as X2EarnApps

  const x2EarnRewardsPoolV1 = (await deployProxy("X2EarnRewardsPoolV1", [
    owner.address,
    owner.address,
    owner.address,
    await b3tr.getAddress(),
    await x2EarnApps.getAddress(),
  ])) as X2EarnRewardsPoolV1

  const x2EarnRewardsPool = (await upgradeProxy(
    "X2EarnRewardsPoolV1",
    "X2EarnRewardsPool",
    await x2EarnRewardsPoolV1.getAddress(),
    [owner.address, config.X_2_EARN_INITIAL_IMPACT_KEYS],
    {
      version: 2,
    },
  )) as X2EarnRewardsPool

  // Deploy XAllocationPool
  const xAllocationPool = (await deployProxy("XAllocationPool", [
    owner.address,
    owner.address,
    owner.address,
    await b3tr.getAddress(),
    await treasury.getAddress(),
    await x2EarnApps.getAddress(),
    await x2EarnRewardsPool.getAddress(),
  ])) as XAllocationPool

  const X_ALLOCATIONS_ADDRESS = await xAllocationPool.getAddress()
  const VOTE_2_EARN_ADDRESS = otherAccounts[1].address

  const emissions = (await deployProxy("Emissions", [
    {
      minter: minterAccount.address,
      admin: owner.address,
      upgrader: owner.address,
      contractsAddressManager: owner.address,
      decaySettingsManager: owner.address,
      b3trAddress: await b3tr.getAddress(),
      destinations: [X_ALLOCATIONS_ADDRESS, VOTE_2_EARN_ADDRESS, await treasury.getAddress(), config.MIGRATION_ADDRESS],
      initialXAppAllocation: config.INITIAL_X_ALLOCATION,
      cycleDuration: config.EMISSIONS_CYCLE_DURATION,
      decaySettings: [
        config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
        config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
        config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
        config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
      ],
      treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
      maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
      migrationAmount: config.MIGRATION_AMOUNT,
    },
  ])) as Emissions

  const voterRewardsV1 = (await deployProxy("VoterRewardsV1", [
    owner.address, // admin
    owner.address, // upgrader
    owner.address, // contractsAddressManager
    await emissions.getAddress(),
    await galaxyMember.getAddress(),
    await b3tr.getAddress(),
    levels,
    multipliers,
  ])) as VoterRewardsV1

  const voterRewards = (await upgradeProxy("VoterRewardsV1", "VoterRewards", await voterRewardsV1.getAddress(), [], {
    version: 2,
  })) as VoterRewards

  // Set vote 2 earn (VoterRewards deployed contract) address in emissions
  await emissions.connect(owner).setVote2EarnAddress(await voterRewards.getAddress())

  // Deploy XAllocationVoting
  const xAllocationVoting = (await deployProxy("XAllocationVoting", [
    {
      vot3Token: await vot3.getAddress(),
      quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE, // quorum percentage
      initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1, // X Alloc voting period
      timeLock: await timeLock.getAddress(),
      voterRewards: await voterRewards.getAddress(),
      emissions: await emissions.getAddress(),
      admins: [await timeLock.getAddress(), owner.address],
      upgrader: owner.address,
      contractsAddressManager: owner.address,
      x2EarnAppsAddress: await x2EarnApps.getAddress(),
      baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
      appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
      votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
    },
  ])) as XAllocationVoting

  // Deploy Governor
  const governor = (await deployProxy(
    "B3TRGovernor",
    [
      {
        vot3Token: await vot3.getAddress(),
        timelock: await timeLock.getAddress(),
        xAllocationVoting: await xAllocationVoting.getAddress(),
        b3tr: await b3tr.getAddress(),
        quorumPercentage: config.B3TR_GOVERNOR_QUORUM_PERCENTAGE, // quorum percentage
        initialDepositThreshold: config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD, // deposit threshold
        initialMinVotingDelay: config.B3TR_GOVERNOR_MIN_VOTING_DELAY, // delay before vote starts
        initialVotingThreshold: config.B3TR_GOVERNOR_VOTING_THRESHOLD, // voting threshold
        voterRewards: await voterRewards.getAddress(),
        isFunctionRestrictionEnabled: true,
      },
      {
        governorAdmin: owner.address,
        pauser: owner.address,
        contractsAddressManager: owner.address,
        proposalExecutor: owner.address,
        governorFunctionSettingsRoleAddress: owner.address,
      },
    ],
    {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
      GovernorConfigurator: await GovernorConfiguratorLib.getAddress(),
      GovernorDepositLogic: await GovernorDepositLogicLib.getAddress(),
      GovernorFunctionRestrictionsLogic: await GovernorFunctionRestrictionsLogicLib.getAddress(),
      GovernorProposalLogic: await GovernorProposalLogicLib.getAddress(),
      GovernorQuorumLogic: await GovernorQuorumLogicLib.getAddress(),
      GovernorStateLogic: await GovernorStateLogicLib.getAddress(),
      GovernorVotesLogic: await GovernorVotesLogicLib.getAddress(),
    },
  )) as B3TRGovernor

  const contractAddresses: Record<string, string> = {
    B3TR: await b3tr.getAddress(),
    VoterRewards: await voterRewards.getAddress(),
    Treasury: await treasury.getAddress(),
    XAllocationVoting: await xAllocationVoting.getAddress(),
    Emissions: await emissions.getAddress(),
    GalaxyMember: await galaxyMember.getAddress(),
    TimeLock: await timeLock.getAddress(),
    VOT3: await vot3.getAddress(),
    XAllocationPool: await xAllocationPool.getAddress(),
    B3TRGovernor: await governor.getAddress(),
    X2EarnApps: await x2EarnApps.getAddress(),
  }

  const libraries = {
    B3TRGovernor: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
      GovernorConfigurator: await GovernorConfiguratorLib.getAddress(),
      GovernorDepositLogic: await GovernorDepositLogicLib.getAddress(),
      GovernorFunctionRestrictionsLogic: await GovernorFunctionRestrictionsLogicLib.getAddress(),
      GovernorProposalLogic: await GovernorProposalLogicLib.getAddress(),
      GovernorQuorumLogic: await GovernorQuorumLogicLib.getAddress(),
      GovernorStateLogic: await GovernorStateLogicLib.getAddress(),
      GovernorVotesLogic: await GovernorVotesLogicLib.getAddress(),
    },
  }

  await setWhitelistedFunctions(contractAddresses, config, governor, owner, libraries) // Set whitelisted functions for governor proposals

  // Set up roles
  const PROPOSER_ROLE = await timeLock.PROPOSER_ROLE()
  const EXECUTOR_ROLE = await timeLock.EXECUTOR_ROLE()
  const CANCELLER_ROLE = await timeLock.CANCELLER_ROLE()
  await timeLock.connect(timelockAdmin).grantRole(PROPOSER_ROLE, await governor.getAddress())
  await timeLock.connect(timelockAdmin).grantRole(EXECUTOR_ROLE, await governor.getAddress())
  await timeLock.connect(timelockAdmin).grantRole(CANCELLER_ROLE, await governor.getAddress())

  // Set xAllocationVoting and Governor address in GalaxyMember
  await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
  await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())

  // Grant Vote registrar role to XAllocationVoting
  await voterRewards
    .connect(owner)
    .grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await xAllocationVoting.getAddress())
  // Grant Vote registrar role to Governor
  await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await governor.getAddress())

  // Grant admin role to voter rewards for registering x allocation voting
  await xAllocationVoting.connect(owner).grantRole(await xAllocationVoting.DEFAULT_ADMIN_ROLE(), emissions.getAddress())

  // Set xAllocationGovernor in emissions
  await emissions.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

  // Setup XAllocationPool addresses
  await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())
  await xAllocationPool.connect(owner).setEmissionsAddress(await emissions.getAddress())

  //Set the emissions address and the admin as the ROUND_STARTER_ROLE in XAllocationVoting
  const roundStarterRole = await xAllocationVoting.ROUND_STARTER_ROLE()
  await xAllocationVoting
    .connect(owner)
    .grantRole(roundStarterRole, await emissions.getAddress())
    .then(async tx => await tx.wait())
  await xAllocationVoting
    .connect(owner)
    .grantRole(roundStarterRole, owner.address)
    .then(async tx => await tx.wait())

  // Bootstrap and start emissions
  if (bootstrapAndStartEmissions) {
    await callBootstrapAndStartEmissions()
  }

  // deploy Mocks
  let myErc1155, myErc721
  if (deployMocks) {
    const MyERC721 = await ethers.getContractFactory("MyERC721")
    myErc721 = await MyERC721.deploy(owner.address)
    await myErc721.waitForDeployment()

    const MyERC1155 = await ethers.getContractFactory("MyERC1155")
    myErc1155 = await MyERC1155.deploy(owner.address)
    await myErc1155.waitForDeployment()
  }

  cachedDeployInstance = {
    B3trContract,
    b3tr,
    vot3,
    timeLock,
    governor,
    galaxyMember,
    x2EarnApps,
    xAllocationVoting,
    xAllocationPool,
    emissions,
    voterRewards,
    voterRewardsV1,
    owner,
    otherAccount,
    minterAccount,
    timelockAdmin,
    otherAccounts,
    treasury,
    x2EarnRewardsPool,
    governorClockLogicLib: GovernorClockLogicLib,
    governorConfiguratorLib: GovernorConfiguratorLib,
    governorDepositLogicLib: GovernorDepositLogicLib,
    governorFunctionRestrictionsLogicLib: GovernorFunctionRestrictionsLogicLib,
    governorGovernanceLogicLib: GovernorGovernanceLogicLib,
    governorProposalLogicLib: GovernorProposalLogicLib,
    governorQuorumLogicLib: GovernorQuorumLogicLib,
    governorStateLogicLib: GovernorStateLogicLib,
    governorVotesLogicLib: GovernorVotesLogicLib,
    myErc721: myErc721,
    myErc1155: myErc1155,
  }
  return cachedDeployInstance
}
