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
  MyERC20,
  MyERC721,
  MyERC1155,
  TokenAuction,
  B3TRGovernor,
  NodeManagementV3,
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
  GovernorClockLogicV5,
  GovernorConfiguratorV5,
  GovernorDepositLogicV5,
  GovernorFunctionRestrictionsLogicV5,
  GovernorProposalLogicV5,
  GovernorQuorumLogicV5,
  GovernorStateLogicV5,
  PassportChecksLogic,
  PassportEntityLogic,
  PassportPoPScoreLogic,
  PassportSignalingLogic,
  PassportWhitelistAndBlacklistLogic,
  PassportPersonhoodLogic,
  PassportDelegationLogic,
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
  AdministrationUtilsV2,
  VoteEligibilityUtilsV2,
  EndorsementUtilsV2,
  AdministrationUtilsV3,
  VoteEligibilityUtilsV3,
  EndorsementUtilsV3,
  AdministrationUtilsV4,
  VoteEligibilityUtilsV4,
  EndorsementUtilsV4,
  AdministrationUtilsV5,
  VoteEligibilityUtilsV5,
  EndorsementUtilsV5,
  X2EarnCreator,
  VeBetterPassportV2,
  PassportConfiguratorV2,
  PassportWhitelistAndBlacklistLogicV2,
  PassportPoPScoreLogicV2,
  PassportPersonhoodLogicV2,
  PassportEntityLogicV2,
  PassportDelegationLogicV2,
  PassportChecksLogicV2,
  PassportSignalingLogicV2,
  B3TRMultiSig,
  GovernorVotesLogicV5,
  VeBetterPassportV3,
  PassportPersonhoodLogicV3,
  PassportEntityLogicV3,
  PassportChecksLogicV3,
  PassportConfiguratorV3,
  PassportDelegationLogicV3,
  PassportSignalingLogicV3,
  PassportPoPScoreLogicV3,
  PassportWhitelistAndBlacklistLogicV3,
  GovernorQuorumLogicV6,
  GovernorVotesLogicV6,
  GovernorStateLogicV6,
  GovernorFunctionRestrictionsLogicV6,
  GovernorProposalLogicV6,
  GovernorDepositLogicV6,
  GovernorConfiguratorV6,
  GovernorClockLogicV6,
  StargateNFT,
  GrantsManager,
  RelayerRewardsPool,
  AutoVotingLogic,
  DBAPool,
} from "../../typechain-types"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import {
  deployAndUpgrade,
  deployProxy,
  deployProxyOnly,
  initializeProxy,
  upgradeProxy,
  deployStargateProxyWithoutInitialization,
} from "../../scripts/helpers"
import { bootstrapAndStartEmissions as callBootstrapAndStartEmissions } from "./common"
import { governanceLibraries, passportLibraries } from "../../scripts/libraries"
import { setWhitelistedFunctions } from "../../scripts/deploy/deployAll"
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
import { APPS } from "../../scripts/deploy/setup"
import { deployStargateNFTLibraries } from "../../scripts/deploy/deploys/deployStargateNftLibraries"
import { initialTokenLevels, vthoRewardPerBlock } from "../../contracts/mocks/const"
import { autoVotingLibraries } from "../../scripts/libraries"

export interface DeployInstance {
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

  // Governance
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
  governorClockLogicLibV5: GovernorClockLogicV5
  governorConfiguratorLibV5: GovernorConfiguratorV5
  governorDepositLogicLibV5: GovernorDepositLogicV5
  governorFunctionRestrictionsLogicLibV5: GovernorFunctionRestrictionsLogicV5
  governorProposalLogicLibV5: GovernorProposalLogicV5
  governorQuorumLogicLibV5: GovernorQuorumLogicV5
  governorStateLogicLibV5: GovernorStateLogicV5
  governorVotesLogicLibV5: GovernorVotesLogicV5
  governorClockLogicLibV6: GovernorClockLogicV6
  governorConfiguratorLibV6: GovernorConfiguratorV6
  governorDepositLogicLibV6: GovernorDepositLogicV6
  governorFunctionRestrictionsLogicLibV6: GovernorFunctionRestrictionsLogicV6
  governorProposalLogicLibV6: GovernorProposalLogicV6
  governorQuorumLogicLibV6: GovernorQuorumLogicV6
  governorStateLogicLibV6: GovernorStateLogicV6
  governorVotesLogicLibV6: GovernorVotesLogicV6

  // GrantsManager
  grantsManager: GrantsManager

  // Passport
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
  passportChecksLogicV3: PassportChecksLogicV3
  passportConfiguratorV3: PassportConfiguratorV3
  passportEntityLogicV3: PassportEntityLogicV3
  passportDelegationLogicV3: PassportDelegationLogicV3
  passportPersonhoodLogicV3: PassportPersonhoodLogicV3
  passportPoPScoreLogicV3: PassportPoPScoreLogicV3
  passportSignalingLogicV3: PassportSignalingLogicV3
  passportWhitelistBlacklistLogicV3: PassportWhitelistAndBlacklistLogicV3
  passportConfigurator: any // no abi for this library, which means a typechain is not generated
  // X2Earn Libraries
  administrationUtils: AdministrationUtils
  endorsementUtils: EndorsementUtils
  voteEligibilityUtils: VoteEligibilityUtils
  administrationUtilsV2: AdministrationUtilsV2
  endorsementUtilsV2: EndorsementUtilsV2
  voteEligibilityUtilsV2: VoteEligibilityUtilsV2
  administrationUtilsV3: AdministrationUtilsV3
  endorsementUtilsV3: EndorsementUtilsV3
  voteEligibilityUtilsV3: VoteEligibilityUtilsV3
  administrationUtilsV4: AdministrationUtilsV4
  endorsementUtilsV4: EndorsementUtilsV4
  voteEligibilityUtilsV4: VoteEligibilityUtilsV4
  administrationUtilsV5: AdministrationUtilsV5
  endorsementUtilsV5: EndorsementUtilsV5
  voteEligibilityUtilsV5: VoteEligibilityUtilsV5

  myErc721: MyERC721 | undefined
  myErc1155: MyERC1155 | undefined
  vechainNodesMock: TokenAuction
  b3trMultiSig: B3TRMultiSig

  // StarGate
  stargateNftMock: StargateNFT
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
  const creators = otherAccounts.slice(0, APPS.length) // otherAcounts[1]...otherAccounts[8] reserved for creators

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
    GovernorClockLogicLibV5,
    GovernorConfiguratorLibV5,
    GovernorFunctionRestrictionsLogicLibV5,
    GovernorGovernanceLogicLibV5,
    GovernorQuorumLogicLibV5,
    GovernorProposalLogicLibV5,
    GovernorVotesLogicLibV5,
    GovernorDepositLogicLibV5,
    GovernorStateLogicLibV5,
    GovernorClockLogicLibV6,
    GovernorConfiguratorLibV6,
    GovernorDepositLogicLibV6,
    GovernorFunctionRestrictionsLogicLibV6,
    GovernorProposalLogicLibV6,
    GovernorQuorumLogicLibV6,
    GovernorStateLogicLibV6,
    GovernorVotesLogicLibV6,
  } = await governanceLibraries()

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
  } = await passportLibraries()

  // Deploy X2Earn AppLibraries
  const {
    // Latest
    AdministrationUtils,
    EndorsementUtils,
    VoteEligibilityUtils,
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
  } = await x2EarnLibraries()

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

  // Deploy StargateNFT libraries
  const {
    StargateNFTClockLib,
    StargateNFTSettingsLib,
    StargateNFTTokenLib,
    StargateNFTMintingLib,
    StargateNFTVetGeneratedVthoLib,
    StargateNFTLevelsLib,
  } = await deployStargateNFTLibraries({ logOutput: false })

  // Deploy StargateNFT proxy
  const stargateNftAddress = await deployStargateProxyWithoutInitialization(
    "StargateNFT",
    {
      Clock: await StargateNFTClockLib.getAddress(),
      MintingLogic: await StargateNFTMintingLib.getAddress(),
      Settings: await StargateNFTSettingsLib.getAddress(),
      Token: await StargateNFTTokenLib.getAddress(),
      VetGeneratedVtho: await StargateNFTVetGeneratedVthoLib.getAddress(),
      Levels: await StargateNFTLevelsLib.getAddress(),
    },
    false,
  )

  // Deploy StargateDelegation proxy
  const stargateDelegateAddress = await deployStargateProxyWithoutInitialization("StargateDelegation", {}, false)

  // Initialize StargateNFT proxy
  const stargateNftMock = (await initializeProxy(
    stargateNftAddress,
    "StargateNFT",
    [
      {
        tokenCollectionName: "VeChain Node Token",
        tokenCollectionSymbol: "VNT",
        baseTokenURI: "ipfs://mock/",
        admin: owner.address,
        upgrader: owner.address,
        pauser: owner.address,
        levelOperator: owner.address,
        legacyNodes: await vechainNodesMock.getAddress(), // from TokenAuction mock
        stargateDelegation: stargateDelegateAddress,
        legacyLastTokenId: 13, // see setup.ts, seeding for 5 + APPS.length accounts
        levelsAndSupplies: initialTokenLevels, // TODO: review implementation
        vthoToken: vthoAddress,
      },
    ],
    {
      Clock: await StargateNFTClockLib.getAddress(),
      MintingLogic: await StargateNFTMintingLib.getAddress(),
      Settings: await StargateNFTSettingsLib.getAddress(),
      Token: await StargateNFTTokenLib.getAddress(),
      VetGeneratedVtho: await StargateNFTVetGeneratedVthoLib.getAddress(),
      Levels: await StargateNFTLevelsLib.getAddress(),
    },
  )) as StargateNFT

  // Initialize StargateDelegation proxy
  const stargateDelegateMock = await initializeProxy(
    stargateDelegateAddress,
    "StargateDelegation",
    [
      {
        upgrader: owner.address,
        admin: owner.address,
        stargateNFT: stargateNftAddress,
        vthoToken: vthoAddress,
        vthoRewardPerBlock, // CHECK - as per stargate local config
        delegationPeriod: 10, // CHECK - as per stargate local config
        operator: owner.address,
      },
    ],
    {},
  )

  // Add stargateNftMock as operator to vechainNodesMock, so that it can destroy legacy nodes
  await vechainNodesMock.addOperator(await stargateNftMock.getAddress())

  const nodeManagementMock = await deployAndUpgrade(
    ["NodeManagementV1", "NodeManagementV2", "NodeManagementV3"],
    [[await vechainNodesMock.getAddress(), owner.address, owner.address], [], [stargateNftAddress]],
    {
      versions: [undefined, 2, 3],
      logOutput: false,
    },
  )

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

  const x2EarnCreator = (await deployProxy("X2EarnCreator", [config.CREATOR_NFT_URI, owner.address])) as X2EarnCreator

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
    ["GalaxyMemberV1", "GalaxyMemberV2", "GalaxyMemberV3", "GalaxyMemberV4", "GalaxyMember"],
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
    ],
    {
      versions: [undefined, 2, 3, 4, 5],
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

  const x2EarnApps = (await deployAndUpgrade(
    ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnAppsV3", "X2EarnAppsV4", "X2EarnAppsV5", "X2EarnApps"],
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
    ],
    {
      versions: [undefined, 2, 3, 4, 5, 6],
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
          AdministrationUtils: await AdministrationUtils.getAddress(),
          EndorsementUtils: await EndorsementUtils.getAddress(),
          VoteEligibilityUtils: await VoteEligibilityUtils.getAddress(),
        },
      ],
    },
  )) as X2EarnApps

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
      [owner.address, owner.address, owner.address, await b3tr.getAddress(), await x2EarnApps.getAddress()],
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
        await x2EarnApps.getAddress(),
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
          x2EarnAppsAddress: await x2EarnApps.getAddress(),
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
  const grantsManager = (await deployProxy("GrantsManager", [
    TEMP_GOVERNOR_ADDRESS, // governor address
    await treasury.getAddress(), // treasury address
    owner.address, // admin
    await b3tr.getAddress(), // b3tr address
    config.MINIMUM_MILESTONE_COUNT, // minimum milestone count
  ])) as GrantsManager

  const governor = (await deployAndUpgrade(
    [
      "B3TRGovernorV1",
      "B3TRGovernorV2",
      "B3TRGovernorV3",
      "B3TRGovernorV4",
      "B3TRGovernorV5",
      "B3TRGovernorV6",
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
    ],
    {
      versions: [undefined, 2, 3, 4, 5, 6, 7],
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

  const dynamicBaseAllocationPool = (await deployProxy("DBAPool", [
    {
      admin: owner.address,
      x2EarnApps: await x2EarnApps.getAddress(),
      xAllocationPool: await xAllocationPool.getAddress(),
      x2earnRewardsPool: await x2EarnRewardsPool.getAddress(),
      b3tr: await b3tr.getAddress(),
      distributionStartRound: 1,
    },
  ])) as DBAPool

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

  // Setup the X2EarnApps XAllocationVote address
  await x2EarnApps.connect(owner).setXAllocationVotingGovernor(await xAllocationVoting.getAddress())
  // Set up the X2EarnRewardsPool contract in x2EarnApps
  await x2EarnApps.connect(owner).setX2EarnRewardsPoolContract(await x2EarnRewardsPool.getAddress())

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
    governorClockLogicLibV5: GovernorClockLogicLibV5,
    governorConfiguratorLibV5: GovernorConfiguratorLibV5,
    governorDepositLogicLibV5: GovernorDepositLogicLibV5,
    governorFunctionRestrictionsLogicLibV5: GovernorFunctionRestrictionsLogicLibV5,
    governorProposalLogicLibV5: GovernorProposalLogicLibV5,
    governorQuorumLogicLibV5: GovernorQuorumLogicLibV5,
    governorStateLogicLibV5: GovernorStateLogicLibV5,
    governorVotesLogicLibV5: GovernorVotesLogicLibV5,
    governorClockLogicLibV6: GovernorClockLogicLibV6,
    governorConfiguratorLibV6: GovernorConfiguratorLibV6,
    governorDepositLogicLibV6: GovernorDepositLogicLibV6,
    governorFunctionRestrictionsLogicLibV6: GovernorFunctionRestrictionsLogicLibV6,
    governorProposalLogicLibV6: GovernorProposalLogicLibV6,
    governorQuorumLogicLibV6: GovernorQuorumLogicLibV6,
    governorStateLogicLibV6: GovernorStateLogicLibV6,
    governorVotesLogicLibV6: GovernorVotesLogicLibV6,
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
    passportChecksLogicV3: PassportChecksLogicV3,
    passportConfiguratorV3: PassportConfiguratorV3,
    passportEntityLogicV3: PassportEntityLogicV3,
    passportDelegationLogicV3: PassportDelegationLogicV3,
    passportPersonhoodLogicV3: PassportPersonhoodLogicV3,
    passportPoPScoreLogicV3: PassportPoPScoreLogicV3,
    passportSignalingLogicV3: PassportSignalingLogicV3,
    passportWhitelistBlacklistLogicV3: PassportWhitelistAndBlacklistLogicV3,
    administrationUtils: AdministrationUtils,
    endorsementUtils: EndorsementUtils,
    voteEligibilityUtils: VoteEligibilityUtils,
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
    myErc721: myErc721,
    myErc1155: myErc1155,
    vthoTokenMock,
    vechainNodesMock,
    stargateNftMock,
    relayerRewardsPool,
    autoVotingLogic: AutoVotingLogic,
  }
  return cachedDeployInstance
}
