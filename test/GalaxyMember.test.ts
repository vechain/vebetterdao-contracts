import { describe, it } from "mocha"
import {
  NFT_NAME,
  NFT_SYMBOL,
  ZERO_ADDRESS,
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
  upgradeNFTtoLevel,
  waitForCurrentRoundToEnd,
  waitForProposalToBeActive,
} from "./helpers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { createLocalConfig } from "../config/contracts/envs/local"
import { createTestConfig } from "./helpers/config"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { deployProxy } from "../scripts/helpers"
import { GalaxyMember } from "../typechain-types"

describe("Galaxy Member", () => {
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

    it("CLOCK_MODE should be set to blockNumber", async () => {
      const { galaxyMember } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await galaxyMember.CLOCK_MODE()).to.equal("mode=blocknumber&from=default")
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
      const { galaxyMember, owner, b3tr, treasury } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        galaxyMember.connect(owner).initialize({
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
          treasury: await treasury.getAddress(),
        }),
      ).to.be.reverted
    })

    it("Should not be able to deploy contract with max level less than 1", async function () {
      const { owner, b3tr, treasury } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const config = createLocalConfig()

      await expect(
        deployProxy("GalaxyMember", [
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
        deployProxy("GalaxyMember", [
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
      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      // Upgrade to level 2
      await upgradeNFTtoLevel(0, 2, galaxyMember, b3tr, otherAccount, minterAccount)

      await expect(upgradeNFTtoLevel(0, 3, galaxyMember, b3tr, otherAccount, minterAccount)).to.be.reverted // Should not be able to upgrade to level 3

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
        deployProxy("GalaxyMember", [
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
        deployProxy("GalaxyMember", [
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
        deployProxy("GalaxyMember", [
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

      expect(await galaxyMember.version()).to.equal("1")
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
      const galaxyMember = (await deployProxy("GalaxyMember", [
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
      const galaxyMember = (await deployProxy("GalaxyMember", [
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
      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.ownerOf(0)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount
      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1
    })

    it("User can free mint if he participated in B3TR Governance", async () => {
      const { galaxyMember, otherAccount, b3tr, otherAccounts, governor, B3trContract } =
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
      expect(await galaxyMember.ownerOf(0)).to.equal(await voter.getAddress()) // Owner of the first NFT is the otherAccount
      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1
      expect(await galaxyMember.getHighestLevel(voter)).to.equal(1) // Level 0
    })

    it("User can free mint if he participated both in B3TR Governance and in x-allocation voting", async () => {
      const { galaxyMember, otherAccount, b3tr, otherAccounts, governor, B3trContract } =
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

      expect(decodedEvents?.[0]?.name).to.equal("SelectedLevel")
      expect(decodedEvents?.[0]?.args?.[0]).to.equal(await otherAccount.getAddress())
      expect(decodedEvents?.[0]?.args?.[1]).to.equal(0)
      expect(decodedEvents?.[0]?.args?.[2]).to.equal(1)

      expect(decodedEvents?.[1]?.name).to.equal("Transfer")
      expect(decodedEvents?.[1]?.args?.[0]).to.equal(ZERO_ADDRESS)
      expect(decodedEvents?.[1]?.args?.[1]).to.equal(await otherAccount.getAddress())

      expect(await galaxyMember.numCheckpoints(await otherAccount.getAddress())).to.equal(1) // Other account has 1 checkpoint

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.ownerOf(0)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount
      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1

      expect(await galaxyMember.getHighestLevel(otherAccount)).to.equal(1) // Level 1
      expect(await galaxyMember.getPastHighestLevel(await otherAccount.getAddress(), receipt.blockNumber - 1)).to.equal(
        0,
      ) // Level 0 in the past

      await expect(galaxyMember.getPastHighestLevel(await otherAccount.getAddress(), receipt.blockNumber + 1)).to.be
        .reverted // Should revert if block number is in the future

      expect(await galaxyMember.tokenByIndex(0)).to.equal(0) // Token ID of the first NFT is 1
      expect(await galaxyMember.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0) // Token ID of the first NFT owned by otherAccount is 1

      expect(await galaxyMember.tokenURI(0)).to.equal(`${config.GM_NFT_BASE_URI}1.json`) // Token URI of the first NFT is the "base URI/level"
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

      expect(await galaxyMember.getHighestLevel(otherAccount)).to.equal(1) // Level 1
    })

    it("Should handle multiple mints from different accounts correctly", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount, true)

      await galaxyMember.connect(otherAccount).freeMint()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, false)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 NFT

      expect(await galaxyMember.ownerOf(0)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount
      expect(await galaxyMember.ownerOf(1)).to.equal(await owner.getAddress()) // Owner of the second NFT is the owner

      expect(await galaxyMember.totalSupply()).to.equal(2) // Total supply is 2

      expect(await galaxyMember.levelOf(0)).to.equal(1) // Level 1
      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      expect(await galaxyMember.tokenByIndex(0)).to.equal(0) // Token ID of the first NFT is 1
      expect(await galaxyMember.tokenByIndex(1)).to.equal(1) // Token ID of the second NFT is 2

      expect(await galaxyMember.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0) // Token ID of the first NFT owned by otherAccount is 1
      expect(await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)).to.equal(1) // Token ID of the first NFT owned by owner is 1

      expect(await galaxyMember.getHighestLevel(otherAccount)).to.equal(1) // Level 1
      expect(await galaxyMember.getHighestLevel(owner)).to.equal(1) // Level 1
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

      expect(await galaxyMember.getHighestLevel(owner)).to.equal(1) // Level 1

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 0)

      expect(await galaxyMember.getHighestLevel(owner)).to.equal(0) // Level 0 (no NFT)

      await galaxyMember.connect(owner).freeMint()

      expect(await galaxyMember.getHighestLevel(owner)).to.equal(1) // Level 1

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 NFT

      expect(await galaxyMember.ownerOf(0)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount
      expect(await galaxyMember.ownerOf(1)).to.equal(await owner.getAddress()) // Owner of the second NFT is the owner

      expect(await galaxyMember.totalSupply()).to.equal(2) // Total supply is 2

      expect(await galaxyMember.levelOf(0)).to.equal(1) // Level 1
      expect(await galaxyMember.levelOf(1)).to.equal(1) // Level 1

      expect(await galaxyMember.tokenByIndex(0)).to.equal(0) // Token ID of the first NFT is 1
      expect(await galaxyMember.tokenByIndex(1)).to.equal(1) // Token ID of the second NFT is 2

      expect(await galaxyMember.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0) // Token ID of the first NFT owned by otherAccount is 1
      expect(await galaxyMember.tokenOfOwnerByIndex(await owner.getAddress(), 0)).to.equal(1) // Token ID of the first NFT owned by owner is 1
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

    it("Should be able to mint with minter role if public minting is paused", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount)

      await galaxyMember.connect(owner).setIsPublicMintingPaused(true)

      expect(await galaxyMember.hasRole(await galaxyMember.MINTER_ROLE(), owner.address)).to.equal(true)
      await galaxyMember.connect(owner).mint(await otherAccount.getAddress())

      expect(await galaxyMember.hasRole(await galaxyMember.MINTER_ROLE(), otherAccount.address)).to.equal(false)
      await expect(galaxyMember.connect(otherAccount).freeMint()).to.be.reverted // Other account cannot mint as he is not admin

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Owner has 1 NFT

      expect(await galaxyMember.ownerOf(0)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount

      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1

      expect(await galaxyMember.levelOf(0)).to.equal(1) // Level 1

      expect(await galaxyMember.getHighestLevel(otherAccount)).to.equal(1) // Level 1
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

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 0)

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(0) // Owner has 0 NFTs

      expect(await galaxyMember.ownerOf(0)).to.equal(await otherAccount.getAddress()) // Owner of the first NFT is the otherAccount

      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 1

      expect(await galaxyMember.levelOf(0)).to.equal(1) // Level 1

      expect(await galaxyMember.tokenByIndex(0)).to.equal(0) // Token ID of the first NFT is 1

      expect(await galaxyMember.tokenOfOwnerByIndex(await otherAccount.getAddress(), 0)).to.equal(0) // Token ID of the first NFT owned by otherAccount is 1
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

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 0)
    })

    it("Should be able to receive a GM NFT from another account if you already have one", async () => {
      const { galaxyMember, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(otherAccount, true)
      await participateInAllocationVoting(owner)

      await galaxyMember.connect(otherAccount).freeMint()

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

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

      expect(decodedEvents?.[0]?.name).to.equal("SelectedLevel")
      expect(decodedEvents?.[0]?.args?.[0]).to.equal(await owner.getAddress())
      expect(decodedEvents?.[0]?.args?.[1]).to.equal(0) // Previous level
      expect(decodedEvents?.[0]?.args?.[2]).to.equal(1) // New level

      tx = await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 0)

      receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      events = receipt?.logs

      decodedEvents = events?.map(event => {
        return galaxyMember.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents?.length).to.equal(3)

      expect(decodedEvents?.[0]?.name).to.equal("SelectedLevel")
      expect(decodedEvents?.[0]?.args?.[0]).to.equal(await owner.getAddress())
      expect(decodedEvents?.[0]?.args?.[1]).to.equal(1) // Previous level
      expect(decodedEvents?.[0]?.args?.[2]).to.equal(0) // New level

      expect(decodedEvents?.[1]?.name).to.equal("SelectedLevel")
      expect(decodedEvents?.[1]?.args?.[0]).to.equal(await otherAccount.getAddress())
      expect(decodedEvents?.[1]?.args?.[1]).to.equal(0) // Previous level
      expect(decodedEvents?.[1]?.args?.[2]).to.equal(1) // New level

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(0) // Owner has 0 NFTs

      expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(1) // Level 1
      expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(0) // Level 0

      expect(await galaxyMember.getPastHighestLevel(await otherAccount.getAddress(), receipt.blockNumber - 1)).to.equal(
        0,
      ) // Level 0 in the past
      expect(await galaxyMember.getPastHighestLevel(await owner.getAddress(), receipt.blockNumber - 1)).to.equal(1) // Level 1 in the past

      tx = await galaxyMember
        .connect(otherAccount)
        .transferFrom(await otherAccount.getAddress(), await otherAccounts[0].getAddress(), 0)

      receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(0) // Other account has 0 NFTs
      expect(await galaxyMember.balanceOf(await otherAccounts[0].getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(0) // Owner has 0 NFTs

      expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(0) // Level 0
      expect(await galaxyMember.getHighestLevel(await otherAccounts[0].getAddress())).to.equal(1) // Level 1
      expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(0) // Level 0

      expect(await galaxyMember.getPastHighestLevel(await otherAccount.getAddress(), receipt.blockNumber - 1)).to.equal(
        1,
      ) // Level 1 in the past
      expect(
        await galaxyMember.getPastHighestLevel(await otherAccounts[0].getAddress(), receipt.blockNumber - 1),
      ).to.equal(0) // Level 0 in the past
      expect(await galaxyMember.getPastHighestLevel(await owner.getAddress(), receipt.blockNumber - 1)).to.equal(0) // Level 0 in the past
    })
  })

  describe("Transferring", () => {
    it("Should be able to send GM NFT to same account", async () => {
      const { galaxyMember, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner)

      await galaxyMember.connect(owner).freeMint()

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await owner.getAddress(), 0)

      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 NFT
      expect(await galaxyMember.ownerOf(0)).to.equal(await owner.getAddress()) // Owner of the first NFT is the owner
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

      await galaxyMember.transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

      await galaxyMember.connect(owner).burn(0)

      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(0) // Owner has 0 NFTs
      expect(await galaxyMember.totalSupply()).to.equal(1) // Total supply is 0

      await expect(galaxyMember.connect(owner).burn(1)).to.be.reverted // Owner cannot burn a token he doesn't own
    })
  })

  describe("Level Selection", () => {
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

      expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(1) // Level 1
      expect(await galaxyMember.getPastHighestLevel(await owner.getAddress(), receipt.blockNumber - 1)).to.equal(0) // Level 0 in the past

      await galaxyMember.connect(owner).freeMint()

      tx = await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 0)

      receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 NFT
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 NFT

      expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(1) // Level 1
      expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(1) // Level 1 (because owner still has a token)

      expect(
        await galaxyMember.getPastHighestLevel(await otherAccount.getAddress(), receipt?.blockNumber - 1),
      ).to.equal(0) // Level 0 in the past

      await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(2) // Other account has 2 NFTs

      expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(1) // Level 1

      expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(0) // Level 0 (because owner doesn't have any tokens now)
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

      const blockOfMint = receipt.blockNumber

      // Check for Selected and SelectedLevel events
      let events = receipt?.logs

      let decodedEvents = events?.map(event => {
        return galaxyMember.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents?.[0]?.name).to.equal("SelectedLevel")
      expect(decodedEvents?.[0]?.args?.[0]).to.equal(await otherAccount.getAddress())
      expect(decodedEvents?.[0]?.args?.[1]).to.equal(0) // Previous level
      expect(decodedEvents?.[0]?.args?.[2]).to.equal(1) // New level

      tx = await galaxyMember
        .connect(otherAccount)
        .transferFrom(await otherAccount.getAddress(), await owner.getAddress(), 0)

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

      expect(decodedEvents?.[0]?.name).to.equal("SelectedLevel")
      expect(decodedEvents?.[0]?.args?.[0]).to.equal(await otherAccount.getAddress())
      expect(decodedEvents?.[0]?.args?.[1]).to.equal(1) // Previous level
      expect(decodedEvents?.[0]?.args?.[2]).to.equal(0) // New level

      expect(decodedEvents?.[1]?.name).to.equal("SelectedLevel")
      expect(decodedEvents?.[1]?.args?.[0]).to.equal(await owner.getAddress())
      expect(decodedEvents?.[1]?.args?.[1]).to.equal(0) // Previous level
      expect(decodedEvents?.[1]?.args?.[2]).to.equal(1) // New level

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(0) // Other account has 0 tokens
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(1) // Owner has 1 token

      expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(0) // Level 0
      expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(1) // Level 1

      const checkpoint = await galaxyMember.checkpoints(await otherAccount.getAddress(), 0)

      // Checkpointed at block of mint with level 1
      expect(checkpoint[0]).to.equal(blockOfMint)
      expect(checkpoint[1]).to.equal(1)
    })
  })

  describe("Upgrading", () => {
    it("Should be able to upgrade a level 1 token to a level 2 token", async () => {
      const config = createLocalConfig()
      const { owner, xAllocationVoting, b3tr, minterAccount, governor, treasury, otherAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await galaxyMember.connect(owner).freeMint() // Token id 0

      await catchRevert(galaxyMember.connect(owner).upgrade(0)) // Insufficient B3TR to upgrade

      await b3tr.connect(minterAccount).mint(owner, ethers.parseEther("10000")) // Get some 10,000 B3TR required to upgrade to level 2

      await b3tr.connect(owner).approve(await galaxyMember.getAddress(), ethers.parseEther("10000")) // We need to approve the galaxyMember contract to transfer the B3TR required to upgrade from the owner's account

      const balanceOfTreasuryBefore = await b3tr.balanceOf(await treasury.getAddress())

      await galaxyMember.connect(owner).upgrade(0) // Upgrade token id 1 to level 2

      const balanceOfTreasuryAfter = await b3tr.balanceOf(await treasury.getAddress())

      expect(balanceOfTreasuryAfter - balanceOfTreasuryBefore).to.equal(ethers.parseEther("10000")) // 10,000 B3TR should be transferred to the treasury pool

      expect(await galaxyMember.levelOf(0)).to.equal(2) // Level 2

      expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(2) // Level 2

      await expect(upgradeNFTtoLevel(0, 3, galaxyMember, b3tr, owner, minterAccount)).to.be.reverted // Level 3 is not available

      await expect(galaxyMember.connect(otherAccount).setMaxLevel(3)).to.be.reverted // Only owner can set max level

      await expect(galaxyMember.connect(owner).setMaxLevel(2)).to.be.reverted // Max level must be greater than current level

      const tx = await galaxyMember.connect(owner).setMaxLevel(3)
      const receipt = await tx.wait()

      const name = getEventName(receipt, galaxyMember)
      expect(name).to.equal("MaxLevelUpdated")

      await upgradeNFTtoLevel(0, 3, galaxyMember, b3tr, owner, minterAccount) // Now we can upgrade to level 3
    })

    it("Should be able to transfer a token with level greater than 1", async () => {
      const config = createLocalConfig()
      const { owner, xAllocationVoting, b3tr, minterAccount, governor, otherAccount, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await galaxyMember.connect(owner).freeMint() // Token id 1

      await b3tr.connect(minterAccount).mint(owner, ethers.parseEther("10000")) // Get some 10,000 B3TR required to upgrade to level 2

      await b3tr.connect(owner).approve(await galaxyMember.getAddress(), ethers.parseEther("10000")) // We need to approve the galaxyMember contract to transfer the B3TR required to upgrade from the owner's account

      await galaxyMember.connect(owner).upgrade(0) // Upgrade token id 0 to level 2

      expect(await galaxyMember.levelOf(0)).to.equal(2) // Level 2

      const tx = await galaxyMember
        .connect(owner)
        .transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 0)

      const receipt = await tx.wait()

      if (!receipt?.blockNumber) throw new Error("No receipt block number")

      const events = receipt?.logs

      const decodedEvents = events?.map(event => {
        return galaxyMember.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      expect(decodedEvents?.[0]?.name).to.equal("SelectedLevel")
      expect(decodedEvents?.[0]?.args?.[0]).to.equal(await owner.getAddress())
      expect(decodedEvents?.[0]?.args?.[1]).to.equal(2) // Previous level
      expect(decodedEvents?.[0]?.args?.[2]).to.equal(0) // New level

      expect(decodedEvents?.[1]?.name).to.equal("SelectedLevel")
      expect(decodedEvents?.[1]?.args?.[0]).to.equal(await otherAccount.getAddress())
      expect(decodedEvents?.[1]?.args?.[1]).to.equal(0) // Previous level
      expect(decodedEvents?.[1]?.args?.[2]).to.equal(2) // New level

      expect(await galaxyMember.balanceOf(await otherAccount.getAddress())).to.equal(1) // Other account has 1 token
      expect(await galaxyMember.balanceOf(await owner.getAddress())).to.equal(0) // Owner has 0 tokens

      expect(await galaxyMember.levelOf(0)).to.equal(2) // Level 2

      expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(2) // Level 2
      expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(0) // Level 0

      expect(await galaxyMember.getNextLevel(0)).to.equal(3) // Next level is 3
    })

    it("Should not be able to upgrade if contract is paused", async () => {
      const config = createLocalConfig()
      const { owner, xAllocationVoting, b3tr, minterAccount, governor, treasury } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await galaxyMember.connect(owner).freeMint() // Token id 1

      await upgradeNFTtoLevel(0, 2, galaxyMember, b3tr, owner, minterAccount)

      await galaxyMember.connect(owner).pause()

      await catchRevert(galaxyMember.connect(owner).upgrade(0))

      await galaxyMember.connect(owner).unpause()

      await upgradeNFTtoLevel(0, 3, galaxyMember, b3tr, owner, minterAccount)
    })

    it("Should not be able to upgrade if allowance is not set", async () => {
      const config = createLocalConfig()
      const { owner, xAllocationVoting, b3tr, minterAccount, governor, treasury } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // participation in governance is a requirement for minting
      await participateInAllocationVoting(owner, true)

      const galaxyMember = (await deployProxy("GalaxyMember", [
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

      await galaxyMember.waitForDeployment()

      await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
      await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

      await galaxyMember.connect(owner).freeMint() // Token id 1

      await b3tr.connect(minterAccount).mint(owner, ethers.parseEther("10000")) // Get some 10,000 B3TR required to upgrade to level 2

      await catchRevert(galaxyMember.connect(owner).upgrade(1)) // Allowance not set
    })
  })

  it("Should be able to upgrade to level 10", async () => {
    const config = createTestConfig()
    const { owner, xAllocationVoting, minterAccount, governor, b3tr, otherAccount, treasury } =
      await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

    // Bootstrap emissions
    await bootstrapEmissions()

    // participation in governance is a requirement for minting
    await participateInAllocationVoting(owner, true)

    const galaxyMember = (await deployProxy("GalaxyMember", [
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

    await galaxyMember.waitForDeployment()

    await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
    await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

    await galaxyMember.connect(owner).freeMint() // Token id 0

    expect(await galaxyMember.levelOf(0)).to.equal(1) // Level 1
    expect(await galaxyMember.ownerOf(0)).to.equal(await owner.getAddress()) // Owner of the first NFT is the owner

    await upgradeNFTtoLevel(0, 10, galaxyMember, b3tr, owner, minterAccount)

    expect(await galaxyMember.levelOf(0)).to.equal(10) // Level 10

    expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(10) // Level 10

    // Transfer the token to another account
    await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 0)

    expect(await galaxyMember.levelOf(0)).to.equal(10) // Level 10
    expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(0) // Level 0

    expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(10) // Level 10
  })

  it("Should not be able to upgrade token not owned", async () => {
    const config = createTestConfig()
    const { owner, xAllocationVoting, minterAccount, governor, b3tr, otherAccount, treasury } =
      await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

    // Bootstrap emissions
    await bootstrapEmissions()

    // participation in governance is a requirement for minting
    await participateInAllocationVoting(owner, true)

    const galaxyMember = (await deployProxy("GalaxyMember", [
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
    const { owner, xAllocationVoting, minterAccount, governor, b3tr, treasury } = await getOrDeployContractInstances({
      forceDeploy: true,
      config,
    })

    // Bootstrap emissions
    await bootstrapEmissions()

    // participation in governance is a requirement for minting
    await participateInAllocationVoting(owner, true)

    const galaxyMember = (await deployProxy("GalaxyMember", [
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

    await galaxyMember.waitForDeployment()

    await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
    await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

    await galaxyMember.connect(owner).freeMint() // Token id 0

    await upgradeNFTtoLevel(0, 10, galaxyMember, b3tr, owner, minterAccount)

    // Should not be able to upgrade above max level
    await catchRevert(galaxyMember.connect(owner).upgrade(0))
  })

  it("Should correctly track highest level owned", async () => {
    const config = createTestConfig()
    const { owner, xAllocationVoting, minterAccount, governor, b3tr, otherAccount, treasury } =
      await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

    // Bootstrap emissions
    await bootstrapEmissions()

    // participation in governance is a requirement for minting
    await participateInAllocationVoting(owner, true)

    const galaxyMember = (await deployProxy("GalaxyMember", [
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

    await galaxyMember.waitForDeployment()

    await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
    await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

    await galaxyMember.connect(owner).freeMint() // Token id 0
    await galaxyMember.connect(owner).freeMint() // Token id 1
    await galaxyMember.connect(owner).freeMint() // Token id 2
    await galaxyMember.connect(owner).freeMint() // Token id 3
    await galaxyMember.connect(owner).freeMint() // Token id 4

    expect(await galaxyMember.levelOf(0)).to.equal(1) // Level 1
    expect(await galaxyMember.ownerOf(0)).to.equal(await owner.getAddress()) // Owner of the first NFT is the owner

    /*
      Tokens owned:

      Level 5: 2 tokens
      Level 4: 1 token
      Level 3: 1 token
      Level 1: 1 token
    */
    await upgradeNFTtoLevel(2, 4, galaxyMember, b3tr, owner, minterAccount) // Upgrade token id 2 to level 4
    await upgradeNFTtoLevel(3, 3, galaxyMember, b3tr, owner, minterAccount) // Upgrade token id 3 to level 3
    await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, owner, minterAccount) // Upgrade token id 0 to level 5
    await upgradeNFTtoLevel(4, 1, galaxyMember, b3tr, owner, minterAccount) // Upgrade token id 4 to level 1
    await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, owner, minterAccount) // Upgrade token id 1 to level 5

    /*
      Transfer token ID 5 of level 1 to other account

      Tokens owned remaining:
      Level 5: 2
      Level 4: 1
      Level 3: 1
    */
    await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 4)

    expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(5) // Owner has highest level of 5

    expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(1) // Other account now has the highest level of 1

    /*
      Transfer token ID 1 of level 5 to other account

      Tokens owned remaining:
      Level 5: 1
      Level 4: 1
      Level 3: 1
      Level 1: 2
    */
    await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 0)

    expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(5) // Owner still has the highest level of 5

    expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(5) // Other account now has the highest level of 5

    /*
      Transfer token ID 2 of level 5 to other account

      Tokens owned remaining:
      Level 4: 1
      Level 3: 1
      Level 1: 1
    */
    await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 1)

    expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(4) // Owner now has the highest level of 4

    expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(5) // Other account retains the highest level of 5

    /*
      Transfer token ID 3 of level 4 to other account

      Tokens owned remaining:
      Level 3: 1
    */
    await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 2)

    expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(3) // Owner now has the highest level of 3

    expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(5) // Other account retains the highest level of 5

    /*
      Transfer token ID 4 of level 3 to other account

      Tokens owned remaining: None
    */
    await galaxyMember.connect(owner).transferFrom(await owner.getAddress(), await otherAccount.getAddress(), 3)

    expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(0) // Owner now has no tokens so the highest level is 0 (no Level)

    expect(await galaxyMember.getHighestLevel(await otherAccount.getAddress())).to.equal(5) // Other account retains the highest level of 5
  })

  it("Should be able to select the highest level owned manually", async () => {
    const config = createTestConfig()
    const { owner, xAllocationVoting, minterAccount, governor, b3tr, treasury } = await getOrDeployContractInstances({
      forceDeploy: true,
      config,
    })

    // Bootstrap emissions
    await bootstrapEmissions()

    // participation in governance is a requirement for minting
    await participateInAllocationVoting(owner, true)

    const galaxyMember = (await deployProxy("GalaxyMember", [
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

    await galaxyMember.waitForDeployment()

    await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
    await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

    await galaxyMember.connect(owner).freeMint() // Token id 0
    await galaxyMember.connect(owner).freeMint() // Token id 1
    await galaxyMember.connect(owner).freeMint() // Token id 2
    await galaxyMember.connect(owner).freeMint() // Token id 3
    await galaxyMember.connect(owner).freeMint() // Token id 4

    expect(await galaxyMember.levelOf(0)).to.equal(1) // Level 1
    expect(await galaxyMember.ownerOf(0)).to.equal(await owner.getAddress()) // Owner of the first NFT is the owner

    /*
      Tokens owned:

      Level 5: 2 tokens
      Level 4: 1 token
      Level 3: 1 token
      Level 1: 1 token
    */
    await upgradeNFTtoLevel(2, 4, galaxyMember, b3tr, owner, minterAccount) // Upgrade token id 2 to level 4
    await upgradeNFTtoLevel(3, 3, galaxyMember, b3tr, owner, minterAccount) // Upgrade token id 3 to level 3
    await upgradeNFTtoLevel(0, 5, galaxyMember, b3tr, owner, minterAccount) // Upgrade token id 0 to level 5
    await upgradeNFTtoLevel(4, 1, galaxyMember, b3tr, owner, minterAccount) // Upgrade token id 4 to level 1
    await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, owner, minterAccount) // Upgrade token id 1 to level 5

    await galaxyMember.connect(owner).selectHighestLevel() // Select the highest level owned

    expect(await galaxyMember.getHighestLevel(await owner.getAddress())).to.equal(5) // Owner has the highest level of 5
  })
})
