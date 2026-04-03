import { ethers } from "hardhat"
import { expect } from "chai"
import { describe, it } from "mocha"
import { getOrDeployContractInstances } from "../helpers"
import { setupSignalingFixture } from "./fixture.test"
import { endorseApp } from "../helpers/xnodes"

// Helper to create a second app using a fresh creator account
async function createSecondApp(contracts: Awaited<ReturnType<typeof setupSignalingFixture>>) {
  const { owner, otherAccounts, x2EarnApps, veBetterPassport } = contracts
  const { x2EarnCreator } = await getOrDeployContractInstances({ forceDeploy: false })

  const app2Creator = otherAccounts[10]
  await x2EarnCreator.connect(owner).safeMint(app2Creator.address)
  await x2EarnApps.connect(app2Creator).submitApp(app2Creator.address, app2Creator, app2Creator.address, "uri2")
  const app2Id = ethers.keccak256(ethers.toUtf8Bytes(app2Creator.address))
  await endorseApp(app2Id, app2Creator)
  await veBetterPassport.connect(owner).setAppSecurity(app2Id, 1)

  return app2Id
}

describe("VeBetterPassport Round Tracking - @shard8a", function () {
  describe("userRoundAppCount", function () {
    it("should return 0 for a user with no interactions", async function () {
      const { veBetterPassport, otherAccounts } = await setupSignalingFixture()
      expect(await veBetterPassport.userRoundAppCount(otherAccounts[2].address, 1)).to.equal(0)
    })

    it("should increment when a user interacts with an app in a round", async function () {
      const { veBetterPassport, owner, otherAccounts, appId } = await setupSignalingFixture()
      const user = otherAccounts[2]

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)

      expect(await veBetterPassport.userRoundAppCount(user.address, 1)).to.equal(1)
    })

    it("should not double-count the same app in the same round", async function () {
      const { veBetterPassport, owner, otherAccounts, appId } = await setupSignalingFixture()
      const user = otherAccounts[2]

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)

      expect(await veBetterPassport.userRoundAppCount(user.address, 1)).to.equal(1)
    })

    it("should count distinct apps in the same round", async function () {
      const contracts = await setupSignalingFixture()
      const { veBetterPassport, owner, otherAccounts, appId } = contracts
      const user = otherAccounts[2]

      const app2Id = await createSecondApp(contracts)

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, app2Id, 1)

      expect(await veBetterPassport.userRoundAppCount(user.address, 1)).to.equal(2)
    })

    it("should track counts independently per round", async function () {
      const { veBetterPassport, owner, otherAccounts, appId } = await setupSignalingFixture()
      const user = otherAccounts[2]

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 2)

      expect(await veBetterPassport.userRoundAppCount(user.address, 1)).to.equal(1)
      expect(await veBetterPassport.userRoundAppCount(user.address, 2)).to.equal(1)
      expect(await veBetterPassport.userRoundAppCount(user.address, 3)).to.equal(0)
    })
  })

  describe("userRoundActionCount", function () {
    it("should return 0 for a user with no actions", async function () {
      const { veBetterPassport, otherAccounts } = await setupSignalingFixture()
      expect(await veBetterPassport.userRoundActionCount(otherAccounts[2].address, 1)).to.equal(0)
    })

    it("should increment for each action registered in the round", async function () {
      const contracts = await setupSignalingFixture()
      const { veBetterPassport, owner, otherAccounts, appId } = contracts
      const user = otherAccounts[2]

      const app2Id = await createSecondApp(contracts)

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, app2Id, 1)

      expect(await veBetterPassport.userRoundActionCount(user.address, 1)).to.equal(3)
    })

    it("should track counts independently per round", async function () {
      const { veBetterPassport, owner, otherAccounts, appId } = await setupSignalingFixture()
      const user = otherAccounts[2]

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 2)

      expect(await veBetterPassport.userRoundActionCount(user.address, 1)).to.equal(2)
      expect(await veBetterPassport.userRoundActionCount(user.address, 2)).to.equal(1)
      expect(await veBetterPassport.userRoundActionCount(user.address, 3)).to.equal(0)
    })

    it("should not count actions for blacklisted users", async function () {
      const { veBetterPassport, owner, otherAccounts, appId } = await setupSignalingFixture()
      const user = otherAccounts[2]

      await veBetterPassport.connect(owner).blacklist(user.address)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)

      expect(await veBetterPassport.userRoundActionCount(user.address, 1)).to.equal(0)
    })
  })

  describe("appRoundActionCount", function () {
    it("should return 0 for an app with no actions", async function () {
      const { veBetterPassport, appId } = await setupSignalingFixture()
      expect(await veBetterPassport.appRoundActionCount(appId, 1)).to.equal(0)
    })

    it("should increment for each action registered", async function () {
      const { veBetterPassport, owner, otherAccounts, appId } = await setupSignalingFixture()

      await veBetterPassport.connect(owner).registerActionForRound(otherAccounts[2].address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccounts[3].address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(otherAccounts[4].address, appId, 1)

      expect(await veBetterPassport.appRoundActionCount(appId, 1)).to.equal(3)
    })

    it("should count multiple actions from the same user", async function () {
      const { veBetterPassport, owner, otherAccounts, appId } = await setupSignalingFixture()
      const user = otherAccounts[2]

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)

      expect(await veBetterPassport.appRoundActionCount(appId, 1)).to.equal(2)
    })

    it("should track counts independently per round", async function () {
      const { veBetterPassport, owner, otherAccounts, appId } = await setupSignalingFixture()
      const user = otherAccounts[2]

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 2)

      expect(await veBetterPassport.appRoundActionCount(appId, 1)).to.equal(2)
      expect(await veBetterPassport.appRoundActionCount(appId, 2)).to.equal(1)
    })

    it("should track counts independently per app", async function () {
      const contracts = await setupSignalingFixture()
      const { veBetterPassport, owner, otherAccounts, appId } = contracts
      const user = otherAccounts[2]

      const app2Id = await createSecondApp(contracts)

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, app2Id, 1)

      expect(await veBetterPassport.appRoundActionCount(appId, 1)).to.equal(3)
      expect(await veBetterPassport.appRoundActionCount(app2Id, 1)).to.equal(1)
    })

    it("should not count actions for blacklisted users", async function () {
      const { veBetterPassport, owner, otherAccounts, appId } = await setupSignalingFixture()
      const user = otherAccounts[2]

      await veBetterPassport.connect(owner).blacklist(user.address)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)

      expect(await veBetterPassport.appRoundActionCount(appId, 1)).to.equal(0)
    })
  })

  describe("userUniqueAppInteraction", function () {
    it("should return false for a user that never interacted with an app", async function () {
      const { veBetterPassport, otherAccounts, appId } = await setupSignalingFixture()
      expect(await veBetterPassport.userUniqueAppInteraction(otherAccounts[2].address, appId)).to.equal(false)
    })

    it("should return true after a user interacts with an app", async function () {
      const { veBetterPassport, owner, otherAccounts, appId } = await setupSignalingFixture()
      const user = otherAccounts[2]

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)

      expect(await veBetterPassport.userUniqueAppInteraction(user.address, appId)).to.equal(true)
    })
  })

  describe("userInteractedApps", function () {
    it("should return empty array for a user with no interactions", async function () {
      const { veBetterPassport, otherAccounts } = await setupSignalingFixture()
      expect(await veBetterPassport.userInteractedApps(otherAccounts[2].address)).to.deep.equal([])
    })

    it("should return all apps a user has interacted with", async function () {
      const contracts = await setupSignalingFixture()
      const { veBetterPassport, owner, otherAccounts, appId } = contracts
      const user = otherAccounts[2]

      const app2Id = await createSecondApp(contracts)

      await veBetterPassport.connect(owner).registerActionForRound(user.address, appId, 1)
      await veBetterPassport.connect(owner).registerActionForRound(user.address, app2Id, 1)

      const apps = await veBetterPassport.userInteractedApps(user.address)
      expect(apps).to.have.lengthOf(2)
      expect(apps).to.include(appId)
      expect(apps).to.include(app2Id)
    })
  })
})
