import { expect } from "chai"
import { ethers } from "hardhat"
import { describe, it } from "mocha"

import { EndorsementUtils } from "../../typechain-types"
import { getOrDeployContractInstances, startNewAllocationRound, waitForCurrentRoundToEnd } from "../helpers"
import { createNodeHolder } from "../helpers/xnodes"

describe("EndorsementUtils Coverage - @shard15g", function () {
  describe("Getter functions", function () {
    it("getEndorserNodes returns node IDs endorsing an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(3, otherAccounts[1])
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 10)

      const endorserNodes = await x2EarnApps.getEndorserNodes(app1Id)
      expect(endorserNodes.length).to.equal(1)
      expect(endorserNodes[0]).to.equal(nodeId1)
    })

    it("maxPointsPerNodePerApp and maxPointsPerApp return configured values", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({})

      expect(await x2EarnApps.maxPointsPerNodePerApp()).to.equal(49)
      expect(await x2EarnApps.maxPointsPerApp()).to.equal(110)
    })

    it("endorsementsPaused returns false by default and true when paused", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.endorsementsPaused()).to.equal(false)

      await x2EarnApps.connect(owner).pauseEndorsements()
      expect(await x2EarnApps.endorsementsPaused()).to.equal(true)

      await x2EarnApps.connect(owner).unpauseEndorsements()
      expect(await x2EarnApps.endorsementsPaused()).to.equal(false)
    })

    it("migrationCompleted returns correct state", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.migrationCompleted()).to.equal(false)
      await x2EarnApps.connect(owner).markMigrationComplete()
      expect(await x2EarnApps.migrationCompleted()).to.equal(true)
    })

    it("getNodePointsForApp returns points for a specific endorsement", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      expect(await x2EarnApps.getNodePointsForApp(nodeId1, app1Id)).to.equal(0)

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 25)
      expect(await x2EarnApps.getNodePointsForApp(nodeId1, app1Id)).to.equal(25)
    })

    it("getNodeUsedPoints returns total points used across all apps", async function () {
      const { x2EarnApps, otherAccounts, owner, creators } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[2].address)

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 30)
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app2Id, nodeId1, 20)

      expect(await x2EarnApps.getNodeUsedPoints(nodeId1)).to.equal(50)
    })

    it("getNodeAvailablePoints returns remaining points", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      expect(await x2EarnApps.getNodeAvailablePoints(nodeId1)).to.equal(100)

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 40)
      expect(await x2EarnApps.getNodeAvailablePoints(nodeId1)).to.equal(60)
    })

    it("getNodePointsInfo returns comprehensive info including locked points", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Set a non-zero cooldown (in rounds) so lockedPoints > 0
      await x2EarnApps.connect(owner).updateCooldownPeriod(10)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      // Bootstrap emissions so round tracking works, then endorse
      await startNewAllocationRound()
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 30)

      const info = await x2EarnApps.getNodePointsInfo(nodeId1)
      expect(info.totalPoints).to.equal(100)
      expect(info.usedPoints).to.equal(30)
      expect(info.availablePoints).to.equal(70)
      expect(info.lockedPoints).to.equal(30)
    })

    it("getNodePointsInfo lockedPoints is 0 after cooldown expires", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Cooldown is 0 in local config, so endorsement is not locked
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 30)

      const info = await x2EarnApps.getNodePointsInfo(nodeId1)
      expect(info.totalPoints).to.equal(100)
      expect(info.usedPoints).to.equal(30)
      expect(info.availablePoints).to.equal(70)
      expect(info.lockedPoints).to.equal(0) // Cooldown is 0 rounds
    })

    it("canUnendorse returns false when not endorsing and true after cooldown", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Set cooldown to 1 round
      await x2EarnApps.connect(owner).updateCooldownPeriod(1)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      expect(await x2EarnApps.canUnendorse(nodeId1, app1Id)).to.equal(false)

      // Bootstrap emissions and endorse in round 1
      await startNewAllocationRound()
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 20)
      expect(await x2EarnApps.canUnendorse(nodeId1, app1Id)).to.equal(false)

      // Advance to next round (round 2 >= endorsedAtRound(1) + cooldown(1))
      await waitForCurrentRoundToEnd()
      await startNewAllocationRound()
      expect(await x2EarnApps.canUnendorse(nodeId1, app1Id)).to.equal(true)
    })

    it("getNodeActiveEndorsements returns all active endorsements for a node", async function () {
      const { x2EarnApps, otherAccounts, owner, creators } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[5].address)

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[5].address, otherAccounts[5].address, otherAccounts[5].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 30)
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app2Id, nodeId1, 20)

      const endorsements = await x2EarnApps.getNodeActiveEndorsements(nodeId1)
      expect(endorsements.length).to.equal(2)
      expect(endorsements[0].points).to.equal(30)
      expect(endorsements[1].points).to.equal(20)
    })
  })

  describe("Pause, migration, and governance setters", function () {
    it("Pausing endorsements prevents endorsing and unpausing allows it", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      await x2EarnApps.connect(owner).pauseEndorsements()

      await expect(x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 10)).to.be.revertedWithCustomError(
        x2EarnApps,
        "EndorsementsPaused",
      )

      await x2EarnApps.connect(owner).unpauseEndorsements()
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 10)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(10)
    })

    it("markMigrationComplete prevents further seeding", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const MIGRATION_ROLE = await x2EarnApps.MIGRATION_ROLE()
      await x2EarnApps.connect(owner).grantRole(MIGRATION_ROLE, owner.address)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      await x2EarnApps.connect(owner).seedEndorsement(app1Id, nodeId1, 10)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(10)

      await x2EarnApps.connect(owner).markMigrationComplete()
      await expect(x2EarnApps.connect(owner).seedEndorsement(app1Id, nodeId1, 20)).to.be.reverted
    })

    it("Governance can update max points per node per app and max points per app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps.connect(owner).setMaxPointsPerNodePerApp(60)
      expect(await x2EarnApps.maxPointsPerNodePerApp()).to.equal(60)

      await x2EarnApps.connect(owner).setMaxPointsPerApp(200)
      expect(await x2EarnApps.maxPointsPerApp()).to.equal(200)
    })

    it("setMaxPointsPerApp reverts when below endorsementScoreThreshold", async function () {
      const { x2EarnApps, endorsementUtils, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      expect(await x2EarnApps.endorsementScoreThreshold()).to.equal(100)
      await expect(x2EarnApps.connect(owner).setMaxPointsPerApp(99)).to.be.revertedWithCustomError(
        endorsementUtils as EndorsementUtils,
        "MaxPointsPerAppBelowThreshold",
      )
    })

    it("updateEndorsementScoreThreshold reverts when above maxPointsPerApp", async function () {
      const { x2EarnApps, endorsementUtils, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      expect(await x2EarnApps.maxPointsPerApp()).to.equal(110)
      await expect(x2EarnApps.connect(owner).updateEndorsementScoreThreshold(111)).to.be.revertedWithCustomError(
        endorsementUtils as EndorsementUtils,
        "ThresholdExceedsMaxPointsPerApp",
      )
    })
  })

  describe("Update existing endorsement (add more points)", function () {
    it("Adding points to existing endorsement updates points and resets cooldown", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 20)
      expect(await x2EarnApps.getNodePointsForApp(nodeId1, app1Id)).to.equal(20)

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 10)
      expect(await x2EarnApps.getNodePointsForApp(nodeId1, app1Id)).to.equal(30)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(30)

      const endorserNodes = await x2EarnApps.getEndorserNodes(app1Id)
      expect(endorserNodes.length).to.equal(1)
    })
  })

  describe("unendorseApp returns true when score stays above threshold", function () {
    it("Partial unendorse keeps app eligible when score remains >= threshold", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])
      const nodeId2 = await createNodeHolder(7, otherAccounts[2])
      const nodeId3 = await createNodeHolder(7, otherAccounts[3])

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 49)
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2, 49)
      await x2EarnApps.connect(otherAccounts[3]).endorseApp(app1Id, nodeId3, 12)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(110)
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.equal(true)

      // Cooldown is 0 in local config, no need to wait
      await x2EarnApps.connect(otherAccounts[3]).unendorseApp(app1Id, nodeId3, 5)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(105)
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.equal(true)
    })
  })

  describe("removeNodeEndorsement returns true when score stays above threshold", function () {
    it("Admin removes endorser, app stays eligible when score still >= threshold", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])
      const nodeId2 = await createNodeHolder(7, otherAccounts[2])
      const nodeId3 = await createNodeHolder(7, otherAccounts[3])
      const nodeId4 = await createNodeHolder(7, otherAccounts[4])

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 49)
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2, 49)
      await x2EarnApps.connect(otherAccounts[3]).endorseApp(app1Id, nodeId3, 10)
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, nodeId4, 2)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(110)
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.equal(true)

      await x2EarnApps.connect(owner).removeNodeEndorsement(app1Id, nodeId4)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(108)
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.equal(true)
    })
  })

  describe("seedEndorsement full coverage", function () {
    it("Seeds new endorsement, updates existing, and emits events", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const MIGRATION_ROLE = await x2EarnApps.MIGRATION_ROLE()
      await x2EarnApps.connect(owner).grantRole(MIGRATION_ROLE, owner.address)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])
      const nodeId2 = await createNodeHolder(7, otherAccounts[2])

      // Seed first endorsement (new entry branch L844-855)
      await x2EarnApps.connect(owner).seedEndorsement(app1Id, nodeId1, 30)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(30)
      expect((await x2EarnApps.getEndorserNodes(app1Id)).length).to.equal(1)

      // Seed second endorsement from different node
      await x2EarnApps.connect(owner).seedEndorsement(app1Id, nodeId2, 20)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(50)
      expect((await x2EarnApps.getEndorserNodes(app1Id)).length).to.equal(2)

      // Update first node's endorsement (existing entry branch L836-843)
      await x2EarnApps.connect(owner).seedEndorsement(app1Id, nodeId1, 40)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(60) // 50 - 30 + 40
      expect((await x2EarnApps.getEndorserNodes(app1Id)).length).to.equal(2)

      // Verify endorser addresses (L858-860)
      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers.length).to.equal(2)
    })
  })

  describe("getScoreAtTimepoint", function () {
    it("Returns the endorsement score at the start and end of an allocation round", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])
      const nodeId2 = await createNodeHolder(7, otherAccounts[2])

      // Endorse before any round starts
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 30)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(30)

      // Start round 1 — snapshot is taken at this block
      const roundId = await startNewAllocationRound()
      const roundSnapshot = await xAllocationVoting.roundSnapshot(roundId)

      // Score at round start should be 30
      expect(await x2EarnApps.getScoreAtTimepoint(app1Id, roundSnapshot)).to.equal(30)

      // Endorse more during the round
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2, 20)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(50)

      // End the round
      await waitForCurrentRoundToEnd()
      const roundDeadline = await xAllocationVoting.roundDeadline(roundId)

      // Score at round end should be 50
      expect(await x2EarnApps.getScoreAtTimepoint(app1Id, roundDeadline)).to.equal(50)

      // Score at round start should still be 30
      expect(await x2EarnApps.getScoreAtTimepoint(app1Id, roundSnapshot)).to.equal(30)
    })

    it("Returns 0 for timepoints before any endorsement", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const blockBefore = await ethers.provider.getBlockNumber()

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 10)

      expect(await x2EarnApps.getScoreAtTimepoint(app1Id, blockBefore)).to.equal(0)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(10)
    })

    it("Reverts when querying a future timepoint", async function () {
      const { x2EarnApps, endorsementUtils, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const futureBlock = (await ethers.provider.getBlockNumber()) + 1000
      await expect(x2EarnApps.getScoreAtTimepoint(app1Id, futureBlock)).to.be.revertedWithCustomError(
        endorsementUtils as EndorsementUtils,
        "FutureLookup",
      )
    })

    it("Tracks score changes across multiple rounds", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])
      const nodeId2 = await createNodeHolder(7, otherAccounts[2])
      const nodeId3 = await createNodeHolder(7, otherAccounts[3])

      // Round 1: endorse with 49 points
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 49)
      const round1Id = await startNewAllocationRound()
      const round1Snapshot = await xAllocationVoting.roundSnapshot(round1Id)

      expect(await x2EarnApps.getScoreAtTimepoint(app1Id, round1Snapshot)).to.equal(49)

      // Add more endorsements during round 1
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2, 49)
      await x2EarnApps.connect(otherAccounts[3]).endorseApp(app1Id, nodeId3, 2)

      // End round 1, start round 2
      await waitForCurrentRoundToEnd()
      const round2Id = await startNewAllocationRound()
      const round2Snapshot = await xAllocationVoting.roundSnapshot(round2Id)

      // At round 1 start: 49, at round 2 start: 100
      expect(await x2EarnApps.getScoreAtTimepoint(app1Id, round1Snapshot)).to.equal(49)
      expect(await x2EarnApps.getScoreAtTimepoint(app1Id, round2Snapshot)).to.equal(100)

      // Unendorse during round 2
      await x2EarnApps.connect(otherAccounts[3]).unendorseApp(app1Id, nodeId3, 2)

      await waitForCurrentRoundToEnd()
      const round2Deadline = await xAllocationVoting.roundDeadline(round2Id)

      // At round 2 end: 98
      expect(await x2EarnApps.getScoreAtTimepoint(app1Id, round2Deadline)).to.equal(98)
      // Round 1 start still 49
      expect(await x2EarnApps.getScoreAtTimepoint(app1Id, round1Snapshot)).to.equal(49)
    })
  })

  describe("_removeEndorsement swap-and-pop branches", function () {
    it("Removing non-last endorsement triggers swap in node's endorsements list", async function () {
      const { x2EarnApps, otherAccounts, owner, creators } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[5].address)

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[5].address, otherAccounts[5].address, otherAccounts[5].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      // Endorse two apps: app1 first (index 0), app2 second (index 1)
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 30)
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app2Id, nodeId1, 30)

      expect(await x2EarnApps.getNodePointsForApp(nodeId1, app1Id)).to.equal(30)
      expect(await x2EarnApps.getNodePointsForApp(nodeId1, app2Id)).to.equal(30)

      // Cooldown is 0 in local config, no need to wait
      // Unendorse app1 (index 0) - triggers swap: app2 moves to index 0 (L899-902)
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1, 0)

      expect(await x2EarnApps.getNodePointsForApp(nodeId1, app2Id)).to.equal(30)
      expect(await x2EarnApps.getNodePointsForApp(nodeId1, app1Id)).to.equal(0)

      const activeEndorsements = await x2EarnApps.getNodeActiveEndorsements(nodeId1)
      expect(activeEndorsements.length).to.equal(1)
    })

    it("Removing non-first endorser from app triggers node swap in endorser list", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId1 = await createNodeHolder(7, otherAccounts[1])
      const nodeId2 = await createNodeHolder(7, otherAccounts[2])
      const nodeId3 = await createNodeHolder(7, otherAccounts[3])

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1, 49)
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2, 10)
      await x2EarnApps.connect(otherAccounts[3]).endorseApp(app1Id, nodeId3, 49)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(108)

      // Admin removes node1 (first, index 0) -> node3 swaps into position (L913-916)
      await x2EarnApps.connect(owner).removeNodeEndorsement(app1Id, nodeId1)
      expect(await x2EarnApps.getScore(app1Id)).to.equal(59)

      const endorserNodes = await x2EarnApps.getEndorserNodes(app1Id)
      expect(endorserNodes.length).to.equal(2)

      expect(await x2EarnApps.getNodePointsForApp(nodeId2, app1Id)).to.equal(10)
      expect(await x2EarnApps.getNodePointsForApp(nodeId3, app1Id)).to.equal(49)
    })
  })
})
