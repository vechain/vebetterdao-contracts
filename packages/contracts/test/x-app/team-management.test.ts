import { expect } from "chai"
import { ethers } from "hardhat"
import { describe, it } from "mocha"

import {
  bootstrapAndStartEmissions,
  catchRevert,
  getOrDeployContractInstances,
  getVot3Tokens,
  startNewAllocationRound,
  waitForCurrentRoundToEnd,
  ZERO_ADDRESS,
} from "../helpers"
import { endorseApp } from "../helpers/xnodes"

describe("X-Apps - Team Management - @shard15b", function () {
  describe("Admin address", function () {
    it("Admin can update the admin address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const admin = await x2EarnApps.appAdmin(app1Id)
      expect(admin).to.eql(otherAccounts[0].address)

      await x2EarnApps.connect(owner).setAppAdmin(app1Id, otherAccounts[1].address)

      const updatedAdmin = await x2EarnApps.appAdmin(app1Id)
      expect(updatedAdmin).to.eql(otherAccounts[1].address)
      expect(updatedAdmin).to.not.eql(admin)
    })

    it("Cannot update the admin address of a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const newAdminAddress = ethers.Wallet.createRandom().address

      await expect(x2EarnApps.connect(owner).setAppAdmin(app1Id, newAdminAddress)).to.be.reverted
    })

    it("Cannot set the admin address of an app to ZERO address", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await catchRevert(x2EarnApps.connect(otherAccounts[0]).setAppAdmin(app1Id, ZERO_ADDRESS))
    })

    it("User with DEFAULT_ADMIN_ROLE can update the admin address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const admin = await x2EarnApps.appAdmin(app1Id)
      expect(admin).to.eql(otherAccounts[0].address)

      await x2EarnApps.connect(otherAccounts[0]).setAppAdmin(app1Id, otherAccounts[1].address)

      const updatedAdmin = await x2EarnApps.appAdmin(app1Id)
      expect(updatedAdmin).to.eql(otherAccounts[1].address)
      expect(updatedAdmin).to.not.eql(admin)
    })

    it("Non admins cannot update the admin address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      // check that is not admin
      expect(await x2EarnApps.isAppAdmin(app1Id, otherAccounts[1].address)).to.eql(false)
      await catchRevert(x2EarnApps.connect(otherAccounts[1]).setAppAdmin(app1Id, otherAccounts[1].address))

      // user without DEFAULT_ADMIN_ROLE
      expect(await x2EarnApps.hasRole(await x2EarnApps.DEFAULT_ADMIN_ROLE(), otherAccounts[0].address)).to.eql(false)
      await catchRevert(x2EarnApps.connect(otherAccounts[1]).setAppAdmin(app1Id, otherAccounts[2].address))
    })
  })

  describe("Team wallet address", function () {
    it("Should be able to fetch app team wallet address", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const teamWalletAddress = await x2EarnApps.teamWalletAddress(app1Id)
      expect(teamWalletAddress).to.eql(otherAccounts[0].address)
    })

    it("Governance admin role can update the team wallet address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const appReceiverAddress1 = await x2EarnApps.teamWalletAddress(app1Id)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      await x2EarnApps.connect(owner).updateTeamWalletAddress(app1Id, otherAccounts[1].address)

      const appReceiverAddress2 = await x2EarnApps.teamWalletAddress(app1Id)
      expect(appReceiverAddress2).to.eql(otherAccounts[1].address)
      expect(appReceiverAddress1).to.not.eql(appReceiverAddress2)
    })

    it("App admin can update the team wallet address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")

      const appReceiverAddress1 = await x2EarnApps.teamWalletAddress(app1Id)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, appAdmin.address)
      expect(isAdmin).to.be.false

      expect(await x2EarnApps.isAppAdmin(app1Id, appAdmin.address)).to.be.true

      await x2EarnApps.connect(appAdmin).updateTeamWalletAddress(app1Id, otherAccounts[1].address)

      const appReceiverAddress2 = await x2EarnApps.teamWalletAddress(app1Id)
      expect(appReceiverAddress2).to.eql(otherAccounts[1].address)
      expect(appReceiverAddress1).to.not.eql(appReceiverAddress2)
    })

    it("Moderators cannot update the team wallet address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const appReceiverAddress1 = await x2EarnApps.teamWalletAddress(app1Id)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)

      const isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      await expect(x2EarnApps.connect(otherAccounts[1]).updateTeamWalletAddress(app1Id, otherAccounts[1].address)).to.be
        .reverted

      const appReceiverAddress2 = await x2EarnApps.teamWalletAddress(app1Id)
      expect(appReceiverAddress2).to.eql(appReceiverAddress1)
    })

    it("Moderators cannot update the team wallet address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const appReceiverAddress1 = await x2EarnApps.teamWalletAddress(app1Id)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)

      const isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      await expect(x2EarnApps.connect(otherAccounts[1]).updateTeamWalletAddress(app1Id, otherAccounts[1].address)).to.be
        .reverted

      const appReceiverAddress2 = await x2EarnApps.teamWalletAddress(app1Id)
      expect(appReceiverAddress2).to.eql(appReceiverAddress1)
    })

    it("Non-admin cannot update the team wallet address of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const appReceiverAddress1 = await x2EarnApps.teamWalletAddress(app1Id)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, otherAccounts[1].address)
      expect(isAdmin).to.be.false

      await expect(x2EarnApps.connect(otherAccounts[1]).updateTeamWalletAddress(app1Id, otherAccounts[1].address)).to.be
        .reverted

      const appReceiverAddress2 = await x2EarnApps.teamWalletAddress(app1Id)
      expect(appReceiverAddress2).to.eql(appReceiverAddress1)
    })

    it("Cannot update the team wallet address of a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const newTeamWalletAddress = ethers.Wallet.createRandom().address

      await expect(x2EarnApps.connect(owner).updateTeamWalletAddress(app1Id, newTeamWalletAddress)).to.be.reverted
    })

    it("Team wallet address cannot be updated to ZERO address", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await catchRevert(x2EarnApps.connect(otherAccounts[0]).updateTeamWalletAddress(app1Id, ZERO_ADDRESS))
    })
  })

  describe("App Moderators", function () {
    it("By default there is no moderator for an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[0].address)
      expect(isModerator).to.be.false

      const moderators = await x2EarnApps.appModerators(app1Id)
      expect(moderators).to.eql([])
    })

    it("DEFAULT_ADMIN_ROLE can add a moderator to an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)

      const isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true
    })

    it("DEFAULT_ADMIN_ROLE can remove a moderator from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      let isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      await x2EarnApps.connect(owner).removeAppModerator(app1Id, otherAccounts[1].address)

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.false
    })

    it("App admin can add a moderator to an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, appAdmin.address)
      expect(isAdmin).to.be.false

      expect(await x2EarnApps.isAppAdmin(app1Id, appAdmin.address)).to.be.true

      await x2EarnApps.connect(appAdmin).addAppModerator(app1Id, otherAccounts[1].address)

      const isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true
    })

    it("App admin can remove a moderator from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")
      await x2EarnApps.connect(appAdmin).addAppModerator(app1Id, otherAccounts[1].address)
      await x2EarnApps.connect(appAdmin).addAppModerator(app1Id, otherAccounts[2].address)

      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, appAdmin.address)
      expect(isAdmin).to.be.false

      expect(await x2EarnApps.isAppAdmin(app1Id, appAdmin.address)).to.be.true

      let isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      await x2EarnApps.connect(appAdmin).removeAppModerator(app1Id, otherAccounts[2].address)

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[2].address)
      expect(isModerator).to.be.false

      expect(await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)).to.be.true
    })

    it("Can correctly fetch all moderators of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[2].address)

      const moderators = await x2EarnApps.appModerators(app1Id)
      expect(moderators).to.eql([otherAccounts[1].address, otherAccounts[2].address])
    })

    it("Can know if an address is a moderator of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)

      let isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[2].address)
      expect(isModerator).to.be.false
    })

    it("Cannot add a moderator to a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.connect(owner).addAppModerator(app1Id, owner.address)).to.be.reverted
    })

    it("Cannot remove a moderator from a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.connect(owner).removeAppModerator(app1Id, owner.address)).to.be.reverted
    })

    it("Cannot add ZERO_ADDRESS as a moderator of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(otherAccounts[0]).addAppModerator(app1Id, ZERO_ADDRESS)).to.be.reverted
    })

    it("Cannot remove ZERO_ADDRESS as a moderator of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(otherAccounts[0]).removeAppModerator(app1Id, ZERO_ADDRESS)).to.be.reverted
    })

    it("Non admin or user without DEFAULT_ADMIN_ROLE cannot add a moderator to an app", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.connect(otherAccounts[0]).addAppModerator(app1Id, otherAccounts[0].address)).to.be
        .reverted
    })

    it("Non admin or user without DEFAULT_ADMIN_ROLE cannot remove a moderator from an app", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.connect(otherAccounts[0]).removeAppModerator(app1Id, otherAccounts[0].address)).to.be
        .reverted
    })

    it("Removing a moderator from an app does not affect other moderators of the app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[1].address)
      await x2EarnApps.connect(owner).addAppModerator(app1Id, otherAccounts[2].address)

      let isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.true

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[2].address)
      expect(isModerator).to.be.true

      await x2EarnApps.connect(owner).removeAppModerator(app1Id, otherAccounts[1].address)

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[1].address)
      expect(isModerator).to.be.false

      isModerator = await x2EarnApps.isAppModerator(app1Id, otherAccounts[2].address)
      expect(isModerator).to.be.true
    })

    it("An error is thrown when trying to remove a non existing moderator from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(owner).removeAppModerator(app1Id, otherAccounts[1].address)).to.be.reverted
    })

    it("Cannot remove a moderator with ZERO_ADDRESS from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(owner).removeAppModerator(app1Id, ZERO_ADDRESS)).to.be.reverted
    })

    it("Cannot remove moderator of non existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))

      await expect(x2EarnApps.connect(owner).removeAppModerator(app1Id, owner.address)).to.be.reverted
    })

    it("Cannot have exceed the maximum number of moderators for an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")

      const limit = await x2EarnApps.MAX_MODERATORS()

      const addModeratorPromises = []
      for (let i = 1; i <= limit; i++) {
        const randomWallet = ethers.Wallet.createRandom()
        addModeratorPromises.push(x2EarnApps.connect(appAdmin).addAppModerator(app1Id, randomWallet.address))
      }

      // Wait for all addAppModerator transactions to complete
      await Promise.all(addModeratorPromises)

      await expect(x2EarnApps.connect(appAdmin).addAppModerator(app1Id, otherAccounts[10].address)).to.be.reverted

      // check that having 100 moderators do not affect the app
      const moderators = await x2EarnApps.appModerators(app1Id)
      expect(moderators.length).to.eql(100)

      // check that the last moderator is not the one that failed
      expect(moderators[99]).to.not.eql(otherAccounts[10].address)
      expect(await x2EarnApps.isAppModerator(app1Id, otherAccounts[10].address)).to.be.false
    })
  })

  describe("Reward distributors", function () {
    it("Admin can add a reward distributor to an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[1].address)

      const isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.true
    })

    it("Admin can remove a reward distributor from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[1].address)

      let isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.true

      await x2EarnApps.connect(owner).removeRewardDistributor(app1Id, otherAccounts[1].address)

      isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.false
    })

    it("Cannot add a reward distributor to a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await expect(x2EarnApps.connect(owner).addRewardDistributor(app1Id, owner.address)).to.be.reverted
    })

    it("Cannot remove a reward distributor from a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await expect(x2EarnApps.connect(owner).removeRewardDistributor(app1Id, owner.address)).to.be.reverted
    })

    it("Cannot add ZERO_ADDRESS as a reward distributor of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(otherAccounts[0]).addRewardDistributor(app1Id, ZERO_ADDRESS)).to.be.reverted
    })

    it("Cannot remove ZERO_ADDRESS as a reward distributor of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(otherAccounts[0]).removeRewardDistributor(app1Id, ZERO_ADDRESS)).to.be.reverted
    })

    it("Cannot remove a non existing reward distributor from an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(owner).removeRewardDistributor(app1Id, otherAccounts[1].address)).to.be.reverted
    })

    it("When having more than one distributor, updating one address won't affect the others", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[1].address)
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[2].address)

      let isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.true

      isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[2].address)
      expect(isDistributor).to.be.true

      await x2EarnApps.connect(owner).removeRewardDistributor(app1Id, otherAccounts[1].address)

      isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.false

      isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[2].address)
      expect(isDistributor).to.be.true
    })

    it("Can correctly fetch all reward distributors of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[1].address)
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[2].address)

      const distributors = await x2EarnApps.rewardDistributors(app1Id)
      expect(distributors).to.eql([otherAccounts[1].address, otherAccounts[2].address])
    })

    it("Can know if an address is a reward distributor of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).addRewardDistributor(app1Id, otherAccounts[1].address)

      let isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[1].address)
      expect(isDistributor).to.be.true

      isDistributor = await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[2].address)
      expect(isDistributor).to.be.false
    })

    it("Cannot add a reward distributor to an app if not an admin", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await expect(x2EarnApps.connect(otherAccounts[0]).addRewardDistributor(app1Id, otherAccounts[1].address)).to.be
        .reverted
    })

    it("Cannot remove a reward distributor from an app if not an admin", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await expect(x2EarnApps.connect(otherAccounts[0]).removeRewardDistributor(app1Id, otherAccounts[1].address)).to.be
        .reverted
    })

    it("Cannot have exceed the maximum number of reward distributors for an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const limit = await x2EarnApps.MAX_REWARD_DISTRIBUTORS()
      const app1Id = await x2EarnApps.hashAppName("My app")
      const appAdmin = otherAccounts[9]
      await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin.address, "My app", "metadataURI")

      const addDistributorPromises = []
      for (let i = 1; i <= limit; i++) {
        const randomWallet = ethers.Wallet.createRandom()
        addDistributorPromises.push(x2EarnApps.connect(appAdmin).addRewardDistributor(app1Id, randomWallet.address))
      }

      // Wait for all addRewardDistributor transactions to complete
      await Promise.all(addDistributorPromises)

      await expect(x2EarnApps.connect(appAdmin).addRewardDistributor(app1Id, otherAccounts[10].address)).to.be.reverted

      // check that having 100 distributors do not affect the app
      const distributors = await x2EarnApps.rewardDistributors(app1Id)
      expect(distributors.length).to.eql(100)

      // check that the last distributor is not the one that failed
      expect(distributors[99]).to.not.eql(otherAccounts[10].address)
      expect(await x2EarnApps.isRewardDistributor(app1Id, otherAccounts[10].address)).to.be.false
    })
  })

  describe("Team allocation percentage", function () {
    it("By default, the team allocation percentage of an app is 0", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      const teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(0n)
    })

    it("Admin can update the team allocation percentage of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 50)

      let teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(50n)

      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 60)

      teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(60n)
    })

    it("Admin can remove the team allocation percentage of an app by setting it to 0", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 50)

      let teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(50n)
    })

    it("Cannot update the team allocation percentage of a non-existing app", async function () {
      const { x2EarnApps, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const appId = await x2EarnApps.hashAppName("non-existing app")

      await expect(x2EarnApps.connect(owner).setTeamAllocationPercentage(appId, 50)).to.be.reverted
    })

    it("Cannot update the team allocation percentage of an app to more than 100", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      await expect(x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 101)).to.be.reverted
    })

    it("Cannot update the team allocation percentage of an app to less than 0", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")

      // uint256 cannot be negative, so ethers will throw an encoding error
      try {
        await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, -1)
        expect.fail("Should have thrown an error")
      } catch (error: any) {
        expect(error.code).to.equal("INVALID_ARGUMENT")
      }
    })

    it("Non-admin cannot update the team allocation percentage of an app", async function () {
      const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })
      const app1Id = await x2EarnApps.hashAppName("My app")

      await expect(x2EarnApps.connect(otherAccounts[0]).setTeamAllocationPercentage(app1Id, 50)).to.be.reverted
    })

    it("User with DEFAULT_ADMIN_ROLE can update the team allocation percentage of an app", async function () {
      const { x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const adminRole = await x2EarnApps.DEFAULT_ADMIN_ROLE()
      const isAdmin = await x2EarnApps.hasRole(adminRole, owner.address)
      expect(isAdmin).to.be.true

      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 50)

      let teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(50n)
    })

    it("Team allocation percentage of an app is 0 and apps need to withdraw, then they can change this", async function () {
      const {
        x2EarnApps,
        otherAccounts,
        owner,
        xAllocationVoting,
        xAllocationPool,
        b3tr,
        x2EarnRewardsPool,
        veBetterPassport,
      } = await getOrDeployContractInstances({ forceDeploy: true })
      const voter = otherAccounts[1]

      await getVot3Tokens(voter, "1")

      await veBetterPassport.whitelist(voter.address)
      await veBetterPassport.toggleCheck(1)

      const app1Id = await x2EarnApps.hashAppName("My app")
      await x2EarnApps
        .connect(owner)
        .submitApp(otherAccounts[0].address, otherAccounts[0].address, "My app", "metadataURI")
      await endorseApp(app1Id, otherAccounts[0])
      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 0)

      let teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(0n)

      // start round
      await bootstrapAndStartEmissions()

      // vote
      let roundId = await xAllocationVoting.currentRoundId()
      await xAllocationVoting.connect(voter).castVote(roundId, [app1Id], [ethers.parseEther("1")])
      await waitForCurrentRoundToEnd()

      // get balance of team wallet address
      const teamWalletAddress = await x2EarnApps.teamWalletAddress(app1Id)
      const teamWalletBalanceBefore = await b3tr.balanceOf(teamWalletAddress)
      expect(teamWalletBalanceBefore).to.eql(0n)

      const x2EarnRewardsPoolBalanceBefore = await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())
      let appEarnings = await xAllocationPool.roundEarnings(roundId, app1Id)

      // admin claims for app
      await xAllocationPool.connect(owner).claim(roundId, app1Id)

      // all funds should have been sent to the x2EarnRewardsPool contract
      const teamWalletBalanceAfter = await b3tr.balanceOf(teamWalletAddress)
      const x2EarnRewardsPoolBalanceAfter = await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())
      expect(teamWalletBalanceAfter).to.eql(0n)
      expect(x2EarnRewardsPoolBalanceAfter).to.eql(x2EarnRewardsPoolBalanceBefore + appEarnings[0])

      // admin should be able to withdraw the funds
      await x2EarnRewardsPool.connect(otherAccounts[0]).withdraw(appEarnings[0], app1Id, "")
      const x2EarnRewardsPoolBalanceAfterWithdraw = await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())
      expect(x2EarnRewardsPoolBalanceAfterWithdraw).to.eql(x2EarnRewardsPoolBalanceAfter - appEarnings[0])
      const teamWalletBalanceAfterWithdraw = await b3tr.balanceOf(teamWalletAddress)
      expect(teamWalletBalanceAfterWithdraw).to.eql(appEarnings[0])

      // now we start a new round and the app can change the team allocation percentage
      await startNewAllocationRound()
      roundId = await xAllocationVoting.currentRoundId()
      await xAllocationVoting.connect(voter).castVote(roundId, [app1Id], [ethers.parseEther("1")])
      await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 30)
      teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)
      expect(teamAllocationPercentage).to.eql(30n)
      await waitForCurrentRoundToEnd()

      appEarnings = await xAllocationPool.roundEarnings(roundId, app1Id)

      // admin claims for app
      await xAllocationPool.connect(owner).claim(roundId, app1Id)

      // now the team wallet should have received some funds
      const teamWalletBalanceAfter2 = await b3tr.balanceOf(teamWalletAddress)
      expect(teamWalletBalanceAfter2).to.eql(teamWalletBalanceAfterWithdraw + (appEarnings[0] * 30n) / 100n)

      // 70% of funds should have been sent to the x2EarnRewardsPool contract
      const x2EarnRewardsPoolBalanceAfter2 = await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())
      expect(x2EarnRewardsPoolBalanceAfter2).to.eql(
        x2EarnRewardsPoolBalanceAfterWithdraw + (appEarnings[0] * 70n) / 100n,
      )

      // admin of app can deposit back the funds to the x2EarnRewardsPool
      await b3tr.connect(otherAccounts[0]).approve(await x2EarnRewardsPool.getAddress(), teamWalletBalanceAfter2)
      await x2EarnRewardsPool.connect(otherAccounts[0]).deposit(teamWalletBalanceAfter2.toString(), app1Id)
      const x2EarnRewardsPoolBalanceAfter3 = await b3tr.balanceOf(await x2EarnRewardsPool.getAddress())
      expect(x2EarnRewardsPoolBalanceAfter3).to.eql(x2EarnRewardsPoolBalanceAfter2 + teamWalletBalanceAfter2)
      expect(await b3tr.balanceOf(teamWalletAddress)).to.eql(0n)
    })
  })
})
