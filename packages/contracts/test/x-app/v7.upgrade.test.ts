import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { ContractsConfig } from "@repo/config/contracts"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { expect } from "chai"

import { deployAndUpgrade, upgradeProxy } from "../../scripts/helpers"
import { Stargate, StargateNFT, X2EarnApps, X2EarnAppsV6 } from "../../typechain-types"
import { createLegacyNodeHolder, getOrDeployContractInstances, ZERO_ADDRESS } from "../helpers"

let config: ContractsConfig
let x2EarnApps: X2EarnApps
let otherAccounts: SignerWithAddress[]
let owner: SignerWithAddress
let stargateMock: Stargate
let stargateNftMock: StargateNFT
// Skipped: v8.upgrade.test.ts covers V7→V8 and implicitly requires V7 to work
describe.skip("X-Apps - V7 Upgrade - @shard15d", function () {
  beforeEach(async function () {
    config = createLocalConfig()

    const contracts = await getOrDeployContractInstances({
      forceDeploy: true,
      config,
      deployMocks: true,
    })

    if (!contracts) {
      throw new Error("Contracts not deployed")
    }

    x2EarnApps = contracts.x2EarnApps
    otherAccounts = contracts.otherAccounts
    owner = contracts.owner
    stargateMock = contracts.stargateMock
    stargateNftMock = contracts.stargateNftMock
  })

  it("Apps eligible before stargate should remain eligible If the endorser nodes are migrated", async function () {
    const {
      timeLock,
      nodeManagement,
      veBetterPassport,
      x2EarnCreator,
      xAllocationVoting: freshXAllocationVoting,
      x2EarnRewardsPool,
      stargateNftMock: freshStargateNftMock,
      stargateMock: freshStargateMock,
      vechainNodesMock: freshVechainNodesMock,

      //X2EarnAppsV2
      endorsementUtilsV2,
      voteEligibilityUtilsV2,
      administrationUtilsV2,
      //X2EarnAppsV3
      administrationUtilsV3,
      endorsementUtilsV3,
      voteEligibilityUtilsV3,
      //X2EarnAppsV4
      administrationUtilsV4,
      endorsementUtilsV4,
      voteEligibilityUtilsV4,
      //X2EarnAppsV5
      administrationUtilsV5,
      endorsementUtilsV5,
      voteEligibilityUtilsV5,
      //X2EarnAppsV6
      administrationUtilsV6,
      endorsementUtilsV6,
      voteEligibilityUtilsV6,
      //X2EarnAppsV7
      administrationUtilsV7,
      endorsementUtilsV7,
      voteEligibilityUtilsV7,
    } = await getOrDeployContractInstances({ forceDeploy: true, deployMocks: true })

    //-------------------------------- Setup fresh X2EarnAppsV6 --------------------------------
    const x2EarnAppsV6 = (await deployAndUpgrade(
      ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnAppsV3", "X2EarnAppsV4", "X2EarnAppsV5", "X2EarnAppsV6"],
      [
        ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
        [
          config.XAPP_GRACE_PERIOD,
          await nodeManagement.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await freshXAllocationVoting.getAddress()],
        [await x2EarnRewardsPool.getAddress()], // Setting temporary address for the x2EarnRewardsPool
        [],
        [],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6],
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
        ],
      },
    )) as X2EarnAppsV6

    // Update X2EarnRewardsPool to recognize the new X2EarnAppsV6 address
    const CONTRACTS_ADDRESS_MANAGER_ROLE = await x2EarnRewardsPool.CONTRACTS_ADDRESS_MANAGER_ROLE()
    await x2EarnRewardsPool.connect(owner).grantRole(CONTRACTS_ADDRESS_MANAGER_ROLE, owner.address)
    await x2EarnRewardsPool.connect(owner).setX2EarnApps(await x2EarnAppsV6.getAddress())

    // Grant ACTION_SCORE_MANAGER_ROLE to the new X2EarnAppsV6 address
    await veBetterPassport
      .connect(owner)
      .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnAppsV6.getAddress())

    // Grant MINTER_ROLE and BURNER_ROLE to the new X2EarnAppsV6 address
    await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.MINTER_ROLE(), await x2EarnAppsV6.getAddress())
    await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.BURNER_ROLE(), await x2EarnAppsV6.getAddress())

    //-------------------------------- End Setup fresh X2EarnAppsV6 --------------------------------//

    //Submit an app
    const appId = await x2EarnAppsV6.hashAppName(otherAccounts[0].address)
    await x2EarnAppsV6
      .connect(owner)
      .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

    //App should not be eligible now
    expect(await x2EarnAppsV6.isEligibleNow(appId)).to.eql(false)
    //App should be unendorsed
    expect(await x2EarnAppsV6.isAppUnendorsed(appId)).to.eql(true)

    //Mint legacy node level 7 (100 points)
    const nodeId = await createLegacyNodeHolder(7, otherAccounts[0])

    //Endorse the app
    await x2EarnAppsV6.connect(otherAccounts[0]).endorseApp(appId, nodeId)

    //Check endorsement
    await x2EarnAppsV6.checkEndorsement(appId)

    //App should be endorsed and eligible
    expect(await x2EarnAppsV6.isEligibleNow(appId)).to.eql(true)
    expect(await x2EarnAppsV6.isAppUnendorsed(appId)).to.eql(false)

    //-------------------------------- Upgrade X2EarnAppsV6 to X2EarnAppsV7 --------------------------------//
    const x2EarnAppsV7 = (await upgradeProxy(
      "X2EarnAppsV6",
      "X2EarnAppsV7",
      await x2EarnAppsV6.getAddress(),
      [await freshStargateNftMock.getAddress()],
      {
        version: 7,
        libraries: {
          AdministrationUtilsV7: await administrationUtilsV7.getAddress(),
          EndorsementUtilsV7: await endorsementUtilsV7.getAddress(),
          VoteEligibilityUtilsV7: await voteEligibilityUtilsV7.getAddress(),
        },
      },
    )) as X2EarnApps

    //Should be in v7
    expect(await x2EarnAppsV7.version()).to.equal("7")

    //App should remain eligible until check endorsement is called
    expect(await x2EarnAppsV7.isEligibleNow(appId)).to.eql(true)
    expect(await x2EarnAppsV7.isAppUnendorsed(appId)).to.eql(false)

    //Remove lead time , so we can migrate the node to stargate
    await freshVechainNodesMock.connect(owner).setLeadTime(0)

    //Migrate original node to stargate
    await freshStargateMock.connect(otherAccounts[0]).migrate(nodeId, {
      value: (await freshStargateNftMock.getLevel(7)).vetAmountRequiredToStake,
      gasLimit: 10_000_000,
    })

    //Nothing should change until check endorsement is called
    expect(await x2EarnAppsV7.isEligibleNow(appId)).to.eql(true)
    expect(await x2EarnAppsV7.isAppUnendorsed(appId)).to.eql(false)

    //Check endorsement
    await x2EarnAppsV7.checkEndorsement(appId)

    //App should remain eligible since check endorsement was called after migration
    expect(await x2EarnAppsV7.isEligibleNow(appId)).to.eql(true)
    expect(await x2EarnAppsV7.isAppUnendorsed(appId)).to.eql(false)
  })

  it("Apps eligible before stargate should LOSE ENDORSEMENT if the enforser nodes are not migrated", async function () {
    const {
      timeLock,
      nodeManagement,
      veBetterPassport,
      x2EarnCreator,
      xAllocationVoting: freshXAllocationVoting,
      x2EarnRewardsPool,
      stargateNftMock: freshStargateNftMock,
      stargateMock: freshStargateMock,
      vechainNodesMock: freshVechainNodesMock,

      //X2EarnAppsV2
      endorsementUtilsV2,
      voteEligibilityUtilsV2,
      administrationUtilsV2,
      //X2EarnAppsV3
      administrationUtilsV3,
      endorsementUtilsV3,
      voteEligibilityUtilsV3,
      //X2EarnAppsV4
      administrationUtilsV4,
      endorsementUtilsV4,
      voteEligibilityUtilsV4,
      //X2EarnAppsV5
      administrationUtilsV5,
      endorsementUtilsV5,
      voteEligibilityUtilsV5,
      //X2EarnAppsV6
      administrationUtilsV6,
      endorsementUtilsV6,
      voteEligibilityUtilsV6,
      //X2EarnAppsV7
      administrationUtilsV7,
      endorsementUtilsV7,
      voteEligibilityUtilsV7,
    } = await getOrDeployContractInstances({ forceDeploy: true, deployMocks: true })

    //-------------------------------- Setup fresh X2EarnAppsV6 --------------------------------
    const x2EarnAppsV6 = (await deployAndUpgrade(
      ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnAppsV3", "X2EarnAppsV4", "X2EarnAppsV5", "X2EarnAppsV6"],
      [
        ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
        [
          config.XAPP_GRACE_PERIOD,
          await nodeManagement.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await freshXAllocationVoting.getAddress()],
        [await x2EarnRewardsPool.getAddress()], // Setting temporary address for the x2EarnRewardsPool
        [],
        [],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6],
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
        ],
      },
    )) as X2EarnAppsV6

    // Update X2EarnRewardsPool to recognize the new X2EarnAppsV6 address
    const CONTRACTS_ADDRESS_MANAGER_ROLE = await x2EarnRewardsPool.CONTRACTS_ADDRESS_MANAGER_ROLE()
    await x2EarnRewardsPool.connect(owner).grantRole(CONTRACTS_ADDRESS_MANAGER_ROLE, owner.address)
    await x2EarnRewardsPool.connect(owner).setX2EarnApps(await x2EarnAppsV6.getAddress())

    // Grant ACTION_SCORE_MANAGER_ROLE to the new X2EarnAppsV6 address
    await veBetterPassport
      .connect(owner)
      .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnAppsV6.getAddress())

    // Grant MINTER_ROLE and BURNER_ROLE to the new X2EarnAppsV6 address
    await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.MINTER_ROLE(), await x2EarnAppsV6.getAddress())
    await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.BURNER_ROLE(), await x2EarnAppsV6.getAddress())

    //-------------------------------- End Setup fresh X2EarnAppsV6 --------------------------------//

    //Submit an app
    const appId = await x2EarnAppsV6.hashAppName(otherAccounts[0].address)
    await x2EarnAppsV6
      .connect(owner)
      .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

    //App should not be eligible now
    expect(await x2EarnAppsV6.isEligibleNow(appId)).to.eql(false)
    //App should be unendorsed
    expect(await x2EarnAppsV6.isAppUnendorsed(appId)).to.eql(true)

    //Mint legacy node level 7 (100 points)
    const nodeId = await createLegacyNodeHolder(7, otherAccounts[0])

    //Endorse the app
    await x2EarnAppsV6.connect(otherAccounts[0]).endorseApp(appId, nodeId)

    //Check endorsement
    await x2EarnAppsV6.checkEndorsement(appId)

    //App should be endorsed and eligible
    expect(await x2EarnAppsV6.isEligibleNow(appId)).to.eql(true)
    expect(await x2EarnAppsV6.isAppUnendorsed(appId)).to.eql(false)

    //-------------------------------- Upgrade X2EarnAppsV6 to X2EarnAppsV7 --------------------------------//
    const x2EarnAppsV7 = (await upgradeProxy(
      "X2EarnAppsV6",
      "X2EarnAppsV7",
      await x2EarnAppsV6.getAddress(),
      [await freshStargateNftMock.getAddress()],
      {
        version: 7,
        libraries: {
          AdministrationUtilsV7: await administrationUtilsV7.getAddress(),
          EndorsementUtilsV7: await endorsementUtilsV7.getAddress(),
          VoteEligibilityUtilsV7: await voteEligibilityUtilsV7.getAddress(),
        },
      },
    )) as X2EarnApps

    //Should be in v7
    expect(await x2EarnAppsV7.version()).to.equal("7")

    //Nothing should change until check endorsement is called
    expect(await x2EarnAppsV7.isEligibleNow(appId)).to.eql(true)
    expect(await x2EarnAppsV7.isAppUnendorsed(appId)).to.eql(false)

    //Check endorsement
    await x2EarnAppsV7.checkEndorsement(appId)

    //App should be unendorsed and eligible, meaning it's under grace period
    expect(await x2EarnAppsV7.isAppUnendorsed(appId)).to.eql(true)
    expect(await x2EarnAppsV7.isEligibleNow(appId)).to.eql(true)
  })

  it("Apps not eligible before stargate should remain not eligible", async function () {
    const {
      timeLock,
      nodeManagement,
      veBetterPassport,
      x2EarnCreator,
      xAllocationVoting: freshXAllocationVoting,
      x2EarnRewardsPool,
      stargateNftMock: freshStargateNftMock,
      stargateMock: freshStargateMock,
      vechainNodesMock: freshVechainNodesMock,

      //X2EarnAppsV2
      endorsementUtilsV2,
      voteEligibilityUtilsV2,
      administrationUtilsV2,
      //X2EarnAppsV3
      administrationUtilsV3,
      endorsementUtilsV3,
      voteEligibilityUtilsV3,
      //X2EarnAppsV4
      administrationUtilsV4,
      endorsementUtilsV4,
      voteEligibilityUtilsV4,
      //X2EarnAppsV5
      administrationUtilsV5,
      endorsementUtilsV5,
      voteEligibilityUtilsV5,
      //X2EarnAppsV6
      administrationUtilsV6,
      endorsementUtilsV6,
      voteEligibilityUtilsV6,
      //X2EarnAppsV7
      administrationUtilsV7,
      endorsementUtilsV7,
      voteEligibilityUtilsV7,
    } = await getOrDeployContractInstances({ forceDeploy: true, deployMocks: true })

    //-------------------------------- Setup fresh X2EarnAppsV6 --------------------------------
    const x2EarnAppsV6 = (await deployAndUpgrade(
      ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnAppsV3", "X2EarnAppsV4", "X2EarnAppsV5", "X2EarnAppsV6"],
      [
        ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
        [
          config.XAPP_GRACE_PERIOD,
          await nodeManagement.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await freshXAllocationVoting.getAddress()],
        [await x2EarnRewardsPool.getAddress()], // Setting temporary address for the x2EarnRewardsPool
        [],
        [],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6],
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
        ],
      },
    )) as X2EarnAppsV6

    // Update X2EarnRewardsPool to recognize the new X2EarnAppsV6 address
    const CONTRACTS_ADDRESS_MANAGER_ROLE = await x2EarnRewardsPool.CONTRACTS_ADDRESS_MANAGER_ROLE()
    await x2EarnRewardsPool.connect(owner).grantRole(CONTRACTS_ADDRESS_MANAGER_ROLE, owner.address)
    await x2EarnRewardsPool.connect(owner).setX2EarnApps(await x2EarnAppsV6.getAddress())

    // Grant ACTION_SCORE_MANAGER_ROLE to the new X2EarnAppsV6 address
    await veBetterPassport
      .connect(owner)
      .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnAppsV6.getAddress())

    // Grant MINTER_ROLE and BURNER_ROLE to the new X2EarnAppsV6 address
    await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.MINTER_ROLE(), await x2EarnAppsV6.getAddress())
    await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.BURNER_ROLE(), await x2EarnAppsV6.getAddress())

    //-------------------------------- End Setup fresh X2EarnAppsV6 --------------------------------//

    //Submit an app
    const appId = await x2EarnAppsV6.hashAppName(otherAccounts[0].address)
    await x2EarnAppsV6
      .connect(owner)
      .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

    //App should not be eligible now
    expect(await x2EarnAppsV6.isEligibleNow(appId)).to.eql(false)
    //App should be unendorsed
    expect(await x2EarnAppsV6.isAppUnendorsed(appId)).to.eql(true)

    //Check endorsement
    await x2EarnAppsV6.checkEndorsement(appId)

    //App should remain not eligible
    expect(await x2EarnAppsV6.isEligibleNow(appId)).to.eql(false)
    expect(await x2EarnAppsV6.isAppUnendorsed(appId)).to.eql(true)

    //-------------------------------- Upgrade X2EarnAppsV6 to X2EarnAppsV7 --------------------------------//
    const x2EarnAppsV7 = (await upgradeProxy(
      "X2EarnAppsV6",
      "X2EarnAppsV7",
      await x2EarnAppsV6.getAddress(),
      [await freshStargateNftMock.getAddress()],
      {
        version: 7,
        libraries: {
          AdministrationUtilsV7: await administrationUtilsV7.getAddress(),
          EndorsementUtilsV7: await endorsementUtilsV7.getAddress(),
          VoteEligibilityUtilsV7: await voteEligibilityUtilsV7.getAddress(),
        },
      },
    )) as X2EarnApps

    //Should be in v7
    expect(await x2EarnAppsV7.version()).to.equal("7")

    //App should remain not eligible and unendorsed
    expect(await x2EarnAppsV7.isEligibleNow(appId)).to.eql(false)
    expect(await x2EarnAppsV7.isAppUnendorsed(appId)).to.eql(true)
  })
  it("Apps in grace period before stargate should remain in grace period", async function () {
    const {
      timeLock,
      nodeManagement,
      veBetterPassport,
      x2EarnCreator,
      xAllocationVoting: freshXAllocationVoting,
      x2EarnRewardsPool,
      stargateNftMock: freshStargateNftMock,
      stargateMock: freshStargateMock,
      vechainNodesMock: freshVechainNodesMock,

      //X2EarnAppsV2
      endorsementUtilsV2,
      voteEligibilityUtilsV2,
      administrationUtilsV2,
      //X2EarnAppsV3
      administrationUtilsV3,
      endorsementUtilsV3,
      voteEligibilityUtilsV3,
      //X2EarnAppsV4
      administrationUtilsV4,
      endorsementUtilsV4,
      voteEligibilityUtilsV4,
      //X2EarnAppsV5
      administrationUtilsV5,
      endorsementUtilsV5,
      voteEligibilityUtilsV5,
      //X2EarnAppsV6
      administrationUtilsV6,
      endorsementUtilsV6,
      voteEligibilityUtilsV6,
      //X2EarnAppsV7
      administrationUtilsV7,
      endorsementUtilsV7,
      voteEligibilityUtilsV7,
    } = await getOrDeployContractInstances({ forceDeploy: true, deployMocks: true })

    //-------------------------------- Setup fresh X2EarnAppsV6 --------------------------------
    const x2EarnAppsV6 = (await deployAndUpgrade(
      ["X2EarnAppsV1", "X2EarnAppsV2", "X2EarnAppsV3", "X2EarnAppsV4", "X2EarnAppsV5", "X2EarnAppsV6"],
      [
        ["ipfs://", [await timeLock.getAddress(), owner.address], owner.address, owner.address],
        [
          config.XAPP_GRACE_PERIOD,
          await nodeManagement.getAddress(),
          await veBetterPassport.getAddress(),
          await x2EarnCreator.getAddress(),
        ],
        [config.X2EARN_NODE_COOLDOWN_PERIOD, await freshXAllocationVoting.getAddress()],
        [await x2EarnRewardsPool.getAddress()], // Setting temporary address for the x2EarnRewardsPool
        [],
        [],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6],
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
        ],
      },
    )) as X2EarnAppsV6

    // Update X2EarnRewardsPool to recognize the new X2EarnAppsV6 address
    const CONTRACTS_ADDRESS_MANAGER_ROLE = await x2EarnRewardsPool.CONTRACTS_ADDRESS_MANAGER_ROLE()
    await x2EarnRewardsPool.connect(owner).grantRole(CONTRACTS_ADDRESS_MANAGER_ROLE, owner.address)
    await x2EarnRewardsPool.connect(owner).setX2EarnApps(await x2EarnAppsV6.getAddress())

    // Grant ACTION_SCORE_MANAGER_ROLE to the new X2EarnAppsV6 address
    await veBetterPassport
      .connect(owner)
      .grantRole(await veBetterPassport.ACTION_SCORE_MANAGER_ROLE(), await x2EarnAppsV6.getAddress())

    // Grant MINTER_ROLE and BURNER_ROLE to the new X2EarnAppsV6 address
    await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.MINTER_ROLE(), await x2EarnAppsV6.getAddress())
    await x2EarnCreator.connect(owner).grantRole(await x2EarnCreator.BURNER_ROLE(), await x2EarnAppsV6.getAddress())

    //-------------------------------- End Setup fresh X2EarnAppsV6 --------------------------------//

    //Submit an app
    const appId = await x2EarnAppsV6.hashAppName(otherAccounts[0].address)
    await x2EarnAppsV6
      .connect(owner)
      .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

    //App should not be eligible now
    expect(await x2EarnAppsV6.isEligibleNow(appId)).to.eql(false)
    //App should be unendorsed
    expect(await x2EarnAppsV6.isAppUnendorsed(appId)).to.eql(true)

    //Endorse the app
    const nodeId = await createLegacyNodeHolder(7, otherAccounts[0])
    await x2EarnAppsV6.connect(otherAccounts[0]).endorseApp(appId, nodeId)

    //Check endorsement
    await x2EarnAppsV6.checkEndorsement(appId)

    //App should be endorsed and eligible
    expect(await x2EarnAppsV6.isEligibleNow(appId)).to.eql(true)
    expect(await x2EarnAppsV6.isAppUnendorsed(appId)).to.eql(false)

    //Remove endorsement
    await x2EarnAppsV6.connect(otherAccounts[0]).unendorseApp(appId, nodeId)

    //Check endorsement
    await x2EarnAppsV6.checkEndorsement(appId)

    //App should be unendorsed and eligible, meaning it's under grace period
    expect(await x2EarnAppsV6.isAppUnendorsed(appId)).to.eql(true)
    expect(await x2EarnAppsV6.isEligibleNow(appId)).to.eql(true)

    //-------------------------------- Upgrade X2EarnAppsV6 to X2EarnAppsV7 --------------------------------//
    const x2EarnAppsV7 = (await upgradeProxy(
      "X2EarnAppsV6",
      "X2EarnAppsV7",
      await x2EarnAppsV6.getAddress(),
      [await freshStargateNftMock.getAddress()],
      {
        version: 7,
        libraries: {
          AdministrationUtilsV7: await administrationUtilsV7.getAddress(),
          EndorsementUtilsV7: await endorsementUtilsV7.getAddress(),
          VoteEligibilityUtilsV7: await voteEligibilityUtilsV7.getAddress(),
        },
      },
    )) as X2EarnApps

    //Should be in v7
    expect(await x2EarnAppsV7.version()).to.equal("7")

    //App should remain in grace period
    expect(await x2EarnAppsV7.isAppUnendorsed(appId)).to.eql(true)
    expect(await x2EarnAppsV7.isEligibleNow(appId)).to.eql(true)
  })
})
