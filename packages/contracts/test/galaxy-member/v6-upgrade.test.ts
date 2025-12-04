import { getOrDeployContractInstances, NFT_NAME, NFT_SYMBOL } from "../helpers"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { bootstrapEmissions, mintLegacyNode, participateInAllocationVoting, upgradeNFTtoLevel } from "../helpers/common"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import {
  B3TR,
  B3TRGovernor,
  GalaxyMember,
  GalaxyMemberV1,
  GalaxyMemberV2,
  GalaxyMemberV3,
  GalaxyMemberV4,
  GalaxyMemberV5,
  Treasury,
  XAllocationVoting,
  StargateNFT,
  NodeManagementV3,
  TokenAuction,
  Stargate,
} from "../../typechain-types"
import { deployProxy, upgradeProxy } from "../../scripts/helpers"
import { ContractsConfig } from "@repo/config/contracts"
import { expect } from "chai"
import { ethers } from "hardhat"

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
describe("Galaxy Member - V6 Upgrade - @shard3b", function () {
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
  })
  it("Token minted in V1 should persist until V6", async function () {
    // Deploy with correct b3tr required to upgrade
    const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
      {
        name: NFT_NAME,
        symbol: NFT_SYMBOL,
        admin: owner.address,
        upgrader: owner.address,
        pauser: owner.address,
        minter: owner.address,
        contractsAddressManager: owner.address,
        maxLevel: 2,
        baseTokenURI: config.GM_NFT_BASE_URI,
        b3trToUpgradeToLevel: [10000000000000000000000n],
        b3tr: await b3tr.getAddress(),
        treasury: await treasury.getAddress(),
      },
    ])) as GalaxyMemberV1

    await galaxyMemberV1.waitForDeployment()

    await galaxyMemberV1.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
    await galaxyMemberV1.connect(owner).setB3trGovernorAddress(await governor.getAddress())

    //Should be in version 1
    expect(await galaxyMemberV1.version()).to.equal("1")

    // Bootstrap emissions
    await bootstrapEmissions()

    // participation in governance is a requirement for minting
    await participateInAllocationVoting(otherAccount)

    // Mint first token
    await galaxyMemberV1.connect(otherAccount).freeMint()

    //Should be the first token id
    expect(await galaxyMemberV1.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0)

    //Upgrade to V2
    const galaxyMemberV2 = (await upgradeProxy(
      "GalaxyMemberV1",
      "GalaxyMemberV2",
      await galaxyMemberV1.getAddress(),
      [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
      { version: 2 },
    )) as GalaxyMemberV2

    //Should be in version 2
    expect(await galaxyMemberV2.version()).to.equal("2")

    //Should have the same token id
    expect(await galaxyMemberV2.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0)

    //Upgrade to V3
    const galaxyMemberV3 = (await upgradeProxy(
      "GalaxyMemberV2",
      "GalaxyMemberV3",
      await galaxyMemberV2.getAddress(),
      [],
      { version: 3 },
    )) as GalaxyMemberV3

    //Should be in version 3
    expect(await galaxyMemberV3.version()).to.equal("3")

    //Should have the same token id
    expect(await galaxyMemberV3.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0)

    //Upgrade to V4
    const galaxyMemberV4 = (await upgradeProxy(
      "GalaxyMemberV3",
      "GalaxyMemberV4",
      await galaxyMemberV3.getAddress(),
      [],
      { version: 4 },
    )) as GalaxyMemberV4

    //Should be in version 4
    expect(await galaxyMemberV4.version()).to.equal("4")

    //Should have the same token id
    expect(await galaxyMemberV4.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0)
    //Upgrade to V5
    const galaxyMemberV5 = (await upgradeProxy(
      "GalaxyMemberV4",
      "GalaxyMemberV5",
      await galaxyMemberV4.getAddress(),
      [],
      { version: 5 },
    )) as GalaxyMemberV5

    //Should be in version 5
    expect(await galaxyMemberV5.version()).to.equal("5")

    //Should have the same token id
    expect(await galaxyMemberV5.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0)
    //Upgrade to V6
    const galaxyMemberV6 = (await upgradeProxy(
      "GalaxyMemberV5",
      "GalaxyMember",
      await galaxyMemberV5.getAddress(),
      [await stargateNftMock.getAddress()],
      { version: 6 },
    )) as GalaxyMember

    //Should be in version 6
    expect(await galaxyMemberV6.version()).to.equal("6")

    //Should have the same token id
    expect(await galaxyMemberV6.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0)
  })
  it("Token minted in V5 should persist through V6 upgrade", async function () {
    // Deploy with correct b3tr required to upgrade
    const galaxyMemberV5 = (await deployProxy("GalaxyMemberV5", [
      {
        name: NFT_NAME,
        symbol: NFT_SYMBOL,
        admin: owner.address,
        upgrader: owner.address,
        pauser: owner.address,
        minter: owner.address,
        contractsAddressManager: owner.address,
        maxLevel: 2,
        baseTokenURI: config.GM_NFT_BASE_URI,
        b3trToUpgradeToLevel: [10000000000000000000000n],
        b3tr: await b3tr.getAddress(),
        treasury: await treasury.getAddress(),
      },
    ])) as GalaxyMemberV5

    await galaxyMemberV5.waitForDeployment()

    await galaxyMemberV5.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
    await galaxyMemberV5.connect(owner).setB3trGovernorAddress(await governor.getAddress())

    //Should be in version 5
    expect(await galaxyMemberV5.version()).to.equal("5")

    //Bootstrap emissions
    await bootstrapEmissions()

    //Participate in governance
    await participateInAllocationVoting(otherAccount, true, otherAccount)
    await participateInAllocationVoting(owner, false, owner)

    //Mint token
    await galaxyMemberV5.connect(otherAccount).freeMint() // token id 0
    await galaxyMemberV5.connect(owner).freeMint() // token id 1

    //Should be in version 6
    expect(await galaxyMemberV5.version()).to.equal("5")

    //Should have the same token id
    expect(await galaxyMemberV5.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0) // token id 0
    expect(await galaxyMemberV5.tokenOfOwnerByIndex(await owner.getAddress(), 0)).to.equal(1) // token id 1

    //Upgrade to V6
    const galaxyMemberV6 = (await upgradeProxy(
      "GalaxyMemberV5",
      "GalaxyMember",
      await galaxyMemberV5.getAddress(),
      [await stargateNftMock.getAddress()],
      { version: 6 },
    )) as GalaxyMember

    //Should be in version 6
    expect(await galaxyMemberV6.version()).to.equal("6")

    //Should have the same token id
    expect(await galaxyMemberV6.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0) // token id 0
    expect(await galaxyMemberV6.tokenOfOwnerByIndex(await owner.getAddress(), 0)).to.equal(1) // token id 1
  })

  it("Should NOT have state conflict after upgrading to V6 if node is migrated to Stargate before upgrading", async () => {
    // Bootstrap emissions
    await bootstrapEmissions()

    // Should be able to free mint after participating in allocation voting
    await participateInAllocationVoting(owner, false, otherAccounts[10])

    const galaxyMember = (await deployProxy("GalaxyMemberV1", [
      {
        name: NFT_NAME,
        symbol: NFT_SYMBOL,
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
    ])) as GalaxyMemberV1

    await galaxyMember.waitForDeployment()
    expect(await galaxyMember.MAX_LEVEL()).to.equal(5)

    // Contract setup
    await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
    await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

    // Participation in governance is a requirement for minting
    const participated = await galaxyMember.connect(owner).participatedInGovernance(owner)
    expect(participated).to.equal(true)

    // Mint 4 tokens to owner
    await galaxyMember.connect(owner).freeMint() // gmId 0
    await galaxyMember.connect(owner).burn(0) // gmId 0
    await galaxyMember.connect(owner).freeMint() // gmId 1
    await galaxyMember.connect(owner).freeMint() // gmId 2
    await galaxyMember.connect(owner).freeMint() // gmId 3
    await galaxyMember.connect(owner).freeMint() // gmId 4

    expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(4)

    // Transfer GM NFTs to other accounts: otherAccount, otherAccounts[0], otherAccounts[1]
    await galaxyMember.connect(owner)["safeTransferFrom(address,address,uint256)"](owner, otherAccount, 1)
    await galaxyMember.connect(owner).transferFrom(owner.address, otherAccounts[0].address, 2)
    await galaxyMember.connect(owner).transferFrom(owner.address, otherAccounts[1].address, 3)

    // All 4 accounts hold 1 GM NFT each
    expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1)
    expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1)
    expect(await galaxyMember.balanceOf(await otherAccounts[0].getAddress())).to.equal(1)
    expect(await galaxyMember.balanceOf(await otherAccounts[1].getAddress())).to.equal(1)

    expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress())
    expect(await galaxyMember.ownerOf(2)).to.equal(await otherAccounts[0].getAddress())
    expect(await galaxyMember.ownerOf(3)).to.equal(await otherAccounts[1].getAddress())
    expect(await galaxyMember.ownerOf(4)).to.equal(await owner.getAddress())

    // All GMs are of level 1
    expect(await galaxyMember.levelOf(1)).to.equal(1) // Earth
    expect(await galaxyMember.levelOf(2)).to.equal(1)
    expect(await galaxyMember.levelOf(3)).to.equal(1)
    expect(await galaxyMember.levelOf(4)).to.equal(1)

    let storageSlots = []

    const initialSlot = BigInt("0x7a79e46844ed04411e4579c7bc49d053e59b0854fa4e9a8df3d5a0597ce45200") // Slot 0 of GalaxyMember

    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlots.push(await ethers.provider.getStorage(await galaxyMember.getAddress(), i))
    }

    storageSlots = storageSlots.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    ) // removing empty slots

    const galaxyMemberV2 = (await upgradeProxy(
      "GalaxyMemberV1",
      "GalaxyMemberV2",
      await galaxyMember.getAddress(),
      [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
      { version: 2 },
    )) as GalaxyMemberV2

    let storageSlotsAfter = []

    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlotsAfter.push(await ethers.provider.getStorage(await galaxyMemberV2.getAddress(), i))
    }

    storageSlotsAfter = storageSlotsAfter.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    ) // removing empty slots

    // Check if storage slots are the same after upgrade
    for (let i = 0; i < storageSlots.length; i++) {
      // console.log("*** storageSlots v1", storageSlots[i], "vs v2", storageSlotsAfter[i])
      expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
    }

    // Contract setup
    await galaxyMemberV2.setVechainNodes(await vechainNodes.getAddress())

    expect(await galaxyMemberV2.MAX_LEVEL()).to.equal(5)
    await galaxyMemberV2.setMaxLevel(10)
    expect(await galaxyMemberV2.MAX_LEVEL()).to.equal(10)

    // Check if all GM NFTs are still owned by the original owners
    expect(await galaxyMemberV2.balanceOf(await owner.getAddress())).to.equal(1)
    expect(await galaxyMemberV2.balanceOf(await otherAccount.getAddress())).to.equal(1)
    expect(await galaxyMemberV2.balanceOf(await otherAccounts[0].getAddress())).to.equal(1)
    expect(await galaxyMemberV2.balanceOf(await otherAccounts[1].getAddress())).to.equal(1)

    expect(await galaxyMemberV2.ownerOf(1)).to.equal(await otherAccount.getAddress())
    expect(await galaxyMemberV2.ownerOf(2)).to.equal(await otherAccounts[0].getAddress())
    expect(await galaxyMemberV2.ownerOf(3)).to.equal(await otherAccounts[1].getAddress())
    expect(await galaxyMemberV2.ownerOf(4)).to.equal(await owner.getAddress())

    // All GMs are still of level 1
    expect(await galaxyMemberV2.levelOf(1)).to.equal(1)
    expect(await galaxyMemberV2.levelOf(2)).to.equal(1)
    expect(await galaxyMemberV2.levelOf(3)).to.equal(1)
    expect(await galaxyMemberV2.levelOf(4)).to.equal(1)

    // Mint a new GM NFT to owner
    await galaxyMemberV2.connect(owner).freeMint()

    expect(await galaxyMemberV2.balanceOf(await owner.getAddress())).to.equal(2)
    expect(await galaxyMemberV2.ownerOf(5)).to.equal(await owner.getAddress())
    expect(await galaxyMemberV2.levelOf(5)).to.equal(1) // Earth

    // Let's upgrade gmId 1, owned by otherAccount, to level 2
    await upgradeNFTtoLevel(1, 2, galaxyMemberV2, b3tr, otherAccount, minterAccount)
    expect(await galaxyMemberV2.levelOf(1)).to.equal(2) // Moon

    // Mint Mjolnir X Node to otherAccount
    await mintLegacyNode(7, otherAccount)
    const nodeId = 1 //Should be the first minted
    expect(await vechainNodes.idToOwner(nodeId)).to.equal(await otherAccount.getAddress())

    // Expect a free upgrade to level 7 when attaching a Mjolnir X Node to a GM NFT of a lower level
    expect(await galaxyMemberV2.getLevelAfterAttachingNode(1, nodeId)).to.equal(7)

    // Attach nodeId 2 to gmId 1
    await galaxyMemberV2.connect(otherAccount).attachNode(nodeId, 1)
    expect(await galaxyMemberV2.levelOf(1)).to.equal(7) // Saturn
    expect(await galaxyMemberV2.tokenURI(1)).to.equal(config.GM_NFT_BASE_URI + "7.json")

    storageSlots = []
    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlots.push(await ethers.provider.getStorage(await galaxyMemberV2.getAddress(), i))
    }

    storageSlots = storageSlots.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    )

    const galaxyMemberV3 = (await upgradeProxy(
      "GalaxyMemberV2",
      "GalaxyMemberV3",
      await galaxyMember.getAddress(),
      [],
      { version: 3 },
    )) as unknown as GalaxyMemberV3

    storageSlotsAfter = []
    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlotsAfter.push(await ethers.provider.getStorage(await galaxyMemberV3.getAddress(), i))
    }

    storageSlotsAfter = storageSlotsAfter.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    )

    // Check if storage slots are the same after upgrade
    for (let i = 0; i < storageSlots.length; i++) {
      // console.log("*** storageSlots v2", storageSlots[i], "vs v3", storageSlotsAfter[i])
      expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
    }

    // Check if all GM NFTs are still owned by the original owners
    expect(await galaxyMemberV3.balanceOf(await owner.getAddress())).to.equal(2)
    expect(await galaxyMemberV3.balanceOf(await otherAccount.getAddress())).to.equal(1)
    expect(await galaxyMemberV3.balanceOf(await otherAccounts[0].getAddress())).to.equal(1)
    expect(await galaxyMemberV3.balanceOf(await otherAccounts[1].getAddress())).to.equal(1)

    expect(await galaxyMemberV3.ownerOf(1)).to.equal(await otherAccount.getAddress())
    expect(await galaxyMemberV3.ownerOf(2)).to.equal(await otherAccounts[0].getAddress())
    expect(await galaxyMemberV3.ownerOf(3)).to.equal(await otherAccounts[1].getAddress())
    expect(await galaxyMemberV3.ownerOf(4)).to.equal(await owner.getAddress())
    expect(await galaxyMemberV3.ownerOf(5)).to.equal(await owner.getAddress())

    // Check that existing GM NFTs have the same level
    expect(await galaxyMemberV3.levelOf(1)).to.equal(7)
    expect(await galaxyMemberV3.levelOf(2)).to.equal(1)
    expect(await galaxyMemberV3.levelOf(3)).to.equal(1)
    expect(await galaxyMemberV3.levelOf(4)).to.equal(1)
    expect(await galaxyMemberV3.levelOf(5)).to.equal(1)

    // Mint a new GM NFT to owner
    await galaxyMemberV3.connect(owner).freeMint()

    expect(await galaxyMemberV3.balanceOf(await owner.getAddress())).to.equal(3)
    expect(await galaxyMemberV3.ownerOf(6)).to.equal(await owner.getAddress())
    expect(await galaxyMemberV3.levelOf(6)).to.equal(1) // Earth

    // Get selected token Id at block number - since you can hold +1 GM NFT, select one to boost rewards
    expect(
      await galaxyMemberV3.getSelectedTokenIdAtBlock(owner.address, await ethers.provider.getBlockNumber()),
    ).to.equal(0n)

    // admin selects gmId 4 as part of upgrade
    await galaxyMemberV3.connect(owner).selectFor(owner.getAddress(), 4)
    expect(await galaxyMemberV3.getSelectedTokenId(owner.getAddress())).to.equal(4)

    // Get selected gmId at block number
    expect(
      await galaxyMemberV3.getSelectedTokenIdAtBlock(owner.address, await ethers.provider.getBlockNumber()),
    ).to.equal(4n)

    // Transfer gmId 4 to otherAccounts[6] - upon transfer, if the `from` address had that id selected,
    // and if they own other GM NFTs, the "first" one is selected
    await galaxyMemberV3.connect(owner).transferFrom(owner.address, otherAccounts[6].address, 4)
    expect(await galaxyMemberV3.getSelectedTokenId(owner.getAddress())).to.equal(6n) // otherAccounts[6]

    expect(
      await galaxyMemberV3.getSelectedTokenIdAtBlock(owner.address, await ethers.provider.getBlockNumber()),
    ).to.equal(6n)

    // Check if the token is transferred
    expect(await galaxyMemberV3.ownerOf(4)).to.equal(await otherAccounts[6].getAddress())

    // Get selected token Id at block number for the transfer recipient
    expect(
      await galaxyMemberV3.getSelectedTokenIdAtBlock(otherAccounts[6].address, await ethers.provider.getBlockNumber()),
    ).to.equal(4n)

    storageSlots = []
    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlots.push(await ethers.provider.getStorage(await galaxyMemberV3.getAddress(), i))
    }

    storageSlots = storageSlots.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    )

    const galaxyMemberV4 = (await upgradeProxy(
      "GalaxyMemberV3",
      "GalaxyMemberV4",
      await galaxyMember.getAddress(),
      [],
      { version: 4 },
    )) as unknown as GalaxyMemberV4

    storageSlotsAfter = []
    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlotsAfter.push(await ethers.provider.getStorage(await galaxyMemberV4.getAddress(), i))
    }

    storageSlotsAfter = storageSlotsAfter.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    )

    // Check if storage slots are the same after upgrade
    for (let i = 0; i < storageSlots.length; i++) {
      // console.log("*** storageSlots v3", storageSlots[i], "vs v4", storageSlotsAfter[i])
      expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
    }

    // Check if all GM NFTs are still owned by the original owners
    expect(await galaxyMemberV4.balanceOf(await owner.getAddress())).to.equal(2)
    expect(await galaxyMemberV4.balanceOf(await otherAccount.getAddress())).to.equal(1)
    expect(await galaxyMemberV4.balanceOf(await otherAccounts[0].getAddress())).to.equal(1)
    expect(await galaxyMemberV4.balanceOf(await otherAccounts[1].getAddress())).to.equal(1)
    expect(await galaxyMemberV4.balanceOf(await otherAccounts[6].getAddress())).to.equal(1)

    expect(await galaxyMemberV3.ownerOf(1)).to.equal(await otherAccount.getAddress())
    expect(await galaxyMemberV3.ownerOf(2)).to.equal(await otherAccounts[0].getAddress())
    expect(await galaxyMemberV3.ownerOf(3)).to.equal(await otherAccounts[1].getAddress())
    expect(await galaxyMemberV4.ownerOf(4)).to.equal(await otherAccounts[6].getAddress())
    expect(await galaxyMemberV3.ownerOf(5)).to.equal(await owner.getAddress())
    expect(await galaxyMemberV3.ownerOf(6)).to.equal(await owner.getAddress())

    // Check that existing GM NFTs have the same level
    expect(await galaxyMemberV3.levelOf(1)).to.equal(7)
    expect(await galaxyMemberV3.levelOf(2)).to.equal(1)
    expect(await galaxyMemberV3.levelOf(3)).to.equal(1)
    expect(await galaxyMemberV3.levelOf(4)).to.equal(1)
    expect(await galaxyMemberV3.levelOf(5)).to.equal(1)
    expect(await galaxyMemberV3.levelOf(6)).to.equal(1)

    // Transfer gmId 6 to otherAccounts[6]
    await galaxyMemberV4.connect(owner).transferFrom(owner.address, otherAccounts[6].address, 6)

    // Check if the token is transferred
    expect(await galaxyMemberV4.ownerOf(6)).to.equal(await otherAccounts[6].getAddress())

    // Check token selection
    expect(await galaxyMemberV4.getSelectedTokenId(owner.getAddress())).to.equal(5n) // defaults to the first token
    expect(await galaxyMemberV4.getSelectedTokenId(otherAccounts[6].getAddress())).to.equal(4n) // otherAccounts[6] had 4 selected

    // V5 is about pointing nodeManagement to version 3, and deprecate the usage of tokenAuction contract
    // Before the upgrade, I can correctly check the level of the vechain node
    expect(await galaxyMemberV4.getNodeLevelOf(nodeId)).to.equal(7)

    // The node is still attached to the GM NFT, resulting on the GM NFT having level 7
    expect(await galaxyMemberV4.getIdAttachedToNode(nodeId)).to.equal(1)
    expect(await galaxyMemberV4.levelOf(1)).to.equal(7)

    storageSlots = []
    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlots.push(await ethers.provider.getStorage(await galaxyMemberV4.getAddress(), i))
    }

    storageSlots = storageSlots.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    )

    // before the upgrade, we save the mapping _nodeToFreeUpgradeLevel values (to check later)
    const levels = await stargateNftMock.getLevels()
    const freeUpgradeLevels = []
    for (const level of levels) {
      const freeUpgradeLevel = await galaxyMemberV4.getNodeToFreeLevel(level.id)
      freeUpgradeLevels.push(freeUpgradeLevel)
    }

    const galaxyMemberV5 = (await upgradeProxy(
      "GalaxyMemberV4",
      "GalaxyMemberV5",
      await galaxyMember.getAddress(),
      [],
      { version: 5 },
    )) as GalaxyMemberV5

    storageSlotsAfter = []
    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlotsAfter.push(await ethers.provider.getStorage(await galaxyMemberV5.getAddress(), i))
    }

    storageSlotsAfter = storageSlotsAfter.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    )

    // Check if storage slots are the same after upgrade
    for (let i = 0; i < storageSlots.length; i++) {
      // console.log("*** storageSlots v4", storageSlots[i], "vs v5", storageSlotsAfter[i])
      expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
    }

    // Check if all GM NFTs are still owned by the original owners
    expect(await galaxyMemberV5.balanceOf(await owner.getAddress())).to.equal(1)
    expect(await galaxyMemberV5.balanceOf(await otherAccount.getAddress())).to.equal(1)
    expect(await galaxyMemberV5.balanceOf(await otherAccounts[0].getAddress())).to.equal(1)
    expect(await galaxyMemberV5.balanceOf(await otherAccounts[1].getAddress())).to.equal(1)
    expect(await galaxyMemberV5.balanceOf(await otherAccounts[6].getAddress())).to.equal(2)

    expect(await galaxyMemberV5.ownerOf(1)).to.equal(await otherAccount.getAddress())
    expect(await galaxyMemberV5.ownerOf(2)).to.equal(await otherAccounts[0].getAddress())
    expect(await galaxyMemberV5.ownerOf(3)).to.equal(await otherAccounts[1].getAddress())
    expect(await galaxyMemberV5.ownerOf(4)).to.equal(await otherAccounts[6].getAddress())
    expect(await galaxyMemberV5.ownerOf(5)).to.equal(await owner.getAddress())
    expect(await galaxyMemberV5.ownerOf(6)).to.equal(await otherAccounts[6].getAddress())

    // Check that existing GM NFTs have the same level
    expect(await galaxyMemberV5.levelOf(1)).to.equal(7)
    expect(await galaxyMemberV5.levelOf(2)).to.equal(1)
    expect(await galaxyMemberV5.levelOf(3)).to.equal(1)
    expect(await galaxyMemberV5.levelOf(4)).to.equal(1)
    expect(await galaxyMemberV5.levelOf(5)).to.equal(1)
    expect(await galaxyMemberV5.levelOf(6)).to.equal(1)

    // Mint a new GM NFT to owner
    await galaxyMemberV5.connect(owner).freeMint()

    expect(await galaxyMemberV5.balanceOf(await owner.getAddress())).to.equal(2)
    expect(await galaxyMemberV5.ownerOf(7)).to.equal(await owner.getAddress())
    expect(await galaxyMemberV5.levelOf(7)).to.equal(1) // Earth

    // Check token selection
    expect(await galaxyMemberV5.getSelectedTokenId(owner.getAddress())).to.equal(5n)
    expect(await galaxyMemberV5.getSelectedTokenId(otherAccounts[6].getAddress())).to.equal(4n)

    // Can still check the level of the vechain node
    expect(await galaxyMemberV5.getNodeLevelOf(nodeId)).to.equal(7)

    // The node is still attached to the GM NFT gmId1, resulting on the GM NFT having level 7
    expect(await galaxyMemberV5.getIdAttachedToNode(nodeId)).to.equal(1)
    expect(await galaxyMemberV5.levelOf(1)).to.equal(7)

    // Node can be delegated, and the GM will be downgraded
    await nodeManagement.connect(otherAccount).delegateNode(otherAccounts[1].address, nodeId)
    expect(await galaxyMemberV5.levelOf(1)).to.equal(2) // Moon

    // For the record, otherAccounts[1] is the new delegatee/node manager, they also own GM NFT gmId3
    expect(await nodeManagement.getNodeManager(nodeId)).to.equal(await otherAccounts[1].getAddress())
    expect(await galaxyMemberV5.ownerOf(3)).to.equal(await otherAccounts[1].getAddress())
    expect(await galaxyMemberV5.levelOf(3)).to.equal(1) // Earth

    // Delegatee decides to attach the delegated node to their own GM NFT (need to detach first)
    await galaxyMemberV5.connect(otherAccounts[1]).detachNode(nodeId, 1)
    await galaxyMemberV5.connect(otherAccounts[1]).attachNode(nodeId, 3)
    expect(await galaxyMemberV5.levelOf(3)).to.equal(7) // Saturn - the node gets a free upgrade

    // Node owner - otherAccount - who's nor the GM NFT owner neither the node manager - can still detach the node
    await galaxyMemberV5.connect(otherAccount).detachNode(nodeId, 3)
    expect(await galaxyMemberV5.levelOf(3)).to.equal(1) // Back to Earth

    // after the upgrade, we check that the mapping _nodeToFreeUpgradeLevel has no corrupted values
    for (let i = 0; i < levels.length; i++) {
      const freeUpgradeLevel = await galaxyMemberV5.getNodeToFreeLevel(levels[i].id)
      expect(freeUpgradeLevel).to.equal(freeUpgradeLevels[i])
    }

    // we can add a new _nodeToFreeUpgradeLevel value
    await galaxyMemberV5.connect(owner).setNodeToFreeUpgradeLevel(9, 4)
    expect(await galaxyMemberV5.getNodeToFreeLevel(9)).to.equal(4)

    // we can remove a _nodeToFreeUpgradeLevel value
    await galaxyMemberV5.connect(owner).setNodeToFreeUpgradeLevel(10, 6)
    expect(await galaxyMemberV5.getNodeToFreeLevel(10)).to.equal(6)

    // we can update previous _nodeToFreeUpgradeLevel value
    await galaxyMemberV5.connect(owner).setNodeToFreeUpgradeLevel(1, 5)
    expect(await galaxyMemberV5.getNodeToFreeLevel(1)).to.equal(5)

    // validate again that we can fetch the correct values
    for (let i = 0; i < levels.length; i++) {
      const freeUpgradeLevel = await galaxyMemberV5.getNodeToFreeLevel(levels[i].id)

      // we changed the above levels above, so adding if conditions so we can reuse the preiovious array
      if (levels[i].id === 1n) {
        expect(freeUpgradeLevel).to.equal(5)
      } else if (levels[i].id === 10n) {
        expect(freeUpgradeLevel).to.equal(6)
      } else if (levels[i].id === 9n) {
        expect(freeUpgradeLevel).to.equal(4)
      } else {
        expect(freeUpgradeLevel).to.equal(freeUpgradeLevels[i])
      }
    }

    storageSlots = []
    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlots.push(await ethers.provider.getStorage(await galaxyMemberV5.getAddress(), i))
    }

    storageSlots = storageSlots.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    )

    //-------------------------------- ⚠️ IMPORTANT ⚠️ --------------------------------
    // NODE OWNER (otherAccount) MUST MIGRATE NODE TO STARGATE BEFORE UPGRADING TO V6
    // Otherwise galaxy member will be "reset" for users with gm attached to legacy nodes
    //-------------------------------- ⚠️ IMPORTANT ⚠️ --------------------------------
    //Admin updates lead time on Legacy Token Auction
    const setLeadTimeTx = await vechainNodes.setLeadTime(0)
    await setLeadTimeTx.wait()
    await stargateMock
      .connect(otherAccount)
      .migrate(nodeId, { value: (await stargateNftMock.getLevel(7)).vetAmountRequiredToStake, gasLimit: 10_000_000 })

    const galaxyMemberV6 = (await upgradeProxy(
      "GalaxyMemberV5",
      "GalaxyMember",
      await galaxyMember.getAddress(),
      [await stargateNftMock.getAddress()],
      {
        version: 6,
      },
    )) as GalaxyMember

    expect(await galaxyMemberV6.version()).to.equal("6")

    storageSlotsAfter = []
    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlotsAfter.push(await ethers.provider.getStorage(await galaxyMemberV6.getAddress(), i))
    }

    storageSlotsAfter = storageSlotsAfter.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    )

    // Check if storage slots are the same after upgrade
    for (let i = 0; i < storageSlots.length; i++) {
      // console.log("*** storageSlots v5", storageSlots[i], "vs v6", storageSlotsAfter[i])
      expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
    }

    // Check if all GM NFTs are still owned by the original owners
    expect(await galaxyMemberV6.balanceOf(await owner.getAddress())).to.equal(2)
    expect(await galaxyMemberV6.balanceOf(await otherAccount.getAddress())).to.equal(1)
    expect(await galaxyMemberV6.balanceOf(await otherAccounts[0].getAddress())).to.equal(1)
    expect(await galaxyMemberV6.balanceOf(await otherAccounts[1].getAddress())).to.equal(1)
    expect(await galaxyMemberV6.balanceOf(await otherAccounts[6].getAddress())).to.equal(2)

    expect(await galaxyMemberV6.ownerOf(1)).to.equal(await otherAccount.getAddress())
    expect(await galaxyMemberV6.ownerOf(2)).to.equal(await otherAccounts[0].getAddress())
    expect(await galaxyMemberV6.ownerOf(3)).to.equal(await otherAccounts[1].getAddress())
    expect(await galaxyMemberV6.ownerOf(4)).to.equal(await otherAccounts[6].getAddress())
    expect(await galaxyMemberV6.ownerOf(5)).to.equal(await owner.getAddress())
    expect(await galaxyMemberV6.ownerOf(6)).to.equal(await otherAccounts[6].getAddress())
    expect(await galaxyMemberV6.ownerOf(7)).to.equal(await owner.getAddress())

    // Check that existing GM NFTs have the same level
    expect(await galaxyMemberV6.levelOf(1)).to.equal(2) // Moon (node was detached at line 657)
    expect(await galaxyMemberV6.levelOf(2)).to.equal(1)
    expect(await galaxyMemberV6.levelOf(3)).to.equal(1)
    expect(await galaxyMemberV6.levelOf(4)).to.equal(1)
    expect(await galaxyMemberV6.levelOf(5)).to.equal(1)
    expect(await galaxyMemberV6.levelOf(6)).to.equal(1)
    expect(await galaxyMemberV6.levelOf(7)).to.equal(1)

    // Check token selection
    expect(await galaxyMemberV6.getSelectedTokenId(owner.getAddress())).to.equal(5n)
    expect(await galaxyMemberV6.getSelectedTokenId(otherAccounts[6].getAddress())).to.equal(4n)
    // Can still check the level of the vechain node
    expect(await galaxyMemberV6.getNodeLevelOf(nodeId)).to.equal(7)

    // The node is no longer attached to any GM NFT (was detached at line 657)
    expect(await galaxyMemberV6.getIdAttachedToNode(nodeId)).to.equal(0)

    // Attach the node back to gmId 1
    await galaxyMemberV6.connect(otherAccount).attachNode(nodeId, 1)
    expect(await galaxyMemberV6.levelOf(1)).to.equal(7) // Saturn
    expect(await galaxyMemberV6.getIdAttachedToNode(nodeId)).to.equal(1)
  })

  it("Should reset attachment if node NOT migrated before upgrading to V6", async () => {
    // Bootstrap emissions
    await bootstrapEmissions()

    const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
      {
        name: NFT_NAME,
        symbol: NFT_SYMBOL,
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
    ])) as GalaxyMemberV1

    await galaxyMemberV1.waitForDeployment()
    expect(await galaxyMemberV1.MAX_LEVEL()).to.equal(5)

    await galaxyMemberV1.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
    await galaxyMemberV1.connect(owner).setB3trGovernorAddress(await governor.getAddress())

    //Participate in governance - owner needs to participate to be able to free mint
    await participateInAllocationVoting(owner, true, otherAccounts[10])

    //Mint 4 tokens to owner
    await galaxyMemberV1.connect(owner).freeMint() // gmId 0
    await galaxyMemberV1.connect(owner).burn(0) // gmId 0
    await galaxyMemberV1.connect(owner).freeMint() // gmId 1
    await galaxyMemberV1.connect(owner).burn(1) // gmId 1
    await galaxyMemberV1.connect(owner).freeMint() // gmId 2
    await galaxyMemberV1.connect(owner).burn(2) // gmId 2
    await galaxyMemberV1.connect(owner).freeMint() // gmId 3
    await galaxyMemberV1.connect(owner).burn(3) // gmId 3

    //Upgrade to v2
    const galaxyMemberV2 = (await upgradeProxy(
      "GalaxyMemberV1",
      "GalaxyMemberV2",
      await galaxyMemberV1.getAddress(),
      [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
      { version: 2 },
    )) as GalaxyMemberV2
    expect(await galaxyMemberV2.version()).to.equal("2")

    //Upgrade to v3
    const galaxyMemberV3 = (await upgradeProxy(
      "GalaxyMemberV2",
      "GalaxyMemberV3",
      await galaxyMemberV2.getAddress(),
      [],
      { version: 3 },
    )) as GalaxyMemberV3
    expect(await galaxyMemberV3.version()).to.equal("3")

    //Upgrade to v4
    const galaxyMemberV4 = (await upgradeProxy(
      "GalaxyMemberV3",
      "GalaxyMemberV4",
      await galaxyMemberV3.getAddress(),
      [],
      { version: 4 },
    )) as GalaxyMemberV4
    expect(await galaxyMemberV4.version()).to.equal("4")

    //Upgrade to v5
    const galaxyMemberV5 = (await upgradeProxy(
      "GalaxyMemberV4",
      "GalaxyMemberV5",
      await galaxyMemberV4.getAddress(),
      [],
      { version: 5 },
    )) as GalaxyMemberV5

    expect(await galaxyMemberV5.version()).to.equal("5")

    const gmId = 4
    await galaxyMemberV5.connect(owner).freeMint() //gmid 4
    await mintLegacyNode(7, owner)
    const ownerNodes = await nodeManagement.getUserNodes(owner.address)
    const nodeId = ownerNodes[0].nodeId
    await galaxyMemberV5.connect(owner).attachNode(nodeId, gmId)

    //Upgrade to v6
    const galaxyMemberV6 = (await upgradeProxy(
      "GalaxyMemberV5",
      "GalaxyMember",
      await galaxyMemberV5.getAddress(),
      [await stargateNftMock.getAddress()],
      { version: 6 },
    )) as GalaxyMember

    expect(await galaxyMemberV6.version()).to.equal("6")

    expect(await galaxyMemberV6.levelOf(gmId)).to.equal(1)
    expect(await galaxyMemberV6.getIdAttachedToNode(nodeId)).to.equal(0)
  })
})
