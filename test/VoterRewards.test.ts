import { describe, it } from "mocha"
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
  bootstrapAndStartEmissions,
  ZERO_ADDRESS,
  payDeposit,
} from "./helpers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { createLocalConfig } from "../config/contracts/envs/local"
import { createTestConfig } from "./helpers/config"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { deployAndUpgrade, deployProxy, upgradeProxy } from "../scripts/helpers"
import { B3TRGovernor, GalaxyMember, VoterRewards, VoterRewardsV1, XAllocationVoting } from "../typechain-types"

describe("VoterRewards - @shard7", () => {
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

      await voterRewards.connect(owner).setLevelToMultiplier(1, 2)
      expect(await voterRewards.levelToMultiplier(1)).to.equal(2)

      await expect(voterRewards.connect(owner).setLevelToMultiplier(0, 2)).to.be.reverted // Level cannot be zero
      await expect(voterRewards.connect(owner).setLevelToMultiplier(1, 0)).to.be.reverted // Multiplier cannot be zero

      await expect(voterRewards.connect(otherAccount).setLevelToMultiplier(1, 2)).to.be.reverted // Should not be able to set level to multiplier if not admin
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

    it("Only admin should be able to set vote registrar role address", async () => {
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

      let events = receipt?.logs

      let decodedEvents = events?.map(event => {
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

    it("Only admin should be able to upgrade the contract", async function () {
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
      const { voterRewardsV1, owner, emissions, galaxyMember, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(
        voterRewardsV1.initialize(
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

      expect(await voterRewards.version()).to.equal("2")
    })

    it("Should not have state conflict after upgrading to V2", async () => {
      const config = createLocalConfig()
      const {
        otherAccounts,
        otherAccount: voter1,
        owner,
        emissions,
        b3tr,
        timeLock,
        galaxyMember,
        vot3,
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
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
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
        "VoterRewards",
        await voterRewardsV1.getAddress(),
        [],
        {
          version: 2,
        },
      )) as VoterRewards

      const storageSlotsAfter = []

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
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
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
      expect(decodedEvents[0]?.args?.[3]).to.equal(ethers.parseEther("22.360679774")) // Reward weight

      expect(await emissions.isCycleEnded(1)).to.equal(false)

      await catchRevert(voterRewards.claimReward(1, otherAccount.address)) // Should not be able to claim rewards before cycle ended

      expect(await voterRewards.cycleToVoterToTotal(1, otherAccount)).to.equal(ethers.parseEther("22.360679774")) // I'm expecting 22.36 because I voted 300 for app1 and 200 for app2 at the first cycle which is 500 and the square root of 500 is 22.36

      tx = await xAllocationVoting
        .connect(voter2)
        .castVote(roundId, [app1, app2], [ethers.parseEther("200"), ethers.parseEther("100")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      expect(await voterRewards.cycleToVoterToTotal(1, voter2)).to.equal(ethers.parseEther("17.320508075")) // I'm expecting 17.32 because I voted 200 for app1 and 100 for app2 at the first cycle which is 300 and the square root of 300 is 17.32

      await catchRevert(voterRewards.claimReward(1, voter2.address)) // Should not be able to claim rewards before cycle ended

      tx = await xAllocationVoting
        .connect(voter3)
        .castVote(roundId, [app1, app2], [ethers.parseEther("100"), ethers.parseEther("500")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      expect(await voterRewards.cycleToVoterToTotal(1, voter3)).to.equal(ethers.parseEther("24.494897427")) // I'm expecting 24.49 because I voted 100 for app1 and 500 for app2 at the first cycle which is 600 and the square root of 600 is 24.49

      // Votes should be tracked correctly
      let appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("800"))

      let totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("1400"))

      // Total voters should be tracked correctly
      let totalVoters = await xAllocationVoting.totalVoters(roundId)
      expect(totalVoters).to.eql(BigInt(3))

      // Voter rewards checks
      expect(await voterRewards.cycleToTotal(1)).to.equal(ethers.parseEther("64.176085276")) // Total votes -> Math.sqrt(500) + Math.sqrt(300) + Math.sqrt(600)
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

      const rewardClaimedEvent = decodedEvents.find(event => event?.name === "RewardClaimed")

      expect(rewardClaimedEvent?.args?.[0]).to.equal(1) // Cycle
      expect(rewardClaimedEvent?.args?.[1]).to.equal(otherAccount.address) // Voter
      expect(rewardClaimedEvent?.args?.[2]).to.equal(696853966016598011228309n) // Reward

      await voterRewards.connect(voter2).claimReward(1, voter2.address)
      await voterRewards.connect(voter3).claimReward(1, voter3.address)

      await expect(voterRewards.connect(voter2).claimReward(1, ZERO_ADDRESS)).to.be.reverted // Should not be able to claim rewards for zero address

      expect(await b3tr.balanceOf(voter2.address)).to.equal(voter2Rewards)
      expect(await b3tr.balanceOf(voter3.address)).to.equal(voter3Rewards)

      expect(await b3tr.balanceOf(await voterRewards.getAddress())).to.lt(ethers.parseEther("1"))
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
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
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
      let totalVoters = await xAllocationVoting.totalVoters(roundId)
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

      const rewardClaimedEvent = decodedEvents.find(event => event?.name === "RewardClaimed")

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
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
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

    it("Should increase voting rewards for user's with higher token levels", async () => {
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
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
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

      await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.getHighestLevel(voter1.address)).to.equal(5)

      // Second round
      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      await waitForNextBlock()

      expect(await galaxyMember.getPastHighestLevel(voter1.address, await xAllocationVoting.roundSnapshot(2))).to.equal(
        5,
      )

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

      // Rewards to be claimed are now NOT the same for all voters because voter1 has a higher level NFT:
      expect(await voterRewards.getReward(2, voter1.address)).to.equal(1000000000000000000000000n) // Double voting rewards multiplier so it's like he voted 2000 (out of 4000 total votes) => 50% of the rewards
      expect(await voterRewards.getReward(2, voter2.address)).to.equal(500000000000000000000000n)
      expect(await voterRewards.getReward(2, voter3.address)).to.equal(500000000000000000000000n)
    })

    it("Should not increase voting rewards if user upgrades after x allocation round snapshot", async () => {
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
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const galaxyMember = (await deployProxy("GalaxyMember", [
        {
          name: "galaxyMember",
          symbol: "BDG",
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
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

      await upgradeNFTtoLevel(0, 2, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 2

      expect(await galaxyMember.getHighestLevel(voter1.address)).to.equal(2)

      expect(await galaxyMember.getPastHighestLevel(voter1.address, await xAllocationVoting.roundSnapshot(2))).to.equal(
        0,
      ) // Voter 1 upgraded after the round snapshot so he results in not having a level for the round

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

      // Rewards to be claimed are now NOT the same for all voters because voter1 has a higher level NFT:
      expect(await voterRewards.getReward(2, voter1.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(2, voter2.address)).to.equal(666666666666666666666666n)
      expect(await voterRewards.getReward(2, voter3.address)).to.equal(666666666666666666666666n)
    })

    it("Should calculate rewards correctly if users have different levels of NFTs", async () => {
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
        veBetterPassport,
        treasury,
        x2EarnApps,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
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

      await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.getHighestLevel(voter1.address)).to.equal(5)

      await galaxyMember.connect(voter2).freeMint()

      await upgradeNFTtoLevel(1, 10, galaxyMember, b3tr, voter2, minterAccount) // Upgrading to level 10

      expect(await galaxyMember.getHighestLevel(voter2.address)).to.equal(10)

      await galaxyMember.connect(voter3).freeMint()

      await upgradeNFTtoLevel(2, 2, galaxyMember, b3tr, voter3, minterAccount) // Upgrading to level 2

      expect(await galaxyMember.getHighestLevel(voter3.address)).to.equal(2)

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
        voter 1 = 31.62 reward weighted votes * 100% multiplier = 63.24 reward weighted power
        voter 2 = 31.62 reward weighted votes * 25x multiplier = 790.57 reward weighted power
        voter 3 = 31.62 reward weighted votes * 10% multiplier = 34.78 reward weighted power

        Total power = 888.60
        voter 1 allocation = 63.24 / 888.60 * 100 = 7.11%
        voter 2 allocation = 790.57 / 888.60 * 100 = 88.96%
        voter 3 allocation = 34.78 / 888.60 * 100 = 3.91%
      */
      expect(await voterRewards.cycleToTotal(2)).to.equal(ethers.parseEther("888.6000224881")) // Total reward weighted votes
      expect(await voterRewards.cycleToVoterToTotal(2, voter1)).to.equal(ethers.parseEther("63.245553202")) // Voter 1 reward weighted votes
      expect(await voterRewards.cycleToVoterToTotal(2, voter2)).to.equal(ethers.parseEther("790.569415025")) // Voter 2 reward weighted votes
      expect(await voterRewards.cycleToVoterToTotal(2, voter3)).to.equal(ethers.parseEther("34.7850542611")) // Voter 3 reward weighted votes

      /*
        voter 1 = 31.62 reward weighted votes * 100% multiplier = 63.24 reward weighted power
        voter 2 = 31.62 reward weighted votes * 25x multiplier = 790.57 reward weighted power
        voter 3 = 31.62 reward weighted votes * 10% multiplier = 34.78 reward weighted power

        Total power = 888.60
        voter 1 allocation = 63.24 / 888.60 * 100 = 7.11%
        voter 2 allocation = 790.57 / 888.60 * 100 = 88.96%
        voter 3 allocation = 34.78 / 888.60 * 100 = 3.91%
      */
      expect(await voterRewards.getReward(2, voter1.address)).to.equal(142348754448398576512455n) // 7.11%
      expect(await voterRewards.getReward(2, voter2.address)).to.equal(1779359430604982206405693n) // 88.96%
      expect(await voterRewards.getReward(2, voter3.address)).to.equal(78291814946619217081850n) // 3.91%
    })

    it("Should have correct GM NFT level even if user transfers after voting round snapshot", async () => {
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
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
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

      await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.getHighestLevel(voter1.address)).to.equal(5)

      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      const roundId2 = await xAllocationVoting.currentRoundId()

      expect(roundId2).to.equal(2)

      expect(await xAllocationVoting.roundDeadline(roundId2)).to.lt(await emissions.getNextCycleBlock())

      await waitForNextBlock()

      // Transfer GM NFT to another account
      await galaxyMember.connect(voter1).transferFrom(voter1.address, voter2.address, 0)

      expect(await galaxyMember.getHighestLevel(voter2.address)).to.equal(5)

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
      expect(await voterRewards.getReward(2, voter1.address)).to.equal(1000000000000000000000000n) // Even if voter1 transferred the NFT, at the time of the round snapshot he had a level 5 NFT (thus he should get the rewards of a level 5 NFT)
      expect(await voterRewards.getReward(2, voter2.address)).to.equal(500000000000000000000000n)
      expect(await voterRewards.getReward(2, voter3.address)).to.equal(500000000000000000000000n)
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
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
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

      await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.getHighestLevel(voter1.address)).to.equal(5)

      // Send GM NFT to another account
      await galaxyMember.connect(voter1).transferFrom(voter1.address, voter2.address, 0)

      expect(await galaxyMember.getHighestLevel(voter2.address)).to.equal(5)

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
      expect(await voterRewards.getReward(2, voter1.address)).to.equal(500000000000000000000000n)
      expect(await voterRewards.getReward(2, voter2.address)).to.equal(1000000000000000000000000n) // Voter 2 has the NFT transferred from voter 1 of level 5 before the round snapshot
      expect(await voterRewards.getReward(2, voter3.address)).to.equal(500000000000000000000000n)
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

      expect(await b3tr.balanceOf(voter1.address)).to.equal(await emissions.getVote2EarnAmount(1)) // Only voter thus all rewards

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
        governor,
        B3trContract,
        veBetterPassport,
        emissions,
        voterRewards,
        minterAccount,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

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
      const config = createTestConfig()
      config.B3TR_GOVERNOR_VOTING_THRESHOLD = ethers.parseEther("0")
      config.INITIAL_X_ALLOCATION = BigInt("66666666666666666666666")

      const {
        otherAccounts,
        otherAccount: voter1,
        b3tr,
        governor,
        B3trContract,
        veBetterPassport,
        voterRewards,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await bootstrapAndStartEmissions()

      const voter2 = otherAccounts[1]

      await getVot3Tokens(voter1, "1000")

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.toggleCheck(1)

      // Now we can create a new proposal
      const tx = await createProposal(b3tr, B3trContract, voter1, description, functionToCall, [])
      const proposalId = await getProposalIdFromTx(tx)
      await payDeposit(proposalId, voter1)

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

    it("Should be able to increase voting rewards by upgrading GM NFT", async () => {
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
        veBetterPassport,
        voterRewards,
        treasury,
        xAllocationVoting,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
        },
      })

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      const voter2 = otherAccounts[1]
      const proposar = otherAccounts[2]

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(voter1, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(proposar, "2000")

      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      let tx = await createProposal(b3tr, B3trContract, proposar, description, functionToCall, [])
      let proposalId = await getProposalIdFromTx(tx)
      await payDeposit(proposalId, proposar)

      let cycle = await governor.proposalStartRound(proposalId)

      const proposalState = await waitForProposalToBeActive(proposalId)

      expect(proposalState).to.equal("1") // Active

      // Vote on the proposal
      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      await waitForNextCycle()

      expect(await voterRewards.getReward(cycle, voter1.address)).to.equal(1000000000000000000000000n) // 50% of the rewards
      expect(await voterRewards.getReward(cycle, voter2.address)).to.equal(1000000000000000000000000n) // 50% of the rewards

      await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

      // GM NFT token mint and upgrade
      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      tx = await createProposal(b3tr, B3trContract, proposar, description + "1", functionToCall, [])
      proposalId = await getProposalIdFromTx(tx)
      await payDeposit(proposalId, proposar)
      cycle = await governor.proposalStartRound(proposalId)

      await waitForProposalToBeActive(proposalId)

      await governor.connect(voter1).castVote(proposalId, 1) // For
      await governor.connect(voter2).castVote(proposalId, 1) // For

      await waitForNextCycle()

      /*
        voter1 = 1000 votes (31.62 reward weighted votes) for governance voting * 100% multiplier = 63.24 reward weighted power
        voter2 = 1000 votes (31.62 reward weighted votes) for governance voting without NFT upgrade = 31.62 reward weighted power

        Total power = 94.86
        voter1 allocation = 63.24 / 94.86 * 100 = 66.67%
        voter2 allocation = 31.62 / 94.86 * 100 = 33.33%
      */
      expect(await voterRewards.getReward(cycle, voter1.address)).to.equal(1333333333333333333333333n)
      expect(await voterRewards.getReward(cycle, voter2.address)).to.equal(666666666666666666666666n)
    })
  })

  describe("X allocation & governance voting rewards", () => {
    const description = "Test Proposal: testing propsal with random description!"
    const functionToCall = "tokenDetails"

    it("QUADRATIC REWARDING ENABLED: Should calculate rewards correctly for governance voting and x allocation voting", async () => {
      const config = createTestConfig()
      const {
        otherAccounts,
        otherAccount: voter1,
        b3tr,
        governor,
        B3trContract,
        veBetterPassport,
        emissions,
        minterAccount,
        owner,
        voterRewards,
        xAllocationVoting,
        treasury,
        x2EarnApps,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
      })

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))

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

      // Quadratic rewarding enabled
      expect(await voterRewards.isQuadraticRewardingDisabledForCurrentCycle()).to.be.false

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

      expect(await xAllocationVoting.roundDeadline(xAllocationsRoundID)).to.lt(await emissions.getNextCycleBlock())

      // Upgrading GM NFT
      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.getHighestLevel(voter1.address)).to.equal(5)

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

      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(800000000000000000000000n) // 40% (Notice that voter1 has a level 5 NFT but didn't increase the rewards, this is because the snapshot of the proposal was taken before the NFT upgrade)
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

      /*
        voter 1 = 1000 votes (reward weighted votes 31.26) for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = reward weighted votes 63.24 * 100% multiplier = 126.48 total reward weighted votes
        voter 2 votes = 1000 votes (reward weighted votes 31.26) for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = reward weighted votes 63.24 with no multiplier = 63.2 total reward weighted votes
        voter 3 votes = 0 votes for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = reward weighted votes 31.62 with no multiplier = 31.62 total reward weighted votes

        Total reward weighted votes = 221.32 (126.48 + 63.24 + 31.62) = 221.32
        Total rewards = 2000000000000000000000000 (2,000,000 B3TR)
        voter 1 allocation = 126.48 / 221.32 * 100 = 57.14%
        voter 2 allocation = 63.24 / 221.32 * 100 = 28.57%
        voter 3 allocation = 31.62 / 221.32 * 100 = 14.29%
      */
      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(1142857142857142857142857n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(571428571428571428571428n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(285714285714285714285714n)
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
        voterRewards,
        xAllocationVoting,
        veBetterPassport,
        treasury,
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

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))

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

      expect(await xAllocationVoting.roundDeadline(xAllocationsRoundID)).to.lt(await emissions.getNextCycleBlock())

      // Upgrading GM NFT
      await galaxyMember.connect(voter1).freeMint()

      await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.getHighestLevel(voter1.address)).to.equal(5)

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

      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(800000000000000000000000n) // 40% (Notice that voter1 has a level 5 NFT but didn't increase the rewards, this is because the snapshot of the proposal was taken before the NFT upgrade)
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

      /*
        voter 1 = 1000 votes for governance voting and 1000 votes for x allocation voting = reward weighted votes 2000 * 100% multiplier = 4000 total reward weighted votes
        voter 2 votes = 1000 votes for governance voting and 1000 votes for x allocation voting = reward weighted votes 2000 with no multiplier = 2000 total reward weighted votes
        voter 3 votes = 0 votes for governance voting and 1000 votes for x allocation voting = reward weighted votes 1000 with no multiplier = 1000 total reward weighted votes

        Total reward weighted votes = 7000 (4000 + 2000 + 1000) = 7000
        Voter 1 allocation = 4000 / 7000 * 100 = 57.14%
        Voter 2 allocation = 2000 / 7000 * 100 = 28.57%
        Voter 3 allocation = 1000 / 7000 * 100 = 14.29%
      */
      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(1142857142857142857142857n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(571428571428571428571428n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(285714285714285714285714n)
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
        xAllocationVoting,
        treasury,
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

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))

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

      await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.getHighestLevel(voter1.address)).to.equal(5)

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
        voter 1 = 1000 votes for governance voting and 1000 votes for x allocation voting = reward weighted votes 2000 * 100% multiplier = 4000 total reward weighted votes
        voter 2 votes = 1000 votes for governance voting and 1000 votes for x allocation voting = reward weighted votes 2000 with no multiplier = 2000 total reward weighted votes
        voter 3 votes = 0 votes for governance voting and 1000 votes for x allocation voting = reward weighted votes 1000 with no multiplier = 1000 total reward weighted votes

        Total reward weighted votes = 7000 (4000 + 2000 + 1000) = 7000
        Voter 1 allocation = 4000 / 7000 * 100 = 57.14%
        Voter 2 allocation = 2000 / 7000 * 100 = 28.57%
        Voter 3 allocation = 1000 / 7000 * 100 = 14.29%
      */
      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(1142857142857142857142857n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(571428571428571428571428n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(285714285714285714285714n)
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
        owner,
        voterRewards,
        veBetterPassport,
        xAllocationVoting,
        treasury,
        x2EarnApps,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config: {
          ...config,
          EMISSIONS_CYCLE_DURATION: 200,
          B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 0,
        },
      })

      expect(await voterRewards.isQuadraticRewardingDisabledAtBlock(await ethers.provider.getBlockNumber())).to.be.false

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await voterRewards.setGalaxyMember(await galaxyMember.getAddress())

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))

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

      await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

      expect(await galaxyMember.getHighestLevel(voter1.address)).to.equal(5)

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

      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(800000000000000000000000n) // 40% (Notice that voter1 has a level 5 NFT but didn't increase the rewards, this is because the snapshot of the proposal was taken before the NFT upgrade)
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

      /*
        voter 1 = 1000 votes (reward weighted votes 31.26) for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = reward weighted votes 63.24 * 100% multiplier = 126.48 total reward weighted votes
        voter 2 votes = 1000 votes (reward weighted votes 31.26) for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = reward weighted votes 63.24 with no multiplier = 63.2 total reward weighted votes
        voter 3 votes = 0 votes for governance voting and 1000 votes (reward weighted votes 31.26) for x allocation voting = reward weighted votes 31.62 with no multiplier = 31.62 total reward weighted votes

        Total reward weighted votes = 221.32 (126.48 + 63.24 + 31.62) = 221.32
        Total rewards = 2000000000000000000000000 (2,000,000 B3TR)
        voter 1 allocation = 126.48 / 221.32 * 100 = 57.14%
        voter 2 allocation = 63.24 / 221.32 * 100 = 28.57%
        voter 3 allocation = 31.62 / 221.32 * 100 = 14.29%
      */
      expect(await voterRewards.getReward(xAllocationsRoundID, voter1.address)).to.equal(1142857142857142857142857n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter2.address)).to.equal(571428571428571428571428n)
      expect(await voterRewards.getReward(xAllocationsRoundID, voter3.address)).to.equal(285714285714285714285714n)
    })
  })
})
