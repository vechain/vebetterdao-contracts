import { ethers } from "hardhat"
import { expect } from "chai"
import {
  ZERO_ADDRESS,
  bootstrapEmissions,
  calculateBaseAllocationOffChain,
  calculateUnallocatedAppAllocationOffChain,
  calculateVariableAppAllocationOffChain,
  catchRevert,
  getOrDeployContractInstances,
  getVot3Tokens,
  moveToCycle,
  startNewAllocationRound,
  waitForRoundToEnd,
} from "./helpers"
import { describe, it } from "mocha"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { createLocalConfig } from "../config/contracts/envs/local"
import { deployProxy, upgradeProxy } from "../scripts/helpers"
import { XAllocationPool, XAllocationPoolV1 } from "../typechain-types"

describe("X-Allocation Pool - @shard3", async function () {
  describe("Deployment", async function () {
    it("Contract is correctly initialized", async function () {
      const { xAllocationPool, owner, x2EarnApps, emissions, b3tr, treasury } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await xAllocationPool.treasury()).to.eql(await treasury.getAddress())
      expect(await xAllocationPool.b3tr()).to.eql(await b3tr.getAddress())
      expect(await xAllocationPool.emissions()).to.eql(await emissions.getAddress())
      expect(await xAllocationPool.x2EarnApps()).to.eql(await x2EarnApps.getAddress())

      const DEFAULT_ADMIN_ROLE = await xAllocationPool.DEFAULT_ADMIN_ROLE()
      const UPGRADER_ROLE = await xAllocationPool.UPGRADER_ROLE()

      expect(await xAllocationPool.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.eql(true)
      expect(await xAllocationPool.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)
    })

    it("Should revert if admin is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, b3tr, treasury, x2EarnApps, x2EarnRewardsPool } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("XAllocationPool", [
          ZERO_ADDRESS,
          owner.address,
          owner.address,
          await b3tr.getAddress(),
          await treasury.getAddress(),
          await x2EarnApps.getAddress(),
          await x2EarnRewardsPool.getAddress(),
        ]),
      ).to.be.reverted
    })
  })

  describe("Contract upgradeablity", () => {
    it("Admin should be able to upgrade the contract", async function () {
      const { xAllocationPool, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("XAllocationPool")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await xAllocationPool.getAddress())

      const UPGRADER_ROLE = await xAllocationPool.UPGRADER_ROLE()
      expect(await xAllocationPool.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(xAllocationPool.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await xAllocationPool.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only admin should be able to upgrade the contract", async function () {
      const { xAllocationPool, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("XAllocationPool")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await xAllocationPool.getAddress())

      const UPGRADER_ROLE = await xAllocationPool.UPGRADER_ROLE()
      expect(await xAllocationPool.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(xAllocationPool.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to
        .be.reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await xAllocationPool.getAddress())

      expect(newImplAddress.toUpperCase()).to.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.not.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Admin can change UPGRADER_ROLE", async function () {
      const { xAllocationPool, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("XAllocationPool")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await xAllocationPool.getAddress())

      const UPGRADER_ROLE = await xAllocationPool.UPGRADER_ROLE()
      expect(await xAllocationPool.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(xAllocationPool.connect(owner).grantRole(UPGRADER_ROLE, otherAccount.address)).to.not.be.reverted
      await expect(xAllocationPool.connect(owner).revokeRole(UPGRADER_ROLE, owner.address)).to.not.be.reverted

      await expect(xAllocationPool.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to
        .not.be.reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await xAllocationPool.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Cannot deploy contract with zero address", async function () {
      const { b3tr, treasury, owner, x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      await expect(
        deployProxy("XAllocationPool", [
          owner.address,
          owner.address,
          owner.address,
          ZERO_ADDRESS,
          await treasury.getAddress(),
          await x2EarnApps.getAddress(),
          owner.address,
        ]),
      ).to.be.reverted

      await expect(
        deployProxy("XAllocationPool", [
          owner.address,
          owner.address,
          owner.address,
          await b3tr.getAddress(),
          ZERO_ADDRESS,
          await x2EarnApps.getAddress(),
          owner.address,
        ]),
      ).to.be.reverted

      await expect(
        deployProxy("XAllocationPool", [
          owner.address,
          owner.address,
          owner.address,
          await b3tr.getAddress(),
          await treasury.getAddress(),
          ZERO_ADDRESS,
          owner.address,
        ]),
      ).to.be.reverted

      await expect(
        deployProxy("XAllocationPool", [
          owner.address,
          owner.address,
          owner.address,
          await b3tr.getAddress(),
          await treasury.getAddress(),
          owner.address,
          ZERO_ADDRESS,
        ]),
      ).to.be.reverted
    })

    it("Cannot initilize twice", async function () {
      const { xAllocationPool, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      await catchRevert(
        xAllocationPool.initialize(
          owner.address,
          owner.address,
          owner.address,
          owner.address,
          owner.address,
          owner.address,
          owner.address,
        ),
      )
    })

    it("Should return correct version of the contract", async () => {
      const { xAllocationPool } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await xAllocationPool.version()).to.equal("2")
    })

    it("Should not have state conflict after upgrading to V2", async () => {
      const config = createLocalConfig()
      config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 100
      config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE = 0
      config.INITIAL_X_ALLOCATION = 10000n
      config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE = 0
      const {
        otherAccounts,
        owner,
        b3tr,
        x2EarnRewardsPool,
        emissions,
        x2EarnApps,
        xAllocationVoting,
        treasury,
        veBetterPassport,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      // Deploy XAllocationPool
      const xAllocationPoolV1 = (await deployProxy("XAllocationPoolV1", [
        owner.address,
        owner.address,
        owner.address,
        await b3tr.getAddress(),
        await treasury.getAddress(),
        await x2EarnApps.getAddress(),
        await x2EarnRewardsPool.getAddress(),
      ])) as XAllocationPoolV1

      await xAllocationPoolV1.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())
      await xAllocationPoolV1.connect(owner).setEmissionsAddress(await emissions.getAddress())

      // Bootstrap emissions
      await bootstrapEmissions()

      otherAccounts.forEach(async account => {
        await veBetterPassport.whitelist(account.address)
        await getVot3Tokens(account, "10000")
      })

      await veBetterPassport.toggleCheck(1)

      //Add apps
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app", "metadataURI")
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #2", "metadataURI")
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[5].address, otherAccounts[5].address, "My app #3", "metadataURI")

      //Start allocation round
      const round1 = await startNewAllocationRound()

      // Vote
      await xAllocationVoting
        .connect(otherAccounts[1])
        .castVote(round1, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[2])
        .castVote(round1, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[3])
        .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[4])
        .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[5])
        .castVote(round1, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

      await waitForRoundToEnd(round1)

      const app1round1Earnings = await xAllocationPoolV1.roundEarnings(round1, app1Id)
      const app2round1Earnings = await xAllocationPoolV1.roundEarnings(round1, app2Id)
      const app3round1Earnings = await xAllocationPoolV1.roundEarnings(round1, app3Id)

      expect(app1round1Earnings[0]).to.eql(1144n)
      expect(app2round1Earnings[0]).to.eql(5993n)
      expect(app3round1Earnings[0]).to.eql(2861n)

      //Start allocation round
      const round2 = await startNewAllocationRound()

      // Vote
      await xAllocationVoting
        .connect(otherAccounts[1])
        .castVote(round2, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[2])
        .castVote(round2, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[3])
        .castVote(round2, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[4])
        .castVote(round2, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[5])
        .castVote(round2, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

      await waitForRoundToEnd(round2)

      // start new round
      const app1round2Earnings = await xAllocationPoolV1.roundEarnings(round2, app1Id)
      const app2round2Earnings = await xAllocationPoolV1.roundEarnings(round2, app2Id)
      const app3round2Earnings = await xAllocationPoolV1.roundEarnings(round2, app3Id)

      expect(app1round2Earnings[0]).to.eql(1144n)
      expect(app2round2Earnings[0]).to.eql(5993n)
      expect(app3round2Earnings[0]).to.eql(2861n)

      let storageSlots = []

      const initialSlot = BigInt("0xba46220259871765522240056f76631a28aa19c5092d6dd51d6b858b4ebcb300") // Slot 0 of VoterRewards

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlots.push(await ethers.provider.getStorage(await xAllocationPoolV1.getAddress(), i))
      }

      storageSlots = storageSlots.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      ) // removing empty slots

      const xAllocationPool = (await upgradeProxy(
        "XAllocationPoolV1",
        "XAllocationPool",
        await xAllocationPoolV1.getAddress(),
        [],
        {
          version: 2,
        },
      )) as XAllocationPool

      const storageSlotsAfter = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await xAllocationPool.getAddress(), i))
      }

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      otherAccounts.forEach(async account => {
        await getVot3Tokens(account, "10000")
      })

      //Start allocation round
      const round3 = await startNewAllocationRound()

      // Check Quadratic Funding is on
      expect(await xAllocationPool.isQuadraticFundingDisabledForCurrentRound()).to.eql(false)

      // Vote
      await xAllocationVoting
        .connect(otherAccounts[1])
        .castVote(round3, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[2])
        .castVote(round3, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[3])
        .castVote(round3, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[4])
        .castVote(round3, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])

      // Turn off quadratic funding mid round
      await xAllocationPool.connect(owner).toggleQuadraticFunding()

      await xAllocationVoting
        .connect(otherAccounts[5])
        .castVote(round3, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

      await waitForRoundToEnd(round3)

      const app1round3Earnings = await xAllocationPool.roundEarnings(round3, app1Id)
      const app2round3Earnings = await xAllocationPool.roundEarnings(round3, app2Id)
      const app3round3Earnings = await xAllocationPool.roundEarnings(round3, app3Id)

      expect(app1round3Earnings[0]).to.eql(1144n)
      expect(app2round3Earnings[0]).to.eql(5993n)
      expect(app3round3Earnings[0]).to.eql(2861n) // remains quadratic

      //Start allocation round
      const round4 = await startNewAllocationRound()

      // Check Quadratic Funding is off
      expect(await xAllocationPool.isQuadraticFundingDisabledForCurrentRound()).to.eql(true)

      expect(await xAllocationPool.isQuadraticFundingDisabledForRound(round4)).to.eql(true)

      // Vote
      await xAllocationVoting
        .connect(otherAccounts[1])
        .castVote(round4, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[2])
        .castVote(round4, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[3])
        .castVote(round4, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[4])
        .castVote(round4, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
      await xAllocationVoting
        .connect(otherAccounts[5])
        .castVote(round4, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

      await waitForRoundToEnd(round4)

      // start new round

      const app1round4Earnings = await xAllocationPool.roundEarnings(round4, app1Id)
      const app2round4Earnings = await xAllocationPool.roundEarnings(round4, app2Id)
      const app3round4Earnings = await xAllocationPool.roundEarnings(round4, app3Id)

      /*
        app1 percentage = 1000 / 3100 = 32.25% (No cap)
        app2 percentage = 1600 / 3100 = 51.61% (No cap)
        app3 percentage = 500 / 3100 = 16.12%
      */
      expect(app1round4Earnings[0]).to.eql(3225n)
      expect(app2round4Earnings[0]).to.eql(5161n)
      expect(app3round4Earnings[0]).to.eql(1612n)

      // Check that round earings from round 1 are still the same after toggle
      const app1round1Earnings1 = await xAllocationPool.roundEarnings(round1, app1Id)
      const app2round1Earnings2 = await xAllocationPool.roundEarnings(round1, app2Id)
      const app3round1Earnings3 = await xAllocationPool.roundEarnings(round1, app3Id)

      // Check that round earings from round 1 are still the same after toggle
      expect(app1round1Earnings1[0]).to.eql(1144n)
      expect(app2round1Earnings2[0]).to.eql(5993n)
      expect(app3round1Earnings3[0]).to.eql(2861n)
    })
  })

  describe("Settings", async function () {
    describe("Treasury address", async function () {
      it("Admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set treasury address", async function () {
        const { xAllocationPool, owner, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        expect(
          await xAllocationPool.hasRole(await xAllocationPool.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address),
        ).to.eql(true)

        const newTreasuryAddress = otherAccount.address

        await xAllocationPool.connect(owner).setTreasuryAddress(newTreasuryAddress)

        const treasuryAddress = await xAllocationPool.treasury()

        expect(treasuryAddress).to.eql(newTreasuryAddress)
      })

      it("Only admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set treasury address", async function () {
        const { xAllocationPool, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        expect(
          await xAllocationPool.hasRole(await xAllocationPool.CONTRACTS_ADDRESS_MANAGER_ROLE(), otherAccount.address),
        ).to.eql(false)

        const newTreasuryAddress = otherAccount.address

        await expect(xAllocationPool.connect(otherAccount).setTreasuryAddress(newTreasuryAddress)).to.be.reverted
      })

      it("Cannot set treasury address to zero address", async function () {
        const { xAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newTreasuryAddress = ZERO_ADDRESS

        await expect(xAllocationPool.connect(owner).setTreasuryAddress(newTreasuryAddress)).to.be.reverted
      })
    })

    describe("Emissions address", async function () {
      it("Admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set emissions contract address", async function () {
        const { xAllocationPool, owner, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        expect(
          await xAllocationPool.hasRole(await xAllocationPool.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address),
        ).to.eql(true)

        const newEmissionsAddress = otherAccount.address

        await xAllocationPool.connect(owner).setEmissionsAddress(newEmissionsAddress)

        const emissionsAddress = await xAllocationPool.emissions()

        expect(emissionsAddress).to.eql(newEmissionsAddress)
      })

      it("Only admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set emissions contract address", async function () {
        const { xAllocationPool, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        expect(
          await xAllocationPool.hasRole(await xAllocationPool.CONTRACTS_ADDRESS_MANAGER_ROLE(), otherAccount.address),
        ).to.eql(false)

        const newEmissionsAddress = otherAccount.address

        await expect(xAllocationPool.connect(otherAccount).setEmissionsAddress(newEmissionsAddress)).to.be.reverted
      })

      it("Cannot set emissions contract address to zero address", async function () {
        const { xAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newEmissionsAddress = ZERO_ADDRESS

        await expect(xAllocationPool.connect(owner).setEmissionsAddress(newEmissionsAddress)).to.be.reverted
      })

      it("Cannot calculate emissions amount if emissions contract is not set", async function () {
        const { owner, b3tr, treasury, x2EarnApps, x2EarnRewardsPool } = await getOrDeployContractInstances({
          forceDeploy: false,
        })

        // Deploy XAllocationPool
        const xAllocationPool = (await deployProxy("XAllocationPool", [
          owner.address,
          owner.address,
          owner.address,
          await b3tr.getAddress(),
          await treasury.getAddress(),
          await x2EarnApps.getAddress(),
          await x2EarnRewardsPool.getAddress(),
        ])) as XAllocationPool

        await xAllocationPool.setXAllocationVotingAddress(owner.address)

        expect(await xAllocationPool.emissions()).to.eql(ZERO_ADDRESS)

        await expect(xAllocationPool.baseAllocationAmount(1)).to.be.reverted
      })
    })

    describe("XAllocationVoting address", async function () {
      it("Admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set xAllocationVoting contract address", async function () {
        const { xAllocationPool, owner, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        expect(
          await xAllocationPool.hasRole(await xAllocationPool.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address),
        ).to.eql(true)

        const newXAllocationVotingAddress = otherAccount.address

        await xAllocationPool.connect(owner).setXAllocationVotingAddress(newXAllocationVotingAddress)

        const xAllocationVotingAddress = await xAllocationPool.xAllocationVoting()

        expect(xAllocationVotingAddress).to.eql(newXAllocationVotingAddress)
      })

      it("Only admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set xAllocationVoting contract address", async function () {
        const { xAllocationPool, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        expect(
          await xAllocationPool.hasRole(await xAllocationPool.CONTRACTS_ADDRESS_MANAGER_ROLE(), otherAccount.address),
        ).to.eql(false)

        const newXAllocationVotingAddress = otherAccount.address

        await expect(xAllocationPool.connect(otherAccount).setXAllocationVotingAddress(newXAllocationVotingAddress)).to
          .be.reverted
      })

      it("Cannot set xAllocationVoting contract address to zero address", async function () {
        const { xAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newXAllocationVotingAddress = ZERO_ADDRESS

        await expect(xAllocationPool.connect(owner).setXAllocationVotingAddress(newXAllocationVotingAddress)).to.be
          .reverted
      })

      it("Cannot call getAppShares or baseAllocationAmount if xAllocationVoting is not set", async function () {
        const { owner, b3tr, treasury, x2EarnApps, x2EarnRewardsPool } = await getOrDeployContractInstances({
          forceDeploy: false,
        })

        // Deploy XAllocationPool
        const xAllocationPool = (await deployProxy("XAllocationPool", [
          owner.address,
          owner.address,
          owner.address,
          await b3tr.getAddress(),
          await treasury.getAddress(),
          await x2EarnApps.getAddress(),
          await x2EarnRewardsPool.getAddress(),
        ])) as XAllocationPool

        expect(await xAllocationPool.xAllocationVoting()).to.eql(ZERO_ADDRESS)

        await expect(xAllocationPool.baseAllocationAmount(1)).to.be.reverted
        await expect(xAllocationPool.getAppShares(1, ethers.keccak256(ethers.toUtf8Bytes(ZERO_ADDRESS)))).to.be.reverted
      })
    })

    describe("x2EarnApps address", async function () {
      it("Admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set x2EarnApps contract address", async function () {
        const { xAllocationPool, owner, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        expect(
          await xAllocationPool.hasRole(await xAllocationPool.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address),
        ).to.eql(true)

        const newX2EarnAppsAddress = otherAccount.address

        await xAllocationPool.connect(owner).setX2EarnAppsAddress(newX2EarnAppsAddress)

        const x2EarnAppsAddress = await xAllocationPool.x2EarnApps()

        expect(x2EarnAppsAddress).to.eql(newX2EarnAppsAddress)
      })

      it("Only admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set x2EarnApps contract address", async function () {
        const { xAllocationPool, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        expect(
          await xAllocationPool.hasRole(await xAllocationPool.CONTRACTS_ADDRESS_MANAGER_ROLE(), otherAccount.address),
        ).to.eql(false)

        const newX2EarnAppsAddress = otherAccount.address

        await expect(xAllocationPool.connect(otherAccount).setX2EarnAppsAddress(newX2EarnAppsAddress)).to.be.reverted
      })

      it("Cannot set x2EarnApps contract address to zero address", async function () {
        const { xAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newX2EarnAppsAddress = ZERO_ADDRESS

        await expect(xAllocationPool.connect(owner).setX2EarnAppsAddress(newX2EarnAppsAddress)).to.be.reverted
      })
    })
  })

  describe("Allocation rewards for x-apps", async function () {
    describe("App shares and base allocation", async function () {
      it("App can receive a max amount of allocation share and unallocated amount gets sent to treasury", async function () {
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, x2EarnApps, veBetterPassport } =
          await getOrDeployContractInstances({
            forceDeploy: true,
          })

        // Bootstrap emissions
        await bootstrapEmissions()

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #2", "metadataURI")

        //Start allocation round
        const round1 = await startNewAllocationRound()
        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(round1)

        // expect not to be cupped since it's lower than maxCapPercentage
        let app1Shares = await xAllocationPool.getAppShares(round1, app1Id)
        expect(app1Shares[0]).to.eql(1000n)

        let app2Shares = await xAllocationPool.getAppShares(round1, app2Id)

        // should be capped to 20%
        let maxCapPercentage = await xAllocationPool.scaledAppSharesCap(round1)
        expect(app2Shares[0]).to.eql(maxCapPercentage)
        expect(app2Shares[1]).to.eql(7000n) // 100% - baseAllocation(10%) - app1Shares(20%) = 70%
      })

      it("Every app in the round receives a base allocation", async function () {
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, b3tr, emissions, minterAccount, x2EarnApps } =
          await getOrDeployContractInstances({
            forceDeploy: true,
          })

        // SEED DATA

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app1ReceiverAddress = otherAccounts[3].address
        const app2ReceiverAddress = otherAccounts[4].address
        await x2EarnApps.connect(owner).addApp(app1ReceiverAddress, app1ReceiverAddress, "My app", "metadataURI")
        await x2EarnApps.connect(owner).addApp(app2ReceiverAddress, app2ReceiverAddress, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        //Start allocation round
        const round1 = parseInt((await xAllocationVoting.currentRoundId()).toString())
        // Nobody votes
        await waitForRoundToEnd(round1)
        await xAllocationVoting.finalizeRound(round1)

        // ENDED SEEDING DATA

        // Send 100% to the team instead of x2EarnRewardsPool
        await x2EarnApps.connect(owner).setTeamAllocationPercentage(app1Id, 100)
        await x2EarnApps.connect(owner).setTeamAllocationPercentage(app2Id, 100)

        // CLAIMING
        const baseAllocationAmount = await xAllocationPool.baseAllocationAmount(round1)

        let app1Revenue = await xAllocationPool.roundEarnings(round1, app1Id)
        let app2Revenue = await xAllocationPool.roundEarnings(round1, app2Id)
        expect(app1Revenue[0]).to.eql(baseAllocationAmount)
        expect(app2Revenue[0]).to.eql(baseAllocationAmount)

        let app1Balance = await b3tr.balanceOf(app1ReceiverAddress)
        let app2Balance = await b3tr.balanceOf(app2ReceiverAddress)

        expect(app1Balance).to.eql(0n)
        expect(app2Balance).to.eql(0n)

        await xAllocationPool.claim(round1, app1Id)
        await xAllocationPool.claim(round1, app2Id)

        app1Balance = await b3tr.balanceOf(app1ReceiverAddress)
        app2Balance = await b3tr.balanceOf(app2ReceiverAddress)

        expect(app1Balance).to.eql(baseAllocationAmount)
        expect(app2Balance).to.eql(baseAllocationAmount)
      })

      it("New app of failed round receives a base allocation even if it was not eligible in previous round", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          veBetterPassport,
          xAllocationPool,
          b3tr,
          emissions,
          minterAccount,
          x2EarnApps,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        // SEED DATA

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app1ReceiverAddress = otherAccounts[3].address
        const app2ReceiverAddress = otherAccounts[4].address
        await x2EarnApps.connect(owner).addApp(app1ReceiverAddress, app1ReceiverAddress, "My app", "metadataURI")
        await x2EarnApps.connect(owner).addApp(app2ReceiverAddress, app2ReceiverAddress, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Start allocation round
        const round1 = parseInt((await xAllocationVoting.currentRoundId()).toString())

        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(round1)
        await xAllocationVoting.finalizeRound(round1)

        let state = await xAllocationVoting.state(round1)
        // should be succeeded
        expect(state).to.eql(2n)

        // new emission, new round and new app
        const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))
        const app3ReceiverAddress = otherAccounts[4].address
        await x2EarnApps.connect(owner).addApp(app3ReceiverAddress, app3ReceiverAddress, "My app #3", "metadataURI")
        await x2EarnApps.connect(otherAccounts[4]).setTeamAllocationPercentage(app3Id, 100)
        await moveToCycle(3)
        const round2 = parseInt((await xAllocationVoting.currentRoundId()).toString())
        expect(round2).to.eql(2)

        await xAllocationVoting.connect(voter1).castVote(round2, [app3Id], [ethers.parseEther("1")])
        await waitForRoundToEnd(round2)
        await xAllocationVoting.finalizeRound(round2)

        state = await xAllocationVoting.state(round2)
        // should be failed
        expect(state).to.eql(1n)

        const baseAllocationAmount = await xAllocationPool.baseAllocationAmount(round2)

        let round1Votes = await xAllocationVoting.getAppVotes(round1, app3Id)
        expect(round1Votes).to.eql(0n)
        let round2Votes = await xAllocationVoting.getAppVotes(round2, app3Id)
        expect(round2Votes).to.eql(ethers.parseEther("1"))

        let app3Revenue = await xAllocationPool.roundEarnings(round2, app3Id)
        expect(app3Revenue[0]).to.eql(baseAllocationAmount)

        let app3Balance = await b3tr.balanceOf(app3ReceiverAddress)
        expect(app3Balance).to.eql(0n)

        await xAllocationPool.claim(round2, app3Id)

        app3Balance = await b3tr.balanceOf(app3ReceiverAddress)
        expect(app3Balance).to.eql(baseAllocationAmount)
      })

      it("App shares cap and unallocated share of a past round should be checkpointed", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "2000")

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        const round1 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting.connect(voter1).castVote(round1, [app1Id], [ethers.parseEther("1000")])

        await waitForRoundToEnd(Number(round1))
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(BigInt(2))

        // Update cap
        const GOVERNANCE_ROLE = await xAllocationVoting.GOVERNANCE_ROLE()
        await xAllocationVoting.connect(owner).grantRole(GOVERNANCE_ROLE, owner.address)
        await xAllocationVoting.connect(owner).setAppSharesCap(50)

        await xAllocationVoting.connect(owner).startNewRound()

        const round2 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting.connect(voter1).castVote(round2, [app1Id], [ethers.parseEther("1000")])

        await waitForRoundToEnd(Number(round2))

        const expectedBaseAllocationR1 = await calculateBaseAllocationOffChain(Number(round1))
        let expectedVariableAllocationR1App1 = await calculateVariableAppAllocationOffChain(Number(round1), app1Id)
        const expecteUnallocatedAllocationR1App1 = await calculateUnallocatedAppAllocationOffChain(
          Number(round1),
          app1Id,
        )

        // should be capped to 20%
        let maxCapPercentageR1 = await xAllocationPool.scaledAppSharesCap(round1)
        const appSharesR1A1 = await xAllocationPool.getAppShares(round1, app1Id)
        expect(appSharesR1A1[0]).to.eql(maxCapPercentageR1)
        // Unallocated amount should be 80%
        expect(appSharesR1A1[1]).to.eql(8000n) // 100% - appShareCap(20%) = 80%

        // should be capped to 50%
        let maxCapPercentageR2 = await xAllocationPool.scaledAppSharesCap(round2)
        const appSharesR2A1 = await xAllocationPool.getAppShares(round2, app1Id)
        expect(appSharesR2A1[0]).to.eql(maxCapPercentageR2)
        // Unallocated amount should be 50%
        expect(appSharesR2A1[1]).to.eql(5000n) // 100% - appShareCap(50%) = 50%

        let claimableRewardsR1App1 = await xAllocationPool.roundEarnings(round1, app1Id)
        expect(claimableRewardsR1App1[0]).to.eql(expectedVariableAllocationR1App1 + expectedBaseAllocationR1)
        expect(claimableRewardsR1App1[1]).to.eql(expecteUnallocatedAllocationR1App1)

        const expectedBaseAllocationR2 = await calculateBaseAllocationOffChain(Number(round2))
        let expectedVariableAllocationR2App1 = await calculateVariableAppAllocationOffChain(Number(round2), app1Id)
        const expecteUnallocatedAllocationR2App1 = await calculateUnallocatedAppAllocationOffChain(
          Number(round2),
          app1Id,
        )

        let claimableRewardsR2App1 = await xAllocationPool.roundEarnings(round2, app1Id)
        expect(claimableRewardsR2App1[0]).to.eql(expectedVariableAllocationR2App1 + expectedBaseAllocationR2)
        expect(claimableRewardsR2App1[1]).to.eql(expecteUnallocatedAllocationR2App1)
      })

      it("Base allocation of a past round should remain the same even if value has been updated", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "2000")

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        // Vote
        await xAllocationVoting.connect(voter1).castVote(round1, [app1Id], [ethers.parseEther("1000")])

        await waitForRoundToEnd(Number(round1))
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(BigInt(2))

        // Update BaseAllocationPercentage
        const GOVERNANCE_ROLE = await xAllocationVoting.GOVERNANCE_ROLE()
        await xAllocationVoting.connect(owner).grantRole(GOVERNANCE_ROLE, owner.address)
        await xAllocationVoting.connect(owner).setBaseAllocationPercentage(50)

        await xAllocationVoting.connect(owner).startNewRound()

        const round2 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting.connect(voter1).castVote(round2, [app1Id], [ethers.parseEther("1000")])

        await waitForRoundToEnd(Number(round2))

        const expectedBaseAllocationR1 = await calculateBaseAllocationOffChain(Number(round1))
        let expectedVariableAllocationR1App1 = await calculateVariableAppAllocationOffChain(Number(round1), app1Id)

        let claimableRewardsR1App1 = await xAllocationPool.roundEarnings(round1, app1Id)
        expect(claimableRewardsR1App1[0]).to.eql(expectedVariableAllocationR1App1 + expectedBaseAllocationR1)

        const expectedBaseAllocationR2 = await calculateBaseAllocationOffChain(Number(round2))
        let expectedVariableAllocationR2App1 = await calculateVariableAppAllocationOffChain(Number(round2), app1Id)
        let claimableRewardsR2App1 = await xAllocationPool.roundEarnings(round2, app1Id)
        expect(claimableRewardsR2App1[0]).to.eql(expectedVariableAllocationR2App1 + expectedBaseAllocationR2)
        expect(claimableRewardsR2App1[0]).to.eql(await xAllocationPool.getMaxAppAllocation(round2))
      })

      it("Cannot calculate base allocation amount and app shares if xAllocationVoting is not set", async function () {
        const config = createLocalConfig()
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, x2EarnApps, veBetterPassport } =
          await getOrDeployContractInstances({
            forceDeploy: true,
          })

        // Bootstrap emissions
        await bootstrapEmissions()

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #2", "metadataURI")

        //Start allocation round
        const round1 = await startNewAllocationRound()

        // (30% * Emissions)/ Number of apps
        const expectedBaseAllocation =
          (BigInt(config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE) * config.INITIAL_X_ALLOCATION) / (100n * 2n) //2 Apps

        // ((100% - 30%) * 20%) * Emissions
        const expectedMaxAppCapAllocation =
          ((100n - BigInt(config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE)) *
            BigInt(config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP) *
            config.INITIAL_X_ALLOCATION) /
          100n ** 2n

        // Get max allocations
        const maxAppAllocation = await xAllocationPool.getMaxAppAllocation(round1)

        expect(maxAppAllocation).to.eql(expectedMaxAppCapAllocation + expectedBaseAllocation)

        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(round1)

        const earnings = await xAllocationPool.roundEarnings(round1, app2Id)
        expect(earnings[0]).to.eql(maxAppAllocation)
      })
    })

    describe("App earnings", async function () {
      it("Allocation rewards are calculated correctly", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(Number(round1))
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(BigInt(2))

        let app1Shares = await xAllocationPool.getAppShares(round1, app1Id)
        expect(app1Shares[0]).to.eql(1000n)
        expect(app1Shares[1]).to.eql(0n)

        let app2Shares = await xAllocationPool.getAppShares(round1, app2Id)
        // should be capped to 20%
        // Remaining 70% should be retuned as unallocated
        let maxCapPercentage = await xAllocationPool.scaledAppSharesCap(round1)
        expect(app2Shares[0]).to.eql(maxCapPercentage)
        expect(app2Shares[1]).to.eql(7000n) // (alloctaedVotes)90% - app1Shares(20%) = 70%

        // Calculate base allocations
        let baseAllocationAmount = await xAllocationPool.baseAllocationAmount(round1)
        const expectedBaseAllocation = await calculateBaseAllocationOffChain(Number(round1))
        expect(baseAllocationAmount).to.eql(expectedBaseAllocation)

        let expectedVariableAllcoation = await calculateVariableAppAllocationOffChain(Number(round1), app1Id)
        let claimableRewards = await xAllocationPool.roundEarnings(round1, app1Id)
        expect(claimableRewards[0]).to.eql(expectedVariableAllcoation + expectedBaseAllocation)

        // Calculate allocation rewards
        let allocationRewards = await xAllocationPool.currentRoundEarnings(app1Id)
        expectedVariableAllcoation = await calculateVariableAppAllocationOffChain(Number(round1), app1Id)
        expect(allocationRewards).to.eql(expectedBaseAllocation + expectedVariableAllcoation)

        allocationRewards = await xAllocationPool.currentRoundEarnings(app2Id)
        expectedVariableAllcoation = await calculateVariableAppAllocationOffChain(Number(round1), app2Id)
        expect(allocationRewards).to.eql(expectedBaseAllocation + expectedVariableAllcoation)
      })

      it("Should correctly count live earnings when current round failed (round > 1 )", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(Number(round1))
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(2n)

        // Now we can go to round 2 and test our scenario
        await emissions.connect(minterAccount).distribute()
        const baseAllocationAmount = await xAllocationPool.baseAllocationAmount(round1)

        const round2 = await xAllocationVoting.currentRoundId()
        expect(round2).to.eql(2n)

        let realTimeApp1 = await xAllocationPool.currentRoundEarnings(app1Id)
        expect(realTimeApp1).to.eql(baseAllocationAmount)

        let realTimeApp2 = await xAllocationPool.currentRoundEarnings(app2Id)
        expect(realTimeApp2).to.eql(baseAllocationAmount)

        await waitForRoundToEnd(Number(round2))

        // Now round ended but a new one did not started so this should happen:
        // 1 - real time earnings should use shares from previous round -> earnings should be the same as previous round
        const round1App1Earnings = await xAllocationPool.roundEarnings(round1, app1Id)
        const round1App2Earnings = await xAllocationPool.roundEarnings(round1, app2Id)

        realTimeApp1 = await xAllocationPool.currentRoundEarnings(app1Id)
        expect(realTimeApp1).to.eql(round1App1Earnings[0])

        realTimeApp2 = await xAllocationPool.currentRoundEarnings(app2Id)
        expect(realTimeApp2).to.eql(round1App2Earnings[0])
      })

      it("When adding new app previous allocations should remain the same", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3")) // to add later
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()
        await emissions.connect(minterAccount).start()

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        const round1 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(Number(round1))
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(BigInt(2))

        const app1Earnings = await xAllocationPool.roundEarnings(round1, app1Id)
        const app2Earnings = await xAllocationPool.roundEarnings(round1, app2Id)
        const app3Earnings = await xAllocationPool.roundEarnings(round1, app3Id)
        expect(app3Earnings[0]).to.eql(0n)

        const baseAllocationAmountBeforeAddingApp3 = await xAllocationPool.baseAllocationAmount(round1)

        // Add new app
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #3", "metadataURI")

        // Start new round
        await emissions.distribute()

        expect(app1Earnings).to.eql(await xAllocationPool.roundEarnings(round1, app1Id))
        expect(app2Earnings).to.eql(await xAllocationPool.roundEarnings(round1, app2Id))
        expect(app3Earnings).to.eql(await xAllocationPool.roundEarnings(round1, app3Id))
        expect((await xAllocationPool.roundEarnings(round1, app3Id))[0]).to.eql(0n)

        expect(baseAllocationAmountBeforeAddingApp3).to.eql(await xAllocationPool.baseAllocationAmount(round1))

        await waitForRoundToEnd(Number(await xAllocationVoting.currentRoundId()))

        // remove app
        await x2EarnApps.connect(owner).setVotingEligibility(app3Id, false)

        // Start new round
        await emissions.distribute()

        const round3 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round3, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(Number(round3))
        state = await xAllocationVoting.state(round3)
        expect(state).to.eql(BigInt(2))

        const app1EarningsInRound3 = await xAllocationPool.roundEarnings(round3, app1Id)
        const app2EarningsInRound3 = await xAllocationPool.roundEarnings(round3, app2Id)
        const app3EarningsInRound3 = await xAllocationPool.roundEarnings(round3, app3Id)
        expect(app3EarningsInRound3[0]).to.eql(0n)

        // add again
        await x2EarnApps.connect(owner).setVotingEligibility(app3Id, true)

        // Start new round
        await emissions.distribute()

        expect(app1EarningsInRound3).to.eql(await xAllocationPool.roundEarnings(round3, app1Id))
        expect(app2EarningsInRound3).to.eql(await xAllocationPool.roundEarnings(round3, app2Id))
        expect(app3EarningsInRound3).to.eql(await xAllocationPool.roundEarnings(round3, app3Id))
        expect((await xAllocationPool.roundEarnings(round3, app3Id))[0]).to.eql(0n)
      })

      it("Cannot calculate earnings if xAllocationVoting is not set", async function () {
        const contract = await ethers.getContractFactory("XAllocationPool")
        const xAllocationPool = await contract.deploy()
        await xAllocationPool.waitForDeployment()

        let roundId = await startNewAllocationRound()

        await expect(xAllocationPool.currentRoundEarnings(ethers.keccak256(ethers.toUtf8Bytes("My app")))).to.be
          .reverted
        await expect(xAllocationPool.roundEarnings(roundId, ethers.keccak256(ethers.toUtf8Bytes("My app")))).to.be
          .reverted
      })

      it("Earnings should be calculated correctly when round failed", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()
        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(Number(round1))
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(2n) // succeeded

        const app1Earnings = await xAllocationPool.roundEarnings(round1, app1Id)
        const app2Earnings = await xAllocationPool.roundEarnings(round1, app2Id)

        // Start new round
        await emissions.connect(minterAccount).distribute()
        const round2 = await xAllocationVoting.currentRoundId()

        await waitForRoundToEnd(Number(round2))
        state = await xAllocationVoting.state(round2)
        expect(state).to.eql(1n) // failed

        const app1EarningsInRound2 = await xAllocationPool.roundEarnings(round2, app1Id)
        const app2EarningsInRound2 = await xAllocationPool.roundEarnings(round2, app2Id)

        expect(app1Earnings).to.eql(app1EarningsInRound2)
        expect(app2Earnings).to.eql(app2EarningsInRound2)
      })

      it("Max app allocation should be calculated correctly", async function () {})
    })
    describe("App claiming", async function () {
      it("Allocation rewards are claimed correctly", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          b3tr,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        // SEED DATA

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app1ReceiverAddress = otherAccounts[3].address
        const app2ReceiverAddress = otherAccounts[4].address
        await x2EarnApps.connect(owner).addApp(app1ReceiverAddress, app1ReceiverAddress, "My app", "metadataURI")
        await x2EarnApps.connect(owner).addApp(app2ReceiverAddress, app2ReceiverAddress, "My app #2", "metadataURI")

        // Set allocation percentage for the team to 100%
        await x2EarnApps.connect(otherAccounts[3]).setTeamAllocationPercentage(app1Id, 100)
        await x2EarnApps.connect(otherAccounts[4]).setTeamAllocationPercentage(app2Id, 100)

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Start allocation round
        const round1 = parseInt((await xAllocationVoting.currentRoundId()).toString())
        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(round1)
        await xAllocationVoting.finalizeRound(round1)

        // ENDED SEEDING DATA

        // CLAIMING
        let app1Revenue = await xAllocationPool.roundEarnings(round1, app1Id)
        let app2Revenue = await xAllocationPool.roundEarnings(round1, app2Id)

        let app1Balance = await b3tr.balanceOf(app1ReceiverAddress)
        let app2Balance = await b3tr.balanceOf(app2ReceiverAddress)

        expect(app1Balance).to.eql(0n)
        expect(app2Balance).to.eql(0n)

        expect(await xAllocationPool.claimed(round1, app1Id)).to.eql(false)
        await xAllocationPool.connect(otherAccounts[3]).claim(round1, app1Id)
        expect(await xAllocationPool.claimed(round1, app1Id)).to.eql(true)

        expect(await xAllocationPool.claimed(round1, app2Id)).to.eql(false)
        await xAllocationPool.connect(otherAccounts[4]).claim(round1, app2Id)
        expect(await xAllocationPool.claimed(round1, app2Id)).to.eql(true)

        app1Balance = await b3tr.balanceOf(app1ReceiverAddress)
        app2Balance = await b3tr.balanceOf(app2ReceiverAddress)

        expect(app1Balance).to.eql(app1Revenue[0])
        expect(app2Balance).to.eql(app2Revenue[0])
      })

      it("App cannot claim two times in the same round", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        // SEED DATA

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app1ReceiverAddress = otherAccounts[3].address
        const app2ReceiverAddress = otherAccounts[4].address
        await x2EarnApps.connect(owner).addApp(app1ReceiverAddress, app1ReceiverAddress, "My app", "metadataURI")
        await x2EarnApps.connect(owner).addApp(app2ReceiverAddress, app2ReceiverAddress, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        //Start allocation round
        const round1 = parseInt((await xAllocationVoting.currentRoundId()).toString())
        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(round1)
        await xAllocationVoting.finalizeRound(round1)

        // ENDED SEEDING DATA

        // CLAIMING

        expect(await xAllocationPool.claimed(round1, app1Id)).to.eql(false)
        await xAllocationPool.connect(otherAccounts[3]).claim(round1, app1Id)
        expect(await xAllocationPool.claimed(round1, app1Id)).to.eql(true)

        await catchRevert(xAllocationPool.connect(otherAccounts[3]).claim(round1, app1Id))
      })

      it("Anyone can trigger claiming of allocation to app", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          b3tr,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        // SEED DATA

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app1ReceiverAddress = otherAccounts[3].address
        const app2ReceiverAddress = otherAccounts[4].address
        await x2EarnApps.connect(owner).addApp(app1ReceiverAddress, app1ReceiverAddress, "My app", "metadataURI")
        await x2EarnApps.connect(owner).addApp(app2ReceiverAddress, app2ReceiverAddress, "My app #2", "metadataURI")

        // Set allocation percentage for the team to 100%
        await x2EarnApps.connect(otherAccounts[3]).setTeamAllocationPercentage(app1Id, 100)
        await x2EarnApps.connect(otherAccounts[4]).setTeamAllocationPercentage(app2Id, 100)

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        //Start allocation round
        const round1 = parseInt((await xAllocationVoting.currentRoundId()).toString())
        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(round1)
        await xAllocationVoting.finalizeRound(round1)

        // ENDED SEEDING DATA

        // CLAIMING
        let app1Revenue = await xAllocationPool.roundEarnings(round1, app1Id)

        let app1Balance = await b3tr.balanceOf(app1ReceiverAddress)
        expect(app1Balance).to.eql(0n)

        //claiming initiated by a random account
        await xAllocationPool.connect(otherAccounts[8]).claim(round1, app1Id)
        app1Balance = await b3tr.balanceOf(app1ReceiverAddress)
        expect(app1Balance).to.eql(app1Revenue[0])
      })

      it("Can claim first round even if it's not finalized", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        // SEED DATA

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app1ReceiverAddress = otherAccounts[3].address
        const app2ReceiverAddress = otherAccounts[4].address
        await x2EarnApps.connect(owner).addApp(app1ReceiverAddress, app1ReceiverAddress, "My app", "metadataURI")
        await x2EarnApps.connect(owner).addApp(app2ReceiverAddress, app2ReceiverAddress, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        //Start allocation round
        const round1 = parseInt((await xAllocationVoting.currentRoundId()).toString())
        // Vote
        await xAllocationVoting.connect(voter1).castVote(round1, [app1Id], [ethers.parseEther("1")])
        await waitForRoundToEnd(round1)

        // expect it's failed
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(1n)

        // ROUND IS NOT FINALIZED
        // await xAllocationVoting.finalizeRound(round1)

        // ENDED SEEDING DATA

        // CLAIMING
        await xAllocationPool.claim(round1, app1Id)
      })

      it("Can claim failed not finalized round [ROUND > 1]", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[2].address, otherAccounts[2].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(Number(round1))
        // round 1 should be succeed
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(2n)

        // Now we can go to round 2 and test our scenario
        await emissions.connect(minterAccount).distribute()

        const round2 = await xAllocationVoting.currentRoundId()
        expect(round2).to.eql(2n)

        await waitForRoundToEnd(Number(round2))
        // expect it's failed
        state = await xAllocationVoting.state(round2)
        expect(state).to.eql(1n)

        // ROUND IS NOT FINALIZED
        const isFinalized = await xAllocationVoting.isFinalized(round2)
        expect(isFinalized).to.eql(false)

        // CLAIMING
        await expect(xAllocationPool.claim(round1, app1Id)).not.to.be.reverted
      })

      it("Can claim failed round after it's finalized", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        // SEED DATA

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app1ReceiverAddress = otherAccounts[3].address
        const app2ReceiverAddress = otherAccounts[4].address
        await x2EarnApps.connect(owner).addApp(app1ReceiverAddress, app1ReceiverAddress, "My app", "metadataURI")
        await x2EarnApps.connect(owner).addApp(app2ReceiverAddress, app2ReceiverAddress, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        //Start allocation round
        const round1 = parseInt((await xAllocationVoting.currentRoundId()).toString())
        // Vote
        await xAllocationVoting.connect(voter1).castVote(round1, [app1Id], [ethers.parseEther("1")])
        await waitForRoundToEnd(round1)

        // expect it's failed
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(1n)

        // ROUND IS FINALIZED
        await xAllocationVoting.finalizeRound(round1)

        // ENDED SEEDING DATA

        // CLAIMING
        await expect(xAllocationPool.claim(round1, app1Id)).not.to.be.reverted
      })

      it("Cannot claim active round", async function () {
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, emissions, minterAccount, x2EarnApps } =
          await getOrDeployContractInstances({
            forceDeploy: true,
          })

        // SEED DATA

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app1ReceiverAddress = otherAccounts[3].address
        const app2ReceiverAddress = otherAccounts[4].address
        await x2EarnApps.connect(owner).addApp(app1ReceiverAddress, app1ReceiverAddress, "My app", "metadataURI")
        await x2EarnApps.connect(owner).addApp(app2ReceiverAddress, app2ReceiverAddress, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        //Start allocation round
        const round1 = parseInt((await xAllocationVoting.currentRoundId()).toString())

        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(0n)

        // CLAIMING
        await catchRevert(xAllocationPool.claim(round1, app1Id))
      })

      it("User should be able to check his available earnings to claim", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          b3tr,
          minterAccount,
          x2EarnApps,
          x2EarnRewardsPool,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[6].address, otherAccounts[6].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[7].address, otherAccounts[7].address, "My app #2", "metadataURI")

        // Set allocation percentage for the team to 100%
        await x2EarnApps.connect(otherAccounts[6]).setTeamAllocationPercentage(app1Id, 100)
        await x2EarnApps.connect(otherAccounts[7]).setTeamAllocationPercentage(app2Id, 100)

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        await x2EarnApps.setTeamAllocationPercentage(app1Id, 40)
        const teamAllocationPercentage = await x2EarnApps.teamAllocationPercentage(app1Id)

        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(Number(round1))
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(2n)

        let app1Shares = await xAllocationPool.getAppShares(round1, app1Id)
        expect(app1Shares[0]).to.eql(1000n)

        const claimableAmount = await xAllocationPool.claimableAmount(round1, app1Id)
        const expectedEarnings = await xAllocationPool.roundEarnings(round1, app1Id)
        expect(claimableAmount[0]).to.eql(expectedEarnings[0])

        // expect that the total amount is divided correctly in 2 parts:
        // 1. allocation reserved for the team
        // 1. allocation reserved for rewards

        const expectedTeamAmount = (teamAllocationPercentage * expectedEarnings[0]) / 100n

        expect(expectedTeamAmount).to.eql(expectedEarnings[2])

        let userBalance = await b3tr.balanceOf(otherAccounts[6].address)

        expect(userBalance).to.eql(0n)

        await xAllocationPool.connect(otherAccounts[6]).claim(round1, app1Id)

        // balance of user should be equal to expected earnings
        userBalance = await b3tr.balanceOf(otherAccounts[6].address)
        expect(userBalance).to.eql(expectedTeamAmount)

        // the rest should be inside X2EarnRewardsPool
        expect(await x2EarnRewardsPool.availableFunds(app1Id)).to.eql(expectedEarnings[3])

        // claimable amount should be 0
        const claimableAmountAfterClaim = await xAllocationPool.claimableAmount(round1, app1Id)
        expect(claimableAmountAfterClaim[0]).to.eql(0n)
      })

      it("Claimable amount for an active round should be 0", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[6].address, otherAccounts[6].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[7].address, otherAccounts[7].address, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(0n) //active

        const claimableAmount = await xAllocationPool.claimableAmount(round1, app1Id)
        expect(claimableAmount[0]).to.eql(0n)
      })

      it("Cannot claim 0 rewards", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        const GOVERNANCE_ROLE = await xAllocationVoting.GOVERNANCE_ROLE()
        await xAllocationVoting.grantRole(GOVERNANCE_ROLE, owner.address)
        await xAllocationVoting.setBaseAllocationPercentage(0)
        expect(await xAllocationVoting.baseAllocationPercentage()).to.eql(0n)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[6].address, otherAccounts[6].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[7].address, otherAccounts[7].address, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting.connect(voter1).castVote(round1, [app2Id], [ethers.parseEther("1000")])

        await waitForRoundToEnd(Number(round1))
        let state = await xAllocationVoting.state(round1)
        expect(state).to.eql(2n)

        const claimableAmount = await xAllocationPool.claimableAmount(round1, app1Id)
        expect(claimableAmount[0]).to.eql(0n)

        await catchRevert(xAllocationPool.connect(otherAccounts[6]).claim(round1, app1Id))
      })

      it("Cannot claim if b3tr token is paused", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          b3tr,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[6].address, otherAccounts[6].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[7].address, otherAccounts[7].address, "My app #2", "metadataURI")

        // Bootstrap emissions -> sends funds to contract
        await bootstrapEmissions()
        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting.connect(voter1).castVote(round1, [app2Id], [ethers.parseEther("1000")])

        await waitForRoundToEnd(Number(round1))

        // pause b3tr transfer
        await b3tr.pause()

        await catchRevert(xAllocationPool.connect(otherAccounts[6]).claim(round1, app1Id))
      })

      it("Cannot claim for app that does not exist", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[6].address, otherAccounts[6].address, "My app", "metadataURI")

        // Bootstrap emissions -> sends funds to contract
        await bootstrapEmissions()
        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting.connect(voter1).castVote(round1, [app1Id], [ethers.parseEther("1")])

        await waitForRoundToEnd(Number(round1))

        await catchRevert(
          xAllocationPool.connect(otherAccounts[6]).claim(round1, ethers.keccak256(ethers.toUtf8Bytes("My app #2"))),
        )
      })

      it("Should fail if not enough balance on contract", async function () {
        const {
          xAllocationPool,
          otherAccounts,
          x2EarnApps,
          xAllocationVoting,
          b3tr,
          emissions,
          owner,
          minterAccount,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        // Bootstrap emissions
        await bootstrapEmissions()

        await getVot3Tokens(otherAccounts[3], "10000")

        await veBetterPassport.whitelist(otherAccounts[3].address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps.addApp(otherAccounts[3].address, otherAccounts[3].address, "My app", "metadataURI")
        await x2EarnApps.addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #2", "metadataURI")

        // simulate first round
        await emissions.connect(minterAccount).start()
        await xAllocationVoting
          .connect(otherAccounts[3])
          .castVote(1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])
        await waitForRoundToEnd(1)

        await xAllocationPool.claim(1, app1Id)
        await xAllocationPool.claim(1, app2Id)

        //Start allocation round without passing throug emissions contract
        expect(await xAllocationVoting.hasRole(await xAllocationVoting.ROUND_STARTER_ROLE(), owner.address)).to.eql(
          true,
        )

        await xAllocationVoting.connect(owner).startNewRound()
        const roundId = await xAllocationVoting.currentRoundId()

        // vote
        await xAllocationVoting.connect(otherAccounts[3]).castVote(roundId, [app1Id], [ethers.parseEther("100")])

        await waitForRoundToEnd(roundId)

        expect(await b3tr.balanceOf(await xAllocationPool.getAddress())).to.eql(0n)

        await catchRevert(xAllocationPool.connect(otherAccounts[3]).claim(roundId, app1Id))
      })
    })

    describe("Unallocated funds", async function () {
      it("Unallocated rewards are returned to the treasury", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          b3tr,
          emissions,
          minterAccount,
          treasury,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        // SEED DATA

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app1ReceiverAddress = otherAccounts[3].address
        const app2ReceiverAddress = otherAccounts[4].address
        await x2EarnApps.connect(owner).addApp(app1ReceiverAddress, app1ReceiverAddress, "My app", "metadataURI")
        await x2EarnApps.connect(owner).addApp(app2ReceiverAddress, app2ReceiverAddress, "My app #2", "metadataURI")

        // Bootstrap emissions
        await bootstrapEmissions()

        await emissions.connect(minterAccount).start()

        //Start allocation round
        const round1 = parseInt((await xAllocationVoting.currentRoundId()).toString())
        // Vote
        await xAllocationVoting
          .connect(voter1)
          .castVote(round1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("900")])

        await waitForRoundToEnd(round1)
        await xAllocationVoting.finalizeRound(round1)

        // ENDED SEEDING DATA

        // CLAIMING
        let app1Revenue = await xAllocationPool.roundEarnings(round1, app1Id)
        let app2Revenue = await xAllocationPool.roundEarnings(round1, app2Id)

        const treasuryBalanceBefore = await b3tr.balanceOf(await treasury.getAddress())

        await xAllocationPool.connect(otherAccounts[3]).claim(round1, app1Id)
        await xAllocationPool.connect(otherAccounts[4]).claim(round1, app2Id)

        const treasuryBalanceAfter = await b3tr.balanceOf(await treasury.getAddress())

        expect(treasuryBalanceAfter).to.eql(treasuryBalanceBefore + app1Revenue[1] + app2Revenue[1])
        expect(treasuryBalanceAfter - treasuryBalanceBefore).to.be.gt(0)
      })

      it("Cannot transfer unallocated funds if b3tr token is paused", async function () {
        const {
          xAllocationVoting,
          otherAccounts,
          owner,
          xAllocationPool,
          emissions,
          minterAccount,
          b3tr,
          treasury,
          x2EarnApps,
          veBetterPassport,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const voter1 = otherAccounts[1]
        await getVot3Tokens(voter1, "1000")

        await veBetterPassport.whitelist(voter1.address)
        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[6].address, otherAccounts[6].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[7].address, otherAccounts[7].address, "My app #2", "metadataURI")

        // Bootstrap emissions -> sends funds to contract
        await bootstrapEmissions()
        await emissions.connect(minterAccount).start()

        const round1 = await xAllocationVoting.currentRoundId()

        // Vote
        await xAllocationVoting.connect(voter1).castVote(round1, [app2Id], [ethers.parseEther("1000")])

        await waitForRoundToEnd(Number(round1))
        expect(await xAllocationVoting.state(round1)).to.eql(2n) // succeeded

        const unallocatedAmount = (await xAllocationPool.claimableAmount(round1, app2Id))[1]
        expect(unallocatedAmount).to.be.gt(0n)

        const treasuryBalanceBefore = await b3tr.balanceOf(await treasury.getAddress())

        // pause b3tr transfer
        await b3tr.pause()

        await catchRevert(xAllocationPool.connect(otherAccounts[6]).claim(round1, app2Id))

        const treasuryBalanceAfter = await b3tr.balanceOf(await treasury.getAddress())
        expect(treasuryBalanceAfter).to.eql(treasuryBalanceBefore)

        await b3tr.unpause()
        await xAllocationPool.connect(otherAccounts[6]).claim(round1, app2Id)
        expect(await b3tr.balanceOf(await treasury.getAddress())).to.eql(treasuryBalanceBefore + unallocatedAmount)
      })
    })

    describe("Quadratic funding & Linear Funding", async function () {
      it("[Quadratic] Should calculate correct app shares with Quadratic funding distrubiton with max cap at 20%", async function () {
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, x2EarnApps, veBetterPassport } =
          await getOrDeployContractInstances({
            forceDeploy: true,
          })

        // Bootstrap emissions
        await bootstrapEmissions()

        otherAccounts.forEach(async account => {
          await veBetterPassport.whitelist(account.address)
          await getVot3Tokens(account, "10000")
        })

        await veBetterPassport.toggleCheck(1)

        //Add apps
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
        const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))

        //Start allocation round
        const round1 = await startNewAllocationRound()
        // Vote
        await xAllocationVoting
          .connect(otherAccounts[1])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[2])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[3])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[4])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[5])
          .castVote(round1, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

        await waitForRoundToEnd(round1)

        const app1Shares = await xAllocationPool.getAppShares(round1, app1Id)
        const app2Shares = await xAllocationPool.getAppShares(round1, app2Id)
        const app3Shares = await xAllocationPool.getAppShares(round1, app3Id)

        expect(app1Shares[0]).to.eql(1144n)
        expect(app2Shares[0]).to.eql(2000n) // reached cap would be 59.94% of the total votes
        expect(app3Shares[0]).to.eql(2000n) // reached cap would be 28.61% of the total votes
      })

      it("[Linear] Should calculate correct app shares with Linear funding distrubiton with max cap at 20%", async function () {
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, x2EarnApps, veBetterPassport } =
          await getOrDeployContractInstances({
            forceDeploy: true,
          })

        // Bootstrap emissions
        await bootstrapEmissions()

        otherAccounts.forEach(async account => {
          await veBetterPassport.whitelist(account.address)
          await getVot3Tokens(account, "10000")
        })

        await veBetterPassport.toggleCheck(1)

        // Turn off quadratic funding
        await xAllocationPool.connect(owner).toggleQuadraticFunding()

        //Add apps
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
        const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))

        //Start allocation round
        const round1 = await startNewAllocationRound()

        // Check if quadratic funding is off
        expect(await xAllocationPool.isQuadraticFundingDisabledForCurrentRound()).to.eql(true)

        // Vote
        await xAllocationVoting
          .connect(otherAccounts[1])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[2])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[3])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[4])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[5])
          .castVote(round1, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

        /*
            app1: 1000 votes
            app2: 1600 votes
            app3: 500 votes

            Total votes: 3100
        */

        await waitForRoundToEnd(round1)

        /*
            app1 percentage = 1000 / 3100 = 32.25% => Capped at 20%
            app2 percentage = 1600 / 3100 = 51.61% => Capped at 20%
            app3 percentage = 500 / 3100 = 16.12% 
        */
        const app1Shares = await xAllocationPool.getAppShares(round1, app1Id)
        const app2Shares = await xAllocationPool.getAppShares(round1, app2Id)
        const app3Shares = await xAllocationPool.getAppShares(round1, app3Id)

        expect(app1Shares[0]).to.eql(2000n)
        expect(app2Shares[0]).to.eql(2000n) // reached cap would be 59.94% of the total votes
        expect(app3Shares[0]).to.eql(1612n) // reached cap would be 28.61% of the total votes
      })

      it("[Quadratic] Should calculate correct app shares with Quadratic funding distrubiton with no max cap", async function () {
        const config = createLocalConfig()
        config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 100
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, x2EarnApps, veBetterPassport } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            config,
          })

        // Bootstrap emissions
        await bootstrapEmissions()

        otherAccounts.forEach(async account => {
          await veBetterPassport.whitelist(account.address)
          await getVot3Tokens(account, "10000")
        })

        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #2", "metadataURI")
        await x2EarnApps.connect(owner).addApp(otherAccounts[5].address, otherAccounts[5], "My app #3", "metadataURI")

        //Start allocation round
        const round1 = await startNewAllocationRound()
        // Vote
        await xAllocationVoting
          .connect(otherAccounts[1])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[2])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[3])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[4])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[5])
          .castVote(round1, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

        await waitForRoundToEnd(round1)

        const app1Shares = await xAllocationPool.getAppShares(round1, app1Id)
        const app2Shares = await xAllocationPool.getAppShares(round1, app2Id)
        const app3Shares = await xAllocationPool.getAppShares(round1, app3Id)

        expect(app1Shares[0]).to.eql(1144n)
        expect(app2Shares[0]).to.eql(5993n) // reached cap would be 59.94% of the total votes
        expect(app3Shares[0]).to.eql(2861n) // reached cap would be 28.61% of the total votes
      })

      it("[Linear] Should calculate correct app shares with Linear funding distrubiton with no max cap", async function () {
        const config = createLocalConfig()
        config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 100
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, x2EarnApps, veBetterPassport } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            config,
          })

        // Turn off quadratic funding
        await xAllocationPool.connect(owner).toggleQuadraticFunding()

        // Bootstrap emissions
        await bootstrapEmissions()

        otherAccounts.forEach(async account => {
          await veBetterPassport.whitelist(account.address)
          await getVot3Tokens(account, "10000")
        })

        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #2", "metadataURI")
        await x2EarnApps.connect(owner).addApp(otherAccounts[5].address, otherAccounts[5], "My app #3", "metadataURI")

        //Start allocation round
        const round1 = await startNewAllocationRound()

        // Check Quadratic Funding is off
        expect(await xAllocationPool.isQuadraticFundingDisabledForCurrentRound()).to.eql(true)

        // Vote
        await xAllocationVoting
          .connect(otherAccounts[1])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[2])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[3])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[4])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[5])
          .castVote(round1, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

        /*
            app1: 1000 votes
            app2: 1600 votes
            app3: 500 votes
        */

        await waitForRoundToEnd(round1)

        /*
            app1 percentage = 1000 / 3100 = 32.25% (No cap)
            app2 percentage = 1600 / 3100 = 51.61% (No cap)
            app3 percentage = 500 / 3100 = 16.12%
        */
        const app1Shares = await xAllocationPool.getAppShares(round1, app1Id)
        const app2Shares = await xAllocationPool.getAppShares(round1, app2Id)
        const app3Shares = await xAllocationPool.getAppShares(round1, app3Id)

        expect(app1Shares[0]).to.eql(3225n)
        expect(app2Shares[0]).to.eql(5161n) // reached cap would be 59.94% of the total votes
        expect(app3Shares[0]).to.eql(1612n) // reached cap would be 28.61% of the total votes
      })

      it("[Quadratic] Should give correct rewards based with Quadratic Funding", async function () {
        const config = createLocalConfig()
        config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 100
        config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE = 0
        config.INITIAL_X_ALLOCATION = 10000n
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, x2EarnApps, veBetterPassport } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            config,
          })

        // Bootstrap emissions
        await bootstrapEmissions()

        otherAccounts.forEach(async account => {
          await veBetterPassport.whitelist(account.address)
          await getVot3Tokens(account, "10000")
        })

        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #2", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[5].address, otherAccounts[5].address, "My app #3", "metadataURI")

        //Start allocation round
        const round1 = await startNewAllocationRound()
        // Vote
        await xAllocationVoting
          .connect(otherAccounts[1])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[2])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[3])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[4])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[5])
          .castVote(round1, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

        await waitForRoundToEnd(round1)

        const app1app1Earnings = await xAllocationPool.roundEarnings(round1, app1Id)
        const app2app2Earnings = await xAllocationPool.roundEarnings(round1, app2Id)
        const app3app3Earnings = await xAllocationPool.roundEarnings(round1, app3Id)

        expect(app1app1Earnings[0]).to.eql(1144n)
        expect(app2app2Earnings[0]).to.eql(5993n)
        expect(app3app3Earnings[0]).to.eql(2861n)
      })

      it("[Linear] Should give correct rewards based with Linear Funding", async function () {
        const config = createLocalConfig()
        config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 100
        config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE = 0
        config.INITIAL_X_ALLOCATION = 10000n
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, x2EarnApps, veBetterPassport } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            config,
          })

        // Bootstrap emissions
        await bootstrapEmissions()

        otherAccounts.forEach(async account => {
          await veBetterPassport.whitelist(account.address)
          await getVot3Tokens(account, "10000")
        })

        await veBetterPassport.toggleCheck(1)

        // Turn off quadratic funding
        await xAllocationPool.connect(owner).toggleQuadraticFunding()

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #2", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[5].address, otherAccounts[5].address, "My app #3", "metadataURI")

        //Start allocation round
        const round1 = await startNewAllocationRound()

        // Check Quadratic Funding is off
        expect(await xAllocationPool.isQuadraticFundingDisabledForCurrentRound()).to.eql(true)

        // Vote
        await xAllocationVoting
          .connect(otherAccounts[1])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[2])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[3])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[4])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[5])
          .castVote(round1, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

        /*
          app1: 1000 votes
          app2: 1600 votes
          app3: 500 votes
        */

        await waitForRoundToEnd(round1)

        /*
          app1 percentage = 1000 / 3100 = 32.25% (No cap)
          app2 percentage = 1600 / 3100 = 51.61% (No cap)
          app3 percentage = 500 / 3100 = 16.12%
        */
        const app1app1Earnings = await xAllocationPool.roundEarnings(round1, app1Id)
        const app2app2Earnings = await xAllocationPool.roundEarnings(round1, app2Id)
        const app3app3Earnings = await xAllocationPool.roundEarnings(round1, app3Id)

        expect(app1app1Earnings[0]).to.eql(3225n)
        expect(app2app2Earnings[0]).to.eql(5161n)
        expect(app3app3Earnings[0]).to.eql(1612n)
      })
      it("Should calculate correct app shares across rounds where both quadratic and linear funding are used", async function () {
        const config = createLocalConfig()
        config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP = 100
        config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE = 0
        config.INITIAL_X_ALLOCATION = 10000n
        config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE = 0
        const { xAllocationVoting, otherAccounts, owner, xAllocationPool, x2EarnApps, veBetterPassport } =
          await getOrDeployContractInstances({
            forceDeploy: true,
            config,
          })

        // Bootstrap emissions
        await bootstrapEmissions()

        otherAccounts.forEach(async account => {
          await veBetterPassport.whitelist(account.address)
          await getVot3Tokens(account, "10000")
        })

        await veBetterPassport.toggleCheck(1)

        //Add apps
        const app1Id = ethers.keccak256(ethers.toUtf8Bytes("My app"))
        const app2Id = ethers.keccak256(ethers.toUtf8Bytes("My app #2"))
        const app3Id = ethers.keccak256(ethers.toUtf8Bytes("My app #3"))
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[3].address, otherAccounts[3].address, "My app", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[4].address, otherAccounts[4].address, "My app #2", "metadataURI")
        await x2EarnApps
          .connect(owner)
          .addApp(otherAccounts[5].address, otherAccounts[5].address, "My app #3", "metadataURI")

        //Start allocation round
        const round1 = await startNewAllocationRound()

        // Check Quadratic Funding is on
        expect(await xAllocationPool.isQuadraticFundingDisabledForCurrentRound()).to.eql(false)

        // Vote
        await xAllocationVoting
          .connect(otherAccounts[1])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[2])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[3])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[4])
          .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[5])
          .castVote(round1, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

        // Turn off quadratic funding
        await xAllocationPool.connect(owner).toggleQuadraticFunding()

        await waitForRoundToEnd(round1)

        const app1round1Earnings = await xAllocationPool.roundEarnings(round1, app1Id)
        const app2round1Earnings = await xAllocationPool.roundEarnings(round1, app2Id)
        const app3round1Earnings = await xAllocationPool.roundEarnings(round1, app3Id)

        expect(app1round1Earnings[0]).to.eql(1144n)
        expect(app2round1Earnings[0]).to.eql(5993n)
        expect(app3round1Earnings[0]).to.eql(2861n)

        //Start allocation round
        const round2 = await startNewAllocationRound()

        // Check Quadratic Funding is off
        expect(await xAllocationPool.isQuadraticFundingDisabledForCurrentRound()).to.eql(true)

        expect(await xAllocationPool.isQuadraticFundingDisabledForRound(2)).to.eql(true)

        // Vote
        await xAllocationVoting
          .connect(otherAccounts[1])
          .castVote(round2, [app2Id, app3Id], [ethers.parseEther("900"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[2])
          .castVote(round2, [app2Id, app3Id], [ethers.parseEther("500"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[3])
          .castVote(round2, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[4])
          .castVote(round2, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])
        await xAllocationVoting
          .connect(otherAccounts[5])
          .castVote(round2, [app1Id, app3Id], [ethers.parseEther("1000"), ethers.parseEther("100")])

        await waitForRoundToEnd(round2)

        // start new round

        const app1round2Earnings = await xAllocationPool.roundEarnings(round2, app1Id)
        const app2round2Earnings = await xAllocationPool.roundEarnings(round2, app2Id)
        const app3round2Earnings = await xAllocationPool.roundEarnings(round2, app3Id)

        /*
          app1 percentage = 1000 / 3100 = 32.25% (No cap)
          app2 percentage = 1600 / 3100 = 51.61% (No cap)
          app3 percentage = 500 / 3100 = 16.12%
        */
        expect(app1round2Earnings[0]).to.eql(3225n)
        expect(app2round2Earnings[0]).to.eql(5161n)
        expect(app3round2Earnings[0]).to.eql(1612n)

        // Check that round earings from round 1 are still the same after toggle
        const app1round1Earnings1 = await xAllocationPool.roundEarnings(round1, app1Id)
        const app2round1Earnings2 = await xAllocationPool.roundEarnings(round1, app2Id)
        const app3round1Earnings3 = await xAllocationPool.roundEarnings(round1, app3Id)

        // Check that round earings from round 1 are still the same after toggle
        expect(app1round1Earnings1[0]).to.eql(1144n)
        expect(app2round1Earnings2[0]).to.eql(5993n)
        expect(app3round1Earnings3[0]).to.eql(2861n)
      })
      it("Should be able to toggle quadratic funding on and off", async function () {
        const { xAllocationPool, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        // Bootstrap emissions
        await bootstrapEmissions()

        expect(await xAllocationPool.isQuadraticFundingDisabledForCurrentRound()).to.eql(false)

        await xAllocationPool.connect(owner).toggleQuadraticFunding()

        // Start new round
        const round1 = await startNewAllocationRound()

        expect(await xAllocationPool.isQuadraticFundingDisabledForCurrentRound()).to.eql(true)

        expect(await xAllocationPool.isQuadraticFundingDisabledForRound(round1)).to.eql(true)

        await xAllocationPool.connect(owner).toggleQuadraticFunding()

        // wait for round to end
        await waitForRoundToEnd(round1)

        // Start new round
        const round2 = await startNewAllocationRound()

        expect(await xAllocationPool.isQuadraticFundingDisabledForCurrentRound()).to.eql(false)

        expect(await xAllocationPool.isQuadraticFundingDisabledForRound(round2)).to.eql(false)
      })

      it("Only DEFAULT_ADMIN can toggle quadratic funding", async function () {
        const { xAllocationPool, otherAccounts } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await catchRevert(xAllocationPool.connect(otherAccounts[1]).toggleQuadraticFunding())
      })
    })
  })
})
