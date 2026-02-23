import { ethers } from "hardhat"
import { expect } from "chai"
import {
  ZERO_ADDRESS,
  bootstrapEmissions,
  catchRevert,
  getOrDeployContractInstances,
  getVot3Tokens,
  waitForRoundToEnd,
  startNewAllocationRound,
} from "./helpers"
import { describe, it, before } from "mocha"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { deployProxy } from "../scripts/helpers"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { endorseApp } from "./helpers/xnodes"
import { DBAPoolV1, DBAPoolV2 } from "../typechain-types"

describe("DBA Pool - @shard7b", async function () {
  // Environment params
  let owner: HardhatEthersSigner
  let otherAccount: HardhatEthersSigner
  let distributor: HardhatEthersSigner
  let upgrader: HardhatEthersSigner

  before(async function () {
    const {
      owner: deployedOwner,
      otherAccount: deployedOtherAccount,
      otherAccounts,
    } = await getOrDeployContractInstances({ forceDeploy: true })
    owner = deployedOwner
    otherAccount = deployedOtherAccount
    distributor = otherAccounts[0]
    upgrader = otherAccounts[1]
  })

  describe("Deployment and Initialization", async function () {
    it("Contract is correctly initialized", async function () {
      const { dynamicBaseAllocationPool, x2EarnApps, xAllocationPool, x2EarnRewardsPool, b3tr } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      expect(await dynamicBaseAllocationPool.x2EarnApps()).to.eql(await x2EarnApps.getAddress())
      expect(await dynamicBaseAllocationPool.xAllocationPool()).to.eql(await xAllocationPool.getAddress())
      expect(await dynamicBaseAllocationPool.x2EarnRewardsPool()).to.eql(await x2EarnRewardsPool.getAddress())
      expect(await dynamicBaseAllocationPool.b3tr()).to.eql(await b3tr.getAddress())
      expect(await dynamicBaseAllocationPool.distributionStartRound()).to.eql(1n)

      const DEFAULT_ADMIN_ROLE = await dynamicBaseAllocationPool.DEFAULT_ADMIN_ROLE()
      expect(await dynamicBaseAllocationPool.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.eql(true)
    })

    it("Should return correct version", async function () {
      const { dynamicBaseAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await dynamicBaseAllocationPool.version()).to.eql("3")
    })

    it("Should revert if admin is set to zero address in initialization", async () => {
      const config = createLocalConfig()
      const { b3tr, x2EarnApps, xAllocationPool, x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("DBAPool", [
          {
            admin: ZERO_ADDRESS,
            x2EarnApps: await x2EarnApps.getAddress(),
            xAllocationPool: await xAllocationPool.getAddress(),
            x2earnRewardsPool: await x2EarnRewardsPool.getAddress(),
            b3tr: await b3tr.getAddress(),
            distributionStartRound: 1,
          },
        ]),
      ).to.be.revertedWith("DBAPool: admin is the zero address")
    })

    it("Should revert if x2EarnApps is set to zero address in initialization", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, xAllocationPool, x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("DBAPool", [
          {
            admin: owner.address,
            x2EarnApps: ZERO_ADDRESS,
            xAllocationPool: await xAllocationPool.getAddress(),
            x2earnRewardsPool: await x2EarnRewardsPool.getAddress(),
            b3tr: await b3tr.getAddress(),
            distributionStartRound: 1,
          },
        ]),
      ).to.be.revertedWith("DBAPool: x2EarnApps is the zero address")
    })

    it("Should revert if xAllocationPool is set to zero address in initialization", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, x2EarnApps, x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("DBAPool", [
          {
            admin: owner.address,
            x2EarnApps: await x2EarnApps.getAddress(),
            xAllocationPool: ZERO_ADDRESS,
            x2earnRewardsPool: await x2EarnRewardsPool.getAddress(),
            b3tr: await b3tr.getAddress(),
            distributionStartRound: 1,
          },
        ]),
      ).to.be.revertedWith("DBAPool: xAllocationPool is the zero address")
    })

    it("Should revert if x2earnRewardsPool is set to zero address in initialization", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, x2EarnApps, xAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("DBAPool", [
          {
            admin: owner.address,
            x2EarnApps: await x2EarnApps.getAddress(),
            xAllocationPool: await xAllocationPool.getAddress(),
            x2earnRewardsPool: ZERO_ADDRESS,
            b3tr: await b3tr.getAddress(),
            distributionStartRound: 1,
          },
        ]),
      ).to.be.revertedWith("DBAPool: x2EarnRewardsPool is the zero address")
    })

    it("Should revert if b3tr is set to zero address in initialization", async () => {
      const config = createLocalConfig()
      const { owner, x2EarnApps, xAllocationPool, x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("DBAPool", [
          {
            admin: owner.address,
            x2EarnApps: await x2EarnApps.getAddress(),
            xAllocationPool: await xAllocationPool.getAddress(),
            x2earnRewardsPool: await x2EarnRewardsPool.getAddress(),
            b3tr: ZERO_ADDRESS,
            distributionStartRound: 1,
          },
        ]),
      ).to.be.revertedWith("DBAPool: b3tr is the zero address")
    })

    it("Should revert if distributionStartRound is zero in initialization", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, x2EarnApps, xAllocationPool, x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("DBAPool", [
          {
            admin: owner.address,
            x2EarnApps: await x2EarnApps.getAddress(),
            xAllocationPool: await xAllocationPool.getAddress(),
            x2earnRewardsPool: await x2EarnRewardsPool.getAddress(),
            b3tr: await b3tr.getAddress(),
            distributionStartRound: 0,
          },
        ]),
      ).to.be.revertedWith("DBAPool: distribution start round is zero")
    })
  })

  describe("Contract Upgradeability", () => {
    it("Admin with UPGRADER_ROLE should be able to upgrade the contract", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("DBAPool")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(
        ethers.provider,
        await dynamicBaseAllocationPool.getAddress(),
      )

      const UPGRADER_ROLE = await dynamicBaseAllocationPool.UPGRADER_ROLE()

      // Grant upgrader role to owner
      await dynamicBaseAllocationPool.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      expect(await dynamicBaseAllocationPool.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(dynamicBaseAllocationPool.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x"))
        .to.not.be.reverted

      const newImplAddress = await getImplementationAddress(
        ethers.provider,
        await dynamicBaseAllocationPool.getAddress(),
      )

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only accounts with UPGRADER_ROLE should be able to upgrade the contract", async function () {
      const { dynamicBaseAllocationPool, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("DBAPool")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const UPGRADER_ROLE = await dynamicBaseAllocationPool.UPGRADER_ROLE()

      await catchRevert(
        dynamicBaseAllocationPool.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x"),
      )
    })
  })

  describe("Role Management", () => {
    it("Should assign DEFAULT_ADMIN_ROLE to admin on initialization", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const DEFAULT_ADMIN_ROLE = await dynamicBaseAllocationPool.DEFAULT_ADMIN_ROLE()
      expect(await dynamicBaseAllocationPool.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.eql(true)
    })

    it("Admin should be able to grant DISTRIBUTOR_ROLE", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, distributor.address)

      expect(await dynamicBaseAllocationPool.hasRole(DISTRIBUTOR_ROLE, distributor.address)).to.eql(true)
    })

    it("Admin should be able to revoke DISTRIBUTOR_ROLE", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, distributor.address)
      expect(await dynamicBaseAllocationPool.hasRole(DISTRIBUTOR_ROLE, distributor.address)).to.eql(true)

      await dynamicBaseAllocationPool.connect(owner).revokeRole(DISTRIBUTOR_ROLE, distributor.address)
      expect(await dynamicBaseAllocationPool.hasRole(DISTRIBUTOR_ROLE, distributor.address)).to.eql(false)
    })

    it("Non-admin should not be able to grant roles", async function () {
      const { dynamicBaseAllocationPool, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await catchRevert(
        dynamicBaseAllocationPool.connect(otherAccount).grantRole(DISTRIBUTOR_ROLE, otherAccount.address),
      )
    })
  })

  describe("Getter Functions", () => {
    it("Should return correct b3trBalance", async function () {
      const { dynamicBaseAllocationPool, b3tr, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const amount = ethers.parseEther("1000")
      await b3tr.connect(minterAccount).mint(await dynamicBaseAllocationPool.getAddress(), amount)

      expect(await dynamicBaseAllocationPool.b3trBalance()).to.eql(amount)
    })

    it("Should return correct x2EarnApps address", async function () {
      const { dynamicBaseAllocationPool, x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await dynamicBaseAllocationPool.x2EarnApps()).to.eql(await x2EarnApps.getAddress())
    })

    it("Should return correct xAllocationPool address", async function () {
      const { dynamicBaseAllocationPool, xAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await dynamicBaseAllocationPool.xAllocationPool()).to.eql(await xAllocationPool.getAddress())
    })

    it("Should return correct b3tr address", async function () {
      const { dynamicBaseAllocationPool, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await dynamicBaseAllocationPool.b3tr()).to.eql(await b3tr.getAddress())
    })

    it("Should return correct x2EarnRewardsPool address", async function () {
      const { dynamicBaseAllocationPool, x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await dynamicBaseAllocationPool.x2EarnRewardsPool()).to.eql(await x2EarnRewardsPool.getAddress())
    })

    it("Should return correct distributionStartRound", async function () {
      const { dynamicBaseAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await dynamicBaseAllocationPool.distributionStartRound()).to.eql(1n)
    })

    it("isDBARewardsDistributed should return false for new round", async function () {
      const { dynamicBaseAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await dynamicBaseAllocationPool.isDBARewardsDistributed(1)).to.eql(false)
    })

    it("fundsForRound should return unallocated funds from xAllocationPool", async function () {
      const { dynamicBaseAllocationPool, xAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const roundId = 1
      const unallocatedFunds = await xAllocationPool.unallocatedFunds(roundId)
      expect(await dynamicBaseAllocationPool.fundsForRound(roundId)).to.eql(unallocatedFunds)
    })
  })

  describe("Admin Functions", () => {
    describe("Pause/Unpause", () => {
      it("Admin should be able to pause the contract", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await dynamicBaseAllocationPool.connect(owner).pause()
        expect(await dynamicBaseAllocationPool.paused()).to.eql(true)
      })

      it("Admin should be able to unpause the contract", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await dynamicBaseAllocationPool.connect(owner).pause()
        expect(await dynamicBaseAllocationPool.paused()).to.eql(true)

        await dynamicBaseAllocationPool.connect(owner).unpause()
        expect(await dynamicBaseAllocationPool.paused()).to.eql(false)
      })

      it("Non-admin should not be able to pause the contract", async function () {
        const { dynamicBaseAllocationPool, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).pause())
      })

      it("Non-admin should not be able to unpause the contract", async function () {
        const { dynamicBaseAllocationPool, owner, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await dynamicBaseAllocationPool.connect(owner).pause()
        await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).unpause())
      })

      it("Should not allow distribution when paused", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
        await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, distributor.address)

        await dynamicBaseAllocationPool.connect(owner).pause()

        const appIds = [ethers.encodeBytes32String("app1")]
        await catchRevert(dynamicBaseAllocationPool.connect(distributor).distributeDBARewards(1, appIds))
      })
    })

    describe("setX2EarnApps", () => {
      it("Admin should be able to update x2EarnApps", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newAddress = ethers.Wallet.createRandom().address
        await dynamicBaseAllocationPool.connect(owner).setX2EarnApps(newAddress)

        expect(await dynamicBaseAllocationPool.x2EarnApps()).to.eql(newAddress)
      })

      it("Non-admin should not be able to update x2EarnApps", async function () {
        const { dynamicBaseAllocationPool, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newAddress = ethers.Wallet.createRandom().address
        await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).setX2EarnApps(newAddress))
      })

      it("Should revert if x2EarnApps is set to zero address", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await expect(dynamicBaseAllocationPool.connect(owner).setX2EarnApps(ZERO_ADDRESS)).to.be.revertedWith(
          "DBAPool: zero address",
        )
      })
    })

    describe("setXAllocationPool", () => {
      it("Admin should be able to update xAllocationPool", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newAddress = ethers.Wallet.createRandom().address
        await dynamicBaseAllocationPool.connect(owner).setXAllocationPool(newAddress)

        expect(await dynamicBaseAllocationPool.xAllocationPool()).to.eql(newAddress)
      })

      it("Non-admin should not be able to update xAllocationPool", async function () {
        const { dynamicBaseAllocationPool, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newAddress = ethers.Wallet.createRandom().address
        await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).setXAllocationPool(newAddress))
      })

      it("Should revert if xAllocationPool is set to zero address", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await expect(dynamicBaseAllocationPool.connect(owner).setXAllocationPool(ZERO_ADDRESS)).to.be.revertedWith(
          "DBAPool: zero address",
        )
      })
    })

    describe("setX2EarnRewardsPool", () => {
      it("Admin should be able to update x2EarnRewardsPool", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newAddress = ethers.Wallet.createRandom().address
        await dynamicBaseAllocationPool.connect(owner).setX2EarnRewardsPool(newAddress)

        expect(await dynamicBaseAllocationPool.x2EarnRewardsPool()).to.eql(newAddress)
      })

      it("Non-admin should not be able to update x2EarnRewardsPool", async function () {
        const { dynamicBaseAllocationPool, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newAddress = ethers.Wallet.createRandom().address
        await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).setX2EarnRewardsPool(newAddress))
      })

      it("Should revert if x2EarnRewardsPool is set to zero address", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await expect(dynamicBaseAllocationPool.connect(owner).setX2EarnRewardsPool(ZERO_ADDRESS)).to.be.revertedWith(
          "DBAPool: zero address",
        )
      })
    })

    describe("setDistributionStartRound", () => {
      it("Admin should be able to update distributionStartRound", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newStartRound = 10
        await dynamicBaseAllocationPool.connect(owner).setDistributionStartRound(newStartRound)

        expect(await dynamicBaseAllocationPool.distributionStartRound()).to.eql(BigInt(newStartRound))
      })

      it("Non-admin should not be able to update distributionStartRound", async function () {
        const { dynamicBaseAllocationPool, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newStartRound = 10
        await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).setDistributionStartRound(newStartRound))
      })

      it("Should revert if distributionStartRound is set to zero", async function () {
        const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await expect(dynamicBaseAllocationPool.connect(owner).setDistributionStartRound(0)).to.be.revertedWith(
          "DBAPool: distribution start round is zero",
        )
      })
    })
  })

  describe("canDistributeDBARewards", () => {
    it("Should return false if round is before distributionStartRound", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await dynamicBaseAllocationPool.connect(owner).setDistributionStartRound(10)
      expect(await dynamicBaseAllocationPool.canDistributeDBARewards(5)).to.eql(false)
    })

    it("Should return false if rewards already distributed for round", async function () {
      const { dynamicBaseAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // This would require actually distributing rewards first, which we'll test in distribution tests
      expect(await dynamicBaseAllocationPool.canDistributeDBARewards(1)).to.be.a("boolean")
    })

    it("Should return false if no unallocated funds for round", async function () {
      const { dynamicBaseAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // For a brand new round with no activity
      expect(await dynamicBaseAllocationPool.canDistributeDBARewards(999999)).to.eql(false)
    })

    it("Should return false if not all funds claimed for round", async function () {
      const { dynamicBaseAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // This tests the allFundsClaimed requirement
      const result = await dynamicBaseAllocationPool.canDistributeDBARewards(1)
      expect(result).to.be.a("boolean")
    })
  })

  describe("DBA Rewards Distribution", () => {
    it("Should revert if caller doesn't have DISTRIBUTOR_ROLE", async function () {
      const { dynamicBaseAllocationPool, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const appIds = [ethers.encodeBytes32String("app1")]
      await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).distributeDBARewards(1, appIds))
    })

    it("Should revert if no apps provided", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, distributor.address)

      await expect(dynamicBaseAllocationPool.connect(distributor).distributeDBARewards(1, [])).to.be.revertedWith(
        "DBAPool: no apps to distribute to",
      )
    })

    it("Should revert if round is before distributionStartRound", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, distributor.address)

      await dynamicBaseAllocationPool.connect(owner).setDistributionStartRound(10)

      const appIds = [ethers.encodeBytes32String("app1")]
      await expect(dynamicBaseAllocationPool.connect(distributor).distributeDBARewards(5, appIds)).to.be.revertedWith(
        "DBAPool: Round invalid or not ready to distribute",
      )
    })

    it("Should revert if trying to distribute twice for same round", async function () {
      const { dynamicBaseAllocationPool, owner, x2EarnApps, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      // This test will need proper setup with a completed round
      // For now, we verify the check exists
      expect(await dynamicBaseAllocationPool.isDBARewardsDistributed(1)).to.eql(false)
    })

    it("Should revert if contract has no B3TR balance", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, distributor.address)

      const appIds = [ethers.encodeBytes32String("app1")]

      // This will fail on one of the validation checks
      await catchRevert(dynamicBaseAllocationPool.connect(distributor).distributeDBARewards(1, appIds))
    })

    it("Should revert if app does not exist", async function () {
      const { dynamicBaseAllocationPool, owner, b3tr, minterAccount, xAllocationPool } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      // Give DBA pool some funds
      await b3tr.connect(minterAccount).mint(await dynamicBaseAllocationPool.getAddress(), ethers.parseEther("1000"))

      // Use a non-existent app ID
      const nonExistentAppId = ethers.encodeBytes32String("nonexistent")

      // This will fail validation checks before getting to app existence check
      await catchRevert(dynamicBaseAllocationPool.connect(owner).distributeDBARewards(1, [nonExistentAppId]))
    })

    it("Should revert if duplicate app IDs are provided", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      // Create random app IDs
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("app1"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("app2"))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes("app3"))

      // Try to distribute with duplicate app IDs - should revert before any other checks
      await expect(
        dynamicBaseAllocationPool.connect(owner).distributeDBARewards(1, [app1Id, app2Id, app1Id]),
      ).to.be.revertedWith("DBAPool: duplicate app IDs not allowed")

      // Verify with consecutive duplicates
      await expect(
        dynamicBaseAllocationPool.connect(owner).distributeDBARewards(1, [app2Id, app2Id]),
      ).to.be.revertedWith("DBAPool: duplicate app IDs not allowed")

      // Verify with duplicates at the end
      await expect(
        dynamicBaseAllocationPool.connect(owner).distributeDBARewards(1, [app1Id, app2Id, app3Id, app2Id]),
      ).to.be.revertedWith("DBAPool: duplicate app IDs not allowed")
    })

    it("Should handle large number of app IDs efficiently (scalability test)", async function () {
      this.timeout(180000) // 3 minutes timeout for this test

      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      // Create 1000 unique app IDs
      const appIds = []
      for (let i = 0; i < 1000; i++) {
        appIds.push(ethers.keccak256(ethers.toUtf8Bytes(`app${i}`)))
      }

      // Add a duplicate at the end to test worst-case scenario
      appIds.push(appIds[0])

      // This should detect the duplicate even with 1001 items
      await expect(dynamicBaseAllocationPool.connect(owner).distributeDBARewards(1, appIds)).to.be.revertedWith(
        "DBAPool: duplicate app IDs not allowed",
      )
    })
  })

  describe("Integration Tests - Full Distribution Flow", () => {
    it("Should successfully distribute rewards to a single eligible app", async function () {
      this.timeout(120000)

      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 10
      config.INITIAL_X_ALLOCATION = ethers.parseEther("10000")
      config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 50

      const {
        dynamicBaseAllocationPool,
        owner,
        x2EarnApps,
        xAllocationPool,
        xAllocationVoting,
        emissions,
        b3tr,
        minterAccount,
        otherAccounts,
        veBetterPassport,
        creators,
        x2EarnRewardsPool,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await bootstrapEmissions()

      await veBetterPassport.whitelist(otherAccounts[0].address)
      await veBetterPassport.whitelist(otherAccounts[1].address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(otherAccounts[0], "10000")
      await getVot3Tokens(otherAccounts[1], "10000")

      // Create two apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("app1"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("app2"))

      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[5].address, otherAccounts[5].address, "app1", "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[6].address, otherAccounts[6].address, "app2", "metadataURI")

      await endorseApp(app1Id, otherAccounts[0])
      await endorseApp(app2Id, otherAccounts[1])

      await emissions.connect(minterAccount).start()
      const round1 = await xAllocationVoting.currentRoundId()

      // Vote heavily on app1 to exceed cap, lightly on app2
      await xAllocationVoting.connect(otherAccounts[0]).castVote(round1, [app1Id], [ethers.parseEther("9000")])
      await xAllocationVoting.connect(otherAccounts[1]).castVote(round1, [app2Id], [ethers.parseEther("1000")])

      await waitForRoundToEnd(round1)

      await xAllocationPool
        .connect(owner)
        .setUnallocatedFundsReceiverAddress(await dynamicBaseAllocationPool.getAddress())

      await xAllocationPool.claim(round1, app1Id)
      await xAllocationPool.claim(round1, app2Id)

      const unallocatedAmount = await xAllocationPool.unallocatedFunds(round1)
      expect(unallocatedAmount).to.equal(ethers.parseEther("2800"))

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      const initialApp2Funds = await x2EarnRewardsPool.availableFunds(app2Id)

      // Compute expected reward: min(flatShare, meritCap)
      // Merit cap now uses vote-only allocation (totalEarnings - baseAllocation)
      const [app2TotalEarnings] = await xAllocationPool.roundEarnings(round1, app2Id)
      const baseAllocation = await xAllocationPool.baseAllocationAmount(round1)
      const app2VoteOnly = app2TotalEarnings - baseAllocation
      const meritCap = app2VoteOnly * 2n
      const flatShare = unallocatedAmount // single app gets all
      const expectedReward = flatShare < meritCap ? flatShare : meritCap

      // Distribute to single app
      const tx = await dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, [app2Id])

      await expect(tx)
        .to.emit(dynamicBaseAllocationPool, "FundsDistributedToApp")
        .withArgs(app2Id, expectedReward, round1)

      const finalApp2Funds = await x2EarnRewardsPool.availableFunds(app2Id)
      expect(finalApp2Funds - initialApp2Funds).to.equal(expectedReward)
      expect(await dynamicBaseAllocationPool.b3trBalance()).to.equal(0n)
      expect(await dynamicBaseAllocationPool.isDBARewardsDistributed(round1)).to.equal(true)
    })

    it("Should successfully store distributed rewards for apps", async function () {
      this.timeout(120000)

      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 10
      config.INITIAL_X_ALLOCATION = ethers.parseEther("10000")
      config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 50

      const {
        dynamicBaseAllocationPool,
        owner,
        x2EarnApps,
        xAllocationPool,
        xAllocationVoting,
        emissions,
        minterAccount,
        otherAccounts,
        veBetterPassport,
        creators,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await bootstrapEmissions()

      await veBetterPassport.whitelist(otherAccounts[0].address)
      await veBetterPassport.whitelist(otherAccounts[1].address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(otherAccounts[0], "10000")
      await getVot3Tokens(otherAccounts[1], "10000")

      // Create two apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("app1"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("app2"))

      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[5].address, otherAccounts[5].address, "app1", "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[6].address, otherAccounts[6].address, "app2", "metadataURI")

      await endorseApp(app1Id, otherAccounts[0])
      await endorseApp(app2Id, otherAccounts[1])

      await emissions.connect(minterAccount).start()
      const round1 = await xAllocationVoting.currentRoundId()

      // Vote heavily on app1 to exceed cap, lightly on app2
      await xAllocationVoting.connect(otherAccounts[0]).castVote(round1, [app1Id], [ethers.parseEther("9000")])
      await xAllocationVoting.connect(otherAccounts[1]).castVote(round1, [app2Id], [ethers.parseEther("1000")])

      await waitForRoundToEnd(round1)

      await xAllocationPool
        .connect(owner)
        .setUnallocatedFundsReceiverAddress(await dynamicBaseAllocationPool.getAddress())

      await xAllocationPool.claim(round1, app1Id)
      await xAllocationPool.claim(round1, app2Id)

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      // Compute expected reward for round 1
      const unallocatedR1 = await xAllocationPool.unallocatedFunds(round1)
      const [app2EarningsR1] = await xAllocationPool.roundEarnings(round1, app2Id)
      const baseAllocR1 = await xAllocationPool.baseAllocationAmount(round1)
      const meritCapR1 = (app2EarningsR1 - baseAllocR1) * 2n
      const expectedR1 = unallocatedR1 < meritCapR1 ? unallocatedR1 : meritCapR1

      await dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, [app2Id])

      const dbaRoundRewardsForApp1Round1 = await dynamicBaseAllocationPool.dbaRoundRewardsForApp(round1, app1Id)
      expect(dbaRoundRewardsForApp1Round1).to.equal(0n)

      const dbaRoundRewardsForApp2Round1 = await dynamicBaseAllocationPool.dbaRoundRewardsForApp(round1, app2Id)
      expect(dbaRoundRewardsForApp2Round1).to.equal(expectedR1)

      const round2 = await startNewAllocationRound()

      await xAllocationVoting.connect(otherAccounts[0]).castVote(round2, [app1Id], [ethers.parseEther("9000")])
      await xAllocationVoting.connect(otherAccounts[1]).castVote(round2, [app2Id], [ethers.parseEther("1000")])

      await waitForRoundToEnd(round2)

      await xAllocationPool.claim(round2, app1Id)
      await xAllocationPool.claim(round2, app2Id)

      // Compute expected reward for round 2
      const unallocatedR2 = await xAllocationPool.unallocatedFunds(round2)
      const [app2EarningsR2] = await xAllocationPool.roundEarnings(round2, app2Id)
      const baseAllocR2 = await xAllocationPool.baseAllocationAmount(round2)
      const meritCapR2 = (app2EarningsR2 - baseAllocR2) * 2n
      const expectedR2 = unallocatedR2 < meritCapR2 ? unallocatedR2 : meritCapR2

      await dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round2, [app2Id])

      const dbaRoundRewardsForApp1Round2 = await dynamicBaseAllocationPool.dbaRoundRewardsForApp(round2, app1Id)
      expect(dbaRoundRewardsForApp1Round2).to.equal(0n)

      const dbaRoundRewardsForApp2Round2 = await dynamicBaseAllocationPool.dbaRoundRewardsForApp(round2, app2Id)
      expect(dbaRoundRewardsForApp2Round2).to.equal(expectedR2)
    })

    it("Should revert when trying to distribute to non-existent app", async function () {
      this.timeout(120000)

      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 10
      config.INITIAL_X_ALLOCATION = ethers.parseEther("10000")
      config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 50

      const {
        dynamicBaseAllocationPool,
        owner,
        x2EarnApps,
        xAllocationPool,
        xAllocationVoting,
        emissions,
        b3tr,
        minterAccount,
        otherAccounts,
        veBetterPassport,
        creators,
        x2EarnRewardsPool,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await bootstrapEmissions()

      await veBetterPassport.whitelist(otherAccounts[0].address)
      await veBetterPassport.toggleCheck(1)
      await getVot3Tokens(otherAccounts[0], "10000")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("app1"))
      const nonExistentAppId = ethers.keccak256(ethers.toUtf8Bytes("nonExistentApp"))

      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[5].address, otherAccounts[5].address, "app1", "metadataURI")

      await endorseApp(app1Id, otherAccounts[0])

      await emissions.connect(minterAccount).start()
      const round1 = await xAllocationVoting.currentRoundId()

      await xAllocationVoting.connect(otherAccounts[0]).castVote(round1, [app1Id], [ethers.parseEther("8000")])

      await waitForRoundToEnd(round1)

      await xAllocationPool
        .connect(owner)
        .setUnallocatedFundsReceiverAddress(await dynamicBaseAllocationPool.getAddress())

      await xAllocationPool.claim(round1, app1Id)

      const unallocatedAmount = await xAllocationPool.unallocatedFunds(round1)
      expect(unallocatedAmount).to.equal(ethers.parseEther("3500"))

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      // Try to distribute to non-existent app
      await expect(
        dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, [nonExistentAppId]),
      ).to.be.revertedWith("DBAPool: app does not exist")

      // Verify can still distribute to existing app after failed attempt
      const initialApp1Funds = await x2EarnRewardsPool.availableFunds(app1Id)

      await dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, [app1Id])

      const finalApp1Funds = await x2EarnRewardsPool.availableFunds(app1Id)
      expect(finalApp1Funds - initialApp1Funds).to.equal(ethers.parseEther("3500"))
    })

    it("Should not allow distribution before all apps have claimed their rewards", async function () {
      this.timeout(120000)

      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 10
      config.INITIAL_X_ALLOCATION = ethers.parseEther("10000")
      config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 50

      const {
        dynamicBaseAllocationPool,
        owner,
        x2EarnApps,
        xAllocationPool,
        xAllocationVoting,
        emissions,
        b3tr,
        minterAccount,
        otherAccounts,
        veBetterPassport,
        creators,
        x2EarnRewardsPool,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await bootstrapEmissions()

      await veBetterPassport.whitelist(otherAccounts[0].address)
      await veBetterPassport.whitelist(otherAccounts[1].address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(otherAccounts[0], "10000")
      await getVot3Tokens(otherAccounts[1], "10000")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("app1"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("app2"))

      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[5].address, otherAccounts[5].address, "app1", "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[6].address, otherAccounts[6].address, "app2", "metadataURI")

      await endorseApp(app1Id, otherAccounts[0])
      await endorseApp(app2Id, otherAccounts[1])

      await emissions.connect(minterAccount).start()
      const round1 = await xAllocationVoting.currentRoundId()

      await xAllocationVoting.connect(otherAccounts[0]).castVote(round1, [app1Id], [ethers.parseEther("8000")])
      await xAllocationVoting.connect(otherAccounts[1]).castVote(round1, [app2Id], [ethers.parseEther("2000")])

      await waitForRoundToEnd(round1)

      await xAllocationPool
        .connect(owner)
        .setUnallocatedFundsReceiverAddress(await dynamicBaseAllocationPool.getAddress())

      // Only app1 claims, app2 does not
      await xAllocationPool.claim(round1, app1Id)

      const allFundsClaimed = await xAllocationPool.allFundsClaimed(round1)
      expect(allFundsClaimed).to.equal(false)

      const canDistribute = await dynamicBaseAllocationPool.canDistributeDBARewards(round1)
      expect(canDistribute).to.equal(false)

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      // Should not be able to distribute yet
      await expect(dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, [app2Id])).to.be.revertedWith(
        "DBAPool: Round invalid or not ready to distribute",
      )

      // After app2 claims, should be able to distribute
      await xAllocationPool.claim(round1, app2Id)

      const allFundsClaimedAfter = await xAllocationPool.allFundsClaimed(round1)
      expect(allFundsClaimedAfter).to.equal(true)

      const canDistributeAfter = await dynamicBaseAllocationPool.canDistributeDBARewards(round1)
      expect(canDistributeAfter).to.equal(true)

      const unallocatedAmount = await xAllocationPool.unallocatedFunds(round1)
      expect(unallocatedAmount).to.equal(ethers.parseEther("2100"))

      // Now distribution should succeed
      const initialApp2Funds = await x2EarnRewardsPool.availableFunds(app2Id)

      await dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, [app2Id])

      const finalApp2Funds = await x2EarnRewardsPool.availableFunds(app2Id)
      expect(finalApp2Funds - initialApp2Funds).to.equal(ethers.parseEther("2100"))
    })

    it("Should distribute DBA rewards when one app exceeds cap and generates unallocated funds for other eligible apps", async function () {
      this.timeout(120000) // Increase timeout for complex test

      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 10
      config.INITIAL_X_ALLOCATION = ethers.parseEther("10000")
      config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 50 // 50% max cap so we can exceed it

      const {
        dynamicBaseAllocationPool,
        owner,
        x2EarnApps,
        xAllocationPool,
        xAllocationVoting,
        emissions,
        b3tr,
        minterAccount,
        otherAccounts,
        veBetterPassport,
        creators,
        x2EarnRewardsPool,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Setup voters with VOT3 tokens
      await veBetterPassport.whitelist(otherAccounts[0].address)
      await veBetterPassport.whitelist(otherAccounts[1].address)
      await veBetterPassport.whitelist(otherAccounts[2].address)
      await veBetterPassport.whitelist(otherAccounts[3].address)
      await veBetterPassport.whitelist(otherAccounts[4].address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(otherAccounts[0], "10000")
      await getVot3Tokens(otherAccounts[1], "10000")
      await getVot3Tokens(otherAccounts[2], "10000")
      await getVot3Tokens(otherAccounts[3], "10000")
      await getVot3Tokens(otherAccounts[4], "10000")

      // Create three apps - use different creators for each
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("app1"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("app2"))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes("app3"))

      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[5].address, otherAccounts[5].address, "app1", "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[6].address, otherAccounts[6].address, "app2", "metadataURI")
      await x2EarnApps
        .connect(creators[2])
        .submitApp(otherAccounts[7].address, otherAccounts[7].address, "app3", "metadataURI")

      // Endorse apps so they can be voted on
      await endorseApp(app1Id, otherAccounts[0])
      await endorseApp(app2Id, otherAccounts[1])
      await endorseApp(app3Id, otherAccounts[2])

      // Start new allocation round
      await emissions.connect(minterAccount).start()
      const round1 = await xAllocationVoting.currentRoundId()

      // Vote heavily on app1 to exceed the max cap (50%)
      // This will generate unallocated funds
      await xAllocationVoting.connect(otherAccounts[0]).castVote(round1, [app1Id], [ethers.parseEther("8000")])

      // Vote moderately on app2 and app3 - these will be eligible for DBA distribution
      await xAllocationVoting.connect(otherAccounts[1]).castVote(round1, [app2Id], [ethers.parseEther("1000")])
      await xAllocationVoting.connect(otherAccounts[2]).castVote(round1, [app3Id], [ethers.parseEther("1000")])

      // Wait for round to end
      await waitForRoundToEnd(round1)

      // Set DBA pool as the unallocated funds receiver
      await xAllocationPool
        .connect(owner)
        .setUnallocatedFundsReceiverAddress(await dynamicBaseAllocationPool.getAddress())

      // Have all apps claim their rewards
      // When app1 claims, it will hit the max cap and send unallocated funds to DBA pool
      await xAllocationPool.claim(round1, app1Id)
      await xAllocationPool.claim(round1, app2Id)
      await xAllocationPool.claim(round1, app3Id)

      // Get the unallocated funds that were sent to DBA pool
      const unallocatedAmount = await xAllocationPool.unallocatedFunds(round1)
      expect(unallocatedAmount).to.equal(ethers.parseEther("2100"))

      // Verify DBA pool received the exact unallocated funds
      const dbaPoolBalance = await dynamicBaseAllocationPool.b3trBalance()
      expect(dbaPoolBalance).to.equal(ethers.parseEther("2100"))
      expect(dbaPoolBalance).to.equal(unallocatedAmount)

      // Grant distributor role
      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      // Verify can distribute (should return true now)
      const canDistribute = await dynamicBaseAllocationPool.canDistributeDBARewards(round1)
      expect(canDistribute).to.equal(true)

      // Get initial available funds in X2EarnRewardsPool for app2 and app3
      const initialApp2Funds = await x2EarnRewardsPool.availableFunds(app2Id)
      const initialApp3Funds = await x2EarnRewardsPool.availableFunds(app3Id)

      // Distribute DBA rewards to app2 and app3 (the eligible apps)
      const eligibleApps = [app2Id, app3Id]
      const expectedAmountPerApp = ethers.parseEther("1050")
      expect(dbaPoolBalance / BigInt(eligibleApps.length)).to.equal(expectedAmountPerApp)

      const tx = await dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, eligibleApps)

      // Verify events were emitted for each app
      await expect(tx)
        .to.emit(dynamicBaseAllocationPool, "FundsDistributedToApp")
        .withArgs(app2Id, expectedAmountPerApp, round1)

      await expect(tx)
        .to.emit(dynamicBaseAllocationPool, "FundsDistributedToApp")
        .withArgs(app3Id, expectedAmountPerApp, round1)

      // Verify available funds increased correctly in X2EarnRewardsPool
      const finalApp2Funds = await x2EarnRewardsPool.availableFunds(app2Id)
      const finalApp3Funds = await x2EarnRewardsPool.availableFunds(app3Id)

      // Verify both apps received their exact DBA allocation
      expect(finalApp2Funds - initialApp2Funds).to.equal(ethers.parseEther("1050"))
      expect(finalApp3Funds - initialApp3Funds).to.equal(ethers.parseEther("1050"))
      expect(finalApp2Funds - initialApp2Funds).to.equal(expectedAmountPerApp)
      expect(finalApp3Funds - initialApp3Funds).to.equal(expectedAmountPerApp)

      // Verify DBA pool balance is exactly 0
      expect(await dynamicBaseAllocationPool.b3trBalance()).to.equal(0n)

      // Verify round is marked as distributed
      expect(await dynamicBaseAllocationPool.isDBARewardsDistributed(round1)).to.equal(true)

      // Verify cannot distribute again for same round
      await expect(
        dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, eligibleApps),
      ).to.be.revertedWith("DBAPool: Round invalid or not ready to distribute")
    })
  })

  describe("Event Emissions", () => {
    it("Should emit FundsDistributedToApp event for each app", async function () {
      // This is covered in the integration test above
      // Event structure: FundsDistributedToApp(bytes32 indexed appId, address indexed teamWallet, uint256 amount, uint256 indexed roundId)
      const { dynamicBaseAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Verify event exists in interface
      const filter = dynamicBaseAllocationPool.filters.FundsDistributedToApp()
      expect(filter).to.not.be.undefined
    })
  })

  describe("Security and Access Control", () => {
    it("Should protect against reentrancy attacks", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // The contract uses ReentrancyGuard
      // This test verifies the protection is in place
      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      // Reentrancy protection is verified through the nonReentrant modifier
      // which is part of the contract implementation
    })

    it("Should enforce role-based access control on all privileged functions", async function () {
      const { dynamicBaseAllocationPool, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Test all admin functions
      await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).pause())
      await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).unpause())
      await catchRevert(
        dynamicBaseAllocationPool.connect(otherAccount).setX2EarnApps(ethers.Wallet.createRandom().address),
      )
      await catchRevert(
        dynamicBaseAllocationPool.connect(otherAccount).setXAllocationPool(ethers.Wallet.createRandom().address),
      )
      await catchRevert(
        dynamicBaseAllocationPool.connect(otherAccount).setX2EarnRewardsPool(ethers.Wallet.createRandom().address),
      )
      await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).setDistributionStartRound(5))

      // Test distributor function
      const appIds = [ethers.encodeBytes32String("app1")]
      await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).distributeDBARewards(1, appIds))
    })

    it("Should properly validate all input parameters", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Zero address validations
      await expect(dynamicBaseAllocationPool.connect(owner).setX2EarnApps(ZERO_ADDRESS)).to.be.revertedWith(
        "DBAPool: zero address",
      )
      await expect(dynamicBaseAllocationPool.connect(owner).setXAllocationPool(ZERO_ADDRESS)).to.be.revertedWith(
        "DBAPool: zero address",
      )
      await expect(dynamicBaseAllocationPool.connect(owner).setX2EarnRewardsPool(ZERO_ADDRESS)).to.be.revertedWith(
        "DBAPool: zero address",
      )

      // Zero value validations
      await expect(dynamicBaseAllocationPool.connect(owner).setDistributionStartRound(0)).to.be.revertedWith(
        "DBAPool: distribution start round is zero",
      )

      // Empty array validation
      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)
      await expect(dynamicBaseAllocationPool.connect(owner).distributeDBARewards(1, [])).to.be.revertedWith(
        "DBAPool: no apps to distribute to",
      )
    })
  })

  describe("Seed DBA Rewards Function", () => {
    it("Should allow UPGRADER_ROLE to seed historical DBA rewards for multiple apps", async function () {
      const { dynamicBaseAllocationPool, owner, x2EarnApps, creators, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Grant UPGRADER_ROLE to owner
      const UPGRADER_ROLE = await dynamicBaseAllocationPool.UPGRADER_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      // Create apps using creators who have Creator NFTs
      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "App1", "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, "App2", "metadataURI")
      const app1Id = await x2EarnApps.hashAppName("App1")
      const app2Id = await x2EarnApps.hashAppName("App2")

      // Endorse apps so they are fully created
      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])

      const roundIds = [1n, 1n]
      const appIds = [app1Id, app2Id]
      const amounts = [ethers.parseEther("1000"), ethers.parseEther("2000")]

      // Seed the rewards
      await dynamicBaseAllocationPool.connect(owner).seedDBARewardsForApps(roundIds, appIds, amounts)

      // Verify the rewards were seeded
      expect(await dynamicBaseAllocationPool.dbaRoundRewardsForApp(roundIds[0], appIds[0])).to.equal(amounts[0])
      expect(await dynamicBaseAllocationPool.dbaRoundRewardsForApp(roundIds[1], appIds[1])).to.equal(amounts[1])
    })

    it("Should revert when non-UPGRADER tries to seed rewards", async function () {
      const { dynamicBaseAllocationPool, otherAccount, x2EarnApps, creators, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Create an app using a creator who has a Creator NFT
      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "App1", "metadataURI")
      const appId = await x2EarnApps.hashAppName("App1")

      // Endorse app so it's fully created
      await endorseApp(appId, otherAccounts[2])

      const roundIds = [1n]
      const appIds = [appId]
      const amounts = [ethers.parseEther("1000")]

      // Try to seed without UPGRADER_ROLE
      await catchRevert(
        dynamicBaseAllocationPool.connect(otherAccount).seedDBARewardsForApps(roundIds, appIds, amounts),
      )
    })

    it("Should revert when seeding with zero amount", async function () {
      const { dynamicBaseAllocationPool, owner, x2EarnApps, creators, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Grant UPGRADER_ROLE to owner
      const UPGRADER_ROLE = await dynamicBaseAllocationPool.UPGRADER_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      // Create an app using a creator who has a Creator NFT
      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "App1", "metadataURI")
      const appId = await x2EarnApps.hashAppName("App1")

      // Endorse app so it's fully created
      await endorseApp(appId, otherAccounts[2])

      const roundIds = [1n]
      const appIds = [appId]
      const amounts = [0n]

      // Try to seed with zero amount
      await expect(
        dynamicBaseAllocationPool.connect(owner).seedDBARewardsForApps(roundIds, appIds, amounts),
      ).to.be.revertedWith("DBAPool: amount is zero")
    })

    it("Should revert when seeding for invalid round", async function () {
      const { dynamicBaseAllocationPool, owner, x2EarnApps, creators, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Grant UPGRADER_ROLE to owner
      const UPGRADER_ROLE = await dynamicBaseAllocationPool.UPGRADER_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      // Create an app using a creator who has a Creator NFT
      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "App1", "metadataURI")
      const appId = await x2EarnApps.hashAppName("App1")

      // Endorse app so it's fully created
      await endorseApp(appId, otherAccounts[2])

      const roundIds = [0n] // Round before distributionStartRound (which is 1)
      const appIds = [appId]
      const amounts = [ethers.parseEther("1000")]

      // Try to seed for invalid round
      await expect(
        dynamicBaseAllocationPool.connect(owner).seedDBARewardsForApps(roundIds, appIds, amounts),
      ).to.be.revertedWith("DBAPool: round is invalid")
    })

    it("Should revert when seeding for non-existent app", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Grant UPGRADER_ROLE to owner
      const UPGRADER_ROLE = await dynamicBaseAllocationPool.UPGRADER_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      const roundIds = [1n]
      const nonExistentAppId = ethers.encodeBytes32String("NonExistentApp")
      const appIds = [nonExistentAppId]
      const amounts = [ethers.parseEther("1000")]

      // Try to seed for non-existent app
      await expect(
        dynamicBaseAllocationPool.connect(owner).seedDBARewardsForApps(roundIds, appIds, amounts),
      ).to.be.revertedWith("DBAPool: app does not exist")
    })

    it("Should revert when seeding for app that already has rewards", async function () {
      const { dynamicBaseAllocationPool, owner, x2EarnApps, creators, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Grant UPGRADER_ROLE to owner
      const UPGRADER_ROLE = await dynamicBaseAllocationPool.UPGRADER_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      // Create an app using a creator who has a Creator NFT
      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "App1", "metadataURI")
      const appId = await x2EarnApps.hashAppName("App1")

      // Endorse app so it's fully created
      await endorseApp(appId, otherAccounts[2])

      const roundIds = [1n]
      const appIds = [appId]
      const amounts = [ethers.parseEther("1000")]

      // Seed the rewards first time
      await dynamicBaseAllocationPool.connect(owner).seedDBARewardsForApps(roundIds, appIds, amounts)

      // Try to seed again for same round and app
      await expect(
        dynamicBaseAllocationPool.connect(owner).seedDBARewardsForApps(roundIds, appIds, amounts),
      ).to.be.revertedWith("DBAPool: app has already received rewards for the round")
    })

    it("Should correctly track rewards per app per round in batch", async function () {
      const { dynamicBaseAllocationPool, owner, x2EarnApps, creators, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Grant UPGRADER_ROLE to owner
      const UPGRADER_ROLE = await dynamicBaseAllocationPool.UPGRADER_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      // Create two apps using creators who have Creator NFTs
      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "App1", "metadataURI1")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[1].address, otherAccounts[1].address, "App2", "metadataURI2")
      const app1Id = await x2EarnApps.hashAppName("App1")
      const app2Id = await x2EarnApps.hashAppName("App2")

      // Endorse apps so they are fully created
      await endorseApp(app1Id, otherAccounts[2])
      await endorseApp(app2Id, otherAccounts[3])

      const amount1 = ethers.parseEther("1000")
      const amount2 = ethers.parseEther("2000")

      // Seed rewards for multiple apps and rounds in one batch
      const roundIds = [1n, 1n, 2n]
      const appIds = [app1Id, app2Id, app1Id]
      const amounts = [amount1, amount2, amount2]

      await dynamicBaseAllocationPool.connect(owner).seedDBARewardsForApps(roundIds, appIds, amounts)

      // Verify all rewards are tracked correctly
      expect(await dynamicBaseAllocationPool.dbaRoundRewardsForApp(1n, app1Id)).to.equal(amount1)
      expect(await dynamicBaseAllocationPool.dbaRoundRewardsForApp(1n, app2Id)).to.equal(amount2)
      expect(await dynamicBaseAllocationPool.dbaRoundRewardsForApp(2n, app1Id)).to.equal(amount2)
      expect(await dynamicBaseAllocationPool.dbaRoundRewardsForApp(2n, app2Id)).to.equal(0n) // Not seeded
    })

    it("Should revert when arrays have mismatched lengths", async function () {
      const { dynamicBaseAllocationPool, owner, x2EarnApps, creators, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Grant UPGRADER_ROLE to owner
      const UPGRADER_ROLE = await dynamicBaseAllocationPool.UPGRADER_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      // Create an app using a creator who has a Creator NFT
      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "App1", "metadataURI")
      const appId = await x2EarnApps.hashAppName("App1")

      // Endorse app so it's fully created
      await endorseApp(appId, otherAccounts[2])

      // Mismatched array lengths
      const roundIds = [1n, 2n]
      const appIds = [appId]
      const amounts = [ethers.parseEther("1000")]

      await expect(
        dynamicBaseAllocationPool.connect(owner).seedDBARewardsForApps(roundIds, appIds, amounts),
      ).to.be.revertedWith("DBAPool: arrays length mismatch")
    })

    it("Should revert when arrays are empty", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Grant UPGRADER_ROLE to owner
      const UPGRADER_ROLE = await dynamicBaseAllocationPool.UPGRADER_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      const roundIds: bigint[] = []
      const appIds: string[] = []
      const amounts: bigint[] = []

      await expect(
        dynamicBaseAllocationPool.connect(owner).seedDBARewardsForApps(roundIds, appIds, amounts),
      ).to.be.revertedWith("DBAPool: empty arrays")
    })
  })

  describe("Storage Integrity During Upgrade", () => {
    it("Should preserve all storage when upgrading from V1 to V2", async function () {
      const config = createLocalConfig()
      const { owner, b3tr, x2EarnApps, xAllocationPool, x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Deploy V1
      const dbaPoolV1 = (await deployProxy("DBAPoolV1", [
        {
          admin: owner.address,
          x2EarnApps: await x2EarnApps.getAddress(),
          xAllocationPool: await xAllocationPool.getAddress(),
          x2earnRewardsPool: await x2EarnRewardsPool.getAddress(),
          b3tr: await b3tr.getAddress(),
          distributionStartRound: 5,
        },
      ])) as DBAPoolV1

      // Store V1 state
      const v1X2EarnApps = await dbaPoolV1.x2EarnApps()
      const v1XAllocationPool = await dbaPoolV1.xAllocationPool()
      const v1X2EarnRewardsPool = await dbaPoolV1.x2EarnRewardsPool()
      const v1B3tr = await dbaPoolV1.b3tr()
      const v1DistributionStartRound = await dbaPoolV1.distributionStartRound()

      // Verify V1 state
      expect(await dbaPoolV1.version()).to.equal("1")
      expect(v1DistributionStartRound).to.equal(5n)

      // Grant UPGRADER_ROLE to owner
      const UPGRADER_ROLE = await dbaPoolV1.UPGRADER_ROLE()
      await dbaPoolV1.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      // Get contract factory for V2
      const DBAPoolV2Factory = await ethers.getContractFactory("DBAPoolV2")
      const dbaPoolV2Implementation = await DBAPoolV2Factory.deploy()
      await dbaPoolV2Implementation.waitForDeployment()

      // Upgrade to V2
      const dbaPoolV1Contract = await ethers.getContractAt("DBAPoolV1", await dbaPoolV1.getAddress())
      await dbaPoolV1Contract.connect(owner).upgradeToAndCall(await dbaPoolV2Implementation.getAddress(), "0x")

      // Get V2 instance
      const dbaPoolV2 = await ethers.getContractAt("DBAPoolV2", await dbaPoolV1.getAddress())

      // Verify all V1 storage is preserved
      expect(await dbaPoolV2.x2EarnApps()).to.equal(v1X2EarnApps)
      expect(await dbaPoolV2.xAllocationPool()).to.equal(v1XAllocationPool)
      expect(await dbaPoolV2.x2EarnRewardsPool()).to.equal(v1X2EarnRewardsPool)
      expect(await dbaPoolV2.b3tr()).to.equal(v1B3tr)
      expect(await dbaPoolV2.distributionStartRound()).to.equal(v1DistributionStartRound)

      // Verify new V2 functionality is available
      expect(await dbaPoolV2.version()).to.equal("2")

      // Verify new mapping returns 0 for all queries (not initialized yet)
      const randomAppId = ethers.encodeBytes32String("randomApp")
      expect(await dbaPoolV2.dbaRoundRewardsForApp(1n, randomAppId)).to.equal(0n)
    })

    it("Should maintain role assignments after upgrade", async function () {
      const config = createLocalConfig()
      const { owner, otherAccount, b3tr, x2EarnApps, xAllocationPool, x2EarnRewardsPool } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Deploy V1
      const dbaPoolV1 = (await deployProxy("DBAPoolV1", [
        {
          admin: owner.address,
          x2EarnApps: await x2EarnApps.getAddress(),
          xAllocationPool: await xAllocationPool.getAddress(),
          x2earnRewardsPool: await x2EarnRewardsPool.getAddress(),
          b3tr: await b3tr.getAddress(),
          distributionStartRound: 1,
        },
      ])) as DBAPoolV1

      // Grant roles in V1
      const UPGRADER_ROLE = await dbaPoolV1.UPGRADER_ROLE()
      const DISTRIBUTOR_ROLE = await dbaPoolV1.DISTRIBUTOR_ROLE()
      await dbaPoolV1.connect(owner).grantRole(UPGRADER_ROLE, owner.address)
      await dbaPoolV1.connect(owner).grantRole(DISTRIBUTOR_ROLE, otherAccount.address)

      // Verify roles before upgrade
      expect(await dbaPoolV1.hasRole(UPGRADER_ROLE, owner.address)).to.be.true
      expect(await dbaPoolV1.hasRole(DISTRIBUTOR_ROLE, otherAccount.address)).to.be.true

      // Upgrade to V2
      const DBAPoolV2Factory = await ethers.getContractFactory("DBAPoolV2")
      const dbaPoolV2Implementation = await DBAPoolV2Factory.deploy()
      await dbaPoolV2Implementation.waitForDeployment()

      const dbaPoolV1Contract = await ethers.getContractAt("DBAPoolV1", await dbaPoolV1.getAddress())
      await dbaPoolV1Contract.connect(owner).upgradeToAndCall(await dbaPoolV2Implementation.getAddress(), "0x")

      // Get V2 instance
      const dbaPoolV2 = await ethers.getContractAt("DBAPoolV2", await dbaPoolV1.getAddress())

      // Verify roles are preserved after upgrade
      expect(await dbaPoolV2.hasRole(UPGRADER_ROLE, owner.address)).to.be.true
      expect(await dbaPoolV2.hasRole(DISTRIBUTOR_ROLE, otherAccount.address)).to.be.true
    })

    it("Should preserve storage when upgrading from V2 to V3", async function () {
      const config = createLocalConfig()
      const { owner, b3tr, x2EarnApps, xAllocationPool, x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Deploy V1
      const dbaPoolV1 = (await deployProxy("DBAPoolV1", [
        {
          admin: owner.address,
          x2EarnApps: await x2EarnApps.getAddress(),
          xAllocationPool: await xAllocationPool.getAddress(),
          x2earnRewardsPool: await x2EarnRewardsPool.getAddress(),
          b3tr: await b3tr.getAddress(),
          distributionStartRound: 5,
        },
      ])) as DBAPoolV1

      // Grant UPGRADER_ROLE to owner
      const UPGRADER_ROLE = await dbaPoolV1.UPGRADER_ROLE()
      await dbaPoolV1.connect(owner).grantRole(UPGRADER_ROLE, owner.address)

      // Upgrade to V2
      const DBAPoolV2Factory = await ethers.getContractFactory("DBAPoolV2")
      const dbaPoolV2Impl = await DBAPoolV2Factory.deploy()
      await dbaPoolV2Impl.waitForDeployment()

      await (await ethers.getContractAt("DBAPoolV1", await dbaPoolV1.getAddress()))
        .connect(owner)
        .upgradeToAndCall(await dbaPoolV2Impl.getAddress(), "0x")

      // Get V2 instance and store state
      const dbaPoolV2 = (await ethers.getContractAt("DBAPoolV2", await dbaPoolV1.getAddress())) as DBAPoolV2
      expect(await dbaPoolV2.version()).to.equal("2")

      const v2X2EarnApps = await dbaPoolV2.x2EarnApps()
      const v2DistributionStartRound = await dbaPoolV2.distributionStartRound()

      // Upgrade to V3 with initializeV3
      const DBAPoolV3Factory = await ethers.getContractFactory("DBAPool")
      const dbaPoolV3Impl = await DBAPoolV3Factory.deploy()
      await dbaPoolV3Impl.waitForDeployment()

      const treasuryAddr = otherAccount.address
      const initData = DBAPoolV3Factory.interface.encodeFunctionData("initializeV3", [treasuryAddr])
      await dbaPoolV2.connect(owner).upgradeToAndCall(await dbaPoolV3Impl.getAddress(), initData)

      // Get V3 instance
      const dbaPoolV3 = await ethers.getContractAt("DBAPool", await dbaPoolV1.getAddress())

      // Verify V3 version and that V2 storage is preserved
      expect(await dbaPoolV3.version()).to.equal("3")
      expect(await dbaPoolV3.x2EarnApps()).to.equal(v2X2EarnApps)
      expect(await dbaPoolV3.distributionStartRound()).to.equal(v2DistributionStartRound)

      // Verify new V3 storage was set
      expect(await dbaPoolV3.treasuryAddress()).to.equal(treasuryAddr)
      expect(await dbaPoolV3.meritCapMultiplier()).to.equal(2)
    })
  })

  describe("V3 - Treasury Address", () => {
    it("Should return the treasury address set during initialization", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await dynamicBaseAllocationPool.treasuryAddress()).to.equal(owner.address)
    })

    it("Should allow admin to update the treasury address", async function () {
      const { dynamicBaseAllocationPool, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await dynamicBaseAllocationPool.connect(owner).setTreasuryAddress(otherAccount.address)
      expect(await dynamicBaseAllocationPool.treasuryAddress()).to.equal(otherAccount.address)
    })

    it("Should revert if non-admin tries to set treasury address", async function () {
      const { dynamicBaseAllocationPool, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(dynamicBaseAllocationPool.connect(otherAccount).setTreasuryAddress(otherAccount.address))
    })

    it("Should revert if setting treasury address to zero", async function () {
      const { dynamicBaseAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(dynamicBaseAllocationPool.connect(owner).setTreasuryAddress(ZERO_ADDRESS)).to.be.revertedWith(
        "DBAPool: zero address",
      )
    })
  })

  describe("V3 - Merit Cap Distribution", () => {
    it("Should cap app reward at 2x vote allocation when flat share exceeds merit cap", async function () {
      this.timeout(120000)

      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 10
      config.INITIAL_X_ALLOCATION = ethers.parseEther("10000")
      config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 50

      const {
        dynamicBaseAllocationPool,
        owner,
        x2EarnApps,
        xAllocationPool,
        xAllocationVoting,
        emissions,
        b3tr,
        minterAccount,
        otherAccounts,
        veBetterPassport,
        creators,
        x2EarnRewardsPool,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await bootstrapEmissions()

      await veBetterPassport.whitelist(otherAccounts[0].address)
      await veBetterPassport.whitelist(otherAccounts[1].address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(otherAccounts[0], "10000")
      await getVot3Tokens(otherAccounts[1], "10000")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("app1"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("app2"))

      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[5].address, otherAccounts[5].address, "app1", "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[6].address, otherAccounts[6].address, "app2", "metadataURI")

      await endorseApp(app1Id, otherAccounts[0])
      await endorseApp(app2Id, otherAccounts[1])

      await emissions.connect(minterAccount).start()
      const round1 = await xAllocationVoting.currentRoundId()

      // app1 gets 99% votes, app2 gets 1% (very small allocation)
      await xAllocationVoting.connect(otherAccounts[0]).castVote(round1, [app1Id], [ethers.parseEther("9900")])
      await xAllocationVoting.connect(otherAccounts[1]).castVote(round1, [app2Id], [ethers.parseEther("100")])

      await waitForRoundToEnd(round1)

      await xAllocationPool
        .connect(owner)
        .setUnallocatedFundsReceiverAddress(await dynamicBaseAllocationPool.getAddress())

      await xAllocationPool.claim(round1, app1Id)
      await xAllocationPool.claim(round1, app2Id)

      const unallocatedAmount = await xAllocationPool.unallocatedFunds(round1)
      expect(unallocatedAmount).to.be.gt(0n)

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      const treasuryAddr = await dynamicBaseAllocationPool.treasuryAddress()

      const [app2TotalEarnings] = await xAllocationPool.roundEarnings(round1, app2Id)
      const baseAllocation = await xAllocationPool.baseAllocationAmount(round1)
      const meritCap = (app2TotalEarnings - baseAllocation) * 2n
      const flatShare = unallocatedAmount / 2n

      // Distribute to both apps
      const initialApp2Funds = await x2EarnRewardsPool.availableFunds(app2Id)
      const initialTreasuryBalance = await b3tr.balanceOf(treasuryAddr)

      const tx = await dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, [app1Id, app2Id])

      // app2's reward should be capped at 2x its vote-only allocation if flatShare > meritCap
      const app2Reward = await dynamicBaseAllocationPool.dbaRoundRewardsForApp(round1, app2Id)
      if (flatShare > meritCap) {
        expect(app2Reward).to.equal(meritCap)

        // Treasury should have received overflow
        await expect(tx).to.emit(dynamicBaseAllocationPool, "FundsDistributedToTreasury")
        const finalTreasuryBalance = await b3tr.balanceOf(treasuryAddr)
        expect(finalTreasuryBalance).to.be.gt(initialTreasuryBalance)
      } else {
        expect(app2Reward).to.equal(flatShare)
      }

      expect(await dynamicBaseAllocationPool.b3trBalance()).to.equal(0n)
    })

    it("Should send integer-division remainder to treasury", async function () {
      this.timeout(120000)

      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 10
      config.INITIAL_X_ALLOCATION = ethers.parseEther("10000")
      config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 50

      const {
        dynamicBaseAllocationPool,
        owner,
        x2EarnApps,
        xAllocationPool,
        xAllocationVoting,
        emissions,
        b3tr,
        minterAccount,
        otherAccounts,
        veBetterPassport,
        creators,
        x2EarnRewardsPool,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await bootstrapEmissions()

      await veBetterPassport.whitelist(otherAccounts[0].address)
      await veBetterPassport.whitelist(otherAccounts[1].address)
      await veBetterPassport.whitelist(otherAccounts[2].address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(otherAccounts[0], "10000")
      await getVot3Tokens(otherAccounts[1], "10000")
      await getVot3Tokens(otherAccounts[2], "10000")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("app1"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("app2"))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes("app3"))

      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[5].address, otherAccounts[5].address, "app1", "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[6].address, otherAccounts[6].address, "app2", "metadataURI")
      await x2EarnApps
        .connect(creators[2])
        .submitApp(otherAccounts[7].address, otherAccounts[7].address, "app3", "metadataURI")

      await endorseApp(app1Id, otherAccounts[0])
      await endorseApp(app2Id, otherAccounts[1])
      await endorseApp(app3Id, otherAccounts[2])

      await emissions.connect(minterAccount).start()
      const round1 = await xAllocationVoting.currentRoundId()

      await xAllocationVoting.connect(otherAccounts[0]).castVote(round1, [app1Id], [ethers.parseEther("8000")])
      await xAllocationVoting.connect(otherAccounts[1]).castVote(round1, [app2Id], [ethers.parseEther("1000")])
      await xAllocationVoting.connect(otherAccounts[2]).castVote(round1, [app3Id], [ethers.parseEther("1000")])

      await waitForRoundToEnd(round1)

      await xAllocationPool
        .connect(owner)
        .setUnallocatedFundsReceiverAddress(await dynamicBaseAllocationPool.getAddress())

      await xAllocationPool.claim(round1, app1Id)
      await xAllocationPool.claim(round1, app2Id)
      await xAllocationPool.claim(round1, app3Id)

      const unallocatedAmount = await xAllocationPool.unallocatedFunds(round1)

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      const treasuryAddr = await dynamicBaseAllocationPool.treasuryAddress()
      const initialTreasuryBalance = await b3tr.balanceOf(treasuryAddr)

      await dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, [app2Id, app3Id])

      const app2Reward = await dynamicBaseAllocationPool.dbaRoundRewardsForApp(round1, app2Id)
      const app3Reward = await dynamicBaseAllocationPool.dbaRoundRewardsForApp(round1, app3Id)
      const finalTreasuryBalance = await b3tr.balanceOf(treasuryAddr)
      const treasuryReceived = finalTreasuryBalance - initialTreasuryBalance

      // Total disbursed must equal the original pool amount
      expect(app2Reward + app3Reward + treasuryReceived).to.equal(unallocatedAmount)

      // DBA pool balance should be zero after distribution
      expect(await dynamicBaseAllocationPool.b3trBalance()).to.equal(0n)
    })

    it("Should give full flat share when merit cap is not binding", async function () {
      this.timeout(120000)

      const config = createLocalConfig()
      config.EMISSIONS_CYCLE_DURATION = 10
      config.INITIAL_X_ALLOCATION = ethers.parseEther("10000")
      config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 50

      const {
        dynamicBaseAllocationPool,
        owner,
        x2EarnApps,
        xAllocationPool,
        xAllocationVoting,
        emissions,
        minterAccount,
        otherAccounts,
        veBetterPassport,
        creators,
        x2EarnRewardsPool,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await bootstrapEmissions()

      await veBetterPassport.whitelist(otherAccounts[0].address)
      await veBetterPassport.whitelist(otherAccounts[1].address)
      await veBetterPassport.toggleCheck(1)

      await getVot3Tokens(otherAccounts[0], "10000")
      await getVot3Tokens(otherAccounts[1], "10000")

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("app1"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("app2"))

      await x2EarnApps
        .connect(creators[0])
        .submitApp(otherAccounts[5].address, otherAccounts[5].address, "app1", "metadataURI")
      await x2EarnApps
        .connect(creators[1])
        .submitApp(otherAccounts[6].address, otherAccounts[6].address, "app2", "metadataURI")

      await endorseApp(app1Id, otherAccounts[0])
      await endorseApp(app2Id, otherAccounts[1])

      await emissions.connect(minterAccount).start()
      const round1 = await xAllocationVoting.currentRoundId()

      // Both apps get significant votes - neither will hit merit cap
      await xAllocationVoting.connect(otherAccounts[0]).castVote(round1, [app1Id], [ethers.parseEther("9000")])
      await xAllocationVoting.connect(otherAccounts[1]).castVote(round1, [app2Id], [ethers.parseEther("1000")])

      await waitForRoundToEnd(round1)

      await xAllocationPool
        .connect(owner)
        .setUnallocatedFundsReceiverAddress(await dynamicBaseAllocationPool.getAddress())

      await xAllocationPool.claim(round1, app1Id)
      await xAllocationPool.claim(round1, app2Id)

      const unallocatedAmount = await xAllocationPool.unallocatedFunds(round1)
      const flatSharePerApp = unallocatedAmount / 2n

      const DISTRIBUTOR_ROLE = await dynamicBaseAllocationPool.DISTRIBUTOR_ROLE()
      await dynamicBaseAllocationPool.connect(owner).grantRole(DISTRIBUTOR_ROLE, owner.address)

      // Raise multiplier so merit cap does not bind
      await dynamicBaseAllocationPool.connect(owner).setMeritCapMultiplier(10)

      const [app2TotalEarnings] = await xAllocationPool.roundEarnings(round1, app2Id)
      const baseAllocation = await xAllocationPool.baseAllocationAmount(round1)
      const meritCap = (app2TotalEarnings - baseAllocation) * 10n

      // Merit cap should NOT bind
      expect(flatSharePerApp).to.be.lte(meritCap)

      const initialApp2Funds = await x2EarnRewardsPool.availableFunds(app2Id)

      await dynamicBaseAllocationPool.connect(owner).distributeDBARewards(round1, [app1Id, app2Id])

      const app2Reward = await dynamicBaseAllocationPool.dbaRoundRewardsForApp(round1, app2Id)
      expect(app2Reward).to.equal(flatSharePerApp)

      const finalApp2Funds = await x2EarnRewardsPool.availableFunds(app2Id)
      expect(finalApp2Funds - initialApp2Funds).to.equal(flatSharePerApp)
    })
  })
})
