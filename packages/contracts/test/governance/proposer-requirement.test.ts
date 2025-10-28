import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { expect } from "chai"
import { ethers } from "ethers"
import { beforeEach, describe, it } from "mocha"

import { B3TR, B3TRGovernor, Emissions, GalaxyMember, VOT3 } from "../../typechain-types"
import { getRoundId, getVot3Tokens } from "../helpers"
import { setupGovernanceFixtureWithEmissions, setupProposer } from "./fixture.test"

describe("Governance - Proposer requirement - @shard4d", function () {
  let governor: B3TRGovernor
  let vot3: VOT3
  let b3tr: B3TR
  let minterAccount: SignerWithAddress
  let proposer: SignerWithAddress
  let owner: SignerWithAddress
  let galaxyMember: GalaxyMember
  let emissions: Emissions
  beforeEach(async function () {
    const fixture = await setupGovernanceFixtureWithEmissions()
    governor = fixture.governor
    vot3 = fixture.vot3
    b3tr = fixture.b3tr
    minterAccount = fixture.minterAccount
    proposer = fixture.proposer
    owner = fixture.owner
    galaxyMember = fixture.galaxyMember
    emissions = fixture.emissions
    // Setup proposer for all tests
    await emissions.connect(minterAccount).start()
    await setupProposer(proposer, b3tr, vot3, minterAccount)
  })

  describe("Proposer requirement", function () {
    it("Should correctly set the GM for the standard governance proposal", async function () {
      await governor.connect(owner).setRequiredGMLevelByProposalType(0, 1) // 0 = standard proposal with earth required
      const requiredGMLevel = await governor.getRequiredGMLevelByProposalType(0)
      expect(requiredGMLevel).to.equal(1)
    })

    it("Should correctly set the GM for the grant proposal", async function () {
      await governor.connect(owner).setRequiredGMLevelByProposalType(1, 1) // 1 = grant proposal with earth required
      const requiredGMLevel = await governor.getRequiredGMLevelByProposalType(1)
      expect(requiredGMLevel).to.equal(1)
    })

    it("Should not create a proposal (0 or 1) if the proposer does not have the correct GM", async function () {
      // set max GM level to 2
      await galaxyMember.connect(owner).setMaxLevel(2)
      await governor.connect(owner).setRequiredGMLevelByProposalType(0, 2) // 0 = standard proposal with earth required
      const requiredGMLevel = await governor.getRequiredGMLevelByProposalType(0)
      expect(requiredGMLevel).to.equal(2)

      await getVot3Tokens(proposer, "1000")
      // grant approval to the governor contract
      await vot3.connect(proposer).approve(await governor.getAddress(), ethers.parseEther("1000"))

      // get the roundId
      const roundId = await getRoundId()

      // GM level of the proposer = 1 (earth)
      const tokenId = await galaxyMember.getSelectedTokenId(proposer.address)
      const gmLevel = await galaxyMember.levelOf(tokenId)
      expect(gmLevel).to.equal(1)

      await expect(governor.connect(proposer).propose([], [], [], "", roundId, 0)).to.be.revertedWithCustomError(
        governor,
        "GovernorInvalidProposer",
      )
    })

    it("Should not set the required GM level above the max level", async function () {
      const maxGMWeight = await galaxyMember.MAX_LEVEL()
      await expect(
        governor.connect(owner).setRequiredGMLevelByProposalType(0, Number(maxGMWeight) + 1),
      ).to.be.revertedWithCustomError(governor, "GMLevelAboveMaxLevel")
    })

    it("Should not set the required GM level if the proposal type is invalid", async function () {
      await expect(governor.connect(owner).setRequiredGMLevelByProposalType(2, 1)).to.be.reverted
    })

    it("Should not get the required GM level if the proposal type is invalid", async function () {
      await expect(governor.getRequiredGMLevelByProposalType(2)).to.be.reverted
    })

    it("Should emit the RequiredGMLevelSet event when the required GM level is set", async function () {
      const tx = await governor.connect(owner).setRequiredGMLevelByProposalType(0, 1)
      await expect(tx).to.emit(governor, "RequiredGMLevelSet").withArgs(0, 0, 1)
    })
  })

  describe("Permissions", function () {
    it("Should not be able set the required GM level if not admin", async function () {
      await expect(
        governor.connect(minterAccount).setRequiredGMLevelByProposalType(0, 1),
      ).to.be.revertedWithCustomError(governor, "GovernorOnlyExecutor")
    })
  })
})
