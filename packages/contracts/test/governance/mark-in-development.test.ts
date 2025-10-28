import { describe, it, beforeEach } from "mocha"
import {
  setupProposer,
  validateProposalEvents,
  setupGovernanceFixtureWithEmissions,
  GRANT_PROPOSAL_TYPE,
  setupVoter,
  setupSupporter,
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
  createProposalAndExecuteIt,
  createProposalWithMultipleFunctionsAndExecuteItGrant,
  getProposalIdFromTx,
  getRoundId,
  moveBlocks,
  payDeposit,
  startNewAllocationRound,
  waitForCurrentRoundToEnd,
  waitForProposalToBeActive,
  waitForVotingPeriodToEnd,
} from "../helpers/common"

describe("Governance - Mark in development/completed - @shard4k", function () {
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
  let otherAccounts: SignerWithAddress[]
  let b3trContract: ContractFactory
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
    otherAccounts = fixture.otherAccounts
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
    b3trContract = await ethers.getContractFactory("B3TR")
  })

  describe("State Transitions - Mark as IN-DEVELOPMENT", function () {
    it("(EXECUTABLE PROPOSAL) Should NOT be able to mark as IN-DEVELOPMENT from SUCCEEDED state - must execute first", async function () {
      const functionToCall = "tokenDetails"
      const encodedFunctionCall = b3trContract.interface.encodeFunctionData(functionToCall, [])
      const targets = [await b3tr.getAddress()]
      const values = [0]
      const calldatas = [encodedFunctionCall]
      const description = `description-${this.test?.title}`
      const startRoundId = (await getRoundId()) + 1

      // Create executable proposal
      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description, startRoundId, 0)
      const proposalId = await getProposalIdFromTx(tx)

      // Deposit and support
      const proposalDepositThreshold = await governor.proposalDepositThreshold(proposalId)
      await setupSupporter(proposer, vot3, proposalDepositThreshold, governor)
      await governor.connect(proposer).deposit(proposalDepositThreshold, proposalId)

      await waitForCurrentRoundToEnd()

      // Setup voters
      await setupVoter(otherAccounts[0], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)

      // Start voting round
      await startNewAllocationRound({ emissions, xAllocationVoting })

      // Wait for proposal to be active
      await waitForProposalToBeActive(proposalId, { governor })

      // Vote
      await governor.connect(otherAccounts[0]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[1]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[2]).castVote(proposalId, 1)

      // Wait for voting period to end
      await waitForVotingPeriodToEnd(proposalId)

      // Start queue/execution round
      await startNewAllocationRound({ emissions, xAllocationVoting })

      // Proposal should be succeeded
      expect(await governor.state(proposalId)).to.equal(4) // Succeeded

      // Should NOT be able to mark as IN-DEVELOPMENT from Succeeded state
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await expect(governor.connect(owner).markAsInDevelopment(proposalId)).to.be.revertedWithCustomError(
        governor,
        "GovernorRestrictedProposal",
      )

      // State should remain Succeeded
      expect(await governor.state(proposalId)).to.equal(4) // Succeeded
    })
  })

  describe("Permissions - Mark as IN-DEVELOPMENT", function () {
    it("(TEXT-ONLY PROPOSAL) Should NOT be able to mark as IN-DEVELOPMENT if not the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const targets = []
      const values = []
      const calldatas = []
      const description = `description-${this.test?.title}`
      const startRoundId = (await getRoundId()) + 1

      // Create proposal
      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description, startRoundId, 0)

      const proposalId = await getProposalIdFromTx(tx)

      // Mint tokens and approve for spending in proposal deposit
      const proposalDepositThreshold = await governor.proposalDepositThreshold(proposalId)
      await setupSupporter(proposer, vot3, proposalDepositThreshold, governor)
      await governor.connect(proposer).deposit(proposalDepositThreshold, proposalId)

      //Since we create proposal already with full support, we can skip support phase
      await waitForCurrentRoundToEnd()

      // Before starting the voting round we should setup voters
      await setupVoter(otherAccounts[0], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)

      //Start voting round
      await startNewAllocationRound({ emissions, xAllocationVoting })

      // Wait for proposal to be active
      await waitForProposalToBeActive(proposalId, { governor })

      // Vote
      await governor.connect(otherAccounts[0]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[1]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[2]).castVote(proposalId, 1)

      // Wait for voting period to end
      await waitForVotingPeriodToEnd(proposalId)

      // Random account should NOT be able to mark as IN-DEVELOPMENT
      await expect(governor.connect(otherAccounts[3]).markAsInDevelopment(proposalId)).to.rejected
    })
    it("(EXECUTABLE PROPOSAL) Should NOT be able to mark as IN-DEVELOPMENT if not the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      //Create and execute a proposal doing a tokenDetails call
      const executeTx = await createProposalAndExecuteIt(
        proposer,
        otherAccounts[0],
        b3tr,
        b3trContract,
        "description",
        "tokenDetails",
      )

      const receipt = await executeTx.wait()
      if (!receipt) throw new Error("No receipt")

      // Get proposalId from ProposalExecuted event
      const executedEvent = receipt.logs.find(log => {
        try {
          const parsed = governor.interface.parseLog({ topics: [...log.topics], data: log.data })
          return parsed?.name === "ProposalExecuted"
        } catch {
          return false
        }
      })
      if (!executedEvent) throw new Error("ProposalExecuted event not found")
      const proposalId = governor.interface.parseLog({
        topics: [...executedEvent.topics],
        data: executedEvent.data,
      })?.args[0]

      // Random account should NOT be able to mark as IN-DEVELOPMENT
      await expect(governor.connect(otherAccounts[3]).markAsInDevelopment(proposalId)).to.rejected
    })
    it("(GRANT PROPOSAL) Should NOT be able to mark as IN-DEVELOPMENT if not the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      //Create grant and execute it
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

      // Random account should NOT be able to mark as IN-DEVELOPMENT
      await expect(governor.connect(otherAccounts[3]).markAsInDevelopment(proposalId)).to.rejected
    })
    it("(TEXT-ONLY PROPOSAL) Should be able to mark as IN-DEVELOPMENT if the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const targets = []
      const values = []
      const calldatas = []
      const description = `description-${this.test?.title}`
      const startRoundId = (await getRoundId()) + 1

      // Create proposal
      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description, startRoundId, 0)

      const proposalId = await getProposalIdFromTx(tx)

      // Mint tokens and approve for spending in proposal deposit
      const proposalDepositThreshold = await governor.proposalDepositThreshold(proposalId)
      await setupSupporter(proposer, vot3, proposalDepositThreshold, governor)
      await governor.connect(proposer).deposit(proposalDepositThreshold, proposalId)

      //Since we create proposal already with full support, we can skip support phase
      await waitForCurrentRoundToEnd()

      // Before starting the voting round we should setup voters
      await setupVoter(otherAccounts[0], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)

      //Start voting round
      await startNewAllocationRound({ emissions, xAllocationVoting })

      // Wait for proposal to be active
      await waitForProposalToBeActive(proposalId, { governor })

      // Vote
      await governor.connect(otherAccounts[0]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[1]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[2]).castVote(proposalId, 1)

      // Wait for voting period to end
      await waitForVotingPeriodToEnd(proposalId)

      // Should be able to mark as IN-DEVELOPMENT
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await governor.connect(owner).markAsInDevelopment(proposalId)
      expect(await governor.state(proposalId)).to.equal(8) // InDevelopment
    })
    it("(EXECUTABLE PROPOSAL) Should be able to mark as IN-DEVELOPMENT if the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      //Create and execute a proposal doing a tokenDetails call
      const executeTx = await createProposalAndExecuteIt(
        proposer,
        otherAccounts[0],
        b3tr,
        b3trContract,
        "description",
        "tokenDetails",
      )

      const receipt = await executeTx.wait()
      if (!receipt) throw new Error("No receipt")

      // Get proposalId from ProposalExecuted event
      const executedEvent = receipt.logs.find(log => {
        try {
          const parsed = governor.interface.parseLog({ topics: [...log.topics], data: log.data })
          return parsed?.name === "ProposalExecuted"
        } catch {
          return false
        }
      })
      if (!executedEvent) throw new Error("ProposalExecuted event not found")
      const proposalId = governor.interface.parseLog({
        topics: [...executedEvent.topics],
        data: executedEvent.data,
      })?.args[0]
      // Should be able to mark as IN-DEVELOPMENT
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await governor.connect(owner).markAsInDevelopment(proposalId)
      expect(await governor.state(proposalId)).to.equal(8) // InDevelopment
    })
    it("(GRANT PROPOSAL) Should NOT be able to mark as IN-DEVELOPMENT even with the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      //Create grant and execute it
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

      // Should be able to mark as IN-DEVELOPMENT
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)

      await expect(governor.connect(owner).markAsInDevelopment(proposalId)).to.be.revertedWithCustomError(
        governor,
        "GovernorRestrictedProposal",
      )
    })
  })
  describe("Permissions - Mark as COMPLETED", function () {
    it("(TEXT-ONLY PROPOSAL) Should NOT be able to mark as COMPLETED if not the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const targets = []
      const values = []
      const calldatas = []
      const description = `description-${this.test?.title}`
      const startRoundId = (await getRoundId()) + 1

      // Create proposal
      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description, startRoundId, 0)

      const proposalId = await getProposalIdFromTx(tx)

      // Mint tokens and approve for spending in proposal deposit
      const proposalDepositThreshold = await governor.proposalDepositThreshold(proposalId)
      await setupSupporter(proposer, vot3, proposalDepositThreshold, governor)
      await governor.connect(proposer).deposit(proposalDepositThreshold, proposalId)

      //Since we create proposal already with full support, we can skip support phase
      await waitForCurrentRoundToEnd()

      // Before starting the voting round we should setup voters
      await setupVoter(otherAccounts[0], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)

      //Start voting round
      await startNewAllocationRound({ emissions, xAllocationVoting })

      // Wait for proposal to be active
      await waitForProposalToBeActive(proposalId, { governor })

      // Vote
      await governor.connect(otherAccounts[0]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[1]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[2]).castVote(proposalId, 1)

      // Wait for voting period to end
      await waitForVotingPeriodToEnd(proposalId)

      // Random account should NOT be able to mark as COMPLETED
      await expect(governor.connect(otherAccounts[3]).markAsCompleted(proposalId)).to.rejected
    })
    it("(EXECUTABLE PROPOSAL) Should NOT be able to mark as COMPLETED if not the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      //Create and execute a proposal doing a tokenDetails call
      const executeTx = await createProposalAndExecuteIt(
        proposer,
        otherAccounts[0],
        b3tr,
        b3trContract,
        "description",
        "tokenDetails",
      )

      const receipt = await executeTx.wait()
      if (!receipt) throw new Error("No receipt")

      // Get proposalId from ProposalExecuted event
      const executedEvent = receipt.logs.find(log => {
        try {
          const parsed = governor.interface.parseLog({ topics: [...log.topics], data: log.data })
          return parsed?.name === "ProposalExecuted"
        } catch {
          return false
        }
      })
      if (!executedEvent) throw new Error("ProposalExecuted event not found")
      const proposalId = governor.interface.parseLog({
        topics: [...executedEvent.topics],
        data: executedEvent.data,
      })?.args[0]

      // Random account should NOT be able to mark as COMPLETED
      await expect(governor.connect(otherAccounts[3]).markAsCompleted(proposalId)).to.rejected
    })
    it("(GRANT PROPOSAL) Should NOT be able to mark as COMPLETED if not the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      //Create grant and execute it
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

      // Random account should NOT be able to mark as COMPLETED
      await expect(governor.connect(otherAccounts[3]).markAsCompleted(proposalId)).to.rejected
    })
    it("(TEXT-ONLY PROPOSAL) Should be able to mark as COMPLETED if the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const targets = []
      const values = []
      const calldatas = []
      const description = `description-${this.test?.title}`
      const startRoundId = (await getRoundId()) + 1

      // Create proposal
      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description, startRoundId, 0)

      const proposalId = await getProposalIdFromTx(tx)

      // Mint tokens and approve for spending in proposal deposit
      const proposalDepositThreshold = await governor.proposalDepositThreshold(proposalId)
      await setupSupporter(proposer, vot3, proposalDepositThreshold, governor)
      await governor.connect(proposer).deposit(proposalDepositThreshold, proposalId)

      //Since we create proposal already with full support, we can skip support phase
      await waitForCurrentRoundToEnd()

      // Before starting the voting round we should setup voters
      await setupVoter(otherAccounts[0], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)

      //Start voting round
      await startNewAllocationRound({ emissions, xAllocationVoting })

      // Wait for proposal to be active
      await waitForProposalToBeActive(proposalId, { governor })

      // Vote
      await governor.connect(otherAccounts[0]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[1]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[2]).castVote(proposalId, 1)

      // Wait for voting period to end
      await waitForVotingPeriodToEnd(proposalId)

      // Should be able to mark as IN-DEVELOPMENT
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await governor.connect(owner).markAsInDevelopment(proposalId)
      expect(await governor.state(proposalId)).to.equal(8) // InDevelopment

      // Should be able to mark as COMPLETED
      await governor.connect(owner).markAsCompleted(proposalId)
      expect(await governor.state(proposalId)).to.equal(9) // Completed
    })
    it("(EXECUTABLE PROPOSAL) Should be able to mark as COMPLETED if the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      //Create and execute a proposal doing a tokenDetails call
      const executeTx = await createProposalAndExecuteIt(
        proposer,
        otherAccounts[0],
        b3tr,
        b3trContract,
        "description",
        "tokenDetails",
      )

      const receipt = await executeTx.wait()
      if (!receipt) throw new Error("No receipt")

      // Get proposalId from ProposalExecuted event
      const executedEvent = receipt.logs.find(log => {
        try {
          const parsed = governor.interface.parseLog({ topics: [...log.topics], data: log.data })
          return parsed?.name === "ProposalExecuted"
        } catch {
          return false
        }
      })
      if (!executedEvent) throw new Error("ProposalExecuted event not found")
      const proposalId = governor.interface.parseLog({
        topics: [...executedEvent.topics],
        data: executedEvent.data,
      })?.args[0]

      // Should be able to mark as IN-DEVELOPMENT
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await governor.connect(owner).markAsInDevelopment(proposalId)
      expect(await governor.state(proposalId)).to.equal(8) // InDevelopment

      // Should be able to mark as COMPLETED
      await governor.connect(owner).markAsCompleted(proposalId)
      expect(await governor.state(proposalId)).to.equal(9) // Completed
    })
    it("(GRANT PROPOSAL) Should NOT be able to mark as COMPLETED even with the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      //Create grant and execute it
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

      // Should NOT be able to mark as COMPLETED
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await expect(governor.connect(owner).markAsInDevelopment(proposalId)).to.be.revertedWithCustomError(
        governor,
        "GovernorRestrictedProposal",
      )
      await expect(governor.connect(owner).markAsCompleted(proposalId)).to.be.revertedWithCustomError(
        governor,
        "GovernorRestrictedProposal",
      )
    })
  })
  describe("Permissions - Reset Development State", function () {
    it("(TEXT-ONLY PROPOSAL) Should NOT be able to reset development state if not the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const targets = []
      const values = []
      const calldatas = []
      const description = `description-${this.test?.title}`
      const startRoundId = (await getRoundId()) + 1

      // Create proposal
      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description, startRoundId, 0)

      const proposalId = await getProposalIdFromTx(tx)

      // Mint tokens and approve for spending in proposal deposit
      const proposalDepositThreshold = await governor.proposalDepositThreshold(proposalId)
      await setupSupporter(proposer, vot3, proposalDepositThreshold, governor)
      await governor.connect(proposer).deposit(proposalDepositThreshold, proposalId)

      //Since we create proposal already with full support, we can skip support phase
      await waitForCurrentRoundToEnd()

      // Before starting the voting round we should setup voters
      await setupVoter(otherAccounts[0], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)

      //Start voting round
      await startNewAllocationRound({ emissions, xAllocationVoting })

      // Wait for proposal to be active
      await waitForProposalToBeActive(proposalId, { governor })

      // Vote
      await governor.connect(otherAccounts[0]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[1]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[2]).castVote(proposalId, 1)

      // Wait for voting period to end
      await waitForVotingPeriodToEnd(proposalId)

      // Mark as IN-DEVELOPMENT first
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await governor.connect(owner).markAsInDevelopment(proposalId)
      expect(await governor.state(proposalId)).to.equal(8) // InDevelopment

      // Random account should NOT be able to reset development state
      await expect(governor.connect(otherAccounts[3]).resetDevelopmentState(proposalId)).to.rejected
    })
    it("(EXECUTABLE PROPOSAL) Should NOT be able to reset development state if not the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      //Create and execute a proposal doing a tokenDetails call
      const executeTx = await createProposalAndExecuteIt(
        proposer,
        otherAccounts[0],
        b3tr,
        b3trContract,
        "description",
        "tokenDetails",
      )

      const receipt = await executeTx.wait()
      if (!receipt) throw new Error("No receipt")

      // Get proposalId from ProposalExecuted event
      const executedEvent = receipt.logs.find(log => {
        try {
          const parsed = governor.interface.parseLog({ topics: [...log.topics], data: log.data })
          return parsed?.name === "ProposalExecuted"
        } catch {
          return false
        }
      })
      if (!executedEvent) throw new Error("ProposalExecuted event not found")
      const proposalId = governor.interface.parseLog({
        topics: [...executedEvent.topics],
        data: executedEvent.data,
      })?.args[0]

      // Mark as IN-DEVELOPMENT first
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await governor.connect(owner).markAsInDevelopment(proposalId)
      expect(await governor.state(proposalId)).to.equal(8) // InDevelopment

      // Random account should NOT be able to reset development state
      await expect(governor.connect(otherAccounts[3]).resetDevelopmentState(proposalId)).to.rejected
    })
    it("(GRANT PROPOSAL) Should NOT be able to reset development state if not the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      //Create grant and execute it
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

      // Random account should NOT be able to reset development state
      await expect(governor.connect(otherAccounts[3]).resetDevelopmentState(proposalId)).to.rejected
    })
    it("(TEXT-ONLY PROPOSAL) Should be able to reset development state if the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const targets = []
      const values = []
      const calldatas = []
      const description = `description-${this.test?.title}`
      const startRoundId = (await getRoundId()) + 1

      // Create proposal
      const tx = await governor.connect(proposer).propose(targets, values, calldatas, description, startRoundId, 0)

      const proposalId = await getProposalIdFromTx(tx)

      // Mint tokens and approve for spending in proposal deposit
      const proposalDepositThreshold = await governor.proposalDepositThreshold(proposalId)
      await setupSupporter(proposer, vot3, proposalDepositThreshold, governor)
      await governor.connect(proposer).deposit(proposalDepositThreshold, proposalId)

      //Since we create proposal already with full support, we can skip support phase
      await waitForCurrentRoundToEnd()

      // Before starting the voting round we should setup voters
      await setupVoter(otherAccounts[0], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
      await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)

      //Start voting round
      await startNewAllocationRound({ emissions, xAllocationVoting })

      // Wait for proposal to be active
      await waitForProposalToBeActive(proposalId, { governor })

      // Vote
      await governor.connect(otherAccounts[0]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[1]).castVote(proposalId, 1)
      await governor.connect(otherAccounts[2]).castVote(proposalId, 1)

      // Wait for voting period to end
      await waitForVotingPeriodToEnd(proposalId)

      // Should be able to mark as IN-DEVELOPMENT
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await governor.connect(owner).markAsInDevelopment(proposalId)
      expect(await governor.state(proposalId)).to.equal(8) // InDevelopment

      // Should be able to reset development state
      await governor.connect(owner).resetDevelopmentState(proposalId)
      expect(await governor.state(proposalId)).to.equal(4) // Succeeded
    })
    it("(EXECUTABLE PROPOSAL) Should be able to reset development state if the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      //Create and execute a proposal doing a tokenDetails call
      const executeTx = await createProposalAndExecuteIt(
        proposer,
        otherAccounts[0],
        b3tr,
        b3trContract,
        "description",
        "tokenDetails",
      )

      const receipt = await executeTx.wait()
      if (!receipt) throw new Error("No receipt")

      // Get proposalId from ProposalExecuted event
      const executedEvent = receipt.logs.find(log => {
        try {
          const parsed = governor.interface.parseLog({ topics: [...log.topics], data: log.data })
          return parsed?.name === "ProposalExecuted"
        } catch {
          return false
        }
      })
      if (!executedEvent) throw new Error("ProposalExecuted event not found")
      const proposalId = governor.interface.parseLog({
        topics: [...executedEvent.topics],
        data: executedEvent.data,
      })?.args[0]

      // Should be able to mark as IN-DEVELOPMENT
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await governor.connect(owner).markAsInDevelopment(proposalId)
      expect(await governor.state(proposalId)).to.equal(8) // InDevelopment

      // Should be able to reset development state
      await governor.connect(owner).resetDevelopmentState(proposalId)
      expect(await governor.state(proposalId)).to.equal(6) // Executed
    })
    it("(GRANT PROPOSAL) Should NOT be able to reset development state even with the PROPOSAL_STATE_MANAGER_ROLE", async function () {
      const description = "https://ipfs.io/ipfs/Qm..." // project details metadata URI cannot be changed later
      const milestonesDetailsMetadataURI = "https://ipfs.io/ipfs/Qm..." // milestones details can be changed later
      const values = [ethers.parseEther("10000"), ethers.parseEther("20000")]

      //Create grant and execute it
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

      // Should NOT be able to reset development state
      // Because grants can never be in development by b3trgovernor
      await governor.connect(owner).grantRole(await governor.PROPOSAL_STATE_MANAGER_ROLE(), owner.address)
      await expect(governor.connect(owner).resetDevelopmentState(proposalId)).to.be.revertedWithCustomError(
        governor,
        "GovernorUnexpectedProposalState",
      )
    })
  })
})
