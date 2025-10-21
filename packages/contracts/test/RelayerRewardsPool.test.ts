import { ethers } from "hardhat"
import { expect } from "chai"
import { describe, it, beforeEach } from "mocha"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

import { getOrDeployContractInstances, waitForNextCycle } from "./helpers"
import { RelayerRewardsPool, B3TR, Emissions, XAllocationVoting } from "../typechain-types"

describe("RelayerRewardsPool - @shard18", function () {
  let relayerRewardsPool: RelayerRewardsPool
  let b3tr: B3TR
  let emissions: Emissions
  let xAllocationVoting: XAllocationVoting
  let minterAccount: HardhatEthersSigner
  let owner: HardhatEthersSigner
  let upgrader: HardhatEthersSigner
  let poolAdmin: HardhatEthersSigner
  let relayer1: HardhatEthersSigner
  let relayer2: HardhatEthersSigner
  let user1: HardhatEthersSigner
  let user2: HardhatEthersSigner
  let otherAccounts: HardhatEthersSigner[]

  // Main setup - used by most tests
  const setupContracts = async () => {
    const config = await getOrDeployContractInstances({
      forceDeploy: true,
    })
    if (!config) throw new Error("Failed to deploy contracts")

    relayerRewardsPool = config.relayerRewardsPool
    b3tr = config.b3tr
    emissions = config.emissions
    xAllocationVoting = config.xAllocationVoting
    owner = config.owner
    minterAccount = config.minterAccount
    otherAccounts = config.otherAccounts

    // Setup test accounts
    upgrader = otherAccounts[0]
    poolAdmin = otherAccounts[1]
    relayer1 = otherAccounts[2]
    relayer2 = otherAccounts[3]
    user1 = otherAccounts[4]
    user2 = otherAccounts[5]

    // Grant roles for testing
    await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), owner.address)
    await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

    await emissions.connect(minterAccount).bootstrap()
    await emissions.connect(minterAccount).start()

    await relayerRewardsPool.connect(owner).grantRole(await relayerRewardsPool.POOL_ADMIN_ROLE(), poolAdmin.address)
  }

  beforeEach(async function () {
    await setupContracts()
  })

  describe("Deployment and Initialization", function () {
    it("should deploy with correct initial values", async function () {
      expect(await relayerRewardsPool.version()).to.equal("1")
      expect(await relayerRewardsPool.getVoteWeight()).to.equal(3)
      expect(await relayerRewardsPool.getClaimWeight()).to.equal(1)
      expect(await relayerRewardsPool.getEarlyAccessBlocks()).to.equal(432000)
      expect(await relayerRewardsPool.getRelayerFeePercentage()).to.equal(10)
      expect(await relayerRewardsPool.getRelayerFeeDenominator()).to.equal(100)
      expect(await relayerRewardsPool.getFeeCap()).to.equal(ethers.parseEther("100"))
    })

    it("should have correct role assignments", async function () {
      const DEFAULT_ADMIN_ROLE = await relayerRewardsPool.DEFAULT_ADMIN_ROLE()
      const POOL_ADMIN_ROLE = await relayerRewardsPool.POOL_ADMIN_ROLE()

      expect(await relayerRewardsPool.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true
      expect(await relayerRewardsPool.hasRole(POOL_ADMIN_ROLE, owner.address)).to.be.true
      expect(await relayerRewardsPool.hasRole(POOL_ADMIN_ROLE, poolAdmin.address)).to.be.true
    })

    it("should revert initialization with zero addresses", async function () {
      const RelayerRewardsPoolFactory = await ethers.getContractFactory("RelayerRewardsPool")
      const pool = await RelayerRewardsPoolFactory.deploy()

      await expect(
        pool.initialize(
          ethers.ZeroAddress,
          upgrader.address,
          await b3tr.getAddress(),
          await emissions.getAddress(),
          await xAllocationVoting.getAddress(),
        ),
      ).to.be.revertedWithCustomError(pool, "InvalidInitialization")

      await expect(
        pool.initialize(
          owner.address,
          ethers.ZeroAddress,
          await b3tr.getAddress(),
          await emissions.getAddress(),
          await xAllocationVoting.getAddress(),
        ),
      ).to.be.revertedWithCustomError(pool, "InvalidInitialization")

      await expect(
        pool.initialize(
          owner.address,
          upgrader.address,
          ethers.ZeroAddress,
          await emissions.getAddress(),
          await xAllocationVoting.getAddress(),
        ),
      ).to.be.revertedWithCustomError(pool, "InvalidInitialization")

      await expect(
        pool.initialize(
          owner.address,
          upgrader.address,
          await b3tr.getAddress(),
          await emissions.getAddress(),
          ethers.ZeroAddress,
        ),
      ).to.be.revertedWithCustomError(pool, "InvalidInitialization")
    })
  })

  describe("Role Management", function () {
    it("should allow admin to grant and revoke pool admin role", async function () {
      const POOL_ADMIN_ROLE = await relayerRewardsPool.POOL_ADMIN_ROLE()

      // Grant role
      await relayerRewardsPool.connect(owner).grantRole(POOL_ADMIN_ROLE, user1.address)
      expect(await relayerRewardsPool.hasRole(POOL_ADMIN_ROLE, user1.address)).to.be.true

      // Revoke role
      await relayerRewardsPool.connect(owner).revokeRole(POOL_ADMIN_ROLE, user1.address)
      expect(await relayerRewardsPool.hasRole(POOL_ADMIN_ROLE, user1.address)).to.be.false
    })

    it("should not allow non-admin to grant roles", async function () {
      const POOL_ADMIN_ROLE = await relayerRewardsPool.POOL_ADMIN_ROLE()

      await expect(relayerRewardsPool.connect(user1).grantRole(POOL_ADMIN_ROLE, user2.address)).to.be.reverted
    })

    it("should allow pool admin to perform admin functions", async function () {
      // Pool admin should be able to register relayers
      await expect(relayerRewardsPool.connect(poolAdmin).registerRelayer(relayer1.address)).to.not.be.reverted
    })
  })

  describe("Contract Configuration", function () {
    it("should allow admin to update B3TR address", async function () {
      const newB3TRAddress = user1.address // Using a dummy address for testing

      await expect(relayerRewardsPool.connect(owner).setB3TRAddress(newB3TRAddress))
        .to.emit(relayerRewardsPool, "B3TRAddressUpdated")
        .withArgs(newB3TRAddress, await b3tr.getAddress())
    })

    it("should allow admin to update Emissions address", async function () {
      const newEmissionsAddress = user1.address // Using a dummy address for testing

      await expect(relayerRewardsPool.connect(owner).setEmissionsAddress(newEmissionsAddress))
        .to.emit(relayerRewardsPool, "EmissionsAddressUpdated")
        .withArgs(newEmissionsAddress, await emissions.getAddress())
    })

    it("should revert setting zero address for B3TR", async function () {
      await expect(relayerRewardsPool.connect(owner).setB3TRAddress(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(relayerRewardsPool, "InvalidParameter")
        .withArgs("b3trAddress")
    })

    it("should revert setting zero address for Emissions", async function () {
      await expect(relayerRewardsPool.connect(owner).setEmissionsAddress(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(relayerRewardsPool, "InvalidParameter")
        .withArgs("emissionsAddress")
    })

    it("should not allow non-admin to update addresses", async function () {
      await expect(relayerRewardsPool.connect(user1).setB3TRAddress(user2.address)).to.be.revertedWith(
        "RelayerRewardsPool: caller must have admin or pool admin role",
      )

      await expect(relayerRewardsPool.connect(user1).setEmissionsAddress(user2.address)).to.be.revertedWith(
        "RelayerRewardsPool: caller must have admin or pool admin role",
      )
    })
  })

  describe("Weight Management", function () {
    it("should allow admin to update vote weight", async function () {
      const newWeight = 5

      await expect(relayerRewardsPool.connect(owner).setVoteWeight(newWeight))
        .to.emit(relayerRewardsPool, "VoteWeightUpdated")
        .withArgs(newWeight, 3) // 3 is the initial vote weight

      expect(await relayerRewardsPool.getVoteWeight()).to.equal(newWeight)
    })

    it("should allow admin to update claim weight", async function () {
      const newWeight = 2

      await expect(relayerRewardsPool.connect(owner).setClaimWeight(newWeight))
        .to.emit(relayerRewardsPool, "ClaimWeightUpdated")
        .withArgs(newWeight, 1) // 1 is the initial claim weight

      expect(await relayerRewardsPool.getClaimWeight()).to.equal(newWeight)
    })

    it("should revert setting zero weight", async function () {
      await expect(relayerRewardsPool.connect(owner).setVoteWeight(0))
        .to.be.revertedWithCustomError(relayerRewardsPool, "InvalidParameter")
        .withArgs("voteWeight")

      await expect(relayerRewardsPool.connect(owner).setClaimWeight(0))
        .to.be.revertedWithCustomError(relayerRewardsPool, "InvalidParameter")
        .withArgs("claimWeight")
    })

    it("should not allow non-admin to update weights", async function () {
      await expect(relayerRewardsPool.connect(user1).setVoteWeight(5)).to.be.revertedWith(
        "RelayerRewardsPool: caller must have admin or pool admin role",
      )

      await expect(relayerRewardsPool.connect(user1).setClaimWeight(2)).to.be.revertedWith(
        "RelayerRewardsPool: caller must have admin or pool admin role",
      )
    })
  })

  describe("Relayer Registration", function () {
    it("should allow admin to register a relayer", async function () {
      await expect(relayerRewardsPool.connect(owner).registerRelayer(relayer1.address))
        .to.emit(relayerRewardsPool, "RelayerRegistered")
        .withArgs(relayer1.address)

      expect(await relayerRewardsPool.isRegisteredRelayer(relayer1.address)).to.be.true

      const registeredRelayers = await relayerRewardsPool.getRegisteredRelayers()
      expect(registeredRelayers).to.include(relayer1.address)
    })

    it("should allow pool admin to register a relayer", async function () {
      await expect(relayerRewardsPool.connect(poolAdmin).registerRelayer(relayer1.address))
        .to.emit(relayerRewardsPool, "RelayerRegistered")
        .withArgs(relayer1.address)

      expect(await relayerRewardsPool.isRegisteredRelayer(relayer1.address)).to.be.true
    })

    it("should revert registering zero address", async function () {
      await expect(relayerRewardsPool.connect(owner).registerRelayer(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(relayerRewardsPool, "InvalidParameter")
        .withArgs("relayer")
    })

    it("should revert registering already registered relayer", async function () {
      await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)

      await expect(relayerRewardsPool.connect(owner).registerRelayer(relayer1.address))
        .to.be.revertedWithCustomError(relayerRewardsPool, "RelayerAlreadyRegistered")
        .withArgs(relayer1.address)
    })

    it("should allow admin to unregister a relayer", async function () {
      // First register
      await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)
      expect(await relayerRewardsPool.isRegisteredRelayer(relayer1.address)).to.be.true

      // Then unregister
      await expect(relayerRewardsPool.connect(owner).unregisterRelayer(relayer1.address))
        .to.emit(relayerRewardsPool, "RelayerUnregistered")
        .withArgs(relayer1.address)

      expect(await relayerRewardsPool.isRegisteredRelayer(relayer1.address)).to.be.false

      const registeredRelayers = await relayerRewardsPool.getRegisteredRelayers()
      expect(registeredRelayers).to.not.include(relayer1.address)
    })

    it("should revert unregistering non-registered relayer", async function () {
      await expect(relayerRewardsPool.connect(owner).unregisterRelayer(relayer1.address))
        .to.be.revertedWithCustomError(relayerRewardsPool, "RelayerNotRegistered")
        .withArgs(relayer1.address)
    })

    it("should handle multiple relayer registrations correctly", async function () {
      await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)
      await relayerRewardsPool.connect(owner).registerRelayer(relayer2.address)

      const registeredRelayers = await relayerRewardsPool.getRegisteredRelayers()
      expect(registeredRelayers).to.have.lengthOf(2)
      expect(registeredRelayers).to.include(relayer1.address)
      expect(registeredRelayers).to.include(relayer2.address)

      // Unregister one and check the array is properly updated
      await relayerRewardsPool.connect(owner).unregisterRelayer(relayer1.address)

      const updatedRelayers = await relayerRewardsPool.getRegisteredRelayers()
      expect(updatedRelayers).to.have.lengthOf(1)
      expect(updatedRelayers).to.include(relayer2.address)
      expect(updatedRelayers).to.not.include(relayer1.address)
    })

    it("should not allow non-admin to register/unregister relayers", async function () {
      await expect(relayerRewardsPool.connect(user1).registerRelayer(relayer1.address)).to.be.revertedWith(
        "RelayerRewardsPool: caller must have admin or pool admin role",
      )

      // Register first
      await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)

      await expect(relayerRewardsPool.connect(user1).unregisterRelayer(relayer1.address)).to.be.revertedWith(
        "RelayerRewardsPool: caller must have admin or pool admin role",
      )
    })
  })

  describe("Early Access Configuration", function () {
    it("should allow admin to update early access blocks", async function () {
      const newBlocks = 200

      await expect(relayerRewardsPool.connect(owner).setEarlyAccessBlocks(newBlocks))
        .to.emit(relayerRewardsPool, "EarlyAccessBlocksUpdated")
        .withArgs(newBlocks, 432000) // 432000 is the initial value

      expect(await relayerRewardsPool.getEarlyAccessBlocks()).to.equal(newBlocks)
    })

    it("should not allow non-admin to update early access blocks", async function () {
      await expect(relayerRewardsPool.connect(user1).setEarlyAccessBlocks(200)).to.be.revertedWith(
        "RelayerRewardsPool: caller must have admin or pool admin role",
      )
    })
  })

  describe("Round Setup and Action Management", function () {
    beforeEach(async function () {
      // Register relayers for testing
      await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)
      await relayerRewardsPool.connect(owner).registerRelayer(relayer2.address)
    })

    it("should set total actions for round correctly", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 10

      await expect(relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers))
        .to.emit(relayerRewardsPool, "TotalAutoVotingActionsSet")
        .withArgs(roundId, totalAutoVotingUsers, totalAutoVotingUsers * 2, totalAutoVotingUsers * 2 * 2, 2) // 2 registered relayers

      expect(await relayerRewardsPool.totalActions(roundId)).to.equal(totalAutoVotingUsers * 2) // 2 actions per user

      const voteWeight = await relayerRewardsPool.getVoteWeight()
      const claimWeight = await relayerRewardsPool.getClaimWeight()
      const expectedWeightedActions = BigInt(totalAutoVotingUsers) * (voteWeight + claimWeight)
      expect(await relayerRewardsPool.totalWeightedActions(roundId)).to.equal(expectedWeightedActions)
    })

    it("should register relayer actions correctly", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 10

      await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

      const voteWeight = await relayerRewardsPool.getVoteWeight()
      const claimWeight = await relayerRewardsPool.getClaimWeight()

      // Register a VOTE action
      await expect(relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0)) // 0 = VOTE
        .to.emit(relayerRewardsPool, "RelayerActionRegistered")
        .withArgs(relayer1.address, user1.address, roundId, 1, voteWeight)

      expect(await relayerRewardsPool.totalRelayerActions(relayer1.address, roundId)).to.equal(1)
      expect(await relayerRewardsPool.totalRelayerWeightedActions(relayer1.address, roundId)).to.equal(voteWeight)

      // Register a CLAIM action
      await expect(relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1)) // 1 = CLAIM
        .to.emit(relayerRewardsPool, "RelayerActionRegistered")
        .withArgs(relayer1.address, user1.address, roundId, 2, claimWeight)

      expect(await relayerRewardsPool.totalRelayerActions(relayer1.address, roundId)).to.equal(2)
      expect(await relayerRewardsPool.totalRelayerWeightedActions(relayer1.address, roundId)).to.equal(
        voteWeight + claimWeight,
      )
    })

    it("should revert registering action for zero address", async function () {
      const roundId = 1

      await expect(
        relayerRewardsPool.connect(owner).registerRelayerAction(ethers.ZeroAddress, user1.address, roundId, 0),
      )
        .to.be.revertedWithCustomError(relayerRewardsPool, "InvalidParameter")
        .withArgs("relayer")
    })

    it("should not allow non-admin to register actions or set round totals", async function () {
      const roundId = 1

      await expect(relayerRewardsPool.connect(user1).setTotalActionsForRound(roundId, 10)).to.be.revertedWith(
        "RelayerRewardsPool: caller must have admin or pool admin role",
      )

      await expect(
        relayerRewardsPool.connect(user1).registerRelayerAction(relayer1.address, user1.address, roundId, 0),
      ).to.be.revertedWith("RelayerRewardsPool: caller must have admin or pool admin role")
    })
  })

  describe("Reward Deposits", function () {
    it("should allow admin to deposit rewards", async function () {
      const roundId = 1
      const amount = ethers.parseEther("100")

      // Give B3TR tokens to owner
      await b3tr.connect(owner).mint(owner.address, amount)
      await b3tr.connect(owner).approve(await relayerRewardsPool.getAddress(), amount)

      await expect(relayerRewardsPool.connect(owner).deposit(amount, roundId))
        .to.emit(relayerRewardsPool, "RewardsDeposited")
        .withArgs(roundId, amount, amount) // First deposit, so total equals amount

      expect(await relayerRewardsPool.getTotalRewards(roundId)).to.equal(amount)
    })

    it("should accumulate deposits for the same round", async function () {
      const roundId = 1
      const amount1 = ethers.parseEther("100")
      const amount2 = ethers.parseEther("50")

      // Give B3TR tokens to owner
      await b3tr.connect(owner).mint(owner.address, amount1 + amount2)
      await b3tr.connect(owner).approve(await relayerRewardsPool.getAddress(), amount1 + amount2)

      await relayerRewardsPool.connect(owner).deposit(amount1, roundId)
      await relayerRewardsPool.connect(owner).deposit(amount2, roundId)

      expect(await relayerRewardsPool.getTotalRewards(roundId)).to.equal(amount1 + amount2)
    })

    it("should revert deposit with zero amount", async function () {
      await expect(relayerRewardsPool.connect(owner).deposit(0, 1))
        .to.be.revertedWithCustomError(relayerRewardsPool, "InvalidParameter")
        .withArgs("amount")
    })

    it("should not allow non-admin to deposit", async function () {
      const amount = ethers.parseEther("100")

      await expect(relayerRewardsPool.connect(user1).deposit(amount, 1)).to.be.revertedWith(
        "RelayerRewardsPool: caller must have admin or pool admin role",
      )
    })
  })

  describe("Reward Claiming", function () {
    // Fresh setup for this specific test suite
    beforeEach(async function () {
      // Get completely fresh contracts for this test suite
      await setupContracts()

      // End emissions explicitly
      await waitForNextCycle(emissions)

      // Setup for reward claiming tests
      await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)
      await relayerRewardsPool.connect(owner).registerRelayer(relayer2.address)

      const roundId = 1
      const totalAutoVotingUsers = 4
      const rewardAmount = ethers.parseEther("100")

      // Set up round
      await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

      // Deposit rewards
      await b3tr.connect(owner).mint(owner.address, rewardAmount)
      await b3tr.connect(owner).approve(await relayerRewardsPool.getAddress(), rewardAmount)
      await relayerRewardsPool.connect(owner).deposit(rewardAmount, roundId)

      // Each relayer completes exactly half the required actions (2 users worth each)
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1) // CLAIM
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1) // CLAIM

      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer2.address, user2.address, roundId, 0) // VOTE
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer2.address, user2.address, roundId, 1) // CLAIM
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer2.address, user2.address, roundId, 0) // VOTE
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer2.address, user2.address, roundId, 1) // CLAIM
    })

    it("should calculate claimable rewards correctly", async function () {
      const roundId = 1
      const rewardAmount = ethers.parseEther("100")

      // VERIFY: All required actions are now completed
      const totalWeightedActions = await relayerRewardsPool.totalWeightedActions(roundId)
      const completedWeightedActions = await relayerRewardsPool.completedWeightedActions(roundId)

      expect(completedWeightedActions).to.equal(totalWeightedActions, "All actions should be completed")

      // THEN: Both conditions for claimable rewards are met:
      // 1. All actions completed
      // 2. Emission cycle ended
      expect(await relayerRewardsPool.isRewardClaimable(roundId)).to.be.true

      // THEN: Both relayers should get equal rewards (they did equal work)
      const relayer1Claimable = await relayerRewardsPool.claimableRewards(relayer1.address, roundId)
      const relayer2Claimable = await relayerRewardsPool.claimableRewards(relayer2.address, roundId)

      expect(relayer1Claimable).to.equal(relayer2Claimable, "Relayers did equal work, should get equal rewards")
      expect(relayer1Claimable + relayer2Claimable).to.equal(
        rewardAmount,
        "Total claimable should equal deposited rewards",
      )
      expect(relayer1Claimable).to.be.gt(0, "Rewards should be greater than zero")
    })

    it("should allow relayer to claim rewards when round is complete", async function () {
      const roundId = 1

      const claimableAmount = await relayerRewardsPool.claimableRewards(relayer1.address, roundId)
      expect(claimableAmount).to.be.gt(0)

      const initialBalance = await b3tr.balanceOf(relayer1.address)

      await expect(relayerRewardsPool.connect(relayer1).claimRewards(roundId, relayer1.address))
        .to.emit(relayerRewardsPool, "RelayerRewardsClaimed")
        .withArgs(relayer1.address, roundId, claimableAmount)

      const finalBalance = await b3tr.balanceOf(relayer1.address)
      expect(finalBalance - initialBalance).to.equal(claimableAmount)

      // Should not be able to claim again
      expect(await relayerRewardsPool.claimableRewards(relayer1.address, roundId)).to.equal(0)
    })

    it("should allow all relayers to claim rewards", async function () {
      const roundId = 1

      const initialBalance = await b3tr.balanceOf(relayer1.address)
      const claimableAmount = await relayerRewardsPool.claimableRewards(relayer1.address, roundId)

      const initialBalance2 = await b3tr.balanceOf(relayer2.address)
      const claimableAmount2 = await relayerRewardsPool.claimableRewards(relayer2.address, roundId)

      // User1 claims for relayer1
      await expect(relayerRewardsPool.connect(user1).claimRewards(roundId, relayer1.address))
        .to.emit(relayerRewardsPool, "RelayerRewardsClaimed")
        .withArgs(relayer1.address, roundId, claimableAmount)

      await expect(relayerRewardsPool.connect(user1).claimRewards(roundId, relayer2.address))
        .to.emit(relayerRewardsPool, "RelayerRewardsClaimed")
        .withArgs(relayer2.address, roundId, claimableAmount2)

      // Relayer1 and Relayer2 should receive the rewards
      const finalBalance = await b3tr.balanceOf(relayer1.address)
      const finalBalance2 = await b3tr.balanceOf(relayer2.address)
      expect(finalBalance - initialBalance).to.equal(claimableAmount)
      expect(finalBalance2 - initialBalance2).to.equal(claimableAmount2)

      // Should not be able to claim again
      await expect(relayerRewardsPool.connect(user1).claimRewards(roundId, relayer1.address))
        .to.be.revertedWithCustomError(relayerRewardsPool, "RewardsAlreadyClaimed")
        .withArgs(relayer1.address, roundId)

      await expect(relayerRewardsPool.connect(user1).claimRewards(roundId, relayer2.address))
        .to.be.revertedWithCustomError(relayerRewardsPool, "RewardsAlreadyClaimed")
        .withArgs(relayer2.address, roundId)
    })

    it("should revert claiming when round is not complete", async function () {
      const incompleteRoundId = 2
      const totalAutoVotingUsers = 4

      // Start a second round
      await emissions.connect(minterAccount).distribute()

      // Set up a new round that will be incomplete
      await relayerRewardsPool.connect(owner).setTotalActionsForRound(incompleteRoundId, totalAutoVotingUsers)

      // Only register SOME actions (not all required)
      await relayerRewardsPool
        .connect(owner)
        .registerRelayerAction(relayer1.address, user1.address, incompleteRoundId, 0) // VOTE
      await relayerRewardsPool
        .connect(owner)
        .registerRelayerAction(relayer1.address, user1.address, incompleteRoundId, 1) // CLAIM

      // Verify round is not claimable
      expect(await relayerRewardsPool.isRewardClaimable(incompleteRoundId)).to.be.false
      expect(await relayerRewardsPool.claimableRewards(relayer1.address, incompleteRoundId)).to.equal(0)

      // Should revert when trying to claim
      await expect(relayerRewardsPool.connect(relayer1).claimRewards(incompleteRoundId, relayer1.address))
        .to.be.revertedWithCustomError(relayerRewardsPool, "RoundNotEnded")
        .withArgs(incompleteRoundId)
    })

    it("should revert when all actions are not completed", async function () {
      const incompleteRoundId = 2
      const totalAutoVotingUsers = 4

      // Start a second round
      await emissions.connect(minterAccount).distribute()

      // Set up a new round that will be incomplete
      await relayerRewardsPool.connect(owner).setTotalActionsForRound(incompleteRoundId, totalAutoVotingUsers)

      // Only register SOME actions (not all required)
      await relayerRewardsPool
        .connect(owner)
        .registerRelayerAction(relayer1.address, user1.address, incompleteRoundId, 0) // VOTE
      await relayerRewardsPool
        .connect(owner)
        .registerRelayerAction(relayer1.address, user1.address, incompleteRoundId, 1) // CLAIM

      await waitForNextCycle(emissions)

      // Verify round is not claimable
      expect(await relayerRewardsPool.isRewardClaimable(incompleteRoundId)).to.be.false
      expect(await relayerRewardsPool.claimableRewards(relayer1.address, incompleteRoundId)).to.equal(0)

      // Should revert when trying to claim
      await expect(relayerRewardsPool.connect(relayer1).claimRewards(incompleteRoundId, relayer1.address))
        .to.be.revertedWithCustomError(relayerRewardsPool, "NoRewardsToClaim")
        .withArgs(relayer1.address, incompleteRoundId)
    })
  })

  describe("Reward Claimability", function () {
    it("should correctly determine if rewards are claimable", async function () {
      const incompleteRoundId = 1
      const totalAutoVotingUsers = 2

      await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)
      await relayerRewardsPool.connect(owner).setTotalActionsForRound(incompleteRoundId, totalAutoVotingUsers)

      // Initially not claimable (no actions completed)
      expect(await relayerRewardsPool.isRewardClaimable(incompleteRoundId)).to.be.false

      // Complete half the actions
      await relayerRewardsPool
        .connect(owner)
        .registerRelayerAction(relayer1.address, user1.address, incompleteRoundId, 0) // VOTE
      await relayerRewardsPool
        .connect(owner)
        .registerRelayerAction(relayer1.address, user1.address, incompleteRoundId, 1) // CLAIM

      // Still not claimable (only half completed)
      expect(await relayerRewardsPool.isRewardClaimable(incompleteRoundId)).to.be.false

      // Complete all actions
      await relayerRewardsPool
        .connect(owner)
        .registerRelayerAction(relayer1.address, user1.address, incompleteRoundId, 0) // VOTE
      await relayerRewardsPool
        .connect(owner)
        .registerRelayerAction(relayer1.address, user1.address, incompleteRoundId, 1) // CLAIM

      // Now should be claimable
      await waitForNextCycle(emissions)

      expect(await relayerRewardsPool.isRewardClaimable(incompleteRoundId)).to.be.true
    })
  })

  describe("Edge Cases and Error Handling", function () {
    it("should handle zero relayers in total actions for round", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 10

      await expect(relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers))
        .to.emit(relayerRewardsPool, "TotalAutoVotingActionsSet")
        .withArgs(roundId, totalAutoVotingUsers, totalAutoVotingUsers * 2, totalAutoVotingUsers * 2 * 2, 0)

      // Total actions should still be set correctly
      expect(await relayerRewardsPool.totalActions(roundId)).to.equal(totalAutoVotingUsers * 2)
    })

    it("should handle proportional rewards correctly with different weighted actions", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 2
      const rewardAmount = ethers.parseEther("100")

      await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)
      await relayerRewardsPool.connect(owner).registerRelayer(relayer2.address)
      await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

      // Deposit rewards
      await b3tr.connect(owner).mint(owner.address, rewardAmount)
      await b3tr.connect(owner).approve(await relayerRewardsPool.getAddress(), rewardAmount)
      await relayerRewardsPool.connect(owner).deposit(rewardAmount, roundId)

      // Relayer1 does more VOTE actions (higher weight)
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE (weight 3)
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE (weight 3)

      // Relayer2 does CLAIM actions (lower weight)
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer2.address, user2.address, roundId, 1) // CLAIM (weight 1)
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer2.address, user2.address, roundId, 1) // CLAIM (weight 1)

      await waitForNextCycle(emissions)

      const relayer1Claimable = await relayerRewardsPool.claimableRewards(relayer1.address, roundId)
      const relayer2Claimable = await relayerRewardsPool.claimableRewards(relayer2.address, roundId)

      // Relayer1 should get more rewards due to higher weighted actions
      expect(relayer1Claimable).to.be.gt(relayer2Claimable)
      expect(relayer1Claimable + relayer2Claimable).to.equal(rewardAmount)
    })

    it("should handle maximum values correctly", async function () {
      const roundId = 1

      // This should not overflow
      await expect(relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, 1000)).to.not.be.reverted
    })
  })

  describe("Reduce Expected Actions", function () {
    beforeEach(async function () {
      await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)
      await relayerRewardsPool.connect(owner).registerRelayer(relayer2.address)
    })

    it("should reduce expected actions for round correctly", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 10
      const usersToReduce = 3

      // Set initial total actions
      await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

      const initialTotalActions = await relayerRewardsPool.totalActions(roundId)
      const initialTotalWeightedActions = await relayerRewardsPool.totalWeightedActions(roundId)

      // Calculate expected reductions
      const actionsToReduce = usersToReduce * 2 // Each user requires 2 actions (vote + claim)
      const voteWeight = await relayerRewardsPool.getVoteWeight()
      const claimWeight = await relayerRewardsPool.getClaimWeight()
      const weightedActionsToReduce = BigInt(usersToReduce) * (voteWeight + claimWeight)

      const expectedNewTotalActions = initialTotalActions - BigInt(actionsToReduce)
      const expectedNewTotalWeightedActions = initialTotalWeightedActions - weightedActionsToReduce

      // Reduce expected actions
      await expect(relayerRewardsPool.connect(owner).reduceExpectedActionsForRound(roundId, usersToReduce))
        .to.emit(relayerRewardsPool, "ExpectedActionsReduced")
        .withArgs(roundId, usersToReduce, expectedNewTotalActions, expectedNewTotalWeightedActions)

      // Verify the totals are updated correctly
      expect(await relayerRewardsPool.totalActions(roundId)).to.equal(expectedNewTotalActions)
      expect(await relayerRewardsPool.totalWeightedActions(roundId)).to.equal(expectedNewTotalWeightedActions)
    })

    it("should allow pool admin to reduce expected actions", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 5
      const usersToReduce = 1

      await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

      await expect(relayerRewardsPool.connect(poolAdmin).reduceExpectedActionsForRound(roundId, usersToReduce)).to.not
        .be.reverted
    })

    it("should revert when trying to reduce zero users", async function () {
      const roundId = 1

      await expect(relayerRewardsPool.connect(owner).reduceExpectedActionsForRound(roundId, 0))
        .to.be.revertedWithCustomError(relayerRewardsPool, "InvalidParameter")
        .withArgs("userCount")
    })

    it("should revert when trying to reduce more actions than available", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 2
      const usersToReduce = 5 // More than available

      await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

      await expect(
        relayerRewardsPool.connect(owner).reduceExpectedActionsForRound(roundId, usersToReduce),
      ).to.be.revertedWith("RelayerRewardsPool: cannot reduce more actions than available")
    })

    it("should revert when trying to reduce more weighted actions than available", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 1
      const usersToReduce = 2 // More than available

      await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

      await expect(
        relayerRewardsPool.connect(owner).reduceExpectedActionsForRound(roundId, usersToReduce),
      ).to.be.revertedWith("RelayerRewardsPool: cannot reduce more actions than available")
    })

    it("should not allow non-admin to reduce expected actions", async function () {
      const roundId = 1
      const usersToReduce = 1

      await expect(
        relayerRewardsPool.connect(user1).reduceExpectedActionsForRound(roundId, usersToReduce),
      ).to.be.revertedWith("RelayerRewardsPool: caller must have admin or pool admin role")
    })

    it("should handle reducing all users correctly", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 3

      await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

      // Reduce all users
      await relayerRewardsPool.connect(owner).reduceExpectedActionsForRound(roundId, totalAutoVotingUsers)

      // Should result in zero expected actions
      expect(await relayerRewardsPool.totalActions(roundId)).to.equal(0)
      expect(await relayerRewardsPool.totalWeightedActions(roundId)).to.equal(0)
    })

    it("should allow multiple reductions correctly", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 10

      await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

      const voteWeight = await relayerRewardsPool.getVoteWeight()
      const claimWeight = await relayerRewardsPool.getClaimWeight()

      // First reduction
      const firstReduction = 3
      await relayerRewardsPool.connect(owner).reduceExpectedActionsForRound(roundId, firstReduction)

      const afterFirstTotalActions = await relayerRewardsPool.totalActions(roundId)
      const afterFirstTotalWeightedActions = await relayerRewardsPool.totalWeightedActions(roundId)

      // Second reduction
      const secondReduction = 2
      const expectedSecondActions = afterFirstTotalActions - BigInt(secondReduction * 2)
      const expectedSecondWeightedActions =
        afterFirstTotalWeightedActions - BigInt(secondReduction) * (voteWeight + claimWeight)

      await expect(relayerRewardsPool.connect(owner).reduceExpectedActionsForRound(roundId, secondReduction))
        .to.emit(relayerRewardsPool, "ExpectedActionsReduced")
        .withArgs(roundId, secondReduction, expectedSecondActions, expectedSecondWeightedActions)

      expect(await relayerRewardsPool.totalActions(roundId)).to.equal(expectedSecondActions)
      expect(await relayerRewardsPool.totalWeightedActions(roundId)).to.equal(expectedSecondWeightedActions)
    })

    it("should affect reward claimability correctly", async function () {
      const roundId = 1
      const totalAutoVotingUsers = 4
      const usersToReduce = 2

      await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

      // Register some actions for half the original users
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1) // CLAIM
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user2.address, roundId, 0) // VOTE
      await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user2.address, roundId, 1) // CLAIM

      // Before reduction, round should not be complete
      await waitForNextCycle(emissions)
      expect(await relayerRewardsPool.isRewardClaimable(roundId)).to.be.false

      // After reducing users, round should be complete
      await relayerRewardsPool.connect(owner).reduceExpectedActionsForRound(roundId, usersToReduce)
      expect(await relayerRewardsPool.isRewardClaimable(roundId)).to.be.true
    })

    describe("Missed Auto-Voting Users Count", function () {
      it("should return correct count when no actions are completed", async function () {
        const roundId = 1
        const totalAutoVotingUsers = 5

        await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

        // No actions completed yet
        expect(await relayerRewardsPool.getMissedAutoVotingUsersCount(roundId)).to.equal(totalAutoVotingUsers)
      })

      it("should return zero when all actions are completed", async function () {
        const roundId = 1
        const totalAutoVotingUsers = 2

        await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

        // Complete all actions for all users
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1) // CLAIM
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user2.address, roundId, 0) // VOTE
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user2.address, roundId, 1) // CLAIM

        expect(await relayerRewardsPool.getMissedAutoVotingUsersCount(roundId)).to.equal(0)
      })

      it("should return zero when over-completed", async function () {
        const roundId = 1
        const totalAutoVotingUsers = 1

        await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

        // Register more actions than expected
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1) // CLAIM
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // Extra VOTE
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1) // Extra CLAIM

        expect(await relayerRewardsPool.getMissedAutoVotingUsersCount(roundId)).to.equal(0)
      })

      it("should correctly calculate missed users with partial completion", async function () {
        const roundId = 1
        const totalAutoVotingUsers = 3

        await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

        // Complete actions for 1 user only
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1) // CLAIM

        // 2 users missed
        expect(await relayerRewardsPool.getMissedAutoVotingUsersCount(roundId)).to.equal(2)
      })

      it("should not count partial user actions as a full missed user", async function () {
        const roundId = 1
        const totalAutoVotingUsers = 2

        await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

        // voteWeight = 3, claimWeight = 1, total per user = 4
        // Expected: 2 users * 4 = 8 weighted actions

        // Complete one full user (vote + claim) = 4 weighted actions
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE (weight 3)
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1) // CLAIM (weight 1)

        // Add only partial action for second user (just vote) = 3 weighted actions
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user2.address, roundId, 0) // VOTE (weight 3)

        // Completed: 4 + 3 = 7 weighted actions
        // Deficit: 8 - 7 = 1
        // Missed users: 1 / 4 = 0 (integer division floors, partial user not counted)
        expect(await relayerRewardsPool.getMissedAutoVotingUsersCount(roundId)).to.equal(0)
      })

      it("should handle different weight configurations correctly", async function () {
        const roundId = 1
        const totalAutoVotingUsers = 5

        // Change weights
        await relayerRewardsPool.connect(owner).setVoteWeight(5)
        await relayerRewardsPool.connect(owner).setClaimWeight(2)

        await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

        // Complete actions for 2 users (each has vote + claim = 7 weighted actions per user)
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE (weight 5)
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1) // CLAIM (weight 2)
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user2.address, roundId, 0) // VOTE (weight 5)
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user2.address, roundId, 1) // CLAIM (weight 2)

        // Expected: 5 users * 7 = 35 weighted actions
        // Completed: 2 users * 7 = 14 weighted actions
        // Deficit: 35 - 14 = 21
        // Missed users: 21 / 7 = 3
        expect(await relayerRewardsPool.getMissedAutoVotingUsersCount(roundId)).to.equal(3)
      })

      it("should update missed count as actions are reduced", async function () {
        const roundId = 1
        const totalAutoVotingUsers = 5

        await relayerRewardsPool.connect(owner).setTotalActionsForRound(roundId, totalAutoVotingUsers)

        // Initially all users are missed
        expect(await relayerRewardsPool.getMissedAutoVotingUsersCount(roundId)).to.equal(5)

        // Reduce expected actions by 2 users
        await relayerRewardsPool.connect(owner).reduceExpectedActionsForRound(roundId, 2)

        // Now only 3 users are expected and all are still missed
        expect(await relayerRewardsPool.getMissedAutoVotingUsersCount(roundId)).to.equal(3)

        // Complete actions for 1 user
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 0) // VOTE
        await relayerRewardsPool.connect(owner).registerRelayerAction(relayer1.address, user1.address, roundId, 1) // CLAIM

        // Now 2 users are missed
        expect(await relayerRewardsPool.getMissedAutoVotingUsersCount(roundId)).to.equal(2)
      })

      it("should return zero for round with no auto-voting users set", async function () {
        const roundId = 999 // Round with no setup

        expect(await relayerRewardsPool.getMissedAutoVotingUsersCount(roundId)).to.equal(0)
      })
    })
  })

  describe("Calculate Relayer Fee", function () {
    it("should calculate 10% fee correctly for normal amounts", async function () {
      const reward1000 = ethers.parseEther("1000")
      const expectedFee = ethers.parseEther("100") // 10% of 1000

      const fee = await relayerRewardsPool.calculateRelayerFee(reward1000)
      expect(fee).to.equal(expectedFee)
    })

    it("should calculate fee correctly for small amounts", async function () {
      const reward5 = ethers.parseEther("5")
      const expectedFee = ethers.parseEther("0.5") // 10% of 5

      const fee = await relayerRewardsPool.calculateRelayerFee(reward5)
      expect(fee).to.equal(expectedFee)
    })

    it("should cap fee at 100 B3TR when calculated fee exceeds cap", async function () {
      const largeReward = ethers.parseEther("10000") // 10% would be 1000 B3TR
      const feeCap = ethers.parseEther("100") // Default cap

      const fee = await relayerRewardsPool.calculateRelayerFee(largeReward)
      expect(fee).to.equal(feeCap)
    })

    it("should return exact cap when calculated fee equals cap", async function () {
      const reward1000 = ethers.parseEther("1000") // 10% = 100 B3TR (exactly at cap)
      const feeCap = ethers.parseEther("100")

      const fee = await relayerRewardsPool.calculateRelayerFee(reward1000)
      expect(fee).to.equal(feeCap)
    })

    it("should return zero fee for zero reward", async function () {
      const fee = await relayerRewardsPool.calculateRelayerFee(0)
      expect(fee).to.equal(0)
    })

    it("should handle very small amounts with integer division", async function () {
      // 0.5 ether * 10 / 100 = 0.05 ether
      const smallReward = ethers.parseEther("0.5")
      const expectedFee = ethers.parseEther("0.05")

      const fee = await relayerRewardsPool.calculateRelayerFee(smallReward)
      expect(fee).to.equal(expectedFee)
    })

    it("should use multiply-first approach to preserve precision", async function () {
      // Test that (amount * percent) / denominator preserves precision
      // vs (amount / denominator) * percent which would lose precision

      const reward = ethers.parseEther("999")
      // (999 * 10) / 100 = 99.9 ether
      const expectedFee = ethers.parseEther("99.9")

      const fee = await relayerRewardsPool.calculateRelayerFee(reward)
      expect(fee).to.equal(expectedFee)
    })

    it("should calculate correctly after fee percentage is changed", async function () {
      // Change fee to 20%
      await relayerRewardsPool.connect(owner).setRelayerFeePercentage(20)

      const reward = ethers.parseEther("500")
      const expectedFee = ethers.parseEther("100") // 20% of 500 = 100, but capped at 100

      const fee = await relayerRewardsPool.calculateRelayerFee(reward)
      expect(fee).to.equal(expectedFee)

      // Reset to default
      await relayerRewardsPool.connect(owner).setRelayerFeePercentage(10)
    })

    it("should calculate correctly after fee cap is changed", async function () {
      // Change cap to 200 B3TR
      const newCap = ethers.parseEther("200")
      await relayerRewardsPool.connect(owner).setFeeCap(newCap)

      const largeReward = ethers.parseEther("10000") // 10% = 1000, but capped at 200
      const fee = await relayerRewardsPool.calculateRelayerFee(largeReward)
      expect(fee).to.equal(newCap)

      // Test amount where fee is below new cap
      const reward1500 = ethers.parseEther("1500") // 10% = 150 (below 200 cap)
      const fee2 = await relayerRewardsPool.calculateRelayerFee(reward1500)
      expect(fee2).to.equal(ethers.parseEther("150"))

      // Reset to default
      await relayerRewardsPool.connect(owner).setFeeCap(ethers.parseEther("100"))
    })

    it("should calculate correctly with custom denominator", async function () {
      // Change to 1000 denominator (allows more granular percentages)
      await relayerRewardsPool.connect(owner).setRelayerFeeDenominator(1000)
      await relayerRewardsPool.connect(owner).setRelayerFeePercentage(25) // 25/1000 = 2.5%

      const reward = ethers.parseEther("1000")
      const expectedFee = ethers.parseEther("25") // 2.5% of 1000

      const fee = await relayerRewardsPool.calculateRelayerFee(reward)
      expect(fee).to.equal(expectedFee)

      // Reset to defaults
      await relayerRewardsPool.connect(owner).setRelayerFeeDenominator(100)
      await relayerRewardsPool.connect(owner).setRelayerFeePercentage(10)
    })

    it("should handle edge case of 1 wei reward", async function () {
      // 1 wei * 10 / 100 = 0 (integer division)
      const fee = await relayerRewardsPool.calculateRelayerFee(1)
      expect(fee).to.equal(0)
    })

    it("should handle large reward amounts", async function () {
      const largeReward = ethers.parseEther("1000000") // 1 million B3TR
      const feeCap = ethers.parseEther("100")

      const fee = await relayerRewardsPool.calculateRelayerFee(largeReward)
      expect(fee).to.equal(feeCap) // Should be capped
    })

    describe("Real-world reward amounts", function () {
      it("should calculate fee for 1.2536 B3TR reward", async function () {
        const reward = ethers.parseEther("1.2536")
        // 1.2536 * 10 / 100 = 0.12536
        const expectedFee = ethers.parseEther("0.12536")

        const fee = await relayerRewardsPool.calculateRelayerFee(reward)
        expect(fee).to.equal(expectedFee)
      })

      it("should calculate fee for 47.89213 B3TR reward", async function () {
        const reward = ethers.parseEther("47.89213")
        // 47.89213 * 10 / 100 = 4.789213
        const expectedFee = ethers.parseEther("4.789213")

        const fee = await relayerRewardsPool.calculateRelayerFee(reward)
        expect(fee).to.equal(expectedFee)
      })

      it("should calculate fee for 238.456789123456789 B3TR reward", async function () {
        const reward = ethers.parseEther("238.456789123456789")
        // 238.456789123456789 * 10 / 100 = 23.8456789123456789
        const expectedFee = ethers.parseEther("23.8456789123456789")

        const fee = await relayerRewardsPool.calculateRelayerFee(reward)
        expect(fee).to.equal(expectedFee)
      })

      it("should calculate fee for 0.00123456789 B3TR reward (very small)", async function () {
        const reward = ethers.parseEther("0.00123456789")
        // 0.00123456789 * 10 / 100 = 0.000123456789
        const expectedFee = ethers.parseEther("0.000123456789")

        const fee = await relayerRewardsPool.calculateRelayerFee(reward)
        expect(fee).to.equal(expectedFee)
      })

      it("should calculate fee for 999.99999999999999 B3TR reward", async function () {
        const reward = ethers.parseEther("999.99999999999999")
        // 999.99999999999999 * 10 / 100 = 99.999999999999999
        const expectedFee = ethers.parseEther("99.999999999999999")

        const fee = await relayerRewardsPool.calculateRelayerFee(reward)
        expect(fee).to.equal(expectedFee)
      })

      it("should cap fee for 1234.56789012345678 B3TR reward", async function () {
        const reward = ethers.parseEther("1234.56789012345678")
        // 1234.56789012345678 * 10 / 100 = 123.456789012345678 (but capped at 100)
        const feeCap = ethers.parseEther("100")

        const fee = await relayerRewardsPool.calculateRelayerFee(reward)
        expect(fee).to.equal(feeCap) // Should be capped
      })

      it("should maintain precision for 3.14159265358979323 B3TR (Pi)", async function () {
        const reward = ethers.parseEther("3.14159265358979323")
        // 3.14159265358979323 * 10 / 100 = 0.314159265358979323
        const expectedFee = ethers.parseEther("0.314159265358979323")

        const fee = await relayerRewardsPool.calculateRelayerFee(reward)
        expect(fee).to.equal(expectedFee)
      })

      it("should handle 0.987654321 B3TR reward with multiply-first precision", async function () {
        const reward = ethers.parseEther("0.987654321")
        // (0.987654321 * 10) / 100 = 0.0987654321
        const expectedFee = ethers.parseEther("0.0987654321")

        const fee = await relayerRewardsPool.calculateRelayerFee(reward)
        expect(fee).to.equal(expectedFee)

        // Verify multiply-first preserves precision
        // If we did divide-first: 0.987654321 / 100 = 0.00987654321, then * 10 = 0.0987654321
        // Both work here, but multiply-first is safer for integer division edge cases
      })

      it("should handle typical voter reward of 156.789 B3TR", async function () {
        const reward = ethers.parseEther("156.789")
        // 156.789 * 10 / 100 = 15.6789
        const expectedFee = ethers.parseEther("15.6789")

        const fee = await relayerRewardsPool.calculateRelayerFee(reward)
        expect(fee).to.equal(expectedFee)
      })

      it("should calculate fee for edge case 9.99999999999999999 B3TR", async function () {
        const reward = ethers.parseEther("9.99999999999999999")
        // 9.99999999999999999 * 10 / 100 = 0.999999999999999999
        const expectedFee = ethers.parseEther("0.999999999999999999")

        const fee = await relayerRewardsPool.calculateRelayerFee(reward)
        expect(fee).to.equal(expectedFee)
      })
    })
  })

  describe("Version", function () {
    it("should return the correct version", async function () {
      expect(await relayerRewardsPool.version()).to.equal("1")
    })
  })
})
