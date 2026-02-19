import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { expect } from "chai"
import { ethers } from "hardhat"
import { before, describe, it } from "mocha"

import { deployAndUpgrade } from "../scripts/helpers"
import { X2EarnAppsV3 } from "../typechain-types"
import {
  bootstrapAndStartEmissions,
  bootstrapEmissions,
  catchRevert,
  createProposalAndExecuteIt,
  filterEventsByName,
  getOrDeployContractInstances,
  getVot3Tokens,
  parseAppAddedEvent,
  startNewAllocationRound,
  waitForCurrentRoundToEnd,
  waitForRoundToEnd,
  ZERO_ADDRESS,
} from "./helpers"
import { endorseApp } from "./helpers/xnodes"

describe("X-Apps - Core Features - @shard15a", function () {
  // We prepare the environment for 4 creators
  let creator1: HardhatEthersSigner
  let creator2: HardhatEthersSigner
  let creator3: HardhatEthersSigner
  let creator4: HardhatEthersSigner

  before(async function () {
    const { creators } = await getOrDeployContractInstances({ forceDeploy: true })
    creator1 = creators[0]
    creator2 = creators[1]
    creator3 = creators[2]
    creator4 = creators[3]
  })

  describe("Deployment", function () {
    it("Clock mode is set correctly", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })
      expect(await x2EarnApps.CLOCK_MODE()).to.eql("mode=blocknumber&from=default")
    })

    it("Node level to endorsement score mapping is correct", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })
      expect(await x2EarnApps.nodeLevelEndorsementScore(0)).to.eql(0n)
      expect(await x2EarnApps.nodeLevelEndorsementScore(1)).to.eql(2n)
      expect(await x2EarnApps.nodeLevelEndorsementScore(2)).to.eql(13n)
      expect(await x2EarnApps.nodeLevelEndorsementScore(3)).to.eql(50n)
      expect(await x2EarnApps.nodeLevelEndorsementScore(4)).to.eql(3n)
      expect(await x2EarnApps.nodeLevelEndorsementScore(5)).to.eql(9n)
      expect(await x2EarnApps.nodeLevelEndorsementScore(6)).to.eql(35n)
      expect(await x2EarnApps.nodeLevelEndorsementScore(7)).to.eql(100n)
    })

    it("Version returns a string", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })
      const version = await x2EarnApps.version()
      expect(typeof version).to.eql("string")
      expect(version.length).to.be.greaterThan(0)
    })

    it("Cooldown period is set correctly", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })
      const config = createLocalConfig()
      expect(await x2EarnApps.cooldownPeriod()).to.eql(BigInt(config.X2EARN_NODE_COOLDOWN_PERIOD))
    })

    it("hashAppName returns a bytes32 hash", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })
      const hash = await x2EarnApps.hashAppName("TestApp")
      expect(hash).to.match(/^0x[a-fA-F0-9]{64}$/)
      // Verify deterministic hashing
      const hash2 = await x2EarnApps.hashAppName("TestApp")
      expect(hash).to.eql(hash2)
      // Different input produces different hash
      const hash3 = await x2EarnApps.hashAppName("DifferentApp")
      expect(hash).to.not.eql(hash3)
    })
  })

  describe("Settings", function () {
    it("Admin can set baseURI for apps", async function () {
      const { owner, x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })

      const initialURI = await x2EarnApps.baseURI()

      await x2EarnApps.connect(owner).setBaseURI("ipfs2://")

      const updatedURI = await x2EarnApps.baseURI()
      expect(updatedURI).to.eql("ipfs2://")
      expect(updatedURI).to.not.eql(initialURI)
    })

    it("Limit of 100 moderators and distributors is set", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await x2EarnApps.MAX_MODERATORS()).to.eql(100n)
      expect(await x2EarnApps.MAX_REWARD_DISTRIBUTORS()).to.eql(100n)
    })
  })

  describe("Add apps", function () {
    it("Should be able to register an app successfully", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      let tx = await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      let receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      let appAdded = filterEventsByName(receipt.logs, "AppAdded")
      expect(appAdded).not.to.eql([])

      let { id, address } = await parseAppAddedEvent(appAdded[0])
      expect(id).to.eql(app1Id)
      expect(address).to.eql(otherAccounts[0].address)
    })

    it("Should not be able to register an app if it is already registered", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await catchRevert(
        x2EarnApps
          .connect(owner)
          .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI"),
      )
    })

    it("Should be able to fetch app team wallet address", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

      const app1ReceiverAddress = await x2EarnApps.teamWalletAddress(app1Id)
      const app2ReceiverAddress = await x2EarnApps.teamWalletAddress(app2Id)
      expect(app1ReceiverAddress).to.eql(otherAccounts[2].address)
      expect(app2ReceiverAddress).to.eql(otherAccounts[3].address)
    })

    it("Cannot register an app that has ZERO address as the team wallet address", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(
        x2EarnApps.connect(owner).submitApp(ZERO_ADDRESS, otherAccounts[2].address, "My app", "metadataURI"),
      )
    })

    it("Cannot register an app that has ZERO address as the admin", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(
        x2EarnApps.connect(owner).submitApp(otherAccounts[2].address, ZERO_ADDRESS, "My app", "metadataURI"),
      )
    })

    it("Only users with the XAPP creator nft can register an app", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(
        x2EarnApps
          .connect(otherAccounts[11])
          .submitApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI"),
      ).to.be.revertedWithCustomError(x2EarnApps, "X2EarnUnverifiedCreator")

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
    })

    it("Should enable rewards pool for new app when registering an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.enableRewardsPoolForNewApp(app1Id)).to.be.revertedWith(
        "X2EarnRewardsPool: rewards pool already enabled",
      )
    })

    it("Rewards pool should be enabled for new apps and disabled for older apps", async function () {
      const {
        x2EarnApps,
        otherAccounts,
        owner,
        x2EarnRewardsPool,
        timeLock,
        nodeManagement,
        veBetterPassport,
        x2EarnCreator,
        administrationUtilsV2,
        endorsementUtilsV2,
        voteEligibilityUtilsV2,
        administrationUtilsV3,
        endorsementUtilsV3,
        voteEligibilityUtilsV3,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 24
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1

      const xAllocationGovernor = otherAccounts[1].address
      const veBetterPassportContractAddress = await veBetterPassport.getAddress()

      const x2EarnAppsV3 = (await deployAndUpgrade(
        ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnAppsV3"],
        [
          ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
          [
            config.XAPP_GRACE_PERIOD,
            await nodeManagement.getAddress(),
            veBetterPassportContractAddress,
            await x2EarnCreator.getAddress(),
          ],
          [config.X2EARN_NODE_COOLDOWN_PERIOD, xAllocationGovernor],
        ],
        {
          versions: [undefined, 2, 3],
          libraries: [
            undefined,
            {
              AdministrationUtilsV2: await administrationUtilsV2.getAddress(),
              EndorsementUtilsV2: await endorsementUtilsV2.getAddress(),
              VoteEligibilityUtilsV2: await voteEligibilityUtilsV2.getAddress(),
            },
            {
              AdministrationUtilsV3: await administrationUtilsV3.getAddress(),
              EndorsementUtilsV3: await endorsementUtilsV3.getAddress(),
              VoteEligibilityUtilsV3: await voteEligibilityUtilsV3.getAddress(),
            },
          ],
        },
      )) as X2EarnAppsV3

      // The app was prev deployed with version 3 of x2earn app
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnAppsV3
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, "My app #2", "metadataURI")
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))

      // check that the rewards pool is not enabled by default for the older app
      expect(await x2EarnRewardsPool.isRewardsPoolEnabled(app1Id)).to.be.equal(false)
      // check that the rewards pool is enabled by default for the new app
      expect(await x2EarnRewardsPool.isRewardsPoolEnabled(app2Id)).to.be.equal(true)
    })
  })

  describe("Fetch apps", function () {
    it("Can get unendorsed app ids", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await x2EarnApps.unendorsedAppIds()
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, "My app #2", "metadataURI")
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))

      // unendorsed apps
      const appIds = await x2EarnApps.unendorsedAppIds()
      expect(appIds).to.eql([app1Id, app2Id])
    })

    it("Can retrieve app by id", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const app = await x2EarnApps.app(app1Id)
      expect(app.id).to.eql(app1Id)
      expect(app.teamWalletAddress).to.eql(otherAccounts[0].address)
      expect(app.name).to.eql("My app")
      expect(app.metadataURI).to.eql("metadataURI")
    })

    it("Can index endorsed apps", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(app1Id, otherAccounts[0])

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, "My app #2", "metadataURI")

      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
      await endorseApp(app2Id, otherAccounts[1])

      const apps = await x2EarnApps.apps()
      expect(apps.length).to.eql(2)
    })

    it("Can index unendorsed apps", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, "My app #2", "metadataURI")

      const apps = await x2EarnApps.unendorsedApps()
      expect(apps.length).to.eql(2)
    })

    it("Can get number of apps", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(app1Id, otherAccounts[0])

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, "My app #2", "metadataURI")
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
      await endorseApp(app2Id, otherAccounts[1])

      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, "My app #3", "metadataURI")
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))
      await endorseApp(app3Id, otherAccounts[2])

      await x2EarnApps
        .connect(creator3)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, "My app #4", "metadataURI")
      const app4Id = ethers.keccak256(ethers.toUtf8Bytes("My app #4"))
      await endorseApp(app4Id, otherAccounts[3])

      const apps = await x2EarnApps.apps()
      expect(apps.length).to.eql(4)
    })

    it("Can fetch up to 1000 apps without pagination", async function () {
      console.log("Test disabled")

      // const { x2EarnApps, otherAccounts, owner, xAllocationVoting } = await getOrDeployContractInstances({
      //   forceDeploy: true,
      // })

      // const limit = 1000

      // let registerAppsPromises = []
      // for (let i = 1; i <= limit; i++) {
      //   registerAppsPromises.push(
      //     x2EarnApps
      //       .connect(owner)
      //       .submitApp(otherAccounts[1].address, otherAccounts[1].address, "My app" + i, "metadataURI"),
      //   )
      //   const appId = ethers.keccak256(ethers.toUtf8Bytes("My app" + i))
      //   await endorseApp(appId, otherAccounts[i])
      // }

      // await Promise.all(registerAppsPromises)

      // const apps = await x2EarnApps.apps()
      // expect(apps.length).to.eql(limit)

      // // check that can correctly fetch apps in round
      // await startNewAllocationRound()
      // const appsInRound = await xAllocationVoting.getAppsOfRound(1)
      // expect(appsInRound.length).to.eql(limit)
    })
  })

  describe("App availability for allocation voting", function () {
    it("Should be possible to endorse an app and make it available for allocation voting", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[0])

      let roundId = await startNewAllocationRound()

      const isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, roundId)
      expect(isEligibleForVote).to.eql(true)
    })

    it("Admin can make an app unavailable for allocation voting starting from next round", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      await endorseApp(app1Id, otherAccounts[0])

      let round1 = await startNewAllocationRound()

      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      // app should still be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      let appsVotedInSpecificRound = await xAllocationVoting.getAppIdsOfRound(round1)
      expect(appsVotedInSpecificRound.length).to.equal(1n)

      await waitForRoundToEnd(round1)
      let round2 = await startNewAllocationRound()

      // app should not be eligible from this round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(false)

      appsVotedInSpecificRound = await xAllocationVoting.getAppIdsOfRound(round2)
      expect(appsVotedInSpecificRound.length).to.equal(0)

      // if checking for the previous round, it should still be eligible
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)
    })

    it("Admin with governance role can make an unavailable app available again starting from next round", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), owner.address)).to.eql(true)

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      await endorseApp(app1Id, otherAccounts[0])

      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(false)

      let round1 = await startNewAllocationRound()

      // app should still be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(false)

      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, true)
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)
      expect(await x2EarnApps.isEligible(app1Id, await xAllocationVoting.roundSnapshot(round1))).to.eql(false)

      // app still should not be eligible from this round
      expect(await xAllocationVoting.isEligibleForVote(app1Id, round1)).to.eql(false)

      await waitForRoundToEnd(round1)

      let round2 = await startNewAllocationRound()

      // app should be eligible from this round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(true)
    })

    it("Non existing app is not eligible", async function () {
      const { xAllocationVoting, x2EarnApps, owner, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const appId = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      expect(await x2EarnApps.isEligibleNow(appId)).to.eql(false)
      expect(await x2EarnApps.isEligible(appId, (await xAllocationVoting.clock()) - 1n)).to.eql(false)
    })

    it("Non endorsed app is not eligible", async function () {
      const { xAllocationVoting, x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })

      const app1Id = await x2EarnApps.hashAppName(ZERO_ADDRESS)

      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(false)
      expect(await x2EarnApps.isEligible(app1Id, (await xAllocationVoting.clock()) - 1n)).to.eql(false)
    })

    it("Cannot get eligilibity in the future", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[0])

      await expect(x2EarnApps.isEligible(app1Id, (await xAllocationVoting.clock()) + 1n)).to.be.reverted
    })

    it("DAO can make an app unavailable for allocation voting starting from next round", async function () {
      const {
        otherAccounts,
        x2EarnApps,
        xAllocationVoting,
        emissions,
        timeLock,
        owner,
        endorsementUtils,
        administrationUtils,
        voteEligibilityUtils,
        appStorageUtils,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await bootstrapAndStartEmissions()

      const app1Id = await x2EarnApps.hashAppName("Bike 4 Life")
      const proposer = otherAccounts[0]
      const voter1 = otherAccounts[1]

      // check that app does not exists
      await expect(x2EarnApps.app(app1Id)).to.be.reverted

      // granting role to the timelock
      await x2EarnApps.grantRole(await x2EarnApps.GOVERNANCE_ROLE(), await timeLock.getAddress())

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "Bike 4 Life", "metadataURI")
      await endorseApp(app1Id, otherAccounts[0])

      await waitForCurrentRoundToEnd()

      // start new round
      await emissions.distribute()
      let round1 = await xAllocationVoting.currentRoundId()
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      await waitForCurrentRoundToEnd()

      await createProposalAndExecuteIt(
        proposer,
        voter1,
        x2EarnApps,
        await ethers.getContractFactory("X2EarnApps", {
          libraries: {
            AdministrationUtils: await administrationUtils.getAddress(),
            EndorsementUtils: await endorsementUtils.getAddress(),
            VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
            AppStorageUtils: await appStorageUtils.getAddress(),
          },
        }),
        "Exclude app from the allocation voting rounds",
        "setVotingEligibility",
        [app1Id, false],
      )

      // app should still be eligible for the current round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      await waitForCurrentRoundToEnd()

      await emissions.distribute()
      let round2 = await xAllocationVoting.currentRoundId()

      // app should not be eligible from this round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(false)
    })

    it("Non-admin address cannot make an app available or unavailable for allocation voting", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: false })

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      expect(await x2EarnApps.hasRole(await x2EarnApps.GOVERNANCE_ROLE(), otherAccounts[0].address)).to.eql(false)

      await catchRevert(x2EarnApps.connect(otherAccounts[0]).setVotingEligibility(app1Id, true))
    })

    it("App needs to wait next round if added during an ongoing round", async function () {
      const { otherAccounts, x2EarnApps, owner, xAllocationVoting, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      const voter = otherAccounts[0]
      await getVot3Tokens(voter, "30000")

      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      let round1 = await startNewAllocationRound()

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.toggleCheck(1)

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await endorseApp(app1Id, otherAccounts[0])
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(false)

      //check that I cannot vote for this app in current round
      await catchRevert(xAllocationVoting.connect(voter).castVote(round1, [app1Id], [ethers.parseEther("1")]))

      let appVotes = await xAllocationVoting.getAppVotes(round1, app1Id)
      expect(appVotes).to.equal(0n)

      let appsVotedInSpecificRound = await xAllocationVoting.getAppIdsOfRound(round1)
      expect(appsVotedInSpecificRound.length).to.equal(0)

      await waitForRoundToEnd(round1)
      let round2 = await startNewAllocationRound()

      // app should be eligible from this round
      isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round2)
      expect(isEligibleForVote).to.eql(true)

      // check that I can vote for this app
      expect(await xAllocationVoting.connect(voter).castVote(round2, [app1Id], [ethers.parseEther("1")])).to.not.be
        .reverted

      appVotes = await xAllocationVoting.getAppVotes(round2, app1Id)
      expect(appVotes).to.equal(ethers.parseEther("1"))
    })

    it("Cannot set Eligibility for non existing app", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await catchRevert(x2EarnApps.setVotingEligibility(app1Id, true))
    })
  })

  describe("Creator NFT", function () {
    it("Users with the XAPP creator nft can register an app sucesfully", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps.connect(creator1).submitApp(creator2.address, creator2.address, creator2.address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(creator2.address))

      // App should be registered successfully
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // User should be listed as one of the apps creators
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([creator1.address])
    })

    it("App admin can't add more than 3 creator for the app", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps.connect(creator1).submitApp(creator2.address, creator2.address, creator2.address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(creator2.address))

      // App should be registered successfully
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // User should be listed as one of the apps creators
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([creator1.address])

      // App admin can add more creators for the app
      await expect(x2EarnApps.connect(creator2).addCreator(app1Id, creator2.address)).to.emit(
        x2EarnApps,
        "CreatorAddedToApp",
      )
      // App admin can add more creators for the app
      await expect(x2EarnApps.connect(creator2).addCreator(app1Id, creator3.address)).to.emit(
        x2EarnApps,
        "CreatorAddedToApp",
      )
      // App admin can add more creators for the app
      await expect(x2EarnApps.connect(creator2).addCreator(app1Id, creator4.address)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnMaxCreatorsReached",
      )

      // New creator should be added to the app
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([creator1.address, creator2.address, creator3.address])
    })

    it("Added creator can't submit another app unless removed from the app as a creator", async function () {
      const { x2EarnApps, x2EarnCreator } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps.connect(creator1).submitApp(creator2.address, creator2.address, creator2.address, "metadataURI")
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(creator2.address))

      // App should be registered successfully
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // User should be listed as one of the apps creators
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([creator1.address])

      // Adding creator2 to the app
      await expect(x2EarnApps.connect(creator2).addCreator(app1Id, creator2.address)).to.emit(
        x2EarnApps,
        "CreatorAddedToApp",
      )

      expect(await x2EarnApps.isCreatorOfAnyApp(creator2.address)).to.eql(true)

      // the added creator try to submit another app
      await expect(
        x2EarnApps.connect(creator2).submitApp(creator4.address, creator4.address, creator4.address, "metadataURI2"),
      ).to.be.revertedWithCustomError(x2EarnApps, "CreatorNFTAlreadyUsed")
      // we remove the creator2 from the app, to let him submit another app
      await x2EarnApps.connect(creator2).removeAppCreator(app1Id, creator2.address)
      // creator2 should be eligible to submit another app ( go back to the process of minting a new creator NFT)
      await x2EarnCreator.safeMint(creator2.address)
      expect(await x2EarnApps.isCreatorOfAnyApp(creator2.address)).to.eql(false)
      await x2EarnApps.connect(creator2).submitApp(creator3.address, creator3.address, creator3.address, "metadataURI2")
    })

    it("An app can have MAX 3 creators", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps.connect(creator1).submitApp(creator2.address, creator2.address, creator2.address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(creator2.address))

      // App should be registered successfully
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // User should be listed as one of the apps creators
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([creator1.address])

      // Adding another creator should fail
      expect(await x2EarnApps.connect(creator2).addCreator(app1Id, creator2.address))
      expect(await x2EarnApps.connect(creator2).addCreator(app1Id, creator3.address))
      await expect(x2EarnApps.connect(creator2).addCreator(app1Id, creator4.address)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnMaxCreatorsReached",
      )
    })

    it("Same creator cannot be part of more than 1 app", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(otherAccounts[0])
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      // App should be registered successfully
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // User should be listed as one of the apps creators
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([otherAccounts[0].address])

      // App admin can add more creators for the app
      await x2EarnApps.connect(otherAccounts[2]).addCreator(app1Id, otherAccounts[1].address)

      // New creator should be added to the app
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([otherAccounts[0].address, otherAccounts[1].address])

      await x2EarnApps
        .connect(otherAccounts[2])
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI2")

      // Adding the creator of the appid2 to the appid1 should fail because he is already a creator of the appid1
      await expect(
        x2EarnApps.connect(otherAccounts[2]).addCreator(app1Id, otherAccounts[1].address),
      ).to.be.revertedWithCustomError(x2EarnApps, "X2EarnAlreadyCreator")
    })

    it("Should mint a creator NFT for a creator that gets added after registration that doesnt currently hold one", async function () {
      const { x2EarnApps, otherAccounts, x2EarnCreator } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(otherAccounts[0])
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      // Adding a new creator that doesnt hold a creator NFT
      await expect(x2EarnApps.connect(otherAccounts[2]).addCreator(app1Id, otherAccounts[10].address)).to.emit(
        x2EarnCreator,
        "Transfer",
      )

      // New creator should be added to the app
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([otherAccounts[0].address, otherAccounts[10].address])

      // New creator should have a creator NFT minted for them
      expect(await x2EarnCreator.balanceOf(otherAccounts[10].address)).to.eql(1n)

      // Adding a new creator(otherAccounts[2]) that already holds a creator NFT should not mint a new one

      const balanceBefore = await x2EarnCreator.balanceOf(otherAccounts[2].address)

      // Adding the user with a creator NFT
      await expect(x2EarnApps.connect(otherAccounts[2]).addCreator(app1Id, otherAccounts[2].address)).to.not.emit(
        x2EarnCreator,
        "Transfer",
      )

      // Balance of the user should remain the same
      expect(await x2EarnCreator.balanceOf(otherAccounts[2].address)).to.eql(balanceBefore)
    })

    it("Should burn a creator NFT for a creator that gets removed from an app and is not a creator for any other app", async function () {
      const { x2EarnApps, otherAccounts, x2EarnCreator } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      await x2EarnApps
        .connect(otherAccounts[0])
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      // Adding a new creator
      await x2EarnApps.connect(otherAccounts[2]).addCreator(app1Id, otherAccounts[1].address)

      // New creator should be added to the app
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([otherAccounts[0].address, otherAccounts[1].address])

      // New creator should have a creator NFT minted for them
      expect(await x2EarnCreator.balanceOf(otherAccounts[1].address)).to.eql(1n)

      // Removing the creator
      await expect(x2EarnApps.connect(otherAccounts[2]).removeAppCreator(app1Id, otherAccounts[1].address)).to.emit(
        x2EarnCreator,
        "Transfer",
      )

      // New creator should have their creator NFT burned
      expect(await x2EarnCreator.balanceOf(otherAccounts[1].address)).to.eql(0n)
    })

    it("A creator should be part of only one app", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(otherAccounts[0])
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      // try to submit another app with the same creator will fail
      await expect(
        x2EarnApps
          .connect(otherAccounts[0])
          .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI"),
      ).to.be.revertedWithCustomError(x2EarnApps, "CreatorNFTAlreadyUsed")
    })

    it("Should not be able to remove a creator that is not part of the app", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(otherAccounts[0])
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      // Removing a creator that is not part of the app should fail
      await expect(
        x2EarnApps.connect(otherAccounts[2]).removeAppCreator(app1Id, otherAccounts[3].address),
      ).to.be.revertedWithCustomError(x2EarnApps, "X2EarnNonexistentCreator")
    })

    it("Should not be able to add a creator to an app that does not exist", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      // Adding a creator to an app that does not exist should fail
      await expect(x2EarnApps.addCreator(app1Id, otherAccounts[1].address)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonexistentApp",
      )
    })

    it("Should not be able to remove a creator from an app that does not exist", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      // Removing a creator from an app that does not exist should fail
      await expect(x2EarnApps.removeAppCreator(app1Id, otherAccounts[1].address)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonexistentApp",
      )
    })

    it("Should revoke all creator rights if their XApp is blacklisted", async function () {
      const { x2EarnApps, otherAccounts, x2EarnCreator } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Other Accounts 0 creates 1 apps -> Creator of the app1
      await x2EarnApps
        .connect(otherAccounts[0])
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      // decide to change the creator of the app for another creator addressse
      await x2EarnApps.connect(otherAccounts[2]).removeAppCreator(app1Id, otherAccounts[0].address)
      await x2EarnApps.connect(otherAccounts[2]).addCreator(app1Id, otherAccounts[1].address)

      // It gets endorsed
      await endorseApp(app1Id, otherAccounts[2])

      // creator should have a creator NFT minted for them
      expect(await x2EarnCreator.balanceOf(otherAccounts[1].address)).to.eql(1n)

      // Blacklisting the first app
      await x2EarnApps.setVotingEligibility(app1Id, false) // Blacklist the app

      // creator should have their creator NFT burned
      expect(await x2EarnCreator.balanceOf(otherAccounts[1].address)).to.eql(0n)

      // Should still be considered creators of the app for info purposes
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([otherAccounts[1].address])
    })

    it("Should regrant creator rights if their XApp is unblacklisted", async function () {
      const { x2EarnApps, otherAccounts, x2EarnCreator } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Other Accounts 0 creates 1 apps -> Creator of the app1
      await x2EarnApps
        .connect(otherAccounts[0])
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      // decide to change the creator of the app for another creator addressse
      await x2EarnApps.connect(otherAccounts[2]).removeAppCreator(app1Id, otherAccounts[0].address)
      // default creator should have their creator NFT burned
      expect(await x2EarnCreator.balanceOf(otherAccounts[0].address)).to.eql(0n)

      await x2EarnApps.connect(otherAccounts[2]).addCreator(app1Id, otherAccounts[1].address)

      // Both apps get endorsed
      await endorseApp(app1Id, otherAccounts[2])

      // Each account should have a creator NFT minted for them
      expect(await x2EarnCreator.balanceOf(otherAccounts[1].address)).to.eql(1n)

      // Blacklisting the first app
      await x2EarnApps.setVotingEligibility(app1Id, false) // Blacklist the app

      // creator should have their creator NFT burned
      expect(await x2EarnCreator.balanceOf(otherAccounts[1].address)).to.eql(0n)

      // Should all still be considered creators of the app for info purposes
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([otherAccounts[1].address])

      // Unblacklisting the first app
      await x2EarnApps.setVotingEligibility(app1Id, true) // Unblacklist the app

      // creator should have their creator NFT minted
      expect(await x2EarnCreator.balanceOf(otherAccounts[1].address)).to.eql(1n)
    })

    it("XApps user endorsed should not go into negative if blacklisted multiple times", async function () {
      const { x2EarnApps, otherAccounts, x2EarnCreator } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Other Accounts 0 creates 1 apps -> Creator of the app1
      await x2EarnApps
        .connect(otherAccounts[0])
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      // app get endorsed
      await endorseApp(app1Id, otherAccounts[2])

      // Creator should have their NFT minted
      expect(await x2EarnCreator.balanceOf(otherAccounts[0].address)).to.eql(1n)

      // Blacklisting the first app
      await x2EarnApps.setVotingEligibility(app1Id, false) // Blacklist the app

      // Creator should have their creator NFT burned
      expect(await x2EarnCreator.balanceOf(otherAccounts[0].address)).to.eql(0n)

      // Creator should be creators of 0 apps
      expect(await x2EarnApps.creatorApps(otherAccounts[0].address)).to.eql(0n)

      // Blacklisting the first app again
      await x2EarnApps.setVotingEligibility(app1Id, false) // Blacklist the app

      // Creator should not have their creator NFT burned again as they are already burned
      expect(await x2EarnCreator.balanceOf(otherAccounts[0].address)).to.eql(0n)

      // Creator should be creators of 0 apps
      expect(await x2EarnApps.creatorApps(otherAccounts[0].address)).to.eql(0n)
    })

    it("XApps user endorsed should not keep increasing if de-blacklisted multiple times", async function () {
      const { x2EarnApps, x2EarnCreator } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Other Accounts 0 creates 1 apps -> Creator of the app1
      await x2EarnApps.connect(creator1).submitApp(creator2.address, creator2.address, creator2.address, "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(creator2.address))

      // App get endorsed
      await endorseApp(app1Id, creator2)

      // Creator = account 0 should have their creator NFT minted
      expect(await x2EarnCreator.balanceOf(creator1.address)).to.eql(1n)

      // De- Blacklisting the first app (It is not blacklisted)
      await x2EarnApps.setVotingEligibility(app1Id, true)

      // Creator should not have their creator NFT burned
      expect(await x2EarnCreator.balanceOf(creator1.address)).to.eql(1n)

      // Creator should be creators of 1 app
      expect(await x2EarnApps.creatorApps(creator1.address)).to.eql(1n)

      // De- Blacklisting the first app (It is not blacklisted)
      await x2EarnApps.setVotingEligibility(app1Id, false) // Blacklist the app

      // Should all still be considered creators of the app for info purposes
      expect(await x2EarnApps.appCreators(app1Id)).to.deep.equal([creator1.address])

      // Creator should be creators of 0 apps
      expect(await x2EarnApps.creatorApps(creator1.address)).to.eql(0n)

      // Creator should have their creator NFT burned again
      expect(await x2EarnCreator.balanceOf(creator1.address)).to.eql(0n)

      // Blacklisting the first app again (should not decrease the creator NFT)
      await x2EarnApps.setVotingEligibility(app1Id, false) // Blacklist the app again

      // Creator should be creators of 0 apps ==> De-blacklisting multiple times should not decrease the creator NFT
      expect(await x2EarnApps.creatorApps(creator1.address)).to.eql(0n)
    })
  })
})
