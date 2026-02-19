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
  X2EarnAppsV7,
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
    const { x2EarnApps, owner, administrationUtils, endorsementUtils, voteEligibilityUtils, appStorageUtils } =
      await getOrDeployContractInstances({
        forceDeploy: true,
      })

    // Deploy the implementation contract
    const Contract = await ethers.getContractFactory("X2EarnApps", {
      libraries: {
        AdministrationUtils: await administrationUtils.getAddress(),
        EndorsementUtils: await endorsementUtils.getAddress(),
        VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        AppStorageUtils: await appStorageUtils.getAddress(),
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
    const { x2EarnApps, otherAccount, administrationUtils, endorsementUtils, voteEligibilityUtils, appStorageUtils } =
      await getOrDeployContractInstances({
        forceDeploy: true,
      })

    // Deploy the implementation contract
    const Contract = await ethers.getContractFactory("X2EarnApps", {
      libraries: {
        AdministrationUtils: await administrationUtils.getAddress(),
        EndorsementUtils: await endorsementUtils.getAddress(),
        VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        AppStorageUtils: await appStorageUtils.getAddress(),
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
      appStorageUtils,
      x2EarnRewardsPool,
      x2EarnCreator,
      stargateNftMock,
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
      administrationUtilsV5,
      endorsementUtilsV5,
      voteEligibilityUtilsV5,
      administrationUtilsV6,
      endorsementUtilsV6,
      voteEligibilityUtilsV6,
      administrationUtilsV7,
      endorsementUtilsV7,
      voteEligibilityUtilsV7,
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
    const x2EarnAppsV5 = (await upgradeProxy("X2EarnAppsV4", "X2EarnAppsV5", await x2EarnAppsV4.getAddress(), [], {
      version: 5,
      libraries: {
        AdministrationUtilsV5: await administrationUtilsV5.getAddress(),
        EndorsementUtilsV5: await endorsementUtilsV5.getAddress(),
        VoteEligibilityUtilsV5: await voteEligibilityUtilsV5.getAddress(),
      },
    })) as X2EarnAppsV5
    // start new round
    await startNewAllocationRound()

    const appsV5 = await x2EarnAppsV5.apps()
    expect(appsV4).to.eql(appsV5)

    // Upgrade X2EarnAppsV5 to X2EarnAppsV6
    const x2EarnAppsV6 = (await upgradeProxy("X2EarnAppsV5", "X2EarnAppsV6", await x2EarnAppsV5.getAddress(), [], {
      version: 6,
      libraries: {
        AdministrationUtilsV6: await administrationUtilsV6.getAddress(),
        EndorsementUtilsV6: await endorsementUtilsV6.getAddress(),
        VoteEligibilityUtilsV6: await voteEligibilityUtilsV6.getAddress(),
      },
    })) as X2EarnAppsV6
    // start new round
    await startNewAllocationRound()

    const appsV6 = await x2EarnAppsV6.apps()
    expect(appsV5).to.eql(appsV6)

    // Upgrade X2EarnAppsV6 to X2EarnAppsV7
    const x2EarnAppsV7 = (await upgradeProxy(
      "X2EarnAppsV6",
      "X2EarnAppsV7",
      await x2EarnAppsV6.getAddress(),
      [await stargateNftMock.getAddress()],
      {
        version: 7,
        libraries: {
          AdministrationUtilsV7: await administrationUtilsV7.getAddress(),
          EndorsementUtilsV7: await endorsementUtilsV7.getAddress(),
          VoteEligibilityUtilsV7: await voteEligibilityUtilsV7.getAddress(),
        },
      },
    )) as X2EarnAppsV7
    // start new round
    await startNewAllocationRound()

    const appsV7 = await x2EarnAppsV7.apps()
    expect(appsV6).to.eql(appsV7)

    // Upgrade X2EarnAppsV7 to X2EarnApps (V8 - latest)
    const x2EarnAppsV8 = (await upgradeProxy("X2EarnAppsV7", "X2EarnApps", await x2EarnAppsV7.getAddress(), [], {
      version: 8,
      libraries: {
        AdministrationUtils: await administrationUtils.getAddress(),
        EndorsementUtils: await endorsementUtils.getAddress(),
        VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        AppStorageUtils: await appStorageUtils.getAddress(),
      },
    })) as X2EarnApps
    // start new round
    await startNewAllocationRound()

    const appsV8 = await x2EarnAppsV8.apps()
    expect(appsV7).to.eql(appsV8)
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
      appStorageUtils,
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
      appStorageUtils,
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
})
