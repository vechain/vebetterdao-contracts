import { describe, it } from "mocha"
import {
  ZERO_ADDRESS,
  bootstrapEmissions,
  catchRevert,
  getEventName,
  getOrDeployContractInstances,
  moveToCycle,
  waitForBlock,
  waitForNextCycle,
} from "./helpers"
import { assert, expect } from "chai"
import { contract, ethers, network } from "hardhat"
import { calculateTreasuryAllocation } from "./helpers/allocations"
import { createLocalConfig } from "../config/contracts/envs/local"
import { createTestConfig } from "./helpers/config"
import { generateB3trAllocations } from "./helpers/generateB3trAllocations"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { deployAndUpgrade, deployProxy, upgradeProxy } from "../scripts/helpers"
import b3trAllocationsEmissionsDisaligned from "./fixture/full-allocations-round-14-decay.json"
import b3trAllocationsGMPool from "./fixture/updated-full-allocations-with-gm.json"
import { Emissions, EmissionsV2 } from "../typechain-types"

describe("Emissions - @shard1", () => {
  describe("Contract parameters", () => {
    it("Should have correct parameters set on deployment", async () => {
      const config = createLocalConfig()
      const { emissions, owner, b3tr, minterAccount, xAllocationPool, voterRewards, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Destination addresses should be set correctly
      expect(await emissions.xAllocations()).to.equal(await xAllocationPool.getAddress())
      expect(await emissions.vote2Earn()).to.equal(await voterRewards.getAddress())
      expect(await emissions.treasury()).to.equal(await treasury.getAddress())

      // Admin should be set correctly
      expect(await emissions.hasRole(await emissions.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.equal(true)

      // Minter should be set correctly
      expect(await emissions.hasRole(await emissions.MINTER_ROLE(), await minterAccount.getAddress())).to.equal(true)

      // Initial allocation amounts should be set correctly
      const initialEmissions = await emissions.initialXAppAllocation()
      expect(initialEmissions).to.equal(config.INITIAL_X_ALLOCATION)

      // B3TR address should be set correctly
      expect(await emissions.b3tr()).to.equal(await b3tr.getAddress())

      // Decay settings should be set correctly
      expect(await emissions.xAllocationsDecay()).to.equal(config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE)
      expect(await emissions.vote2EarnDecay()).to.equal(config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE)
      expect(await emissions.xAllocationsDecayPeriod()).to.equal(config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD)
      expect(await emissions.vote2EarnDecayPeriod()).to.equal(config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD)

      // Treasury percentage should be set correctly
      expect(await emissions.treasuryPercentage()).to.equal(config.EMISSIONS_TREASURY_PERCENTAGE)

      // GM Percentage of Treasury Pool should be set correctly
      expect(await emissions.gmPercentage()).to.equal(config.GM_PERCENTAGE_OF_TREASURY)
    })

    it("Should revert if Treasury is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, minterAccount, xAllocationPool, voterRewards } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              ZERO_ADDRESS,
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should revert if XAllocations is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, minterAccount, voterRewards, treasury } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              ZERO_ADDRESS,
              await voterRewards.getAddress(),
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should revert if vote2Earn is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, minterAccount, xAllocationPool, treasury } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              ZERO_ADDRESS,
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should revert if admin is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, minterAccount, xAllocationPool, treasury, voterRewards } =
        await getOrDeployContractInstances({
          forceDeploy: false,
        })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: ZERO_ADDRESS,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should revert if Treasury is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, minterAccount, xAllocationPool, voterRewards } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              ZERO_ADDRESS,
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should be able to change the X allocations address", async () => {
      const { emissions, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(emissions.connect(owner).setXallocationsAddress(ZERO_ADDRESS)).to.be.reverted

      const tx = await emissions.connect(owner).setXallocationsAddress(otherAccounts[3].address)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("XAllocationsAddressUpdated")

      expect(await emissions.xAllocations()).to.equal(otherAccounts[3].address)
    })

    it("Should be able to change the Vote 2 Earn address", async () => {
      const { emissions, otherAccounts, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(emissions.connect(owner).setVote2EarnAddress(ZERO_ADDRESS)).to.be.reverted

      await expect(emissions.connect(otherAccount).setVote2EarnAddress(otherAccounts[3].address)).to.be.reverted // Not admin

      const tx = await emissions.connect(owner).setVote2EarnAddress(otherAccounts[3].address)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("Vote2EarnAddressUpdated")

      expect(await emissions.vote2Earn()).to.equal(otherAccounts[3].address)
    })

    it("Should be able to change the Treasury address", async () => {
      const { emissions, otherAccounts, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(emissions.connect(owner).setTreasuryAddress(ZERO_ADDRESS)).to.be.reverted

      await expect(emissions.connect(otherAccount).setTreasuryAddress(otherAccounts[3].address)).to.be.reverted // Not admin

      const tx = await emissions.connect(owner).setTreasuryAddress(otherAccounts[3].address)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("TreasuryAddressUpdated")

      expect(await emissions.treasury()).to.equal(otherAccounts[3].address)
    })

    it("Should not be able to change the X allocations address if not admin", async () => {
      const { emissions, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(emissions.connect(otherAccounts[0]).setXallocationsAddress(otherAccounts[3].address))
    })

    it("Treasury percentage should be between 0 and 10000", async () => {
      const { emissions, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(emissions.connect(owner).setTreasuryPercentage(10001))
      try {
        await emissions.connect(owner).setTreasuryPercentage(-1)
        assert.fail("Should revert")
      } catch (e) {
        /* empty */
      }
      await emissions.connect(owner).setTreasuryPercentage(10000)
      await emissions.connect(owner).setTreasuryPercentage(0)
      const tx = await emissions.connect(owner).setTreasuryPercentage(550)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("TreasuryPercentageUpdated")

      await expect(emissions.connect(otherAccount).setTreasuryPercentage(55)).to.be.reverted // Not admin
    })

    it("GM Percentage of Treasury Pool should be between 0 and 10000", async () => {
      const { emissions, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(emissions.connect(owner).setGmPercentage(10001))
      try {
        await emissions.connect(owner).setGmPercentage(-1)
        assert.fail("Should revert")
      } catch (e) {
        /* empty */
      }
      await emissions.connect(owner).setGmPercentage(10000)
      await emissions.connect(owner).setGmPercentage(0)
      const tx = await emissions.connect(owner).setGmPercentage(550)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("GMPercentageUpdated")

      await expect(emissions.connect(otherAccount).setGmPercentage(55)).to.be.reverted // Not admin
    })

    it("MaxVote2EarnDecay percentage should be between 0 and 100", async () => {
      const { emissions, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(emissions.connect(owner).setMaxVote2EarnDecay(101))
      try {
        await emissions.connect(owner).setMaxVote2EarnDecay(-1)
        assert.fail("Should revert")
      } catch (e) {
        /* empty */
      }
      await emissions.connect(owner).setMaxVote2EarnDecay(100)
      await emissions.connect(owner).setMaxVote2EarnDecay(0)
      const tx = await emissions.connect(owner).setMaxVote2EarnDecay(55)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("MaxVote2EarnDecayUpdated")

      await expect(emissions.connect(otherAccount).setMaxVote2EarnDecay(55)).to.be.reverted // Not admin
    })

    it("Vote2EarnDecay percentage should be between 0 and 100", async () => {
      const { emissions, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(emissions.connect(owner).setVote2EarnDecay(101))
      try {
        await emissions.connect(owner).setVote2EarnDecay(-1)
        assert.fail("Should revert")
      } catch (e) {
        /* empty */
      }
      await emissions.connect(owner).setVote2EarnDecay(100)
      await emissions.connect(owner).setVote2EarnDecay(0)
      const tx = await emissions.connect(owner).setVote2EarnDecay(55)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("Vote2EarnDecayUpdated")

      await expect(emissions.connect(otherAccount).setVote2EarnDecay(55)).to.be.reverted // Not admin
    })

    it("XAllocationsDecay percentage should be between 0 and 100", async () => {
      const { emissions, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(emissions.connect(owner).setXAllocationsDecay(101))
      try {
        await emissions.connect(owner).setXAllocationsDecay(-1)
        assert.fail("Should revert")
      } catch (e) {
        /* empty */
      }
      await emissions.connect(owner).setXAllocationsDecay(100)
      await emissions.connect(owner).setXAllocationsDecay(0)
      const tx = await emissions.connect(owner).setXAllocationsDecay(55)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("XAllocationsDecayUpdated")

      await expect(emissions.connect(otherAccount).setXAllocationsDecay(55)).to.be.reverted // Not admin
    })

    it("Should return correct x allocations governor address", async () => {
      const { emissions, xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await emissions.xAllocationsGovernor()).to.equal(await xAllocationVoting.getAddress())
    })

    it("Should return max vote 2 earn decay percentage", async () => {
      const { emissions } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await emissions.maxVote2EarnDecay()).to.equal(80)
    })

    it("Should return scaling factor", async () => {
      const { emissions } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await emissions.SCALING_FACTOR()).to.equal(10 ** 6)
    })

    it("Should be able to change cycle duration", async () => {
      const { emissions, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const tx = await emissions.connect(owner).setCycleDuration(1000)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("EmissionCycleDurationUpdated")

      expect(await emissions.cycleDuration()).to.equal(1000)

      await expect(emissions.connect(otherAccount).setCycleDuration(1000)).to.be.reverted // Not admin

      await expect(emissions.connect(owner).setCycleDuration(0)).to.be.reverted // At least 1 block
    })

    it("Should revert if cycle period is set less than voting period", async () => {
      const { emissions, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(emissions.connect(owner).setCycleDuration(10)).to.be.reverted
    })

    it("Should be able to change x allocations decay period", async () => {
      const { emissions, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const tx = await emissions.connect(owner).setXAllocationsDecayPeriod(1000)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("XAllocationsDecayPeriodUpdated")

      expect(await emissions.xAllocationsDecayPeriod()).to.equal(1000)

      await expect(emissions.connect(otherAccount).setXAllocationsDecayPeriod(1000)).to.be.reverted // Not admin

      await expect(emissions.connect(owner).setXAllocationsDecayPeriod(0)).to.be.reverted // At least 1 block
    })

    it("Should be able to change vote 2 earn decay period", async () => {
      const { emissions, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const tx = await emissions.connect(owner).setVote2EarnDecayPeriod(1000)
      const receipt = await tx.wait()

      const eventName = getEventName(receipt, emissions)
      expect(eventName).to.equal("Vote2EarnDecayPeriodUpdated")

      expect(await emissions.vote2EarnDecayPeriod()).to.equal(1000)

      await expect(emissions.connect(otherAccount).setVote2EarnDecayPeriod(1000)).to.be.reverted // Not admin

      await expect(emissions.connect(owner).setVote2EarnDecayPeriod(0)).to.be.reverted // At least 1 block
    })

    it("Should be able to change x allocations voting governor", async () => {
      const { emissions, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(emissions.connect(otherAccount).setXAllocationsGovernorAddress(otherAccount.address)).to.be.reverted // Not admin

      await expect(emissions.connect(owner).setXAllocationsGovernorAddress(ZERO_ADDRESS)).to.be.reverted // Can't be zero address
    })

    // it("getScaledDecayPercentage: decay percentage should be between 0 and 99", async () => {
    //   const { emissions, owner } = await getOrDeployContractInstances({
    //     forceDeploy: true,
    //   })

    //   await expect(emissions.connect(owner).getScaledDecayPercentage(101)).to.be.reverted
    //   try {
    //     await emissions.connect(owner).getScaledDecayPercentage(-1)
    //     assert.fail("Should revert")
    //   } catch (e) {
    //     /* empty */
    //   }
    //   await expect(emissions.connect(owner).getScaledDecayPercentage(100)).to.be.reverted

    //   await expect(emissions.connect(owner).getScaledDecayPercentage(0)).not.to.be.reverted
    //   await expect(emissions.connect(owner).getScaledDecayPercentage(55)).not.to.be.reverted
    // })
  })

  describe("Contract upgradeablity", () => {
    it("Admin should be able to upgrade the contract", async function () {
      const { emissions, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("Emissions")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await emissions.getAddress())

      const UPGRADER_ROLE = await emissions.UPGRADER_ROLE()
      expect(await emissions.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(emissions.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await emissions.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only admin should be able to upgrade the contract", async function () {
      const { emissions, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("Emissions")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await emissions.getAddress())

      const UPGRADER_ROLE = await emissions.UPGRADER_ROLE()
      expect(await emissions.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(emissions.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await emissions.getAddress())

      expect(newImplAddress.toUpperCase()).to.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.not.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Admin can change UPGRADER_ROLE", async function () {
      const { emissions, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("Emissions")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await emissions.getAddress())

      const UPGRADER_ROLE = await emissions.UPGRADER_ROLE()
      expect(await emissions.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(emissions.connect(owner).grantRole(UPGRADER_ROLE, otherAccount.address)).to.not.be.reverted
      await expect(emissions.connect(owner).revokeRole(UPGRADER_ROLE, owner.address)).to.not.be.reverted

      await expect(emissions.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await emissions.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Should not be able to call initializer after deployment", async () => {
      const config = createLocalConfig()
      const { emissions, owner, minterAccount, xAllocationPool, voterRewards, treasury, b3tr } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      expect(
        emissions.initialize({
          minter: minterAccount.address,
          admin: owner.address,
          upgrader: owner.address,
          contractsAddressManager: owner.address,
          decaySettingsManager: owner.address,
          b3trAddress: await b3tr.getAddress(),
          destinations: [
            await xAllocationPool.getAddress(),
            await voterRewards.getAddress(),
            await treasury.getAddress(),
            config.MIGRATION_ADDRESS,
          ],
          initialXAppAllocation: 0,
          cycleDuration: config.EMISSIONS_CYCLE_DURATION,
          decaySettings: [
            config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
            config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
            config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
            config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
          ],
          treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
          maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
          migrationAmount: config.MIGRATION_AMOUNT,
        }),
      ).to.be.reverted

      expect(emissions.initializeV3(config.GM_PERCENTAGE_OF_TREASURY)).to.be.reverted
    })

    it("Should not be able to deploy with initial X Allocations zero", async () => {
      const config = createTestConfig()
      const { owner, minterAccount, b3tr, xAllocationPool, voterRewards, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: 0,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy with cycle duration less or equal to 0", async () => {
      const config = createTestConfig()
      const { owner, minterAccount, b3tr, xAllocationPool, voterRewards, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: 0,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy with treasury percentage not between 1 and 10000", async () => {
      const config = createTestConfig()
      const { owner, minterAccount, b3tr, xAllocationPool, voterRewards, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: 0,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should not be able to upgrade with GM percentage not between 1 and 10000", async () => {
      const config = createLocalConfig()
      const { owner, minterAccount, b3tr, xAllocationPool, voterRewards, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const emissions = (await deployAndUpgrade(
        ["EmissionsV1", "EmissionsV2"],
        [
          [
            {
              minter: minterAccount.address,
              admin: owner.address,
              upgrader: owner.address,
              contractsAddressManager: owner.address,
              decaySettingsManager: owner.address,
              b3trAddress: await b3tr.getAddress(),
              destinations: [
                await xAllocationPool.getAddress(),
                await voterRewards.getAddress(),
                await treasury.getAddress(),
                config.MIGRATION_ADDRESS,
              ],
              initialXAppAllocation: config.INITIAL_X_ALLOCATION,
              cycleDuration: config.EMISSIONS_CYCLE_DURATION,
              decaySettings: [
                config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
                config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
                config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
                config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
              ],
              treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
              maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
              migrationAmount: config.MIGRATION_AMOUNT,
            },
          ],
          [],
        ],
        {
          versions: [undefined, 2],
          logOutput: false,
        },
      )) as EmissionsV2

      await expect(
        upgradeProxy("EmissionsV2", "Emissions", await emissions.getAddress(), [10001], {
          version: 3,
        }),
      ).to.be.reverted
    })

    it("Should not be able to deploy with x allocations decay percentage not between 1 and 100", async () => {
      const config = createTestConfig()
      const { owner, minterAccount, b3tr, xAllocationPool, voterRewards, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              101,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy with vote2Earn decay percentage not between 1 and 100", async () => {
      const config = createTestConfig()
      const { owner, minterAccount, b3tr, xAllocationPool, voterRewards, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              0,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy with xAllocations decay delay period less than 1", async () => {
      const config = createTestConfig()
      const { owner, minterAccount, b3tr, xAllocationPool, voterRewards, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              0,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy with vote2Earn decay delay period less than 1", async () => {
      const config = createTestConfig()
      const { owner, minterAccount, b3tr, xAllocationPool, voterRewards, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              0,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should not be able to deploy with max vote2Earn decay percentage not between 1 and 100", async () => {
      const config = createTestConfig()
      const { owner, minterAccount, b3tr, xAllocationPool, voterRewards, treasury } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      await expect(
        deployProxy("Emissions", [
          {
            minter: minterAccount.address,
            admin: owner.address,
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            decaySettingsManager: owner.address,
            b3trAddress: await b3tr.getAddress(),
            destinations: [
              await xAllocationPool.getAddress(),
              await voterRewards.getAddress(),
              await treasury.getAddress(),
              config.MIGRATION_ADDRESS,
            ],
            initialXAppAllocation: config.INITIAL_X_ALLOCATION,
            cycleDuration: config.EMISSIONS_CYCLE_DURATION,
            decaySettings: [
              config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
              config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
              config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
              config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
            ],
            treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
            maxVote2EarnDecay: 0,
            migrationAmount: config.MIGRATION_AMOUNT,
          },
        ]),
      ).to.be.reverted
    })

    it("Should return correct version of the contract", async () => {
      const { emissions } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await emissions.version()).to.equal("3")
    })

    it("Should not have any state conflicts after upgrading to V3", async function () {
      const config = createTestConfig()
      const { b3tr, minterAccount, owner, xAllocationPool, voterRewards, treasury, xAllocationVoting } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      let emissions = (await deployAndUpgrade(
        ["EmissionsV1", "EmissionsV2"],
        [
          [
            {
              minter: minterAccount.address,
              admin: owner.address,
              upgrader: owner.address,
              contractsAddressManager: owner.address,
              decaySettingsManager: owner.address,
              b3trAddress: await b3tr.getAddress(),
              destinations: [
                await xAllocationPool.getAddress(),
                await voterRewards.getAddress(),
                await treasury.getAddress(),
                config.MIGRATION_ADDRESS,
              ],
              initialXAppAllocation: config.INITIAL_X_ALLOCATION,
              cycleDuration: config.EMISSIONS_CYCLE_DURATION,
              decaySettings: [
                config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
                config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
                config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
                config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
              ],
              treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
              maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
              migrationAmount: config.MIGRATION_AMOUNT,
            },
          ],
          [],
        ],
        {
          versions: [undefined, 2],
          logOutput: false,
        },
      )) as EmissionsV2

      await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())
      await emissions.setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
      await xAllocationVoting
        .connect(owner)
        .grantRole(await xAllocationVoting.ROUND_STARTER_ROLE(), await emissions.getAddress())
      // Bootstrap emissions
      await emissions.connect(minterAccount).bootstrap()
      // Start emissions
      await emissions.connect(minterAccount).start()

      // Variables to hold calculated amounts for assertions
      let xAllocationsAmount = BigInt(0)
      let vote2EarnAmount = BigInt(0)
      let treasuryAmount = BigInt(0)
      let gmAmount = BigInt(0)
      let _totalEmissions = config.MIGRATION_AMOUNT
      const cap = await b3tr.cap()

      const b3trAllocations = await generateB3trAllocations(config, "./test/fixture/full-allocations.json")
      // const b3trAllocations = await generateB3trAllocations(config)

      // Loop through all cycles as simulated in the b3tr emissions spreadsheet
      for (let i = 0; i < 10; i++) {
        const allocations = b3trAllocations[i]

        // Calculate decayed amounts
        xAllocationsAmount = await emissions.getXAllocationAmount(allocations.cycle)
        vote2EarnAmount = await emissions.getVote2EarnAmount(allocations.cycle)
        treasuryAmount = await emissions.getTreasuryAmount(allocations.cycle)
        const totalEmissionsFromContract = await emissions.totalEmissions()
        _totalEmissions = _totalEmissions + xAllocationsAmount + vote2EarnAmount + treasuryAmount
        const remainingEmissionsFromContract = await emissions.getRemainingEmissions()

        const emissionsFromContract = await emissions.emissions(allocations.cycle)
        expect(emissionsFromContract).to.deep.equal([xAllocationsAmount, vote2EarnAmount, treasuryAmount])

        // Log the cycle and amounts for debugging
        // Uncomment to view the emissions for each cycle
        // console.log(
        //   `Cycle ${allocations.cycle}: XAllocations = ${ethers.formatEther(xAllocationsAmount)}, Vote2Earn = ${ethers.formatEther(vote2EarnAmount)}`,
        //   `Treasury = ${ethers.formatEther(treasuryAmount)} Total Emissions = ${ethers.formatEther(totalEmissionsFromContract)} Remaining Emissions = ${ethers.formatEther(remainingEmissionsFromContract)}`,
        // )

        // Assert the calculated amounts match the expected amounts from the spreadsheet
        expect(xAllocationsAmount).to.equal(allocations.xAllocation)
        expect(vote2EarnAmount).to.equal(allocations.vote2EarnAllocation)
        expect(treasuryAmount).to.equal(allocations.treasuryAllocation)
        expect(totalEmissionsFromContract).to.equal(_totalEmissions)
        expect(remainingEmissionsFromContract).to.equal(cap - totalEmissionsFromContract)

        // Move to next cycle
        const blockNextCycle = await emissions.getNextCycleBlock()
        await waitForBlock(Number(blockNextCycle))

        await expect(emissions.distribute())
          .to.emit(emissions, "EmissionDistributed")
          .withArgs(
            allocations.cycle + 1,
            b3trAllocations[i + 1].xAllocation,
            b3trAllocations[i + 1].vote2EarnAllocation,
            b3trAllocations[i + 1].treasuryAllocation,
          )

        expect(await emissions.getCurrentCycle()).to.equal(allocations.cycle + 1)
      }

      // Should be on cycle 11
      expect(await emissions.getCurrentCycle()).to.equal(11)

      let storageSlots = []

      const initialSlot = BigInt("0xa3a4dbdafa3539d2a7f76379fff3516428de5d09ad2bbe195434cac5e7193900") // Slot 0 of Emissions

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlots.push(await ethers.provider.getStorage(await emissions.getAddress(), i))
      }

      storageSlots = storageSlots.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      ) // removing empty slots

      // Upgrade contract
      const emissionsV3 = (await upgradeProxy(
        "EmissionsV2",
        "Emissions",
        await emissions.getAddress(),
        [config.GM_PERCENTAGE_OF_TREASURY],
        {
          version: 3,
        },
      )) as unknown as Emissions

      let storageSlotsAfter = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await emissionsV3.getAddress(), i))
      }

      storageSlotsAfter = storageSlotsAfter.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      )

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      expect(await emissionsV3.version()).to.equal("3")

      const allocations = b3trAllocations[10]

      // Calculate decayed amounts
      xAllocationsAmount = await emissionsV3.getXAllocationAmount(allocations.cycle)
      vote2EarnAmount = await emissionsV3.getVote2EarnAmount(allocations.cycle)
      treasuryAmount = await emissionsV3.getTreasuryAmount(allocations.cycle)
      gmAmount = await emissionsV3.getGMAmount(allocations.cycle)
      expect(gmAmount).to.equal(0n)
      const totalEmissionsFromContract = await emissionsV3.totalEmissions()
      _totalEmissions = _totalEmissions + xAllocationsAmount + vote2EarnAmount + treasuryAmount + gmAmount
      const remainingEmissionsFromContract = await emissionsV3.getRemainingEmissions()

      const emissionsFromContract = await emissionsV3.emissions(allocations.cycle)
      expect(emissionsFromContract).to.deep.equal([xAllocationsAmount, vote2EarnAmount, treasuryAmount, 0n])

      // Move to next cycle as GM will kick in next cycle
      const blockNextCycle = await emissionsV3.getNextCycleBlock()
      await waitForBlock(Number(blockNextCycle))

      // Distribute emissions
      await emissionsV3.connect(minterAccount).distribute()

      for (let i = 11; i < 20; i++) {
        const allocations = b3trAllocations[i]

        // Calculate decayed amounts
        xAllocationsAmount = await emissionsV3.getXAllocationAmount(allocations.cycle)
        vote2EarnAmount = await emissionsV3.getVote2EarnAmount(allocations.cycle)
        treasuryAmount = await emissionsV3.getTreasuryAmount(allocations.cycle)
        gmAmount = await emissionsV3.getGMAmount(allocations.cycle)
        const totalEmissionsFromContract = await emissionsV3.totalEmissions()
        _totalEmissions = _totalEmissions + xAllocationsAmount + vote2EarnAmount + treasuryAmount + gmAmount
        const remainingEmissionsFromContract = await emissionsV3.getRemainingEmissions()

        const emissionsFromContract = await emissionsV3.emissions(allocations.cycle)
        expect(emissionsFromContract).to.deep.equal([xAllocationsAmount, vote2EarnAmount, treasuryAmount, gmAmount])

        // Log the cycle and amounts for debugging
        // Uncomment to view the emissions for each cycle
        // console.log(
        //   `Cycle ${allocations.cycle}: XAllocations = ${ethers.formatEther(xAllocationsAmount)}, Vote2Earn = ${ethers.formatEther(vote2EarnAmount)}`,
        //   `Treasury = ${ethers.formatEther(treasuryAmount)} Total Emissions = ${ethers.formatEther(totalEmissionsFromContract)} Remaining Emissions = ${ethers.formatEther(remainingEmissionsFromContract)}`,
        // )

        // Assert the calculated amounts match the expected amounts from the spreadsheet
        expect(xAllocationsAmount).to.equal(allocations.xAllocation)
        expect(vote2EarnAmount).to.equal(allocations.vote2EarnAllocation)
        // Should be 75% of the treasury allocation
        expect(treasuryAmount).to.equal((allocations.treasuryAllocation * 75n) / 100n)
        // Should be 25% of the treasury allocation
        expect(gmAmount).to.equal((allocations.treasuryAllocation * 25n) / 100n)
        expect(totalEmissionsFromContract).to.equal(_totalEmissions)
        expect(remainingEmissionsFromContract).to.equal(cap - totalEmissionsFromContract)

        // Move to next cycle
        const blockNextCycle = await emissionsV3.getNextCycleBlock()
        await waitForBlock(Number(blockNextCycle))

        await expect(emissionsV3.distribute())
          .to.emit(emissionsV3, "EmissionDistributedV2")
          .withArgs(
            allocations.cycle + 1,
            b3trAllocations[i + 1].xAllocation,
            b3trAllocations[i + 1].vote2EarnAllocation,
            (b3trAllocations[i + 1].treasuryAllocation * 75n) / 100n,
            (b3trAllocations[i + 1].treasuryAllocation * 25n) / 100n,
          )

        expect(await emissionsV3.getCurrentCycle()).to.equal(allocations.cycle + 1)
      }
    })
  })

  describe("Bootstrap emissions", () => {
    it("Should be able to bootstrap emissions", async () => {
      const config = createLocalConfig()
      config.GM_PERCENTAGE_OF_TREASURY = 0
      const { emissions, b3tr, minterAccount, treasury, owner, xAllocationPool, voterRewards } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Grant minter role to emissions contract
      await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

      const tx = await emissions.connect(minterAccount).bootstrap()

      const receipt = await tx.wait()

      if (!receipt?.logs) throw new Error("No logs in receipt")

      const events = receipt?.logs

      const decodedEvents = events?.map(event => {
        return emissions.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      const emissionDistributedEvent = decodedEvents.find(event => event?.name === "EmissionDistributed")

      const initialVoteAllocation = config.INITIAL_X_ALLOCATION
      const initialTreasuryAlloc = calculateTreasuryAllocation(
        config.INITIAL_X_ALLOCATION,
        initialVoteAllocation,
        BigInt(config.EMISSIONS_TREASURY_PERCENTAGE),
      )

      expect(emissionDistributedEvent?.args?.cycle).to.equal(1)
      expect(emissionDistributedEvent?.args.xAllocations).to.equal(config.INITIAL_X_ALLOCATION)
      expect(emissionDistributedEvent?.args.vote2Earn).to.equal(initialVoteAllocation)
      expect(emissionDistributedEvent?.args.treasury).to.equal(initialTreasuryAlloc)

      expect(await b3tr.balanceOf(await xAllocationPool.getAddress())).to.equal(config.INITIAL_X_ALLOCATION)
      expect(await b3tr.balanceOf(await voterRewards.getAddress())).to.equal(initialVoteAllocation)
      expect(await b3tr.balanceOf(await treasury.getAddress())).to.equal(initialTreasuryAlloc)

      expect(await emissions.getXAllocationAmount(1)).to.equal(config.INITIAL_X_ALLOCATION)
      expect(await emissions.getVote2EarnAmount(1)).to.equal(initialVoteAllocation)
      expect(await emissions.getTreasuryAmount(1)).to.equal(initialTreasuryAlloc)

      expect(await emissions.nextCycle()).to.equal(1)
    })

    it("Should not be able to get vote 2 earn amount if emissions have not started", async () => {
      const { emissions } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(emissions.getVote2EarnAmount(0)).to.be.reverted
    })

    it("Should not be able to get current cycle if emissions have not started", async () => {
      const { emissions } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(emissions.getCurrentCycle()).to.be.reverted
    })

    it("Should not be able to get X allocations amount for cycle that has not started", async () => {
      const { emissions } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await bootstrapEmissions()

      await expect(emissions.getXAllocationAmount(2)).to.be.reverted
    })

    it("Should correctly determine if cycle is ended", async () => {
      const { emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      expect(await emissions.isCycleEnded(1)).to.equal(false)

      await waitForNextCycle()

      expect(await emissions.isCycleEnded(1)).to.equal(true)

      await emissions.connect(minterAccount).distribute()

      expect(await emissions.isCycleDistributed(1)).to.equal(true)
    })

    it("Should be able to get last emissions block", async () => {
      const { emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      const lastBlock = await emissions.lastEmissionBlock()

      expect(lastBlock).to.be.greaterThan(0)
    })

    it("Should not be able to bootstrap emissions if B3TR transfers are paused", async () => {
      const { emissions, b3tr, minterAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Grant minter role to emissions contract
      await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

      await b3tr.connect(owner).pause()

      await catchRevert(emissions.connect(minterAccount).bootstrap())

      await b3tr.connect(owner).unpause()

      await emissions.connect(minterAccount).bootstrap() // Now we should be able to bootstrap due to unpausing
    })

    it("Should not be able to bootstrap emissions twice", async () => {
      const { emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Try to bootstrap emissions again - Should revert
      await catchRevert(emissions.connect(minterAccount).bootstrap())
    })

    it("Should not be able to bootstrap emissions if not minter", async () => {
      const { emissions, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Try to bootstrap emissions without minter role - Should revert
      await catchRevert(emissions.connect(otherAccounts[0]).bootstrap())
    })

    it("Should return emissions values for a given cycle", async () => {
      const config = createLocalConfig()
      const { emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      await waitForNextCycle()

      await emissions.connect(minterAccount).distribute()

      expect(await emissions.emissions(2)).to.eql([
        2000000000000000000000000n,
        2000000000000000000000000n,
        750000000000000000000000n,
        250000000000000000000000n,
      ])
    })
  })

  describe("Start emissions", () => {
    it("Should be able to start emissions", async () => {
      const config = createLocalConfig()
      config.GM_PERCENTAGE_OF_TREASURY = 0
      const { emissions, b3tr, minterAccount, treasury, xAllocationPool, voterRewards } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      const tx = await emissions.connect(minterAccount).start()

      const receipt = await tx.wait()

      if (!receipt?.logs) throw new Error("No logs in receipt")

      const initialVoteAllocation = config.INITIAL_X_ALLOCATION
      const initialTreasuryAlloc = calculateTreasuryAllocation(
        config.INITIAL_X_ALLOCATION,
        initialVoteAllocation,
        BigInt(config.EMISSIONS_TREASURY_PERCENTAGE),
      )

      expect(await b3tr.balanceOf(await xAllocationPool.getAddress())).to.equal(config.INITIAL_X_ALLOCATION)
      expect(await b3tr.balanceOf(await voterRewards.getAddress())).to.equal(initialVoteAllocation)
      expect(await b3tr.balanceOf(await treasury.getAddress())).to.equal(initialTreasuryAlloc)

      expect(await emissions.getXAllocationAmount(1)).to.equal(config.INITIAL_X_ALLOCATION)
      expect(await emissions.getVote2EarnAmount(1)).to.equal(initialVoteAllocation)
      expect(await emissions.getTreasuryAmount(1)).to.equal(initialTreasuryAlloc)

      expect(await emissions.nextCycle()).to.equal(2)
    })

    it("Should not be able to start emissions if B3TR transfers are paused", async () => {
      const { emissions, b3tr, minterAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await b3tr.connect(owner).pause()

      await catchRevert(emissions.connect(minterAccount).start())

      await b3tr.connect(owner).unpause()

      await emissions.connect(minterAccount).start() // Now we should be able to start emissions due to unpausing
    })

    it("Should not be able start emissions twice", async () => {
      const { emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Start emissions
      await emissions.connect(minterAccount).start()

      // Try to start emissions again - Should revert
      await catchRevert(emissions.connect(minterAccount).start())
    })

    it("Should not be able to start emissions if not bootstapped", async () => {
      const { emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Try to start emissions without bootstrapping - Should revert
      await catchRevert(emissions.connect(minterAccount).start())
    })
  })

  describe("Emissions distribution", () => {
    it("Should be able to calculate emissions correctly for first cycle", async () => {
      const config = createLocalConfig()
      config.GM_PERCENTAGE_OF_TREASURY = 0
      const { emissions, b3tr, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Start emissions
      await emissions.connect(minterAccount).start()

      // Expect next cycle to be 2
      expect(await emissions.nextCycle()).to.equal(2)

      await waitForNextCycle()

      // Calculate emissions for first cycle
      const xAllocationAmount = await emissions.getXAllocationAmount(2)
      const vote2EarnAmount = await emissions.getVote2EarnAmount(2)
      const treasuryAmount = await emissions.getTreasuryAmount(2)
      const gmAmount = await emissions.getGMAmount(2)
      const initialVoteAllocation = config.INITIAL_X_ALLOCATION
      const initialTreasuryAlloc = calculateTreasuryAllocation(
        config.INITIAL_X_ALLOCATION,
        initialVoteAllocation,
        BigInt(config.EMISSIONS_TREASURY_PERCENTAGE),
      )

      expect(xAllocationAmount).to.equal(config.INITIAL_X_ALLOCATION)
      expect(vote2EarnAmount).to.equal(initialVoteAllocation)
      expect(treasuryAmount).to.equal(initialTreasuryAlloc)
      expect(gmAmount).to.equal(0n)

      // Distribute emissions
      const tx = await emissions.connect(minterAccount).distribute()

      const receipt = await tx.wait()

      if (!receipt?.logs) throw new Error("No logs in receipt")

      const events = receipt?.logs

      const decodedEvents = events?.map(event => {
        return emissions.interface.parseLog({
          topics: event?.topics as string[],
          data: event?.data as string,
        })
      })

      const emissionDistributedEvent = decodedEvents.find(event => event?.name === "EmissionDistributedV2")

      expect(emissionDistributedEvent?.args?.cycle).to.equal(2)
      expect(emissionDistributedEvent?.args.xAllocations).to.equal(xAllocationAmount)
      expect(emissionDistributedEvent?.args.vote2Earn).to.equal(vote2EarnAmount)
      expect(emissionDistributedEvent?.args.treasury).to.equal(treasuryAmount)

      // Check supply
      expect(await b3tr.totalSupply()).to.equal(
        config.MIGRATION_AMOUNT + (config.INITIAL_X_ALLOCATION + initialVoteAllocation + initialTreasuryAlloc) * 2n,
      )
      expect(await b3tr.balanceOf(await emissions.xAllocations())).to.equal(config.INITIAL_X_ALLOCATION * 2n)
      expect(await b3tr.balanceOf(await emissions.vote2Earn())).to.equal(initialVoteAllocation * 2n)
      expect(await b3tr.balanceOf(await emissions.treasury())).to.equal(initialTreasuryAlloc * 2n)
      expect(await b3tr.balanceOf(config.MIGRATION_ADDRESS)).to.equal(config.MIGRATION_AMOUNT)
    })

    it("Should not be able to distribute emissions if B3TR transfers are paused", async () => {
      const config = createLocalConfig()
      const { emissions, b3tr, minterAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Start emissions
      await emissions.connect(minterAccount).start()

      await waitForNextCycle()

      // Pause B3TR transfers
      await b3tr.connect(owner).pause()

      // Try to distribute emissions - Should revert
      await catchRevert(emissions.connect(minterAccount).distribute())

      // Unpause B3TR transfers
      await b3tr.connect(owner).unpause()

      // Distribute emissions
      await emissions.connect(minterAccount).distribute()
    })

    it("Should not be able to distribute emissions before next cycle starts", async () => {
      const config = createLocalConfig()
      config.GM_PERCENTAGE_OF_TREASURY = 0
      const { emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Start emissions
      await emissions.connect(minterAccount).start()

      expect(await emissions.nextCycle()).to.equal(2)

      // Calculate emissions for first cycle
      const initialVoteAllocation = config.INITIAL_X_ALLOCATION
      const initialTreasuryAlloc = calculateTreasuryAllocation(
        config.INITIAL_X_ALLOCATION,
        initialVoteAllocation,
        BigInt(config.EMISSIONS_TREASURY_PERCENTAGE),
      )

      const xAllocationsAmount = await emissions.getXAllocationAmount(2)
      const vote2EarnAmount = await emissions.getVote2EarnAmount(2)
      const treasuryAmount = await emissions.getTreasuryAmount(2)

      expect(xAllocationsAmount).to.equal(config.INITIAL_X_ALLOCATION)
      expect(vote2EarnAmount).to.equal(initialVoteAllocation)
      expect(treasuryAmount).to.equal(initialTreasuryAlloc)

      // Try to distribute emissions before next cycle starts - Should revert
      await catchRevert(emissions.connect(minterAccount).distribute())
    })

    it("Should be able to calculate emissions correctly for second cycle", async () => {
      const config = createLocalConfig()
      config.GM_PERCENTAGE_OF_TREASURY = 0
      const { emissions, b3tr, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Start emissions
      await emissions.connect(minterAccount).start()

      await waitForNextCycle()

      // Distribute emissions
      await emissions.connect(minterAccount).distribute()

      expect(await emissions.isCycleDistributed(2)).to.equal(true)

      const initialVoteAllocation = config.INITIAL_X_ALLOCATION
      const initialTreasuryAlloc = calculateTreasuryAllocation(
        config.INITIAL_X_ALLOCATION,
        initialVoteAllocation,
        BigInt(config.EMISSIONS_TREASURY_PERCENTAGE),
      )

      // Check supply
      expect(await b3tr.totalSupply()).to.equal(
        config.MIGRATION_AMOUNT + (config.INITIAL_X_ALLOCATION + initialVoteAllocation + initialTreasuryAlloc) * 2n,
      )
      expect(await b3tr.balanceOf(await emissions.xAllocations())).to.equal(config.INITIAL_X_ALLOCATION * 2n)
      expect(await b3tr.balanceOf(await emissions.vote2Earn())).to.equal(initialVoteAllocation * 2n)
      expect(await b3tr.balanceOf(await emissions.treasury())).to.equal(initialTreasuryAlloc * 2n)
      expect(await b3tr.balanceOf(config.MIGRATION_ADDRESS)).to.equal(config.MIGRATION_AMOUNT)

      await waitForNextCycle()

      expect(await emissions.nextCycle()).to.equal(3)

      // Calculate emissions for second cycle
      const xAllocationsAmount = await emissions.getXAllocationAmount(3)
      const vote2EarnAmount = await emissions.getVote2EarnAmount(3)
      const treasuryAmount = await emissions.getTreasuryAmount(3)

      expect(xAllocationsAmount).to.equal(config.INITIAL_X_ALLOCATION)
      expect(vote2EarnAmount).to.equal(initialVoteAllocation)
      expect(treasuryAmount).to.equal(initialTreasuryAlloc)

      // Distribute emissions
      await emissions.connect(minterAccount).distribute()

      expect(await emissions.isCycleDistributed(3)).to.equal(true)

      // Check supply
      expect(await b3tr.totalSupply()).to.equal(
        config.MIGRATION_AMOUNT + (config.INITIAL_X_ALLOCATION + initialVoteAllocation + initialTreasuryAlloc) * 3n,
      )
      expect(await b3tr.balanceOf(await emissions.xAllocations())).to.equal(config.INITIAL_X_ALLOCATION * 3n)
      expect(await b3tr.balanceOf(await emissions.vote2Earn())).to.equal(initialVoteAllocation * 3n)
      expect(await b3tr.balanceOf(await emissions.treasury())).to.equal(initialTreasuryAlloc * 3n)
      expect(await b3tr.balanceOf(config.MIGRATION_ADDRESS)).to.equal(config.MIGRATION_AMOUNT)

      expect(await emissions.nextCycle()).to.equal(4)
    })

    it("Should calculate emissions properly after first X-Alloc decay period", async () => {
      const config = createTestConfig()
      config.GM_PERCENTAGE_OF_TREASURY = 0
      const { emissions, b3tr, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Start emissions
      await emissions.connect(minterAccount).start()

      await waitForNextCycle()

      // Set GM Pool percentage to 25%
      await emissions.setGmPercentage(2500)

      // Distribute emissions
      await emissions.connect(minterAccount).distribute()

      // Check supply
      expect(await b3tr.totalSupply()).to.equal(ethers.parseEther("13750000"))
      expect(await b3tr.balanceOf(await emissions.xAllocations())).to.equal(ethers.parseEther("4000000")) // 2Mill (Cycle 1) + 2Mill (Cycle 2)
      expect(await b3tr.balanceOf(await emissions.vote2Earn())).to.equal(ethers.parseEther("4250000")) // 2Mill (Cycle 1) + 2Mill (Cycle 2) + 250000 (25% of Treasury, Cycle 2)
      expect(await b3tr.balanceOf(await emissions.treasury())).to.equal(ethers.parseEther("1750000")) // 1Mill (Cycle 1) + 750000 (75% of Treasury, Cycle 2)
      expect(await b3tr.balanceOf(config.MIGRATION_ADDRESS)).to.equal(config.MIGRATION_AMOUNT)

      // Move to after first decay period
      const cycle = config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD + 2
      await moveToCycle(cycle)

      expect(await emissions.nextCycle()).to.equal(cycle)

      await waitForNextCycle()

      const xAllocationsAmount = await emissions.getXAllocationAmount(cycle)
      const vote2EarnAmount = await emissions.getVote2EarnAmount(cycle)
      const treasuryAmount = await emissions.getTreasuryAmount(cycle)
      const gmAmount = await emissions.getGMAmount(cycle)
      // Check allocations after decay
      expect(xAllocationsAmount).to.equal(ethers.parseEther("1920000")) // Decay 4% 2Mill = 1920000
      expect(vote2EarnAmount).to.equal(ethers.parseEther("1920000")) // Decay 4% 2Mill = 1920000
      expect(treasuryAmount).to.equal(ethers.parseEther("720000")) // 75% of (25% of 1920000 * 2) = 720000
      expect(gmAmount).to.equal(ethers.parseEther("240000")) // 25% of (25% of 1920000 * 2) = 240000
      // Check supply
      expect(await b3tr.balanceOf(await emissions.xAllocations())).to.equal(ethers.parseEther("25920000")) // 2Mill (Cycle 1) + 2Mill (Cycle 2) + 1920000 (Cycle 3)
      expect(await b3tr.balanceOf(await emissions.vote2Earn())).to.equal(ethers.parseEther("28910000")) // 2Mill (Cycle 1) + 2Mill (Cycle 2) + 1920000 (Cycle 3) + 240000 (Cycle 3)
      expect(await b3tr.balanceOf(await emissions.treasury())).to.equal(ethers.parseEther("9970000"))
      expect(await b3tr.totalSupply()).to.equal(ethers.parseEther("68550000"))
    }).timeout(1000 * 60 * 10) // 10 minutes

    it("Should calculate emissions properly after first Rewards decay period", async () => {
      const config = createTestConfig()
      config.GM_PERCENTAGE_OF_TREASURY = 0
      const { emissions, b3tr, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Start emissions
      await emissions.connect(minterAccount).start()

      // Set GM Pool percentage to 25%
      await emissions.setGmPercentage(2500)

      await waitForNextCycle()

      // Distribute emissions
      await emissions.connect(minterAccount).distribute()

      // Check supply
      expect(await b3tr.totalSupply()).to.equal(ethers.parseEther("13750000"))
      expect(await b3tr.balanceOf(await emissions.xAllocations())).to.equal(ethers.parseEther("4000000")) // 2Mill (Cycle 1) + 2Mill (Cycle 2)
      expect(await b3tr.balanceOf(await emissions.vote2Earn())).to.equal(ethers.parseEther("4250000")) // 2Mill (Cycle 1) + 2Mill (Cycle 2) + 250000 (GM Pool, Cycle 2)
      expect(await b3tr.balanceOf(await emissions.treasury())).to.equal(ethers.parseEther("1750000")) // 1Mill (Cycle 1) + 750000 (75% of Treasury, Cycle 2)
      expect(await b3tr.balanceOf(config.MIGRATION_ADDRESS)).to.equal(config.MIGRATION_AMOUNT)

      // Move to after first Rewards decay period
      const cycle = config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD + 2
      await moveToCycle(cycle)

      expect(await emissions.nextCycle()).to.equal(cycle)

      await waitForNextCycle()

      const xAllocationsAmount = await emissions.getXAllocationAmount(cycle)
      const vote2EarnAmount = await emissions.getVote2EarnAmount(cycle)
      const treasuryAmount = await emissions.getTreasuryAmount(cycle)
      const gmAmount = await emissions.getGMAmount(cycle)

      // ----------  Cycle 52  ---------- //
      // Check allocations after decay
      expect(xAllocationsAmount).to.equal(ethers.parseEther("1698693.12")) // (4% Decay every 12 cycles) -> 2,000,000 * (0.96 ^ 4) = 1,698,693.12
      expect(vote2EarnAmount).to.equal(ethers.parseEther("1358954.496")) //  (20% decay every 50 cycles) -> 1,698,693.12 * (0.8 ^ 1) = 1,358,954.496
      expect(treasuryAmount).to.equal(ethers.parseEther("573308.928")) // 1698693.12 + 1358954.496 = 3057647.616 * 0.25 = 764411.904 (Full Treasury) * 0.75 (Portion after GM cut) = 573308.928
      expect(gmAmount).to.equal(ethers.parseEther("191102.976")) // 764411.904 * 0.25 = 191102.976

      // Check supply
      expect(await b3tr.balanceOf(await emissions.xAllocations())).to.equal(ethers.parseEther("95488143.36"))
      expect(await b3tr.balanceOf(await emissions.vote2Earn())).to.equal(ethers.parseEther("106813188.992"))
      expect(await b3tr.balanceOf(await emissions.treasury())).to.equal(ethers.parseEther("35994352.768"))
      expect(await b3tr.totalSupply()).to.equal(ethers.parseEther("242045685.12"))
    }).timeout(1000 * 60 * 10) // 10 minutes

    it("Should not be able to start emissions if not minter", async () => {
      const { emissions, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await catchRevert(emissions.connect(otherAccount).start())
    })

    it.skip(
      "Should be able to perform all cycles till reaching B3TR supply cap and GM pool percentage is 0%",
      async function () {
        if (network.name !== "hardhat") {
          console.log(`\nThe test "${this?.test?.title}" is only supported on hardhat network. Skipping...\n`)
          return
        }
        const config = createTestConfig()
        config.GM_PERCENTAGE_OF_TREASURY = 0
        const { emissions, b3tr, minterAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
          config,
        })

        // Bootstrap emissions
        await bootstrapEmissions()

        // Start emissions
        await emissions.connect(minterAccount).start()

        // Variables to hold calculated amounts for assertions
        let xAllocationsAmount = BigInt(0)
        let vote2EarnAmount = BigInt(0)
        let treasuryAmount = BigInt(0)
        let gmAmount = BigInt(0)
        let _totalEmissions = config.MIGRATION_AMOUNT
        const cap = await b3tr.cap()

        const b3trAllocations = await generateB3trAllocations(config, "./test/fixture/full-allocations.json")
        // const b3trAllocations = await generateB3trAllocations(config)

        // Loop through all cycles as simulated in the b3tr emissions spreadsheet
        for (let i = 0; i < b3trAllocations.length; i++) {
          await waitForNextCycle()

          const allocations = b3trAllocations[i]

          // Calculate decayed amounts
          xAllocationsAmount = await emissions.getXAllocationAmount(allocations.cycle)
          vote2EarnAmount = await emissions.getVote2EarnAmount(allocations.cycle)
          treasuryAmount = await emissions.getTreasuryAmount(allocations.cycle)
          expect(await emissions.getGMAmount(allocations.cycle)).to.equal(0n)
          const totalEmissionsFromContract = await emissions.totalEmissions()
          _totalEmissions = _totalEmissions + xAllocationsAmount + vote2EarnAmount + treasuryAmount
          const remainingEmissionsFromContract = await emissions.getRemainingEmissions()

          // Log the cycle and amounts for debugging
          // Uncomment to view the emissions for each cycle
          // console.log(
          //   `Cycle ${allocations.cycle}: XAllocations = ${ethers.formatEther(xAllocationsAmount)}, Vote2Earn = ${ethers.formatEther(vote2EarnAmount)}`,
          //   `Treasury = ${ethers.formatEther(treasuryAmount)} Total Emissions = ${ethers.formatEther(totalEmissionsFromContract)} Remaining Emissions = ${ethers.formatEther(remainingEmissionsFromContract)}`,
          // )

          // Assert the calculated amounts match the expected amounts from the spreadsheet
          expect(xAllocationsAmount).to.equal(allocations.xAllocation)
          expect(vote2EarnAmount).to.equal(allocations.vote2EarnAllocation)
          expect(treasuryAmount).to.equal(allocations.treasuryAllocation)
          expect(totalEmissionsFromContract).to.equal(_totalEmissions)
          expect(remainingEmissionsFromContract).to.equal(cap - totalEmissionsFromContract)

          // Don't distribute on the last cycle
          if (i >= b3trAllocations.length - 1) {
            // console.log(`Not distributing cycle ${allocations.cycle}`)
            continue
          }

          // console.log(`Distributing cycle ${allocations.cycle + 1}`)
          await emissions.distribute()

          expect(await emissions.getCurrentCycle()).to.equal(allocations.cycle + 1)
        }

        await catchRevert(emissions.connect(minterAccount).distribute()) // Should not be able to distribute more than the B3TR supply cap

        // Check supply
        expect(await b3tr.totalSupply()).to.equal(await emissions.totalEmissions()) // 999,884,045.14 B3TR
      },
    ).timeout(1000 * 60 * 5) // 5 minutes

    it.skip(
      "Should be able to perform all cycles till reaching B3TR supply cap with Emissions alignment",
      async function () {
        const config = createTestConfig()
        const { emissions, b3tr, minterAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
          config: {
            ...config,
            EMISSIONS_IS_NOT_ALIGNED: true,
            EMISSIONS_X_ALLOCATION_DECAY_PERIOD: 912, // Erroneous value to replicate mainnet configuration
          },
        })

        expect(await emissions.isEmissionsNotAligned()).to.equal(true)

        // Bootstrap emissions
        await bootstrapEmissions()

        // Start emissions
        await emissions.connect(minterAccount).start()

        // Variables to hold calculated amounts for assertions
        let xAllocationsAmount = BigInt(0)
        let vote2EarnAmount = BigInt(0)
        let treasuryAmount = BigInt(0)
        let _totalEmissions = config.MIGRATION_AMOUNT
        const cap = await b3tr.cap()

        const b3trAllocations = b3trAllocationsEmissionsDisaligned

        // Loop through all cycles as simulated in the b3tr emissions spreadsheet
        for (let i = 0; i < b3trAllocations.length; i++) {
          await waitForNextCycle()

          const allocations = b3trAllocations[i]

          // Calculate decayed amounts
          xAllocationsAmount = await emissions.getXAllocationAmount(allocations.cycle)
          vote2EarnAmount = await emissions.getVote2EarnAmount(allocations.cycle)
          treasuryAmount = await emissions.getTreasuryAmount(allocations.cycle)
          const totalEmissionsFromContract = await emissions.totalEmissions()
          _totalEmissions = _totalEmissions + xAllocationsAmount + vote2EarnAmount + treasuryAmount
          const remainingEmissionsFromContract = await emissions.getRemainingEmissions()

          // Log the cycle and amounts for debugging
          // Uncomment to view the emissions for each cycle
          // console.log(
          //   `Cycle ${allocations.cycle}: XAllocations = ${ethers.formatEther(xAllocationsAmount)}, Vote2Earn = ${ethers.formatEther(vote2EarnAmount)}`,
          //   `Treasury = ${ethers.formatEther(treasuryAmount)} Total Emissions = ${ethers.formatEther(totalEmissionsFromContract)} Remaining Emissions = ${ethers.formatEther(remainingEmissionsFromContract)}`,
          // )

          // Assert the calculated amounts match the expected amounts from the spreadsheet
          expect(xAllocationsAmount).to.equal(allocations.xAllocation)
          expect(vote2EarnAmount).to.equal(allocations.vote2EarnAllocation)
          expect(treasuryAmount).to.equal(allocations.treasuryAllocation)
          expect(totalEmissionsFromContract).to.equal(_totalEmissions)
          expect(remainingEmissionsFromContract).to.equal(cap - totalEmissionsFromContract)

          // Don't distribute on the last cycle
          if (i >= b3trAllocations.length - 1) {
            // console.log(`Not distributing cycle ${allocations.cycle}`)
            continue
          }

          // console.log(`Distributing cycle ${allocations.cycle + 1}`)
          await emissions.distribute()

          expect(await emissions.getCurrentCycle()).to.equal(allocations.cycle + 1)

          // Replicate mainnet transaction setting the correct decay period for the XAllocations
          if ((await emissions.getCurrentCycle()) === BigInt(13)) {
            await emissions.setXAllocationsDecayPeriod(12)
          }

          xAllocationsAmount = await emissions.getXAllocationAmount(allocations.cycle)
          vote2EarnAmount = await emissions.getVote2EarnAmount(allocations.cycle)
          treasuryAmount = await emissions.getTreasuryAmount(allocations.cycle)
          expect(xAllocationsAmount).to.equal(allocations.xAllocation)
          expect(vote2EarnAmount).to.equal(allocations.vote2EarnAllocation)
          expect(treasuryAmount).to.equal(allocations.treasuryAllocation)
        }

        await catchRevert(emissions.connect(minterAccount).distribute()) // Should not be able to distribute more than the B3TR supply cap

        // Check supply
        expect(await b3tr.totalSupply()).to.equal(await emissions.totalEmissions())

        console.log(`Total emissions: ${ethers.formatEther(await emissions.totalEmissions())}`)
      },
    ).timeout(1000 * 60 * 10) // 10 minutes

    it.skip(
      "Should be able to perform all cycles till reaching B3TR supply cap with GM Pool in cycle 44 added and GM Pool percentage is 25%",
      async function () {
        const config = createTestConfig()
        config.GM_PERCENTAGE_OF_TREASURY = 2500
        config.EMISSIONS_IS_NOT_ALIGNED = true
        config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD = 912 // Erroneous value to replicate mainnet configuration

        const { b3tr, minterAccount, xAllocationPool, voterRewards, treasury, owner, xAllocationVoting } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            config,
          })

        const emissions = (await deployAndUpgrade(
          ["EmissionsV1", "EmissionsV2"],
          [
            [
              {
                minter: minterAccount.address,
                admin: owner.address,
                upgrader: owner.address,
                contractsAddressManager: owner.address,
                decaySettingsManager: owner.address,
                b3trAddress: await b3tr.getAddress(),
                destinations: [
                  await xAllocationPool.getAddress(),
                  await voterRewards.getAddress(),
                  await treasury.getAddress(),
                  config.MIGRATION_ADDRESS,
                ],
                initialXAppAllocation: config.INITIAL_X_ALLOCATION,
                cycleDuration: config.EMISSIONS_CYCLE_DURATION,
                decaySettings: [
                  config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
                  config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
                  config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
                  config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
                ],
                treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
                maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
                migrationAmount: config.MIGRATION_AMOUNT,
              },
            ],
            [config.EMISSIONS_IS_NOT_ALIGNED],
          ],
          {
            versions: [undefined, 2],
            logOutput: false,
          },
        )) as EmissionsV2

        await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

        await emissions.setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

        await xAllocationVoting
          .connect(owner)
          .grantRole(await xAllocationVoting.ROUND_STARTER_ROLE(), await emissions.getAddress())

        // Bootstrap emissions

        expect(await emissions.isEmissionsNotAligned()).to.equal(true)

        // Bootstrap emissions
        await emissions.connect(minterAccount).bootstrap()

        // Start emissions
        await emissions.connect(minterAccount).start()

        // Variables to hold calculated amounts for assertions
        let xAllocationsAmount = BigInt(0)
        let vote2EarnAmount = BigInt(0)
        let treasuryAmount = BigInt(0)
        let gmAmount = BigInt(0)
        let _totalEmissions = config.MIGRATION_AMOUNT
        const cap = await b3tr.cap()

        const b3trAllocations = b3trAllocationsGMPool

        // Loop through all cycles as simulated in the b3tr emissions spreadsheet
        for (let i = 0; i < 42; i++) {
          const blockNextCycle = await emissions.getNextCycleBlock()
          await waitForBlock(Number(blockNextCycle))

          const allocations = b3trAllocations[i]

          // Calculate decayed amounts
          xAllocationsAmount = await emissions.getXAllocationAmount(allocations.cycle)
          vote2EarnAmount = await emissions.getVote2EarnAmount(allocations.cycle)
          treasuryAmount = await emissions.getTreasuryAmount(allocations.cycle)
          const totalEmissionsFromContract = await emissions.totalEmissions()
          _totalEmissions = _totalEmissions + xAllocationsAmount + vote2EarnAmount + treasuryAmount
          const remainingEmissionsFromContract = await emissions.getRemainingEmissions()

          // Log the cycle and amounts for debugging
          // Uncomment to view the emissions for each cycle
          // console.log(
          //   `Cycle ${allocations.cycle}: XAllocations = ${ethers.formatEther(xAllocationsAmount)}, Vote2Earn = ${ethers.formatEther(vote2EarnAmount)}`,
          //   `Treasury = ${ethers.formatEther(treasuryAmount)} Total Emissions = ${ethers.formatEther(totalEmissionsFromContract)} Remaining Emissions = ${ethers.formatEther(remainingEmissionsFromContract)}`,
          // )

          // Assert the calculated amounts match the expected amounts from the spreadsheet
          expect(xAllocationsAmount).to.equal(allocations.xAllocation)
          expect(vote2EarnAmount).to.equal(allocations.vote2EarnAllocation)
          expect(treasuryAmount).to.equal(allocations.treasuryAllocation)
          expect(totalEmissionsFromContract).to.equal(_totalEmissions)
          expect(remainingEmissionsFromContract).to.equal(cap - totalEmissionsFromContract)

          await emissions.distribute()

          expect(await emissions.getCurrentCycle()).to.equal(allocations.cycle + 1)

          // Replicate mainnet transaction setting the correct decay period for the XAllocations
          if ((await emissions.getCurrentCycle()) === BigInt(13)) {
            await emissions.setXAllocationsDecayPeriod(12)
          }

          xAllocationsAmount = await emissions.getXAllocationAmount(allocations.cycle)
          vote2EarnAmount = await emissions.getVote2EarnAmount(allocations.cycle)
          treasuryAmount = await emissions.getTreasuryAmount(allocations.cycle)
          expect(xAllocationsAmount).to.equal(allocations.xAllocation)
          expect(vote2EarnAmount).to.equal(allocations.vote2EarnAllocation)
          expect(treasuryAmount).to.equal(allocations.treasuryAllocation)
        }

        // Next cycle should be 44
        expect(await emissions.getCurrentCycle()).to.equal(43)
        // Upgrade contract
        const emissionsV3 = (await upgradeProxy(
          "EmissionsV2",
          "Emissions",
          await emissions.getAddress(),
          [config.GM_PERCENTAGE_OF_TREASURY],
          {
            version: 3,
          },
        )) as unknown as Emissions

        expect(await emissionsV3.version()).to.equal("3")

        const allocations = b3trAllocations[42]

        // Calculate decayed amounts
        xAllocationsAmount = await emissionsV3.getXAllocationAmount(allocations.cycle)
        vote2EarnAmount = await emissionsV3.getVote2EarnAmount(allocations.cycle)
        treasuryAmount = await emissionsV3.getTreasuryAmount(allocations.cycle)
        gmAmount = await emissionsV3.getGMAmount(allocations.cycle)
        expect(gmAmount).to.equal(0n)
        const totalEmissionsFromContract = await emissionsV3.totalEmissions()
        _totalEmissions = _totalEmissions + xAllocationsAmount + vote2EarnAmount + treasuryAmount + gmAmount
        const remainingEmissionsFromContract = await emissionsV3.getRemainingEmissions()

        // Move to next cycle as GM will kick in next cycle
        let blockNextCycle = await emissionsV3.getNextCycleBlock()
        await waitForBlock(Number(blockNextCycle))

        // Distribute emissions
        await emissionsV3.connect(minterAccount).distribute()

        // Loop through all cycles as simulated in the b3tr emissions spreadsheet
        for (let i = 43; i < b3trAllocations.length; i++) {
          const allocations = b3trAllocations[i]

          // Calculate decayed amounts
          xAllocationsAmount = await emissionsV3.getXAllocationAmount(allocations.cycle)
          vote2EarnAmount = await emissionsV3.getVote2EarnAmount(allocations.cycle)
          treasuryAmount = await emissionsV3.getTreasuryAmount(allocations.cycle)
          gmAmount = await emissionsV3.getGMAmount(allocations.cycle)
          const totalEmissionsFromContract = await emissionsV3.totalEmissions()
          _totalEmissions = _totalEmissions + xAllocationsAmount + vote2EarnAmount + treasuryAmount + gmAmount
          const remainingEmissionsFromContract = await emissionsV3.getRemainingEmissions()

          // Log the cycle and amounts for debugging
          // Uncomment to view the emissions for each cycle
          // console.log(
          //   `Cycle ${allocations.cycle}: XAllocations = ${ethers.formatEther(xAllocationsAmount)}, Vote2Earn = ${ethers.formatEther(vote2EarnAmount)}`,
          //   `Treasury = ${ethers.formatEther(treasuryAmount)} Total Emissions = ${ethers.formatEther(totalEmissionsFromContract)} Remaining Emissions = ${ethers.formatEther(remainingEmissionsFromContract)}`,
          // )

          // Assert the calculated amounts match the expected amounts from the spreadsheet
          expect(xAllocationsAmount).to.equal(allocations.xAllocation)
          expect(vote2EarnAmount).to.equal(allocations.vote2EarnAllocation)
          expect(treasuryAmount).to.equal(allocations.treasuryAllocation)
          expect(gmAmount).to.equal(allocations.gmAllocation)
          expect(totalEmissionsFromContract).to.equal(_totalEmissions)
          expect(remainingEmissionsFromContract).to.equal(cap - totalEmissionsFromContract)

          // Don't distribute on the last cycle
          if (i >= b3trAllocations.length - 1) {
            // console.log(`Not distributing cycle ${allocations.cycle}`)
            continue
          }

          blockNextCycle = await emissionsV3.getNextCycleBlock()
          await waitForBlock(Number(blockNextCycle))

          await emissionsV3.distribute()

          expect(await emissionsV3.getCurrentCycle()).to.equal(allocations.cycle + 1)

          xAllocationsAmount = await emissionsV3.getXAllocationAmount(allocations.cycle)
          vote2EarnAmount = await emissionsV3.getVote2EarnAmount(allocations.cycle)
          treasuryAmount = await emissionsV3.getTreasuryAmount(allocations.cycle)
          gmAmount = await emissionsV3.getGMAmount(allocations.cycle)

          expect(xAllocationsAmount).to.equal(allocations.xAllocation)
          expect(vote2EarnAmount).to.equal(allocations.vote2EarnAllocation)
          expect(treasuryAmount).to.equal(allocations.treasuryAllocation)
          expect(gmAmount).to.equal(allocations.gmAllocation)
        }

        await catchRevert(emissions.connect(minterAccount).distribute()) // Should not be able to distribute more than the B3TR supply cap

        // Check supply
        expect(await b3tr.totalSupply()).to.equal(await emissions.totalEmissions())

        console.log(`Total emissions: ${ethers.formatEther(await emissions.totalEmissions())}`)
      },
    ).timeout(1000 * 60 * 10) // 10 minutes

    it("Should not be able to distribute if cycle is not ready", async () => {
      const { emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Start emissions
      await emissions.connect(minterAccount).start()

      await waitForNextCycle()

      // Distribute emissions
      await emissions.connect(minterAccount).distribute()

      await catchRevert(emissions.connect(minterAccount).distribute())
    })

    it("Should be able to perform emissions also after the next cycle block", async () => {
      const { emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Start emissions
      await emissions.connect(minterAccount).start()

      await waitForNextCycle()

      // Distribute emissions
      await emissions.connect(minterAccount).distribute()

      await waitForNextCycle()

      await waitForBlock(10) // Simulate a delay of 10 blocks before distributing the next cycle

      await emissions.connect(minterAccount).distribute()

      expect(await emissions.getCurrentCycle()).to.equal(3)

      await waitForNextCycle()

      await emissions.connect(minterAccount).distribute()
    })

    it("Should not be able to distribute emissions if emissions not started", async () => {
      const { emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(emissions.connect(minterAccount).distribute())
    })
  })
})
