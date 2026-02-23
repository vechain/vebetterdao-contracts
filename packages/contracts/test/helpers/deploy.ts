import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
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
  X2EarnRewardsPool,
  MyERC20,
  MyERC721,
  MyERC1155,
  TokenAuction,
  B3TRGovernor,
  NodeManagementV3,
  VeBetterPassport,
  VeBetterPassportV1,
  X2EarnCreator,
  VeBetterPassportV2,
  B3TRMultiSig,
  VeBetterPassportV3,
  StargateNFT,
  GrantsManager,
  GrantsManagerV1,
  RelayerRewardsPool,
  AutoVotingLogic,
  DBAPool,
  DBAPoolV1,
  DBAPoolV2,
  Stargate,
  AdministrationUtilsV6,
  EndorsementUtilsV6,
  VoteEligibilityUtilsV6,
  X2EarnAppsV7,
} from "../../typechain-types"
import { deployAndUpgrade, deployProxy, deployProxyOnly, initializeProxy, upgradeProxy } from "../../scripts/helpers"
import { governanceLibraries, passportLibraries } from "../../scripts/libraries"
import type { GovernanceLibraries } from "../../scripts/libraries/governanceLibraries"
import type { PassportLibraries } from "../../scripts/libraries/passportLibraries"
import { setWhitelistedFunctions } from "./whitelistGovernance"
import { x2EarnLibraries } from "../../scripts/libraries/x2EarnLibraries"
import type { X2EarnLibraries } from "../../scripts/libraries/x2EarnLibraries"
import { APPS } from "../../scripts/deploy/setup"
import { autoVotingLibraries } from "../../scripts/libraries"
import { deployStargateMock } from "../../scripts/deploy/mocks/deployStargate"
import { bootstrapAndStartEmissions as callBootstrapAndStartEmissions } from "./common"

// Helper type to convert PascalCase library types to camelCase
type ToCamelCaseKeys<T> = {
  [K in keyof T as Uncapitalize<K & string>]: T[K]
}

export interface DeployInstance
  extends ToCamelCaseKeys<GovernanceLibraries>, ToCamelCaseKeys<PassportLibraries>, ToCamelCaseKeys<X2EarnLibraries> {
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
  treasury: Treasury
  nodeManagement: NodeManagementV3
  x2EarnCreator: X2EarnCreator
  x2EarnRewardsPool: X2EarnRewardsPool
  veBetterPassport: VeBetterPassport
  veBetterPassportV1: VeBetterPassportV1
  veBetterPassportV2: VeBetterPassportV2
  veBetterPassportV3: VeBetterPassportV3
  dynamicBaseAllocationPool: DBAPool
  owner: HardhatEthersSigner
  otherAccount: HardhatEthersSigner
  minterAccount: HardhatEthersSigner
  timelockAdmin: HardhatEthersSigner
  otherAccounts: HardhatEthersSigner[]
  creators: HardhatEthersSigner[]

  // GrantsManager
  grantsManager: GrantsManager

  myErc721: MyERC721 | undefined
  myErc1155: MyERC1155 | undefined

  // Legacy Nodes
  vechainNodesMock: TokenAuction

  // B3TR MultiSig
  b3trMultiSig: B3TRMultiSig

  // StarGate
  stargateNftMock: StargateNFT
  stargateMock: Stargate
  vthoTokenMock: MyERC20

  // Rewards Pool related to XAllocationVoting
  relayerRewardsPool: RelayerRewardsPool

  // AutoVoting Libraries
  autoVotingLogic: AutoVotingLogic
}

export const NFT_NAME = "GalaxyMember"
export const NFT_SYMBOL = "GM"
export const DEFAULT_MAX_MINTABLE_LEVEL = 1

// // Voter Rewards
export const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] // Galaxy Member contract levels
export const multipliers = [0, 10, 20, 50, 100, 150, 200, 400, 900, 2400] // Galaxy Member contract percentage multipliers (in basis points)

let cachedDeployInstance: DeployInstance = {} as DeployInstance
export const getOrDeployContractInstances = async ({
  forceDeploy = false,
  config = createLocalConfig(),
  maxMintableLevel = DEFAULT_MAX_MINTABLE_LEVEL,
  bootstrapAndStartEmissions = false,
  deployMocks = false,
}) => {
  if (!forceDeploy && Object.keys(cachedDeployInstance).length > 0) {
    return cachedDeployInstance
  }

  // Contracts are deployed using the first signer/account by default
  const [owner, otherAccount, minterAccount, timelockAdmin, ...otherAccounts] = await ethers.getSigners()
  const creators = otherAccounts.slice(0, APPS.length) // otherAcounts[1]...otherAccounts[8] reserved for creators

  // ---------------------- Deploy Libraries ----------------------
  const {
    // V1
    GovernorClockLogicLibV1,
    GovernorConfiguratorLibV1,
    GovernorDepositLogicLibV1,
    GovernorFunctionRestrictionsLogicLibV1,
    GovernorGovernanceLogicLibV1,
    GovernorProposalLogicLibV1,
    GovernorQuorumLogicLibV1,
    GovernorVotesLogicLibV1,
    GovernorStateLogicLibV1,
    // V3
    GovernorClockLogicLibV3,
    GovernorConfiguratorLibV3,
    GovernorFunctionRestrictionsLogicLibV3,
    GovernorGovernanceLogicLibV3,
    GovernorQuorumLogicLibV3,
    GovernorProposalLogicLibV3,
    GovernorVotesLogicLibV3,
    GovernorDepositLogicLibV3,
    GovernorStateLogicLibV3,
    // V4
    GovernorClockLogicLibV4,
    GovernorConfiguratorLibV4,
    GovernorFunctionRestrictionsLogicLibV4,
    GovernorGovernanceLogicLibV4,
    GovernorQuorumLogicLibV4,
    GovernorProposalLogicLibV4,
    GovernorVotesLogicLibV4,
    GovernorDepositLogicLibV4,
    GovernorStateLogicLibV4,
    // V5
    GovernorClockLogicLibV5,
    GovernorConfiguratorLibV5,
    GovernorFunctionRestrictionsLogicLibV5,
    GovernorGovernanceLogicLibV5,
    GovernorQuorumLogicLibV5,
    GovernorProposalLogicLibV5,
    GovernorVotesLogicLibV5,
    GovernorDepositLogicLibV5,
    GovernorStateLogicLibV5,
    // V6
    GovernorClockLogicLibV6,
    GovernorConfiguratorLibV6,
    GovernorDepositLogicLibV6,
    GovernorFunctionRestrictionsLogicLibV6,
    GovernorGovernanceLogicLibV6,
    GovernorProposalLogicLibV6,
    GovernorQuorumLogicLibV6,
    GovernorStateLogicLibV6,
    GovernorVotesLogicLibV6,
    // V7
    GovernorClockLogicLibV7,
    GovernorConfiguratorLibV7,
    GovernorDepositLogicLibV7,
    GovernorFunctionRestrictionsLogicLibV7,
    GovernorGovernanceLogicLibV7,
    GovernorProposalLogicLibV7,
    GovernorQuorumLogicLibV7,
    GovernorStateLogicLibV7,
    GovernorVotesLogicLibV7,
    // V8
    GovernorClockLogicLibV8,
    GovernorConfiguratorLibV8,
    GovernorDepositLogicLibV8,
    GovernorFunctionRestrictionsLogicLibV8,
    GovernorProposalLogicLibV8,
    GovernorQuorumLogicLibV8,
    GovernorStateLogicLibV8,
    GovernorVotesLogicLibV8,
    GovernorGovernanceLogicLibV8,
    // (latest)
    GovernorClockLogicLib,
    GovernorConfiguratorLib,
    GovernorDepositLogicLib,
    GovernorFunctionRestrictionsLogicLib,
    GovernorGovernanceLogicLib,
    GovernorProposalLogicLib,
    GovernorQuorumLogicLib,
    GovernorVotesLogicLib,
    GovernorStateLogicLib,
  } = await governanceLibraries({ logOutput: false, latestVersionOnly: false })

  // Deploy Passport Libraries
  const {
    // V3
    PassportChecksLogicV3,
    PassportConfiguratorV3,
    PassportEntityLogicV3,
    PassportDelegationLogicV3,
    PassportPersonhoodLogicV3,
    PassportPoPScoreLogicV3,
    PassportSignalingLogicV3,
    PassportWhitelistAndBlacklistLogicV3,
    // V2
    PassportChecksLogicV2,
    PassportConfiguratorV2,
    PassportEntityLogicV2,
    PassportDelegationLogicV2,
    PassportPersonhoodLogicV2,
    PassportPoPScoreLogicV2,
    PassportSignalingLogicV2,
    PassportWhitelistAndBlacklistLogicV2,
    // V1
    PassportChecksLogicV1,
    PassportConfiguratorV1,
    PassportEntityLogicV1,
    PassportDelegationLogicV1,
    PassportPersonhoodLogicV1,
    PassportPoPScoreLogicV1,
    PassportSignalingLogicV1,
    PassportWhitelistAndBlacklistLogicV1,
    // V4 (latest)
    PassportChecksLogic,
    PassportConfigurator,
    PassportEntityLogic,
    PassportDelegationLogic,
    PassportPersonhoodLogic,
    PassportPoPScoreLogic,
    PassportSignalingLogic,
    PassportWhitelistAndBlacklistLogic,
  } = await passportLibraries({ logOutput: false, latestVersionOnly: false })

  // Deploy X2Earn AppLibraries
  const {
    // Latest
    AdministrationUtils,
    EndorsementUtils,
    VoteEligibilityUtils,
    AppStorageUtils,
    // V2
    AdministrationUtilsV2,
    EndorsementUtilsV2,
    VoteEligibilityUtilsV2,
    // V3
    AdministrationUtilsV3,
    EndorsementUtilsV3,
    VoteEligibilityUtilsV3,
    // V4
    AdministrationUtilsV4,
    EndorsementUtilsV4,
    VoteEligibilityUtilsV4,
    // V5
    AdministrationUtilsV5,
    EndorsementUtilsV5,
    VoteEligibilityUtilsV5,
    // V6
    AdministrationUtilsV6,
    EndorsementUtilsV6,
    VoteEligibilityUtilsV6,
    // V7
    AdministrationUtilsV7,
    EndorsementUtilsV7,
    VoteEligibilityUtilsV7,
  } = await x2EarnLibraries({ logOutput: false, latestVersionOnly: false })

  // Deploy AutoVoting Libraries
  const { AutoVotingLogic } = await autoVotingLibraries()

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

  // deploy Stargate Mocks
  // Deploy VTHO token
  const VTHOFactory = await ethers.getContractFactory("MyERC20")
  const vthoTokenMock = await VTHOFactory.deploy(owner.address, owner.address)
  await vthoTokenMock.waitForDeployment()
  const vthoAddress = await vthoTokenMock.getAddress()

  const { stargateNFT: stargateNftMock, stargate: stargateMock } = await deployStargateMock({
    logOutput: false,
    legacyNodesContractAddress: await vechainNodesMock.getAddress(),
    vthoTokenAddress: await vthoTokenMock.getAddress(),
  })

  // Add stargateNftMock as operator to vechainNodesMock, so that it can destroy legacy nodes
  await vechainNodesMock.addOperator(await stargateNftMock.getAddress())

  const nodeManagementMock = (await deployAndUpgrade(
    ["NodeManagementV1", "NodeManagementV2", "NodeManagementV3"],
    [[await vechainNodesMock.getAddress(), owner.address, owner.address], [], [await stargateNftMock.getAddress()]],
    {
      versions: [undefined, 2, 3],
      logOutput: false,
    },
  )) as NodeManagementV3

  let myErc1155, myErc721
  if (deployMocks) {
    const MyERC721 = await ethers.getContractFactory("MyERC721")
    myErc721 = await MyERC721.deploy(owner.address)
    await myErc721.waitForDeployment()

    const MyERC1155 = await ethers.getContractFactory("MyERC1155")
    myErc1155 = await MyERC1155.deploy(owner.address)
    await myErc1155.waitForDeployment()
  }

  // ---------------------- Deploy MultiSig ----------------------

  const B3TRMultiSig = await ethers.getContractFactory("B3TRMultiSig")
  const b3trMultiSig = await B3TRMultiSig.deploy([owner.address, otherAccount.address, minterAccount.address], 2)

  // ---------------------- Deploy Contracts ----------------------
  // Deploy B3TR
  const B3trContract = await ethers.getContractFactory("B3TR")
  const b3tr = await B3trContract.deploy(owner, minterAccount, owner)

  // Deploy VOT3 version 1
  let vot3 = (await deployProxy("VOT3", [owner.address, owner.address, owner.address, await b3tr.getAddress()])) as VOT3

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
    await timeLock.getAddress(), // timelock address
    owner.address, // admin
    owner.address, // proxy admin
    owner.address, // pauser
    config.TREASURY_TRANSFER_LIMIT_VET,
    config.TREASURY_TRANSFER_LIMIT_B3TR,
    config.TREASURY_TRANSFER_LIMIT_VOT3,
    config.TREASURY_TRANSFER_LIMIT_VTHO,
  ])) as Treasury

  const x2EarnCreator = (await deployAndUpgrade(
    ["X2EarnCreatorV1", "X2EarnCreator"],
    [[config.CREATOR_NFT_URI, owner.address], [true]],
    {
      versions: [undefined, 2],
      logOutput: false,
    },
  )) as X2EarnCreator

  // Deploy NodeManagement - deprecating...
  // const nodeManagementV1 = (await deployProxy("NodeManagementV1", [
  //   await vechainNodesMock.getAddress(),
  //   owner.address,
  //   owner.address,
  // ])) as NodeManagementV1

  // const nodeManagement = (await upgradeProxy(
  //   "NodeManagementV1",
  //   "NodeManagement",
  //   await nodeManagementV1.getAddress(),
  //   [],
  //   {
  //     version: 2,
  //   },
  // )) as NodeManagement

  const galaxyMember = (await deployAndUpgrade(
    ["GalaxyMemberV1", "GalaxyMemberV2", "GalaxyMemberV3", "GalaxyMemberV4", "GalaxyMemberV5", "GalaxyMember"],
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
        await nodeManagementMock.getAddress(),
        owner.address,
        config.GM_NFT_NODE_TO_FREE_LEVEL,
      ],
      [],
      [],
      [],
      [await stargateNftMock.getAddress()],
    ],
    {
      versions: [undefined, 2, 3, 4, 5, 6],
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
  const xAllocationGovernor = otherAccounts[10].address

  // Set a temporary address for the x2EarnRewardsPool to then set the correct address in x2EarnApps
  const x2EarnRewardsPoolAddress = otherAccounts[11].address

  // Deploy up to V7
  const x2EarnAppsV7 = (await deployAndUpgrade(
    ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnAppsV3", "X2EarnAppsV4", "X2EarnAppsV5", "X2EarnAppsV6", "X2EarnAppsV7"],
    [
      ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
      [
        config.XAPP_GRACE_PERIOD,
        await nodeManagementMock.getAddress(),
        veBetterPassportContractAddress,
        await x2EarnCreator.getAddress(),
      ],
      [config.X2EARN_NODE_COOLDOWN_PERIOD, xAllocationGovernor],
      [x2EarnRewardsPoolAddress], // Setting temporary address for the x2EarnRewardsPool
      [],
      [],
      [await stargateNftMock.getAddress()],
    ],
    {
      versions: [undefined, 2, 3, 4, 5, 6, 7],
      libraries: [
        undefined,
        {
          AdministrationUtilsV2: await AdministrationUtilsV2.getAddress(),
          EndorsementUtilsV2: await EndorsementUtilsV2.getAddress(),
          VoteEligibilityUtilsV2: await VoteEligibilityUtilsV2.getAddress(),
        },
        {
          AdministrationUtilsV3: await AdministrationUtilsV3.getAddress(),
          EndorsementUtilsV3: await EndorsementUtilsV3.getAddress(),
          VoteEligibilityUtilsV3: await VoteEligibilityUtilsV3.getAddress(),
        },
        {
          AdministrationUtilsV4: await AdministrationUtilsV4.getAddress(),
          EndorsementUtilsV4: await EndorsementUtilsV4.getAddress(),
          VoteEligibilityUtilsV4: await VoteEligibilityUtilsV4.getAddress(),
        },
        {
          AdministrationUtilsV5: await AdministrationUtilsV5.getAddress(),
          EndorsementUtilsV5: await EndorsementUtilsV5.getAddress(),
          VoteEligibilityUtilsV5: await VoteEligibilityUtilsV5.getAddress(),
        },
        {
          AdministrationUtilsV6: await AdministrationUtilsV6.getAddress(),
          EndorsementUtilsV6: await EndorsementUtilsV6.getAddress(),
          VoteEligibilityUtilsV6: await VoteEligibilityUtilsV6.getAddress(),
        },
        {
          AdministrationUtilsV7: await AdministrationUtilsV7.getAddress(),
          EndorsementUtilsV7: await EndorsementUtilsV7.getAddress(),
          VoteEligibilityUtilsV7: await VoteEligibilityUtilsV7.getAddress(),
        },
      ],
    },
  )) as X2EarnAppsV7

  const x2EarnRewardsPool = (await deployAndUpgrade(
    [
      "X2EarnRewardsPoolV1",
      "X2EarnRewardsPoolV2",
      "X2EarnRewardsPoolV3",
      "X2EarnRewardsPoolV4",
      "X2EarnRewardsPoolV5",
      "X2EarnRewardsPoolV6",
      "X2EarnRewardsPool",
    ],
    [
      [owner.address, owner.address, owner.address, await b3tr.getAddress(), await x2EarnAppsV7.getAddress()],
      [owner.address, config.X_2_EARN_INITIAL_IMPACT_KEYS],
      [veBetterPassportContractAddress],
      [],
      [],
      [],
      [],
    ],
    {
      versions: [undefined, 2, 3, 4, 5, 6, 7],
    },
  )) as X2EarnRewardsPool

  const xAllocationPool = (await deployAndUpgrade(
    [
      "XAllocationPoolV1",
      "XAllocationPoolV2",
      "XAllocationPoolV3",
      "XAllocationPoolV4",
      "XAllocationPoolV5",
      "XAllocationPoolV6",
      "XAllocationPool",
    ],
    [
      [
        owner.address,
        owner.address,
        owner.address,
        await b3tr.getAddress(),
        await treasury.getAddress(),
        await x2EarnAppsV7.getAddress(),
        await x2EarnRewardsPool.getAddress(),
      ],
      [],
      [],
      [],
      [],
      [],
      [[], []],
    ],
    {
      versions: [undefined, 2, 3, 4, 5, 6, 7],
    },
  )) as XAllocationPool

  const X_ALLOCATIONS_ADDRESS = await xAllocationPool.getAddress()
  const VOTE_2_EARN_ADDRESS = otherAccounts[10].address

  const emissions = (await deployAndUpgrade(
    ["EmissionsV1", "EmissionsV2", "Emissions"],
    [
      [
        {
          minter: minterAccount.address,
          admin: owner.address,
          upgrader: owner.address,
          contractsAddressManager: owner.address,
          decaySettingsManager: owner.address,
          b3trAddress: await b3tr.getAddress(),
          destinations: [
            X_ALLOCATIONS_ADDRESS,
            VOTE_2_EARN_ADDRESS,
            await treasury.getAddress(),
            config.MIGRATION_ADDRESS,
          ],
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
      ],
      [],
      [config.GM_PERCENTAGE_OF_TREASURY],
    ],
    {
      versions: [undefined, 2, 3],
      logOutput: false,
    },
  )) as Emissions

  const voterRewards = (await deployAndUpgrade(
    ["VoterRewardsV1", "VoterRewardsV2", "VoterRewardsV3", "VoterRewardsV4", "VoterRewardsV5", "VoterRewards"],
    [
      [
        owner.address, // admin
        owner.address, // upgrader
        owner.address, // contractsAddressManager
        await emissions.getAddress(),
        await galaxyMember.getAddress(),
        await b3tr.getAddress(),
        levels,
        multipliers,
      ],
      [],
      [],
      [],
      [],
      [],
    ],
    {
      versions: [undefined, 2, 3, 4, 5, 6],
    },
  )) as VoterRewards

  // Set vote 2 earn (VoterRewards deployed contract) address in emissions
  await emissions.connect(owner).setVote2EarnAddress(await voterRewards.getAddress())

  const tempB3trGovernorAddress = owner.address
  const xAllocationVoting = (await deployAndUpgrade(
    [
      "XAllocationVotingV1",
      "XAllocationVotingV2",
      "XAllocationVotingV3",
      "XAllocationVotingV4",
      "XAllocationVotingV5",
      "XAllocationVotingV6",
      "XAllocationVotingV7",
      "XAllocationVoting",
    ],
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
          x2EarnAppsAddress: await x2EarnAppsV7.getAddress(),
          baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
          appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
          votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
        },
      ],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ],
    {
      versions: [undefined, 2, 3, 4, 5, 6, 7, 8],
      libraries: [
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { AutoVotingLogic: await AutoVotingLogic.getAddress() },
      ],
      logOutput: false,
    },
  )) as XAllocationVoting

  const veBetterPassportV1 = (await initializeProxy(
    veBetterPassportContractAddress,
    "VeBetterPassportV1",
    [
      {
        x2EarnApps: await x2EarnAppsV7.getAddress(),
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
    await veBetterPassportV1.getAddress(), // Proxy address remains the same
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

  const veBetterPassportV3 = (await upgradeProxy(
    "VeBetterPassportV2",
    "VeBetterPassportV3",
    await veBetterPassportV1.getAddress(), // Proxy address remains the same
    [],
    {
      version: 3,
      libraries: {
        PassportChecksLogicV3: await PassportChecksLogicV3.getAddress(),
        PassportConfiguratorV3: await PassportConfiguratorV3.getAddress(),
        PassportEntityLogicV3: await PassportEntityLogicV3.getAddress(),
        PassportDelegationLogicV3: await PassportDelegationLogicV3.getAddress(),
        PassportPersonhoodLogicV3: await PassportPersonhoodLogicV3.getAddress(),
        PassportPoPScoreLogicV3: await PassportPoPScoreLogicV3.getAddress(),
        PassportSignalingLogicV3: await PassportSignalingLogicV3.getAddress(),
        PassportWhitelistAndBlacklistLogicV3: await PassportWhitelistAndBlacklistLogicV3.getAddress(),
      },
    },
  )) as VeBetterPassportV3

  // V4 (latest version)
  const veBetterPassport = (await upgradeProxy(
    "VeBetterPassportV3",
    "VeBetterPassport",
    await veBetterPassportV1.getAddress(), // Proxy address remains the same
    [],
    {
      version: 4,
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

  // Set the TEMP governor address before deploying the governor
  const TEMP_GOVERNOR_ADDRESS = owner.address

  // Deploy GrantsManager V1 first
  const grantsManagerV1 = (await deployProxy("GrantsManagerV1", [
    // ← Change to GrantsManagerV1
    TEMP_GOVERNOR_ADDRESS, // governor address
    await treasury.getAddress(), // treasury address
    owner.address, // admin
    await b3tr.getAddress(), // b3tr address
    config.MINIMUM_MILESTONE_COUNT, // minimum milestone count
  ])) as GrantsManagerV1

  // Grant UPGRADER_ROLE to deployer
  await grantsManagerV1.connect(owner).grantRole(await grantsManagerV1.UPGRADER_ROLE(), owner.address)

  // Then upgrade from V1 to V2
  const grantsManager = (await upgradeProxy(
    "GrantsManagerV1",
    "GrantsManager",
    await grantsManagerV1.getAddress(),
    [],
    {
      version: 2,
      libraries: {},
    },
  )) as GrantsManager

  const governor = (await deployAndUpgrade(
    [
      "B3TRGovernorV1",
      "B3TRGovernorV2",
      "B3TRGovernorV3",
      "B3TRGovernorV4",
      "B3TRGovernorV5",
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      "B3TRGovernorV8",
      "B3TRGovernor",
    ],
    [
      [
        {
          vot3Token: await vot3.getAddress(),
          timelock: await timeLock.getAddress(),
          xAllocationVoting: await xAllocationVoting.getAddress(),
          b3tr: await b3tr.getAddress(),
          quorumPercentage: config.B3TR_GOVERNOR_QUORUM_PERCENTAGE,
          initialDepositThreshold: config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD,
          initialMinVotingDelay: config.B3TR_GOVERNOR_MIN_VOTING_DELAY,
          initialVotingThreshold: config.B3TR_GOVERNOR_VOTING_THRESHOLD,
          voterRewards: await voterRewards.getAddress(),
          isFunctionRestrictionEnabled: true,
        },
        {
          governorAdmin: owner.address, // admin
          pauser: owner.address, // botSignaler
          contractsAddressManager: owner.address, // upgrader
          proposalExecutor: owner.address, // settingsManager
          governorFunctionSettingsRoleAddress: owner.address, // roleGranter
        },
      ],
      [],
      [],
      [await veBetterPassport.getAddress()],
      [],
      [],
      [
        {
          grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD, //Grant deposit threshold
          grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD, //Grant voting threshold
          grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE, //Grant quorum percentage
          grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP, //Grant deposit threshold cap
          standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP, //Standard deposit threshold cap
          standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT, //Standard GM weight
          grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT, //Grant GM weight
          galaxyMember: await galaxyMember.getAddress(), //GalaxyMember contract
          grantsManager: await grantsManager.getAddress(), //GrantsManager contract
        },
      ], // [levels, config.GM_MULTIPLIERS_V2] -> Will revert if emissions is not bootstrapped
      [], // Reserved for future configuration parameters; currently no values required
      [], // v9
    ],
    {
      versions: [undefined, 2, 3, 4, 5, 6, 7, 8, 9],
      libraries: [
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
        {
          GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
          GovernorConfiguratorV1: await GovernorConfiguratorLibV1.getAddress(),
          GovernorDepositLogicV1: await GovernorDepositLogicLibV1.getAddress(),
          GovernorFunctionRestrictionsLogicV1: await GovernorFunctionRestrictionsLogicLibV1.getAddress(),
          GovernorProposalLogicV1: await GovernorQuorumLogicLibV1.getAddress(),
          GovernorQuorumLogicV1: await GovernorQuorumLogicLibV1.getAddress(),
          GovernorStateLogicV1: await GovernorStateLogicLibV1.getAddress(),
          GovernorVotesLogicV1: await GovernorVotesLogicLibV1.getAddress(),
        },
        {
          GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
          GovernorConfiguratorV3: await GovernorConfiguratorLibV3.getAddress(),
          GovernorDepositLogicV3: await GovernorDepositLogicLibV3.getAddress(),
          GovernorFunctionRestrictionsLogicV3: await GovernorFunctionRestrictionsLogicLibV3.getAddress(),
          GovernorProposalLogicV3: await GovernorProposalLogicLibV3.getAddress(),
          GovernorQuorumLogicV3: await GovernorQuorumLogicLibV3.getAddress(),
          GovernorStateLogicV3: await GovernorStateLogicLibV3.getAddress(),
          GovernorVotesLogicV3: await GovernorVotesLogicLibV3.getAddress(),
        },
        {
          GovernorClockLogicV4: await GovernorClockLogicLibV4.getAddress(),
          GovernorConfiguratorV4: await GovernorConfiguratorLibV4.getAddress(),
          GovernorDepositLogicV4: await GovernorDepositLogicLibV4.getAddress(),
          GovernorFunctionRestrictionsLogicV4: await GovernorFunctionRestrictionsLogicLibV4.getAddress(),
          GovernorProposalLogicV4: await GovernorProposalLogicLibV4.getAddress(),
          GovernorQuorumLogicV4: await GovernorQuorumLogicLibV4.getAddress(),
          GovernorStateLogicV4: await GovernorStateLogicLibV4.getAddress(),
          GovernorVotesLogicV4: await GovernorVotesLogicLibV4.getAddress(),
        },
        {
          GovernorClockLogicV5: await GovernorClockLogicLibV5.getAddress(),
          GovernorConfiguratorV5: await GovernorConfiguratorLibV5.getAddress(),
          GovernorDepositLogicV5: await GovernorDepositLogicLibV5.getAddress(),
          GovernorFunctionRestrictionsLogicV5: await GovernorFunctionRestrictionsLogicLibV5.getAddress(),
          GovernorQuorumLogicV5: await GovernorQuorumLogicLibV5.getAddress(),
          GovernorProposalLogicV5: await GovernorProposalLogicLibV5.getAddress(),
          GovernorStateLogicV5: await GovernorStateLogicLibV5.getAddress(),
          GovernorVotesLogicV5: await GovernorVotesLogicLibV5.getAddress(),
        },
        {
          GovernorClockLogicV6: await GovernorClockLogicLibV6.getAddress(),
          GovernorConfiguratorV6: await GovernorConfiguratorLibV6.getAddress(),
          GovernorDepositLogicV6: await GovernorDepositLogicLibV6.getAddress(),
          GovernorFunctionRestrictionsLogicV6: await GovernorFunctionRestrictionsLogicLibV6.getAddress(),
          GovernorProposalLogicV6: await GovernorProposalLogicLibV6.getAddress(),
          GovernorQuorumLogicV6: await GovernorQuorumLogicLibV6.getAddress(),
          GovernorStateLogicV6: await GovernorStateLogicLibV6.getAddress(),
          GovernorVotesLogicV6: await GovernorVotesLogicLibV6.getAddress(),
        },
        {
          GovernorClockLogicV7: await GovernorClockLogicLibV7.getAddress(),
          GovernorConfiguratorV7: await GovernorConfiguratorLibV7.getAddress(),
          GovernorDepositLogicV7: await GovernorDepositLogicLibV7.getAddress(),
          GovernorFunctionRestrictionsLogicV7: await GovernorFunctionRestrictionsLogicLibV7.getAddress(),
          GovernorProposalLogicV7: await GovernorProposalLogicLibV7.getAddress(),
          GovernorQuorumLogicV7: await GovernorQuorumLogicLibV7.getAddress(),
          GovernorStateLogicV7: await GovernorStateLogicLibV7.getAddress(),
          GovernorVotesLogicV7: await GovernorVotesLogicLibV7.getAddress(),
        },
        {
          GovernorClockLogicV8: await GovernorClockLogicLibV8.getAddress(),
          GovernorConfiguratorV8: await GovernorConfiguratorLibV8.getAddress(),
          GovernorDepositLogicV8: await GovernorDepositLogicLibV8.getAddress(),
          GovernorFunctionRestrictionsLogicV8: await GovernorFunctionRestrictionsLogicLibV8.getAddress(),
          GovernorProposalLogicV8: await GovernorProposalLogicLibV8.getAddress(),
          GovernorQuorumLogicV8: await GovernorQuorumLogicLibV8.getAddress(),
          GovernorStateLogicV8: await GovernorStateLogicLibV8.getAddress(),
          GovernorVotesLogicV8: await GovernorVotesLogicLibV8.getAddress(),
        },
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
      ],
    },
  )) as B3TRGovernor

  const relayerRewardsPool = (await deployAndUpgrade(
    ["RelayerRewardsPool"],
    [
      [
        owner.address, // admin
        owner.address, // upgrader
        await b3tr.getAddress(), // b3trAddress
        await emissions.getAddress(), // emissionsAddress
        await xAllocationVoting.getAddress(), // xAllocationVotingAddress
      ],
    ],
    {
      versions: [undefined],
      logOutput: false,
    },
  )) as RelayerRewardsPool

  // Deploy DBAPool V1
  const dbaPoolV1 = (await deployProxy("DBAPoolV1", [
    {
      admin: owner.address,
      x2EarnApps: await x2EarnAppsV7.getAddress(),
      xAllocationPool: await xAllocationPool.getAddress(),
      x2earnRewardsPool: await x2EarnRewardsPool.getAddress(),
      b3tr: await b3tr.getAddress(),
      distributionStartRound: 1,
    },
  ])) as DBAPoolV1

  // Grant UPGRADER_ROLE to owner so we can upgrade
  const UPGRADER_ROLE = await dbaPoolV1.UPGRADER_ROLE()
  const grantRoleTx = await dbaPoolV1.connect(owner).grantRole(UPGRADER_ROLE, owner.address)
  await grantRoleTx.wait()

  // Upgrade to V2
  const dbaPoolV2 = (await upgradeProxy("DBAPoolV1", "DBAPoolV2", await dbaPoolV1.getAddress(), [], {
    version: 2,
    logOutput: false,
  })) as DBAPoolV2

  // Upgrade to V3
  const dynamicBaseAllocationPool = (await upgradeProxy(
    "DBAPoolV2",
    "DBAPool",
    await dbaPoolV2.getAddress(),
    [owner.address], // treasuryAddress
    {
      version: 3,
      logOutput: false,
    },
  )) as DBAPool

  // Upgrade to X2EarnAppsV8
  // This is done here because in versions > 7 the setters have been removed.
  // Setup the X2EarnApps XAllocationVote address
  await x2EarnAppsV7.connect(owner).setXAllocationVotingGovernor(await xAllocationVoting.getAddress())
  // Set up the X2EarnRewardsPool contract in x2EarnApps
  await x2EarnAppsV7.connect(owner).setX2EarnRewardsPoolContract(await x2EarnRewardsPool.getAddress())
  await x2EarnAppsV7
    .connect(owner)
    .setVeBetterPassportContract(await veBetterPassport.getAddress())
    .then(async tx => await tx.wait())

  // V8 flexible endorsement caps: 49 per node per app, 110 total per app
  const x2EarnApps = (await upgradeProxy("X2EarnAppsV7", "X2EarnApps", await x2EarnAppsV7.getAddress(), [49, 110], {
    version: 8,
    libraries: {
      AdministrationUtils: await AdministrationUtils.getAddress(),
      EndorsementUtils: await EndorsementUtils.getAddress(),
      VoteEligibilityUtils: await VoteEligibilityUtils.getAddress(),
      AppStorageUtils: await AppStorageUtils.getAddress(),
    },
  })) as X2EarnApps

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
    StargateNFT: await stargateNftMock.getAddress(),
    DynamicBaseAllocationPool: await dynamicBaseAllocationPool.getAddress(),
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
      AppStorageUtils: await AppStorageUtils.getAddress(),
    },
    XAllocationVoting: {
      AutoVotingLogic: await AutoVotingLogic.getAddress(),
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
  // Set governor and veBetterPassport addresses in XAllocationVoting
  await xAllocationVoting.connect(owner).grantRole(await xAllocationVoting.DEFAULT_ADMIN_ROLE(), emissions.getAddress())
  await xAllocationVoting.connect(owner).grantRole(await xAllocationVoting.GOVERNANCE_ROLE(), owner.address)
  await xAllocationVoting.connect(owner).setB3TRGovernor(await governor.getAddress())
  await xAllocationVoting.connect(owner).setVeBetterPassport(await veBetterPassport.getAddress())

  // Set xAllocationGovernor in emissions
  await emissions.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

  // Grant action score manager role to X2EarnApps
  await veBetterPassport
    .connect(owner)
    .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnApps.getAddress())

  // Setup XAllocationPool addresses
  await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())
  await xAllocationPool.connect(owner).setEmissionsAddress(await emissions.getAddress())

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

  // Setup the RelayerRewardsPool contract
  await relayerRewardsPool
    .connect(owner)
    .grantRole(await relayerRewardsPool.POOL_ADMIN_ROLE(), await xAllocationVoting.getAddress())
    .then(async tx => await tx.wait())
  await relayerRewardsPool
    .connect(owner)
    .grantRole(await relayerRewardsPool.POOL_ADMIN_ROLE(), await voterRewards.getAddress())
    .then(async tx => await tx.wait())
  await xAllocationVoting
    .connect(owner)
    .grantRole(await xAllocationVoting.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address)
    .then(async tx => await tx.wait())
  await xAllocationVoting.connect(owner).setRelayerRewardsPoolAddress(await relayerRewardsPool.getAddress())
  await voterRewards.connect(owner).setRelayerRewardsPool(await relayerRewardsPool.getAddress())
  await voterRewards.connect(owner).setXAllocationVoting(await xAllocationVoting.getAddress())

  // Since x2EarnApps v5, new apps => new creator != owner
  // Token id 2, 3, 4, 5 are reserved for the creator NFTs
  await Promise.all([
    x2EarnCreator.safeMint(owner.address), // Mint for the owner
    ...creators.map(creator => x2EarnCreator.safeMint(creator.address)), // Mint for all creators
  ])

  // Set up the GrantsManager
  await grantsManager.connect(owner).setGovernorContract(await governor.getAddress())
  await grantsManager.connect(owner).grantRole(await grantsManager.GOVERNANCE_ROLE(), await governor.getAddress()) // prev initialized with (TEMP_GOVERNOR_ADDRESS= owner.address)
  await grantsManager.connect(owner).grantRole(await grantsManager.DEFAULT_ADMIN_ROLE(), owner.address)

  // Grant PROPOSAL_STATE_MANAGER_ROLE to owner in B3TRGovernor contract
  await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)

  // Bootstrap and start emissions
  if (bootstrapAndStartEmissions) {
    await callBootstrapAndStartEmissions({ b3tr, emissions, minterAccount, owner })
  }

  cachedDeployInstance = {
    B3trContract,
    b3tr,
    vot3,
    timeLock,
    x2EarnCreator,
    grantsManager,
    governor,
    galaxyMember,
    x2EarnApps,
    xAllocationVoting,
    nodeManagement: nodeManagementMock,
    xAllocationPool,
    emissions,
    voterRewards,
    dynamicBaseAllocationPool,
    owner,
    otherAccount,
    minterAccount,
    timelockAdmin,
    otherAccounts,
    creators,
    treasury,
    x2EarnRewardsPool,
    veBetterPassport,
    veBetterPassportV1,
    veBetterPassportV2,
    veBetterPassportV3,
    b3trMultiSig,
    governorClockLogicLib: GovernorClockLogicLib,
    governorConfiguratorLib: GovernorConfiguratorLib,
    governorDepositLogicLib: GovernorDepositLogicLib,
    governorFunctionRestrictionsLogicLib: GovernorFunctionRestrictionsLogicLib,
    governorGovernanceLogicLib: GovernorGovernanceLogicLib,
    governorProposalLogicLib: GovernorProposalLogicLib,
    governorQuorumLogicLib: GovernorQuorumLogicLib,
    governorStateLogicLib: GovernorStateLogicLib,
    governorVotesLogicLib: GovernorVotesLogicLib,
    governorClockLogicLibV1: GovernorClockLogicLibV1,
    governorConfiguratorLibV1: GovernorConfiguratorLibV1,
    governorDepositLogicLibV1: GovernorDepositLogicLibV1,
    governorFunctionRestrictionsLogicLibV1: GovernorFunctionRestrictionsLogicLibV1,
    governorGovernanceLogicLibV1: GovernorGovernanceLogicLibV1,
    governorProposalLogicLibV1: GovernorProposalLogicLibV1,
    governorQuorumLogicLibV1: GovernorQuorumLogicLibV1,
    governorStateLogicLibV1: GovernorStateLogicLibV1,
    governorVotesLogicLibV1: GovernorVotesLogicLibV1,
    governorClockLogicLibV3: GovernorClockLogicLibV3,
    governorConfiguratorLibV3: GovernorConfiguratorLibV3,
    governorDepositLogicLibV3: GovernorDepositLogicLibV3,
    governorFunctionRestrictionsLogicLibV3: GovernorFunctionRestrictionsLogicLibV3,
    governorGovernanceLogicLibV3: GovernorGovernanceLogicLibV3,
    governorProposalLogicLibV3: GovernorProposalLogicLibV3,
    governorQuorumLogicLibV3: GovernorQuorumLogicLibV3,
    governorStateLogicLibV3: GovernorStateLogicLibV3,
    governorVotesLogicLibV3: GovernorVotesLogicLibV3,
    governorClockLogicLibV4: GovernorClockLogicLibV4,
    governorConfiguratorLibV4: GovernorConfiguratorLibV4,
    governorDepositLogicLibV4: GovernorDepositLogicLibV4,
    governorFunctionRestrictionsLogicLibV4: GovernorFunctionRestrictionsLogicLibV4,
    governorGovernanceLogicLibV4: GovernorGovernanceLogicLibV4,
    governorProposalLogicLibV4: GovernorProposalLogicLibV4,
    governorQuorumLogicLibV4: GovernorQuorumLogicLibV4,
    governorStateLogicLibV4: GovernorStateLogicLibV4,
    governorVotesLogicLibV4: GovernorVotesLogicLibV4,
    governorClockLogicLibV5: GovernorClockLogicLibV5,
    governorConfiguratorLibV5: GovernorConfiguratorLibV5,
    governorDepositLogicLibV5: GovernorDepositLogicLibV5,
    governorFunctionRestrictionsLogicLibV5: GovernorFunctionRestrictionsLogicLibV5,
    governorGovernanceLogicLibV5: GovernorGovernanceLogicLibV5,
    governorProposalLogicLibV5: GovernorProposalLogicLibV5,
    governorQuorumLogicLibV5: GovernorQuorumLogicLibV5,
    governorStateLogicLibV5: GovernorStateLogicLibV5,
    governorVotesLogicLibV5: GovernorVotesLogicLibV5,
    governorClockLogicLibV6: GovernorClockLogicLibV6,
    governorConfiguratorLibV6: GovernorConfiguratorLibV6,
    governorDepositLogicLibV6: GovernorDepositLogicLibV6,
    governorFunctionRestrictionsLogicLibV6: GovernorFunctionRestrictionsLogicLibV6,
    governorGovernanceLogicLibV6: GovernorGovernanceLogicLibV6,
    governorProposalLogicLibV6: GovernorProposalLogicLibV6,
    governorQuorumLogicLibV6: GovernorQuorumLogicLibV6,
    governorStateLogicLibV6: GovernorStateLogicLibV6,
    governorVotesLogicLibV6: GovernorVotesLogicLibV6,
    governorClockLogicLibV7: GovernorClockLogicLibV7,
    governorConfiguratorLibV7: GovernorConfiguratorLibV7,
    governorDepositLogicLibV7: GovernorDepositLogicLibV7,
    governorFunctionRestrictionsLogicLibV7: GovernorFunctionRestrictionsLogicLibV7,
    governorGovernanceLogicLibV7: GovernorGovernanceLogicLibV7,
    governorProposalLogicLibV7: GovernorProposalLogicLibV7,
    governorQuorumLogicLibV7: GovernorQuorumLogicLibV7,
    governorStateLogicLibV7: GovernorStateLogicLibV7,
    governorVotesLogicLibV7: GovernorVotesLogicLibV7,
    governorClockLogicLibV8: GovernorClockLogicLibV8,
    governorConfiguratorLibV8: GovernorConfiguratorLibV8,
    governorDepositLogicLibV8: GovernorDepositLogicLibV8,
    governorFunctionRestrictionsLogicLibV8: GovernorFunctionRestrictionsLogicLibV8,
    governorGovernanceLogicLibV8: GovernorGovernanceLogicLibV8,
    governorProposalLogicLibV8: GovernorProposalLogicLibV8,
    governorQuorumLogicLibV8: GovernorQuorumLogicLibV8,
    governorStateLogicLibV8: GovernorStateLogicLibV8,
    governorVotesLogicLibV8: GovernorVotesLogicLibV8,
    passportChecksLogic: PassportChecksLogic,
    passportDelegationLogic: PassportDelegationLogic,
    passportEntityLogic: PassportEntityLogic,
    passportPersonhoodLogic: PassportPersonhoodLogic,
    passportPoPScoreLogic: PassportPoPScoreLogic,
    passportSignalingLogic: PassportSignalingLogic,
    passportWhitelistAndBlacklistLogic: PassportWhitelistAndBlacklistLogic,
    passportConfigurator: PassportConfigurator,
    passportChecksLogicV1: PassportChecksLogicV1,
    passportDelegationLogicV1: PassportDelegationLogicV1,
    passportEntityLogicV1: PassportEntityLogicV1,
    passportConfiguratorV1: PassportConfiguratorV1,
    passportPersonhoodLogicV1: PassportPersonhoodLogicV1,
    passportPoPScoreLogicV1: PassportPoPScoreLogicV1,
    passportSignalingLogicV1: PassportSignalingLogicV1,
    passportWhitelistAndBlacklistLogicV1: PassportWhitelistAndBlacklistLogicV1,
    passportChecksLogicV2: PassportChecksLogicV2,
    passportDelegationLogicV2: PassportDelegationLogicV2,
    passportEntityLogicV2: PassportEntityLogicV2,
    passportPersonhoodLogicV2: PassportPersonhoodLogicV2,
    passportPoPScoreLogicV2: PassportPoPScoreLogicV2,
    passportSignalingLogicV2: PassportSignalingLogicV2,
    passportWhitelistAndBlacklistLogicV2: PassportWhitelistAndBlacklistLogicV2,
    passportConfiguratorV2: PassportConfiguratorV2,
    passportChecksLogicV3: PassportChecksLogicV3,
    passportConfiguratorV3: PassportConfiguratorV3,
    passportEntityLogicV3: PassportEntityLogicV3,
    passportDelegationLogicV3: PassportDelegationLogicV3,
    passportPersonhoodLogicV3: PassportPersonhoodLogicV3,
    passportPoPScoreLogicV3: PassportPoPScoreLogicV3,
    passportSignalingLogicV3: PassportSignalingLogicV3,
    passportWhitelistAndBlacklistLogicV3: PassportWhitelistAndBlacklistLogicV3,
    administrationUtils: AdministrationUtils,
    endorsementUtils: EndorsementUtils,
    voteEligibilityUtils: VoteEligibilityUtils,
    appStorageUtils: AppStorageUtils,
    administrationUtilsV2: AdministrationUtilsV2,
    endorsementUtilsV2: EndorsementUtilsV2,
    voteEligibilityUtilsV2: VoteEligibilityUtilsV2,
    administrationUtilsV3: AdministrationUtilsV3,
    endorsementUtilsV3: EndorsementUtilsV3,
    voteEligibilityUtilsV3: VoteEligibilityUtilsV3,
    administrationUtilsV4: AdministrationUtilsV4,
    endorsementUtilsV4: EndorsementUtilsV4,
    voteEligibilityUtilsV4: VoteEligibilityUtilsV4,
    administrationUtilsV5: AdministrationUtilsV5,
    endorsementUtilsV5: EndorsementUtilsV5,
    voteEligibilityUtilsV5: VoteEligibilityUtilsV5,
    administrationUtilsV6: AdministrationUtilsV6,
    endorsementUtilsV6: EndorsementUtilsV6,
    voteEligibilityUtilsV6: VoteEligibilityUtilsV6,
    administrationUtilsV7: AdministrationUtilsV7,
    endorsementUtilsV7: EndorsementUtilsV7,
    voteEligibilityUtilsV7: VoteEligibilityUtilsV7,
    myErc721: myErc721,
    myErc1155: myErc1155,
    vthoTokenMock,
    vechainNodesMock,
    stargateNftMock,
    stargateMock,
    relayerRewardsPool,
    autoVotingLogic: AutoVotingLogic,
  }
  return cachedDeployInstance
}
