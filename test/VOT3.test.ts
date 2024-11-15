import { assert, ethers } from "hardhat"
import { expect } from "chai"
import { ZERO_ADDRESS, catchRevert, getOrDeployContractInstances, getVot3Tokens } from "./helpers"
import { describe, it } from "mocha"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { deployProxy } from "../scripts/helpers"

describe("VOT3 - @shard6", function () {
  describe("Deployment", function () {
    it("should deploy the contract", async function () {
      const { vot3 } = await getOrDeployContractInstances({ forceDeploy: false })
      await vot3.waitForDeployment()
      const address = await vot3.getAddress()

      expect(address).not.to.eql(undefined)
    })

    it("should have the correct name", async function () {
      const { vot3 } = await getOrDeployContractInstances({ forceDeploy: false })

      const res = await vot3.name()
      expect(res).to.eql("VOT3")

      const res2 = await vot3.symbol()
      expect(res2).to.eql("VOT3")
    })

    it("admin role is set correctly upon deploy", async function () {
      const { vot3, owner } = await getOrDeployContractInstances({ forceDeploy: false })

      const defaultAdminRole = await vot3.DEFAULT_ADMIN_ROLE()

      const res = await vot3.hasRole(defaultAdminRole, owner)
      expect(res).to.eql(true)
    })

    it("Only admin should be able to pause and unpause VOT3 contract", async function () {
      const { vot3, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await vot3.hasRole(await vot3.PAUSER_ROLE(), owner.address)).to.eql(true)
      await vot3.connect(owner).pause()
      await vot3.connect(owner).unpause()

      expect(await vot3.hasRole(await vot3.PAUSER_ROLE(), otherAccount.address)).to.eql(false)
      await catchRevert(vot3.connect(otherAccount).pause())
      await catchRevert(vot3.connect(otherAccount).unpause())
    })

    it("Should be able to pause and unpause VOT3 contract", async function () {
      const { vot3, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await vot3.hasRole(await vot3.PAUSER_ROLE(), owner.address)).to.eql(true)
      expect(await vot3.hasRole(await vot3.PAUSER_ROLE(), otherAccount.address)).to.eql(false)

      await vot3.connect(owner).pause()

      await expect(vot3.connect(otherAccount).unpause()).to.be.reverted // only admin can unpause

      await vot3.connect(owner).unpause()

      await expect(vot3.connect(otherAccount).pause()).to.be.reverted // only admin can pause
    })

    it("Should be able to get nonces", async function () {
      const { vot3, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      await vot3.nonces(owner)
    })

    it("Should be able to get b3tr address", async function () {
      const { vot3, b3tr } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await vot3.b3tr()).to.eql(await b3tr.getAddress())
    })

    it("Should revert if B3TR is set to zero address in initilisation", async () => {
      const { owner } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(deployProxy("VOT3", [owner.address, owner.address, owner.address, ZERO_ADDRESS])).to.be.reverted
    })
    it("Should revert if admin is set to zero address in initilisation", async () => {
      const { owner, b3tr } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(deployProxy("VOT3", [ZERO_ADDRESS, owner.address, owner.address, await b3tr.getAddress()])).to.be
        .reverted
    })
  })

  describe("Contract upgradeablity", () => {
    it("Admin should be able to upgrade the contract", async function () {
      const { vot3, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("VOT3")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await vot3.getAddress())

      const UPGRADER_ROLE = await vot3.UPGRADER_ROLE()
      expect(await vot3.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(vot3.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be.reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await vot3.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only admin should be able to upgrade the contract", async function () {
      const { vot3, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("VOT3")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await vot3.getAddress())

      const UPGRADER_ROLE = await vot3.UPGRADER_ROLE()
      expect(await vot3.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(vot3.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.be.reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await vot3.getAddress())

      expect(newImplAddress.toUpperCase()).to.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.not.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Admin can change UPGRADER_ROLE", async function () {
      const { vot3, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("VOT3")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await vot3.getAddress())

      const UPGRADER_ROLE = await vot3.UPGRADER_ROLE()
      expect(await vot3.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(vot3.connect(owner).grantRole(UPGRADER_ROLE, otherAccount.address)).to.not.be.reverted
      await expect(vot3.connect(owner).revokeRole(UPGRADER_ROLE, owner.address)).to.not.be.reverted

      await expect(vot3.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await vot3.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Should not be able to initialize the contract after it has already been initialized", async function () {
      const { vot3, owner, b3tr } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await expect(vot3.initialize(owner.address, owner.address, owner.address, await b3tr.getAddress())).to.be.reverted // already initialized
    })

    it("Should return correct version of the contract", async () => {
      const { vot3 } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await vot3.version()).to.equal("1")
    })
  })

  describe("Lock B3TR", function () {
    it("should lock B3TR and mint VOT3", async function () {
      const { b3tr, vot3, minterAccount, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR
      await expect(b3tr.connect(minterAccount).mint(otherAccount, ethers.parseEther("1000"))).not.to.be.reverted

      // Approve VOT3 to spend B3TR on behalf of otherAccount. N.B. this is an important step and could be included in a multi clause transaction
      await expect(b3tr.connect(otherAccount).approve(await vot3.getAddress(), ethers.parseEther("9"))).not.to.be
        .reverted

      // Lock B3TR to get VOT3
      await expect(vot3.connect(otherAccount).convertToVOT3(ethers.parseEther("9"))).not.to.be.reverted

      // Check balances
      expect(await b3tr.balanceOf(otherAccount)).to.eql(ethers.parseEther("991"))
      expect(await b3tr.balanceOf(await vot3.getAddress())).to.eql(ethers.parseEther("9"))
      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("9"))
      expect(await vot3.convertedB3trOf(otherAccount)).to.eql(ethers.parseEther("9"))
    })

    it("should not lock B3TR if not enough B3TR approved", async function () {
      const { b3tr, vot3, minterAccount, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR
      await expect(b3tr.connect(minterAccount).mint(otherAccount, ethers.parseEther("1000"))).not.to.be.reverted

      // Approve VOT3 to spend B3TR on behalf of otherAccount. N.B. this is an important step and could be included in a multi clause transaction
      await expect(b3tr.connect(otherAccount).approve(await vot3.getAddress(), ethers.parseEther("9"))).not.to.be
        .reverted

      // Lock B3TR to get VOT3
      await catchRevert(vot3.convertToVOT3(ethers.parseEther("10")))
    })

    it("Should not be able to lock B3TR if VOT3 contract is paused", async function () {
      const { b3tr, vot3, minterAccount, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Mint some B3TR
      await expect(b3tr.connect(minterAccount).mint(otherAccount, ethers.parseEther("1000"))).not.to.be.reverted

      // Approve VOT3 to spend B3TR on behalf of otherAccount. N.B. this is an important step and could be included in a multi clause transaction
      await expect(b3tr.connect(otherAccount).approve(await vot3.getAddress(), ethers.parseEther("9"))).not.to.be
        .reverted

      // Pause VOT3
      await vot3.connect(owner).pause()

      // Lock B3TR to get VOT3
      await catchRevert(vot3.connect(otherAccount).convertToVOT3(ethers.parseEther("9")))

      // Unpause VOT3
      await vot3.connect(owner).unpause()

      // Lock B3TR to get VOT3
      await expect(vot3.connect(otherAccount).convertToVOT3(ethers.parseEther("9"))).not.to.be.reverted
    })
  })

  describe("Unlock B3TR", function () {
    it("should burn VOT3 and unlock B3TR", async function () {
      const { b3tr, vot3, minterAccount, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      const vot3Address = await vot3.getAddress()

      // Mint some B3TR
      await expect(b3tr.connect(minterAccount).mint(otherAccount, ethers.parseEther("1000"))).not.to.be.reverted

      // Approve VOT3 to spend B3TR on behalf of otherAccount. N.B. this is an important step and could be included in a multi clause transaction
      await expect(b3tr.connect(otherAccount).approve(vot3Address, ethers.parseEther("9"))).not.to.be.reverted

      // Lock B3TR to get VOT3
      await expect(vot3.connect(otherAccount).convertToVOT3(ethers.parseEther("9"))).not.to.be.reverted

      // Check balances
      expect(await b3tr.balanceOf(otherAccount)).to.eql(ethers.parseEther("991"))
      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("9"))
      expect(await vot3.convertedB3trOf(otherAccount)).to.eql(ethers.parseEther("9"))
      expect(await b3tr.balanceOf(vot3Address)).to.eql(ethers.parseEther("9"))

      // Unlock B3TR to burn VOT3
      await expect(vot3.connect(otherAccount).convertToB3TR(ethers.parseEther("9"), { gasLimit: 10_000_000 })).not.to.be
        .reverted

      // Check balances
      expect(await b3tr.balanceOf(otherAccount)).to.eql(ethers.parseEther("1000"))
      expect(await b3tr.balanceOf(vot3Address)).to.eql(ethers.parseEther("0"))
      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.convertedB3trOf(otherAccount)).to.eql(ethers.parseEther("0"))
    })

    it("should not unlock B3TR if not enough VOT3", async function () {
      const { b3tr, vot3, minterAccount, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR
      await expect(b3tr.connect(minterAccount).mint(otherAccount, ethers.parseEther("1000"))).not.to.be.reverted

      // Approve VOT3 to spend B3TR on behalf of otherAccount. N.B. this is an important step and could be included in a multi clause transaction
      await expect(b3tr.connect(otherAccount).approve(await vot3.getAddress(), ethers.parseEther("9"))).not.to.be
        .reverted

      // Lock B3TR to get VOT3
      await expect(vot3.connect(otherAccount).convertToVOT3(ethers.parseEther("9"), { gasLimit: 10_000_000 })).not.to.be
        .reverted

      // Check balances
      expect(await b3tr.balanceOf(otherAccount)).to.eql(ethers.parseEther("991"))
      expect(await b3tr.balanceOf(await vot3.getAddress())).to.eql(ethers.parseEther("9"))
      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("9"))
      expect(await vot3.convertedB3trOf(otherAccount)).to.eql(ethers.parseEther("9"))

      // Unlock B3TR to burn VOT3
      await catchRevert(vot3.connect(otherAccount).convertToB3TR(ethers.parseEther("10"), { gasLimit: 10_000_000 }))
    })

    it("should not unlock B3TR if not enough converted balance, even if there is enough VOT3 balance", async function () {
      const { b3tr, vot3, minterAccount, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Mint some B3TR to two accounts
      await expect(b3tr.connect(minterAccount).mint(otherAccount, ethers.parseEther("1000"))).not.to.be.reverted
      await expect(b3tr.connect(minterAccount).mint(otherAccounts[0], ethers.parseEther("1000"))).not.to.be.reverted

      // Approve VOT3 to spend B3TR on behalf of otherAccount. N.B. this is an important step and could be included in a multi clause transaction
      await expect(b3tr.connect(otherAccount).approve(await vot3.getAddress(), ethers.parseEther("7"))).not.to.be
        .reverted
      await expect(b3tr.connect(otherAccounts[0]).approve(await vot3.getAddress(), ethers.parseEther("8"))).not.to.be
        .reverted

      // Lock B3TR to get VOT3
      await expect(vot3.connect(otherAccount).convertToVOT3(ethers.parseEther("7"), { gasLimit: 10_000_000 })).not.to.be
        .reverted
      await expect(vot3.connect(otherAccounts[0]).convertToVOT3(ethers.parseEther("8"), { gasLimit: 10_000_000 })).not
        .to.be.reverted

      // Check balances
      expect(await b3tr.balanceOf(await vot3.getAddress())).to.eql(ethers.parseEther("15"))

      expect(await b3tr.balanceOf(otherAccount)).to.eql(ethers.parseEther("993"))
      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("7"))
      expect(await vot3.convertedB3trOf(otherAccount)).to.eql(ethers.parseEther("7"))

      expect(await b3tr.balanceOf(otherAccounts[0])).to.eql(ethers.parseEther("992"))
      expect(await vot3.balanceOf(otherAccounts[0])).to.eql(ethers.parseEther("8"))
      expect(await vot3.convertedB3trOf(otherAccounts[0])).to.eql(ethers.parseEther("8"))

      // Transfer VOT3 from otherAccounts[0] to otherAccount
      await expect(
        vot3.connect(otherAccounts[0]).transfer(otherAccount, ethers.parseEther("2"), { gasLimit: 10_000_000 }),
      ).not.to.be.reverted

      // Check balances
      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("9"))
      expect(await vot3.convertedB3trOf(otherAccount)).to.eql(ethers.parseEther("7"))

      expect(await vot3.balanceOf(otherAccounts[0])).to.eql(ethers.parseEther("6"))
      expect(await vot3.convertedB3trOf(otherAccounts[0])).to.eql(ethers.parseEther("8"))

      // Attempt to unlock 8 VOT3 from otherAccount
      await catchRevert(vot3.connect(otherAccount).convertToB3TR(ethers.parseEther("8"), { gasLimit: 10_000_000 }))

      // Finally unlock 7 VOT3 from otherAccount
      await expect(vot3.connect(otherAccount).convertToB3TR(ethers.parseEther("7"), { gasLimit: 10_000_000 })).not.to.be
        .reverted
    })

    it("Should not be able to unlock B3TR if VOT3 transfers are paused", async function () {
      const { b3tr, vot3, minterAccount, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Mint some B3TR
      await expect(b3tr.connect(minterAccount).mint(otherAccount, ethers.parseEther("1000"))).not.to.be.reverted

      // Approve VOT3 to spend B3TR on behalf of otherAccount. N.B. this is an important step and could be included in a multi clause transaction
      await expect(b3tr.connect(otherAccount).approve(await vot3.getAddress(), ethers.parseEther("9"))).not.to.be
        .reverted

      // Lock B3TR to get VOT3
      await expect(vot3.connect(otherAccount).convertToVOT3(ethers.parseEther("9"), { gasLimit: 10_000_000 })).not.to.be
        .reverted

      // Pause VOT3
      await vot3.connect(owner).pause()

      // Unlock B3TR to burn VOT3
      await catchRevert(vot3.connect(otherAccount).convertToB3TR(ethers.parseEther("9"), { gasLimit: 10_000_000 }))

      // Unpause VOT3
      await vot3.connect(owner).unpause()

      // Unlock B3TR to burn VOT3
      await expect(vot3.connect(otherAccount).convertToB3TR(ethers.parseEther("9"), { gasLimit: 10_000_000 })).not.to.be
        .reverted
    })
  })

  describe("Delegation", function () {
    it("User that never owned VOT3 should have 0 voting rights and no delegation set", async function () {
      const { vot3, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.delegates(otherAccount)).to.eql("0x0000000000000000000000000000000000000000")
    })

    it("Self-delegation should be automatic upon swapping B3TR for VOT3", async function () {
      const { vot3, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(otherAccount, "1000")

      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("1000"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("1000"))
      expect(await vot3.delegates(otherAccount)).to.eql(otherAccount.address)
    })

    it("Self-delegation should be automatic upon receiving VOT3 from another user", async function () {
      const { vot3, minterAccount, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(minterAccount, "1000")

      // user has no VOT3 and no delegation
      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.delegates(otherAccount)).to.eql("0x0000000000000000000000000000000000000000")

      // transfer
      await vot3.connect(minterAccount).transfer(otherAccount, ethers.parseEther("1"))

      // check that delegation was automatic
      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("1"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("1"))
      expect(await vot3.delegates(otherAccount)).to.eql(otherAccount.address)
    })

    it("Vote power is being tracked correctly", async function () {
      const { vot3, minterAccount, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(otherAccount, "1000")

      // Initial state: 1000 VOT3, 1000 voting power, self-delegated
      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("1000"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("1000"))
      expect(await vot3.delegates(otherAccount)).to.eql(otherAccount.address)

      // transfer
      let tx = await vot3
        .connect(otherAccount)
        .transfer(minterAccount, ethers.parseEther("1"), { gasLimit: 10_000_000 })
      const receipt = await tx.wait()
      if (!receipt) assert.fail("No receipt")

      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("999"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("999"))
      expect(await vot3.delegates(otherAccount)).to.eql(otherAccount.address)

      expect(await vot3.getPastVotes(otherAccount, receipt.blockNumber - 1)).to.eql(ethers.parseEther("1000"))

      // transfer back
      await vot3.connect(minterAccount).transfer(otherAccount, ethers.parseEther("1"), { gasLimit: 10_000_000 })

      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("1000"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("1000"))
      expect(await vot3.delegates(otherAccount)).to.eql(otherAccount.address)

      // convertToB3TR
      await vot3.connect(otherAccount).convertToB3TR(ethers.parseEther("1000"), { gasLimit: 10_000_000 })

      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.delegates(otherAccount)).to.eql(otherAccount.address)

      // we should not count voting power for the VOT3 contract itself
      expect(await vot3.delegates(await vot3.getAddress())).to.eql("0x0000000000000000000000000000000000000000")
    })

    it("Automatic self-delegation should be triggered only once", async function () {
      const { vot3, b3tr, minterAccount, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Mint some B3TR
      await b3tr.connect(minterAccount).mint(otherAccount, ethers.parseEther("1000"))

      // Approve VOT3 to spend B3TR on behalf of otherAccount. N.B. this is an important step and could be included in a multi clause transaction
      await b3tr.connect(otherAccount).approve(await vot3.getAddress(), ethers.parseEther("1000"))

      // Lock B3TR to get VOT3
      const tx = await vot3.connect(otherAccount).convertToVOT3(ethers.parseEther("1000"))
      let receipt = await tx.wait()

      let events = receipt?.logs
      if (!events) assert.fail("No events")

      // DelegateChanged event should be emitted
      let delegateChangedEvents = events.filter(
        (event: any) => event.fragment && event.fragment.name === "DelegateChanged",
      )
      expect(delegateChangedEvents).not.to.eql([])

      // Now if I do it again, it should not emit the event because it's already delegated to itself
      await b3tr.connect(minterAccount).mint(otherAccount, ethers.parseEther("1000"))
      await b3tr.connect(otherAccount).approve(await vot3.getAddress(), ethers.parseEther("1000"))
      const secondTx = await vot3.connect(otherAccount).convertToVOT3(ethers.parseEther("1000"))
      receipt = await secondTx.wait()

      events = receipt?.logs
      if (!events) assert.fail("No events")

      // DelegateChanged event should not be emitted
      delegateChangedEvents = events.filter((event: any) => event.fragment && event.fragment.name === "DelegateChanged")
      expect(delegateChangedEvents).to.eql([])
    })

    it("Delegation to another user should still be possible", async function () {
      const { vot3, minterAccount, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(otherAccount, "1000")

      // delegate to another user
      await vot3.connect(otherAccount).delegate(minterAccount.address, { gasLimit: 10_000_000 })

      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("1000"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.delegates(otherAccount)).to.eql(minterAccount.address)

      expect(await vot3.balanceOf(minterAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.getVotes(minterAccount)).to.eql(ethers.parseEther("1000"))
    })

    it("Self delegation is not happening for the VOT3 contract itself", async function () {
      const { vot3, otherAccount } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(otherAccount, "1000")

      // delegate to another user
      await vot3.connect(otherAccount).convertToB3TR(ethers.parseEther("1000"), { gasLimit: 10_000_000 })

      expect(await vot3.getVotes(await vot3.getAddress())).to.eql(ethers.parseEther("0"))
    })

    it("Self delegation is not happening if interacting with another contract", async function () {
      const { vot3, otherAccount, b3tr } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(otherAccount, "1000")

      await vot3
        .connect(otherAccount)
        .transfer(await b3tr.getAddress(), ethers.parseEther("1"), { gasLimit: 10_000_000 })
      expect(await vot3.getVotes(await b3tr.getAddress())).to.eql(ethers.parseEther("0"))
    })

    it("Should not trigger self-delegation if VOT3 transfers are paused", async function () {
      const { vot3, otherAccount, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      // Pause VOT3
      await vot3.connect(owner).pause()

      // Mint some B3TR and Convert B3TR for VOT3
      await expect(vot3.connect(otherAccount).convertToVOT3(ethers.parseEther("1000"))).to.be.reverted

      // Unpause VOT3
      await vot3.connect(owner).unpause()

      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(otherAccount, "1000")

      // delegate to another user
      await vot3.connect(otherAccount).delegate(owner.address, { gasLimit: 10_000_000 })

      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("1000"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.delegates(otherAccount)).to.eql(owner.address)

      expect(await vot3.balanceOf(owner)).to.eql(ethers.parseEther("0"))
      expect(await vot3.getVotes(owner)).to.eql(ethers.parseEther("1000"))
    })

    it("Should not be able to delegate voting power if VOT3 transfers are paused", async function () {
      const { vot3, otherAccount, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(otherAccount, "1000")

      // Pause VOT3
      await vot3.connect(owner).pause()

      // delegate to another user
      await catchRevert(vot3.connect(otherAccount).delegate(owner.address, { gasLimit: 10_000_000 }))

      // Unpause VOT3
      await vot3.connect(owner).unpause()

      // delegate to another user
      await vot3.connect(otherAccount).delegate(owner.address, { gasLimit: 10_000_000 })

      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("1000"))
      expect(await vot3.getVotes(otherAccount)).to.eql(ethers.parseEther("0"))
      expect(await vot3.delegates(otherAccount)).to.eql(owner.address)

      expect(await vot3.balanceOf(owner)).to.eql(ethers.parseEther("0"))
      expect(await vot3.getVotes(owner)).to.eql(ethers.parseEther("1000"))
    })
  })

  describe("Voting power", function () {
    let vot3Contract: any
    let other: any
    let accounts: any
    this.beforeAll(async function () {
      const { vot3, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      vot3Contract = vot3
      other = otherAccount
      accounts = otherAccounts
    })
    it("Voting power should be the square root of the amount of vote", async function () {
      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(other, "1000")

      // Initial state: 1000 VOT3, 1000 voting power, self-delegated
      expect(await vot3Contract.balanceOf(other)).to.eql(ethers.parseEther("1000"))
      //scale down by 1e9 as sqrt of 10^18 is 10^9
      expect(await vot3Contract.getQuadraticVotingPower(other)).to.eql(ethers.parseEther("31.622776601"))
    })
    it("Voting power should be the square root of the amount of delegated votes", async function () {
      await getVot3Tokens(accounts[1], "9")
      await getVot3Tokens(accounts[2], "7")

      expect(await vot3Contract.balanceOf(accounts[1])).to.eql(ethers.parseEther("9"))
      expect(await vot3Contract.balanceOf(accounts[2])).to.eql(ethers.parseEther("7"))

      // delegate to another user
      await vot3Contract.connect(accounts[1]).delegate(accounts[2].address, { gasLimit: 10_000_000 })

      // Initial state: 7 VOT3, recived 9 delegated VOT3s, 16 VOT3s in total and 4 voting power
      expect(await vot3Contract.getVotes(accounts[2])).to.eql(ethers.parseEther("16"))
      expect(await vot3Contract.getQuadraticVotingPower(accounts[2])).to.eql(ethers.parseEther("4"))
    })
    it("Should be able to get past voting power", async function () {
      await getVot3Tokens(accounts[3], "50000")

      // Initial state: 50000 VOT3, sqrt(50000) voting power, self-delegated
      expect(await vot3Contract.balanceOf(accounts[3])).to.eql(ethers.parseEther("50000"))
      expect(await vot3Contract.getQuadraticVotingPower(accounts[3])).to.eql(ethers.parseEther("223.606797749"))

      // Transfer to another account
      const tx = await vot3Contract.connect(accounts[3]).transfer(accounts[4].address, ethers.parseEther("10000"))
      const receipt = await tx.wait()

      // 40000 VOT3, sqrt(40000) voting power, self-delegated
      expect(await vot3Contract.balanceOf(accounts[3])).to.eql(ethers.parseEther("40000"))
      expect(await vot3Contract.getQuadraticVotingPower(accounts[3])).to.eql(ethers.parseEther("200"))

      // Voting power should be the same as before the transfer
      expect(await vot3Contract.getPastQuadraticVotingPower(accounts[3], receipt.blockNumber - 1)).to.eql(
        ethers.parseEther("223.606797749"),
      )
    })
  })

  describe("Transferring", function () {
    it("Should be able to transfer VOT3", async function () {
      const { vot3, otherAccount, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(otherAccount, "1000")

      // transfer
      await vot3.connect(otherAccount).transfer(owner.address, ethers.parseEther("1"))

      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("999"))
      expect(await vot3.balanceOf(owner)).to.eql(ethers.parseEther("1"))
    })

    it("Should be able to approve and transferFrom VOT3", async function () {
      const { vot3, otherAccount, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      // Mint some B3TR and Convert B3TR for VOT3
      await getVot3Tokens(otherAccount, "1000")

      // approve
      await vot3.connect(otherAccount).approve(owner.address, ethers.parseEther("1"))

      // transferFrom
      await vot3.connect(owner).transferFrom(otherAccount.address, owner.address, ethers.parseEther("1"))

      expect(await vot3.balanceOf(otherAccount)).to.eql(ethers.parseEther("999"))
      expect(await vot3.balanceOf(owner)).to.eql(ethers.parseEther("1"))
    })
  })
})
