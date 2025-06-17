import { ethers } from "hardhat"
import { describe, it, beforeEach } from "mocha"
import { expect } from "chai"
import { setupSignalingFixture } from "./fixture.test"
import { VeBetterPassport } from "../../typechain-types"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BytesLike } from "ethers"

import { endorseApp } from "../helpers/xnodes"
import { linkEntityToPassportWithSignature } from "../helpers/common"

describe("VeBetterPassport (Signaling Logic) - @shard8b", function () {
  let veBetterPassport: VeBetterPassport
  let owner: SignerWithAddress
  let otherAccounts: SignerWithAddress[]
  let appId: BytesLike
  let regularSignaler: SignerWithAddress
  let appAdmin: SignerWithAddress
  let x2EarnApps: any

  beforeEach(async function () {
    const fixture = await setupSignalingFixture()
    veBetterPassport = fixture.veBetterPassport
    owner = fixture.owner
    otherAccounts = fixture.otherAccounts
    appId = fixture.appId
    regularSignaler = fixture.regularSignaler
    appAdmin = fixture.appAdmin
    x2EarnApps = fixture.x2EarnApps
  })

  describe("Signaling By Default Admin", function () {
    it("Admin can update the signaling threshold", async function () {
      // Enable score check
      await veBetterPassport.connect(owner).toggleCheck(4)

      // score check should be enabled
      expect(await veBetterPassport.isCheckEnabled(4)).to.be.true

      // Expect score threshold to be 0
      expect(await veBetterPassport.thresholdPoPScore()).to.equal(0)

      await expect(veBetterPassport.connect(regularSignaler).signalUserWithReason(owner.address, "Some reason"))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(owner.address, regularSignaler.address, appId, "Some reason")

      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(1)

      // User should be a person as their score is 0 and participation score check is enabled with threshold of 0,
      // even if they have been signaled (as the signaling threshold is not met yet)
      expect(await veBetterPassport.isPerson(owner.address)).to.deep.equal([
        true,
        "User's participation score is above the threshold",
      ])

      // Update the signaling threshold to 1
      await veBetterPassport.connect(owner).setSignalingThreshold(1)

      // Enable signaling check
      await veBetterPassport.connect(owner).toggleCheck(3)

      // User should be a bot as they have been signaled and signaling threshold is 1
      expect(await veBetterPassport.isPerson(owner.address)).to.deep.equal([
        false,
        "User has been signaled too many times",
      ])
    })

    it("DEFAULT_ADMIN_ROLE can reset signals of a user", async function () {
      // Signal the user
      await expect(veBetterPassport.connect(regularSignaler).signalUserWithReason(owner.address, "Some reason"))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(owner.address, regularSignaler.address, appId, "Some reason")

      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(1)

      // Reset the signals
      await expect(
        veBetterPassport
          .connect(owner)
          .resetUserSignalsWithReason(owner.address, "User demonstrated erroneous signaling"),
      )
        .to.emit(veBetterPassport, "UserSignalsReset")
        .withArgs(owner.address, "User demonstrated erroneous signaling")

      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(0)
    })

    it("Should not be able to reset signals without DEFAULT_ADMIN_ROLE", async function () {
      // Signal the user
      await expect(veBetterPassport.connect(regularSignaler).signalUserWithReason(owner.address, "Some reason"))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(owner.address, regularSignaler.address, appId, "Some reason")

      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(1)

      // Try to reset with a non-admin account
      await expect(
        veBetterPassport
          .connect(regularSignaler)
          .resetUserSignalsWithReason(owner.address, "User demonstrated erroneous signaling"),
      ).to.be.reverted

      // Counter should remain unchanged
      expect(await veBetterPassport.signaledCounter(owner.address)).to.equal(1)
    })

    it("ROLE_GRANTER can add and remove app signalers", async function () {
      const targetSignaler = otherAccounts[2]

      // First verify the account is not a signaler
      expect(await veBetterPassport.appOfSignaler(targetSignaler.address)).to.equal(ethers.ZeroHash)

      // Add signaler using admin
      await expect(veBetterPassport.connect(owner).assignSignalerToApp(appId, targetSignaler.address))
        .to.emit(veBetterPassport, "SignalerAssignedToApp")
        .withArgs(targetSignaler.address, appId)

      expect(await veBetterPassport.appOfSignaler(targetSignaler.address)).to.equal(appId)

      // Remove signaler
      await expect(veBetterPassport.connect(owner).removeSignalerFromApp(targetSignaler.address))
        .to.emit(veBetterPassport, "SignalerRemovedFromApp")
        .withArgs(targetSignaler.address, appId)

      expect(await veBetterPassport.appOfSignaler(targetSignaler.address)).to.equal(ethers.ZeroHash)
    })

    it("DEFAULT_ADMIN_ROLE can signal a user without reason", async function () {
      const targetUser = otherAccounts[5]

      // Admin can signal without providing a reason
      await expect(veBetterPassport.connect(owner).signalUser(targetUser.address))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(targetUser.address, owner.address, ethers.ZeroHash, "")

      expect(await veBetterPassport.signaledCounter(targetUser.address)).to.equal(1)
    })

    it("Non-admin users cannot use signalUser (no reason)", async function () {
      const targetUser = otherAccounts[7]

      // Regular signaler should not be able to use the no-reason function
      await expect(veBetterPassport.connect(regularSignaler).signalUser(targetUser.address)).to.be.reverted

      // Verify no signals were recorded
      expect(await veBetterPassport.signaledCounter(targetUser.address)).to.equal(0)
    })
  })

  describe("Signaling By SIGNALER_ROLE", function () {
    it("Admin of App can assign and revoke a signaler", async function () {
      const targetSignaler = otherAccounts[2]

      // First verify the account is not a signaler
      expect(await veBetterPassport.appOfSignaler(targetSignaler.address)).to.equal(ethers.ZeroHash)

      // Assign signaler
      await expect(veBetterPassport.connect(appAdmin).assignSignalerToAppByAppAdmin(appId, targetSignaler.address))
        .to.emit(veBetterPassport, "SignalerAssignedToApp")
        .withArgs(targetSignaler.address, appId)

      expect(await veBetterPassport.appOfSignaler(targetSignaler.address)).to.equal(appId)

      // Remove signaler
      await expect(veBetterPassport.connect(appAdmin).removeSignalerFromAppByAppAdmin(targetSignaler.address))
        .to.emit(veBetterPassport, "SignalerRemovedFromApp")
        .withArgs(targetSignaler.address, appId)

      expect(await veBetterPassport.appOfSignaler(targetSignaler.address)).to.equal(ethers.ZeroHash)
    })

    it("Non-Admin of an app cannot add a signaler", async function () {
      const nonAdminAccount = otherAccounts[3]
      const targetSignaler = otherAccounts[4]

      // Try to assign signaler with non-admin account
      await expect(
        veBetterPassport.connect(nonAdminAccount).assignSignalerToAppByAppAdmin(appId, targetSignaler.address),
      ).to.be.reverted
    })

    it("Signaler can signal a user", async function () {
      const targetUser = otherAccounts[3]

      // Verify starting state
      expect(await veBetterPassport.hasRole(await veBetterPassport.SIGNALER_ROLE(), regularSignaler.address)).to.be.true
      expect(await veBetterPassport.signaledCounter(targetUser.address)).to.equal(0)

      await expect(veBetterPassport.connect(regularSignaler).signalUserWithReason(targetUser.address, "Some reason"))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(targetUser.address, regularSignaler.address, appId, "Some reason")

      expect(await veBetterPassport.signaledCounter(targetUser.address)).to.equal(1)

      // Remove signaler role
      await expect(veBetterPassport.connect(appAdmin).removeSignalerFromAppByAppAdmin(regularSignaler.address))
        .to.emit(veBetterPassport, "SignalerRemovedFromApp")
        .withArgs(regularSignaler.address, appId)

      // Try to signal again - should fail
      await expect(veBetterPassport.connect(regularSignaler).signalUserWithReason(targetUser.address, "Some reason")).to
        .be.reverted
    })

    it("Passport signals should be updated when an entity's signals get reset", async function () {
      // Create a new entity-passport relationship
      const entity = otherAccounts[3]
      const passport = otherAccounts[4]

      // Link entity to passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 100000)

      // Make passport a signaler and reset signaler for the app
      await expect(veBetterPassport.connect(appAdmin).assignSignalerToAppByAppAdmin(appId, passport.address))
        .to.emit(veBetterPassport, "SignalerAssignedToApp")
        .withArgs(passport.address, appId)

      // Signal the entity
      await expect(veBetterPassport.connect(passport).signalUserWithReason(entity.address, "Some reason"))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(entity.address, passport.address, appId, "Some reason")

      // Verify signals for both entity and passport
      expect(await veBetterPassport.signaledCounter(entity.address)).to.equal(1)
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(1)

      // Reset signals
      await expect(
        veBetterPassport
          .connect(owner)
          .resetUserSignalsWithReason(entity.address, "User demonstrated erroneous signaling"),
      )
        .to.emit(veBetterPassport, "UserSignalsReset")
        .withArgs(entity.address, "User demonstrated erroneous signaling")

      // Verify signals are reset for both
      expect(await veBetterPassport.signaledCounter(entity.address)).to.equal(0)
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(0)
    })

    it("Passport signals should be updated when an entity's app signals get reset", async function () {
      // Create a new entity-passport relationship
      const entity = otherAccounts[3]
      const passport = otherAccounts[4]

      // Link entity to passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 100000)

      // Signal the entity
      await expect(veBetterPassport.connect(regularSignaler).signalUserWithReason(entity.address, "Some reason"))
        .to.emit(veBetterPassport, "UserSignaled")
        .withArgs(entity.address, regularSignaler.address, appId, "Some reason")

      expect(await veBetterPassport.signaledCounter(entity.address)).to.equal(1)
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(1)

      // Reset signals via app admin
      await expect(
        veBetterPassport
          .connect(owner)
          .resetUserSignalsWithReason(entity.address, "User demonstrated erroneous signaling"),
      )
        .to.emit(veBetterPassport, "UserSignalsReset")
        .withArgs(entity.address, "User demonstrated erroneous signaling")

      // Verify signals are reset for both
      expect(await veBetterPassport.signaledCounter(entity.address)).to.equal(0)
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(0)
    })
  })

  it("should be able to reset signals of a user by app admins", async function () {
    // Create a new app with otherAccounts[5] as admin
    const newAppAdmin = otherAccounts[5]
    const targetUser = otherAccounts[6]

    await x2EarnApps
      .connect(newAppAdmin)
      .submitApp(otherAccounts[7].address, newAppAdmin, otherAccounts[7].address, "metadataURI")

    const newAppId = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[7].address))
    await endorseApp(newAppId, newAppAdmin)

    // Make newAppAdmin both a signaler and reset signaler for the new app
    await expect(veBetterPassport.connect(newAppAdmin).assignSignalerToAppByAppAdmin(newAppId, newAppAdmin.address))
      .to.emit(veBetterPassport, "SignalerAssignedToApp")
      .withArgs(newAppAdmin.address, newAppId)

    // Signal user with both signalers
    await expect(veBetterPassport.connect(regularSignaler).signalUserWithReason(targetUser.address, "Some reason"))
      .to.emit(veBetterPassport, "UserSignaled")
      .withArgs(targetUser.address, regularSignaler.address, appId, "Some reason")

    await expect(veBetterPassport.connect(newAppAdmin).signalUserWithReason(targetUser.address, "Some reason"))
      .to.emit(veBetterPassport, "UserSignaled")
      .withArgs(targetUser.address, newAppAdmin.address, newAppId, "Some reason")

    expect(await veBetterPassport.signaledCounter(targetUser.address)).to.equal(2)

    // Reset signals of user by app admin
    await expect(
      veBetterPassport
        .connect(owner)
        .resetUserSignalsWithReason(targetUser.address, "User demonstrated erroneous signaling"),
    )
      .to.emit(veBetterPassport, "UserSignalsReset")
      .withArgs(targetUser.address, "User demonstrated erroneous signaling")

    expect(await veBetterPassport.signaledCounter(targetUser.address)).to.equal(0)
  })

  describe("Signaling By UPGRADER_ROLE", function () {
    it("Should allow to set signaling threshold", async function () {
      await veBetterPassport.connect(owner).setSignalingThreshold(2)
      expect(await veBetterPassport.signalingThreshold()).to.equal(2)

      await expect(
        veBetterPassport.connect(owner).grantRole(await veBetterPassport.UPGRADER_ROLE(), otherAccounts[2].address),
      )
        .to.emit(veBetterPassport, "RoleGranted")
        .withArgs(await veBetterPassport.UPGRADER_ROLE(), otherAccounts[2].address, owner.address)

      await veBetterPassport.connect(otherAccounts[2]).setSignalingThreshold(3)
      expect(await veBetterPassport.signalingThreshold()).to.equal(3)
    })

    it("Should revert if not UPGRADER_ROLE", async function () {
      await expect(veBetterPassport.connect(otherAccounts[3]).setSignalingThreshold(4)).to.be.reverted
    })
  })
})
