import { ethers } from "hardhat"
import { expect } from "chai"
import {
  bootstrapAndStartEmissions,
  bootstrapEmissions,
  createProposal,
  linkEntityToPassportWithSignature,
  getOrDeployContractInstances,
  getProposalIdFromTx,
  getVot3Tokens,
  payDeposit,
  startNewAllocationRound,
  waitForNextCycle,
  waitForProposalToBeActive,
  delegateWithSignature,
  moveToCycle,
  waitForCurrentRoundToEnd,
  moveBlocks,
  waitForBlock,
  waitForNextBlock,
  participateInAllocationVoting,
  upgradeNFTtoLevel,
} from "./helpers"
import { describe, it } from "mocha"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { ZeroAddress } from "ethers"
import { createTestConfig } from "./helpers/config"
import { deployAndUpgrade, deployProxyOnly, initializeProxy, upgradeProxy } from "../scripts/helpers"

import {
  B3TRGovernor,
  Emissions,
  VeBetterPassport,
  VeBetterPassportV1,
  VeBetterPassportV2,
  VeBetterPassportV3,
  VoterRewards,
  X2EarnRewardsPool,
  XAllocationPool,
  XAllocationVoting,
} from "../typechain-types"
import { endorseApp } from "./helpers/xnodes"
import { createLocalConfig } from "@repo/config/contracts/envs/local"

describe("VeBetterPassport - @shard8", function () {
  describe("Contract parameters", function () {
    it("Should have contract addresses set correctly", async function () {
      const { veBetterPassport, xAllocationVoting, x2EarnApps, galaxyMember } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Verify contract addresses
      expect(await veBetterPassport.getXAllocationVoting()).to.equal(await xAllocationVoting.getAddress())
      expect(await veBetterPassport.getX2EarnApps()).to.equal(await x2EarnApps.getAddress())
      expect(await veBetterPassport.getGalaxyMember()).to.equal(await galaxyMember.getAddress())
    })

    it("Should have correct roles set", async function () {
      const { veBetterPassport, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await veBetterPassport.hasRole(await veBetterPassport.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true
      expect(await veBetterPassport.hasRole(await veBetterPassport.SETTINGS_MANAGER_ROLE(), owner.address)).to.be.true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ROLE_GRANTER(), owner.address)).to.be.true
      expect(await veBetterPassport.hasRole(await veBetterPassport.SIGNALER_ROLE(), owner.address)).to.be.true
      expect(await veBetterPassport.hasRole(await veBetterPassport.WHITELISTER_ROLE(), owner.address)).to.be.true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
    })

    it("Should have action score thresholds set correctly", async function () {
      const config = createTestConfig()
      const { veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          VEPASSPORT_BOT_SIGNALING_THRESHOLD: 5,
          VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE: 20,
          VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE: 10,
        },
      })

      expect(await veBetterPassport.thresholdPoPScore()).to.equal(0)
      expect(await veBetterPassport.signalingThreshold()).to.equal(5)
      expect(await veBetterPassport.whitelistThreshold()).to.equal(20)
      expect(await veBetterPassport.blacklistThreshold()).to.equal(10)
    })

    it("Should have rounds for cumulative score set correctly", async function () {
      const config = createTestConfig()
      const { veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE: 5,
        },
      })

      expect(await veBetterPassport.roundsForCumulativeScore()).to.equal(5)
    })

    it("Should have minimum galaxy member level set correctly", async function () {
      const config = createTestConfig()
      const { veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL: 5,
        },
      })

      expect(await veBetterPassport.getMinimumGalaxyMemberLevel()).to.equal(5)
    })

    it("Should return correct eip712 domain separator", async function () {
      const { veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const domainSeparator = await veBetterPassport.eip712Domain()
      expect(domainSeparator).to.deep.equal([
        "0x0f",
        "VeBetterPassport",
        "1",
        1337n,
        await veBetterPassport.getAddress(),
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        [],
      ])
    })
  })
  // deployment
  describe("Upgrades", function () {
    it("should return the correct version", async function () {
      const { veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await veBetterPassport.version()).to.equal("4")
    })
    it("Should not be able to initialize twice", async function () {
      const config = createTestConfig()
      const { veBetterPassport, owner, x2EarnApps, xAllocationVoting, galaxyMember } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await expect(
        veBetterPassport.initialize(
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
            resetSignaler: owner.address, // resetSignaler
          },
        ),
      ).to.be.reverted
    })

    it("Should not be able to upgrade if without UPGRADER_ROLE", async function () {
      const {
        veBetterPassport,
        otherAccount,
        passportChecksLogic,
        passportConfigurator,
        passportDelegationLogic,
        passportPersonhoodLogic,
        passportPoPScoreLogic,
        passportSignalingLogic,
        passportEntityLogic,
        passportWhitelistBlacklistLogic,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("VeBetterPassport", {
        libraries: {
          PassportChecksLogic: await passportChecksLogic.getAddress(),
          PassportConfigurator: await passportConfigurator.getAddress(),
          PassportEntityLogic: await passportEntityLogic.getAddress(),
          PassportPersonhoodLogic: await passportPersonhoodLogic.getAddress(),
          PassportPoPScoreLogic: await passportPoPScoreLogic.getAddress(),
          PassportDelegationLogic: await passportDelegationLogic.getAddress(),
          PassportSignalingLogic: await passportSignalingLogic.getAddress(),
          PassportWhitelistAndBlacklistLogic: await passportWhitelistBlacklistLogic.getAddress(),
        },
      })

      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const UPGRADER_ROLE = await veBetterPassport.UPGRADER_ROLE()
      expect(await veBetterPassport.hasRole(UPGRADER_ROLE, otherAccount)).to.eql(false)

      await expect(veBetterPassport.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to
        .be.reverted
    })

    it("User with UPGRADER_ROLE should be able to upgrade the contract", async function () {
      const {
        owner,
        veBetterPassport,
        passportChecksLogic,
        passportConfigurator,
        passportDelegationLogic,
        passportPersonhoodLogic,
        passportPoPScoreLogic,
        passportEntityLogic,
        passportSignalingLogic,
        passportWhitelistBlacklistLogic,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("VeBetterPassport", {
        libraries: {
          PassportChecksLogic: await passportChecksLogic.getAddress(),
          PassportConfigurator: await passportConfigurator.getAddress(),
          PassportEntityLogic: await passportEntityLogic.getAddress(),
          PassportPersonhoodLogic: await passportPersonhoodLogic.getAddress(),
          PassportPoPScoreLogic: await passportPoPScoreLogic.getAddress(),
          PassportDelegationLogic: await passportDelegationLogic.getAddress(),
          PassportSignalingLogic: await passportSignalingLogic.getAddress(),
          PassportWhitelistAndBlacklistLogic: await passportWhitelistBlacklistLogic.getAddress(),
        },
      })
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await veBetterPassport.getAddress())

      const UPGRADER_ROLE = await veBetterPassport.UPGRADER_ROLE()
      expect(await veBetterPassport.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(veBetterPassport.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await veBetterPassport.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only user with UPGRADER_ROLE should be able to upgrade the contract", async function () {
      const {
        owner,
        veBetterPassport,
        otherAccount,
        passportChecksLogic,
        passportConfigurator,
        passportDelegationLogic,
        passportPersonhoodLogic,
        passportPoPScoreLogic,
        passportSignalingLogic,
        passportWhitelistBlacklistLogic,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("VeBetterPassport", {
        libraries: {
          PassportChecksLogic: await passportChecksLogic.getAddress(),
          PassportConfigurator: await passportConfigurator.getAddress(),
          PassportEntityLogic: await passportDelegationLogic.getAddress(),
          PassportDelegationLogic: await passportDelegationLogic.getAddress(),
          PassportPersonhoodLogic: await passportPersonhoodLogic.getAddress(),
          PassportPoPScoreLogic: await passportPoPScoreLogic.getAddress(),
          PassportSignalingLogic: await passportSignalingLogic.getAddress(),
          PassportWhitelistAndBlacklistLogic: await passportWhitelistBlacklistLogic.getAddress(),
        },
      })
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await veBetterPassport.getAddress())

      await veBetterPassport.revokeRole(await veBetterPassport.UPGRADER_ROLE(), owner.address) // Revoke the UPGRADER_ROLE from the owner

      expect(await veBetterPassport.hasRole(await veBetterPassport.UPGRADER_ROLE(), owner.address)).to.eql(false)

      await veBetterPassport.grantRole(await veBetterPassport.UPGRADER_ROLE(), otherAccount.address) // Grant the UPGRADER_ROLE to the otherAccount

      // Upgrade the VeBetterPassport implementation with NON-UPGRADER_ROLE user
      await expect(veBetterPassport.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.be
        .reverted

      // Upgrade the VeBetterPassport implementation with UPGRADER_ROLE user
      await expect(veBetterPassport.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to
        .not.be.reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await veBetterPassport.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Should not have any state conflicts after from V1 to V2, and then to V3", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      config.EMISSIONS_CYCLE_DURATION = 20
      const {
        owner,
        otherAccount,
        treasury,
        galaxyMember,
        b3tr,
        timeLock: timelock,
        minterAccount,
        vot3,
        x2EarnApps,
        otherAccounts,
        passportChecksLogicV1,
        passportConfiguratorV1,
        passportDelegationLogicV1,
        passportPersonhoodLogicV1,
        passportPoPScoreLogicV1,
        passportSignalingLogicV1,
        passportEntityLogicV1,
        passportWhitelistBlacklistLogicV1,
        passportChecksLogicV2,
        passportConfiguratorV2,
        passportDelegationLogicV2,
        passportPersonhoodLogicV2,
        passportPoPScoreLogicV2,
        passportSignalingLogicV2,
        passportEntityLogicV2,
        passportWhitelistBlacklistLogicV2,
        passportChecksLogicV3,
        passportConfiguratorV3,
        passportDelegationLogicV3,
        passportPersonhoodLogicV3,
        passportPoPScoreLogicV3,
        passportSignalingLogicV3,
        passportWhitelistBlacklistLogicV3,
        passportEntityLogicV3,
        governorClockLogicLibV1,
        governorConfiguratorLibV1,
        governorDepositLogicLibV1,
        governorFunctionRestrictionsLogicLibV1,
        governorProposalLogicLibV1,
        governorQuorumLogicLibV1,
        governorStateLogicLibV1,
        governorVotesLogicLibV1,
        governorClockLogicLibV3,
        governorConfiguratorLibV3,
        governorDepositLogicLibV3,
        governorFunctionRestrictionsLogicLibV3,
        governorProposalLogicLibV3,
        governorQuorumLogicLibV3,
        governorStateLogicLibV3,
        governorVotesLogicLibV3,
        governorClockLogicLib,
        governorConfiguratorLib,
        governorDepositLogicLib,
        governorFunctionRestrictionsLogicLib,
        governorProposalLogicLib,
        governorQuorumLogicLib,
        governorStateLogicLib,
        governorVotesLogicLib,
        B3trContract,
        creators,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const veBetterPassportContractAddress = await deployProxyOnly("VeBetterPassportV1", {
        PassportChecksLogicV1: await passportChecksLogicV1.getAddress(),
        PassportConfiguratorV1: await passportConfiguratorV1.getAddress(),
        PassportEntityLogicV1: await passportEntityLogicV1.getAddress(),
        PassportDelegationLogicV1: await passportDelegationLogicV1.getAddress(),
        PassportPersonhoodLogicV1: await passportPersonhoodLogicV1.getAddress(),
        PassportPoPScoreLogicV1: await passportPoPScoreLogicV1.getAddress(),
        PassportSignalingLogicV1: await passportSignalingLogicV1.getAddress(),
        PassportWhitelistAndBlacklistLogicV1: await passportWhitelistBlacklistLogicV1.getAddress(),
      })

      const x2EarnRewardsPool = (await deployAndUpgrade(
        ["X2EarnRewardsPoolV1", "X2EarnRewardsPoolV2", "X2EarnRewardsPool"],
        [
          [
            owner.address, // admin
            owner.address, // contracts address manager
            owner.address, // upgrader //TODO: transferRole
            await b3tr.getAddress(),
            await x2EarnApps.getAddress(),
          ],
          [
            owner.address, // impact admin address
            config.X_2_EARN_INITIAL_IMPACT_KEYS, // impact keys
          ],
          [veBetterPassportContractAddress],
        ],
        {
          versions: [undefined, 2, 3],
        },
      )) as X2EarnRewardsPool

      const xAllocationPool = (await deployAndUpgrade(
        ["XAllocationPoolV1", "XAllocationPool"],
        [
          [
            owner.address, // admin
            owner.address, // upgrader
            owner.address, // contractsAddressManager
            await b3tr.getAddress(),
            await treasury.getAddress(),
            await x2EarnApps.getAddress(),
            await x2EarnRewardsPool.getAddress(),
          ],
          [],
        ],
        {
          versions: [undefined, 2],
        },
      )) as XAllocationPool

      const emissions = (await deployAndUpgrade(
        ["EmissionsV1", "Emissions"],
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
        },
      )) as Emissions

      const voterRewards = (await deployAndUpgrade(
        ["VoterRewardsV1", "VoterRewards"],
        [
          [
            owner.address, // admin
            owner.address, // upgrader // TODO: transferRole
            owner.address, // contractsAddressManager
            await emissions.getAddress(),
            await galaxyMember.getAddress(),
            await b3tr.getAddress(),
            config.VOTER_REWARDS_LEVELS,
            config.VOTER_REWARDS_MULTIPLIER,
          ],
          [],
        ],
        {
          versions: [undefined, 2],
        },
      )) as VoterRewards

      const xAllocationVoting = (await deployAndUpgrade(
        ["XAllocationVotingV1", "XAllocationVoting"],
        [
          [
            {
              vot3Token: await vot3.getAddress(),
              quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE,
              initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1,
              timeLock: await timelock.getAddress(),
              voterRewards: await voterRewards.getAddress(),
              emissions: await emissions.getAddress(),
              admins: [await timelock.getAddress(), owner.address],
              upgrader: owner.address,
              contractsAddressManager: owner.address,
              x2EarnAppsAddress: await x2EarnApps.getAddress(),
              baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
              appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
              votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
            },
          ],
          [veBetterPassportContractAddress],
        ],
        {
          versions: [undefined, 2],
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
            admin: owner.address, // admins
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
          PassportChecksLogicV1: await passportChecksLogicV1.getAddress(),
          PassportConfiguratorV1: await passportConfiguratorV1.getAddress(),
          PassportEntityLogicV1: await passportEntityLogicV1.getAddress(),
          PassportDelegationLogicV1: await passportDelegationLogicV1.getAddress(),
          PassportPersonhoodLogicV1: await passportPersonhoodLogicV1.getAddress(),
          PassportPoPScoreLogicV1: await passportPoPScoreLogicV1.getAddress(),
          PassportSignalingLogicV1: await passportSignalingLogicV1.getAddress(),
          PassportWhitelistAndBlacklistLogicV1: await passportWhitelistBlacklistLogicV1.getAddress(),
        },
      )) as VeBetterPassportV1

      const governor = (await deployAndUpgrade(
        ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernor"],
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
              governorAdmin: owner.address,
              pauser: owner.address,
              contractsAddressManager: owner.address,
              proposalExecutor: owner.address,
              governorFunctionSettingsRoleAddress: owner.address,
            },
          ],
          [],
          [],
          [veBetterPassportContractAddress],
        ],
        {
          versions: [undefined, 2, 3, 4],
          libraries: [
            {
              GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
              GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
              GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
              GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
              GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
              GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
              GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
              GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
            },
            {
              GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
              GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
              GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
              GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
              GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
              GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
              GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
              GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
            },
            {
              GovernorClockLogicV3: await governorClockLogicLibV3.getAddress(),
              GovernorConfiguratorV3: await governorConfiguratorLibV3.getAddress(),
              GovernorDepositLogicV3: await governorDepositLogicLibV3.getAddress(),
              GovernorFunctionRestrictionsLogicV3: await governorFunctionRestrictionsLogicLibV3.getAddress(),
              GovernorProposalLogicV3: await governorProposalLogicLibV3.getAddress(),
              GovernorQuorumLogicV3: await governorQuorumLogicLibV3.getAddress(),
              GovernorStateLogicV3: await governorStateLogicLibV3.getAddress(),
              GovernorVotesLogicV3: await governorVotesLogicLibV3.getAddress(),
            },
            {
              GovernorClockLogic: await governorClockLogicLib.getAddress(),
              GovernorConfigurator: await governorConfiguratorLib.getAddress(),
              GovernorDepositLogic: await governorDepositLogicLib.getAddress(),
              GovernorFunctionRestrictionsLogic: await governorFunctionRestrictionsLogicLib.getAddress(),
              GovernorProposalLogic: await governorProposalLogicLib.getAddress(),
              GovernorQuorumLogic: await governorQuorumLogicLib.getAddress(),
              GovernorStateLogic: await governorStateLogicLib.getAddress(),
              GovernorVotesLogic: await governorVotesLogicLib.getAddress(),
            },
          ],
        },
      )) as B3TRGovernor

      await veBetterPassportV1
        .connect(owner)
        .grantRole(await veBetterPassportV1.ACTION_REGISTRAR_ROLE(), await x2EarnRewardsPool.getAddress())

      // Grant admin role to voter rewards for registering x allocation voting
      await xAllocationVoting
        .connect(owner)
        .grantRole(await xAllocationVoting.DEFAULT_ADMIN_ROLE(), emissions.getAddress())

      await voterRewards
        .connect(owner)
        .grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await xAllocationVoting.getAddress())

      await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await governor.getAddress())

      await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())
      await xAllocationPool.connect(owner).setEmissionsAddress(await emissions.getAddress())

      // Set xAllocationGovernor in emissions
      await emissions.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      const roundStarterRole = await xAllocationVoting.ROUND_STARTER_ROLE()
      await xAllocationVoting
        .connect(owner)
        .grantRole(roundStarterRole, await emissions.getAddress())
        .then(async tx => await tx.wait())
      await xAllocationVoting
        .connect(owner)
        .grantRole(roundStarterRole, owner.address)
        .then(async tx => await tx.wait())

      // Set XAllocation address in GalaxyMember
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await getVot3Tokens(otherAccount, "10000")
      await getVot3Tokens(owner, "10000")
      await getVot3Tokens(otherAccounts[4], "10000")

      const creator1 = creators[0]
      const creator2 = creators[1]
      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])
      await endorseApp(app3Id, otherAccounts[4])

      await emissions.connect(owner).setVote2EarnAddress(await voterRewards.getAddress())

      // Set app security levels
      await veBetterPassportV1.connect(owner).setAppSecurity(app1Id, 1)
      await veBetterPassportV1.connect(owner).setAppSecurity(app2Id, 2)
      await veBetterPassportV1.connect(owner).setAppSecurity(app3Id, 3)

      // Grant action registrar role
      await veBetterPassportV1.grantRole(await veBetterPassportV1.ACTION_REGISTRAR_ROLE(), owner)
      expect(await veBetterPassportV1.hasRole(await veBetterPassportV1.ACTION_REGISTRAR_ROLE(), owner.address)).to.be
        .true

      // Bootstrap emissions
      // Grant minter role to emissions contract
      await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())
      // Bootstrap emissions
      await emissions.connect(minterAccount).bootstrap()
      await emissions.connect(minterAccount).start()

      // Whitelist function
      const funcSig = B3trContract.interface.getFunction("tokenDetails")?.selector
      await governor.connect(owner).setWhitelistFunction(await b3tr.getAddress(), funcSig as string, true)

      // Create a proposal for next round
      // create a new proposal active from round 2
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const tx = await governor.connect(owner).propose([address], [0], [encodedFunctionCall], "test", "2", 0, {
        gasLimit: 10_000_000,
      })

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      const proposalThreshold = await governor.proposalDepositThreshold(proposalId)
      await getVot3Tokens(owner, ethers.formatEther(proposalThreshold))
      // We also need to wait a block to update the proposer's votes snapshot
      await waitForNextBlock()

      await vot3.connect(owner).approve(await governor.getAddress(), proposalThreshold)
      await governor.connect(owner).deposit(proposalThreshold, proposalId)

      // First round, participation score check is disabled

      // Register actions for round 1
      await veBetterPassportV1.connect(owner).registerAction(otherAccount.address, app1Id)
      await veBetterPassportV1.connect(owner).registerAction(otherAccount.address, app2Id)

      // User's cumulative score = 100 (app1) + 200 (app2) = 300
      expect(await veBetterPassportV1.userRoundScore(otherAccount.address, 1)).to.equal(300)
      expect(await veBetterPassportV1.getCumulativeScoreWithDecay(otherAccount, 1)).to.equal(300)

      await veBetterPassportV1.toggleCheck(4)

      // Vote
      // Note that `otherAccount` can vote because the participation score threshold is set to 0
      await xAllocationVoting
        .connect(otherAccount)
        .castVote(
          1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      await xAllocationVoting.connect(otherAccounts[4]).castVote(1, [app1Id], [ethers.parseEther("1")])

      // Set minimum participation score to 500
      await veBetterPassportV1.setThresholdPoPScore(500)

      let blockNextCycle = await emissions.getNextCycleBlock()
      await waitForBlock(Number(blockNextCycle))
      await emissions.connect(minterAccount).distribute()

      expect(await xAllocationVoting.currentRoundId()).to.equal(2)

      expect(await governor.state(proposalId)).to.equal(1)

      // User tries to vote both governance and x allocation voting but reverts due to not meeting the participation score threshold
      await expect(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(
            2,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      await expect(governor.connect(otherAccount).castVote(proposalId, 2)).to.be.revertedWithCustomError(
        xAllocationVoting,
        "GovernorPersonhoodVerificationFailed",
      )

      // Register actions for round 2
      await veBetterPassportV1.connect(owner).registerAction(otherAccount, app2Id)
      await veBetterPassportV1.connect(owner).registerAction(otherAccount, app3Id)

      /*
        User's cumulative score:
        round 1 = 300
        round 2 = 600 + (300 * 0.8) = 840
      */
      expect(await veBetterPassportV1.getCumulativeScoreWithDecay(otherAccount, 2)).to.equal(840)

      // User now meets the participation score threshold and can vote
      await xAllocationVoting
        .connect(otherAccount)
        .castVote(
          2,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      await governor.connect(otherAccount).castVote(proposalId, 2)

      // Increase participation score threshold to 1000
      await veBetterPassportV1.setThresholdPoPScore(1000)

      // Toggle GM level check
      await veBetterPassportV1.toggleCheck(5)

      // Upgrade to V2
      const veBetterPassportV2 = (await upgradeProxy(
        "VeBetterPassportV1",
        "VeBetterPassportV2",
        await veBetterPassportV1.getAddress(),
        [],
        {
          version: 2,
          libraries: {
            PassportChecksLogicV2: await passportChecksLogicV2.getAddress(),
            PassportConfiguratorV2: await passportConfiguratorV2.getAddress(),
            PassportEntityLogicV2: await passportEntityLogicV2.getAddress(),
            PassportDelegationLogicV2: await passportDelegationLogicV2.getAddress(),
            PassportPersonhoodLogicV2: await passportPersonhoodLogicV2.getAddress(),
            PassportPoPScoreLogicV2: await passportPoPScoreLogicV2.getAddress(),
            PassportSignalingLogicV2: await passportSignalingLogicV2.getAddress(),
            PassportWhitelistAndBlacklistLogicV2: await passportWhitelistBlacklistLogicV2.getAddress(),
          },
        },
      )) as VeBetterPassportV2

      blockNextCycle = await emissions.getNextCycleBlock()
      await waitForBlock(Number(blockNextCycle))

      // Increase participation score threshold to 1000
      await veBetterPassportV2.setThresholdPoPScore(1000)

      await emissions.distribute()

      expect(await xAllocationVoting.currentRoundId()).to.equal(3)

      // User tries to vote x allocation voting but reverts due to not meeting the participation score threshold
      await expect(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(
            3,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      // Register action for round 3
      await veBetterPassportV2.connect(owner).registerAction(otherAccount, app1Id)

      /*
        User's cumulative score:
        round 1 = 300
        round 2 = 600 + (300 * 0.8) = 840
        round 3 = 100 + (840 * 0.8) = 772
        */
      expect(await veBetterPassportV2.getCumulativeScoreWithDecay(otherAccount, 3)).to.equal(772)

      // User still doesn't meet the participation score threshold and can't vote
      await expect(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(
            3,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      // register more actions for round 3
      await veBetterPassportV2.connect(owner).registerAction(otherAccount, app2Id)
      await veBetterPassportV2.connect(owner).registerAction(otherAccount, app3Id)

      /*
        User's cumulative score:
        round 1 = 300
        round 2 = 600 + (300 * 0.8) = 840
        round 3 = 700 + (840 * 0.8) = 1072
        */
      expect(await veBetterPassportV2.getCumulativeScoreWithDecay(otherAccount, 3)).to.equal(1372)

      // User now meets the participation score threshold and can vote
      await xAllocationVoting
        .connect(otherAccount)
        .castVote(
          3,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      // "Before linking passport should have 0"
      expect(await veBetterPassportV2.getCumulativeScoreWithDecay(owner, 3)).to.equal(0)

      // Before linking passport should not be considered person
      expect(
        (await veBetterPassportV2.isPersonAtTimepoint(owner.address, await xAllocationVoting.roundSnapshot(3)))[0],
      ).to.be.equal(false)

      // Delegate passport to owner and try to vote

      await linkEntityToPassportWithSignature(
        veBetterPassportV2 as unknown as VeBetterPassport,
        owner,
        otherAccount,
        3600,
      )

      // After linking "other account" should be entity
      expect(await veBetterPassportV2.isEntity(otherAccount.address)).to.be.true

      // After linking owner should be passport
      expect(await veBetterPassportV2.isPassport(owner.address)).to.be.true

      // After linking passport should not be considered person at the beginning of the round
      expect(
        (await veBetterPassportV2.isPersonAtTimepoint(owner.address, await xAllocationVoting.roundSnapshot(3)))[0],
      ).to.be.equal(false)

      expect(await veBetterPassportV2.isPassport(owner.address)).to.be.true

      // Owner can't vote yet because the delegation is checkpointed and is active from the next round
      await expect(
        xAllocationVoting
          .connect(owner)
          .castVote(
            3,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      blockNextCycle = await emissions.getNextCycleBlock()
      await waitForBlock(Number(blockNextCycle))

      // Mint user GM token
      await galaxyMember.connect(otherAccounts[4]).freeMint()
      await galaxyMember.setMaxLevel(2)
      // Set user GM level to 2
      await upgradeNFTtoLevel(1, 2, galaxyMember, b3tr, otherAccounts[4], minterAccount)

      // Checking if user is person based on GM level will not work in V2 because the check is not implemented
      expect(await veBetterPassportV2.isPerson(otherAccounts[4].address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Record contract storage state at this point
      let storageSlots = []

      const initialSlot = BigInt("0x273c9387b78d9b22e6f3371bb3aa3a918f53507e8cacc54e4831933cbb844100") // Slot 0 of VoterRewards

      for (let i = initialSlot; i < initialSlot + BigInt(50); i++) {
        storageSlots.push(await ethers.provider.getStorage(await veBetterPassportV1.getAddress(), i))
      }

      storageSlots = storageSlots.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      )

      // Upgrade to V3
      const veBetterPassportV3 = (await upgradeProxy(
        "VeBetterPassportV2",
        "VeBetterPassportV3",
        await veBetterPassportV2.getAddress(),
        [],
        {
          version: 3,
          libraries: {
            PassportChecksLogicV3: await passportChecksLogicV3.getAddress(),
            PassportConfiguratorV3: await passportConfiguratorV3.getAddress(),
            PassportEntityLogicV3: await passportEntityLogicV3.getAddress(),
            PassportDelegationLogicV3: await passportDelegationLogicV3.getAddress(),
            PassportPersonhoodLogicV3: await passportPersonhoodLogicV3.getAddress(),
            PassportPoPScoreLogicV3: await passportPoPScoreLogicV3.getAddress(),
            PassportSignalingLogicV3: await passportSignalingLogicV3.getAddress(),
            PassportWhitelistAndBlacklistLogicV3: await passportWhitelistBlacklistLogicV3.getAddress(),
          },
        },
      )) as VeBetterPassportV3

      // Check that the storage slots are the same
      let storageSlotsAfter = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await veBetterPassportV3.getAddress(), i))
      }

      storageSlotsAfter = storageSlotsAfter.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      )

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      await emissions.connect(minterAccount).distribute()

      expect(await xAllocationVoting.currentRoundId()).to.equal(4)

      // Checking if user is person based on GM level will work in V3 because the check is implemented
      expect(await veBetterPassportV3.isPerson(otherAccounts[4].address)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])

      // During linking points are not brought over, so we need to register some actions
      // on both the entity and the passport to see that they are grouped together and can vote
      expect(await veBetterPassportV1.getCumulativeScoreWithDecay(otherAccount, 4)).to.equal(1097)

      // register more actions for round 4 (mixing entity and passport)
      await veBetterPassportV3.connect(owner).registerAction(otherAccount, app2Id)
      await veBetterPassportV3.connect(owner).registerAction(owner, app3Id)
      await veBetterPassportV3.connect(owner).registerAction(owner, app3Id)

      // new points should be added to the passport, entity should not have any new points added
      expect(await veBetterPassportV3.getCumulativeScoreWithDecay(otherAccount, 4)).to.equal(1097)
      /*
        Passport's cumulative score:
        round 4 = 200 + 400 + 400
        */
      expect(await veBetterPassportV3.getCumulativeScoreWithDecay(owner, 4)).to.equal(1000)

      // Now that we reached threshold passport should be considered person
      expect(
        (await veBetterPassportV3.isPersonAtTimepoint(owner.address, await xAllocationVoting.roundSnapshot(4)))[0],
      ).to.be.equal(true)

      // Owner can vote now
      await xAllocationVoting
        .connect(owner)
        .castVote(
          4,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )
    })
  })

  describe("Passport Checks", function () {
    it("Should initialize correctly", async function () {
      const {
        owner: settingsManager,
        veBetterPassport,
        otherAccount,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Verify non admin account cannot toggle checks by default
      await expect(veBetterPassport.connect(otherAccount).toggleCheck(1)).to.be.reverted

      const settingsManagerRole = await veBetterPassport.SETTINGS_MANAGER_ROLE()

      // Verify settingsManager has the role
      expect(await veBetterPassport.hasRole(settingsManagerRole, settingsManager.address)).to.be.true
    })

    it("Should allow only settings manager to toggle checks", async function () {
      const {
        owner: settingsManager,
        veBetterPassport,
        otherAccount,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      await expect(veBetterPassport.connect(otherAccount).toggleCheck(1)).to.be.reverted

      // Settings manager should be able to toggle the checks
      await expect(veBetterPassport.connect(settingsManager).toggleCheck(1)) // 1 is the
        .to.emit(veBetterPassport, "CheckToggled")
        .withArgs("Whitelist Check", true)

      // Whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true

      // Cast SETTING_MANAGER_ROLE to otherAccount
      const settingsManagerRole = await veBetterPassport.SETTINGS_MANAGER_ROLE()
      await veBetterPassport.connect(settingsManager).grantRole(settingsManagerRole, otherAccount.address)

      // Other account should be able to toggle the checks
      await expect(veBetterPassport.connect(otherAccount).toggleCheck(1))
        .to.emit(veBetterPassport, "CheckToggled")
        .withArgs("Whitelist Check", false)

      // Whitelist check should be disabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.false
    })

    it("Should be able to toggle whitelist check", async function () {
      const { owner: settingsManager, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Whitelist check should be disabled by default
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.false

      // Settings manager should be able to toggle the checks
      await expect(veBetterPassport.connect(settingsManager).toggleCheck(1))
        .to.emit(veBetterPassport, "CheckToggled")
        .withArgs("Whitelist Check", true)

      // Whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true
    })

    it("Should be able to toggle blacklist check", async function () {
      const { owner: settingsManager, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Blacklist check should be disabled by default
      expect(await veBetterPassport.isCheckEnabled(2)).to.be.false

      // Settings manager should be able to toggle the checks
      await expect(veBetterPassport.connect(settingsManager).toggleCheck(2))
        .to.emit(veBetterPassport, "CheckToggled")
        .withArgs("Blacklist Check", true)

      // Blacklist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(2)).to.be.true
    })

    it("Should be able to toggle signaling check", async function () {
      const { owner: settingsManager, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Signaling check should be disabled by default
      expect(await veBetterPassport.isCheckEnabled(3)).to.be.false

      // Settings manager should be able to toggle the checks
      await expect(veBetterPassport.connect(settingsManager).toggleCheck(3))
        .to.emit(veBetterPassport, "CheckToggled")
        .withArgs("Signaling Check", true)

      // Signaling check should be enabled
      expect(await veBetterPassport.isCheckEnabled(3)).to.be.true
    })

    it("Should be able to toggle participation check", async function () {
      const { owner: settingsManager, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Participation check should be disabled by default
      expect(await veBetterPassport.isCheckEnabled(4)).to.be.false

      // Settings manager should be able to toggle the checks
      await expect(veBetterPassport.connect(settingsManager).toggleCheck(4))
        .to.emit(veBetterPassport, "CheckToggled")
        .withArgs("Participation Score Check", true)

      // Participation check should be enabled
      expect(await veBetterPassport.isCheckEnabled(4)).to.be.true
    })

    it("Should be able to toggle gm ownership check", async function () {
      const { owner: settingsManager, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Whitelist check should be disabled by default
      expect(await veBetterPassport.isCheckEnabled(5)).to.be.false

      // Settings manager should be able to toggle the checks
      await expect(veBetterPassport.connect(settingsManager).toggleCheck(5))
        .to.emit(veBetterPassport, "CheckToggled")
        .withArgs("GM Ownership Check", true)

      // Whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(5)).to.be.true
    })

    it("Should be able to set the minimum galaxy member level", async function () {
      const { owner: settingsManager, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Set the minimum galaxy member level
      await expect(veBetterPassport.connect(settingsManager).setMinimumGalaxyMemberLevel(5))
        .to.emit(veBetterPassport, "MinimumGalaxyMemberLevelSet")
        .withArgs(5)

      // Verify the minimum galaxy member level
      expect(await veBetterPassport.getMinimumGalaxyMemberLevel()).to.equal(5)
    })

    it("Should not be able to toggle a a check that is not defined in enum", async function () {
      const { owner: settingsManager, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Should revert if the check is not defined in the enum
      await expect(veBetterPassport.connect(settingsManager).toggleCheck(8)).to.be.reverted
    })
  })

  describe("Passport Configurator", function () {
    it("should be able to set the Galaxy Member address", async function () {
      const { veBetterPassport, galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Check if the galaxy member is set correctly
      expect(await veBetterPassport.getGalaxyMember()).to.equal(await galaxyMember.getAddress())

      // Cannot set the galaxy member to the zero address
      await expect(veBetterPassport.setGalaxyMember(ZeroAddress)).to.be.reverted

      // Set the galaxy member to another address
      await veBetterPassport.setGalaxyMember(otherAccount.address)

      // Check if the galaxy member is set correctly
      expect(await veBetterPassport.getGalaxyMember()).to.equal(otherAccount.address)
    })

    it("should be able to set the X2Earn address", async function () {
      const { veBetterPassport, x2EarnApps, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await veBetterPassport.getX2EarnApps()).to.equal(await x2EarnApps.getAddress())

      await expect(veBetterPassport.setX2EarnApps(ZeroAddress)).to.be.reverted

      await veBetterPassport.setX2EarnApps(otherAccount.address)

      expect(await veBetterPassport.getX2EarnApps()).to.equal(otherAccount.address)
    })

    it("should be able to set the xAllocationVoting address", async function () {
      const { veBetterPassport, xAllocationVoting, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await veBetterPassport.getXAllocationVoting()).to.equal(await xAllocationVoting.getAddress())

      await expect(veBetterPassport.setXAllocationVoting(ZeroAddress)).to.be.reverted

      await veBetterPassport.setXAllocationVoting(otherAccount.address)

      expect(await veBetterPassport.getXAllocationVoting()).to.equal(otherAccount.address)
    })

    it("Can set pop threshold to 0", async function () {
      const { owner, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.connect(owner).setThresholdPoPScore(12)
      expect(await veBetterPassport.thresholdPoPScore()).to.equal(12n)

      await veBetterPassport.connect(owner).setThresholdPoPScore(0)
      expect(await veBetterPassport.thresholdPoPScore()).to.equal(0n)
    })
  })

  describe("Passport Entities", function () {
    it("Should revert if an entity is trying to become a passport", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      await linkEntityToPassportWithSignature(veBetterPassport, A, B, 1000)

      await expect(linkEntityToPassportWithSignature(veBetterPassport, B, C, 1000)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })

    it("Should revert if an entity is trying to become a passport", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      await linkEntityToPassportWithSignature(veBetterPassport, A, B, 1000)

      await expect(veBetterPassport.connect(C).linkEntityToPassport(B.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })

    it("Should revert if passport is trying to create a pending link to another passport", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      await linkEntityToPassportWithSignature(veBetterPassport, A, B, 1000)

      await expect(veBetterPassport.connect(A).linkEntityToPassport(C.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })

    it("Should revert if passport has max entities and tries to link another entity via signature", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_PASSPORT_MAX_ENTITIES = 2
      const {
        veBetterPassport,
        owner: passport,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const entity1 = otherAccounts[0]
      const entity2 = otherAccounts[1]
      const entity3 = otherAccounts[2]

      // Link two entities to the passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity1, 1000)
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity2, 1000)

      // Attempt to link a third entity, which should fail
      await expect(
        linkEntityToPassportWithSignature(veBetterPassport, passport, entity3, 1000),
      ).to.be.revertedWithCustomError(veBetterPassport, "MaxEntitiesPerPassportReached")
    })

    it("Should revert if entity is pending delegation and attempts to link to a passport", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const entity1 = otherAccounts[0]
      const passport1 = otherAccounts[1]
      const passport2 = otherAccounts[2]

      // Entity1 starts a pending delegation to passport2
      await veBetterPassport.connect(entity1).delegatePassport(passport2.address)

      // Entity1 tries to link to passport1, but should revert due to pending delegation
      await expect(
        linkEntityToPassportWithSignature(veBetterPassport, passport1, entity1, 1000),
      ).to.be.revertedWithCustomError(veBetterPassport, "DelegatedEntity")
    })

    it("Should not change the state if entity linking fails", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const entity1 = otherAccounts[0]
      const passport1 = otherAccounts[1]
      const passport2 = otherAccounts[2]

      // Link entity1 to passport1
      await linkEntityToPassportWithSignature(veBetterPassport, passport1, entity1, 1000)

      // Attempt to link entity1 to passport2, which should fail
      await expect(
        linkEntityToPassportWithSignature(veBetterPassport, passport2, entity1, 1000),
      ).to.be.revertedWithCustomError(veBetterPassport, "AlreadyLinked")

      // Ensure entity1 is still only linked to passport1
      expect(await veBetterPassport.getPassportForEntity(entity1.address)).to.equal(passport1.address)
    })

    it("Entity check should be done also when accepting a link", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // Scenario:
      // Entity A -> pending linking to Passport B
      // Entity C -> tries to link to Entity A -> should revert

      await veBetterPassport.connect(A).linkEntityToPassport(B.address)
      await expect(veBetterPassport.connect(C).linkEntityToPassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })

    it("Entity check should check that user is not a delegatee", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // Scenario:
      // Passport A Delegates to Passport B
      // B tries to link to C -> should revert

      await delegateWithSignature(veBetterPassport, A, B, 1000)
      await expect(veBetterPassport.connect(B).linkEntityToPassport(C.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "DelegatedEntity",
      )
    })

    it("Entity check should check that user is not a pending delegatee", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // Scenario:
      // Passport A Delegates to Passport B
      // Passport B tries to link to Passport C -> should revert

      await veBetterPassport.connect(A).delegatePassport(B.address)
      await expect(veBetterPassport.connect(B).linkEntityToPassport(C.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "DelegatedEntity",
      )
    })

    it("Entity check should check that entity is not a pending passport", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // Scenario:
      // Passport A has a pending link to entity B
      // Passport A tries to link to passport C -> should revert

      await veBetterPassport.connect(B).linkEntityToPassport(A.address)

      await expect(veBetterPassport.connect(A).linkEntityToPassport(C.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })

    it("Entity check should be done also when accepting a delegation link", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // Scenario:
      // A -> pending linking to B
      // C -> pending linking to A
      // B accepts linking
      // A accepts linking -> should revert

      await veBetterPassport.connect(A).delegatePassport

      await veBetterPassport.connect(A).linkEntityToPassport(B.address)
      await expect(veBetterPassport.connect(C).linkEntityToPassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })

    it("Should revert if passport is trying to link to another passport with signature", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // Enitity B links to passport A
      await linkEntityToPassportWithSignature(veBetterPassport, A, B, 1000)

      // Passport A tries to link to passport C
      await expect(linkEntityToPassportWithSignature(veBetterPassport, C, A, 1000)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })

    it("Should be able to register an entity by function calls", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(veBetterPassport.connect(entity).linkEntityToPassport(passport.address))
        .to.emit(veBetterPassport, "LinkPending")
        .withArgs(entity.address, passport.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Expect pending link
      expect((await veBetterPassport.getPendingLinkings(passport.address))[0].length).to.equal(1)

      // Approve the entity
      await expect(veBetterPassport.connect(passport).acceptEntityLink(entity.address))
        .to.emit(veBetterPassport, "LinkCreated")
        .withArgs(entity.address, passport.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.true
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.equal(true)
      // Expect no pending link
      expect((await veBetterPassport.getPendingLinkings(passport.address))[0].length).to.equal(0)
    })

    it("Should be able to register an entity by signature", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true
      // No entity is linked to the passport
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.be.empty

      // Approve the entity
      // await veBetterPassport.delegateWithSignature(other)
      // Set up EIP-712 domain
      const domain = {
        name: "VeBetterPassport",
        version: "1",
        chainId: 1337,
        verifyingContract: await veBetterPassport.getAddress(),
      }
      let types = {
        LinkEntity: [
          { name: "entity", type: "address" },
          { name: "passport", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      }

      // Define a deadline timestamp
      const currentBlock = await ethers.provider.getBlockNumber()
      const block = await ethers.provider.getBlock(currentBlock)

      if (!block) {
        throw new Error("Block not found")
      }

      const deadline = block.timestamp + 3600 // 1 hour from
      // Prepare the struct to sign
      const linkData = {
        entity: entity.address,
        passport: passport.address,
        deadline: deadline,
      }

      // Create the EIP-712 signature for the delegator
      const signature = await entity.signTypedData(domain, types, linkData)

      // Perform the delegation using the signature
      await expect(
        veBetterPassport.connect(passport).linkEntityToPassportWithSignature(entity.address, deadline, signature),
      )
        .to.emit(veBetterPassport, "LinkCreated")
        .withArgs(entity.address, passport.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.true
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.equal(true)
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.have.lengthOf(1)
    })

    it("Should be ale to link multiple entities to pasport", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const entity1 = otherAccounts[0]
      const entity2 = otherAccounts[1]
      const entity3 = otherAccounts[2]

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity1.address)).to.be.false
      expect(await veBetterPassport.isEntity(entity2.address)).to.be.false
      expect(await veBetterPassport.isEntity(entity3.address)).to.be.false

      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.be.empty

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity1, 1000)
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity2, 1000)
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity3, 1000)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity1.address)).to.be.true
      expect(await veBetterPassport.isEntity(entity2.address)).to.be.true
      expect(await veBetterPassport.isEntity(entity3.address)).to.be.true

      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.equal(true)
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.have.lengthOf(3)
    })

    it("Should be able to unlink an entity from a passport", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true

      // Approve the entity
      await expect(veBetterPassport.connect(entity).linkEntityToPassport(passport.address))
        .to.emit(veBetterPassport, "LinkPending")
        .withArgs(entity.address, passport.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Expect pending link
      expect((await veBetterPassport.getPendingLinkings(passport.address))[0].length).to.equal(1)

      // Approve the entity
      await expect(veBetterPassport.connect(passport).acceptEntityLink(entity.address))
        .to.emit(veBetterPassport, "LinkCreated")
        .withArgs(entity.address, passport.address)

      const block = await ethers.provider.getBlockNumber()

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.true
      expect(await veBetterPassport.getPassportForEntity(entity.address)).to.equal(passport.address)
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.equal(true)
      // Expect no pending link
      expect((await veBetterPassport.getPendingLinkings(passport.address))[0].length).to.equal(0)

      // Unlink the entity
      await expect(veBetterPassport.connect(passport).removeEntityLink(entity.address))
        .to.emit(veBetterPassport, "LinkRemoved")
        .withArgs(entity.address, passport.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true

      // Entity should have been linked at the time of the block
      expect(await veBetterPassport.isEntityInTimepoint(entity.address, block)).to.be.true

      expect(await veBetterPassport.getPassportForEntityAtTimepoint(entity.address, block)).to.equal(passport.address)
    })

    it("Should not be ale to link more entities than MAX allowed to be linked to a pasport", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_PASSPORT_MAX_ENTITIES = 2
      const {
        veBetterPassport,
        owner: passport,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const entity1 = otherAccounts[0]
      const entity2 = otherAccounts[1]
      const entity3 = otherAccounts[2]

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity1.address)).to.be.false
      expect(await veBetterPassport.isEntity(entity2.address)).to.be.false
      expect(await veBetterPassport.isEntity(entity3.address)).to.be.false

      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.be.empty

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity1, 1000)
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity2, 1000)
      await expect(
        linkEntityToPassportWithSignature(veBetterPassport, passport, entity3, 1000),
      ).to.be.revertedWithCustomError(veBetterPassport, "MaxEntitiesPerPassportReached")

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity1.address)).to.be.true
      expect(await veBetterPassport.isEntity(entity2.address)).to.be.true
      expect(await veBetterPassport.isEntity(entity3.address)).to.be.false

      // Can update max entities per passport
      await veBetterPassport.connect(passport).setMaxEntitiesPerPassport(3)

      // Can link the entity
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity3, 1000)
      expect(await veBetterPassport.isEntity(entity3.address)).to.be.true

      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.equal(true)
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.have.lengthOf(3)
    })

    it("Only passport or entity should be able to unlink an entity from a passport", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const randomWallet = otherAccounts[0]

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true

      // Approve the entity
      await expect(veBetterPassport.connect(entity).linkEntityToPassport(passport.address))
        .to.emit(veBetterPassport, "LinkPending")
        .withArgs(entity.address, passport.address)

      await expect(veBetterPassport.connect(randomWallet).denyIncomingPendingDelegation(entity.address)).to.be.reverted

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Expect pending link
      expect((await veBetterPassport.getPendingLinkings(passport.address))[0].length).to.equal(1)
      // Expect no outgoing pending link
      expect((await veBetterPassport.getPendingLinkings(passport.address))[1]).to.equal(ZeroAddress)
      // Expect an outgoing pending link from the random wallet to the entity
      expect((await veBetterPassport.getPendingLinkings(entity.address))[1]).to.equal(passport.address)
      // Expect no incoming pending link
      expect((await veBetterPassport.getPendingLinkings(entity.address))[0].length).to.equal(0)

      // Approve the entity
      await expect(veBetterPassport.connect(passport).acceptEntityLink(entity.address))
        .to.emit(veBetterPassport, "LinkCreated")
        .withArgs(entity.address, passport.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.true
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.equal(true)
      // Expect no pending link
      expect((await veBetterPassport.getPendingLinkings(passport.address))[0].length).to.equal(0)

      // Unlink the entity
      await expect(
        veBetterPassport.connect(randomWallet).removeEntityLink(entity.address),
      ).to.be.revertedWithCustomError(veBetterPassport, "UnauthorizedUser")
    })

    it("Should be able to unlink multiple entities from a passport", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const entity1 = otherAccounts[0]
      const entity2 = otherAccounts[1]
      const entity3 = otherAccounts[2]

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity1.address)).to.be.false
      expect(await veBetterPassport.isEntity(entity2.address)).to.be.false
      expect(await veBetterPassport.isEntity(entity3.address)).to.be.false

      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.be.empty

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity1, 1000)
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity2, 1000)
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity3, 1000)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity1.address)).to.be.true
      expect(await veBetterPassport.isEntity(entity2.address)).to.be.true
      expect(await veBetterPassport.isEntity(entity3.address)).to.be.true

      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.equal(true)
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.have.lengthOf(3)

      // Unlink the entities
      await expect(veBetterPassport.connect(passport).removeEntityLink(entity1.address))
        .to.emit(veBetterPassport, "LinkRemoved")
        .withArgs(entity1.address, passport.address)
      await expect(veBetterPassport.connect(passport).removeEntityLink(entity2.address))
        .to.emit(veBetterPassport, "LinkRemoved")
        .withArgs(entity2.address, passport.address)
      await expect(veBetterPassport.connect(passport).removeEntityLink(entity3.address))
        .to.emit(veBetterPassport, "LinkRemoved")
        .withArgs(entity3.address, passport.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity1.address)).to.be.false
      expect(await veBetterPassport.isEntity(entity2.address)).to.be.false
      expect(await veBetterPassport.isEntity(entity3.address)).to.be.false

      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.be.empty
    })

    it("Should be able to cancel a pending entity link", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true

      // Approve the entity
      await expect(veBetterPassport.connect(entity).linkEntityToPassport(passport.address))
        .to.emit(veBetterPassport, "LinkPending")
        .withArgs(entity.address, passport.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Expect pending link
      expect((await veBetterPassport.getPendingLinkings(passport.address))[0].length).to.equal(1)

      // Cancel the pending link
      await expect(veBetterPassport.connect(passport).denyIncomingPendingEntityLink(entity.address))
        .to.emit(veBetterPassport, "LinkRemoved")
        .withArgs(entity.address, passport.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true
      // Expect no pending link
      expect((await veBetterPassport.getPendingLinkings(passport.address))[0].length).to.equal(0)
    })

    it("Only the link target can deny an incoming link request", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true

      // Approve the entity
      await expect(veBetterPassport.connect(entity).linkEntityToPassport(passport.address))
        .to.emit(veBetterPassport, "LinkPending")
        .withArgs(entity.address, passport.address)

      // Try to deny the link request
      await expect(
        veBetterPassport.connect(otherAccounts[1]).denyIncomingPendingEntityLink(entity.address),
      ).to.be.revertedWithCustomError(veBetterPassport, "UnauthorizedUser")

      // The target of the link should be able to deny the link request
      await expect(veBetterPassport.connect(passport).denyIncomingPendingEntityLink(entity.address))
        .to.emit(veBetterPassport, "LinkRemoved")
        .withArgs(entity.address, passport.address)
    })

    it("Should revert if passport tries remove pending link without any pending link", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Try to deny the link request
      await expect(veBetterPassport.connect(passport).denyIncomingPendingEntityLink(entity.address)).to.be.reverted
    })

    it("Should revert if entity tries cancel pending link without any pending link", async function () {
      const { veBetterPassport, otherAccount: entity } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Try to deny the link request
      await expect(veBetterPassport.connect(entity).cancelOutgoingPendingEntityLink()).to.be.reverted
    })

    it("If A wants to link to C, and B wants to link to C, A should be able to deny only B's link request", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(A.address)).to.be.false
      expect(await veBetterPassport.isEntity(B.address)).to.be.false
      expect(await veBetterPassport.isEntity(C.address)).to.be.false

      // A wants to link to C
      await expect(veBetterPassport.connect(A).linkEntityToPassport(C.address))
        .to.emit(veBetterPassport, "LinkPending")
        .withArgs(A.address, C.address)

      // B wants to link to C
      await expect(veBetterPassport.connect(B).linkEntityToPassport(C.address))
        .to.emit(veBetterPassport, "LinkPending")
        .withArgs(B.address, C.address)

      // C should have 2 incoming pending links and 0 outgoing pending links
      expect((await veBetterPassport.getPendingLinkings(C.address))[0]).to.deep.equal([A.address, B.address])
      expect((await veBetterPassport.getPendingLinkings(C.address))[1]).to.equal(ZeroAddress)

      // C denies A's link request
      await expect(veBetterPassport.connect(C).denyIncomingPendingEntityLink(A.address))
        .to.emit(veBetterPassport, "LinkRemoved")
        .withArgs(A.address, C.address)

      // C should have 1 incoming pending links and 0 outgoing pending links
      expect((await veBetterPassport.getPendingLinkings(C.address))[0]).to.deep.equal([B.address])
      expect((await veBetterPassport.getPendingLinkings(C.address))[1]).to.equal(ZeroAddress)

      // B should be able to cancel his link request to C
      await expect(veBetterPassport.connect(B).cancelOutgoingPendingEntityLink())
        .to.emit(veBetterPassport, "LinkRemoved")
        .withArgs(B.address, C.address)

      // C should have 1 incoming pending links and 0 outgoing pending links
      expect((await veBetterPassport.getPendingLinkings(C.address))[0]).to.deep.equal([])
      expect((await veBetterPassport.getPendingLinkings(C.address))[1]).to.equal(ZeroAddress)
    })

    it("Should not be able to assign an entity to a passport if the entity is already linked to another passport", async function () {
      const {
        veBetterPassport,
        owner: passport1,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const entity = otherAccounts[0]
      const passport2 = otherAccounts[1]

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport1.address)).to.be.true
      expect(await veBetterPassport.isPassport(passport2.address)).to.be.true

      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport1.address)).to.be.empty
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport2.address)).to.be.empty

      // Approve the entity
      await expect(veBetterPassport.connect(entity).linkEntityToPassport(passport1.address))
        .to.emit(veBetterPassport, "LinkPending")
        .withArgs(entity.address, passport1.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Expect pending link
      expect((await veBetterPassport.getPendingLinkings(passport1.address))[0].length).to.equal(1)

      // Approve the entity
      await expect(veBetterPassport.connect(passport1).acceptEntityLink(entity.address))
        .to.emit(veBetterPassport, "LinkCreated")
        .withArgs(entity.address, passport1.address)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.true
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport1.address)).to.be.true
      expect(await veBetterPassport.isPassport(passport2.address)).to.be.true
      // Expect no pending link
      expect((await veBetterPassport.getPendingLinkings(passport1.address))[0].length).to.equal(0)

      // Try to link the entity to another passport
      await expect(
        veBetterPassport.connect(entity).linkEntityToPassport(passport2.address),
      ).to.be.revertedWithCustomError(veBetterPassport, "AlreadyLinked")
    })

    it("Should not be able to assign an entity to a passport if the entity is already linked to another passport", async function () {
      const { veBetterPassport, owner: passport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      // Try to link the entity to another passport
      await expect(
        veBetterPassport.connect(passport).linkEntityToPassport(passport.address),
      ).to.be.revertedWithCustomError(veBetterPassport, "CannotLinkToSelf")
    })

    it("Should not be able to assign an entity to a passport if the signature is invalid", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true
      // No entity is linked to the passport
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.be.empty

      // Approve the entity
      // await veBetterPassport.linkEntityToPassportWithSignature(other)
      // Set up EIP-712 domain
      const domain = {
        name: "VeBetterPassport",
        version: "1",
        chainId: 1337,
        verifyingContract: await veBetterPassport.getAddress(),
      }

      // Make the signature invalid
      let types = {
        INVALID: [
          { name: "entity", type: "address" },
          { name: "passport", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      }

      // Define a deadline timestamp
      const currentBlock = await ethers.provider.getBlockNumber()
      const block = await ethers.provider.getBlock(currentBlock)

      if (!block) {
        throw new Error("Block not found")
      }

      const deadline = block.timestamp + 3600 // 1 hour from
      // Prepare the struct to sign
      const linkData = {
        entity: entity.address,
        passport: passport.address,
        deadline: deadline,
      }

      // Create the EIP-712 signature for the delegator
      const signature = await entity.signTypedData(domain, types, linkData)

      // Perform the delegation using the signature
      await expect(
        veBetterPassport.connect(passport).linkEntityToPassportWithSignature(entity.address, deadline, signature),
      ).to.be.revertedWithCustomError(veBetterPassport, "InvalidSignature")
    })

    it("Should not be able to assign an entity to a passport if the signature is expired", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true
      // No entity is linked to the passport
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.be.empty

      // Approve the entity
      // await veBetterPassport.linkEntityToPassportWithSignature(other)
      // Set up EIP-712 domain
      const domain = {
        name: "VeBetterPassport",
        version: "1",
        chainId: 1337,
        verifyingContract: await veBetterPassport.getAddress(),
      }

      let types = {
        LinkEntity: [
          { name: "entity", type: "address" },
          { name: "passport", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      }

      // Define a deadline timestamp
      const currentBlock = await ethers.provider.getBlockNumber()
      const block = await ethers.provider.getBlock(currentBlock)

      if (!block) {
        throw new Error("Block not found")
      }

      const deadline = block.timestamp - 1 // Ensure the deadline is in the past
      // Prepare the struct to sign
      const linkData = {
        entity: entity.address,
        passport: passport.address,
        deadline: deadline,
      }

      // Create the EIP-712 signature for the delegator
      const signature = await entity.signTypedData(domain, types, linkData)

      // Perform the delegation using the expired signature
      await expect(
        veBetterPassport.connect(passport).linkEntityToPassportWithSignature(entity.address, deadline, signature),
      ).to.be.revertedWithCustomError(veBetterPassport, "SignatureExpired")
    })

    it("Should not be able to assign an entity to a passport if it is linked to another passport", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const passport2 = otherAccounts[0]

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true
      // No entity is linked to the passport
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.be.empty

      // Link the entity to the passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 1000)

      // Entity is linked to the passport
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.not.be.empty
      // Check entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.true

      await expect(
        linkEntityToPassportWithSignature(veBetterPassport, passport2, entity, 1000),
      ).to.be.revertedWithCustomError(veBetterPassport, "AlreadyLinked")
    })

    it("Should not be able to assign an entity to a passport if passport has the max number of entities already assigned", async function () {
      const config = createTestConfig()

      config.VEPASSPORT_PASSPORT_MAX_ENTITIES = 2

      const {
        veBetterPassport,
        owner: passport,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const entity1 = otherAccounts[0]
      const entity2 = otherAccounts[1]
      const entity3 = otherAccounts[2]

      // Ensure max number of entities per passport is 2
      expect(await veBetterPassport.maxEntitiesPerPassport()).to.be.equal(2)

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity1.address)).to.be.false
      // Check if passport is linked to an entity
      expect(await veBetterPassport.isPassport(passport.address)).to.be.true
      // No entity is linked to the passport
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.be.empty

      // Link the entities to the passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity1, 1000)
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity2, 1000)

      // Entity is linked to the passport
      expect(await veBetterPassport.getEntitiesLinkedToPassport(passport.address)).to.lengthOf(2)

      await expect(
        linkEntityToPassportWithSignature(veBetterPassport, passport, entity3, 1000),
      ).to.be.revertedWithCustomError(veBetterPassport, "MaxEntitiesPerPassportReached")
    })

    it("Should assign an enities score correctly", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      config.VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE = 5

      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts, creators } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      const passport = otherAccounts[0]

      const creator1 = creators[0]
      const creator2 = creators[1]
      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])
      await endorseApp(app3Id, otherAccounts[4])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets app1 security to APP_SECURITY.LOW
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)

      // Sets app2 security to APP_SECURITY.MEDIUM
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 2)

      // Sets app3 security to APP_SECURITY.HIGH
      await veBetterPassport.connect(owner).setAppSecurity(app3Id, 3)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)

      // Move through 5 rounds
      await moveToCycle(6)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 3)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 4)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app3Id, 5)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 2)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 3)).to.equal(200)
      expect(await veBetterPassport.userRoundScore(otherAccount, 4)).to.equal(200)
      expect(await veBetterPassport.userRoundScore(otherAccount, 5)).to.equal(400)

      await linkEntityToPassportWithSignature(veBetterPassport, passport, otherAccount, 1000)

      /*

        The entitys score should remain the same for the same when first assigned

        Round 1 score: 100
        Round 2 score: 100
        Round 3 score: 200
        Round 4 score: 200
        Round 5 score: 400

        round N = [round N score] + ([cumulative score] * [1 - decay factor])

        round 1 = 100 + (0 * 0.8) = 100
        round 2 = 100 + (100 * 0.8) = 180
        round 3 = 200 + (180 * 0.8) = 344
        round 4 = 200 + (344 * 0.8) = 475,2 => 475 
        round 5 = 400 + (475 * 0.8) = 780
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 5)).to.equal(780)

      /*
        The passports score should not take into account the entitys score over the past VEPASSPORT_ROUNDS_FOR_ASSIGNING_ENTITY_SCORE (3) rounds
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(passport, 5)).to.equal(0)

      // The entitys score for APP1 should not be the same as the passport score (interactions with app1 happended in round 1 and 2)
      expect(await veBetterPassport.userAppTotalScore(otherAccount, app1Id)).to.not.equal(
        await veBetterPassport.userAppTotalScore(passport, app1Id),
      )

      // The entitys score for APP2 should not be the same as the passport score (interactions with app2 happended in round 3 and 4)
      expect(await veBetterPassport.userAppTotalScore(otherAccount, app2Id)).to.not.equal(
        await veBetterPassport.userAppTotalScore(passport, app2Id),
      )

      // The entitys score for APP3 should not be the same as the passport score (interactions with app3 happended in round 5)
      expect(await veBetterPassport.userAppTotalScore(otherAccount, app3Id)).to.not.equal(
        await veBetterPassport.userAppTotalScore(passport, app3Id),
      )

      // If we move to the next round and the entity earns more points, the passport score should increase and not the entity score
      await moveToCycle(7)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 6)

      expect(await veBetterPassport.userRoundScore(otherAccount, 6)).to.equal(0)
      expect(await veBetterPassport.userRoundScore(passport, 6)).to.equal(100)
    })

    it("Should register aggregated actions for a round correctly", async function () {
      const {
        veBetterPassport,
        owner,
        x2EarnApps,
        b3tr,
        otherAccounts,
        xAllocationVoting,
        x2EarnRewardsPool,
        minterAccount,
        creators,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const user1 = otherAccounts[0]
      const user2 = otherAccounts[1]
      const creator1 = creators[0]
      const creator2 = creators[1]

      // Bootstrap emissions
      await bootstrapAndStartEmissions()
      // simulate 5 rounds of actions
      await moveToCycle(6)

      // Add 3 apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])
      await endorseApp(app3Id, otherAccounts[4])

      // Set apps security to LOW
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 1)
      await veBetterPassport.connect(owner).setAppSecurity(app3Id, 1)

      // Owner can distribute rewards for all apps
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, owner.address)
      expect(await x2EarnApps.isRewardDistributor(app1Id, owner.address)).to.equal(true)
      await x2EarnApps.connect(owner).addRewardDistributor(app2Id, owner.address)
      expect(await x2EarnApps.isRewardDistributor(app2Id, owner.address)).to.equal(true)
      await x2EarnApps.connect(owner).addRewardDistributor(app3Id, owner.address)
      expect(await x2EarnApps.isRewardDistributor(app3Id, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(minterAccount).mint(owner.address, ethers.parseEther("100"))
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), ethers.parseEther("100"))
      await x2EarnRewardsPool.connect(owner).deposit(ethers.parseEther("30"), app1Id)
      await x2EarnRewardsPool.connect(owner).deposit(ethers.parseEther("30"), app2Id)
      await x2EarnRewardsPool.connect(owner).deposit(ethers.parseEther("30"), app3Id)

      const currentRound = await xAllocationVoting.currentRoundId()
      const currentBlock = await ethers.provider.getBlockNumber()
      const currentRoundSnapshot = await xAllocationVoting.currentRoundSnapshot()
      const currentRoundDeadline = await xAllocationVoting.currentRoundDeadline()
      expect(currentRound).to.equal(5n)
      expect(currentBlock > currentRoundSnapshot && currentBlock < currentRoundDeadline).to.be.true

      expect(await x2EarnApps.isAppAdmin(app1Id, otherAccounts[2].address)).to.equal(true)
      expect(await x2EarnApps.isAppAdmin(app2Id, otherAccounts[3].address)).to.equal(true)
      expect(await x2EarnApps.isAppAdmin(app3Id, otherAccounts[4].address)).to.equal(true)

      // // x2EarnApps V4 introduced a default rewards pool for each new app
      // // For backwards compatibility, we need to disable the default rewards pool for the apps created in this test
      await x2EarnRewardsPool.connect(otherAccounts[2]).toggleRewardsPoolBalance(app1Id, false)
      await x2EarnRewardsPool.connect(otherAccounts[3]).toggleRewardsPoolBalance(app2Id, false)
      await x2EarnRewardsPool.connect(otherAccounts[4]).toggleRewardsPoolBalance(app3Id, false)

      // Let's assume we deployed VeBetterPassport in the middle of the 5th round
      // and we want to register the actions for the first 4 rounds aggregating data offchain.
      // Scenario:
      // User 1 used app1 4 times, app2 2 times and app3 never (distributed in multiple rounds), before deploying VBP
      // User 2 used app1 2 times, app2 2 times and app3 2 times (distributed in multiple rounds), before deploying VBP

      // Simulate that while we seed old actions, User1 uses app2 1 more time and app3 1 time
      await x2EarnRewardsPool.connect(owner).distributeReward(app2Id, ethers.parseEther("1"), user1.address, "0x")
      await x2EarnRewardsPool.connect(owner).distributeReward(app3Id, ethers.parseEther("1"), user1.address, "0x")

      // Now we seed old aggregated actions for the first 4 rounds and part of the 5th
      await veBetterPassport.connect(owner).registerAggregatedActionsForRound(user1.address, app1Id, 1, 200) // user1 used app1 2 times in round 1
      await veBetterPassport.connect(owner).registerAggregatedActionsForRound(user1.address, app1Id, 2, 200) // user1 used app1 2 times in round 2
      await veBetterPassport.connect(owner).registerAggregatedActionsForRound(user1.address, app2Id, 2, 100) // user1 used app2 1 time in round 2
      await veBetterPassport.connect(owner).registerAggregatedActionsForRound(user1.address, app2Id, 5, 100) // user1 used app2 1 time in round 2

      await veBetterPassport.connect(owner).registerAggregatedActionsForRound(user2.address, app3Id, 1, 100) // user2 used app3 1 time in round 1
      await veBetterPassport.connect(owner).registerAggregatedActionsForRound(user2.address, app1Id, 3, 100) // user2 used app1 1 time in round 3
      await veBetterPassport.connect(owner).registerAggregatedActionsForRound(user2.address, app3Id, 3, 100) // user2 used app3 1 time in round 3
      await veBetterPassport.connect(owner).registerAggregatedActionsForRound(user2.address, app1Id, 4, 100) // user2 used app1 1 time in round 4
      await veBetterPassport.connect(owner).registerAggregatedActionsForRound(user2.address, app2Id, 5, 200) // user2 used app2 2 time in round 5

      // At the end this should be the result:
      // user1:
      //   round 1: 200, using app1 2 times
      //   round 2: 200 + 100 = 300, using app1 2 times and app2 1 time
      //   round 3: 0
      //   round 4: 0
      //   round 5: 200 + 100 = 300, using app1 1 time, app2 1 time, app3 1 time
      // user2:
      //   round 1: 100, using app1 1 time
      //   round 2: 0
      //   round 3: 100 + 100 = 200, using app1 1 time and app3 1 time
      //   round 4: 100, using app1 1 time
      //   round 5: 100 + 100 = 200, using app2 2 times
      //
      // Now we should check that the following mappings were updated correctly in the contract:
      // userRoundScore[passport][round]
      // userTotalScore[passport]
      // userAppRoundScore[passport][round][appId]
      // userAppTotalScore[passport][appId]
      //user1
      expect(await veBetterPassport.userRoundScore(user1.address, 1)).to.equal(200n)
      expect(await veBetterPassport.userRoundScore(user1.address, 2)).to.equal(300n)
      expect(await veBetterPassport.userRoundScore(user1.address, 3)).to.equal(0n)
      expect(await veBetterPassport.userRoundScore(user1.address, 4)).to.equal(0n)
      expect(await veBetterPassport.userRoundScore(user1.address, 5)).to.equal(300n)
      expect(await veBetterPassport.userTotalScore(user1.address)).to.equal(800n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 1, app1Id)).to.equal(200n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 1, app2Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 1, app3Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 2, app1Id)).to.equal(200n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 2, app2Id)).to.equal(100n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 2, app3Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 3, app1Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 3, app2Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 3, app3Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 4, app1Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 4, app2Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 4, app3Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 5, app1Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 5, app2Id)).to.equal(200n)
      expect(await veBetterPassport.userRoundScoreApp(user1.address, 5, app3Id)).to.equal(100n)
      expect(await veBetterPassport.userAppTotalScore(user1.address, app1Id)).to.equal(400n)
      expect(await veBetterPassport.userAppTotalScore(user1.address, app2Id)).to.equal(300n)
      expect(await veBetterPassport.userAppTotalScore(user1.address, app3Id)).to.equal(100n)
      //user2
      expect(await veBetterPassport.userRoundScore(user2.address, 1)).to.equal(100n)
      expect(await veBetterPassport.userRoundScore(user2.address, 2)).to.equal(0n)
      expect(await veBetterPassport.userRoundScore(user2.address, 3)).to.equal(200n)
      expect(await veBetterPassport.userRoundScore(user2.address, 4)).to.equal(100n)
      expect(await veBetterPassport.userRoundScore(user2.address, 5)).to.equal(200n)
      expect(await veBetterPassport.userTotalScore(user2.address)).to.equal(600n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 1, app1Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 1, app2Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 1, app3Id)).to.equal(100n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 2, app1Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 2, app2Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 2, app3Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 3, app1Id)).to.equal(100n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 3, app2Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 3, app3Id)).to.equal(100n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 4, app1Id)).to.equal(100n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 4, app2Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 4, app3Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 5, app1Id)).to.equal(0n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 5, app2Id)).to.equal(200n)
      expect(await veBetterPassport.userRoundScoreApp(user2.address, 5, app3Id)).to.equal(0n)
      expect(await veBetterPassport.userAppTotalScore(user2.address, app1Id)).to.equal(200n)
      expect(await veBetterPassport.userAppTotalScore(user2.address, app2Id)).to.equal(200n)
      expect(await veBetterPassport.userAppTotalScore(user2.address, app3Id)).to.equal(200n)
    })

    it("Should remove an enities score correctly", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts, creators } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      const passport = otherAccounts[0]

      const creator1 = creators[0]
      const creator2 = creators[1]

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])
      await endorseApp(app3Id, otherAccounts[4])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets app1 security to APP_SECURITY.LOW
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)

      // Sets app2 security to APP_SECURITY.MEDIUM
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 2)

      // Sets app3 security to APP_SECURITY.HIGH
      await veBetterPassport.connect(owner).setAppSecurity(app3Id, 3)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)

      // Move through 5 rounds
      await moveToCycle(6)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 3)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 4)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app3Id, 5)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 2)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 3)).to.equal(200)
      expect(await veBetterPassport.userRoundScore(otherAccount, 4)).to.equal(200)
      expect(await veBetterPassport.userRoundScore(otherAccount, 5)).to.equal(400)

      await linkEntityToPassportWithSignature(veBetterPassport, passport, otherAccount, 1000)

      /*

        The entitys score should remain the same as when first assigned

        Round 1 score: 100
        Round 2 score: 100
        Round 3 score: 200
        Round 4 score: 200
        Round 5 score: 400

        round N = [round N score] + ([cumulative score] * [1 - decay factor])

        round 1 = 100 + (0 * 0.8) = 100
        round 2 = 100 + (100 * 0.8) = 180
        round 3 = 200 + (180 * 0.8) = 344
        round 4 = 200 + (344 * 0.8) = 475,2 => 475 
        round 5 = 400 + (475 * 0.8) = 780
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 5)).to.equal(780)
      expect(await veBetterPassport.userTotalScore(otherAccount)).to.equal(1000)

      /*
        The passports score should not take into account the entitys score over the past VEPASSPORT_ROUNDS_FOR_ASSIGNING_ENTITY_SCORE (3) rounds
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(passport, 5)).to.equal(0)
      expect(await veBetterPassport.userTotalScore(passport)).to.equal(0)

      // The entitys score for APP1 should not be the same as the passport score (interactions with app1 happended in round 1 and 2)
      expect(await veBetterPassport.userAppTotalScore(otherAccount, app1Id)).to.not.equal(
        await veBetterPassport.userAppTotalScore(passport, app1Id),
      )

      // The entitys score for APP2 should not be the same as the passport score (interactions with app2 happended in round 3 and 4)
      expect(await veBetterPassport.userAppTotalScore(otherAccount, app2Id)).to.not.equal(
        await veBetterPassport.userAppTotalScore(passport, app2Id),
      )

      // The entitys score for APP3 should not be the same as the passport score (interactions with app3 happended in round 5)
      expect(await veBetterPassport.userAppTotalScore(otherAccount, app3Id)).to.not.equal(
        await veBetterPassport.userAppTotalScore(passport, app3Id),
      )

      // If we move to the next round and the entity earns more points, the passport score should increase and not the entity score
      await moveToCycle(7)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app3Id, 6)

      expect(await veBetterPassport.userRoundScore(otherAccount, 6)).to.equal(0)
      expect(await veBetterPassport.userRoundScore(passport, 6)).to.equal(400)

      /*

        The passports score should take into account the entitys score over the last round

        round 6 = 400
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(passport, 6)).to.equal(400)

      // Remove the entity from the passport
      await veBetterPassport.connect(passport).removeEntityLink(otherAccount)

      /*

        The entitys score should remain the same for the same when first assigned (did not earn any points in round 6)

        Round 1 score: 100
        Round 2 score: 100
        Round 3 score: 200
        Round 4 score: 200
        Round 5 score: 400

        round N = [round N score] + ([cumulative score] * [1 - decay factor])

        round 1 = 100 * 0.5^5 = 3.125 => 32.76 => 32 -> Not included as this is more than 5 rounds ago (roundsForCumulativeScore)
        round 2 = 100 * 0.8^4 = 40.96 => 40
        round 3 = 200 * 0.8^3 = 102.4 => 102
        round 4 = 200 * 0.8^2 = 128
        round 5 = 400 * 0.8 = 320
        round 6 = 0
      */

      expect(await veBetterPassport.userTotalScore(otherAccount)).to.equal(1000)
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 6)).to.equal(591) // Entities cumulative score should be decyaed by 0.8

      /*

        The passports score should remain the same for the period the entity was linked to the passport
        
        round 6 = 400
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(passport, 6)).to.equal(400)
      expect(await veBetterPassport.userTotalScore(passport)).to.equal(400) // Score earned by the entity in the last round
    })

    it("Should assign an enities signals correctly", async function () {
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const appAdmin = otherAccounts[0]
      const passport = otherAccounts[1]

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, appAdmin, otherAccounts[0].address, "metadataURI")

      const appId = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      await endorseApp(appId, appAdmin)

      await expect(veBetterPassport.connect(appAdmin).assignSignalerToAppByAppAdmin(appId, otherAccount.address))
        .to.emit(veBetterPassport, "SignalerAssignedToApp")
        .withArgs(otherAccount.address, appId)

      await veBetterPassport.connect(owner).setAppSecurity(appId, 1)

      // Register action for entity so that it is assigned a score
      await veBetterPassport.connect(owner).registerActionForRound(owner, appId, 2)

      expect(await veBetterPassport.hasRole(await veBetterPassport.SIGNALER_ROLE(), otherAccount.address)).to.be.true

      await expect(veBetterPassport.connect(otherAccount).signalUserWithReason(owner.address, "Some reason"))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(owner.address, otherAccount.address, appId, "Some reason")

      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(1)

      // Passport should inherit the signals from the entity
      await linkEntityToPassportWithSignature(veBetterPassport, passport, owner, 1000)

      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(1)

      // Passport should inherit the signals from the entity
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(1)

      await expect(veBetterPassport.connect(otherAccount).signalUserWithReason(owner.address, "Some reason"))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(owner.address, otherAccount.address, appId, "Some reason")

      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(2)

      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(2)
    })

    it("Should remove enity signals correctly when entity detaches from passport", async function () {
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const appAdmin = otherAccounts[0]
      const passport = otherAccounts[1]

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, appAdmin, otherAccounts[0].address, "metadataURI")

      const appId = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      await endorseApp(appId, appAdmin)

      await expect(veBetterPassport.connect(appAdmin).assignSignalerToAppByAppAdmin(appId, otherAccount.address))
        .to.emit(veBetterPassport, "SignalerAssignedToApp")
        .withArgs(otherAccount.address, appId)

      await veBetterPassport.connect(owner).setAppSecurity(appId, 1)

      // Register action for entity so that it is assigned a score
      await veBetterPassport.connect(owner).registerActionForRound(owner, appId, 2)

      expect(await veBetterPassport.hasRole(await veBetterPassport.SIGNALER_ROLE(), otherAccount.address)).to.be.true

      await expect(veBetterPassport.connect(otherAccount).signalUserWithReason(owner.address, "Some reason"))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(owner.address, otherAccount.address, appId, "Some reason")

      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(1)

      // Passport should inherit the signals from the entity
      await linkEntityToPassportWithSignature(veBetterPassport, passport, owner, 1000)

      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(1)

      // Passport should inherit the signals from the entity
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(1)

      await expect(veBetterPassport.connect(otherAccount).signalUserWithReason(owner.address, "Some reason"))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(owner.address, otherAccount.address, appId, "Some reason")

      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(2)

      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(2)

      // Remove the entity from the passport
      await veBetterPassport.connect(owner).removeEntityLink(owner)

      // Entity signals should remain the same
      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(2)

      // Passport signals should be removed
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(0)
    })

    it("Should assign an enities blacklists and whitelists correctly", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE = 0
      config.VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE = 0
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false

      // Blacklist the entity
      await veBetterPassport.blacklist(entity.address)

      // Check if entity is blacklisted
      expect(await veBetterPassport.isBlacklisted(entity.address)).to.be.true

      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.false

      // Passport should inherit the signals from the entity
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 1000)

      // Passport should be blacklisted
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.true

      // Passport account is not blacklisted
      expect(await veBetterPassport.isBlacklisted(passport.address)).to.be.false

      // whitelist the entity
      await veBetterPassport.whitelist(entity.address)

      // Check if entity is whitelisted
      expect(await veBetterPassport.isWhitelisted(entity.address)).to.be.true
      expect(await veBetterPassport.isBlacklisted(entity.address)).to.be.false

      // Passport should inherit the lisitngs from the entity
      expect(await veBetterPassport.isPassportWhitelisted(passport.address)).to.be.true
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.false
    })

    it("Should remove any blacklists and whitelists an entity may have when it detaches", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE = 0
      config.VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE = 0
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Check if entity is linked to a passport
      expect(await veBetterPassport.isEntity(entity.address)).to.be.false

      // Blacklist the entity
      await veBetterPassport.blacklist(entity.address)

      // Check if entity is blacklisted
      expect(await veBetterPassport.isBlacklisted(entity.address)).to.be.true

      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.false

      // Passport should inherit the signals from the entity
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 1000)

      // Passport should be blacklisted
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.true

      // Passport account is not blacklisted
      expect(await veBetterPassport.isBlacklisted(passport.address)).to.be.false

      // whitelist the entity
      await veBetterPassport.whitelist(entity.address)

      // Check if entity is whitelisted
      expect(await veBetterPassport.isWhitelisted(entity.address)).to.be.true
      expect(await veBetterPassport.isBlacklisted(entity.address)).to.be.false

      // Passport should inherit the lisitngs from the entity
      expect(await veBetterPassport.isPassportWhitelisted(passport.address)).to.be.true
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.false

      // Remove the entity from the passport
      await veBetterPassport.connect(passport).removeEntityLink(entity)

      // Entity should be whitelisted
      expect(await veBetterPassport.isWhitelisted(entity.address)).to.be.true

      // Entity should not be blacklisted
      expect(await veBetterPassport.isBlacklisted(entity.address)).to.be.false

      // Passport should not be blacklisted
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.false

      // Passport should not be whitelisted
      expect(await veBetterPassport.isPassportWhitelisted(passport.address)).to.be.false
    })

    it("Should be able to assign multiple entites to a passport, do actions with entities and use the combintation to meet personhood status", async function () {
      const config = createTestConfig()
      const { veBetterPassport, x2EarnApps, owner, otherAccounts, creators } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const enity1 = otherAccounts[0]
      const enity2 = otherAccounts[1]
      const passport = otherAccounts[2]
      const creator1 = creators[0]

      // Set the threshold to 500
      await veBetterPassport.connect(owner).setThresholdPoPScore(500)

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets app1 security to APP_SECURITY.LOW
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)

      // Sets app2 security to APP_SECURITY.MEDIUM
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 2)

      await veBetterPassport.connect(owner).registerActionForRound(enity1, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity1, app2Id, 1)

      await veBetterPassport.connect(owner).registerActionForRound(enity2, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity2, app2Id, 1)

      // Move through 1 round
      await moveToCycle(2)

      // Entity 1 should have a score of 300
      expect(await veBetterPassport.userTotalScore(enity1)).to.equal(300)
      expect(await veBetterPassport.userTotalScore(enity2)).to.equal(300)

      // Cumulative score for entity 1 should be 300
      expect(await veBetterPassport.getCumulativeScoreWithDecay(enity1, 1)).to.equal(300)
      expect(await veBetterPassport.getCumulativeScoreWithDecay(enity2, 1)).to.equal(300)

      // Score threshold should be 500
      expect(await veBetterPassport.thresholdPoPScore()).to.equal(500)

      // Enable PoP score check
      await veBetterPassport.connect(owner).toggleCheck(4)
      expect(await veBetterPassport.isCheckEnabled(4)).to.be.true

      // Entity 1 should not be a person
      expect(await veBetterPassport.isPerson(enity1.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Entity 2 should not be a person
      expect(await veBetterPassport.isPerson(enity2.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Assign entity 1 to passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, enity1, 1000)

      // Passport should not be a person
      expect(await veBetterPassport.isPerson(passport.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Assign entity 2 to passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, enity2, 1000)

      // Passport should not be a person
      expect(await veBetterPassport.isPerson(passport.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Entity 1 should not be a person
      expect(await veBetterPassport.isPerson(enity1.address)).to.deep.equal([
        false,
        "User has delegated their personhood",
      ])

      // Entity 2 should not be a person
      expect(await veBetterPassport.isPerson(enity2.address)).to.deep.equal([
        false,
        "User has delegated their personhood",
      ])

      // Make entities interact with apps
      await veBetterPassport.connect(owner).registerActionForRound(enity1, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity1, app2Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity1, app2Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity2, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity2, app2Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity2, app2Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity2, app2Id, 1)

      // Now passport should have enough score to be a person
      expect(await veBetterPassport.isPerson(passport.address)).to.deep.equal([
        true,
        "User's participation score is above the threshold",
      ])
    })

    it("Cannot attach an entity if entity has delegated personhood", async function () {
      const config = createTestConfig()
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const enity1 = otherAccounts[0]
      const enity2 = otherAccounts[1]
      const passport = otherAccounts[2]
      const passport2 = otherAccounts[3]

      // Delegate entity 1 personhood to entity 2
      await delegateWithSignature(veBetterPassport, enity1, passport2, 1000)

      await veBetterPassport.connect(enity2).delegatePassport(passport2.address)

      // Should revert if entity 1 tries to attach to passport
      await expect(
        linkEntityToPassportWithSignature(veBetterPassport, passport, enity1, 1000),
      ).to.be.revertedWithCustomError(veBetterPassport, "DelegatedEntity")

      // Should revert if entity 2 tries to attach to passport
      await expect(
        veBetterPassport.connect(enity2).linkEntityToPassport(passport.address),
      ).to.be.revertedWithCustomError(veBetterPassport, "DelegatedEntity")
    })
  })

  describe("Passport Delegation", function () {
    it("Should be able to delegate personhood with signature", async function () {
      const {
        xAllocationVoting,
        x2EarnApps,
        otherAccounts,
        owner,
        veBetterPassport,
        otherAccount: delegatee,
        creators,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      otherAccounts.forEach(async account => {
        await getVot3Tokens(account, "10000")
      })
      await getVot3Tokens(delegatee, "10000")
      await getVot3Tokens(owner, "10000")

      // Whitelist owner
      await expect(veBetterPassport.connect(owner).whitelist(owner.address))
        .to.emit(veBetterPassport, "UserWhitelisted")
        .withArgs(owner.address, owner.address)
      await veBetterPassport.connect(owner).whitelist(otherAccounts[1].address)

      // Expect owner to be whitelisted
      expect(await veBetterPassport.isWhitelisted(owner.address)).to.be.true

      // Enable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true

      // expect owner to be person
      expect(await veBetterPassport.isPerson(owner.address)).to.deep.equal([true, "User is whitelisted"])

      const creator1 = creators[0]
      const creator2 = creators[1]

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])

      // await veBetterPassport.delegateWithSignature(other)
      // Set up EIP-712 domain
      const domain = {
        name: "VeBetterPassport",
        version: "1",
        chainId: 1337,
        verifyingContract: await veBetterPassport.getAddress(),
      }
      let types = {
        Delegation: [
          { name: "delegator", type: "address" },
          { name: "delegatee", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      }

      // Define a deadline timestamp
      const currentBlock = await ethers.provider.getBlockNumber()
      const block = await ethers.provider.getBlock(currentBlock)

      if (!block) {
        throw new Error("Block not found")
      }

      const deadline = block.timestamp + 3600 // 1 hour from
      // Prepare the struct to sign
      const delegationData = {
        delegator: owner.address,
        delegatee: delegatee.address,
        deadline: deadline,
      }

      // Create the EIP-712 signature for the delegator
      const signature = await owner.signTypedData(domain, types, delegationData)

      // Perform the delegation using the signature
      await expect(veBetterPassport.connect(delegatee).delegateWithSignature(owner.address, deadline, signature))
        .to.emit(veBetterPassport, "DelegationCreated")
        .withArgs(owner.address, delegatee.address)

      // Verify that the delegatee has been assigned the delegator
      const storedDelegatee = await veBetterPassport.getDelegatee(owner.address)
      expect(storedDelegatee).to.equal(delegatee.address)

      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app3Id, otherAccounts[4])

      //Start allocation round
      const round1 = await startNewAllocationRound()
      // Vote
      await xAllocationVoting
        .connect(delegatee)
        .castVote(
          round1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      // Otheraccounts[1] has not delegated his passport and can vote
      await xAllocationVoting
        .connect(otherAccounts[1])
        .castVote(
          round1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )
    })

    it("Should be able to delegate personhood", async function () {
      const {
        xAllocationVoting,
        x2EarnApps,
        otherAccounts,
        owner,
        veBetterPassport,
        otherAccount: delegatee,
        creators,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      otherAccounts.forEach(async account => {
        await getVot3Tokens(account, "10000")
      })
      await getVot3Tokens(delegatee, "10000")
      await getVot3Tokens(owner, "10000")

      // Whitelist owner
      await expect(veBetterPassport.connect(owner).whitelist(owner.address))
        .to.emit(veBetterPassport, "UserWhitelisted")
        .withArgs(owner.address, owner.address)
      await veBetterPassport.connect(owner).whitelist(otherAccounts[1].address)

      // Expect owner to be whitelisted
      expect(await veBetterPassport.isWhitelisted(owner.address)).to.be.true

      // Enable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true

      // expect owner to be person
      expect(await veBetterPassport.isPerson(owner.address)).to.deep.equal([true, "User is whitelisted"])

      const creator1 = creators[0]
      const creator2 = creators[1]
      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])

      // delegate personhood
      await expect(veBetterPassport.connect(owner).delegatePassport(delegatee.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(owner.address, delegatee.address)

      // Check the pending delegation: 1 incoming and 0 outgoing
      const pendingDelegation = await veBetterPassport.getPendingDelegations(delegatee.address)
      expect(pendingDelegation).to.deep.equal([[owner.address], ZeroAddress])

      // Check the pending delegation from delegator POV: 0 incoming and 1 outgoing
      const pendingDelegationForDelegator = await veBetterPassport.getPendingDelegations(owner.address)
      expect(pendingDelegationForDelegator).to.deep.equal([[], delegatee.address])

      // Perform the delegation using the signature
      await expect(veBetterPassport.connect(delegatee).acceptDelegation(owner.address))
        .to.emit(veBetterPassport, "DelegationCreated")
        .withArgs(owner.address, delegatee.address)

      // Check the pending delegation
      const pendingDelegation2 = await veBetterPassport.getPendingDelegations(delegatee.address)
      expect(pendingDelegation2).to.deep.equal([[], ZeroAddress])

      // Check the pending delegation from delegator POV
      const pendingDelegationForDelegator2 = await veBetterPassport.getPendingDelegations(owner.address)
      expect(pendingDelegationForDelegator2).to.deep.equal([[], ZeroAddress])

      // Verify that the delegatee has been assigned the delegator
      const storedDelegatee = await veBetterPassport.getDelegatee(owner.address)
      expect(storedDelegatee).to.equal(delegatee.address)

      expect(await veBetterPassport.isDelegatee(delegatee.address)).to.be.true

      expect(await veBetterPassport.isDelegateeInTimepoint(delegatee.address, await ethers.provider.getBlockNumber()))
        .to.be.true

      expect(await veBetterPassport.isDelegator(owner.address)).to.be.true

      expect(await veBetterPassport.isDelegatorInTimepoint(owner.address, await ethers.provider.getBlockNumber())).to.be
        .true

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app3Id, otherAccounts[4])

      //Start allocation round
      const round1 = await startNewAllocationRound()
      // Vote
      await xAllocationVoting
        .connect(delegatee)
        .castVote(
          round1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      // Otheraccounts[1] has not delegated his passport and can vote
      await xAllocationVoting
        .connect(otherAccounts[1])
        .castVote(
          round1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )
    })

    it("Should be able to reject delegation request", async function () {
      const {
        xAllocationVoting,
        x2EarnApps,
        otherAccounts,
        owner,
        veBetterPassport,
        otherAccount: delegatee,
        creators,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      otherAccounts.forEach(async account => {
        await getVot3Tokens(account, "10000")
      })
      await getVot3Tokens(delegatee, "10000")
      await getVot3Tokens(owner, "10000")

      // Whitelist owner
      await expect(veBetterPassport.connect(owner).whitelist(owner.address))
        .to.emit(veBetterPassport, "UserWhitelisted")
        .withArgs(owner.address, owner.address)
      await veBetterPassport.connect(owner).whitelist(otherAccounts[1].address)

      // Expect owner to be whitelisted
      expect(await veBetterPassport.isWhitelisted(owner.address)).to.be.true

      // Enable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true

      // expect owner to be person
      expect(await veBetterPassport.isPerson(owner.address)).to.deep.equal([true, "User is whitelisted"])

      const creator1 = creators[0]
      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])

      // delegate personhood
      await expect(veBetterPassport.connect(owner).delegatePassport(delegatee.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(owner.address, delegatee.address)

      // Check the pending delegation
      const pendingDelegation = await veBetterPassport.getPendingDelegations(delegatee.address)
      expect(pendingDelegation).to.deep.equal([[owner.address], ZeroAddress])

      // Check the pending delegation from delegator POV
      const pendingDelegationForDelegator = await veBetterPassport.getPendingDelegations(owner.address)
      expect(pendingDelegationForDelegator).to.deep.equal([[], delegatee.address])

      // Perform the delegation using the signature
      await expect(veBetterPassport.connect(delegatee).denyIncomingPendingDelegation(owner.address))
        .to.emit(veBetterPassport, "DelegationRevoked")
        .withArgs(owner.address, delegatee.address)

      // Check the pending delegation
      const pendingDelegation2 = await veBetterPassport.getPendingDelegations(delegatee.address)
      expect(pendingDelegation2).to.deep.equal([[], ZeroAddress])

      // Check the pending delegation from delegator POV
      const pendingDelegationForDelegator2 = await veBetterPassport.getPendingDelegations(owner.address)
      expect(pendingDelegationForDelegator2).to.deep.equal([[], ZeroAddress])

      // Owner can vote
      await expect(
        xAllocationVoting
          .connect(owner)
          .castVote(
            await startNewAllocationRound(),
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.reverted
    })

    it("Only the target delegatee can deny an incoming delegation request", async function () {
      const {
        otherAccounts,
        owner,
        veBetterPassport,
        otherAccount: delegatee,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const delegator = owner

      // Delegate to delegatee
      await expect(veBetterPassport.connect(delegator).delegatePassport(delegatee.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(delegator.address, delegatee.address)

      // Try to deny the link request
      await expect(
        veBetterPassport.connect(otherAccounts[1]).denyIncomingPendingDelegation(delegator.address),
      ).to.be.revertedWithCustomError(veBetterPassport, "PassportDelegationUnauthorizedUser")

      // The target of the link should be able to deny the link request
      await expect(veBetterPassport.connect(delegatee).denyIncomingPendingDelegation(delegator.address))
        .to.emit(veBetterPassport, "DelegationRevoked")
        .withArgs(delegator.address, delegatee.address)
    })

    it("User with one incoming and one outgoing delegation should be able to cancel only one", async function () {
      const {
        otherAccounts,
        owner,
        veBetterPassport,
        otherAccount: delegatee,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Use case: A has a pending delegation to B, and B has a pending delegation to C.
      // B should be able to cancel only the pending delegation to C or from A.
      const A = owner
      const B = delegatee
      const C = otherAccounts[0]

      // A delegate to B
      await expect(veBetterPassport.connect(A).delegatePassport(B.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(A.address, B.address)

      // B delegate to C
      await expect(veBetterPassport.connect(B).delegatePassport(C.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(B.address, C.address)

      // If we check now the pending delegations of A we should see 1 outgoing to B
      const pendingDelegationsOfA = await veBetterPassport.getPendingDelegations(A.address)
      expect(pendingDelegationsOfA).to.deep.equal([[], B.address])

      // If we check now the pending delegations of B we should see 1 incoming from A and 1 outgoing to C
      const pendingDelegationsOfB = await veBetterPassport.getPendingDelegations(B.address)
      expect(pendingDelegationsOfB).to.deep.equal([[A.address], C.address])

      // If we check now the pending delegations of C we should see 1 incoming from B
      const pendingDelegationsOfC = await veBetterPassport.getPendingDelegations(C.address)
      expect(pendingDelegationsOfC).to.deep.equal([[B.address], ZeroAddress])

      // B should be able to cancel only the outgoing delegation to C
      await veBetterPassport.connect(B).cancelOutgoingPendingDelegation()
      // should still have 1 incoming and 0 outgoing
      expect(await veBetterPassport.getPendingDelegations(B.address)).to.deep.equal([[A.address], ZeroAddress])

      // Now we return to original simulation with B trying to delegate again to C
      await expect(veBetterPassport.connect(B).delegatePassport(C.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(B.address, C.address)

      // should have 1 incoming and 1 outgoing
      expect(await veBetterPassport.getPendingDelegations(B.address)).to.deep.equal([[A.address], C.address])

      // This time B wants to remove pending delegation from A
      await veBetterPassport.connect(B).denyIncomingPendingDelegation(A.address)
      // should have 0 incoming and 1 outgoing
      expect(await veBetterPassport.getPendingDelegations(B.address)).to.deep.equal([[], C.address])

      const pendingDelegationsOfB2 = await veBetterPassport.getPendingDelegations(B.address)
      expect(pendingDelegationsOfB2).to.deep.equal([[], C.address])

      // If C want to delegate to A, B should not be able to remove it
      await expect(veBetterPassport.connect(C).delegatePassport(A.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(C.address, A.address)

      await expect(veBetterPassport.connect(B).denyIncomingPendingDelegation(A.address)).to.be.reverted
    })

    it("Should revert if a user tries to cancel pending delegation that does not exist", async function () {
      const { owner: A, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // A has not created a pending delegation

      // B should not be able to cancel the pending delegation from A
      await expect(veBetterPassport.connect(A).cancelOutgoingPendingDelegation()).to.be.revertedWithCustomError(
        veBetterPassport,
        "NotDelegated",
      )
    })

    it("If A has a pending delegation to B, and B has a pending delegation to A, then A or B should be able to cancel only one", async function () {
      const {
        owner,
        veBetterPassport,
        otherAccount: delegatee,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = owner
      const B = delegatee

      // A delegate to B
      await expect(veBetterPassport.connect(A).delegatePassport(B.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(A.address, B.address)

      // B delegate to A
      await expect(veBetterPassport.connect(B).delegatePassport(A.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(B.address, A.address)

      // Get pending delegations of A
      const pendingDelegationsOfA = await veBetterPassport.getPendingDelegations(A.address)
      expect(pendingDelegationsOfA).to.deep.equal([[B.address], B.address])

      // Get pending delegations of B
      const pendingDelegationsOfB = await veBetterPassport.getPendingDelegations(B.address)
      expect(pendingDelegationsOfB).to.deep.equal([[A.address], A.address])

      // A should be able to cancel only the pending delegation to B
      await veBetterPassport.connect(A).cancelOutgoingPendingDelegation()
      // should still have 1 incoming and 0 outgoing
      expect(await veBetterPassport.getPendingDelegations(A.address)).to.deep.equal([[B.address], ZeroAddress])

      // Now we return to original simulation with A trying to delegate to B
      await expect(veBetterPassport.connect(A).delegatePassport(B.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(A.address, B.address)

      // should have 1 incoming and 1 outgoing
      expect(await veBetterPassport.getPendingDelegations(B.address)).to.deep.equal([[A.address], A.address])

      // This time A wants to remove the incoming delegation from B
      await veBetterPassport.connect(A).denyIncomingPendingDelegation(B.address)
      // should have 0 incoming and 1 outgoing
      expect(await veBetterPassport.getPendingDelegations(A.address)).to.deep.equal([[], B.address])
    })

    it("If A delegates to B, and C delegates to B (both pending), then B should be able to cancel only one", async function () {
      const {
        owner,
        veBetterPassport,
        otherAccount: delegatee,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = owner
      const B = delegatee
      const C = otherAccounts[0]

      // A delegate to B
      await expect(veBetterPassport.connect(A).delegatePassport(B.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(A.address, B.address)

      // C delegate to B
      await expect(veBetterPassport.connect(C).delegatePassport(B.address))
        .to.emit(veBetterPassport, "DelegationPending")
        .withArgs(C.address, B.address)

      // Get pending delegations of B: should have 2 incoming delegations from A and C, and 0 outgoing
      const pendingDelegationsOfB = await veBetterPassport.getPendingDelegations(B.address)
      expect(pendingDelegationsOfB).to.deep.equal([[A.address, C.address], ZeroAddress])

      // B should be able to cancel only the pending delegation from A
      await veBetterPassport.connect(B).denyIncomingPendingDelegation(A.address)
      // should still have 1 incoming and 0 outgoing
      expect(await veBetterPassport.getPendingDelegations(B.address)).to.deep.equal([[C.address], ZeroAddress])
    })

    it("Should not be able to vote if delegating and not delegatee with allocation voting", async function () {
      const {
        xAllocationVoting,
        x2EarnApps,
        otherAccounts,
        owner,
        veBetterPassport,
        otherAccount: delegatee,
        creators,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await getVot3Tokens(delegatee, "10000")
      await getVot3Tokens(owner, "10000")

      // Whitelist owner
      await veBetterPassport.connect(owner).whitelist(owner.address)

      // Enable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true

      // expect owner to be person
      expect(await veBetterPassport.isPerson(owner.address)).to.deep.equal([true, "User is whitelisted"])

      const creator1 = creators[0]
      const creator2 = creators[1]
      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])

      // delegate with signature
      await delegateWithSignature(veBetterPassport, owner, delegatee, 3600)

      // Verify that the delegatee has been assigned the delegator
      const storedDelegatee = await veBetterPassport.getDelegatee(owner.address)
      expect(storedDelegatee).to.equal(delegatee.address)
      expect(await veBetterPassport.getDelegator(delegatee.address)).to.equal(owner.address)

      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app3Id, otherAccounts[4])

      //Start allocation round
      const round1 = await startNewAllocationRound()

      // Vote
      await xAllocationVoting
        .connect(delegatee)
        .castVote(
          round1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      // Owner has delegated his passport and has no delegation to him (is not a delegatee) => owner can't vote
      await expect(
        xAllocationVoting
          .connect(owner)
          .castVote(
            round1,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")
    })

    it("Should not be able to vote if delegating and not delegatee with governor", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        owner,
        veBetterPassport,
        otherAccount: delegatee,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await getVot3Tokens(delegatee, "10000")
      await getVot3Tokens(owner, "10000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // Whitelist owner
      await veBetterPassport.connect(owner).whitelist(owner.address)

      // Enable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true

      // expect owner to be person
      expect(await veBetterPassport.isPerson(owner.address)).to.deep.equal([true, "User is whitelisted"])

      // create a new proposal
      const tx = await createProposal(b3tr, B3trContract, owner, "Get b3tr token details", "tokenDetails", [])

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), owner)

      // Define a deadline timestamp
      const time = Date.now()
      const deadline = time + 3600 // 1 hour from now -> change from ms to s

      // delegate with signature
      await delegateWithSignature(veBetterPassport, owner, delegatee, deadline)

      // wait
      await waitForProposalToBeActive(proposalId)

      // Delegatee votes
      await governor.connect(delegatee).castVote(proposalId, 2) // vote abstain

      await expect(governor.connect(owner).castVote(proposalId, 2)).to.be.revertedWithCustomError(
        governor,
        "GovernorPersonhoodVerificationFailed",
      )
    })

    it("should revert if a user tries to accept a pending delegation that does not exist", async function () {
      const { owner: A, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // A has not created a pending delegation

      // B should not be able to accept the pending delegation from A
      await expect(veBetterPassport.connect(A).acceptDelegation(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "NotDelegated",
      )
    })

    it("should revert if a user tries to accept a pending delegation that is a not a delagatee", async function () {
      const {
        owner: A,
        veBetterPassport,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const B = otherAccounts[0]
      const C = otherAccounts[1]

      // A has requested to delegate there passport to C
      await veBetterPassport.connect(A).delegatePassport(C.address)

      // B should not be able to accept the pending delegation from A
      await expect(veBetterPassport.connect(B).acceptDelegation(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationUnauthorizedUser",
      )
    })

    it("should revert if a user tries to delegate a passport to themselves", async function () {
      const { owner: A, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // A should not be able to delegate there passport to themselves
      await expect(veBetterPassport.connect(A).delegatePassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "CannotDelegateToSelf",
      )
    })

    it("If already a delagatee it should remove mapping of old delegation and accept new", async function () {
      const {
        owner: A,
        veBetterPassport,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const B = otherAccounts[0]
      const C = otherAccounts[1]

      // A has delegated there passport to C
      await delegateWithSignature(veBetterPassport, A, C, 3600)

      // C should be a delegatee of A
      expect(await veBetterPassport.getDelegatee(A.address)).to.equal(C.address)
      expect(await veBetterPassport.getDelegator(C.address)).to.equal(A.address)

      // B requests to delegate there passport to C
      await veBetterPassport.connect(B).delegatePassport(C.address)

      // C should be pending delegatee of B
      expect(await veBetterPassport.getPendingDelegations(C.address)).to.deep.equal([[B.address], ZeroAddress])

      // C accepts the delegation
      await veBetterPassport.connect(C).acceptDelegation(B.address)

      // C should be a delegatee of B
      expect(await veBetterPassport.getDelegatee(B.address)).to.equal(C.address)
      expect(await veBetterPassport.getDelegator(C.address)).to.equal(B.address)

      // A should no longer be a delegatee of C
      expect(await veBetterPassport.getDelegatee(A.address)).to.equal(ZeroAddress)
    })

    it("If delegator is already a delegator remove mapping", async function () {
      const {
        owner: A,
        veBetterPassport,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const B = otherAccounts[0]
      const C = otherAccounts[1]

      // A has delegated there passport to C
      await delegateWithSignature(veBetterPassport, A, C, 3600)

      // C should be a delegatee of A
      expect(await veBetterPassport.getDelegatee(A.address)).to.equal(C.address)
      expect(await veBetterPassport.getDelegator(C.address)).to.equal(A.address)

      // A requests to delegate there passport to B
      await veBetterPassport.connect(A).delegatePassport(B.address)

      // B should be pending delegatee of A
      expect(await veBetterPassport.getPendingDelegations(B.address)).to.deep.equal([[A.address], ZeroAddress])

      // C should no longer be a delegatee of A
      expect(await veBetterPassport.getDelegatee(A.address)).to.equal(ZeroAddress)
      expect(await veBetterPassport.getDelegator(C.address)).to.equal(ZeroAddress)

      // A requests to delegate there passport to C
      await veBetterPassport.connect(A).delegatePassport(C.address)

      // B should no longer be a pending delegatee of A
      expect(await veBetterPassport.getPendingDelegations(B.address)).to.deep.equal([[], ZeroAddress])

      // C should be a pending delegatee of A
      expect(await veBetterPassport.getPendingDelegations(C.address)).to.deep.equal([[A.address], ZeroAddress])
    })

    it("If a delegator delegating with signature is already a delegator remove mapping", async function () {
      const {
        owner: A,
        veBetterPassport,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const B = otherAccounts[0]
      const C = otherAccounts[1]

      // A has delegated there passport to C
      await delegateWithSignature(veBetterPassport, A, C, 3600)

      // C should be a delegatee of A
      expect(await veBetterPassport.getDelegatee(A.address)).to.equal(C.address)
      expect(await veBetterPassport.getDelegator(C.address)).to.equal(A.address)

      // A now delegates to B
      await delegateWithSignature(veBetterPassport, A, B, 3600)

      // C should no longer be a delegatee of A
      expect(await veBetterPassport.getDelegator(C.address)).to.equal(ZeroAddress)

      // B should be a delegatee of A
      expect(await veBetterPassport.getDelegatee(A.address)).to.equal(B.address)

      // B should be a delegator of A
      expect(await veBetterPassport.getDelegator(B.address)).to.equal(A.address)

      // A now requests to delegate there passport to C
      await veBetterPassport.connect(A).delegatePassport(C.address)

      // B should no longer be a delegatee of A
      expect(await veBetterPassport.getDelegatee(A.address)).to.equal(ZeroAddress)
      expect(await veBetterPassport.getPendingDelegations(A.address)).to.deep.equal([[], C.address])

      // C should be a pending delegatee of A
      expect(await veBetterPassport.getPendingDelegations(C.address)).to.deep.equal([[A.address], ZeroAddress])

      // A decided to delegate with signature to B
      await delegateWithSignature(veBetterPassport, A, B, 3600)

      // C should no longer be a pending delegatee of A
      expect(await veBetterPassport.getPendingDelegations(C.address)).to.deep.equal([[], ZeroAddress])
    })

    // If X delegates to Y, X can't vote. If Z delegates to X, X now can vote as he's a delegatee of Z.
    it("Should be able to vote if delegatee and delegator with governor", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        owner: X,
        veBetterPassport,
        otherAccount: Y,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const Z = otherAccounts[0]

      await getVot3Tokens(X, "10000")
      await getVot3Tokens(Y, "10000")
      await getVot3Tokens(Z, "10000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // Whitelist owner
      await veBetterPassport.connect(X).whitelist(X.address)
      await veBetterPassport.connect(X).whitelist(Z.address)

      // Enable whitelist check
      await veBetterPassport.connect(X).toggleCheck(1)

      // whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true

      // expect owner to be person
      expect(await veBetterPassport.isPerson(X.address)).to.deep.equal([true, "User is whitelisted"])

      // create a new proposal
      const tx = await createProposal(b3tr, B3trContract, X, "Get b3tr token details", "tokenDetails", [])

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), X)

      // Define a deadline timestamp
      const time = Date.now()
      const deadline = time + 3600 // 1 hour from now -> change from ms to s

      // delegate with signature X to Y
      await delegateWithSignature(veBetterPassport, X, Y, deadline)

      // delegate with signature Z to X
      await delegateWithSignature(veBetterPassport, Z, X, deadline)

      // wait for proposal
      await waitForProposalToBeActive(proposalId)

      // Y can vote
      await governor.connect(Y).castVote(proposalId, 2) // vote abstain

      // X can vote even if he's a delegator to Y because X is delegatee of Z
      await governor.connect(X).castVote(proposalId, 2) // vote abstain

      // Z is delegator of X and has no delegators for him. Thus he can't vote.
      await expect(governor.connect(Z).castVote(proposalId, 2)).to.be.revertedWithCustomError(
        governor,
        "GovernorPersonhoodVerificationFailed",
      )
    })

    it("User A should be able to delegate passport A to B, user B should be able to delegate passport B to C and user C should be able to delegate passport C to A", async function () {
      const { governor, b3tr, B3trContract, owner, veBetterPassport, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      await getVot3Tokens(owner, "10000")
      await getVot3Tokens(A, "10000")
      await getVot3Tokens(B, "10000")
      await getVot3Tokens(C, "10000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // Whitelist all passport owners
      await veBetterPassport.connect(owner).whitelist(A.address)
      await veBetterPassport.connect(owner).whitelist(B.address)
      await veBetterPassport.connect(owner).whitelist(C.address)

      // Enable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true

      // expect all passports to be a person as whitelist is enabled
      expect(await veBetterPassport.isPerson(A.address)).to.deep.equal([true, "User is whitelisted"])
      expect(await veBetterPassport.isPerson(B.address)).to.deep.equal([true, "User is whitelisted"])
      expect(await veBetterPassport.isPerson(C.address)).to.deep.equal([true, "User is whitelisted"])

      // create a new proposal
      const tx = await createProposal(b3tr, B3trContract, owner, "Get b3tr token details", "tokenDetails", [])

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), owner)

      // delegate with signature A to B
      await veBetterPassport.connect(A).delegatePassport(B.address)
      await veBetterPassport.connect(B).acceptDelegation(A.address)

      // delegate with signature B to C
      await veBetterPassport.connect(B).delegatePassport(C.address)
      await veBetterPassport.connect(C).acceptDelegation(B.address)

      // delegate with signature C to A
      await veBetterPassport.connect(C).delegatePassport(A.address)
      await veBetterPassport.connect(A).acceptDelegation(C.address)

      // wait for proposal
      await waitForProposalToBeActive(proposalId)

      // A can vote
      await governor.connect(A).castVote(proposalId, 2) // vote abstain

      // B can vote
      await governor.connect(B).castVote(proposalId, 2) // vote abstain

      // C can vote
      await governor.connect(C).castVote(proposalId, 2) // vote abstain
    })

    it("User A should be able to delegate passport A to B, user B should be able to delegate passport B to C and user C should be able to delegate passport C to A, score threshold 0", async function () {
      const { governor, b3tr, B3trContract, owner, veBetterPassport, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      await getVot3Tokens(owner, "10000")
      await getVot3Tokens(A, "10000")
      await getVot3Tokens(B, "10000")
      await getVot3Tokens(C, "10000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // Enable score check
      await veBetterPassport.connect(owner).toggleCheck(4)

      // score check should be enabled
      expect(await veBetterPassport.isCheckEnabled(4)).to.be.true

      // Expect score threshold to be 0
      expect(await veBetterPassport.thresholdPoPScore()).to.equal(0)

      // expect all passports to be a person as score is enabled
      expect(await veBetterPassport.isPerson(A.address)).to.deep.equal([
        true,
        "User's participation score is above the threshold",
      ])
      expect(await veBetterPassport.isPerson(B.address)).to.deep.equal([
        true,
        "User's participation score is above the threshold",
      ])
      expect(await veBetterPassport.isPerson(C.address)).to.deep.equal([
        true,
        "User's participation score is above the threshold",
      ])

      // create a new proposal
      const tx = await createProposal(b3tr, B3trContract, owner, "Get b3tr token details", "tokenDetails", [])

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), owner)

      // Define a deadline timestamp
      const time = Date.now()
      const deadline = time + 3600 // 1 hour from now -> change from ms to s

      // delegate with signature A to B
      await delegateWithSignature(veBetterPassport, A, B, deadline)

      // delegate with signature B to C
      await delegateWithSignature(veBetterPassport, B, C, deadline)

      // delegate with signature C to A
      await delegateWithSignature(veBetterPassport, C, A, deadline)

      // wait for proposal
      await waitForProposalToBeActive(proposalId)

      // A can vote
      await governor.connect(A).castVote(proposalId, 2) // vote abstain

      // B can vote
      await governor.connect(B).castVote(proposalId, 2) // vote abstain

      // C can vote
      await governor.connect(C).castVote(proposalId, 2) // vote abstain
    })

    it("When voting delegation must have been done before the start of the proposal", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        owner: X,
        veBetterPassport,
        otherAccount: Y,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const Z = otherAccounts[0]

      await getVot3Tokens(X, "10000")
      await getVot3Tokens(Y, "10000")
      await getVot3Tokens(Z, "10000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // Whitelist owner
      await veBetterPassport.connect(X).whitelist(X.address)
      await veBetterPassport.connect(X).whitelist(Z.address)

      // Enable whitelist check
      await veBetterPassport.connect(X).toggleCheck(1)

      // whitelist check should be enabled
      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true

      // expect owner to be person
      expect(await veBetterPassport.isPerson(X.address)).to.deep.equal([true, "User is whitelisted"])

      // create a new proposal
      const tx = await createProposal(b3tr, B3trContract, X, "Get b3tr token details", "tokenDetails", [])

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), X)

      // Define a deadline timestamp
      const time = Date.now()
      const deadline = time + 3600 // 1 hour from now -> change from ms to s

      // wait for proposal
      await waitForProposalToBeActive(proposalId)

      // delegate with signature X to Y
      await delegateWithSignature(veBetterPassport, X, Y, deadline)

      // Y cannot vote because he is not human since delegation was done after proposal was started
      await expect(governor.connect(Y).castVote(proposalId, 2)).to.be.reverted
    })

    it("Should not be able to delegate to self", async function () {
      const { veBetterPassport, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(delegateWithSignature(veBetterPassport, owner, owner, 3600)).to.be.reverted
    })

    it("Should not be able to revoke delegation if not delegated", async function () {
      const { veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(veBetterPassport.revokeDelegation()).to.be.reverted
    })

    it("Should not be able to delegate with signature if signature expired", async function () {
      const { veBetterPassport, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(delegateWithSignature(veBetterPassport, owner, otherAccount, 0)).to.be.revertedWithCustomError(
        veBetterPassport,
        "SignatureExpired",
      )
    })

    it("Should not be able to delegate with invalid singature", async function () {
      const { veBetterPassport, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Set up EIP-712 domain
      const domain = {
        name: "PassportDelegation",
        version: "1",
        chainId: 1337,
        verifyingContract: await veBetterPassport.getAddress(),
      }
      let types = {
        Delegation: [
          { name: "wrong_field_1", type: "address" },
          { name: "wrong_field_2", type: "address" },
          { name: "wrong_field_3", type: "address" },
        ],
      }

      // Define a deadline timestamp
      const currentBlock = await ethers.provider.getBlockNumber()
      const block = await ethers.provider.getBlock(currentBlock)

      if (!block) {
        throw new Error("Block not found")
      }

      const deadline = block.timestamp + 3600 // 1 hour from

      // Prepare the struct to sign
      const delegationData = {
        wrong_field_1: owner.address,
        wrong_field_2: otherAccount.address,
        wrong_field_3: otherAccount.address,
      }

      // Create the EIP-712 signature for the delegator
      const signature = await owner.signTypedData(domain, types, delegationData)

      // Perform the delegation using the signature
      await expect(
        veBetterPassport.connect(otherAccount).delegateWithSignature(owner.address, deadline, signature),
      ).to.be.revertedWithCustomError(veBetterPassport, "InvalidSignature")
    })

    it("If a delegator re-delegates its passport or delegatee accepts delegation of new passport it should update mappings", async function () {
      const { veBetterPassport, owner, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await delegateWithSignature(veBetterPassport, owner, otherAccount, 3600)

      expect(await veBetterPassport.getDelegatee(owner.address)).to.equal(otherAccount.address)
      expect(await veBetterPassport.getDelegator(otherAccount.address)).to.equal(owner.address)

      await delegateWithSignature(veBetterPassport, otherAccounts[0], otherAccount, 3600)

      expect(await veBetterPassport.getDelegatee(owner.address)).to.equal(ethers.ZeroAddress)
      expect(await veBetterPassport.getDelegator(otherAccount.address)).to.equal(otherAccounts[0].address)
      expect(await veBetterPassport.getDelegatee(otherAccounts[0].address)).to.equal(otherAccount.address)
    })

    it("Should be able to revoke delegation as delegatee", async function () {
      const {
        veBetterPassport,
        owner: delegator,
        otherAccount: delegatee,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await delegateWithSignature(veBetterPassport, delegator, delegatee, 3600)
      const block = await ethers.provider.getBlockNumber()

      await expect(veBetterPassport.connect(delegatee).revokeDelegation()).to.emit(
        veBetterPassport,
        "DelegationRevoked",
      )
      expect(await veBetterPassport.getDelegatee(delegator.address)).to.equal(ethers.ZeroAddress)
      expect(await veBetterPassport.getDelegator(delegatee.address)).to.equal(ethers.ZeroAddress)

      expect(await veBetterPassport.getDelegatorInTimepoint(delegatee.address, block)).to.equal(delegator.address)

      expect(
        await veBetterPassport.getDelegatorInTimepoint(delegatee.address, await ethers.provider.getBlockNumber()),
      ).to.equal(ZeroAddress)

      expect(await veBetterPassport.getDelegateeInTimepoint(delegator.address, block)).to.equal(delegatee.address)
    })

    it("Should be able to revoke delegation as delegator", async function () {
      const { veBetterPassport, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await delegateWithSignature(veBetterPassport, owner, otherAccount, 3600)

      await expect(veBetterPassport.revokeDelegation()).to.emit(veBetterPassport, "DelegationRevoked")
      expect(await veBetterPassport.getDelegatee(owner.address)).to.equal(ethers.ZeroAddress)
      expect(await veBetterPassport.getDelegator(otherAccount.address)).to.equal(ethers.ZeroAddress)
    })

    it("Should not be able to revoke delegation if not delegator nor delegatee", async function () {
      const { veBetterPassport, owner, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await delegateWithSignature(veBetterPassport, owner, otherAccount, 3600)

      await expect(veBetterPassport.connect(otherAccounts[0]).revokeDelegation()).to.be.reverted
      expect(await veBetterPassport.getDelegatee(owner.address)).to.equal(otherAccount.address)
      expect(await veBetterPassport.getDelegator(otherAccount.address)).to.equal(owner.address)
    })

    it("An entity should not be able to delegate a passport to a user", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const delegatee = otherAccounts[0]

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 1000)

      expect(await veBetterPassport.isEntity(entity.address)).to.be.true

      // Should not be able to delegate an entity
      await expect(delegateWithSignature(veBetterPassport, entity, delegatee, 3600)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationFromEntity",
      )

      // Should not be able to delegate an entity
      await expect(veBetterPassport.connect(entity).delegatePassport(delegatee.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationFromEntity",
      )

      // detach entity
      await veBetterPassport.connect(passport).removeEntityLink(entity)

      // Should be able to delegate
      await expect(delegateWithSignature(veBetterPassport, entity, delegatee, 3600)).to.not.be.reverted
    })

    it("A passport cannot be delegated to an entity", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const passport2 = otherAccounts[1]
      const entity2 = otherAccounts[2]

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 1000)
      await linkEntityToPassportWithSignature(veBetterPassport, passport2, entity2, 1000)

      expect(await veBetterPassport.isEntity(entity.address)).to.be.true

      // Should not be able to delegate a passport
      await expect(delegateWithSignature(veBetterPassport, passport, entity2, 3600)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationToEntity",
      )

      // Should not be able to delegate a passport
      await expect(veBetterPassport.connect(passport).delegatePassport(entity2.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationToEntity",
      )

      // detach entity
      await veBetterPassport.connect(passport2).removeEntityLink(entity2)

      // Should be able to delegate
      await expect(delegateWithSignature(veBetterPassport, passport, entity2, 3600)).to.not.be.reverted
    })

    it("A passport cannot be delegated if a pending entity", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const passport2 = otherAccounts[1]
      const entity2 = otherAccounts[2]
      const user = otherAccounts[3]

      await veBetterPassport.connect(entity).linkEntityToPassport(passport.address)
      await veBetterPassport.connect(entity2).linkEntityToPassport(passport2.address)

      // Should be a pending entity
      expect((await veBetterPassport.getPendingLinkings(entity.address))[1]).to.equal(passport.address)

      // Should not be able to delegate as a pending entity
      await expect(delegateWithSignature(veBetterPassport, entity, user, 3600)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationFromEntity",
      )

      // Should not be able to delegate a passport
      await expect(veBetterPassport.connect(passport2).delegatePassport(entity2.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationToEntity",
      )

      // detach entity
      await veBetterPassport.connect(passport2).denyIncomingPendingEntityLink(entity2)

      // Should be able to delegate
      await expect(delegateWithSignature(veBetterPassport, passport, entity2, 3600)).to.not.be.reverted
    })

    it("should revert if a wallet not linked to a passport tries to be removed", async function () {
      const {
        veBetterPassport,
        owner: user,
        otherAccount: randomWallet,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(veBetterPassport.connect(user).removeEntityLink(randomWallet)).to.be.revertedWithCustomError(
        veBetterPassport,
        "NotLinked",
      )
    })

    it("Should be able to assign multiple entites to a passport, do actions and use the combintation to meet personhood status", async function () {
      const config = createTestConfig()
      const {
        veBetterPassport,
        x2EarnApps,
        owner,
        otherAccount: delegatee,
        otherAccounts,
        creators,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const enity1 = otherAccounts[0]
      const enity2 = otherAccounts[1]
      const passport = otherAccounts[2]
      const creator1 = creators[0]

      // Set the score threshold to 500
      await veBetterPassport.connect(owner).setThresholdPoPScore(500)

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets app1 security to APP_SECURITY.LOW
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)

      // Sets app2 security to APP_SECURITY.MEDIUM
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 2)

      await veBetterPassport.connect(owner).registerActionForRound(enity1, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity1, app2Id, 1)

      await veBetterPassport.connect(owner).registerActionForRound(enity2, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity2, app2Id, 1)

      // Move through 1 round
      await moveToCycle(2)

      // Entity 1 should have a score of 300
      expect(await veBetterPassport.userTotalScore(enity1)).to.equal(300)
      expect(await veBetterPassport.userTotalScore(enity2)).to.equal(300)

      // Cumulative score for entity 1 should be 300
      expect(await veBetterPassport.getCumulativeScoreWithDecay(enity1, 1)).to.equal(300)
      expect(await veBetterPassport.getCumulativeScoreWithDecay(enity2, 1)).to.equal(300)

      // Score threshold should be 500
      expect(await veBetterPassport.thresholdPoPScore()).to.equal(500)

      // Enable PoP score check
      await veBetterPassport.connect(owner).toggleCheck(4)
      expect(await veBetterPassport.isCheckEnabled(4)).to.be.true

      // Entity 1 should not be a person
      expect(await veBetterPassport.isPerson(enity1.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Entity 2 should not be a person
      expect(await veBetterPassport.isPerson(enity2.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Assign entity 1 to passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, enity1, 1000)

      // Passport should not be a person
      expect(await veBetterPassport.isPerson(passport.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Assign entity 2 to passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, enity2, 1000)

      // Passport should not be a person
      expect(await veBetterPassport.isPerson(passport.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Now we do actions with enities 1 and 2 to make the passport a person
      await veBetterPassport.connect(owner).registerActionForRound(passport, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity1, app2Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(enity2, app2Id, 1)

      // Passport should not be a person
      expect((await veBetterPassport.isPerson(passport.address))[0]).to.equal(true)

      // Delegate is not a person
      expect(await veBetterPassport.isPerson(delegatee.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Delegate passport to delegatee
      await delegateWithSignature(veBetterPassport, passport, delegatee, 3600)

      // Delegatee should be a person
      expect(await veBetterPassport.isPerson(delegatee.address)).to.deep.equal([
        true,
        "User's participation score is above the threshold",
      ])

      // Passport should not be a person
      expect(await veBetterPassport.isPerson(passport.address)).to.deep.equal([
        false,
        "User has delegated their personhood",
      ])
    })

    it("A user can have maximum on passport delegated to him per time", async function () {
      const { veBetterPassport, owner, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const owner2 = otherAccounts[0]

      await delegateWithSignature(veBetterPassport, owner, otherAccount, 3600)
      expect(await veBetterPassport.getDelegatee(owner.address)).to.equal(otherAccount.address)
      expect(await veBetterPassport.getDelegator(otherAccount.address)).to.equal(owner.address)

      await delegateWithSignature(veBetterPassport, owner2, otherAccount, 3600)
      // now that owner2 has delegetated to otherAccount, otherAccount should be delegatee of owner2
      expect(await veBetterPassport.getDelegatee(owner2.address)).to.equal(otherAccount.address)
      expect(await veBetterPassport.getDelegator(otherAccount.address)).to.equal(owner2.address)
    })

    it("After linking an entity to a passport, the entity should non be able to vote", async function () {
      const { veBetterPassport, xAllocationVoting, x2EarnApps, owner, otherAccount, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      await getVot3Tokens(otherAccount, "10000")
      await getVot3Tokens(owner, "10000")

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.setAppSecurity(app1Id, 3) // APP_SECURITY.HIGH
      await veBetterPassport.connect(owner).toggleCheck(4) // Enable PoP score check
      await veBetterPassport.connect(owner).setThresholdPoPScore(200)

      //Start allocation round
      const round1 = await startNewAllocationRound()

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)

      // cumulative score of otherAccount should be 2000
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 1)).to.be.equal(2000)
      // cumulative score of owner should be 0
      expect(await veBetterPassport.getCumulativeScoreWithDecay(owner, 1)).to.be.equal(0)

      // Both should be considered passports at the start of the round
      expect(
        await veBetterPassport.isPassportInTimepoint(owner.address, await xAllocationVoting.currentRoundSnapshot()),
      ).to.be.true
      expect(
        await veBetterPassport.isPassportInTimepoint(
          otherAccount.address,
          await xAllocationVoting.currentRoundSnapshot(),
        ),
      ).to.be.true

      // Now we link the entity to the passport; for voting this shoould have effect from next round, but for actions it should be immediate
      await linkEntityToPassportWithSignature(veBetterPassport, owner, otherAccount, 3600)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)

      // cumulative score of otherAccount should be 2000 (same as before)
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 1)).to.be.equal(2000)
      // cumulative score of owner should be 2000 (because actions from otherAccount are now counted as owner's)
      expect(await veBetterPassport.getCumulativeScoreWithDecay(owner, 1)).to.be.equal(2000)

      // Other account should not be considered a passport anymore now
      expect(await veBetterPassport.isPassport(otherAccount.address)).to.be.false
      // But it should be considered a passport at the start of the round
      expect(
        await veBetterPassport.isPassportInTimepoint(
          otherAccount.address,
          await xAllocationVoting.currentRoundSnapshot(),
        ),
      ).to.be.true

      // Owner should be considered a passport both both now and at the start of the round
      expect(await veBetterPassport.isPassport(owner.address)).to.be.true
      expect(
        await veBetterPassport.isPassportInTimepoint(owner.address, await xAllocationVoting.currentRoundSnapshot()),
      ).to.be.true

      // Since the the entity is considered a passport at the start of the round, and since it has enough score now, he can vote
      await expect(xAllocationVoting.connect(otherAccount).castVote(round1, [app1Id], [ethers.parseEther("100")])).to
        .not.be.reverted

      // Since the owner is considered a passport at the start of the round, and since it has enough score now, he can vote
      await expect(xAllocationVoting.connect(owner).castVote(round1, [app1Id], [ethers.parseEther("100")])).to.not.be
        .reverted

      // But when starting the next round only the owner should be able to vote, since otherAccount is now considered an enitity at 100%
      await waitForCurrentRoundToEnd()
      await startNewAllocationRound()

      await expect(
        xAllocationVoting.connect(otherAccount).castVote(2, [app1Id], [ethers.parseEther("100")]),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      await expect(xAllocationVoting.connect(owner).castVote(2, [app1Id], [ethers.parseEther("100")])).to.not.be
        .reverted
    })
  })

  describe("Delegation and Link checks", function () {
    // A is a Passport
    // B is an Entity
    // C is a Passport
    // D is an Entity
    it("Should Revert if Entity B is already an Entity", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[1]
      const B = otherAccounts[0]
      const C = otherAccounts[2]

      // Link B to A
      await linkEntityToPassportWithSignature(veBetterPassport, A, B, 1000)

      // Should revert if B tries to link to C
      await expect(veBetterPassport.connect(B).linkEntityToPassport(C.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })
    it("Should Revert if Entity B is already a Pending Entity", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[1]
      const B = otherAccounts[0]
      const C = otherAccounts[2]

      // B creates pending link to A
      await veBetterPassport.connect(B).linkEntityToPassport(A.address)

      // Should revert if B tries to link to C
      await expect(veBetterPassport.connect(B).linkEntityToPassport(C.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })
    it("Should revert if Passport A is already an entity and not a passport", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // Passport A is an entity to Passport C
      await linkEntityToPassportWithSignature(veBetterPassport, C, A, 1000)

      // Should revert if Entity B tries to link to A as it is already an entity
      await expect(veBetterPassport.connect(B).linkEntityToPassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })
    it("Should revert if Passport A is already a Pending Entity and not a passport", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // A creates pending link to C
      await veBetterPassport.connect(A).linkEntityToPassport(C.address)

      // Should revert if Entity B tries to link to A as it is already a pending entity
      await expect(veBetterPassport.connect(B).linkEntityToPassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })
    it("Should revert if Entity B is already a Passport", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[1]
      const B = otherAccounts[0]
      const D = otherAccounts[2]

      // B is a passport
      await linkEntityToPassportWithSignature(veBetterPassport, B, D, 1000)

      // Should revert if B tries to link to A
      await expect(veBetterPassport.connect(B).linkEntityToPassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })
    it("Should revert if Entity B is already a Pending Passport", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[1]
      const B = otherAccounts[0]
      const D = otherAccounts[2]

      // B creates pending link to D
      await veBetterPassport.connect(B).linkEntityToPassport(D.address)

      // Should revert if B tries to link to A
      await expect(veBetterPassport.connect(B).linkEntityToPassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "AlreadyLinked",
      )
    })
    it("Should revert if Entity B is a delegator", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[1]
      const B = otherAccounts[0]
      const C = otherAccounts[2]

      // B is a delegator
      await delegateWithSignature(veBetterPassport, B, C, 1000)

      // Should revert if B tries to link to A
      await expect(veBetterPassport.connect(B).linkEntityToPassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "DelegatedEntity",
      )
    })
    it("Should revert if Entity B is a pending delegator", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[1]
      const B = otherAccounts[0]
      const C = otherAccounts[2]

      // B is a pending delegator
      await veBetterPassport.connect(B).delegatePassport(C.address)

      // Should revert if B tries to link to A
      await expect(veBetterPassport.connect(B).linkEntityToPassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "DelegatedEntity",
      )
    })
    it("Should revert if Entity B is a delegatee", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[1]
      const B = otherAccounts[0]
      const C = otherAccounts[2]

      // B is a delegatee
      await delegateWithSignature(veBetterPassport, C, B, 1000)

      // Should revert if B tries to link to A
      await expect(veBetterPassport.connect(B).linkEntityToPassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "DelegatedEntity",
      )
    })
    it("Should revert if Entity B is a pending delegatee", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[1]
      const B = otherAccounts[0]
      const C = otherAccounts[2]

      // B is a pending delegatee
      await veBetterPassport.connect(C).delegatePassport(B.address)

      // Should revert if B tries to link to A
      await expect(veBetterPassport.connect(B).linkEntityToPassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "DelegatedEntity",
      )
    })
    it("Should revert if Entity B is trying to link to itself", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const B = otherAccounts[0]

      // Should revert if B tries to link to itself
      await expect(veBetterPassport.connect(B).linkEntityToPassport(B.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "CannotLinkToSelf",
      )
    })
    it("Should revert if Passport A is trying to delegate to itself", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]

      // Should revert if A tries to delegate to itself
      await expect(veBetterPassport.connect(A).delegatePassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "CannotDelegateToSelf",
      )
    })
    it("Should revert if Entity B tries to delegate to Passport A", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // B is an entity of C
      await linkEntityToPassportWithSignature(veBetterPassport, C, B, 1000)

      // Should revert if B tries to delegate to C
      await expect(veBetterPassport.connect(B).delegatePassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationFromEntity",
      )
    })
    it("Should revert if Pending Entity B tries to delegate to Passport A", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // B is a pending entity of C
      await veBetterPassport.connect(B).linkEntityToPassport(C.address)

      // Should revert if B tries to delegate to A
      await expect(veBetterPassport.connect(B).delegatePassport(A.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationFromEntity",
      )
    })
    it("Should revert if Passport A tries to delegate to Entity B", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // B is an entity of C
      await linkEntityToPassportWithSignature(veBetterPassport, C, B, 1000)

      // Should revert if A tries to delegate to B
      await expect(veBetterPassport.connect(A).delegatePassport(B.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationToEntity",
      )
    })
    it("Should revert if Passport A tries to delegate to Pending Entity B", async function () {
      const { veBetterPassport, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const A = otherAccounts[0]
      const B = otherAccounts[1]
      const C = otherAccounts[2]

      // B is a pending entity of C
      await veBetterPassport.connect(B).linkEntityToPassport(C.address)

      // Should revert if A tries to delegate to B
      await expect(veBetterPassport.connect(A).delegatePassport(B.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "PassportDelegationToEntity",
      )
    })
  })

  describe("Passport Clock", function () {
    it("Should return current block number when calling clock", async function () {
      const { veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await veBetterPassport.clock()).to.be.equal(await ethers.provider.getBlockNumber())
    })

    it("should return the clock mode", async function () {
      const { veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await veBetterPassport.CLOCK_MODE()).to.be.equal("mode=blocknumber&from=default")
    })
  })
})

// Isolated tests for shard16 because of the size of the tests
describe("VeBetterPassport - @shard16", function () {
  describe("Passport PoP Score", function () {
    it("Should be able to register participation of user with ACTION_REGISTRAR_ROLE", async function () {
      const { x2EarnApps, otherAccounts, owner, veBetterPassport, otherAccount, xAllocationVoting } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1) // APP_SECURITY.LOW

      await veBetterPassport.connect(owner).registerAction(otherAccount, app1Id)

      expect(await veBetterPassport.userRoundScore(otherAccount, await xAllocationVoting.currentRoundId())).to.equal(
        100,
      )
    })

    it("Should correctly calculate cumulative score", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      const { x2EarnApps, otherAccounts, owner, veBetterPassport, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1) // APP_SECURITY.LOW

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 3)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 4)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 5)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 2)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 3)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 4)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 5)).to.equal(100)

      /*
        All 5 rounds the user has 100 score.

        round N = [round N score] + ([cumulative score] * [1 - decay factor])

        round 1 = 100 + (0 * 0.8) = 100
        round 2 = 100 + (100 * 0.8) = 180
        round 3 = 100 + (180 * 0.8) = 244
        round 4 = 100 + (244 * 0.8) = 295,2 => 295 
        round 5 = 100 + (295 * 0.8) = 336
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 5)).to.equal(336)
    })

    it("Should correctly transfer enities cumulative score", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      const { x2EarnApps, otherAccounts, owner, veBetterPassport, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1) // APP_SECURITY.LOW

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 3)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 4)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 5)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 2)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 3)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 4)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 5)).to.equal(100)

      /*
        All 5 rounds the user has 100 score.

        round N = [round N score] + ([cumulative score] * [1 - decay factor])

        round 1 = 100 + (0 * 0.8) = 100
        round 2 = 100 + (100 * 0.8) = 180
        round 3 = 100 + (180 * 0.8) = 244
        round 4 = 100 + (244 * 0.8) = 295,2 => 295 
        round 5 = 100 + (295 * 0.8) = 336
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 5)).to.equal(336)
    })

    it("Should be able to change security multiplier with ACTION_SCORE_MANAGER_ROLE", async function () {
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets APP_SECURITY.LOW multiplier to 1000
      await veBetterPassport.connect(owner).setSecurityMultiplier(1, 1000)

      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1) // APP_SECURITY.LOW

      expect(await veBetterPassport.securityMultiplier(1)).to.equal(1000)

      await veBetterPassport.registerActionForRound(otherAccount, app1Id, 1)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(1000)
      expect(await veBetterPassport.userRoundScoreApp(otherAccount, 1, app1Id)).to.equal(1000)
    })

    it("Should be able to change app's security multiplier with ACTION_SCORE_MANAGER_ROLE", async function () {
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets app's security to APP_SECURITY.MEDIUM
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 2)

      expect(await veBetterPassport.appSecurity(app1Id)).to.equal(2)

      await veBetterPassport.registerActionForRound(otherAccount, app1Id, 1)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(200)
      expect(await veBetterPassport.userRoundScoreApp(otherAccount, 1, app1Id)).to.equal(200)
    })

    it("Should calculate cumulative score correctly with different security multipliers", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts, creators } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      const creator1 = creators[0]
      const creator2 = creators[1]

      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")

      await endorseApp(app2Id, otherAccounts[3])
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")
      await endorseApp(app3Id, otherAccounts[4])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets app1 security to APP_SECURITY.LOW
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)

      // Sets app2 security to APP_SECURITY.MEDIUM
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 2)

      // Sets app3 security to APP_SECURITY.HIGH
      await veBetterPassport.connect(owner).setAppSecurity(app3Id, 3)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 3)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 4)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app3Id, 5)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 2)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 3)).to.equal(200)
      expect(await veBetterPassport.userRoundScore(otherAccount, 4)).to.equal(200)
      expect(await veBetterPassport.userRoundScore(otherAccount, 5)).to.equal(400)

      /*
        Round 1 score: 100
        Round 2 score: 100
        Round 3 score: 200
        Round 4 score: 200
        Round 5 score: 400

        round N = [round N score] + ([cumulative score] * [1 - decay factor])

        round 1 = 100 + (0 * 0.8) = 100
        round 2 = 100 + (100 * 0.8) = 180
        round 3 = 200 + (180 * 0.8) = 344
        round 4 = 200 + (344 * 0.8) = 475,2 => 475 
        round 5 = 400 + (475 * 0.8) = 780
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 5)).to.equal(780)
    })

    it("Should calculate decay from first round if last round specified is greater than cumulative rounds to look for", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets app1 security to APP_SECURITY.LOW
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 3)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 4)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 5)

      // Get cumulative score from lastRound = 2. first round to start iterations would be negative so we expect cumulative score to start from round 1:
      // round 1 = 100 => round 2 = 100 + (100 * 0.8) = 180
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 2)).to.equal(180)
    })

    it("Should not be able to register action without ACTION_REGISTRAR_ROLE", async function () {
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await expect(veBetterPassport.connect(otherAccounts[3]).registerAction(otherAccount, app1Id)).to.be.reverted
    })

    it("Should be able to change app's security multiplier with ACTION_SCORE_MANAGER_ROLE", async function () {
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets app's security to APP_SECURITY.MEDIUM
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 2)

      expect(await veBetterPassport.appSecurity(app1Id)).to.equal(2)

      await veBetterPassport.registerActionForRound(otherAccount, app1Id, 1)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(200)
      expect(await veBetterPassport.userRoundScoreApp(otherAccount, 1, app1Id)).to.equal(200)
    })

    it("Should calculate cumulative score correctly with different security multipliers", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts, creators } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })
      const creator1 = creators[0]
      const creator2 = creators[1]

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])
      await endorseApp(app3Id, otherAccounts[4])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets app1 security to APP_SECURITY.LOW
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)

      // Sets app2 security to APP_SECURITY.MEDIUM
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 2)

      // Sets app3 security to APP_SECURITY.HIGH
      await veBetterPassport.connect(owner).setAppSecurity(app3Id, 3)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 3)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 4)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app3Id, 5)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 2)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 3)).to.equal(200)
      expect(await veBetterPassport.userRoundScore(otherAccount, 4)).to.equal(200)
      expect(await veBetterPassport.userRoundScore(otherAccount, 5)).to.equal(400)

      /*
        Round 1 score: 100
        Round 2 score: 100
        Round 3 score: 200
        Round 4 score: 200
        Round 5 score: 400
        round N = [round N score] + ([cumulative score] * [1 - decay factor])
        round 1 = 100 + (0 * 0.8) = 100
        round 2 = 100 + (100 * 0.8) = 180
        round 3 = 200 + (180 * 0.8) = 344
        round 4 = 200 + (344 * 0.8) = 475,2 => 475 
        round 5 = 400 + (475 * 0.8) = 780
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 5)).to.equal(780)
    })

    it("Should be able to update rounds for cumulative scores", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts, creators } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })
      const creator1 = creators[0]
      const creator2 = creators[1]

      await bootstrapAndStartEmissions()

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])
      await endorseApp(app3Id, otherAccounts[4])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Sets app1 security to APP_SECURITY.LOW
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)

      // Sets app2 security to APP_SECURITY.MEDIUM
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 2)

      // Sets app3 security to APP_SECURITY.HIGH
      await veBetterPassport.connect(owner).setAppSecurity(app3Id, 3)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 3)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 4)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app3Id, 5)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 2)).to.equal(100)
      expect(await veBetterPassport.userRoundScore(otherAccount, 3)).to.equal(200)
      expect(await veBetterPassport.userRoundScore(otherAccount, 4)).to.equal(200)
      expect(await veBetterPassport.userRoundScore(otherAccount, 5)).to.equal(400)

      // skip through to round 5
      await moveToCycle(6)

      /*
        Round 1 score: 100
        Round 2 score: 100
        Round 3 score: 200
        Round 4 score: 200
        Round 5 score: 400
        round N = [round N score] + ([cumulative score] * [1 - decay factor])
        round 1 = 100 + (0 * 0.8) = 100
        round 2 = 100 + (100 * 0.8) = 180
        round 3 = 200 + (180 * 0.8) = 344
        round 4 = 200 + (344 * 0.8) = 475,2 => 475 
        round 5 = 400 + (475 * 0.8) = 780
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 5)).to.equal(780)

      // Only actions score manager can update rounds for cumulative scores
      await expect(veBetterPassport.connect(otherAccount).setRoundsForCumulativeScore(2)).to.be.reverted

      // Update rounds to 2
      await veBetterPassport.connect(owner).setRoundsForCumulativeScore(2)

      // Cumulative score should now be 180
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 5)).to.equal(560)
    })

    it("Should calculate decay from first round if last round specified is greater than cumulative rounds to look for", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      await veBetterPassport.setAppSecurity(app1Id, 1) // APP_SECURITY.LOW

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 3)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 4)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 5)

      // Get cumulative score from lastRound = 2. first round to start iterations would be negative so we expect cumulative score to start from round 1:
      // round 1 = 100 => round 2 = 100 + (100 * 0.8) = 180
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 2)).to.equal(180)
    })

    it("Should not be able to register action without ACTION_REGISTRAR_ROLE", async function () {
      const { veBetterPassport, owner, x2EarnApps, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await expect(veBetterPassport.connect(otherAccount).registerAction(otherAccount, app1Id)).to.be.reverted
    })

    it("Should be able to change app security with ACTION_SCORE_MANAGER_ROLE", async function () {
      const { veBetterPassport, owner, x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true

      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 2)

      expect(await veBetterPassport.appSecurity(app1Id)).to.equal(2)
    })

    it("Should be able to change decay rate with DEFAULT_ADMIN_ROLE", async function () {
      const { veBetterPassport, owner, otherAccounts, otherAccount, x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.grantRole(await veBetterPassport.DEFAULT_ADMIN_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true

      // 90% decay rate
      await veBetterPassport.connect(owner).setDecayRate(90)

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1) // APP_SECURITY.LOW

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 3)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 4)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 5)

      /*  
        round 1 = 100
        round 2 = 100 + (100 * 0.1) = 110
        round 3 = 100 + (110 * 0.1) = 111
        round 4 = 100 + (111 * 0.1) = 111.1 => 111
        round 5 = 100 + (111 * 0.1) = 111.1 => 111
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 5)).to.equal(111)
    })

    it("Should be able to set decay rate to 0", async function () {
      const { veBetterPassport, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.connect(owner).setDecayRate(1)
      expect(await veBetterPassport.decayRate()).to.equal(1)

      await veBetterPassport.connect(owner).setDecayRate(0)
      expect(await veBetterPassport.decayRate()).to.equal(0)
    })

    it("Should set app score to LOW by default when joining the ecosystem", async function () {
      const { veBetterPassport, owner, otherAccounts, otherAccount, x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(100n)
      expect(await veBetterPassport.userRoundScoreApp(otherAccount, 1, app1Id)).to.equal(100n)
    })

    it("Should not register action score if user is blacklisted", async function () {
      const { veBetterPassport, owner, otherAccounts, otherAccount, x2EarnApps, creators } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })
      const creator1 = creators[0]

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))

      // Set app security to APP_SECURITY.LOW
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 1)

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 1)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(100)
      expect(await veBetterPassport.userRoundScoreApp(otherAccount, 1, app1Id)).to.equal(100)

      // Blacklist user
      await veBetterPassport.connect(owner).blacklist(otherAccount.address)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 2)

      expect(await veBetterPassport.userRoundScore(otherAccount, 2)).to.equal(0)

      // Attach to passport
      await linkEntityToPassportWithSignature(veBetterPassport, owner, otherAccount, 1000)

      // Passport score should be 0
      expect(await veBetterPassport.userRoundScore(owner.address, 2)).to.equal(0)

      // Actions registered by blacklisted user should not affect passport score
      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app1Id, 3)

      expect(await veBetterPassport.userRoundScore(owner.address, 3)).to.equal(0)
      expect(await veBetterPassport.userRoundScore(otherAccount.address, 3)).to.equal(0)

      // Remove user from blacklist
      await veBetterPassport.connect(owner).whitelist(otherAccount.address)

      await veBetterPassport.connect(owner).registerActionForRound(otherAccount, app2Id, 4)

      expect(await veBetterPassport.userRoundScore(otherAccount, 4)).to.equal(0)
      // Passport score should be 1
      expect(await veBetterPassport.userRoundScore(owner.address, 4)).to.equal(100)
    })

    it("should revert if you try to link passport to yourself via signature", async function () {
      const { veBetterPassport, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(linkEntityToPassportWithSignature(veBetterPassport, owner, owner, 1000)).to.be.reverted
    })

    it("Should checkpoint the PoP score threshold correctly", async function () {
      const { veBetterPassport, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), owner.address)).to.be
        .true

      // Get block number post deployment
      const blockNumber1 = await ethers.provider.getBlockNumber()

      // Threshold PoP score is 0
      expect(await veBetterPassport.thresholdPoPScore()).to.equal(0)

      // Wait for next block
      await moveBlocks(1)

      // Set threshold PoP score to 100
      await veBetterPassport.connect(owner).setThresholdPoPScore(100)

      // Threshold PoP score is 100
      expect(await veBetterPassport.thresholdPoPScore()).to.equal(100)

      // Get block number post setting threshold
      const blockNumber2 = await ethers.provider.getBlockNumber()

      // Wait for next block
      await moveBlocks(1)

      // Set threshold PoP score to 200
      await veBetterPassport.connect(owner).setThresholdPoPScore(200)

      // Threshold PoP score is 200
      expect(await veBetterPassport.thresholdPoPScore()).to.equal(200)

      // Get block number post setting threshold
      const blockNumber3 = await ethers.provider.getBlockNumber()

      // Checkpoints
      expect(await veBetterPassport.thresholdPoPScoreAtTimepoint(blockNumber1)).to.equal(0)

      expect(await veBetterPassport.thresholdPoPScoreAtTimepoint(blockNumber2)).to.equal(100)

      expect(await veBetterPassport.thresholdPoPScoreAtTimepoint(blockNumber3)).to.equal(200)
    })

    it("should revert if you are trying to accept a link request that does not exist", async function () {
      const { veBetterPassport, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(veBetterPassport.connect(owner).acceptEntityLink(owner.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "NotLinked",
      )
    })

    it("should revert if you are trying to accept a link request and you are not the passport", async function () {
      const { veBetterPassport, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.linkEntityToPassport(otherAccount.address)

      await expect(veBetterPassport.connect(owner).acceptEntityLink(owner.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "UnauthorizedUser",
      )
    })

    it("should revert if you are trying to accept a link request and passport has reached max amoutn entities", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_PASSPORT_MAX_ENTITIES = 1
      const {
        veBetterPassport,
        owner: passport,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const entity1 = otherAccounts[0]
      const entity2 = otherAccounts[1]

      // Entities create link requests
      await veBetterPassport.connect(entity1).linkEntityToPassport(passport.address)
      await veBetterPassport.connect(entity2).linkEntityToPassport(passport.address)

      // Entity 2 link accepts link request
      await veBetterPassport.connect(passport).acceptEntityLink(entity2.address)

      //Entity 2 should be a passport entity
      expect(await veBetterPassport.getPassportForEntity(entity2.address)).to.equal(passport.address)

      // Should revert if entity 1 tries to accept link request as max entities reached
      await expect(veBetterPassport.connect(passport).acceptEntityLink(entity1.address)).to.be.revertedWithCustomError(
        veBetterPassport,
        "MaxEntitiesPerPassportReached",
      )
    })
  })

  describe("Passport Whitelisting & Blacklisting", function () {
    it("WHITELISTER_ROLE should be able to whitelist and blacklist users", async function () {
      const { veBetterPassport, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await veBetterPassport.hasRole(await veBetterPassport.WHITELISTER_ROLE(), owner.address)).to.be.true

      await veBetterPassport.toggleCheck(1)
      await veBetterPassport.toggleCheck(2)

      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true
      expect(await veBetterPassport.isCheckEnabled(2)).to.be.true

      await veBetterPassport.connect(owner).whitelist(otherAccount.address)

      expect(await veBetterPassport.isWhitelisted(otherAccount.address)).to.be.true
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([true, "User is whitelisted"])

      await veBetterPassport.connect(owner).blacklist(otherAccount.address)

      expect(await veBetterPassport.isWhitelisted(otherAccount.address)).to.be.false
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([false, "User is blacklisted"])
    })

    it("If whitelisted, blacklisting removes from whitelist", async function () {
      const { veBetterPassport, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.connect(owner).whitelist(otherAccount.address)

      await veBetterPassport.toggleCheck(1)
      await veBetterPassport.toggleCheck(2)

      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true
      expect(await veBetterPassport.isCheckEnabled(2)).to.be.true

      expect(await veBetterPassport.isWhitelisted(otherAccount.address)).to.be.true
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([true, "User is whitelisted"])

      await veBetterPassport.connect(owner).blacklist(otherAccount.address)

      expect(await veBetterPassport.isWhitelisted(otherAccount.address)).to.be.false
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([false, "User is blacklisted"])
    })

    it("If blacklisted, whitelisting removes from blacklist", async function () {
      const { veBetterPassport, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.toggleCheck(1)
      await veBetterPassport.toggleCheck(2)

      expect(await veBetterPassport.isCheckEnabled(1)).to.be.true
      expect(await veBetterPassport.isCheckEnabled(2)).to.be.true

      await veBetterPassport.connect(owner).blacklist(otherAccount.address)

      expect(await veBetterPassport.isWhitelisted(otherAccount.address)).to.be.false
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([false, "User is blacklisted"])

      await veBetterPassport.connect(owner).whitelist(otherAccount.address)

      expect(await veBetterPassport.isWhitelisted(otherAccount.address)).to.be.true
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([true, "User is whitelisted"])
    })

    it("Without WHITELISTER_ROLE, should not be able to whitelist or blacklist users", async function () {
      const { veBetterPassport, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(veBetterPassport.connect(otherAccount).whitelist(owner.address)).to.be.reverted
      await expect(veBetterPassport.connect(otherAccount).blacklist(owner.address)).to.be.reverted
    })

    it("If passport is whitelisted and enities are blacklisted, should return whitelisted", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 1000)

      await veBetterPassport.whitelist(passport.address)
      await veBetterPassport.blacklist(entity.address)

      expect(await veBetterPassport.isWhitelisted(passport.address)).to.be.true
      expect(await veBetterPassport.isBlacklisted(entity.address)).to.be.true

      // Passport is whitelisted, entity is blacklisted, should return whitelisted
      expect(await veBetterPassport.isPassportWhitelisted(passport.address)).to.be.true
      // Passport is whitelisted, entity is blacklisted, should return whitelisted
      expect(await veBetterPassport.isPassportWhitelisted(entity.address)).to.be.true
    })

    it("If passport is blacklisted and enities are whitelisted, should return blacklisted", async function () {
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 1000)

      await veBetterPassport.blacklist(passport.address)
      await veBetterPassport.whitelist(entity.address)

      expect(await veBetterPassport.isBlacklisted(passport.address)).to.be.true
      expect(await veBetterPassport.isWhitelisted(entity.address)).to.be.true

      // Passport is whitelisted, entity is blacklisted, should return whitelisted
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.true
      // Passport is whitelisted, entity is blacklisted, should return whitelisted
      expect(await veBetterPassport.isPassportBlacklisted(entity.address)).to.be.true
    })

    it("Can update blacklist threshold", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE = 60 // 60% of entities are blacklisted
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity1,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const entity2 = otherAccounts[2]

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity1, 1000)
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity2, 1000)

      await veBetterPassport.blacklist(entity1.address)

      expect(await veBetterPassport.isBlacklisted(entity1.address)).to.be.true
      expect(await veBetterPassport.isBlacklisted(entity2.address)).to.be.false

      // 50% of entities are blacklisted, doesn't meet threshold of 60%
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.false

      // Update threshold to 50%
      await veBetterPassport.setBlacklistThreshold(50)

      // 50% of entities are blacklisted, meets threshold of 50%
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.true
    })

    it("Can update whitelist threshold", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE = 60 // 60% of entities are blacklisted
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity1,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const entity2 = otherAccounts[2]

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity1, 1000)
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity2, 1000)

      await veBetterPassport.whitelist(entity1.address)

      expect(await veBetterPassport.isWhitelisted(entity1.address)).to.be.true
      expect(await veBetterPassport.isWhitelisted(entity2.address)).to.be.false

      // 50% of entities are whitelisted, doesn't meet threshold of 60%
      expect(await veBetterPassport.isPassportWhitelisted(passport.address)).to.be.false

      // Update threshold to 50%
      await veBetterPassport.setWhitelistThreshold(50)

      // 50% of entities are whitelisted, meets threshold of 50%
      expect(await veBetterPassport.isPassportWhitelisted(passport.address)).to.be.true
    })

    it("Can remove user from blacklist", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE = 60 // 60% of entities are blacklisted
      const {
        veBetterPassport,
        otherAccount: entity1,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const entity2 = otherAccounts[2]

      await veBetterPassport.blacklist(entity1.address)

      expect(await veBetterPassport.isBlacklisted(entity1.address)).to.be.true
      expect(await veBetterPassport.isBlacklisted(entity2.address)).to.be.false

      // Remove entity1 from blacklist
      await veBetterPassport.removeFromBlacklist(entity1.address)

      expect(await veBetterPassport.isBlacklisted(entity1.address)).to.be.false
    })

    it("Can remove user from whitelist", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE = 60 // 60% of entities are whitelisted
      const { veBetterPassport, otherAccount: entity1 } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await veBetterPassport.whitelist(entity1.address)

      expect(await veBetterPassport.isWhitelisted(entity1.address)).to.be.true

      // Remove entity1 from whitelist
      await veBetterPassport.removeFromWhitelist(entity1.address)

      // Entity1 should no longer be whitelisted
      expect(await veBetterPassport.isWhitelisted(entity1.address)).to.be.false
    })

    it("Can remove an entity from whitelist", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE = 60 // 60% of entities are whitelisted
      const {
        veBetterPassport,
        otherAccount: entity1,
        owner: passport,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity1, 1000)

      await veBetterPassport.whitelist(entity1.address)

      expect(await veBetterPassport.isWhitelisted(entity1.address)).to.be.true

      expect(await veBetterPassport.isPassportWhitelisted(passport.address)).to.be.true

      // Remove entity1 from whitelist
      await veBetterPassport.removeFromWhitelist(entity1.address)

      // Entity1 should no longer be whitelisted
      expect(await veBetterPassport.isWhitelisted(entity1.address)).to.be.false

      // Passport should no longer be whitelisted
      expect(await veBetterPassport.isPassportWhitelisted(passport.address)).to.be.false
    })

    it("If over the threshold amount of entities are blacklisted, passport should return blacklisted", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE = 60 // 60% of entities are blacklisted
      const {
        veBetterPassport,
        owner: passport,
        otherAccount: entity1,
        otherAccounts,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const entity2 = otherAccounts[2]

      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity1, 1000)

      // 100% of entities are blacklisted
      await veBetterPassport.blacklist(entity1.address)

      expect(await veBetterPassport.isBlacklisted(passport.address)).to.be.false
      expect(await veBetterPassport.isBlacklisted(entity1.address)).to.be.true
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.true

      // 50% of entities are blacklisted
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity2, 1000)

      expect(await veBetterPassport.isBlacklisted(passport.address)).to.be.false
      expect(await veBetterPassport.isBlacklisted(entity1.address)).to.be.true
      expect(await veBetterPassport.isBlacklisted(entity2.address)).to.be.false
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.false

      // Blacklist entity2
      await veBetterPassport.blacklist(entity2.address)

      expect(await veBetterPassport.isBlacklisted(passport.address)).to.be.false
      expect(await veBetterPassport.isBlacklisted(entity1.address)).to.be.true
      expect(await veBetterPassport.isBlacklisted(entity2.address)).to.be.true
      expect(await veBetterPassport.isPassportBlacklisted(passport.address)).to.be.true
    })
  })

  describe("isPerson", function () {
    it("Should return true if user is whitelisted", async function () {
      const { veBetterPassport, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.connect(owner).toggleCheck(1)

      await veBetterPassport.connect(owner).whitelist(otherAccount.address)

      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([true, "User is whitelisted"])
    })

    it("Should return false if user is blacklisted", async function () {
      const { veBetterPassport, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.connect(owner).toggleCheck(2)

      await veBetterPassport.connect(owner).blacklist(otherAccount.address)

      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([false, "User is blacklisted"])
    })

    it("Should return true if user does meet participation score threshold", async function () {
      const config = createTestConfig()
      const { veBetterPassport, owner, otherAccount, x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Set the threshold to 100
      await veBetterPassport.connect(owner).setThresholdPoPScore(100)

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      await veBetterPassport.toggleCheck(4)

      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)

      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1) // APP_SECURITY.LOW

      await veBetterPassport.connect(owner).registerAction(otherAccount, app1Id)

      expect(await veBetterPassport.userRoundScore(otherAccount, 1)).to.equal(100)

      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 1)).to.equal(100)

      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        true,
        "User's participation score is above the threshold",
      ])
    })

    it("Should return false if user doesn't meet any valid personhood criteria", async function () {
      const { veBetterPassport, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])
    })
  })

  describe("Passport GM check", function () {
    it("isPerson should return true if user has GM token above threshold level", async function () {
      const config = createLocalConfig()
      config.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL = 5
      const { veBetterPassport, owner, otherAccount, galaxyMember, b3tr, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Toggle GM check
      await veBetterPassport.connect(owner).toggleCheck(5)

      // Set GM token level to 5
      await galaxyMember.connect(owner).setMaxLevel(5)

      // Bootstrap emissions
      await bootstrapEmissions()

      // Should be able to free mint after participating in allocation voting -> User is whitelisted at this point
      await participateInAllocationVoting(otherAccount)

      // Check if user is whitelisted
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([true, "User is whitelisted"])

      // Mint GM token
      await galaxyMember.connect(otherAccount).freeMint()

      // User should have GM token of level 1 at this point
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(1)

      // Disable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // User should not be a person here as there GM totken level is below threshold of 5
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Upgrade GM token to level 5
      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, otherAccount, minterAccount)

      // User should have GM token of level 5 at this point
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(5) // Level 5

      // User should be a person here as there GM token level is above threshold of 5
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])
    })

    it("isPersonAtTimePoint should return true if user has GM token above threshold level", async function () {
      const config = createLocalConfig()
      config.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL = 5
      const { veBetterPassport, owner, otherAccount, galaxyMember, b3tr, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Toggle GM check
      await veBetterPassport.connect(owner).toggleCheck(5)

      // Set GM token level to 5
      await galaxyMember.connect(owner).setMaxLevel(5)

      // Bootstrap emissions
      await bootstrapEmissions()

      // Should be able to free mint after participating in allocation voting -> User is whitelisted at this point
      await participateInAllocationVoting(otherAccount)

      // Check if user is whitelisted
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([true, "User is whitelisted"])

      // Mint GM token
      await galaxyMember.connect(otherAccount).freeMint()

      // User should have GM token of level 1 at this point
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(1)

      // Disable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // User should not be a person here as there GM totken level is below threshold of 5
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Upgrade GM token to level 5
      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, otherAccount, minterAccount)

      // Get block number post upgrading GM token
      const blockNumberPost = await ethers.provider.getBlockNumber()

      // User should have GM token of level 5 at this point
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(5) // Level 5

      // User should be a person here as there GM token level is above threshold of 5
      expect(await veBetterPassport.isPersonAtTimepoint(otherAccount.address, blockNumberPost)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])
    })

    it("isPersonAtTimePoint should return true if user GM was upgraded since timepoint", async function () {
      const config = createLocalConfig()
      config.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL = 5
      const { veBetterPassport, owner, otherAccount, galaxyMember, b3tr, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Toggle GM check
      await veBetterPassport.connect(owner).toggleCheck(5)

      // Set GM token level to 5
      await galaxyMember.connect(owner).setMaxLevel(5)

      // Bootstrap emissions
      await bootstrapEmissions()

      // Should be able to free mint after participating in allocation voting -> User is whitelisted at this point
      await participateInAllocationVoting(otherAccount)

      // Check if user is whitelisted
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([true, "User is whitelisted"])

      // Mint GM token
      await galaxyMember.connect(otherAccount).freeMint()

      // User should have GM token of level 1 at this point
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(1)

      // Disable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // User should not be a person here as there GM totken level is below threshold of 5
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Get block number prior to upgrading GM token
      const blockNumberPre = await ethers.provider.getBlockNumber()

      // Upgrade GM token to level 5
      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, otherAccount, minterAccount)

      // Get block number post upgrading GM token
      const blockNumberPost = await ethers.provider.getBlockNumber()

      // User should have GM token of level 5 at this point
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(5) // Level 5

      // User should be a person prior to upgrading GM token as token has since been upgraded
      expect(await veBetterPassport.isPersonAtTimepoint(otherAccount.address, blockNumberPre)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])

      // User should be a person here as there GM token level is above threshold of 5
      expect(await veBetterPassport.isPersonAtTimepoint(otherAccount.address, blockNumberPost)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])
    })

    it("isPersonAtTimePoint should return false if user did not own GM at timepoint", async function () {
      const config = createLocalConfig()
      config.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL = 5
      const { veBetterPassport, owner, otherAccount, galaxyMember, b3tr, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Toggle GM check
      await veBetterPassport.connect(owner).toggleCheck(5)

      // Set GM token level to 5
      await galaxyMember.connect(owner).setMaxLevel(5)

      // Bootstrap emissions
      await bootstrapEmissions()

      // Should be able to free mint after participating in allocation voting -> User is whitelisted at this point
      await participateInAllocationVoting(otherAccount)

      // Check if user is whitelisted
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([true, "User is whitelisted"])

      // Mint GM token
      await galaxyMember.connect(otherAccount).freeMint()
      // Upgrade GM token to level 5
      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, otherAccount, minterAccount)

      // User should have GM token of level 5 at this point
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(5)

      // Disable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // Get block number prior to transferring GM token
      const blockNumberPre = await ethers.provider.getBlockNumber()

      await galaxyMember.connect(otherAccount).transferFrom(otherAccount.address, owner.address, 1)

      // Get block number post upgrading GM token
      const blockNumberPost = await ethers.provider.getBlockNumber()

      // User who no longer owns GM token be a person at timepoint pre transfer
      expect(await veBetterPassport.isPersonAtTimepoint(otherAccount.address, blockNumberPre)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])

      // User who no longer owns GM token be a person at timepoint post transfer
      expect(await veBetterPassport.isPersonAtTimepoint(otherAccount.address, blockNumberPost)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // User who received GM token be a person at timepoint post transfer
      expect(await veBetterPassport.isPersonAtTimepoint(owner.address, blockNumberPost)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])

      // User who received GM token shoould not be a person at timepoint pre transfer
      expect(await veBetterPassport.isPersonAtTimepoint(owner.address, blockNumberPre)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // They should be a person at the current block
      expect(await veBetterPassport.isPerson(owner.address)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])

      // User who no longer owns GM token should not be a person at the current block
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])
    })

    it("isPersonAtTimePoint should return false if user did have selected GM at timepoint", async function () {
      const config = createLocalConfig()
      config.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL = 5
      const { veBetterPassport, owner, otherAccount, galaxyMember, b3tr, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Toggle GM check
      await veBetterPassport.connect(owner).toggleCheck(5)

      // Set GM token level to 5
      await galaxyMember.connect(owner).setMaxLevel(5)

      // Bootstrap emissions
      await bootstrapEmissions()

      // Should be able to free mint after participating in allocation voting -> User is whitelisted at this point
      await participateInAllocationVoting(otherAccount)

      // Disable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // Mint 2 GM tokens
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()

      // User should own 2 GM tokens
      expect(await galaxyMember.getTokensInfoByOwner(otherAccount.address, 0, 5)).to.have.lengthOf(2)

      // Users selected GM token should be token 1
      expect(await galaxyMember.getSelectedTokenId(otherAccount.address)).to.equal(1)

      // Users selected should have GM token of level 1 at this point
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(1)

      // Upgrade the users other GM token to level 5
      await upgradeNFTtoLevel(2, 5, galaxyMember, b3tr, otherAccount, minterAccount)

      // Get block number prior to changing selected GM token
      const blockNumberPre = await ethers.provider.getBlockNumber()

      // Change selected GM token to token 2
      await galaxyMember.connect(otherAccount).select(2)

      // Get block number post changing selected GM token
      const blockNumberPost = await ethers.provider.getBlockNumber()

      // Users selected GM token should be token 2
      expect(await galaxyMember.getSelectedTokenId(otherAccount.address)).to.equal(2)

      // User should not be a person at timepoint pre changing selected GM token
      expect(await veBetterPassport.isPersonAtTimepoint(otherAccount.address, blockNumberPre)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // User should be a person at timepoint post changing selected GM token
      expect(await veBetterPassport.isPersonAtTimepoint(otherAccount.address, blockNumberPost)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])

      // User should be a person at the current block
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])
    })

    it("if GM check threshold is updated, should return correct personhood status", async function () {
      const config = createLocalConfig()
      config.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL = 5
      const { veBetterPassport, owner, otherAccount, galaxyMember, b3tr, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Toggle GM check
      await veBetterPassport.connect(owner).toggleCheck(5)

      // Set GM token level to 5
      await galaxyMember.connect(owner).setMaxLevel(5)

      // Bootstrap emissions
      await bootstrapEmissions()

      // Should be able to free mint after participating in allocation voting -> User is whitelisted at this point
      await participateInAllocationVoting(otherAccount)

      // Check if user is whitelisted
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([true, "User is whitelisted"])

      // Mint GM token
      await galaxyMember.connect(otherAccount).freeMint()

      // User should have GM token of level 1 at this point
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(1)

      // Disable whitelist check
      await veBetterPassport.connect(owner).toggleCheck(1)

      // User should not be a person here as there GM totken level is below threshold of 5
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])

      // Upgrade GM token to level 5
      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, otherAccount, minterAccount)

      // User should have GM token of level 5 at this point
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(5) // Level 5

      // User should be a person here as there GM token level is above threshold of 5
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        true,
        "User's selected Galaxy Member is above the minimum level",
      ])

      //  Update GM check threshold to 100
      await veBetterPassport.connect(owner).setMinimumGalaxyMemberLevel(100)

      // User should not be a person here as there GM token level is below threshold of 100
      expect(await veBetterPassport.isPerson(otherAccount.address)).to.deep.equal([
        false,
        "User does not meet the criteria to be considered a person",
      ])
    })
  })

  describe("Governance & X Allocation Voting", function () {
    it("Should register participation correctly through emission's cycles", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      const {
        x2EarnApps,
        owner,
        otherAccount,
        veBetterPassport,
        otherAccounts,
        b3tr,
        B3trContract,
        xAllocationVoting,
        governor,
        creators,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await getVot3Tokens(otherAccount, "10000")
      await getVot3Tokens(owner, "10000")

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])
      await endorseApp(app3Id, otherAccounts[4])

      // Set app security levels
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 2)
      await veBetterPassport.connect(owner).setAppSecurity(app3Id, 3)

      // Grant action registrar role
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      // Create a proposal for next round
      // create a new proposal active from round 2
      const tx = await createProposal(b3tr, B3trContract, owner, "Get b3tr token details", "tokenDetails", [], 2)

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), owner)

      // First round, participation score check is disabled

      // Register actions for round 1
      await veBetterPassport.connect(owner).registerAction(otherAccount, app1Id)
      await veBetterPassport.connect(owner).registerAction(otherAccount, app2Id)

      // User's cumulative score = 100 (app1) + 200 (app2) = 300
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 1)).to.equal(300)

      await veBetterPassport.toggleCheck(4)

      // Vote
      // Note that `otherAccount` can vote because the participation score threshold is set to 0
      await xAllocationVoting
        .connect(otherAccount)
        .castVote(
          1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      // Set minimum participation score to 500
      await veBetterPassport.setThresholdPoPScore(500)

      await waitForProposalToBeActive(proposalId)

      expect(await xAllocationVoting.currentRoundId()).to.equal(2)

      // User tries to vote both governance and x allocation voting but reverts due to not meeting the participation score threshold
      await expect(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(
            2,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      await expect(governor.connect(otherAccount).castVote(proposalId, 2)).to.be.revertedWithCustomError(
        xAllocationVoting,
        "GovernorPersonhoodVerificationFailed",
      )

      // Register actions for round 2
      await veBetterPassport.connect(owner).registerAction(otherAccount, app2Id)
      await veBetterPassport.connect(owner).registerAction(otherAccount, app3Id)

      /*
        User's cumulative score:
        round 1 = 300
        round 2 = 600 + (300 * 0.8) = 840
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 2)).to.equal(840)

      // User now meets the participation score threshold and can vote
      await xAllocationVoting
        .connect(otherAccount)
        .castVote(
          2,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      await governor.connect(otherAccount).castVote(proposalId, 2)

      // Increase participation score threshold to 1000
      await veBetterPassport.setThresholdPoPScore(1000)

      await waitForNextCycle()

      // Increase participation score threshold to 1000
      await veBetterPassport.setThresholdPoPScore(1000)

      await startNewAllocationRound()

      expect(await xAllocationVoting.currentRoundId()).to.equal(3)

      // User tries to vote x allocation voting but reverts due to not meeting the participation score threshold
      await expect(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(
            3,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      // Register action for round 3
      await veBetterPassport.connect(owner).registerAction(otherAccount, app1Id)

      /*
        User's cumulative score:
        round 1 = 300
        round 2 = 600 + (300 * 0.8) = 840
        round 3 = 100 + (840 * 0.8) = 772
        */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 3)).to.equal(772)

      // User still doesn't meet the participation score threshold and can't vote
      await expect(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(
            3,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      // register more actions for round 3
      await veBetterPassport.connect(owner).registerAction(otherAccount, app2Id)
      await veBetterPassport.connect(owner).registerAction(otherAccount, app3Id)

      /*
        User's cumulative score:
        round 1 = 300
        round 2 = 600 + (300 * 0.8) = 840
        round 3 = 700 + (840 * 0.8) = 1072
        */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 3)).to.equal(1372)

      // User now meets the participation score threshold and can vote
      await xAllocationVoting
        .connect(otherAccount)
        .castVote(
          3,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      // "Before linking passport should have 0"
      expect(await veBetterPassport.getCumulativeScoreWithDecay(owner, 3)).to.equal(0)

      // Before linking passport should not be considered person
      expect(
        (await veBetterPassport.isPersonAtTimepoint(owner.address, await xAllocationVoting.roundSnapshot(3)))[0],
      ).to.be.equal(false)

      // Delegate passport to owner and try to vote
      await linkEntityToPassportWithSignature(veBetterPassport, owner, otherAccount, 3600)
      // After linking "other account" should be entity
      expect(await veBetterPassport.isEntity(otherAccount.address)).to.be.true

      // After linking owner should be passport
      expect(await veBetterPassport.isPassport(owner.address)).to.be.true

      // After linking passport should not be considered person at the beginning of the round
      expect(
        (await veBetterPassport.isPersonAtTimepoint(owner.address, await xAllocationVoting.roundSnapshot(3)))[0],
      ).to.be.equal(false)

      expect(await veBetterPassport.isPassport(owner.address)).to.be.true

      // Owner can't vote yet because the delegation is checkpointed and is active from the next round
      await expect(
        xAllocationVoting
          .connect(owner)
          .castVote(
            3,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")
      await waitForNextCycle()

      await startNewAllocationRound()

      expect(await xAllocationVoting.currentRoundId()).to.equal(4)

      // During linking points are not brought over, so we need to register some actions
      // on both the entity and the passport to see that they are grouped together and can vote
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 4)).to.equal(1097)

      // register more actions for round 4 (mixing entity and passport)
      await veBetterPassport.connect(owner).registerAction(otherAccount, app2Id)
      await veBetterPassport.connect(owner).registerAction(owner, app3Id)
      await veBetterPassport.connect(owner).registerAction(owner, app3Id)

      // new points should be added to the passport, entity should not have any new points added
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 4)).to.equal(1097)
      /*
        Passport's cumulative score:
        round 4 = 200 + 400 + 400
        */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(owner, 4)).to.equal(1000)

      // Now that we reached threshold passport should be considered person
      expect(
        (await veBetterPassport.isPersonAtTimepoint(owner.address, await xAllocationVoting.roundSnapshot(4)))[0],
      ).to.be.equal(true)

      // Owner can vote now
      await xAllocationVoting
        .connect(owner)
        .castVote(
          4,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )
    })

    it("Should use checkpointed PoP score threshold for whole round regardless if PoP score changes", async function () {
      const config = createTestConfig()
      config.VEPASSPORT_DECAY_RATE = 20
      config.EMISSIONS_CYCLE_DURATION = 20
      const {
        x2EarnApps,
        owner,
        otherAccount,
        veBetterPassport,
        otherAccounts,
        b3tr,
        B3trContract,
        xAllocationVoting,
        governor,
        creators,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await getVot3Tokens(otherAccount, "10000")
      await getVot3Tokens(owner, "10000")

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])
      await endorseApp(app3Id, otherAccounts[4])

      // Set app security levels
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 1)
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 2)
      await veBetterPassport.connect(owner).setAppSecurity(app3Id, 3)

      // Grant action registrar role
      await veBetterPassport.grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner)
      expect(await veBetterPassport.hasRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)).to.be.true

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      // Create a proposal for next round
      // create a new proposal active from round 2
      const tx = await createProposal(b3tr, B3trContract, owner, "Get b3tr token details", "tokenDetails", [], 2)

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), owner)

      // First round, participation score check is disabled

      // Register actions for round 1
      await veBetterPassport.connect(owner).registerAction(otherAccount, app1Id)
      await veBetterPassport.connect(owner).registerAction(otherAccount, app2Id)

      // User's cumulative score = 100 (app1) + 200 (app2) = 300
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 1)).to.equal(300)

      await veBetterPassport.toggleCheck(4)

      // Vote
      // Note that `otherAccount` can vote because the participation score threshold is set to 0
      await xAllocationVoting
        .connect(otherAccount)
        .castVote(
          1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      // Set minimum participation score to 500, which will take effect from the next round
      await veBetterPassport.setThresholdPoPScore(500)

      // owmer has a threshold of 0 but can vote because the threshold is still 0 for the round
      await xAllocationVoting
        .connect(owner)
        .castVote(
          1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      await waitForProposalToBeActive(proposalId)

      // New round has started and the threshold is now 500
      expect(await xAllocationVoting.currentRoundId()).to.equal(2)

      // User tries to vote both governance and x allocation voting but reverts due to not meeting the participation score threshold
      await expect(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(
            2,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      await expect(governor.connect(otherAccount).castVote(proposalId, 2)).to.be.revertedWithCustomError(
        xAllocationVoting,
        "GovernorPersonhoodVerificationFailed",
      )

      // Register actions for round 2
      await veBetterPassport.connect(owner).registerAction(otherAccount, app2Id)
      await veBetterPassport.connect(owner).registerAction(otherAccount, app3Id)

      /*
        User's cumulative score:
        round 1 = 300
        round 2 = 600 + (300 * 0.8) = 840
      */
      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 2)).to.equal(840)

      // User now meets the participation score threshold and can vote
      await xAllocationVoting
        .connect(otherAccount)
        .castVote(
          2,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )

      // Owner can not as threshold is 500
      await expect(
        xAllocationVoting
          .connect(owner)
          .castVote(
            2,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      await governor.connect(otherAccount).castVote(proposalId, 2)

      await waitForNextCycle()

      await startNewAllocationRound()

      expect(await xAllocationVoting.currentRoundId()).to.equal(3)

      // Increase participation score threshold to 1000
      await veBetterPassport.setThresholdPoPScore(1000)

      // User tries to vote x allocation voting and can vote because the threshold is still 500 for the round
      await expect(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(
            3,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.not.be.reverted

      await waitForNextCycle()

      await startNewAllocationRound()

      // User tries to vote x allocation voting and can't vote because the threshold is now 1000 for the round
      await expect(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(
            4,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      // Register action for round 4
      await veBetterPassport.connect(owner).registerAction(otherAccount, app1Id)

      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 4)).to.equal(637)

      // User still doesn't meet the participation score threshold and can't vote
      await expect(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(
            4,
            [app1Id, app2Id, app3Id],
            [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
          ),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorPersonhoodVerificationFailed")

      // register more actions for round 4
      await veBetterPassport.connect(owner).registerAction(otherAccount, app2Id)
      await veBetterPassport.connect(owner).registerAction(otherAccount, app3Id)

      expect(await veBetterPassport.getCumulativeScoreWithDecay(otherAccount, 4)).to.equal(1237)

      // User now meets the participation score threshold and can vote
      await xAllocationVoting
        .connect(otherAccount)
        .castVote(
          4,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )
    })
  })
})
