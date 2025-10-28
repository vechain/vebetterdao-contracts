import { describe, it, beforeEach } from "mocha"
import { setupProposer, setupGovernanceFixtureWithEmissions } from "../fixture.test"
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
} from "../../../typechain-types"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { expect } from "chai"
import { ContractFactory, Interface } from "ethers"
import { createProposalWithMultipleFunctionsAndExecuteItGrant } from "../../helpers/common"
describe("GrantsManager - V2 Compatibility - @shard4j", function () {
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
  })

  it("Should NOT be able to mark grant as in development manually", async () => {
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

    //Grant should be in development and proposal should be executed
    expect(await grantsManager.grantState(proposalId)).to.equal(8) // InDevelopment state
    expect(await governor.state(proposalId)).to.equal(6) // Executed state

    await expect(governor.connect(owner).markAsCompleted(proposalId)).to.be.revertedWithCustomError(
      governor,
      "GovernorRestrictedProposal",
    )
    // State should remain the same
    expect(await grantsManager.grantState(proposalId)).to.equal(8) // InDevelopment state
    expect(await governor.state(proposalId)).to.equal(6) // Executed state

    //Approve and claim all milestones
    await grantsManager.connect(owner).approveMilestones(proposalId, 0)
    await grantsManager.connect(owner).approveMilestones(proposalId, 1)
    await grantsManager.connect(proposer).claimMilestone(proposalId, 0)
    await grantsManager.connect(proposer).claimMilestone(proposalId, 1)

    // Grant should be completed
    expect(await grantsManager.grantState(proposalId)).to.equal(9) // Completed state
    expect(await governor.state(proposalId)).to.equal(6) // Executed state

    await expect(governor.connect(owner).markAsCompleted(proposalId)).to.be.revertedWithCustomError(
      governor,
      "GovernorRestrictedProposal",
    )
    // State should remain the same
    expect(await grantsManager.grantState(proposalId)).to.equal(9) // Completed state
    expect(await governor.state(proposalId)).to.equal(6) // Executed state
  })

  it("Should NOT be able to mark grant as completed manually", async () => {
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

    //Grant should be in development and proposal should be executed
    expect(await grantsManager.grantState(proposalId)).to.equal(8) // InDevelopment state
    expect(await governor.state(proposalId)).to.equal(6) // Executed state

    await expect(governor.connect(owner).markAsCompleted(proposalId)).to.be.revertedWithCustomError(
      governor,
      "GovernorRestrictedProposal",
    )
    // State should remain the same
    expect(await grantsManager.grantState(proposalId)).to.equal(8) // InDevelopment state
    expect(await governor.state(proposalId)).to.equal(6) // Executed state

    //Approve and claim all milestones
    await grantsManager.connect(owner).approveMilestones(proposalId, 0)
    await grantsManager.connect(owner).approveMilestones(proposalId, 1)
    await grantsManager.connect(proposer).claimMilestone(proposalId, 0)
    await grantsManager.connect(proposer).claimMilestone(proposalId, 1)

    // Grant should be completed
    expect(await grantsManager.grantState(proposalId)).to.equal(9) // Completed state
    expect(await governor.state(proposalId)).to.equal(6) // Executed state

    await expect(governor.connect(owner).markAsCompleted(proposalId)).to.be.revertedWithCustomError(
      governor,
      "GovernorRestrictedProposal",
    )
    // State should remain the same
    expect(await grantsManager.grantState(proposalId)).to.equal(9) // Completed state
    expect(await governor.state(proposalId)).to.equal(6) // Executed state
  })
})
