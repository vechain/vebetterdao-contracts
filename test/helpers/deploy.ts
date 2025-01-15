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
  X2EarnApps,
  GovernorClockLogicV1,
  GovernorConfiguratorV1,
  GovernorDepositLogicV1,
  GovernorFunctionRestrictionsLogicV1,
  GovernorProposalLogicV1,
  GovernorQuorumLogicV1,
  GovernorStateLogicV1,
  GovernorVotesLogicV1,
  X2EarnRewardsPool,
  MyERC721,
  MyERC1155,
  TokenAuction,
  XAllocationPoolV1,
  X2EarnRewardsPoolV1,
  XAllocationVotingV1,
  B3TRGovernor,
  NodeManagement,
  B3TRGovernorV1,
  B3TRGovernorV2,
  VoterRewardsV1,
  GovernorClockLogic,
  GovernorConfigurator,
  GovernorDepositLogic,
  GovernorFunctionRestrictionsLogic,
  GovernorProposalLogic,
  GovernorQuorumLogic,
  GovernorStateLogic,
  GovernorVotesLogic,
  EmissionsV1,
  VeBetterPassport,
  B3TRGovernorV3,
  GovernorClockLogicV3,
  GovernorConfiguratorV3,
  GovernorFunctionRestrictionsLogicV3,
  GovernorProposalLogicV3,
  GovernorDepositLogicV3,
  GovernorQuorumLogicV3,
  GovernorVotesLogicV3,
  GovernorStateLogicV3,
  PassportChecksLogic,
  PassportEntityLogic,
  PassportPoPScoreLogic,
  PassportSignalingLogic,
  PassportWhitelistAndBlacklistLogic,
  PassportPersonhoodLogic,
  PassportDelegationLogic,
  X2EarnRewardsPoolV2,
  X2EarnRewardsPoolV3,
  PassportChecksLogicV1,
  PassportDelegationLogicV1,
  PassportEntityLogicV1,
  PassportPersonhoodLogicV1,
  PassportPoPScoreLogicV1,
  PassportSignalingLogicV1,
  PassportWhitelistAndBlacklistLogicV1,
  VeBetterPassportV1,
  PassportConfiguratorV1,
  AdministrationUtils,
  VoteEligibilityUtils,
  EndorsementUtils,
  X2EarnCreator,
  NodeManagementV1,
  VeBetterPassportV2,
  PassportConfiguratorV2,
  PassportWhitelistAndBlacklistLogicV2,
  PassportPoPScoreLogicV2,
  PassportPersonhoodLogicV2,
  PassportEntityLogicV2,
  PassportDelegationLogicV2,
  PassportChecksLogicV2,
  PassportSignalingLogicV2,
  VoterRewardsV3,
  AdministrationUtilsV2,
  EndorsementUtilsV2,
  VoteEligibilityUtilsV2,
} from "../../typechain-types"
import { createLocalConfig } from "../../config/contracts/envs/local"
import { deployAndUpgrade, deployProxy, deployProxyOnly, initializeProxy, upgradeProxy } from "../../scripts/helpers"
import { bootstrapAndStartEmissions as callBootstrapAndStartEmissions } from "./common"
import { governanceLibraries, passportLibraries } from "../../scripts/libraries"
import { setWhitelistedFunctions } from "../../scripts/deploy/deploy"
import { B3TRGovernorV4 } from "../../typechain-types/contracts/deprecated/V4"
import { VoterRewardsV2 } from "../../typechain-types/contracts/deprecated/V2/VoterRewardsV2"
import {
  GovernorClockLogicV4,
  GovernorConfiguratorV4,
  GovernorDepositLogicV4,
  GovernorFunctionRestrictionsLogicV4,
  GovernorProposalLogicV4,
  GovernorQuorumLogicV4,
  GovernorStateLogicV4,
  GovernorVotesLogicV4,
} from "../../typechain-types/contracts/deprecated/V4/governance/libraries"
import { x2EarnLibraries } from "../../scripts/libraries/x2EarnLibraries"

interface DeployInstance {
  B3trContract: ContractFactory
  b3tr: B3TR & { deploymentTransaction(): ContractTransactionResponse }
  vot3: VOT3
  timeLock: TimeLock
  governor: B3TRGovernor
  governorV1: B3TRGovernorV1
  governorV2: B3TRGovernorV2
  governorV3: B3TRGovernorV3
  governorV4: B3TRGovernorV4
  galaxyMember: GalaxyMember
  x2EarnApps: X2EarnApps
  xAllocationVoting: XAllocationVoting
  xAllocationPool: XAllocationPool
  emissions: Emissions
  voterRewards: VoterRewards
  voterRewardsV1: VoterRewardsV1
  treasury: Treasury
  nodeManagement: NodeManagement
  x2EarnCreator: X2EarnCreator
  x2EarnRewardsPool: X2EarnRewardsPool
  veBetterPassport: VeBetterPassport
  owner: HardhatEthersSigner
  otherAccount: HardhatEthersSigner
  minterAccount: HardhatEthersSigner
  timelockAdmin: HardhatEthersSigner
  otherAccounts: HardhatEthersSigner[]
  governorClockLogicLib: GovernorClockLogic
  governorConfiguratorLib: GovernorConfigurator
  governorDepositLogicLib: GovernorDepositLogic
  governorFunctionRestrictionsLogicLib: GovernorFunctionRestrictionsLogic
  governorProposalLogicLib: GovernorProposalLogic
  governorQuorumLogicLib: GovernorQuorumLogic
  governorStateLogicLib: GovernorStateLogic
  governorVotesLogicLib: GovernorVotesLogic
  governorClockLogicLibV1: GovernorClockLogicV1
  governorConfiguratorLibV1: GovernorConfiguratorV1
  governorDepositLogicLibV1: GovernorDepositLogicV1
  governorFunctionRestrictionsLogicLibV1: GovernorFunctionRestrictionsLogicV1
  governorProposalLogicLibV1: GovernorProposalLogicV1
  governorQuorumLogicLibV1: GovernorQuorumLogicV1
  governorStateLogicLibV1: GovernorStateLogicV1
  governorVotesLogicLibV1: GovernorVotesLogicV1
  governorClockLogicLibV3: GovernorClockLogicV3
  governorConfiguratorLibV3: GovernorConfiguratorV3
  governorDepositLogicLibV3: GovernorDepositLogicV3
  governorFunctionRestrictionsLogicLibV3: GovernorFunctionRestrictionsLogicV3
  governorProposalLogicLibV3: GovernorProposalLogicV3
  governorQuorumLogicLibV3: GovernorQuorumLogicV3
  governorStateLogicLibV3: GovernorStateLogicV3
  governorVotesLogicLibV3: GovernorVotesLogicV3
  governorClockLogicLibV4: GovernorClockLogicV4
  governorConfiguratorLibV4: GovernorConfiguratorV4
  governorDepositLogicLibV4: GovernorDepositLogicV4
  governorFunctionRestrictionsLogicLibV4: GovernorFunctionRestrictionsLogicV4
  governorProposalLogicLibV4: GovernorProposalLogicV4
  governorQuorumLogicLibV4: GovernorQuorumLogicV4
  governorStateLogicLibV4: GovernorStateLogicV4
  governorVotesLogicLibV4: GovernorVotesLogicV4
  passportChecksLogic: PassportChecksLogic
  passportDelegationLogic: PassportDelegationLogic
  passportEntityLogic: PassportEntityLogic
  passportPersonhoodLogic: PassportPersonhoodLogic
  passportPoPScoreLogic: PassportPoPScoreLogic
  passportSignalingLogic: PassportSignalingLogic
  passportWhitelistBlacklistLogic: PassportWhitelistAndBlacklistLogic
  passportChecksLogicV1: PassportChecksLogicV1
  passportDelegationLogicV1: PassportDelegationLogicV1
  passportEntityLogicV1: PassportEntityLogicV1
  passportPersonhoodLogicV1: PassportPersonhoodLogicV1
  passportPoPScoreLogicV1: PassportPoPScoreLogicV1
  passportSignalingLogicV1: PassportSignalingLogicV1
  passportWhitelistBlacklistLogicV1: PassportWhitelistAndBlacklistLogicV1
  passportConfiguratorV1: PassportConfiguratorV1
  passportChecksLogicV2: PassportChecksLogicV2
  passportDelegationLogicV2: PassportDelegationLogicV2
  passportEntityLogicV2: PassportEntityLogicV2
  passportPersonhoodLogicV2: PassportPersonhoodLogicV2
  passportPoPScoreLogicV2: PassportPoPScoreLogicV2
  passportSignalingLogicV2: PassportSignalingLogicV2
  passportWhitelistBlacklistLogicV2: PassportWhitelistAndBlacklistLogicV2
  passportConfiguratorV2: PassportConfiguratorV2
  passportConfigurator: any // no abi for this library, which means a typechain is not generated
  administrationUtils: AdministrationUtils
  endorsementUtils: EndorsementUtils
  voteEligibilityUtils: VoteEligibilityUtils
  administrationUtilsV2: AdministrationUtilsV2
  endorsementUtilsV2: EndorsementUtilsV2
  voteEligibilityUtilsV2: VoteEligibilityUtilsV2
  myErc721: MyERC721 | undefined
  myErc1155: MyERC1155 | undefined
  vechainNodesMock: TokenAuction
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
  const {
    GovernorClockLogicLibV1,
    GovernorConfiguratorLibV1,
    GovernorDepositLogicLibV1,
    GovernorFunctionRestrictionsLogicLibV1,
    GovernorProposalLogicLibV1,
    GovernorQuorumLogicLibV1,
    GovernorVotesLogicLibV1,
    GovernorStateLogicLibV1,
    GovernorClockLogicLib,
    GovernorConfiguratorLib,
    GovernorDepositLogicLib,
    GovernorFunctionRestrictionsLogicLib,
    GovernorProposalLogicLib,
    GovernorQuorumLogicLib,
    GovernorVotesLogicLib,
    GovernorStateLogicLib,
    GovernorClockLogicLibV3,
    GovernorConfiguratorLibV3,
    GovernorFunctionRestrictionsLogicLibV3,
    GovernorQuorumLogicLibV3,
    GovernorProposalLogicLibV3,
    GovernorVotesLogicLibV3,
    GovernorDepositLogicLibV3,
    GovernorStateLogicLibV3,
    GovernorClockLogicLibV4,
    GovernorConfiguratorLibV4,
    GovernorFunctionRestrictionsLogicLibV4,
    GovernorQuorumLogicLibV4,
    GovernorProposalLogicLibV4,
    GovernorVotesLogicLibV4,
    GovernorDepositLogicLibV4,
    GovernorStateLogicLibV4,
  } = await governanceLibraries()

  // Deploy Passport Libraries
  const {
    PassportChecksLogicV2,
    PassportConfiguratorV2,
    PassportEntityLogicV2,
    PassportDelegationLogicV2,
    PassportPersonhoodLogicV2,
    PassportPoPScoreLogicV2,
    PassportSignalingLogicV2,
    PassportWhitelistAndBlacklistLogicV2,
    PassportChecksLogicV1,
    PassportConfiguratorV1,
    PassportEntityLogicV1,
    PassportDelegationLogicV1,
    PassportPersonhoodLogicV1,
    PassportPoPScoreLogicV1,
    PassportSignalingLogicV1,
    PassportWhitelistAndBlacklistLogicV1,
    PassportChecksLogic,
    PassportConfigurator,
    PassportEntityLogic,
    PassportDelegationLogic,
    PassportPersonhoodLogic,
    PassportPoPScoreLogic,
    PassportSignalingLogic,
    PassportWhitelistAndBlacklistLogic,
  } = await passportLibraries()

  const {
    AdministrationUtils,
    EndorsementUtils,
    VoteEligibilityUtils,
    AdministrationUtilsV2,
    EndorsementUtilsV2,
    VoteEligibilityUtilsV2,
  } = await x2EarnLibraries()

  // ---------------------- Deploy Mocks ----------------------

  // deploy Mocks
  const TokenAuctionLock = await ethers.getContractFactory("TokenAuction")
  const vechainNodesMock = await TokenAuctionLock.deploy()
  await vechainNodesMock.waitForDeployment()

  const ClockAuctionLock = await ethers.getContractFactory("ClockAuction")
  const clockAuctionContract = await ClockAuctionLock.deploy(
    await vechainNodesMock.getAddress(),
    await owner.getAddress(),
  )

  await vechainNodesMock.setSaleAuctionAddress(await clockAuctionContract.getAddress())

  await vechainNodesMock.addOperator(await owner.getAddress())

  let myErc1155, myErc721
  if (deployMocks) {
    const MyERC721 = await ethers.getContractFactory("MyERC721")
    myErc721 = await MyERC721.deploy(owner.address)
    await myErc721.waitForDeployment()

    const MyERC1155 = await ethers.getContractFactory("MyERC1155")
    myErc1155 = await MyERC1155.deploy(owner.address)
    await myErc1155.waitForDeployment()
  }

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

  const x2EarnCreator = (await deployProxy("X2EarnCreator", [config.CREATOR_NFT_URI, owner.address])) as X2EarnCreator

  // Deploy NodeManagement
  const nodeManagementV1 = (await deployProxy("NodeManagementV1", [
    await vechainNodesMock.getAddress(),
    owner.address,
    owner.address,
  ])) as NodeManagementV1

  const nodeManagement = (await upgradeProxy(
    "NodeManagementV1",
    "NodeManagement",
    await nodeManagementV1.getAddress(),
    [],
    {
      version: 2,
    },
  )) as NodeManagement

  const galaxyMember = (await deployAndUpgrade(
    ["GalaxyMemberV1", "GalaxyMemberV2", "GalaxyMember"],
    [
      [
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
      ],
      [
        await vechainNodesMock.getAddress(),
        await nodeManagement.getAddress(),
        owner.address,
        config.GM_NFT_NODE_TO_FREE_LEVEL,
      ],
      [],
    ],
    {
      versions: [undefined, 2, 3],
    },
  )) as GalaxyMember

  // Initialization requires the address of the x2EarnRewardsPool, for this reason we will initialize it after
  const veBetterPassportContractAddress = await deployProxyOnly("VeBetterPassportV1", {
    PassportChecksLogicV1: await PassportChecksLogicV1.getAddress(),
    PassportConfiguratorV1: await PassportConfiguratorV1.getAddress(),
    PassportEntityLogicV1: await PassportEntityLogicV1.getAddress(),
    PassportDelegationLogicV1: await PassportDelegationLogicV1.getAddress(),
    PassportPersonhoodLogicV1: await PassportPersonhoodLogicV1.getAddress(),
    PassportPoPScoreLogicV1: await PassportPoPScoreLogicV1.getAddress(),
    PassportSignalingLogicV1: await PassportSignalingLogicV1.getAddress(),
    PassportWhitelistAndBlacklistLogicV1: await PassportWhitelistAndBlacklistLogicV1.getAddress(),
  })

  // Set a temporary address for the xAllocationGovernor
  const xAllocationGovernor = otherAccounts[1].address

  const x2EarnApps = (await deployAndUpgrade(
    ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnApps"],
    [
      ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
      [
        config.XAPP_GRACE_PERIOD,
        await nodeManagement.getAddress(),
        veBetterPassportContractAddress,
        await x2EarnCreator.getAddress(),
      ],
      [config.X2EARN_NODE_COOLDOWN_PERIOD, xAllocationGovernor],
    ],
    {
      versions: [undefined, 2, 3],
      libraries: [
        undefined,
        {
          AdministrationUtilsV2: await AdministrationUtilsV2.getAddress(),
          EndorsementUtilsV2: await EndorsementUtilsV2.getAddress(),
          VoteEligibilityUtilsV2: await VoteEligibilityUtilsV2.getAddress(),
        },
        {
          AdministrationUtils: await AdministrationUtils.getAddress(),
          EndorsementUtils: await EndorsementUtils.getAddress(),
          VoteEligibilityUtils: await VoteEligibilityUtils.getAddress(),
        },
      ],
    },
  )) as X2EarnApps

  const x2EarnRewardsPool = (await deployAndUpgrade(
    ["X2EarnRewardsPoolV1", "X2EarnRewardsPoolV2", "X2EarnRewardsPoolV3", "X2EarnRewardsPoolV4", "X2EarnRewardsPool"],
    [
      [owner.address, owner.address, owner.address, await b3tr.getAddress(), await x2EarnApps.getAddress()],
      [owner.address, config.X_2_EARN_INITIAL_IMPACT_KEYS],
      [veBetterPassportContractAddress],
      [],
      [],
    ],
    {
      versions: [undefined, 2, 3, 4, 5],
    },
  )) as X2EarnRewardsPool

  const xAllocationPool = (await deployAndUpgrade(
    ["XAllocationPoolV1", "XAllocationPoolV2", "XAllocationPoolV3", "XAllocationPool"],
    [
      [
        owner.address,
        owner.address,
        owner.address,
        await b3tr.getAddress(),
        await treasury.getAddress(),
        await x2EarnApps.getAddress(),
        await x2EarnRewardsPool.getAddress(),
      ],
      [],
      [],
      [],
    ],
    {
      versions: [undefined, 2, 3, 4],
    },
  )) as XAllocationPool

  const X_ALLOCATIONS_ADDRESS = await xAllocationPool.getAddress()
  const VOTE_2_EARN_ADDRESS = otherAccounts[1].address

  const emissionsV1 = (await deployProxy("Emissions", [
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
  ])) as EmissionsV1

  const emissions = (await upgradeProxy(
    "EmissionsV1",
    "Emissions",
    await emissionsV1.getAddress(),
    [config.EMISSIONS_IS_NOT_ALIGNED ?? false],
    {
      version: 2,
    },
  )) as Emissions

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

  ;(await upgradeProxy("VoterRewardsV1", "VoterRewardsV2", await voterRewardsV1.getAddress(), [], {
    version: 2,
  })) as VoterRewardsV2
  ;(await upgradeProxy("VoterRewardsV2", "VoterRewardsV3", await voterRewardsV1.getAddress(), [], {
    version: 3,
  })) as VoterRewardsV3

  const voterRewards = (await upgradeProxy("VoterRewardsV3", "VoterRewards", await voterRewardsV1.getAddress(), [], {
    version: 4,
  })) as VoterRewards

  // Set vote 2 earn (VoterRewards deployed contract) address in emissions
  await emissions.connect(owner).setVote2EarnAddress(await voterRewardsV1.getAddress())

  const xAllocationVoting = (await deployAndUpgrade(
    ["XAllocationVotingV1", "XAllocationVotingV2", "XAllocationVotingV3", "XAllocationVotingV4", "XAllocationVoting"],
    [
      [
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
      ],
      [veBetterPassportContractAddress],
      [],
      [],
      [],
    ],
    {
      versions: [undefined, 2, 3, 4, 5],
      logOutput: false,
    },
  )) as XAllocationVoting

  const veBetterPassportV1 = (await initializeProxy(
    veBetterPassportContractAddress,
    "VeBetterPassportV1",
    [
      {
        x2EarnApps: await x2EarnApps.getAddress(),
        xAllocationVoting: await xAllocationVoting.getAddress(),
        galaxyMember: await galaxyMember.getAddress(),
        signalingThreshold: config.VEPASSPORT_BOT_SIGNALING_THRESHOLD, //signalingThreshold
        roundsForCumulativeScore: config.VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE, //roundsForCumulativeScore
        minimumGalaxyMemberLevel: config.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL, //galaxyMemberMinimumLevel
        blacklistThreshold: config.VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE, //blacklistThreshold
        whitelistThreshold: config.VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE, //whitelistThreshold
        maxEntitiesPerPassport: config.VEPASSPORT_PASSPORT_MAX_ENTITIES, //maxEntitiesPerPassport
        decayRate: config.VEPASSPORT_DECAY_RATE, //decayRate
      },
      {
        admin: owner.address, // admin
        botSignaler: owner.address, // botSignaler
        upgrader: owner.address, // upgrader
        settingsManager: owner.address, // settingsManager
        roleGranter: owner.address, // roleGranter
        blacklister: owner.address, // blacklister
        whitelister: owner.address, // whitelistManager
        actionRegistrar: owner.address, // actionRegistrar
        actionScoreManager: owner.address, // actionScoreManager
      },
    ],
    {
      PassportChecksLogicV1: await PassportChecksLogicV1.getAddress(),
      PassportConfiguratorV1: await PassportConfiguratorV1.getAddress(),
      PassportEntityLogicV1: await PassportEntityLogicV1.getAddress(),
      PassportDelegationLogicV1: await PassportDelegationLogicV1.getAddress(),
      PassportPersonhoodLogicV1: await PassportPersonhoodLogicV1.getAddress(),
      PassportPoPScoreLogicV1: await PassportPoPScoreLogicV1.getAddress(),
      PassportSignalingLogicV1: await PassportSignalingLogicV1.getAddress(),
      PassportWhitelistAndBlacklistLogicV1: await PassportWhitelistAndBlacklistLogicV1.getAddress(),
    },
  )) as VeBetterPassportV1

  const veBetterPassportV2 = (await upgradeProxy(
    "VeBetterPassportV1",
    "VeBetterPassportV2",
    await veBetterPassportV1.getAddress(),
    [],
    {
      version: 2,
      libraries: {
        PassportChecksLogicV2: await PassportChecksLogicV2.getAddress(),
        PassportConfiguratorV2: await PassportConfiguratorV2.getAddress(),
        PassportEntityLogicV2: await PassportEntityLogicV2.getAddress(),
        PassportDelegationLogicV2: await PassportDelegationLogicV2.getAddress(),
        PassportPersonhoodLogicV2: await PassportPersonhoodLogicV2.getAddress(),
        PassportPoPScoreLogicV2: await PassportPoPScoreLogicV2.getAddress(),
        PassportSignalingLogicV2: await PassportSignalingLogicV2.getAddress(),
        PassportWhitelistAndBlacklistLogicV2: await PassportWhitelistAndBlacklistLogicV2.getAddress(),
      },
    },
  )) as VeBetterPassportV2

  const veBetterPassport = (await upgradeProxy(
    "VeBetterPassportV2",
    "VeBetterPassport",
    await veBetterPassportV1.getAddress(),
    [],
    {
      version: 3,
      libraries: {
        PassportChecksLogic: await PassportChecksLogic.getAddress(),
        PassportConfigurator: await PassportConfigurator.getAddress(),
        PassportEntityLogic: await PassportEntityLogic.getAddress(),
        PassportDelegationLogic: await PassportDelegationLogic.getAddress(),
        PassportPersonhoodLogic: await PassportPersonhoodLogic.getAddress(),
        PassportPoPScoreLogic: await PassportPoPScoreLogic.getAddress(),
        PassportSignalingLogic: await PassportSignalingLogic.getAddress(),
        PassportWhitelistAndBlacklistLogic: await PassportWhitelistAndBlacklistLogic.getAddress(),
      },
    },
  )) as VeBetterPassport

  // Deploy Governor
  const governorV1 = (await deployProxy(
    "B3TRGovernorV1",
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
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
      GovernorConfiguratorV1: await GovernorConfiguratorLibV1.getAddress(),
      GovernorDepositLogicV1: await GovernorDepositLogicLibV1.getAddress(),
      GovernorFunctionRestrictionsLogicV1: await GovernorFunctionRestrictionsLogicLibV1.getAddress(),
      GovernorProposalLogicV1: await GovernorProposalLogicLibV1.getAddress(),
      GovernorQuorumLogicV1: await GovernorQuorumLogicLibV1.getAddress(),
      GovernorStateLogicV1: await GovernorStateLogicLibV1.getAddress(),
      GovernorVotesLogicV1: await GovernorVotesLogicLibV1.getAddress(),
    },
  )) as B3TRGovernorV1

  const governorV2 = (await upgradeProxy("B3TRGovernorV1", "B3TRGovernorV2", await governorV1.getAddress(), [], {
    version: 2,
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
      GovernorConfiguratorV1: await GovernorConfiguratorLibV1.getAddress(),
      GovernorDepositLogicV1: await GovernorDepositLogicLibV1.getAddress(),
      GovernorFunctionRestrictionsLogicV1: await GovernorFunctionRestrictionsLogicLibV1.getAddress(),
      GovernorProposalLogicV1: await GovernorQuorumLogicLibV1.getAddress(),
      GovernorQuorumLogicV1: await GovernorQuorumLogicLibV1.getAddress(),
      GovernorStateLogicV1: await GovernorStateLogicLibV1.getAddress(),
      GovernorVotesLogicV1: await GovernorVotesLogicLibV1.getAddress(),
    },
  })) as B3TRGovernorV2

  const governorV3 = (await upgradeProxy("B3TRGovernorV2", "B3TRGovernorV3", await governorV1.getAddress(), [], {
    version: 3,
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
      GovernorConfiguratorV3: await GovernorConfiguratorLibV3.getAddress(),
      GovernorDepositLogicV3: await GovernorDepositLogicLibV3.getAddress(),
      GovernorFunctionRestrictionsLogicV3: await GovernorFunctionRestrictionsLogicLibV3.getAddress(),
      GovernorProposalLogicV3: await GovernorProposalLogicLibV3.getAddress(),
      GovernorQuorumLogicV3: await GovernorQuorumLogicLibV3.getAddress(),
      GovernorStateLogicV3: await GovernorStateLogicLibV3.getAddress(),
      GovernorVotesLogicV3: await GovernorVotesLogicLibV3.getAddress(),
    },
  })) as B3TRGovernorV3

  const governorV4 = (await upgradeProxy(
    "B3TRGovernorV3",
    "B3TRGovernorV4",
    await governorV1.getAddress(),
    [await veBetterPassport.getAddress()],
    {
      version: 4,
      libraries: {
        GovernorClockLogicV4: await GovernorClockLogicLibV4.getAddress(),
        GovernorConfiguratorV4: await GovernorConfiguratorLibV4.getAddress(),
        GovernorDepositLogicV4: await GovernorDepositLogicLibV4.getAddress(),
        GovernorFunctionRestrictionsLogicV4: await GovernorFunctionRestrictionsLogicLibV4.getAddress(),
        GovernorProposalLogicV4: await GovernorProposalLogicLibV4.getAddress(),
        GovernorQuorumLogicV4: await GovernorQuorumLogicLibV4.getAddress(),
        GovernorStateLogicV4: await GovernorStateLogicLibV4.getAddress(),
        GovernorVotesLogicV4: await GovernorVotesLogicLibV4.getAddress(),
      },
    },
  )) as B3TRGovernorV4

  const governor = (await upgradeProxy("B3TRGovernorV4", "B3TRGovernor", await governorV1.getAddress(), [], {
    version: 5,
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
      GovernorConfigurator: await GovernorConfiguratorLib.getAddress(),
      GovernorDepositLogic: await GovernorDepositLogicLib.getAddress(),
      GovernorFunctionRestrictionsLogic: await GovernorFunctionRestrictionsLogicLib.getAddress(),
      GovernorProposalLogic: await GovernorProposalLogicLib.getAddress(),
      GovernorQuorumLogic: await GovernorQuorumLogicLib.getAddress(),
      GovernorStateLogic: await GovernorStateLogicLib.getAddress(),
      GovernorVotesLogic: await GovernorVotesLogicLib.getAddress(),
    },
  })) as B3TRGovernor

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
    VeBetterPassport: veBetterPassportContractAddress,
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
    X2EarnApps: {
      EndorsementUtils: await EndorsementUtils.getAddress(),
      AdministrationUtils: await AdministrationUtils.getAddress(),
      VoteEligibilityUtils: await VoteEligibilityUtils.getAddress(),
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

  // Grant action score manager role to X2EarnApps
  await veBetterPassport
    .connect(owner)
    .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnApps.getAddress())

  // Setup XAllocationPool addresses
  await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())
  await xAllocationPool.connect(owner).setEmissionsAddress(await emissions.getAddress())

  // Setup the X2EarnApps XAllocationVote address
  await x2EarnApps.connect(owner).setXAllocationVotingGovernor(await xAllocationVoting.getAddress())

  // Set up veBetterPassport
  await veBetterPassport
    .connect(owner)
    .grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), await x2EarnRewardsPool.getAddress())

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

  // Set up the X2EarnCreator contract
  await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.MINTER_ROLE(), await x2EarnApps.getAddress())
  await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.BURNER_ROLE(), await x2EarnApps.getAddress())

  // Mint creator NFT to owner
  await x2EarnCreator.safeMint(await owner.getAddress())

  // Bootstrap and start emissions
  if (bootstrapAndStartEmissions) {
    await callBootstrapAndStartEmissions()
  }

  cachedDeployInstance = {
    B3trContract,
    b3tr,
    vot3,
    timeLock,
    x2EarnCreator,
    governor,
    governorV1,
    governorV2,
    governorV3,
    governorV4,
    galaxyMember,
    x2EarnApps,
    xAllocationVoting,
    nodeManagement,
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
    veBetterPassport,
    governorClockLogicLib: GovernorClockLogicLib,
    governorConfiguratorLib: GovernorConfiguratorLib,
    governorDepositLogicLib: GovernorDepositLogicLib,
    governorFunctionRestrictionsLogicLib: GovernorFunctionRestrictionsLogicLib,
    governorProposalLogicLib: GovernorProposalLogicLib,
    governorQuorumLogicLib: GovernorQuorumLogicLib,
    governorStateLogicLib: GovernorStateLogicLib,
    governorVotesLogicLib: GovernorVotesLogicLib,
    governorClockLogicLibV1: GovernorClockLogicLibV1,
    governorConfiguratorLibV1: GovernorConfiguratorLibV1,
    governorDepositLogicLibV1: GovernorDepositLogicLibV1,
    governorFunctionRestrictionsLogicLibV1: GovernorFunctionRestrictionsLogicLibV1,
    governorProposalLogicLibV1: GovernorProposalLogicLibV1,
    governorQuorumLogicLibV1: GovernorQuorumLogicLibV1,
    governorStateLogicLibV1: GovernorStateLogicLibV1,
    governorVotesLogicLibV1: GovernorVotesLogicLibV1,
    governorClockLogicLibV3: GovernorClockLogicLibV3,
    governorConfiguratorLibV3: GovernorConfiguratorLibV3,
    governorDepositLogicLibV3: GovernorDepositLogicLibV3,
    governorFunctionRestrictionsLogicLibV3: GovernorFunctionRestrictionsLogicLibV3,
    governorProposalLogicLibV3: GovernorProposalLogicLibV3,
    governorQuorumLogicLibV3: GovernorQuorumLogicLibV3,
    governorStateLogicLibV3: GovernorStateLogicLibV3,
    governorVotesLogicLibV3: GovernorVotesLogicLibV3,
    governorClockLogicLibV4: GovernorClockLogicLibV4,
    governorConfiguratorLibV4: GovernorConfiguratorLibV4,
    governorDepositLogicLibV4: GovernorDepositLogicLibV4,
    governorFunctionRestrictionsLogicLibV4: GovernorFunctionRestrictionsLogicLibV4,
    governorProposalLogicLibV4: GovernorProposalLogicLibV4,
    governorQuorumLogicLibV4: GovernorQuorumLogicLibV4,
    governorStateLogicLibV4: GovernorStateLogicLibV4,
    governorVotesLogicLibV4: GovernorVotesLogicLibV4,
    passportChecksLogic: PassportChecksLogic,
    passportDelegationLogic: PassportDelegationLogic,
    passportEntityLogic: PassportEntityLogic,
    passportPersonhoodLogic: PassportPersonhoodLogic,
    passportPoPScoreLogic: PassportPoPScoreLogic,
    passportSignalingLogic: PassportSignalingLogic,
    passportWhitelistBlacklistLogic: PassportWhitelistAndBlacklistLogic,
    passportConfigurator: PassportConfigurator,
    passportChecksLogicV1: PassportChecksLogicV1,
    passportDelegationLogicV1: PassportDelegationLogicV1,
    passportEntityLogicV1: PassportEntityLogicV1,
    passportConfiguratorV1: PassportConfiguratorV1,
    passportPersonhoodLogicV1: PassportPersonhoodLogicV1,
    passportPoPScoreLogicV1: PassportPoPScoreLogicV1,
    passportSignalingLogicV1: PassportSignalingLogicV1,
    passportWhitelistBlacklistLogicV1: PassportWhitelistAndBlacklistLogicV1,
    passportChecksLogicV2: PassportChecksLogicV2,
    passportDelegationLogicV2: PassportDelegationLogicV2,
    passportEntityLogicV2: PassportEntityLogicV2,
    passportPersonhoodLogicV2: PassportPersonhoodLogicV2,
    passportPoPScoreLogicV2: PassportPoPScoreLogicV2,
    passportSignalingLogicV2: PassportSignalingLogicV2,
    passportWhitelistBlacklistLogicV2: PassportWhitelistAndBlacklistLogicV2,
    passportConfiguratorV2: PassportConfiguratorV2,
    administrationUtils: AdministrationUtils,
    endorsementUtils: EndorsementUtils,
    voteEligibilityUtils: VoteEligibilityUtils,
    administrationUtilsV2: AdministrationUtilsV2,
    endorsementUtilsV2: EndorsementUtilsV2,
    voteEligibilityUtilsV2: VoteEligibilityUtilsV2,
    myErc721: myErc721,
    myErc1155: myErc1155,
    vechainNodesMock,
  }
  return cachedDeployInstance
}
