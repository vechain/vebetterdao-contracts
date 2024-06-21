import { ethers } from "hardhat"
import { expect } from "chai"
import { catchRevert, getOrDeployContractInstances } from "./helpers"
import { describe, it } from "mocha"
import { createLocalConfig } from "../config/contracts/envs/local"

describe("B3TR Token", function () {
  describe("Deployment", function () {
    it("should deploy the contract", async function () {
      const { b3tr } = await getOrDeployContractInstances({ forceDeploy: false })
      await b3tr.waitForDeployment()
      const address = await b3tr.getAddress()

      expect(address).not.to.eql(undefined)
    })

    it("should have the correct name", async function () {
      const { b3tr } = await getOrDeployContractInstances({ forceDeploy: false })

      const res = await b3tr.name()
      expect(res).to.eql("B3TR")

      const res2 = await b3tr.symbol()
      expect(res2).to.eql("B3TR")
    })

    it("should have the correct max supply", async function () {
      const config = createLocalConfig()
      const { b3tr } = await getOrDeployContractInstances({ forceDeploy: false, config })

      const cap = await b3tr.cap()
      expect(cap).to.eql(ethers.parseEther("1000243154"))
    })

    it("admin role is set correctly upon deploy", async function () {
      const { b3tr, owner } = await getOrDeployContractInstances({ forceDeploy: false })

      const defaultAdminRole = await b3tr.DEFAULT_ADMIN_ROLE()

      const res = await b3tr.hasRole(defaultAdminRole, owner)
      expect(res).to.eql(true)
    })

    it("minter role is set correctly upon deploy", async function () {
      const { b3tr, otherAccount, minterAccount } = await getOrDeployContractInstances({ forceDeploy: false })
      const operatorRole = await b3tr.MINTER_ROLE()

      const res = await b3tr.hasRole(operatorRole, minterAccount)
      expect(res).to.eql(true)

      // test that operator role is not set for other accounts
      expect(await b3tr.hasRole(operatorRole, otherAccount)).to.eql(false)
    })

    it("should revert if default admin set to zero address on initilisation", async function () {
      const { owner, minterAccount } = await getOrDeployContractInstances({ forceDeploy: false })
      const B3trContract = await ethers.getContractFactory("B3TR")
      await expect(B3trContract.deploy(ethers.ZeroAddress, minterAccount, owner)).to.be.reverted
    })
  })

  describe("Access Control", function () {
    it("only admin can grant minter role", async function () {
      const { b3tr, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const operatorRole = await b3tr.MINTER_ROLE()

      expect(await b3tr.hasRole(operatorRole, otherAccount)).to.eql(false)

      await expect(b3tr.connect(otherAccount).grantRole(operatorRole, otherAccount)).to.be.reverted

      await b3tr.connect(owner).grantRole(operatorRole, otherAccount)
      expect(await b3tr.hasRole(operatorRole, otherAccount)).to.eql(true)
    })

    it("only admin can revoke minter role", async function () {
      const { b3tr, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: false })

      const operatorRole = await b3tr.MINTER_ROLE()

      await b3tr.connect(owner).grantRole(operatorRole, otherAccount)
      expect(await b3tr.hasRole(operatorRole, otherAccount)).to.eql(true)

      await expect(b3tr.connect(otherAccount).revokeRole(operatorRole, otherAccount)).to.be.reverted

      await b3tr.connect(owner).revokeRole(operatorRole, otherAccount)
      expect(await b3tr.hasRole(operatorRole, otherAccount)).to.eql(false)
    })

    it("only admin can grant admin role", async function () {
      const { b3tr, owner, otherAccount } = await getOrDeployContractInstances({ forceDeploy: false })

      const adminRole = await b3tr.DEFAULT_ADMIN_ROLE()

      // at the beginning owner is admin
      expect(await b3tr.hasRole(adminRole, otherAccount)).to.eql(false)
      expect(await b3tr.hasRole(adminRole, owner)).to.eql(true)

      await expect(b3tr.connect(otherAccount).grantRole(adminRole, otherAccount)).to.be.reverted

      await b3tr.connect(owner).grantRole(adminRole, otherAccount)
      expect(await b3tr.hasRole(adminRole, otherAccount)).to.eql(true)

      // owner is still admin until it is revoked
      expect(await b3tr.hasRole(adminRole, owner)).to.eql(true)
    })

    it("only admin can revoke admin role", async function () {
      const { b3tr, owner, otherAccount, minterAccount } = await getOrDeployContractInstances({ forceDeploy: false })

      const adminRole = await b3tr.DEFAULT_ADMIN_ROLE()

      // after last test both owner and otherAccount are admin
      expect(await b3tr.hasRole(adminRole, otherAccount)).to.eql(true)
      expect(await b3tr.hasRole(adminRole, owner)).to.eql(true)

      await expect(b3tr.connect(minterAccount).revokeRole(adminRole, owner)).to.be.reverted

      await b3tr.connect(otherAccount).revokeRole(adminRole, owner)

      // owner is no longer admin
      expect(await b3tr.hasRole(adminRole, owner)).to.eql(false)

      // otherAccount is still admin until
      expect(await b3tr.hasRole(adminRole, otherAccount)).to.eql(true)
    })

    it("admin transfer admin permissions to another account", async function () {
      const { b3tr, owner, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const adminRole = await b3tr.DEFAULT_ADMIN_ROLE()
      const minterRole = await b3tr.MINTER_ROLE()

      const newAdmin = otherAccounts[5]

      expect(await b3tr.hasRole(adminRole, owner)).to.eql(true)
      expect(await b3tr.hasRole(adminRole, newAdmin)).to.eql(false)

      await b3tr.connect(owner).grantRole(adminRole, newAdmin)
      expect(await b3tr.hasRole(adminRole, newAdmin)).to.eql(true)

      await b3tr.connect(owner).renounceRole(adminRole, owner)

      expect(await b3tr.hasRole(adminRole, owner)).to.eql(false)
      expect(await b3tr.hasRole(adminRole, newAdmin)).to.eql(true)

      //can do same stuff as previous owner
      await b3tr.connect(newAdmin).grantRole(minterRole, otherAccounts[5])
      await b3tr.connect(newAdmin).grantRole(adminRole, otherAccounts[5])
    })

    it("Only admin with PAUSER_ROLE can toggle pause of b3tr transfers", async function () {
      const { b3tr, otherAccount, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await b3tr.hasRole(await b3tr.PAUSER_ROLE(), otherAccount.address)).to.eql(false)
      await catchRevert(b3tr.connect(otherAccount).pause())
      await catchRevert(b3tr.connect(otherAccount).unpause())

      expect(await b3tr.hasRole(await b3tr.PAUSER_ROLE(), owner.address)).to.eql(true)
      await b3tr.connect(owner).pause()
      expect(await b3tr.paused()).to.eql(true)

      await b3tr.connect(owner).unpause()
      expect(await b3tr.paused()).to.eql(false)
    })
  })

  describe("Max supply", function () {
    it("cannot be minted more than max supply", async function () {
      const { b3tr, otherAccount, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const operatorRole = await b3tr.MINTER_ROLE()

      await b3tr.grantRole(operatorRole, owner)
      await expect(b3tr.mint(otherAccount, ethers.parseEther("1000243155"))).to.be.reverted
    })

    it("can be minted up to max supply", async function () {
      const config = createLocalConfig()
      const { b3tr, otherAccount, owner } = await getOrDeployContractInstances({ forceDeploy: false, config })
      const operatorRole = await b3tr.MINTER_ROLE()

      await b3tr.grantRole(operatorRole, owner)
      await expect(b3tr.mint(otherAccount, ethers.parseEther("1000243154"))).not.to.be.reverted

      const balance = await b3tr.balanceOf(otherAccount)
      expect(String(balance)).to.eql(ethers.parseEther("1000243154").toString())
    })
  })

  describe("Mint", function () {
    it("only accounts with minter role can mint", async function () {
      const { b3tr, otherAccount, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      expect(await b3tr.totalSupply()).to.eql(0n)
      await expect(b3tr.mint(otherAccount, ethers.parseEther("1"))).to.be.reverted
      expect(await b3tr.totalSupply()).to.eql(0n)
      const operatorRole = await b3tr.MINTER_ROLE()

      await b3tr.grantRole(operatorRole, owner)
      await expect(b3tr.mint(otherAccount, ethers.parseEther("1"))).not.to.be.reverted
      expect(await b3tr.totalSupply()).to.eql(ethers.parseEther("1"))

      const balance = await b3tr.balanceOf(otherAccount)
      expect(String(balance)).to.eql(ethers.parseEther("1").toString())
    })

    it("Should not be able to mint if transfers are paused", async function () {
      const { b3tr, otherAccount, owner } = await getOrDeployContractInstances({ forceDeploy: true })

      const operatorRole = await b3tr.MINTER_ROLE()

      await b3tr.grantRole(operatorRole, owner)
      await b3tr.pause()

      await catchRevert(b3tr.mint(otherAccount, ethers.parseEther("1")))

      await b3tr.connect(owner).unpause()

      await expect(b3tr.mint(otherAccount, ethers.parseEther("1"))).not.to.be.reverted
    })
  })

  describe("Token details", function () {
    it("returns expected information", async function () {
      const { b3tr } = await getOrDeployContractInstances({ forceDeploy: false })

      const name = await b3tr.name()
      const symbol = await b3tr.symbol()
      const decimals = await b3tr.decimals()
      const cap = await b3tr.cap()
      const totalSupply = await b3tr.totalSupply()

      const tokenDetails = await b3tr.tokenDetails()

      expect(tokenDetails[0]).to.eql(name)
      expect(tokenDetails[1]).to.eql(symbol)
      expect(tokenDetails[2]).to.eql(decimals)
      expect(tokenDetails[3]).to.eql(totalSupply)
      expect(tokenDetails[4]).to.eql(cap)
    })
  })
})
