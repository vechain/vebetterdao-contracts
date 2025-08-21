import { describe, it, beforeEach } from "mocha"
import {
  setupProposer,
  validateProposalEvents,
  setupGovernanceFixtureWithEmissions,
  GRANT_PROPOSAL_TYPE,
  setupVoter,
} from "./fixture.test"
import {
  B3TRGovernor,
  VOT3,
  B3TR,
  Treasury,
  GrantsManager,
  VeBetterPassport,
  TimeLock,
  Emissions,
  XAllocationVoting,
  GrantsManager__factory,
  GovernorProposalLogic__factory,
  B3TRGovernor__factory,
} from "../../typechain-types"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { expect } from "chai"
import { ContractFactory, Interface } from "ethers"
import {
  createGrantProposal,
  createProposalWithMultipleFunctionsAndExecuteItGrant,
  getRoundId,
  moveBlocks,
  payDeposit,
  waitForCurrentRoundToEnd,
} from "../helpers/common"

describe("Governance - Milestone Creation - @shard4c", function () {
  let governor: B3TRGovernor
  let vot3: VOT3
  let b3tr: B3TR
  let minterAccount: SignerWithAddress
  let proposer: SignerWithAddress
  let secondaryAccount: SignerWithAddress
  let treasury: Treasury
  let grantsManager: GrantsManager
  let owner: SignerWithAddress
  let voter: SignerWithAddress
  let veBetterPassport: VeBetterPassport
  let timeLock: TimeLock
  let grantsManagerAddress: string
  let treasuryAddress: string
  let emissions: Emissions
  let xAllocationVoting: XAllocationVoting
  let contractToPassToMethods: any
  let treasuryContract: ContractFactory
  let grantsManagerInterface: Interface
  let governorProposalLogicInterface: Interface
  let governorInterface: Interface
  beforeEach(async function () {
    const fixture = await setupGovernanceFixtureWithEmissions()
    governor = fixture.governor
    vot3 = fixture.vot3
    b3tr = fixture.b3tr
    minterAccount = fixture.minterAccount
    proposer = fixture.proposer
    secondaryAccount = fixture.otherAccount
    treasury = fixture.treasury
    grantsManager = fixture.grantsManager
    owner = fixture.owner
    voter = fixture.voter
    veBetterPassport = fixture.veBetterPassport
    timeLock = fixture.timeLock
    emissions = fixture.emissions
    xAllocationVoting = fixture.xAllocationVoting

    // Setup proposer for all tests
    await emissions.connect(minterAccount).start()
    await setupProposer(proposer, b3tr, vot3, minterAccount)
    await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

    grantsManagerAddress = await grantsManager.getAddress()
    treasuryAddress = await treasury.getAddress()
    treasuryContract = await ethers.getContractFactory("Treasury")
    contractToPassToMethods = {
      b3tr,
      vot3,
      minterAccount,
      governor,
      treasury,
      emissions,
      xAllocationVoting,
      veBetterPassport,
      owner,
      timeLock,
      grantsManager,
    }

    grantsManagerInterface = GrantsManager__factory.createInterface()
    governorProposalLogicInterface = GovernorProposalLogic__factory.createInterface()
    governorInterface = B3TRGovernor__factory.createInterface()
  })

  describe("Milestone contract setup and creation", function () {
    it("Should set the minimum milestone count", async function () {
      const minimumMilestoneCount = await grantsManager.getMinimumMilestoneCount()
      expect(minimumMilestoneCount).to.equal(2) // MINIMUM_MILESTONE_COUNT = 2
    })

    it("Should have the correct governor role setup", async function () {
      const governorProxyAddress = await governor.getAddress()

      // Check if the governor proxy has the GOVERNANCE_ROLE
      const GOVERNANCE_ROLE = await grantsManager.GOVERNANCE_ROLE()
      const hasRole = await grantsManager.hasRole(GOVERNANCE_ROLE, governorProxyAddress)
      ;(expect(hasRole).to.be.true, "Governor proxy should have GOVERNANCE_ROLE")

      // Verify that the governor is correctly set in the GrantsManager
      const storedGovernor = await grantsManager.getGovernorContract()
      expect(storedGovernor).to.equal(governorProxyAddress, "GrantsManager should have the correct governor address")
    })

    it("Should not create the proposal if the number of milestones is less than the minimum milestone accepted", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000")]

      const roundId = await getRoundId(contractToPassToMethods)
      const calldatas = [treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[0]])]

      expect(
        governor.connect(proposer).proposeGrant(
          [treasuryAddress], // Only Treasury targets for transfers
          [0], // transferb3tr is not payable
          calldatas,
          description,
          roundId,
          0,
          proposer.address,
          milestonesDetailsMetadataURI,
        ),
      ).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "InvalidNumberOfMilestones",
      )
    })

    it("Should not create the proposal if the number of milestones is not equal to the number of values", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      const roundId = await getRoundId(contractToPassToMethods)
      const calldatas = [treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[0]])]

      expect(
        governor.connect(proposer).proposeGrant(
          [treasuryAddress], // Only Treasury targets for transfers
          [0], // transferb3tr is not payable
          calldatas,
          description,
          roundId,
          0,
          proposer.address,
          milestonesDetailsMetadataURI,
        ),
      ).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "InvalidNumberOfMilestones",
      )
    })

    it("Should emit MilestonesCreated event when proposal is created", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      const roundId = await getRoundId(contractToPassToMethods)
      const calldatas = [
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[0]]),
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[1]]),
      ]

      expect(
        governor.connect(proposer).proposeGrant(
          [treasuryAddress], // Only Treasury for now
          [0n, 0n], // transferb3tr is not payable
          calldatas,
          description,
          roundId,
          0,
          proposer.address,
          milestonesDetailsMetadataURI,
        ),
      ).to.emit(grantsManager, "MilestonesCreated")
    })

    it("Should create milestones on proposal creation", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]
      const totalAmount = values.reduce((a, b) => a + b, 0n)

      const calldatas = [
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[0]]),
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[1]]),
      ]

      const tx = await createGrantProposal(
        proposer,
        [treasuryAddress, treasuryAddress], // n time = lenght of the calldatas
        calldatas,
        [0n, 0n],
        description,
        0,
        proposer.address,
        milestonesDetailsMetadataURI,
        contractToPassToMethods,
      )

      const receipt = await tx.wait()

      const { proposalId } = await validateProposalEvents(
        governor,
        receipt,
        Number(GRANT_PROPOSAL_TYPE),
        proposer.address,
        description,
      )

      // Verify milestone data was created during proposal creation
      const storedGrant = await grantsManager.getGrantProposal(proposalId)
      expect(storedGrant.totalAmount).to.equal(totalAmount)
      expect(storedGrant.proposer).to.equal(proposer.address)
      expect(storedGrant.milestones.length).to.equal(calldatas.length)
      expect(storedGrant.milestones[0].amount).to.equal(values[0])
      expect(storedGrant.milestones[1].amount).to.equal(values[1])
      expect(storedGrant.milestones[0].isClaimed).to.equal(false)
      expect(storedGrant.milestones[1].isClaimed).to.equal(false)
      expect(storedGrant.milestones[0].isApproved).to.equal(false)
      expect(storedGrant.milestones[1].isApproved).to.equal(false)
      expect(storedGrant.milestones[0].isRejected).to.equal(false)
      expect(storedGrant.milestones[1].isRejected).to.equal(false)
      expect(storedGrant.metadataURI).to.equal(milestonesDetailsMetadataURI)
      // get the state of the milestone
      const firstMilestoneState = await grantsManager.milestoneState(proposalId, 0)
      const secondMilestoneState = await grantsManager.milestoneState(proposalId, 1)
      expect(firstMilestoneState).to.equal(0) // Pending
      expect(secondMilestoneState).to.equal(0) // Pending
      // get the grant state
      const grantState = await grantsManager.grantState(proposalId)
      expect(grantState).to.equal(0) // Pending state <=> the proposal state
    })

    it("Cannot create the milestone if the function executable is not transferB3TR", async () => {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      // get the roundId
      const roundId = await getRoundId(contractToPassToMethods)
      const calldatas = [treasury.interface.encodeFunctionData("transferVET", [grantsManagerAddress, values[0]])]

      expect(
        governor.connect(proposer).proposeGrant(
          [treasuryAddress], // Only Treasury for now
          [0], // Transfer total amount
          calldatas,
          description,
          roundId,
          0,
          proposer.address,
          milestonesDetailsMetadataURI,
        ),
      ).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "InvalidFunctionSelector",
      )
    })

    it("Cannot create milestone if the value passed is 0", async () => {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("0")]

      const roundId = await getRoundId(contractToPassToMethods)
      const calldatas = [treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[0]])]

      expect(
        governor.connect(proposer).proposeGrant(
          [treasuryAddress], // Only Treasury for now
          [0], // transferb3tr is not payable
          calldatas,
          description,
          roundId,
          0,
          proposer.address,
          milestonesDetailsMetadataURI,
        ),
      ).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "InvalidAmount",
      )
    })

    it("Should not create grant proposal with invalid data", async () => {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      const roundId = await getRoundId(contractToPassToMethods)

      // 2 calldatas, but only 1 target -> should revert
      const calldatas = [
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[0]]),
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[1]]),
      ]
      expect(
        governor.connect(proposer).proposeGrant(
          [treasuryAddress], // Only Treasury for now
          [0], // 2 calldatas, but only 1 value -> should revert
          calldatas,
          description,
          roundId,
          0,
          proposer.address,
          milestonesDetailsMetadataURI,
        ),
      ).to.be.revertedWithCustomError(
        {
          interface: governorProposalLogicInterface,
        },
        "GovernorInvalidProposalLength",
      )
    })

    it("Should create proposal respecting the minVotingDelay", async () => {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]
      await governor.setMinVotingDelay(3) // normally set to 1

      await moveBlocks(17)
      let currentBlock = await governor.clock()
      let currentRoundsEndsAt = await xAllocationVoting.currentRoundDeadline()
      let minVotingDelay = await governor.minVotingDelay()
      expect(minVotingDelay).to.be.greaterThan(currentRoundsEndsAt - currentBlock)

      const calldatas = [
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[0]]),
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[1]]),
      ]

      let voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round
      expect(
        governor.connect(proposer).proposeGrant(
          [treasuryAddress, treasuryAddress], // Only Treasury for now
          [0, 0], // transferb3tr is not payable
          calldatas,
          description,
          voteStartsInRoundId,
          0,
          proposer.address,
          milestonesDetailsMetadataURI,
        ),
      ).to.be.revertedWithCustomError(
        {
          interface: governorProposalLogicInterface,
        },
        "GovernorInvalidStartRound",
      )
      // simulate start of new round with enough voting delay
      await waitForCurrentRoundToEnd()
      await emissions.distribute()

      //not moving blocks, so the proposal should be in the next round
      currentBlock = await governor.clock()
      currentRoundsEndsAt = await xAllocationVoting.currentRoundDeadline()
      minVotingDelay = await governor.minVotingDelay()
      expect(minVotingDelay).to.not.be.greaterThan(currentRoundsEndsAt - currentBlock)

      // Now if we create a proposal it should not revert ( within the voting window )
      voteStartsInRoundId = (await xAllocationVoting.currentRoundId()) + 1n // starts in next round

      await governor.connect(proposer).proposeGrant(
        [treasuryAddress, treasuryAddress], // Only Treasury for now
        [0, 0], // transferb3tr is not payable
        calldatas,
        description,
        voteStartsInRoundId,
        0,
        proposer.address,
        milestonesDetailsMetadataURI,
      )
    })

    it("Should not be able to call createMilestone if it's not the governor", async () => {
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later

      await expect(
        grantsManager
          .connect(owner)
          .createMilestones(milestonesDetailsMetadataURI, 0, proposer.address, owner.address, [], {}),
      ).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "NotAuthorized",
      )
    })
  })

  describe("Milestone execution", function () {
    it("Should send the total amount of the proposal from the treasury to the grants manager", async () => {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr
        "0", // deposit amount
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      const totalAmountFromProposal = await grantsManager.getTotalAmountForMilestones(proposalId)
      expect(totalAmountFromProposal).to.equal(values.reduce((a, b) => a + b, 0n))

      expect(await b3tr.balanceOf(grantsManagerAddress)).to.equal(totalAmountFromProposal)
    })

    it("Should create a milestone in pending state", async () => {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later

      const calldatas = [
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")]),
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")]),
      ]

      const roundId = await getRoundId(contractToPassToMethods)
      const tx = await governor.connect(proposer).proposeGrant(
        [treasuryAddress, treasuryAddress], // Only Treasury for now
        [0, 0], // transferb3tr is not payable
        calldatas,
        description,
        roundId,
        0, // depositAmount
        proposer.address,
        milestonesDetailsMetadataURI,
      )

      const receipt = await tx.wait()
      const { proposalId } = await validateProposalEvents(
        governor,
        receipt,
        Number(GRANT_PROPOSAL_TYPE),
        proposer.address,
        description,
      )
      const milestoneStatus = await grantsManager.milestoneState(proposalId, 0)
      expect(milestoneStatus).to.equal(0)
    })

    it("Once the proposal is executed, the milestone can be validated by the GRANTS_APPROVER_ROLE or the governor", async () => {
      const description = "My new project"
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, ethers.parseEther("1")],
          [grantsManagerAddress, ethers.parseEther("1")],
        ], // args of transferb3tr
        "0", // deposit amount
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      // try to approve without having the GRANTS_APPROVER_ROLE (owner already have it in deploy.ts)
      await expect(grantsManager.connect(proposer).approveMilestones(proposalId, 0)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "NotAuthorized",
      )
      // grant owner the approver role
      await grantsManager.grantRole(await grantsManager.GRANTS_APPROVER_ROLE(), owner.address)
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      const milestonseRegistered = await grantsManager.getMilestone(proposalId, 0) // the first one should be validated
      expect(milestonseRegistered.isApproved).to.equal(true) // Approved
      expect(milestonseRegistered.amount).to.equal(ethers.parseEther("1"))

      // other milestone should be pending
      const milestonseRegistered2 = await grantsManager.getMilestone(proposalId, 1) // the second one should be pending
      expect(milestonseRegistered2.isApproved).to.equal(false) // Pending
    })

    it("Should not be able to validate the milestone if the proposal is not executed or did not pass the deposit or voting threshold", async () => {
      const description = "My new project"
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later

      // set to 1 milestone for simplicity
      await grantsManager.setMinimumMilestoneCount(1)

      const roundId = await getRoundId(contractToPassToMethods)
      const tx = await governor.connect(proposer).proposeGrant(
        [treasuryAddress], // Only Treasury for now
        [0], // transferb3tr is not payable
        [treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")])],
        description,
        roundId,
        0,
        proposer.address,
        milestonesDetailsMetadataURI,
      )
      const receipt = await tx.wait()

      const { proposalId } = await validateProposalEvents(
        governor,
        receipt,
        Number(GRANT_PROPOSAL_TYPE),
        proposer.address,
        description,
      )
      const milestone = await grantsManager.getMilestone(proposalId, 0)
      expect(milestone.isApproved).to.equal(false) // Pending
      expect(milestone.isClaimed).to.equal(false) // Pending

      // grant owner the approver role
      await grantsManager.grantRole(await grantsManager.GRANTS_APPROVER_ROLE(), owner.address)
      await expect(grantsManager.connect(owner).approveMilestones(proposalId, 0)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "ProposalNotExecuted",
      )
    })

    it("Only admin can approve the milestones", async () => {
      const description = "My new project"
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later

      // set to 1 milestone for simplicity
      await grantsManager.setMinimumMilestoneCount(1)

      const roundId = await getRoundId(contractToPassToMethods)
      const tx = await governor.connect(proposer).proposeGrant(
        [treasuryAddress], // Only Treasury for now
        [0], // transferb3tr is not payable
        [treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")])],
        description,
        roundId,
        0,
        proposer.address,
        milestonesDetailsMetadataURI,
      )
      const receipt = await tx.wait()

      const { proposalId } = await validateProposalEvents(
        governor,
        receipt,
        Number(GRANT_PROPOSAL_TYPE),
        proposer.address,
        description,
      )

      // grant owner the approver role
      await grantsManager.grantRole(await grantsManager.GRANTS_APPROVER_ROLE(), owner.address)
      await expect(grantsManager.connect(voter).approveMilestones(proposalId, 0)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "NotAuthorized",
      )
    })

    it("Milestone should be claimed by the PROPOSER once the proposal is executed and the milestone is validated", async () => {
      const description = "My new project"
      const values = [ethers.parseEther("10000"), ethers.parseEther("10000")]
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr( should have a revert if the amount is not equal)
        "0", // deposit amount
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      const balanceBeforeClaiming = await b3tr.balanceOf(proposer.address)

      // try to approve with someone else than the governor roles
      // grant owner the approver role
      await grantsManager.grantRole(await grantsManager.GRANTS_APPROVER_ROLE(), owner.address)
      await expect(grantsManager.connect(proposer).approveMilestones(proposalId, 0)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "NotAuthorized",
      )
      // try to claim will it have not been approve by any governor role
      await expect(grantsManager.connect(proposer).claimMilestone(proposalId, 0)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "MilestoneNotApprovedByAdmin",
      )

      // grant owner the approver role
      await grantsManager.grantRole(await grantsManager.GRANTS_APPROVER_ROLE(), owner.address)
      // try to approve the 2nd milestone before approving the first one
      await expect(grantsManager.connect(owner).approveMilestones(proposalId, 1)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "PreviousMilestoneNotApproved",
      )

      // approve with the correct role
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      // try to claim with someone else than the proposal owner
      await expect(grantsManager.connect(voter).claimMilestone(proposalId, 0)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "CallerIsNotTheGrantReceiver",
      )

      // try to claim the 2nd milestone before approving the first one
      await expect(grantsManager.connect(proposer).claimMilestone(proposalId, 1)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "MilestoneNotApprovedByAdmin",
      )

      // approve the milestone
      // claim the milestone with the correct role
      await grantsManager.connect(proposer).claimMilestone(proposalId, 0)

      // check the state of the milestone 0
      const milestone0 = await grantsManager.getMilestone(proposalId, 0)
      expect(milestone0.isClaimed).to.equal(true) // Claimed

      // approve the second milestone
      await grantsManager.connect(owner).approveMilestones(proposalId, 1)
      // claim the second milestone
      await grantsManager.connect(proposer).claimMilestone(proposalId, 1)

      const balanceAfterClaiming = await b3tr.balanceOf(proposer.address)
      expect(balanceAfterClaiming).to.equal(balanceBeforeClaiming + ethers.parseEther("20000"))
    })

    it("Milestone should be claimed by the GRANTS RECEIVER once the proposal is executed and the milestone is validated", async () => {
      const description = "My new project"
      const values = [ethers.parseEther("10000"), ethers.parseEther("10000")]
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr( should have a revert if the amount is not equal)
        "0", // deposit amount
        secondaryAccount.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      const balanceBeforeClaiming = await b3tr.balanceOf(secondaryAccount.address)

      // try to approve with someone else than the governor roles
      // grant owner the approver role
      await grantsManager.grantRole(await grantsManager.GRANTS_APPROVER_ROLE(), owner.address)
      await expect(grantsManager.connect(proposer).approveMilestones(proposalId, 0)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "NotAuthorized",
      )
      // try to claim will it have not been approve by any governor role
      await expect(grantsManager.connect(secondaryAccount).claimMilestone(proposalId, 0)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "MilestoneNotApprovedByAdmin",
      )

      // grant owner the approver role
      await grantsManager.grantRole(await grantsManager.GRANTS_APPROVER_ROLE(), owner.address)
      // try to approve the 2nd milestone before approving the first one
      await expect(grantsManager.connect(owner).approveMilestones(proposalId, 1)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "PreviousMilestoneNotApproved",
      )

      // approve with the correct role
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      // try to claim with someone else than the grants receiver
      await expect(grantsManager.connect(voter).claimMilestone(proposalId, 0)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "CallerIsNotTheGrantReceiver",
      )

      // try to claim the 2nd milestone before approving the first one
      await expect(grantsManager.connect(secondaryAccount).claimMilestone(proposalId, 1)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "MilestoneNotApprovedByAdmin",
      )

      // approve the milestone
      // claim the milestone with the correct role
      await grantsManager.connect(secondaryAccount).claimMilestone(proposalId, 0)

      // check the state of the milestone 0
      const milestone0 = await grantsManager.getMilestone(proposalId, 0)
      expect(milestone0.isClaimed).to.equal(true) // Claimed

      // approve the second milestone
      await grantsManager.connect(owner).approveMilestones(proposalId, 1)
      // claim the second milestone
      await grantsManager.connect(secondaryAccount).claimMilestone(proposalId, 1)

      const balanceAfterClaiming = await b3tr.balanceOf(secondaryAccount.address)
      expect(balanceAfterClaiming).to.equal(balanceBeforeClaiming + ethers.parseEther("20000"))
    })

    it("Cannot claim twice the same milestone", async () => {
      const description = "My new project"
      const values = [ethers.parseEther("10000"), ethers.parseEther("10000")]
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr( should have a revert if the amount is not equal)
        "0", // deposit amount
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      // approve the milestone
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      // claim the milestone
      await grantsManager.connect(proposer).claimMilestone(proposalId, 0)
      // claim the milestone again
      await expect(grantsManager.connect(proposer).claimMilestone(proposalId, 0)).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "MilestoneAlreadyClaimed",
      )
    })

    it("Should not be able to claim a milestone if the grant manager is paused", async () => {
      const description = "My new project"
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("10000")]

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr
        "0", // deposit amount
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      await grantsManager.connect(owner).pause()
      await expect(grantsManager.connect(proposer).claimMilestone(proposalId, 0)).to.be.reverted
      await grantsManager.connect(owner).unpause()
      await grantsManager.connect(proposer).claimMilestone(proposalId, 0)
    })

    // it("Should correctly approve / claim the milestones if more than 1 grants proposal are created")
  })

  describe("Proposal and milestone description modification", function () {
    it("Cannot create milestone if the milestone details metadata URI is empty", async () => {
      const description = "My new project"
      const milestonesDetailsMetadataURI = ""
      const values = [ethers.parseEther("10000"), ethers.parseEther("10000")]

      const roundId = await getRoundId(contractToPassToMethods)
      const calldatas = [treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, values[0]])]

      expect(
        governor.connect(proposer).proposeGrant(
          [treasuryAddress], // Only Treasury for now
          [0], // transferb3tr is not payable
          calldatas,
          description,
          roundId,
          0,
          proposer.address,
          milestonesDetailsMetadataURI,
        ),
      ).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "MilestoneDetailsMetadataURIEmpty",
      )
    })

    it("Should be able to update the milestone details metadata URI", async () => {
      const description = "My new project"
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const newMilestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qp..." // milestones details can be changed later

      const roundId = await getRoundId(contractToPassToMethods)
      const calldatas = [
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")]),
      ]

      // set to 1 milestone for simplicity
      await grantsManager.setMinimumMilestoneCount(1)

      const tx = await governor.connect(proposer).proposeGrant(
        [treasuryAddress], // Only Treasury for now
        [0], // transferb3tr is not payable
        calldatas,
        description,
        roundId,
        0,
        proposer.address,
        milestonesDetailsMetadataURI,
      )

      const receipt = await tx.wait()
      const { proposalId } = await validateProposalEvents(
        governor,
        receipt,
        Number(GRANT_PROPOSAL_TYPE),
        proposer.address,
        description,
      )

      await grantsManager.connect(proposer).updateMilestoneMetadataURI(proposalId, newMilestonesDetailsMetadataURI)

      const grants = await grantsManager.getGrantProposal(proposalId)
      expect(grants.metadataURI).to.equal(newMilestonesDetailsMetadataURI)
    })

    it("Proposer should  NOT be able to update the grants receiver", async () => {
      const description = "My new project"
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("10000")]

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr
        "0", // deposit amount
        secondaryAccount.address, // grants receiver
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )
      const originalGrantsReceiver = await grantsManager.getGrantsReceiverAddress(proposalId)
      expect(originalGrantsReceiver).to.equal(secondaryAccount.address)

      await expect(
        grantsManager.connect(proposer).updateGrantsReceiver(proposalId, owner.address),
      ).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "NotAuthorized",
      )

      const grants = await grantsManager.getGrantProposal(proposalId)
      expect(grants.grantsReceiver).to.equal(originalGrantsReceiver) // Should not be updated
    })

    it("Governance should be able to update the grants receiver", async () => {
      const description = "My new project"
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("10000")]

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr
        "0", // deposit amount
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )
      const originalGrantsReceiver = await grantsManager.getGrantsReceiverAddress(proposalId)
      expect(originalGrantsReceiver).to.equal(proposer.address)

      await grantsManager.connect(owner).updateGrantsReceiver(proposalId, owner.address)
      const grants = await grantsManager.getGrantProposal(proposalId)
      const newGrantsReceiver = owner.address
      expect(grants.grantsReceiver).to.equal(newGrantsReceiver) // Should be updated
      expect(newGrantsReceiver).to.not.equal(originalGrantsReceiver) // Should be different
    })
    it("Current grants receiver should be able to update the grants receiver", async () => {
      const description = "My new project"
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("10000")]

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr
        "0", // deposit amount
        secondaryAccount.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )
      const originalGrantsReceiver = await grantsManager.getGrantsReceiverAddress(proposalId)
      expect(originalGrantsReceiver).to.equal(secondaryAccount.address)

      const newGrantsReceiver = owner.address
      await grantsManager.connect(secondaryAccount).updateGrantsReceiver(proposalId, newGrantsReceiver)
      const grants = await grantsManager.getGrantProposal(proposalId)
      expect(grants.grantsReceiver).to.equal(newGrantsReceiver) // Should be updated
      expect(newGrantsReceiver).to.not.equal(originalGrantsReceiver) // Should be different
    })
  })

  describe("Milestone deposit", function () {
    it("Proposer should not be able to deposits it's own grant, but can deposit for other grants", async function () {
      const description = "My new project"
      const description2 = "My new project 2"
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later s

      const roundId = await getRoundId(contractToPassToMethods)
      const tx = await governor.connect(proposer).proposeGrant(
        [treasuryAddress, treasuryAddress], // Only Treasury for now
        [0, 0], // transferb3tr is not payable
        [
          treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")]),
          treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")]),
        ],
        description,
        roundId,
        0,
        proposer.address,
        milestonesDetailsMetadataURI,
      )
      const receipt = await tx.wait()
      const { proposalId: proposalId1 } = await validateProposalEvents(
        governor,
        receipt,
        Number(GRANT_PROPOSAL_TYPE),
        proposer.address,
        description,
      )
      const tx2 = await governor.connect(owner).proposeGrant(
        [treasuryAddress, treasuryAddress], // Only Treasury for now
        [0, 0], // transferb3tr is not payable
        [
          treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")]),
          treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")]),
        ],
        description2,
        roundId,
        0,
        proposer.address,
        milestonesDetailsMetadataURI,
      )
      const receipt2 = await tx2.wait()
      const { proposalId: proposalId2 } = await validateProposalEvents(
        governor,
        receipt2,
        Number(GRANT_PROPOSAL_TYPE),
        owner.address,
        description2,
      )

      // get the deposit amount
      const depositAmount = await governor.getProposalDeposits(proposalId1)
      const depositAmount2 = await governor.getProposalDeposits(proposalId2)

      expect(depositAmount).to.equal(ethers.parseEther("0"))
      expect(depositAmount2).to.equal(ethers.parseEther("0"))

      // Proposer can deposit for other grants
      await governor.connect(proposer).deposit(ethers.parseEther("1"), proposalId2)
      await expect(
        governor.connect(proposer).deposit(ethers.parseEther("1"), proposalId1),
      ).to.be.revertedWithCustomError(
        {
          interface: governorInterface,
        },
        "GranteeCannotDepositOwnGrant",
      )

      const depositAmount3 = await governor.getProposalDeposits(proposalId2)
      expect(depositAmount3).to.equal(ethers.parseEther("1"))
    })
  })

  describe("Milestone rejection", function () {
    it("Funds should be returned from the grants treasury to the DAO treasury if a milestone is rejected", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      const granteeBalanceBeforeProposal = await b3tr.balanceOf(proposer.address)

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr
        0,
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      // Balances after the proposal
      const treasuryBalanceAfterProposalExecuted = await b3tr.balanceOf(treasuryAddress) // - 30000 (removed from the DAO's treasury to the grants manager)
      const grantsManagerBalanceAfterProposalExecuted = await b3tr.balanceOf(grantsManagerAddress) // + 30000

      // approve + claim, the grantee should have 10000
      const granteeClaimingAmount = ethers.parseEther("10000")
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      await grantsManager.connect(proposer).claimMilestone(proposalId, 0)
      const granteeBalanceBeforeRejection = await b3tr.balanceOf(proposer.address)
      expect(granteeBalanceBeforeRejection).to.equal(granteeBalanceBeforeProposal + granteeClaimingAmount)

      const grantsManagerBalanceAfterGranteeClaiming = await b3tr.balanceOf(grantsManagerAddress)
      expect(grantsManagerBalanceAfterGranteeClaiming).to.equal(
        grantsManagerBalanceAfterProposalExecuted - granteeClaimingAmount,
      )

      // Should transfer back to the DAO's treasury the remaingin funds ( 10 000 )
      await grantsManager.grantRole(await grantsManager.GRANTS_REJECTOR_ROLE(), owner.address)
      await expect(grantsManager.connect(owner).rejectMilestones(proposalId)).to.emit(
        grantsManager,
        "MilestoneRejectedAndFundsReturnedToTreasury",
      )

      // Check the states ( Grant should be Canceled, Milestone1 should be Claimed, Milestone2 should be Rejected )
      const grantState = await grantsManager.grantState(proposalId)
      expect(grantState).to.equal(2) // Canceled
      const milestoneState = await grantsManager.milestoneState(proposalId, 0)
      expect(milestoneState).to.equal(2n) // Claimed
      const milestoneState2 = await grantsManager.milestoneState(proposalId, 1)
      expect(milestoneState2).to.equal(3n) // Rejected

      const isGrantRejected = await grantsManager.isGrantRejected(proposalId)
      expect(isGrantRejected).to.equal(true)

      const grantsManagerBalanceAfterRejection = await b3tr.balanceOf(grantsManagerAddress)
      expect(grantsManagerBalanceAfterRejection).to.equal(0)
    })

    it("Funds should be returned from the grants treasury to the DAO treasury if a grant is rejected, the already claimed funds should not be returned", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000"), ethers.parseEther("30000")]

      const granteeBalanceBeforeProposal = await b3tr.balanceOf(proposer.address)

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
          [grantsManagerAddress, values[2]],
        ], // args of transferb3tr
        0,
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      // Balances after the proposal
      const grantsManagerBalanceAfterProposalExecuted = await b3tr.balanceOf(grantsManagerAddress) // + 30000

      // Balances before the rejection
      const treasuryBalanceBeforeRejection = await b3tr.balanceOf(treasuryAddress)

      // approve + claim, the grantee should have 10000
      const granteeClaimingAmount = ethers.parseEther("10000")
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      await grantsManager.connect(proposer).claimMilestone(proposalId, 0)
      const granteeBalanceBeforeRejection = await b3tr.balanceOf(proposer.address)
      expect(granteeBalanceBeforeRejection).to.equal(granteeBalanceBeforeProposal + granteeClaimingAmount)

      const grantsManagerBalanceAfterGranteeClaiming = await b3tr.balanceOf(grantsManagerAddress)
      expect(grantsManagerBalanceAfterGranteeClaiming).to.equal(
        grantsManagerBalanceAfterProposalExecuted - granteeClaimingAmount,
      )

      // Should transfer back to the DAO's treasury the remaingin funds ( 10 000 )
      await grantsManager.grantRole(await grantsManager.GRANTS_REJECTOR_ROLE(), owner.address)
      await expect(grantsManager.connect(owner).rejectMilestones(proposalId)).to.emit(
        grantsManager,
        "MilestoneRejectedAndFundsReturnedToTreasury",
      )

      // Check the states ( Grant should be Canceled, Milestone1 should be Claimed, Milestone2 should be Rejected )
      const grantState = await grantsManager.grantState(proposalId)
      expect(grantState).to.equal(2) // Canceled
      const milestoneState = await grantsManager.milestoneState(proposalId, 0)
      expect(milestoneState).to.equal(2n) // Claimed
      const milestoneState2 = await grantsManager.milestoneState(proposalId, 1)
      expect(milestoneState2).to.equal(3n) // Rejected
      const milestoneState3 = await grantsManager.milestoneState(proposalId, 2)
      expect(milestoneState3).to.equal(3n) // Rejected

      const isGrantRejected = await grantsManager.isGrantRejected(proposalId)
      expect(isGrantRejected).to.equal(true)

      const grantsManagerBalanceAfterRejection = await b3tr.balanceOf(grantsManagerAddress)
      expect(grantsManagerBalanceAfterRejection).to.equal(0)

      //Current treasury balance should be the sum of the milestones 2 and 3 and past balance
      const currentTreasuryBalance = await b3tr.balanceOf(treasuryAddress)
      expect(currentTreasuryBalance).to.be.eq(treasuryBalanceBeforeRejection + values[1] + values[2])
    })
  })

  describe("Milestone states", function () {
    it("If all the milestone are approved, the proposal should be completed", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr
        0,
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      // Approve the first milestone
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      // Approve the second milestone
      await grantsManager.connect(owner).approveMilestones(proposalId, 1)

      // Claim the first milestone
      await grantsManager.connect(proposer).claimMilestone(proposalId, 0)
      // Claim the second milestone
      await grantsManager.connect(proposer).claimMilestone(proposalId, 1)

      // Check the states ( Proposal should be Executed, Milestone should be Claimed )
      const grantState = await grantsManager.grantState(proposalId)
      expect(grantState).to.equal(9) // Completed ( all funds have been sent )
      const milestoneState = await grantsManager.milestoneState(proposalId, 0)
      expect(milestoneState).to.equal(2n) // Claimed
      const milestoneState2 = await grantsManager.milestoneState(proposalId, 1)
      expect(milestoneState2).to.equal(2n) // Claimed
      const isGrantCompleted = await grantsManager.isGrantCompleted(proposalId)
      expect(isGrantCompleted).to.equal(true)
    })
    it("If a milestone is rejected, the grant should be canceled", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr
        0,
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      // Approve the first milestone
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      // Claim the first milestone
      await grantsManager.connect(proposer).claimMilestone(proposalId, 0)

      // Reject the second milestone
      await grantsManager.connect(owner).rejectMilestones(proposalId)

      // Check the states ( Proposal should be Canceled, Milestone1 should be Claimed, Milestone2 should be Rejected )
      const grantState = await grantsManager.grantState(proposalId)
      expect(grantState).to.equal(2) // Canceled
      const milestoneState = await grantsManager.milestoneState(proposalId, 0)
      expect(milestoneState).to.equal(2n) // Claimed
      const milestoneState2 = await grantsManager.milestoneState(proposalId, 1)
      expect(milestoneState2).to.equal(3n) // Rejected
      const isGrantRejected = await grantsManager.isGrantRejected(proposalId)
      expect(isGrantRejected).to.equal(true)
    })

    it("If any milestone is still pending, the grant should be in development", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr
        0,
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )

      // Approve the first milestone
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      // Claim the first milestone
      await grantsManager.connect(proposer).claimMilestone(proposalId, 0) // Claim the first milestone

      // Check the states ( Proposal should be InDevelopment, Milestone1 should be Claimed, Milestone2 should be Pending )
      const grantState = await grantsManager.grantState(proposalId)
      expect(grantState).to.equal(8) // InDevelopment
      const milestoneState = await grantsManager.milestoneState(proposalId, 0)
      expect(milestoneState).to.equal(2n) // Claimed
      const milestoneState2 = await grantsManager.milestoneState(proposalId, 1)
      expect(milestoneState2).to.equal(0n) // Pending
      const isGrantInDevelopment = await grantsManager.isGrantInDevelopment(proposalId)
      expect(isGrantInDevelopment).to.equal(true)
    })

    it("Grant should be in developement if the proposal is executed and at least one milestone is pending", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      const { proposalId } = await createProposalWithMultipleFunctionsAndExecuteItGrant(
        proposer, // proposer
        owner, // voter
        [treasury, treasury], // targets ( 2 transfers )
        treasuryContract, // contract to pass to avoid re-deploying the contracts
        description, // description ( will be empty in the proposal, because if modified, the proposalId and milestoneId will be modified => lost in the see)
        ["transferB3TR", "transferB3TR"], // functionToCall
        [
          [grantsManagerAddress, values[0]],
          [grantsManagerAddress, values[1]],
        ], // args of transferb3tr
        0,
        proposer.address,
        milestonesDetailsMetadataURI, // milestones
        contractToPassToMethods, // contracts to pass to avoid re-deploying the contracts
      )
      // Approve the first milestone
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)

      // Claim the first milestone
      await grantsManager.connect(proposer).claimMilestone(proposalId, 0)

      const grantState = await grantsManager.grantState(proposalId)
      expect(grantState).to.equal(8) // InDevelopment
      const milestoneState = await grantsManager.milestoneState(proposalId, 0)
      expect(milestoneState).to.equal(2n) // Claimed
      const milestoneState2 = await grantsManager.milestoneState(proposalId, 1)
      expect(milestoneState2).to.equal(0n) // Pending
      const isGrantCompleted = await grantsManager.isGrantCompleted(proposalId)
      expect(isGrantCompleted).to.equal(false)
      const isGrantInDevelopment = await grantsManager.isGrantInDevelopment(proposalId)
      expect(isGrantInDevelopment).to.equal(true)
    })

    it("Grant should neither be in development nor completed if the proposal is not executed ( the funds are not yet transferred to the grants manager )", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later

      const roundId = await getRoundId(contractToPassToMethods)
      await grantsManager.setMinimumMilestoneCount(1)

      const tx = await governor.connect(proposer).proposeGrant(
        [treasuryAddress], // Only Treasury for now
        [0], // transferb3tr is not payable
        [treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")])],
        description,
        roundId,
        0,
        proposer.address,
        milestonesDetailsMetadataURI,
      )

      const receipt = await tx.wait()
      const { proposalId } = await validateProposalEvents(
        governor,
        receipt,
        Number(GRANT_PROPOSAL_TYPE),
        proposer.address,
        description,
      )

      const grantState = await grantsManager.grantState(proposalId)
      expect(grantState).to.equal(0) // Pending
      const milestoneState = await grantsManager.milestoneState(proposalId, 0)
      expect(milestoneState).to.equal(0n) // Pending
      const isGrantCompleted = await grantsManager.isGrantCompleted(proposalId)
      expect(isGrantCompleted).to.equal(false)
      const isGrantInDevelopment = await grantsManager.isGrantInDevelopment(proposalId)
      expect(isGrantInDevelopment).to.equal(false)
    })

    it("Until it is executed , grants manager and b3tr governor state should be exacly the same", async function () {
      // Setup voter
      await setupVoter(voter, b3tr, vot3, minterAccount, owner, veBetterPassport)

      const description = "My new project"
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later s
      const targets = [treasuryAddress, treasuryAddress]
      const values = [0, 0]
      const calldatas = [
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")]),
        treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")]),
      ]
      const roundId = await getRoundId(contractToPassToMethods)
      const tx = await governor.connect(proposer).proposeGrant(
        targets, // Only Treasury for now
        values, // transferb3tr is not payable
        calldatas,
        description,
        roundId,
        0,
        proposer.address,
        milestonesDetailsMetadataURI,
      )
      const receipt = await tx.wait()
      const { proposalId } = await validateProposalEvents(
        governor,
        receipt,
        Number(GRANT_PROPOSAL_TYPE),
        proposer.address,
        description,
      )
      // Check the states ( Proposal should be Pending and Grant should be Pending )
      expect(await governor.state(proposalId)).to.equal(await grantsManager.grantState(proposalId))
      //Pay the deposit
      await payDeposit(proposalId, owner)

      //Check the states ( Proposal should be Des and Grant should be Pending )
      expect(await governor.state(proposalId)).to.equal(await grantsManager.grantState(proposalId))

      // simulate start of new round with enough voting delay
      await waitForCurrentRoundToEnd()
      await emissions.distribute()

      //Check the states ( Proposal should be active and Grant should be active )
      expect(await governor.state(proposalId)).to.equal(await grantsManager.grantState(proposalId))

      await governor.connect(voter).castVote(proposalId, 1, { gasLimit: 10_000_000 }) // vote for

      // simulate start of new round with enough voting delay
      await waitForCurrentRoundToEnd()
      await emissions.distribute()

      //Check the states ( Proposal should be Succeeded and Grant should be Succeeded )
      expect(await governor.state(proposalId)).to.equal(await grantsManager.grantState(proposalId))

      // Queue the proposal
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
      await governor.connect(proposer).queue(targets, values, calldatas, descriptionHash)

      //Check the states ( Proposal should be Queued and Grant should be Queued )
      expect(await governor.state(proposalId)).to.equal(await grantsManager.grantState(proposalId))

      // Execute the proposal
      await governor.connect(owner).execute(targets, values, calldatas, descriptionHash)

      //Check the states ( Proposal should be Executed and Grant should be InDevelopment )
      expect(await governor.state(proposalId)).to.equal("6")
      expect(await grantsManager.grantState(proposalId)).to.equal("8")

      //Approve first milestone
      await grantsManager.connect(owner).approveMilestones(proposalId, 0)
      // Claim first milestone
      await grantsManager.connect(proposer).claimMilestone(proposalId, 0)

      //Governor state should remain executed and grant state should remain in development
      expect(await governor.state(proposalId)).to.equal("6")
      expect(await grantsManager.grantState(proposalId)).to.equal("8")

      //Approve second milestone (this is the last one)
      await grantsManager.connect(owner).approveMilestones(proposalId, 1)
      // Claim second milestone
      await grantsManager.connect(proposer).claimMilestone(proposalId, 1)

      //Governor state should remain executed and grant state should be completed
      expect(await governor.state(proposalId)).to.equal("6")
      expect(await grantsManager.grantState(proposalId)).to.equal("9")
    })
  })

  describe("Pause and unpause", function () {
    it("Only pauser role or governance should be able to pause and unpause the grants manager", async function () {
      await expect(grantsManager.connect(proposer).pause()).to.be.revertedWithCustomError(
        {
          interface: grantsManagerInterface,
        },
        "NotAuthorized",
      )
      await grantsManager.grantRole(await grantsManager.PAUSER_ROLE(), proposer.address)

      await expect(grantsManager.connect(proposer).pause()).to.emit(grantsManager, "Paused")
      await expect(grantsManager.connect(proposer).unpause()).to.emit(grantsManager, "Unpaused")
    })
    it("Should not be able to create a proposal if the grant manager is paused", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later

      const roundId = await getRoundId(contractToPassToMethods)
      await grantsManager.setMinimumMilestoneCount(1)

      await grantsManager.connect(owner).pause()
      await expect(
        governor.connect(proposer).proposeGrant(
          [treasuryAddress], // Only Treasury for now
          [0], // transferb3tr is not payable
          [treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")])],
          description,
          roundId,
          0,
          proposer.address,
          milestonesDetailsMetadataURI,
        ),
      ).to.be.reverted

      await grantsManager.connect(owner).unpause()
      expect(
        await governor
          .connect(proposer)
          .proposeGrant(
            [treasuryAddress],
            [0],
            [treasury.interface.encodeFunctionData("transferB3TR", [grantsManagerAddress, ethers.parseEther("1")])],
            description,
            roundId,
            0,
            proposer.address,
            milestonesDetailsMetadataURI,
          ),
      ).to.emit(governor, "ProposalCreated")
    })
  })
})
