import { ethers } from "hardhat"
import { expect } from "chai"
import {
  ZERO_ADDRESS,
  catchRevert,
  filterEventsByName,
  getOrDeployContractInstances,
  waitForRoundToEnd,
} from "./helpers"
import { describe, it } from "mocha"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { deployProxy, upgradeProxy } from "../scripts/helpers"
import { X2EarnRewardsPool, X2EarnRewardsPoolV2, X2EarnRewardsPoolV3 } from "../typechain-types"
import { X2EarnRewardsPoolV1 } from "../typechain-types/contracts/depreceated/V1"
import { endorseApp } from "./helpers/xnodes"
import { createLocalConfig } from "../config/contracts/envs/local"

describe("X2EarnRewardsPool - @shard2", function () {
  // deployment
  describe("Deployment", function () {
    it("Cannot deploy contract with zero address", async function () {
      const { owner } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(
        deployProxy("X2EarnRewardsPoolV1", [owner.address, owner.address, owner.address, owner.address, ZERO_ADDRESS]),
      ).to.be.reverted

      await expect(
        deployProxy("X2EarnRewardsPoolV1", [owner.address, owner.address, owner.address, ZERO_ADDRESS, owner.address]),
      ).to.be.reverted

      await expect(
        deployProxy("X2EarnRewardsPoolV1", [owner.address, owner.address, ZERO_ADDRESS, owner.address, owner.address]),
      ).to.be.reverted

      await expect(
        deployProxy("X2EarnRewardsPoolV1", [owner.address, ZERO_ADDRESS, owner.address, owner.address, owner.address]),
      ).to.be.reverted

      await expect(
        deployProxy("X2EarnRewardsPoolV1", [ZERO_ADDRESS, owner.address, owner.address, owner.address, owner.address]),
      ).to.be.reverted
    })

    it("Should deploy the contract", async function () {
      const { x2EarnRewardsPool } = await getOrDeployContractInstances({ forceDeploy: true })
      expect(await x2EarnRewardsPool.getAddress()).to.not.equal(ZERO_ADDRESS)
    })

    it("Should set B3TR correctly", async function () {
      const { x2EarnRewardsPool, b3tr } = await getOrDeployContractInstances({ forceDeploy: false })
      expect(await x2EarnRewardsPool.b3tr()).to.equal(await b3tr.getAddress())
    })

    it("Version should be set correctly", async function () {
      const { x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      expect(await x2EarnRewardsPool.version()).to.equal("4")
    })

    it("X2EarnApps should be set correctly", async function () {
      const { x2EarnRewardsPool, x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: false })
      expect(await x2EarnRewardsPool.x2EarnApps()).to.equal(await x2EarnApps.getAddress())
    })
  })

  // upgradeability
  describe("Contract upgradeablity", () => {
    it("Cannot initialize twice", async function () {
      const { owner } = await getOrDeployContractInstances({ forceDeploy: true })

      const x2EarnRewardsPoolV1 = (await deployProxy("X2EarnRewardsPoolV1", [
        owner.address,
        owner.address,
        owner.address,
        owner.address,
        owner.address,
      ])) as X2EarnRewardsPoolV1
      await catchRevert(
        x2EarnRewardsPoolV1.initialize(owner.address, owner.address, owner.address, owner.address, owner.address),
      )
    })

    it("User with UPGRADER_ROLE should be able to upgrade the contract", async function () {
      const { x2EarnRewardsPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("X2EarnRewardsPoolV1")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await x2EarnRewardsPool.getAddress())

      const UPGRADER_ROLE = await x2EarnRewardsPool.UPGRADER_ROLE()
      expect(await x2EarnRewardsPool.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(x2EarnRewardsPool.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await x2EarnRewardsPool.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only user with UPGRADER_ROLE should be able to upgrade the contract", async function () {
      const { x2EarnRewardsPool, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("X2EarnRewardsPoolV1")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await x2EarnRewardsPool.getAddress())

      const UPGRADER_ROLE = await x2EarnRewardsPool.UPGRADER_ROLE()
      expect(await x2EarnRewardsPool.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(x2EarnRewardsPool.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to
        .be.reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await x2EarnRewardsPool.getAddress())

      expect(newImplAddress.toUpperCase()).to.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.not.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Should return correct version of the contract", async () => {
      const { x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await x2EarnApps.version()).to.equal("2")
    })

    it("Storage should be preserved after upgrade", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, x2EarnApps, minterAccount, veBetterPassport } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const x2EarnRewardsPoolV1 = (await deployProxy("X2EarnRewardsPoolV1", [
        owner.address,
        owner.address,
        owner.address,
        await b3tr.getAddress(),
        await x2EarnApps.getAddress(),
      ])) as X2EarnRewardsPoolV1

      expect(await x2EarnRewardsPoolV1.version()).to.equal("1")

      // update x2EarnApps address
      await x2EarnRewardsPoolV1.connect(owner).setX2EarnApps(await x2EarnApps.getAddress())
      const x2EarnAppsAddress = await x2EarnRewardsPoolV1.x2EarnApps()

      // deposit some funds
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      // create app
      await x2EarnApps.submitApp(owner.address, owner.address, "My app", "metadataURI")
      await endorseApp(await x2EarnApps.hashAppName("My app"), owner)
      await x2EarnApps.submitApp(owner.address, owner.address, "My app #2", "metadataURI")
      await endorseApp(await x2EarnApps.hashAppName("My app #2"), minterAccount)

      await b3tr.connect(owner).approve(await x2EarnRewardsPoolV1.getAddress(), amount)
      await x2EarnRewardsPoolV1.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app"))

      expect(await b3tr.balanceOf(await x2EarnRewardsPoolV1.getAddress())).to.equal(amount)

      // upgrade to new version
      const x2EarnRewardsPoolV2 = (await upgradeProxy(
        "X2EarnRewardsPoolV1",
        "X2EarnRewardsPoolV2",
        await x2EarnRewardsPoolV1.getAddress(),
        [owner.address, config.X_2_EARN_INITIAL_IMPACT_KEYS],
        {
          version: 2,
        },
      )) as X2EarnRewardsPoolV2

      expect(await x2EarnRewardsPoolV2.version()).to.equal("2")
      expect(await x2EarnRewardsPoolV2.x2EarnApps()).to.equal(x2EarnAppsAddress)
      expect(await x2EarnRewardsPoolV2.availableFunds(await x2EarnApps.hashAppName("My app"))).to.equal(amount)

      // upgrade to new version
      const x2EarnRewardsPoolV3 = (await upgradeProxy(
        "X2EarnRewardsPoolV2",
        "X2EarnRewardsPoolV3",
        await x2EarnRewardsPoolV1.getAddress(),
        [await veBetterPassport.getAddress()],
        {
          version: 3,
        },
      )) as X2EarnRewardsPoolV3

      expect(await x2EarnRewardsPoolV3.version()).to.equal("3")
      expect(await x2EarnRewardsPoolV3.x2EarnApps()).to.equal(x2EarnAppsAddress)
      expect(await x2EarnRewardsPoolV3.availableFunds(await x2EarnApps.hashAppName("My app"))).to.equal(amount)

      // upgrade to new version
      const x2EarnRewardsPoolV4 = (await upgradeProxy(
        "X2EarnRewardsPoolV3",
        "X2EarnRewardsPool",
        await x2EarnRewardsPoolV1.getAddress(),
        [],
        {
          version: 4,
        },
      )) as X2EarnRewardsPool

      expect(await x2EarnRewardsPoolV4.version()).to.equal("4")
      expect(await x2EarnRewardsPoolV4.x2EarnApps()).to.equal(x2EarnAppsAddress)
      expect(await x2EarnRewardsPoolV4.availableFunds(await x2EarnApps.hashAppName("My app"))).to.equal(amount)
    })

    it("Should not be able to upgrade if initial impact keys is empty", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, x2EarnApps, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const x2EarnRewardsPoolV1 = (await deployProxy("X2EarnRewardsPoolV1", [
        owner.address,
        owner.address,
        owner.address,
        await b3tr.getAddress(),
        await x2EarnApps.getAddress(),
      ])) as X2EarnRewardsPoolV1

      expect(await x2EarnRewardsPoolV1.version()).to.equal("1")

      // update x2EarnApps address
      await x2EarnRewardsPoolV1.connect(owner).setX2EarnApps(await x2EarnApps.getAddress())

      // deposit some funds
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      // create app
      await x2EarnApps.submitApp(owner.address, owner.address, "My app", "metadataURI")
      await x2EarnApps.submitApp(owner.address, owner.address, "My app #2", "metadataURI")

      await endorseApp(await x2EarnApps.hashAppName("My app"), owner)
      await endorseApp(await x2EarnApps.hashAppName("My app #2"), minterAccount)

      await b3tr.connect(owner).approve(await x2EarnRewardsPoolV1.getAddress(), amount)
      await x2EarnRewardsPoolV1.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app"))

      expect(await b3tr.balanceOf(await x2EarnRewardsPoolV1.getAddress())).to.equal(amount)

      // upgrade to new version
      await expect(
        upgradeProxy(
          "X2EarnRewardsPoolV1",
          "X2EarnRewardsPoolV2",
          await x2EarnRewardsPoolV1.getAddress(),
          [owner.address, []],
          {
            version: 2,
          },
        ),
      ).to.be.reverted

      await expect(
        upgradeProxy(
          "X2EarnRewardsPoolV1",
          "X2EarnRewardsPoolV2",
          await x2EarnRewardsPoolV1.getAddress(),
          [owner.address, ["impact"]],
          {
            version: 2,
          },
        ),
      ).to.not.be.reverted
    })

    it("Should not be able to upgrade to V3 if veBetterPassport address is empty", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, x2EarnApps, minterAccount, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      const x2EarnRewardsPoolV1 = (await deployProxy("X2EarnRewardsPoolV1", [
        owner.address,
        owner.address,
        owner.address,
        await b3tr.getAddress(),
        await x2EarnApps.getAddress(),
      ])) as X2EarnRewardsPoolV1

      expect(await x2EarnRewardsPoolV1.version()).to.equal("1")

      // update x2EarnApps address
      await x2EarnRewardsPoolV1.connect(owner).setX2EarnApps(await x2EarnApps.getAddress())

      // deposit some funds
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      // create app
      await x2EarnApps.submitApp(owner.address, owner.address, "My app", "metadataURI")
      await x2EarnApps.submitApp(owner.address, owner.address, "My app #2", "metadataURI")

      await endorseApp(await x2EarnApps.hashAppName("My app"), owner)
      await endorseApp(await x2EarnApps.hashAppName("My app #2"), otherAccount)

      await b3tr.connect(owner).approve(await x2EarnRewardsPoolV1.getAddress(), amount)
      await x2EarnRewardsPoolV1.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app"))

      expect(await b3tr.balanceOf(await x2EarnRewardsPoolV1.getAddress())).to.equal(amount)

      // upgrade to new version
      await expect(
        upgradeProxy(
          "X2EarnRewardsPoolV1",
          "X2EarnRewardsPoolV2",
          await x2EarnRewardsPoolV1.getAddress(),
          [owner.address, config.X_2_EARN_INITIAL_IMPACT_KEYS],
          {
            version: 2,
          },
        ),
      ).to.not.be.reverted

      await expect(
        upgradeProxy(
          "X2EarnRewardsPoolV2",
          "X2EarnRewardsPool",
          await x2EarnRewardsPoolV1.getAddress(),
          [ZERO_ADDRESS],
          {
            version: 3,
          },
        ),
      ).to.be.reverted

      await expect(
        upgradeProxy(
          "X2EarnRewardsPoolV2",
          "X2EarnRewardsPool",
          await x2EarnRewardsPoolV1.getAddress(),
          [owner.address],
          {
            version: 3,
          },
        ),
      ).to.not.be.reverted
    })
  })

  // settings
  describe("Settings", function () {
    it("CONTRACTS_ADDRESS_MANAGER_ROLE can set new x2EarnApps", async function () {
      const { x2EarnRewardsPool, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(
        await x2EarnRewardsPool.hasRole(await x2EarnRewardsPool.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address),
      ).to.eql(true)
      await x2EarnRewardsPool.connect(owner).setX2EarnApps(await otherAccount.getAddress())

      expect(await x2EarnRewardsPool.x2EarnApps()).to.equal(await otherAccount.getAddress())
    })

    it("Only CONTRACTS_ADDRESS_MANAGER_ROLE can set new x2EarnApps", async function () {
      const { x2EarnRewardsPool, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(
        await x2EarnRewardsPool.hasRole(await x2EarnRewardsPool.CONTRACTS_ADDRESS_MANAGER_ROLE(), otherAccount.address),
      ).to.eql(false)

      await catchRevert(x2EarnRewardsPool.connect(otherAccount).setX2EarnApps(await otherAccount.getAddress()))
    })

    it("New x2EarnApps address cannot be the zero address", async function () {
      const { x2EarnRewardsPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(x2EarnRewardsPool.connect(owner).setX2EarnApps(ZERO_ADDRESS))
    })

    it("Can't send VET to the contract", async function () {
      const { x2EarnRewardsPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(
        owner.sendTransaction({
          to: await x2EarnRewardsPool.getAddress(),
          value: ethers.parseEther("1.0"), // Sends exactly 1.0 ether
        }),
      ).to.be.reverted

      const balance = await ethers.provider.getBalance(await x2EarnRewardsPool.getAddress())
      expect(balance).to.equal(0n)
    })

    it("Can't send ERC721 to the contract", async function () {
      const { myErc721, x2EarnRewardsPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!myErc721) throw new Error("No ERC721 contract")

      await myErc721.connect(owner).safeMint(owner.address, 1)

      // @ts-ignore
      await expect(myErc721.connect(owner).safeTransferFrom(owner.address, await x2EarnRewardsPool.getAddress(), 1)).to
        .be.rejected
    })

    it("Cannot send ERC1155 to the contract", async function () {
      const { myErc1155, x2EarnRewardsPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!myErc1155) throw new Error("No ERC1155 contract")

      await myErc1155.connect(owner).mint(owner.address, 1, 1, "0x")

      // @ts-ignore
      await expect(
        myErc1155.connect(owner).safeTransferFrom(owner.address, await x2EarnRewardsPool.getAddress(), 1, 1, "0x"),
      ).to.be.rejected
    })

    it("Cannot batch send ERC1155 to the contract", async function () {
      const { myErc1155, x2EarnRewardsPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      if (!myErc1155) throw new Error("No ERC1155 contract")

      await expect(
        myErc1155.connect(owner).mintBatch(await x2EarnRewardsPool.getAddress(), [2, 3], [2, 3], new Uint8Array(0)),
      ).to.be.rejected
    })

    it("should revert when calling fallback function with call data", async function () {
      const { x2EarnRewardsPool, owner } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      owner.sendTransaction({
        to: await x2EarnRewardsPool.getAddress(),
        value: ethers.parseEther("0"),
        data: "0x1234", // some data
      })
    })

    it("Can get and set veBetterPassport address", async function () {
      const { x2EarnRewardsPool, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      await x2EarnRewardsPool.connect(owner).setVeBetterPassport(owner.address)

      const updatedVeBetterPassportAddress = await x2EarnRewardsPool.veBetterPassport()
      expect(updatedVeBetterPassportAddress).to.eql(owner.address)

      // only admin can set the veBetterPassport address
      await expect(x2EarnRewardsPool.connect(otherAccount).setVeBetterPassport(otherAccount.address)).to.be.reverted
    })
  })

  // deposit
  describe("Deposit", function () {
    // everyone can deposit
    it("Anyone can deposit", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      // create app
      await x2EarnApps.submitApp(owner.address, owner.address, "My app", "metadataURI")
      await x2EarnApps.submitApp(owner.address, owner.address, "My app #2", "metadataURI")

      const appId1 = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appId2 = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
      await endorseApp(appId1, owner)
      await endorseApp(appId2, minterAccount)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app"))

      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(amount)
    })

    // app must exist
    it("Should not allow deposit to non-existing app", async function () {
      const { x2EarnRewardsPool, b3tr, owner, x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })
      const amount = ethers.parseEther("100")

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await catchRevert(x2EarnRewardsPool.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app")))
    })

    // owner must approve token
    it("Should not allow deposit without approval", async function () {
      const { x2EarnRewardsPool, x2EarnApps, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })
      const amount = ethers.parseEther("100")

      await x2EarnApps.submitApp(owner.address, owner.address, "My app", "metadataURI")
      const appId = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(appId, owner)

      await catchRevert(x2EarnRewardsPool.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app")))
    })

    it("Should emit Deposit event", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccount, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(otherAccount.address, amount)

      await x2EarnApps.submitApp(owner.address, owner.address, "My app", "metadataURI")
      const appId = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(appId, owner)

      await b3tr.connect(otherAccount).approve(await x2EarnRewardsPool.getAddress(), amount)
      const tx = await x2EarnRewardsPool.connect(otherAccount).deposit(amount, await x2EarnApps.hashAppName("My app"))
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "NewDeposit")
      expect(event).not.to.eql([])

      expect(event[0].args[0]).to.equal(amount)
      expect(event[0].args[1]).to.equal(await x2EarnApps.hashAppName("My app"))
      expect(event[0].args[2]).to.equal(otherAccount.address)
    })
  })
  describe("Balance", function () {
    it("Should return correct balance", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(owner.address, owner.address, "My app", "metadataURI")
      const appId = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(appId, owner)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app"))

      expect(await x2EarnRewardsPool.availableFunds(await x2EarnApps.hashAppName("My app"))).to.equal(amount)
    })
  })
  // withdraw
  describe("Withdraw", function () {
    it("The admin of the app can withdraw", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const appAdmin = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, appAdmin.address, "My app", "metadataURI")
      const appId = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(appId, owner)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      expect(await b3tr.balanceOf(teamWallet.address)).to.equal(0n)

      await x2EarnRewardsPool.connect(appAdmin).withdraw(ethers.parseEther("1"), appId, "")

      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // money are sent to team wallet
      expect(await b3tr.balanceOf(teamWallet.address)).to.equal(ethers.parseEther("1"))

      // can leave a reason
      const tx = await x2EarnRewardsPool
        .connect(appAdmin)
        .withdraw(ethers.parseEther("1"), await x2EarnApps.hashAppName("My app"), "For the team")

      // "Should emit Withdraw event"
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "TeamWithdrawal")
      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(await x2EarnApps.hashAppName("My app"))
      expect(event[0].args[2]).to.equal(teamWallet.address)
      expect(event[0].args[3]).to.equal(appAdmin.address)
      expect(event[0].args[4]).to.equal("For the team")
    })

    it("The app distributor can withdraw", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const appAdmin = otherAccounts[11]
      const appDistributor = otherAccounts[12]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, appAdmin.address, "My app", "metadataURI")
      const appId = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(appId, owner)

      await x2EarnApps.connect(appAdmin).addRewardDistributor(appId, appDistributor.address)
      expect(await x2EarnApps.isRewardDistributor(appId, appDistributor.address)).to.equal(true)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      expect(await b3tr.balanceOf(teamWallet.address)).to.equal(0n)

      await x2EarnRewardsPool.connect(appDistributor).withdraw(ethers.parseEther("1"), appId, "")

      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // money are sent to team wallet
      expect(await b3tr.balanceOf(teamWallet.address)).to.equal(ethers.parseEther("1"))

      // can leave a reason
      const tx = await x2EarnRewardsPool
        .connect(appDistributor)
        .withdraw(ethers.parseEther("1"), await x2EarnApps.hashAppName("My app"), "For the team")

      // "Should emit Withdraw event"
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "TeamWithdrawal")
      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(await x2EarnApps.hashAppName("My app"))
      expect(event[0].args[2]).to.equal(teamWallet.address)
      expect(event[0].args[3]).to.equal(appDistributor.address)
      expect(event[0].args[4]).to.equal("For the team")
    })

    it("App must exist", async function () {
      const { x2EarnRewardsPool, b3tr, owner, x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), ethers.parseEther("100"))

      await catchRevert(
        x2EarnRewardsPool.connect(owner).withdraw(ethers.parseEther("1"), await x2EarnApps.hashAppName("My app"), ""),
      )
    })

    it("Normal users cannot withdraw", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccount, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccount

      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(appId, owner)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app"))

      await catchRevert(
        x2EarnRewardsPool
          .connect(otherAccount)
          .withdraw(ethers.parseEther("1"), await x2EarnApps.hashAppName("My app"), ""),
      )
    })

    it("Cannot withdraw as admin of another app", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccount, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccount

      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      await x2EarnApps.submitApp(owner.address, owner.address, "My app #2", "metadataURI")
      const appId = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))

      await endorseApp(appId, owner)
      await endorseApp(app2Id, minterAccount)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app"))

      await catchRevert(
        x2EarnRewardsPool
          .connect(teamWallet)
          .withdraw(ethers.parseEther("1"), await x2EarnApps.hashAppName("My app"), ""),
      )
    })

    it("App must have enough available funds to withdraw", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccount, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccount

      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(appId, owner)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app"))

      await catchRevert(
        x2EarnRewardsPool.connect(owner).withdraw(ethers.parseEther("101"), await x2EarnApps.hashAppName("My app"), ""),
      )
    })

    it("Should not allow to withdraw more than available funds", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccount, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccount

      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await endorseApp(appId, owner)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, await x2EarnApps.hashAppName("My app"))

      await catchRevert(
        x2EarnRewardsPool.connect(owner).withdraw(ethers.parseEther("101"), await x2EarnApps.hashAppName("My app"), ""),
      )
    })
  })
  // distributeRewards
  describe("Distribute rewards", async function () {
    it("Selected address from team can distribute rewards", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      const tx = await x2EarnRewardsPool
        .connect(owner)
        .distributeReward(appId, ethers.parseEther("1"), user.address, "ipfs://metadata")
      const receipt = await tx.wait()

      expect(await b3tr.balanceOf(user.address)).to.equal(ethers.parseEther("1"))
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // event emitted
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "RewardDistributed")

      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(appId)
      expect(event[0].args[2]).to.equal(user.address)
      expect(event[0].args[3]).to.equal("") // Because it's using a deprecated function
      expect(event[0].args[4]).to.equal(owner.address)
    })

    it("Cannot distribute if no available funds", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)
      await x2EarnApps.addRewardDistributor(appId, owner.address)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      await expect(x2EarnRewardsPool.connect(owner).distributeReward(appId, ethers.parseEther("101"), user.address, ""))
        .to.be.reverted

      expect(await b3tr.balanceOf(user.address)).to.equal(0)
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(amount)
    })

    it("Only selected address can distribute rewards", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.addRewardDistributor(appId, owner.address)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      await catchRevert(
        x2EarnRewardsPool.connect(user).distributeReward(appId, ethers.parseEther("1"), user.address, ""),
      )

      expect(await b3tr.balanceOf(user.address)).to.equal(0)
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(amount)
    })

    it("App must exist", async function () {
      const { x2EarnRewardsPool, b3tr, owner, otherAccounts, x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)

      await catchRevert(
        x2EarnRewardsPool
          .connect(teamWallet)
          .distributeReward(await x2EarnApps.hashAppName("My app"), ethers.parseEther("1"), user.address, ""),
      )
    })

    it("App must have a reward distributor", async function () {
      const { x2EarnRewardsPool, b3tr, owner, otherAccounts, x2EarnApps, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      await catchRevert(
        x2EarnRewardsPool.connect(teamWallet).distributeReward(appId, ethers.parseEther("1"), user.address, ""),
      )
    })

    it("Cannot distribute more than available funds", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.addRewardDistributor(appId, owner.address)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      await catchRevert(
        x2EarnRewardsPool.connect(teamWallet).distributeReward(appId, ethers.parseEther("101"), user.address, ""),
      )
    })

    it("Cannot distribute more than available funds", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.addRewardDistributor(appId, teamWallet.address)

      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      await expect(
        x2EarnRewardsPool.connect(teamWallet).distributeReward(appId, ethers.parseEther("101"), user.address, ""),
      ).to.be.reverted
    })
  })

  describe("Proofs and Impact", async function () {
    it("Json proof is created by the contract", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      const tx = await x2EarnRewardsPool
        .connect(owner)
        .distributeRewardWithProof(
          appId,
          ethers.parseEther("1"),
          user.address,
          ["image"],
          ["https://image.png"],
          ["carbon", "water"],
          [100, 200],
          "The description of the action",
        )

      const receipt = await tx.wait()

      expect(await b3tr.balanceOf(user.address)).to.equal(ethers.parseEther("1"))
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // event emitted
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "RewardDistributed")

      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(appId)
      expect(event[0].args[2]).to.equal(user.address)

      const emittedProof = JSON.parse(event[0].args[3])

      expect(emittedProof).to.have.property("version")
      expect(emittedProof.version).to.equal(2)
      expect(emittedProof).to.have.deep.property("proof", { image: "https://image.png" })
      expect(emittedProof).to.have.property("description")
      expect(emittedProof.description).to.equal("The description of the action")
      expect(emittedProof).to.have.deep.property("impact", { carbon: 100, water: 200 })

      expect(event[0].args[4]).to.equal(owner.address)
    })

    it("App can provide multiple proofs", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      const tx = await x2EarnRewardsPool
        .connect(owner)
        .distributeRewardWithProof(
          appId,
          ethers.parseEther("1"),
          user.address,
          ["image", "link"],
          ["https://image.png", "https://twitter.com/tweet/1"],
          ["carbon", "water"],
          [100, 200],
          "The description of the action",
        )

      const receipt = await tx.wait()

      expect(await b3tr.balanceOf(user.address)).to.equal(ethers.parseEther("1"))
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // event emitted
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "RewardDistributed")

      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(appId)
      expect(event[0].args[2]).to.equal(user.address)

      const emittedProof = JSON.parse(event[0].args[3])
      expect(emittedProof).to.have.property("version")
      expect(emittedProof.version).to.equal(2)
      expect(emittedProof).to.have.deep.property("proof", {
        image: "https://image.png",
        link: "https://twitter.com/tweet/1",
      })
      expect(emittedProof).to.have.property("description")
      expect(emittedProof.description).to.equal("The description of the action")
      expect(emittedProof).to.have.deep.property("impact", { carbon: 100, water: 200 })

      expect(event[0].args[4]).to.equal(owner.address)
    })

    it("App can provide only proofs without impact", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      const tx = await x2EarnRewardsPool
        .connect(owner)
        .distributeRewardWithProof(
          appId,
          ethers.parseEther("1"),
          user.address,
          ["image", "link"],
          ["https://image.png", "https://twitter.com/tweet/1"],
          [],
          [],
          "The description of the action",
        )

      const receipt = await tx.wait()

      expect(await b3tr.balanceOf(user.address)).to.equal(ethers.parseEther("1"))
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // event emitted
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "RewardDistributed")

      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(appId)
      expect(event[0].args[2]).to.equal(user.address)

      const emittedProof = JSON.parse(event[0].args[3])

      expect(emittedProof).to.have.property("version")
      expect(emittedProof.version).to.equal(2)
      expect(emittedProof).to.have.deep.property("proof", {
        image: "https://image.png",
        link: "https://twitter.com/tweet/1",
      })
      expect(emittedProof).to.have.property("description")
      expect(emittedProof.description).to.equal("The description of the action")

      expect(emittedProof).to.not.have.property("impact")
    })

    it("App can provide only impact without proofs", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      const tx = await x2EarnRewardsPool
        .connect(owner)
        .distributeRewardWithProof(
          appId,
          ethers.parseEther("1"),
          user.address,
          [],
          [],
          ["carbon", "water"],
          [100, 200],
          "The description of the action",
        )

      const receipt = await tx.wait()

      expect(await b3tr.balanceOf(user.address)).to.equal(ethers.parseEther("1"))
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // event emitted
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "RewardDistributed")

      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(appId)
      expect(event[0].args[2]).to.equal(user.address)

      const emittedProof = JSON.parse(event[0].args[3])

      expect(emittedProof).to.have.property("version")
      expect(emittedProof.version).to.equal(2)
      expect(emittedProof).to.have.property("description")
      expect(emittedProof.description).to.equal("The description of the action")
      expect(emittedProof).to.have.deep.property("impact", { carbon: 100, water: 200 })

      expect(emittedProof).to.not.have.property("proof")
    })

    it("If only description is passed, without proofs and impact, nothing is emitted", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      const tx = await x2EarnRewardsPool
        .connect(owner)
        .distributeRewardWithProof(
          appId,
          ethers.parseEther("1"),
          user.address,
          [],
          [],
          [],
          [],
          "The description of the action",
        )

      const receipt = await tx.wait()

      expect(await b3tr.balanceOf(user.address)).to.equal(ethers.parseEther("1"))
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // event emitted
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "RewardDistributed")

      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(appId)
      expect(event[0].args[2]).to.equal(user.address)
      expect(event[0].args[3]).to.equal("")
    })

    it("Description is not mandatory if proof or impact is passed", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      const tx = await x2EarnRewardsPool
        .connect(owner)
        .distributeRewardWithProof(
          appId,
          ethers.parseEther("1"),
          user.address,
          ["image", "link"],
          ["https://image.png", "https://twitter.com/tweet/1"],
          ["carbon", "water"],
          [100, 200],
          "",
        )

      const receipt = await tx.wait()

      expect(await b3tr.balanceOf(user.address)).to.equal(ethers.parseEther("1"))
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // event emitted
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "RewardDistributed")

      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(appId)
      expect(event[0].args[2]).to.equal(user.address)

      const emittedProof = JSON.parse(event[0].args[3])
      expect(emittedProof).to.have.property("version")
      expect(emittedProof.version).to.equal(2)
      expect(emittedProof).to.have.deep.property("proof", {
        image: "https://image.png",
        link: "https://twitter.com/tweet/1",
      })
      expect(emittedProof).to.not.have.property("description")
      expect(emittedProof).to.have.deep.property("impact", { carbon: 100, water: 200 })
    })

    it("If no proof, nor impact, nor description is passed, nothing is emitted", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      const tx = await x2EarnRewardsPool
        .connect(owner)
        .distributeRewardWithProof(appId, ethers.parseEther("1"), user.address, [], [], [], [], "")

      const receipt = await tx.wait()

      expect(await b3tr.balanceOf(user.address)).to.equal(ethers.parseEther("1"))
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // event emitted
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "RewardDistributed")

      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(appId)
      expect(event[0].args[2]).to.equal(user.address)
      expect(event[0].args[3]).to.equal("")
    })

    it("If a non valid proof type is passed, it reverts", async function () {
      const { x2EarnRewardsPool, x2EarnApps, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      await catchRevert(
        x2EarnRewardsPool
          .connect(owner)
          .distributeRewardWithProof(
            await x2EarnApps.hashAppName("My app"),
            ethers.parseEther("1"),
            owner.address,
            ["invalid"],
            ["https://image.png"],
            ["carbon", "water"],
            [100, 200],
            "The description of the action",
          ),
      )
    })

    it("Only valid proofs are image, text, link, video", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      await catchRevert(
        x2EarnRewardsPool
          .connect(owner)
          .distributeRewardWithProof(
            appId,
            ethers.parseEther("1"),
            user.address,
            ["invalid"],
            ["https://image.png"],
            ["carbon", "water"],
            [100, 200],
            "The description of the action",
          ),
      )

      await expect(
        x2EarnRewardsPool
          .connect(owner)
          .distributeRewardWithProof(
            appId,
            ethers.parseEther("1"),
            user.address,
            ["video"],
            ["https://image.png"],
            ["carbon", "water"],
            [100, 200],
            "The description of the action",
          ),
      ).not.to.be.reverted

      await expect(
        x2EarnRewardsPool
          .connect(owner)
          .distributeRewardWithProof(
            appId,
            ethers.parseEther("1"),
            user.address,
            ["image"],
            ["https://image.png"],
            ["carbon", "water"],
            [100, 200],
            "The description of the action",
          ),
      ).not.to.be.reverted

      await expect(
        x2EarnRewardsPool
          .connect(owner)
          .distributeRewardWithProof(
            appId,
            ethers.parseEther("1"),
            user.address,
            ["link"],
            ["https://image.png"],
            ["carbon", "water"],
            [100, 200],
            "The description of the action",
          ),
      ).not.to.be.reverted
    })

    it("If a non valid impact type is passed, it reverts", async function () {
      const { x2EarnRewardsPool, x2EarnApps, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      await catchRevert(
        x2EarnRewardsPool
          .connect(owner)
          .distributeRewardWithProof(
            await x2EarnApps.hashAppName("My app"),
            ethers.parseEther("1"),
            owner.address,
            ["image"],
            ["https://image.png"],
            ["invalid"],
            [100, 200],
            "The description of the action",
          ),
      )
    })

    it("If impact values length differs from codes length, it reverts", async function () {
      const { x2EarnRewardsPool, x2EarnApps, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      await catchRevert(
        x2EarnRewardsPool
          .connect(owner)
          .distributeRewardWithProof(
            await x2EarnApps.hashAppName("My app"),
            ethers.parseEther("1"),
            owner.address,
            ["image"],
            ["https://image.png"],
            ["carbon"],
            [100, 200],
            "The description of the action",
          ),
      )
    })

    it("If proof values length differs from types length, it reverts", async function () {
      const { x2EarnRewardsPool, x2EarnApps, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      await catchRevert(
        x2EarnRewardsPool
          .connect(owner)
          .distributeRewardWithProof(
            await x2EarnApps.hashAppName("My app"),
            ethers.parseEther("1"),
            owner.address,
            ["image", "link"],
            ["https://image.png"],
            ["carbon", "water"],
            [100, 200],
            "The description of the action",
          ),
      )
    })

    it("Anyone can index available impact codes", async function () {
      const { x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      const impactCodes = await x2EarnRewardsPool.getAllowedImpactKeys()

      expect(impactCodes).to.eql([
        "carbon",
        "water",
        "energy",
        "waste_mass",
        "education_time",
        "timber",
        "plastic",
        "trees_planted",
      ])
    })

    it("IMPACT_KEY_MANAGER_ROLE and DEFAULT_ADMIN can remove an impact code", async function () {
      const { x2EarnRewardsPool, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      expect(await x2EarnRewardsPool.hasRole(await x2EarnRewardsPool.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(
        true,
      )

      await x2EarnRewardsPool.connect(owner).removeImpactKey("carbon")

      const impactCodes = await x2EarnRewardsPool.getAllowedImpactKeys()

      expect(impactCodes).to.eql([
        "trees_planted",
        "water",
        "energy",
        "waste_mass",
        "education_time",
        "timber",
        "plastic",
      ])

      await x2EarnRewardsPool
        .connect(owner)
        .grantRole(await x2EarnRewardsPool.IMPACT_KEY_MANAGER_ROLE(), otherAccount.address)

      await x2EarnRewardsPool.connect(otherAccount).removeImpactKey("water")

      const impactCodes2 = await x2EarnRewardsPool.getAllowedImpactKeys()

      expect(impactCodes2).to.eql(["trees_planted", "plastic", "energy", "waste_mass", "education_time", "timber"])
    })

    it("IMPACT_KEY_MANAGER_ROLE and DEFAULT_ADMIN can add an impact code", async function () {
      const { x2EarnRewardsPool, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      expect(await x2EarnRewardsPool.hasRole(await x2EarnRewardsPool.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(
        true,
      )

      await x2EarnRewardsPool.connect(owner).addImpactKey("new_impact")

      const impactCodes = await x2EarnRewardsPool.getAllowedImpactKeys()

      expect(impactCodes).to.eql([
        "carbon",
        "water",
        "energy",
        "waste_mass",
        "education_time",
        "timber",
        "plastic",
        "trees_planted",
        "new_impact",
      ])

      await x2EarnRewardsPool
        .connect(owner)
        .grantRole(await x2EarnRewardsPool.IMPACT_KEY_MANAGER_ROLE(), otherAccount.address)

      await x2EarnRewardsPool.connect(otherAccount).addImpactKey("new_impact_2")

      const impactCodes2 = await x2EarnRewardsPool.getAllowedImpactKeys()

      expect(impactCodes2).to.eql([
        "carbon",
        "water",
        "energy",
        "waste_mass",
        "education_time",
        "timber",
        "plastic",
        "trees_planted",
        "new_impact",
        "new_impact_2",
      ])
    })

    it("Non admin users cannot add and remove impact codes", async function () {
      const { x2EarnRewardsPool, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        bootstrapAndStartEmissions: true,
      })

      expect(
        await x2EarnRewardsPool.hasRole(await x2EarnRewardsPool.DEFAULT_ADMIN_ROLE(), otherAccounts[10].address),
      ).to.equal(false)
      expect(
        await x2EarnRewardsPool.hasRole(await x2EarnRewardsPool.IMPACT_KEY_MANAGER_ROLE(), otherAccounts[10].address),
      ).to.equal(false)

      await catchRevert(x2EarnRewardsPool.connect(otherAccounts[10]).addImpactKey("new_impact"))
      await catchRevert(x2EarnRewardsPool.connect(otherAccounts[10]).removeImpactKey("carbon"))
    })

    it("Deprecated: can distribute rewards with a self-provided proof and impact", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const user = otherAccounts[11]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      const proof = { mycustomproof: "https://image.png" }

      const tx = await x2EarnRewardsPool
        .connect(owner)
        .distributeRewardDeprecated(appId, ethers.parseEther("1"), user.address, JSON.stringify(proof))

      const receipt = await tx.wait()

      expect(await b3tr.balanceOf(user.address)).to.equal(ethers.parseEther("1"))
      expect(await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())).to.equal(ethers.parseEther("99"))

      // event emitted
      if (!receipt) throw new Error("No receipt")

      const event = filterEventsByName(receipt.logs, "RewardDistributed")

      expect(event).not.to.eql([])
      expect(event[0].args[0]).to.equal(ethers.parseEther("1"))
      expect(event[0].args[1]).to.equal(appId)
      expect(event[0].args[2]).to.equal(user.address)

      const emittedProof = JSON.parse(event[0].args[3])

      expect(emittedProof).to.have.property("mycustomproof")
      expect(emittedProof.mycustomproof).to.equal("https://image.png")
    })

    it("I should be able to preview the proof and impact of a reward distribution", async function () {
      const { x2EarnRewardsPool, x2EarnApps, b3tr, owner, otherAccounts, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          bootstrapAndStartEmissions: true,
        })

      const teamWallet = otherAccounts[10]
      const amount = ethers.parseEther("100")

      await b3tr.connect(minterAccount).mint(owner.address, amount)

      await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
      const appId = await x2EarnApps.hashAppName("My app")
      await endorseApp(appId, owner)

      await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
      expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

      // fill the pool
      await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
      await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

      const onchainGeneratedProof = JSON.parse(
        await x2EarnRewardsPool.buildProof(
          ["image"],
          ["https://image.png"],
          ["carbon", "water"],
          [100, 200],
          "The description of the action",
        ),
      )

      expect(onchainGeneratedProof).to.have.property("version")
      expect(onchainGeneratedProof.version).to.equal(2)
      expect(onchainGeneratedProof).to.have.deep.property("proof", {
        image: "https://image.png",
      })
      expect(onchainGeneratedProof).to.have.property("description")
      expect(onchainGeneratedProof).to.have.deep.property("impact", { carbon: 100, water: 200 })
    })
  })

  it("Can register action in VeBetterPassport", async function () {
    const {
      x2EarnRewardsPool,
      x2EarnApps,
      xAllocationVoting,
      veBetterPassport,
      b3tr,
      owner,
      otherAccounts,
      minterAccount,
    } = await getOrDeployContractInstances({
      forceDeploy: true,
    })

    const teamWallet = otherAccounts[10]
    const user = otherAccounts[11]
    const amount = ethers.parseEther("100")

    await b3tr.connect(minterAccount).mint(owner.address, amount)

    await x2EarnApps.submitApp(teamWallet.address, owner.address, "My app", "metadataURI")
    const appId = await x2EarnApps.hashAppName("My app")
    await endorseApp(appId, owner)

    await x2EarnApps.connect(owner).addRewardDistributor(appId, owner.address)
    expect(await x2EarnApps.isRewardDistributor(appId, owner.address)).to.equal(true)

    // fill the pool
    await b3tr.connect(owner).approve(await x2EarnRewardsPool.getAddress(), amount)
    await x2EarnRewardsPool.connect(owner).deposit(amount, appId)

    // start round
    await xAllocationVoting.connect(owner).startNewRound()

    await veBetterPassport.setAppSecurity(appId, 1)

    expect(await veBetterPassport.getAddress()).to.equal(await x2EarnRewardsPool.veBetterPassport())

    const tx = await x2EarnRewardsPool.connect(owner).distributeReward(appId, ethers.parseEther("1"), user.address, "")

    const receipt = await tx.wait()

    // event emitted
    if (!receipt) throw new Error("No receipt")

    const decodedEvents = receipt.logs?.map(event => {
      return veBetterPassport.interface.parseLog({
        topics: event?.topics as string[],
        data: event?.data as string,
      })
    })

    const registeredActionEvent = decodedEvents.filter(
      (event: any) => event !== null && event.name === "RegisteredAction",
    )[0]

    let roundId = await xAllocationVoting.currentRoundId()

    expect(registeredActionEvent).not.to.eql([])
    expect(registeredActionEvent?.args[0]).to.equal(user.address)
    expect(registeredActionEvent?.args[1]).to.equal(user.address)
    expect(registeredActionEvent?.args[2]).to.equal(appId)
    expect(registeredActionEvent?.args[3]).to.equal(roundId)

    // check that the action score is correct
    const appSecurity = await veBetterPassport.appSecurity(appId)
    const multiplier = await veBetterPassport.securityMultiplier(appSecurity)
    expect(registeredActionEvent?.args[4]).to.equal(multiplier)

    // check that the user score is correct
    expect(await veBetterPassport.userAppTotalScore(user.address, appId)).to.equal(multiplier)
    expect(await veBetterPassport.userRoundScoreApp(user.address, roundId, appId)).to.equal(multiplier)
    expect(await veBetterPassport.userTotalScore(user.address)).to.equal(multiplier)
    expect(await veBetterPassport.userRoundScore(user.address, roundId)).to.equal(multiplier)

    // start round
    await waitForRoundToEnd(roundId)
    await xAllocationVoting.connect(owner).startNewRound()
    roundId = await xAllocationVoting.currentRoundId()

    // action is registered when the reward is distributed with proof
    const tx2 = await x2EarnRewardsPool
      .connect(owner)
      .distributeRewardWithProof(
        appId,
        ethers.parseEther("1"),
        user.address,
        ["image"],
        ["https://image.png"],
        ["carbon", "water"],
        [100, 200],
        "The description of the action",
      )

    const receipt2 = await tx2.wait()

    // event emitted
    if (!receipt2) throw new Error("No receipt")

    const decodedEvents2 = receipt2.logs?.map(event => {
      return veBetterPassport.interface.parseLog({
        topics: event?.topics as string[],
        data: event?.data as string,
      })
    })

    const registeredActionEvent2 = decodedEvents2.filter(
      (event: any) => event !== null && event.name === "RegisteredAction",
    )[0]

    expect(registeredActionEvent2).not.to.eql([])
    expect(registeredActionEvent2?.args[0]).to.equal(user.address)
    expect(registeredActionEvent2?.args[1]).to.equal(user.address)
    expect(registeredActionEvent2?.args[2]).to.equal(appId)
    expect(registeredActionEvent2?.args[3]).to.equal(roundId)

    // check that the action score is correct
    const supposedScore = multiplier + multiplier
    expect(registeredActionEvent2?.args[4]).to.equal(multiplier)

    // check that the user score is correct
    expect(await veBetterPassport.userAppTotalScore(user.address, appId)).to.equal(supposedScore)
    expect(await veBetterPassport.userTotalScore(user.address)).to.equal(supposedScore)
    expect(await veBetterPassport.userRoundScore(user.address, roundId)).to.equal(multiplier)
    expect(await veBetterPassport.userRoundScoreApp(user.address, roundId, appId)).to.equal(multiplier)

    // start round
    await waitForRoundToEnd(roundId)
    await xAllocationVoting.connect(owner).startNewRound()
    roundId = await xAllocationVoting.currentRoundId()

    // event is emitted when using depraceted distributeReward function
    const tx3 = await x2EarnRewardsPool
      .connect(owner)
      .distributeRewardDeprecated(appId, ethers.parseEther("1"), user.address, "")

    const receipt3 = await tx3.wait()

    // event emitted
    if (!receipt3) throw new Error("No receipt")

    const decodedEvents3 = receipt3.logs?.map(event => {
      return veBetterPassport.interface.parseLog({
        topics: event?.topics as string[],
        data: event?.data as string,
      })
    })

    const registeredActionEvent3 = decodedEvents3.filter(
      (event: any) => event !== null && event.name === "RegisteredAction",
    )[0]

    expect(registeredActionEvent3).not.to.eql([])
    expect(registeredActionEvent3?.args[0]).to.equal(user.address)
    expect(registeredActionEvent3?.args[1]).to.equal(user.address)
    expect(registeredActionEvent3?.args[2]).to.equal(appId)
    expect(registeredActionEvent3?.args[3]).to.equal(roundId)

    // check that the action score is correct
    const supposedScore2 = supposedScore + multiplier
    expect(registeredActionEvent3?.args[4]).to.equal(multiplier)

    // check that the user score is correct
    expect(await veBetterPassport.userRoundScoreApp(user.address, roundId, appId)).to.equal(multiplier)
    expect(await veBetterPassport.userTotalScore(user.address)).to.equal(supposedScore2)
    expect(await veBetterPassport.userRoundScore(user.address, roundId)).to.equal(multiplier)
  })
})
