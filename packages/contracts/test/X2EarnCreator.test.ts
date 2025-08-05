import { describe, it } from "mocha"
import { ZERO_ADDRESS, catchRevert, getOrDeployContractInstances } from "./helpers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"

describe("X2EarnCreator - @shard11", () => {
  describe("Contract parameters", () => {
    it("Should have correct parameters set on deployment", async () => {
      const { x2EarnCreator, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await x2EarnCreator.name()).to.equal("X2EarnCreator")
      expect(await x2EarnCreator.symbol()).to.equal("X2C")
      expect(await x2EarnCreator.hasRole(await x2EarnCreator.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.equal(
        true,
      )
    })

    it("Should support ERC 165 interface", async () => {
      const { x2EarnCreator } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await x2EarnCreator.supportsInterface("0x01ffc9a7")).to.equal(true) // ERC165
    })
  })

  describe("Pausing", () => {
    it("Only PAUSER_ROLE or DEFAULT_ADMIN_ROLE should be able to pause and unpause the contract", async () => {
      const { x2EarnCreator, otherAccount, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const pauser = otherAccounts[0]
      await x2EarnCreator.grantRole(await x2EarnCreator.PAUSER_ROLE(), pauser.address)

      expect(await x2EarnCreator.hasRole(await x2EarnCreator.PAUSER_ROLE(), otherAccount.address)).to.eql(false)
      expect(await x2EarnCreator.hasRole(await x2EarnCreator.PAUSER_ROLE(), pauser.address)).to.eql(true)
      expect(await x2EarnCreator.hasRole(await x2EarnCreator.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)

      await catchRevert(x2EarnCreator.connect(otherAccount).pause())

      // DEFAULT_ADMIN_ROLE
      await expect(x2EarnCreator.connect(owner).pause()).to.emit(x2EarnCreator, "Paused")
      expect(await x2EarnCreator.paused()).to.equal(true)

      await expect(x2EarnCreator.connect(owner).unpause()).to.emit(x2EarnCreator, "Unpaused")
      expect(await x2EarnCreator.paused()).to.equal(false)

      await catchRevert(x2EarnCreator.connect(otherAccount).unpause())

      // PAUSER_ROLE
      await x2EarnCreator.connect(pauser).pause()
      expect(await x2EarnCreator.paused()).to.equal(true)

      await x2EarnCreator.connect(pauser).unpause()
      expect(await x2EarnCreator.paused()).to.equal(false)
    })

    it("Should not allow tokens to be minted when paused", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).pause()

      await catchRevert(x2EarnCreator.connect(owner).safeMint(otherAccount.address))
    })
  })

  describe("Base URI", () => {
    it("Should be able to set the base URI", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      // normal user
      await expect(x2EarnCreator.connect(otherAccount).setBaseURI("ipfs://BASE_URI")).to.be.reverted

      // default admin
      expect(await x2EarnCreator.hasRole(await x2EarnCreator.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true)
      await expect(x2EarnCreator.connect(owner).setBaseURI("ipfs://BASE_URI2")).to.not.be.reverted
      expect(await x2EarnCreator.baseURI()).to.equal("ipfs://BASE_URI2")
    })
  })

  describe("Upgrading", () => {
    it("Admin should be able to upgrade the contract", async function () {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("X2EarnCreator")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await x2EarnCreator.getAddress())

      await x2EarnCreator.grantRole(await x2EarnCreator.UPGRADER_ROLE(), owner.address)

      const UPGRADER_ROLE = await x2EarnCreator.UPGRADER_ROLE()
      expect(await x2EarnCreator.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      // If non-admin tries to upgrade, it should fail
      await expect(x2EarnCreator.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.be
        .reverted

      await expect(x2EarnCreator.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await x2EarnCreator.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })
    it("should return the correct version", async function () {
      const { x2EarnCreator } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const version = await x2EarnCreator.version()
      expect(version).to.equal("1")
    })

    it("Should not be able to initialize the contract after it has already been initialized", async function () {
      const config = createLocalConfig()
      const { x2EarnCreator, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(x2EarnCreator.initialize(config.CREATOR_NFT_URI, owner.address)).to.be.reverted // already initialized
    })
  })

  describe("Minting", () => {
    it("Should mint a token to the caller", async () => {
      const { x2EarnCreator, owner, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })

      await expect(x2EarnCreator.connect(owner).safeMint(otherAccounts[14].address)).to.emit(x2EarnCreator, "Transfer")

      expect(await x2EarnCreator.ownerOf(10)).to.equal(otherAccounts[14].address)
      expect(await x2EarnCreator.tokenURI(10)).to.equal(
        "ipfs://bafybeie2onvzl3xsod5becuswpdmi63gtq7wgjqhqjecehytt7wdeg4py4/metadata/1.json",
      )
    })

    it("Should not allow minting when paused", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).pause()

      await catchRevert(x2EarnCreator.connect(owner).safeMint(otherAccount.address))
    })

    it("Should not allow minting to the zero address", async () => {
      const { x2EarnCreator, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      await catchRevert(x2EarnCreator.connect(owner).safeMint(ZERO_ADDRESS))
    })

    it("Only user with MINTER_ROLE or DEFAULT_ADMIN_ROLE should be able to mint tokens", async () => {
      const { x2EarnCreator, owner, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const minter = otherAccounts[0]
      await x2EarnCreator.grantRole(await x2EarnCreator.MINTER_ROLE(), minter.address)

      expect(await x2EarnCreator.hasRole(await x2EarnCreator.MINTER_ROLE(), otherAccount.address)).to.eql(false)
      expect(await x2EarnCreator.hasRole(await x2EarnCreator.MINTER_ROLE(), minter.address)).to.eql(true)
      expect(await x2EarnCreator.hasRole(await x2EarnCreator.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)

      await catchRevert(x2EarnCreator.connect(otherAccount).safeMint(otherAccount.address))

      // DEFAULT_ADMIN_ROLE
      await expect(x2EarnCreator.connect(owner).safeMint(otherAccount.address)).to.not.be.reverted

      // MINTER_ROLE
      await expect(x2EarnCreator.connect(minter).safeMint(otherAccounts[10].address)).to.not.be.reverted
    })

    it("Should not be able to get the token URI if token not minted", async () => {
      const { x2EarnCreator } = await getOrDeployContractInstances({ forceDeploy: true })

      // x2earnApp v5: Token [2...5] are reserved for the creator NFTs
      await expect(x2EarnCreator.tokenURI(10)).to.be.reverted
    })

    it("Should not be able to mint token to a user that already has a token", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      await expect(x2EarnCreator.connect(owner).safeMint(otherAccount.address)).to.be.revertedWithCustomError(
        x2EarnCreator,
        "AlreadyOwnsNFT",
      )
    })
  })

  describe("Transferring", () => {
    it("Should not be able to tranfet a token using transferFrom", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      await expect(
        x2EarnCreator.connect(owner).transferFrom(owner.address, otherAccount.address, 0),
      ).to.be.revertedWithCustomError(x2EarnCreator, "TransfersDisabled")
    })

    it("Should not be able to transfer a token using safeTransferFrom without data", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      // Testing the first overload without data parameter
      await expect(
        x2EarnCreator["safeTransferFrom(address,address,uint256)"](owner.address, otherAccount.address, 1),
      ).to.be.revertedWithCustomError(x2EarnCreator, "TransfersDisabled")
    })

    it("Should not be able to transfer a token using safeTransferFrom with data", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      // Testing the second overload with the data parameter
      await expect(
        x2EarnCreator["safeTransferFrom(address,address,uint256,bytes)"](owner.address, otherAccount.address, 1, "0x"),
      ).to.be.revertedWithCustomError(x2EarnCreator, "TransfersDisabled")
    })

    it("Should not be able to approve a token for transfer", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      await expect(x2EarnCreator.connect(owner).approve(otherAccount.address, 0)).to.be.revertedWithCustomError(
        x2EarnCreator,
        "TransfersDisabled",
      )
    })

    it("Should not be able to setApprovalForAll", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      await expect(
        x2EarnCreator.connect(owner).setApprovalForAll(otherAccount.address, true),
      ).to.be.revertedWithCustomError(x2EarnCreator, "TransfersDisabled")
    })
  })

  describe("Burning", () => {
    it("Only user with BURNER_ROLE or DEFAULT_ADMIN_ROLE should be able to burn NFT", async () => {
      const { x2EarnCreator, owner, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const burner = otherAccounts[0]
      await x2EarnCreator.grantRole(await x2EarnCreator.BURNER_ROLE(), burner.address)

      expect(await x2EarnCreator.hasRole(await x2EarnCreator.BURNER_ROLE(), otherAccount.address)).to.eql(false)
      expect(await x2EarnCreator.hasRole(await x2EarnCreator.BURNER_ROLE(), burner.address)).to.eql(true)
      expect(await x2EarnCreator.hasRole(await x2EarnCreator.DEFAULT_ADMIN_ROLE(), owner.address)).to.eql(true)

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      // normal user
      await expect(x2EarnCreator.connect(otherAccount).burn(1)).to.be.reverted

      // default admin
      await expect(x2EarnCreator.connect(owner).burn(1)).to.emit(x2EarnCreator, "Transfer")

      // burner
      await expect(x2EarnCreator.connect(burner).burn(2)).to.emit(x2EarnCreator, "Transfer")
    })

    it("Should not be able to burn a token when paused", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      await x2EarnCreator.connect(owner).pause()

      await catchRevert(x2EarnCreator.connect(owner).burn(0))
    })

    it("Should not be able to burn a token that does not exist", async () => {
      const { x2EarnCreator, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      await catchRevert(x2EarnCreator.connect(owner).burn(10))
    })

    it("Should not be able to get the token URI after burning", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      await x2EarnCreator.connect(owner).burn(1)

      await expect(x2EarnCreator.tokenURI(1)).to.be.reverted
    })
  })

  describe("Token Info", () => {
    it("Should return the correct token URI", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      expect(await x2EarnCreator.tokenURI(1)).to.equal(
        "ipfs://bafybeie2onvzl3xsod5becuswpdmi63gtq7wgjqhqjecehytt7wdeg4py4/metadata/1.json",
      )
    })
    it("Should return the correct token owner", async () => {
      const { x2EarnCreator, owner, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })

      let creator10 = otherAccounts[10]
      await x2EarnCreator.connect(owner).safeMint(creator10.address)

      expect(await x2EarnCreator.ownerOf(1)).to.equal(owner.address)
      expect(await x2EarnCreator.ownerOf(10)).to.equal(creator10.address)
    })
    it("Should return the correct token balance", async () => {
      const { x2EarnCreator, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccount.address)

      expect(await x2EarnCreator.balanceOf(owner.address)).to.equal(1)
      expect(await x2EarnCreator.balanceOf(otherAccount.address)).to.equal(1)
    })
    it("Should return the correct token total supply", async () => {
      const { x2EarnCreator, owner, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })

      // Already minted 9 tokens to otherAccounts[0..7] and owner -> see deploy.ts
      await x2EarnCreator.connect(owner).safeMint(otherAccounts[10].address)
      await x2EarnCreator.connect(owner).safeMint(otherAccounts[11].address)

      await x2EarnCreator.connect(owner).burn(1)

      expect(await x2EarnCreator.totalSupply()).to.equal(10)
    })
    it("Should return the correct token owner by index", async () => {
      const { x2EarnCreator, owner, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnCreator.connect(owner).safeMint(otherAccounts[10].address)
      await x2EarnCreator.connect(owner).safeMint(otherAccounts[11].address)

      expect(await x2EarnCreator.tokenOfOwnerByIndex(owner.address, 0)).to.equal(1)
      expect(await x2EarnCreator.tokenOfOwnerByIndex(otherAccounts[10].address, 0)).to.equal(10)
      expect(await x2EarnCreator.tokenOfOwnerByIndex(otherAccounts[11].address, 0)).to.equal(11)
    })
  })
})
