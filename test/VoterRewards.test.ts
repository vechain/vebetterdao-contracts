import { describe, it, beforeEach } from "mocha"
import {
  catchRevert,
  getOrDeployContractInstances,
  getVot3Tokens,
  levels,
  multipliers,
  waitForNextCycle,
  voteOnApps,
  addAppsToAllocationVoting,
  waitForRoundToEnd,
  bootstrapEmissions,
  upgradeNFTtoLevel,
  waitForNextBlock,
  createProposal,
  getProposalIdFromTx,
  waitForProposalToBeActive,
  ZERO_ADDRESS,
  participateInAllocationVoting,
  startNewAllocationRound,
  addNodeToken,
  bootstrapAndStartEmissions,
  payDeposit,
  moveBlocks,
  updateGMMultipliers,
} from "./helpers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { createLocalConfig } from "../config/contracts/envs/local"
import { createTestConfig } from "./helpers/config"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { deployAndUpgrade, deployProxy, upgradeProxy } from "../scripts/helpers"
import {
  B3TRGovernor,
  B3TRGovernorV5,
  Emissions,
  EmissionsV2,
  GalaxyMember,
  GalaxyMemberV1,
  GalaxyMemberV2,
  VoterRewards,
  VoterRewardsV1,
  VoterRewardsV2,
  VoterRewardsV3,
  VoterRewardsV4,
  XAllocationVoting,
} from "../typechain-types"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { endorseApp } from "./helpers/xnodes"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("VoterRewards - @shard2", () => {
  // Environment params
  let creator1: HardhatEthersSigner
  let creator2: HardhatEthersSigner
  beforeEach(async function () {
    const { creators } = await getOrDeployContractInstances({ forceDeploy: true })
    creator1 = creators[0]
    creator2 = creators[1]
  })

  describe("Contract parameters", () => {
    it("Should have correct parameters set on deployment", async () => {
      const { voterRewards, owner, galaxyMember, emissions } = await getOrDeployContractInstances({ forceDeploy: true })

      // Contract address checks
      expect(await voterRewards.emissions()).to.equal(await emissions.getAddress())
      expect(await voterRewards.galaxyMember()).to.equal(await galaxyMember.getAddress())

      // Admin role
      expect(await voterRewards.hasRole(await voterRewards.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true)

      // NFT Levels multipliers
      for (const level of levels) {
        expect(await voterRewards.levelToMultiplier(level)).to.equal(multipliers[levels.indexOf(level)])
      }
    })

    it("Should be able to set new emissions contract", async () => {
      const { voterRewards, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await voterRewards.connect(owner).setEmissions(otherAccount.address)
      expect(await voterRewards.emissions()).to.equal(otherAccount.address)
    })

    it("Should not be able to set new emissions contract if not admin", async () => {
      const { voterRewards, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await expect(voterRewards.connect(otherAccount).setEmissions(otherAccount.address)).to.be.reverted
    })

    it("Should be able to set new Galaxy Member contract", async () => {
      const { voterRewards, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await voterRewards.connect(owner).setGalaxyMember(otherAccount.address)
      expect(await voterRewards.galaxyMember()).to.equal(otherAccount.address)
    })

    it("Should not be able to set new Galaxy Member contract if not admin", async () => {
      const { voterRewards, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await expect(voterRewards.connect(otherAccount).setGalaxyMember(otherAccount.address)).to.be.reverted
    })

    it("Should not be able to register vote if proposal start is zero", async () => {
      const { voterRewards, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), otherAccount.address)

      await expect(
        voterRewards
          .connect(otherAccount)
          .registerVote(
            0,
            otherAccount.address,
            ethers.parseEther("1000"),
            ethers.parseEther(Math.sqrt(1000).toString()),
          ),
      ).to.be.reverted
    })

    it("Should revert if admin is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, galaxyMember, emissions } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("VoterRewardsV1", [
          ZERO_ADDRESS, // admin
          owner.address, // upgrader
          owner.address, // contractsAddressManager
          await emissions.getAddress(),
          await galaxyMember.getAddress(),
          await b3tr.getAddress(),
          levels,
          multipliers,
        ]),
      ).to.be.reverted
    })

    it("Should not be able to register vote for zero address voter", async () => {
      const { voterRewards, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), otherAccount.address)

      await expect(
        voterRewards
          .connect(otherAccount)
          .registerVote(1, ZERO_ADDRESS, ethers.parseEther("1000"), ethers.parseEther(Math.sqrt(1000).toString())),
      ).to.be.reverted
    })

    it("Should return correct scaling factor", async () => {
      const { voterRewards } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await voterRewards.SCALING_FACTOR()).to.equal(10 ** 6)
    })

    it("Should return correct b3tr address", async () => {
      const { voterRewards, b3tr } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await voterRewards.b3tr()).to.equal(await b3tr.getAddress())
    })

    it("Should be able to set level to multiplier", async () => {
      const { voterRewards, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await voterRewards.connect(owner).setLevelToMultiplierNow(1, 2)
      expect(await voterRewards.levelToMultiplier(1)).to.equal(2)

      await expect(voterRewards.connect(owner).setLevelToMultiplierNow(0, 2)).to.be.reverted // Level cannot be zero
      await expect(voterRewards.connect(owner).setLevelToMultiplierNow(1, 0)).to.be.reverted // Multiplier cannot be zero

      await expect(voterRewards.connect(otherAccount).setLevelToMultiplierNow(1, 2)).to.be.reverted // Should not be able to set level to multiplier if not admin
    })

    it("Should be able to set galaxy member address", async () => {
      const { voterRewards, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await voterRewards.connect(owner).setGalaxyMember(otherAccount.address)
      expect(await voterRewards.galaxyMember()).to.equal(otherAccount.address)

      await expect(voterRewards.connect(otherAccount).setGalaxyMember(otherAccount.address)).to.be.reverted // Should not be able to set galaxy member address if not admin
      await expect(voterRewards.connect(owner).setGalaxyMember(ZERO_ADDRESS)).to.be.reverted // Galaxy member address cannot be zero
    })

    it("Should be able to set emissions address", async () => {
      const { voterRewards, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await voterRewards.connect(owner).setEmissions(otherAccount.address)
      expect(await voterRewards.emissions()).to.equal(otherAccount.address)

      await expect(voterRewards.connect(otherAccount).setEmissions(otherAccount.address)).to.be.reverted // Should not be able to set emissions address if not admin
      await expect(voterRewards.connect(owner).setEmissions(ZERO_ADDRESS)).to.be.reverted // Emissions address cannot be zero
    })

    it("Admin should be able to set vote registrar role address", async () => {
      const { voterRewards, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), otherAccount.address)
    })

    it(" admin should be able to set vote registrar role address", async () => {
      const { voterRewards, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await voterRewards.hasRole(await voterRewards.VOTE_REGISTRAR_ROLE(), otherAccount.address)).to.eql(false)
      await expect(
        voterRewards.connect(otherAccount).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), otherAccount.address),
      ).to.be.reverted
    })

    it("Should be able to disable Quadratic Rewards", async () => {
      const { voterRewards, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await voterRewards.isQuadraticRewardingDisabledAtBlock(await ethers.provider.getBlockNumber())).to.eql(
        false,
      )

      const tx = await voterRewards.connect(owner).toggleQuadraticRewarding()

      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      const events = receipt?.logs

      const decodedEvents = events?.map(event => {
        return voterRewards.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      const event = decodedEvents.find(event => event?.name === "QuadraticRewardingToggled")

      expect(event).to.not.equal(undefined)

      expect(await voterRewards.isQuadraticRewardingDisabledAtBlock(await ethers.provider.getBlockNumber())).to.eql(
        true,
      )
    })

    it("Quadratic Rewards should be enabled by default", async () => {
      const { voterRewards } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await voterRewards.isQuadraticRewardingDisabledAtBlock(1)).to.eql(false)
    })

    it("Only admin should be able to disable Quadratic Rewards", async () => {
      const { voterRewards, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await expect(voterRewards.connect(otherAccount).toggleQuadraticRewarding()).to.be.reverted
    })

    it("Clock should return correct block number", async () => {
      const { voterRewards } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await voterRewards.clock()).to.equal(await ethers.provider.getBlockNumber())
    })
  })

  describe("Contract upgradeablity", () => {
    it("Admin should be able to upgrade the contract", async function () {
      const { voterRewards, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("VoterRewards")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await voterRewards.getAddress())

      const UPGRADER_ROLE = await voterRewards.UPGRADER_ROLE()
      expect(await voterRewards.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(voterRewards.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await voterRewards.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Admin should be able to upgrade the contract", async function () {
      const { voterRewards, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("VoterRewards")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await voterRewards.getAddress())

      const UPGRADER_ROLE = await voterRewards.UPGRADER_ROLE()
      expect(await voterRewards.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(voterRewards.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await voterRewards.getAddress())

      expect(newImplAddress.toUpperCase()).to.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.not.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Admin can change UPGRADER_ROLE", async function () {
      const { voterRewards, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("VoterRewards")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await voterRewards.getAddress())

      const UPGRADER_ROLE = await voterRewards.UPGRADER_ROLE()
      expect(await voterRewards.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(voterRewards.connect(owner).grantRole(UPGRADER_ROLE, otherAccount.address)).to.not.be.reverted
      await expect(voterRewards.connect(owner).revokeRole(UPGRADER_ROLE, owner.address)).to.not.be.reverted

      await expect(voterRewards.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not
        .be.reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await voterRewards.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Should not be able to initialize the contract after already being initialized", async function () {
      const { voterRewards, owner, emissions, galaxyMember, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(
        voterRewards.initialize(
          owner.address,
          owner.address,
          owner.address,
          await emissions.getAddress(),
          await galaxyMember.getAddress(),
          await b3tr.getAddress(),
          levels,
          multipliers,
        ),
      ).to.be.reverted
    })

    it("Should not be able to deploy proxy with galaxy member address as zero address", async function () {
      const { owner, emissions, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(
        deployProxy("VoterRewardsV1", [
          owner.address,
          owner.address,
          owner.address,
          await emissions.getAddress(),
          ZERO_ADDRESS,
          await b3tr.getAddress(),
          levels,
          multipliers,
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy proxy with emissions address as zero address", async function () {
      const { owner, galaxyMember, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(
        deployProxy("VoterRewardsV1", [
          owner.address,
          owner.address,
          owner.address,
          ZERO_ADDRESS,
          await galaxyMember.getAddress(),
          await b3tr.getAddress(),
          levels,
          multipliers,
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy proxy with b3tr address as zero address", async function () {
      const { owner, emissions, galaxyMember } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(
        deployProxy("VoterRewardsV1", [
          owner.address,
          owner.address,
          owner.address,
          await emissions.getAddress(),
          await galaxyMember.getAddress(),
          ZERO_ADDRESS,
          levels,
          multipliers,
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy proxy with incorrect levels and multipliers", async function () {
      const { owner, emissions, galaxyMember, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(
        deployProxy("VoterRewardsV1", [
          owner.address,
          owner.address,
          owner.address,
          await emissions.getAddress(),
          await galaxyMember.getAddress(),
          await b3tr.getAddress(),
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          [1, 2, 3, 4, 5, 6, 7, 8, 9], // Incorrect multipliers length should be same as levels length
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy proxy with levels empty", async function () {
      const { owner, emissions, galaxyMember, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(
        deployProxy("VoterRewardsV1", [
          owner.address,
          owner.address,
          owner.address,
          await emissions.getAddress(),
          await galaxyMember.getAddress(),
          await b3tr.getAddress(),
          [],
          [],
        ]),
      ).to.be.reverted
    })

    it("Should return correct version of the contract", async () => {
      const { voterRewards } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await voterRewards.version()).to.equal("5")
    })

    it("Should not have state conflict after upgrading to V3 and V4", async () => {
      const config = createLocalConfig()
      const {
        otherAccounts,
        otherAccount: voter1,
        owner,
        emissions,
        b3tr,
        timeLock,
        vechainNodesMock,
        nodeManagement,
        vot3,
        treasury,
        x2EarnApps,
        xAllocationPool,
        governorClockLogicLib,
        governorConfiguratorLib,
        governorDepositLogicLib,
        governorFunctionRestrictionsLogicLib,
        governorProposalLogicLib,
        governorQuorumLogicLib,
        governorStateLogicLib,
        governorVotesLogicLib,
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
        veBetterPassport,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 1,
          baseTokenURI: config.GM_NFT_BASE_URI,
          xNodeMaxMintableLevels: [1, 2, 3, 4, 5, 6, 7],
          b3trToUpgradeToLevel: [1000000n],
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMemberV1

      const voterRewardsV1 = (await deployProxy("VoterRewardsV1", [
        owner.address, // admin
        owner.address, // upgrader
        owner.address, // contractsAddressManager
        await emissions.getAddress(),
        await galaxyMemberV1.getAddress(),
        await b3tr.getAddress(),
        levels,
        multipliers,
      ])) as VoterRewardsV1

      // Deploy XAllocationVoting
      const xAllocationVoting = (await deployAndUpgrade(
        ["XAllocationVotingV1", "XAllocationVoting"],
        [
          [
            {
              vot3Token: await vot3.getAddress(),
              quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE, // quorum percentage
              initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1, // X Alloc voting period
              timeLock: await timeLock.getAddress(),
              voterRewards: await voterRewardsV1.getAddress(),
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
          [await veBetterPassport.getAddress()],
        ],
        {
          versions: [undefined, 2],
        },
      )) as XAllocationVoting

      // Deploy Governor
      const governor = (await deployAndUpgrade(
        ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernor"],
        [
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
              voterRewards: await voterRewardsV1.getAddress(),
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
          [await veBetterPassport.getAddress()],
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

      await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())

      // Grant Vote registrar role to XAllocationVoting
      await voterRewardsV1
        .connect(owner)
        .grantRole(await voterRewardsV1.VOTE_REGISTRAR_ROLE(), await xAllocationVoting.getAddress())
      // Grant Vote registrar role to Governor
      await voterRewardsV1
        .connect(owner)
        .grantRole(await voterRewardsV1.VOTE_REGISTRAR_ROLE(), await governor.getAddress())

      // Grant admin role to voter rewards for registering x allocation voting
      await xAllocationVoting
        .connect(owner)
        .grantRole(await xAllocationVoting.DEFAULT_ADMIN_ROLE(), emissions.getAddress())

      // Set xAllocationGovernor in emissions
      await emissions.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await emissions.connect(owner).setVote2EarnAddress(await voterRewardsV1.getAddress())

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

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])
      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      const roundId = await xAllocationVoting.currentRoundId()

      expect(roundId).to.equal(1)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      await xAllocationVoting.connect(voter1).castVote(roundId, [app1], [ethers.parseEther("1000")])
      await xAllocationVoting
        .connect(voter2)
        .castVote(roundId, [app1, app2], [ethers.parseEther("200"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(voter3)
        .castVote(roundId, [app1, app2], [ethers.parseEther("500"), ethers.parseEther("500")])

      expect(await emissions.isCycleEnded(1)).to.equal(false)

      await catchRevert(voterRewardsV1.claimReward(1, voter1.address))

      expect(await voterRewardsV1.cycleToVoterToTotal(1, voter1)).to.equal(ethers.parseEther("31.622776601"))

      expect(await voterRewardsV1.cycleToVoterToTotal(1, voter2)).to.equal(ethers.parseEther("17.320508075"))

      await catchRevert(voterRewardsV1.claimReward(1, voter2.address))

      expect(await voterRewardsV1.cycleToVoterToTotal(1, voter3)).to.equal(ethers.parseEther("31.622776601"))

      // Votes should be tracked correctly
      let appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("1700"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("600"))

      let totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("2300"))

      // Total voters should be tracked correctly
      let totalVoters = await xAllocationVoting.totalVoters(roundId)
      expect(totalVoters).to.eql(BigInt(3))

      // Voter rewards checks
      expect(await voterRewardsV1.cycleToTotal(1)).to.equal(ethers.parseEther("80.566061277")) // Total votes -> Math.sqrt(1000) + Math.sqrt(300) + Math.sqrt(1000)
      expect(await voterRewardsV1.cycleToTotal(1)).to.equal(
        (await voterRewardsV1.cycleToVoterToTotal(1, voter1)) +
          (await voterRewardsV1.cycleToVoterToTotal(1, voter2)) +
          (await voterRewardsV1.cycleToVoterToTotal(1, voter3)),
      ) // Total votes
      let storageSlots = []

      const initialSlot = BigInt("0x114e7ffaaf205d38cd05b17b56f3357806ef2ce889cb4748445ae91cdfc37c00") // Slot 0 of VoterRewards

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlots.push(await ethers.provider.getStorage(await voterRewardsV1.getAddress(), i))
      }

      storageSlots = storageSlots.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      ) // removing empty slots

      const voterRewardsV2 = (await upgradeProxy(
        "VoterRewardsV1",
        "VoterRewardsV2",
        await voterRewardsV1.getAddress(),
        [],
        {
          version: 2,
        },
      )) as VoterRewardsV2

      let storageSlotsAfter = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await voterRewardsV2.getAddress(), i))
      }

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      await waitForRoundToEnd(Number(roundId))

      // Votes should be the same after round ended
      appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("1700"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("600"))

      totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("2300"))

      await waitForNextCycle()

      expect(await emissions.isCycleDistributed(await emissions.nextCycle())).to.equal(false)
      expect(await emissions.isNextCycleDistributable()).to.equal(true)

      // Reward claiming
      expect(await emissions.isCycleDistributed(1)).to.equal(true)
      expect(await b3tr.balanceOf(await voterRewardsV2.getAddress())).to.equal(await emissions.getVote2EarnAmount(1))

      const voter1Rewards = await voterRewardsV2.getReward(1, voter1.address)
      const voter2Rewards = await voterRewardsV2.getReward(1, voter2.address)
      const voter3Rewards = await voterRewardsV2.getReward(1, voter3.address)

      await voterRewardsV2.connect(voter1).claimReward(1, voter1)

      expect(await b3tr.balanceOf(voter1.address)).to.equal(voter1Rewards)

      expect(await b3tr.balanceOf(await voterRewardsV2.getAddress())).to.equal(
        (await emissions.getVote2EarnAmount(1)) - voter1Rewards,
      )

      // Second round
      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      const roundId2 = await xAllocationVoting.currentRoundId()

      expect(roundId2).to.equal(2)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      await xAllocationVoting.connect(voter1).castVote(roundId2, [app2], [ethers.parseEther("1000")])
      await xAllocationVoting
        .connect(voter2)
        .castVote(roundId2, [app1, app2], [ethers.parseEther("100"), ethers.parseEther("500")])
      await xAllocationVoting
        .connect(voter3)
        .castVote(roundId2, [app1, app2], [ethers.parseEther("500"), ethers.parseEther("500")])

      expect(await emissions.isCycleEnded(2)).to.equal(false)

      await catchRevert(voterRewardsV2.claimReward(2, voter1.address))

      expect(await voterRewardsV2.cycleToVoterToTotal(2, voter1)).to.equal(ethers.parseEther("31.622776601"))

      expect(await voterRewardsV2.cycleToVoterToTotal(2, voter2)).to.equal(ethers.parseEther("24.494897427"))

      await catchRevert(voterRewardsV2.claimReward(2, voter2.address))

      expect(await voterRewardsV2.cycleToVoterToTotal(2, voter3)).to.equal(ethers.parseEther("31.622776601"))

      // Votes should be tracked correctly
      appVotes = await xAllocationVoting.getAppVotes(roundId2, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId2, app2)
      expect(appVotes).to.eql(ethers.parseEther("2000"))

      totalVotes = await xAllocationVoting.totalVotes(roundId2)
      expect(totalVotes).to.eql(ethers.parseEther("2600"))

      // Total voters should be tracked correctly
      totalVoters = await xAllocationVoting.totalVoters(roundId2)
      expect(totalVoters).to.eql(BigInt(3))

      // Voter rewards checks
      expect(await voterRewardsV2.cycleToTotal(2)).to.equal(ethers.parseEther("87.740450629")) // Total votes -> Math.sqrt(1000) + Math.sqrt(300) + Math.sqrt(1000)
      expect(await voterRewardsV2.cycleToTotal(2)).to.equal(
        (await voterRewardsV2.cycleToVoterToTotal(2, voter1)) +
          (await voterRewardsV2.cycleToVoterToTotal(2, voter2)) +
          (await voterRewardsV2.cycleToVoterToTotal(2, voter3)),
      ) // Total votes

      await waitForRoundToEnd(Number(roundId2))

      // Votes should be the same after round ended
      appVotes = await xAllocationVoting.getAppVotes(roundId2, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId2, app2)
      expect(appVotes).to.eql(ethers.parseEther("2000"))

      totalVotes = await xAllocationVoting.totalVotes(roundId2)
      expect(totalVotes).to.eql(ethers.parseEther("2600"))

      await waitForNextCycle()

      expect(await emissions.isCycleEnded(2)).to.equal(true)

      expect(await emissions.isCycleDistributed(await emissions.nextCycle())).to.equal(false)
      expect(await emissions.isNextCycleDistributable()).to.equal(true)

      // Reward claiming
      expect(await emissions.isCycleDistributed(2)).to.equal(true)
      expect(await b3tr.balanceOf(await voterRewardsV2.getAddress())).to.gt(await emissions.getVote2EarnAmount(2)) // Voters of round 1 can still claim rewards of round 1 thus the balance of VoterRewards contract should be greater than the emission amount

      const voter1Rewards2 = await voterRewardsV2.getReward(2, voter1.address)
      const voter2Rewards2 = await voterRewardsV2.getReward(2, voter2.address)
      const voter3Rewards2 = await voterRewardsV2.getReward(2, voter3.address)

      await voterRewardsV2.connect(voter1).claimReward(2, voter1)
      await voterRewardsV2.connect(voter2).claimReward(2, voter2)
      await voterRewardsV2.connect(voter3).claimReward(2, voter3)

      expect(await b3tr.balanceOf(voter1.address)).to.equal(voter1Rewards + voter1Rewards2) // Voter 1 claimed also rewards of round 1
      expect(await b3tr.balanceOf(voter2.address)).to.equal(voter2Rewards2)
      expect(await b3tr.balanceOf(voter3.address)).to.equal(voter3Rewards2)

      // Voters of round 1 can still claim rewards of round 1
      await voterRewardsV2.connect(voter2).claimReward(1, voter2)
      await voterRewardsV2.connect(voter3).claimReward(1, voter3)

      expect(await b3tr.balanceOf(voter2.address)).to.equal(voter2Rewards + voter2Rewards2)
      expect(await b3tr.balanceOf(voter3.address)).to.equal(voter3Rewards + voter3Rewards2)

      // Check if storage slots are the same after upgrade
      storageSlots = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlots.push(await ethers.provider.getStorage(await voterRewardsV2.getAddress(), i))
      }

      ;(await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMemberV2",
        await galaxyMemberV1.getAddress(),
        [
          await vechainNodesMock.getAddress(),
          await nodeManagement.getAddress(),
          owner.address,
          config.GM_NFT_NODE_TO_FREE_LEVEL,
        ],
        { version: 2 },
      )) as unknown as GalaxyMemberV2

      const voterRewardsV3 = (await upgradeProxy(
        "VoterRewardsV2",
        "VoterRewardsV3",
        await voterRewardsV1.getAddress(),
        [],
        {
          version: 3,
        },
      )) as VoterRewardsV3

      await waitForNextCycle()

      // start round
      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      const roundId3 = await xAllocationVoting.currentRoundId()

      expect(roundId3).to.equal(3)

      await xAllocationVoting
        .connect(voter1)
        .castVote(roundId3, [app1, app2], [ethers.parseEther("0"), ethers.parseEther("1000")])
      await xAllocationVoting
        .connect(voter2)
        .castVote(roundId3, [app1, app2], [ethers.parseEther("100"), ethers.parseEther("500")])

      await waitForRoundToEnd(Number(roundId3))

      // Check storage slots after upgrade
      storageSlotsAfter = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await voterRewardsV3.getAddress(), i))
      }

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      // Upgrade to V4
      await upgradeProxy("GalaxyMemberV2", "GalaxyMember", await galaxyMemberV1.getAddress(), [], {
        version: 3,
      })

      const voterRewardsV4 = (await upgradeProxy(
        "VoterRewardsV3",
        "VoterRewardsV4",
        await voterRewardsV1.getAddress(),
        [],
        {
          version: 3,
        },
      )) as VoterRewards

      let storageSlotsV4 = []
      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsV4.push(await ethers.provider.getStorage(await voterRewardsV4.getAddress(), i))
      }

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlotsAfter[i]).to.equal(storageSlotsV4[i])
      }

      await waitForNextCycle()

      // start round
      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      const roundId4 = await xAllocationVoting.currentRoundId()

      expect(roundId4).to.equal(4)

      await xAllocationVoting
        .connect(voter1)
        .castVote(roundId4, [app1, app2], [ethers.parseEther("0"), ethers.parseEther("1000")])
      await xAllocationVoting
        .connect(voter2)
        .castVote(roundId4, [app1, app2], [ethers.parseEther("100"), ethers.parseEther("500")])

      // Wait for round to end
      const deadline = await xAllocationVoting.roundDeadline(roundId4)
      const currentBlock = await xAllocationVoting.clock()
      await moveBlocks(parseInt((deadline - currentBlock + BigInt(1)).toString()))

      await expect(voterRewardsV4.connect(voter1).claimReward(4, voter1)).to.emit(voterRewardsV4, "RewardClaimed")
      await expect(voterRewardsV4.connect(voter2).claimReward(4, voter2)).to.emit(voterRewardsV4, "RewardClaimed")
    })

    it("Should not have state conflict after upgrading to V5", async () => {
      const config = createLocalConfig()
      const {
        otherAccounts,
        otherAccount: voter1,
        owner,
        b3tr,
        timeLock,
        nodeManagement,
        vot3,
        treasury,
        x2EarnApps,
        veBetterPassport,
        xAllocationPool,
        governorClockLogicLib,
        governorConfiguratorLib,
        governorDepositLogicLib,
        governorFunctionRestrictionsLogicLib,
        governorProposalLogicLib,
        governorQuorumLogicLib,
        governorStateLogicLib,
        governorVotesLogicLib,
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
        governorClockLogicLibV4,
        governorConfiguratorLibV4,
        governorDepositLogicLibV4,
        governorFunctionRestrictionsLogicLibV4,
        governorProposalLogicLibV4,
        governorQuorumLogicLibV4,
        governorStateLogicLibV4,
        governorVotesLogicLibV4,
        governorClockLogicLibV5,
        governorConfiguratorLibV5,
        governorDepositLogicLibV5,
        governorFunctionRestrictionsLogicLibV5,
        governorQuorumLogicLibV5,
        governorStateLogicLibV5,
        governorVotesLogicLibV5,
        governorProposalLogicLibV5,
        minterAccount,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const galaxyMember = (await deployAndUpgrade(
        ["GalaxyMemberV1", "GalaxyMember"],
        [
          [
            {
              name: "galaxyMember",
              symbol: "GM",
              admin: owner.address,
              upgrader: owner.address,
              pauser: owner.address,
              minter: owner.address,
              contractsAddressManager: owner.address,
              maxLevel: 10,
              baseTokenURI: config.GM_NFT_BASE_URI,
              b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
              b3tr: await b3tr.getAddress(),
              treasury: await treasury.getAddress(),
            },
          ],
          [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
        ],
        { versions: [undefined, 2] },
      )) as unknown as GalaxyMember

      const emissions = (await deployAndUpgrade(
        ["EmissionsV1", "EmissionsV2"],
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
                owner.address,
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
          logOutput: false,
        },
      )) as EmissionsV2

      const voterRewardsV4 = (await deployAndUpgrade(
        ["VoterRewardsV1", "VoterRewardsV2", "VoterRewardsV3", "VoterRewardsV4"],
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
        ],
        {
          versions: [undefined, 2, 3, 4],
        },
      )) as VoterRewardsV4

      await voterRewardsV4.connect(owner).setEmissions(await emissions.getAddress())

      const xAllocationVoting = (await deployAndUpgrade(
        [
          "XAllocationVotingV1",
          "XAllocationVotingV2",
          "XAllocationVotingV3",
          "XAllocationVotingV4",
          "XAllocationVotingV5",
        ],
        [
          [
            {
              vot3Token: await vot3.getAddress(),
              quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE, // quorum percentage
              initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1, // X Alloc voting period
              timeLock: await timeLock.getAddress(),
              voterRewards: await voterRewardsV4.getAddress(),
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
          [await veBetterPassport.getAddress()],
          [],
          [],
          [],
        ],
        {
          versions: [undefined, 2, 3, 4, 5],
          logOutput: false,
        },
      )) as XAllocationVoting

      // Deploy Governor
      const governor = (await deployAndUpgrade(
        ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4", "B3TRGovernorV5"],
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
              voterRewards: await voterRewardsV4.getAddress(),
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
        ],
        {
          versions: [undefined, 2, 3, 4, 5],
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
              GovernorProposalLogicV1: await governorQuorumLogicLibV1.getAddress(),
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
              GovernorClockLogicV4: await governorClockLogicLibV4.getAddress(),
              GovernorConfiguratorV4: await governorConfiguratorLibV4.getAddress(),
              GovernorDepositLogicV4: await governorDepositLogicLibV4.getAddress(),
              GovernorFunctionRestrictionsLogicV4: await governorFunctionRestrictionsLogicLibV4.getAddress(),
              GovernorProposalLogicV4: await governorProposalLogicLibV4.getAddress(),
              GovernorQuorumLogicV4: await governorQuorumLogicLibV4.getAddress(),
              GovernorStateLogicV4: await governorStateLogicLibV4.getAddress(),
              GovernorVotesLogicV4: await governorVotesLogicLibV4.getAddress(),
            },
            {
              GovernorClockLogicV5: await governorClockLogicLibV5.getAddress(),
              GovernorConfiguratorV5: await governorConfiguratorLibV5.getAddress(),
              GovernorDepositLogicV5: await governorDepositLogicLibV5.getAddress(),
              GovernorFunctionRestrictionsLogicV5: await governorFunctionRestrictionsLogicLibV5.getAddress(),
              GovernorQuorumLogicV5: await governorQuorumLogicLibV5.getAddress(),
              GovernorProposalLogicV5: await governorProposalLogicLibV5.getAddress(),
              GovernorStateLogicV5: await governorStateLogicLibV5.getAddress(),
              GovernorVotesLogicV5: await governorVotesLogicLibV5.getAddress(),
            },
          ],
        },
      )) as B3TRGovernorV5

      await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())

      // Grant Vote registrar role to XAllocationVoting
      await voterRewardsV4
        .connect(owner)
        .grantRole(await voterRewardsV4.VOTE_REGISTRAR_ROLE(), await xAllocationVoting.getAddress())
      // Grant Vote registrar role to Governor
      await voterRewardsV4
        .connect(owner)
        .grantRole(await voterRewardsV4.VOTE_REGISTRAR_ROLE(), await governor.getAddress())

      // Grant admin role to voter rewards for registering x allocation voting
      await xAllocationVoting
        .connect(owner)
        .grantRole(await xAllocationVoting.DEFAULT_ADMIN_ROLE(), emissions.getAddress())

      // Set xAllocationGovernor in emissions
      await emissions.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await emissions.connect(owner).setVote2EarnAddress(await voterRewardsV4.getAddress())

      // Setup XAllocationPool addresses
      await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())
      await xAllocationPool.connect(owner).setEmissionsAddress(await emissions.getAddress())

      await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

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

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])
      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      // Bootstrap emissions
      await emissions.connect(minterAccount).bootstrap()

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()

      expect(roundId).to.equal(1)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      // Vote on apps for the first round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId, // First round
        xAllocationVoting,
        veBetterPassport,
      )

      // Rewards to be claimed are the same for all voters:
      expect(await voterRewardsV4.getReward(1, voter1.address)).to.equal(666666666666666666666666n)
      expect(await voterRewardsV4.getReward(1, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewardsV4.getReward(1, voter3.address)).to.equal(666666666666666666666666n)

      await waitForRoundToEnd(Number(roundId), xAllocationVoting)

      await waitForNextCycle(emissions)

      // Claim rewards events should match V1
      expect(await voterRewardsV4.connect(voter1).claimReward(1, voter1.address))
        .to.emit(voterRewardsV4, "RewardClaimed")
        .withArgs(1, voter1.address, 666666666666666666666666n)
      expect(await voterRewardsV4.connect(voter2).claimReward(1, voter2.address))
        .to.emit(voterRewardsV4, "RewardClaimed")
        .withArgs(1, voter2.address, 666666666666666666666666n)
      expect(await voterRewardsV4.connect(voter3).claimReward(1, voter3.address))
        .to.emit(voterRewardsV4, "RewardClaimed")
        .withArgs(1, voter3.address, 666666666666666666666666n)

      // GM NFT token mint and upgrade
      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter1.address))).to.equal(5)

      await galaxyMember.connect(voter2).freeMint()

      await upgradeNFTtoLevel(2, 10, galaxyMember, b3tr, voter2, minterAccount) // Upgrading to level 10

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter2.address))).to.equal(10)

      await galaxyMember.connect(voter3).freeMint()

      await upgradeNFTtoLevel(3, 2, galaxyMember, b3tr, voter3, minterAccount) // Upgrading to level 2

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter3.address))).to.equal(2)

      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      const roundId2 = await xAllocationVoting.currentRoundId()

      expect(roundId2).to.equal(2)

      expect(await xAllocationVoting.roundDeadline(roundId2)).to.lt(await emissions.getNextCycleBlock())

      await waitForNextBlock()

      let storageSlots = []

      const initialSlot = BigInt("0x114e7ffaaf205d38cd05b17b56f3357806ef2ce889cb4748445ae91cdfc37c00") // Slot 0 of VoterRewards

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlots.push(await ethers.provider.getStorage(await voterRewardsV4.getAddress(), i))
      }

      storageSlots = storageSlots.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      ) // removing empty slots

      // Upgrade Emissions and Voter Rewards to support GM Pool
      const emissionsLatest = (await upgradeProxy(
        "EmissionsV2",
        "Emissions",
        await emissions.getAddress(),
        [config.GM_PERCENTAGE_OF_TREASURY],
        {
          version: 3,
        },
      )) as unknown as Emissions

      const voterRewardsLatest = (await upgradeProxy(
        "VoterRewardsV4",
        "VoterRewards",
        await voterRewardsV4.getAddress(),
        [config.VOTER_REWARDS_LEVELS_V2, config.GM_MULTIPLIERS_V2],
        {
          version: 5,
        },
      )) as unknown as VoterRewards

      // Upgrade contracts that use interfaces
      await upgradeProxy("XAllocationVotingV5", "XAllocationVoting", await xAllocationVoting.getAddress(), [], {
        version: 6,
      })

      await upgradeProxy("XAllocationPoolV5", "XAllocationPool", await xAllocationPool.getAddress(), [], {
        version: 6,
      })

      await upgradeProxy("B3TRGovernorV5", "B3TRGovernor", await governor.getAddress(), [], {
        version: 6,
        libraries: {
          GovernorClockLogic: await governorClockLogicLib.getAddress(),
          GovernorConfigurator: await governorConfiguratorLib.getAddress(),
          GovernorDepositLogic: await governorDepositLogicLib.getAddress(),
          GovernorFunctionRestrictionsLogic: await governorFunctionRestrictionsLogicLib.getAddress(),
          GovernorProposalLogic: await governorProposalLogicLib.getAddress(),
          GovernorQuorumLogic: await governorQuorumLogicLib.getAddress(),
          GovernorStateLogic: await governorStateLogicLib.getAddress(),
          GovernorVotesLogic: await governorVotesLogicLib.getAddress(),
        },
      })

      let storageSlotsAfter = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await voterRewardsLatest.getAddress(), i))
      }

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      expect(await voterRewardsLatest.version()).to.equal("5")

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId2, // Second round
        xAllocationVoting,
        veBetterPassport,
      )

      //------ Should still be using original GM reward formula for the round when upgrade happens ------//

      /*
          voter 1 = 31.62 reward weighted votes * 100% multiplier = 63.24 reward weighted power
          voter 2 = 31.62 reward weighted votes * 25x multiplier = 790.57 reward weighted power
          voter 3 = 31.62 reward weighted votes * 10% multiplier = 34.78 reward weighted power
  
          Total power = 888.60
          voter 1 allocation = 63.24 / 888.60 * 100 = 7.11%
          voter 2 allocation = 790.57 / 888.60 * 100 = 88.96%
          voter 3 allocation = 34.78 / 888.60 * 100 = 3.91%
        */
      expect(await voterRewardsLatest.cycleToTotal(2)).to.equal(ethers.parseEther("888.6000224881")) // Total reward weighted votes
      expect(await voterRewardsLatest.cycleToVoterToTotal(2, voter1)).to.equal(ethers.parseEther("63.245553202")) // Voter 1 reward weighted votes
      expect(await voterRewardsLatest.cycleToVoterToTotal(2, voter2)).to.equal(ethers.parseEther("790.569415025")) // Voter 2 reward weighted votes
      expect(await voterRewardsLatest.cycleToVoterToTotal(2, voter3)).to.equal(ethers.parseEther("34.7850542611")) // Voter 3 reward weighted votes

      /*
          voter 1 = 31.62 reward weighted votes * 100% multiplier = 63.24 reward weighted power
          voter 2 = 31.62 reward weighted votes * 25x multiplier = 790.57 reward weighted power
          voter 3 = 31.62 reward weighted votes * 10% multiplier = 34.78 reward weighted power
  
          Total power = 888.60
          voter 1 allocation = 63.24 / 888.60 * 100 = 7.11%
          voter 2 allocation = 790.57 / 888.60 * 100 = 88.96%
          voter 3 allocation = 34.78 / 888.60 * 100 = 3.91%
        */
      expect(await voterRewardsLatest.getReward(2, voter1.address)).to.equal(142348754448398576512455n) // 7.11%
      expect(await voterRewardsLatest.getReward(2, voter2.address)).to.equal(1779359430604982206405693n) // 88.96%
      expect(await voterRewardsLatest.getReward(2, voter3.address)).to.equal(78291814946619217081850n) // 3.91%

      // Get GM rewards should be 0
      expect(await voterRewardsLatest.getGMReward(2, voter1.address)).to.equal(0n)
      expect(await voterRewardsLatest.getGMReward(2, voter2.address)).to.equal(0n)
      expect(await voterRewardsLatest.getGMReward(2, voter3.address)).to.equal(0n)

      // GM pool is 0 for round 2
      expect(await emissionsLatest.getGMAmount(2)).to.equal(0n)

      // wait for next cycle
      await waitForNextCycle(emissionsLatest)

      // Distribute emissions
      await emissionsLatest.connect(minterAccount).distribute()

      // GM pool should have 25% of the treasury
      expect(await emissionsLatest.getGMAmount(3)).to.equal(ethers.parseEther("250000"))

      // Claim rewards for last round
      await expect(voterRewardsLatest.connect(voter1).claimReward(2, voter1.address))
        .to.emit(voterRewardsLatest, "RewardClaimedV2")
        .withArgs(2, voter1.address, 142348754448398576512455n, 0n)
      await expect(voterRewardsLatest.connect(voter2).claimReward(2, voter2.address))
        .to.emit(voterRewardsLatest, "RewardClaimedV2")
        .withArgs(2, voter2.address, 1779359430604982206405693n, 0n)
      await expect(voterRewardsLatest.connect(voter3).claimReward(2, voter3.address))
        .to.emit(voterRewardsLatest, "RewardClaimedV2")
        .withArgs(2, voter3.address, 78291814946619217081850n, 0n)

      const roundId3 = await xAllocationVoting.currentRoundId()

      // Vote on apps for the third round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId3, // Third round
        xAllocationVoting,
        veBetterPassport,
      )

      // Total votes will no longer be effected by GM as that comes from standalone pool
      expect(await voterRewardsLatest.cycleToTotal(3)).to.equal(ethers.parseEther("94.868329803")) // Total weighted votes (31.62 * 3)
      expect(await voterRewardsLatest.cycleToVoterToTotal(3, voter1)).to.equal(ethers.parseEther("31.622776601")) // Voter 1 weighted vote
      expect(await voterRewardsLatest.cycleToVoterToTotal(3, voter2)).to.equal(ethers.parseEther("31.622776601")) // Voter 2 weighted vote
      expect(await voterRewardsLatest.cycleToVoterToTotal(3, voter3)).to.equal(ethers.parseEther("31.622776601")) // Voter 3 weighted vote

      // Total GM weight should be 2810
      /**
       *  voter 1 has level 5 GM NFT -> 2x multiplier (200)
       *  voter 2 has level 10 GM NFT -> 25x multiplier (2500)
       *  voter 3 has level 2 GM NFT -> 1.1x multiplier (110)
       *
       *  total = 200 + 2500 + 110 = 2810
       */
      expect(await voterRewardsLatest.cycleToTotalGMWeight(3)).to.equal(2810n)
      expect(await voterRewardsLatest.cycleToVoterToGMWeight(3, voter1)).to.equal(200n)
      expect(await voterRewardsLatest.cycleToVoterToGMWeight(3, voter2)).to.equal(2500n)
      expect(await voterRewardsLatest.cycleToVoterToGMWeight(3, voter3)).to.equal(110n)

      /**
       * There is 250000 in the GM pool for round 3
       *
       *  Rewards distribution should be:
       *  voter 1 = 200 / 2810 * 250000 = 17793.59 B3TR
       *  voter 2 = 2500 / 2810 * 250000 = 222419.92 B3TR
       *  voter 3 = 110 / 2810 * 250000 = 9786.45 B3TR
       */
      expect(await voterRewardsLatest.getGMReward(3, voter1.address)).to.equal(
        ethers.parseEther("17793.594306049822064056"),
      )
      expect(await voterRewardsLatest.getGMReward(3, voter2.address)).to.equal(
        ethers.parseEther("222419.928825622775800711"),
      )
      expect(await voterRewardsLatest.getGMReward(3, voter3.address)).to.equal(
        ethers.parseEther("9786.476868327402135231"),
      )

      /**
       *
       * There is 2000000 in the generic pool for round 3
       *
       *  Rewards distribution should no longer be affected by GM as that comes from standalone pool
       *
       *  Cycle to total = 94.868329803
       *  voter 1 = 31.62 / 94.868329803 * 2000000 = 666666.66 B3TR
       *  voter 2 = 31.62 / 94.868329803 * 2000000 = 666666.66 B3TR
       *  voter 3 = 31.62 / 94.868329803 * 2000000 = 666666.66 B3TR
       */
      expect(await voterRewardsLatest.cycleToTotal(3)).to.equal(ethers.parseEther("94.868329803")) // Total weighted votes (31.62 * 3)
      expect(await voterRewardsLatest.cycleToVoterToTotal(3, voter1)).to.equal(ethers.parseEther("31.622776601")) // Voter 1 weighted vote
      expect(await voterRewardsLatest.cycleToVoterToTotal(3, voter2)).to.equal(ethers.parseEther("31.622776601")) // Voter 2 weighted vote
      expect(await voterRewardsLatest.cycleToVoterToTotal(3, voter3)).to.equal(ethers.parseEther("31.622776601")) // Voter 3 weighted vote

      // Wait for next cycle
      await waitForNextCycle(emissionsLatest)

      // Distribute emissions
      await emissionsLatest.connect(minterAccount).distribute()

      // Claim rewards for last round
      await expect(voterRewardsLatest.connect(voter1).claimReward(3, voter1.address))
        .to.emit(voterRewardsLatest, "RewardClaimedV2")
        .withArgs(3, voter1.address, 666666666666666666666666n, 17793594306049822064056n)
      await expect(voterRewardsLatest.connect(voter2).claimReward(3, voter2.address))
        .to.emit(voterRewardsLatest, "RewardClaimedV2")
        .withArgs(3, voter2.address, 666666666666666666666666n, 222419928825622775800711n)
      await expect(voterRewardsLatest.connect(voter3).claimReward(3, voter3.address))
        .to.emit(voterRewardsLatest, "RewardClaimedV2")
        .withArgs(3, voter3.address, 666666666666666666666666n, 9786476868327402135231n)

      // Can update GM multipliers, but it wont take effect until next cycle
      await voterRewardsLatest.setLevelToMultiplier(2, 1000)
      await voterRewardsLatest.setLevelToMultiplier(5, 2000)

      // Multiplier is set to latest update to level
      await expect(voterRewardsLatest.setLevelToMultiplier(2, 50))
        .to.emit(voterRewardsLatest, "LevelToMultiplierPending")
        .withArgs(2, 50)

      const roundId4 = await xAllocationVoting.currentRoundId()
      // Vote on apps for the fourth round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId4, // Fourth round
        xAllocationVoting,
        veBetterPassport,
      )

      // cycle to GM total should be same as before
      expect(await voterRewardsLatest.cycleToTotalGMWeight(4)).to.equal(2810n)
      expect(await voterRewardsLatest.cycleToVoterToGMWeight(4, voter1)).to.equal(200n)
      expect(await voterRewardsLatest.cycleToVoterToGMWeight(4, voter2)).to.equal(2500n)
      expect(await voterRewardsLatest.cycleToVoterToGMWeight(4, voter3)).to.equal(110n)

      await waitForNextCycle(emissionsLatest)
      await emissionsLatest.connect(minterAccount).distribute()

      // GM Multiplier should be updated as of this cycle
      const roundId5 = await xAllocationVoting.currentRoundId()

      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId5, // Fifth round
        xAllocationVoting,
        veBetterPassport,
      )

      expect(await voterRewardsLatest.cycleToVoterToGMWeight(5, voter1)).to.equal(2000n)
      expect(await voterRewardsLatest.cycleToVoterToGMWeight(5, voter2)).to.equal(2500n)
      expect(await voterRewardsLatest.cycleToVoterToGMWeight(5, voter3)).to.equal(50n)
    })
  })

  describe("X Allocation voting rewards", () => {
    it("Should track voting rewards correctly involving multiple voters", async () => {
      const config = createLocalConfig()
      const {
        xAllocationVoting,
        otherAccounts,
        otherAccount,
        xAllocationPool,
        owner,
        voterRewards,
        emissions,
        b3tr,
        minterAccount,
        x2EarnApps,
        veBetterPassport,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])
      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await veBetterPassport.whitelist(otherAccount.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(otherAccount, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      // Bootstrap emissions
      await bootstrapEmissions()

      let tx = await emissions.connect(minterAccount).start()

      let receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      let events = receipt?.logs

      let decodedEvents = events?.map(event => {
        return xAllocationVoting.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      const proposalEvent = decodedEvents.find(event => event?.name === "RoundCreated")

      expect(proposalEvent).to.not.equal(undefined)

      expect(await emissions.getCurrentCycle()).to.equal(1)

      expect(await b3tr.balanceOf(await xAllocationPool.getAddress())).to.equal(config.INITIAL_X_ALLOCATION)

      expect(await emissions.nextCycle()).to.equal(2)

      await waitForNextCycle()
      await emissions.connect(minterAccount).distribute()

      const roundId = await xAllocationVoting.currentRoundId()

      expect(roundId).to.equal(2)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      tx = await xAllocationVoting
        .connect(otherAccount)
        .castVote(roundId, [app1, app2], [ethers.parseEther("300"), ethers.parseEther("200")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      events = receipt?.logs

      decodedEvents = events?.map(event => {
        return voterRewards.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents[0]?.args?.[0]).to.equal(2) // Cycle
      expect(decodedEvents[0]?.args?.[1]).to.equal(otherAccount.address) // Voter
      expect(decodedEvents[0]?.args?.[2]).to.equal(ethers.parseEther("500")) // Votes
      expect(decodedEvents[0]?.args?.[3]).to.equal(ethers.parseEther("22.360679774")) // Reward weight

      expect(await emissions.isCycleEnded(roundId)).to.equal(false)

      await catchRevert(voterRewards.claimReward(roundId, otherAccount.address)) // Should not be able to claim rewards before cycle ended

      expect(await voterRewards.cycleToVoterToTotal(roundId, otherAccount)).to.equal(ethers.parseEther("22.360679774")) // I'm expecting 22.36 because I voted 300 for app1 and 200 for app2 at the first cycle which is 500 and the square root of 500 is 22.36

      tx = await xAllocationVoting
        .connect(voter2)
        .castVote(roundId, [app1, app2], [ethers.parseEther("200"), ethers.parseEther("100")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      expect(await voterRewards.cycleToVoterToTotal(roundId, voter2)).to.equal(ethers.parseEther("17.320508075")) // I'm expecting 17.32 because I voted 200 for app1 and 100 for app2 at the first cycle which is 300 and the square root of 300 is 17.32

      await catchRevert(voterRewards.claimReward(roundId, voter2.address)) // Should not be able to claim rewards before cycle ended

      tx = await xAllocationVoting
        .connect(voter3)
        .castVote(roundId, [app1, app2], [ethers.parseEther("100"), ethers.parseEther("500")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      expect(await voterRewards.cycleToVoterToTotal(roundId, voter3)).to.equal(ethers.parseEther("24.494897427")) // I'm expecting 24.49 because I voted 100 for app1 and 500 for app2 at the first cycle which is 600 and the square root of 600 is 24.49

      // Votes should be tracked correctly
      let appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("800"))

      let totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("1400"))

      // Total voters should be tracked correctly
      const totalVoters = await xAllocationVoting.totalVoters(roundId)
      expect(totalVoters).to.eql(BigInt(3))

      // Voter rewards checks
      expect(await voterRewards.cycleToTotal(roundId)).to.equal(ethers.parseEther("64.176085276")) // Total votes -> Math.sqrt(500) + Math.sqrt(300) + Math.sqrt(600)
      expect(await voterRewards.cycleToTotal(roundId)).to.equal(
        (await voterRewards.cycleToVoterToTotal(roundId, otherAccount)) +
          (await voterRewards.cycleToVoterToTotal(roundId, voter2)) +
          (await voterRewards.cycleToVoterToTotal(roundId, voter3)),
      ) // Total votes

      await waitForRoundToEnd(Number(roundId))

      // Votes should be the same after round ended
      appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("800"))

      totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("1400"))

      await waitForNextCycle()

      expect(await emissions.isCycleDistributed(await emissions.nextCycle())).to.equal(false)
      expect(await emissions.isNextCycleDistributable()).to.equal(true)

      // Reward claiming
      expect(await emissions.isCycleDistributed(1)).to.equal(true)
      expect(await b3tr.balanceOf(await voterRewards.getAddress())).to.equal(
        (await emissions.getVote2EarnAmount(1)) +
          (await emissions.getVote2EarnAmount(2)) +
          (await emissions.getGMAmount(2)),
      )

      const voter1Rewards = await voterRewards.getReward(roundId, otherAccount.address)
      const voter2Rewards = await voterRewards.getReward(roundId, voter2.address)
      const voter3Rewards = await voterRewards.getReward(roundId, voter3.address)

      tx = await voterRewards.connect(otherAccount).claimReward(roundId, otherAccount.address)
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      expect(await b3tr.balanceOf(otherAccount.address)).to.equal(voter1Rewards)

      events = receipt?.logs

      decodedEvents = events?.map(event => {
        return voterRewards.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      const rewardClaimedEvent = decodedEvents.find(event => event?.name === "RewardClaimedV2")

      expect(rewardClaimedEvent?.args?.[0]).to.equal(roundId) // Cycle
      expect(rewardClaimedEvent?.args?.[1]).to.equal(otherAccount.address) // Voter
      expect(rewardClaimedEvent?.args?.[2]).to.equal(696853966016598011228309n) // Reward

      await voterRewards.connect(voter2).claimReward(roundId, voter2.address)
      await voterRewards.connect(voter3).claimReward(roundId, voter3.address)

      await expect(voterRewards.connect(voter2).claimReward(1, ZERO_ADDRESS)).to.be.reverted // Should not be able to claim rewards for zero address

      expect(await b3tr.balanceOf(voter2.address)).to.equal(voter2Rewards)
      expect(await b3tr.balanceOf(voter3.address)).to.equal(voter3Rewards)

      expect(await b3tr.balanceOf(await voterRewards.getAddress())).to.lt(ethers.parseEther("22500001")) // Round 1 + GM pool round 2
    })

    it("Should track voting rewards correctly involving multiple voters when Quadratic Rewarding is disabled", async () => {
      const config = createLocalConfig()
      const {
        xAllocationVoting,
        otherAccounts,
        otherAccount,
        xAllocationPool,
        owner,
        voterRewards,
        emissions,
        b3tr,
        minterAccount,
        x2EarnApps,
        veBetterPassport,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await voterRewards.connect(owner).toggleQuadraticRewarding()
      expect(await voterRewards.isQuadraticRewardingDisabledAtBlock(await ethers.provider.getBlockNumber())).to.eql(
        true,
      )

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])
      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await veBetterPassport.whitelist(otherAccount.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(otherAccount, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      // Bootstrap emissions
      await bootstrapEmissions()

      let tx = await emissions.connect(minterAccount).start()

      let receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      let events = receipt?.logs

      let decodedEvents = events?.map(event => {
        return xAllocationVoting.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      const proposalEvent = decodedEvents.find(event => event?.name === "RoundCreated")

      expect(proposalEvent).to.not.equal(undefined)

      expect(await emissions.getCurrentCycle()).to.equal(1)

      expect(await b3tr.balanceOf(await xAllocationPool.getAddress())).to.equal(config.INITIAL_X_ALLOCATION)

      expect(await emissions.nextCycle()).to.equal(2)

      const roundId = await xAllocationVoting.currentRoundId()

      expect(roundId).to.equal(1)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      tx = await xAllocationVoting
        .connect(otherAccount)
        .castVote(roundId, [app1, app2], [ethers.parseEther("300"), ethers.parseEther("200")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      events = receipt?.logs

      decodedEvents = events?.map(event => {
        return voterRewards.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents[0]?.args?.[0]).to.equal(1) // Cycle
      expect(decodedEvents[0]?.args?.[1]).to.equal(otherAccount.address) // Voter
      expect(decodedEvents[0]?.args?.[2]).to.equal(ethers.parseEther("500")) // Votes
      expect(decodedEvents[0]?.args?.[3]).to.equal(ethers.parseEther("500")) // Reward weight

      expect(await emissions.isCycleEnded(1)).to.equal(false)

      await catchRevert(voterRewards.claimReward(1, otherAccount.address)) // Should not be able to claim rewards before cycle ended

      expect(await voterRewards.cycleToVoterToTotal(1, otherAccount)).to.equal(ethers.parseEther("500")) // I'm expecting 500 because I voted 300 for app1 and 200 for app2 at the first cycle which is 500

      tx = await xAllocationVoting
        .connect(voter2)
        .castVote(roundId, [app1, app2], [ethers.parseEther("200"), ethers.parseEther("100")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      expect(await voterRewards.cycleToVoterToTotal(1, voter2)).to.equal(ethers.parseEther("300")) // I'm expecting 300 because I voted 200 for app1 and 100 for app2 at the first cycle which is 300

      await catchRevert(voterRewards.claimReward(1, voter2.address)) // Should not be able to claim rewards before cycle ended

      tx = await xAllocationVoting
        .connect(voter3)
        .castVote(roundId, [app1, app2], [ethers.parseEther("100"), ethers.parseEther("500")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      expect(await voterRewards.cycleToVoterToTotal(1, voter3)).to.equal(ethers.parseEther("600")) // I'm expecting 600 because I voted 100 for app1 and 500 for app2 at the first cycle which is 600

      // Votes should be tracked correctly
      let appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("800"))

      let totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("1400"))

      // Total voters should be tracked correctly
      const totalVoters = await xAllocationVoting.totalVoters(roundId)
      expect(totalVoters).to.eql(BigInt(3))

      // Voter rewards checks
      expect(await voterRewards.cycleToTotal(1)).to.equal(ethers.parseEther("1400")) // Total votes
      expect(await voterRewards.cycleToTotal(1)).to.equal(
        (await voterRewards.cycleToVoterToTotal(1, otherAccount)) +
          (await voterRewards.cycleToVoterToTotal(1, voter2)) +
          (await voterRewards.cycleToVoterToTotal(1, voter3)),
      ) // Total votes

      await waitForRoundToEnd(Number(roundId))

      // Votes should be the same after round ended
      appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("800"))

      totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("1400"))

      await waitForNextCycle()

      expect(await emissions.isCycleDistributed(await emissions.nextCycle())).to.equal(false)
      expect(await emissions.isNextCycleDistributable()).to.equal(true)

      // Reward claiming
      expect(await emissions.isCycleDistributed(1)).to.equal(true)
      expect(await b3tr.balanceOf(await voterRewards.getAddress())).to.equal(await emissions.getVote2EarnAmount(1))

      const voter1Rewards = await voterRewards.getReward(1, otherAccount.address)
      const voter2Rewards = await voterRewards.getReward(1, voter2.address)
      const voter3Rewards = await voterRewards.getReward(1, voter3.address)

      tx = await voterRewards.connect(otherAccount).claimReward(1, otherAccount)
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      expect(await b3tr.balanceOf(otherAccount.address)).to.equal(voter1Rewards)

      events = receipt?.logs

      decodedEvents = events?.map(event => {
        return voterRewards.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      const rewardClaimedEvent = decodedEvents.find(event => event?.name === "RewardClaimedV2")

      expect(rewardClaimedEvent?.args?.[0]).to.equal(1) // Cycle
      expect(rewardClaimedEvent?.args?.[1]).to.equal(otherAccount.address) // Voter
      expect(rewardClaimedEvent?.args?.[2]).to.equal(714285714285714285714285n) // Reward

      await voterRewards.connect(voter2).claimReward(1, voter2.address)
      await voterRewards.connect(voter3).claimReward(1, voter3.address)

      await expect(voterRewards.connect(voter2).claimReward(1, ZERO_ADDRESS)).to.be.reverted // Should not be able to claim rewards for zero address

      expect(await b3tr.balanceOf(voter2.address)).to.equal(voter2Rewards)
      expect(await b3tr.balanceOf(voter3.address)).to.equal(voter3Rewards)

      expect(await b3tr.balanceOf(await voterRewards.getAddress())).to.lt(ethers.parseEther("1"))
    })

    it("Should track voting rewards correctly involving multiple voters and multiple rounds", async () => {
      const {
        xAllocationVoting,
        otherAccounts,
        otherAccount: voter1,
        owner,
        voterRewards,
        emissions,
        b3tr,
        minterAccount,
        x2EarnApps,
        veBetterPassport,
        vechainNodesMock,
        nodeManagement,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])

      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()

      const isdisabled = await voterRewards.isQuadraticRewardingDisabledForCurrentCycle()
      expect(isdisabled).to.equal(false)

      expect(roundId).to.equal(1)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      // Vote on apps for the first round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("200"), ethers.parseEther("100")], // Voter 2 votes 200 for app1 and 100 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId, // First round
      )

      expect(await emissions.isCycleEnded(1)).to.equal(false)

      await catchRevert(voterRewards.claimReward(1, voter1.address))

      expect(await voterRewards.cycleToVoterToTotal(1, voter1)).to.equal(ethers.parseEther("31.622776601"))

      expect(await voterRewards.cycleToVoterToTotal(1, voter2)).to.equal(ethers.parseEther("17.320508075"))

      await catchRevert(voterRewards.claimReward(1, voter2.address))

      expect(await voterRewards.cycleToVoterToTotal(1, voter3)).to.equal(ethers.parseEther("31.622776601"))

      // Votes should be tracked correctly
      let appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("1700"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("600"))

      let totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("2300"))

      // Total voters should be tracked correctly
      let totalVoters = await xAllocationVoting.totalVoters(roundId)
      expect(totalVoters).to.eql(BigInt(3))

      // Voter rewards checks
      expect(await voterRewards.cycleToTotal(1)).to.equal(ethers.parseEther("80.566061277")) // Total votes -> Math.sqrt(1000) + Math.sqrt(300) + Math.sqrt(1000)
      expect(await voterRewards.cycleToTotal(1)).to.equal(
        (await voterRewards.cycleToVoterToTotal(1, voter1)) +
          (await voterRewards.cycleToVoterToTotal(1, voter2)) +
          (await voterRewards.cycleToVoterToTotal(1, voter3)),
      ) // Total votes

      await waitForRoundToEnd(Number(roundId))

      // Votes should be the same after round ended
      appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("1700"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("600"))

      totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("2300"))

      await waitForNextCycle()

      expect(await emissions.isCycleDistributed(await emissions.nextCycle())).to.equal(false)
      expect(await emissions.isNextCycleDistributable()).to.equal(true)

      // Reward claiming
      expect(await emissions.isCycleDistributed(1)).to.equal(true)
      expect(await b3tr.balanceOf(await voterRewards.getAddress())).to.equal(await emissions.getVote2EarnAmount(1))

      const voter1Rewards = await voterRewards.getReward(1, voter1.address)
      const voter2Rewards = await voterRewards.getReward(1, voter2.address)
      const voter3Rewards = await voterRewards.getReward(1, voter3.address)

      await voterRewards.connect(voter1).claimReward(1, voter1)

      expect(await b3tr.balanceOf(voter1.address)).to.equal(voter1Rewards)

      expect(await b3tr.balanceOf(await voterRewards.getAddress())).to.equal(
        (await emissions.getVote2EarnAmount(1)) - voter1Rewards,
      )

      // Second round
      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      const roundId2 = await xAllocationVoting.currentRoundId()

      expect(roundId2).to.equal(2)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
          [ethers.parseEther("100"), ethers.parseEther("500")], // Voter 2 votes 100 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId2, // Second round
      )

      expect(await emissions.isCycleEnded(2)).to.equal(false)

      await catchRevert(voterRewards.claimReward(2, voter1.address))

      expect(await voterRewards.cycleToVoterToTotal(2, voter1)).to.equal(ethers.parseEther("31.622776601"))

      expect(await voterRewards.cycleToVoterToTotal(2, voter2)).to.equal(ethers.parseEther("24.494897427"))

      await catchRevert(voterRewards.claimReward(2, voter2.address))

      expect(await voterRewards.cycleToVoterToTotal(2, voter3)).to.equal(ethers.parseEther("31.622776601"))

      // Votes should be tracked correctly
      appVotes = await xAllocationVoting.getAppVotes(roundId2, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId2, app2)
      expect(appVotes).to.eql(ethers.parseEther("2000"))

      totalVotes = await xAllocationVoting.totalVotes(roundId2)
      expect(totalVotes).to.eql(ethers.parseEther("2600"))

      // Total voters should be tracked correctly
      totalVoters = await xAllocationVoting.totalVoters(roundId2)
      expect(totalVoters).to.eql(BigInt(3))

      // Voter rewards checks
      expect(await voterRewards.cycleToTotal(2)).to.equal(ethers.parseEther("87.740450629")) // Total votes -> Math.sqrt(1000) + Math.sqrt(300) + Math.sqrt(1000)
      expect(await voterRewards.cycleToTotal(2)).to.equal(
        (await voterRewards.cycleToVoterToTotal(2, voter1)) +
          (await voterRewards.cycleToVoterToTotal(2, voter2)) +
          (await voterRewards.cycleToVoterToTotal(2, voter3)),
      ) // Total votes

      await waitForRoundToEnd(Number(roundId2))

      // Votes should be the same after round ended
      appVotes = await xAllocationVoting.getAppVotes(roundId2, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId2, app2)
      expect(appVotes).to.eql(ethers.parseEther("2000"))

      totalVotes = await xAllocationVoting.totalVotes(roundId2)
      expect(totalVotes).to.eql(ethers.parseEther("2600"))

      await waitForNextCycle()

      expect(await emissions.isCycleEnded(2)).to.equal(true)

      expect(await emissions.isCycleDistributed(await emissions.nextCycle())).to.equal(false)
      expect(await emissions.isNextCycleDistributable()).to.equal(true)

      // Reward claiming
      expect(await emissions.isCycleDistributed(2)).to.equal(true)
      expect(await b3tr.balanceOf(await voterRewards.getAddress())).to.gt(await emissions.getVote2EarnAmount(2)) // Voters of round 1 can still claim rewards of round 1 thus the balance of VoterRewards contract should be greater than the emission amount

      const voter1Rewards2 = await voterRewards.getReward(2, voter1.address)
      const voter2Rewards2 = await voterRewards.getReward(2, voter2.address)
      const voter3Rewards2 = await voterRewards.getReward(2, voter3.address)

      await voterRewards.connect(voter1).claimReward(2, voter1)
      await voterRewards.connect(voter2).claimReward(2, voter2)
      await voterRewards.connect(voter3).claimReward(2, voter3)

      expect(await b3tr.balanceOf(voter1.address)).to.equal(voter1Rewards + voter1Rewards2) // Voter 1 claimed also rewards of round 1
      expect(await b3tr.balanceOf(voter2.address)).to.equal(voter2Rewards2)
      expect(await b3tr.balanceOf(voter3.address)).to.equal(voter3Rewards2)

      // Voters of round 1 can still claim rewards of round 1
      await voterRewards.connect(voter2).claimReward(1, voter2)
      await voterRewards.connect(voter3).claimReward(1, voter3)

      expect(await b3tr.balanceOf(voter2.address)).to.equal(voter2Rewards + voter2Rewards2)
      expect(await b3tr.balanceOf(voter3.address)).to.equal(voter3Rewards + voter3Rewards2)
    })

    it("Should increase GM voting rewards for user's with higher token levels", async () => {
      const config = createTestConfig()
      const {
        xAllocationVoting,
        otherAccounts,
        otherAccount: voter1,
        owner,
        voterRewards,
        emissions,
        b3tr,
        minterAccount,
        governor,
        treasury,
        veBetterPassport,
        x2EarnApps,
        nodeManagement,
        vechainNodesMock,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 10,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [
          await vechainNodesMock.getAddress(),
          await nodeManagement.getAddress(),
          owner.address,
          config.GM_NFT_NODE_TO_FREE_LEVEL,
        ],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])
      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()

      expect(roundId).to.equal(1)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      // Vote on apps for the first round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId, // First round
      )

      // Rewards to be claimed are the same for all voters:
      expect(await voterRewards.getReward(1, voter1.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(1, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(1, voter3.address)).to.equal(666666666666666666666666n)

      await waitForRoundToEnd(Number(roundId))

      await waitForNextCycle()

      // GM NFT token mint and upgrade
      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5 -> Rewards multiplier is 2x

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter1.address))).to.equal(5)

      // Second round
      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      await waitForNextBlock()

      const roundId2 = await xAllocationVoting.currentRoundId()

      expect(roundId2).to.equal(2)

      expect(await xAllocationVoting.roundDeadline(roundId2)).to.lt(await emissions.getNextCycleBlock())

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId2, // Second round
      )

      // Rewards to be claimed from generic pool are now STILL the same for all voters event though voter1 has a higher level NFT:

      /*
       The rewards are calculated as follows:
      - Generic pool rewards: 2000000
      - Voter 1 generic rewards = 2000000/3 = 666666666666666666666666n
      - Voter 2 generic rewards = 2000000/3 = 666666666666666666666666n
      - Voter 3 generic rewards = 2000000/3 = 666666666666666666666666n
      */
      expect(await voterRewards.getReward(2, voter1.address)).to.equal(666666666666666666666666n) // Double voting rewards multiplier so it's like he voted 2000 (out of 4000 total votes) => 50% of the rewards
      expect(await voterRewards.getReward(2, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(2, voter3.address)).to.equal(666666666666666666666666n)

      // GM pool rewards should be 250000
      expect(await emissions.getGMAmount(2)).to.equal(250000000000000000000000n)

      // cycle to total GM should be 100 (Using original multipliers here) as only voter1 has a GM NFT
      expect(await voterRewards.cycleToTotalGMWeight(2)).to.equal(100n)
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter1.address)).to.equal(100n)

      // Expect only voter 1 to get rewards from GM pool
      expect(await voterRewards.getGMReward(2, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(2, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(2, voter3.address)).to.equal(0n)
    })

    it("Should change GM voting rewards if user upgrades after x allocation round snapshot", async () => {
      const config = createTestConfig()
      const {
        xAllocationVoting,
        otherAccounts,
        otherAccount: voter1,
        owner,
        voterRewards,
        emissions,
        b3tr,
        minterAccount,
        governor,
        treasury,
        x2EarnApps,
        veBetterPassport,
        vechainNodesMock,
        nodeManagement,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 10,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [
          await vechainNodesMock.getAddress(),
          await nodeManagement.getAddress(),
          owner.address,
          config.GM_NFT_NODE_TO_FREE_LEVEL,
        ],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])
      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()

      expect(roundId).to.equal(1)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      // Vote on apps for the first round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId, // First round
      )

      // Rewards to be claimed are the same for all voters:
      expect(await voterRewards.getReward(1, voter1.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(1, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(1, voter3.address)).to.equal(666666666666666666666666n)

      await waitForRoundToEnd(Number(roundId))

      await waitForNextCycle()

      // Second round
      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      // GM NFT token mint and upgrade

      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(1, 2, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 2

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter1.address))).to.equal(2)

      const roundId2 = await xAllocationVoting.currentRoundId()

      expect(roundId2).to.equal(2)

      expect(await xAllocationVoting.roundDeadline(roundId2)).to.lt(await emissions.getNextCycleBlock())

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId2, // Second round
      )

      /*
        Rewards to be claimed from generic pool do not take into account the level of the NFT:
        The rewards are calculated as follows:
        - Generic pool rewards: 2000000

        voter 1 = sqrt(1000 = 31.622
        voter 2 = sqrt(1000) = 31.622
        voter 3 = sqrt(1000) = 31.622

        total = 31.622 + 31.622 + 31.622 = 94.866
        voter 1 = 31.622 / 94.866 * 100 = 33.33% = 2,000,000 * 33.33% = 666,666.
        voter 2 = 31.622 / 94.866 * 100 = 33.33% = 2,000,000 * 33.33% = 666,666.
        voter 3 = 31.622 / 94.866 * 100 = 33.33% = 2,000,000 * 33.33% = 666,666.
      */
      expect(await voterRewards.getReward(2, voter1.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(2, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(2, voter3.address)).to.equal(666666666666666666666666n)

      // GM pool rewards should be 250000
      expect(await emissions.getGMAmount(2)).to.equal(250000000000000000000000n)
      // cycle to total GM should be 100 (Using original multipliers here) as only voter1 has a GM NFT
      expect(await voterRewards.cycleToTotalGMWeight(2)).to.equal(10n)
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter1.address)).to.equal(10n)
      // Expect only voter 1 to get rewards from GM pool
      expect(await voterRewards.getGMReward(2, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(2, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(2, voter3.address)).to.equal(0n)
    })

    it("Should calculate GM rewards correctly if users have different levels of NFTs", async () => {
      const config = createTestConfig()
      config.EMISSIONS_CYCLE_DURATION = 24
      const {
        xAllocationVoting,
        otherAccounts,
        otherAccount: voter1,
        owner,
        voterRewards,
        emissions,
        b3tr,
        minterAccount,
        governor,
        veBetterPassport,
        treasury,
        x2EarnApps,
        nodeManagement,
        vechainNodesMock,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 10,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [
          await vechainNodesMock.getAddress(),
          await nodeManagement.getAddress(),
          owner.address,
          config.GM_NFT_NODE_TO_FREE_LEVEL,
        ],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])
      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()

      await updateGMMultipliers()

      expect(roundId).to.equal(1)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      // Vote on apps for the first round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId, // First round
      )

      // Rewards to be claimed are the same for all voters:
      expect(await voterRewards.getReward(1, voter1.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(1, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(1, voter3.address)).to.equal(666666666666666666666666n)

      await waitForRoundToEnd(Number(roundId))

      await waitForNextCycle()

      // GM NFT token mint and upgrade

      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter1.address))).to.equal(5)

      await galaxyMember.connect(voter2).freeMint()

      await upgradeNFTtoLevel(2, 10, galaxyMember, b3tr, voter2, minterAccount) // Upgrading to level 10

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter2.address))).to.equal(10)

      await galaxyMember.connect(voter3).freeMint()

      await upgradeNFTtoLevel(3, 2, galaxyMember, b3tr, voter3, minterAccount) // Upgrading to level 2

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter3.address))).to.equal(2)

      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      const roundId2 = await xAllocationVoting.currentRoundId()

      expect(roundId2).to.equal(2)

      expect(await xAllocationVoting.roundDeadline(roundId2)).to.lt(await emissions.getNextCycleBlock())

      await waitForNextBlock()

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId2, // Second round
      )

      /*
        GM NFT has no effect on the generic pool rewards:
        The rewards are calculated as follows:
        - Generic pool rewards: 2000000

        voter 1 = sqrt(1000 = 31.622
        voter 2 = sqrt(1000) = 31.622
        voter 3 = sqrt(1000) = 31.622
        total = 31.622 + 31.622 + 31.622 = 94.866
        voter 1 = 31.622 / 94.866 * 100 = 33.33% = 2,000,000 * 33.33% = 666,666.

      */
      expect(await voterRewards.cycleToTotal(2)).to.equal(ethers.parseEther("94.868329803")) // Total reward weighted votes
      expect(await voterRewards.cycleToVoterToTotal(2, voter1)).to.equal(ethers.parseEther("31.622776601")) // Voter 1 reward weighted votes
      expect(await voterRewards.cycleToVoterToTotal(2, voter2)).to.equal(ethers.parseEther("31.622776601")) // Voter 2 reward weighted votes
      expect(await voterRewards.cycleToVoterToTotal(2, voter3)).to.equal(ethers.parseEther("31.622776601")) // Voter 3 reward weighted votes

      /*
        voter 1 = 31.62 reward weighted votes * 100% multiplier = 63.24 reward weighted power
        voter 2 = 31.62 reward weighted votes * 25x multiplier = 790.57 reward weighted power
        voter 3 = 31.62 reward weighted votes * 10% multiplier = 34.78 reward weighted power

        Total power = 888.60
        voter 1 allocation = 63.24 / 888.60 * 100 = 7.11%
        voter 2 allocation = 790.57 / 888.60 * 100 = 88.96%
        voter 3 allocation = 34.78 / 888.60 * 100 = 3.91%
      */
      expect(await voterRewards.getReward(2, voter1.address)).to.equal(666666666666666666666666n) // 33.33%
      expect(await voterRewards.getReward(2, voter2.address)).to.equal(666666666666666666666666n) // 33.33%
      expect(await voterRewards.getReward(2, voter3.address)).to.equal(666666666666666666666666n) // 33.33%

      // GM pool rewards should be 250000
      expect(await emissions.getGMAmount(2)).to.equal(250000000000000000000000n)

      /*
        GM NFT rewards should be calculated as follows:
        - GM pool rewards: 250000
        voter 1 = NFT level 5 = 2x multiplier = 200
        voter 2 = NFT level 10 = 25x multiplier = 2500
        voter 3 = NFT level 2 = 1.1x multiplier = 110

        Total power = 2810
        voter 1 allocation = 200 / 2810 * 100 = 7.11%
        voter 2 allocation = 2500 / 2810 * 100 = 88.96%
        voter 3 allocation = 110 / 2810 * 100 = 3.91%
      */
      expect(await voterRewards.cycleToTotalGMWeight(2)).to.equal(2810n) // Total GM power
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter1.address)).to.equal(200n) // Voter 1 GM power
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter2.address)).to.equal(2500n) // Voter 2 GM power
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter3.address)).to.equal(110n) // Voter 3 GM power

      // Expect only voter 1 to get rewards from GM pool
      expect(await voterRewards.getGMReward(2, voter1.address)).to.equal(17793594306049822064056n) // 7.11% of 250000
      expect(await voterRewards.getGMReward(2, voter2.address)).to.equal(222419928825622775800711n) // 88.96% of 250000
      expect(await voterRewards.getGMReward(2, voter3.address)).to.equal(9786476868327402135231n) // 3.91% of 250000
    })

    it("Should change GM NFT Level if user transfers GM NFT", async () => {
      const config = createTestConfig()
      config.EMISSIONS_CYCLE_DURATION = 24
      const {
        xAllocationVoting,
        otherAccounts,
        otherAccount: voter1,
        owner,
        voterRewards,
        emissions,
        b3tr,
        minterAccount,
        governor,
        treasury,
        veBetterPassport,
        x2EarnApps,
        vechainNodesMock,
        nodeManagement,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 10,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [
          await vechainNodesMock.getAddress(),
          await nodeManagement.getAddress(),
          owner.address,
          config.GM_NFT_NODE_TO_FREE_LEVEL,
        ],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])
      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      await updateGMMultipliers()

      const roundId = await xAllocationVoting.currentRoundId()

      expect(roundId).to.equal(1)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      // Vote on apps for the first round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        roundId, // First round
      )

      // Rewards to be claimed are the same for all voters:
      expect(await voterRewards.getReward(1, voter1.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(1, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(1, voter3.address)).to.equal(666666666666666666666666n)

      await waitForRoundToEnd(Number(roundId))

      await waitForNextCycle()

      // GM NFT token mint and upgrade

      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter1.address))).to.equal(5)

      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      const roundId2 = await xAllocationVoting.currentRoundId()

      expect(roundId2).to.equal(2)

      expect(await xAllocationVoting.roundDeadline(roundId2)).to.lt(await emissions.getNextCycleBlock())

      await waitForNextBlock()

      // Transfer GM NFT to another account
      await galaxyMember.connect(voter1).transferFrom(voter1.address, voter2.address, 1)

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter2.address))).to.equal(5)

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2 -> 31.62 reward weighted votes
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 2 votes 1000 for app2 -> 31.62 reward weighted votes
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2 -> 31.62 reward weighted votes
        ],
        roundId2, // Second round
      )

      // Rewards to be claimed are the same for all voters as NFTs do not impact the rewards calculation
      expect(await voterRewards.getReward(2, voter1.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(2, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(2, voter3.address)).to.equal(666666666666666666666666n)

      /**
       * NFT Rewards should be calculated as follows, only voter 1 had a NFT at the time of the round snapshot but the NFT was transferred to voter 2
       *
       * voter 1 = NFT level 5 = 2x multiplier = 200 @ time of round snapshot -> No rewards as NFT was transferred
       * voter 2 = NFT level 5 = 2x multiplier = 200 @ time of vote -> They will benefit from the NFT level 5
       * voter 3 = NFT level 0
       *
       * Total power = 600
       * voter 1 allocation = 0 / 200 * 100 = 0%
       * voter 2 allocation = 200 / 200 * 100 = 100%
       * voter 3 allocation = 0 / 200 * 100 = 0%
       */
      expect(await voterRewards.getGMReward(2, voter1.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(2, voter2.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(2, voter3.address)).to.equal(0n)

      // Cycle to total GM weight should be 200 as voter 2 has the NFT
      expect(await voterRewards.cycleToTotalGMWeight(2)).to.equal(200n)
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter1.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter2.address)).to.equal(200n)
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter3.address)).to.equal(0n)
    })

    it("Should be able to use GM NFT received from transfer to increase voting rewards", async () => {
      const config = createTestConfig()
      const {
        xAllocationVoting,
        otherAccounts,
        otherAccount: voter1,
        owner,
        voterRewards,
        emissions,
        b3tr,
        minterAccount,
        governor,
        treasury,
        veBetterPassport,
        x2EarnApps,
        vechainNodesMock,
        nodeManagement,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 10,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [
          await vechainNodesMock.getAddress(),
          await nodeManagement.getAddress(),
          owner.address,
          config.GM_NFT_NODE_TO_FREE_LEVEL,
        ],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])

      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()

      expect(roundId).to.equal(1)

      expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

      // Vote on apps for the first round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1 -> 31.62 reward weighted votes
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2 -> 31.62 reward weighted votes
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2 -> 31.62 reward weighted votes
        ],
        roundId, // First round
      )

      // Rewards to be claimed are the same for all voters:
      expect(await voterRewards.getReward(1, voter1.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(1, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(1, voter3.address)).to.equal(666666666666666666666666n)

      await waitForRoundToEnd(Number(roundId))

      await waitForNextCycle()

      // GM NFT token mint and upgrade

      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter1.address))).to.equal(5)

      // Send GM NFT to another account
      await galaxyMember.connect(voter1).transferFrom(voter1.address, voter2.address, 1)

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter2.address))).to.equal(5)

      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      const roundId2 = await xAllocationVoting.currentRoundId()

      expect(roundId2).to.equal(2)

      expect(await xAllocationVoting.roundDeadline(roundId2)).to.lt(await emissions.getNextCycleBlock())

      await waitForNextBlock()

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2 -> 31.62 reward weighted votes
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 2 votes 1000 for app2 -> 31.62 reward weighted votes
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2 -> 31.62 reward weighted votes
        ],
        roundId2, // Second round
      )
      // Rewards to be claimed are now NOT the same for all voters because voters have different levels of NFTs:
      expect(await voterRewards.getReward(2, voter1.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(2, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(2, voter3.address)).to.equal(666666666666666666666666n)

      expect(await voterRewards.getGMReward(2, voter1.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(2, voter2.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(2, voter3.address)).to.equal(0n)

      // Cycle to total GM weight should be 200 as voter 2 has the NFT
      expect(await voterRewards.cycleToTotalGMWeight(2)).to.equal(100n)
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter1.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter2.address)).to.equal(100n)
      expect(await voterRewards.cycleToVoterToGMWeight(2, voter3.address)).to.equal(0n)
    })

    it("Should not be able to claim rewards if not voted", async () => {
      const { xAllocationVoting, otherAccount, voterRewards, emissions, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      let roundId = await xAllocationVoting.currentRoundId()

      await waitForRoundToEnd(Number(roundId))

      await waitForNextCycle()

      await catchRevert(voterRewards.claimReward(1, otherAccount.address)) // Should not be able to claim rewards as not voted

      await emissions.connect(otherAccount).distribute()

      roundId = await xAllocationVoting.currentRoundId()

      await waitForRoundToEnd(Number(roundId))

      await waitForNextCycle()

      await emissions.connect(otherAccount).distribute()

      await expect(voterRewards.claimReward(1, otherAccount.address)).to.be.reverted
      await expect(voterRewards.claimReward(2, otherAccount.address)).to.be.reverted
    })

    it("Should not be able to claim rewards twice", async () => {
      const { xAllocationVoting, otherAccount, voterRewards, emissions, b3tr, owner, minterAccount, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const [app1] = await addAppsToAllocationVoting([otherAccount.address], owner)

      const voter1 = otherAccounts[0]

      await getVot3Tokens(voter1, "1000")

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()

      await voteOnApps([app1], [voter1], [[ethers.parseEther("1000")]], roundId)

      await waitForRoundToEnd(Number(roundId))

      await waitForNextCycle()

      await voterRewards.connect(voter1).claimReward(1, voter1.address)

      expect(await b3tr.balanceOf(voter1.address)).to.equal(await emissions.getVote2EarnAmount(1)) //  voter thus all rewards

      await catchRevert(voterRewards.claimReward(1, otherAccount.address)) // Should not be able to claim rewards twice
    })

    it("Should revert if vote is registered by non vote registrar", async () => {
      const { voterRewards, otherAccount, xAllocationVoting, emissions, minterAccount, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()

      const proposalStart = await xAllocationVoting.roundSnapshot(roundId)

      await veBetterPassport.whitelist(otherAccount.address)
      await veBetterPassport.toggleCheck(1)

      await expect(
        voterRewards
          .connect(otherAccount)
          .registerVote(
            proposalStart,
            otherAccount.address,
            ethers.parseEther("1000"),
            ethers.parseEther("31.6227766017"),
          ),
      ).to.be.reverted
    })

    it("Should not be able to claim rewards for cycle zero", async () => {
      const { voterRewards, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(voterRewards.claimReward(0, otherAccount.address)).to.be.reverted // Cycle zero is a non-existing cycle, first cycle when emissions start is 1
    })

    it("Should not register any vote if voting power is zero", async () => {
      const { voterRewards, otherAccount, owner, emissions, minterAccount, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), otherAccount.address)

      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      await veBetterPassport.whitelist(otherAccount.address)
      await veBetterPassport.toggleCheck(1)

      const totalVotesBefore = await voterRewards.cycleToTotal(1)

      await voterRewards
        .connect(otherAccount)
        .registerVote(1, otherAccount.address, ethers.parseEther("0"), ethers.parseEther("0"))

      const totalVotesAfter = await voterRewards.cycleToTotal(1)

      expect(totalVotesBefore).to.equal(totalVotesAfter) // We expect no votes to be registered when voting power is zero
    })
  })

  describe("Governance voting rewards", () => {
    const description = "Test Proposal: testing propsal with random description!"
    const functionToCall = "tokenDetails"

    it("Should calculate rewards correctly for governance voting", async () => {
      const {
        otherAccounts,
        otherAccount: voter1,
        b3tr,
        B3trContract,
        veBetterPassport,
        voterRewards,
        governor,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const voter2 = otherAccounts[1]
      const proposar = otherAccounts[2]

      // we do it here but will use in the next test
      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(proposar, "1000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.toggleCheck(1)

      // Now we can create a new proposal
      const tx = await createProposal(b3tr, B3trContract, proposar, description, functionToCall, [])
      const proposalId = await getProposalIdFromTx(tx)

      await payDeposit(proposalId, proposar)

      const cycle = await governor.proposalStartRound(proposalId)

      expect(await voterRewards.isQuadraticRewardingDisabledForCurrentCycle()).to.be.false

      const proposalState = await waitForProposalToBeActive(proposalId)

      expect(proposalState).to.equal("1") // Active

      // Vote on the proposal
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      await waitForNextCycle()

      expect(await voterRewards.getReward(cycle, voter1.address)).to.equal(1000000000000000000000000n) // 50% of the rewards
      expect(await voterRewards.getReward(cycle, voter2.address)).to.equal(1000000000000000000000000n) // 50% of the rewards

      expect(await voterRewards.cycleToTotal(cycle)).to.equal(ethers.parseEther("63.245553202")) // Total reward weighted votes
    })

    it("Should be able to vote with 0 VOT3 tokens and not receive rewards", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_VOTING_THRESHOLD = ethers.parseEther("0")
      config.INITIAL_X_ALLOCATION = BigInt("66666666666666666666666")

      const {
        otherAccounts,
        otherAccount: voter1,
        b3tr,
        B3trContract,
        veBetterPassport,
        voterRewards,
        governor,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
      })

      const voter2 = otherAccounts[1]

      await getVot3Tokens(voter1, "1000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.toggleCheck(1)

      // Now we can create a new proposal
      const tx = await createProposal(b3tr, B3trContract, voter1, description, functionToCall, [])
      const proposalId = await getProposalIdFromTx(tx)

      const cycle = await governor.proposalStartRound(proposalId)

      const proposalState = await waitForProposalToBeActive(proposalId)

      expect(proposalState).to.equal("1") // Active

      // Vote on the proposal
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      await waitForNextCycle()

      expect(await voterRewards.getReward(cycle, voter1.address)).to.equal(66666666666666666666666n) // 100% of the rewards
      expect(await voterRewards.getReward(cycle, voter2.address)).to.equal(0) // Even if voter2 voted, he has 0 VOT3 tokens so he should not receive any rewards
    })

    it("Should be able to increase GM voting rewards by upgrading GM NFT", async () => {
      const config = createLocalConfig()
      const {
        otherAccounts,
        b3tr,
        B3trContract,
        emissions,
        minterAccount,
        owner,
        veBetterPassport,
        voterRewards,
        treasury,
        xAllocationVoting,
        governor,
        vechainNodesMock,
        nodeManagement,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
      })

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 10,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [
          await vechainNodesMock.getAddress(),
          await nodeManagement.getAddress(),
          owner.address,
          config.GM_NFT_NODE_TO_FREE_LEVEL,
        ],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      const voter1 = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const proposar = otherAccounts[2]

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(proposar, "2000")

      // Now we can create a new proposal
      let tx = await createProposal(b3tr, B3trContract, proposar, description, functionToCall, [])
      let proposalId = await getProposalIdFromTx(tx)

      let cycle = await governor.proposalStartRound(proposalId)

      await updateGMMultipliers()

      const proposalState = await waitForProposalToBeActive(proposalId)

      expect(proposalState).to.equal("1") // Active

      // Vote on the proposal
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      await waitForNextCycle()

      expect(await voterRewards.getReward(cycle, voter1.address)).to.equal(1000000000000000000000000n) // 50% of the rewards
      expect(await voterRewards.getReward(cycle, voter2.address)).to.equal(1000000000000000000000000n) // 50% of the rewards

      // No GM rewards yet
      expect(await voterRewards.getGMReward(cycle, voter1.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(cycle, voter2.address)).to.equal(0n)

      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      // GM NFT token mint and upgrade

      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      tx = await createProposal(b3tr, B3trContract, proposar, description + "1", functionToCall, [])
      proposalId = await getProposalIdFromTx(tx)
      cycle = await governor.proposalStartRound(proposalId)

      await waitForProposalToBeActive(proposalId)

      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      await waitForNextCycle()

      /*
        voter1 = 1000 votes (31.62 reward weighted votes) for governance voting
        voter2 = 1000 votes (31.62 reward weighted votes) for governance voting

        Total power = 94.86
        voter1 allocation = 31.62/ 63.245553202 * 100 = 50%
        voter2 allocation = 31.62 / 63.245553202 * 100 = 50%
      */
      expect(await voterRewards.getReward(cycle, voter1.address)).to.equal(1000000000000000000000000n)
      expect(await voterRewards.getReward(cycle, voter2.address)).to.equal(1000000000000000000000000n)

      /*

        GM rewards should be calculated as follows:
        voter1 = NFT level 5 = 2x multiplier = 200 @ time of round snapshot
        voter2 = NFT level 0

        Total power = 200
        voter1 allocation = 200 / 200 * 100 = 100%
        voter2 allocation = 0 / 200 * 100 = 0%
      */

      expect(await voterRewards.getGMReward(cycle, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(cycle, voter2.address)).to.equal(0n)

      // Cycle to total GM weight should be 200 as voter 1 has the NFT
      expect(await voterRewards.cycleToTotalGMWeight(cycle)).to.equal(200n)
      expect(await voterRewards.cycleToVoterToGMWeight(cycle, voter1.address)).to.equal(200n)
      expect(await voterRewards.cycleToVoterToGMWeight(cycle, voter2.address)).to.equal(0n)
    })
  })

  describe("X allocation & governance voting rewards", () => {
    const description = "Test Proposal: testing propsal with random description!"
    const functionToCall = "tokenDetails"

    it("QUADRATIC REWARDING ENABLED: Should calculate rewards correctly for governance voting and x allocation voting", async () => {
      const config = createTestConfig()
      const {
        otherAccounts,
        b3tr,
        B3trContract,
        veBetterPassport,
        emissions,
        minterAccount,
        owner,
        governor,
        voterRewards,
        xAllocationVoting,
        treasury,
        vechainNodesMock,
        nodeManagement,
        x2EarnApps,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
      })

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 10,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [
          await vechainNodesMock.getAddress(),
          await nodeManagement.getAddress(),
          owner.address,
          config.GM_NFT_NODE_TO_FREE_LEVEL,
        ],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])

      const voter1 = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      const proposar = otherAccounts[3]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")
      await getVot3Tokens(proposar, "2000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      // Bootstrap emissions
      await bootstrapAndStartEmissions() // round 1

      await updateGMMultipliers()

      // Quadratic rewarding enabled
      expect(await voterRewards.isQuadraticRewardingDisabledForCurrentCycle()).to.be.false

      let nextCycle = await emissions.nextCycle() // next cycle round 2

      // Now we can create a new proposal
      let tx = await createProposal(b3tr, B3trContract, proposar, description, functionToCall, [], nextCycle)
      let proposalId = await getProposalIdFromTx(tx)

      const proposalState = await waitForProposalToBeActive(proposalId) // we are now in round 2
      let xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      expect(xAllocationsRoundID).to.equal(2)
      expect(proposalState).to.equal("1") // Active

      // Vote on the proposal (voter3 does not vote)
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      expect(await xAllocationVoting.roundDeadline(xAllocationsRoundID)).to.lt(await emissions.getNextCycleBlock())

      // Upgrading GM NFT
      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter1.address))).to.equal(5)

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID, // second round
      )

      /*
        GM has no effect on regular reward pool

        voter1 = 1000 votes (reward weighted votes 31.26) for governance voting and 1000 votes = 31.26 + 31.26 = 62.52
        voter2 = 1000 votes (reward weighted votes 31.26) for governance voting and 1000 votes = 31.26 + 31.26 = 62.52
        voter3 = 0 votes for governance voting and 1000 votes (reward weighted votes 31.26) = 31.26

        Total weighted votes = 62.52 + 62.52 + 31.26 = 156.3
        Total power = 156.3
        voter1 allocation = 62.52 / 156.3 * 100 = 40% (1000000 B3TR)
        voter2 allocation = 62.52 / 156.3 * 100 = 40% (1000000 B3TR)
        voter3 allocation = 31.26 / 156.3 * 100 = 20% (1000000 B3TR)
      */
      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(800000000000000000000000n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(800000000000000000000000n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(400000000000000000000000n)

      nextCycle = await emissions.nextCycle() // next cycle round 3

      // Now we can create a new proposal and the GM NFT upgrade will be taken into account
      tx = await createProposal(b3tr, B3trContract, proposar, description + "1", functionToCall, [], nextCycle)
      proposalId = await getProposalIdFromTx(tx)

      await waitForProposalToBeActive(proposalId) // we are in round 3 now

      // Vote on the proposal
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      xAllocationsRoundID = await xAllocationVoting.currentRoundId()
      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID, // second round
      )

      /*
        Same as above GM has no effect on regular reward pool
      */
      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(800000000000000000000000n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(800000000000000000000000n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(400000000000000000000000n)

      /*
        GM rewards should be calculated as follows:
        voter1 = NFT level 5 = 2x multiplier = 200 => 200 (proposal voting) + 200 (x allocation voting) = 400 gm weight
        voter2 = NFT level 0
        voter3 = NFT level 0

        Total power = 400
        voter1 allocation = 400 / 400 * 100 = 100%
        voter2 allocation = 0 / 200 * 100 = 0%
        voter3 allocation = 0 / 200 * 100 = 0%
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)

      // Cycle to total GM weight should be 400 as voter 1 has the NFT
      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(400n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(400n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)
    })

    it("QUADRATIC REWARDING DISABLED: Should calculate rewards correctly for governance voting and x allocation voting", async () => {
      const config = createTestConfig()
      const {
        otherAccounts,
        otherAccount: voter1,
        b3tr,
        governor,
        B3trContract,
        emissions,
        minterAccount,
        owner,
        vechainNodesMock,
        voterRewards,
        vot3,
        xAllocationVoting,
        veBetterPassport,
        treasury,
        nodeManagement,
        x2EarnApps,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
      })

      await voterRewards.toggleQuadraticRewarding()
      expect(await voterRewards.isQuadraticRewardingDisabledAtBlock(await ethers.provider.getBlockNumber())).to.eql(
        true,
      )

      const galaxyMember = (await deployAndUpgrade(
        ["GalaxyMemberV1", "GalaxyMember"],
        [
          [
            {
              name: "galaxyMember",
              symbol: "GM",
              admin: owner.address,
              upgrader: owner.address,
              pauser: owner.address,
              minter: owner.address,
              contractsAddressManager: owner.address,
              maxLevel: 10,
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
        ],
        {
          versions: [undefined, 2],
        },
      )) as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[5])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[6])

      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      const proposar = otherAccounts[3]

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")
      await getVot3Tokens(proposar, "2000")

      // Bootstrap emissions
      await bootstrapAndStartEmissions() // round 1

      // Quadratic rewarding disabled
      expect(await voterRewards.isQuadraticRewardingDisabledForCurrentCycle()).to.be.true

      let nextCycle = await emissions.nextCycle() // next cycle round 2

      // Now we can create a new proposal
      let tx = await createProposal(b3tr, B3trContract, proposar, description, functionToCall, [], nextCycle)
      let proposalId = await getProposalIdFromTx(tx)

      const proposalState = await waitForProposalToBeActive(proposalId) // we are now in round 2
      let xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      expect(xAllocationsRoundID).to.equal(nextCycle)
      expect(proposalState).to.equal("1") // Active

      // Vote on the proposal (voter3 does not vote)
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID, // second round
      )

      /*
        voter1 = 1000 votes for governance voting and 1000 votes for x allocation voting = 2000 votes
        voter2 = 1000 votes for governance voting and 1000 votes for x allocation voting = 2000 votes
        voter3 = 0 votes for governance voting and 1000 votes for x allocation voting = 1000 votes

        Total reward votes = 5000
        voter1 allocation = 2000 / 5000 * 100 = 40% (800000 B3TR)
        voter2 allocation = 2000 / 5000 * 100 = 40% (800000 B3TR)
        voter3 allocation = 1000 / 5000 * 100 = 20% (400000 B3TR)
      */
      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(800000000000000000000000n) // 40%
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(800000000000000000000000n) // 40%
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(400000000000000000000000n) // 20%

      nextCycle = await emissions.nextCycle() // next cycle round 3

      // Now we can create a new proposal and the GM NFT upgrade will be taken into account
      tx = await createProposal(b3tr, B3trContract, proposar, description + "1", functionToCall, [], nextCycle)
      proposalId = await getProposalIdFromTx(tx)

      await waitForProposalToBeActive(proposalId) // we are in round 3 now

      // Vote on the proposal
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      xAllocationsRoundID = await xAllocationVoting.currentRoundId()
      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID, // second round
      )

      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(800000000000000000000000n) // 40%
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(800000000000000000000000n) // 40%
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(400000000000000000000000n) // 20%
    })

    it("QUADRATIC REWARDING DISABLED MID ROUND: Should calculate rewards correctly for governance voting and x allocation voting and Quadratic rewarding should only be removed from following round", async () => {
      const config = createTestConfig()
      const {
        otherAccounts,
        otherAccount: voter1,
        b3tr,
        governor,
        B3trContract,
        emissions,
        minterAccount,
        owner,
        voterRewards,
        vechainNodesMock,
        xAllocationVoting,
        treasury,
        nodeManagement,
        x2EarnApps,
        veBetterPassport,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
      })

      const galaxyMember = (await deployAndUpgrade(
        ["GalaxyMemberV1", "GalaxyMember"],
        [
          [
            {
              name: "galaxyMember",
              symbol: "GM",
              admin: owner.address,
              upgrader: owner.address,
              pauser: owner.address,
              minter: owner.address,
              contractsAddressManager: owner.address,
              maxLevel: 10,
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
        ],
        {
          versions: [undefined, 2],
        },
      )) as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])

      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      const proposar = otherAccounts[3]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")
      await getVot3Tokens(proposar, "2000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      // Bootstrap emissions
      await bootstrapAndStartEmissions() // round 1

      let nextCycle = await emissions.nextCycle() // next cycle round 2

      await updateGMMultipliers()

      // Now we can create a new proposal
      let tx = await createProposal(b3tr, B3trContract, proposar, description, functionToCall, [], nextCycle)
      let proposalId = await getProposalIdFromTx(tx)

      const proposalState = await waitForProposalToBeActive(proposalId) // we are now in round 2
      let xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      expect(xAllocationsRoundID).to.equal(nextCycle)
      expect(proposalState).to.equal("1") // Active

      // Vote on the proposal (voter3 does not vote)
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      expect(await xAllocationVoting.roundDeadline(xAllocationsRoundID)).to.lt(await emissions.getNextCycleBlock())

      // Upgrading GM NFT
      await galaxyMember.connect(voter1).freeMint()

      // Disable quadratic rewarding mid round
      await voterRewards.toggleQuadraticRewarding()

      // Quadratic rewarding should still be enabled for the current round
      expect(await voterRewards.isQuadraticRewardingDisabledForCurrentCycle()).to.be.false

      // Flag should be set to enable quadratic rewarding for the next round
      expect(await voterRewards.isQuadraticRewardingDisabledAtBlock(await ethers.provider.getBlockNumber())).to.be.true

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("100"), ethers.parseEther("300")], // Voter 2 votes 100 for app1 and 300 for app2
          [ethers.parseEther("200"), ethers.parseEther("600")], // Voter 3 votes 200 for app1 and 600 for app2
        ],
        xAllocationsRoundID, // second round
      )

      /*
        voter1 = 1000 votes (reward weighted votes 31.62) for governance voting and 1000 votes (reward weighted votes 31.62) for x allocation voting = 2000 votes (reward weighted votes 63.24)
        voter2 = 1000 votes (reward weighted votes 31.62) for governance voting and 400 votes (reward weighted votes 20) for x allocation voting = 1400 votes (reward weighted votes 51.62)
        voter3 = 0 votes for governance voting and 800 votes (reward weighted votes 28.30) for x allocation voting = 800 votes (reward weighted votes 28.30)

        Total weighted votes = 63.24 + 51.62 + 28.30 = 143.16
        voter1 allocation = 63.24 / 143.16 * 100 = 44.17% (883610 B3TR)
        voter2 allocation = 51.62 / 143.16 * 100 = 36.06% (721227 B3TR)
        voter3 allocation = 28.30 / 143.16 * 100 = 19.77% (379591 B3TR)
      */

      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(883610255602826854818087n) // 44.17%
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(721227224966304585354231n) // 33.67%
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(395162519430868559827680n) // 18.96%

      nextCycle = await emissions.nextCycle() // next cycle round 3

      // Now we can create a new proposal and the GM NFT upgrade will be taken into account
      tx = await createProposal(b3tr, B3trContract, proposar, description + "1", functionToCall, [], nextCycle)
      proposalId = await getProposalIdFromTx(tx)

      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5
      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter1.address))).to.equal(5) // Level 5

      await waitForProposalToBeActive(proposalId) // we are in round 3 now

      // Vote on the proposal
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      xAllocationsRoundID = await xAllocationVoting.currentRoundId()
      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID, // second round
      )

      /*
        voter 1 = 1000 votes for governance voting and 1000 votes for x allocation voting = reward weighted votes 2000 = 2000 total reward weighted votes
        voter 2 votes = 1000 votes for governance voting and 1000 votes for x allocation voting = reward weighted votes 2000 with no multiplier = 2000 total reward weighted votes
        voter 3 votes = 0 votes for governance voting and 1000 votes for x allocation voting = reward weighted votes 1000 with no multiplier = 1000 total reward weighted votes

        Total reward weighted votes = 5000 (2000 + 2000 + 1000) = 5000
        Voter 1 allocation = 2000 / 5000 * 100 = 40% (800000 B3TR)
        Voter 2 allocation = 2000 / 5000 * 100 = 40% (800000 B3TR)  
        Voter 3 allocation = 1000 / 5000 * 100 = 20% (400000 B3TR)
      */
      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(800000000000000000000000n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(800000000000000000000000n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(400000000000000000000000n)

      /*
        GM rewards should be calculated as follows:
        voter1 = NFT level 5 = 2x multiplier = 200 => 200 (proposal voting) + 200 (x allocation voting) = 400 gm weight
        voter2 = NFT level 0
        voter3 = NFT level 0

        Total power = 200
        voter1 allocation = 200 / 200 * 100 = 100%
        voter2 allocation = 0 / 200 * 100 = 0%
        voter3 allocation = 0 / 200 * 100 = 0%
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)

      // Cycle to total GM weight should be 400 as voter 1 has the NFT
      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(400n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(400n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)
    })

    it("QUADRATIC REWARDING ENABLED MID ROUND: Should calculate rewards correctly for governance voting and x allocation voting and Quadratic rewarding should only be enabled from following round", async () => {
      const config = createTestConfig()
      const {
        otherAccounts,
        otherAccount: voter1,
        b3tr,
        governor,
        B3trContract,
        emissions,
        minterAccount,
        vechainNodesMock,
        owner,
        voterRewards,
        veBetterPassport,
        xAllocationVoting,
        treasury,
        x2EarnApps,
        nodeManagement,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
      })

      expect(await voterRewards.isQuadraticRewardingDisabledAtBlock(await ethers.provider.getBlockNumber())).to.be.false

      const galaxyMember = (await deployAndUpgrade(
        ["GalaxyMemberV1", "GalaxyMember"],
        [
          [
            {
              name: "galaxyMember",
              symbol: "GM",
              admin: owner.address,
              upgrader: owner.address,
              pauser: owner.address,
              minter: owner.address,
              contractsAddressManager: owner.address,
              maxLevel: 10,
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
        ],
        {
          versions: [undefined, 2],
        },
      )) as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[0])
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[1])

      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      const proposar = otherAccounts[3]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")
      await getVot3Tokens(proposar, "2000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.toggleCheck(1)

      // Bootstrap emissions
      await bootstrapAndStartEmissions() // round 1

      let nextCycle = await emissions.nextCycle() // next cycle round 2

      await updateGMMultipliers()

      // Now we can create a new proposal
      let tx = await createProposal(b3tr, B3trContract, proposar, description, functionToCall, [], nextCycle)
      let proposalId = await getProposalIdFromTx(tx)

      const proposalState = await waitForProposalToBeActive(proposalId) // we are now in round 2
      let xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      expect(xAllocationsRoundID).to.equal(nextCycle)
      expect(proposalState).to.equal("1") // Active

      // Vote on the proposal (voter3 does not vote)
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      expect(await xAllocationVoting.roundDeadline(xAllocationsRoundID)).to.lt(await emissions.getNextCycleBlock())

      // Upgrading GM NFT
      await galaxyMember.connect(voter1).freeMint()

      // Disable quadratic rewarding mid round
      await voterRewards.toggleQuadraticRewarding()

      // Quadratic rewarding should still be disabled for the current round
      expect(await voterRewards.isQuadraticRewardingDisabledForCurrentCycle()).to.be.false

      // Flag should be set to enable quadratic rewarding for the next round
      expect(await voterRewards.isQuadraticRewardingDisabledAtBlock(await ethers.provider.getBlockNumber())).to.be.true

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID, // second round
      )

      /*
        voter1 = 1000 votes (reward weighted votes 31.26) for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = 2000 votes (reward weighted votes 63.24)
        voter2 = 1000 votes (reward weighted votes 31.26) for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = 2000 votes (reward weighted votes 63.24)
        voter3 = 0 votes for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = 1000 votes (reward weighted votes 31.26)

        Total reward weighted votes = 158.10
        voter1 allocation = 63.24 / 158.10 * 100 = 40% (800000 B3T3)
        voter2 allocation = 63.24 / 158.10 * 100 = 40% (800000 B3TR)
        voter3 allocation = 31.62 / 158.10 * 100 = 20% (400000 B3TR)
      */

      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(800000000000000000000000n) // 40%
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(800000000000000000000000n) // 40%
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(400000000000000000000000n) // 20%

      nextCycle = await emissions.nextCycle() // next cycle round 3

      // Now we can create a new proposal and the GM NFT upgrade will be taken into account
      tx = await createProposal(b3tr, B3trContract, proposar, description + "1", functionToCall, [], nextCycle)
      proposalId = await getProposalIdFromTx(tx)

      await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5
      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter1.address))).to.equal(5) // Level 5

      await waitForProposalToBeActive(proposalId) // we are in round 3 now

      // Vote on the proposal
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      xAllocationsRoundID = await xAllocationVoting.currentRoundId()
      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID, // second round
      )

      /*
        voter1 = 1000 votes (reward weighted votes 31.26) for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = 2000 votes (reward weighted votes 63.24)
        voter2 = 1000 votes (reward weighted votes 31.26) for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = 2000 votes (reward weighted votes 63.24)
        voter3 = 0 votes for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = 1000 votes (reward weighted votes 31.26)

        Total reward weighted votes = 158.10
        voter1 allocation = 63.24 / 158.10 * 100 = 40% (800000 B3T3)
        voter2 allocation = 63.24 / 158.10 * 100 = 40% (800000 B3TR)
        voter3 allocation = 31.62 / 158.10 * 100 = 20% (400000 B3TR)
      */

      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(800000000000000000000000n) // 40%
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(800000000000000000000000n) // 40%
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(400000000000000000000000n) // 20%

      /*
        GM rewards should be calculated as follows:
        voter1 = NFT level 5 = 2x multiplier = 200 => 200 (proposal voting) + 200 (x allocation voting) = 400 gm weight
        voter2 = NFT level 0
        voter3 = NFT level 0

        Total power = 400
        voter1 allocation = 400 / 400 * 100 = 100%
        voter2 allocation = 0 / 200 * 100 = 0%
        voter3 allocation = 0 / 200 * 100 = 0%
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)

      // Cycle to total GM weight should be 400 as voter 1 has the NFT
      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(400n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(400n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)
    })
  })

  describe("GM NFT Binding with Vechain nodes", () => {
    it("Should not multiply voting power if GM NFT already voted for proposal", async () => {
      const description = "Test Proposal: testing propsal with random description!"
      const functionToCall = "tokenDetails"

      const config = createLocalConfig()

      const {
        vechainNodesMock,
        galaxyMember,
        emissions,
        b3tr,
        B3trContract,
        xAllocationVoting,
        otherAccounts,
        voterRewards,
        governor,
        x2EarnApps,
        veBetterPassport,
      } = await getOrDeployContractInstances({
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
        forceDeploy: true,
        deployMocks: true,
      })

      await veBetterPassport.toggleCheck(4)

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[8])

      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")

      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[7])

      const voter1 = otherAccounts[1]
      const voter2 = otherAccounts[2]
      const voter3 = otherAccounts[3]

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      await addNodeToken(1, voter1)
      await addNodeToken(3, voter3)

      await participateInAllocationVoting(voter1)

      await updateGMMultipliers()

      await galaxyMember.connect(voter1).freeMint() // Token Id 1

      await galaxyMember.setMaxLevel(10)

      // Attach node to GM NFT
      await galaxyMember.connect(voter1).attachNode(3, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 1

      const nextCycle = await emissions.nextCycle() // next cycle round 2

      await getVot3Tokens(voter1, "999")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      // Now we can create a new proposal
      const tx = await createProposal(b3tr, B3trContract, voter1, description, functionToCall, [], nextCycle)
      const proposalId = await getProposalIdFromTx(tx)

      const proposalState = await waitForProposalToBeActive(proposalId) // we are now in round 2
      const xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      expect(xAllocationsRoundID).to.equal(nextCycle)
      expect(proposalState).to.equal("1") // Active

      expect(await governor.getVotes(voter1.address, (await ethers.provider.getBlockNumber()) - 1)).to.equal(
        ethers.parseEther("1000"),
      )
      expect(await governor.getVotes(voter2.address, (await ethers.provider.getBlockNumber()) - 1)).to.equal(
        ethers.parseEther("1000"),
      )

      // Vote on the proposal (voter3 does not vote)
      await governor.connect(voter1).castVote(proposalId, 1) // For (sqrt(1000) = 31.62 weighted voting power * 10% multiplier = 34.78 weighted voting power)
      await governor.connect(voter2).castVote(proposalId, 1) // For (sqrt(1000) = 31.62 weighted voting power (No multiplier)

      /*
          GM has no effect on generic voter rewards
      */
      expect(await voterRewards.getReward(await xAllocationVoting.currentRoundId(), voter1.address)).to.equal(
        1000000000000000000000000n,
      )
      expect(await voterRewards.getReward(await xAllocationVoting.currentRoundId(), voter2.address)).to.equal(
        1000000000000000000000000n,
      )

      // Voter 1 should get all the GM rewards
      expect(await voterRewards.getGMReward(await xAllocationVoting.currentRoundId(), voter1.address)).to.equal(
        250000000000000000000000n,
      )
      expect(await voterRewards.getGMReward(await xAllocationVoting.currentRoundId(), voter2.address)).to.equal(0n)

      // Now we transfer the NFT to another account and vote with that account

      await expect(galaxyMember.connect(voter1).transferFrom(voter1.address, voter3.address, 1)).to.be.revertedWith(
        "GalaxyMember: token attached to a node, detach before transfer",
      ) // Can't transfer GM NFT attached to a node

      await galaxyMember.connect(voter1).detachNode(3, 1) // Detach node

      await galaxyMember.connect(voter1).transferFrom(voter1.address, voter3.address, 1) // Now we can transfer the NFT

      await galaxyMember.connect(voter3).attachNode(4, 1) // Attach Mjolnir to GM NFT of voter3 that he just received

      expect(await galaxyMember.levelOf(1)).to.equal(6) // Level 6 because of the Mjolnir node

      await governor.connect(voter3).castVote(proposalId, 1)

      /*
        GM has no effect here

        voter 3 voting power = 31.62
        voter 1 voting power = 31.62
        voter 2 voting power = 31.62
      */

      expect(await voterRewards.getReward(await xAllocationVoting.currentRoundId(), voter3.address)).to.equal(
        666666666666666666666666n,
      )
      expect(await voterRewards.getReward(await xAllocationVoting.currentRoundId(), voter1.address)).to.equal(
        666666666666666666666666n,
      )
      expect(await voterRewards.getReward(await xAllocationVoting.currentRoundId(), voter2.address)).to.equal(
        666666666666666666666666n,
      )

      /*
       voter3 cast vote but the GM NFT was already used to vote for the proposal, thus NO multiplier should be applied

       Only voter 1 gets GM rewards 
      */
      expect(await voterRewards.getGMReward(await xAllocationVoting.currentRoundId(), voter1.address)).to.equal(
        250000000000000000000000n,
      )
      expect(await voterRewards.getGMReward(await xAllocationVoting.currentRoundId(), voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(await xAllocationVoting.currentRoundId(), voter3.address)).to.equal(0n)

      expect(await emissions.getCurrentCycle()).to.equal(2) // We're in round 2
      expect(await emissions.isCycleEnded(await emissions.getCurrentCycle())).to.equal(false)

      // Vote on apps for the second round
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID,
      )

      // Same as before GM has no effect on generic voter rewards
      expect(await voterRewards.getReward(await xAllocationVoting.currentRoundId(), voter3.address)).to.equal(
        666666666666666666666666n,
      )
      expect(await voterRewards.getReward(await xAllocationVoting.currentRoundId(), voter1.address)).to.equal(
        666666666666666666666666n,
      )
      expect(await voterRewards.getReward(await xAllocationVoting.currentRoundId(), voter2.address)).to.equal(
        666666666666666666666666n,
      )

      /*
        Now with gm reward pool, things change a bit 

        voter 3: 600 because of Level 5 GM NFT due to Mjolnir attached)
        voter 1: 110 because Mjolnir
        voter 2: 0

      */
      expect(await voterRewards.getGMReward(await xAllocationVoting.currentRoundId(), voter3.address)).to.equal(
        173611111111111111111111n,
      )
      expect(await voterRewards.getGMReward(await xAllocationVoting.currentRoundId(), voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(await xAllocationVoting.currentRoundId(), voter1.address)).to.equal(
        76388888888888888888888n,
      )

      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(360n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(250n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(110n)
    })

    it("Should not multiply voting power if Vechain node already voted for proposal", async () => {
      const description = "Test Proposal: testing propsal with random description!"
      const functionToCall = "tokenDetails"

      const config = createLocalConfig()

      const {
        vechainNodesMock,
        galaxyMember,
        emissions,
        b3tr,
        B3trContract,
        xAllocationVoting,
        otherAccounts,
        voterRewards,
        governor,
        x2EarnApps,
        owner,
      } = await getOrDeployContractInstances({
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
        forceDeploy: true,
        deployMocks: true,
      })

      ///////////////////////////

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[5])

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")

      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[6])

      const voter1 = otherAccounts[1]
      const voter2 = otherAccounts[2]
      const voter3 = otherAccounts[3]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      await addNodeToken(3, voter1)

      const roundId = await startNewAllocationRound()

      await updateGMMultipliers()

      await voteOnApps(
        [app1, app2],
        [voter1, voter2],
        [
          [ethers.parseEther("1"), ethers.parseEther("0")], // Voter 1 votes
          [ethers.parseEther("0"), ethers.parseEther("1")], // Voter 2 votes
        ],
        BigInt(roundId),
      )

      await galaxyMember.connect(voter1).freeMint() // Token Id 1

      await galaxyMember.setMaxLevel(10)

      await waitForRoundToEnd(roundId)

      // Start next cycle
      await emissions.distribute()

      // Attach node to GM NFT
      await galaxyMember.connect(voter1).attachNode(3, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(6) // Level 6 because of the Mjolnir node attached

      let xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      // voter 2 doesn't vote
      await voteOnApps(
        [app1, app2],
        [voter1, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID,
      )

      /*
        voter 1: 2.5x (Mjolnir attached) = 250
        voter 3: 0

        Total GM weight = 250
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)

      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(250n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(250n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)

      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      // Transfer Mjolnir to voter2
      await vechainNodesMock.connect(voter1).transferFrom(voter1.address, voter2.address, 3)

      await galaxyMember.connect(voter2).freeMint() // Token Id 2

      await expect(galaxyMember.connect(voter2).attachNode(3, 2)).to.be.reverted // Mjolnir (token Id 1) is still attached to voter1

      await galaxyMember.connect(voter2).detachNode(3, await galaxyMember.getIdAttachedToNode(3)) // Detach Mjolnir from voter1's GM NFT

      await galaxyMember.connect(voter2).attachNode(3, 2) // Attach Mjolnir to voter2's GM NFT

      expect(await galaxyMember.levelOf(2)).to.equal(6) // Level 6 because of the Mjolnir node attached
      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1 because Mjolnir was detached

      // Now voter 2 votes
      await voteOnApps(
        [app1, app2],
        [voter2],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 2 votes 1000 for app1
        ],
        xAllocationsRoundID,
      )

      /*
        voter 2 now voted:

        voter 2: NO multiplier even though he has level 6 GM NFT with Mjolnir attached, because that node already voted for this proposal
        voter 1: 2.5x (Mjolnir attached previosuly) = 250
        voter 3: 0

        Total GM weight = 250
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)
      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(250n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(250n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)

      // Now we can create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        voter1,
        description,
        functionToCall,
        [],
        xAllocationsRoundID + BigInt(2),
      )
      const proposalId = await getProposalIdFromTx(tx)

      const proposalState = await waitForProposalToBeActive(proposalId)

      expect(proposalState).to.equal("1") // Active

      xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For
      await governor.connect(voter3).castVote(proposalId, 0) // Against

      /*
        Now the proposal ID is completely different so multiplier should be applied

        voter 1: NO multiplier as Mjonir was detached
        voter 2: 2.5x Mjolnir attached
        voter 3: 0

        Total GM weight = 250
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)
      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(250n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(250n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)
    })

    it("Should correctly track multiplier of GM NFT with B3TR donated when voting", async () => {
      const config = createLocalConfig()

      const {
        vechainNodesMock,
        galaxyMember,
        emissions,
        b3tr,
        minterAccount,
        xAllocationVoting,
        otherAccounts,
        voterRewards,
        x2EarnApps,
        owner,
      } = await getOrDeployContractInstances({
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
        forceDeploy: true,
        deployMocks: true,
      })

      ///////////////////////////

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[6])

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")

      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[7])

      const voter1 = otherAccounts[1]
      const voter2 = otherAccounts[2]
      const voter3 = otherAccounts[3]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      await addNodeToken(3, voter1)

      const roundId = await startNewAllocationRound()

      await updateGMMultipliers()

      await voteOnApps(
        [app1, app2],
        [voter1, voter2],
        [
          [ethers.parseEther("1"), ethers.parseEther("0")], // Voter 1 votes
          [ethers.parseEther("0"), ethers.parseEther("1")], // Voter 2 votes
        ],
        BigInt(roundId),
      )

      await galaxyMember.connect(voter1).freeMint() // Token Id 1

      await galaxyMember.setMaxLevel(3) // Set max level of GM NFT to 3

      await waitForRoundToEnd(roundId)

      // Start next cycle
      await emissions.distribute()

      // Attach node to GM NFT
      await galaxyMember.connect(voter1).attachNode(3, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(3) // Level 3 because of the Mjolnir node attached but max level is 3.

      let xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 2 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID,
      )

      /*
        voter 1: 1.20x (Level 3)
        voter 2: 0
        voter 3: 

        Total GM weight = 1.20
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)

      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(120n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(120n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)

      await waitForRoundToEnd(xAllocationsRoundID)

      await galaxyMember.setMaxLevel(10) // Now set max level to 10

      // Start next cycle
      await emissions.distribute()

      xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      expect(await galaxyMember.levelOf(1)).to.equal(6) // Level 6 because of the Mjolnir node attached which allows the GM NFT to be level 6 for free

      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 2 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID,
      )

      /*
        voter 1: 2.5 (Level 6)
        voter 2: 0
        voter 3: 0

        Total GM weight = 2.5
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)

      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(250n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(250n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)

      // Now let's upgrade the GM NFT to level 10
      await b3tr.connect(minterAccount).mint(voter1, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(voter1).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(voter1).upgrade(1) // Upgrade token id 1

      await b3tr.connect(minterAccount).mint(voter1, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(voter1).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(voter1).upgrade(1) // Upgrade token id 1

      await b3tr.connect(minterAccount).mint(voter1, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(voter1).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(voter1).upgrade(1) // Upgrade token id 1

      await b3tr.connect(minterAccount).mint(voter1, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(voter1).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(voter1).upgrade(1) // Upgrade token id 1

      expect(await galaxyMember.levelOf(1)).to.equal(10)

      await waitForRoundToEnd(xAllocationsRoundID)

      // Start next cycle
      await emissions.distribute()

      xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 2 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID,
      )

      /*
        voter 1: Level 10 GM NFT has 25x multiplier = 250
        voter 2: 0
        voter 3: 0

        Total GM weight = 250
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)
      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(2500n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(2500n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)

      await waitForRoundToEnd(xAllocationsRoundID)

      // Start next cycle
      await emissions.distribute()

      xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      /*
        Now let's see what happens when detaching the Mjolnir node from the GM NFT

        voter 1 has spent 500,000 + 2,500,000 + 5,000,000 + 25,000,000 = 33,000,000 B3TR to upgrade the GM NFT to level 10

        Starting from Level 1 (when Mjolnir is detached), the GM NFT Level would be = Level 9 with 435,000 B3TR required to upgrade to Level 10
      */
      await galaxyMember.connect(voter1).detachNode(3, 1) // Detach Mjolnir from GM NFT

      expect(await galaxyMember.levelOf(1)).to.equal(9)
      expect(await galaxyMember.getB3TRtoUpgrade(1)).to.equal(ethers.parseEther("435000"))

      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 2 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID,
      )

      /*
        voter 1: Level 9 GM NFT has 10x multiplier => 1000
        voter 2: 0
        voter 3: 0

        Total GM weight = 1000
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)
      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(1000n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(1000n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)
    })

    it("Should change multiplier if selected GM NFT is changed", async () => {
      const config = createLocalConfig()

      const {
        vechainNodesMock,
        galaxyMember,
        emissions,
        b3tr,
        minterAccount,
        xAllocationVoting,
        otherAccounts,
        voterRewards,
        x2EarnApps,
        owner,
      } = await getOrDeployContractInstances({
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
        forceDeploy: true,
        deployMocks: true,
      })

      ///////////////////////////

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(app1, otherAccounts[6])

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")

      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      await endorseApp(app2, otherAccounts[7])

      const voter1 = otherAccounts[1]
      const voter2 = otherAccounts[2]
      const voter3 = otherAccounts[3]

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      await addNodeToken(3, voter1)

      const roundId = await startNewAllocationRound()

      await updateGMMultipliers()

      await voteOnApps(
        [app1, app2],
        [voter1, voter2],
        [
          [ethers.parseEther("1"), ethers.parseEther("0")], // Voter 1 votes
          [ethers.parseEther("0"), ethers.parseEther("1")], // Voter 2 votes
        ],
        BigInt(roundId),
      )

      await galaxyMember.connect(voter1).freeMint() // Token Id 1

      await galaxyMember.connect(voter1).freeMint() // Token Id 2

      await galaxyMember.setMaxLevel(10)

      // Let's upgrade the GM NFT 1
      await b3tr.connect(minterAccount).mint(voter1, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(voter1).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(voter1).upgrade(1) // Upgrade token id 1

      expect(await galaxyMember.levelOf(1)).to.equal(2)

      await waitForRoundToEnd(roundId)

      // Start next cycle
      await emissions.distribute()

      // All voters vote
      let xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 2 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID,
      )

      // voter 1 should have 1.1x multiplier
      // voter 2 and 3 should have no multiplier
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(250000000000000000000000n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)

      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(110n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(110n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)

      await waitForRoundToEnd(xAllocationsRoundID)

      // Now let's change voter1's selected GM NFT to token id 2
      await galaxyMember.connect(voter1).select(2)

      // Start next cycle
      await emissions.distribute()

      xAllocationsRoundID = await xAllocationVoting.currentRoundId()

      // All voters vote
      await voteOnApps(
        [app1, app2],
        [voter1, voter2, voter3],
        [
          [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
          [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 2 votes 1000 for app2
          [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
        ],
        xAllocationsRoundID,
      )

      // voter 1 should now have no multiplier like voter 2 and 3
      /*
        voter 1 = 0
        voter 2 = 0
        voter 3 = 0
        Total GM weight = 0
      */
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter1.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.getGMReward(xAllocationsRoundID, voter3.address)).to.equal(0n)

      expect(await voterRewards.cycleToTotalGMWeight(xAllocationsRoundID)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter1.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter2.address)).to.equal(0n)
      expect(await voterRewards.cycleToVoterToGMWeight(xAllocationsRoundID, voter3.address)).to.equal(0n)
    })
  })
})
