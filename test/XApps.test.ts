import { ethers, network } from "hardhat"
import { expect } from "chai"
import {
  ZERO_ADDRESS,
  bootstrapAndStartEmissions,
  bootstrapEmissions,
  catchRevert,
  createProposalAndExecuteIt,
  filterEventsByName,
  getOrDeployContractInstances,
  getStorageSlots,
  getTwoUniqueRandomIndices,
  getVot3Tokens,
  parseAppAddedEvent,
  startNewAllocationRound,
  waitForBlock,
  waitForCurrentRoundToEnd,
  waitForRoundToEnd,
} from "./helpers"
import { describe, it, beforeEach } from "mocha"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { createLocalConfig } from "../config/contracts/envs/local"
import { createNodeHolder, endorseApp } from "./helpers/xnodes"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { deployAndUpgrade, deployProxy, deployProxyOnly, initializeProxy, upgradeProxy } from "../scripts/helpers"
import {
  B3TRGovernor,
  Emissions,
  GalaxyMember,
  VeBetterPassport,
  VeBetterPassportV1,
  VoterRewards,
  X2EarnApps,
  X2EarnAppsV1,
  X2EarnAppsV2,
  X2EarnAppsV3,
  X2EarnAppsV4,
  X2EarnApps__factory,
  X2EarnRewardsPool,
  X2EarnRewardsPoolV4,
  XAllocationPool,
  XAllocationPoolV3,
  XAllocationVotingV3,
} from "../typechain-types"
import { SeedAccount, getTestKeys } from "../scripts/helpers/seedAccounts"
import { buildTxBody, signAndSendTx } from "../scripts/helpers/txHelper"
import { APPS } from "../scripts/deploy/setup"
import { clauseBuilder, unitsUtils, type TransactionBody, coder, FunctionFragment } from "@vechain/sdk-core"
import { airdropVTHO } from "../scripts/helpers/airdrop"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("X-Apps - @shard15", function () {
  // We prepare the environment for 4 creators
  let creator1: HardhatEthersSigner
  let creator2: HardhatEthersSigner
  let creator3: HardhatEthersSigner
  let creator4: HardhatEthersSigner

  beforeEach(async function () {
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
  })

  describe("Contract upgradeablity", () => {
    it("v5 initializer is empty", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      await x2EarnApps.initializeV5()
    })

    it("User with UPGRADER_ROLE should be able to upgrade the contract", async function () {
      const { x2EarnApps, owner, administrationUtils, endorsementUtils, voteEligibilityUtils } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("X2EarnApps", {
        libraries: {
          AdministrationUtils: await administrationUtils.getAddress(),
          EndorsementUtils: await endorsementUtils.getAddress(),
          VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        },
      })

      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await x2EarnApps.getAddress())

      const UPGRADER_ROLE = await x2EarnApps.UPGRADER_ROLE()
      expect(await x2EarnApps.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(x2EarnApps.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await x2EarnApps.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only user with UPGRADER_ROLE should be able to upgrade the contract", async function () {
      const { x2EarnApps, otherAccount, administrationUtils, endorsementUtils, voteEligibilityUtils } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("X2EarnApps", {
        libraries: {
          AdministrationUtils: await administrationUtils.getAddress(),
          EndorsementUtils: await endorsementUtils.getAddress(),
          VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        },
      })
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await x2EarnApps.getAddress())

      const UPGRADER_ROLE = await x2EarnApps.UPGRADER_ROLE()
      expect(await x2EarnApps.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(x2EarnApps.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await x2EarnApps.getAddress())

      expect(newImplAddress.toUpperCase()).to.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.not.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Should return correct version of the contract", async () => {
      const { x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.version()).to.equal("5")
    })

    it("X2Earn Apps Info added pre contract upgrade should should be same after upgrade", async () => {
      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 24
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1
      const {
        timeLock,
        owner,
        otherAccounts,
        vechainNodesMock,
        veBetterPassport,
        administrationUtils,
        endorsementUtils,
        voteEligibilityUtils,
        x2EarnRewardsPool,
        x2EarnCreator,
        administrationUtilsV2,
        endorsementUtilsV2,
        voteEligibilityUtilsV2,
        administrationUtilsV3,
        endorsementUtilsV3,
        voteEligibilityUtilsV3,
        xAllocationVoting,
        administrationUtilsV4,
        endorsementUtilsV4,
        voteEligibilityUtilsV4,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy X2EarnApps
      const x2EarnAppsV1 = (await deployProxy("X2EarnAppsV1", [
        "ipfs://",
        [await timeLock.getAddress(), owner.address],
        owner.address,
        owner.address,
      ])) as X2EarnAppsV1

      // Add app 1
      await x2EarnAppsV1
        .connect(owner)
        .addApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
      // Add app 2
      await x2EarnAppsV1
        .connect(owner)
        .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

      // start round using V1 contract
      await startNewAllocationRound()

      // Add app 3 during first round
      await x2EarnAppsV1
        .connect(owner)
        .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #3", "metadataURI")

      const appsV1 = await x2EarnAppsV1.apps()

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // Upgrade X2EarnAppsV1 to X2EarnApps
      const x2EarnAppsV2 = (await upgradeProxy(
        "X2EarnAppsV1",
        "X2EarnAppsV2",
        await x2EarnAppsV1.getAddress(),
        [
          config.XAPP_GRACE_PERIOD,
          await vechainNodesMock.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        {
          version: 2,
          libraries: {
            AdministrationUtilsV2: await administrationUtilsV2.getAddress(),
            EndorsementUtilsV2: await endorsementUtilsV2.getAddress(),
            VoteEligibilityUtilsV2: await voteEligibilityUtilsV2.getAddress(),
          },
        },
      )) as X2EarnAppsV2

      // start new round
      await startNewAllocationRound()

      const appsV2 = await x2EarnAppsV2.apps()

      expect(appsV1).to.eql(appsV2)

      // Upgrade X2EarnAppsV2 to X2EarnApps
      const x2EarnAppsV3 = (await upgradeProxy(
        "X2EarnAppsV2",
        "X2EarnAppsV3",
        await x2EarnAppsV2.getAddress(),
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await xAllocationVoting.getAddress()],
        {
          version: 3,
          libraries: {
            AdministrationUtilsV3: await administrationUtilsV3.getAddress(),
            EndorsementUtilsV3: await endorsementUtilsV3.getAddress(),
            VoteEligibilityUtilsV3: await voteEligibilityUtilsV3.getAddress(),
          },
        },
      )) as X2EarnAppsV3

      // start new round
      await startNewAllocationRound()

      const appsV3 = await x2EarnAppsV3.apps()
      expect(appsV2).to.eql(appsV3)

      const cooldownPeriod = await x2EarnAppsV3.cooldownPeriod()
      expect(cooldownPeriod).to.eql(1n)

      // Upgrade X2EarnAppsV2 to X2EarnApps
      const x2EarnAppsV4 = (await upgradeProxy(
        "X2EarnAppsV3",
        "X2EarnAppsV4",
        await x2EarnAppsV3.getAddress(),
        [await x2EarnRewardsPool.getAddress()],
        {
          version: 4,
          libraries: {
            AdministrationUtilsV4: await administrationUtilsV4.getAddress(),
            EndorsementUtilsV4: await endorsementUtilsV4.getAddress(),
            VoteEligibilityUtilsV4: await voteEligibilityUtilsV4.getAddress(),
          },
        },
      )) as X2EarnAppsV4
      // start new round
      await startNewAllocationRound()

      const appsV4 = await x2EarnAppsV4.apps()
      expect(appsV3).to.eql(appsV4)

      // Upgrade X2EarnAppsV4 to X2EarnAppsV5
      const x2EarnAppsV5 = (await upgradeProxy("X2EarnAppsV4", "X2EarnApps", await x2EarnAppsV4.getAddress(), [], {
        version: 5,
        libraries: {
          AdministrationUtils: await administrationUtils.getAddress(),
          EndorsementUtils: await endorsementUtils.getAddress(),
          VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        },
      })) as X2EarnApps
      // start new round
      await startNewAllocationRound()

      const appsV5 = await x2EarnAppsV5.apps()
      expect(appsV4).to.eql(appsV5)
    })

    it("X2Earn Apps added pre contract upgrade should need endorsement after upgrade and should be in grace period", async () => {
      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 24
      const {
        xAllocationVoting,
        x2EarnRewardsPool,
        xAllocationPool,
        timeLock,
        x2EarnCreator,
        owner,
        nodeManagement,
        otherAccounts,
        veBetterPassport,
        administrationUtilsV2,
        endorsementUtilsV2,
        voteEligibilityUtilsV2,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy X2EarnApps
      const x2EarnAppsV1 = (await deployProxy("X2EarnAppsV1", [
        "ipfs://",
        [await timeLock.getAddress(), owner.address],
        owner.address,
        owner.address,
      ])) as X2EarnAppsV1

      await x2EarnRewardsPool.setX2EarnApps(await x2EarnAppsV1.getAddress())
      await xAllocationPool.setX2EarnAppsAddress(await x2EarnAppsV1.getAddress())
      await xAllocationVoting.setX2EarnAppsAddress(await x2EarnAppsV1.getAddress())

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))

      // Create two MjolnirX node holder with an endorsement score of 100
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
      await createNodeHolder(7, otherAccounts[2]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Add apps -> should be eligble for next round
      await x2EarnAppsV1
        .connect(owner)
        .addApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
      await x2EarnAppsV1
        .connect(owner)
        .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

      // start round using V1 contract
      const round1 = await startNewAllocationRound()

      // Add app -> should be eligble for next round
      await x2EarnAppsV1
        .connect(owner)
        .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #3", "metadataURI")

      // check eligibilty
      expect(await x2EarnAppsV1.isEligibleNow(app1Id)).to.eql(true)
      expect(await x2EarnAppsV1.isEligibleNow(app2Id)).to.eql(true)
      expect(await x2EarnAppsV1.isEligibleNow(app3Id)).to.eql(true)

      expect(await xAllocationVoting.isEligibleForVote(app1Id, round1)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app2Id, round1)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app3Id, round1)).to.eql(false)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // Upgrade X2EarnAppsV1 to X2EarnApps
      const x2EarnAppsV2 = (await upgradeProxy(
        "X2EarnAppsV1",
        "X2EarnAppsV2",
        await x2EarnAppsV1.getAddress(),
        [
          config.XAPP_GRACE_PERIOD,
          await nodeManagement.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        {
          version: 2,
          libraries: {
            AdministrationUtilsV2: await administrationUtilsV2.getAddress(),
            EndorsementUtilsV2: await endorsementUtilsV2.getAddress(),
            VoteEligibilityUtilsV2: await voteEligibilityUtilsV2.getAddress(),
          },
        },
      )) as X2EarnAppsV2

      await veBetterPassport
        .connect(owner)
        .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnAppsV2.getAddress())

      // start new round
      const round2 = await startNewAllocationRound()

      // check eligibilty
      expect(await x2EarnAppsV2.isEligibleNow(app1Id)).to.eql(true)
      expect(await x2EarnAppsV2.isEligibleNow(app2Id)).to.eql(true)
      expect(await x2EarnAppsV2.isEligibleNow(app3Id)).to.eql(true)

      // All apps should be eligible now
      expect(await xAllocationVoting.isEligibleForVote(app1Id, round2)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app2Id, round2)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app3Id, round2)).to.eql(true)

      // Need to check the status of the apps so that they SC will reconise apps are unendrosed
      await x2EarnAppsV2.checkEndorsement(app1Id)
      await x2EarnAppsV2.checkEndorsement(app2Id)
      await x2EarnAppsV2.checkEndorsement(app3Id)

      // All apps should be seeking endorsement
      expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(true)
      expect(await x2EarnAppsV2.isAppUnendorsed(app2Id)).to.eql(true)
      expect(await x2EarnAppsV2.isAppUnendorsed(app3Id)).to.eql(true)

      // 2 out of the three apps get endorsed
      await x2EarnAppsV2.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100
      await x2EarnAppsV2.connect(otherAccounts[2]).endorseApp(app2Id, 2) // Node holder endorsement score is 100

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // Need to check the status of the apps so that they SC will reconise apps are unendrosed ans track grace period
      await x2EarnAppsV2.checkEndorsement(app1Id)
      await x2EarnAppsV2.checkEndorsement(app2Id)
      await x2EarnAppsV2.checkEndorsement(app3Id)

      // start new round
      const round3 = await startNewAllocationRound()

      // All apps should be eligible now
      expect(await xAllocationVoting.isEligibleForVote(app1Id, round3)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app2Id, round3)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app3Id, round3)).to.eql(true)

      // Only 1 app should be seeking endorsement
      expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(false)
      expect(await x2EarnAppsV2.isAppUnendorsed(app2Id)).to.eql(false)
      expect(await x2EarnAppsV2.isAppUnendorsed(app3Id)).to.eql(true)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // Need to check the status of the apps so that they SC will reconise apps are unendrosed and track grace period
      await x2EarnAppsV2.checkEndorsement(app1Id)
      await x2EarnAppsV2.checkEndorsement(app2Id)
      await x2EarnAppsV2.checkEndorsement(app3Id)

      // start new round -> app3Id has had two rounds unendorsed so it is no longer in grace period and not eligeble for voting
      const round4 = await startNewAllocationRound()

      // All apps should be eligible now
      expect(await xAllocationVoting.isEligibleForVote(app1Id, round4)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app2Id, round4)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app3Id, round4)).to.eql(false)

      // Only 1 app should be seeking endorsement
      expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(false)
      expect(await x2EarnAppsV2.isAppUnendorsed(app2Id)).to.eql(false)
      expect(await x2EarnAppsV2.isAppUnendorsed(app3Id)).to.eql(true)
    })

    it("Vechain nodes that starting endorsing XApps priod to upgrade or not subject to cooldown period but will be after they perform an action.", async () => {
      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 24
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1
      const {
        xAllocationVoting,
        x2EarnRewardsPool,
        xAllocationPool,
        timeLock,
        x2EarnCreator,
        owner,
        nodeManagement,
        otherAccounts,
        veBetterPassport,
        administrationUtilsV2,
        endorsementUtilsV2,
        voteEligibilityUtilsV2,
        administrationUtilsV3,
        endorsementUtilsV3,
        voteEligibilityUtilsV3,
        administrationUtilsV4,
        endorsementUtilsV4,
        voteEligibilityUtilsV4,
        administrationUtils,
        endorsementUtils,
        voteEligibilityUtils,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy X2EarnApps
      const x2EarnAppsV1 = (await deployProxy("X2EarnAppsV1", [
        "ipfs://",
        [await timeLock.getAddress(), owner.address],
        owner.address,
        owner.address,
      ])) as X2EarnAppsV1

      await x2EarnRewardsPool.setX2EarnApps(await x2EarnAppsV1.getAddress())
      await xAllocationPool.setX2EarnAppsAddress(await x2EarnAppsV1.getAddress())
      await xAllocationVoting.setX2EarnAppsAddress(await x2EarnAppsV1.getAddress())

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))

      // Create two MjolnirX node holder with an endorsement score of 100
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
      await createNodeHolder(7, otherAccounts[2]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Add apps -> should be eligble for next round
      await x2EarnAppsV1
        .connect(owner)
        .addApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
      await x2EarnAppsV1
        .connect(owner)
        .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

      // start round using V1 contract
      const round1 = await startNewAllocationRound()

      // Add app -> should be eligble for next round
      await x2EarnAppsV1
        .connect(owner)
        .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #3", "metadataURI")

      // check eligibilty
      expect(await x2EarnAppsV1.isEligibleNow(app1Id)).to.eql(true)
      expect(await x2EarnAppsV1.isEligibleNow(app2Id)).to.eql(true)
      expect(await x2EarnAppsV1.isEligibleNow(app3Id)).to.eql(true)

      expect(await xAllocationVoting.isEligibleForVote(app1Id, round1)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app2Id, round1)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app3Id, round1)).to.eql(false)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // Upgrade X2EarnAppsV1 to X2EarnApps
      const x2EarnAppsV2 = (await upgradeProxy(
        "X2EarnAppsV1",
        "X2EarnAppsV2",
        await x2EarnAppsV1.getAddress(),
        [
          config.XAPP_GRACE_PERIOD,
          await nodeManagement.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        {
          version: 2,
          libraries: {
            AdministrationUtilsV2: await administrationUtilsV2.getAddress(),
            EndorsementUtilsV2: await endorsementUtilsV2.getAddress(),
            VoteEligibilityUtilsV2: await voteEligibilityUtilsV2.getAddress(),
          },
        },
      )) as X2EarnAppsV2

      await veBetterPassport
        .connect(owner)
        .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnAppsV2.getAddress())

      // start new round
      const round2 = await startNewAllocationRound()

      // check eligibilty
      expect(await x2EarnAppsV2.isEligibleNow(app1Id)).to.eql(true)
      expect(await x2EarnAppsV2.isEligibleNow(app2Id)).to.eql(true)
      expect(await x2EarnAppsV2.isEligibleNow(app3Id)).to.eql(true)

      // All apps should be eligible now
      expect(await xAllocationVoting.isEligibleForVote(app1Id, round2)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app2Id, round2)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app3Id, round2)).to.eql(true)

      // Need to check the status of the apps so that they SC will reconise apps are unendrosed
      await x2EarnAppsV2.checkEndorsement(app1Id)
      await x2EarnAppsV2.checkEndorsement(app2Id)
      await x2EarnAppsV2.checkEndorsement(app3Id)

      // All apps should be seeking endorsement
      expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(true)
      expect(await x2EarnAppsV2.isAppUnendorsed(app2Id)).to.eql(true)
      expect(await x2EarnAppsV2.isAppUnendorsed(app3Id)).to.eql(true)

      // 2 out of the three apps get endorsed
      await x2EarnAppsV2.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100
      await x2EarnAppsV2.connect(otherAccounts[2]).endorseApp(app2Id, 2) // Node holder endorsement score is 100

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // Need to check the status of the apps so that they SC will reconise apps are unendrosed ans track grace period
      await x2EarnAppsV2.checkEndorsement(app1Id)
      await x2EarnAppsV2.checkEndorsement(app2Id)
      await x2EarnAppsV2.checkEndorsement(app3Id)

      // start new round
      const round3 = await startNewAllocationRound()

      // All apps should be eligible now
      expect(await xAllocationVoting.isEligibleForVote(app1Id, round3)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app2Id, round3)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app3Id, round3)).to.eql(true)

      // Only 1 app should be seeking endorsement
      expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(false)
      expect(await x2EarnAppsV2.isAppUnendorsed(app2Id)).to.eql(false)
      expect(await x2EarnAppsV2.isAppUnendorsed(app3Id)).to.eql(true)

      // wait for round to end
      await waitForCurrentRoundToEnd()

      // Need to check the status of the apps so that they SC will reconise apps are unendrosed and track grace period
      await x2EarnAppsV2.checkEndorsement(app1Id)
      await x2EarnAppsV2.checkEndorsement(app2Id)
      await x2EarnAppsV2.checkEndorsement(app3Id)

      // start new round -> app3Id has had two rounds unendorsed so it is no longer in grace period and not eligeble for voting
      const round4 = await startNewAllocationRound()

      // All apps should be eligible now
      expect(await xAllocationVoting.isEligibleForVote(app1Id, round4)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app2Id, round4)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app3Id, round4)).to.eql(false)

      // Only 1 app should be seeking endorsement
      expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(false)
      expect(await x2EarnAppsV2.isAppUnendorsed(app2Id)).to.eql(false)
      expect(await x2EarnAppsV2.isAppUnendorsed(app3Id)).to.eql(true)

      // Prior to upgrade node holder can endorse apps without being subject to cooldown period
      await x2EarnAppsV2.connect(otherAccounts[1]).unendorseApp(app1Id, 1) // Node holder endorsement score is 100
      expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(true)
      await x2EarnAppsV2.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100
      expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(false)
      await x2EarnAppsV2.connect(otherAccounts[1]).unendorseApp(app1Id, 1) // Node holder endorsement score is 100
      expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(true)
      await x2EarnAppsV2.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100
      expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(false)

      // Create new node holders with an endorsement score of 100
      const nodeId1 = await createNodeHolder(7, otherAccounts[5]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
      const nodeId2 = await createNodeHolder(7, otherAccounts[6]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // app3Id just gets endorsed
      await x2EarnAppsV2.connect(otherAccounts[6]).endorseApp(app3Id, nodeId2)

      // Upgrade X2EarnAppsV3 to X2EarnAppsV2
      const x2EarnAppsV3 = (await upgradeProxy(
        "X2EarnAppsV2",
        "X2EarnAppsV3",
        await x2EarnAppsV2.getAddress(),
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await xAllocationVoting.getAddress()],
        {
          version: 3,
          libraries: {
            AdministrationUtilsV3: await administrationUtilsV3.getAddress(),
            EndorsementUtilsV3: await endorsementUtilsV3.getAddress(),
            VoteEligibilityUtilsV3: await voteEligibilityUtilsV3.getAddress(),
          },
        },
      )) as X2EarnAppsV3

      // New node holders should not be subject to cooldown period even if they endorse an app prior to upgrade
      expect(await x2EarnAppsV3.checkCooldown(nodeId1)).to.eql(false)
      expect(await x2EarnAppsV3.checkCooldown(nodeId2)).to.eql(false)

      // Node holders that endorsed an app prior to upgrade should not be subject to cooldown period
      expect(await x2EarnAppsV3.checkCooldown(1)).to.eql(false)

      // If a node holder that endorsed an app prior to upgrade performs an action they should be subject to cooldown period
      await x2EarnAppsV3.connect(otherAccounts[1]).unendorseApp(app1Id, 1) // Node holder endorsement score is 100
      await x2EarnAppsV3.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100

      expect(await x2EarnAppsV3.checkCooldown(1)).to.eql(true)

      // Should revert if user in cooldown period tries to endorse an app
      await catchRevert(x2EarnAppsV3.connect(otherAccounts[1]).endorseApp(app1Id, 1))

      await x2EarnAppsV3
        .connect(creator1)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, "My app 4", "metadataURI")
      const app4Id = ethers.keccak256(ethers.toUtf8Bytes("My app 4"))

      // New node holders should be subject to cooldown period
      await catchRevert(x2EarnAppsV3.connect(otherAccounts[5]).endorseApp(app4Id, 5))

      // Fast forward time to next round
      // wait for round to end
      await waitForCurrentRoundToEnd()

      await startNewAllocationRound()

      // New node holders should not be subject to cooldown period
      expect(await x2EarnAppsV3.checkCooldown(nodeId1)).to.eql(false)
      expect(await x2EarnAppsV3.checkCooldown(nodeId2)).to.eql(false)
      expect(await x2EarnAppsV3.checkCooldown(1)).to.eql(false)

      // Upgrade X2EarnAppsV3 to X2EarnApps
      const x2EarnAppsV4 = (await upgradeProxy(
        "X2EarnAppsV3",
        "X2EarnAppsV4",
        await x2EarnAppsV3.getAddress(),
        [await x2EarnRewardsPool.getAddress()],
        {
          version: 4,
          libraries: {
            AdministrationUtilsV4: await administrationUtilsV4.getAddress(),
            EndorsementUtilsV4: await endorsementUtilsV4.getAddress(),
            VoteEligibilityUtilsV4: await voteEligibilityUtilsV4.getAddress(),
          },
        },
      )) as X2EarnAppsV4
      // New node holders should not be subject to cooldown period even if they endorse an app prior to upgrade
      expect(await x2EarnAppsV4.checkCooldown(nodeId1)).to.eql(false)
      expect(await x2EarnAppsV4.checkCooldown(nodeId2)).to.eql(false)

      // Node holders that endorsed an app prior to upgrade should not be subject to cooldown period
      expect(await x2EarnAppsV4.checkCooldown(1)).to.eql(false)

      // If a node holder that endorsed an app prior to upgrade performs an action they should be subject to cooldown period
      await x2EarnAppsV4.connect(otherAccounts[1]).unendorseApp(app1Id, 1) // Node holder endorsement score is 100
      await x2EarnAppsV4.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100

      expect(await x2EarnAppsV4.checkCooldown(1)).to.eql(true)

      // Should revert if user in cooldown period tries to endorse an app
      await catchRevert(x2EarnAppsV4.connect(otherAccounts[1]).endorseApp(app1Id, 1))

      await x2EarnAppsV4
        .connect(creator2)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, "My app 5", "metadataURI")
      const app5Id = ethers.keccak256(ethers.toUtf8Bytes("My app 5"))

      // New node holders should be subject to cooldown period
      await catchRevert(x2EarnAppsV4.connect(otherAccounts[5]).endorseApp(app5Id, 5))

      // Fast forward time to next round
      // wait for round to end
      await waitForCurrentRoundToEnd()
      await startNewAllocationRound()

      // New node holders should not be subject to cooldown period
      expect(await x2EarnAppsV4.checkCooldown(nodeId1)).to.eql(false)
      expect(await x2EarnAppsV4.checkCooldown(nodeId2)).to.eql(false)
      expect(await x2EarnAppsV4.checkCooldown(1)).to.eql(false)

      // Upgrade X2EarnAppsV4 to X2EarnAppsV5
      const x2EarnAppsV5 = (await upgradeProxy("X2EarnAppsV4", "X2EarnApps", await x2EarnAppsV4.getAddress(), [], {
        version: 5,
        libraries: {
          AdministrationUtils: await administrationUtils.getAddress(),
          EndorsementUtils: await endorsementUtils.getAddress(),
          VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        },
      })) as X2EarnApps

      // New node holders should not be subject to cooldown period
      expect(await x2EarnAppsV5.checkCooldown(nodeId1)).to.eql(false)
      expect(await x2EarnAppsV5.checkCooldown(nodeId2)).to.eql(false)
      expect(await x2EarnAppsV5.checkCooldown(1)).to.eql(false)

      // If a node holder that endorsed an app prior to upgrade performs an action they should be subject to cooldown period
      await x2EarnAppsV5.connect(otherAccounts[1]).unendorseApp(app1Id, 1) // Node holder endorsement score is 100
      await x2EarnAppsV5.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100

      expect(await x2EarnAppsV5.checkCooldown(1)).to.eql(true)

      // Should revert if user in cooldown period tries to endorse an app
      await catchRevert(x2EarnAppsV5.connect(otherAccounts[1]).endorseApp(app1Id, 1))

      // Should revert if user in cooldown period tries to unendorse an app
      await catchRevert(x2EarnAppsV5.connect(otherAccounts[1]).unendorseApp(app1Id, 1))

      // Should revert if user in cooldown period tries to endorse an app
      await catchRevert(x2EarnAppsV5.connect(otherAccounts[1]).endorseApp(app1Id, 1))

      // Should revert if user in cooldown period tries to unendorse an app
      await catchRevert(x2EarnAppsV5.connect(otherAccounts[1]).unendorseApp(app1Id, 1))
      await x2EarnAppsV5
        .connect(creator3)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, "My app 6", "metadataURI")
      const app6Id = ethers.keccak256(ethers.toUtf8Bytes("My app 6"))

      // New node holders should be subject to cooldown period
      await catchRevert(x2EarnAppsV5.connect(otherAccounts[5]).endorseApp(app6Id, 5))

      // Fast forward time to next round
      // wait for round to end
      await waitForCurrentRoundToEnd()
      await startNewAllocationRound()

      // New node holders should not be subject to cooldown period
      expect(await x2EarnAppsV5.checkCooldown(nodeId1)).to.eql(false)
      expect(await x2EarnAppsV5.checkCooldown(nodeId2)).to.eql(false)
      expect(await x2EarnAppsV5.checkCooldown(1)).to.eql(false)
    })

    it("Should not have state conflict after upgrading to V5", async () => {
      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 24
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1
      const {
        xAllocationVoting,
        x2EarnRewardsPool,
        xAllocationPool,
        timeLock,
        owner,
        otherAccounts,
        veBetterPassport,
        endorsementUtils,
        administrationUtils,
        voteEligibilityUtils,
        nodeManagement,
        x2EarnCreator,
        administrationUtilsV2,
        endorsementUtilsV2,
        voteEligibilityUtilsV2,
        administrationUtilsV3,
        endorsementUtilsV3,
        voteEligibilityUtilsV3,
        administrationUtilsV4,
        endorsementUtilsV4,
        voteEligibilityUtilsV4,
      } = await getOrDeployContractInstances({ forceDeploy: true })

      const x2EarnAppsV2 = (await deployAndUpgrade(
        ["X2EarnAppsV1", "X2EarnAppsV2"],
        [
          ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
          [
            config.XAPP_GRACE_PERIOD,
            await nodeManagement.getAddress(),
            await veBetterPassport.getAddress(),
            await x2EarnCreator.getAddress(),
          ],
        ],
        {
          versions: [undefined, 2],
          libraries: [
            undefined,
            {
              AdministrationUtilsV2: await administrationUtilsV2.getAddress(),
              EndorsementUtilsV2: await endorsementUtilsV2.getAddress(),
              VoteEligibilityUtilsV2: await voteEligibilityUtilsV2.getAddress(),
            },
          ],
        },
      )) as X2EarnAppsV2

      // Grant Roles

      // Grant minter and burner role to X2Earn contract
      await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.MINTER_ROLE(), await x2EarnAppsV2.getAddress())
      await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.BURNER_ROLE(), await x2EarnAppsV2.getAddress())

      // Grant the ACTION_SCORE_MANAGER_ROLE to X2Earn contract
      await veBetterPassport
        .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnAppsV2.getAddress())
        .then(async tx => await tx.wait())

      await x2EarnRewardsPool.setX2EarnApps(await x2EarnAppsV2.getAddress())
      await xAllocationPool.setX2EarnAppsAddress(await x2EarnAppsV2.getAddress())
      await xAllocationVoting.setX2EarnAppsAddress(await x2EarnAppsV2.getAddress())

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))

      // Create two MjolnirX node holders with an endorsement score of 100
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
      await createNodeHolder(7, otherAccounts[2]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Add apps -> should be eligible for the next round
      await x2EarnAppsV2
        .connect(owner)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
      await x2EarnAppsV2
        .connect(owner)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

      await x2EarnAppsV2.connect(otherAccounts[1]).endorseApp(app1Id, 1)
      await x2EarnAppsV2.connect(otherAccounts[2]).endorseApp(app2Id, 2)

      // Start round using V1 contract
      const round1 = await startNewAllocationRound()

      // Add app -> should be eligible for the next round
      await x2EarnAppsV2
        .connect(owner)
        .submitApp(otherAccounts[4].address, otherAccounts[4].address, "My app #3", "metadataURI")

      await createNodeHolder(7, otherAccounts[4]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
      await x2EarnAppsV2.connect(otherAccounts[4]).endorseApp(app3Id, 3)

      // Check eligibility
      expect(await x2EarnAppsV2.isEligibleNow(app1Id)).to.eql(true)
      expect(await x2EarnAppsV2.isEligibleNow(app2Id)).to.eql(true)
      expect(await x2EarnAppsV2.isEligibleNow(app3Id)).to.eql(true)

      expect(await xAllocationVoting.isEligibleForVote(app1Id, round1)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app2Id, round1)).to.eql(true)
      expect(await xAllocationVoting.isEligibleForVote(app3Id, round1)).to.eql(false)

      // Wait for round to end
      await waitForCurrentRoundToEnd()

      const initialSlotVoteEligibility = BigInt("0xb5b8d618af1ffb8d5bcc4bd23f445ba34ed08d7a16d1e1b5411cfbe7913e5900")
      const initialSlotSettings = BigInt("0x83b9a7e51f394efa93107c3888716138908bbbe611dfc86afa3639a826441100")
      const initialSlotAppsStorage = BigInt("0xb6909058bd527140b8d55a44344c5e42f1f148f1b3b16df7641882df8dd72900")
      const initialSlotAdministration = BigInt("0x5830f0e95c01712d916c34d9e2fa42e9f749b325b67bce7382d70bb99c623500")
      const initialEndorsementSlot = BigInt("0xc1a7bcdc0c77e8c77ade4541d1777901ab96ca598d164d89afa5c8dfbfc44300")

      const storageSlots = await getStorageSlots(
        x2EarnAppsV2.getAddress(),
        initialSlotVoteEligibility,
        initialSlotSettings,
        initialSlotAppsStorage,
        initialSlotAdministration,
        initialEndorsementSlot,
      )
      config.X2EARN_NODE_COOLDOWN_PERIOD = 24

      // Upgrade X2EarnAppsV2 to X2EarnAppsV3
      const x2EarnAppsV3 = (await upgradeProxy(
        "X2EarnAppsV2",
        "X2EarnAppsV3",
        await x2EarnAppsV2.getAddress(),
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await xAllocationVoting.getAddress()],
        {
          version: 3,
          libraries: {
            AdministrationUtilsV3: await administrationUtilsV3.getAddress(),
            EndorsementUtilsV3: await endorsementUtilsV3.getAddress(),
            VoteEligibilityUtilsV3: await voteEligibilityUtilsV3.getAddress(),
          },
        },
      )) as X2EarnAppsV3

      const storageSlotsAfterV3 = await getStorageSlots(
        x2EarnAppsV3.getAddress(),
        initialSlotVoteEligibility,
        initialSlotSettings,
        initialSlotAppsStorage,
        initialSlotAdministration,
        initialEndorsementSlot,
      )

      expect(await x2EarnAppsV3.version()).to.equal("3")
      expect(storageSlotsAfterV3[storageSlotsAfterV3.length - 2]).to.equal(BigInt(config.X2EARN_NODE_COOLDOWN_PERIOD))

      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfterV3[i])
      }

      const storageSlotsAdministrationAfterV3 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialSlotAdministration,
      )

      const storageSlotsVoteEligibilityAfterV3 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialSlotVoteEligibility,
      )

      const storageSlotsSettingsAfterV3 = await getStorageSlots(await x2EarnAppsV2.getAddress(), initialSlotSettings)

      const storageSlotsAppsStorageAfterV3 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialSlotAppsStorage,
      )

      const storageSlotsEndorsementSlotAfterV3 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialEndorsementSlot,
      )
      // x2EarnAppsV4
      const x2EarnAppsV4 = (await upgradeProxy(
        "X2EarnAppsV3",
        "X2EarnAppsV4",
        await x2EarnAppsV3.getAddress(),
        [await x2EarnRewardsPool.getAddress()],
        {
          version: 4,
          libraries: {
            AdministrationUtilsV4: await administrationUtilsV4.getAddress(),
            EndorsementUtilsV4: await endorsementUtilsV4.getAddress(),
            VoteEligibilityUtilsV4: await voteEligibilityUtilsV4.getAddress(),
          },
        },
      )) as X2EarnAppsV4

      expect(await x2EarnAppsV4.x2EarnRewardsPoolContract()).to.eql(await x2EarnRewardsPool.getAddress())

      const storageSlotsAdministrationAfterV4 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialSlotAdministration,
      )

      const storageSlotsVoteEligibilityAfterV4 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialSlotVoteEligibility,
      )

      const storageSlotsSettingsAfterV4 = await getStorageSlots(await x2EarnAppsV2.getAddress(), initialSlotSettings)

      const storageSlotsAppsStorageAfterV4 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialSlotAppsStorage,
      )

      const storageSlotsEndorsementSlotAfterV4 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialEndorsementSlot,
      )

      expect(await x2EarnAppsV4.version()).to.equal("4")

      // Check that the storage slots are the same for the administration module
      for (let i = 0; i < storageSlotsAdministrationAfterV3.length; i++) {
        expect(storageSlotsAdministrationAfterV3[i]).to.equal(storageSlotsAdministrationAfterV4[i])
      }

      // Check that the storage slots are the same for the vote eligibility module
      for (let i = 0; i < storageSlotsVoteEligibilityAfterV3.length; i++) {
        expect(storageSlotsVoteEligibilityAfterV3[i]).to.equal(storageSlotsVoteEligibilityAfterV4[i])
      }

      // Check that the storage slots are the same for the settings module
      for (let i = 0; i < storageSlotsSettingsAfterV3.length; i++) {
        expect(storageSlotsSettingsAfterV3[i]).to.equal(storageSlotsSettingsAfterV4[i])
      }

      // Check that the storage slots are the same for the apps storage module
      for (let i = 0; i < storageSlotsAppsStorageAfterV3.length; i++) {
        expect(storageSlotsAppsStorageAfterV3[i]).to.equal(storageSlotsAppsStorageAfterV4[i])
      }

      // Check that the storage slots are the same for the endorsement slot
      for (let i = 0; i < storageSlotsEndorsementSlotAfterV3.length; i++) {
        expect(storageSlotsEndorsementSlotAfterV3[i]).to.equal(storageSlotsEndorsementSlotAfterV4[i])
      }

      // The first slot is the x2earnCreator contract address
      const addressFromSlot = ethers.getAddress("0x" + storageSlotsAdministrationAfterV4[0].slice(26))
      const expectedAddress = ethers.getAddress(await x2EarnCreator.getAddress())
      expect(addressFromSlot).to.equal(expectedAddress)

      // The second slot is the x2earnRewardsPool contract address
      const addressFromSlot2 = ethers.getAddress("0x" + storageSlotsAdministrationAfterV4[1].slice(26))
      const expectedAddress2 = ethers.getAddress(await x2EarnRewardsPool.getAddress())
      expect(addressFromSlot2).to.equal(expectedAddress2)

      // Upgrade to V5
      const x2EarnAppsV5 = (await upgradeProxy("X2EarnAppsV4", "X2EarnApps", await x2EarnAppsV4.getAddress(), [], {
        version: 5,
        libraries: {
          AdministrationUtils: await administrationUtils.getAddress(),
          EndorsementUtils: await endorsementUtils.getAddress(),
          VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        },
      })) as X2EarnApps

      expect(await x2EarnAppsV5.x2EarnRewardsPoolContract()).to.eql(await x2EarnRewardsPool.getAddress())
      expect(await x2EarnAppsV5.x2EarnCreatorContract()).to.eql(await x2EarnCreator.getAddress())
      const storageSlotsAdministrationAfterV5 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialSlotAdministration,
      )

      const storageSlotsVoteEligibilityAfterV5 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialSlotVoteEligibility,
      )

      const storageSlotsSettingsAfterV5 = await getStorageSlots(await x2EarnAppsV2.getAddress(), initialSlotSettings)

      const storageSlotsAppsStorageAfterV5 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialSlotAppsStorage,
      )

      const storageSlotsEndorsementSlotAfterV5 = await getStorageSlots(
        await x2EarnAppsV2.getAddress(),
        initialEndorsementSlot,
      )
      // check that the version is good
      expect(await x2EarnAppsV5.version()).to.eql("5")

      // Check that the storage slots are the same for the administration module
      for (let i = 0; i < storageSlotsAdministrationAfterV5.length; i++) {
        expect(storageSlotsAdministrationAfterV5[i]).to.equal(storageSlotsAdministrationAfterV4[i])
      }

      // Check that the storage slots are the same for the vote eligibility module
      for (let i = 0; i < storageSlotsVoteEligibilityAfterV5.length; i++) {
        expect(storageSlotsVoteEligibilityAfterV5[i]).to.equal(storageSlotsVoteEligibilityAfterV4[i])
      }

      // Check that the storage slots are the same for the settings module
      for (let i = 0; i < storageSlotsSettingsAfterV5.length; i++) {
        expect(storageSlotsSettingsAfterV5[i]).to.equal(storageSlotsSettingsAfterV4[i])
      }

      // Check that the storage slots are the same for the apps storage module
      for (let i = 0; i < storageSlotsAppsStorageAfterV5.length; i++) {
        expect(storageSlotsAppsStorageAfterV5[i]).to.equal(storageSlotsAppsStorageAfterV4[i])
      }

      // Check that the storage slots are the same for the endorsement slot
      for (let i = 0; i < storageSlotsEndorsementSlotAfterV5.length; i++) {
        expect(storageSlotsEndorsementSlotAfterV5[i]).to.equal(storageSlotsEndorsementSlotAfterV4[i])
      }

      // The first slot is the x2earnCreator contract address
      const addressFromSlotUpgradeV5 = ethers.getAddress("0x" + storageSlotsAdministrationAfterV5[0].slice(26))
      const expectedAddressUpgradeV5 = ethers.getAddress(await x2EarnCreator.getAddress())
      expect(addressFromSlotUpgradeV5).to.equal(expectedAddressUpgradeV5)

      // The second slot is the x2earnRewardsPool contract address
      const addressFromSlot2UpgradeV5 = ethers.getAddress("0x" + storageSlotsAdministrationAfterV5[1].slice(26))
      const expectedAddress2UpgradeV5 = ethers.getAddress(await x2EarnRewardsPool.getAddress())
      expect(addressFromSlot2UpgradeV5).to.equal(expectedAddress2UpgradeV5)
    })

    it.skip("Check no issues upgrading to V5 with update of libraries", async function () {
      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 50
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1
      const {
        otherAccounts,
        otherAccount,
        owner,
        vechainNodesMock,
        timeLock,
        b3tr,
        vot3,
        treasury,
        x2EarnCreator,
        nodeManagement,
        passportChecksLogicV1,
        passportConfiguratorV1,
        passportDelegationLogicV1,
        passportPersonhoodLogicV1,
        passportPoPScoreLogicV1,
        passportSignalingLogicV1,
        passportEntityLogicV1,
        passportWhitelistBlacklistLogicV1,
        passportChecksLogic,
        passportConfigurator,
        passportDelegationLogic,
        passportPersonhoodLogic,
        passportPoPScoreLogic,
        passportSignalingLogic,
        passportWhitelistBlacklistLogic,
        passportEntityLogic,
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
        governorClockLogicLib,
        governorConfiguratorLib,
        governorDepositLogicLib,
        governorFunctionRestrictionsLogicLib,
        governorProposalLogicLib,
        governorQuorumLogicLib,
        governorStateLogicLib,
        governorVotesLogicLib,
        administrationUtils,
        endorsementUtils,
        voteEligibilityUtils,
        administrationUtilsV2,
        endorsementUtilsV2,
        voteEligibilityUtilsV2,
        administrationUtilsV3,
        endorsementUtilsV3,
        voteEligibilityUtilsV3,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy X2EarnApps V1 and all the other contracts
      const x2EarnAppsV1 = (await deployProxy("X2EarnAppsV1", [
        "ipfs://",
        [await timeLock.getAddress(), owner.address],
        owner.address,
        owner.address,
      ])) as X2EarnAppsV1

      const veBetterPassportContractAddress = await deployProxyOnly("VeBetterPassportV1", {
        PassportChecksLogicV1: await passportChecksLogicV1.getAddress(),
        PassportConfiguratorV1: await passportConfiguratorV1.getAddress(),
        PassportEntityLogicV1: await passportEntityLogicV1.getAddress(),
        PassportDelegationLogicV1: await passportDelegationLogicV1.getAddress(),
        PassportPersonhoodLogicV1: await passportPersonhoodLogicV1.getAddress(),
        PassportPoPScoreLogicV1: await passportPoPScoreLogicV1.getAddress(),
        PassportSignalingLogicV1: await passportSignalingLogicV1.getAddress(),
        PassportWhitelistAndBlacklistLogicV1: await passportWhitelistBlacklistLogicV1.getAddress(),
      })

      const x2EarnRewardsPool = (await deployAndUpgrade(
        ["X2EarnRewardsPoolV1", "X2EarnRewardsPoolV2", "X2EarnRewardsPoolV3", "X2EarnRewardsPoolV4"],
        [
          [
            owner.address, // admin
            owner.address, // contracts address manager
            owner.address, // upgrader //TODO: transferRole
            await b3tr.getAddress(),
            await x2EarnAppsV1.getAddress(),
          ],
          [
            owner.address, // impact admin address
            config.X_2_EARN_INITIAL_IMPACT_KEYS, // impact keys
          ],
          [veBetterPassportContractAddress],
          [],
        ],
        {
          versions: [undefined, 2, 3, 4],
        },
      )) as X2EarnRewardsPoolV4

      const xAllocationPool = (await deployAndUpgrade(
        ["XAllocationPoolV1", "XAllocationPoolV2", "XAllocationPoolV3"],
        [
          [
            owner.address, // admin
            owner.address, // upgrader
            owner.address, // contractsAddressManager
            await b3tr.getAddress(),
            await treasury.getAddress(),
            await x2EarnAppsV1.getAddress(),
            await x2EarnRewardsPool.getAddress(),
          ],
          [],
          [],
        ],
        {
          versions: [undefined, 2, 3],
        },
      )) as XAllocationPoolV3

      const galaxyMember = (await deployAndUpgrade(
        ["GalaxyMemberV1", "GalaxyMemberV2", "GalaxyMember"],
        [
          [
            {
              name: "VeBetterDAO Galaxy Member",
              symbol: "GM",
              admin: owner.address,
              upgrader: owner.address,
              pauser: owner.address,
              minter: owner.address,
              contractsAddressManager: owner.address,
              maxLevel: 5,
              baseTokenURI: config.GM_NFT_BASE_URI,
              b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
              b3tr: await b3tr.getAddress(),
              treasury: await treasury.getAddress(),
            },
          ],
          [
            await vechainNodesMock.getAddress(),
            await nodeManagement.getAddress(),
            owner.address,
            config.GM_NFT_NODE_TO_FREE_LEVEL,
          ],
          [],
        ],
        {
          versions: [undefined, 2, 3],
        },
      )) as GalaxyMember

      const emissions = (await deployAndUpgrade(
        ["EmissionsV1", "Emissions"],
        [
          [
            {
              minter: owner.address,
              admin: owner.address,
              upgrader: owner.address,
              contractsAddressManager: owner.address,
              decaySettingsManager: owner.address,
              b3trAddress: await b3tr.getAddress(),
              destinations: [
                await xAllocationPool.getAddress(),
                config.VOTE_2_EARN_POOL_ADDRESS,
                await treasury.getAddress(),
                config.MIGRATION_ADDRESS,
              ],
              initialXAppAllocation: config.INITIAL_X_ALLOCATION,
              cycleDuration: config.EMISSIONS_CYCLE_DURATION,
              decaySettings: [
                config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
                config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
                config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
                config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
              ],
              treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
              maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
              migrationAmount: config.MIGRATION_AMOUNT,
            },
          ],
          [config.EMISSIONS_IS_NOT_ALIGNED],
        ],
        {
          versions: [undefined, 2],
        },
      )) as Emissions

      const voterRewards = (await deployAndUpgrade(
        ["VoterRewardsV1", "VoterRewardsV2", "VoterRewards"],
        [
          [
            owner.address, // admin
            owner.address, // upgrader // TODO: transferRole
            owner.address, // contractsAddressManager
            await emissions.getAddress(),
            await galaxyMember.getAddress(),
            await b3tr.getAddress(),
            config.VOTER_REWARDS_LEVELS,
            config.VOTER_REWARDS_MULTIPLIER,
          ],
          [],
          [],
        ],
        {
          versions: [undefined, 2, 3],
        },
      )) as VoterRewards

      const xAllocationVoting = (await deployAndUpgrade(
        ["XAllocationVotingV1", "XAllocationVotingV2", "XAllocationVotingV3"],
        [
          [
            {
              vot3Token: await vot3.getAddress(),
              quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE,
              initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1,
              timeLock: await timeLock.getAddress(),
              voterRewards: await voterRewards.getAddress(),
              emissions: await emissions.getAddress(),
              admins: [await timeLock.getAddress(), owner.address],
              upgrader: owner.address,
              contractsAddressManager: owner.address,
              x2EarnAppsAddress: await x2EarnAppsV1.getAddress(),
              baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
              appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
              votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
            },
          ],
          [veBetterPassportContractAddress],
          [],
        ],
        {
          versions: [undefined, 2, 3],
        },
      )) as XAllocationVotingV3

      const veBetterPassportV1 = (await initializeProxy(
        veBetterPassportContractAddress,
        "VeBetterPassportV1",
        [
          {
            x2EarnApps: await x2EarnAppsV1.getAddress(),
            xAllocationVoting: await xAllocationVoting.getAddress(),
            galaxyMember: await galaxyMember.getAddress(),
            signalingThreshold: config.VEPASSPORT_BOT_SIGNALING_THRESHOLD, //signalingThreshold
            roundsForCumulativeScore: config.VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE, //roundsForCumulativeScore
            minimumGalaxyMemberLevel: config.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL, //galaxyMemberMinimumLevel
            blacklistThreshold: config.VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE, //blacklistThreshold
            whitelistThreshold: config.VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE, //whitelistThreshold
            maxEntitiesPerPassport: config.VEPASSPORT_PASSPORT_MAX_ENTITIES, //maxEntitiesPerPassport
            decayRate: config.VEPASSPORT_DECAY_RATE, //decayRate
          },
          {
            admin: owner.address, // admins
            botSignaler: owner.address, // botSignaler
            upgrader: owner.address, // upgrader
            settingsManager: owner.address, // settingsManager
            roleGranter: owner.address, // roleGranter
            blacklister: owner.address, // blacklister
            whitelister: owner.address, // whitelistManager
            actionRegistrar: owner.address, // actionRegistrar
            actionScoreManager: owner.address, // actionScoreManager
          },
        ],
        {
          PassportChecksLogicV1: await passportChecksLogicV1.getAddress(),
          PassportConfiguratorV1: await passportConfiguratorV1.getAddress(),
          PassportEntityLogicV1: await passportEntityLogicV1.getAddress(),
          PassportDelegationLogicV1: await passportDelegationLogicV1.getAddress(),
          PassportPersonhoodLogicV1: await passportPersonhoodLogicV1.getAddress(),
          PassportPoPScoreLogicV1: await passportPoPScoreLogicV1.getAddress(),
          PassportSignalingLogicV1: await passportSignalingLogicV1.getAddress(),
          PassportWhitelistAndBlacklistLogicV1: await passportWhitelistBlacklistLogicV1.getAddress(),
        },
      )) as VeBetterPassportV1

      const veBetterPassport = (await upgradeProxy(
        "VeBetterPassportV1",
        "VeBetterPassport",
        await veBetterPassportV1.getAddress(),
        [],
        {
          version: 2,
          libraries: {
            PassportChecksLogic: await passportChecksLogic.getAddress(),
            PassportConfigurator: await passportConfigurator.getAddress(),
            PassportEntityLogic: await passportEntityLogic.getAddress(),
            PassportDelegationLogic: await passportDelegationLogic.getAddress(),
            PassportPersonhoodLogic: await passportPersonhoodLogic.getAddress(),
            PassportPoPScoreLogic: await passportPoPScoreLogic.getAddress(),
            PassportSignalingLogic: await passportSignalingLogic.getAddress(),
            PassportWhitelistAndBlacklistLogic: await passportWhitelistBlacklistLogic.getAddress(),
          },
        },
      )) as VeBetterPassport

      const governor = (await deployAndUpgrade(
        ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4", "B3TRGovernor"],
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
          [veBetterPassportContractAddress],
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

      // ------------------ Set up contracts ------------------
      await veBetterPassportV1
        .connect(owner)
        .grantRole(await veBetterPassportV1.ACTION_REGISTRAR_ROLE(), await x2EarnRewardsPool.getAddress())

      // Grant admin role to voter rewards for registering x allocation voting
      await xAllocationVoting
        .connect(owner)
        .grantRole(await xAllocationVoting.DEFAULT_ADMIN_ROLE(), emissions.getAddress())

      await voterRewards
        .connect(owner)
        .grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await xAllocationVoting.getAddress())

      await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await governor.getAddress())

      await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())
      await xAllocationPool.connect(owner).setEmissionsAddress(await emissions.getAddress())

      // Set xAllocationGovernor and VoterRewards in emissions
      await emissions.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await emissions.connect(owner).setVote2EarnAddress(await voterRewards.getAddress())
      await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

      await veBetterPassport.toggleCheck(4)

      const roundStarterRole = await xAllocationVoting.ROUND_STARTER_ROLE()
      await xAllocationVoting
        .connect(owner)
        .grantRole(roundStarterRole, await emissions.getAddress())
        .then(async tx => await tx.wait())
      await xAllocationVoting
        .connect(owner)
        .grantRole(roundStarterRole, owner.address)
        .then(async tx => await tx.wait())

      const testKeys = getTestKeys(50)

      let eligibleAppIds: string[] = []
      APPS.forEach(async (app, index) => {
        const tx = await x2EarnAppsV1.addApp(app.teamWalletAddress, app.admin, app.name, app.metadataURI)
        await tx.wait()

        const appId = ethers.keccak256(ethers.toUtf8Bytes(app.name))
        eligibleAppIds.push(appId)

        // Add moderators
        for (let i = 0; i < 3; i++) {
          await x2EarnAppsV1.connect(owner).addAppModerator(appId, testKeys[index + i].address)
        }
      })

      // Get VTHO tokens
      for (let i = 0; i < otherAccounts.length; i++) {
        // Create two node holders with an endorsement score
        await getVot3Tokens(otherAccounts[i], "1000")
        expect(await vot3.balanceOf(otherAccounts[i].address)).to.eql(ethers.parseEther("1000"))
      }

      expect(await x2EarnAppsV1.appsCount()).to.eql(8n)
      expect((await x2EarnAppsV1.allEligibleApps()).length).to.eql(8)
      await emissions.connect(owner).bootstrap()
      await emissions.connect(owner).start()

      // Expect round 1 to start
      expect(await emissions.getCurrentCycle()).to.eql(1n)

      // Start voting rounds
      for (let i = 1; i < 18; i++) {
        // Get each of the users to vote
        otherAccounts.map(async account => {
          const [firstAppIndex, secondAppIndex] = getTwoUniqueRandomIndices(eligibleAppIds.length)
          const appIdsToVoteOn = [eligibleAppIds[firstAppIndex], eligibleAppIds[secondAppIndex]]

          const voteAmounts = [
            ethers.parseEther((Math.random() * 100).toFixed(2)), // Random amount for the first app
            ethers.parseEther((Math.random() * 100).toFixed(2)), // Random amount for the second app
          ]

          const tx = await xAllocationVoting.connect(account).castVote(i, appIdsToVoteOn, voteAmounts)
          await tx.wait()
        })

        // Wait for the round to end
        const blockNextCycle = await emissions.getNextCycleBlock()
        await waitForBlock(Number(blockNextCycle))

        // Claim rewards as voter
        otherAccounts.map(async account => {
          const amount = await voterRewards.cycleToVoterToTotal(i, account.address)
          expect(amount).to.not.eql(0n)
          const tx = await voterRewards.connect(account).claimReward(i, account.address)
          await tx.wait()

          // Covert to vot3
          await b3tr.connect(account).approve(await vot3.getAddress(), amount)
          await vot3.connect(account).convertToVOT3(amount)

          expect(await voterRewards.cycleToVoterToTotal(i, account.address)).to.eql(0n)
        })

        // Claim X2Earn rewards
        eligibleAppIds.map(async appId => {
          expect(await xAllocationPool.claimableAmount(i, appId)).to.not.eql(0n)
          const tx = await xAllocationPool.connect(owner).claim(i, appId)
          await tx.wait()
        })

        await emissions.distribute()
      }

      // Upgrade to V2 of X2EarnApps
      const x2EarnAppsV2 = (await upgradeProxy(
        "X2EarnAppsV1",
        "X2EarnAppsV2",
        await x2EarnAppsV1.getAddress(),
        [
          config.XAPP_GRACE_PERIOD,
          await nodeManagement.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        {
          version: 2,
          libraries: {
            AdministrationUtilsV2: await administrationUtilsV2.getAddress(),
            EndorsementUtilsV2: await endorsementUtilsV2.getAddress(),
            VoteEligibilityUtilsV2: await voteEligibilityUtilsV2.getAddress(),
          },
        },
      )) as X2EarnAppsV2

      // Grant minter and burner role to X2Earn contract
      await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.MINTER_ROLE(), await x2EarnAppsV2.getAddress())
      await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.BURNER_ROLE(), await x2EarnAppsV2.getAddress())

      // Check if all apps are still registered
      expect(await x2EarnAppsV2.appsCount()).to.eql(8n)
      expect((await x2EarnAppsV2.allEligibleApps()).length).to.eql(8)

      // Grant the ACTION_SCORE_MANAGER_ROLE to X2Earn contract
      await veBetterPassport
        .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnAppsV2.getAddress())
        .then(async tx => await tx.wait())

      // Check if all moderators are still registered and endorse each app
      for (let i = 0; i < eligibleAppIds.length; i++) {
        const moderators = await x2EarnAppsV2.appModerators(eligibleAppIds[i])
        expect(moderators[0]).to.eql(testKeys[i].address)
        expect(moderators[1]).to.eql(testKeys[i + 1].address)
        expect(moderators[2]).to.eql(testKeys[i + 2].address)

        // Check endorsement status -> all apps should be unendorsed -> Grace period should start
        await expect(x2EarnAppsV2.checkEndorsement(eligibleAppIds[i])).to.emit(
          x2EarnAppsV2,
          "AppUnendorsedGracePeriodStarted",
        )
        expect(await x2EarnAppsV2.isAppUnendorsed(eligibleAppIds[i])).to.eql(true)

        const secuirtyScore = await veBetterPassport.appSecurity(eligibleAppIds[i])

        // Endorse the app
        await vechainNodesMock.addToken(otherAccounts[i], 7, false, 0, 0)
        await expect(x2EarnAppsV2.connect(otherAccounts[i]).endorseApp(eligibleAppIds[i], BigInt(i + 1))).to.emit(
          x2EarnAppsV2,
          "AppEndorsed",
        )
        // Check endorsement status -> all apps should be endorsed
        await x2EarnAppsV2.checkEndorsement(eligibleAppIds[i])
        expect(await x2EarnAppsV2.isAppUnendorsed(eligibleAppIds[i])).to.eql(false)

        // Secuirty score should remain same
        expect(await veBetterPassport.appSecurity(eligibleAppIds[i])).to.eql(secuirtyScore)
      }

      // Upgrade to V3 of X2EarnApps
      const x2EarnAppsV3 = (await upgradeProxy(
        "X2EarnAppsV2",
        "X2EarnAppsV3",
        await x2EarnAppsV2.getAddress(),
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await xAllocationVoting.getAddress()],
        {
          version: 3,
          libraries: {
            AdministrationUtilsV3: await administrationUtilsV3.getAddress(),
            EndorsementUtilsV3: await endorsementUtilsV3.getAddress(),
            VoteEligibilityUtilsV3: await voteEligibilityUtilsV3.getAddress(),
          },
        },
      )) as X2EarnAppsV3

      // Upgrade contracts that need new interfaces
      ;(await upgradeProxy("X2EarnRewardsPoolV4", "X2EarnRewardsPool", await x2EarnRewardsPool.getAddress(), [], {
        version: 4,
      })) as X2EarnRewardsPool
      ;(await upgradeProxy("XAllocationPoolV3", "XAllocationPool", await xAllocationPool.getAddress(), [], {
        version: 3,
      })) as XAllocationPool
      ;(await upgradeProxy(
        "X2EarnRewardsPoolV4",
        "X2EarnRewardsPool",
        await x2EarnRewardsPool.getAddress(),
        [],
        {},
      )) as X2EarnRewardsPool

      // Continue voting rounds
      for (let i = 1; i < 5; i++) {
        // Get each of the users to vote
        otherAccounts.map(async account => {
          const [firstAppIndex, secondAppIndex] = getTwoUniqueRandomIndices(eligibleAppIds.length)
          const appIdsToVoteOn = [eligibleAppIds[firstAppIndex], eligibleAppIds[secondAppIndex]]

          const voteAmounts = [
            ethers.parseEther((Math.random() * 100).toFixed(2)), // Random amount for the first app
            ethers.parseEther((Math.random() * 100).toFixed(2)), // Random amount for the second app
          ]

          const tx = await xAllocationVoting.connect(account).castVote(i, appIdsToVoteOn, voteAmounts)
          await tx.wait()
        })

        // Wait for the round to end
        const blockNextCycle = await emissions.getNextCycleBlock()
        await waitForBlock(Number(blockNextCycle))

        // Claim rewards as voter
        otherAccounts.map(async account => {
          const amount = await voterRewards.cycleToVoterToTotal(i, account.address)
          expect(amount).to.not.eql(0n)
          const tx = await voterRewards.connect(account).claimReward(i, account.address)
          await tx.wait()

          // Covert to vot3
          await b3tr.connect(account).approve(await vot3.getAddress(), amount)
          await vot3.connect(account).convertToVOT3(amount)

          expect(await voterRewards.cycleToVoterToTotal(i, account.address)).to.eql(0n)
        })

        // Claim X2Earn rewards
        eligibleAppIds.map(async appId => {
          expect(await xAllocationPool.claimableAmount(i, appId)).to.not.eql(0n)
          const tx = await xAllocationPool.connect(owner).claim(i, appId)
          await tx.wait()
        })

        // Check endorsement status -> all apps should be unendorsed -> Grace period should start
        for (let i = 0; i < eligibleAppIds.length; i++) {
          await x2EarnAppsV3.checkEndorsement(eligibleAppIds[i])
          expect(await x2EarnAppsV3.isEligibleNow(eligibleAppIds[i])).to.eql(true)
        }

        await emissions.distribute()
      }

      // Submit a new app
      await x2EarnAppsV3
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const newAppId = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      // Should be 1 app pending endorsement
      expect(await x2EarnAppsV3.unendorsedAppIds()).to.deep.equal([newAppId])
      // Should not be recognised as part of ecosystem yet
      expect(await x2EarnAppsV3.apps()).to.not.include(newAppId)

      // App security score should be 0
      expect(await veBetterPassport.appSecurity(newAppId)).to.eql(0n)

      // Endorse the app
      await vechainNodesMock.addToken(otherAccount, 7, false, 0, 0)
      const tokenId = await vechainNodesMock.ownerToId(otherAccount.address)

      // Wait for the cooldown period to end (1 round)
      await waitForBlock(Number(await emissions.getNextCycleBlock()))
      await emissions.distribute()
      await x2EarnAppsV3.connect(otherAccount).endorseApp(newAppId, tokenId)

      // Should not be able to unendorse the app
      await expect(x2EarnAppsV3.connect(otherAccount).unendorseApp(newAppId, tokenId)).to.be.revertedWithCustomError(
        x2EarnAppsV3,
        "X2EarnNodeCooldownActive",
      )

      // Should be eligible
      expect(await x2EarnAppsV3.isEligibleNow(newAppId)).to.eql(true)

      // Should not be eligible for voting yet
      const currentRound = await emissions.getCurrentCycle()
      expect(await xAllocationVoting.isEligibleForVote(newAppId, currentRound)).to.eql(false)

      // Should no longer be looking for endorsement
      expect(await x2EarnAppsV3.unendorsedAppIds()).to.deep.equal([])

      // Security score should be LOW
      expect(await veBetterPassport.appSecurity(newAppId)).to.eql(1n)

      // Cannot Vote on the app
      await catchRevert(
        xAllocationVoting
          .connect(otherAccounts[1])
          .castVote(1, [newAppId, eligibleAppIds[0]], [ethers.parseEther("10"), 0]),
      )

      // Wait for the round to end
      const blockNextCycle = await emissions.getNextCycleBlock()
      await waitForBlock(Number(blockNextCycle))

      // Start new round of voting
      await emissions.distribute()

      // Should be eligible for voting now
      expect(await xAllocationVoting.isEligibleForVote(newAppId, currentRound + 1n)).to.eql(true)

      // Get each of the users to vote
      otherAccounts.map(async account => {
        const [firstAppIndex] = getTwoUniqueRandomIndices(eligibleAppIds.length)
        const appIdsToVoteOn = [newAppId, eligibleAppIds[firstAppIndex]]

        const voteAmounts = [
          ethers.parseEther((Math.random() * 100).toFixed(2)), // Random amount for the first app
          ethers.parseEther((Math.random() * 100).toFixed(2)), // Random amount for the second app
        ]

        const tx = await xAllocationVoting.connect(account).castVote(currentRound + 1n, appIdsToVoteOn, voteAmounts)
        await tx.wait()
      })

      // Wait for the round to end
      const blockNextCycle2 = await emissions.getNextCycleBlock()
      await waitForBlock(Number(blockNextCycle2))

      // New App can claim rewards
      expect(await xAllocationPool.claimableAmount(currentRound + 1n, newAppId)).to.not.eql(0n)
      const tx = await xAllocationPool.connect(owner).claim(currentRound + 1n, newAppId)
      await tx.wait()

      // Upgrade to V4
      const x2EarnAppsV4 = (await upgradeProxy(
        "X2EarnAppsV3",
        "X2EarnApps",
        await x2EarnAppsV3.getAddress(),
        [await x2EarnRewardsPool.getAddress()],
        {
          version: 4,
          libraries: {
            AdministrationUtils: await administrationUtils.getAddress(),
            EndorsementUtils: await endorsementUtils.getAddress(),
            VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
          },
        },
      )) as X2EarnAppsV4
      expect(await x2EarnAppsV4.version()).to.eql("4")
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

    it("Only admin can update node management contract address", async function () {
      const { x2EarnApps, otherAccount, nodeManagement, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.getNodeManagementContract()).to.eql(await nodeManagement.getAddress())
      await catchRevert(x2EarnApps.connect(otherAccount).setNodeManagementContract(otherAccount.address))

      await x2EarnApps.connect(owner).setNodeManagementContract(await otherAccount.getAddress())

      expect(await x2EarnApps.getNodeManagementContract()).to.eql(await otherAccount.getAddress())
    })

    it("Only admin can update veBetter passport contract address", async function () {
      const { x2EarnApps, otherAccount, veBetterPassport, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.getVeBetterPassportContract()).to.eql(await veBetterPassport.getAddress())
      await catchRevert(x2EarnApps.connect(otherAccount).setVeBetterPassportContract(otherAccount.address))

      await x2EarnApps.connect(owner).setVeBetterPassportContract(await otherAccount.getAddress())

      expect(await x2EarnApps.getVeBetterPassportContract()).to.eql(await otherAccount.getAddress())
    })

    it("Only admin can update x2Earn creator contract address", async function () {
      const { x2EarnApps, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(x2EarnApps.connect(otherAccount).setX2EarnCreatorContract(otherAccount.address))

      await x2EarnApps.connect(owner).setX2EarnCreatorContract(await otherAccount.getAddress())
    })

    it("Only admin can update xAllocation voting contract", async function () {
      const { x2EarnApps, otherAccount, xAllocationVoting, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.getXAllocationVotingGovernor()).to.eql(await xAllocationVoting.getAddress())
      await catchRevert(x2EarnApps.connect(otherAccount).setXAllocationVotingGovernor(otherAccount.address))

      await x2EarnApps.connect(owner).setXAllocationVotingGovernor(await otherAccount.getAddress())

      expect(await x2EarnApps.getXAllocationVotingGovernor()).to.eql(await otherAccount.getAddress())
    })

    it("Cannot set XAllocation voting to zero address", async function () {
      const { x2EarnApps, xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.getXAllocationVotingGovernor()).to.eql(await xAllocationVoting.getAddress())
      await catchRevert(x2EarnApps.setXAllocationVotingGovernor(ZERO_ADDRESS))

      expect(await x2EarnApps.getXAllocationVotingGovernor()).to.eql(await xAllocationVoting.getAddress())
    })

    it("Cannot set x2EarnRewardsPool to zero address", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(x2EarnApps.setX2EarnRewardsPoolContract(ZERO_ADDRESS))
    })

    it("Only admin can set x2EarnRewardsPool", async function () {
      const { x2EarnApps, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(x2EarnApps.connect(otherAccount).setX2EarnRewardsPoolContract(otherAccount.address))
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
    it("Can get eligible apps count", async function () {
      const { x2EarnApps, otherAccounts, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(app1Id, owner)

      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, "My app #2", "metadataURI")

      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
      await endorseApp(app2Id, otherAccount)

      const appsCount = await x2EarnApps.appsCount()
      expect(appsCount).to.eql(2n)
    })

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

      // endorsed apps
      const appsCount = await x2EarnApps.appsCount()
      expect(appsCount).to.eql(0n)
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

    it("Can paginate apps", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnApps
        .connect(creator1)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(app1Id, otherAccounts[0])

      await x2EarnApps
        .connect(creator2)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, "My app #2", "metadataURI")
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
      await endorseApp(app2Id, otherAccounts[1])

      await x2EarnApps
        .connect(creator3)
        .submitApp(otherAccounts[2].address, otherAccounts[2].address, "My app #3", "metadataURI")
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))
      await endorseApp(app3Id, otherAccounts[2])

      await x2EarnApps
        .connect(creator4)
        .submitApp(otherAccounts[3].address, otherAccounts[3].address, "My app #4", "metadataURI")
      const app4Id = ethers.keccak256(ethers.toUtf8Bytes("My app #4"))
      await endorseApp(app4Id, otherAccounts[3])

      const apps1 = await x2EarnApps.getPaginatedApps(0, 2)
      expect(apps1.length).to.eql(2)

      const apps2 = await x2EarnApps.getPaginatedApps(2, 5)
      expect(apps2.length).to.eql(2)

      expect(apps1).to.not.eql(apps2)

      const allApps = await x2EarnApps.getPaginatedApps(0, 4)
      expect(allApps).to.eql([...apps1, ...apps2])
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

      const count = await x2EarnApps.appsCount()
      expect(count).to.eql(4n)

      const apps = await x2EarnApps.getPaginatedApps(0, 4)
      expect(apps.length).to.eql(4)

      await expect(x2EarnApps.getPaginatedApps(4, 4)).to.revertedWithCustomError(x2EarnApps, "X2EarnInvalidStartIndex")
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

      const appId = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(appId, otherAccounts[0])

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
      const appId = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(appId, otherAccounts[0])

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

      const appId = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(appId, otherAccounts[0])

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

      const appId = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await endorseApp(appId, otherAccounts[0])
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

// Isolated tests for shard16 because of the size of the tests
describe("X-Apps - @shard17", function () {
  // We prepare the environment for 4 creators
  let creator1: HardhatEthersSigner
  let creator2: HardhatEthersSigner

  beforeEach(async function () {
    const { creators } = await getOrDeployContractInstances({ forceDeploy: true })
    creator1 = creators[1]
    creator2 = creators[2]
  })

  describe("Admin address", function () {
    it("Admin can update the admin address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const admin = await x2EarnApps.appAdmin(app1Id)
      expect(admin).to.eql(otherAccounts[0].address)

      await x2EarnApps.connect(owner).setAppAdmin(app1Id, otherAccounts[1].address)

      const updatedAdmin = await x2EarnApps.appAdmin(app1Id)
      expect(updatedAdmin).to.eql(otherAccounts[1].address)
      expect(updatedAdmin).to.not.eql(admin)
    })

    it("Cannot update the admin address of a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const newAdminAddress = ethers.Wallet.createRandom().address

      await expect(x2EarnApps.connect(owner).setAppAdmin(app1Id, newAdminAddress)).to.be.rejected
    })

    it("Cannot set the admin address of an app to ZERO address", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await catchRevert(x2EarnApps.connect(otherAccounts[0]).setAppAdmin(app1Id, ZERO_ADDRESS))
    })

    it("User with DEFAULT_ADMIN_ROLE can update the admin address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const admin = await x2EarnApps.appAdmin(app1Id)
      expect(admin).to.eql(otherAccounts[0].address)

      await x2EarnApps.connect(otherAccounts[0]).setAppAdmin(app1Id, otherAccounts[1].address)

      const updatedAdmin = await x2EarnApps.appAdmin(app1Id)
      expect(updatedAdmin).to.eql(otherAccounts[1].address)
      expect(updatedAdmin).to.not.eql(admin)
    })

    it("Non admins cannot update the admin address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      // check that is not admin
      expect(await x2EarnApps.isAppAdmin(app1Id, otherAccounts[1].address)).to.eql(false)
      await catchRevert(x2EarnApps.connect(otherAccounts[1]).setAppAdmin(app1Id, otherAccounts[1].address))

      // user without DEFAULT_ADMIN_ROLE
      expect(await x2EarnApps.hasRole(await x2EarnApps.DEFAULT_ADMIN_ROLE(), otherAccounts[0].address)).to.eql(false)
      await catchRevert(x2EarnApps.connect(otherAccounts[1]).setAppAdmin(app1Id, otherAccounts[2].address))
    })
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
      await expect(x2EarnApps.connect(unauthorizedUser).updateAppMetadata(app1Id, newMetadataURI)).to.be.rejected

      const appURI = await x2EarnApps.appURI(app1Id)
      expect(appURI).to.eql((await x2EarnApps.baseURI()) + oldMetadataURI)
    })

    it("Cannot update metadata of non existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const newMetadataURI = "metadataURI2"

      await expect(x2EarnApps.connect(owner).updateAppMetadata(app1Id, newMetadataURI)).to.be.rejected
    })

    it("Cannot get app uri of non existing app", async function () {
      const { x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.appURI(app1Id)).to.be.rejected
    })
  })

  describe("Team wallet address", function () {
    it("Should be able to fetch app team wallet address", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const teamWalletAddress = await x2EarnApps.teamWalletAddress(app1Id)
      expect(teamWalletAddress).to.eql(otherAccounts[0].address)
    })

    it("Governance admin role can update the team wallet address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const appReceiverAddress1 = await x2EarnApps.teamWalletAddress(app1Id)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      await x2EarnApps.connect(owner).updateTeamWalletAddress(app1Id, otherAccounts[1].address)

      const appReceiverAddress2 = await x2EarnApps.teamWalletAddress(app1Id)
      expect(appReceiverAddress2).to.eql(otherAccounts[1].address)
      expect(appReceiverAddress1).to.not.eql(appReceiverAddress2)
    })

    it("App admin can update the team wallet address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")

      const appReceiverAddress1 = await x2EarnApps.teamWalletAddress(app1Id)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, appAdmin.address)
      expect(isAdmin).to.be.false

      expect(await x2EarnApps.isAppAdmin(app1Id, appAdmin.address)).to.be.true

      await x2EarnApps.connect(appAdmin).updateTeamWalletAddress(app1Id, otherAccounts[1].address)

      const appReceiverAddress2 = await x2EarnApps.teamWalletAddress(app1Id)
      expect(appReceiverAddress2).to.eql(otherAccounts[1].address)
      expect(appReceiverAddress1).to.not.eql(appReceiverAddress2)
    })

    it("Moderators cannot update the team wallet address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const appReceiverAddress1 = await x2EarnApps.teamWalletAddress(app1Id)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)

      const isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      await expect(x2EarnApps.connect(otherAccounts[1]).updateTeamWalletAddress(app1Id, otherAccounts[1].address)).to.be
        .rejected

      const appReceiverAddress2 = await x2EarnApps.teamWalletAddress(app1Id)
      expect(appReceiverAddress2).to.eql(appReceiverAddress1)
    })

    it("Moderators cannot update the team wallet address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const appReceiverAddress1 = await x2EarnApps.teamWalletAddress(app1Id)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)

      const isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      await expect(x2EarnApps.connect(otherAccounts[1]).updateTeamWalletAddress(app1Id, otherAccounts[1].address)).to.be
        .rejected

      const appReceiverAddress2 = await x2EarnApps.teamWalletAddress(app1Id)
      expect(appReceiverAddress2).to.eql(appReceiverAddress1)
    })

    it("Non-admin cannot update the team wallet address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const appReceiverAddress1 = await x2EarnApps.teamWalletAddress(app1Id)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, otherAccounts[1].address)
      expect(isAdmin).to.be.false

      await expect(x2EarnApps.connect(otherAccounts[1]).updateTeamWalletAddress(app1Id, otherAccounts[1].address)).to.be
        .rejected

      const appReceiverAddress2 = await x2EarnApps.teamWalletAddress(app1Id)
      expect(appReceiverAddress2).to.eql(appReceiverAddress1)
    })

    it("Cannot update the team wallet address of a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const newTeamWalletAddress = ethers.Wallet.createRandom().address

      await expect(x2EarnApps.connect(owner).updateTeamWalletAddress(app1Id, newTeamWalletAddress)).to.be.rejected
    })

    it("Team wallet address cannot be updated to ZERO address", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await catchRevert(x2EarnApps.connect(otherAccounts[0]).updateTeamWalletAddress(app1Id, ZERO_ADDRESS))
    })
  })

  describe("App Moderators", function () {
    it("By default there is no moderator for an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[0].address)
      expect(isModerator).to.be.false

      const moderators = await x2EarnApps.appModerators(app1Id)
      expect(moderators).to.eql([])
    })

    it("DEFAULT_ADMIN_ROLE can add a moderator to an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)

      const isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true
    })

    it("DEFAULT_ADMIN_ROLE can remove a moderator from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      let isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      await x2EarnApps.connect(owner).removeAppModerator(app1Id, otherAccounts[1].address)

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.false
    })

    it("App admin can add a moderator to an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, appAdmin.address)
      expect(isAdmin).to.be.false

      expect(await x2EarnApps.isAppAdmin(app1Id, appAdmin.address)).to.be.true

      await x2EarnApps.connect(appAdmin).addAppModerator(app1Id, otherAccounts[1].address)

      const isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true
    })

    it("App admin can remove a moderator from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")
      await x2EarnApps.connect(appAdmin).addAppModerator(app1Id, otherAccounts[1].address)
      await x2EarnApps.connect(appAdmin).addAppModerator(app1Id, otherAccounts[2].address)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, appAdmin.address)
      expect(isAdmin).to.be.false

      expect(await x2EarnApps.isAppAdmin(app1Id, appAdmin.address)).to.be.true

      let isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      await x2EarnApps.connect(appAdmin).removeAppModerator(app1Id, otherAccounts[2].address)

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[2].address)
      expect(isModerator).to.be.false

      expect(await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)).to.be.true
    })

    it("Can correctly fetch all moderators of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[2].address)

      const moderators = await x2EarnApps.appModerators(app1Id)
      expect(moderators).to.eql([otherAccounts[1].address, otherAccounts[2].address])
    })

    it("Can know if an address is a moderator of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)

      let isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[2].address)
      expect(isModerator).to.be.false
    })

    it("Cannot add a moderator to a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.connect(owner).addAppModerator(app1Id, owner.address)).to.be.rejected
    })

    it("Cannot remove a moderator from a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.connect(owner).removeAppModerator(app1Id, owner.address)).to.be.rejected
    })

    it("Cannot add ZERO_ADDRESS as a moderator of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(otherAccounts[0]).addAppModerator(app1Id, ZERO_ADDRESS)).to.be.rejected
    })

    it("Cannot remove ZERO_ADDRESS as a moderator of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(otherAccounts[0]).removeAppModerator(app1Id, ZERO_ADDRESS)).to.be.rejected
    })

    it("Non admin or user without DEFAULT_ADMIN_ROLE cannot add a moderator to an app", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.connect(otherAccounts[0]).addAppModerator(app1Id, otherAccounts[0].address)).to.be
        .rejected
    })

    it("Non admin or user without DEFAULT_ADMIN_ROLE cannot remove a moderator from an app", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.connect(otherAccounts[0]).removeAppModerator(app1Id, otherAccounts[0].address)).to.be
        .rejected
    })

    it("Removing a moderator from an app does not affect other moderators of the app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[2].address)

      let isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[2].address)
      expect(isModerator).to.be.true

      await x2EarnApps.connect(owner).removeAppModerator(app1Id, otherAccounts[1].address)

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.false

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[2].address)
      expect(isModerator).to.be.true
    })

    it("An error is thrown when trying to remove a non existing moderator from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(owner).removeAppModerator(app1Id, otherAccounts[1].address)).to.be.rejected
    })

    it("Cannot remove a moderator with ZERO_ADDRESS from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(owner).removeAppModerator(app1Id, ZERO_ADDRESS)).to.be.rejected
    })

    it("Cannot remove moderator of non existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.connect(owner).removeAppModerator(app1Id, owner.address)).to.be.rejected
    })

    it("Cannot have exceed the maximum number of moderators for an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")

      const limit = await x2EarnApps.MAX_MODERATORS()

      const addModeratorPromises = []
      for (let i = 1; i <= limit; i++) {
        const randomWallet = ethers.Wallet.createRandom()
        addModeratorPromises.push(x2EarnApps.connect(appAdmin).addAppModerator(app1Id, randomWallet.address))
      }

      // Wait for all addAppModerator transactions to complete
      await Promise.all(addModeratorPromises)

      await expect(x2EarnApps.connect(appAdmin).addAppModerator(app1Id, otherAccounts[10].address)).to.be.rejected

      // check that having 100 moderators do not affect the app
      const moderators = await x2EarnApps.appModerators(app1Id)
      expect(moderators.length).to.eql(100)

      // check that the last moderator is not the one that failed
      expect(moderators[99]).to.not.eql(otherAccounts[10].address)
      expect(await x2EarnApps.isAppModerator(app1Id, otherAccounts[10].address)).to.be.false
    })
  })

  describe("Reward distributors", function () {
    it("Admin can add a reward distributor to an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[1].address)

      const isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.true
    })

    it("Admin can remove a reward distributor from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[1].address)

      let isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.true

      await x2EarnApps.connect(owner).removeRewardDistributor(app1Id, otherAccounts[1].address)

      isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.false
    })

    it("Cannot add a reward distributor to a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await expect(x2EarnApps.connect(owner).addRewardDistributor(app1Id, owner.address)).to.be.rejected
    })

    it("Cannot remove a reward distributor from a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await expect(x2EarnApps.connect(owner).removeRewardDistributor(app1Id, owner.address)).to.be.rejected
    })

    it("Cannot add ZERO_ADDRESS as a reward distributor of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(otherAccounts[0]).addRewardDistributor(app1Id, ZERO_ADDRESS)).to.be.rejected
    })

    it("Cannot remove ZERO_ADDRESS as a reward distributor of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(otherAccounts[0]).removeRewardDistributor(app1Id, ZERO_ADDRESS)).to.be.rejected
    })

    it("Cannot remove a non existing reward distributor from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(owner).removeRewardDistributor(app1Id, otherAccounts[1].address)).to.be.rejected
    })

    it("When having more than one distributor, updating one address won't affect the others", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[1].address)
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[2].address)

      let isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.true

      isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[2].address)
      expect(isDistributor).to.be.true

      await x2EarnApps.connect(owner).removeRewardDistributor(app1Id, otherAccounts[1].address)

      isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.false

      isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[2].address)
      expect(isDistributor).to.be.true
    })

    it("Can correctly fetch all reward distributors of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[1].address)
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[2].address)

      const distributors = await x2EarnApps.rewardDistributors(app1Id)
      expect(distributors).to.eql([otherAccounts[1].address, otherAccounts[2].address])
    })

    it("Can know if an address is a reward distributor of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[1].address)

      let isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.true

      isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[2].address)
      expect(isDistributor).to.be.false
    })

    it("Cannot add a reward distributor to an app if not an admin", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await expect(x2EarnApps.connect(otherAccounts[0]).addRewardDistributor(app1Id, otherAccounts[1].address)).to.be
        .rejected
    })

    it("Cannot remove a reward distributor from an app if not an admin", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await expect(x2EarnApps.connect(otherAccounts[0]).removeRewardDistributor(app1Id, otherAccounts[1].address)).to.be
        .rejected
    })

    it("Cannot have exceed the maximum number of reward distributors for an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const limit = await x2EarnApps.MAX_REWARD_DISTRIBUTORS()
      const app1Id = await x2EarnApps.hashAppName("My app")
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")

      const addDistributorPromises = []
      for (let i = 1; i <= limit; i++) {
        const randomWallet = ethers.Wallet.createRandom()
        addDistributorPromises.push(x2EarnApps.connect(appAdmin).addRewardDistributor(app1Id, randomWallet.address))
      }

      // Wait for all addRewardDistributor transactions to complete
      await Promise.all(addDistributorPromises)

      await expect(x2EarnApps.connect(appAdmin).addRewardDistributor(app1Id, otherAccounts[10].address)).to.be.rejected

      // check that having 100 distributors do not affect the app
      const distributors = await x2EarnApps.rewardDistributors(app1Id)
      expect(distributors.length).to.eql(100)

      // check that the last distributor is not the one that failed
      expect(distributors[99]).to.not.eql(otherAccounts[10].address)
      expect(await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[10].address)).to.be.false
    })
  })

  describe("Team allocation percentage", function () {
    it("By default, the team allocation percentage of an app is 0", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(0n)
    })

    it("Admin can update the team allocation percentage of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 50)

      let teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(50n)

      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 60)

      teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(60n)
    })

    it("Admin can remove the team allocation percentage of an app by setting it to 0", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 50)

      let teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(50n)
    })

    it("Cannot update the team allocation percentage of a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const appId = await x2EarnApps.hashAppName("non-existing app")

      await expect(x2EarnApps.connect(owner).setTeamAllocationPercentage(appId, 50)).to.be.rejected
    })

    it("Cannot update the team allocation percentage of an app to more than 100", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 101)).to.be.rejected
    })

    it("Cannot update the team allocation percentage of an app to less than 0", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, -1)).to.be.rejected
    })

    it("Non-admin cannot update the team allocation percentage of an app", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await expect(x2EarnApps.connect(otherAccounts[0]).setTeamAllocationPercentage(app1Id, 50)).to.be.rejected
    })

    it("User with DEFAULT_ADMIN_ROLE can update the team allocation percentage of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 50)

      let teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(50n)
    })

    it("Team allocation percentage of an app is 0 and apps need to withdraw, then they can change this", async function () {
      const {
        x2EarnApps,
        otherAccounts,
        owner,
        xAllocationVoting,
        xAllocationPool,
        b3tr,
        x2EarnRewardsPool,
        veBetterPassport,
      } = await getOrDeployContractInstances({ forceDeploy: true })
      const voter = otherAccounts[1]

      await getVot3Tokens(voter, "1")

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.toggleCheck(1)

      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await endorseApp(app1Id, otherAccounts[0])
      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 0)

      let teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(0n)

      // start round
      await bootstrapAndStartEmissions()

      // vote
      let roundId = await xAllocationVoting.currentRoundId()
      await xAllocationVoting.connect(voter).castVote(roundId, [app1Id], [ethers.parseEther("1")])
      await waitForCurrentRoundToEnd()

      // get balance of team wallet address
      const teamWalletAddress = await x2EarnApps.teamWalletAddress(app1Id)
      const teamWalletBalanceBefore = await b3tr.balanceOf(teamWalletAddress)
      expect(teamWalletBalanceBefore).to.eql(0n)

      const x2EarnRewardsPoolBalanceBefore = await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())
      let appEarnings = await xAllocationPool.roundEarnings(roundId, app1Id)

      // admin claims for app
      await xAllocationPool.connect(owner).claim(roundId, app1Id)

      // all funds should have been sent to the x2EarnRewardsPool contract
      const teamWalletBalanceAfter = await b3tr.balanceOf(teamWalletAddress)
      const x2EarnRewardsPoolBalanceAfter = await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())
      expect(teamWalletBalanceAfter).to.eql(0n)
      expect(x2EarnRewardsPoolBalanceAfter).to.eql(x2EarnRewardsPoolBalanceBefore + appEarnings[0])

      // admin should be able to withdraw the funds
      await x2EarnRewardsPool.connect(otherAccounts[0]).withdraw(appEarnings[0], app1Id, "")
      const x2EarnRewardsPoolBalanceAfterWithdraw = await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())
      expect(x2EarnRewardsPoolBalanceAfterWithdraw).to.eql(x2EarnRewardsPoolBalanceAfter - appEarnings[0])
      const teamWalletBalanceAfterWithdraw = await b3tr.balanceOf(teamWalletAddress)
      expect(teamWalletBalanceAfterWithdraw).to.eql(appEarnings[0])

      // now we start a new round and the app can change the team allocation percentage
      await startNewAllocationRound()
      roundId = await xAllocationVoting.currentRoundId()
      await xAllocationVoting.connect(voter).castVote(roundId, [app1Id], [ethers.parseEther("1")])
      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 30)
      teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(30n)
      await waitForCurrentRoundToEnd()

      appEarnings = await xAllocationPool.roundEarnings(roundId, app1Id)

      // admin claims for app
      await xAllocationPool.connect(owner).claim(roundId, app1Id)

      // now the team wallet should have received some funds
      const teamWalletBalanceAfter2 = await b3tr.balanceOf(teamWalletAddress)
      expect(teamWalletBalanceAfter2).to.eql(teamWalletBalanceAfterWithdraw + (appEarnings[0] * 30n) / 100n)

      // 70% of funds should have been sent to the x2EarnRewardsPool contract
      const x2EarnRewardsPoolBalanceAfter2 = await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())
      expect(x2EarnRewardsPoolBalanceAfter2).to.eql(
        x2EarnRewardsPoolBalanceAfterWithdraw + (appEarnings[0] * 70n) / 100n,
      )

      // admin of app can deposit back the funds to the x2EarnRewardsPool
      await b3tr.connect(otherAccounts[0]).approve(await x2EarnRewardsPool.getAddress(), teamWalletBalanceAfter2)
      await x2EarnRewardsPool.connect(otherAccounts[0]).deposit(teamWalletBalanceAfter2.toString(), app1Id)
      const x2EarnRewardsPoolBalanceAfter3 = await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())
      expect(x2EarnRewardsPoolBalanceAfter3).to.eql(x2EarnRewardsPoolBalanceAfter2 + teamWalletBalanceAfter2)
      expect(await b3tr.balanceOf(teamWalletAddress)).to.eql(0n)
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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // Endorse XAPP with both Mjolnir node holders
      expect(await x2EarnApps.getNodeEndorsementScore(1)).to.eql(50n) // Node ID 1 has an endorsement score is 50
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Endorse with node holder 1
      expect(await x2EarnApps.getScore(app1Id)).to.eql(50n) // XAPP endorsement score is 50

      expect(await x2EarnApps.getNodeEndorsementScore(2)).to.eql(50n) // Node Id 2 has an endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Endorse with node holder 2
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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // Endorse XAPP with both Mjolnir node holder -> XAPP endorsement score is 50 -> XAPP is not eligible for XAllocation Voting
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

      expect(await x2EarnApps.nodeToEndorsedApp(1)).to.eql(app1Id) // Node ID 1 has endorsed app1Id

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)

      expect(await x2EarnApps.nodeToEndorsedApp(1)).to.not.eql(app1Id) // Node ID 1 should not have endorsed app1Id

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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await x2EarnApps.connect(otherAccounts[0]).removeNodeEndorsement(app1Id, 1)

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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

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
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)

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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)

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
      await x2EarnApps.connect(otherAccounts[2]).unendorseApp(app1Id, 2)

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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)

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
      await x2EarnApps.connect(otherAccounts[0]).removeNodeEndorsement(app1Id, 2)

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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)

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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)

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
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1)

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
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner, vechainNodesMock } =
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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // Skip ahead by a round so node is no longer in cooldown
      await startNewAllocationRound()

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

      await waitForCurrentRoundToEnd()
      // Skip ahead by a round so node is no longer in cooldown
      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      // XNode holder transfers its XNode
      const tokenId = await vechainNodesMock.ownerToId(otherAccounts[1].address)
      await vechainNodesMock
        .connect(otherAccounts[1])
        .transferFrom(otherAccounts[1].address, otherAccounts[3].address, tokenId)

      const tokenId1 = await vechainNodesMock.ownerToId(otherAccounts[3].address)
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
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // App should be pending endorsement -> score is 0 never endorsed
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // App is pending endorsent
      expect((await x2EarnApps.unendorsedApps()).length).to.eql(1)

      // Endorse XAPP with MjölnirX node holder
      const tx = await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100

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
      await createNodeHolder(7, otherAccounts[2]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
      await expect(x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2)).to.revertedWithCustomError(
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
      const { x2EarnApps, otherAccounts, owner, vechainNodesMock } = await getOrDeployContractInstances({
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
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      // App should be pending endorsement -> score is 0 never endorsed
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Start allocation round
      await startNewAllocationRound()

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100

      // Get XAPP score
      const score = await x2EarnApps.getScore(app1Id)

      // App should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Xnode holder should be listed as an endorser
      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers[0]).to.eql(otherAccounts[1].address)

      // XNode holder transfers its XNode
      const tokenId = await vechainNodesMock.ownerToId(otherAccounts[1].address)
      await vechainNodesMock
        .connect(otherAccounts[1])
        .transferFrom(otherAccounts[1].address, otherAccounts[3].address, tokenId)

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
      const { x2EarnApps, otherAccounts, owner, vechainNodesMock } = await getOrDeployContractInstances({
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
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // App should be pending endorsement -> score is 0 never endorsed
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100

      // App should not be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // Xnode holder should be listed as an endorser
      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers[0]).to.eql(otherAccounts[1].address)

      // Xnode holder loses its XNode status
      // Skip ahead 1 day
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      // XNode holder transfers its XNode
      const tokenId = await vechainNodesMock.ownerToId(otherAccounts[1].address)
      await vechainNodesMock.connect(owner).downgradeTo(tokenId, 0)

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

      await createNodeHolder(1, otherAccounts[1]) // Node strength level 1 corresponds (Thor) to an endorsement score of 10
      await createNodeHolder(2, otherAccounts[2]) // Node strength level 2 corresponds (Odin) to an endorsement score of 20
      await createNodeHolder(3, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(4, otherAccounts[4]) // Node strength level 4 corresponds (MjolnirX) to an endorsement score of 100
      await createNodeHolder(5, otherAccounts[5]) // Node strength level 5 corresponds (MjolnirX) to an endorsement score of 100
      await createNodeHolder(6, otherAccounts[6]) // Node strength level 6 corresponds (MjolnirX) to an endorsement score of 100
      await createNodeHolder(7, otherAccounts[7]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[1].address)).to.eql(2n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[2].address)).to.eql(13n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[3].address)).to.eql(50n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[4].address)).to.eql(3n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[5].address)).to.eql(9n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[6].address)).to.eql(35n)
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[7].address)).to.eql(100n)

      expect(await x2EarnApps.getNodeEndorsementScore(1)).to.eql(2n)
      expect(await x2EarnApps.getNodeEndorsementScore(2)).to.eql(13n)
      expect(await x2EarnApps.getNodeEndorsementScore(3)).to.eql(50n)
      expect(await x2EarnApps.getNodeEndorsementScore(4)).to.eql(3n)
      expect(await x2EarnApps.getNodeEndorsementScore(5)).to.eql(9n)
      expect(await x2EarnApps.getNodeEndorsementScore(6)).to.eql(35n)
      expect(await x2EarnApps.getNodeEndorsementScore(7)).to.eql(100n)

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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

      // App not pending endorsement
      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      // Should revert if random user calls removeNodeEndorsement
      await expect(x2EarnApps.connect(otherAccounts[10]).removeNodeEndorsement(app1Id, 1)).to.be.reverted

      // Should not revert if xapp admin user calls removeNodeEndorsement
      await expect(x2EarnApps.connect(otherAccounts[0]).removeNodeEndorsement(app1Id, 1)).to.not.be.reverted

      // Should not revert if default admin user calls removeNodeEndorsement
      await expect(x2EarnApps.connect(owner).removeNodeEndorsement(app1Id, 2)).to.not.be.reverted
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
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100

      // Should reverts as node id that is not an endorser is passed in
      await expect(x2EarnApps.connect(owner).removeNodeEndorsement(app1Id, 10)).to.be.reverted

      // Should not revert as node id that is an endorser is passed in
      await expect(x2EarnApps.connect(owner).removeNodeEndorsement(app1Id, 1)).to.not.be.reverted
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
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // App should be pending endorsement -> score is 0 never endorsed
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100

      // Should revert as endorser is already endorsing an XApp
      await expect(x2EarnApps.connect(otherAccounts[1]).endorseApp(app2Id, 2)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonNodeHolder",
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
      await createNodeHolder(7, otherAccounts[1])

      // Should revert as endorser is already endorsing an XApp
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)).to.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNonexistentApp",
      )
    })

    it("Cannot unendorse an XAPP if not an endorser", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // User should be a node holder to by pass first check
      await createNodeHolder(7, otherAccounts[1])

      // Register XAPPs -> XAPP is pending endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      // AppId that does not exist
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Should revert as user is not an endorser
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)).to.revertedWithCustomError(
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
      await createNodeHolder(7, otherAccounts[0]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[0]).endorseApp(app1Id, 1) // Node holder endorsement score is 100

      // Blacklist XAPP
      await x2EarnApps.connect(owner).setVotingEligibility(app1Id, false)

      // Should not revert as endorser if the XAPP is blacklisted
      await expect(x2EarnApps.connect(otherAccounts[0]).unendorseApp(app1Id, 1)).to.not.be.reverted

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

      await expect(x2EarnApps.connect(otherAccounts[0]).endorseApp(app2Id, 1)).to.not.be.reverted
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
      await createNodeHolder(7, otherAccounts[0]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Endorse XAPP with MjölnirX node holder
      await x2EarnApps.connect(otherAccounts[0]).endorseApp(app1Id, 1) // Node holder endorsement score is 100

      // Should not revert as endorser if the XAPP is blacklisted
      await expect(x2EarnApps.connect(otherAccounts[0]).unendorseApp(app1Id, 1)).to.not.be.reverted

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

      await expect(x2EarnApps.connect(otherAccounts[0]).endorseApp(app2Id, 1)).to.not.be.reverted

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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

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

      await endorseApp(app1Id, otherAccounts[1])

      // Get app security level
      const appSecurityLevel = await veBetterPassport.appSecurity(app1Id)
      expect(appSecurityLevel).to.eql(1n)

      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1) // Node holder removes their endorsement

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

      await endorseApp(app1Id, otherAccounts[1])
      await endorseApp(app2Id, otherAccounts[2])

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
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)
      await x2EarnApps.connect(otherAccounts[2]).unendorseApp(app2Id, 2)

      // Check endorsement
      await x2EarnApps.checkEndorsement(app1Id)
      await x2EarnApps.checkEndorsement(app2Id)

      // App security level should be NONE
      expect(await veBetterPassport.appSecurity(app1Id)).to.eql(0n)
      expect(await veBetterPassport.appSecurity(app2Id)).to.eql(0n)

      // Re-endorse apps
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1)
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app2Id, 2)

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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

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
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).unendorseApp(app1Id, 2) // Node holder endorsement score is 50

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

    it("An XAPP that has been removed from black list, but did not reach score threshold pre blacklist, but node has increased score since so that XApp now has a score greater than 100, they should not be peding endorsement ", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, owner, vechainNodesMock } =
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
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await createNodeHolder(1, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 2

      // Endorse XAPP with node holder -> combined endorsement score is 63 -> less than 100
      await x2EarnApps.connect(owner).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 2

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
      // XNode holder increases its node strength by getting a new node while XAPP is blacklisted

      const tokenId2 = await vechainNodesMock.ownerToId(otherAccounts[2].address)
      await vechainNodesMock.upgradeTo(tokenId2, 7)

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

      await createNodeHolder(0, otherAccounts[0]) // Node strength level 0 corresponds (None) to an endorsement score of 0
      await createNodeHolder(1, otherAccounts[1]) // Node strength level 1 corresponds (Strength) to an endorsement score of 2
      await createNodeHolder(2, otherAccounts[2]) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await createNodeHolder(3, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(4, otherAccounts[4]) // Node strength level 4 corresponds (VeThorX) to an endorsement score of 3
      await createNodeHolder(5, otherAccounts[5]) // Node strength level 5 corresponds (StrengthX) to an endorsement score of 9
      await createNodeHolder(6, otherAccounts[6]) // Node strength level 6 corresponds (ThunderX) to an endorsement score of 35
      await createNodeHolder(7, otherAccounts[7]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Get endorsement score
      expect(await x2EarnApps.getUsersEndorsementScore(otherAccounts[0].address)).to.eql(0n) // Node strength level 0 corresponds (None) to an endorsement score of 0
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

      await createNodeHolder(0, otherAccounts[0]) // Node strength level 0 corresponds (None) to an endorsement score of 0
      await createNodeHolder(1, otherAccounts[1]) // Node strength level 1 corresponds (Strength) to an endorsement score of 2
      await createNodeHolder(2, otherAccounts[2]) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await createNodeHolder(3, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(4, otherAccounts[4]) // Node strength level 4 corresponds (VeThorX) to an endorsement score of 3
      await createNodeHolder(5, otherAccounts[5]) // Node strength level 5 corresponds (StrengthX) to an endorsement score of 9
      await createNodeHolder(6, otherAccounts[6]) // Node strength level 6 corresponds (ThunderX) to an endorsement score of 35
      await createNodeHolder(7, otherAccounts[7]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

      // Get endorsement score
      expect(await x2EarnApps.getNodeEndorsementScore(1)).to.eql(0n) // Node strength level 0 corresponds (None) to an endorsement score of 0
      expect(await x2EarnApps.getNodeEndorsementScore(2)).to.eql(2n) // Node strength level 1 corresponds (Strength) to an endorsement score of 2
      expect(await x2EarnApps.getNodeEndorsementScore(3)).to.eql(13n) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      expect(await x2EarnApps.getNodeEndorsementScore(4)).to.eql(50n) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      expect(await x2EarnApps.getNodeEndorsementScore(5)).to.eql(3n) // Node strength level 4 corresponds (VeThorX) to an endorsement score of 3
      expect(await x2EarnApps.getNodeEndorsementScore(6)).to.eql(9n) // Node strength level 5 corresponds (StrengthX) to an endorsement score of 9
      expect(await x2EarnApps.getNodeEndorsementScore(7)).to.eql(35n) // Node strength level 6 corresponds (ThunderX) to an endorsement score of 35
      expect(await x2EarnApps.getNodeEndorsementScore(8)).to.eql(100n) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
    })

    it("If an XAPP has a score less than 100 but one of its endorsers increases the node strength when endorsement status is checked they will be endorsed ", async function () {
      const { x2EarnApps, otherAccounts, owner, vechainNodesMock } = await getOrDeployContractInstances({
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
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // Endorse XAPP with node holder -> combined endorsement score is 63 -> less than 100
      await x2EarnApps.connect(owner).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app1Id, 2) // Node holder endorsement score is 50

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
      const tokenId2 = await vechainNodesMock.ownerToId(otherAccounts[2].address)
      await vechainNodesMock.upgradeTo(tokenId2, 7)

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
      const { x2EarnApps, otherAccounts, owner, vechainNodesMock } = await getOrDeployContractInstances({
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
      await createNodeHolder(7, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      // Endorse XAPP with node holder
      await x2EarnApps.connect(owner).endorseApp(app1Id, 1) // Node holder endorsement score 100

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
      const tokenId = await vechainNodesMock.ownerToId(owner.address)
      await vechainNodesMock.connect(owner).transfer(otherAccounts[0].address, tokenId)

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
      await x2EarnApps.connect(otherAccounts[0]).unendorseApp(app1Id, 1)

      // app should be pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(true)

      // check endorsers should be 0
      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers.length).to.eql(0)

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(2)

      // should be able to endorse new XAPP
      await x2EarnApps.connect(otherAccounts[0]).endorseApp(app2Id, 1) // Node holder endorsement score 100

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
      const { x2EarnApps, otherAccounts, owner, vechainNodesMock } = await getOrDeployContractInstances({
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
          amount: unitsUtils.parseVET("200000"),
        })
      })

      // aidrop VTHO
      await airdropVTHO(seedAccounts, accounts[2])

      for (let i = 0; i < 50; i++) {
        // Create two node holders with an endorsement score
        await vechainNodesMock.addToken(accounts[i].address, level, false, 0, 0)

        const clauses = [
          clauseBuilder.functionInteraction(
            await x2EarnApps.getAddress(),
            coder
              .createInterface(JSON.stringify(X2EarnApps__factory.abi))
              .getFunction("endorseApp") as FunctionFragment,
            [app1Id],
          ),
        ]

        const body: TransactionBody = await buildTxBody(clauses, accounts[i].address, 32, 10_000_000)

        if (!accounts[i].pk) throw new Error("No private key")

        await signAndSendTx(body, accounts[i].pk)
      }

      const endorsers = await x2EarnApps.getEndorsers(app1Id)
      expect(endorsers.length).to.eql(50)

      const tx = await x2EarnApps.checkEndorsement(app1Id)
      const receipt = await tx.wait()

      console.log(receipt?.gasUsed)
    })

    it("A user with a XNODE node delegated to them can endorse an XAPP", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement } = await getOrDeployContractInstances({
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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50
      await createNodeHolder(3, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // delegate node to user
      await nodeManagement.connect(otherAccounts[1]).delegateNode(otherAccounts[3].address) // Other account 1 delegates node to other account 3
      await nodeManagement.connect(otherAccounts[2]).delegateNode(otherAccounts[4].address) // Other account 2 delegates node to other account 4

      // Endorse XAPP with both Mjolnir node holders
      await x2EarnApps.connect(otherAccounts[3]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      expect(await x2EarnApps.getScore(app1Id)).to.eql(50n) // XAPP endorsement score is 50
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, 2) // Node holder endorsement score is 50
      expect(await x2EarnApps.getScore(app1Id)).to.eql(100n) // XAPP endorsement score is now 100

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)
    })

    it("A user with a XNODE node delegated to them can endorse an XAPP and the delegated XNODE owner cannot", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement } = await getOrDeployContractInstances({
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
      await createNodeHolder(3, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 50

      // delegate node to user
      await nodeManagement.connect(otherAccounts[1]).delegateNode(otherAccounts[3].address) // Other account 1 delegates node to other account 3

      await expect(x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 2)).to.be.reverted // Node owner cannot endorse XAPP as node is delegated

      // Endorse XAPP with both Mjolnir node holders
      await x2EarnApps.connect(otherAccounts[3]).endorseApp(app1Id, 1) // Node holder endorsement score is 50
      expect(await x2EarnApps.getScore(app1Id)).to.eql(50n) // XAPP endorsement score is 50
    })

    it("A user with multiple nodes delegated to them can endorse multiple apps", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement } = await getOrDeployContractInstances({
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
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 100
      await createNodeHolder(7, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 100
      await createNodeHolder(7, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 100

      // delegate node to user
      await nodeManagement.connect(otherAccounts[1]).delegateNode(otherAccounts[4].address) // Other account 1 delegates node to other account 4
      await nodeManagement.connect(otherAccounts[2]).delegateNode(otherAccounts[4].address) // Other account 2 delegates node to other account 4
      await nodeManagement.connect(otherAccounts[3]).delegateNode(otherAccounts[4].address) // Other account 3 delegates node to other account 4

      // Account 4 endorses all 3 XAPPs
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, 1) // Node holder endorsement score is 100 -> XAPP endorse with token Id 1
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app2Id, 2) // Node holder endorsement score is 100 -> XAPP endorse with token Id 2
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app3Id, 3) // Node holder endorsement score is 100 -> XAPP endorse with token Id 3

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([otherAccounts[4].address])
      expect(await x2EarnApps.getEndorsers(app2Id)).to.eql([otherAccounts[4].address])
      expect(await x2EarnApps.getEndorsers(app3Id)).to.eql([otherAccounts[4].address])
    })

    it("A user with multiple nodes delegated to them can endorse the same app multiple times", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement } = await getOrDeployContractInstances({
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
      await createNodeHolder(6, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35
      await createNodeHolder(6, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35
      await createNodeHolder(6, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35

      // delegate node to user
      await nodeManagement.connect(otherAccounts[1]).delegateNode(otherAccounts[4].address) // Other account 1 delegates node to other account 4
      await nodeManagement.connect(otherAccounts[2]).delegateNode(otherAccounts[4].address) // Other account 2 delegates node to other account 4
      await nodeManagement.connect(otherAccounts[3]).delegateNode(otherAccounts[4].address) // Other account 3 delegates node to other account 4

      // Account 4 endorses all 3 XAPPs
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, 1) // Node holder endorsement score is 35 -> XAPP endorse with token Id 1
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, 2) // Node holder endorsement score is 35 -> XAPP endorse with token Id 2
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, 3) // Node holder endorsement score is 35 -> XAPP endorse with token Id 3

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
      await createNodeHolder(7, otherAccounts[1])
      await createNodeHolder(7, otherAccounts[2])

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1) // Node holder endorsement score is 100
      await x2EarnApps.connect(otherAccounts[2]).endorseApp(app2Id, 2) // Node holder endorsement score is 50

      expect(await x2EarnApps.nodeToEndorsedApp(1)).to.eql(app1Id) // Node ID 1 has endorsed app1Id

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      // App is not pending endorsement
      expect(await x2EarnApps.isAppUnendorsed(app1Id)).to.eql(false)

      // remove endorsement from one of the node holders
      const tx = await expect(
        x2EarnApps.connect(otherAccounts[2]).unendorseApp(app1Id, 2),
      ).to.be.revertedWithCustomError(x2EarnApps, "X2EarnNonEndorser")
    })

    it("A user with multiple nodes delegated to them can endorse the same app multiple times", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement } = await getOrDeployContractInstances({
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
      await createNodeHolder(6, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35
      await createNodeHolder(6, otherAccounts[2]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35
      await createNodeHolder(6, otherAccounts[3]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35

      // delegate node to user
      await nodeManagement.connect(otherAccounts[1]).delegateNode(otherAccounts[4].address) // Other account 1 delegates node to other account 4
      await nodeManagement.connect(otherAccounts[2]).delegateNode(otherAccounts[4].address) // Other account 2 delegates node to other account 4
      await nodeManagement.connect(otherAccounts[3]).delegateNode(otherAccounts[4].address) // Other account 3 delegates node to other account 4

      // Account 4 endorses all 3 XAPPs
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, 1) // Node holder endorsement score is 35 -> XAPP endorse with token Id 1
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, 2) // Node holder endorsement score is 35 -> XAPP endorse with token Id 2
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, 3) // Node holder endorsement score is 35 -> XAPP endorse with token Id 3

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([
        otherAccounts[4].address,
        otherAccounts[4].address,
        otherAccounts[4].address,
      ]) // TODO: Should be unique endorsers getting returned -> need efficient way to check for unique endorsers
    })

    it("An XAPP who was endorsed by delegated node remains endorsed by XNode when delegation is revoked", async function () {
      const { x2EarnApps, otherAccounts, owner, nodeManagement } = await getOrDeployContractInstances({
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
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 3 corresponds (Mjolnir) to an endorsement score of 35

      // delegate node to user
      await nodeManagement.connect(otherAccounts[1]).delegateNode(otherAccounts[4].address) // Other account 1 delegates node to other account 4

      // Account 4 endorses all 3 XAPPs
      await x2EarnApps.connect(otherAccounts[4]).endorseApp(app1Id, 1) // Node holder endorsement score is 35 -> XAPP endorse with token Id 1

      const appIdsPendingEndorsement2 = await x2EarnApps.unendorsedAppIds()
      expect(appIdsPendingEndorsement2.length).to.eql(0)

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([otherAccounts[4].address])

      // revoke delegation -> Ownner of the node becomes the manager again
      await nodeManagement.connect(otherAccounts[1]).removeNodeDelegation()

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

      await endorseApp(app1Id, owner)

      // app should be eligible for voting
      expect(await x2EarnApps.isEligibleNow(app1Id)).to.eql(true)

      let round1 = await startNewAllocationRound()

      // app should be eligible for the current round
      let isEligibleForVote = await xAllocationVoting.isEligibleForVote(app1Id, round1)
      expect(isEligibleForVote).to.eql(true)

      await x2EarnApps.connect(owner).unendorseApp(app1Id, 1)

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

      const node = await createNodeHolder(7, otherAccounts[1])

      await startNewAllocationRound()

      // Node should NOT be in cooldown period after being minted
      expect(await x2EarnApps.checkCooldown(node)).to.eql(false)

      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1)

      // Node should be in cooldown period -> New round has not yet started
      expect(await x2EarnApps.checkCooldown(node)).to.eql(true)

      // Node holder should not be able to unendorse XAPP
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNodeCooldownActive",
      )

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([otherAccounts[1].address])

      // Node should be out of cooldown period when new round starts
      await waitForCurrentRoundToEnd()
      await startNewAllocationRound()

      // Node should be out of cooldown period
      expect(await x2EarnApps.checkCooldown(node)).to.eql(false)

      // Node holder should be able to unendorse XAPP
      await x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)

      // App should not have any endorsers
      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([])

      // Can endorse again
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1)

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

      const node = await createNodeHolder(7, otherAccounts[1])

      await startNewAllocationRound()

      // Node should be out of cooldown period
      expect(await x2EarnApps.checkCooldown(node)).to.eql(false)

      // Node holder should be able to endorse XAPP
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app1Id, 1)

      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([otherAccounts[1].address])

      // Node should be in cooldown period after endorsing XAPP cannot unendorse
      expect(await x2EarnApps.checkCooldown(node)).to.eql(true)

      // Will revert if node holder tries to unendorse XAPP
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)).to.be.revertedWithCustomError(
        x2EarnApps,
        "X2EarnNodeCooldownActive",
      )

      // If XApp removes endorsement they should not be in cooldown period
      await x2EarnApps.connect(otherAccounts[0]).removeNodeEndorsement(app1Id, node)

      // Node should be out of cooldown period
      expect(await x2EarnApps.checkCooldown(node)).to.eql(false)

      // Node holder should be able to endorse XAPP
      await x2EarnApps.connect(otherAccounts[1]).endorseApp(app2Id, 1)

      // App 1 should not have any endorsers
      expect(await x2EarnApps.getEndorsers(app1Id)).to.eql([])
      // App 2 should have endorsers
      expect(await x2EarnApps.getEndorsers(app2Id)).to.eql([otherAccounts[1].address])

      // Cannot unendorse as node is in cooldown period
      await expect(x2EarnApps.connect(otherAccounts[1]).unendorseApp(app1Id, 1)).to.be.revertedWithCustomError(
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

      const node = await createNodeHolder(7, owner)

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

      await x2EarnApps.connect(owner).endorseApp(app1Id, node)

      expect(await x2EarnApps.checkCooldown(node)).to.eql(true)

      // Contract admin updates the cooldown period
      await x2EarnApps.updateCooldownPeriod(0)

      // Node should no longer be in cooldown period
      expect(await x2EarnApps.checkCooldown(node)).to.eql(false)
    })

    it("Cooldown period should end when a new round starts regardless of when app was last enedorsed", async function () {
      const config = createLocalConfig()
      config.X2EARN_NODE_COOLDOWN_PERIOD = 1
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const node = await createNodeHolder(7, owner)

      // Round 1
      await startNewAllocationRound()
      const app1Id = await x2EarnApps.hashAppName(otherAccounts[0].address)

      // Register XAPP -> XAPP is pedning endorsement
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await x2EarnApps.connect(owner).endorseApp(app1Id, node)

      // Should be in cooldown period
      expect(await x2EarnApps.checkCooldown(node)).to.eql(true)

      // Start new round
      await waitForCurrentRoundToEnd()
      await startNewAllocationRound()

      // Node should no longer be in cooldown period
      expect(await x2EarnApps.checkCooldown(node)).to.eql(false)

      // Update cooldown period to 2 rounds
      await x2EarnApps.updateCooldownPeriod(2)

      // Node should no longer be in cooldown period
      expect(await x2EarnApps.checkCooldown(node)).to.eql(true)

      // Node should no longer be in cooldown period in the next round
      await waitForCurrentRoundToEnd()
      await startNewAllocationRound()

      // Node should no longer be in cooldown period
      expect(await x2EarnApps.checkCooldown(node)).to.eql(false)
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
  })
})
