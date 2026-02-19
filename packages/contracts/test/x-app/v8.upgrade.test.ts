import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { ContractsConfig } from "@repo/config/contracts"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { expect } from "chai"
import { ethers } from "hardhat"

import { deployAndUpgrade, upgradeProxy } from "../../scripts/helpers"
import { EndorsementUtils, X2EarnApps, X2EarnAppsV7 } from "../../typechain-types"
import { createNodeHolder, filterEventsByName, getOrDeployContractInstances, getStorageSlots } from "../helpers"

let config: ContractsConfig
let otherAccounts: SignerWithAddress[]
let owner: SignerWithAddress

describe("X-Apps - V8 Upgrade - @shard15f", function () {
  beforeEach(async function () {
    config = createLocalConfig()

    const contracts = await getOrDeployContractInstances({
      forceDeploy: true,
      deployMocks: true,
    })

    if (!contracts) {
      throw new Error("Contracts not deployed")
    }

    otherAccounts = contracts.otherAccounts
    owner = contracts.owner
  })

  it("Should upgrade from V7 to V8", async function () {
    const {
      timeLock,
      nodeManagement,
      veBetterPassport,
      x2EarnCreator,
      xAllocationVoting: freshXAllocationVoting,
      x2EarnRewardsPool,
      stargateNftMock: freshStargateNftMock,

      // X2EarnApps V2
      administrationUtilsV2,
      endorsementUtilsV2,
      voteEligibilityUtilsV2,
      // X2EarnApps V3
      administrationUtilsV3,
      endorsementUtilsV3,
      voteEligibilityUtilsV3,
      // X2EarnApps V4
      administrationUtilsV4,
      endorsementUtilsV4,
      voteEligibilityUtilsV4,
      // X2EarnApps V5
      administrationUtilsV5,
      endorsementUtilsV5,
      voteEligibilityUtilsV5,
      // X2EarnApps V6
      administrationUtilsV6,
      endorsementUtilsV6,
      voteEligibilityUtilsV6,
      // X2EarnApps V7
      administrationUtilsV7,
      endorsementUtilsV7,
      voteEligibilityUtilsV7,
      // Latest
      administrationUtils,
      endorsementUtils,
      voteEligibilityUtils,
      appStorageUtils,
    } = await getOrDeployContractInstances({ forceDeploy: true, deployMocks: true })

    const x2EarnAppsV7 = (await deployAndUpgrade(
      ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnAppsV3", "X2EarnAppsV4", "X2EarnAppsV5", "X2EarnAppsV6", "X2EarnAppsV7"],
      [
        ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
        [
          config.XAPP_GRACE_PERIOD,
          await nodeManagement.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await freshXAllocationVoting.getAddress()],
        [await x2EarnRewardsPool.getAddress()],
        [],
        [],
        [await freshStargateNftMock.getAddress()],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6, 7],
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
          {
            AdministrationUtilsV4: await administrationUtilsV4.getAddress(),
            EndorsementUtilsV4: await endorsementUtilsV4.getAddress(),
            VoteEligibilityUtilsV4: await voteEligibilityUtilsV4.getAddress(),
          },
          {
            AdministrationUtilsV5: await administrationUtilsV5.getAddress(),
            EndorsementUtilsV5: await endorsementUtilsV5.getAddress(),
            VoteEligibilityUtilsV5: await voteEligibilityUtilsV5.getAddress(),
          },
          {
            AdministrationUtilsV6: await administrationUtilsV6.getAddress(),
            EndorsementUtilsV6: await endorsementUtilsV6.getAddress(),
            VoteEligibilityUtilsV6: await voteEligibilityUtilsV6.getAddress(),
          },
          {
            AdministrationUtilsV7: await administrationUtilsV7.getAddress(),
            EndorsementUtilsV7: await endorsementUtilsV7.getAddress(),
            VoteEligibilityUtilsV7: await voteEligibilityUtilsV7.getAddress(),
          },
        ],
      },
    )) as X2EarnAppsV7

    const x2EarnAppsV8 = (await upgradeProxy("X2EarnAppsV7", "X2EarnApps", await x2EarnAppsV7.getAddress(), [], {
      version: 8,
      libraries: {
        AdministrationUtils: await administrationUtils.getAddress(),
        EndorsementUtils: await endorsementUtils.getAddress(),
        VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        AppStorageUtils: await appStorageUtils.getAddress(),
      },
    })) as X2EarnApps

    expect(await x2EarnAppsV8.version()).to.equal("8")

    // Update X2EarnRewardsPool to point to the upgraded contract
    const CONTRACTS_ADDRESS_MANAGER_ROLE = await x2EarnRewardsPool.CONTRACTS_ADDRESS_MANAGER_ROLE()
    await x2EarnRewardsPool.connect(owner).grantRole(CONTRACTS_ADDRESS_MANAGER_ROLE, owner.address)
    await x2EarnRewardsPool.connect(owner).setX2EarnApps(await x2EarnAppsV8.getAddress())

    // quick sanity: contract still callable
    const appId = await x2EarnAppsV8.hashAppName(otherAccounts[0].address)
    await x2EarnAppsV8
      .connect(owner)
      .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
    expect(await x2EarnAppsV8.isAppUnendorsed(appId)).to.eql(true)
  })

  it("Should preserve storage slots during V7 to V8 upgrade (library refactoring)", async function () {
    const {
      timeLock,
      nodeManagement,
      veBetterPassport,
      x2EarnCreator,
      xAllocationVoting: freshXAllocationVoting,
      x2EarnRewardsPool,
      stargateNftMock: freshStargateNftMock,

      // X2EarnApps V2
      administrationUtilsV2,
      endorsementUtilsV2,
      voteEligibilityUtilsV2,
      // X2EarnApps V3
      administrationUtilsV3,
      endorsementUtilsV3,
      voteEligibilityUtilsV3,
      // X2EarnApps V4
      administrationUtilsV4,
      endorsementUtilsV4,
      voteEligibilityUtilsV4,
      // X2EarnApps V5
      administrationUtilsV5,
      endorsementUtilsV5,
      voteEligibilityUtilsV5,
      // X2EarnApps V6
      administrationUtilsV6,
      endorsementUtilsV6,
      voteEligibilityUtilsV6,
      // X2EarnApps V7
      administrationUtilsV7,
      endorsementUtilsV7,
      voteEligibilityUtilsV7,
      // Latest
      administrationUtils,
      endorsementUtils,
      voteEligibilityUtils,
      appStorageUtils,
    } = await getOrDeployContractInstances({ forceDeploy: true, deployMocks: true })

    // Storage slot locations (ERC-7201)
    const initialSlotVoteEligibility = BigInt("0xb5b8d618af1ffb8d5bcc4bd23f445ba34ed08d7a16d1e1b5411cfbe7913e5900")
    const initialSlotSettings = BigInt("0x83b9a7e51f394efa93107c3888716138908bbbe611dfc86afa3639a826441100")
    const initialSlotAppsStorage = BigInt("0xb6909058bd527140b8d55a44344c5e42f1f148f1b3b16df7641882df8dd72900")
    const initialSlotAdministration = BigInt("0x5830f0e95c01712d916c34d9e2fa42e9f749b325b67bce7382d70bb99c623500")
    const initialEndorsementSlot = BigInt("0xc1a7bcdc0c77e8c77ade4541d1777901ab96ca598d164d89afa5c8dfbfc44300")

    // Deploy up to V7
    const x2EarnAppsV7 = (await deployAndUpgrade(
      ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnAppsV3", "X2EarnAppsV4", "X2EarnAppsV5", "X2EarnAppsV6", "X2EarnAppsV7"],
      [
        ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
        [
          config.XAPP_GRACE_PERIOD,
          await nodeManagement.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await freshXAllocationVoting.getAddress()],
        [await x2EarnRewardsPool.getAddress()],
        [],
        [],
        [await freshStargateNftMock.getAddress()],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6, 7],
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
          {
            AdministrationUtilsV4: await administrationUtilsV4.getAddress(),
            EndorsementUtilsV4: await endorsementUtilsV4.getAddress(),
            VoteEligibilityUtilsV4: await voteEligibilityUtilsV4.getAddress(),
          },
          {
            AdministrationUtilsV5: await administrationUtilsV5.getAddress(),
            EndorsementUtilsV5: await endorsementUtilsV5.getAddress(),
            VoteEligibilityUtilsV5: await voteEligibilityUtilsV5.getAddress(),
          },
          {
            AdministrationUtilsV6: await administrationUtilsV6.getAddress(),
            EndorsementUtilsV6: await endorsementUtilsV6.getAddress(),
            VoteEligibilityUtilsV6: await voteEligibilityUtilsV6.getAddress(),
          },
          {
            AdministrationUtilsV7: await administrationUtilsV7.getAddress(),
            EndorsementUtilsV7: await endorsementUtilsV7.getAddress(),
            VoteEligibilityUtilsV7: await voteEligibilityUtilsV7.getAddress(),
          },
        ],
      },
    )) as X2EarnAppsV7

    // Verify V7 state
    expect(await x2EarnAppsV7.version()).to.equal("7")
    expect(await x2EarnAppsV7.baseURI()).to.equal("ipfs://")
    expect(await x2EarnAppsV7.gracePeriod()).to.equal(config.XAPP_GRACE_PERIOD)
    expect(await x2EarnAppsV7.cooldownPeriod()).to.equal(config.X2EARN_NODE_COOLDOWN_PERIOD)

    // Capture storage slots BEFORE upgrade
    const storageSlotsV7 = await getStorageSlots(
      x2EarnAppsV7.getAddress(),
      initialSlotVoteEligibility,
      initialSlotSettings,
      initialSlotAppsStorage,
      initialSlotAdministration,
      initialEndorsementSlot,
    )

    // Upgrade to V8
    const x2EarnAppsV8 = (await upgradeProxy("X2EarnAppsV7", "X2EarnApps", await x2EarnAppsV7.getAddress(), [], {
      version: 8,
      libraries: {
        AdministrationUtils: await administrationUtils.getAddress(),
        EndorsementUtils: await endorsementUtils.getAddress(),
        VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        AppStorageUtils: await appStorageUtils.getAddress(),
      },
    })) as X2EarnApps

    // Verify version updated
    expect(await x2EarnAppsV8.version()).to.equal("8")

    // Capture storage slots AFTER upgrade
    const storageSlotsV8 = await getStorageSlots(
      x2EarnAppsV8.getAddress(),
      initialSlotVoteEligibility,
      initialSlotSettings,
      initialSlotAppsStorage,
      initialSlotAdministration,
      initialEndorsementSlot,
    )

    // Verify all storage slots are preserved
    for (let i = 0; i < storageSlotsV7.length; i++) {
      expect(storageSlotsV7[i]).to.equal(storageSlotsV8[i], `Storage slot ${i} changed after upgrade`)
    }

    // Verify contract settings are preserved
    expect(await x2EarnAppsV8.baseURI()).to.equal("ipfs://")
    expect(await x2EarnAppsV8.gracePeriod()).to.equal(config.XAPP_GRACE_PERIOD)
    expect(await x2EarnAppsV8.cooldownPeriod()).to.equal(config.X2EARN_NODE_COOLDOWN_PERIOD)
  })

  describe("seedEndorsement", function () {
    it("Should seed endorsement correctly", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Grant MIGRATION_ROLE to owner
      const MIGRATION_ROLE = await x2EarnApps.MIGRATION_ROLE()
      await x2EarnApps.connect(owner).grantRole(MIGRATION_ROLE, owner.address)

      // Submit an app
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, owner.address, "metadataURI")
      const appId = await x2EarnApps.hashAppName(otherAccounts[1].address)

      // Create a node holder with level 7 (MjolnirX)
      const nodeId = await createNodeHolder(7, otherAccounts[2])

      // Seed endorsement
      await x2EarnApps.connect(owner).seedEndorsement(appId, nodeId, 49)

      // Verify endorsement score
      expect(await x2EarnApps.getScore(appId)).to.equal(49)

      // Verify endorsers list
      const endorsers = await x2EarnApps.getEndorsers(appId)
      expect(endorsers.length).to.equal(1)
    })

    it("Should update existing endorsement on duplicate seed instead of creating new entry", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Grant MIGRATION_ROLE to owner
      const MIGRATION_ROLE = await x2EarnApps.MIGRATION_ROLE()
      await x2EarnApps.connect(owner).grantRole(MIGRATION_ROLE, owner.address)

      // Submit an app
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, owner.address, "metadataURI")
      const appId = await x2EarnApps.hashAppName(otherAccounts[1].address)

      // Create a node holder with level 7 (MjolnirX)
      const nodeId = await createNodeHolder(7, otherAccounts[2])

      // Seed endorsement first time with 20 points
      await x2EarnApps.connect(owner).seedEndorsement(appId, nodeId, 20)
      expect(await x2EarnApps.getScore(appId)).to.equal(20)

      // Get endorsers count after first seed
      const endorsersAfterFirst = await x2EarnApps.getEndorsers(appId)
      expect(endorsersAfterFirst.length).to.equal(1)

      // Seed endorsement second time with 30 points (duplicate)
      await x2EarnApps.connect(owner).seedEndorsement(appId, nodeId, 30)

      // Should update to 30, not add to 50 (duplicate guard)
      expect(await x2EarnApps.getScore(appId)).to.equal(30)

      // Endorsers count should remain 1, not 2
      const endorsersAfterSecond = await x2EarnApps.getEndorsers(appId)
      expect(endorsersAfterSecond.length).to.equal(1)
    })

    it("Should revert seeding after migration is complete", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Grant MIGRATION_ROLE to owner
      const MIGRATION_ROLE = await x2EarnApps.MIGRATION_ROLE()
      await x2EarnApps.connect(owner).grantRole(MIGRATION_ROLE, owner.address)

      // Submit an app
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, owner.address, "metadataURI")
      const appId = await x2EarnApps.hashAppName(otherAccounts[1].address)

      // Create a node holder with level 7 (MjolnirX)
      const nodeId = await createNodeHolder(7, otherAccounts[2])

      // Mark migration complete
      await x2EarnApps.connect(owner).markMigrationComplete()

      // Seed endorsement should revert (error comes from EndorsementUtils library)
      await expect(x2EarnApps.connect(owner).seedEndorsement(appId, nodeId, 49)).to.be.reverted
    })

    it("Should only allow MIGRATION_ROLE to seed endorsements", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Submit an app
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, owner.address, "metadataURI")
      const appId = await x2EarnApps.hashAppName(otherAccounts[1].address)

      // Create a node holder with level 7 (MjolnirX)
      const nodeId = await createNodeHolder(7, otherAccounts[2])

      // Random user without MIGRATION_ROLE should not be able to seed
      await expect(x2EarnApps.connect(otherAccounts[3]).seedEndorsement(appId, nodeId, 49)).to.be.reverted
    })
  })

  it("Should emit AppAdded event when app reaches endorsement threshold on V7 and V8", async function () {
    const {
      timeLock,
      nodeManagement,
      veBetterPassport,
      x2EarnCreator,
      xAllocationVoting: freshXAllocationVoting,
      x2EarnRewardsPool,
      stargateNftMock: freshStargateNftMock,
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
      administrationUtilsV7,
      endorsementUtilsV7,
      voteEligibilityUtilsV7,
      administrationUtils,
      endorsementUtils,
      voteEligibilityUtils,
      appStorageUtils,
    } = await getOrDeployContractInstances({ forceDeploy: true, deployMocks: true })

    // Deploy V1 → V7
    const x2EarnAppsV7 = (await deployAndUpgrade(
      ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnAppsV3", "X2EarnAppsV4", "X2EarnAppsV5", "X2EarnAppsV6", "X2EarnAppsV7"],
      [
        ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
        [
          config.XAPP_GRACE_PERIOD,
          await nodeManagement.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await freshXAllocationVoting.getAddress()],
        [await x2EarnRewardsPool.getAddress()],
        [],
        [],
        [await freshStargateNftMock.getAddress()],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6, 7],
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
          {
            AdministrationUtilsV4: await administrationUtilsV4.getAddress(),
            EndorsementUtilsV4: await endorsementUtilsV4.getAddress(),
            VoteEligibilityUtilsV4: await voteEligibilityUtilsV4.getAddress(),
          },
          {
            AdministrationUtilsV5: await administrationUtilsV5.getAddress(),
            EndorsementUtilsV5: await endorsementUtilsV5.getAddress(),
            VoteEligibilityUtilsV5: await voteEligibilityUtilsV5.getAddress(),
          },
          {
            AdministrationUtilsV6: await administrationUtilsV6.getAddress(),
            EndorsementUtilsV6: await endorsementUtilsV6.getAddress(),
            VoteEligibilityUtilsV6: await voteEligibilityUtilsV6.getAddress(),
          },
          {
            AdministrationUtilsV7: await administrationUtilsV7.getAddress(),
            EndorsementUtilsV7: await endorsementUtilsV7.getAddress(),
            VoteEligibilityUtilsV7: await voteEligibilityUtilsV7.getAddress(),
          },
        ],
      },
    )) as X2EarnAppsV7

    // Point rewards pool to this proxy so submitApp can enable rewards
    const CONTRACTS_ADDRESS_MANAGER_ROLE = await x2EarnRewardsPool.CONTRACTS_ADDRESS_MANAGER_ROLE()
    await x2EarnRewardsPool.connect(owner).grantRole(CONTRACTS_ADDRESS_MANAGER_ROLE, owner.address)
    await x2EarnRewardsPool.connect(owner).setX2EarnApps(await x2EarnAppsV7.getAddress())

    // Allow the V7 proxy to call setAppSecurity on VeBetterPassport
    await veBetterPassport
      .connect(owner)
      .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnAppsV7.getAddress())

    // Grant GOVERNANCE_ROLE to owner so we can call governance-gated functions
    const GOVERNANCE_ROLE = await x2EarnAppsV7.GOVERNANCE_ROLE()
    await x2EarnAppsV7.connect(owner).grantRole(GOVERNANCE_ROLE, owner.address)

    // --- V7: Submit app and endorse to threshold ---
    // otherAccounts[0..7] already have creator NFTs from the deploy — use higher indices
    const app1Creator = otherAccounts[8]
    await x2EarnCreator.connect(owner).safeMint(app1Creator.address)

    const app1Name = "V7TestApp"
    await x2EarnAppsV7.connect(app1Creator).submitApp(app1Creator.address, app1Creator.address, app1Name, "uri")
    const app1Id = await x2EarnAppsV7.hashAppName(app1Name)

    expect(await x2EarnAppsV7.isAppUnendorsed(app1Id)).to.eql(true)

    // Create MjolnirX node (level 7 = 100 points, meets threshold of 100)
    const nodeId1 = await createNodeHolder(7, otherAccounts[9])

    // Endorse on V7 — single node with 100 points reaches the threshold
    const v7EndorseTx = await x2EarnAppsV7.connect(otherAccounts[9]).endorseApp(app1Id, nodeId1)
    const v7Receipt = await v7EndorseTx.wait()
    if (!v7Receipt) throw new Error("No receipt")

    // Verify AppAdded event emitted on V7 with appAvailableForAllocationVoting = true
    const v7AppAddedEvents = filterEventsByName(v7Receipt.logs, "AppAdded")
    expect(v7AppAddedEvents.length).to.equal(1)

    const v7Decoded = x2EarnAppsV7.interface.parseLog({
      topics: v7AppAddedEvents[0].topics as string[],
      data: v7AppAddedEvents[0].data,
    })
    expect(v7Decoded?.args[0]).to.equal(app1Id) // id
    expect(v7Decoded?.args[1]).to.equal(app1Creator.address) // teamWalletAddress
    expect(v7Decoded?.args[2]).to.equal(app1Name) // name
    expect(v7Decoded?.args[3]).to.equal(true) // appAvailableForAllocationVoting

    expect(await x2EarnAppsV7.appExists(app1Id)).to.eql(true)
    expect(await x2EarnAppsV7.isAppUnendorsed(app1Id)).to.eql(false)

    // --- Upgrade to V8 ---
    const x2EarnAppsV8 = (await upgradeProxy("X2EarnAppsV7", "X2EarnApps", await x2EarnAppsV7.getAddress(), [49, 110], {
      version: 8,
      libraries: {
        AdministrationUtils: await administrationUtils.getAddress(),
        EndorsementUtils: await endorsementUtils.getAddress(),
        VoteEligibilityUtils: await voteEligibilityUtils.getAddress(),
        AppStorageUtils: await appStorageUtils.getAddress(),
      },
    })) as X2EarnApps

    expect(await x2EarnAppsV8.version()).to.equal("8")
    await x2EarnRewardsPool.connect(owner).setX2EarnApps(await x2EarnAppsV8.getAddress())

    // --- V8: Submit a new app and endorse to threshold ---
    const app2Creator = otherAccounts[10]
    await x2EarnCreator.connect(owner).safeMint(app2Creator.address)

    const app2Name = "V8TestApp"
    await x2EarnAppsV8.connect(app2Creator).submitApp(app2Creator.address, app2Creator.address, app2Name, "uri")
    const app2Id = await x2EarnAppsV8.hashAppName(app2Name)

    expect(await x2EarnAppsV8.isAppUnendorsed(app2Id)).to.eql(true)

    // V8 limits 49 points per node per app, so we need 3 endorsers: 49 + 49 + 2 = 100
    const nodeId2 = await createNodeHolder(7, otherAccounts[11])
    const nodeId3 = await createNodeHolder(7, otherAccounts[12])
    const nodeId4 = await createNodeHolder(7, otherAccounts[13])

    await x2EarnAppsV8.connect(otherAccounts[11]).endorseApp(app2Id, nodeId2, 49)
    await x2EarnAppsV8.connect(otherAccounts[12]).endorseApp(app2Id, nodeId3, 49)

    // Third endorsement crosses the 100-point threshold — should emit AppAdded
    const v8EndorseTx = await x2EarnAppsV8.connect(otherAccounts[13]).endorseApp(app2Id, nodeId4, 2)
    const v8Receipt = await v8EndorseTx.wait()
    if (!v8Receipt) throw new Error("No receipt")

    // Verify AppAdded event emitted on V8 with appAvailableForAllocationVoting = true
    const v8AppAddedEvents = filterEventsByName(v8Receipt.logs, "AppAdded")
    expect(v8AppAddedEvents.length).to.equal(1)

    const v8Decoded = x2EarnAppsV8.interface.parseLog({
      topics: v8AppAddedEvents[0].topics as string[],
      data: v8AppAddedEvents[0].data,
    })
    expect(v8Decoded?.args[0]).to.equal(app2Id) // id
    expect(v8Decoded?.args[1]).to.equal(app2Creator.address) // teamWalletAddress
    expect(v8Decoded?.args[2]).to.equal(app2Name) // name
    expect(v8Decoded?.args[3]).to.equal(true) // appAvailableForAllocationVoting

    expect(await x2EarnAppsV8.appExists(app2Id)).to.eql(true)
    expect(await x2EarnAppsV8.isAppUnendorsed(app2Id)).to.eql(false)
  })
})
