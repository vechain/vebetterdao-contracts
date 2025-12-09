import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { expect } from "chai"
import { ethers } from "hardhat"
import { describe, it } from "mocha"

import { APPS } from "../../scripts/deploy/setup"
import { deployAndUpgrade, deployProxy, deployProxyOnly, initializeProxy, upgradeProxy } from "../../scripts/helpers"
import { getTestKeys } from "../../scripts/helpers/seedAccounts"
import {
  B3TRGovernor,
  Emissions,
  GalaxyMemberV3,
  VeBetterPassport,
  VeBetterPassportV1,
  VoterRewards,
  X2EarnApps,
  X2EarnAppsV1,
  X2EarnAppsV2,
  X2EarnAppsV3,
  X2EarnAppsV4,
  X2EarnAppsV5,
  X2EarnAppsV6,
  X2EarnRewardsPool,
  X2EarnRewardsPoolV4,
  XAllocationPool,
  XAllocationPoolV3,
  XAllocationVotingV3,
} from "../../typechain-types"
import {
  catchRevert,
  getOrDeployContractInstances,
  getStorageSlots,
  getTwoUniqueRandomIndices,
  getVot3Tokens,
  startNewAllocationRound,
  waitForBlock,
  waitForCurrentRoundToEnd,
} from "../helpers"
import { createLegacyNodeHolder } from "../helpers/xnodes"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("Contract upgradeablity @shard15e", () => {
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

    await expect(x2EarnApps.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be.reverted

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

    expect(await x2EarnApps.version()).to.equal("7")
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
    await createLegacyNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
    await createLegacyNodeHolder(7, otherAccounts[2]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
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
      administrationUtilsV5,
      endorsementUtilsV5,
      voteEligibilityUtilsV5,
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
    const nodeId1 = await createLegacyNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
    const nodeId2 = await createLegacyNodeHolder(7, otherAccounts[2]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

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
    await x2EarnAppsV2.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
    await x2EarnAppsV2.connect(otherAccounts[2]).endorseApp(app2Id, nodeId2) // Node holder endorsement score is 100

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
    await x2EarnAppsV2.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
    expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(true)
    await x2EarnAppsV2.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
    expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(false)
    await x2EarnAppsV2.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
    expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(true)
    await x2EarnAppsV2.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
    expect(await x2EarnAppsV2.isAppUnendorsed(app1Id)).to.eql(false)

    // Create new node holders with an endorsement score of 100
    const nodeId3 = await createLegacyNodeHolder(7, otherAccounts[5]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
    const nodeId4 = await createLegacyNodeHolder(7, otherAccounts[6]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

    // app3Id just gets endorsed
    await x2EarnAppsV2.connect(otherAccounts[6]).endorseApp(app3Id, nodeId4)

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
    expect(await x2EarnAppsV3.checkCooldown(nodeId3)).to.eql(false)
    expect(await x2EarnAppsV3.checkCooldown(nodeId4)).to.eql(false)

    // Node holders that endorsed an app prior to upgrade should not be subject to cooldown period
    expect(await x2EarnAppsV3.checkCooldown(nodeId1)).to.eql(false)

    // If a node holder that endorsed an app prior to upgrade performs an action they should be subject to cooldown period
    await x2EarnAppsV3.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
    await x2EarnAppsV3.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100

    expect(await x2EarnAppsV3.checkCooldown(nodeId1)).to.eql(true)

    // Should revert if user in cooldown period tries to endorse an app
    await catchRevert(x2EarnAppsV3.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1))

    await x2EarnAppsV3
      .connect(creator1)
      .submitApp(otherAccounts[4].address, otherAccounts[4].address, "My app 4", "metadataURI")
    const app4Id = ethers.keccak256(ethers.toUtf8Bytes("My app 4"))

    // New node holders should be subject to cooldown period
    await catchRevert(x2EarnAppsV3.connect(otherAccounts[6]).endorseApp(app4Id, nodeId4))

    // Fast forward time to next round
    // wait for round to end
    await waitForCurrentRoundToEnd()

    await startNewAllocationRound()

    // New node holders should not be subject to cooldown period
    expect(await x2EarnAppsV3.checkCooldown(nodeId1)).to.eql(false)
    expect(await x2EarnAppsV3.checkCooldown(nodeId2)).to.eql(false)
    expect(await x2EarnAppsV3.checkCooldown(nodeId3)).to.eql(false)

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
    expect(await x2EarnAppsV4.checkCooldown(nodeId1)).to.eql(false)

    // If a node holder that endorsed an app prior to upgrade performs an action they should be subject to cooldown period
    await x2EarnAppsV4.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
    await x2EarnAppsV4.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
    expect(await x2EarnAppsV4.checkCooldown(nodeId1)).to.eql(true)

    // Should revert if user in cooldown period tries to endorse an app
    await catchRevert(x2EarnAppsV4.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1))

    await x2EarnAppsV4
      .connect(creator2)
      .submitApp(otherAccounts[4].address, otherAccounts[4].address, "My app 5", "metadataURI")
    const app5Id = ethers.keccak256(ethers.toUtf8Bytes("My app 5"))

    // New node holders should be subject to cooldown period
    await catchRevert(x2EarnAppsV4.connect(otherAccounts[6]).endorseApp(app5Id, nodeId4))

    // Fast forward time to next round
    // wait for round to end
    await waitForCurrentRoundToEnd()
    await startNewAllocationRound()

    // New node holders should not be subject to cooldown period
    expect(await x2EarnAppsV4.checkCooldown(nodeId1)).to.eql(false)
    expect(await x2EarnAppsV4.checkCooldown(nodeId2)).to.eql(false)
    expect(await x2EarnAppsV4.checkCooldown(nodeId3)).to.eql(false)

    // Upgrade X2EarnAppsV4 to X2EarnAppsV5
    const x2EarnAppsV5 = (await upgradeProxy("X2EarnAppsV4", "X2EarnAppsV5", await x2EarnAppsV4.getAddress(), [], {
      version: 5,
      libraries: {
        AdministrationUtilsV5: await administrationUtilsV5.getAddress(),
        EndorsementUtilsV5: await endorsementUtilsV5.getAddress(),
        VoteEligibilityUtilsV5: await voteEligibilityUtilsV5.getAddress(),
      },
    })) as X2EarnAppsV5

    // New node holders should not be subject to cooldown period
    expect(await x2EarnAppsV5.checkCooldown(nodeId1)).to.eql(false)
    expect(await x2EarnAppsV5.checkCooldown(nodeId2)).to.eql(false)
    expect(await x2EarnAppsV5.checkCooldown(nodeId3)).to.eql(false)

    // If a node holder that endorsed an app prior to upgrade performs an action they should be subject to cooldown period
    await x2EarnAppsV5.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
    await x2EarnAppsV5.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1) // Node holder endorsement score is 100
    expect(await x2EarnAppsV5.checkCooldown(nodeId1)).to.eql(true)

    // Should revert if user in cooldown period tries to endorse an app
    await catchRevert(x2EarnAppsV5.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1))

    // Should revert if user in cooldown period tries to unendorse an app
    await catchRevert(x2EarnAppsV5.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1))

    // Should revert if user in cooldown period tries to endorse an app
    await catchRevert(x2EarnAppsV5.connect(otherAccounts[1]).endorseApp(app1Id, nodeId1))

    // Should revert if user in cooldown period tries to unendorse an app
    await catchRevert(x2EarnAppsV5.connect(otherAccounts[1]).unendorseApp(app1Id, nodeId1))
    await x2EarnAppsV5
      .connect(creator3)
      .submitApp(otherAccounts[4].address, otherAccounts[4].address, "My app 6", "metadataURI")
    const app6Id = ethers.keccak256(ethers.toUtf8Bytes("My app 6"))
    // New node holders should be subject to cooldown period
    await catchRevert(x2EarnAppsV5.connect(otherAccounts[6]).endorseApp(app6Id, nodeId4))

    // Fast forward time to next round
    // wait for round to end
    await waitForCurrentRoundToEnd()
    await startNewAllocationRound()

    // New node holders should not be subject to cooldown period
    expect(await x2EarnAppsV5.checkCooldown(nodeId1)).to.eql(false)
    expect(await x2EarnAppsV5.checkCooldown(nodeId2)).to.eql(false)
    expect(await x2EarnAppsV5.checkCooldown(nodeId3)).to.eql(false)
  })

  it("Should not have state conflict after upgrading to V6", async () => {
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
      administrationUtilsV5,
      endorsementUtilsV5,
      voteEligibilityUtilsV5,
      administrationUtilsV6,
      endorsementUtilsV6,
      voteEligibilityUtilsV6,
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
    await createLegacyNodeHolder(7, otherAccounts[1]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
    await createLegacyNodeHolder(7, otherAccounts[2]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100

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

    await createLegacyNodeHolder(7, otherAccounts[4]) // Node strength level 7 corresponds (MjolnirX) to an endorsement score of 100
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
    const x2EarnAppsV5 = (await upgradeProxy("X2EarnAppsV4", "X2EarnAppsV5", await x2EarnAppsV4.getAddress(), [], {
      version: 5,
      libraries: {
        AdministrationUtilsV5: await administrationUtilsV5.getAddress(),
        EndorsementUtilsV5: await endorsementUtilsV5.getAddress(),
        VoteEligibilityUtilsV5: await voteEligibilityUtilsV5.getAddress(),
      },
    })) as X2EarnAppsV5

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

    // Upgrade to V6
    const x2EarnAppsV6 = (await upgradeProxy("X2EarnAppsV5", "X2EarnAppsV6", await x2EarnAppsV5.getAddress(), [], {
      version: 6,
      libraries: {
        AdministrationUtilsV6: await administrationUtilsV6.getAddress(),
        EndorsementUtilsV6: await endorsementUtilsV6.getAddress(),
        VoteEligibilityUtilsV6: await voteEligibilityUtilsV6.getAddress(),
      },
    })) as X2EarnAppsV6

    expect(await x2EarnAppsV6.x2EarnRewardsPoolContract()).to.eql(await x2EarnRewardsPool.getAddress())

    // check the storage slots for each module
    // Administion utils
    const storageSlotsAdministrationAfterV6 = await getStorageSlots(
      await x2EarnAppsV2.getAddress(),
      initialSlotAdministration,
    )
    // Vote eligibility utils
    const storageSlotsVoteEligibilityAfterV6 = await getStorageSlots(
      await x2EarnAppsV2.getAddress(),
      initialSlotVoteEligibility,
    )
    // Settings utils
    const storageSlotsSettingsAfterV6 = await getStorageSlots(await x2EarnAppsV2.getAddress(), initialSlotSettings)
    // Apps storage
    const storageSlotsAppsStorageAfterV6 = await getStorageSlots(
      await x2EarnAppsV2.getAddress(),
      initialSlotAppsStorage,
    )
    // Endorsement slot
    const storageSlotsEndorsementSlotAfterV6 = await getStorageSlots(
      await x2EarnAppsV2.getAddress(),
      initialEndorsementSlot,
    )

    // Check that the storage slots are the same for the administration module
    for (let i = 0; i < storageSlotsAdministrationAfterV6.length; i++) {
      expect(storageSlotsAdministrationAfterV6[i]).to.equal(storageSlotsAdministrationAfterV5[i])
    }
    // Check that the storage slots are the same for the vote eligibility module
    for (let i = 0; i < storageSlotsVoteEligibilityAfterV6.length; i++) {
      expect(storageSlotsVoteEligibilityAfterV6[i]).to.equal(storageSlotsVoteEligibilityAfterV5[i])
    }
    // Check that the storage slots are the same for the settings module
    for (let i = 0; i < storageSlotsSettingsAfterV6.length; i++) {
      expect(storageSlotsSettingsAfterV6[i]).to.equal(storageSlotsSettingsAfterV5[i])
    }
    // Check that the storage slots are the same for the apps storage module
    for (let i = 0; i < storageSlotsAppsStorageAfterV6.length; i++) {
      expect(storageSlotsAppsStorageAfterV6[i]).to.equal(storageSlotsAppsStorageAfterV5[i])
    }
    // Check that the storage slots are the same for the endorsement slot
    for (let i = 0; i < storageSlotsEndorsementSlotAfterV6.length; i++) {
      expect(storageSlotsEndorsementSlotAfterV6[i]).to.equal(storageSlotsEndorsementSlotAfterV5[i])
    }

    // Check that the version is good
    expect(await x2EarnAppsV6.version()).to.eql("6")

    // The first slot is the x2earnCreator contract address
    const addressFromSlotUpgradeV6 = ethers.getAddress("0x" + storageSlotsAdministrationAfterV6[0].slice(26))
    const expectedAddressUpgradeV6 = ethers.getAddress(await x2EarnCreator.getAddress())
    expect(addressFromSlotUpgradeV6).to.equal(expectedAddressUpgradeV6)

    // The second slot is the x2earnRewardsPool contract address
    const addressFromSlot2UpgradeV6 = ethers.getAddress("0x" + storageSlotsAdministrationAfterV6[1].slice(26))
    const expectedAddress2UpgradeV6 = ethers.getAddress(await x2EarnRewardsPool.getAddress())
    expect(addressFromSlot2UpgradeV6).to.equal(expectedAddress2UpgradeV6)
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
      passportWhitelistAndBlacklistLogicV1,
      passportChecksLogic,
      passportConfigurator,
      passportDelegationLogic,
      passportPersonhoodLogic,
      passportPoPScoreLogic,
      passportSignalingLogic,
      passportWhitelistAndBlacklistLogic,
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
      PassportWhitelistAndBlacklistLogicV1: await passportWhitelistAndBlacklistLogicV1.getAddress(),
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

    const galaxyMemberV3 = (await deployAndUpgrade(
      ["GalaxyMemberV1", "GalaxyMemberV2", "GalaxyMemberV3"],
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
    )) as GalaxyMemberV3

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
          await galaxyMemberV3.getAddress(),
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
          galaxyMember: await galaxyMemberV3.getAddress(),
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
        PassportWhitelistAndBlacklistLogicV1: await passportWhitelistAndBlacklistLogicV1.getAddress(),
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
          PassportWhitelistAndBlacklistLogic: await passportWhitelistAndBlacklistLogic.getAddress(),
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
        await x2EarnAppsV1.connect(owner).addAppModerator(appId, testKeys[index + i].address.toString())
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
