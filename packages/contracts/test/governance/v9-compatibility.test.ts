import { expect } from "chai"
import { ethers } from "hardhat"
import { describe, it } from "mocha"

import { B3TR, B3TRGovernor, Emissions, VeBetterPassport, VOT3, XAllocationVoting } from "../../typechain-types"
import { createProposal, getProposalIdFromTx, waitForCurrentRoundToEnd } from "../helpers/common"
import {
  setupGovernanceFixtureWithEmissions,
  setupProposer,
  setupSupporter,
  setupVoter,
  startNewRoundAndGetRoundId,
} from "./fixture.test"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { ContractFactory } from "ethers"

describe("Governance - V9 Compatibility - @shard4h", function () {
  let governor: B3TRGovernor
  let vot3: VOT3
  let b3tr: B3TR
  let b3trContract: ContractFactory
  let minterAccount: SignerWithAddress
  let proposer: SignerWithAddress
  let owner: SignerWithAddress
  let emissions: Emissions
  let otherAccounts: SignerWithAddress[]
  let veBetterPassport: VeBetterPassport
  let xAllocationVoting: XAllocationVoting
  beforeEach(async function () {
    const fixture = await setupGovernanceFixtureWithEmissions()
    governor = fixture.governor
    vot3 = fixture.vot3
    b3tr = fixture.b3tr
    b3trContract = fixture.b3trContract
    minterAccount = fixture.minterAccount
    proposer = fixture.proposer
    owner = fixture.owner
    otherAccounts = fixture.otherAccounts
    emissions = fixture.emissions
    veBetterPassport = fixture.veBetterPassport
    xAllocationVoting = fixture.xAllocationVoting
    await emissions.connect(minterAccount).start()
    await setupProposer(proposer, b3tr, vot3, minterAccount)
    await setupVoter(otherAccounts[0], b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[3], b3tr, vot3, minterAccount, owner, veBetterPassport)
  })

  describe("Governance - V9 Compatibility - Proposal Lifecycle", function () {
    it("Should be able to create, deposit, and cancel a proposal in V9", async () => {
      const functionToCall = "tokenDetails"
      const encodedFunctionCall = b3trContract.interface.encodeFunctionData(functionToCall, [])
      const tx = await createProposal(b3tr, b3trContract, proposer, `description ${this.title}`, functionToCall, [])
      const proposalId = await getProposalIdFromTx(tx)
      const stateBeforeCancel = await governor.state(proposalId)
      expect(stateBeforeCancel).to.equal(0) // pending
      await governor
        .connect(proposer)
        .cancel(
          [await b3tr.getAddress()],
          [0],
          [encodedFunctionCall],
          ethers.keccak256(ethers.toUtf8Bytes(`description ${this.title}`)),
          "reason",
        )
      const stateAfterCancel = await governor.state(proposalId)
      expect(stateAfterCancel).to.equal(2) // cancelled
    })

    it("Should be able to vote on a proposal in V9", async () => {
      const functionToCall = "tokenDetails"
      const tx = await createProposal(b3tr, b3trContract, proposer, `description ${this.title}`, functionToCall, [])
      const proposalId = await getProposalIdFromTx(tx)
      // Deposit enough to meet threshold
      const depositThreshold = await governor.proposalDepositThreshold(proposalId)
      const currentDeposit = await governor.getProposalDeposits(proposalId)
      if (currentDeposit < depositThreshold) {
        const remaining = depositThreshold - currentDeposit
        await setupSupporter(proposer, vot3, remaining, governor)
        await governor.connect(proposer).deposit(remaining, proposalId)
      }
      // Wait for round to become active
      await waitForCurrentRoundToEnd()
      await startNewRoundAndGetRoundId(emissions, xAllocationVoting)
      // Cast vote
      const voter = otherAccounts[0]
      await governor.connect(voter).castVote(proposalId, 1) // for
      expect(await governor.hasVoted(proposalId, voter.address)).to.be.true
    })

    it("Should return version 9", async () => {
      expect(await governor.version()).to.equal("9")
    })

    it("Should preserve mark as in development functionality from V8", async () => {
      const functionToCall = "tokenDetails"
      const encodedFunctionCall = b3trContract.interface.encodeFunctionData(functionToCall, [])
      const tx = await createProposal(b3tr, b3trContract, proposer, `description ${this.title}`, functionToCall, [])
      const proposalId = await getProposalIdFromTx(tx)
      // Deposit enough to meet threshold
      const depositThreshold = await governor.proposalDepositThreshold(proposalId)
      const currentDeposit = await governor.getProposalDeposits(proposalId)
      if (currentDeposit < depositThreshold) {
        const remaining = depositThreshold - currentDeposit
        await setupSupporter(proposer, vot3, remaining, governor)
        await governor.connect(proposer).deposit(remaining, proposalId)
      }
      await waitForCurrentRoundToEnd()
      await startNewRoundAndGetRoundId(emissions, xAllocationVoting)
      // Vote for the proposal
      for (let i = 0; i < 4; i++) {
        await governor.connect(otherAccounts[i]).castVote(proposalId, 1) // for
      }
      await waitForCurrentRoundToEnd()
      // Queue and execute
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(`description ${this.title}`))
      await governor.queue([await b3tr.getAddress()], [0], [encodedFunctionCall], descriptionHash)
      await governor.execute([await b3tr.getAddress()], [0], [encodedFunctionCall], descriptionHash)
      const stateAfterExecute = await governor.state(proposalId)
      expect(stateAfterExecute).to.equal(6) // Executed
      // Mark as in development
      await governor.connect(owner).markAsInDevelopment(proposalId)
      const stateAfterMarkInDev = await governor.state(proposalId)
      expect(stateAfterMarkInDev).to.equal(8) // InDevelopment
      // Mark as completed
      await governor.connect(owner).markAsCompleted(proposalId)
      const stateAfterMarkCompleted = await governor.state(proposalId)
      expect(stateAfterMarkCompleted).to.equal(9) // Completed
    })
  })
})
