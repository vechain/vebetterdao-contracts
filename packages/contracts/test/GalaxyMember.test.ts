import { describe, it, beforeEach } from "mocha"
import {
  NFT_NAME,
  NFT_SYMBOL,
  ZERO_ADDRESS,
  addNodeToken,
  bootstrapAndStartEmissions,
  bootstrapEmissions,
  catchRevert,
  createProposal,
  getEventName,
  getOrDeployContractInstances,
  getProposalIdFromTx,
  getVot3Tokens,
  participateInAllocationVoting,
  payDeposit,
  startNewAllocationRound,
  upgradeNFTtoLevel,
  waitForCurrentRoundToEnd,
  waitForProposalToBeActive,
} from "./helpers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { createTestConfig } from "./helpers/config"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { deployProxy, upgradeProxy } from "../scripts/helpers"
import { GalaxyMember, GalaxyMemberV1, GalaxyMemberV2, MockERC721Receiver } from "../typechain-types"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { endorseApp } from "./helpers/xnodes"
import { getConfig } from "@repo/config"

describe("Galaxy Member - @shard3", () => {
  describe("Contract parameters", () => {
    it("Should have correct parameters set on deployment", async () => {
      const { galaxyMember, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await galaxyMember.name()).to.equal("GalaxyMember")
      expect(await galaxyMember.symbol()).to.equal("GM")
      expect(await galaxyMember.hasRole(await galaxyMember.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.equal(
        true,
      )
      expect(await galaxyMember.hasRole(await galaxyMember.PAUSER_ROLE(), await owner.getAddress())).to.equal(true)
      expect(await galaxyMember.MAX_LEVEL()).to.equal(1)
    })

    it("Admin should be able to set x-allocation voting contract address", async () => {
      const { galaxyMember, owner, xAllocationVoting, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await galaxyMember.hasRole(await galaxyMember.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address)).to.equal(
        true,
      )
      const tx = await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      const receipt = await tx.wait()

      const name = getEventName(receipt, galaxyMember)
      expect(name).to.equal("XAllocationsGovernorAddressUpdated")

      expect(await galaxyMember.xAllocationsGovernor()).to.equal(await xAllocationVoting.getAddress())

      expect(
        await galaxyMember.hasRole(await galaxyMember.CONTRACTS_ADDRESS_MANAGER_ROLE(), otherAccount.address),
      ).to.equal(false)
      await expect(galaxyMember.connect(otherAccount).setXAllocationsGovernorAddress(otherAccount.address)).to.be
        .reverted // Only admin should be able to set x-allocation voting contract address

      await expect(galaxyMember.connect(owner).setXAllocationsGovernorAddress(ZERO_ADDRESS)).to.be.reverted // Cannot set x-allocation voting contract address to zero address
    })

    it("Admin should be able to set B3TR Governor contract address", async () => {
      const { galaxyMember, owner, xAllocationVoting, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await galaxyMember.hasRole(await galaxyMember.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address)).to.equal(
        true,
      )
      const tx = await galaxyMember.connect(owner).setB3trGovernorAddress(await xAllocationVoting.getAddress())
      const receipt = await tx.wait()

      const name = getEventName(receipt, galaxyMember)
      expect(name).to.equal("B3trGovernorAddressUpdated")

      expect(await galaxyMember.b3trGovernor()).to.equal(await xAllocationVoting.getAddress())

      expect(
        await galaxyMember.hasRole(await galaxyMember.CONTRACTS_ADDRESS_MANAGER_ROLE(), otherAccount.address),
      ).to.equal(false)
      await expect(galaxyMember.connect(otherAccount).setB3trGovernorAddress(await otherAccount.getAddress())).to.be
        .reverted // Only admin should be able to set B3TR Governor contract address

      await expect(galaxyMember.connect(owner).setB3trGovernorAddress(ZERO_ADDRESS)).to.be.reverted
    })

    it("Only admin should be able to set B3TR Governor contract address", async () => {
      const { galaxyMember, otherAccount, xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const initialAddress = await galaxyMember.b3trGovernor()

      await catchRevert(galaxyMember.connect(otherAccount).setB3trGovernorAddress(await xAllocationVoting.getAddress()))

      expect(await galaxyMember.b3trGovernor()).to.equal(initialAddress)
    })

    it("Only admin should be able to set x-allocation voting contract address", async () => {
      const { galaxyMember, otherAccount, xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const initialAddress = await galaxyMember.xAllocationsGovernor()

      await catchRevert(
        galaxyMember.connect(otherAccount).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress()),
      )

      expect(await galaxyMember.xAllocationsGovernor()).to.equal(initialAddress)
    })

    it("Should have base URI set correctly", async () => {
      const config = createLocalConfig()
      const { galaxyMember, owner } = await getOrDeployContractInstances({ forceDeploy: true, config })

      expect(await galaxyMember.baseURI()).to.equal(config.GM_NFT_BASE_URI)

      const tx = await galaxyMember.connect(owner).setBaseURI("https://newbaseuri.com/")
      const receipt = await tx.wait()

      const name = getEventName(receipt, galaxyMember)
      expect(name).to.equal("BaseURIUpdated")
    })

    it("Only pauser role should be able to pause and unpause the contract", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await galaxyMember.hasRole(await galaxyMember.PAUSER_ROLE(), otherAccount.address)).to.eql(false)
      expect(await galaxyMember.hasRole(await galaxyMember.PAUSER_ROLE(), owner.address)).to.eql(true)

      await catchRevert(galaxyMember.connect(otherAccount).pause())

      await galaxyMember.connect(owner).pause()

      expect(await galaxyMember.paused()).to.equal(true)

      await galaxyMember.connect(owner).unpause()

      expect(await galaxyMember.paused()).to.equal(false)

      await catchRevert(galaxyMember.connect(otherAccount).unpause())
    })

    it("Should have b3tr required to upgrade set on deployment", async () => {
      const { galaxyMember } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await galaxyMember.getB3TRtoUpgradeToLevel(2)).to.equal(10000000000000000000000n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(3)).to.equal(25000000000000000000000n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(4)).to.equal(50000000000000000000000n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(5)).to.equal(100000000000000000000000n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(6)).to.equal(250000000000000000000000n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(7)).to.equal(500000000000000000000000n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(8)).to.equal(2500000000000000000000000n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(9)).to.equal(5000000000000000000000000n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(10)).to.equal(25000000000000000000000000n)
    })

    it("Should be able to update b3tr required to upgrade if admin", async () => {
      const { galaxyMember, owner } = await getOrDeployContractInstances({ forceDeploy: false })

      const tx = await galaxyMember
        .connect(owner)
        .setB3TRtoUpgradeToLevel([
          10000000000000000000001n,
          25000000000000000000001n,
          50000000000000000000001n,
          100000000000000000000001n,
          250000000000000000000001n,
          500000000000000000000001n,
          2500000000000000000000001n,
          5000000000000000000000001n,
          25000000000000000000000001n,
        ])
      const receipt = await tx.wait()

      const name = getEventName(receipt, galaxyMember)
      expect(name).to.equal("B3TRtoUpgradeToLevelUpdated")

      expect(await galaxyMember.getB3TRtoUpgradeToLevel(2)).to.equal(10000000000000000000001n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(3)).to.equal(25000000000000000000001n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(4)).to.equal(50000000000000000000001n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(5)).to.equal(100000000000000000000001n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(6)).to.equal(250000000000000000000001n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(7)).to.equal(500000000000000000000001n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(8)).to.equal(2500000000000000000000001n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(9)).to.equal(5000000000000000000000001n)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(10)).to.equal(25000000000000000000000001n)
    })

    it("Admin should be able to set new base uri", async () => {
      const { galaxyMember, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      const newBaseURI = "https://newbaseuri.com/"

      await galaxyMember.connect(owner).setBaseURI(newBaseURI)

      expect(await galaxyMember.baseURI()).to.equal(newBaseURI)

      await expect(galaxyMember.connect(otherAccount).setBaseURI(newBaseURI + "2")).to.be.reverted

      await expect(galaxyMember.connect(owner).setBaseURI("")).to.be.reverted // base uri cannot be empty
    })

    it("Should have b3tr and treasury addresses set correctly", async () => {
      const { galaxyMember, b3tr, treasury } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await galaxyMember.b3tr()).to.equal(await b3tr.getAddress())
      expect(await galaxyMember.treasury()).to.equal(await treasury.getAddress())
    })

    it("Should support ERC 165 interface", async () => {
      const { galaxyMember } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await galaxyMember.supportsInterface("0x01ffc9a7")).to.equal(true) // ERC165
    })

    it("Should have Vechain Nodes Manager role correctly set", async () => {
      const { galaxyMember, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await galaxyMember.hasRole(await galaxyMember.NODES_MANAGER_ROLE(), owner.address)).to.eql(true)
    })

    it("Should have correct node to free level mapping", async () => {
      const { galaxyMember } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await galaxyMember.getNodeToFreeLevel(0)).to.equal(1) // Level 1 Free Upgrade for None
      expect(await galaxyMember.getNodeToFreeLevel(1)).to.equal(2) // Level 2 Free Upgrade for Strength
      expect(await galaxyMember.getNodeToFreeLevel(2)).to.equal(4) // Level 4 Free Upgrade for Thunder
      expect(await galaxyMember.getNodeToFreeLevel(3)).to.equal(6) // Level 6 Free Upgrade for Mjolnir
      expect(await galaxyMember.getNodeToFreeLevel(4)).to.equal(2) // Level 2 Free Upgrade for VeThorX
      expect(await galaxyMember.getNodeToFreeLevel(5)).to.equal(4) // Level 4 Free Upgrade for StrengthX
      expect(await galaxyMember.getNodeToFreeLevel(6)).to.equal(6) // Level 6 Free Upgrade for ThunderX
      expect(await galaxyMember.getNodeToFreeLevel(7)).to.equal(7) // Level 7 Free Upgrade for MjolnirX
    })
  })

  describe("ERC721 Compliance", () => {
    let galaxyMember: GalaxyMember
    let owner: HardhatEthersSigner
    let approved: HardhatEthersSigner
    let operator: HardhatEthersSigner
    let other: HardhatEthersSigner
    let tokenId: number

    beforeEach(async () => {
      const contracts = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      galaxyMember = contracts.galaxyMember
      owner = contracts.owner
      approved = contracts.otherAccount
      operator = contracts.otherAccounts[0]
      other = contracts.otherAccounts[1]

      // Mint a token for testing
      await participateInAllocationVoting(owner)
      await galaxyMember.connect(owner).freeMint()
      tokenId = 1
    })

    describe("ERC721 Metadata", () => {
      it("should implement supportsInterface for ERC721Metadata", async () => {
        const ERC721MetadataInterfaceId = "0x5b5e139f"
        expect(await galaxyMember.supportsInterface(ERC721MetadataInterfaceId)).to.be.true
      })

      it("should return correct name and symbol", async () => {
        expect(await galaxyMember.name()).to.equal("GalaxyMember")
        expect(await galaxyMember.symbol()).to.equal("GM")
      })
    })

    describe("ERC721 Enumerable", () => {
      it("should implement supportsInterface for ERC721Enumerable", async () => {
        const ERC721EnumerableInterfaceId = "0x780e9d63"
        expect(await galaxyMember.supportsInterface(ERC721EnumerableInterfaceId)).to.be.true
      })

      it("should correctly implement totalSupply and tokenByIndex", async () => {
        expect(await galaxyMember.totalSupply()).to.equal(1)
        expect(await galaxyMember.tokenByIndex(0)).to.equal(tokenId)
      })

      it("should correctly implement tokenOfOwnerByIndex", async () => {
        expect(await galaxyMember.tokenOfOwnerByIndex(owner.address, 0)).to.equal(tokenId)
      })
    })

    describe("ERC721 Core Functions", () => {
      it("should implement approve correctly", async () => {
        await galaxyMember.connect(owner).approve(approved.address, tokenId)
        expect(await galaxyMember.getApproved(tokenId)).to.equal(approved.address)
      })

      it("should implement setApprovalForAll correctly", async () => {
        await galaxyMember.connect(owner).setApprovalForAll(operator.address, true)
        expect(await galaxyMember.isApprovedForAll(owner.address, operator.address)).to.be.true
      })

      it("should emit Approval event on approve", async () => {
        await expect(galaxyMember.connect(owner).approve(approved.address, tokenId))
          .to.emit(galaxyMember, "Approval")
          .withArgs(owner.address, approved.address, tokenId)
      })

      it("should emit ApprovalForAll event on setApprovalForAll", async () => {
        await expect(galaxyMember.connect(owner).setApprovalForAll(operator.address, true))
          .to.emit(galaxyMember, "ApprovalForAll")
          .withArgs(owner.address, operator.address, true)
      })
    })

    describe("ERC721 Transfer Mechanics", () => {
      it("should correctly transfer tokens using transferFrom", async () => {
        await galaxyMember.connect(owner).approve(approved.address, tokenId)
        await galaxyMember.connect(approved).transferFrom(owner.address, other.address, tokenId)
        expect(await galaxyMember.ownerOf(tokenId)).to.equal(other.address)
      })

      it("should correctly transfer tokens using safeTransferFrom", async () => {
        await galaxyMember
          .connect(owner)
          ["safeTransferFrom(address,address,uint256)"](owner.address, other.address, tokenId)
        expect(await galaxyMember.ownerOf(tokenId)).to.equal(other.address)
      })

      it("should clear approvals after transfer", async () => {
        await galaxyMember.connect(owner).approve(approved.address, tokenId)
        await galaxyMember.connect(owner).transferFrom(owner.address, other.address, tokenId)
        expect(await galaxyMember.getApproved(tokenId)).to.equal(ethers.ZeroAddress)
      })
    })

    describe("ERC721 Safety Checks", () => {
      it("should revert when transferring to zero address", async () => {
        await expect(galaxyMember.connect(owner).transferFrom(owner.address, ethers.ZeroAddress, tokenId)).to.be
          .reverted
      })

      it("should revert when caller is not owner or approved", async () => {
        await expect(galaxyMember.connect(other).transferFrom(owner.address, other.address, tokenId)).to.be.reverted
      })

      it("should revert when querying non-existent token", async () => {
        const nonExistentTokenId = 999
        await expect(galaxyMember.ownerOf(nonExistentTokenId)).to.be.reverted
      })
    })

    describe("ERC721 Receiver Compliance", () => {
      let receiverContract: MockERC721Receiver

      beforeEach(async () => {
        const MockERC721Receiver = await ethers.getContractFactory("MockERC721Receiver")
        receiverContract = await MockERC721Receiver.deploy()
      })

      it("should transfer to ERC721Receiver implementer", async () => {
        await galaxyMember
          .connect(owner)
          ["safeTransferFrom(address,address,uint256)"](owner.address, await receiverContract.getAddress(), tokenId)
        expect(await galaxyMember.ownerOf(tokenId)).to.equal(await receiverContract.getAddress())
      })

      it("should revert when transferring to non-receiver contract", async () => {
        // Try to transfer to the GalaxyMember contract itself (which doesn't implement ERC721Receiver)
        await expect(
          galaxyMember
            .connect(owner)
            ["safeTransferFrom(address,address,uint256)"](owner.address, await galaxyMember.getAddress(), tokenId),
        ).to.be.reverted
      })
    })
  })

  describe("Contract upgradeablity", () => {
    it("Admin should be able to upgrade the contract", async function () {
      const { galaxyMember, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("GalaxyMember")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await galaxyMember.getAddress())

      const UPGRADER_ROLE = await galaxyMember.UPGRADER_ROLE()
      expect(await galaxyMember.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(galaxyMember.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await galaxyMember.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only admin should be able to upgrade the contract", async function () {
      const { galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("GalaxyMember")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await galaxyMember.getAddress())

      const UPGRADER_ROLE = await galaxyMember.UPGRADER_ROLE()
      expect(await galaxyMember.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(galaxyMember.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await galaxyMember.getAddress())

      expect(newImplAddress.toUpperCase()).to.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.not.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Admin can change UPGRADER_ROLE", async function () {
      const { galaxyMember, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("GalaxyMember")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await galaxyMember.getAddress())

      const UPGRADER_ROLE = await galaxyMember.UPGRADER_ROLE()
      expect(await galaxyMember.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(galaxyMember.connect(owner).grantRole(UPGRADER_ROLE, otherAccount.address)).to.not.be.reverted
      await expect(galaxyMember.connect(owner).revokeRole(UPGRADER_ROLE, owner.address)).to.not.be.reverted

      await expect(galaxyMember.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not
        .be.reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await galaxyMember.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Shouldn't be able to initialize the contract if already initialized", async function () {
      const config = createLocalConfig()
      const { galaxyMember, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        galaxyMember
          .connect(owner)
          .initializeV2(owner.address, owner.address, owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL),
      ).to.be.reverted
    })

    it("Should not be able to deploy contract with max level less than 1", async function () {
      const { owner, b3tr, treasury } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const config = createLocalConfig()

      await expect(
        deployProxy("GalaxyMemberV1", [
          {
            name: NFT_NAME,
            symbol: NFT_SYMBOL,
            admin: owner.address,
            upgrader: owner.address,
            pauser: owner.address,
            minter: owner.address,
            contractsAddressManager: owner.address,
            maxLevel: 0,
            baseTokenURI: config.GM_NFT_BASE_URI,
            b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
            b3tr: await b3tr.getAddress(),
            treasury: await treasury.getAddress(),
          },
        ]),
      ).to.be.reverted
    })

    it("Should not be able to increase max level if b3tr required to upgrade is not set", async function () {
      const { owner, b3tr, treasury, minterAccount, otherAccount, xAllocationVoting, governor } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const config = createLocalConfig()

      await expect(
        deployProxy("GalaxyMemberV1", [
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
            b3trToUpgradeToLevel: [],
            b3tr: await b3tr.getAddress(),
            treasury: await treasury.getAddress(),
          },
        ]),
      ).to.be.reverted

      // Deploy with correct b3tr required to upgrade
      const galaxyMember = (await deployProxy("GalaxyMemberV1", [
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
      ])) as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount)

      await galaxyMember.connect(otherAccount).freeMint()

      await galaxyMember.connect(otherAccount).burn(0)

      await galaxyMember.connect(otherAccount).freeMint()

      // Upgrade to level 2
      await upgradeNFTtoLevel(1, 2, galaxyMember, b3tr, otherAccount, minterAccount)

      await expect(upgradeNFTtoLevel(1, 3, galaxyMember, b3tr, otherAccount, minterAccount)).to.be.reverted // Should not be able to upgrade to level 3

      // Set max level to 3
      await expect(galaxyMember.connect(owner).setMaxLevel(3)).to.be.reverted // Should not be able to set max level to 3 as b3tr required to upgrade to level 3 is not set

      await galaxyMember.setB3TRtoUpgradeToLevel([10000000000000000000000n, 25000000000000000000000n]) // Set b3tr required to upgrade to level 3 too

      await galaxyMember.connect(owner).setMaxLevel(3) // Should be able to set max level to 3 now
    })

    it("Should not be able to deploy contract if base uri is empty", async function () {
      const { owner, b3tr, treasury } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const config = createLocalConfig()

      await expect(
        deployProxy("GalaxyMemberV1", [
          {
            name: NFT_NAME,
            symbol: NFT_SYMBOL,
            admin: owner.address,
            upgrader: owner.address,
            pauser: owner.address,
            minter: owner.address,
            contractsAddressManager: owner.address,
            maxLevel: 1,
            baseTokenURI: "",
            b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
            b3tr: await b3tr.getAddress(),
            treasury: await treasury.getAddress(),
          },
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy contract if b3tr address is not set", async function () {
      const { owner, treasury } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const config = createLocalConfig()

      await expect(
        deployProxy("GalaxyMemberV1", [
          {
            name: NFT_NAME,
            symbol: NFT_SYMBOL,
            admin: owner.address,
            upgrader: owner.address,
            pauser: owner.address,
            minter: owner.address,
            contractsAddressManager: owner.address,
            maxLevel: 1,
            baseTokenURI: config.GM_NFT_BASE_URI,
            b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
            b3tr: ZERO_ADDRESS,
            treasury: await treasury.getAddress(),
          },
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy contract if treasury address is not set", async function () {
      const { owner, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const config = createLocalConfig()

      await expect(
        deployProxy("GalaxyMemberV1", [
          {
            name: NFT_NAME,
            symbol: NFT_SYMBOL,
            admin: owner.address,
            upgrader: owner.address,
            pauser: owner.address,
            minter: owner.address,
            contractsAddressManager: owner.address,
            maxLevel: 1,
            baseTokenURI: config.GM_NFT_BASE_URI,
            b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
            b3tr: await b3tr.getAddress(),
            treasury: ZERO_ADDRESS,
          },
        ]),
      ).to.be.reverted
    })

    it("Should return correct version of the contract", async () => {
      const { galaxyMember } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await galaxyMember.version()).to.equal("4")
    })

    it("Should not have state conflict after upgrading to V3", async () => {
      const config = createLocalConfig()
      const {
        owner,
        b3tr,
        treasury,
        governor,
        xAllocationVoting,
        otherAccount,
        otherAccounts,
        minterAccount,
        vechainNodesMock,
        nodeManagement,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

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

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      const participated = await galaxyMember.connect(owner).participatedInGovernance(owner)
      expect(participated).to.equal(true)

      await galaxyMember.connect(owner).freeMint()
      await galaxyMember.connect(owner).burn(0)
      await galaxyMember.connect(owner).freeMint()
      await galaxyMember.connect(owner).freeMint()
      await galaxyMember.connect(owner).freeMint()
      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(4)

      // Transfer to other accounts
      await galaxyMember.connect(owner)["safeTransferFrom(address,address,uint256)"](owner, otherAccount, 1)

      await galaxyMember.connect(owner).transferFrom(owner.address, otherAccounts[0].address, 2)

      await galaxyMember.connect(owner).transferFrom(owner.address, otherAccounts[1].address, 3)

      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1)
      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1)
      expect(await galaxyMember.balanceOf(await otherAccounts[0].getAddress())).to.equal(1)
      expect(await galaxyMember.balanceOf(await otherAccounts[1].getAddress())).to.equal(1)

      expect(await galaxyMember.ownerOf(4)).to.equal(await owner.getAddress())
      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress())
      expect(await galaxyMember.ownerOf(2)).to.equal(await otherAccounts[0].getAddress())
      expect(await galaxyMember.ownerOf(3)).to.equal(await otherAccounts[1].getAddress())

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
      )) as unknown as GalaxyMemberV2

      let storageSlotsAfter = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await galaxyMemberV2.getAddress(), i))
      }

      storageSlotsAfter = storageSlotsAfter.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      ) // removing empty slots

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      await galaxyMemberV2.setVechainNodes(await vechainNodesMock.getAddress())

      expect(await galaxyMemberV2.balanceOf(await owner.getAddress())).to.equal(1)
      expect(await galaxyMemberV2.balanceOf(await otherAccount.getAddress())).to.equal(1)
      expect(await galaxyMemberV2.balanceOf(await otherAccounts[0].getAddress())).to.equal(1)
      expect(await galaxyMemberV2.balanceOf(await otherAccounts[1].getAddress())).to.equal(1)

      expect(await galaxyMemberV2.ownerOf(4)).to.equal(await owner.getAddress())
      expect(await galaxyMemberV2.ownerOf(1)).to.equal(await otherAccount.getAddress())
      expect(await galaxyMemberV2.ownerOf(2)).to.equal(await otherAccounts[0].getAddress())
      expect(await galaxyMemberV2.ownerOf(3)).to.equal(await otherAccounts[1].getAddress())

      await galaxyMemberV2.connect(owner).freeMint()

      expect(await galaxyMemberV2.balanceOf(await owner.getAddress())).to.equal(2)
      expect(await galaxyMemberV2.ownerOf(5)).to.equal(await owner.getAddress())

      expect(await galaxyMemberV2.levelOf(1)).to.equal(1)

      // Let's upgrade a token minted with V1
      await upgradeNFTtoLevel(1, 2, galaxyMemberV2, b3tr, otherAccount, minterAccount)

      expect(await galaxyMemberV2.levelOf(1)).to.equal(2)

      // Mint MjolnirX
      await addNodeToken(7, otherAccount)

      expect(await vechainNodesMock.idToOwner(2)).to.equal(await otherAccount.getAddress())
      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress())

      await galaxyMember.setMaxLevel(10)

      expect(await galaxyMemberV2.getLevelAfterAttachingNode(1, 2)).to.equal(7)

      await galaxyMemberV2.connect(otherAccount).attachNode(2, 1)

      expect(await galaxyMemberV2.levelOf(1)).to.equal(7)

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
      )) as unknown as GalaxyMember

      storageSlotsAfter = []
      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await galaxyMemberV3.getAddress(), i))
      }

      storageSlotsAfter = storageSlotsAfter.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      )

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      expect(await galaxyMemberV3.balanceOf(await owner.getAddress())).to.equal(2)
      expect(await galaxyMemberV3.balanceOf(await otherAccount.getAddress())).to.equal(1)
      expect(await galaxyMemberV3.balanceOf(await otherAccounts[0].getAddress())).to.equal(1)
      expect(await galaxyMemberV3.balanceOf(await otherAccounts[1].getAddress())).to.equal(1)

      expect(await galaxyMemberV3.ownerOf(4)).to.equal(await owner.getAddress())
      expect(await galaxyMemberV3.ownerOf(1)).to.equal(await otherAccount.getAddress())
      expect(await galaxyMemberV3.ownerOf(2)).to.equal(await otherAccounts[0].getAddress())
      expect(await galaxyMemberV3.ownerOf(3)).to.equal(await otherAccounts[1].getAddress())

      await galaxyMemberV3.connect(owner).freeMint()

      expect(await galaxyMemberV3.balanceOf(await owner.getAddress())).to.equal(3)
      expect(await galaxyMemberV3.ownerOf(5)).to.equal(await owner.getAddress())

      expect(await galaxyMemberV3.levelOf(1)).to.equal(7)

      // Get checkpointed token Id
      const checkpointedTokenId = await galaxyMemberV3.getSelectedTokenIdAtBlock(
        owner.address,
        await ethers.provider.getBlockNumber(),
      )
      expect(checkpointedTokenId).to.equal(0n)

      // admin selects users token as part of upgrade
      await galaxyMemberV3.connect(owner).selectFor(owner.getAddress(), 4)
      expect(await galaxyMemberV3.getSelectedTokenId(owner.getAddress())).to.equal(4)

      // Get checkpointed token Id
      const checkpointedTokenId2 = await galaxyMemberV3.getSelectedTokenIdAtBlock(
        owner.address,
        await ethers.provider.getBlockNumber(),
      )
      expect(checkpointedTokenId2).to.equal(4n)

      await galaxyMemberV3.connect(owner).transferFrom(owner.address, otherAccounts[6].address, 4)

      // Get checkpointed token Id
      expect(
        await galaxyMemberV3.getSelectedTokenIdAtBlock(owner.address, await ethers.provider.getBlockNumber()),
      ).to.equal(6n)

      expect(await galaxyMemberV3.getSelectedTokenId(owner.getAddress())).to.equal(6n)

      // Check if the token is transferred
      expect(await galaxyMemberV3.ownerOf(4)).to.equal(await otherAccounts[6].getAddress())

      // Get checkpointed token Id
      expect(
        await galaxyMemberV3.getSelectedTokenIdAtBlock(
          otherAccounts[6].address,
          await ethers.provider.getBlockNumber(),
        ),
      ).to.equal(4n)

      storageSlots = []
      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlots.push(await ethers.provider.getStorage(await galaxyMemberV2.getAddress(), i))
      }

      storageSlots = storageSlots.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      )

      const galaxyMemberV4 = (await upgradeProxy(
        "GalaxyMemberV3",
        "GalaxyMember",
        await galaxyMember.getAddress(),
        [],
        { version: 4 },
      )) as unknown as GalaxyMember

      storageSlotsAfter = []
      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await galaxyMemberV3.getAddress(), i))
      }

      storageSlotsAfter = storageSlotsAfter.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      )

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      // Transfer the token
      await galaxyMemberV4.connect(owner).transferFrom(owner.address, otherAccounts[6].address, 6)
      await galaxyMemberV4.connect(owner).transferFrom(owner.address, otherAccounts[6].address, 5)

      // Check if the token is transferred
      expect(await galaxyMemberV4.ownerOf(4)).to.equal(await otherAccounts[6].getAddress())

      expect(await galaxyMemberV4.getSelectedTokenId(owner.getAddress())).to.equal(0n)

      // Get checkpointed token Id
      expect(
        await galaxyMemberV4.getSelectedTokenIdAtBlock(
          otherAccounts[6].address,
          await ethers.provider.getBlockNumber(),
        ),
      ).to.equal(4n)
    })
  })

  describe("Minting", () => {
    it("Cannot mint if B3TRGovernor address is not set", async () => {
      const config = createLocalConfig()
      const { otherAccount, b3tr, xAllocationVoting, owner, emissions, minterAccount, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Grant minter role to emissions contract
      await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

      // Bootstrap emissions
      await emissions.connect(minterAccount).bootstrap()

      // Should be able to free mint after participating in allocation voting
      await participateInAllocationVoting(otherAccount)

      // Deploy Galaxy Member contract
      const galaxyMember = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 1,
          baseTokenURI: config.GM_NFT_BASE_URI,
          xNodeMaxMintableLevels: [1, 2, 3, 4, 5, 6, 7],
          b3trToUpgradeToLevel: [1000000n],
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await catchRevert(galaxyMember.connect(otherAccount).freeMint())
    })

    it("Cannot mint if XAllocation address is not set", async () => {
      const config = createLocalConfig()
      const { otherAccount, b3tr, owner, governor, emissions, minterAccount, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Grant minter role to emissions contract
      await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

      // Bootstrap emissions
      await emissions.connect(minterAccount).bootstrap()

      // Should be able to free mint after participating in allocation voting
      await participateInAllocationVoting(otherAccount)

      // Deploy Galaxy Member contract
      const galaxyMember = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 1,
          baseTokenURI: config.GM_NFT_BASE_URI,
          xNodeMaxMintableLevels: [1, 2, 3, 4, 5, 6, 7],
          b3trToUpgradeToLevel: [1000000n],
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())

      await catchRevert(galaxyMember.connect(otherAccount).freeMint())
    })

    it("Can know if user participated in governance if XAllocation and B3TRGovernor addresses are set", async () => {
      const config = createLocalConfig()
      const { otherAccount, xAllocationVoting, owner, governor, b3tr, treasury } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Should be able to free mint after participating in allocation voting
      await participateInAllocationVoting(otherAccount)

      // Deploy Galaxy Member contract
      const galaxyMember = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 1,
          baseTokenURI: config.GM_NFT_BASE_URI,
          xNodeMaxMintableLevels: [1, 2, 3, 4, 5, 6, 7],
          b3trToUpgradeToLevel: [1000000n],
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      const participated = await galaxyMember.connect(otherAccount).participatedInGovernance(otherAccount)
      expect(participated).to.equal(true)
    })

    it("User cannot free mint if he did not participate in x-allocation voting or b3tr governance", async () => {
      const { galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Should not be able to free mint
      await catchRevert(galaxyMember.connect(otherAccount).freeMint())
    })

    it("User can free mint if participated in x-allocation voting", async () => {
      const { galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Should not be able to free mint
      await catchRevert(galaxyMember.connect(otherAccount).freeMint())

      // Should be able to free mint after participating in allocation voting
      await participateInAllocationVoting(otherAccount)

      expect(await galaxyMember.connect(otherAccount).freeMint()).not.to.be.reverted

      await galaxyMember.setMaxLevel(10)

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount
      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1

      const tokenId = await galaxyMember.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)

      //await galaxyMember.setMaxLevel(10)
      const tokenInfo = await galaxyMember.getTokenInfoByTokenId(tokenId)

      expect(tokenInfo?.tokenId).to.equal(1)
      expect(tokenInfo?.tokenURI.includes("ipfs://")).to.equal(true)
      expect(tokenInfo?.tokenLevel).to.equal(1)
      expect(tokenInfo?.b3trToUpgrade).to.equal(10000000000000000000000n)
    })

    it("User can free mint if he participated in B3TR Governance", async () => {
      const { galaxyMember, otherAccount, b3tr, otherAccounts, governor, B3trContract, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      const voter = otherAccounts[0]

      // Should not be able to free mint
      await catchRevert(galaxyMember.connect(voter).freeMint())

      // we do it here but will use in the next test
      await getVot3Tokens(voter, "30000")

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.toggleCheck(1)

      // Now we can create a new proposal
      const tx = await createProposal(b3tr, B3trContract, otherAccount, "", "tokenDetails", [])
      const proposalId = await getProposalIdFromTx(tx)
      await payDeposit(proposalId, otherAccount)
      await waitForProposalToBeActive(proposalId)
      // Now we can vote
      await governor.connect(voter).castVote(proposalId, 1)

      // I should be able to free mint
      await galaxyMember.connect(voter).freeMint()

      expect(await galaxyMember.balanceOf(await voter.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.ownerOf(1)).to.equal(await voter.getAddress()) // Owner of the first NFT is the otherAccount
      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1
      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await voter.getAddress()))).to.equal(1) // Level 0
    })

    it("User can free mint if he participated both in B3TR Governance and in x-allocation voting", async () => {
      const { galaxyMember, otherAccount, b3tr, otherAccounts, governor, B3trContract, veBetterPassport } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      const voter = otherAccounts[0]

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.toggleCheck(1)

      // Should not be able to free mint
      await catchRevert(galaxyMember.connect(voter).freeMint())

      // we do it here but will use in the next test
      await getVot3Tokens(voter, "30000")

      // Now we can create a new proposal
      const tx = await createProposal(b3tr, B3trContract, otherAccount, "", "tokenDetails", [])
      const proposalId = await getProposalIdFromTx(tx)
      await payDeposit(proposalId, otherAccount)

      await waitForProposalToBeActive(proposalId)
      // Now we can vote
      await governor.connect(voter).castVote(proposalId, 1)

      await waitForCurrentRoundToEnd()

      // Should be able to free mint after participating in allocation voting
      await participateInAllocationVoting(voter)

      // I should be able to free mint
      await galaxyMember.connect(voter).freeMint()
    })

    it("Should mint a level 1 token", async () => {
      const config = createLocalConfig()
      const { galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount)

      const tx = await galaxyMember.connect(otherAccount).freeMint()

      const receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      const events = receipt?.logs

      const decodedEvents = events?.map(event => {
        return galaxyMember.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents?.length).to.equal(2)

      expect(decodedEvents?.[0]?.name).to.equal("Transfer")
      expect(decodedEvents?.[0]?.args?.[0]).to.equal(ZERO_ADDRESS)
      expect(decodedEvents?.[0]?.args?.[1]).to.equal(await otherAccount.getAddress())

      expect(decodedEvents?.[1]?.name).to.equal("Selected")
      expect(decodedEvents?.[1]?.args?.[0]).to.equal(await otherAccount.getAddress())
      expect(decodedEvents?.[1]?.args?.[1]).to.equal(1)

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount
      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1
      expect(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())).to.equal(1) // Selected token ID is 0

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1) // Token ID of the first NFT is 1
      expect(await galaxyMember.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(1) // Token ID of the first NFT owned by otherAccount is 1

      expect(await galaxyMember.tokenURI(1)).to.equal(`${config.GM_NFT_BASE_URI}1.json`) // Token URI of the first NFT is the "base URI/level"
    })

    it("Should be able to free mint multiple NFTs", async () => {
      const { galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount)

      await galaxyMember.connect(otherAccount).freeMint()

      await galaxyMember.connect(otherAccount).freeMint()

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(2) // Other account has 2 NFTs

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(otherAccount))).to.equal(1) // Level 1
    })

    it("Should be able to free mint multiple NFTs and retrieve them with pagination", async () => {
      const { galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount)

      // Mint 12 NFTs
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()
      await galaxyMember.connect(otherAccount).freeMint()

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(12) // Other account has 12 NFTs

      // Retrieve NFTs with 3 pages of size 5
      const page1 = await galaxyMember.getTokensInfoByOwner(otherAccount, 0, 5)
      const page2 = await galaxyMember.getTokensInfoByOwner(otherAccount, 1, 5)
      const page3 = await galaxyMember.getTokensInfoByOwner(otherAccount, 2, 5)
      const page4 = await galaxyMember.getTokensInfoByOwner(otherAccount, 3, 5)

      expect(page1.length).to.equal(5)
      expect(page2.length).to.equal(5)
      expect(page3.length).to.equal(2) // last page
      expect(page4.length).to.equal(0) // should be empty
    })

    it("Should handle multiple mints from different accounts correctly", async () => {
      const { galaxyMember, otherAccount, owner, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount, true)

      await galaxyMember.connect(otherAccount).freeMint()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, false, otherAccounts[4])

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 NFT

      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount
      expect(await galaxyMember.ownerOf(2)).to.equal(await owner.getAddress()) // Owner of the second NFT is the owner

      expect(await galaxyMember.totalSupply()).to.equal(2) // Total supply is 2

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1
      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1) // Token ID of the first NFT is 1
      expect(await galaxyMember.tokenByIndex(1)).to.equal(2) // Token ID of the second NFT is 2

      expect(await galaxyMember.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(1) // Token ID of the first NFT owned by otherAccount is 1
      expect(await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)).to.equal(2) // Token ID of the first NFT owned by owner is 1

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(otherAccount))).to.equal(1)
      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(owner))).to.equal(1)
    })

    it("Cannot mint if contract is paused", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount)

      await galaxyMember.connect(owner).pause()

      await catchRevert(galaxyMember.connect(otherAccount).freeMint())

      await galaxyMember.connect(owner).unpause()

      await galaxyMember.connect(otherAccount).freeMint()
    })

    it("Should be able to mint again after transferring a NFT", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(owner))).to.equal(1)

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(owner))).to.equal(1) // was expect(await galaxyMember.getHighestLevel(owner)).to.equal(0) // Level 0 (no NFT)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(owner))).to.equal(1)

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 NFT

      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount
      expect(await galaxyMember.ownerOf(2)).to.equal(await owner.getAddress()) // Owner of the second NFT is the owner

      expect(await galaxyMember.totalSupply()).to.equal(2) // Total supply is 2

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1
      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1) // Token ID of the first NFT is 1
      expect(await galaxyMember.tokenByIndex(1)).to.equal(2) // Token ID of the second NFT is 2

      expect(await galaxyMember.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(1) // Token ID of the first NFT owned by otherAccount is 1
      expect(await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)).to.equal(2) // Token ID of the first NFT owned by owner is 2
    })

    it("Should return empty string for tokenURI of token that doesn't exist", async () => {
      const { galaxyMember } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await galaxyMember.tokenURI(0)).to.equal("")
    })

    it("Should not be able to free mint if public minting is paused", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount)

      const tx = await galaxyMember.connect(owner).setIsPublicMintingPaused(true)
      const receipt = await tx.wait()

      const name = getEventName(receipt, galaxyMember)
      expect(name).to.equal("PublicMintingPaused")

      await expect(galaxyMember.connect(otherAccount).freeMint()).to.be.reverted

      await galaxyMember.connect(owner).setIsPublicMintingPaused(false)

      await galaxyMember.connect(otherAccount).freeMint()
    })
  })

  describe("Transferring", () => {
    it("Should be able to receive a GM NFT from another account", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(0) // Owner has 0 NFTs

      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount

      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1) // Token ID of the first NFT is 1

      expect(await galaxyMember.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(1) // Token ID of the first NFT owned by otherAccount is 1
    })

    it("Should not be able to transfer a NFT if transfers are paused", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).pause()

      await catchRevert(
        galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 0),
      )

      await galaxyMember.connect(owner).unpause()

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)
    })

    it("Should be able to receive a GM NFT from another account if you already have one", async () => {
      const { galaxyMember, otherAccount, owner, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount, true, otherAccounts[2])
      await participateInAllocationVoting(owner, false, otherAccounts[3])

      await galaxyMember.connect(otherAccount).freeMint()

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 2)

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(2) // Other account has 2 tokens
    })

    it("Should track ownership correctly after multiple transfers", async () => {
      const { galaxyMember, otherAccount, owner, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      let tx = await galaxyMember.connect(owner).freeMint()

      let receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      let events = receipt?.logs

      let decodedEvents = events?.map(event => {
        return galaxyMember.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents?.length).to.equal(2)

      expect(decodedEvents?.[1]?.name).to.equal("Selected")
      expect(decodedEvents?.[1]?.args?.[0]).to.equal(await owner.getAddress())
      expect(decodedEvents?.[1]?.args?.[1]).to.equal(1)

      tx = await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

      receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      events = receipt?.logs

      decodedEvents = events?.map(event => {
        return galaxyMember.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents?.length).to.equal(2)

      expect(decodedEvents?.[1]?.name).to.equal("Selected")
      expect(decodedEvents?.[1]?.args?.[0]).to.equal(await otherAccount.getAddress())
      expect(decodedEvents?.[1]?.args?.[1]).to.equal(1)

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(0) // Owner has 0 NFTs

      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(1) // Level 1
      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await owner.getAddress()))).to.equal(1) // Level 1

      tx = await galaxyMember
        .connect(otherAccount)
        .transferFrom(await otherAccount.getAddress(), await otherAccounts[0].getAddress(), 1)

      receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(0) // Other account has 0 NFTs
      expect(await galaxyMember.balanceOf(await otherAccounts[0].getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(0) // Owner has 0 NFTs

      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(1) // Level 1
      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccounts[0].getAddress())),
      ).to.equal(1) // Level 1
      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await owner.getAddress()))).to.equal(1) // Level 1
    })

    it("Should be able to send GM NFT to same account", async () => {
      const { galaxyMember, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await owner.getAddress(), 1)

      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 NFT
      expect(await galaxyMember.ownerOf(1)).to.equal(await owner.getAddress()) // Owner of the first NFT is the owner
      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1
    })

    it("Should be able to burn a GM NFT owned", async () => {
      const { galaxyMember, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).burn(1)

      await galaxyMember.transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 2)

      expect(await galaxyMember.tokenByIndex(0)).to.equal(2)

      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(0) // Owner has 0 NFTs
      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1

      await expect(galaxyMember.connect(owner).burn(3)).to.be.reverted // Owner cannot burn a token he doesn't own
    })

    it("Should be able to transfer NFT approved on behalf of owner", async () => {
      const { galaxyMember, owner, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).approve(await otherAccount.getAddress(), 1)

      await galaxyMember
        .connect(otherAccount)
        .transferFrom(await owner.getAddress(), await otherAccounts[0].getAddress(), 1)

      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(2)

      expect(await galaxyMember.balanceOf(await otherAccounts[0].getAddress())).to.equal(1) // Other accounts [0] has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 NFTs

      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccounts[0].getAddress()) // Owner of the first NFT is the otherAccounts[0]

      expect(await galaxyMember.totalSupply()).to.equal(2) // Total supply is 1

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1) // Token ID of the first NFT is 1

      expect(await galaxyMember.tokenOfOwnerByIndex(await otherAccounts[0].getAddress(), 0)).to.equal(1) // Token ID of the first NFT owned by otherAccounts[0] is 1

      // Now let's mint two other NFTs and transfer one, asserting that the next one is selected
      await galaxyMember.connect(owner).freeMint() // Token id 3
      await galaxyMember.connect(owner).freeMint() // Token id 4
      await galaxyMember.connect(owner).burn(4)
      await galaxyMember.connect(owner).freeMint() // Token id 5

      await galaxyMember.connect(owner).approve(await otherAccount.getAddress(), 2)

      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(2) // Selected token is 2

      await galaxyMember
        .connect(otherAccount)
        .transferFrom(await owner.getAddress(), await otherAccounts[0].getAddress(), 2)

      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(5) // Selected token is 5 (next one). Token 4 was burnt

      await galaxyMember.connect(owner).approve(await otherAccount.getAddress(), 5)

      await galaxyMember
        .connect(otherAccount)
        .transferFrom(await owner.getAddress(), await otherAccounts[0].getAddress(), 5)

      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(3) // Selected token is 3 (Next highest token ID)

      expect(await galaxyMember.balanceOf(await otherAccounts[0].getAddress())).to.equal(3) // Other accounts [0] has 3 NFTs

      // Can transfer to self
      await galaxyMember
        .connect(otherAccounts[0])
        .transferFrom(await otherAccounts[0].getAddress(), await otherAccounts[0].getAddress(), 1)

      // Can transfer to self through approval
      await galaxyMember.connect(otherAccounts[0]).approve(await owner.getAddress(), 1)
      await galaxyMember
        .connect(owner)
        .transferFrom(await otherAccounts[0].getAddress(), await otherAccounts[0].getAddress(), 1)

      expect(await galaxyMember.balanceOf(await otherAccounts[0].getAddress())).to.equal(3) // Other accounts [0] has 3 NFTs
      expect(await galaxyMember.getSelectedTokenId(await otherAccounts[0].getAddress())).to.equal(1) // Nothing changed from the transfers to self, selected token is still 1
    })

    it("operator should be able to transfer ALL NFTs on behalf of owner", async () => {
      const { galaxyMember, owner, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).setApprovalForAll(await otherAccount.getAddress(), true)

      await galaxyMember
        .connect(otherAccount)
        .transferFrom(await owner.getAddress(), await otherAccounts[0].getAddress(), 1)

      await galaxyMember
        .connect(otherAccount)
        .transferFrom(await owner.getAddress(), await otherAccounts[0].getAddress(), 2)

      await galaxyMember
        .connect(otherAccount)
        .transferFrom(await owner.getAddress(), await otherAccounts[0].getAddress(), 3)

      expect(await galaxyMember.balanceOf(await otherAccounts[0].getAddress())).to.equal(3)
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1)

      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccounts[0].getAddress())
      expect(await galaxyMember.ownerOf(2)).to.equal(await otherAccounts[0].getAddress())
      expect(await galaxyMember.ownerOf(3)).to.equal(await otherAccounts[0].getAddress())

      expect(await galaxyMember.totalSupply()).to.equal(4)

      expect(await galaxyMember.levelOf(1)).to.equal(1)
      expect(await galaxyMember.levelOf(2)).to.equal(1)
      expect(await galaxyMember.levelOf(3)).to.equal(1)

      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(4)
      expect(await galaxyMember.getSelectedTokenId(await otherAccounts[0].getAddress())).to.equal(1)

      await galaxyMember.connect(otherAccounts[0]).setApprovalForAll(await otherAccount.getAddress(), true)

      // Transfer back to owner
      await galaxyMember
        .connect(otherAccount)
        .transferFrom(await otherAccounts[0].getAddress(), await owner.getAddress(), 1)

      expect(await galaxyMember.balanceOf(await otherAccounts[0].getAddress())).to.equal(2)
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(2)

      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(4)
      expect(await galaxyMember.getSelectedTokenId(await otherAccounts[0].getAddress())).to.not.equal(0) // Must have a selected token so it's not 0

      // Revoke approval
      await galaxyMember.connect(otherAccounts[0]).setApprovalForAll(await otherAccount.getAddress(), false)

      await expect(
        galaxyMember
          .connect(otherAccount)
          .transferFrom(await otherAccounts[0].getAddress(), await owner.getAddress(), 2),
      ).to.be.reverted

      // Add approval again
      await galaxyMember.connect(otherAccounts[0]).setApprovalForAll(await otherAccount.getAddress(), true)

      // Transfer back to owner
      await galaxyMember
        .connect(otherAccount)
        .transferFrom(await otherAccounts[0].getAddress(), await owner.getAddress(), 2)

      expect(await galaxyMember.balanceOf(await otherAccounts[0].getAddress())).to.equal(1)
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(3)
    })
  })

  describe("Token Selection", () => {
    it("Should not select level 0 if I still have a token when transferring out", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      let tx = await galaxyMember.connect(owner).freeMint()

      let receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await owner.getAddress()))).to.equal(1) // Level 1

      await galaxyMember.connect(owner).freeMint()

      tx = await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

      receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 NFT

      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(1) // Level 1
      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await owner.getAddress()))).to.equal(1) // Level 1

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 2)

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(2) // Other account has 2 NFTs

      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(1) // Level 1

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await owner.getAddress()))).to.equal(1) // Level 1
    })

    it("Should select level of token received from another account if I don't have any tokens", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount, true)

      let tx = await galaxyMember.connect(otherAccount).freeMint() // Token id 1

      let receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      // Check for Selected and SelectedLevel events
      let events = receipt?.logs

      let decodedEvents = events?.map(event => {
        return galaxyMember.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents?.[1]?.name).to.equal("Selected")
      expect(decodedEvents?.[1]?.args?.[0]).to.equal(await otherAccount.getAddress())
      expect(decodedEvents?.[1]?.args?.[1]).to.equal(1)

      tx = await galaxyMember
        .connect(otherAccount)
        .transferFrom(await otherAccount.getAddress(), await owner.getAddress(), 1)

      receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      // Check for Selected and SelectedLevel events
      events = receipt?.logs

      decodedEvents = events?.map(event => {
        return galaxyMember.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents?.[1]?.name).to.equal("Selected")
      expect(decodedEvents?.[1]?.args?.[0]).to.equal(await owner.getAddress())
      expect(decodedEvents?.[1]?.args?.[1]).to.equal(1)

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(0) // Other account has 0 tokens
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 token

      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(1) // Level 1
      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await owner.getAddress()))).to.equal(1) // Level 1
    })

    it("Should retrieve selected token info", async () => {
      const { galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount, true)

      let tx = await galaxyMember.connect(otherAccount).freeMint() // Token id 1

      let receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      await galaxyMember.setMaxLevel(10)

      const selectedTokenInfo = await galaxyMember.getSelectedTokenInfoByOwner(await otherAccount.getAddress())

      expect(selectedTokenInfo?.tokenId).to.equal(1)
      expect(selectedTokenInfo?.tokenURI.includes("ipfs://")).to.equal(true)
      expect(selectedTokenInfo?.tokenLevel).to.equal(1)
      expect(selectedTokenInfo?.b3trToUpgrade).to.equal(10000000000000000000000n)
    })

    it("Admin should be able to select a token for an account", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount, true)

      await galaxyMember.connect(otherAccount).freeMint() // Token id 1

      await galaxyMember.connect(otherAccount).freeMint() // Token id 2

      await galaxyMember.connect(owner).selectFor(await otherAccount.getAddress(), 2)

      expect(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())).to.equal(2)

      await galaxyMember.connect(owner).selectFor(await otherAccount.getAddress(), 1)

      expect(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())).to.equal(1)
    })

    it("Admin should not be able to select a token for an account if the token is not owned by the account", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      await galaxyMember.connect(owner).freeMint() // Token id 1

      await expect(galaxyMember.connect(owner).selectFor(await otherAccount.getAddress(), 1)).to.be.reverted
    })

    it("Should checkpoint selected token correctly", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const blockNumber1 = await ethers.provider.getBlockNumber()

      await galaxyMember.connect(owner).freeMint() // Token id 1

      const blockNumber2 = await ethers.provider.getBlockNumber()

      await galaxyMember.connect(owner).freeMint() // Token id 2

      const blockNumber3 = await ethers.provider.getBlockNumber()

      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(1)

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

      const blockNumber4 = await ethers.provider.getBlockNumber()

      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(2)

      expect(await galaxyMember.getSelectedTokenIdAtBlock(await owner.getAddress(), blockNumber1)).to.equal(0)

      expect(await galaxyMember.getSelectedTokenIdAtBlock(await owner.getAddress(), blockNumber2)).to.equal(1)

      expect(await galaxyMember.getSelectedTokenIdAtBlock(await owner.getAddress(), blockNumber3)).to.equal(1)

      expect(await galaxyMember.getSelectedTokenIdAtBlock(await owner.getAddress(), blockNumber4)).to.equal(2)
      expect(await galaxyMember.getSelectedTokenIdAtBlock(await otherAccount.getAddress(), blockNumber4)).to.equal(1)

      await galaxyMember.connect(owner).burn(2)
      expect(
        await galaxyMember.getSelectedTokenIdAtBlock(await owner.getAddress(), await ethers.provider.getBlockNumber()),
      ).to.equal(0)
      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(0)

      await galaxyMember.connect(owner).freeMint() // Token id 3
      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(3)
      expect(
        await galaxyMember.getSelectedTokenIdAtBlock(await owner.getAddress(), await ethers.provider.getBlockNumber()),
      ).to.equal(3)
    })
  })

  describe("Upgrading", () => {
    it("Should be able to upgrade a level 1 token to a level 2 token", async () => {
      const { owner, b3tr, minterAccount, treasury, otherAccount, galaxyMember } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      await galaxyMember.connect(owner).setMaxLevel(2)

      await galaxyMember.connect(owner).freeMint() // Token id 0

      await catchRevert(galaxyMember.connect(owner).upgrade(0)) // Insufficient B3TR to upgrade

      await b3tr.connect(minterAccount).mint(owner, ethers.parseEther("10000")) // Get some 10,000 B3TR required to upgrade to level 2

      await b3tr.connect(owner).approve(await galaxyMember.getAddress(), ethers.parseEther("10000")) // We need to approve the galaxyMember contract to transfer the B3TR required to upgrade from the owner's account

      const balanceOfTreasuryBefore = await b3tr.balanceOf(await treasury.getAddress())

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      await galaxyMember.connect(owner).upgrade(1) // Upgrade token id 1 to level 2

      const balanceOfTreasuryAfter = await b3tr.balanceOf(await treasury.getAddress())

      expect(balanceOfTreasuryAfter - balanceOfTreasuryBefore).to.equal(ethers.parseEther("10000")) // 10,000 B3TR should be transferred to the treasury pool

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      await expect(upgradeNFTtoLevel(1, 3, galaxyMember, b3tr, owner, minterAccount)).to.be.reverted // Level 3 is not available

      await expect(galaxyMember.connect(otherAccount).setMaxLevel(3)).to.be.reverted // Only owner can set max level

      await expect(galaxyMember.connect(owner).setMaxLevel(2)).to.be.reverted // Max level must be greater than current level

      const tx = await galaxyMember.connect(owner).setMaxLevel(3)
      const receipt = await tx.wait()

      const name = getEventName(receipt, galaxyMember)
      expect(name).to.equal("MaxLevelUpdated")

      await b3tr.connect(minterAccount).mint(owner, await galaxyMember.getB3TRtoUpgradeToLevel(3))

      await b3tr.connect(owner).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgradeToLevel(3))

      await galaxyMember.connect(owner).upgrade(1) // Upgrade token id 1 to level 3

      expect(await galaxyMember.levelOf(1)).to.equal(3) // Level 3
    })

    it("Should be able to transfer a token with level greater than 1", async () => {
      const config = createLocalConfig()
      const { owner, xAllocationVoting, b3tr, minterAccount, governor, otherAccount, treasury, nodeManagement } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 2,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await galaxyMember.connect(owner).freeMint() // Token id 1

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.connect(owner).freeMint() // Token id 2

      await b3tr.connect(minterAccount).mint(owner, ethers.parseEther("10000")) // Get some 10,000 B3TR required to upgrade to level 2

      await b3tr.connect(owner).approve(await galaxyMember.getAddress(), ethers.parseEther("10000")) // We need to approve the galaxyMember contract to transfer the B3TR required to upgrade from the owner's account

      await galaxyMember.connect(owner).upgrade(2) // Upgrade token id 0 to level 2

      expect(await galaxyMember.levelOf(2)).to.equal(2) // Level 2

      let tx = await galaxyMember
        .connect(owner)
        .transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 2)

      let receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      let events = receipt?.logs

      let decodedEvents = events?.map(event => {
        return galaxyMember.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents?.[1]?.name).to.equal("Selected")
      expect(decodedEvents?.[1]?.args?.[0]).to.equal(await otherAccount.getAddress())
      expect(decodedEvents?.[1]?.args?.[1]).to.equal(2) // Previous level

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 token
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 tokens

      expect(await galaxyMember.levelOf(2)).to.equal(2) // Level 2

      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(2)
      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await owner.getAddress()))).to.equal(1) // Level 1
    })

    it("Should not be able to upgrade if contract is paused", async () => {
      const config = createLocalConfig()
      const { owner, xAllocationVoting, b3tr, minterAccount, governor, treasury, nodeManagement } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 3,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await galaxyMember.connect(owner).freeMint() // Token id 1

      await upgradeNFTtoLevel(1, 2, galaxyMember, b3tr, owner, minterAccount)

      await galaxyMember.connect(owner).pause()

      await catchRevert(galaxyMember.connect(owner).upgrade(1))

      await galaxyMember.connect(owner).unpause()

      await upgradeNFTtoLevel(1, 3, galaxyMember, b3tr, owner, minterAccount)
    })

    it("Should not be able to upgrade if allowance is not set", async () => {
      const config = createLocalConfig()
      const { owner, xAllocationVoting, b3tr, minterAccount, governor, treasury, nodeManagement } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 2,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await galaxyMember.connect(owner).freeMint() // Token id 1

      await b3tr.connect(minterAccount).mint(owner, ethers.parseEther("10000")) // Get some 10,000 B3TR required to upgrade to level 2

      await catchRevert(galaxyMember.connect(owner).upgrade(1)) // Allowance not set
    })

    it("Should be able to upgrade to level 10", async () => {
      const config = createTestConfig()
      const { owner, xAllocationVoting, minterAccount, governor, b3tr, otherAccount, treasury, nodeManagement } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 10,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await galaxyMember.connect(owner).freeMint() // Token id 0

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.connect(owner).freeMint() // Token id 1

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1
      expect(await galaxyMember.ownerOf(1)).to.equal(await owner.getAddress()) // Owner of the first NFT is the owner

      await upgradeNFTtoLevel(1, 10, galaxyMember, b3tr, owner, minterAccount)

      expect(await galaxyMember.levelOf(1)).to.equal(10) // Level 10

      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await owner.getAddress()))).to.equal(10)

      // Transfer the token to another account
      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

      expect(await galaxyMember.levelOf(1)).to.equal(10) // Level 10
      expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await owner.getAddress()))).to.equal(1)

      expect(
        await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(await otherAccount.getAddress())),
      ).to.equal(10)

      // Upgrade to level 11 not possible as max level is 10
      await b3tr.connect(minterAccount).mint(otherAccount, await galaxyMember.getB3TRtoUpgradeToLevel(11))

      await b3tr
        .connect(otherAccount)
        .approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgradeToLevel(11))

      await expect(galaxyMember.connect(otherAccount).upgrade(1)).to.be.revertedWith(
        "Galaxy Member: Token is already at max level",
      )
    })

    it("Should not be able to upgrade token not owned", async () => {
      const config = createTestConfig()
      const { owner, xAllocationVoting, minterAccount, governor, b3tr, otherAccount, treasury, nodeManagement } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 10,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await galaxyMember.connect(owner).freeMint() // Token id 0

      await b3tr.connect(minterAccount).mint(otherAccount, ethers.parseEther("10000")) // Get some 10,000 B3TR required to upgrade to level 2

      await b3tr.connect(otherAccount).approve(await galaxyMember.getAddress(), ethers.parseEther("10000")) // We need to approve the galaxyMember contract to transfer the B3TR required to upgrade from the owner's account

      await catchRevert(galaxyMember.connect(otherAccount).upgrade(0)) // Should not be able to upgrade token not owned
    })

    it("Should not be able to upgrade above max level", async () => {
      const config = createTestConfig()
      const { owner, xAllocationVoting, minterAccount, governor, b3tr, treasury, nodeManagement } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
        {
          name: "galaxyMember",
          symbol: "GM",
          admin: owner.address,
          upgrader: owner.address,
          pauser: owner.address,
          minter: owner.address,
          contractsAddressManager: owner.address,
          maxLevel: 10,
          baseTokenURI: config.GM_NFT_BASE_URI,
          b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
          b3tr: await b3tr.getAddress(),
          treasury: await treasury.getAddress(),
        },
      ])) as GalaxyMember

      const galaxyMember = (await upgradeProxy(
        "GalaxyMemberV1",
        "GalaxyMember",
        await galaxyMemberV1.getAddress(),
        [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
        { version: 2 },
      )) as unknown as GalaxyMember

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await galaxyMember.connect(owner).freeMint() // Token id 1

      await upgradeNFTtoLevel(1, 10, galaxyMember, b3tr, owner, minterAccount)

      // Should not be able to upgrade above max level
      await catchRevert(galaxyMember.connect(owner).upgrade(1))
    })
  })

  describe("Vechain nodes Binding", () => {
    it("Should be able to attach a Strength Vechain Node to a GM NFT", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      const nodeMetadata = await addNodeToken(1, otherAccount) // Mint new Strength Economy Node (Level 1) to other account

      const tokenId = await vechainNodesMock.ownerToId(otherAccount.address)
      expect(await vechainNodesMock.getMetadata(tokenId)).to.deep.equal(nodeMetadata)

      expect(await galaxyMember.getNodeLevelOf(1)).to.equal(1) // The Mock Vechain Node is Strength Economy Node which is Level 1

      await participateInAllocationVoting(otherAccount, false, owner)

      await galaxyMember.connect(otherAccount).freeMint()

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1
      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the owner

      expect(await galaxyMember.getNodeToFreeLevel(1)).to.equal(2) // Strength Economy Node attached to GM NFT => Level 2

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 1)
      await galaxyMember.connect(otherAccount).attachNode(1, 1)

      expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1) // Strength Economy Node (token ID 1) attached to GM NFT (token ID 1)

      expect(await galaxyMember.MAX_LEVEL()).to.equal(1) // GM NFT MAX_LEVEL is 1

      // Strength Economy Node should be attached to GM NFT => Level 2
      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1 because MAX_LEVEL is 1

      // Update GM MAX_LEVEL to 5
      await galaxyMember.connect(owner).setMaxLevel(5)

      // Now GM NFT Level should be the highest possible for Strength Economy Node => Level 2
      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2
    })

    it("Should track all Vechain Nodes attached to GM NFTs correctly", async () => {
      const { vechainNodesMock, galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      await addNodeToken(1, otherAccount) // Mint Mock Strength Economy Node (Level 1)

      await participateInAllocationVoting(otherAccount, false, owner)

      await galaxyMember.connect(otherAccount).freeMint()

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1
      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the owner

      expect(await galaxyMember.getNodeToFreeLevel(1)).to.equal(2) // Strength Economy Node attached to GM NFT => Level 2
      expect(await galaxyMember.getNodeToFreeLevel(2)).to.equal(4) // Thunder Economy Node attached to GM NFT => Level 3
      expect(await galaxyMember.getNodeToFreeLevel(3)).to.equal(6) // Mjolnir Economy Node attached to GM NFT => Level 4
      expect(await galaxyMember.getNodeToFreeLevel(4)).to.equal(2) // VethorX X Node attached to GM NFT => Level 2
      expect(await galaxyMember.getNodeToFreeLevel(5)).to.equal(4) // StrengthX X Node attached to GM NFT => Level 4
      expect(await galaxyMember.getNodeToFreeLevel(6)).to.equal(6) // ThunderX X Node attached to GM NFT => Level 6
      expect(await galaxyMember.getNodeToFreeLevel(7)).to.equal(7) // MjolnirX X Node attached to GM NFT => Level 7

      await galaxyMember.setMaxLevel(10)

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 1)
      await galaxyMember.connect(otherAccount).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      // Attach Thunder Economy Node (token ID 1) to GM NFT (token ID 1)
      await galaxyMember.connect(otherAccount).detachNode(1, 1)

      await vechainNodesMock.upgradeTo(1, 2)

      await galaxyMember.connect(otherAccount).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(4) // Level 4

      // Attach Mjolnir Economy Node (token ID 1) to GM NFT (token ID 1)
      await galaxyMember.connect(otherAccount).detachNode(1, 1)

      await vechainNodesMock.upgradeTo(1, 3)

      await galaxyMember.connect(otherAccount).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(6) // Level 6

      // Attach VethorX X Node (token ID 1) to GM NFT (token ID 1)
      await galaxyMember.connect(otherAccount).detachNode(1, 1)

      await vechainNodesMock.upgradeTo(1, 4)

      await galaxyMember.connect(otherAccount).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      // Attach StrengthX X Node (token ID 1) to GM NFT (token ID 1)
      await galaxyMember.connect(otherAccount).detachNode(1, 1)

      await vechainNodesMock.upgradeTo(1, 5)

      await galaxyMember.connect(otherAccount).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(4) // Level 4

      // Attach ThunderX X Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(otherAccount).detachNode(1, 1)

      await vechainNodesMock.upgradeTo(1, 6)

      await galaxyMember.connect(otherAccount).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(6) // Level 6

      // Attach MjolnirX X Node (token ID 1) to GM NFT (token ID 1)
      await galaxyMember.connect(otherAccount).detachNode(1, 1)

      await vechainNodesMock.upgradeTo(1, 7)

      await galaxyMember.connect(otherAccount).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(7) // Level 7
    })

    it("Should not be able to attach a Vechain Node to a GM NFT if not the owner", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      const nodeMetadata1 = await addNodeToken(1, otherAccount)

      expect(await vechainNodesMock.idToOwner(1)).to.equal(await otherAccount.getAddress())

      expect(await vechainNodesMock.getMetadata(1)).to.deep.equal(nodeMetadata1)

      expect(await galaxyMember.getNodeLevelOf(1)).to.equal(1) // The Mock Vechain Node is Strength Economy Node which is Level 1

      await participateInAllocationVoting(otherAccount, false, owner)

      await galaxyMember.connect(otherAccount).freeMint()

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1
      expect(await galaxyMember.ownerOf(1)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the owner

      await expect(galaxyMember.connect(owner).attachNode(1, 1)).to.be.reverted // Should not be able to attach a node if not the owner
    })

    it("Should not be able to attach a Vechain Node to a GM NFT if not the owner of the node", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      const nodeMetadata = await addNodeToken(1, owner)

      expect(await vechainNodesMock.idToOwner(1)).to.equal(await owner.getAddress())

      expect(await vechainNodesMock.getMetadata(1)).to.deep.equal(nodeMetadata)

      expect(await galaxyMember.getNodeLevelOf(1)).to.equal(1) // The Mock Vechain Node is Strength Economy Node which is Level 1

      await participateInAllocationVoting(owner, false, otherAccount)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1
      expect(await galaxyMember.ownerOf(1)).to.equal(await owner.getAddress()) // Owner of the first NFT is the owner

      await expect(galaxyMember.connect(otherAccount).attachNode(1, 1)).to.be.reverted // Should not be able to attach a node if not the owner of the node
    })

    it("Should be able to detach GM NFT from node after transfering the node", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount, otherAccounts } = await getOrDeployContractInstances(
        {
          forceDeploy: true,
          deployMocks: true,
        },
      )

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      const nodeMetadata = await addNodeToken(1, owner)

      expect(await vechainNodesMock.idToOwner(1)).to.equal(await owner.getAddress())

      expect(await vechainNodesMock.getMetadata(1)).to.deep.equal(nodeMetadata)

      expect(await galaxyMember.getNodeLevelOf(1)).to.equal(1) // The Mock Vechain Node is Strength Economy Node which is Level 1

      await participateInAllocationVoting(owner, false, otherAccounts[3])

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1
      expect(await galaxyMember.ownerOf(1)).to.equal(await owner.getAddress()) // Owner of the first NFT is the owner

      expect(await galaxyMember.getNodeToFreeLevel(1)).to.equal(2) // Strength Economy Node attached to GM NFT => Level 2

      await galaxyMember.setMaxLevel(2)

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(owner).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1) // Strength Economy Node (token ID 1) attached to GM NFT (token

      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      // Transfer Strength Economy Node to other account
      await vechainNodesMock.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

      expect(await vechainNodesMock.idToOwner(1)).to.equal(await otherAccount.getAddress())

      expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1) // Strength Economy Node (token ID 1) still attached to GM NFT (token ID 0)

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1 even though Strength Economy Node is attached because "owner" does not own the node anymore

      await galaxyMember.connect(otherAccount).detachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(1) // GM NFT Level is now 1 as no X Node is attached
    })

    it("Should be able to upgrade GM NFT attached to Vechain node", async () => {
      const { owner, vechainNodesMock, galaxyMember, b3tr, minterAccount, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      await addNodeToken(1, owner)

      await participateInAllocationVoting(owner, false, otherAccounts[3])

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.setMaxLevel(10)

      await b3tr.connect(minterAccount).mint(owner, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(owner).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(owner).upgrade(1) // Upgrade token id 1 to level 2

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      /*
        Current state:

        - Token ID 0 has received 10,000 B3TR to upgrade to level 2
        - Token ID 0 has NO vechain node attached
      */

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(owner).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level remains 2 because Strength Economy Node is allows for Level 2 for Free but now b3tr to upgrade to level 3 is less as we've already donated 10,000 B3TR

      /*
        Current state:

        - Token ID 0 has received 10,000 B3TR to upgrade to level 2
        - Token ID 0 has Strength Economy Node attached
        - Token ID requires 15,000 B3TR to upgrade to level 3 instead of 25,000 B3TR as Strength Economy Node allows for Level 2 for Free and we've already donated 10,000 B3TR
      */
      expect(await galaxyMember.getB3TRtoUpgrade(1)).to.equal(
        (await galaxyMember.getB3TRtoUpgradeToLevel(3)) - (await galaxyMember.getB3TRdonated(1)),
      )

      await b3tr.connect(minterAccount).mint(owner, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(owner).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(owner).upgrade(1) // Upgrade token id 1 to level 2

      expect(await galaxyMember.levelOf(1)).to.equal(3) // Level 3

      await galaxyMember.detachNode(1, 1)

      /*
        Current state:

        - Token ID 0 has received 25,000 total B3TR
        - Token ID 0 has NO vechain node attached
        - Token ID 0 needs 10,000 B3TR to upgrade to level 3 as we've already donated 25,000 B3TR = 25,000 - 10,000 brings to Level 2 and have 15,000 left to upgrade to Level 3. Level 3 requires 25,000 B3TR so 25,000 - 15,000 = 10,000 B3TR required to upgrade to Level 3
      */

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2 as we've detached the Strength Economy Node but we've already donated 25,000 B3TR

      expect(await galaxyMember.getB3TRdonated(1)).to.equal(ethers.parseEther("25000"))

      expect(await galaxyMember.getB3TRtoUpgrade(1)).to.equal(ethers.parseEther("10000"))
    })

    it("Should correctly track B3TR required for upgrades when attaching and detaching nodes", async () => {
      const { vechainNodesMock, galaxyMember, otherAccount, b3tr, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      await addNodeToken(1, otherAccount) // Mint Mock Strength Economy Node (Level 1)

      await participateInAllocationVoting(otherAccount)

      await galaxyMember.connect(otherAccount).freeMint()

      await galaxyMember.setMaxLevel(10)

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      expect(await vechainNodesMock.ownerToId(otherAccount.address)).to.equal(1)
      expect(await vechainNodesMock.idToOwner(1)).to.equal(otherAccount.address)

      await vechainNodesMock.upgradeTo(1, 7)

      // Attach Mjolnir X Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(otherAccount).attachNode(1, 1)

      expect(await galaxyMember.getLevelAfterAttachingNode(1, 1)).to.equal(7) // Level 7

      expect(await galaxyMember.levelOf(1)).to.equal(7) // Level 7

      await b3tr.connect(minterAccount).mint(otherAccount, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(otherAccount).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(otherAccount).upgrade(1) // Upgrade token id 1 to level 8 by donating 2,500,000 B3TR

      expect(await galaxyMember.levelOf(1)).to.equal(8) // Level 8

      expect(await galaxyMember.getLevelAfterDetachingNode(1)).to.equal(7)

      // Detach Mjolnir X Node (token ID 1) from GM NFT (token ID 1)
      await galaxyMember.connect(otherAccount).detachNode(1, 1)

      /*
        Current state:

        - Token ID 0 has received 2,500,000 B3TR
        - Token ID 0 has NO vechain node attached
        - Token ID Level is level 7 with 1,565,000 B3TR left that can be used to upgrade to Level 8 => 2,500,000 - 1,565,000 = 935,000 B3TR required to upgrade to Level 8
      */
      expect(await galaxyMember.levelOf(1)).to.equal(7) // Level 7

      expect(await galaxyMember.getB3TRtoUpgrade(1)).to.equal(ethers.parseEther("935000"))

      await b3tr.connect(minterAccount).mint(otherAccount, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(otherAccount).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(otherAccount).upgrade(1) // Upgrade token id 1 to level 8 by donating 935,000 B3TR

      expect(await galaxyMember.levelOf(1)).to.equal(8) // Level 8
    })

    it("Should not be able to transfer GM NFT attached to Vechain node", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount, otherAccounts } = await getOrDeployContractInstances(
        {
          forceDeploy: true,
          deployMocks: true,
        },
      )

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      await addNodeToken(1, owner)

      await participateInAllocationVoting(owner, false, otherAccounts[3])

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.setMaxLevel(10)

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(owner).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      await expect(galaxyMember.connect(owner).transferFrom(owner.address, otherAccount.address, 1)).to.be.revertedWith(
        "GalaxyMember: token attached to a node, detach before transfer",
      )
    })

    it("Should reset level if node attached doesn't exist anymore", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      await addNodeToken(1, owner)

      await participateInAllocationVoting(owner, false, otherAccount)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.setMaxLevel(10)

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      expect(await galaxyMember.getLevelAfterAttachingNode(1, 1)).to.equal(2) // Level 2

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(owner).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      expect(await galaxyMember.getLevelAfterDetachingNode(1)).to.equal(1)

      // Fast forward 4 hours
      await time.setNextBlockTimestamp((await time.latest()) + 4 * 60 * 60)

      await vechainNodesMock.downgradeTo(1, 0) // Burn Strength Economy Node

      expect(await vechainNodesMock.idToOwner(1)).to.equal(ethers.ZeroAddress)

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      // I can attach another node
      await addNodeToken(2, owner)

      await expect(galaxyMember.connect(owner).attachNode(3, 1)).to.be.revertedWith(
        "GalaxyMember: token already attached to a node",
      )

      await galaxyMember.connect(owner).detachNode(await galaxyMember.getNodeIdAttached(1), 1)

      expect(await galaxyMember.getLevelAfterAttachingNode(1, 3)).to.equal(4) // Level 4

      await galaxyMember.connect(owner).attachNode(3, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(4) // Level 4
    })

    it("User can select a different GM NFT owned", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      await addNodeToken(1, owner)

      await participateInAllocationVoting(owner, false, otherAccounts[3])

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.setMaxLevel(10)

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      await galaxyMember.connect(owner).freeMint()

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(owner).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2
      expect(await galaxyMember.levelOf(2)).to.equal(1) // Level 1

      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(1) // Owner has selected token ID 0 automatically as it was the first token owned

      await galaxyMember.select(1)

      expect(await galaxyMember.getSelectedTokenId(await owner.getAddress())).to.equal(1) // Owner has selected token ID 1
    })

    it("Should reset level if node attached is not owned anymore", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount, otherAccounts } = await getOrDeployContractInstances(
        {
          forceDeploy: true,
          deployMocks: true,
        },
      )

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      await addNodeToken(1, owner)

      await participateInAllocationVoting(owner, false, otherAccounts[3])

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.setMaxLevel(10)

      await galaxyMember.connect(owner).freeMint()

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(owner).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      await vechainNodesMock.transferFrom(owner.address, otherAccount.address, 1)

      expect(await vechainNodesMock.idToOwner(1)).to.equal(otherAccount.address)

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1 now even if the node is attached

      expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1) // Node is still attached
    })

    it("Should not attach node to another GM NFT if node is already attached", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      await addNodeToken(1, owner)

      await participateInAllocationVoting(owner, false, otherAccount)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.setMaxLevel(10)

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(owner).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      await expect(galaxyMember.connect(owner).attachNode(1, 1)).to.be.revertedWith(
        "GalaxyMember: node already attached to a token",
      )
    })

    it("Should be able to attach a node on an upgraded GM NFT", async () => {
      const { owner, vechainNodesMock, galaxyMember, b3tr, minterAccount, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      await participateInAllocationVoting(owner, false, otherAccounts[4])

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.setMaxLevel(10)

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      await b3tr.connect(minterAccount).mint(owner, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(owner).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(owner).upgrade(1) // Upgrade token id 1 to level 2

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      await b3tr.connect(minterAccount).mint(owner, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(owner).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      await galaxyMember.connect(owner).upgrade(1) // Upgrade token id 1 to level 3

      expect(await galaxyMember.levelOf(1)).to.equal(3) // Level 3

      await addNodeToken(2, owner)

      await galaxyMember.connect(owner).attachNode(2, 1)

      expect(await galaxyMember.getLevelAfterAttachingNode(1, 2)).to.equal(4) // Level 4

      expect(await galaxyMember.levelOf(1)).to.equal(4) // Level 4

      expect(await galaxyMember.getLevelAfterDetachingNode(1)).to.equal(3) // Level 3

      await galaxyMember.connect(owner).detachNode(2, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(3) // Level 3
    })

    it("Should not be able to transfer GM NFT attached to node through approval", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount, otherAccounts } = await getOrDeployContractInstances(
        {
          forceDeploy: true,
          deployMocks: true,
        },
      )

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      await addNodeToken(1, owner)

      await participateInAllocationVoting(owner, false, otherAccounts[2])

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.setMaxLevel(10)

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(owner).attachNode(1, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

      await galaxyMember.connect(owner).approve(otherAccount.address, 1)

      await expect(
        galaxyMember.connect(otherAccount).transferFrom(owner.address, otherAccount.address, 1),
      ).to.be.revertedWith("GalaxyMember: token attached to a node, detach before transfer")

      await galaxyMember.connect(owner).detachNode(1, 1)

      await galaxyMember.connect(otherAccount).transferFrom(owner.address, otherAccount.address, 1)

      expect(await galaxyMember.ownerOf(1)).to.equal(otherAccount.address)
    })

    it("should handle node detached changes during upgrade", async () => {
      const { owner, vechainNodesMock, galaxyMember, b3tr, minterAccount, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      await participateInAllocationVoting(owner, false, otherAccounts[4])

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.setMaxLevel(10)

      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      expect(await galaxyMember.ownerOf(1)).to.equal(owner.address)

      // Attach node to GM NFT
      await addNodeToken(2, owner) // Mint Level 2 Node with Token ID 1

      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      await galaxyMember.connect(owner).attachNode(nodeId, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(4)

      await b3tr.connect(minterAccount).mint(owner, await galaxyMember.getB3TRtoUpgrade(1))

      await b3tr.connect(owner).approve(await galaxyMember.getAddress(), await galaxyMember.getB3TRtoUpgrade(1))

      // Detach node
      await galaxyMember.connect(owner).detachNode(nodeId, 1)

      expect(await galaxyMember.levelOf(1)).to.equal(1)

      // Upgrade GM NFT
      await galaxyMember.connect(owner).upgrade(1)

      expect(await galaxyMember.levelOf(1)).to.equal(2)
    })

    it("Should not be able to attach node when contract is paused", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      await addNodeToken(1, owner)

      await participateInAllocationVoting(owner, false, otherAccount)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.setMaxLevel(10)

      // Pause contract
      await galaxyMember.connect(owner).pause()

      await expect(galaxyMember.connect(owner).attachNode(1, 1)).to.be.reverted
    })

    it("Should not be able to detach node when contract is paused", async () => {
      const { owner, vechainNodesMock, galaxyMember, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

      await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

      // Mint Mock Strength Economy Node (Level 1)
      await addNodeToken(1, owner)

      await participateInAllocationVoting(owner, false, otherAccount)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.tokenByIndex(0)).to.equal(1)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.setMaxLevel(10)

      // Attach Strength Economy Node (token ID 1) to GM NFT (token ID 0)
      await galaxyMember.connect(owner).attachNode(1, 1)

      // Pause contract
      await galaxyMember.connect(owner).pause()

      await expect(galaxyMember.connect(owner).detachNode(1, 1)).to.be.reverted
    })
  })

  describe("GalaxyMember Node Management Integration", () => {
    describe("Node Delegation with Token Attachment", () => {
      it("Should allow node manager (delegatee) to attach node to GM token", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, false, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(1)

        const nodeMetadata = await vechainNodesMock.getMetadata(1)

        expect(nodeMetadata[1]).to.equal(BigInt(7)) // Mjolnir X Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(1)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(1, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)
        expect(await galaxyMember.levelOf(1)).to.equal(7)
      })

      it("Should allow node manager to detach node from GM token", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, false, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(1)

        const nodeMetadata = await vechainNodesMock.getMetadata(1)

        expect(nodeMetadata[1]).to.equal(BigInt(7)) // Mjolnir X Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(1)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(1, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)
        expect(await galaxyMember.levelOf(1)).to.equal(7)

        // Detach node from GM NFT
        await galaxyMember.connect(owner).detachNode(1, 1)

        // Expect node to be detached from GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(0)
        expect(await galaxyMember.levelOf(1)).to.equal(1)
      })

      it("Should revert if non-manager tries to attach delegated node", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, false, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(1)

        const nodeMetadata = await vechainNodesMock.getMetadata(1)

        expect(nodeMetadata[1]).to.equal(BigInt(7)) // Mjolnir X Node

        await galaxyMember.connect(owner).freeMint()

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(1)).to.equal(nodeHolder.address)

        // Attach node to GM NFT
        await expect(galaxyMember.connect(owner).attachNode(1, 1)).to.be.revertedWith(
          "GalaxyMember: vechain node not owned or managed by caller",
        )

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(1)).to.equal(owner.address)

        // Now owner can attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(1, 1)
      })
      it("Should revert if non-manager or non-owner tries to detach delegated node", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement, otherAccount } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, false, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(1)

        const nodeMetadata = await vechainNodesMock.getMetadata(1)

        expect(nodeMetadata[1]).to.equal(BigInt(7)) // Mjolnir X Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(1)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(1, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)
        expect(await galaxyMember.levelOf(1)).to.equal(7)

        // Detach node from GM NFT
        await expect(galaxyMember.connect(otherAccount).detachNode(1, 1)).to.be.revertedWith(
          "GalaxyMember: vechain node not owned or managed by caller or token not owned by caller",
        )

        // Remove delegation
        await nodeManagement.connect(nodeHolder).removeNodeDelegation()

        // Expect node to be undelegated
        expect(await nodeManagement.getNodeManager(1)).to.equal(nodeHolder.address)

        // Now nodeHolder can attach node to GM NFT
        await galaxyMember.connect(nodeHolder).detachNode(1, 1)
      })
    })

    describe("Token Level Management with Delegated Nodes", () => {
      it("Should NOT maintain token level when node is delegated to another address", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(1)

        const nodeMetadata = await vechainNodesMock.getMetadata(1)

        expect(nodeMetadata[1]).to.equal(BigInt(7)) // Mjolnir X Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(1)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(1, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)
        expect(await galaxyMember.levelOf(1)).to.equal(7)

        // Remove delegation
        await nodeManagement.connect(nodeHolder).removeNodeDelegation()

        // Expect GM NFT level to be reset to 1 because the manager of the node is not the owner anymore but is nodeHolder
        expect(await galaxyMember.levelOf(1)).to.equal(1)

        // Expect GM is still attached to the node
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)

        await participateInAllocationVoting(nodeHolder, false)

        await galaxyMember.connect(nodeHolder).freeMint()

        // Detach node from GM NFT of owner
        await galaxyMember.connect(owner).detachNode(1, 1)

        // Attach node to GM NFT of nodeHolder
        await galaxyMember.connect(nodeHolder).attachNode(1, 2)

        // Expect node to be attached to GM NFT of nodeHolder
        expect(await galaxyMember.getNodeIdAttached(2)).to.equal(1)

        // Expect GM NFT level to be 7
        expect(await galaxyMember.levelOf(2)).to.equal(7)
      })
      it("Should update token level correctly when delegated node is upgraded", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true)

        // Mint Strength Economy Node (Level 1) to nodeHolder
        await addNodeToken(1, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(2)

        const nodeMetadata = await vechainNodesMock.getMetadata(2)

        expect(nodeMetadata[1]).to.equal(BigInt(1)) // Strength Economy Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(2)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(2, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(2)
        expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

        // Upgrade node
        await vechainNodesMock.connect(owner).upgradeTo(2, 3)

        // Expect GM NFT level to be updated to 8
        expect(await galaxyMember.levelOf(1)).to.equal(6)
      })
      it("Should update token level correctly when delegated node is downgraded", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true)

        // Mint Thunder Economy Node (Level 2) to nodeHolder
        await addNodeToken(2, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(2)

        const nodeMetadata = await vechainNodesMock.getMetadata(2)

        expect(nodeMetadata[1]).to.equal(BigInt(2)) // Thunder Economy Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(2)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(2, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(2)
        expect(await galaxyMember.levelOf(1)).to.equal(4)

        // Fast forward 4 hours for node to be downgraded
        await time.setNextBlockTimestamp((await time.latest()) + 4 * 60 * 60)

        // Downgrade node to Strength Economy Node (Level 1)
        await vechainNodesMock.connect(owner).downgradeTo(2, 1)

        // Expect GM NFT level to be updated to 2
        expect(await galaxyMember.levelOf(1)).to.equal(2)
      })
    })

    describe("Node Transfer Scenarios", () => {
      it("Should maintain token attachment when delegated node is transferred", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true)

        // Mint Strength Economy Node (Level 1) to nodeHolder
        await addNodeToken(1, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(2)

        const nodeMetadata = await vechainNodesMock.getMetadata(2)

        expect(nodeMetadata[1]).to.equal(BigInt(1)) // Strength Economy Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(2)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(2, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(2)
        expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

        // Skip ahead 1 day to be able to transfer node
        await time.setNextBlockTimestamp((await time.latest()) + 86400)

        // Transfer node to another address
        await vechainNodesMock
          .connect(nodeHolder)
          .transferFrom(await nodeHolder.getAddress(), await otherAccounts[1].getAddress(), 2)

        // Expect GM NFT level to be kept at 2 as the node is still attached and is still delegated to owner even though the node OWNER is different
        expect(await galaxyMember.levelOf(1)).to.equal(2)

        // OLD owner can't detach node anymore as the node is not owned by him
        await expect(galaxyMember.connect(nodeHolder).detachNode(2, 1)).to.be.revertedWith(
          "GalaxyMember: vechain node not owned or managed by caller or token not owned by caller",
        )

        // NEW owner can undelegete node
        await nodeManagement.connect(otherAccounts[1]).removeNodeDelegation()

        // Expect GM NFT level to be reset to 1 because the manager of the node is not the owner anymore but is otherAccounts[1]
        expect(await galaxyMember.levelOf(1)).to.equal(1)
      })
      it("Should allow new owner to detach node even if delegated", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true)

        // Mint Strength Economy Node (Level 1) to nodeHolder
        await addNodeToken(1, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(2)

        const nodeMetadata = await vechainNodesMock.getMetadata(2)

        expect(nodeMetadata[1]).to.equal(BigInt(1)) // Strength Economy Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(2)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(2, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(2)
        expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

        // Skip ahead 1 day to be able to transfer node
        await time.setNextBlockTimestamp((await time.latest()) + 86400)

        // Transfer node to another address
        await vechainNodesMock
          .connect(nodeHolder)
          .transferFrom(await nodeHolder.getAddress(), await otherAccounts[1].getAddress(), 2)

        // Node is still delegated to owner
        expect(await nodeManagement.getNodeManager(2)).to.equal(owner.address)

        // Expect GM NFT level to be kept at 2 as the node is still attached and is still delegated to owner even though the node OWNER is different
        expect(await galaxyMember.levelOf(1)).to.equal(2)

        // NEW owner can detach node
        await galaxyMember.connect(otherAccounts[1]).detachNode(2, 1)

        // Expect GM NFT level to be reset to 1 because node is detached
        expect(await galaxyMember.levelOf(1)).to.equal(1)
      })
    })

    describe("Edge Cases", () => {
      it("Should handle delegation change while node is attached to token", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true)

        // Mint Strength Economy Node (Level 1) to nodeHolder
        await addNodeToken(1, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(2)

        const nodeMetadata = await vechainNodesMock.getMetadata(2)

        expect(nodeMetadata[1]).to.equal(BigInt(1)) // Strength Economy Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(2)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(2, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(2)
        expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

        // Delegate node to otherAccounts[1]
        await nodeManagement.connect(nodeHolder).delegateNode(otherAccounts[1])

        // Expect node to be delegated to otherAccounts[1]
        expect(await nodeManagement.getNodeManager(2)).to.equal(otherAccounts[1].address)

        // Expect GM NFT level to be reset to 1 because the manager of the node is not the owner anymore but is otherAccounts[1]
        expect(await galaxyMember.levelOf(1)).to.equal(1)
      })
      it("Should handle node downgrade to NONE level while attached to token", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true)

        // Mint Strength Economy Node (Level 1) to nodeHolder
        await addNodeToken(1, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(2)

        const nodeMetadata = await vechainNodesMock.getMetadata(2)

        expect(nodeMetadata[1]).to.equal(BigInt(1)) // Strength Economy Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(2)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(2, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(2)
        expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

        // Fast forward 4 hours for node to be downgraded
        await time.setNextBlockTimestamp((await time.latest()) + 4 * 60 * 60)

        // Downgrade node to NONE level
        await vechainNodesMock.connect(owner).downgradeTo(2, 0)

        // Expect GM NFT level to be reset to 1 because the node level is NONE
        expect(await galaxyMember.levelOf(1)).to.equal(1)
      })
      it("Should handle delegation removal while node is attached", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        const nodeHolder = otherAccounts[0]

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true)

        // Mint Strength Economy Node (Level 1) to nodeHolder
        await addNodeToken(1, nodeHolder)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(nodeHolder.address)).to.equal(2)

        const nodeMetadata = await vechainNodesMock.getMetadata(2)

        expect(nodeMetadata[1]).to.equal(BigInt(1)) // Strength Economy Node

        await galaxyMember.connect(owner).freeMint()

        // Delegate X Node created above to owner
        await nodeManagement.connect(nodeHolder).delegateNode(owner)

        // Expect node to be delegated to owner
        expect(await nodeManagement.getNodeManager(2)).to.equal(owner.address)

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(2, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(2)
        expect(await galaxyMember.levelOf(1)).to.equal(2) // Level 2

        // Remove delegation
        await nodeManagement.connect(nodeHolder).removeNodeDelegation()

        // Expect GM NFT level to be reset to 1 because the manager of the node is not the owner anymore but is nodeHolder
        expect(await galaxyMember.levelOf(1)).to.equal(1)
      })
      it("Should handle GM level correctly when node attached is delegated", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccount, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(owner.address)).to.equal(1)

        const nodeMetadata = await vechainNodesMock.getMetadata(1)

        expect(nodeMetadata[1]).to.equal(BigInt(7)) // Mjolnir X Node

        await galaxyMember.connect(owner).freeMint()

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(1, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)
        expect(await galaxyMember.levelOf(1)).to.equal(7)

        // Owner delegates his Node
        await nodeManagement.connect(owner).delegateNode(otherAccount)

        // Expect node to be delegated to otherAccount
        expect(await nodeManagement.getNodeManager(1)).to.equal(otherAccount.address)

        // Expect GM NFT level to be reset to 1 because the manager of the node is not the owner anymore but is otherAccount
        expect(await galaxyMember.levelOf(1)).to.equal(1)

        // Expect GM NFT to still be attached to the node
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)

        // Owner can detach node
        await galaxyMember.connect(owner).detachNode(1, 1)

        // Expect GM NFT to be detached from the node
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(0)
      })
      it("Should prevent token transfer while delegated node is attached", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccount, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(owner.address)).to.equal(1)

        const nodeMetadata = await vechainNodesMock.getMetadata(1)

        expect(nodeMetadata[1]).to.equal(BigInt(7)) // Mjolnir X Node

        await galaxyMember.connect(owner).freeMint()

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(1, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)
        expect(await galaxyMember.levelOf(1)).to.equal(7)

        // Owner delegates his Node
        await nodeManagement.connect(owner).delegateNode(otherAccount)

        // Expect node to be delegated to otherAccount
        expect(await nodeManagement.getNodeManager(1)).to.equal(otherAccount.address)

        // Expect GM NFT level to be reset to 1 because the manager of the node is not the owner anymore but is otherAccount
        expect(await galaxyMember.levelOf(1)).to.equal(1)

        // Expect GM NFT to still be attached to the node
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)

        // Owner can't transfer GM NFT
        await expect(
          galaxyMember.connect(owner).transferFrom(owner.address, otherAccounts[1].address, 1),
        ).to.be.revertedWith("GalaxyMember: token attached to a node, detach before transfer")
      })
      it("Should handle multiple delegation changes while attached to token", async () => {
        const { owner, vechainNodesMock, galaxyMember, otherAccount, otherAccounts, nodeManagement } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            deployMocks: true,
          })

        if (!vechainNodesMock) throw new Error("VechainNodesMock not deployed")

        await galaxyMember.setVechainNodes(await vechainNodesMock.getAddress())

        await galaxyMember.setMaxLevel(10) // Set max level to 10

        await participateInAllocationVoting(owner, true)

        // nodeHolder owns a Mjolnir X Node
        expect(await vechainNodesMock.ownerToId(owner.address)).to.equal(1)

        const nodeMetadata = await vechainNodesMock.getMetadata(1)

        expect(nodeMetadata[1]).to.equal(BigInt(7)) // Mjolnir X Node

        await galaxyMember.connect(owner).freeMint()

        // Attach node to GM NFT
        await galaxyMember.connect(owner).attachNode(1, 1)

        // Expect node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)
        expect(await galaxyMember.levelOf(1)).to.equal(7)

        // Owner delegates his Node
        await nodeManagement.connect(owner).delegateNode(otherAccount)

        // Expect node to be delegated to otherAccount
        expect(await nodeManagement.getNodeManager(1)).to.equal(otherAccount.address)

        // Expect GM NFT level to be reset to 1 because the manager of the node is not the owner anymore but is otherAccount
        expect(await galaxyMember.levelOf(1)).to.equal(1)

        // Expect GM NFT to still be attached to the node
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(1)

        await galaxyMember.connect(owner).detachNode(1, 1)

        await participateInAllocationVoting(otherAccounts[1], true, otherAccounts[1]) // Also mints a Mjolnir X Node to otherAccounts[1]

        await galaxyMember.connect(otherAccounts[1]).freeMint()

        // Attach new node to GM NFT
        await galaxyMember.connect(otherAccounts[1]).attachNode(2, 2)

        // Expect new node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(2)).to.equal(2)

        // GM NFT Level should be 4
        expect(await galaxyMember.levelOf(2)).to.equal(7)

        // Owner delegates his Node
        await nodeManagement.connect(otherAccounts[1]).delegateNode(owner)

        await galaxyMember.connect(otherAccounts[1]).detachNode(2, 2)

        // Expect node to be delegated to otherAccounts[1]
        expect(await nodeManagement.getNodeManager(2)).to.equal(owner.address)

        // Expect GM NFT level to be reset to 1 because the manager of the node is not the owner anymore but is otherAccount
        expect(await galaxyMember.levelOf(2)).to.equal(1)

        // GM NFT of owner can now be attached to new node delegated to him
        await galaxyMember.connect(owner).attachNode(2, 1)

        // Expect new node to be attached to GM NFT
        expect(await galaxyMember.getNodeIdAttached(1)).to.equal(2)

        // GM NFT Level should be 7
        expect(await galaxyMember.levelOf(1)).to.equal(7)
      })
    })
  })

  describe("Updating B3TR Required", () => {
    it("Should update B3TR required for GM NFT", async () => {
      const config = createLocalConfig()
      const {
        owner,
        xAllocationVoting,
        x2EarnApps,
        veBetterPassport,
        galaxyMember,
        minterAccount,
        otherAccounts,
        b3tr,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      const account1 = otherAccounts[0] // Holds level 2 GM NFT
      const account2 = otherAccounts[1] // Holds level 3 GM NFT
      const account3 = otherAccounts[2] // Holds level 4 GM NFT
      const account4 = otherAccounts[3] // Holds level 2 GM NFT with level 5 node attached
      const account5 = otherAccounts[4] // Holds level 1 GM NFT with level 7 node attached
      const account6 = otherAccounts[7] // Holds level 1 GM NFT with level 5 node attached

      const endorser1 = otherAccounts[5]
      const endorser2 = otherAccounts[6]

      await addNodeToken(5, account4)
      await addNodeToken(7, account5)
      await addNodeToken(5, account6)

      // participation in governance is a requirement for minting
      await getVot3Tokens(account1, "5000000")
      await getVot3Tokens(account2, "5000000")
      await getVot3Tokens(account3, "5000000")
      await getVot3Tokens(account4, "5000000")
      await getVot3Tokens(account5, "5000000")
      await getVot3Tokens(account6, "5000000")

      // Whitelist accounts
      await veBetterPassport.whitelist(account1.address)
      await veBetterPassport.whitelist(account2.address)
      await veBetterPassport.whitelist(account3.address)
      await veBetterPassport.whitelist(account4.address)
      await veBetterPassport.whitelist(account5.address)
      await veBetterPassport.whitelist(account6.address)
      // Toggle Whitelist Check
      if ((await veBetterPassport.isCheckEnabled(1)) === false) await veBetterPassport.toggleCheck(1)

      // Set up X2EarnApps
      const app1Id = await x2EarnApps.hashAppName("App 1")
      const app2Id = await x2EarnApps.hashAppName("App 2")
      await x2EarnApps.connect(endorser1).submitApp(endorser1.address, endorser1.address, "App 1", "metadataURI 1")
      await x2EarnApps.connect(endorser2).submitApp(endorser2.address, endorser2.address, "App 2", "metadataURI 2")
      await endorseApp(app1Id, endorser1)
      await endorseApp(app2Id, endorser2)

      const roundId = await startNewAllocationRound()

      // Vote
      await xAllocationVoting.connect(account1).castVote(roundId, [app1Id], [ethers.parseEther("1")])
      await xAllocationVoting.connect(account2).castVote(roundId, [app1Id], [ethers.parseEther("1")])
      await xAllocationVoting.connect(account3).castVote(roundId, [app1Id], [ethers.parseEther("1")])
      await xAllocationVoting.connect(account4).castVote(roundId, [app2Id], [ethers.parseEther("1")])
      await xAllocationVoting.connect(account5).castVote(roundId, [app2Id], [ethers.parseEther("1")])
      await xAllocationVoting.connect(account6).castVote(roundId, [app2Id], [ethers.parseEther("1")])

      await galaxyMember.connect(owner).setMaxLevel(5)

      await galaxyMember.connect(account1).freeMint()
      await galaxyMember.connect(account2).freeMint()
      await galaxyMember.connect(account3).freeMint()
      await galaxyMember.connect(account4).freeMint()
      await galaxyMember.connect(account5).freeMint()
      await galaxyMember.connect(account6).freeMint()

      // Check initial B3TR required for each GM NFT level
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(1)).to.equal(0)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(2)).to.equal(ethers.parseEther("10000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(3)).to.equal(ethers.parseEther("25000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(4)).to.equal(ethers.parseEther("50000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(5)).to.equal(ethers.parseEther("100000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(6)).to.equal(ethers.parseEther("250000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(7)).to.equal(ethers.parseEther("500000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(8)).to.equal(ethers.parseEther("2500000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(9)).to.equal(ethers.parseEther("5000000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(10)).to.equal(ethers.parseEther("25000000"))

      // Get tokenId of each GM NFT
      const tokenId1 = await galaxyMember.getSelectedTokenId(account1.address)
      const tokenId2 = await galaxyMember.getSelectedTokenId(account2.address)
      const tokenId3 = await galaxyMember.getSelectedTokenId(account3.address)
      const tokenId4 = await galaxyMember.getSelectedTokenId(account4.address)
      const tokenId5 = await galaxyMember.getSelectedTokenId(account5.address)
      const tokenId6 = await galaxyMember.getSelectedTokenId(account6.address)

      // Set level of each GM NFT
      await upgradeNFTtoLevel(Number(tokenId1), 2, galaxyMember, b3tr, account1, minterAccount)
      await upgradeNFTtoLevel(Number(tokenId2), 3, galaxyMember, b3tr, account2, minterAccount)
      await upgradeNFTtoLevel(Number(tokenId3), 4, galaxyMember, b3tr, account3, minterAccount)
      await upgradeNFTtoLevel(Number(tokenId4), 2, galaxyMember, b3tr, account4, minterAccount)
      await upgradeNFTtoLevel(Number(tokenId5), 1, galaxyMember, b3tr, account5, minterAccount)
      await upgradeNFTtoLevel(Number(tokenId6), 4, galaxyMember, b3tr, account6, minterAccount)

      // Check GM NFT levels
      expect(await galaxyMember.levelOf(tokenId1)).to.equal(2) // Level 2
      expect(await galaxyMember.levelOf(tokenId2)).to.equal(3) // Level 3
      expect(await galaxyMember.levelOf(tokenId3)).to.equal(4) // Level 4
      expect(await galaxyMember.levelOf(tokenId4)).to.equal(2) // Level 2
      expect(await galaxyMember.levelOf(tokenId5)).to.equal(1) // Level 1
      expect(await galaxyMember.levelOf(tokenId6)).to.equal(4) // Level 4

      // Attach nodes to GM NFTs
      await galaxyMember.connect(account4).attachNode(1, tokenId4)
      await galaxyMember.connect(account5).attachNode(2, tokenId5)
      await galaxyMember.connect(account6).attachNode(3, tokenId6)

      // Check GM NFT levels after attaching nodes
      expect(await galaxyMember.levelOf(tokenId4)).to.equal(4) // Free upgrade to level 4 => Has GM of level 2 which means B3TR donated of 10000, needs 90000 more to reach level 5
      expect(await galaxyMember.levelOf(tokenId5)).to.equal(5) // Free upgrade to level 7 => Capped at 5
      expect(await galaxyMember.levelOf(tokenId6)).to.equal(4) // Free upgrade to level 4 => Has GM of level 4 which means B3TR donated of 500000, needs 50000 more to reach level 5

      // Check B3TR required to upgrade each GM NFT level
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId1)).to.equal(ethers.parseEther("25000")) // Level 2 -> Level 3 = 25000
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId2)).to.equal(ethers.parseEther("50000")) // Level 3 -> Level 4 = 50000
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId3)).to.equal(ethers.parseEther("100000")) // Level 4 -> Level 5 = 100000
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId4)).to.equal(ethers.parseEther("90000")) // Level 4 -> Level 5 - 10000 (B3TR Donated before free upgrade) = 90000
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId5)).to.equal(ethers.parseEther("0")) // Level 1 -> Level 2 = 0 => Capped at 5
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId6)).to.equal(ethers.parseEther("15000")) // Level 4 -> Level 5 - 850000 (B3TR Donated before free upgrade) = 15000

      // Check B3TR donated for each GM NFT
      expect(await galaxyMember.getB3TRdonated(tokenId1)).to.equal(ethers.parseEther("10000")) // Level 2 => 10000
      expect(await galaxyMember.getB3TRdonated(tokenId2)).to.equal(ethers.parseEther("35000")) // Level 3 => 10000 + 250000 = 35000
      expect(await galaxyMember.getB3TRdonated(tokenId3)).to.equal(ethers.parseEther("85000")) // Level 4 => 10000 + 25000 + 50000 = 85000
      expect(await galaxyMember.getB3TRdonated(tokenId4)).to.equal(ethers.parseEther("10000")) // Level 2 => 10000
      expect(await galaxyMember.getB3TRdonated(tokenId5)).to.equal(ethers.parseEther("0")) // Level 1
      expect(await galaxyMember.getB3TRdonated(tokenId6)).to.equal(ethers.parseEther("85000")) // Level 4 => 10000 + 25000 + 50000 = 85000

      // Update B3TR required for GM NFT levels
      await galaxyMember.connect(owner).setB3TRtoUpgradeToLevel(config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL_V2)

      // Check updated B3TR required for each GM NFT level
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(1)).to.equal(0)
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(2)).to.equal(ethers.parseEther("5000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(3)).to.equal(ethers.parseEther("12500"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(4)).to.equal(ethers.parseEther("25000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(5)).to.equal(ethers.parseEther("50000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(6)).to.equal(ethers.parseEther("125000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(7)).to.equal(ethers.parseEther("250000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(8)).to.equal(ethers.parseEther("1250000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(9)).to.equal(ethers.parseEther("2500000"))
      expect(await galaxyMember.getB3TRtoUpgradeToLevel(10)).to.equal(ethers.parseEther("12500000"))

      /**
       * Check GM NFT levels after updating B3TR required
       *
       * tokenId1 donated 10000 B3TR, to reach level 2 it now needs 7500 B3TR (level 3 (12500) - (10000 (B3TR donated) - level 2 (5000)))
       * tokenId2 donated 35000 B3TR, to reach level 3 it now needs 7500 B3TR (level 4 (25000) - (35000 (B3TR donated) - level 2 (5000) - level 3 (12500)))
       * tokenId3 donated 85000 B3TR, to reach level 4 it now needs 7500 B3TR (level 5 (50000) - (85000 (B3TR donated) - level 2 (5000) - level 3 (12500) - level 4 (25000)))
       * tokenId4 donated 10000 B3TR, to reach level 5 it now needs 40000 B3TR (level 5 (50000) - (10000 (B3TR donated) - 0 (free upgrade)))
       * tokenId5 donated 0 B3TR, at level 5 it needs 0 B3TR to upgrade (capped at 5)
       * tokenId6 donated 85000 B3TR, to reach level 5 it now needs 0 B3TR (level 5 (50000) - (85000 (B3TR donated) - free upgrade))
       */
      expect(await galaxyMember.levelOf(tokenId1)).to.equal(2) // Level 2
      expect(await galaxyMember.levelOf(tokenId2)).to.equal(3) // Level 3
      expect(await galaxyMember.levelOf(tokenId3)).to.equal(4) // Level 4
      expect(await galaxyMember.levelOf(tokenId4)).to.equal(4) // Level 4
      expect(await galaxyMember.levelOf(tokenId5)).to.equal(5) // Level 1
      expect(await galaxyMember.levelOf(tokenId6)).to.equal(5) // Level 5

      // Check B3TR required to upgrade each GM NFT level
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId1)).to.equal(ethers.parseEther("7500")) // Level 2 -> Level 3 = 7500
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId2)).to.equal(ethers.parseEther("7500")) // Level 3 -> Level 4 = 7500
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId3)).to.equal(ethers.parseEther("7500")) // Level 4 -> Level 5 = 7500
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId4)).to.equal(ethers.parseEther("40000")) // Level 4 -> Level 5 = 40000 (With free upgrade)
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId5)).to.equal(ethers.parseEther("0")) // Level 5
      expect(await galaxyMember.getB3TRtoUpgrade(tokenId6)).to.equal(ethers.parseEther("0")) // Level 5
    })
  })
})
