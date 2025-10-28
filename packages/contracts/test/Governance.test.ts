import { ethers } from "hardhat"
import { assert, expect } from "chai"
import {
  createProposal,
  getOrDeployContractInstances,
  getProposalIdFromTx,
  getVot3Tokens,
  waitForNextBlock,
  waitForVotingPeriodToEnd,
  catchRevert,
  waitForProposalToBeActive,
  participateInGovernanceVoting,
  bootstrapAndStartEmissions,
  waitForCurrentRoundToEnd,
  moveBlocks,
  createProposalAndExecuteIt,
  createProposalWithMultipleFunctionsAndExecuteIt,
  payDeposit,
  bootstrapEmissions,
  ZERO_ADDRESS,
  waitForQueuedProposalToBeReady,
  waitForNextCycle,
  getEventName,
  moveToCycle,
} from "./helpers"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { describe, it } from "mocha"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { B3TRGovernor, B3TRGovernorV1, B3TRGovernorV3, B3TRGovernor__factory } from "../typechain-types"
import { deployAndUpgrade, deployProxy } from "../scripts/helpers"
import { GRANT_PROPOSAL_TYPE, STANDARD_PROPOSAL_TYPE } from "./governance/fixture.test"

describe("Governor and TimeLock - @shard4a", function () {
  describe("Governor deployment", function () {
    it("Should set constructors correctly", async function () {
      const config = createLocalConfig()
      const { governor, vot3, b3tr, owner, timeLock, xAllocationVoting, voterRewards } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await bootstrapAndStartEmissions()

      const votingPeriod = await governor.votingPeriod()
      const minVotingDelay = await governor.minVotingDelay()
      expect(votingPeriod).to.eql(await xAllocationVoting.votingPeriod())
      expect(minVotingDelay.toString()).to.eql(config.B3TR_GOVERNOR_MIN_VOTING_DELAY.toString())

      const xAllocationVotingAddress = await governor.xAllocationVoting()
      const voterRewardsAddress = await governor.voterRewards()

      expect(xAllocationVotingAddress).to.eql(await xAllocationVoting.getAddress())
      expect(voterRewardsAddress).to.eql(await voterRewards.getAddress())

      // proposers votes should be 0
      const clock = await governor.clock()
      const proposerVotes = await governor.getVotes(owner, (clock - BigInt(1)).toString())
      expect(proposerVotes.toString()).to.eql("0")

      // check name of the governor contract
      const name = await governor.name()
      expect(name).to.eql("B3TRGovernor")

      // check that the VOT3 address is correct
      const voteTokenAddress = await governor.token()
      expect(voteTokenAddress).to.eql(await vot3.getAddress())

      // check that the TimeLock address is correct
      const timeLockAddress = await governor.timelock()
      expect(timeLockAddress).to.eql(await timeLock.getAddress())

      // clock mode is set correctly
      const clockMode = await governor.CLOCK_MODE()
      expect(clockMode.toString()).to.eql("mode=blocknumber&from=default")

      // check version
      const version = await governor.version()
      expect(version).to.eql("8")

      // STANDARD deposit threshold is set correctly
      const standardDepositThreshold = await governor.depositThresholdPercentageByProposalType(STANDARD_PROPOSAL_TYPE)
      expect(standardDepositThreshold.toString()).to.eql(config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD.toString())

      // GRANT deposit threshold is set correctly
      const grantDepositThreshold = await governor.depositThresholdPercentageByProposalType(GRANT_PROPOSAL_TYPE)
      expect(grantDepositThreshold.toString()).to.eql(config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD.toString())

      // STANDARD voting threshold is set correctly
      const standardVotingThreshold = await governor.votingThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      expect(standardVotingThreshold.toString()).to.eql(config.B3TR_GOVERNOR_VOTING_THRESHOLD.toString())

      // GRANT voting threshold is set correctly
      const grantVotingThreshold = await governor.votingThresholdByProposalType(GRANT_PROPOSAL_TYPE)
      expect(grantVotingThreshold.toString()).to.eql(config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD.toString())

      // counting mode is set correctly
      const countingMode = await governor.COUNTING_MODE()
      expect(countingMode.toString()).to.eql("support=bravo&quorum=for,abstain,against")

      // should be unpaused
      const paused = await governor.paused()
      expect(paused).to.be.false

      // b3tr address is set correctly
      const b3trAddress = await governor.b3tr()
      expect(b3trAddress).to.eql(await b3tr.getAddress())
    })

    it("Should be able to upgrade the governor contract through governance", async function () {
      const {
        governor,
        owner,
        otherAccount,
        b3tr,
        emissions,
        xAllocationVoting,
        vot3,
        governorClockLogicLibV1,
        governorConfiguratorLibV1,
        governorDepositLogicLibV1,
        governorFunctionRestrictionsLogicLibV1,
        governorProposalLogicLibV1,
        governorQuorumLogicLibV1,
        governorStateLogicLibV1,
        governorVotesLogicLibV1,
        veBetterPassport,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("B3TRGovernorV1", {
        libraries: {
          GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
          GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
          GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
          GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
          GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
          GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
          GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
          GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
        },
      })
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      await veBetterPassport.whitelist(otherAccount.address)
      await veBetterPassport.toggleCheck(1)

      // V1 Contract
      const V1Contract = await ethers.getContractAt("B3TRGovernor", await governor.getAddress())

      // Now we can create a proposal
      const encodedFunctionCall = V1Contract.interface.encodeFunctionData("upgradeToAndCall", [
        await implementation.getAddress(),
        "0x",
      ])
      const description = "Upgrading Governance contracts"
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
      const currentRoundId = await xAllocationVoting.currentRoundId()

      const tx = await governor
        .connect(owner)
        .propose([await governor.getAddress()], [0], [encodedFunctionCall], description, currentRoundId + 1n, 0, {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx)

      // Pay the proposal deposit
      const deposit = await governor.proposalDepositThreshold(proposalId)
      await getVot3Tokens(owner, ethers.formatEther(deposit))
      await vot3.connect(owner).approve(await governor.getAddress(), ethers.parseEther(deposit.toString()))
      await governor.connect(owner).deposit(deposit, proposalId)

      await getVot3Tokens(otherAccount, "10000")

      await waitForProposalToBeActive(proposalId)

      await governor.connect(otherAccount).castVote(proposalId, 1)
      await waitForVotingPeriodToEnd(proposalId)
      expect(await governor.state(proposalId)).to.eql(4n) // succeded

      await governor.queue([await governor.getAddress()], [0], [encodedFunctionCall], descriptionHash)
      expect(await governor.state(proposalId)).to.eql(5n)

      await governor.execute([await governor.getAddress()], [0], [encodedFunctionCall], descriptionHash)
      expect(await governor.state(proposalId)).to.eql(6n)

      await governor.connect(owner).withdraw(proposalId, owner.address)
      await vot3.connect(owner).approve(await governor.getAddress(), ethers.parseEther("1000"))

      const newImplAddress = await getImplementationAddress(ethers.provider, await governor.getAddress())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())

      // Blacklist the old upgradeToAndCall function
      const funcSig = V1Contract.interface.getFunction("upgradeToAndCall")?.selector

      // Check that the new implementation works
      const newGovernor = Contract.attach(await governor.getAddress()) as B3TRGovernor

      const tx1 = await newGovernor.connect(owner).setWhitelistFunction(b3tr, funcSig, true) // whitelist the function for b3tr contract
      const receipt = await tx1.wait()

      const name = getEventName(receipt, newGovernor)
      expect(name).to.eql("FunctionWhitelisted")

      // start new round
      await emissions.distribute()

      // create a new proposal
      const newTx = await newGovernor
        .connect(owner)
        .propose(
          [await b3tr.getAddress()],
          [0],
          [encodedFunctionCall],
          description,
          (await xAllocationVoting.currentRoundId()) + 1n,
          ethers.parseEther("1000"),
          {
            gasLimit: 10_000_000,
          },
        )
      const proposeReceipt = await newTx.wait()
      const event = proposeReceipt?.logs[3]
      const decodedLogs = newGovernor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })
      const newProposalId = decodedLogs?.args[0]

      expect(newProposalId).to.exist
      // expect data of previous contract to be untouched
      expect(await governor.state(proposalId)).to.eql(6n)
      expect(await governor.quorumReached(proposalId)).to.eql(true)
    })

    it("Should be able to upgrade the governor contract through governance when libraries change", async function () {
      const {
        governorClockLogicLibV1,
        governorConfiguratorLibV1,
        governorDepositLogicLibV1,
        governorFunctionRestrictionsLogicLibV1,
        governorProposalLogicLibV1,
        governorQuorumLogicLibV1,
        governorStateLogicLibV1,
        governorVotesLogicLibV1,
      } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      const { governor, owner, otherAccount, xAllocationVoting, vot3, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await veBetterPassport.whitelist(otherAccount.address)
      await veBetterPassport.toggleCheck(1)

      // Start emissions
      await bootstrapAndStartEmissions()

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("B3TRGovernorV1", {
        libraries: {
          GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
          GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
          GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
          GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
          GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
          GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
          GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
          GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
        },
      })
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      // V1 Contract
      const V1Contract = await ethers.getContractAt("B3TRGovernor", await governor.getAddress())

      // Now we can create a proposal
      const encodedFunctionCall = V1Contract.interface.encodeFunctionData("upgradeToAndCall", [
        await implementation.getAddress(),
        "0x",
      ])
      const description = "Upgrading Governance contracts"
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
      const currentRoundId = await xAllocationVoting.currentRoundId()

      const tx = await governor
        .connect(owner)
        .propose([await governor.getAddress()], [0], [encodedFunctionCall], description, currentRoundId + 1n, 0, {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx)

      // Pay the proposal deposit
      const deposit = await governor.proposalDepositThreshold(proposalId)
      await getVot3Tokens(owner, ethers.formatEther(deposit))
      await vot3.connect(owner).approve(await governor.getAddress(), ethers.parseEther(deposit.toString()))
      await governor.connect(owner).deposit(deposit, proposalId)

      await getVot3Tokens(otherAccount, "10000")

      await waitForProposalToBeActive(proposalId)

      await governor.connect(otherAccount).castVote(proposalId, 1)
      await waitForVotingPeriodToEnd(proposalId)
      expect(await governor.state(proposalId)).to.eql(4n) // succeded

      await governor.queue([await governor.getAddress()], [0], [encodedFunctionCall], descriptionHash)
      expect(await governor.state(proposalId)).to.eql(5n)

      await governor.execute([await governor.getAddress()], [0], [encodedFunctionCall], descriptionHash)
      expect(await governor.state(proposalId)).to.eql(6n)

      await governor.connect(owner).withdraw(proposalId, owner.address)
      await vot3.connect(owner).approve(await governor.getAddress(), ethers.parseEther("1000"))

      const newImplAddress = await getImplementationAddress(ethers.provider, await governor.getAddress())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())

      // Check that the new implementation works
      const newGovernor = Contract.attach(await governor.getAddress()) as B3TRGovernor

      expect(await newGovernor.quorumDenominator()).to.equal(100)
    })

    it("Only governance can upgrade the governor contract", async function () {
      const { governor, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(governor.connect(otherAccount).upgradeToAndCall(otherAccount.address, "0x")).to.be.reverted
    })

    it("Should be able to initialize only once", async function () {
      const config = createLocalConfig()
      const {
        b3tr,
        owner,
        vot3,
        timeLock,
        xAllocationVoting,
        voterRewards,
        governorClockLogicLibV1,
        governorConfiguratorLibV1,
        governorDepositLogicLibV1,
        governorFunctionRestrictionsLogicLibV1,
        governorProposalLogicLibV1,
        governorQuorumLogicLibV1,
        governorStateLogicLibV1,
        governorVotesLogicLibV1,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

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
          GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
          GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
          GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
          GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
          GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
          GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
          GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
          GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
        },
      )) as B3TRGovernorV1

      await catchRevert(
        governorV1.initialize(
          {
            vot3Token: await vot3.getAddress(),
            timelock: await timeLock.getAddress(),
            xAllocationVoting: await xAllocationVoting.getAddress(),
            b3tr: await b3tr.getAddress(),
            quorumPercentage: 1, // quorum percentage
            initialDepositThreshold: 1, // voting threshold
            initialMinVotingDelay: 1, // delay before vote starts
            initialVotingThreshold: 1, // voting threshold
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
        ),
      )
    })

    it("Should not be able to set function whitelist if not governance nor admin", async function () {
      const { governor, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(governor.connect(otherAccount).setWhitelistFunction(governor, "0x12345678", true))

      await governor.connect(owner).setWhitelistFunction(governor, "0x12345678", false) // Does not revert as owner is the admin
    })

    it("Should not be able to call setIsFunctionRestrictionEnabled if not governance nor admin", async function () {
      const { governor, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(governor.connect(otherAccount).setIsFunctionRestrictionEnabled(true))

      await governor.connect(owner).setIsFunctionRestrictionEnabled(true) // Doesn't revert as owner is the admin
    })

    it("Should not be able to set whitelist functions if not governance nor admin", async function () {
      const { governor, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(
        governor.connect(otherAccount).setWhitelistFunctions(await governor.getAddress(), ["0x12345678"], true),
      )

      await governor.connect(owner).setWhitelistFunctions(await governor.getAddress(), ["0x12345678"], false) // Admin can perform the onlyAdminOrGovernance restricted method
    })

    it("Should revert if the governor admin is set to the zero address during initilization", async function () {
      const config = createLocalConfig()
      const {
        b3tr,
        owner,
        vot3,
        timeLock,
        xAllocationVoting,
        voterRewards,
        governorClockLogicLibV1,
        governorConfiguratorLibV1,
        governorDepositLogicLibV1,
        governorFunctionRestrictionsLogicLibV1,
        governorProposalLogicLibV1,
        governorQuorumLogicLibV1,
        governorStateLogicLibV1,
        governorVotesLogicLibV1,
      } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(
        deployProxy(
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
              governorAdmin: ZERO_ADDRESS,
              pauser: owner.address,
              contractsAddressManager: owner.address,
              proposalExecutor: owner.address,
              governorFunctionSettingsRoleAddress: owner.address,
            },
          ],
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
        ),
      ).to.be.reverted
    })

    it("Should revert if the governor timelock is set to the zero address during initilization", async function () {
      const config = createLocalConfig()
      const {
        b3tr,
        owner,
        vot3,
        xAllocationVoting,
        voterRewards,
        governorClockLogicLibV1,
        governorConfiguratorLibV1,
        governorDepositLogicLibV1,
        governorFunctionRestrictionsLogicLibV1,
        governorProposalLogicLibV1,
        governorQuorumLogicLibV1,
        governorStateLogicLibV1,
        governorVotesLogicLibV1,
      } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(
        deployProxy(
          "B3TRGovernorV1",
          [
            {
              vot3Token: await vot3.getAddress(),
              timelock: ZERO_ADDRESS,
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
            GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
          },
        ),
      ).to.be.reverted
    })

    it("Should revert if the B3TR address is set to the zero address during initilization", async function () {
      const config = createLocalConfig()
      const {
        owner,
        vot3,
        timeLock,
        xAllocationVoting,
        voterRewards,
        governorClockLogicLibV1,
        governorConfiguratorLibV1,
        governorDepositLogicLibV1,
        governorFunctionRestrictionsLogicLibV1,
        governorProposalLogicLibV1,
        governorQuorumLogicLibV1,
        governorStateLogicLibV1,
        governorVotesLogicLibV1,
      } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(
        deployProxy(
          "B3TRGovernorV1",
          [
            {
              vot3Token: await vot3.getAddress(),
              timelock: await timeLock.getAddress(),
              xAllocationVoting: await xAllocationVoting.getAddress(),
              b3tr: ZERO_ADDRESS,
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
            GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
          },
        ),
      ).to.be.reverted
    })

    it("Should revert if the VOT3 address is set to the zero address during initilization", async function () {
      const config = createLocalConfig()
      const {
        b3tr,
        owner,
        timeLock,
        xAllocationVoting,
        voterRewards,
        governorClockLogicLibV1,
        governorConfiguratorLibV1,
        governorDepositLogicLibV1,
        governorFunctionRestrictionsLogicLibV1,
        governorProposalLogicLibV1,
        governorQuorumLogicLibV1,
        governorStateLogicLibV1,
        governorVotesLogicLibV1,
      } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(
        deployProxy(
          "B3TRGovernorV1",
          [
            {
              vot3Token: ZERO_ADDRESS,
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
            GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
          },
        ),
      ).to.be.reverted
    })

    it("Should revert if the xAllocationVoting address is set to the zero address during initilization", async function () {
      const config = createLocalConfig()
      const {
        b3tr,
        owner,
        vot3,
        timeLock,
        voterRewards,
        governorClockLogicLibV1,
        governorConfiguratorLibV1,
        governorDepositLogicLibV1,
        governorFunctionRestrictionsLogicLibV1,
        governorProposalLogicLibV1,
        governorQuorumLogicLibV1,
        governorStateLogicLibV1,
        governorVotesLogicLibV1,
      } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(
        deployProxy(
          "B3TRGovernorV1",
          [
            {
              vot3Token: await vot3.getAddress(),
              timelock: await timeLock.getAddress(),
              xAllocationVoting: ZERO_ADDRESS,
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
            GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
          },
        ),
      ).to.be.reverted
    })

    it("Should revert if the voterRewards address is set to the zero address during initilization", async function () {
      const config = createLocalConfig()
      const {
        b3tr,
        owner,
        vot3,
        timeLock,
        xAllocationVoting,
        governorClockLogicLibV1,
        governorConfiguratorLibV1,
        governorDepositLogicLibV1,
        governorFunctionRestrictionsLogicLibV1,
        governorProposalLogicLibV1,
        governorQuorumLogicLibV1,
        governorStateLogicLibV1,
        governorVotesLogicLibV1,
      } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(
        deployProxy(
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
              voterRewards: ZERO_ADDRESS,
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
            GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
          },
        ),
      ).to.be.reverted
    })

    it("Should not have state conflict after upgrading to V4 and V5", async () => {
      const config = createLocalConfig()
      const {
        owner,
        b3tr,
        timeLock,
        voterRewards,
        vot3,
        timelockAdmin,
        xAllocationVoting,
        governorClockLogicLib,
        governorConfiguratorLib,
        governorDepositLogicLib,
        governorFunctionRestrictionsLogicLib,
        governorProposalLogicLib,
        governorQuorumLogicLib,
        otherAccount,
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
        governorProposalLogicLibV5,
        governorQuorumLogicLibV5,
        governorStateLogicLibV5,
        governorVotesLogicLibV5,
        veBetterPassport,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await veBetterPassport.toggleCheck(4)

      // Deploy Governor
      const governorV4 = (await deployAndUpgrade(
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
              GovernorProposalLogicV5: await governorProposalLogicLibV5.getAddress(),
              GovernorQuorumLogicV5: await governorQuorumLogicLibV5.getAddress(),
              GovernorStateLogicV5: await governorStateLogicLibV5.getAddress(),
              GovernorVotesLogicV5: await governorVotesLogicLibV5.getAddress(),
            },
          ],
        },
      )) as B3TRGovernorV3

      const b3trGovernorFactory = await ethers.getContractFactory("B3TRGovernorV5", {
        libraries: {
          GovernorClockLogicV5: await governorClockLogicLibV5.getAddress(),
          GovernorConfiguratorV5: await governorConfiguratorLibV5.getAddress(),
          GovernorDepositLogicV5: await governorDepositLogicLibV5.getAddress(),
          GovernorFunctionRestrictionsLogicV5: await governorFunctionRestrictionsLogicLibV5.getAddress(),
          GovernorProposalLogicV5: await governorProposalLogicLibV5.getAddress(),
          GovernorQuorumLogicV5: await governorQuorumLogicLibV5.getAddress(),
          GovernorStateLogicV5: await governorStateLogicLibV5.getAddress(),
          GovernorVotesLogicV5: await governorVotesLogicLibV5.getAddress(),
        },
      })

      await voterRewards
        .connect(owner)
        .grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await governorV4.getAddress())

      // Grant Roles
      const PROPOSER_ROLE = await timeLock.PROPOSER_ROLE()
      const EXECUTOR_ROLE = await timeLock.EXECUTOR_ROLE()
      const CANCELLER_ROLE = await timeLock.CANCELLER_ROLE()
      await timeLock.connect(timelockAdmin).grantRole(PROPOSER_ROLE, await governorV4.getAddress())
      await timeLock.connect(timelockAdmin).grantRole(EXECUTOR_ROLE, await governorV4.getAddress())
      await timeLock.connect(timelockAdmin).grantRole(CANCELLER_ROLE, await governorV4.getAddress())

      // first add to the whitelist
      const funcSig = governorV4.interface.getFunction("updateQuorumNumerator")?.selector
      await governorV4.connect(owner).setWhitelistFunction(await governorV4.getAddress(), funcSig, true)
      const funcSig2 = governorV4.interface.getFunction("upgradeToAndCall")?.selector
      await governorV4.connect(owner).setWhitelistFunction(await governorV4.getAddress(), funcSig2, true)
      const newQuorum = 10n

      // load votes
      await getVot3Tokens(owner, "30000")
      await waitForNextBlock()

      await bootstrapAndStartEmissions()

      const roundId = ((await xAllocationVoting.currentRoundId()) + 1n).toString()

      const address = await governorV4.getAddress()
      const encodedFunctionCall = b3trGovernorFactory.interface.encodeFunctionData("updateQuorumNumerator", [newQuorum])

      const tx0 = await governorV4
        .connect(owner)
        .propose([address], [0], [encodedFunctionCall], "Update Quorum Percentage", roundId.toString(), 0, {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx0)

      const proposalThreshold = await governorV4.proposalDepositThreshold(proposalId)
      await getVot3Tokens(otherAccount, ethers.formatEther(proposalThreshold))
      // We also need to wait a block to update the proposer's votes snapshot
      await waitForNextBlock()
      await vot3.connect(otherAccount).approve(await governorV4.getAddress(), proposalThreshold)
      await governorV4.connect(otherAccount).deposit(proposalThreshold, proposalId)

      let proposalState = await governorV4.state(proposalId) // proposal id of the proposal in the beforeAll step

      if (proposalState.toString() !== "1")
        await moveToCycle(parseInt((await governorV4.proposalStartRound(proposalId)).toString()) + 1)

      // vote
      await governorV4.connect(owner).castVote(proposalId, 1, { gasLimit: 10_000_000 }) // vote for

      const deadline = await governorV4.proposalDeadline(proposalId)

      const currentBlock = await governorV4.clock()

      await moveBlocks(parseInt((deadline - currentBlock + BigInt(1)).toString()))

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("Update Quorum Percentage"))

      await governorV4.queue([address], [0], [encodedFunctionCall], descriptionHash, {
        gasLimit: 10_000_000,
      })

      await waitForNextBlock()

      await governorV4.execute([address], [0], [encodedFunctionCall], descriptionHash, {
        gasLimit: 10_000_000,
      })

      const updatedQuorum = await governorV4["quorumNumerator()"]()
      expect(updatedQuorum).to.eql(newQuorum)

      const initialSlot = BigInt("0xd09a0aaf4ab3087bae7fa25ef74ddd4e5a4950980903ce417e66228cf7dc7b00") // Slot 0 of VoterRewards

      let storageSlots = []

      for (let i = initialSlot; i < initialSlot + BigInt(50); i++) {
        storageSlots.push(await ethers.provider.getStorage(await governorV4.getAddress(), i))
      }

      storageSlots = storageSlots.filter(
        slot =>
          slot !== "0x0000000000000000000000000000000000000000000000000000000000000000" &&
          slot !== "0x0000000000000000000000000000000200000000000000000000000000000002",
      ) // removing empty slots and slots that track governance proposals getting executed on the governor

      // Upgrade to V7
      const ContractV7 = await ethers.getContractFactory("B3TRGovernor", {
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
      const implementationv5 = await ContractV7.deploy()
      await implementationv5.waitForDeployment()

      // Now we can create a proposal
      const tx5 = await governorV4.upgradeToAndCall(await implementationv5.getAddress(), "0x")
      await tx5.wait()

      const governorV7 = ContractV7.attach(await governorV4.getAddress()) as B3TRGovernor

      let storageSlotsAfter = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await governorV7.getAddress(), i))
      }

      storageSlotsAfter = storageSlotsAfter.filter(
        slot =>
          slot !== "0x0000000000000000000000000000000000000000000000000000000000000000" &&
          slot !== "0x0000000000000000000000000000000200000000000000000000000000000002",
      ) // removing empty slots and slots that track governance proposals getting executed on the governor

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      expect(await governorV7.version()).to.equal("8")
    })
  })

  describe("Governor settings", function () {
    let b3trGovernorFactory: B3TRGovernor__factory
    this.beforeAll(async function () {
      const {
        governorClockLogicLib,
        governorConfiguratorLib,
        governorDepositLogicLib,
        governorFunctionRestrictionsLogicLib,
        governorProposalLogicLib,
        governorQuorumLogicLib,
        governorStateLogicLib,
        governorVotesLogicLib,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      b3trGovernorFactory = await ethers.getContractFactory("B3TRGovernor", {
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
    })
    it("should be able to update the timelock address through governance", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // first add updateTimelock to the whitelist
      const funcSig = governor.interface.getFunction("updateTimelock")?.selector
      await governor.connect(owner).setWhitelistFunction(await governor.getAddress(), funcSig, true)

      const newAddress = ethers.Wallet.createRandom().address
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update TimeLock address",
        "updateTimelock",
        [newAddress],
      )

      const updatedAddress = await governor.timelock()
      expect(updatedAddress).to.eql(newAddress)
    })

    it("Should not be able to update the timelock if not governance", async function () {
      const { governor, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newAddress = ethers.Wallet.createRandom().address

      await catchRevert(governor.connect(otherAccount).updateTimelock(newAddress))

      const updatedAddress = await governor.timelock()
      expect(updatedAddress).to.not.eql(newAddress)
    })

    it("should be able to update the xAllocationVoting address through governance", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newAddress = ethers.Wallet.createRandom().address
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update xAllocationVoting address",
        "setXAllocationVoting",
        [newAddress],
      )

      const updatedAddress = await governor.xAllocationVoting()
      expect(updatedAddress).to.eql(newAddress)
    })

    it("Should not support invalid interface", async function () {
      const { governor } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const INVALID_ID = "0xffffffff"
      expect(await governor.supportsInterface(INVALID_ID)).to.eql(false)
    })

    it("Should support ERC 165 interface", async () => {
      const { governor } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await governor.supportsInterface("0x01ffc9a7")).to.equal(true) // ERC165
    })

    it("Admin with CONTRACTS_ADDRESS_MANAGER_ROLE can update xAllocationVoting address", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await governor.hasRole(await governor.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address)).to.eql(true)

      const newAddress = ethers.Wallet.createRandom().address
      await governor.connect(owner).setXAllocationVoting(newAddress)

      const updatedAddress = await governor.xAllocationVoting()
      expect(updatedAddress).to.eql(newAddress)
    })

    it("only governance or CONTRACTS_ADDRESS_MANAGER_ROLE can update xAllocationVoting address", async function () {
      const { governor, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await governor.hasRole(await governor.CONTRACTS_ADDRESS_MANAGER_ROLE(), otherAccount.address)).to.eql(
        false,
      )

      const newAddress = ethers.Wallet.createRandom().address

      await catchRevert(governor.connect(otherAccount).setXAllocationVoting(newAddress))

      const updatedAddress = await governor.xAllocationVoting()
      expect(updatedAddress).to.not.eql(newAddress)
    })

    it("can update voterRewards address through governance", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newAddress = ethers.Wallet.createRandom().address
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update Voter Rewards address",
        "setVoterRewards",
        [newAddress],
      )

      const updatedAddress = await governor.voterRewards()
      expect(updatedAddress).to.eql(newAddress)
    })

    it("Admin with CONTRACTS_ADDRESS_MANAGER_ROLE can update voterRewards address", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await governor.hasRole(await governor.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address)).to.eql(true)

      const newAddress = ethers.Wallet.createRandom().address

      await governor.connect(owner).setVoterRewards(newAddress)

      const updatedAddress = await governor.voterRewards()
      expect(updatedAddress).to.eql(newAddress)
    })

    it("Updating voterRewards address to zero address will revert", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(governor.connect(owner).setVoterRewards(ZERO_ADDRESS)).to.be.reverted
    })

    it("Updating xAllocationVoting address to zero address will revert", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(governor.connect(owner).setXAllocationVoting(ZERO_ADDRESS)).to.be.reverted
    })

    it("Updating timelock address to zero address will revert", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(governor.connect(owner).updateTimelock(ZERO_ADDRESS)).to.be.reverted
    })

    it("only governance or CONTRACTS_ADDRESS_MANAGER_ROLE can update voterRewards address", async function () {
      const { governor, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await governor.hasRole(await governor.CONTRACTS_ADDRESS_MANAGER_ROLE(), otherAccount.address)).to.eql(
        false,
      )

      const newAddress = ethers.Wallet.createRandom().address

      await catchRevert(governor.connect(otherAccount).setVoterRewards(newAddress))

      const updatedAddress = await governor.voterRewards()
      expect(updatedAddress).to.not.eql(newAddress)
    })

    it("can update proposal threshold through governance", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newThreshold = 10n
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update Deposit Threshold",
        "setProposalTypeDepositThresholdPercentage",
        [newThreshold, STANDARD_PROPOSAL_TYPE],
      )

      const updatedThreshold = await governor.depositThresholdPercentageByProposalType(STANDARD_PROPOSAL_TYPE)
      expect(updatedThreshold).to.eql(newThreshold)
    })

    it("only governance or default admin can update proposal threshold", async function () {
      const { governor, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newThreshold = 10n

      expect(await governor.hasRole(await governor.DEFAULT_ADMIN_ROLE(), otherAccount.address)).to.eql(false)

      await catchRevert(
        governor.connect(otherAccount).setProposalTypeDepositThresholdPercentage(newThreshold, STANDARD_PROPOSAL_TYPE),
      )

      const updatedThreshold = await governor.depositThresholdPercentageByProposalType(STANDARD_PROPOSAL_TYPE)
      expect(updatedThreshold).to.not.eql(newThreshold)

      expect(await governor.hasRole(await governor.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)

      await governor.connect(owner).setProposalTypeDepositThresholdPercentage(newThreshold, STANDARD_PROPOSAL_TYPE)
      expect(await governor.depositThresholdPercentageByProposalType(STANDARD_PROPOSAL_TYPE)).to.eql(newThreshold)
    })

    it("Cannot update proposal threshold to more than 100%", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newThreshold = 101n

      await catchRevert(
        createProposalAndExecuteIt(
          owner,
          owner,
          governor,
          b3trGovernorFactory,
          "Update Deposit Threshold",
          "setProposalTypeDepositThresholdPercentage",
          [newThreshold, STANDARD_PROPOSAL_TYPE],
        ),
      )

      const updatedThreshold = await governor.depositThresholdPercentageByProposalType(STANDARD_PROPOSAL_TYPE)
      expect(updatedThreshold).to.not.eql(newThreshold)
    })

    it("can update voting threshold through governance", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newThreshold = 10n
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update Voting Threshold",
        "setProposalTypeVotingThreshold",
        [newThreshold, STANDARD_PROPOSAL_TYPE],
      )

      const updatedThreshold = await governor.votingThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      expect(updatedThreshold).to.eql(newThreshold)
    })

    it("only governance or default admin can update voting threshold", async function () {
      const { governor, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newThreshold = 10n

      expect(await governor.hasRole(await governor.DEFAULT_ADMIN_ROLE(), otherAccount.address)).to.eql(false)

      await catchRevert(
        governor.connect(otherAccount).setProposalTypeVotingThreshold(newThreshold, STANDARD_PROPOSAL_TYPE),
      )

      const updatedThreshold = await governor.votingThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      expect(updatedThreshold).to.not.eql(newThreshold)

      expect(await governor.hasRole(await governor.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)

      await governor.connect(owner).setProposalTypeVotingThreshold(newThreshold, STANDARD_PROPOSAL_TYPE)
      expect(await governor.votingThresholdByProposalType(STANDARD_PROPOSAL_TYPE)).to.eql(newThreshold)
    })

    it("can update min voting delay through governance", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newDelay = 10n
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update Min Voting Delay",
        "setMinVotingDelay",
        [newDelay],
      )

      const updatedDelay = await governor.minVotingDelay()
      expect(updatedDelay).to.eql(newDelay)
    })

    it("Can fetch min voting delay", async function () {
      const { governor } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const delay = await governor.minVotingDelay()
      expect(delay).to.eql(1n)
    })

    it("only governance or default admin can update min voting delay", async function () {
      const { governor, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newDelay = 10n

      expect(await governor.hasRole(await governor.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)
      expect(await governor.hasRole(await governor.DEFAULT_ADMIN_ROLE(), otherAccount.address)).to.eql(false)

      await catchRevert(governor.connect(otherAccount).setMinVotingDelay(newDelay))

      const updatedDelay = await governor.minVotingDelay()
      expect(updatedDelay).to.not.eql(newDelay)

      await governor.connect(owner).setMinVotingDelay(newDelay)
      expect(await governor.minVotingDelay()).to.eql(newDelay)
    })

    it("Should not be able to create proposal of a restricted function", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const funcSig = governor.interface.getFunction("setMinVotingDelay")?.selector

      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update Min Voting Delay",
        "setWhitelistFunction",
        [await governor.getAddress(), funcSig, false], // restrict the function "setMinVotingDelay" from being called
      )

      const newDelay = 10n
      await expect(
        createProposalAndExecuteIt(
          owner,
          owner,
          governor,
          b3trGovernorFactory,
          "Update Min Voting Delay",
          "setMinVotingDelay",
          [newDelay],
        ),
      ).to.be.reverted

      // remove setMinVotingDelay from restricted functions
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update Min Voting Delay",
        "setWhitelistFunction",
        [await governor.getAddress(), funcSig, true],
      )

      // now the proposal should be successful
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update Min Voting Delay",
        "setMinVotingDelay",
        [newDelay],
      )
    })

    it("Should not be able to create a proposal with one of the restricted functions in the array of calldata", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // remove setVoterRewards from whitelisted functions
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Remove whitelist from voter rewards",
        "setWhitelistFunction",
        [await governor.getAddress(), governor.interface.getFunction("setVoterRewards")?.selector, false],
      )

      await expect(
        createProposalWithMultipleFunctionsAndExecuteIt(
          owner,
          owner,
          [governor, governor],
          b3trGovernorFactory,
          "Update Min Voting Delay And Voter Rewards",
          ["setMinVotingDelay", "setVoterRewards"],
          [[10n], [await owner.getAddress()]],
        ),
      ).to.be.reverted
    })

    it("Should be able to create proposal with multiple whitelist functions", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await createProposalWithMultipleFunctionsAndExecuteIt(
        owner,
        owner,
        [governor, governor],
        b3trGovernorFactory,
        "Update Min Voting Delay",
        ["setMinVotingDelay", "setProposalTypeDepositThresholdPercentage"],
        [[10n], [10n, STANDARD_PROPOSAL_TYPE]],
      )

      expect(await governor.minVotingDelay()).to.eql(10n)
      expect(await governor.depositThresholdPercentageByProposalType(STANDARD_PROPOSAL_TYPE)).to.eql(10n)
    })

    it("Should be able to execute any function if function restriction is disabled", async function () {
      const { governor, owner, xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Disable function restriction",
        "setIsFunctionRestrictionEnabled",
        [false],
      )

      // Set setMinVotingDelay as restricted
      const funcSig = governor.interface.getFunction("setMinVotingDelay")?.selector
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update Min Voting Delay",
        "setWhitelistFunction",
        [await governor.getAddress(), funcSig, false],
      )

      const newDelay = 10n
      // Should be able to execute the function even if it is restricted because function restriction is disabled
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update Min Voting Delay",
        "setMinVotingDelay",
        [newDelay],
      )

      // Set function restriction back to enabled
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Enable function restriction",
        "setIsFunctionRestrictionEnabled",
        [true],
        (await xAllocationVoting.currentRoundId()) + BigInt(2),
      )

      // Should not be able to execute the function now
      await expect(
        createProposalAndExecuteIt(
          owner,
          owner,
          governor,
          b3trGovernorFactory,
          "Update Min Voting Delay",
          "setMinVotingDelay",
          [newDelay],
        ),
      ).to.be.reverted
    })

    it("Should not restrict a target function if another target has the same function selector restricted", async () => {
      const { governor, owner, galaxyMember, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const b3trBalanceOfSelector = (await ethers.getContractFactory("B3TR")).interface.getFunction(
        "balanceOf",
      )?.selector
      const galxyMemberBalanceOfSelector = (await ethers.getContractFactory("GalaxyMember")).interface.getFunction(
        "balanceOf",
      )?.selector

      expect(b3trBalanceOfSelector).to.equal(galxyMemberBalanceOfSelector)

      // Whitelist B3TR 'balanceOf'
      await governor.connect(owner).setWhitelistFunction(await b3tr.getAddress(), b3trBalanceOfSelector as string, true)

      expect(await governor.isFunctionWhitelisted(await b3tr.getAddress(), b3trBalanceOfSelector as string)).to.equal(
        true,
      )

      // Should be able to propose and execute because balanceOf for B3TR contract is whitelisted
      await createProposalAndExecuteIt(
        owner,
        owner,
        b3tr,
        await ethers.getContractFactory("B3TR"),
        "Get balance",
        "balanceOf",
        [await owner.getAddress()],
      )

      // Should not be able to propose and execute because balanceOf for GalaxyMember contract is not whitelisted
      await expect(
        createProposalAndExecuteIt(
          owner,
          owner,
          galaxyMember,
          await ethers.getContractFactory("GalaxyMember"),
          "Get balance",
          "balanceOf",
          [await owner.getAddress()],
        ),
      ).to.be.reverted
    })

    it("Should revert if the target address is the zero address", async () => {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      const funcSig = governor.interface.getFunction("updateQuorumNumerator")?.selector
      await expect(governor.connect(owner).setWhitelistFunction(ZERO_ADDRESS, funcSig, true)).to.be.reverted
    })

    it("Should be able to update the quorum percentage through governance", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // first add updateTimelock to the whitelist
      const funcSig = governor.interface.getFunction("updateQuorumNumerator")?.selector
      await governor.connect(owner).setWhitelistFunction(await governor.getAddress(), funcSig, true)

      const newQuorum = 10n
      await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        b3trGovernorFactory,
        "Update Quorum Percentage",
        "updateQuorumNumerator",
        [newQuorum],
      )

      const updatedQuorum = await governor["quorumNumerator()"]()
      expect(updatedQuorum).to.eql(newQuorum)
    })

    it("Should not be able to update the quorum percentage if not governance", async function () {
      const { governor, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const newQuorum = 10n
      await catchRevert(
        createProposalAndExecuteIt(
          otherAccount,
          otherAccount,
          governor,
          b3trGovernorFactory,
          "Update Quorum Percentage",
          "updateQuorumNumerator",
          [newQuorum],
        ),
      )

      const updatedQuorum = await governor["quorumNumerator()"]()
      expect(updatedQuorum).to.not.eql(newQuorum)
    })

    it("Should not be able to set a quorum numerator higher than the denominator", async function () {
      const { governor, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // first add updateTimelock to the whitelist
      const funcSig = governor.interface.getFunction("updateQuorumNumerator")?.selector
      await governor.connect(owner).setWhitelistFunction(await governor.getAddress(), funcSig, true)

      const newQuorum = 101n
      try {
        await createProposalAndExecuteIt(
          owner,
          owner,
          governor,
          b3trGovernorFactory,
          "Update Quorum Percentage",
          "updateQuorumNumerator",
          [newQuorum],
        )

        assert.fail("Should revert")
      } catch (e) {
        // expect to revert
      }

      const updatedQuorum = await governor["quorumNumerator()"]()
      expect(updatedQuorum).to.not.eql(newQuorum)
    })

    it("Can get and set veBetterPassport address", async function () {
      const { governor, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await governor.connect(owner).setVeBetterPassport(owner.address)

      const updatedVeBetterPassportAddress = await governor.veBetterPassport()
      expect(updatedVeBetterPassportAddress).to.eql(owner.address)

      // only admin can set the veBetterPassport address
      await expect(governor.connect(otherAccount).setVeBetterPassport(otherAccount.address)).to.be.reverted
    })

    describe("Pausability", function () {
      it("Admin with PAUSER_ROLE should be able to pause the contract", async function () {
        const { governor, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const PAUSER_ROLE = await governor.PAUSER_ROLE()
        const hasRole = await governor.hasRole(PAUSER_ROLE, owner.address)
        expect(hasRole).to.be.true

        await governor.connect(owner).pause()

        expect(await governor.paused()).to.be.true
      })

      it("Admin with PAUSER_ROLE should be able to unpause the contract", async function () {
        const { governor, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const PAUSER_ROLE = await governor.PAUSER_ROLE()
        const hasRole = await governor.hasRole(PAUSER_ROLE, owner.address)
        expect(hasRole).to.be.true

        await governor.connect(owner).pause()
        expect(await governor.paused()).to.be.true

        await governor.connect(owner).unpause()
        expect(await governor.paused()).to.be.false
      })

      it("Only admin with PAUSER_ROLE can pause and unpause", async function () {
        const { governor, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const PAUSER_ROLE = await governor.PAUSER_ROLE()
        const hasRole = await governor.hasRole(PAUSER_ROLE, otherAccount.address)
        expect(hasRole).to.be.false

        await catchRevert(governor.connect(otherAccount).pause())
        await catchRevert(governor.connect(otherAccount).unpause())
      })

      it("When paused no proposals can be created", async function () {
        const { governor, owner, B3trContract, b3tr } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await governor.connect(owner).pause()

        const functionToCall = "tokenDetails"
        const description = "Get token details"

        await expect(
          createProposal(b3tr, B3trContract, owner, description, functionToCall, []),
        ).to.be.revertedWithCustomError(
          {
            interface: B3TRGovernor__factory.createInterface(),
          },
          "EnforcedPause",
        )
      })

      it("Cannot queue proposal when contract is paused", async function () {
        const {
          governor,
          b3tr,
          B3trContract,
          otherAccount: proposer,
          otherAccounts,
          owner,
          veBetterPassport,
        } = await getOrDeployContractInstances({ forceDeploy: true })
        const functionToCall = "tokenDetails"
        const description = "Get token details"

        // Start emissions
        await bootstrapAndStartEmissions()

        // load votes
        const voter = otherAccounts[0]
        await getVot3Tokens(voter, "30000")
        await waitForNextBlock()

        await veBetterPassport.whitelist(voter.address)
        await veBetterPassport.toggleCheck(1)

        // create a new proposal
        const tx = await createProposal(
          b3tr,
          B3trContract,
          proposer,
          description + ` ${this.test?.title}`,
          functionToCall,
          [],
        ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

        const proposalId = await getProposalIdFromTx(tx)

        await payDeposit(proposalId, proposer)

        // wait
        await waitForProposalToBeActive(proposalId)

        // vote
        await governor.connect(voter).castVote(proposalId, 1) // vote for

        // wait
        await waitForVotingPeriodToEnd(proposalId)
        let proposalState = await governor.state(proposalId)
        expect(proposalState.toString()).to.eql("4") // succeded

        // pause the contract
        await governor.connect(owner).pause()

        // queue it
        const b3trAddress = await b3tr.getAddress()
        const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
        const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description + ` ${this.test?.title}`))

        await expect(
          governor.queue([b3trAddress], [0], [encodedFunctionCall], descriptionHash),
        ).to.be.revertedWithCustomError(
          {
            interface: B3TRGovernor__factory.createInterface(),
          },
          "EnforcedPause",
        )

        // proposal should be in queued state
        proposalState = await governor.state(proposalId)
        expect(proposalState.toString()).to.eql("4")
      })

      it("Cannot execute proposal when contract is paused", async function () {
        const {
          governor,
          b3tr,
          B3trContract,
          otherAccount: proposer,
          otherAccounts,
          veBetterPassport,
          owner,
        } = await getOrDeployContractInstances({ forceDeploy: true })
        const functionToCall = "tokenDetails"
        const description = "Get token details"

        // Start emissions
        await bootstrapAndStartEmissions()

        // load votes
        const voter = otherAccounts[0]
        await getVot3Tokens(voter, "30000")
        await waitForNextBlock()

        await veBetterPassport.whitelist(voter.address)
        await veBetterPassport.toggleCheck(1)

        // create a new proposal
        const tx = await createProposal(
          b3tr,
          B3trContract,
          proposer,
          description + ` ${this.test?.title}`,
          functionToCall,
          [],
        ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

        const proposalId = await getProposalIdFromTx(tx)

        await payDeposit(proposalId, proposer)

        // wait
        await waitForProposalToBeActive(proposalId)

        // vote
        await governor.connect(voter).castVote(proposalId, 1) // vote for

        // wait
        await waitForVotingPeriodToEnd(proposalId)
        let proposalState = await governor.state(proposalId)
        expect(proposalState.toString()).to.eql("4") // succeded

        // queue it
        const b3trAddress = await b3tr.getAddress()
        const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
        const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description + ` ${this.test?.title}`))

        await governor.queue([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

        // proposal should be in queued state
        proposalState = await governor.state(proposalId)
        expect(proposalState.toString()).to.eql("5")

        // pause the contract
        await governor.connect(owner).pause()

        // execute it
        await expect(
          governor.execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash),
        ).to.be.revertedWithCustomError(
          {
            interface: B3TRGovernor__factory.createInterface(),
          },
          "EnforcedPause",
        )
      })
    })

    describe("Fallbacks", async function () {
      it("Can't send VET to the contract", async function () {
        const { governor, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await expect(
          owner.sendTransaction({
            to: await governor.getAddress(),
            value: ethers.parseEther("1.0"), // Sends exactly 1.0 ether
          }),
        ).to.be.reverted

        const balance = await ethers.provider.getBalance(await governor.getAddress())
        expect(balance).to.equal(0n)
      })

      it("Can't send ERC721 to the contract", async function () {
        const { myErc721, governor, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

        if (!myErc721) throw new Error("No ERC721 contract")

        await myErc721.connect(owner).safeMint(owner.address, 1)

        // @ts-ignore
        await expect(myErc721.connect(owner).safeTransferFrom(owner.address, await governor.getAddress(), 1)).to.be
          .rejected
      })

      it("Cannot send ERC1155 to the contract", async function () {
        const { myErc1155, governor, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

        if (!myErc1155) throw new Error("No ERC1155 contract")

        await myErc1155.connect(owner).mint(owner.address, 1, 1, "0x")

        // @ts-ignore
        await expect(myErc1155.connect(owner).safeTransferFrom(owner.address, await governor.getAddress(), 1, 1, "0x"))
          .to.be.reverted
      })

      it("Cannot batch send ERC1155 to the contract", async function () {
        const { myErc1155, governor, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

        if (!myErc1155) throw new Error("No ERC1155 contract")

        await myErc1155.connect(owner).mint(owner.address, 1, 2, "0x")
        await myErc1155.connect(owner).mint(owner.address, 2, 2, "0x")

        // @ts-ignore
        await expect(
          myErc1155
            .connect(owner)
            .safeBatchTransferFrom(owner.address, await governor.getAddress(), [1, 2], [2, 2], "0x"),
        ).to.be.reverted
      })
    })
  })

  describe("Proposal Creation", function () {
    it("When creating a proposal we should specify the round when it should become active", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      const currentRoundsEndsAt = await xAllocationVoting.currentRoundDeadline()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposeReceipt = await tx.wait()
      expect(proposeReceipt).not.to.be.null

      // Check that the ProposalCreated event was emitted with the correct parameters
      const event = proposeReceipt?.logs[3]
      expect(event).not.to.be.undefined

      const decodedLogs = governor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })

      // roundId when proposal will start
      expect(decodedLogs?.args[7]).to.eql(2n)

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(proposalId).not.to.be.null

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      expect(await governor.proposalSnapshot(proposalId)).to.eql(currentRoundsEndsAt + 1n) // proposal should start at the end of the current round + 1 block
      expect(await governor.proposalDeadline(proposalId)).to.eql(
        currentRoundsEndsAt + 1n + (await xAllocationVoting.votingPeriod()),
      ) // proposal should end at the end of the current round + 1 block + voting period

      expect(await governor.proposalStartRound(proposalId)).to.eql(2n) // proposal should start in round 2
    })

    it("Proposal cannot start in next round if current ended and the next one not started yet", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // We are in round 1 now, and we want to wait for it to wait and not start a new one
      await waitForCurrentRoundToEnd()
      await moveBlocks(2)

      // Now if we try to create a proposal starting in the next round it should fail
      expect(await governor.canProposalStartInNextRound()).to.be.false

      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n

      await expect(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0],
            [encodedFunctionCall],
            "",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      ).to.be.reverted
    })

    it("Proposal cannot start in next round there isn't enough delay", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      config.B3TR_GOVERNOR_MIN_VOTING_DELAY = 3
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      const minVotingDelay = await governor.minVotingDelay()
      expect(minVotingDelay).to.eql(3n)

      // Start emissions
      await bootstrapAndStartEmissions() //block 1, round ends in block 5

      await moveBlocks(2) // block 3, round 2 should start in 2 blocks

      // Now if we try to create a proposal starting in the next round it should fail
      expect(await governor.canProposalStartInNextRound()).to.be.false

      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n

      await expect(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0],
            [encodedFunctionCall],
            "",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      ).to.be.reverted
    })

    it("Can create a proposal that starts after 2 rounds", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, emissions, vot3, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Start emissions
      await bootstrapAndStartEmissions()

      const proposer = otherAccounts[0]
      const depositPreVOT3Tokens = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      await getVot3Tokens(proposer, (Number(ethers.formatEther(depositPreVOT3Tokens)) * 1.2).toString())
      const deposit = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      await vot3.connect(proposer).approve(await governor.getAddress(), deposit)

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 2n // starts 2 rounds from now

      const depositThreshold = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)

      await veBetterPassport.whitelist(proposer.address)
      await veBetterPassport.toggleCheck(1)

      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), deposit, {
          gasLimit: 10_000_000,
        })

      const proposeReceipt = await tx.wait()
      expect(proposeReceipt).not.to.be.null

      // Check that the ProposalCreated event was emitted with the correct parameters
      const event = proposeReceipt?.logs[3]
      expect(event).not.to.be.undefined

      const decodedLogs = governor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })

      // roundId when proposal will start
      expect(decodedLogs?.args[7]).to.eql(3n)
      // deposit threshold
      expect(decodedLogs?.args[8]).to.eql(depositThreshold)

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(proposalId).not.to.be.null

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      await waitForCurrentRoundToEnd()
      expect(await xAllocationVoting.currentRoundId()).to.eql(1n)
      expect(await governor.state(proposalId)).to.eql(0n) // pending
      await expect(governor.connect(proposer).castVote(proposalId, 0)).to.be.reverted

      await emissions.distribute()
      expect(await xAllocationVoting.currentRoundId()).to.eql(2n)
      expect(await governor.state(proposalId)).to.eql(0n) // pending
      await expect(governor.connect(proposer).castVote(proposalId, 0)).to.be.reverted

      await waitForCurrentRoundToEnd()
      expect(await xAllocationVoting.currentRoundId()).to.eql(2n)
      expect(await governor.state(proposalId)).to.eql(0n) // pending
      await expect(governor.connect(proposer).castVote(proposalId, 0)).to.be.reverted

      await emissions.distribute()
      expect(await xAllocationVoting.currentRoundId()).to.eql(3n)
      expect(await governor.state(proposalId)).to.eql(1n) // active
      await expect(governor.connect(proposer).castVote(proposalId, 0)).to.not.be.reverted
    })

    it("Proposal snapshot and deadline behaves correctly", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 0
      config.EMISSIONS_CYCLE_DURATION = 5
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, emissions, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")

      // Start emissions
      await bootstrapAndStartEmissions()

      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))
      const tx = await governor
        .connect(proposer)
        .propose(
          [await b3tr.getAddress()],
          [0],
          [B3trContract.interface.encodeFunctionData("tokenDetails", [])],
          "Creating some random proposal",
          (await xAllocationVoting.currentRoundId()) + 1n,
          ethers.parseEther("1000"),
          {
            gasLimit: 10_000_000,
          },
        )

      const proposalId = await getProposalIdFromTx(tx, true)

      // since round 2 did not start yet the proposal snapshot should be an estimation
      const snapshot = await governor.proposalSnapshot(proposalId)
      const currentRoundEndsAt = await xAllocationVoting.currentRoundDeadline()
      expect(snapshot).to.eql(currentRoundEndsAt + 1n)

      // same for the deadline
      const deadline = await governor.proposalDeadline(proposalId)
      expect(deadline).to.eql(currentRoundEndsAt + 1n + (await xAllocationVoting.votingPeriod()))

      // now we can simulate that the round starts with a few blocks of delay
      await waitForCurrentRoundToEnd()
      await moveBlocks(2)
      await emissions.distribute()

      // proposal should be active
      expect(await governor.state(proposalId)).to.eql(1n)

      // snapshot should be the start of the round and should be different from the estimated one
      const newSnapshot = await governor.proposalSnapshot(proposalId)
      expect(newSnapshot).to.eql(await xAllocationVoting.currentRoundSnapshot())
      expect(newSnapshot).to.not.eql(snapshot)

      // same for deadline
      const newDeadline = await governor.proposalDeadline(proposalId)
      expect(newDeadline).to.eql(await xAllocationVoting.currentRoundDeadline())
      expect(newDeadline).to.not.eql(deadline)

      // once the round ends the snapshot and deadline should be the same
      await waitForCurrentRoundToEnd()
      expect(await governor.state(proposalId)).to.not.eql(1n)

      const finalSnapshot = await governor.proposalSnapshot(proposalId)
      const finalDeadline = await governor.proposalDeadline(proposalId)
      expect(finalSnapshot).to.eql(newSnapshot)
      expect(finalDeadline).to.eql(newDeadline)
    })

    it("Proposal snapshot and deadline behaves correctly if a new round is not starting for some unexpected reason", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")

      // Start emissions
      await bootstrapAndStartEmissions()
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // We want to start a proposal in round 3
      const tx = await governor
        .connect(proposer) //@ts-ignore
        .propose(
          [await b3tr.getAddress()],
          [0],
          [B3trContract.interface.encodeFunctionData("tokenDetails", [])],
          "Creating some random proposal",
          (await xAllocationVoting.currentRoundId()) + 2n,
          ethers.parseEther("1000"),
          {
            gasLimit: 10_000_000,
          },
        )
      const proposalId = await getProposalIdFromTx(tx, true)

      expect(await xAllocationVoting.currentRoundId()).to.eql(1n)
      expect(await xAllocationVoting.state(1n)).to.eql(0n) // active
      expect(await xAllocationVoting.currentRoundDeadline()).to.be.greaterThan(await governor.clock())
      // we are in round 1 (active), round 2 still needs to start, our proposal is in round 3

      // so the snapshot should be: block when round 1 ends + 1 block to start round 2 + duration of round 2 + 1 block to start round 3
      const snapshot = await governor.proposalSnapshot(proposalId)
      const currentRoundEndsAt = await xAllocationVoting.currentRoundDeadline()
      expect(snapshot).to.eql(currentRoundEndsAt + 1n + (await xAllocationVoting.votingPeriod()) + 1n)

      // deadline is the moment the proposal starts (snapshot) + the voting period
      const deadline = await governor.proposalDeadline(proposalId)
      expect(deadline).to.eql(snapshot + (await xAllocationVoting.votingPeriod()))

      // We can now simulate that round 1 ends but round 2 is not starting for some reason
      await waitForCurrentRoundToEnd()
      await moveBlocks(2)

      expect(await xAllocationVoting.currentRoundId()).to.eql(1n)
      expect(await xAllocationVoting.state(1n)).to.not.eql(0n) // not active
      // we are in round 1 (ended), round 2 still needs to start, our proposal is in round 3

      // the new snapshot should be: now + 1 block (because we suppose round will start the next block) + the voting period of round 2 + 1 block for starting round 3
      const newSnapshot = await governor.proposalSnapshot(proposalId)
      expect(newSnapshot).to.eql((await governor.clock()) + 1n + (await xAllocationVoting.votingPeriod()) + 1n)

      const newDeadline = await governor.proposalDeadline(proposalId)
      expect(newDeadline).to.eql(newSnapshot + (await xAllocationVoting.votingPeriod()))

      // every block that passes should increase the snapshot and deadline by 1 block
      await moveBlocks(1)
      const newSnapshot2 = await governor.proposalSnapshot(proposalId)
      expect(newSnapshot2).to.eql(newSnapshot + 1n)

      await moveBlocks(1)
      const newSnapshot3 = await governor.proposalSnapshot(proposalId)
      expect(newSnapshot3).to.eql(newSnapshot2 + 1n)
    })

    it("Period between proposal creation and round start must be higher than min delay set in the contract", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      config.B3TR_GOVERNOR_MIN_VOTING_DELAY = 3
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, emissions, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "2000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // simulate 2 blocks passed
      await moveBlocks(2)

      // we should be in the following situation
      let currentBlock = await governor.clock()
      let currentRoundsEndsAt = await xAllocationVoting.currentRoundDeadline()
      let minVotingDelay = await governor.minVotingDelay()
      expect(minVotingDelay).to.be.greaterThan(currentRoundsEndsAt - currentBlock)

      // Now if we create a proposal it should revert because the start of the next round is too close
      let voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("2000"))

      await expect(
        governor
          .connect(proposer)
          .propose(
            [await b3tr.getAddress()],
            [0],
            [B3trContract.interface.encodeFunctionData("tokenDetails", [])],
            "",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      ).to.be.reverted

      // simulate start of new round with enough voting delay
      await waitForCurrentRoundToEnd()
      await emissions.distribute()

      // we should be in the following situation
      currentBlock = await governor.clock()
      currentRoundsEndsAt = await xAllocationVoting.currentRoundDeadline()
      minVotingDelay = await governor.minVotingDelay()
      expect(minVotingDelay).to.not.be.greaterThan(currentRoundsEndsAt - currentBlock)

      // Now if we create a proposal it should not revert
      voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      await expect(
        governor
          .connect(proposer)
          .propose(
            [await b3tr.getAddress()],
            [0],
            [B3trContract.interface.encodeFunctionData("tokenDetails", [])],
            "",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      ).to.not.be.reverted
    })

    it("Proposal is not active until the target round starts", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 7
      const { b3tr, otherAccounts, governor, B3trContract, emissions, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // We need to have enough VOT3 tokens to pay for the deposit
      const depositPreVOT3Tokens = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      await getVot3Tokens(proposer, (Number(ethers.formatEther(depositPreVOT3Tokens)) * 1.2).toString())
      const deposit = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      await vot3.connect(proposer).approve(await governor.getAddress(), deposit)

      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), deposit, {
          gasLimit: 10_000_000,
        })

      const proposeReceipt = await tx.wait()
      expect(proposeReceipt).not.to.be.null

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(proposalId).not.to.be.null

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      // Move to the next round + 1 extra block
      await waitForCurrentRoundToEnd()
      await waitForNextBlock()

      // Round ended but proposal should still be pending
      expect(await governor.state(proposalId)).to.eql(0n) // pending

      // We start the new round
      await emissions.distribute()

      expect(await governor.state(proposalId)).to.eql(1n) // active
    })

    it("Can create a non executable proposal", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 7
      const { otherAccounts, governor, xAllocationVoting, vot3, veBetterPassport } = await getOrDeployContractInstances(
        {
          forceDeploy: true,
          config,
        },
      )

      const proposer = otherAccounts[0]

      const voter = otherAccounts[1]
      await getVot3Tokens(voter, "30000")

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.toggleCheck(1)

      // Start emissions
      await bootstrapAndStartEmissions()

      // We need to have enough VOT3 tokens to pay for the deposit
      const depositPreVOT3Tokens = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      await getVot3Tokens(proposer, (Number(ethers.formatEther(depositPreVOT3Tokens)) * 1.2).toString())
      const deposit = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      await vot3.connect(proposer).approve(await governor.getAddress(), deposit)

      // Now we can create a new proposal
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      const tx = await governor.connect(proposer).propose([], [], [], "", voteStartsInRoundId.toString(), deposit, {
        gasLimit: 10_000_000,
      })

      const proposeReceipt = await tx.wait()
      expect(proposeReceipt).not.to.be.null

      const proposalId = await getProposalIdFromTx(tx, true)

      expect(proposalId).not.to.be.null

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      expect(await governor.proposalNeedsQueuing(proposalId)).to.eql(false)

      // Let's make this proposal succeed
      await waitForProposalToBeActive(proposalId)
      expect(await governor.state(proposalId)).to.eql(1n) // active
      await governor.connect(voter).castVote(proposalId, 1)

      // Move to the next round + 1 extra block
      await waitForCurrentRoundToEnd()

      expect(await governor.state(proposalId)).to.eql(4n) // succeeded

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(""))

      // Can still queue even if there is nothing to execute
      await governor.queue([], [], [], descriptionHash)
      expect(await governor.state(proposalId)).to.eql(5n) // queued

      // Can still execute even if there is nothing to execute
      await governor.execute([], [], [], descriptionHash)
      expect(await governor.state(proposalId)).to.eql(6n)
    })

    it("Can create a proposal with no deposit", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 7
      const { otherAccounts, governor, xAllocationVoting, vot3 } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const proposer = otherAccounts[0]

      const voter = otherAccounts[1]
      await getVot3Tokens(voter, "30000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // We need to have enough VOT3 tokens to pay for the deposit
      const depositPreVOT3Tokens = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      await getVot3Tokens(proposer, (Number(ethers.formatEther(depositPreVOT3Tokens)) * 1.2).toString())
      const deposit = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      await vot3.connect(proposer).approve(await governor.getAddress(), deposit)

      // Now we can create a new proposal
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      const tx = await governor.connect(proposer).propose([], [], [], "", voteStartsInRoundId.toString(), 0, {
        gasLimit: 10_000_000,
      })

      const proposeReceipt = await tx.wait()
      expect(proposeReceipt).not.to.be.null

      const proposalId = await getProposalIdFromTx(tx)

      expect(proposalId).not.to.be.null

      expect(await governor.state(proposalId)).to.eql(0n) // pending
      expect(await governor.getUserDeposit(proposalId, proposer.address)).to.eql(0n)
      expect(await governor.getProposalDeposits(proposalId)).to.eql(0n)
    })

    it("Non existing proposal does not need to be queued", async () => {
      const { governor } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const proposalId = 1n
      expect(await governor.proposalNeedsQueuing(proposalId)).to.be.false
    })

    it("Parameters must have the same length", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))
      // Parameters must have the same length
      await catchRevert(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0, 1],
            [encodedFunctionCall],
            "",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      )

      await catchRevert(
        governor
          .connect(proposer)
          .propose(
            [address, address],
            [0],
            [encodedFunctionCall],
            "",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      )

      await catchRevert(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0],
            [encodedFunctionCall, encodedFunctionCall],
            "",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      )
    })

    it("Proposal concludes when round ends", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 8
      const { b3tr, otherAccounts, governor, B3trContract, emissions, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]

      // Start emissions
      await bootstrapAndStartEmissions()

      // Get VOT3 to pay deposit
      const depositPreVOT3Tokens = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      await getVot3Tokens(proposer, (Number(ethers.formatEther(depositPreVOT3Tokens)) * 1.2).toString())
      const deposit = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      await vot3.connect(proposer).approve(await governor.getAddress(), deposit)

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      await vot3.connect(proposer).approve(await governor.getAddress(), deposit)
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), deposit, {
          gasLimit: 10_000_000,
        })

      const proposeReceipt = await tx.wait()
      expect(proposeReceipt).not.to.be.null

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(proposalId).not.to.be.null

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      // Move to the next round + 1 extra block
      await waitForCurrentRoundToEnd()
      // We start the new round
      await emissions.distribute()

      expect(await governor.state(proposalId)).to.eql(1n) // active

      await waitForCurrentRoundToEnd()

      expect(await governor.state(proposalId)).to.not.eql(1n) // active
      expect(await governor.state(proposalId)).to.not.eql(0n) // pending
    })

    it("Cannot create a proposal that starts in first round if emissions did not start", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      await bootstrapEmissions()

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")

      expect(await xAllocationVoting.currentRoundId()).to.eql(0n)

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const currentRoundId = await xAllocationVoting.currentRoundId() // starts in current round
      expect(currentRoundId).to.eql(0n)

      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))
      await expect(
        governor.connect(proposer).propose([address], [0], [encodedFunctionCall], "", 1n, ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        }),
      ).to.be.reverted
    })

    it("Can create a proposal that starts from second round if emissions did not start", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3, emissions, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      await bootstrapEmissions()

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")

      expect(await xAllocationVoting.currentRoundId()).to.eql(0n)

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const currentRoundId = await xAllocationVoting.currentRoundId() // starts in current round
      expect(currentRoundId).to.eql(0n)

      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", 2n, ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)
      await payDeposit(proposalId, proposer)

      // proposal state should be pending
      expect(await governor.state(proposalId)).to.eql(0n)

      // proposal should start in round 2
      expect(await governor.proposalStartRound(proposalId)).to.eql(2n)

      // proposal snapshot should be: current block + 1 block (expecting round 1 to start) + round 1 duration + 1 block (expecting round 2 to start)
      expect(await governor.proposalSnapshot(proposalId)).to.eql(
        (await governor.clock()) + 1n + (await xAllocationVoting.votingPeriod()) + 1n,
      )

      // proposal deadline should be: snapshot + voting period
      expect(await governor.proposalDeadline(proposalId)).to.eql(
        (await governor.clock()) +
          1n +
          (await xAllocationVoting.votingPeriod()) +
          1n +
          (await xAllocationVoting.votingPeriod()),
      )

      // when round 1 starts the proposal should still be pending and snapshot updated

      // Start emissions
      await emissions.connect(minterAccount).start()
      expect(await xAllocationVoting.currentRoundId()).to.eql(1n)

      expect(await governor.state(proposalId)).to.eql(0n) // still pending

      // should start when round 1 ends + 1 estimated block to start round 2
      expect(await governor.proposalSnapshot(proposalId)).to.eql((await xAllocationVoting.currentRoundDeadline()) + 1n)

      // when round 2 starts the proposal should be active
      await waitForCurrentRoundToEnd()
      expect(await governor.state(proposalId)).to.eql(0n) // should still pending

      // start new round
      await emissions.distribute()
      expect(await xAllocationVoting.currentRoundId()).to.eql(2n)
      expect(await governor.state(proposalId)).to.eql(1n) // should be active
    })

    it("Cannot create same proposal twice", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      await bootstrapAndStartEmissions()

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const roundToStart = (await xAllocationVoting.currentRoundId()) + 2n

      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))
      await expect(
        governor
          .connect(proposer)
          .propose([address], [0], [encodedFunctionCall], "", roundToStart, ethers.parseEther("1000"), {
            gasLimit: 10_000_000,
          }),
      ).to.not.be.reverted

      await expect(
        governor
          .connect(proposer)
          .propose([address], [0], [encodedFunctionCall], "", roundToStart, ethers.parseEther("1000"), {
            gasLimit: 10_000_000,
          }),
      ).to.be.reverted
    })

    it("Should not be able to create a proposal starting in a round that has already passed", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 5
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      let voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) - 1n // starts in previous round

      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))
      await catchRevert(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0],
            [encodedFunctionCall],
            "",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      )

      voteStartsInRoundId = await xAllocationVoting.currentRoundId() // starts in current round
      await catchRevert(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0],
            [encodedFunctionCall],
            "",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      )
    })

    it("can create a proposal even if user did not manually self delegate (because of automatic self-delegation)", async function () {
      const { B3trContract, vot3, b3tr, owner, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      // Before creating a proposal, we need to mint some VOT3 tokens to the owner
      await b3tr.connect(minterAccount).mint(owner, ethers.parseEther("1000"))
      await b3tr.connect(owner).approve(await vot3.getAddress(), ethers.parseEther("9"))
      await vot3.connect(owner).convertToVOT3(ethers.parseEther("9"), { gasLimit: 10_000_000 })

      const functionToCall = "tokenDetails"
      const description = "Get token details"

      await createProposal(b3tr, B3trContract, owner, description, functionToCall, [])
    })

    it("can create a proposal if VOT3 holder has self-delegated", async function () {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      const { governor, B3trContract, b3tr, owner, xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      const functionToCall = "tokenDetails"
      const description = "Get token details"

      // Now we can create a proposal
      const tx = await createProposal(b3tr, B3trContract, owner, description, functionToCall, [])
      const proposeReceipt = await tx.wait()
      expect(proposeReceipt).not.to.be.null

      // Check that the ProposalCreated event was emitted with the correct parameters
      const event = proposeReceipt?.logs[0]
      expect(event).not.to.be.undefined

      const decodedLogs = governor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })

      //event exists
      expect(decodedLogs?.name).to.eql("ProposalCreated")
      // proposal id
      const proposalId = decodedLogs?.args[0]
      expect(proposalId).not.to.be.null
      // proposer is the owner
      expect(decodedLogs?.args[1]).to.eql(await owner.getAddress())
      // targets are correct
      const b3trAddress = await b3tr.getAddress()
      expect(decodedLogs?.args[2]).to.eql([b3trAddress])
      // values are correct
      expect(decodedLogs?.args[3].toString()).to.eql("0")
      // signatures are correct
      expect(decodedLogs?.args[4]).not.to.be.null
      // calldatas are correct
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
      expect(decodedLogs?.args[5]).to.eql([encodedFunctionCall])
      // description is correct
      expect(decodedLogs?.args[6]).to.eql(description)
      // round when proposal will start
      const voteStartsInRoundId = decodedLogs?.args[7]
      expect(voteStartsInRoundId).not.to.be.null
      expect(voteStartsInRoundId).to.eql((await xAllocationVoting.currentRoundId()) + 1n)
      // proposal threshold
      expect(decodedLogs?.args[8].toString()).not.to.be.null

      // proposal should be in pending state
      const proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("0") // pending
    })

    it("can calculate the proposal id from the proposal parameters", async function () {
      const { governor, B3trContract, b3tr, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const functionToCall = "tokenDetails"
      const description = "Get token details"

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a proposal
      const tx = await createProposal(b3tr, B3trContract, owner, description, functionToCall, [])

      const proposalId = await getProposalIdFromTx(tx)

      const b3trAddress = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))

      const retrievedProposalId = await governor.hashProposal(
        [b3trAddress],
        [0],
        [encodedFunctionCall],
        descriptionHash,
      )

      expect(proposalId).to.eql(retrievedProposalId)
    })

    it("ANY user that holds VOT3 and DELEGATED can create a proposal", async function () {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      const { B3trContract, otherAccount, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      const functionToCall = "tokenDetails"
      const description = "Get token details"

      // Now we can create a proposal
      await createProposal(b3tr, B3trContract, otherAccount, description, functionToCall, [])
    })

    it("Can correctly check description restriction", async () => {
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "3000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // throw new Error("Not implemented")
      // with protection via proposer suffix
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 2n // starts 2 rounds from now

      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("3000"))
      await expect(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0],
            [encodedFunctionCall],
            "#proposer=" + proposer.address,
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      ).to.not.be.reverted

      // with proposer suffix but bad address part (XYZ are not a valid hex char)
      await expect(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0],
            [encodedFunctionCall],
            "#proposer=0x3C44CdDdB6a900fa2b585dd299e03d12FA429XYZ",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      ).to.not.be.reverted

      // with wrong suffix
      await expect(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0],
            [encodedFunctionCall],
            "#wrong-suffix=" + proposer.address,
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      ).to.not.be.reverted

      // with protection via proposer suffix but wrong proposer
      await expect(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0],
            [encodedFunctionCall],
            "#proposer=" + otherAccounts[1].address,
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      ).to.be.reverted
    })

    it("Should not be able to create proposal with invalid calldata", async () => {
      const { b3tr, otherAccounts, governor, xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")

      // Start emissions
      await bootstrapAndStartEmissions()

      const address = await b3tr.getAddress()
      const encodedFunctionCall = "0x" // invalid calldata
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      await expect(
        governor
          .connect(proposer)
          .propose(
            [address],
            [0],
            [encodedFunctionCall],
            "",
            voteStartsInRoundId.toString(),
            ethers.parseEther("1000"),
            {
              gasLimit: 10_000_000,
            },
          ),
      ).to.be.reverted
    })

    it("Can fetch proposal creator", async () => {
      const { governor, B3trContract, b3tr, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const functionToCall = "tokenDetails"
      const description = "Get token details"

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a proposal
      const tx = await createProposal(b3tr, B3trContract, owner, description, functionToCall, [])
      const proposalId = await getProposalIdFromTx(tx)

      const creator = await governor.proposalProposer(proposalId)
      expect(creator).to.eql(owner.address)
    })
  })

  // the tests described in this section cannot be run in isolation, but need to run in cascade
  describe("Proposal Voting", function () {
    let voter1: HardhatEthersSigner
    let voter2: HardhatEthersSigner
    let voter3: HardhatEthersSigner
    let voter4: HardhatEthersSigner
    let voter5: HardhatEthersSigner
    let voter6: HardhatEthersSigner
    let voter7: HardhatEthersSigner

    const functionToCall = "tokenDetails"
    const description = "Get token details"
    let proposalId: any

    this.beforeAll(async function () {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 15
      const { vot3, b3tr, otherAccounts, minterAccount, B3trContract, otherAccount, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      voter1 = otherAccounts[0] // with no VOT3
      voter2 = otherAccounts[1] // with VOT3 but no delegation
      voter3 = otherAccounts[2] // with VOT3 and delegation
      voter4 = otherAccounts[3] // with VOT3 and delegation
      voter5 = otherAccounts[4] // with VOT3 and delegation
      voter6 = otherAccounts[5] // with VOT3 and delegation
      voter7 = otherAccounts[6] // with VOT3 and delegation

      await veBetterPassport.whitelist(voter1.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)
      await veBetterPassport.whitelist(voter4.address)
      await veBetterPassport.whitelist(voter5.address)
      await veBetterPassport.whitelist(voter6.address)
      await veBetterPassport.whitelist(voter7.address)
      await veBetterPassport.toggleCheck(1)

      // Before trying to vote we need to mint some VOT3 tokens to the voter2
      await b3tr.connect(minterAccount).mint(voter2, ethers.parseEther("30000"))
      await b3tr.connect(voter2).approve(await vot3.getAddress(), ethers.parseEther("270"))
      await vot3.connect(voter2).convertToVOT3(ethers.parseEther("270"))

      // we do it here but will use in the next test
      await getVot3Tokens(voter3, "1000000")
      await getVot3Tokens(voter4, "9")
      await getVot3Tokens(voter5, "0.1")
      await getVot3Tokens(voter6, "100000")
      await getVot3Tokens(voter7, "1000")

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const tx = await createProposal(b3tr, B3trContract, otherAccount, description, functionToCall, [])
      proposalId = await getProposalIdFromTx(tx)
      payDeposit(proposalId, otherAccount)
    })

    it("cannot vote if proposal is not in active state", async function () {
      const { governor } = await getOrDeployContractInstances({ forceDeploy: false })
      // Now we can create a new proposal

      const proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("0")

      await catchRevert(governor.connect(voter3).castVote(proposalId, 1))
    })

    it("user without VOT3 can't vote with weight 0", async function () {
      const { governor } = await getOrDeployContractInstances({ forceDeploy: false })

      const proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      expect(proposalState.toString()).to.eql("1") // active

      //vote
      await expect(governor.connect(voter1).castVote(proposalId, 1)).to.be.revertedWithCustomError(
        governor,
        "GovernorVotingThresholdNotMet",
      )
    })

    it("user with VOT3 can't vote with weight less than 1", async function () {
      const { governor } = await getOrDeployContractInstances({ forceDeploy: false })

      const proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      expect(proposalState.toString()).to.eql("1") // active

      //vote
      await expect(governor.connect(voter1).castVote(proposalId, 1)).to.be.revertedWithCustomError(
        governor,
        "GovernorVotingThresholdNotMet",
      )
    })

    it("user with 1 VOT3 can vote", async function () {
      const { governor } = await getOrDeployContractInstances({ forceDeploy: false })

      const proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      expect(proposalState.toString()).to.eql("1") // active

      const tx = await governor.connect(voter7).castVote(proposalId, 1)
      const proposeReceipt = await tx.wait()
      const event = proposeReceipt?.logs[1]
      const decodedLogs = governor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })

      //event exists
      expect(decodedLogs?.name).to.eql("VoteCast")
      // voter
      expect(decodedLogs?.args[0]).to.eql(await voter7.getAddress())
      // proposal id
      expect(decodedLogs?.args[1]).to.eql(proposalId)
      // support
      expect(decodedLogs?.args[2].toString()).to.eql("1")
      // votes
      expect(decodedLogs?.args[3].toString()).not.to.eql("1")
      // power
      expect(decodedLogs?.args[4].toString()).not.to.eql("1")

      const hasVoted = await governor.hasVoted(proposalId, await voter7.getAddress())
      expect(hasVoted).to.eql(true)
    })

    it("can vote if self-delegated VOT3 holder before snapshot", async function () {
      const { governor } = await getOrDeployContractInstances({ forceDeploy: false })

      const proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      expect(proposalState.toString()).to.eql("1") // active

      const tx = await governor.connect(voter3).castVote(proposalId, 1)
      const proposeReceipt = await tx.wait()
      const event = proposeReceipt?.logs[1]
      const decodedLogs = governor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })

      //event exists
      expect(decodedLogs?.name).to.eql("VoteCast")
      // voter
      expect(decodedLogs?.args[0]).to.eql(await voter3.getAddress())
      // proposal id
      expect(decodedLogs?.args[1]).to.eql(proposalId)
      // support
      expect(decodedLogs?.args[2].toString()).to.eql("1")
      // votes
      expect(decodedLogs?.args[3].toString()).not.to.eql("0")
      // power
      expect(decodedLogs?.args[4].toString()).not.to.eql("0")

      const hasVoted = await governor.hasVoted(proposalId, await voter3.getAddress())
      expect(hasVoted).to.eql(true)
    })

    it("vote has weight 0 if self-delegated VOT3 holder after the proposal snapshot", async function () {
      const { governor, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: false })

      const newVoter = otherAccounts[4]
      await getVot3Tokens(newVoter, "1000")

      const proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      expect(proposalState.toString()).to.eql("1") // active

      //vote
      await expect(governor.connect(voter1).castVote(proposalId, 1)).to.be.revertedWithCustomError(
        governor,
        "GovernorVotingThresholdNotMet",
      )
    })

    it("[Quadratic] can count votes correctly", async function () {
      const { governor } = await getOrDeployContractInstances({ forceDeploy: false })

      const proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      expect(proposalState.toString()).to.eql("1") // active

      //vote against
      await governor.connect(voter4).castVote(proposalId, 0)

      // now we should have the following votes:
      // voter1: 0 yes
      // voter2: 0 yes
      // voter3: sqrt(1,000,000) + sqrt(1,000) =  1,031.6227766 yes
      // voter4: sqrt(9) = 3 no
      // abstain: 0
      const votes = await governor.proposalVotes(proposalId)

      // against votes
      expect(votes[0]).to.eql(ethers.parseEther("3"))

      // Note that if this test is ran in isolation, the following votes will be 0
      expect(votes[1]).to.satisfy((votes: bigint) => {
        return votes === ethers.parseEther("1031.622776601") || votes === BigInt(0)
      })

      // abstain
      expect(votes[2].toString()).to.eql("0")
    })

    it("[Linear] can count votes correctly", async function () {
      const { governor, b3tr, B3trContract, otherAccount } = await getOrDeployContractInstances({ forceDeploy: false })

      // Turn off quadratic voting
      await governor.toggleQuadraticVoting()

      // Now we can create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        otherAccount,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      )
      proposalId = await getProposalIdFromTx(tx)
      payDeposit(proposalId, otherAccount)

      const proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      // quadratic voting should be off
      expect(await governor.isQuadraticVotingDisabledForCurrentRound()).to.eql(true)

      expect(proposalState.toString()).to.eql("1") // active

      //vote against
      await governor.connect(voter4).castVote(proposalId, 0)

      // now we should have the following votes:
      // voter1: 0 yes
      // voter2: 0 yes
      // voter3: 1,000,000 + 1,000 = 1,001,000 yes
      // voter4: 9 = 9 no
      // abstain: 0
      const votes = await governor.proposalVotes(proposalId)

      // against votes
      expect(votes[0]).to.eql(ethers.parseEther("9"))

      // Note that if this test is ran in isolation, the following votes will be 0
      expect(votes[1]).to.satisfy((votes: bigint) => {
        return votes === ethers.parseEther("1001000") || votes === BigInt(0)
      })

      // abstain
      expect(votes[2].toString()).to.eql("0")
    })

    it("cannot vote twice", async function () {
      const { governor } = await getOrDeployContractInstances({ forceDeploy: false })

      const proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      expect(proposalState.toString()).to.eql("1") // active

      const hasVoted = await governor.hasVoted(proposalId, await voter4.getAddress())

      if (!hasVoted) await governor.connect(voter4).castVote(proposalId, 1)

      await catchRevert(governor.connect(voter4).castVote(proposalId, 1))
    })

    it("cannot vote after voting period ends", async function () {
      const { governor, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: false })

      let proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      expect(proposalState.toString()).to.eql("1") // active

      const hasVoted = await governor.hasVoted(proposalId, await otherAccounts[2].getAddress()) // voter6 has already voted to reach quorum otherwise the proposal would be defeated (state 3)

      if (!hasVoted) await governor.connect(otherAccounts[2]).castVote(proposalId, 1)

      await waitForVotingPeriodToEnd(proposalId)

      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("4") // succeeded

      const voter5 = otherAccounts[5]
      await catchRevert(governor.connect(voter5).castVote(proposalId, 1))
    }).timeout(1800000)

    it("Stores that a user voted at least once", async function () {
      const { otherAccount, owner, governor, b3tr, B3trContract, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Start emissions
      await bootstrapAndStartEmissions()

      await veBetterPassport.whitelist(otherAccount.address)
      await veBetterPassport.toggleCheck(1)

      // Should be able to free mint after participating in allocation voting
      await participateInGovernanceVoting(
        otherAccount,
        owner,
        b3tr,
        B3trContract,
        description,
        functionToCall,
        [],
        false,
      )

      // Check if user voted
      const voted = await governor.hasVotedOnce(otherAccount.address)
      expect(voted).to.equal(true)
    })

    it("Quorum is calculated correctly", async function () {
      const { governor, otherAccounts, b3tr, B3trContract, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      const proposer = otherAccounts[3]
      await getVot3Tokens(voter, "30000")
      await getVot3Tokens(voter2, "30000")
      await getVot3Tokens(voter3, "30000")
      await getVot3Tokens(proposer, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)

      await veBetterPassport.toggleCheck(1)

      // Create a proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId, proposer)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 0) // vote against
      await governor.connect(voter2).castVote(proposalId, 1) // vote for
      await governor.connect(voter3).castVote(proposalId, 2) // vote abastain

      // wait
      await waitForVotingPeriodToEnd(proposalId)

      const proposalSnapshot = await governor.proposalSnapshot(proposalId)

      const quorumNeeded = await governor.quorum(proposalSnapshot)

      const proposalVotes = await governor.proposalTotalVotes(proposalId)
      //sum of votes
      expect(proposalVotes).to.eql(ethers.parseEther("90000"))
      expect(proposalVotes).to.be.greaterThan(quorumNeeded)

      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)
    })

    it("[Quadratic] Against votes are counted correctly for quorum", async function () {
      const { governor, otherAccounts, b3tr, B3trContract, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      await getVot3Tokens(voter, "30000")
      await getVot3Tokens(voter2, "30000")
      await getVot3Tokens(voter3, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)

      await veBetterPassport.toggleCheck(1)

      // Create a proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        voter,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId, voter)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 0) // vote against
      await governor.connect(voter2).castVote(proposalId, 0) // vote against

      // wait
      await waitForVotingPeriodToEnd(proposalId)

      // Check if quorum is calculated correctly
      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      // check against votes are counted correctly
      const votes = await governor.proposalVotes(proposalId)
      expect(votes[0]).to.eql(ethers.parseEther("346.410161512"))
    })

    it("[Linear] Against votes are counted correctly for quorum", async function () {
      const { governor, otherAccounts, b3tr, B3trContract, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      // Turn off quadratic voting
      await governor.toggleQuadraticVoting()

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      await getVot3Tokens(voter, "30000")
      await getVot3Tokens(voter2, "30000")
      await getVot3Tokens(voter3, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)

      await veBetterPassport.toggleCheck(1)

      // Create a proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        voter,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      // Check quadratic voting is off
      const quadraticVoting = await governor.isQuadraticVotingDisabledForCurrentRound()
      expect(quadraticVoting).to.equal(true)

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId, voter)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 0) // vote against
      await governor.connect(voter2).castVote(proposalId, 0) // vote against

      // wait
      await waitForVotingPeriodToEnd(proposalId)

      // Check if quorum is calculated correctly
      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      // check against votes are counted correctly
      const votes = await governor.proposalVotes(proposalId)
      expect(votes[0]).to.eql(ethers.parseEther("60000"))
    })

    it("[Quadratic] Abstain votes are counted correctly for quorum", async function () {
      const { governor, otherAccounts, b3tr, B3trContract, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      await getVot3Tokens(voter, "30000")
      await getVot3Tokens(voter2, "30000")
      await getVot3Tokens(voter3, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)

      await veBetterPassport.toggleCheck(1)

      // Create a proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        voter,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId, voter)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 2) // vote abstain
      await governor.connect(voter2).castVote(proposalId, 2) // vote abstain

      // wait
      await waitForVotingPeriodToEnd(proposalId)

      // Check if quorum is calculated correctly
      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      // check abstain votes are counted correctly
      const votes = await governor.proposalVotes(proposalId)
      expect(votes[2]).to.eql(ethers.parseEther("346.410161512"))
    })

    it("[Linear] Abstain votes are counted correctly for quorum", async function () {
      const { governor, otherAccounts, b3tr, B3trContract, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      // Turn off quadratic voting
      await governor.toggleQuadraticVoting()

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      await getVot3Tokens(voter, "30000")
      await getVot3Tokens(voter2, "30000")
      await getVot3Tokens(voter3, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)

      await veBetterPassport.toggleCheck(1)

      // Create a proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        voter,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      // Check quadratic voting is off
      const quadraticVoting = await governor.isQuadraticVotingDisabledForCurrentRound()
      expect(quadraticVoting).to.equal(true)

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId, voter)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 2) // vote abstain
      await governor.connect(voter2).castVote(proposalId, 2) // vote abstain

      // wait
      await waitForVotingPeriodToEnd(proposalId)

      // Check if quorum is calculated correctly
      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      // check abstain votes are counted correctly
      const votes = await governor.proposalVotes(proposalId)
      expect(votes[2]).to.eql(ethers.parseEther("60000"))
    })

    it("[Quadratic] Yes votes are counted correctly for quorum", async function () {
      const { governor, otherAccounts, b3tr, B3trContract, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      await getVot3Tokens(voter, "30000")
      await getVot3Tokens(voter2, "30000")
      await getVot3Tokens(voter3, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)

      await veBetterPassport.toggleCheck(1)

      // Create a proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        voter,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId, voter)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote yes
      await governor.connect(voter2).castVote(proposalId, 1) // vote yes

      // wait
      await waitForVotingPeriodToEnd(proposalId)

      // Check if quorum is calculated correctly
      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      // check yes votes are counted correctly
      const votes = await governor.proposalVotes(proposalId)
      // sqrt(30,000) * 2 = 346.410161512 - scaled to 9 decimals
      expect(votes[1]).to.eql(ethers.parseEther("346.410161512"))
    })

    it("[Linear] Yes votes are counted correctly for quorum", async function () {
      const { governor, otherAccounts, b3tr, B3trContract, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      // Turn off quadratic voting
      await governor.toggleQuadraticVoting()

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      await getVot3Tokens(voter, "30000")
      await getVot3Tokens(voter2, "30000")
      await getVot3Tokens(voter3, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)

      await veBetterPassport.toggleCheck(1)

      // Create a proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        voter,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      // Check quadratic voting is off
      const quadraticVoting = await governor.isQuadraticVotingDisabledForCurrentRound()
      expect(quadraticVoting).to.equal(true)

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId, voter)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote yes
      await governor.connect(voter2).castVote(proposalId, 1) // vote yes

      // wait
      await waitForVotingPeriodToEnd(proposalId)

      // Check if quorum is calculated correctly
      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      // check yes votes are counted correctly
      const votes = await governor.proposalVotes(proposalId)
      // 30,000 * 2 = 60,000
      expect(votes[1]).to.eql(ethers.parseEther("60000"))
    })

    it("[Quadratic] Can get correct quadratic voting power", async function () {
      const { governor, otherAccounts, b3tr, B3trContract, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      await getVot3Tokens(voter, "30000")
      await getVot3Tokens(voter2, "30000")
      await getVot3Tokens(voter3, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)

      await veBetterPassport.toggleCheck(1)

      // Create a proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        voter,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      const proposalId = await getProposalIdFromTx(tx)
      const receipt = (await tx.wait()) as any

      // pay deposit
      await payDeposit(proposalId, voter)

      // wait
      await waitForProposalToBeActive(proposalId)

      const power1 = await governor.getQuadraticVotingPower(voter.address, receipt.blockNumber)
      const power2 = await governor.getQuadraticVotingPower(voter2.address, receipt.blockNumber)
      const power3 = await governor.getQuadraticVotingPower(voter3.address, receipt.blockNumber)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote yes
      await governor.connect(voter2).castVote(proposalId, 1) // vote yes
      await governor.connect(voter3).castVote(proposalId, 1) // vote yes

      // wait
      await waitForVotingPeriodToEnd(proposalId)

      // Check if quorum is calculated correctly
      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      // check yes votes are counted correctly
      const votes = await governor.proposalVotes(proposalId)
      // sqrt(1000) * 3 = 94.868329937 - scaled to 9 decimals
      expect(votes[1]).to.eql(power1 + power2 + power3)
    })

    it("[Linear] Can get correct voting power", async function () {
      const { governor, otherAccounts, b3tr, B3trContract, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await governor.toggleQuadraticVoting()

      // Start emissions
      await bootstrapAndStartEmissions()

      // Check if quadratic voting is enabled
      const isQuadratic = await governor.isQuadraticVotingDisabledForCurrentRound()

      expect(isQuadratic).to.equal(true)

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      const voter3 = otherAccounts[2]
      await getVot3Tokens(voter, "30000")
      await getVot3Tokens(voter2, "30000")
      await getVot3Tokens(voter3, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)
      await veBetterPassport.whitelist(voter3.address)

      await veBetterPassport.toggleCheck(1)

      // Create a proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        voter,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      const proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId, voter)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote yes
      await governor.connect(voter2).castVote(proposalId, 1) // vote yes
      await governor.connect(voter3).castVote(proposalId, 1) // vote yes

      // wait
      await waitForVotingPeriodToEnd(proposalId)

      // Check if quorum is calculated correctly
      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      // check yes votes are counted correctly
      const votes = await governor.proposalVotes(proposalId)
      // 30,000 * 3 = 90,000
      expect(votes[1]).to.eql(ethers.parseEther("90000"))
    })

    it("Can correctly cast vote with reason", async () => {
      const { governor, otherAccounts, b3tr, B3trContract, otherAccount, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const voter = otherAccounts[0]
      await getVot3Tokens(voter, "30000")

      await veBetterPassport.whitelist(voter.address)

      await veBetterPassport.toggleCheck(1)

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const tx = await createProposal(b3tr, B3trContract, otherAccount, description, functionToCall, [])
      proposalId = await getProposalIdFromTx(tx)
      await payDeposit(proposalId, otherAccount)

      const proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      expect(proposalState.toString()).to.eql("1") // active

      //vote against
      const reason = "I don't agree with this proposal"
      const voteTx = await governor.connect(voter).castVoteWithReason(proposalId, 0, reason)
      const proposeReceipt = await voteTx.wait()
      const event = proposeReceipt?.logs[1]
      const decodedLogs = governor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })

      //event exists
      expect(decodedLogs?.name).to.eql("VoteCast")
      // voter
      expect(decodedLogs?.args[0]).to.eql(voter.address)
      // proposal id
      expect(decodedLogs?.args[1]).to.eql(proposalId)
      // support
      expect(decodedLogs?.args[2].toString()).to.eql("0")
      // reason
      expect(decodedLogs?.args[5]).to.eql(reason)
    })

    it("Can abstain", async () => {
      const { governor, otherAccounts, b3tr, B3trContract, otherAccount, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const voter = otherAccounts[0]
      await getVot3Tokens(voter, "30000")

      await veBetterPassport.whitelist(voter.address)

      await veBetterPassport.toggleCheck(1)

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const tx = await createProposal(b3tr, B3trContract, otherAccount, description, functionToCall, [])
      proposalId = await getProposalIdFromTx(tx)
      await payDeposit(proposalId, otherAccount)

      const proposalState = await waitForProposalToBeActive(proposalId) // proposal id of the proposal in the beforeAll step & block when the proposal was created

      expect(proposalState.toString()).to.eql("1") // active

      //vote against
      const reason = "I don't know well about it so I abstain"
      const voteTx = await governor.connect(voter).castVoteWithReason(proposalId, 2, reason)
      const proposeReceipt = await voteTx.wait()
      const event = proposeReceipt?.logs[1]
      const decodedLogs = governor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })

      //event exists
      expect(decodedLogs?.name).to.eql("VoteCast")
      // voter
      expect(decodedLogs?.args[0]).to.eql(voter.address)
      // proposal id
      expect(decodedLogs?.args[1]).to.eql(proposalId)
      // support
      expect(decodedLogs?.args[2].toString()).to.eql("2")
      // reason
      expect(decodedLogs?.args[5]).to.eql(reason)
    })

    it("Failed state is calculated correctly", async () => {
      const config = createLocalConfig()
      // set deposit threshold to 0 so we can avoid depositing for proposals
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 0
      const {
        governor,
        otherAccounts,
        b3tr,
        B3trContract,
        otherAccount,
        vot3,
        voterRewards,
        veBetterPassport,
        emissions,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      await getVot3Tokens(voter, "1000")
      await getVot3Tokens(voter2, "1")

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)

      await veBetterPassport.toggleCheck(1)

      // Start emissions
      await bootstrapAndStartEmissions()

      //@ts-ignore
      expect(await governor.quorumNumerator()).to.equal(4n)

      const checkUserSupplyPercentage = async (user: HardhatEthersSigner) => {
        let totalSupply = await vot3.totalSupply()
        let userBalance = await vot3.balanceOf(user.address)
        let userPercentage = (userBalance * 100n) / totalSupply

        return userPercentage
      }

      // Scenario 1: quorum is 4%, user votes against with enough VOT3 to reach quorum -> proposal should be defeated
      let tx = await createProposal(b3tr, B3trContract, otherAccount, "scenario 1", functionToCall, [])
      proposalId = await getProposalIdFromTx(tx)
      await waitForProposalToBeActive(proposalId)
      let cycleId = await emissions.getCurrentCycle()
      expect(await checkUserSupplyPercentage(voter)).to.be.greaterThan(4) // check that user owns 4% of the total VOT3 supply
      await governor.connect(voter).castVote(proposalId, 0) // vote against
      await waitForVotingPeriodToEnd(proposalId)
      let proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("3") // defeated
      let isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      await voterRewards.claimReward(cycleId, voter.address)

      // Scenario 2: quorum is 4%, user2 votes for but not with enough VOT3 to reach quorum -> proposal should be defeated
      tx = await createProposal(b3tr, B3trContract, otherAccount, "scenario 2", functionToCall, [])
      proposalId = await getProposalIdFromTx(tx)
      await waitForProposalToBeActive(proposalId)
      expect(await checkUserSupplyPercentage(voter2)).to.not.be.greaterThan(4) // check that user2 does not own 4% of the total VOT3 supply
      await governor.connect(voter2).castVote(proposalId, 1) // vote for
      await waitForVotingPeriodToEnd(proposalId)
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("3") // defeated
      isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(false)

      // Scenario 3: quorum is 4%, user votes abstain with enough VOT3 to reach quorum -> proposal should be defeated since !(for > against)
      tx = await createProposal(b3tr, B3trContract, otherAccount, "scenario 3", functionToCall, [])
      proposalId = await getProposalIdFromTx(tx)
      await waitForProposalToBeActive(proposalId)
      cycleId = await emissions.getCurrentCycle()
      expect(await checkUserSupplyPercentage(voter)).to.be.greaterThan(4) // check that user own 4% of the total VOT3 supply
      await governor.connect(voter).castVote(proposalId, 2) // vote abstain
      await waitForVotingPeriodToEnd(proposalId)
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("3") // defeated
      isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      await voterRewards.claimReward(cycleId, voter.address)
    })

    it("Succeeded state is calculated correctly", async () => {
      const config = createLocalConfig()
      // set deposit threshold to 0 so we can avoid depositing for proposals
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 0
      const { governor, otherAccounts, b3tr, B3trContract, otherAccount, vot3, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      await getVot3Tokens(voter, "1000")
      await getVot3Tokens(voter2, "1")

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)

      await veBetterPassport.toggleCheck(1)

      // Start emissions
      await bootstrapAndStartEmissions()

      //@ts-ignore
      expect(await governor.quorumNumerator()).to.equal(4n)

      const checkUserSupplyPercentage = async (user: HardhatEthersSigner) => {
        let totalSupply = await vot3.totalSupply()
        let userBalance = await vot3.balanceOf(user.address)
        let userPercentage = (userBalance * 100n) / totalSupply

        return userPercentage
      }

      // Scenario: quorum is 4%, user votes for with enough VOT3 to reach quorum -> proposal should be succeeded
      const tx = await createProposal(b3tr, B3trContract, otherAccount, "scenario 4", functionToCall, [])
      proposalId = await getProposalIdFromTx(tx)
      await waitForProposalToBeActive(proposalId)
      expect(await checkUserSupplyPercentage(voter)).to.be.greaterThan(4) // check that user own 4% of the total VOT3 supply
      await governor.connect(voter).castVote(proposalId, 1) // vote for
      await waitForVotingPeriodToEnd(proposalId)
      const proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("4") // succeeded
      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)
    })

    it("Only admin or governance can toggle quadratic voting", async () => {
      const {
        governor,
        otherAccounts,
        owner,
        emissions,
        governorClockLogicLib,
        governorConfiguratorLib,
        governorDepositLogicLib,
        governorFunctionRestrictionsLogicLib,
        governorProposalLogicLib,
        governorQuorumLogicLib,
        governorStateLogicLib,
        governorVotesLogicLib,
        veBetterPassport,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const admin = owner
      const voter = otherAccounts[0]
      const voter2 = otherAccounts[1]
      await getVot3Tokens(voter, "30000")
      await getVot3Tokens(voter2, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.whitelist(voter2.address)

      await veBetterPassport.toggleCheck(1)

      // Only admin or governance can toggle quadratic voting
      await catchRevert(governor.connect(otherAccounts[0]).toggleQuadraticVoting())
      await catchRevert(governor.connect(otherAccounts[1]).toggleQuadraticVoting())

      // Admin can toggle quadratic voting
      await governor.connect(admin).toggleQuadraticVoting()

      // Start emissions
      await bootstrapAndStartEmissions()

      const quadraticVoting = await governor.isQuadraticVotingDisabledForCurrentRound()
      expect(quadraticVoting).to.equal(true)

      const b3trGovernorFactory = await ethers.getContractFactory("B3TRGovernor", {
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

      // Governance can toggle quadratic voting
      // Whiteist function
      const funcSig = governor.interface.getFunction("toggleQuadraticVoting")?.selector
      await governor.connect(owner).setWhitelistFunction(await governor.getAddress(), funcSig, true)

      // Create a proposal
      const tx = await createProposal(
        governor,
        b3trGovernorFactory,
        otherAccounts[0],
        description,
        "toggleQuadraticVoting",
        [],
      )
      proposalId = await getProposalIdFromTx(tx)
      // pay deposit
      await payDeposit(proposalId, voter)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote yes
      await governor.connect(voter2).castVote(proposalId, 1) // vote yes

      // wait
      await waitForVotingPeriodToEnd(proposalId)

      // Check if quorum is calculated correctly
      const isQuorumReached = await governor.quorumReached(proposalId)
      expect(isQuorumReached).to.equal(true)

      const encodedFunctionCall = b3trGovernorFactory.interface.encodeFunctionData("toggleQuadraticVoting", [])
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))

      // Queue the proposal
      await governor.queue([await governor.getAddress()], [0], [encodedFunctionCall], descriptionHash)
      expect(await governor.state(proposalId)).to.eql(5n)

      await governor.execute([await governor.getAddress()], [0], [encodedFunctionCall], descriptionHash)
      expect(await governor.state(proposalId)).to.eql(6n)

      const cycle = await emissions.getCurrentCycle()
      await moveToCycle(Number(cycle) + 2)

      const quadraticVotingAfter = await governor.isQuadraticVotingDisabledForCurrentRound()
      expect(quadraticVotingAfter).to.equal(false)

      expect(await governor.isQuadraticVotingDisabledForRound(cycle)).to.equal(true)
      expect(await governor.isQuadraticVotingDisabledForRound(cycle + 1n)).to.equal(false)
    })
  })

  describe("Proposal Execution", function () {
    let proposalId: number
    let voter: HardhatEthersSigner

    const functionToCall = "tokenDetails"
    const description = "Get token details"

    this.beforeAll(async function () {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 10
      const { otherAccounts, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Start emissions
      await bootstrapAndStartEmissions()

      // load votes
      voter = otherAccounts[0]
      await getVot3Tokens(voter, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.toggleCheck(1)
    })

    it("cannot queue a proposal if not in succeeded state", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        otherAccount: proposer,
      } = await getOrDeployContractInstances({ forceDeploy: false })

      // create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), proposer)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 0) // vote against

      // wait
      await waitForVotingPeriodToEnd(proposalId)
      const proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("3") // defeated

      // try to queue
      const b3trAddress = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
      await catchRevert(governor.queue([b3trAddress], [0], [encodedFunctionCall], descriptionHash))
    })

    it("cannot execute a proposal without queueing it to TimeLock first", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        otherAccount: proposer,
      } = await getOrDeployContractInstances({ forceDeploy: false })

      // create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), proposer)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote for

      // wait
      await waitForVotingPeriodToEnd(proposalId)
      const proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("4") // succeded

      // try to execute
      const b3trAddress = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
      await catchRevert(governor.execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash))
    })

    it("can correctly queue proposal if vote succeeded", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        otherAccount: proposer,
      } = await getOrDeployContractInstances({ forceDeploy: false })

      await getVot3Tokens(voter, "30000")

      // create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), proposer)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote for

      // wait
      await waitForVotingPeriodToEnd(proposalId)
      let proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("4") // succeded

      // can fetch eta
      let eta = await governor.proposalEta(proposalId)
      expect(eta).to.eql(0n)

      // queue it
      const b3trAddress = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description + ` ${this.test?.title}`))

      await governor.queue([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in queued state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("5")

      // can fetch eta
      eta = await governor.proposalEta(proposalId)
      expect(eta).to.be.gt(0n)
    })

    // this test needs the previous one to be run first
    it("PROPOSAL_EXECUTOR_ROLE can correctly execute proposal after it was queued", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        otherAccount: proposer,
        owner,
      } = await getOrDeployContractInstances({ forceDeploy: false })

      await getVot3Tokens(voter, "30000")

      // create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), proposer)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote for

      // wait
      await waitForVotingPeriodToEnd(proposalId)
      let proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("4") // succeded

      // queue it
      const b3trAddress = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description + ` ${this.test?.title}`))

      await governor.queue([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in queued state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("5")

      expect(await governor.hasRole(await governor.PROPOSAL_EXECUTOR_ROLE(), owner.address)).to.eql(true)
      await governor.connect(owner).execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in executed state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("6")
    })

    it("cannot execute proposal twice", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        otherAccount: proposer,
      } = await getOrDeployContractInstances({ forceDeploy: false })

      await getVot3Tokens(voter, "30000")

      // create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), proposer)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote for

      // wait
      await waitForVotingPeriodToEnd(proposalId)
      let proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("4") // succeded

      // queue it
      const b3trAddress = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description + ` ${this.test?.title}`))

      await governor.queue([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in queued state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("5")

      await governor.execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in executed state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("6")

      // try to execute again
      await catchRevert(governor.execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash))
    })

    it("If PROPOSAL_EXECUTOR_ROLE is set then only the proposer can execute the proposal", async function () {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 15
      const {
        governor,
        b3tr,
        B3trContract,
        otherAccount: proposer,
        veBetterPassport,
      } = await getOrDeployContractInstances({ forceDeploy: true, config })

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(voter, "30000")

      // create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), proposer)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote for

      // wait
      await waitForVotingPeriodToEnd(proposalId)
      let proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("4") // succeded

      // queue it
      const b3trAddress = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description + ` ${this.test?.title}`))

      await governor.queue([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in queued state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("5")

      // set proposer executor role
      expect(await governor.hasRole(await governor.PROPOSAL_EXECUTOR_ROLE(), ZERO_ADDRESS)).to.eql(false)
      expect(await governor.hasRole(await governor.PROPOSAL_EXECUTOR_ROLE(), proposer.address)).to.eql(false)

      await expect(governor.connect(proposer).execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash)).to.be
        .reverted
      // proposal should be in queued state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("5")

      // give role to proposer
      await governor.grantRole(await governor.PROPOSAL_EXECUTOR_ROLE(), proposer.address)
      await governor.connect(proposer).execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in executed state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("6")
    })

    it("If PROPOSAL_EXECUTOR_ROLE is set to ZERO_ADDRESS then anyone can execute proposals", async function () {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 15
      const {
        governor,
        b3tr,
        B3trContract,
        veBetterPassport,
        otherAccount: proposer,
      } = await getOrDeployContractInstances({ forceDeploy: true, config })

      await getVot3Tokens(voter, "30000")

      await veBetterPassport.whitelist(voter.address)

      await veBetterPassport.toggleCheck(1)

      // create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), proposer)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote for

      // wait
      await waitForVotingPeriodToEnd(proposalId)
      let proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("4") // succeded

      // queue it
      const b3trAddress = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description + ` ${this.test?.title}`))

      await governor.queue([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in queued state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("5")

      // set proposer executor role
      expect(await governor.hasRole(await governor.PROPOSAL_EXECUTOR_ROLE(), ZERO_ADDRESS)).to.eql(false)
      expect(await governor.hasRole(await governor.PROPOSAL_EXECUTOR_ROLE(), proposer.address)).to.eql(false)

      await expect(governor.connect(proposer).execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash)).to.be
        .reverted
      // proposal should be in queued state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("5")

      // set to zero address so that anyone can execute
      await governor.grantRole(await governor.PROPOSAL_EXECUTOR_ROLE(), ZERO_ADDRESS)
      await governor.connect(proposer).execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in executed state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("6")
    })

    it("Cannot execute proposal directly from TimeLock", async function () {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      config.EMISSIONS_CYCLE_DURATION = 15
      const {
        governor,
        b3tr,
        B3trContract,
        otherAccount: proposer,
        otherAccounts,
        veBetterPassport,
        timeLock,
        owner,
      } = await getOrDeployContractInstances({ forceDeploy: true, config })

      // Start emissions
      await bootstrapAndStartEmissions()

      // load votes
      voter = otherAccounts[0]
      await getVot3Tokens(voter, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)

      await veBetterPassport.toggleCheck(1)

      // create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), proposer)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote for

      // wait
      await waitForVotingPeriodToEnd(proposalId)
      let proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("4") // succeded

      // queue it
      const b3trAddress = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description + ` ${this.test?.title}`))

      await governor.queue([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in queued state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("5")

      // Instead of executing the proposal from the governor, we will try to execute it directly from the TimeLock
      // Only the governor should be able to execute the proposal
      await expect(
        timeLock
          .connect(owner)
          .executeBatch(
            [b3trAddress],
            [0],
            [encodedFunctionCall],
            ethers.ZeroHash,
            await governor.timelockSalt(descriptionHash),
          ),
      ).to.be.revertedWithCustomError(
        {
          interface: B3TRGovernor__factory.createInterface(),
        },
        "AccessControlUnauthorizedAccount",
      )
    })

    it("Cannot execute proposal if min delay has not passed", async function () {
      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 10
      config.TIMELOCK_MIN_DELAY = 10
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      const {
        governor,
        b3tr,
        B3trContract,
        veBetterPassport,
        otherAccount: proposer,
        otherAccounts,
        owner,
      } = await getOrDeployContractInstances({ forceDeploy: true, config })

      // Start emissions
      await bootstrapAndStartEmissions()

      // load votes
      voter = otherAccounts[0]
      await getVot3Tokens(voter, "30000")
      await waitForNextBlock()

      await veBetterPassport.whitelist(voter.address)

      await veBetterPassport.toggleCheck(1)

      // create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      proposalId = await getProposalIdFromTx(tx)

      // pay deposit
      await payDeposit(proposalId.toString(), proposer)

      // wait
      await waitForProposalToBeActive(proposalId)

      // vote
      await governor.connect(voter).castVote(proposalId, 1) // vote for

      // wait
      await waitForVotingPeriodToEnd(proposalId)
      let proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("4") // succeded

      // queue it
      const b3trAddress = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description + ` ${this.test?.title}`))

      await governor.queue([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in queued state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("5")

      // Since we incerased the min delay to 10 blocks we should not be able to execute the proposal
      await catchRevert(governor.connect(owner).execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash))

      // proposal should be in queued state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("5")

      await waitForQueuedProposalToBeReady(proposalId)

      // Now it should be ok
      await governor.connect(owner).execute([b3trAddress], [0], [encodedFunctionCall], descriptionHash)

      // proposal should be in executed state
      proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("6")
    })
  })

  describe("Proposal Cancellation", function () {
    const functionToCall = "tokenDetails"
    const description = "Get token details"
    let proposalId: any

    it("cannot cancel a proposal if not admin or proposer", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        otherAccount: proposer,
        otherAccounts,
      } = await getOrDeployContractInstances({ forceDeploy: false })

      // create a new proposal
      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

      proposalId = await getProposalIdFromTx(tx)

      const proposalState = await governor.state(proposalId)
      expect(proposalState.toString()).to.eql("0") // pending

      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      // try to cancel
      await catchRevert(
        governor
          .connect(otherAccounts[3])
          .cancel(
            [await b3tr.getAddress()],
            [0],
            [encodedFunctionCall],
            ethers.keccak256(ethers.toUtf8Bytes(`${description} ${this.test?.title}`)),
          ),
      )
    })
    it("can cancel a proposal if admin", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        owner,
        otherAccount: proposer,
      } = await getOrDeployContractInstances({ forceDeploy: true })

      await bootstrapAndStartEmissions()

      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      )

      proposalId = await getProposalIdFromTx(tx)

      const proposalState1 = await governor.state(proposalId)
      expect(proposalState1.toString()).to.eql("0") // pending

      const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])

      // try to cancel
      await governor
        .connect(owner)
        .cancel(
          [await b3tr.getAddress()],
          [0],
          [encodedFunctionCall],
          ethers.keccak256(ethers.toUtf8Bytes(`${description} ${this.test?.title}`)),
        )
      const proposalState2 = await governor.state(proposalId)
      expect(proposalState2.toString()).to.eql("2") // cancelled
    })
    it("can cancel a proposal if proposer", async function () {
      const {
        governor,
        b3tr,
        B3trContract,
        otherAccount: proposer,
      } = await getOrDeployContractInstances({ forceDeploy: true })

      await bootstrapAndStartEmissions()

      const tx = await createProposal(
        b3tr,
        B3trContract,
        proposer,
        description + ` ${this.test?.title}`,
        functionToCall,
        [],
      )

      proposalId = await getProposalIdFromTx(tx)

      const proposalState1 = await governor.state(proposalId)
      expect(proposalState1.toString()).to.eql("0") // pending

      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      // try to cancel
      await governor
        .connect(proposer)
        .cancel(
          [await b3tr.getAddress()],
          [0],
          [encodedFunctionCall],
          ethers.keccak256(ethers.toUtf8Bytes(`${description} ${this.test?.title}`)),
        )
      const proposalState2 = await governor.state(proposalId)
      expect(proposalState2.toString()).to.eql("2") // cancelled
    })
  })

  describe("Proposal Deposit", function () {
    it("A proposal state gets set to `DepositNotMet` if deposit not met by time voting round starts", async () => {
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "10")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("10"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 10 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("10"), {
          gasLimit: 10_000_000,
        })

      const proposeReceipt = await tx.wait()
      expect(proposeReceipt).not.to.be.null

      // Check that the ProposalDeposit event was emitted with the correct parameters
      const event = proposeReceipt?.logs[2]
      expect(event).not.to.be.undefined

      const decodedLogs = governor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })

      // deposit amount
      expect(decodedLogs?.args[2]).to.eql(ethers.parseEther("10"))

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(proposalId).not.to.be.null

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      expect(await governor.proposalDepositReached(proposalId)).to.eql(false)

      await waitForProposalToBeActive(proposalId)
      expect(await governor.state(proposalId)).to.eql(7n) // deposit not met

      await waitForNextCycle()

      expect(await governor.state(proposalId)).to.eql(7n) // deposit not met
    })

    it("Sponsers can contribute to deposit total", async () => {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      const sponser = otherAccounts[1]
      await getVot3Tokens(sponser, "1000")
      // grant approval to the governor contract
      await vot3.connect(sponser).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // get enough to pay the deposit
      const sponser2 = otherAccounts[2]
      const depositAmount = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      const depositAmountToPay = (Number(ethers.formatEther(depositAmount)) * 1.2).toString()
      await getVot3Tokens(sponser2, depositAmountToPay.toString())
      // grant approval to the governor contract
      await vot3.connect(sponser2).approve(await governor.getAddress(), ethers.parseEther(depositAmountToPay))

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 1000 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(await governor.proposalDepositReached(proposalId)).to.eql(false)
      expect(await governor.getProposalDeposits(proposalId)).to.eql(ethers.parseEther("1000"))
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(ethers.parseEther("1000"))

      // sponser contributes to the deposit
      const tx2 = await governor
        .connect(sponser)
        .deposit(ethers.parseEther("1000"), proposalId, { gasLimit: 10_000_000 })
      const depositReceipt = await tx2.wait()

      expect(await governor.proposalDepositReached(proposalId)).to.eql(false)
      expect(await governor.getProposalDeposits(proposalId)).to.eql(ethers.parseEther("2000"))
      expect(await governor.getUserDeposit(proposalId, sponser)).to.eql(ethers.parseEther("1000"))

      // Check that the ProposalDeposit event was emitted with the correct parameters
      const event = depositReceipt?.logs[2]
      expect(event).not.to.be.undefined

      const decodedLogs = governor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })

      // deposit amount
      expect(decodedLogs?.args[2]).to.eql(ethers.parseEther("1000"))
      // sponser2 contributes to the deposit
      const tx3 = await governor
        .connect(sponser2)
        .deposit(ethers.parseEther(depositAmountToPay), proposalId, { gasLimit: 10_000_000 })

      await tx3.wait()

      expect(await governor.proposalDepositReached(proposalId)).to.eql(true)
      expect(await governor.getProposalDeposits(proposalId)).to.eql(
        ethers.parseEther(depositAmountToPay) + ethers.parseEther("2000"),
      )

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      await waitForProposalToBeActive(proposalId)
      // proposal should be in active state as deposit was met
      expect(await governor.state(proposalId)).to.eql(1n) // active
    })

    it("Deposits can be withdrawn when round ends", async () => {
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // get enough to pay the deposit
      const sponser = otherAccounts[1]
      const depositAmount = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      const depositAmountToPay = (Number(ethers.formatEther(depositAmount)) * 1.2).toString()
      await getVot3Tokens(sponser, depositAmountToPay.toString())
      // grant approval to the governor contract
      await vot3.connect(sponser).approve(await governor.getAddress(), ethers.parseEther(depositAmountToPay))

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 1000 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(await governor.proposalDepositReached(proposalId)).to.eql(false)
      expect(await governor.getProposalDeposits(proposalId)).to.eql(ethers.parseEther("1000"))
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(ethers.parseEther("1000"))

      // sponser contributes to the deposit
      await governor
        .connect(sponser)
        .deposit(ethers.parseEther(depositAmountToPay), proposalId, { gasLimit: 10_000_000 })

      expect(await governor.proposalDepositReached(proposalId)).to.eql(true)
      expect(await governor.getProposalDeposits(proposalId)).to.eql(
        ethers.parseEther(`${Number(depositAmountToPay) + 1000}`),
      )
      expect(await governor.getUserDeposit(proposalId, sponser)).to.eql(ethers.parseEther(depositAmountToPay))

      expect(await governor.proposalDepositReached(proposalId)).to.eql(true)
      expect(await governor.getProposalDeposits(proposalId)).to.eql(
        ethers.parseEther(`${Number(depositAmountToPay) + 1000}`),
      )

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      await waitForProposalToBeActive(proposalId)
      // proposal should be in active state as deposit was met
      expect(await governor.state(proposalId)).to.eql(1n) // active

      // wait for voting period to end
      await waitForVotingPeriodToEnd(proposalId)

      expect(ethers.parseEther(`${Number(depositAmountToPay) + 1000}`)).to.eql(
        await vot3.balanceOf(await governor.getAddress()),
      )

      await governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(0n)

      await governor.connect(sponser).withdraw(proposalId, sponser.address, { gasLimit: 10_000_000 })
      expect(await governor.getUserDeposit(proposalId, sponser)).to.eql(0n)

      expect(0n).to.eql(await vot3.balanceOf(await governor.getAddress()))
    })

    it("Deposits can be withdrawn when proposal is cancelled", async () => {
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      const sponser = otherAccounts[1]
      await getVot3Tokens(sponser, "1000")
      // grant approval to the governor contract
      await vot3.connect(sponser).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 1000 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(await governor.getProposalDeposits(proposalId)).to.eql(ethers.parseEther("1000"))
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(ethers.parseEther("1000"))

      // sponser contributes to the deposit
      await governor.connect(sponser).deposit(ethers.parseEther("1000"), proposalId, { gasLimit: 10_000_000 })

      expect(await governor.getProposalDeposits(proposalId)).to.eql(ethers.parseEther("2000"))
      expect(await governor.getUserDeposit(proposalId, sponser)).to.eql(ethers.parseEther("1000"))

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      await governor
        .connect(proposer)
        .cancel([address], [0], [encodedFunctionCall], ethers.keccak256(ethers.toUtf8Bytes("")), {
          gasLimit: 10_000_000,
        })

      expect(await governor.state(proposalId)).to.eql(2n) // cancelled

      expect(ethers.parseEther("2000")).to.eql(await vot3.balanceOf(await governor.getAddress()))

      await governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(0n)

      await governor.connect(sponser).withdraw(proposalId, sponser.address, { gasLimit: 10_000_000 })
      expect(await governor.getUserDeposit(proposalId, sponser)).to.eql(0n)

      expect(0n).to.eql(await vot3.balanceOf(await governor.getAddress()))
    })

    it("Deposits can be withdrawn when proposal is active", async () => {
      const config = createLocalConfig()
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // get enough to pay the deposit
      const sponser = otherAccounts[1]
      const depositAmount = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      const depositAmountToPay = (Number(ethers.formatEther(depositAmount)) * 1.2).toString()
      await getVot3Tokens(sponser, depositAmountToPay.toString())
      // grant approval to the governor contract
      await vot3.connect(sponser).approve(await governor.getAddress(), ethers.parseEther(depositAmountToPay))

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 1000 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)

      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(ethers.parseEther("1000"))

      // sponser contributes to the deposit
      await governor
        .connect(sponser)
        .deposit(ethers.parseEther(depositAmountToPay), proposalId, { gasLimit: 10_000_000 })

      expect(await governor.getUserDeposit(proposalId, sponser)).to.eql(ethers.parseEther(depositAmountToPay))

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      await waitForProposalToBeActive(proposalId)
      // proposal should be in active state as deposit was met
      expect(await governor.state(proposalId)).to.eql(1n) // active

      // deposits can be withdrawn when proposal is active
      await governor.connect(sponser).withdraw(proposalId, sponser.address, { gasLimit: 10_000_000 })
      expect(await governor.getUserDeposit(proposalId, sponser)).to.eql(0n)

      expect(ethers.parseEther("1000")).to.eql(await vot3.balanceOf(await governor.getAddress()))

      await governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(0n)
      expect(0n).to.eql(await vot3.balanceOf(await governor.getAddress()))
    })

    it("Deposits cannot be withdrawn when proposal is pending", async () => {
      const config = createLocalConfig()
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // get enough to pay the deposit
      const sponser = otherAccounts[1]
      const depositAmount = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      const depositAmountToPay = (Number(ethers.formatEther(depositAmount)) * 1.2).toString()
      await getVot3Tokens(sponser, depositAmountToPay.toString())
      // grant approval to the governor contract
      await vot3.connect(sponser).approve(await governor.getAddress(), ethers.parseEther(depositAmountToPay))

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 1000 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)

      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(ethers.parseEther("1000"))

      // sponser contributes to the deposit
      await governor
        .connect(sponser)
        .deposit(ethers.parseEther(depositAmountToPay), proposalId, { gasLimit: 10_000_000 })

      expect(await governor.getUserDeposit(proposalId, sponser)).to.eql(ethers.parseEther(depositAmountToPay))

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      // deposits cannot be withdrawn when proposal is pending
      await expect(governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })).to.be
        .reverted

      await expect(governor.connect(sponser).withdraw(proposalId, sponser.address, { gasLimit: 10_000_000 })).to.be
        .reverted

      await waitForProposalToBeActive(proposalId)
      // proposal should be in active state as deposit was met
      expect(await governor.state(proposalId)).to.eql(1n) // active

      // deposits can be withdrawn when proposal is active
      await governor.connect(sponser).withdraw(proposalId, sponser.address, { gasLimit: 10_000_000 })
      expect(await governor.getUserDeposit(proposalId, sponser)).to.eql(0n)

      expect(ethers.parseEther("1000")).to.eql(await vot3.balanceOf(await governor.getAddress()))

      await governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(0n)
      expect(0n).to.eql(await vot3.balanceOf(await governor.getAddress()))
    })

    it("User cannot withdraw if there is no deposit to withdraw", async () => {
      const config = createLocalConfig()
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 10 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(ethers.parseEther("1000"))

      // cancel the proposal to allow withdrawal
      await governor
        .connect(proposer)
        .cancel([address], [0], [encodedFunctionCall], ethers.keccak256(ethers.toUtf8Bytes("")), {
          gasLimit: 10_000_000,
        })
      expect(await governor.state(proposalId)).to.eql(2n) // cancelled

      // user cannot withdraw non existent deposit
      await governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })

      // should not be able to withdraw again
      await expect(governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })).to.be
        .reverted

      // random user cannot withdraw
      await expect(
        governor.connect(otherAccounts[1]).withdraw(proposalId, otherAccounts[1].address, { gasLimit: 10_000_000 }),
      ).to.be.reverted

      // should not be able to withdraw non existing proposal
      await expect(governor.connect(proposer).withdraw(ethers.ZeroHash, proposer.address, { gasLimit: 10_000_000 })).to
        .be.reverted
    })

    it("User cannot withdraw if VOT3 contract is paused", async () => {
      const config = createLocalConfig()
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3, owner } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 10 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(ethers.parseEther("1000"))

      // cancel the proposal
      await governor
        .connect(proposer)
        .cancel([address], [0], [encodedFunctionCall], ethers.keccak256(ethers.toUtf8Bytes("")), {
          gasLimit: 10_000_000,
        })
      expect(await governor.state(proposalId)).to.eql(2n) // cancelled

      // pause the VOT3 contract
      await vot3.connect(owner).pause()

      // user cannot withdraw when VOT3 contract is paused
      await expect(governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })).to.be
        .reverted
    })

    it("User cannot withdraw if there is no deposit to withdraw", async () => {
      const config = createLocalConfig()
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 10 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(ethers.parseEther("1000"))

      // cancel the proposal to allow withdrawal
      await governor
        .connect(proposer)
        .cancel([address], [0], [encodedFunctionCall], ethers.keccak256(ethers.toUtf8Bytes("")), {
          gasLimit: 10_000_000,
        })
      expect(await governor.state(proposalId)).to.eql(2n) // cancelled

      // user cannot withdraw non existent deposit
      await governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })

      // should not be able to withdraw again
      await expect(governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })).to.be
        .reverted

      // random user cannot withdraw
      await expect(
        governor.connect(otherAccounts[1]).withdraw(proposalId, otherAccounts[1].address, { gasLimit: 10_000_000 }),
      ).to.be.reverted

      // should not be able to withdraw non existing proposal
      await expect(governor.connect(proposer).withdraw(ethers.ZeroHash, proposer.address, { gasLimit: 10_000_000 })).to
        .be.reverted
    })

    it("User cannot withdraw if VOT3 contract is paused", async () => {
      const config = createLocalConfig()
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3, owner } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)
      expect(await governor.getUserDeposit(proposalId, proposer)).to.eql(ethers.parseEther("1000"))

      // cancel the proposal
      await governor
        .connect(proposer)
        .cancel([address], [0], [encodedFunctionCall], ethers.keccak256(ethers.toUtf8Bytes("")), {
          gasLimit: 10_000_000,
        })
      expect(await governor.state(proposalId)).to.eql(2n) // cancelled

      // pause the VOT3 contract
      await vot3.connect(owner).pause()

      // user cannot withdraw when VOT3 contract is paused
      await expect(governor.connect(proposer).withdraw(proposalId, proposer.address, { gasLimit: 10_000_000 })).to.be
        .reverted
    })

    it("Should not be able to make a deposit if the proposal is state is not pending", async () => {
      const config = createLocalConfig()
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const sponser = otherAccounts[1]
      await getVot3Tokens(sponser, "1000")
      // grant approval to the governor contract
      await vot3.connect(sponser).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // get enough to pay the deposit
      const proposer = otherAccounts[1]
      const depositAmount = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      const depositAmountToPay = (Number(ethers.formatEther(depositAmount)) * 1.2).toString()
      await getVot3Tokens(proposer, depositAmountToPay.toString())
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther(depositAmountToPay))

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit
      const tx = await governor
        .connect(proposer)
        .propose(
          [address],
          [0],
          [encodedFunctionCall],
          "",
          voteStartsInRoundId.toString(),
          ethers.parseEther(depositAmountToPay),
          {
            gasLimit: 10_000_000,
          },
        )

      const proposalId = await getProposalIdFromTx(tx, true)

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      // deposits cannot be withdrawn when proposal is pending

      await waitForProposalToBeActive(proposalId)
      // proposal should be in active state as deposit was met
      expect(await governor.state(proposalId)).to.eql(1n) // active

      // user cannot deposit when proposal is active
      await expect(governor.connect(sponser).deposit(ethers.parseEther("1000"), proposalId, { gasLimit: 10_000_000 }))
        .to.be.reverted

      // wait for voting period to end
      await waitForVotingPeriodToEnd(proposalId)

      // state should be defeated
      expect(await governor.state(proposalId)).to.eql(3n) // defeated

      // user cannot deposit when proposal is not pending
      await expect(governor.connect(sponser).deposit(ethers.parseEther("1000"), proposalId, { gasLimit: 10_000_000 }))
        .to.be.reverted
    })

    //@dev This is being skipped since now deposit threshold depends on the proposal type AND the deposit amount now is capped, so not always the same amount
    it.skip("Deposit should be 2% of the total B3TR supply when proposal was created", async () => {
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      const b3trSupply = await b3tr.totalSupply()
      const depositAmount = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      expect(depositAmount).to.eql(b3trSupply / 50n)

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a no deposit
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), 0, {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, false)

      expect(await governor.proposalDepositReached(proposalId)).to.eql(false)

      const proposalDeposit = await governor.proposalDepositThreshold(proposalId)
      expect(proposalDeposit).to.eql(depositAmount)

      // get enough to pay the deposit
      const sponser = otherAccounts[1]
      await getVot3Tokens(sponser, ethers.formatEther(depositAmount))
      // grant approval to the governor contract
      await vot3.connect(sponser).approve(await governor.getAddress(), proposalDeposit)

      // sponser contributes to the deposit
      await governor.connect(sponser).deposit(proposalDeposit, proposalId, { gasLimit: 10_000_000 })

      expect(await governor.proposalDepositReached(proposalId)).to.eql(true)
      expect(await governor.getProposalDeposits(proposalId)).to.eql(proposalDeposit)

      const b3trSupply2 = await b3tr.totalSupply()
      const depositAmount2 = await governor.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
      expect(depositAmount2).to.eql(b3trSupply2 / 50n)

      const tx2 = await governor
        .connect(proposer)
        .propose(
          [await b3tr.getAddress()],
          [0],
          [B3trContract.interface.encodeFunctionData("tokenDetails", [])],
          "Creating some random proposal",
          (await xAllocationVoting.currentRoundId()) + 1n,
          ethers.parseEther("1000"),
          {
            gasLimit: 10_000_000,
          },
        )

      const proposeReceipt = await tx2.wait()
      // Check that the ProposalDeposit event was emitted with the correct parameters
      const event = proposeReceipt?.logs[2]
      expect(event).not.to.be.undefined

      const decodedLogs = governor.interface.parseLog({
        topics: [...(event?.topics as string[])],
        data: event ? event.data : "",
      })

      // deposit amount
      expect(decodedLogs?.args[2]).to.eql(ethers.parseEther("1000"))

      const proposalId2 = await getProposalIdFromTx(tx2, true)

      const proposalDeposit2 = await governor.proposalDepositThreshold(proposalId2)

      expect(proposalDeposit).to.not.eql(proposalDeposit2)
    })

    it("Should not be able to deposit 0 B3TR", async () => {
      const config = createLocalConfig()
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 10 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      // user cannot deposit 0 B3TR
      await expect(governor.connect(proposer).deposit(0, proposalId, { gasLimit: 10_000_000 })).to.be.reverted
    })

    it("Should not be able to deposit for a proposal that does not exist", async () => {
      const config = createLocalConfig()
      const { b3tr, otherAccounts, governor, B3trContract, xAllocationVoting, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      const proposer = otherAccounts[0]
      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // Start emissions
      await bootstrapAndStartEmissions()

      // Now we can create a new proposal
      const address = await b3tr.getAddress()
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("tokenDetails", [])
      const voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      // Create a proposal with a deposit of 10 VOT3
      const tx = await governor
        .connect(proposer)
        .propose([address], [0], [encodedFunctionCall], "", voteStartsInRoundId.toString(), ethers.parseEther("1000"), {
          gasLimit: 10_000_000,
        })

      const proposalId = await getProposalIdFromTx(tx, true)

      expect(await governor.state(proposalId)).to.eql(0n) // pending

      // user cannot deposit for a proposal that does not exist
      await expect(governor.connect(proposer).deposit(ethers.parseEther("1000"), 100, { gasLimit: 10_000_000 })).to.be
        .reverted
    })
  })

  describe("Libraries", function () {
    let governor: B3TRGovernor

    describe("GovernorClockLogic", function () {
      this.beforeAll(async function () {
        const config = createLocalConfig()
        const {
          governorClockLogicLibV1,
          governorConfiguratorLibV1,
          governorDepositLogicLibV1,
          governorFunctionRestrictionsLogicLibV1,
          governorProposalLogicLibV1,
          governorQuorumLogicLibV1,
          governorStateLogicLibV1,
          governorVotesLogicLibV1,
          owner,
          b3tr,
          timeLock,
          voterRewards,
          xAllocationVoting,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        governor = (await deployProxy(
          "B3TRGovernorV1",
          [
            {
              vot3Token: await voterRewards.getAddress(), // wrong address
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
            GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
          },
        )) as B3TRGovernorV1
      })

      it("Should return the block number retrieved via the Time library if error occurs getting block form vot3 contract", async () => {
        const expectedBlockNumber = await ethers.provider.getBlockNumber()
        const blockNumber = await governor.clock()
        expect(blockNumber).to.eql(BigInt(expectedBlockNumber))
      })

      it("Should return the hardcoded clock mode if error occurs getting clock mode form vot3 contract", async () => {
        const blockNumber = await governor.CLOCK_MODE()
        expect(blockNumber).to.eql("mode=blocknumber&from=default")
      })
    })

    describe("GovernorQuorumLogic", function () {
      it("Should be able to lookup historic quorom numerators", async () => {
        let b3trGovernorFactory: B3TRGovernor__factory

        const {
          governorClockLogicLib,
          governorConfiguratorLib,
          governorDepositLogicLib,
          governorFunctionRestrictionsLogicLib,
          governorProposalLogicLib,
          governorQuorumLogicLib,
          governorStateLogicLib,
          governorVotesLogicLib,
          governor,
          owner,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        b3trGovernorFactory = await ethers.getContractFactory("B3TRGovernorV1", {
          libraries: {
            GovernorClockLogicV1: await governorClockLogicLib.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLib.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLib.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLib.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLib.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLib.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLib.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLib.getAddress(),
          },
        })

        const quorumNumerator = await governor["quorumNumerator()"]()
        const blockNumber = await ethers.provider.getBlockNumber()

        // first add updateTimelock to the whitelist
        const funcSig = governor.interface.getFunction("updateQuorumNumerator")?.selector
        await governor.connect(owner).setWhitelistFunction(await governor.getAddress(), funcSig, true)

        const newQuorum = 10n
        await createProposalAndExecuteIt(
          owner,
          owner,
          governor,
          b3trGovernorFactory,
          "Update Quorum Percentage",
          "updateQuorumNumerator",
          [newQuorum],
        )

        const updatedQuorum = await governor["quorumNumerator()"]()
        expect(updatedQuorum).to.eql(newQuorum)

        // old quorom should be the same
        expect(await governor["quorumNumerator(uint256)"](blockNumber)).to.equal(quorumNumerator) // 4%
      })
    })
    describe("GovernorProposalLogic", function () {
      it("Admin can cancel a proposal when queued in timelock", async function () {
        const {
          governor,
          b3tr,
          B3trContract,
          otherAccount: proposer,
          veBetterPassport,
          otherAccounts,
        } = await getOrDeployContractInstances({ forceDeploy: false })

        const functionToCall = "tokenDetails"
        const description = "Get token details"
        const encodedFunctionCall = B3trContract.interface.encodeFunctionData(functionToCall, [])
        const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description + ` ${this.test?.title}`))

        const voter = otherAccounts[0]
        await getVot3Tokens(voter, "150000")
        await waitForNextBlock()

        await veBetterPassport.whitelist(voter.address)

        // create a new proposal
        const tx = await createProposal(
          b3tr,
          B3trContract,
          proposer,
          description + ` ${this.test?.title}`,
          functionToCall,
          [],
        ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

        const proposalId = await getProposalIdFromTx(tx)

        // pay deposit
        await payDeposit(proposalId.toString(), proposer)

        // wait
        await waitForProposalToBeActive(proposalId)

        // vote
        await governor.connect(voter).castVote(proposalId, 1) // vote for

        // wait
        await waitForVotingPeriodToEnd(proposalId)
        const proposalState = await governor.state(proposalId)
        expect(proposalState.toString()).to.eql("4") // succeded

        // queue
        await governor.queue([await b3tr.getAddress()], [0], [encodedFunctionCall], descriptionHash)
        expect(await governor.state(proposalId)).to.eql(5n)

        // cancel the proposal
        await governor.cancel([await b3tr.getAddress()], [0], [encodedFunctionCall], descriptionHash)
        expect(await governor.state(proposalId)).to.eql(2n) // cancelled
      })
      it("Proposal needs queuing should return true", async function () {
        const {
          governor,
          b3tr,
          B3trContract,
          otherAccount: proposer,
          otherAccounts,
        } = await getOrDeployContractInstances({ forceDeploy: false })

        const functionToCall = "tokenDetails"
        const description = "Get token details"

        const voter = otherAccounts[0]
        await getVot3Tokens(voter, "150000")
        await waitForNextBlock()

        // create a new proposal
        const tx = await createProposal(
          b3tr,
          B3trContract,
          proposer,
          description + ` ${this.test?.title}`,
          functionToCall,
          [],
        ) // Adding the test title to the description to make it unique otherwise it would revert due to proposal already exists

        const proposalId = await getProposalIdFromTx(tx)

        // pay deposit
        await payDeposit(proposalId.toString(), proposer)

        // wait
        await waitForProposalToBeActive(proposalId)

        // vote
        await governor.connect(voter).castVote(proposalId, 1) // vote for

        // wait
        await waitForVotingPeriodToEnd(proposalId)
        const proposalState = await governor.state(proposalId)
        expect(proposalState.toString()).to.eql("4") // succeded

        // queue
        expect(await governor.proposalNeedsQueuing(proposalId)).to.eql(true)
      })
    })
  })

  describe("Relay", function () {
    it("Should be able to relay a transaction", async () => {
      const config = createLocalConfig()
      const {
        governor,
        owner,
        governorClockLogicLib,
        governorConfiguratorLib,
        governorDepositLogicLib,
        governorFunctionRestrictionsLogicLib,
        governorProposalLogicLib,
        governorQuorumLogicLib,
        governorStateLogicLib,
        governorVotesLogicLib,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // whitelist relay function
      const funcSig = governor.interface.getFunction("relay")?.selector
      await governor.connect(owner).setWhitelistFunction(await governor.getAddress(), funcSig, true)

      const executionTx = await createProposalAndExecuteIt(
        owner,
        owner,
        governor,
        await ethers.getContractFactory("B3TRGovernorV1", {
          libraries: {
            GovernorClockLogicV1: await governorClockLogicLib.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLib.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLib.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLib.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLib.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLib.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLib.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLib.getAddress(),
          },
        }),
        "Relay transaction",
        "relay",
        [owner.address, 0, "0x"],
      )

      const receipt = await executionTx.wait()
      if (!receipt) throw new Error("No receipt")

      expect(receipt.status).to.eql(1)
    })

    it("Only governance can relay a transaction", async () => {
      const config = createLocalConfig()
      const { governor, owner, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // whitelist relay function
      const funcSig = governor.interface.getFunction("relay")?.selector
      await governor.connect(owner).setWhitelistFunction(await governor.getAddress(), funcSig, true)

      await expect(governor.connect(otherAccounts[0]).relay(owner.address, 0, "0x", { gasLimit: 10_000_000 })).to.be
        .reverted
    })
  })
})
