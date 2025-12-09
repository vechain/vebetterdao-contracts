import { createNodeHolder, getOrDeployContractInstances } from "../helpers"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { bootstrapEmissions, participateInAllocationVoting } from "../helpers/common"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import {
  B3TR,
  B3TRGovernor,
  GalaxyMember,
  Treasury,
  XAllocationVoting,
  StargateNFT,
  NodeManagementV3,
  TokenAuction,
  Stargate,
} from "../../typechain-types"
import { ContractsConfig } from "@repo/config/contracts"
import { expect } from "chai"

let owner: SignerWithAddress
let b3tr: B3TR
let treasury: Treasury
let nodeHolder: SignerWithAddress
let secondaryWallet: SignerWithAddress
let config: ContractsConfig
let xAllocationVoting: XAllocationVoting
let governor: B3TRGovernor
let otherAccount: SignerWithAddress
let stargateNftMock: StargateNFT
let minterAccount: SignerWithAddress
let otherAccounts: SignerWithAddress[]
let nodeManagement: NodeManagementV3
let vechainNodes: TokenAuction
let stargateMock: Stargate
let galaxyMember: GalaxyMember
describe("Galaxy Member - V6 Compatibility - @shard3c", function () {
  beforeEach(async function () {
    config = createLocalConfig()
    const contracts = await getOrDeployContractInstances({
      forceDeploy: true,
      config,
      deployMocks: true,
    })
    owner = contracts.owner
    b3tr = contracts.b3tr
    treasury = contracts.treasury
    nodeHolder = contracts.otherAccounts[0]
    secondaryWallet = contracts.otherAccounts[10]
    xAllocationVoting = contracts.xAllocationVoting
    governor = contracts.governor
    otherAccount = contracts.otherAccount
    stargateNftMock = contracts.stargateNftMock
    minterAccount = contracts.minterAccount
    otherAccounts = contracts.otherAccounts
    nodeManagement = contracts.nodeManagement
    vechainNodes = contracts.vechainNodesMock
    stargateMock = contracts.stargateMock
    galaxyMember = contracts.galaxyMember
  })
  it("After Transferring an attached Node to a new owner, the attachment should be reset and GM downgraded", async function () {
    // Bootstrap emissions
    await bootstrapEmissions()

    // Should be able to free mint after participating in allocation voting
    await participateInAllocationVoting(owner, false, otherAccounts[10])

    //Set max level of GM to 10
    await galaxyMember.connect(owner).setMaxLevel(10)

    //Get stargate node
    const nodeId = await createNodeHolder(7, owner)

    // Mint GM to owner
    await galaxyMember.connect(owner).freeMint()
    const gmId = await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)

    // Attach node to GM
    await galaxyMember.connect(owner).attachNode(nodeId, gmId)

    expect(await galaxyMember.getNodeIdAttached(gmId)).to.equal(nodeId) //Should be attached
    expect(await galaxyMember.levelOf(gmId)).to.equal(7) //Should be in Saturn level

    // Transfer node to otherAccount
    await stargateNftMock.connect(owner).transferFrom(owner.address, otherAccount.address, nodeId)

    // Expect attachment to be reset and GM downgraded
    expect(await galaxyMember.getNodeIdAttached(gmId)).to.equal(0)
    expect(await galaxyMember.levelOf(gmId)).to.equal(1)
  })

  it("Should NOT be able to transfer an attached GM", async function () {
    // Bootstrap emissions
    await bootstrapEmissions()

    // Should be able to free mint after participating in allocation voting
    await participateInAllocationVoting(owner, false, otherAccounts[10])

    //Set max level of GM to 10
    await galaxyMember.connect(owner).setMaxLevel(10)

    //Get stargate node
    const nodeId = await createNodeHolder(7, owner)

    // Mint GM to owner
    await galaxyMember.connect(owner).freeMint()
    const gmId = await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)

    //Attach node to GM
    await galaxyMember.connect(owner).attachNode(nodeId, gmId)

    //Try to transfer GM to otherAccount
    await expect(
      galaxyMember.connect(owner).transferFrom(owner.address, otherAccount.address, gmId),
    ).to.be.revertedWith("GalaxyMember: token attached to a node, detach before transfer")
  })

  it("Upon node manager change, attachment should reset and GM downgrade", async function () {
    // Bootstrap emissions
    await bootstrapEmissions()

    // Should be able to free mint after participating in allocation voting
    await participateInAllocationVoting(owner, false, otherAccounts[10])

    //Set max level of GM to 10
    await galaxyMember.connect(owner).setMaxLevel(10)

    //Get stargate node
    const nodeId = await createNodeHolder(7, owner)

    // Mint GM to owner
    await galaxyMember.connect(owner).freeMint()
    const gmId = await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)

    //Attach node to GM
    await galaxyMember.connect(owner).attachNode(nodeId, gmId)

    //Change node manager to otherAccount
    await stargateNftMock.connect(owner).addTokenManager(otherAccount.address, nodeId)

    //Expect attachment to be reset and GM downgraded
    expect(await galaxyMember.getNodeIdAttached(gmId)).to.equal(0)
    expect(await galaxyMember.levelOf(gmId)).to.equal(1)
  })

  it("If unstake/burn stargate node, attachment should be reset and GM downgraded", async function () {
    // Bootstrap emissions
    await bootstrapEmissions()

    // Should be able to free mint after participating in allocation voting
    await participateInAllocationVoting(owner, false, otherAccounts[10])

    //Set max level of GM to 10
    await galaxyMember.connect(owner).setMaxLevel(10)

    //Get stargate node
    const nodeId = await createNodeHolder(7, owner)

    // Mint GM to owner
    await galaxyMember.connect(owner).freeMint()
    const gmId = await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)

    //Attach node to GM
    await galaxyMember.connect(owner).attachNode(nodeId, gmId)

    //Unstake/burn node
    await stargateMock.connect(owner).unstake(nodeId)

    //Expect attachment to be reset and GM downgraded
    expect(await galaxyMember.getNodeIdAttached(gmId)).to.equal(0)
    expect(await galaxyMember.levelOf(gmId)).to.equal(1)
  })

  it("If transferring an attached Node to a new owner, past donated B3TR should remain associated with the GM and not be lost", async function () {
    // Bootstrap emissions
    await bootstrapEmissions()

    // Should be able to free mint after participating in allocation voting
    await participateInAllocationVoting(owner, false, otherAccounts[10])

    //Set max level of GM to 10
    await galaxyMember.connect(owner).setMaxLevel(10)

    //Get stargate node
    const nodeId = await createNodeHolder(7, owner)

    // Mint GM to owner
    await galaxyMember.connect(owner).freeMint()
    const gmId = await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)

    //Attach node to GM
    await galaxyMember.connect(owner).attachNode(nodeId, gmId)

    //Should be attached and in Saturn level
    expect(await galaxyMember.getNodeIdAttached(gmId)).to.equal(nodeId) //Should be attached
    expect(await galaxyMember.levelOf(gmId)).to.equal(7) //Should be in Saturn level

    //Pay for the upgrade to level 8
    const amountToUpgrade = await galaxyMember.getB3TRtoUpgrade(gmId)
    await b3tr.connect(minterAccount).mint(owner, amountToUpgrade) // Mint B3TR to owner
    await b3tr.connect(owner).approve(await galaxyMember.getAddress(), amountToUpgrade) // Approve galaxyMember to transfer B3TR
    await galaxyMember.connect(owner).upgrade(gmId)

    //Should have donated B3TR
    expect(await galaxyMember.getB3TRdonated(gmId)).to.equal(amountToUpgrade)

    //Check the new level
    expect(await galaxyMember.levelOf(gmId)).to.equal(8)

    //Transfer node to otherAccount
    await stargateNftMock.connect(owner).transferFrom(owner.address, otherAccount.address, nodeId)

    //Expect attachment to be reset and GM downgraded
    expect(await galaxyMember.getNodeIdAttached(gmId)).to.equal(0)
    //Since it has donated from level 7 to 8 , it donated 2.500.000 B3TR, so removing the node it should be downgraded to level 7
    expect(await galaxyMember.levelOf(gmId)).to.equal(7)

    //Expect B3TR to remain associated with the GM
    expect(await galaxyMember.getB3TRdonated(gmId)).to.equal(amountToUpgrade)
  })

  it("If unstaking/burning stargate node, past donated B3TR should remain associated with the GM and not be lost", async function () {
    // Bootstrap emissions
    await bootstrapEmissions()

    // Should be able to free mint after participating in allocation voting
    await participateInAllocationVoting(owner, false, otherAccounts[10])

    //Set max level of GM to 10
    await galaxyMember.connect(owner).setMaxLevel(10)

    //Get stargate node
    const nodeId = await createNodeHolder(7, owner)

    // Mint GM to owner
    await galaxyMember.connect(owner).freeMint()
    const gmId = await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)

    //Attach node to GM
    await galaxyMember.connect(owner).attachNode(nodeId, gmId)

    //Should be attached and in Saturn level
    expect(await galaxyMember.getNodeIdAttached(gmId)).to.equal(nodeId) //Should be attached
    expect(await galaxyMember.levelOf(gmId)).to.equal(7) //Should be in Saturn level

    //Pay for the upgrade to level 8
    const amountToUpgrade = await galaxyMember.getB3TRtoUpgrade(gmId)
    await b3tr.connect(minterAccount).mint(owner, amountToUpgrade) // Mint B3TR to owner
    await b3tr.connect(owner).approve(await galaxyMember.getAddress(), amountToUpgrade) // Approve galaxyMember to transfer B3TR
    await galaxyMember.connect(owner).upgrade(gmId)

    //Should have donated B3TR
    expect(await galaxyMember.getB3TRdonated(gmId)).to.equal(amountToUpgrade)

    //Check the new level
    expect(await galaxyMember.levelOf(gmId)).to.equal(8)

    //Unstake/burn node
    await stargateMock.connect(owner).unstake(nodeId)

    //Expect attachment to be reset and GM downgraded
    expect(await galaxyMember.getNodeIdAttached(gmId)).to.equal(0)
    //Since it has donated from level 7 to 8 , it donated 2.500.000 B3TR, so removing the node it should be downgraded to level 7
    expect(await galaxyMember.levelOf(gmId)).to.equal(7)

    //Expect B3TR to remain associated with the GM
    expect(await galaxyMember.getB3TRdonated(gmId)).to.equal(amountToUpgrade)
  })

  it("If unstaking/burning stargate node, gm detects as dettached and can be attached to a new node", async function () {
    // Bootstrap emissions
    await bootstrapEmissions()

    // Should be able to free mint after participating in allocation voting
    await participateInAllocationVoting(owner, false, otherAccounts[10])

    //Set max level of GM to 10
    await galaxyMember.connect(owner).setMaxLevel(10)

    //Get stargate node
    const nodeId = await createNodeHolder(7, owner)

    // Mint GM to owner
    await galaxyMember.connect(owner).freeMint()
    const gmId = await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)

    //Attach node to GM
    await galaxyMember.connect(owner).attachNode(nodeId, gmId)

    //Unstake/burn node
    await stargateMock.connect(owner).unstake(nodeId)

    //Expect attachment to be reset and GM downgraded
    expect(await galaxyMember.getNodeIdAttached(gmId)).to.equal(0)
    expect(await galaxyMember.levelOf(gmId)).to.equal(1)

    const newNodeId = await createNodeHolder(7, owner)

    //Attach node to GM
    await galaxyMember.connect(owner).attachNode(newNodeId, gmId)

    //Expect attachment to be attached and level to be the same
    expect(await galaxyMember.getNodeIdAttached(gmId)).to.equal(newNodeId)
    expect(await galaxyMember.levelOf(gmId)).to.equal(7)
  })
})
