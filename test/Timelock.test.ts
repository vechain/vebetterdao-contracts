import { ethers } from "hardhat"
import { expect } from "chai"
import { catchRevert, getOrDeployContractInstances } from "./helpers"
import { describe, it } from "mocha"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"

// Tests about queueing and executing proposals are in the Governance.test.ts file
describe("TimeLock - @shard6", function () {
  describe("Contract upgradeablity", () => {
    it("Admin should be able to upgrade the contract", async function () {
      const { timeLock, timelockAdmin } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("TimeLock")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await timeLock.getAddress())

      const UPGRADER_ROLE = await timeLock.UPGRADER_ROLE()
      expect(await timeLock.hasRole(UPGRADER_ROLE, timelockAdmin.address)).to.eql(true)

      await expect(timeLock.connect(timelockAdmin).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await timeLock.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only admin should be able to upgrade the contract", async function () {
      const { timeLock, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("TimeLock")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await timeLock.getAddress())

      const UPGRADER_ROLE = await timeLock.UPGRADER_ROLE()
      expect(await timeLock.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(timeLock.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await timeLock.getAddress())

      expect(newImplAddress.toUpperCase()).to.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.not.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Admin can change UPGRADER_ROLE", async function () {
      const { timeLock, timelockAdmin, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("TimeLock")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await timeLock.getAddress())

      const UPGRADER_ROLE = await timeLock.UPGRADER_ROLE()
      expect(await timeLock.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(timeLock.connect(timelockAdmin).grantRole(UPGRADER_ROLE, otherAccount.address)).to.not.be.reverted
      await expect(timeLock.connect(timelockAdmin).revokeRole(UPGRADER_ROLE, timelockAdmin.address)).to.not.be.reverted

      await expect(timeLock.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await timeLock.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Cannot initialize twice", async function () {
      const { owner, timeLock } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(timeLock.initialize(1, [], [], owner.address, owner.address))
    })

    it("Should return correct version of the contract", async () => {
      const { timeLock } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await timeLock.version()).to.equal("1")
    })
  })
})
