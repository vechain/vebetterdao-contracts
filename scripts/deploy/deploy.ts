import { ethers, network } from "hardhat"
import {
  B3TR,
  Emissions,
  VOT3,
  XAllocationVoting,
  TimeLock,
  B3TRGovernor,
  GalaxyMember,
  VoterRewards,
  XAllocationPool,
  Treasury,
  X2EarnRewardsPool,
  X2EarnApps,
  NodeManagement,
  VeBetterPassport,
  VeBetterPassportV1,
  X2EarnCreator,
  VeBetterPassportV2,
} from "../../typechain-types"
import { ContractsConfig } from "../../config/contracts"
import { HttpNetworkConfig } from "hardhat/types"
import { setupLocalEnvironment, setupTestEnvironment } from "./setup"
import { simulateRounds } from "./simulateRounds"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { shouldRunSimulation } from "../../config/contracts"
import {
  deployAndUpgrade,
  deployProxy,
  deployProxyOnly,
  initializeProxy,
  saveContractsToFile,
  upgradeProxy,
} from "../helpers"
import { governanceLibraries, passportLibraries } from "../libraries"
import {
  transferAdminRole,
  transferContractsAddressManagerRole,
  transferDecaySettingsManagerRole,
  transferGovernanceRole,
  transferGovernorFunctionSettingsRole,
  transferMinterRole,
  transferSettingsManagerRole,
  transferUpgraderRole,
  validateContractRole,
} from "../helpers/roles"
import { x2EarnLibraries } from "../libraries/x2EarnLibraries"

// GalaxyMember NFT Values
const name = "VeBetterDAO Galaxy Member"
const symbol = "GM"

export async function deployAll(config: ContractsConfig) {
  const start = performance.now()
  const networkConfig = network.config as HttpNetworkConfig
  console.log(
    `================  Deploying contracts on ${network.name} (${networkConfig.url}) with ${config.NEXT_PUBLIC_APP_ENV} configurations `,
  )
  const [deployer] = await ethers.getSigners()
  console.log(`================  Address used to deploy: ${deployer.address}`)

  // We use a temporary admin to deploy and initialize contracts then transfer role to the real admin
  // Also we have many roles in our contracts but we currently use one wallet for all roles
  const TEMP_ADMIN = network.name === "vechain_solo" ? config.CONTRACTS_ADMIN_ADDRESS : deployer.address
  console.log("================================================================================")
  console.log("Temporary admin set to ", TEMP_ADMIN)
  console.log("Final admin will be set to ", config.CONTRACTS_ADMIN_ADDRESS)
  console.log("================================================================================")
  // ---------- Contracts Deployment ---------- //
  console.log(`================  Contracts Deployment Initiated `)
  // ---------------------- Deploy Libraries ----------------------
  console.log("Deploying Governance Libraries")
  const {
    GovernorClockLogicLibV1,
    GovernorConfiguratorLibV1,
    GovernorDepositLogicLibV1,
    GovernorFunctionRestrictionsLogicLibV1,
    GovernorProposalLogicLibV1,
    GovernorQuorumLogicLibV1,
    GovernorVotesLogicLibV1,
    GovernorStateLogicLibV1,
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
    GovernorClockLogicLib,
    GovernorConfiguratorLib,
    GovernorDepositLogicLib,
    GovernorFunctionRestrictionsLogicLib,
    GovernorProposalLogicLib,
    GovernorQuorumLogicLib,
    GovernorVotesLogicLib,
    GovernorStateLogicLib,
  } = await governanceLibraries()

  console.log("Deploying VeBetter Passport Libraries")
  // Deploy Passport Libraries
  const {
    PassportChecksLogicV1,
    PassportConfiguratorV1,
    PassportEntityLogicV1,
    PassportDelegationLogicV1,
    PassportPersonhoodLogicV1,
    PassportPoPScoreLogicV1,
    PassportSignalingLogicV1,
    PassportWhitelistAndBlacklistLogicV1,
    PassportChecksLogicV2,
    PassportConfiguratorV2,
    PassportEntityLogicV2,
    PassportDelegationLogicV2,
    PassportPersonhoodLogicV2,
    PassportPoPScoreLogicV2,
    PassportSignalingLogicV2,
    PassportWhitelistAndBlacklistLogicV2,
    PassportChecksLogic,
    PassportConfigurator,
    PassportEntityLogic,
    PassportDelegationLogic,
    PassportPersonhoodLogic,
    PassportPoPScoreLogic,
    PassportSignalingLogic,
    PassportWhitelistAndBlacklistLogic,
  } = await passportLibraries()

  console.log("Deploying X2Earn App Libraries")
  const {
    AdministrationUtils,
    EndorsementUtils,
    VoteEligibilityUtils,
    AdministrationUtilsV2,
    EndorsementUtilsV2,
    VoteEligibilityUtilsV2,
  } = await x2EarnLibraries()

  let vechainNodesAddress = "0xb81E9C5f9644Dec9e5e3Cac86b4461A222072302" // this is the mainnet address

  let vechainNodesMock = await ethers.getContractAt("TokenAuction", config.VECHAIN_NODES_CONTRACT_ADDRESS)
  if (network.name !== "vechain_mainnet") {
    console.log("Deploying Vechain Nodes mock contracts")

    const TokenAuctionLock = await ethers.getContractFactory("TokenAuction")
    vechainNodesMock = await TokenAuctionLock.deploy()
    await vechainNodesMock.waitForDeployment()

    const ClockAuctionLock = await ethers.getContractFactory("ClockAuction")
    const clockAuctionContract = await ClockAuctionLock.deploy(await vechainNodesMock.getAddress(), TEMP_ADMIN)

    await vechainNodesMock.setSaleAuctionAddress(await clockAuctionContract.getAddress())

    await vechainNodesMock.addOperator(TEMP_ADMIN)
    vechainNodesAddress = await vechainNodesMock.getAddress()

    console.log("Vechain Nodes Mock deployed at: ", await vechainNodesMock.getAddress())
  }

  // ---------------------- Deploy Contracts ----------------------
  console.log("Deploying VeBetter DAO contracts")
  const b3tr = await deployB3trToken(
    TEMP_ADMIN,
    TEMP_ADMIN, // Minter
    config.CONTRACTS_ADMIN_ADDRESS, // Pauser
  )

  const vot3 = (await deployProxy(
    "VOT3",
    [
      config.CONTRACTS_ADMIN_ADDRESS, // admin
      config.CONTRACTS_ADMIN_ADDRESS, // pauser
      config.CONTRACTS_ADMIN_ADDRESS, // upgrader
      await b3tr.getAddress(),
    ],
    undefined,
    true,
  )) as VOT3

  const timelock = (await deployProxy(
    "TimeLock",
    [
      config.TIMELOCK_MIN_DELAY,
      [], // proposers
      [], // executors
      TEMP_ADMIN, // admin
      config.CONTRACTS_ADMIN_ADDRESS, // upgrader
    ],
    undefined,
    true,
  )) as TimeLock

  const x2EarnCreator = (await deployProxy("X2EarnCreator", [TEMP_ADMIN, TEMP_ADMIN])) as X2EarnCreator

  const treasury = (await deployProxy(
    "Treasury",
    [
      await b3tr.getAddress(),
      await vot3.getAddress(),
      await timelock.getAddress(),
      TEMP_ADMIN, // admin
      config.CONTRACTS_ADMIN_ADDRESS, // upgrader
      config.CONTRACTS_ADMIN_ADDRESS, //pauser
      config.TREASURY_TRANSFER_LIMIT_VET,
      config.TREASURY_TRANSFER_LIMIT_B3TR,
      config.TREASURY_TRANSFER_LIMIT_VOT3,
      config.TREASURY_TRANSFER_LIMIT_VTHO,
    ],
    undefined,
    true,
  )) as Treasury

  // Deploy NodeManagement
  const nodeManagement = (await deployAndUpgrade(
    ["NodeManagementV1", "NodeManagement"],
    [[vechainNodesAddress, config.CONTRACTS_ADMIN_ADDRESS, config.CONTRACTS_ADMIN_ADDRESS], []],
    {
      versions: [undefined, 2],
      logOutput: true,
    },
  )) as NodeManagement

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

  // Set XAllocationVoting to temp address
  const X_ALLOCATION_ADRESS_TEMP = TEMP_ADMIN
  const x2EarnApps = (await deployAndUpgrade(
    ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnApps"],
    [
      [
        config.XAPP_BASE_URI,
        [TEMP_ADMIN], //admins
        TEMP_ADMIN, // upgrader
        TEMP_ADMIN, // governance role
      ],
      [
        config.XAPP_GRACE_PERIOD,
        await nodeManagement.getAddress(),
        veBetterPassportContractAddress,
        await x2EarnCreator.getAddress(),
      ],
      [config.X2EARN_NODE_COOLDOWN_PERIOD, X_ALLOCATION_ADRESS_TEMP],
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
      [
        config.CONTRACTS_ADMIN_ADDRESS, // admin
        config.CONTRACTS_ADMIN_ADDRESS, // contracts address manager
        TEMP_ADMIN, // upgrader //TODO: transferRole
        await b3tr.getAddress(),
        await x2EarnApps.getAddress(),
      ],
      [
        config.CONTRACTS_ADMIN_ADDRESS, // impact admin address
        config.X_2_EARN_INITIAL_IMPACT_KEYS, // impact keys
      ],
      [veBetterPassportContractAddress],
      [],
      [],
    ],
    {
      logOutput: true,
      versions: [undefined, 2, 3, 4, 5],
    },
  )) as X2EarnRewardsPool

  const xAllocationPool = (await deployAndUpgrade(
    ["XAllocationPoolV1", "XAllocationPoolV2", "XAllocationPoolV3", "XAllocationPool"],
    [
      [
        TEMP_ADMIN, // admin
        TEMP_ADMIN, // upgrader
        TEMP_ADMIN, // contractsAddressManager
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
      logOutput: true,
    },
  )) as XAllocationPool

  const galaxyMember = (await deployAndUpgrade(
    ["GalaxyMemberV1", "GalaxyMemberV2", "GalaxyMember"],
    [
      [
        {
          name: name,
          symbol: symbol,
          admin: TEMP_ADMIN,
          upgrader: config.CONTRACTS_ADMIN_ADDRESS,
          pauser: config.CONTRACTS_ADMIN_ADDRESS,
          minter: config.CONTRACTS_ADMIN_ADDRESS,
          contractsAddressManager: TEMP_ADMIN,
          maxLevel: config.GM_NFT_MAX_LEVEL,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ],
      [
        await vechainNodesMock.getAddress(),
        await nodeManagement.getAddress(),
        TEMP_ADMIN,
        config.GM_NFT_NODE_TO_FREE_LEVEL,
      ],
      [],
    ],
    {
      versions: [undefined, 2, 3],
      logOutput: true,
    },
  )) as GalaxyMember

  const emissions = (await deployAndUpgrade(
    ["EmissionsV1", "Emissions"],
    [
      [
        {
          minter: TEMP_ADMIN,
          admin: TEMP_ADMIN,
          upgrader: TEMP_ADMIN,
          contractsAddressManager: TEMP_ADMIN,
          decaySettingsManager: TEMP_ADMIN,
          b3trAddress: await b3tr.getAddress(),
          destinations: [
            await xAllocationPool.getAddress(),
            config.VOTE_2_EARN_POOL_ADDRESS,
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
      [config.EMISSIONS_IS_NOT_ALIGNED],
    ],
    {
      versions: [undefined, 2],
      logOutput: true,
    },
  )) as Emissions

  const voterRewards = (await deployAndUpgrade(
    ["VoterRewardsV1", "VoterRewardsV2", "VoterRewardsV3", "VoterRewards"],
    [
      [
        TEMP_ADMIN, // admin
        TEMP_ADMIN, // upgrader // TODO: transferRole
        config.CONTRACTS_ADMIN_ADDRESS, // contractsAddressManager
        await emissions.getAddress(),
        await galaxyMember.getAddress(),
        await b3tr.getAddress(),
        config.VOTER_REWARDS_LEVELS,
        config.VOTER_REWARDS_MULTIPLIER,
      ],
      [],
      [],
      [],
    ],
    {
      versions: [undefined, 2, 3, 4],
      logOutput: true,
    },
  )) as VoterRewards

  const xAllocationVoting = (await deployAndUpgrade(
    ["XAllocationVotingV1", "XAllocationVotingV2", "XAllocationVotingV3", "XAllocationVoting"],
    [
      [
        {
          vot3Token: await vot3.getAddress(),
          quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE,
          initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1,
          timeLock: await timelock.getAddress(),
          voterRewards: await voterRewards.getAddress(),
          emissions: await emissions.getAddress(),
          admins: [await timelock.getAddress(), TEMP_ADMIN],
          upgrader: TEMP_ADMIN,
          contractsAddressManager: TEMP_ADMIN,
          x2EarnAppsAddress: await x2EarnApps.getAddress(),
          baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
          appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
          votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
        },
      ],
      [veBetterPassportContractAddress],
      [],
      [],
    ],
    {
      versions: [undefined, 2, 3, 4],
      logOutput: true,
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
        admin: config.CONTRACTS_ADMIN_ADDRESS, // admins
        botSignaler: config.CONTRACTS_ADMIN_ADDRESS, // botSignaler
        upgrader: TEMP_ADMIN, // upgrader
        settingsManager: TEMP_ADMIN, // settingsManager
        roleGranter: TEMP_ADMIN, // roleGranter
        blacklister: config.CONTRACTS_ADMIN_ADDRESS, // blacklister
        whitelister: config.CONTRACTS_ADMIN_ADDRESS, // whitelistManager
        actionRegistrar: config.CONTRACTS_ADMIN_ADDRESS, // actionRegistrar
        actionScoreManager: config.CONTRACTS_ADMIN_ADDRESS, // actionScoreManager
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
    "VeBetterPassportV3",
    await veBetterPassportV2.getAddress(),
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

  const governor = (await deployAndUpgrade(
    ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4", "B3TRGovernor"],
    [
      [
        {
          vot3Token: await vot3.getAddress(),
          timelock: await timelock.getAddress(),
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
          governorAdmin: TEMP_ADMIN,
          pauser: config.CONTRACTS_ADMIN_ADDRESS,
          contractsAddressManager: config.CONTRACTS_ADMIN_ADDRESS,
          proposalExecutor: config.CONTRACTS_ADMIN_ADDRESS,
          governorFunctionSettingsRoleAddress: TEMP_ADMIN,
        },
      ],
      [],
      [],
      [veBetterPassportContractAddress],
      [],
    ],
    {
      versions: [undefined, 2, 3, 4, 5],
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
          GovernorProposalLogicV1: await GovernorProposalLogicLibV1.getAddress(),
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
      logOutput: true,
    },
  )) as B3TRGovernor

  const date = new Date(performance.now() - start)
  console.log(`================  Contracts deployed in ${date.getMinutes()}m ${date.getSeconds()}s `)

  const contractAddresses: Record<string, string> = {
    B3TR: await b3tr.getAddress(),
    B3TRGovernor: await governor.getAddress(),
    Emissions: await emissions.getAddress(),
    GalaxyMember: await galaxyMember.getAddress(),
    TimeLock: await timelock.getAddress(),
    Treasury: await treasury.getAddress(),
    VOT3: await vot3.getAddress(),
    VoterRewards: await voterRewards.getAddress(),
    X2EarnApps: await x2EarnApps.getAddress(),
    X2EarnRewardsPool: await x2EarnRewardsPool.getAddress(),
    XAllocationPool: await xAllocationPool.getAddress(),
    XAllocationVoting: await xAllocationVoting.getAddress(),
    vechainNodesManagement: await nodeManagement.getAddress(),
    VeBetterPassport: await veBetterPassport.getAddress(),
    X2EarnCreator: await x2EarnCreator.getAddress(),
  }

  const libraries: {
    B3TRGovernor: Record<string, string>
    VeBetterPassport: Record<string, string>
    X2EarnApps: Record<string, string>
  } = {
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
    VeBetterPassport: {
      PassportChecksLogic: await PassportChecksLogic.getAddress(),
      PassportConfigurator: await PassportConfigurator.getAddress(),
      PassportEntityLogic: await PassportEntityLogic.getAddress(),
      PassportDelegationLogic: await PassportDelegationLogic.getAddress(),
      PassportPersonhoodLogic: await PassportPersonhoodLogic.getAddress(),
      PassportPoPScoreLogic: await PassportPoPScoreLogic.getAddress(),
      PassportSignalingLogic: await PassportSignalingLogic.getAddress(),
      PassportWhitelistAndBlacklistLogic: await PassportWhitelistAndBlacklistLogic.getAddress(),
    },
    X2EarnApps: {
      AdministrationUtils: await AdministrationUtils.getAddress(),
      EndorsementUtils: await EndorsementUtils.getAddress(),
      VoteEligibilityUtils: await VoteEligibilityUtils.getAddress(),
    },
  }

  await setWhitelistedFunctions(contractAddresses, config, governor, deployer, libraries, true) // Set whitelisted functions for governor proposals

  // Enable Participation Score for VeBetterPassport
  await veBetterPassport
    .connect(deployer)
    .toggleCheck(4)
    .then(async tx => await tx.wait())

  // Assign ACTION_REGISTRAR_ROLE to X2EarnRewardsPool
  await veBetterPassport
    .connect(deployer)
    .grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), await x2EarnRewardsPool.getAddress())
    .then(async tx => await tx.wait())

  // ---------- Configure contract roles for setup ---------- //

  console.log("================ Configuring contract roles for setup")

  // TODO: Uncomment this line to pause public minting of GM NFTs when deploying to Mainnet
  // await galaxyMember.connect(admin).setIsPublicMintingPaused(true)
  // console.log("Public minting of GM NFTs paused")

  // Grant MINTER_ROLE on B3TR to emissions contract so it can bootstrap and distribute
  await b3tr
    .connect(deployer)
    .grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())
    .then(async tx => await tx.wait())
  console.log("Minter role granted to emissions contract")

  // Set proposer, canceller and executor role to timelock
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE()
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE()
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE()
  await timelock.connect(deployer).grantRole(PROPOSER_ROLE, await governor.getAddress())
  await timelock.connect(deployer).grantRole(EXECUTOR_ROLE, await governor.getAddress())
  await timelock.connect(deployer).grantRole(CANCELLER_ROLE, await governor.getAddress())
  console.log("Proposer, executor and canceller role granted to governor")

  // Grant treasury GOVERNANCE_ROLE to treasury contract admin for intial phases of project
  const GOVERNANCE_ROLE = await treasury.GOVERNANCE_ROLE()
  await treasury.connect(deployer).grantRole(GOVERNANCE_ROLE, TEMP_ADMIN)
  console.log("Governance role granted to treasury contract admin")

  // Grant Vote Registrar role to XAllocationVoting
  await voterRewards
    .connect(deployer)
    .grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await xAllocationVoting.getAddress())
    .then(async tx => await tx.wait())
  console.log("Vote registrar role granted to XAllocationVoting")
  // Grant Vote Registrar role to B3TRGovernor
  await voterRewards
    .connect(deployer)
    .grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await governor.getAddress())
    .then(async tx => await tx.wait())
  console.log("Vote registrar role granted to B3TRGovernor")

  // Emissions contract should be able to start new rounds
  await xAllocationVoting
    .connect(deployer)
    .grantRole(await xAllocationVoting.ROUND_STARTER_ROLE(), await emissions.getAddress())
    .then(async tx => await tx.wait())
  console.log("Admin role granted to emissions contract")

  // Set X allocations governor
  await emissions
    .connect(deployer)
    .setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
    .then(async tx => await tx.wait())
  // Set voter rewards address in emissions
  await emissions
    .connect(deployer)
    .setVote2EarnAddress(await voterRewards.getAddress())
    .then(async tx => await tx.wait())
  console.log("XAllocationsGovernor and Vote2Earn address set in Emissions contract")

  // Setup X2EarnApps addresses
  await x2EarnApps
    .connect(deployer)
    .setXAllocationVotingGovernor(await xAllocationVoting.getAddress())
    .then(async tx => await tx.wait())

  // Setup XAllocationPool addresses
  await xAllocationPool
    .connect(deployer)
    .setXAllocationVotingAddress(await xAllocationVoting.getAddress())
    .then(async tx => await tx.wait())
  await xAllocationPool
    .connect(deployer)
    .setEmissionsAddress(await emissions.getAddress())
    .then(async tx => await tx.wait())
  console.log("XAllocationVoting and Emissions address set in XAllocationPool contract")

  // Set xAllocationVoting and B3TRGovernor address in GalaxyMember
  await galaxyMember
    .connect(deployer)
    .setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
    .then(async tx => await tx.wait())
  await galaxyMember
    .connect(deployer)
    .setB3trGovernorAddress(await governor.getAddress())
    .then(async tx => await tx.wait())
  console.log("XAllocationsGovernor and B3trGovernor address set in GalaxyMember contract")

  //Set the emissions address as the ROUND_STARTER_ROLE in XAllocationVoting
  const roundStarterRole = await xAllocationVoting.ROUND_STARTER_ROLE()
  await xAllocationVoting
    .connect(deployer)
    .grantRole(roundStarterRole, await emissions.getAddress())
    .then(async tx => await tx.wait())
  console.log("Round starter role granted to emissions contract")

  // Grant the ACTION_SCORE_MANAGER_ROLE to X2Earn contract
  await veBetterPassport
    .connect(deployer)
    .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnApps.getAddress())
    .then(async tx => await tx.wait())

  // Set up X2EarnApps contract
  await x2EarnCreator.grantRole(await x2EarnCreator.MINTER_ROLE(), await x2EarnApps.getAddress())
  await x2EarnCreator.grantRole(await x2EarnCreator.BURNER_ROLE(), await x2EarnApps.getAddress())

  // Mint the initial X2EarnCreator NFT to first admin
  await x2EarnCreator
    .connect(deployer)
    .safeMint(await deployer.getAddress())
    .then(async tx => await tx.wait())

  // ---------- Setup Contracts ---------- //
  // Notice: admin account allowed to perform actions is retrieved again inside the setup functions
  if (network.name === "vechain_testnet") {
    await setupTestEnvironment(emissions, x2EarnApps, vechainNodesMock)
  } else if (network.name === "vechain_solo") {
    await setupLocalEnvironment(emissions, treasury, x2EarnApps, vechainNodesMock)
  }

  // ---------- Run Simulation ---------- //
  if (shouldRunSimulation()) {
    await simulateRounds(b3tr, vot3, xAllocationVoting, emissions, voterRewards, treasury)
  }

  // ---------- Role updates ---------- //
  // Do not update roles on solo network since we are already using the predifined address and it would just increase dev time
  if (network.name === "vechain_testnet") {
    console.log("================ Updating contract roles after setup ================ ")
    console.log("New admin address", config.CONTRACTS_ADMIN_ADDRESS)

    // we will need to have  an admin that triggers the minting function to execute the mainnet migration
    await b3tr
      .connect(deployer)
      .grantRole(await b3tr.MINTER_ROLE(), config.CONTRACTS_ADMIN_ADDRESS)
      .then(async tx => await tx.wait())
    console.log("Minter role granted to new admin on ", await b3tr.getAddress())
    await transferMinterRole(b3tr, deployer, TEMP_ADMIN, await emissions.getAddress())
    await transferAdminRole(b3tr, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferContractsAddressManagerRole(galaxyMember, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(galaxyMember, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferMinterRole(emissions, deployer, deployer.address, config.CONTRACTS_ADMIN_ADDRESS)
    await transferContractsAddressManagerRole(emissions, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferDecaySettingsManagerRole(emissions, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(emissions, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferAdminRole(voterRewards, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferContractsAddressManagerRole(xAllocationPool, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(xAllocationPool, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await xAllocationVoting
      .connect(deployer)
      .grantRole(await xAllocationVoting.GOVERNANCE_ROLE(), config.CONTRACTS_ADMIN_ADDRESS)
      .then(async tx => await tx.wait())
    console.log("Governance role granted to admin in ", await xAllocationVoting.getAddress())
    await transferContractsAddressManagerRole(xAllocationVoting, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(xAllocationVoting, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferGovernanceRole(treasury, deployer, deployer.address, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(treasury, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferGovernorFunctionSettingsRole(governor, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(governor, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferGovernanceRole(x2EarnApps, deployer, deployer.address, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(x2EarnApps, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferAdminRole(timelock, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferSettingsManagerRole(veBetterPassport, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferUpgraderRole(xAllocationPool, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferUpgraderRole(emissions, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferSettingsManagerRole(veBetterPassport, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    console.log("Roles updated successfully!")

    console.log("================ Validating roles")

    // VeBetterPassport
    await validateContractRole(
      veBetterPassport,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await veBetterPassport.SETTINGS_MANAGER_ROLE(),
    )

    // B3TR
    await validateContractRole(b3tr, await emissions.getAddress(), TEMP_ADMIN, await b3tr.MINTER_ROLE())
    await validateContractRole(b3tr, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await b3tr.MINTER_ROLE())
    await validateContractRole(b3tr, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await b3tr.DEFAULT_ADMIN_ROLE())
    await validateContractRole(b3tr, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await b3tr.PAUSER_ROLE())

    // VOT3
    await validateContractRole(vot3, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await vot3.DEFAULT_ADMIN_ROLE())
    await validateContractRole(vot3, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await vot3.UPGRADER_ROLE())
    await validateContractRole(vot3, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await vot3.PAUSER_ROLE())

    // Timelock
    await validateContractRole(timelock, await governor.getAddress(), TEMP_ADMIN, await timelock.PROPOSER_ROLE())
    await validateContractRole(timelock, await governor.getAddress(), TEMP_ADMIN, await timelock.EXECUTOR_ROLE())
    await validateContractRole(timelock, await governor.getAddress(), TEMP_ADMIN, await timelock.CANCELLER_ROLE())
    await validateContractRole(
      timelock,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await timelock.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(timelock, await timelock.getAddress(), TEMP_ADMIN, await timelock.DEFAULT_ADMIN_ROLE())
    await validateContractRole(timelock, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await timelock.UPGRADER_ROLE())

    // B3TRGovernor
    await validateContractRole(
      governor,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await governor.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      governor,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await governor.GOVERNOR_FUNCTIONS_SETTINGS_ROLE(),
    )
    await validateContractRole(governor, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await governor.PAUSER_ROLE())
    await validateContractRole(
      governor,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await governor.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )
    await validateContractRole(
      governor,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await governor.PROPOSAL_EXECUTOR_ROLE(),
    )

    // Emissions
    await validateContractRole(emissions, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await emissions.MINTER_ROLE())
    await validateContractRole(
      emissions,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await emissions.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      emissions,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await emissions.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )
    await validateContractRole(
      emissions,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await emissions.DECAY_SETTINGS_MANAGER_ROLE(),
    )
    await validateContractRole(emissions, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await emissions.UPGRADER_ROLE())

    // VoterRewards
    await validateContractRole(
      voterRewards,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await voterRewards.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      voterRewards,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await voterRewards.UPGRADER_ROLE(),
    )
    await validateContractRole(
      voterRewards,
      await xAllocationVoting.getAddress(),
      TEMP_ADMIN,
      await voterRewards.VOTE_REGISTRAR_ROLE(),
    )
    await validateContractRole(
      voterRewards,
      await governor.getAddress(),
      TEMP_ADMIN,
      await voterRewards.VOTE_REGISTRAR_ROLE(),
    )
    await validateContractRole(
      voterRewards,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await voterRewards.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )

    // X2EarnRewardsPool
    await validateContractRole(
      x2EarnRewardsPool,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await x2EarnRewardsPool.DEFAULT_ADMIN_ROLE(),
    )

    await validateContractRole(
      x2EarnRewardsPool,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await x2EarnRewardsPool.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )

    await validateContractRole(
      x2EarnRewardsPool,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await x2EarnRewardsPool.UPGRADER_ROLE(),
    )

    // XAllocationPool
    await validateContractRole(
      xAllocationPool,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationPool.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      xAllocationPool,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationPool.UPGRADER_ROLE(),
    )
    await validateContractRole(
      xAllocationPool,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationPool.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )

    // XAllocationVoting
    await validateContractRole(
      xAllocationVoting,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationVoting.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      xAllocationVoting,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationVoting.UPGRADER_ROLE(),
    )
    await validateContractRole(
      xAllocationVoting,
      await emissions.getAddress(),
      TEMP_ADMIN,
      await xAllocationVoting.ROUND_STARTER_ROLE(),
    )
    await validateContractRole(
      xAllocationVoting,
      await timelock.getAddress(),
      TEMP_ADMIN,
      await xAllocationVoting.GOVERNANCE_ROLE(),
    )
    await validateContractRole(
      xAllocationVoting,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationVoting.GOVERNANCE_ROLE(),
    )
    await validateContractRole(
      xAllocationVoting,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationVoting.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )

    // Treasury
    await validateContractRole(treasury, await timelock.getAddress(), TEMP_ADMIN, await treasury.GOVERNANCE_ROLE())
    await validateContractRole(
      treasury,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await treasury.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(treasury, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await treasury.UPGRADER_ROLE())
    await validateContractRole(treasury, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await treasury.PAUSER_ROLE())

    // X2EarnApps
    await validateContractRole(
      x2EarnApps,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await x2EarnApps.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(x2EarnApps, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await x2EarnApps.UPGRADER_ROLE())
    await validateContractRole(
      x2EarnApps,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await x2EarnApps.GOVERNANCE_ROLE(),
    )

    // GalaxyMember
    await validateContractRole(
      galaxyMember,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await galaxyMember.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      galaxyMember,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await galaxyMember.UPGRADER_ROLE(),
    )
    await validateContractRole(
      galaxyMember,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await galaxyMember.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )
    await validateContractRole(
      galaxyMember,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await galaxyMember.PAUSER_ROLE(),
    )
    await validateContractRole(
      galaxyMember,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await galaxyMember.MINTER_ROLE(),
    )

    // X2EarnCreator
    await validateContractRole(
      x2EarnCreator,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await x2EarnCreator.DEFAULT_ADMIN_ROLE(),
    )

    await validateContractRole(
      x2EarnCreator,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await x2EarnCreator.MINTER_ROLE(),
    )

    await validateContractRole(
      x2EarnCreator,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await x2EarnCreator.BURNER_ROLE(),
    )

    console.log("Roles validated successfully!")
  }

  console.log("================================================================================")
  console.log("Deployment completed successfully!")
  console.log("================================================================================")

  console.log("Libraries", libraries)
  console.log("Contracts", contractAddresses)
  await saveContractsToFile(contractAddresses, libraries)

  const end = new Date(performance.now() - start)
  console.log(`Total execution time: ${end.getMinutes()}m ${end.getSeconds()}s`)

  return {
    governor: governor,
    timelock: timelock,
    b3tr: b3tr,
    vot3: vot3,
    galaxyMember: galaxyMember,
    xAllocationPool: xAllocationPool,
    xAllocationVoting: xAllocationVoting,
    emissions: emissions,
    voterRewards: voterRewards,
    treasury: treasury,
    x2EarnApps: x2EarnApps,
    x2EarnRewardsPool: x2EarnRewardsPool,
    vechainNodesMock: vechainNodesAddress,
    vechainNodeManagement: nodeManagement,
    veBetterPassport: veBetterPassport,
    x2EarnCreator: x2EarnCreator,
    libraries: {
      governorClockLogic: GovernorClockLogicLib,
      governorConfigurator: GovernorConfiguratorLib,
      governorDepositLogic: GovernorDepositLogicLib,
      governorFunctionRestrictionsLogic: GovernorFunctionRestrictionsLogicLib,
      governorProposalLogic: GovernorProposalLogicLib,
      governorQuorumLogic: GovernorQuorumLogicLib,
      governorStateLogic: GovernorStateLogicLib,
      governorVotesLogic: GovernorVotesLogicLib,
      passportChecksLogic: PassportChecksLogic,
      passportConfigurator: PassportConfigurator,
      passportEntityLogic: PassportEntityLogic,
      passportDelegationLogic: PassportDelegationLogic,
      passportPersonhoodLogic: PassportPersonhoodLogic,
      passportPoPScoreLogic: PassportPoPScoreLogic,
      passportSignalingLogic: PassportSignalingLogic,
      passportWhitelistAndBlacklistLogic: PassportWhitelistAndBlacklistLogic,
    },
  }
  // close the script
}

async function deployB3trToken(admin: string, minter: string, pauser: string): Promise<B3TR> {
  const B3trContract = await ethers.getContractFactory("B3TR") // Use the global variable
  const contract = await B3trContract.deploy(admin, minter, pauser)

  await contract.waitForDeployment()

  console.log(`B3TR impl.: ${await contract.getAddress()}`)

  return contract
}

/**
 * Set the whitelisted functions from config
 * Performs the following steps for each contract:
 *    1. Get the function signatures from the contract factory
 *    2. Set the whitelisted functions in the governor contract
 *
 * @param contractAddresses - Addresses of the deployed contracts
 * @param config - Contracts configuration
 * @param governor - B3TRGovernor contract instance
 * @param admin - Admin signer
 *
 * @note - For ambiguous functions (functions with same name), the function signature is used to differentiate them
 * e.g., instead of using "setVoterRewards", we use "setVoterRewards(address)" in the config
 */
export const setWhitelistedFunctions = async (
  contractAddresses: Record<string, string>,
  config: ContractsConfig,
  governor: B3TRGovernor,
  admin: HardhatEthersSigner,
  libraries: Record<string, Record<string, string>>,
  logOutput = false,
) => {
  if (logOutput) console.log("================ Setting whitelisted functions in B3TRGovernor contract")

  const { B3TR_GOVERNOR_WHITELISTED_METHODS } = config

  for (const [contract, functions] of Object.entries(B3TR_GOVERNOR_WHITELISTED_METHODS)) {
    // Check if the contract address exists
    const contractAddress = contractAddresses[contract]
    if (!contractAddress) {
      if (logOutput) console.log(`Skipping ${contract} as it does not exist in contract addresses`)
      continue // Skip this contract if address does not exist
    }
    // Check if the current contract requires linking with any libraries
    const contractLibraries = libraries[contract]

    // Getting the contract factory with or without libraries as needed
    const contractFactory = contractLibraries
      ? await ethers.getContractFactory(contract, { libraries: contractLibraries })
      : await ethers.getContractFactory(contract)

    const whitelistFunctionSelectors = []

    for (const func of functions) {
      const sig = contractFactory.interface.getFunction(func)?.selector

      if (sig) whitelistFunctionSelectors.push(sig)
    }

    if (whitelistFunctionSelectors.length !== 0) {
      await governor
        .connect(admin)
        .setWhitelistFunctions(contractAddresses[contract], whitelistFunctionSelectors, true)
        .then(async tx => await tx.wait())

      if (logOutput) console.log(`Whitelisted functions set for ${contract} in B3TRGovernor contract`)
    }
  }
}
