import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { VET } from "@vechain/sdk-core"
import { expect } from "chai"
import { ethers, network } from "hardhat"
import { before, describe, it } from "mocha"

import { airdropVTHO } from "../../scripts/helpers/airdrop"
import { getTestKeys, SeedAccount } from "../../scripts/helpers/seedAccounts"
import {
  catchRevert,
  getOrDeployContractInstances,
  startNewAllocationRound,
  waitForCurrentRoundToEnd,
} from "../helpers"
import { createNodeHolder, endorseApp } from "../helpers/xnodes"

describe("X-Apps - Metadata and Endorsement - @shard15c", function () {
  // We prepare the environment for 4 creators
  let creator1: HardhatEthersSigner
  let creator2: HardhatEthersSigner

  before(async function () {
    const { creators } = await getOrDeployContractInstances({ forceDeploy: true })
    creator1 = creators[1]
    creator2 = creators[2]
  })

  describe("Apps metadata", function () {
    it("Admin should be able to update baseURI", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const newBaseURI = "ipfs://new-base-uri"
      await x2EarnApps.connect(owner).setBaseURI(newBaseURI)
      expect(await x2EarnApps.baseURI()).to.eql(newBaseURI)
    })

    it("Non-admin should not be able to update baseURI", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      await catchRevert(x2EarnApps.connect(otherAccounts[0]).setBaseURI("ipfs://new-base-uri"))
    })

    it("Should be able to fetch app metadata", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const baseURI = await x2EarnApps.baseURI()
      const appURI = await x2EarnApps.appURI(app1Id)

      expect(appURI).to.eql(baseURI + "metadataURI")
    })

    it("Admin role can update app metadata", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const newMetadataURI = "metadataURI2"
      await x2EarnApps.connect(owner).updateAppMetadata(app1Id, newMetadataURI)

      const appURI = await x2EarnApps.appURI(app1Id)
      expect(appURI).to.eql((await x2EarnApps.baseURI()) + newMetadataURI)
    })

    it("Admin of app can update app metadata", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")

      const newMetadataURI = "metadataURI2"
      await x2EarnApps.connect(appAdmin).updateAppMetadata(app1Id, newMetadataURI)

      const appURI = await x2EarnApps.appURI(app1Id)
      expect(appURI).to.eql((await x2EarnApps.baseURI()) + newMetadataURI)
    })

    it("Moderator can update app metadata", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      const appModerator = otherAccounts[10]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")

      await x2EarnApps.connect(appAdmin).addAppModerator(app1Id, appModerator.address)
      expect(await x2EarnApps.isAppModerator(app1Id, appModerator.address)).to.be.true

      const newMetadataURI = "metadataURI2"
      await x2EarnApps.connect(appModerator).updateAppMetadata(app1Id, newMetadataURI)

      const appURI = await x2EarnApps.appURI(app1Id)
      expect(appURI).to.eql((await x2EarnApps.baseURI()) + newMetadataURI)
    })

    it("Unatuhtorized users cannot update app metadata", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      const unauthorizedUser = otherAccounts[8]
      const oldMetadataURI = "metadataURI"
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", oldMetadataURI)

      const newMetadataURI = "metadataURI2"
      await expect(x2EarnApps.connect(unauthorizedUser).updateAppMetadata(app1Id, newMetadataURI)).to.be.reverted

      const appURI = await x2EarnApps.appURI(app1Id)
      expect(appURI).to.eql((await x2EarnApps.baseURI()) + oldMetadataURI)
    })

    it("Cannot update metadata of non existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const newMetadataURI = "metadataURI2"

      await expect(x2EarnApps.connect(owner).updateAppMetadata(app1Id, newMetadataURI)).to.be.reverted
    })

    it("Cannot get app uri of non existing app", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.appURI(app1Id)).to.be.reverted
    })
  })

  describe("XApp Endorsement", function () {
    it("If an XAPP is endorsed with a score of 100 they should be eligble for XAllocation Voting", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // Endorse XAPP with both Mjolnir node holders
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId1)).to.eql(50n) // Node ID 1 has an endorsement score is 50
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Endorse with node holder 1
      expect(await x2EarnApps.getScore(app1Id)).to.eql(50n) // XAPP endorsement score is 50

      expect(await x2EarnApps.getNodeEndorsementScore(nodeId2)).to.eql(50n) // Node Id 2 has an endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Endorse with node holder 2
      expect(await x2EarnApps.getScore(app1Id)).to.eql(100n) // XAPP endorsement score is now 100

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)
    })

    it("If an XAPP is endorsed with a score less than 100 they should not be eligble for XAllocation Voting", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create one Mjolnir node holder with an endorsement score of 50
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // Endorse XAPP with both Mjolnir node holder -> XAPP endorsement score is 50 -> XAPP is not eligible for XAllocation Voting
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      expect(await x2EarnApps.getScore(app1Id)).to.eql(50n) // XAPP endorsement score is 50

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(1)

      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(false)
    })

    it("If an XAPP has a score of 100 and is unendorsed by a node holder and their score falls below a 100 they will enter a grace period", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      expect(await x2EarnApps.nodeToEndorsedApp(nodeId1)).to.eql(app1Id) // Node ID 1 has endorsed app1Id

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1)

      expect(await x2EarnApps.nodeToEndorsedApp(nodeId1)).to.not.eql(app1Id) // Node ID 1 should not have endorsed app1Id

      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      let events = receipt?.logs

      let decodedEvents = events?.map(event => {
        return x2EarnApps.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })
      const event = decodedEvents.find(event => event?.name === "AppEndorsed")
      expect(event).to.not.equal(undefined)

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // app should be pending endorsement -> score is now 50 -> grace period starts
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round
      let round2 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(true)
    })

    it("If an XAPP has a score of 100 and its app admin removes endorsement by a node holder and their score falls below a 100 they will enter a grace period", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await x2EarnApps.connect(otherAccounts[0]).removeNodeEndorsement(app1Id, nodeId1)

      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      let events = receipt?.logs

      let decodedEvents = events?.map(event => {
        return x2EarnApps.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })
      const event = decodedEvents.find(event => event?.name === "AppEndorsed")
      expect(event).to.not.equal(undefined)

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // app should be pending endorsement -> score is now 50 -> grace period starts
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round
      let round2 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(true)
    })

    it("If an XAPP is in the grace period for longer than 2 cycles and has not got reendorsed they are removed from voting rounds", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // No apps pending endorsent
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(0)

      // No apps pending endorsent
      expect((await x2EarnApps.unendorsedApps()).length).to.eql(0)

      // remove endorsement from one of the node holders
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1)

      // App is pending endorsent
      expect((await x2EarnApps.unendorsedApps()).length).to.eql(1)

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // app should be pending endorsement -> score is now 50 -> grace period starts
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 1st cycle unedorsed
      let round2 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(true)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 2nd cycle unendorsed
      let round3 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round3)
      expect(isEligibleForVote).to.eql(true)

      // check endorsement this time it will remove the app from the voting rounds
      await x2EarnApps.checkEndorsement(app1Id)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 3rd cycle unendorsed
      let round4 = await startNewAllocationRound()

      // app should not be eligible for the current round as it is not in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round4)
      expect(isEligibleForVote).to.eql(false)

      // App is still pending endorsent
      expect((await x2EarnApps.unendorsedApps()).length).to.eql(1)
    })

    it("If an XAPP is in the grace period for longer than 2 cycles and has not got reendorsed they are removed from voting rounds and any endorser can remove their endorsement", async function () {
      const config = createLocalConfig()
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1)

      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      // check event emitted
      let events = receipt?.logs
      let decodedEvents = events?.map(event => {
        return x2EarnApps.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      const event = decodedEvents.find(event => event?.name === "AppEndorsementStatusUpdated")
      expect(event).to.not.equal(undefined)

      const eventGracePeriod = decodedEvents.find(event => event?.name === "AppUnendorsedGracePeriodStarted")
      expect(eventGracePeriod).to.not.equal(undefined)
      expect(eventGracePeriod?.args[0]).to.eql(app1Id)
      expect(eventGracePeriod?.args[1]).to.eql(BigInt(receipt.blockNumber))
      expect(eventGracePeriod?.args[2]).to.eql(BigInt(receipt.blockNumber + config.XAPP_GRACE_PERIOD))

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // app should be pending endorsement -> score is now 50 -> grace period starts
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 1st cycle unedorsed
      let round2 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(true)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 2nd cycle unendorsed
      let round3 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round3)
      expect(isEligibleForVote).to.eql(true)

      // remove endorsement from one of the node holders -> grace period is passed -> app is removed from voting rounds
      await x2EarnApps.connect(otherAccounts[2]).unendorseApp(app1Id, nodeId2)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 3rd cycle unendorsed
      let round4 = await startNewAllocationRound()

      // app should not be eligible for the current round as it is not in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round4)
      expect(isEligibleForVote).to.eql(false)
    })

    it("If an XAPP is in the grace period for longer than 2 cycles and has not got reendorsed they are removed from voting rounds and app admin can rmeove endorsements", async function () {
      const config = createLocalConfig()
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1)

      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      // check event emitted
      let events = receipt?.logs
      let decodedEvents = events?.map(event => {
        return x2EarnApps.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      const event = decodedEvents.find(event => event?.name === "AppEndorsementStatusUpdated")
      expect(event).to.not.equal(undefined)

      const eventGracePeriod = decodedEvents.find(event => event?.name === "AppUnendorsedGracePeriodStarted")
      expect(eventGracePeriod).to.not.equal(undefined)
      expect(eventGracePeriod?.args[0]).to.eql(app1Id)
      expect(eventGracePeriod?.args[1]).to.eql(BigInt(receipt.blockNumber))
      expect(eventGracePeriod?.args[2]).to.eql(BigInt(receipt.blockNumber + config.XAPP_GRACE_PERIOD))

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // app should be pending endorsement -> score is now 50 -> grace period starts
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 1st cycle unedorsed
      let round2 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(true)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 2nd cycle unendorsed
      let round3 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round3)
      expect(isEligibleForVote).to.eql(true)

      // app admin removes endorsement from one of the node holders
      await x2EarnApps.connect(otherAccounts[0]).removeNodeEndorsement(app1Id, nodeId2)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 3rd cycle unendorsed
      let round4 = await startNewAllocationRound()

      // app should not be eligible for the current round as it is not in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round4)
      expect(isEligibleForVote).to.eql(false)

      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers.length).to.eql(0)
    })

    it("If the grace period is updated it should should update the grace period for apps that are already in the grace period", async function () {
      const config = createLocalConfig()
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1)

      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      // check event emitted
      let events = receipt?.logs
      let decodedEvents = events?.map(event => {
        return x2EarnApps.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      const event = decodedEvents.find(event => event?.name === "AppEndorsementStatusUpdated")
      expect(event).to.not.equal(undefined)

      const eventGracePeriod = decodedEvents.find(event => event?.name === "AppUnendorsedGracePeriodStarted")
      expect(eventGracePeriod).to.not.equal(undefined)
      expect(eventGracePeriod?.args[0]).to.eql(app1Id)
      expect(eventGracePeriod?.args[1]).to.eql(BigInt(receipt.blockNumber))
      expect(eventGracePeriod?.args[2]).to.eql(BigInt(receipt.blockNumber + config.XAPP_GRACE_PERIOD))

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // app should be pending endorsement -> score is now 50 -> grace period starts
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 1st cycle unedorsed
      let round2 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(true)

      // App is eligible as in grace period
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)

      // If we update the grace period now to 1 block the app should not be eligible if we check endorsement
      await x2EarnApps.updateGracePeriod(1)

      // check endorsement this time it will remove the app from the voting rounds
      await x2EarnApps.checkEndorsement(app1Id)

      // app should still be eligible for the current round as it was not removed before the round started
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(true)

      // App is no longer eligible
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(false)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 2nd cycle unendorsed
      let round3 = await startNewAllocationRound()

      // app id not eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round3)
      expect(isEligibleForVote).to.eql(false)

      // Updating grace period now has no effect as the app is no longer eligible
      await x2EarnApps.updateGracePeriod(500000)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // app should not be eligible now
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(false)
    })

    it("If an XAPP is no longer in eligible for voting as they lost their endorsement they can get added in by getting reendorsed", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1)

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // app should be pending endorsement -> score is now 50 -> grace period starts
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // App is pending endorsent
      expect((await x2EarnApps.unendorsedApps()).length).to.eql(1)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 1st cycle unedorsed
      let round2 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(true)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 2nd cycle unendorsed
      let round3 = await startNewAllocationRound()

      // app should still be eligible for the current round as it is in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round3)
      expect(isEligibleForVote).to.eql(true)

      // check endorsement this time it will remove the app from the voting rounds
      await x2EarnApps.checkEndorsement(app1Id)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 3rd cycle unendorsed
      let round4 = await startNewAllocationRound()

      // app should not be eligible for the current round as it is not in the grace period
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round4)
      expect(isEligibleForVote).to.eql(false)

      // App is pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // reendorse the app
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // App is not pending endorsent
      expect((await x2EarnApps.unendorsedApps()).length).to.eql(0)

      // wait for round to end
      await waitForCurrentRoundToEnd()
      // start new round -> 4th cycle reendorsed

      let round5 = await startNewAllocationRound()
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round5)
      expect(isEligibleForVote).to.eql(true)
    })

    it("If an XNode endorser transfers its XNode XApp will not enter grace period, they will remain endorsed", async function () {
      const config = createLocalConfig()
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner, stargateNftMock } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // Skip ahead by a round so node is no longer in cooldown
      await startNewAllocationRound()

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      await waitForCurrentRoundToEnd()
      // Skip ahead by a round so node is no longer in cooldown
      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      // XNode holder transfers its XNode
      const tokenId = (await stargateNftMock.idsOwnedBy(otherAccounts[1]))[0]
      await stargateNftMock.connect(otherAccounts[1]).transferFrom(otherAccounts[1], otherAccounts[3], tokenId)

      const tokenId1 = (await stargateNftMock.idsOwnedBy(otherAccounts[3]))[0]
      expect(tokenId1).to.eql(tokenId)

      // this will only get picked up if endorsement is checked
      await x2EarnApps.checkEndorsement(app1Id)

      // app should be pending endorsement -> score is now 100
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)
      expect(await x2EarnApps.getScore(app1Id)).to.eql(100n)

      // App is not pending endorsent
      expect((await x2EarnApps.unendorsedApps()).length).to.eql(0)
    })

    it("An XAPP can only be endorsed if it is pending endorsement (score < 100)", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create MjölnirX node holder with an endorsement score of 100
      const nodeId1 = await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // App should be pending endorsement -> score is 0 never endorsed
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // App is pending endorsent
      expect((await x2EarnApps.unendorsedApps()).length).to.eql(1)

      // Endorse XAPP with MjölnirX node holder
      const tx = await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100

      // Check event emitted
      let receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      let events = receipt?.logs

      let decodedEvents = events?.map(event => {
        return x2EarnApps.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })
      const event = decodedEvents.find(event => event?.name === "AppEndorsed")
      expect(event).to.not.equal(undefined)

      // App is not pending endorsent
      expect((await x2EarnApps.unendorsedApps()).length).to.eql(0)

      // Should revert as app is already endorsed
      // Create another MjölnirX node holder with an endorsement score of 100
      const nodeId2 = await createNodeHolder(7, otherAccounts[2]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
      await expect(x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnAppAlreadyEndorsed",
      )

      // App should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // App should be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)
    })

    it("If a XNode holder transfers/sells its XNode the XAPPs remains endorsed by XNode and new owner is endorser", async function () {
      const config = createLocalConfig()
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1
      const { x2EarnApps, otherAccounts, owner, stargateNftMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create MjölnirX node holder with an endorsement score of 100
      const nodeId1 = await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      // App should be pending endorsement -> score is 0 never endorsed
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Start allocation round
      await startNewAllocationRound()

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100

      // Get XAPP score
      const score = await x2EarnApps.getScore(app1Id)

      // App should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Xnode holder should be listed as an endorser
      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers[0]).to.eql(otherAccounts[1].address)

      // XNode holder transfers its XNode
      const tokenId = (await stargateNftMock.idsOwnedBy(otherAccounts[1]))[0]
      await stargateNftMock.connect(otherAccounts[1]).transferFrom(otherAccounts[1], otherAccounts[3], tokenId)

      // New Xnode holder should still listed as an endorser
      const endorsers1 = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers1[0]).to.eql(otherAccounts[3].address)

      // XAPP should have same score
      expect(await x2EarnApps.getScore(app1Id)).to.eql(score)

      // XAPP should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // XNode should still be in cooldown
      expect(await x2EarnApps.checkCooldown(tokenId)).to.eql(true)
    })

    it("If a XNode holder loses its XNode status they are removed as an endorser when XApp endorser score is checked", async function () {
      const { x2EarnApps, otherAccounts, owner, stargateMock, stargateNftMock } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create MjölnirX node holder with an endorsement score of 100
      const nodeId1 = await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // App should be pending endorsement -> score is 0 never endorsed
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100

      // App should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Xnode holder should be listed as an endorser
      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers[0]).to.eql(otherAccounts[1].address)

      // Xnode holder loses its XNode status
      // Skip ahead 1 day
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      // XNode holder transfers its XNode
      await stargateMock.connect(otherAccounts[1]).unstake(nodeId1)
      // Xnode holder should not still be listed as an endorser
      const endorsers1 = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers1.length).to.eql(0)

      // XApp is not pending endorsement yet
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // this will only get picked up if endorsement is checked
      await x2EarnApps.checkEndorsement(app1Id)

      // App is pending endorsent
      expect((await x2EarnApps.unendorsedApps()).length).to.eql(1)
    })

    it("Should return correct value for grace period length", async function () {
      const config = createLocalConfig()
      const { x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      const gracePeriod = await x2EarnApps.gracePeriod()
      expect(gracePeriod).to.eql(BigInt(config.XAPP_GRACE_PERIOD))
    })

    it("Grace period can be updated by admin with governance role", async function () {
      const config = createLocalConfig()
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const gracePeriod = await x2EarnApps.gracePeriod()
      expect(gracePeriod).to.eql(BigInt(config.XAPP_GRACE_PERIOD))

      await catchRevert(x2EarnApps.connect(otherAccounts[0]).updateGracePeriod(1000))

      const newGracePeriod = 1000
      await x2EarnApps.connect(owner).updateGracePeriod(newGracePeriod)

      const gracePeriodAfterUpdate = await x2EarnApps.gracePeriod()
      expect(gracePeriodAfterUpdate).to.eql(BigInt(newGracePeriod))
    })

    it("Node endorsement scores can be updated by admin with governance role", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const nodeId1 = await createNodeHolder(1, otherAccounts[1]) // Node strength level 1 corresponds (Thor) to an endorsement score of 10
      const nodeId2 = await createNodeHolder(2, otherAccounts[2]) // Node strength level 2 corresponds (Odin) to an endorsement score of 20
      const nodeId3 = await createNodeHolder(3, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId4 = await createNodeHolder(4, otherAccounts[4]) // Node strength level 4 corresponds (MjolnirX) to an endorsement score of 100
      const nodeId5 = await createNodeHolder(5, otherAccounts[5]) // Node strength level 5 corresponds (MjolnirX) to an endorsement score of 100
      const nodeId6 = await createNodeHolder(6, otherAccounts[6]) // Node strength level 6 corresponds (MjolnirX) to an endorsement score of 100
      const nodeId7 = await createNodeHolder(7, otherAccounts[7]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[1].address)).to.eql(2n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[2].address)).to.eql(13n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[3].address)).to.eql(50n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[4].address)).to.eql(3n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[5].address)).to.eql(9n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[6].address)).to.eql(35n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[7].address)).to.eql(100n)

      expect(await x2EarnApps.getNodeEndorsementScore(nodeId1)).to.eql(2n)
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId2)).to.eql(13n)
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId3)).to.eql(50n)
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId4)).to.eql(3n)
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId5)).to.eql(9n)
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId6)).to.eql(35n)
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId7)).to.eql(100n)

      const newEndorsementScores = {
        strength: 1,
        thunder: 2,
        mjolnir: 3,
        veThorX: 4,
        strengthX: 5,
        thunderX: 6,
        mjolnirX: 7,
      }

      await x2EarnApps.connect(owner).updateNodeEndorsementScores(newEndorsementScores)

      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[1].address)).to.eql(
        BigInt(newEndorsementScores.strength),
      )
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[2].address)).to.eql(
        BigInt(newEndorsementScores.thunder),
      )
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[3].address)).to.eql(
        BigInt(newEndorsementScores.mjolnir),
      )
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[4].address)).to.eql(
        BigInt(newEndorsementScores.veThorX),
      )
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[5].address)).to.eql(
        BigInt(newEndorsementScores.strengthX),
      )
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[6].address)).to.eql(
        BigInt(newEndorsementScores.thunderX),
      )
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[7].address)).to.eql(
        BigInt(newEndorsementScores.mjolnirX),
      )
    })

    it("Only a default admin or app admin can call 'removeNodeEndorsement'", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      // App not pending endorsement
      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      // Should revert if random user calls removeNodeEndorsement
      await expect(x2EarnApps.connect(otherAccounts[10]).removeNodeEndorsement(app1Id, nodeId1)).to.be.reverted

      // Should not revert if xapp admin user calls removeNodeEndorsement
      await expect(x2EarnApps.connect(otherAccounts[0]).removeNodeEndorsement(app1Id, nodeId1)).to.not.be.reverted

      // Should not revert if default admin user calls removeNodeEndorsement
      await expect(x2EarnApps.connect(owner).removeNodeEndorsement(app1Id, nodeId2)).to.not.be.reverted
    })

    it("Should revert if admin tries to remove endorsement of an XAPP that has not been submitted", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Should reverts as app has not been submitted
      await expect(x2EarnApps.connect(owner).removeNodeEndorsement(app1Id, 1)).to.be.reverted
    })

    it("Should revert if admin tries to remove endorsement of an XNode that is not endorsing XAPP", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Create MjölnirX node holder with an endorsement score of 100
      const nodeId1 = await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100

      // Should reverts as node id that is not an endorser is passed in
      await expect(x2EarnApps.connect(owner).removeNodeEndorsement(app1Id, 10)).to.be.reverted

      // Should not revert as node id that is an endorser is passed in
      await expect(x2EarnApps.connect(owner).removeNodeEndorsement(app1Id, nodeId1)).to.not.be.reverted
    })

    it("Endorsement score threshold can be updated by admin with governance role", async function () {
      const config = createLocalConfig()
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      expect(await x2EarnApps.endorsementScoreThreshold()).to.eql(BigInt(100n))

      // Should revert as not admin
      await catchRevert(x2EarnApps.connect(otherAccounts[3]).updateEndorsementScoreThreshold(1000))

      // Update endorsement score threshold
      await x2EarnApps.connect(owner).updateEndorsementScoreThreshold(1000)

      // Check updated endorsement score threshold
      expect(await x2EarnApps.endorsementScoreThreshold()).to.eql(BigInt(1000n))
    })

    it("An XAPP can only endorse one XApp at once", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[1].address)

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(2)

      // Create MjölnirX node holder with an endorsement score of 100
      const nodeId1 = await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // App should be pending endorsement -> score is 0 never endorsed
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100

      // Should revert as endorser is already endorsing an XApp
      await expect(x2EarnApps.connect(otherAccounts[1]).endorseApp(app2Id, nodeId1)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnAlreadyEndorser",
      )

      // App2 should be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app2Id)).to.eql(true)

      // Appw should not be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app2Id)).to.eql(false)
    })

    it("Only an node holder can endorse an XAPP", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Should revert as endorser is already endorsing an XApp
      await expect(x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonNodeHolder",
      )

      // App2 should be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Appw should not be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(false)
    })

    it("Cannot endorse a blacklisted XAPP and a blacklisted App cannot be pending endorsement", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // Blacklist XAPP
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      // Create MjölnirX node holder with an endorsement score of 100
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Should revert as endorser is already endorsing an XApp
      await expect(x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnAppBlacklisted",
      )

      // App2 should be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Appw should not be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(false)
    })

    it("Cannot endorse an XAPP that does not exist", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // AppId that does not exist
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Should revert as endorser is already endorsing an XApp
      await expect(x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonexistentApp",
      )
    })

    it("Cannot unendorse an XAPP that does not exist", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // AppId that does not exist
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // User should be a node holder to by pass first check
      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      // Should revert as endorser is already endorsing an XApp
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonexistentApp",
      )
    })

    it("Cannot unendorse an XAPP if not an endorser", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // User should be a node holder to by pass first check
      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // AppId that does not exist
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Should revert as user is not an endorser
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonEndorser",
      )
    })

    it("Cannot unendorse an XAPP if not a nodeholder", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // AppId that does not exist
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Should revert as user is not an endorser
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonNodeHolder",
      )
    })

    it("Cannot check endorsement status of an XAPP that does not exist", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // AppId that does not exist
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Should revert as endorser is already endorsing an XApp
      await expect(x2EarnApps.connect(otherAccounts[1]).checkEndorsement(app1Id)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonexistentApp",
      )
    })

    it("Does not revert if checking the status of a blacklisted XAPP", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // Blacklist XAPP
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      expect(await x2EarnApps.checkEndorsement(app1Id)).to.not.be.reverted
    })

    it("A blacklisted XAPP is not pending endorsement", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // Blacklist XAPP
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      // App should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)
    })

    it("A node holder can remove endorsement if a XAPP is blacklisted", async function () {
      const { x2EarnApps, otherAccounts, owner, otherAccount, x2EarnCreator } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // Create MjölnirX node holder with an endorsement score of 100
      const nodeId1 = await createNodeHolder(7, otherAccounts[0]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[0]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100

      // Blacklist XAPP
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      // Should not revert as endorser if the XAPP is blacklisted
      await expect(x2EarnApps.connect(otherAccounts[0]).unendorseApp(app1Id, nodeId1)).to.not.be.reverted

      // App should not be pending endorsement -> blacklisted XApps should not be pendng endosement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Xnode holder should no longer be listed as an endorser
      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers.length).to.eql(0)

      // Endorser should be able to endorse a different XAPP
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[1].address)

      // Grant other account creator NFT
      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(otherAccount)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")

      await expect(x2EarnApps.connect(otherAccounts[0]).endorseApp(app2Id, nodeId1)).to.not.be.reverted
    })

    it("A node holder can unendorse one XAPP and reendorse another", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // Create MjölnirX node holder with an endorsement score of 100
      const nodeId1 = await createNodeHolder(7, otherAccounts[0]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[0]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100

      // Should not revert as endorser if the XAPP is blacklisted
      await expect(x2EarnApps.connect(otherAccounts[0]).unendorseApp(app1Id, nodeId1)).to.not.be.reverted

      // App should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Xnode holder should no longer be listed as an endorser
      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers.length).to.eql(0)

      // Endorser should be able to endorse a different XAPP
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[1].address)

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")

      await expect(x2EarnApps.connect(otherAccounts[0]).endorseApp(app2Id, nodeId1)).to.not.be.reverted

      // Node holder should listed as endorser
      const endorsers2 = await x2EarnApps.getEndorsers(app2Id)
      expect(endorsers2[0]).to.eql(otherAccounts[0].address)
    })

    it("An XAPP that has been black listed should not be elgible for voting in following rounds even if endorsed", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // blacklist XAPP from future rounds
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // app should not be pending endorsement -> blacklisted XAPPS shoould nto be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 1st cycle unedorsed
      let round2 = await startNewAllocationRound()

      // app should not be eligible for voting in current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(false)

      // user should still be endorsed by XAPPS
      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers.length).to.eql(2)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 2nd cycle unendorsed
      let round3 = await startNewAllocationRound()

      // app should still still not be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round3)
      expect(isEligibleForVote).to.eql(false)
    })

    it("An XAPP that has been black listed should not be able to be endorsed until removed from the blacklist", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // blacklist XAPP
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      // app should not be pending endorsement -> blacklisted XAPPS should nto be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Check XApps pending endorsement should be empty
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(0)

      // blacklist XAPP
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, true)

      // app should not be pending endorsement until app endorsement is checked
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      await x2EarnApps.checkEndorsement(app1Id)

      // app should now be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Check XApps pending endorsement should be empty
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(1)
    })

    it("An XAPPs security should be set to LOW when they intially join the platform", async function () {
      const { x2EarnApps, otherAccounts, owner, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[1])

      // Get app security level
      const appSecurityLevel = await veBetterPassport.appSecurity(app1Id)
      expect(appSecurityLevel).to.eql(1n)
    })

    it("An XAPPs security should be set to NONE when they lose there endorsement", async function () {
      const config = createLocalConfig()
      config.XAPP_GRACE_PERIOD = 0
      const { x2EarnApps, otherAccounts, owner, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const { nodeId: nodeId1 } = await endorseApp(app1Id, otherAccounts[1])

      // Get app security level
      const appSecurityLevel = await veBetterPassport.appSecurity(app1Id)
      expect(appSecurityLevel).to.eql(1n)

      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1) // Node holder removes their endorsement

      // Check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // Get app security level
      const appSecurityLevel2 = await veBetterPassport.appSecurity(app1Id)
      expect(appSecurityLevel2).to.eql(0n)
    })

    it("An XAPPs security should be reset when an XAPP that once was endorsed gets re-endorsed", async function () {
      const config = createLocalConfig()
      config.XAPP_GRACE_PERIOD = 0
      const { x2EarnApps, otherAccounts, owner, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[1].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")

      const { nodeId: nodeId1 } = await endorseApp(app1Id, otherAccounts[1])
      const { nodeId: nodeId2 } = await endorseApp(app2Id, otherAccounts[2])

      // Get app security level
      expect(await veBetterPassport.appSecurity(app1Id)).to.eql(1n)
      expect(await veBetterPassport.appSecurity(app2Id)).to.eql(1n)

      // Passport admin changes their security level
      await veBetterPassport.connect(owner).setAppSecurity(app1Id, 0)
      await veBetterPassport.connect(owner).setAppSecurity(app2Id, 3)

      // Get app security level
      expect(await veBetterPassport.appSecurity(app1Id)).to.eql(0n)
      expect(await veBetterPassport.appSecurity(app2Id)).to.eql(3n)

      // Unendorse apps
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1)
      await x2EarnApps.connect(otherAccounts[2]).unendorseApp(app2Id, nodeId2)

      // Check endorsement
      await x2EarnApps.checkEndorsement(app1Id)
      await x2EarnApps.checkEndorsement(app2Id)

      // App security level should be NONE
      expect(await veBetterPassport.appSecurity(app1Id)).to.eql(0n)
      expect(await veBetterPassport.appSecurity(app2Id)).to.eql(0n)

      // Re-endorse apps
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1)
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app2Id, nodeId2)

      // Scores should be reset to where they were before
      expect(await veBetterPassport.appSecurity(app1Id)).to.eql(0n)
      expect(await veBetterPassport.appSecurity(app2Id)).to.eql(3n)
    })

    it("An XAPP that has been removed from black list that has endorsers should not be pending endorsement", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement -> blacklisted XAPPS shoould not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // blacklist XAPP from future rounds
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // app should not be pending endorsement -> blacklisted XAPPS shoould nto be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 1st cycle unedorsed
      let round2 = await startNewAllocationRound()

      // app should not be eligible for voting in current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(false)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // Remove XAPP from blacklist
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, true)

      // To find XAPPS that have been unblacklisted need to check endorsement status
      await x2EarnApps.checkEndorsement(app1Id)

      // Should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // start new round
      let round3 = await startNewAllocationRound()

      expect(await xAllocationVoting.isEligibleForVote(app1Id, round3)).to.eql(true)

      // Get apps info should not be empty as app
      const appsInfo = await x2EarnApps.apps()
      expect(appsInfo.length).to.eql(1)

      // Get all eligible apps should return 1
      const eligbleApps = await x2EarnApps.allEligibleApps()
      expect(eligbleApps.length).to.eql(1)

      // Unedorsed apps list should be empty
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(0)
    })

    it("An XAPP that has been removed from blacklist that had been endorsed pre blacklist but now has no endorsers should be pending endorsement and in two week grace period", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Get apps info should be empty as app is not eligible
      const appsInfo1 = await x2EarnApps.apps()
      expect(appsInfo1.length).to.eql(0)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      // Get apps info should not be empty as app is eligible
      const appsInfo2 = await x2EarnApps.apps()
      expect(appsInfo2.length).to.eql(1)

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // blacklist XAPP from future rounds
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // app should not be pending endorsement -> blacklisted XAPPS shoould nto be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 1st cycle unedorsed
      let round2 = await startNewAllocationRound()

      // app should not be eligible for voting in current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(false)

      // XAPP gets unendorsed
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).unendorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      // Get apps info should be not empty as app was once eligible
      const appsInfo3 = await x2EarnApps.apps()
      expect(appsInfo3.length).to.eql(1)

      // check endorsers should be 0
      const endorsers2 = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers2.length).to.eql(0)

      // app should not be pending endorsement -> blacklisted XAPPS shoould not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // Remove XAPP from blacklist
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, true)

      // Get apps info should not be empty as app had once been eligible and is now pending endorsement
      const appsInfo4 = await x2EarnApps.apps()
      expect(appsInfo4.length).to.eql(1)

      // To find XAPPS that have been unblacklisted need to check endorsement status
      await x2EarnApps.checkEndorsement(app1Id)

      // Should be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Unedorsed apps list should be 1 as app is in grace period
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(1)

      // start new round
      let round3 = await startNewAllocationRound()

      expect(await xAllocationVoting.isEligibleForVote(app1Id, round3)).to.eql(true)

      // Get apps info should be equal to 1 as app is eligible
      const appsInfo5 = await x2EarnApps.apps()
      expect(appsInfo5.length).to.eql(1)

      // Unedorsed apps list should contain 1
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(1)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round
      await startNewAllocationRound()

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // check status of endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // start new round
      const latestRound = await startNewAllocationRound()

      // app should not be eligible for voting
      expect(await xAllocationVoting.isEligibleForVote(app1Id, latestRound)).to.eql(false)

      // app should be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Apps pending endorsement should be 1
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(1)
    })

    //Skipping test since upgrade is no more possible with stargate
    it.skip("An XAPP that has been removed from black list, but did not reach score threshold pre blacklist, but node has increased score since so that XApp now has a score greater than 100, they should not be peding endorsement ", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner, stargateMock, stargateNftMock } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two node holders with an endorsement score
      const nodeId1 = await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId2 = await createNodeHolder(1, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 2

      // Endorse XAPP with node holder -> combined endorsement score is 63 -> less than 100
      await x2EarnApps.connect(owner).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 2

      // Check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // app should be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // app should not be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(false)

      // App should not be added so should not exist in vebetter DAO app list
      expect(await x2EarnApps.appExists(app1Id)).to.eql(false)

      // Get apps info should be empty as app is not eligible
      expect((await x2EarnApps.apps()).length).to.eql(0)

      // Unedorsed apps list should not be empty
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(1)

      // blacklist XAPP from future rounds
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)
      // app should not be pending endorsement -> blacklisted XAPPS should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // start new round -> 1st cycle unedorsed
      let round2 = await startNewAllocationRound()

      // app should not be eligible for voting in current round
      expect(await xAllocationVoting.isEligibleForVote(app1Id, round2)).to.eql(false)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // Remove XAPP from blacklist
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, true)

      // To find XAPPS that have been unblacklisted need to check endorsement status
      await x2EarnApps.checkEndorsement(app1Id)

      // Should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Get all eligible apps should return 1
      const eligbleApps = await x2EarnApps.allEligibleApps()
      expect(eligbleApps.length).to.eql(1)

      // start new round
      let round3 = await startNewAllocationRound()

      // app should be eligible for the current round
      expect(await xAllocationVoting.isEligibleForVote(app1Id, round3)).to.eql(true)

      // Get apps info should not be empty as app is eligible
      const appsInfo = await x2EarnApps.apps()
      expect(appsInfo.length).to.eql(1)

      // Unedorsed apps list should be empty
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(0)
    })

    it("Should be able to get a node holders endorsement score", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const nodeId1 = await createNodeHolder(9, otherAccounts[0]) // Node strength level 9 corresponds (Lightning) to an endorsement score of 0
      const nodeId2 = await createNodeHolder(1, otherAccounts[1]) // Node strength level 1 corresponds (Strength) to an endorsement score of 2
      const nodeId3 = await createNodeHolder(2, otherAccounts[2]) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId4 = await createNodeHolder(3, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId5 = await createNodeHolder(4, otherAccounts[4]) // Node strength level 4 corresponds (VeThorX) to an endorsement score of 3
      const nodeId6 = await createNodeHolder(5, otherAccounts[5]) // Node strength level 5 corresponds (StrengthX) to an endorsement score of 9
      const nodeId7 = await createNodeHolder(6, otherAccounts[6]) // Node strength level 6 corresponds (ThunderX) to an endorsement score of 35
      const nodeId8 = await createNodeHolder(7, otherAccounts[7]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Get endorsement score
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[0].address)).to.eql(0n) // Node strength level 9 corresponds (Lightning) to an endorsement score of 0
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[1].address)).to.eql(2n) // Node strength level 1 corresponds (Strength) to an endorsement score of 2
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[2].address)).to.eql(13n) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[3].address)).to.eql(50n) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[4].address)).to.eql(3n) // Node strength level 4 corresponds (VeThorX) to an endorsement score of 3
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[5].address)).to.eql(9n) // Node strength level 5 corresponds (StrengthX) to an endorsement score of 9
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[6].address)).to.eql(35n) // Node strength level 6 corresponds (ThunderX) to an endorsement score of 35
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[7].address)).to.eql(100n) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
    })

    it("Should be able to get a nodes endorsement score", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const nodeId1 = await createNodeHolder(9, otherAccounts[0]) // Node strength level 9 corresponds (Lightning) to an endorsement score of 0
      const nodeId2 = await createNodeHolder(1, otherAccounts[1]) // Node strength level 1 corresponds (Strength) to an endorsement score of 2
      const nodeId3 = await createNodeHolder(2, otherAccounts[2]) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId4 = await createNodeHolder(3, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId5 = await createNodeHolder(4, otherAccounts[4]) // Node strength level 4 corresponds (VeThorX) to an endorsement score of 3
      const nodeId6 = await createNodeHolder(5, otherAccounts[5]) // Node strength level 5 corresponds (StrengthX) to an endorsement score of 9
      const nodeId7 = await createNodeHolder(6, otherAccounts[6]) // Node strength level 6 corresponds (ThunderX) to an endorsement score of 35
      const nodeId8 = await createNodeHolder(7, otherAccounts[7]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Get endorsement score
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId1)).to.eql(0n) // Node strength level 9 corresponds (Lightning) to an endorsement score of 0
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId2)).to.eql(2n) // Node strength level 1 corresponds (Strength) to an endorsement score of 2
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId3)).to.eql(13n) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId4)).to.eql(50n) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId5)).to.eql(3n) // Node strength level 4 corresponds (VeThorX) to an endorsement score of 3
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId6)).to.eql(9n) // Node strength level 5 corresponds (StrengthX) to an endorsement score of 9
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId7)).to.eql(35n) // Node strength level 6 corresponds (ThunderX) to an endorsement score of 35
      expect(await x2EarnApps.getNodeEndorsementScore(nodeId8)).to.eql(100n) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
    })

    it("If an XAPP has a score less than 100 but one of its endorsers increases the node strength when endorsement status is checked they will be endorsed ", async function () {
      const { x2EarnApps, otherAccounts, owner, stargateMock, stargateNftMock } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two node holders with an endorsement score
      const nodeId1 = await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // Endorse XAPP with node holder -> combined endorsement score is 63 -> less than 100
      await x2EarnApps.connect(owner).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50

      // Check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // app should be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // app should not be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(false)

      // App should not be added so should exist in vebetter DAO app list
      expect(await x2EarnApps.appExists(app1Id)).to.eql(false)

      // Get apps info should be empty as app is not eligible
      const appsInfo = await x2EarnApps.apps()
      expect(appsInfo.length).to.eql(0)

      // Skip ahead 1 day
      await time.setNextBlockTimestamp((await time.latest()) + 86400)
      // XNode holder increases its node strength by getting a new node
      const tokenId2 = (await stargateNftMock.idsManagedBy(otherAccounts[2].address))[0]
      await stargateMock.connect(otherAccounts[2]).unstake(tokenId2)
      const upgradedTokenId = await createNodeHolder(7, otherAccounts[2])
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, upgradedTokenId)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // app should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Get apps info should have 1 app
      const appsInfo2 = await x2EarnApps.apps()
      expect(appsInfo2.length).to.eql(1)

      // App should be added so should exist in vebetter DAO app list
      expect(await x2EarnApps.appExists(app1Id)).to.eql(true)

      // Unedorsed apps list should be empty
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(0)
    })

    it("If a user recieves an XNode that is endorsing an XAPP they can remove endorsement and endorse another XAPP", async function () {
      const { x2EarnApps, otherAccounts, owner, stargateMock, stargateNftMock } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[1].address)

      // Register XAPP -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI 1")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(2)

      // Create two node holders with an endorsement score
      const nodeId1 = await createNodeHolder(7, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      // Endorse XAPP with node holder
      await x2EarnApps.connect(owner).endorseApp(app1Id, nodeId1) // Node holder endorsement score 100

      // Check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // app should be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // app should be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)

      // App should be added so should exist in vebetter DAO app list
      expect(await x2EarnApps.appExists(app1Id)).to.eql(true)

      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)
      // XNode holder increases its node strength by getting a new node
      await stargateNftMock.connect(owner).transferFrom(owner.address, otherAccounts[0].address, nodeId1)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // app should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Get apps info should have 1 app
      const appsInfo2 = await x2EarnApps.apps()
      expect(appsInfo2.length).to.eql(1)

      // Unedorsed apps list should be empty
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(1)

      // new owner should be able to unendorse XAPP
      await x2EarnApps.connect(otherAccounts[0]).unendorseApp(app1Id, nodeId1)

      // app should be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // check endorsers should be 0
      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers.length).to.eql(0)

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(2)

      // should be able to endorse new XAPP
      await x2EarnApps.connect(otherAccounts[0]).endorseApp(app2Id, nodeId1) // Node holder endorsement score 100

      // app should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      const appIdsPendingEndorsement3 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement3.length).to.eql(1)
    })

    it("Check how expensive it is to check the endorsement status of an XAPP with 50 endorsers (MAX amount)", async function () {
      if (network.name == "hardhat") {
        return console.log(
          "Skipping VTHO transfer test on hardhat network as hardcoded VTHO contract address in Treasury does not exist",
        )
      }
      const { x2EarnApps, otherAccounts, owner, stargateMock, stargateNftMock } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      const accounts = getTestKeys(50)
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const level = 1 // score = 2

      const seedAccounts: SeedAccount[] = []

      accounts.forEach(key => {
        seedAccounts.push({
          key,
          amount: VET.of(200000).wei,
        })
      })

      // aidrop VTHO
      await airdropVTHO(
        seedAccounts.map(acct => acct.key.address),
        5000n,
        accounts[2],
      )

      for (let i = 0; i < 50; i++) {
        // Create node holder with an endorsement score
        const nodeHolder = accounts[i].address as unknown as HardhatEthersSigner
        const nodeId = await createNodeHolder(level, nodeHolder)

        await x2EarnApps.connect(nodeHolder).endorseApp(app1Id, nodeId)
      }

      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers.length).to.eql(50)

      const tx = await x2EarnApps.checkEndorsement(app1Id)
      const receipt = await tx.wait()

      console.log(receipt?.gasUsed)
    })

    it("A user with a XNODE node delegated to them can endorse an XAPP", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement, stargateMock, stargateNftMock } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      const nodeId2 = await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // delegate node to user
      await stargateNftMock.connect(otherAccounts[1]).addTokenManager(otherAccounts[3].address, nodeId1) // Other account 1 delegates node to other account 3
      await stargateNftMock.connect(otherAccounts[2]).addTokenManager(otherAccounts[4].address, nodeId2) // Other account 2 delegates node to other account 4

      // Endorse XAPP with both Mjolnir node holders
      await x2EarnApps.connect(otherAccounts[3]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      expect(await x2EarnApps.getScore(app1Id)).to.eql(50n) // XAPP endorsement score is 50
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 50
      expect(await x2EarnApps.getScore(app1Id)).to.eql(100n) // XAPP endorsement score is now 100

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)
    })

    it("A user with a XNODE node delegated to them can endorse an XAPP and the delegated XNODE owner cannot", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement, stargateMock, stargateNftMock } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // delegate node to user
      await stargateNftMock.connect(otherAccounts[1]).addTokenManager(otherAccounts[3].address, nodeId1) // Other account 1 delegates node to other account 3

      await expect(x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 2)).to.be.reverted // Node owner cannot endorse XAPP as node is delegated

      // Endorse XAPP with both Mjolnir node holders
      await x2EarnApps.connect(otherAccounts[3]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 50
      expect(await x2EarnApps.getScore(app1Id)).to.eql(50n) // XAPP endorsement score is 50
    })

    it("A random user who is neither owner nor manager cannot endorse with someone else's node", async function () {
      const { x2EarnApps, otherAccounts, owner, stargateMock, stargateNftMock } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // Create a node owned by otherAccounts[1]
      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      // otherAccounts[5] (random user) tries to endorse with otherAccounts[1]'s node
      await expect(x2EarnApps.connect(otherAccounts[5]).endorseApp(app1Id, nodeId1)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonNodeHolder",
      )

      // App should still be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)
    })

    it("Node owner cannot endorse with their own delegated node", async function () {
      const { x2EarnApps, otherAccounts, owner, stargateMock, stargateNftMock } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // Create a node owned by otherAccounts[1]
      const nodeId1 = await createNodeHolder(7, otherAccounts[1])

      // Delegate node to otherAccounts[3]
      await stargateNftMock.connect(otherAccounts[1]).addTokenManager(otherAccounts[3].address, nodeId1)

      // Original owner (otherAccounts[1]) tries to endorse with their delegated node
      await expect(x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonNodeHolder",
      )

      // Manager should be able to endorse
      await x2EarnApps.connect(otherAccounts[3]).endorseApp(app1Id, nodeId1)
      expect(await x2EarnApps.getScore(app1Id)).to.eql(100n)
    })

    it("A user with multiple nodes delegated to them can endorse multiple apps", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement, stargateMock, stargateNftMock } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[1].address)
      const app3Id = await x2EarnApps.hashAppName(otherAccounts[2].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(3)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(7, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 100
      const nodeId2 = await createNodeHolder(7, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 100
      const nodeId3 = await createNodeHolder(7, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 100

      // delegate node to user
      await stargateNftMock.connect(otherAccounts[1]).addTokenManager(otherAccounts[4].address, nodeId1) // Other account 1 delegates node to other account 4
      await stargateNftMock.connect(otherAccounts[2]).addTokenManager(otherAccounts[4].address, nodeId2) // Other account 2 delegates node to other account 4
      await stargateNftMock.connect(otherAccounts[3]).addTokenManager(otherAccounts[4].address, nodeId3) // Other account 3 delegates node to other account 4

      // Account 4 endorses all 3 XAPPs
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100 -> XAPP endorse with token Id 1
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app2Id, nodeId2) // Node holder endorsement score is 100 -> XAPP endorse with token Id 2
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app3Id, nodeId3) // Node holder endorsement score is 100 -> XAPP endorse with token Id 3

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([otherAccounts[4].address])
      expect(await x2EarnApps.getEndorsers(app2Id)).to.eql([otherAccounts[4].address])
      expect(await x2EarnApps.getEndorsers(app3Id)).to.eql([otherAccounts[4].address])
    })

    it("A user with multiple nodes delegated to them can endorse the same app multiple times", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement, stargateMock, stargateNftMock } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(6, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35
      const nodeId2 = await createNodeHolder(6, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35
      const nodeId3 = await createNodeHolder(6, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35

      // delegate node to user
      await stargateNftMock.connect(otherAccounts[1]).addTokenManager(otherAccounts[4].address, nodeId1) // Other account 1 delegates node to other account 4
      await stargateNftMock.connect(otherAccounts[2]).addTokenManager(otherAccounts[4].address, nodeId2) // Other account 2 delegates node to other account 4
      await stargateNftMock.connect(otherAccounts[3]).addTokenManager(otherAccounts[4].address, nodeId3) // Other account 3 delegates node to other account 4

      // Account 4 endorses all 3 XAPPs
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 35 -> XAPP endorse with token Id 1
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 35 -> XAPP endorse with token Id 2
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, nodeId3) // Node holder endorsement score is 35 -> XAPP endorse with token Id 3

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([
        otherAccounts[4].address,
        otherAccounts[4].address,
        otherAccounts[4].address,
      ]) // TODO: Should be unique endorsers getting returned -> need efficient way to check for unique endorsers
    })

    it("Only XApp endorser can remove their XAPP and not other node holder thats not an endorser", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[1].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI1")

      // Create two Mjolnir node holders with an endorsement score of 100 each
      const nodeId1 = await createNodeHolder(7, otherAccounts[1])
      const nodeId2 = await createNodeHolder(7, otherAccounts[2])

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app2Id, nodeId2) // Node holder endorsement score is 50

      expect(await x2EarnApps.nodeToEndorsedApp(nodeId1)).to.eql(app1Id) // Node ID 1 has endorsed app1Id

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await expect(
        x2EarnApps.connect(otherAccounts[2]).unendorseApp(app1Id, nodeId2),
      ).to.be.revertedWithCustomError(x2EarnApps, "X2EarnNonEndorser")
    })

    it("A user with multiple nodes delegated to them can endorse the same app multiple times", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement, stargateMock, stargateNftMock } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(6, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35
      const nodeId2 = await createNodeHolder(6, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35
      const nodeId3 = await createNodeHolder(6, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35

      // delegate node to user
      await stargateNftMock.connect(otherAccounts[1]).addTokenManager(otherAccounts[4].address, nodeId1) // Other account 1 delegates node to other account 4
      await stargateNftMock.connect(otherAccounts[2]).addTokenManager(otherAccounts[4].address, nodeId2) // Other account 2 delegates node to other account 4
      await stargateNftMock.connect(otherAccounts[3]).addTokenManager(otherAccounts[4].address, nodeId3) // Other account 3 delegates node to other account 4

      // Account 4 endorses all 3 XAPPs
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 35 -> XAPP endorse with token Id 1
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, nodeId2) // Node holder endorsement score is 35 -> XAPP endorse with token Id 2
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, nodeId3) // Node holder endorsement score is 35 -> XAPP endorse with token Id 3

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([
        otherAccounts[4].address,
        otherAccounts[4].address,
        otherAccounts[4].address,
      ]) // TODO: Should be unique endorsers getting returned -> need efficient way to check for unique endorsers
    })

    it("An XAPP who was endorsed by delegated node remains endorsed by XNode when delegation is revoked", async function () {
      const { x2EarnApps, otherAccounts, owner, stargateMock, stargateNftMock } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Create two Mjolnir node holders with an endorsement score of 50 each
      const nodeId1 = await createNodeHolder(7, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35

      // delegate node to user
      await stargateNftMock.connect(otherAccounts[1]).addTokenManager(otherAccounts[4].address, nodeId1) // Other account 1 delegates node to other account 4

      // Account 4 endorses all 3 XAPPs
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 35 -> XAPP endorse with token Id 1

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([otherAccounts[4].address])

      // revoke delegation -> Ownner of the node becomes the manager again
      await stargateNftMock.connect(otherAccounts[1]).removeTokenManager(nodeId1)

      // check endorsement
      await x2EarnApps.checkEndorsement(app1Id)

      // app should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Get apps info should have 1 app
      const appsInfo2 = await x2EarnApps.apps()
      expect(appsInfo2.length).to.eql(1)

      // Unedorsed apps list should be empty
      expect((await x2EarnApps.unendorsedAppIds()).length).to.eql(0)

      // XNode owner should now be the endorser
      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([otherAccounts[1].address])
    })

    it("Admins should be able to remove an XApp from submission list", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(1)

      // Remove XAPP from submission list
      await x2EarnApps.connect(owner).removeXAppSubmission(app1Id)

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()

      expect(appIdsPendingEndorsement2.length).to.eql(0)
    })

    it("Only app admins and contract admin should be able to remove an XApp from submission list", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[1].address)
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[2].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(otherAccounts[1])
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI 1")

      await x2EarnApps
        .connect(otherAccounts[2])
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI 2")

      const appIdsPendingEndorsement1 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement1.length).to.eql(2)

      await expect(x2EarnApps.connect(otherAccounts[6]).removeXAppSubmission(app1Id)).to.be.reverted

      // Remove XAPP from submission list
      await expect(x2EarnApps.connect(owner).removeXAppSubmission(app1Id)).to.not.be.reverted

      await expect(x2EarnApps.connect(otherAccounts[2]).removeXAppSubmission(app2Id)).to.not.be.reverted

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()

      expect(appIdsPendingEndorsement2.length).to.eql(0)
    })

    it("Should revert if trying to remove XApp that has not been submitted", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const app1Id = await x2EarnApps.hashAppName(owner.address)

      await expect(x2EarnApps.connect(owner).removeXAppSubmission(app1Id)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonexistentApp",
      )
    })

    it("Should revert if trying to remove XApp that has participated in one or more XAllocationg Voting rounds", async function () {
      const { x2EarnApps, owner, otherAccounts, xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await endorseApp(app1Id, owner)

      // app should be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      await expect(x2EarnApps.connect(owner).removeXAppSubmission(app1Id)).to.be.revertedWithCustomError(
        x2EarnApps,
        "NodeManagementXAppAlreadyIncluded",
      )
    })

    it("Should revert if trying to remove XApp that has participatted in one or more XAllocationg Voting rounds even if unendorsed", async function () {
      const { x2EarnApps, owner, otherAccounts, xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const { nodeId } = await endorseApp(app1Id, owner)

      // app should be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      await x2EarnApps.connect(owner).unendorseApp(app1Id, nodeId)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      await expect(x2EarnApps.connect(owner).removeXAppSubmission(app1Id)).to.be.revertedWithCustomError(
        x2EarnApps,
        "NodeManagementXAppAlreadyIncluded",
      )
    })

    it("Node holder cannot unendorse XAPP if they are in cooldown period", async function () {
      const config = createLocalConfig()
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1
      const { x2EarnApps, owner, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const nodeId = await createNodeHolder(7, otherAccounts[1])

      await startNewAllocationRound()

      // Node should NOT be in cooldown period after being minted
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(false)

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId)

      // Node should be in cooldown period -> New round has not yet started
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(true)

      // Node holder should not be able to unendorse XAPP
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNodeCooldownActive",
      )

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([otherAccounts[1].address])

      // Node should be out of cooldown period when new round starts
      await waitForCurrentRoundToEnd()
      await startNewAllocationRound()

      // Node should be out of cooldown period
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(false)

      // Node holder should be able to unendorse XAPP
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId)

      // App should not have any endorsers
      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([])

      // Can endorse again
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId)

      // Node should be able to endorse XAPP
      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([otherAccounts[1].address])
    })

    it("If XApp removes XAPP endorsment they are not no longer in cooldown period", async function () {
      const config = createLocalConfig()
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1
      const { x2EarnApps, owner, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      const app2Id = await x2EarnApps.hashAppName(otherAccounts[1].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")

      const nodeId = await createNodeHolder(7, otherAccounts[1])

      await startNewAllocationRound()

      // Node should be out of cooldown period
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(false)

      // Node holder should be able to endorse XAPP
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId)

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([otherAccounts[1].address])

      // Node should be in cooldown period after endorsing XAPP cannot unendorse
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(true)

      // Will revert if node holder tries to unendorse XAPP
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNodeCooldownActive",
      )

      // If XApp removes endorsement they should not be in cooldown period
      await x2EarnApps.connect(otherAccounts[0]).removeNodeEndorsement(app1Id, nodeId)

      // Node should be out of cooldown period
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(false)

      // Node holder should be able to endorse XAPP
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app2Id, nodeId)

      // App 1 should not have any endorsers
      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([])
      // App 2 should have endorsers
      expect(await x2EarnApps.getEndorsers(app2Id)).to.eql([otherAccounts[1].address])

      // Cannot unendorse as node is in cooldown period
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNodeCooldownActive",
      )
    })

    it("If cooldown period is updated all nodes that are in the cooldown period endtimes change accordingly", async function () {
      const config = createLocalConfig()
      config.X2EARN_NODE_COOLDOWN_PERIOD = 3
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const nodeId = await createNodeHolder(7, owner)

      // Round 1
      await startNewAllocationRound()
      await waitForCurrentRoundToEnd()

      // Round 2
      await startNewAllocationRound()
      await waitForCurrentRoundToEnd()

      // Round 3
      await startNewAllocationRound()
      await waitForCurrentRoundToEnd()

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await x2EarnApps.connect(owner).endorseApp(app1Id, nodeId)

      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(true)

      // Contract admin updates the cooldown period
      await x2EarnApps.updateCooldownPeriod(0)

      // Node should no longer be in cooldown period
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(false)
    })

    it("Cooldown period should end when a new round starts regardless of when app was last enedorsed", async function () {
      const config = createLocalConfig()
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const nodeId = await createNodeHolder(7, owner)

      // Round 1
      await startNewAllocationRound()
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await x2EarnApps.connect(owner).endorseApp(app1Id, nodeId)

      // Should be in cooldown period
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(true)

      // Start new round
      await waitForCurrentRoundToEnd()
      await startNewAllocationRound()

      // Node should no longer be in cooldown period
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(false)

      // Update cooldown period to 2 rounds
      await x2EarnApps.updateCooldownPeriod(2)

      // Node should no longer be in cooldown period
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(true)

      // Node should no longer be in cooldown period in the next round
      await waitForCurrentRoundToEnd()
      await startNewAllocationRound()

      // Node should no longer be in cooldown period
      expect(await x2EarnApps.checkCooldown(nodeId)).to.eql(false)
    })

    it("Only admin can update cooldown period", async function () {
      const config = createLocalConfig()
      config.X2EARN_NODE_COOLDOWN_PERIOD = 24
      const { x2EarnApps, owner, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(x2EarnApps.connect(otherAccounts[1]).updateCooldownPeriod(0)).to.be.reverted
    })

    it("Node owner with 0 endorsement points cannot endorse an app", async function () {
      const { x2EarnApps, otherAccounts, owner, stargateMock, stargateNftMock } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // Create node holder with level 0 (0 endorsement score)
      const nodeId = await createNodeHolder(9, otherAccounts[1]) // Node strength level 9 corresponds to an endorsement score of 0

      // Verify the node holder has 0 endorsement score
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[1].address)).to.eql(0n)

      // Should revert when trying to endorse with 0 endorsement points
      await expect(x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, nodeId)).to.be.revertedWithCustomError(
        x2EarnApps,
        "NodeNotAllowedToEndorse",
      )

      // App should still be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // App should not be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(false)
    })
  })
})
