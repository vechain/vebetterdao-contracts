import { describe, it, beforeEach } from "mocha"
import { expect } from "chai"
import { setupSignalingFixture } from "./fixture.test"
import { VeBetterPassport } from "../../typechain-types"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BytesLike, ethers } from "ethers"
import { linkEntityToPassportWithSignature } from "../helpers/common"

describe("VeBetterPassport (Reset Signal Count) - @shard8c", function () {
  let veBetterPassport: VeBetterPassport
  let owner: SignerWithAddress
  let otherAccounts: SignerWithAddress[]
  let appId: BytesLike
  let regularSignaler: SignerWithAddress
  let resetSignaler: SignerWithAddress
  let user: SignerWithAddress
  let appAdmin: SignerWithAddress

  beforeEach(async function () {
    const fixture = await setupSignalingFixture()
    veBetterPassport = fixture.veBetterPassport
    owner = fixture.owner
    otherAccounts = fixture.otherAccounts
    appId = fixture.appId
    regularSignaler = fixture.regularSignaler
    appAdmin = fixture.appAdmin

    // Setup a reset signaler with proper role
    resetSignaler = otherAccounts[5]
    await veBetterPassport.connect(owner).assignSignalerToApp(appId, resetSignaler.address)
    await veBetterPassport.connect(owner).grantRole(await veBetterPassport.RESET_SIGNALER_ROLE(), resetSignaler.address)

    // Setup a user with signals
    user = otherAccounts[6]
    await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
    await veBetterPassport.connect(regularSignaler).signalUserWithReason(user.address, "Test")
    await veBetterPassport.connect(regularSignaler).signalUserWithReason(user.address, "Test1")

    // Verify initial state
    expect(await veBetterPassport.signaledCounter(user.address)).to.equal(2)
  })

  describe("Reset Signals by Default Admin", function () {
    it("Should allow to reset user signals", async function () {
      await expect(
        veBetterPassport.connect(owner).resetUserSignalsWithReason(user.address, "suspicious activity lifted"),
      )
        .to.emit(veBetterPassport, "UserSignalsReset")
        .withArgs(user.address, "suspicious activity lifted")

      // Verify signals were reset
      expect(await veBetterPassport.signaledCounter(user.address)).to.equal(0)
    })

    it("Should allow to reset user without signals", async function () {
      const userWithoutSignals = otherAccounts[7]

      expect(await veBetterPassport.signaledCounter(userWithoutSignals.address)).to.equal(0)
      await expect(veBetterPassport.connect(owner).resetUserSignalsWithReason(userWithoutSignals.address, "no signals"))
        .to.emit(veBetterPassport, "UserSignalsReset")
        .withArgs(userWithoutSignals.address, "no signals")
    })
  })

  describe("Reset Signals by RESET_SIGNALER_ROLE (internal use)", function () {
    it("Should revert if a caller does not have RESET_SIGNALER_ROLE", async function () {
      await expect(veBetterPassport.connect(otherAccounts[7]).resetUserSignalsWithReason(user.address, "no signals")).to
        .be.reverted
    })

    it("Should allow to reset user without signals", async function () {
      const userWithoutSignals = otherAccounts[7]

      expect(await veBetterPassport.signaledCounter(userWithoutSignals.address)).to.equal(0)
      expect(await veBetterPassport.appSignalsCounter(appId, userWithoutSignals.address)).to.equal(0)

      await expect(
        veBetterPassport
          .connect(resetSignaler)
          .resetUserSignalsByAppWithReason(userWithoutSignals.address, "no signals"),
      )
        .to.emit(veBetterPassport, "UserSignalsResetForApp")
        .withArgs(userWithoutSignals.address, appId, "no signals")
    })

    it("Should correctly handle resetting signals for passport-linked entities", async function () {
      const entity = otherAccounts[9]
      const passport = otherAccounts[10]

      await veBetterPassport.connect(entity).linkEntityToPassport(passport.address)
      await veBetterPassport.connect(passport).acceptEntityLink(entity.address)

      await veBetterPassport.connect(owner).registerActionForRound(entity.address, appId, 1)
      await veBetterPassport.connect(regularSignaler).signalUserWithReason(entity.address, "Test")

      expect(await veBetterPassport.signaledCounter(entity.address)).to.equal(1)
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(1)

      await veBetterPassport.connect(resetSignaler).resetUserSignalsWithReason(entity.address, "linked entity")

      expect(await veBetterPassport.signaledCounter(entity.address)).to.equal(0)
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(0)
    })

    it("Should allow resetting signals for a user with zero signals", async function () {
      const userWithZeroSignals = otherAccounts[13]

      // Verify the user starts with 0 signals
      expect(await veBetterPassport.signaledCounter(userWithZeroSignals.address)).to.equal(0)

      // Reset the signals
      await expect(
        veBetterPassport
          .connect(resetSignaler)
          .resetUserSignalsWithReason(userWithZeroSignals.address, "preventative reset"),
      )
        .to.emit(veBetterPassport, "UserSignalsReset")
        .withArgs(userWithZeroSignals.address, "preventative reset")

      expect(await veBetterPassport.signaledCounter(userWithZeroSignals.address)).to.equal(0)
    })

    it("Should allow a reset signaler to reset their own signals", async function () {
      await veBetterPassport.connect(regularSignaler).signalUserWithReason(resetSignaler.address, "Suspicious activity")
      expect(await veBetterPassport.signaledCounter(resetSignaler.address)).to.equal(1)

      await expect(
        veBetterPassport
          .connect(resetSignaler)
          .resetUserSignalsWithReason(resetSignaler.address, "clearing my own record"),
      )
        .to.emit(veBetterPassport, "UserSignalsReset")
        .withArgs(resetSignaler.address, "clearing my own record")

      expect(await veBetterPassport.signaledCounter(resetSignaler.address)).to.equal(0)
    })
  })

  describe("Reset Signals by SIGNALER_ROLE (for app admins)", function () {
    it("Should revert if a caller does not have SIGNALER_ROLE", async function () {
      await expect(
        veBetterPassport.connect(otherAccounts[7]).resetUserSignalsByAppWithReason(user.address, "no signals"),
      ).to.be.reverted
    })

    it("Should revert if random user tries to assign signaler role", async function () {
      await expect(
        veBetterPassport.connect(otherAccounts[7]).assignSignalerToAppByAppAdmin(appId, otherAccounts[7].address),
      ).to.be.reverted
    })

    it("Should revert if random user tries to remove signaler role", async function () {
      await expect(veBetterPassport.connect(otherAccounts[7]).removeSignalerFromApp(otherAccounts[7].address)).to.be
        .reverted
    })

    it("Should allow a signaler to reset signals", async function () {
      const randomUser = otherAccounts[14]

      await veBetterPassport.connect(appAdmin).assignSignalerToAppByAppAdmin(appId, regularSignaler.address)

      await veBetterPassport.connect(regularSignaler).signalUserWithReason(randomUser.address, "Suspicious activity")

      expect(await veBetterPassport.signaledCounter(randomUser.address)).to.equal(1)

      await expect(
        veBetterPassport
          .connect(regularSignaler)
          .resetUserSignalsByAppWithReason(randomUser.address, "clearing a record"),
      )
        .to.emit(veBetterPassport, "UserSignalsResetForApp")
        .withArgs(randomUser.address, appId, "clearing a record")

      expect(await veBetterPassport.signaledCounter(randomUser.address)).to.equal(0)
    })

    it("Should allow app admin to assign signaler role, then is able to revoke it, then is able to assign it again", async function () {
      const newSignaler = otherAccounts[8]

      await veBetterPassport.connect(appAdmin).assignSignalerToAppByAppAdmin(appId, newSignaler.address)
      expect(await veBetterPassport.appOfSignaler(newSignaler.address)).to.equal(appId)
      expect(await veBetterPassport.hasRole(await veBetterPassport.SIGNALER_ROLE(), newSignaler.address)).to.be.true

      await veBetterPassport.connect(appAdmin).removeSignalerFromAppByAppAdmin(newSignaler.address)
      expect(await veBetterPassport.appOfSignaler(newSignaler.address)).to.equal(ethers.ZeroHash)
      expect(await veBetterPassport.hasRole(await veBetterPassport.SIGNALER_ROLE(), newSignaler.address)).to.be.false

      await veBetterPassport.connect(appAdmin).assignSignalerToAppByAppAdmin(appId, newSignaler.address)
      expect(await veBetterPassport.appOfSignaler(newSignaler.address)).to.equal(appId)
      expect(await veBetterPassport.hasRole(await veBetterPassport.SIGNALER_ROLE(), newSignaler.address)).to.be.true
    })

    it("Should should be able to be reset by DEFAULT ADMIN and SIGNALER_ROLE", async function () {
      const badWallet = otherAccounts[11]
      const defaultWalletSignaler = otherAccounts[12]

      await veBetterPassport.connect(regularSignaler).signalUserWithReason(badWallet.address, "Test")
      await veBetterPassport.connect(regularSignaler).signalUserWithReason(badWallet.address, "Test")
      expect(await veBetterPassport.signaledCounter(badWallet.address)).to.equal(2)
      expect(await veBetterPassport.appSignalsCounter(appId, badWallet.address)).to.equal(2)

      await veBetterPassport
        .connect(owner)
        .grantRole(await veBetterPassport.RESET_SIGNALER_ROLE(), defaultWalletSignaler.address)

      await veBetterPassport.connect(defaultWalletSignaler).resetUserSignalsWithReason(badWallet.address, "Test")
      expect(await veBetterPassport.signaledCounter(badWallet.address)).to.equal(0)
      expect(await veBetterPassport.appSignalsCounter(appId, badWallet.address)).to.equal(2) // reset signal count should not be affected by default admin signaler

      await veBetterPassport.connect(regularSignaler).resetUserSignalsByAppWithReason(badWallet.address, "Test")
      expect(await veBetterPassport.appSignalsCounter(appId, badWallet.address)).to.equal(0)
    })

    it("Should handle underflow protection when resetting app signals for an entity with passport", async function () {
      // Setup entity and passport
      const entity = otherAccounts[13]
      const passport = otherAccounts[14]

      // Link entity to passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 100000)

      // Signal the entity to accumulate some signals
      await veBetterPassport.connect(regularSignaler).signalUserWithReason(entity.address, "Test signal 1")
      await veBetterPassport.connect(regularSignaler).signalUserWithReason(entity.address, "Test signal 2")

      // Verify signals are correctly assigned to both entity and passport
      expect(await veBetterPassport.signaledCounter(entity.address)).to.equal(2)
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(2)
      expect(await veBetterPassport.appSignalsCounter(appId, entity.address)).to.equal(2)
      expect(await veBetterPassport.appSignalsCounter(appId, passport.address)).to.equal(2)

      // Reset passport signals directly to create an inconsistency
      // This creates the condition where passport has 0 signals but entity still has app signals
      await veBetterPassport.connect(owner).resetUserSignalsWithReason(passport.address, "Resetting passport signals")

      // Verify passport general signals are now 0, but app signals still exist
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(0)
      expect(await veBetterPassport.appSignalsCounter(appId, passport.address)).to.equal(2)

      // Now reset entity app signals - this would have triggered underflow in passport signals before the fix
      // Commit fix: https://github.com/vechain/b3tr/pull/2139/commits/8a1447fc11081947c61e48caab077c7c8311e9ff
      await veBetterPassport
        .connect(regularSignaler)
        .resetUserSignalsByAppWithReason(entity.address, "Resetting entity app signals")

      // Verify entity app signals are reset
      expect(await veBetterPassport.appSignalsCounter(appId, entity.address)).to.equal(0)

      // Verify passport counter remains at 0 (not underflowed to a large number)
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(0)
      // Verify passport app signals are also reset
      expect(await veBetterPassport.appSignalsCounter(appId, passport.address)).to.equal(0)
    })

    it("Should handle underflow protection when removing entity link from passport", async function () {
      // Setup entity and passport
      const entity = otherAccounts[13]
      const passport = otherAccounts[14]

      // Link entity to passport
      await linkEntityToPassportWithSignature(veBetterPassport, passport, entity, 100000)

      // Signal the entity to accumulate some signals
      await veBetterPassport.connect(regularSignaler).signalUserWithReason(entity.address, "Test signal 1")
      await veBetterPassport.connect(regularSignaler).signalUserWithReason(entity.address, "Test signal 2")

      // Verify signals correctly assigned to both entity and passport
      expect(await veBetterPassport.signaledCounter(entity.address)).to.equal(2)
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(2)

      // Verify app signals are also correctly assigned
      expect(await veBetterPassport.appSignalsCounter(appId, entity.address)).to.equal(2)
      expect(await veBetterPassport.appSignalsCounter(appId, passport.address)).to.equal(2)

      // Reset passport signals directly, creating an inconsistency
      await veBetterPassport.connect(owner).resetUserSignalsWithReason(passport.address, "Resetting passport signals")

      // Manually reset passport app signals to 0 (this would normally be done by app-specific reset)
      // This creates the potential underflow condition for app signals
      await veBetterPassport
        .connect(regularSignaler)
        .resetUserSignalsByAppWithReason(passport.address, "Reset app signals")

      // Verify passport signals are now 0, but entity still has signals
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(0)
      expect(await veBetterPassport.signaledCounter(entity.address)).to.equal(2)
      expect(await veBetterPassport.appSignalsCounter(appId, passport.address)).to.equal(0)
      expect(await veBetterPassport.appSignalsCounter(appId, entity.address)).to.equal(2)

      // Remove entity link from passport - this calls removeEntitySignalsFromPassport internally
      // This would have failed before the fix with "VM Exception: underflow"
      // Commit fix: https://github.com/vechain/b3tr/pull/2139/commits/8a1447fc11081947c61e48caab077c7c8311e9ff
      await veBetterPassport.connect(entity).removeEntityLink(entity.address)

      // Verify passport counters remain at 0 (not underflowed)
      expect(await veBetterPassport.signaledCounter(passport.address)).to.equal(0)
      expect(await veBetterPassport.appSignalsCounter(appId, passport.address)).to.equal(0)

      // Entity signals should be unchanged since they're not affected by the link removal
      expect(await veBetterPassport.signaledCounter(entity.address)).to.equal(2)
      expect(await veBetterPassport.appSignalsCounter(appId, entity.address)).to.equal(2)
    })
  })
})
