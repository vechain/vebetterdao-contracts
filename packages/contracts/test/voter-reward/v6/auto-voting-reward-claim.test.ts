import { ethers } from "hardhat"
import { expect } from "chai"
import { describe, it, beforeEach } from "mocha"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { getOrDeployContractInstances, getVot3Tokens, waitForRoundToEnd, waitForNextCycle } from "../../helpers"
import { endorseApp } from "../../helpers/xnodes"
import {
  XAllocationVoting,
  X2EarnApps,
  VeBetterPassport,
  VoterRewards,
  B3TR,
  Emissions,
  VOT3,
  RelayerRewardsPool,
} from "../../../typechain-types"

describe("VoterRewards V6 - @shard10b", function () {
  let xAllocationVoting: XAllocationVoting
  let x2EarnApps: X2EarnApps
  let veBetterPassport: VeBetterPassport
  let voterRewards: VoterRewards
  let b3tr: B3TR
  let vot3: VOT3
  let emissions: Emissions
  let relayerRewardsPool: RelayerRewardsPool
  let owner: HardhatEthersSigner
  let relayer1: HardhatEthersSigner
  let minterAccount: HardhatEthersSigner
  let otherAccounts: HardhatEthersSigner[]
  let user: HardhatEthersSigner
  let user1: HardhatEthersSigner
  let user2: HardhatEthersSigner
  let appOwner: HardhatEthersSigner

  // Main setup - used by most tests
  const setupContracts = async () => {
    const config = await getOrDeployContractInstances({
      forceDeploy: true,
    })
    if (!config) throw new Error("Failed to deploy contracts")

    xAllocationVoting = config.xAllocationVoting
    x2EarnApps = config.x2EarnApps
    veBetterPassport = config.veBetterPassport
    voterRewards = config.voterRewards
    b3tr = config.b3tr
    vot3 = config.vot3
    emissions = config.emissions
    owner = config.owner
    minterAccount = config.minterAccount
    otherAccounts = config.otherAccounts
    relayerRewardsPool = config.relayerRewardsPool
    relayer1 = otherAccounts[0]
    user = otherAccounts[1]
    user1 = otherAccounts[2]
    user2 = otherAccounts[3]
    appOwner = otherAccounts[4]

    await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

    await emissions.connect(minterAccount).bootstrap()
    await relayerRewardsPool.connect(owner).setRelayerFeePercentage(10)
    await voterRewards.connect(owner).setXAllocationVoting(await xAllocationVoting.getAddress())

    await veBetterPassport.toggleCheck(1)
    await veBetterPassport.whitelist(user.address)
    await veBetterPassport.whitelist(user1.address)
    await veBetterPassport.whitelist(user2.address)
    await getVot3Tokens(user, "1000")
    await getVot3Tokens(user1, "1000")
    await getVot3Tokens(user2, "1000")

    await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)
  }

  describe("Relayer Fee Functionality", function () {
    beforeEach(async function () {
      await setupContracts()
      await emissions.connect(minterAccount).start()
    })

    it("should return the correct version", async function () {
      expect(await voterRewards.version()).to.equal("6")
    })

    it("should take a fee when a relayer claims for a user with auto-voting enabled", async function () {
      // Create a test app
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(appOwner.address))
      await x2EarnApps.connect(owner).submitApp(appOwner.address, appOwner.address, appOwner.address, "metadataURI")
      await endorseApp(app1Id, appOwner)

      // Wait for next cycle and start emissions
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      // Enable auto-voting for user
      await xAllocationVoting.connect(user).setUserVotingPreferences([app1Id])
      await xAllocationVoting.connect(user).toggleAutoVoting(user.address)

      // Start a new round
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      const roundId = await xAllocationVoting.currentRoundId()

      // Auto-vote for user via relayer
      const txVote = await xAllocationVoting.connect(relayer1).castVoteOnBehalfOf(user.address, roundId)
      const voteWeight = await relayerRewardsPool.getVoteWeight()
      await expect(txVote)
        .to.emit(relayerRewardsPool, "RelayerActionRegistered")
        .withArgs(relayer1.address, user.address, roundId, 1, voteWeight)

      // Wait for the round to end
      await waitForRoundToEnd(roundId)

      // Check initial balances
      const initialRelayerBalance = await b3tr.balanceOf(relayer1.address)
      const initialUserBalance = await b3tr.balanceOf(user.address)
      const initialPoolTotal = await relayerRewardsPool.getTotalRewards(roundId)
      const claimWeight = await relayerRewardsPool.getClaimWeight()

      // Get the expected rewards
      const userReward = await voterRewards.getReward(roundId, user.address)
      const userGMReward = await voterRewards.getGMReward(roundId, user.address)
      const userTotalReward = userReward + userGMReward

      // Calculate expected fee (10% of total reward)
      const expectedFee = await voterRewards.getRelayerFee(roundId, user.address)

      // Relayer claims for user (who has auto-voting enabled)
      const tx = await voterRewards.connect(relayer1).claimReward(roundId, user.address)

      // Relayer action registered in pool and fee deposited
      await expect(tx)
        .to.emit(relayerRewardsPool, "RelayerActionRegistered")
        .withArgs(relayer1.address, user.address, roundId, 2, claimWeight)
      await expect(tx)
        .to.emit(relayerRewardsPool, "RewardsDeposited")
        .withArgs(roundId, expectedFee, initialPoolTotal + expectedFee)

      // Check balances after claim
      const relayerBalanceAfter = await b3tr.balanceOf(relayer1.address)
      const userBalanceAfter = await b3tr.balanceOf(user.address)

      // Relayer should NOT receive the fee directly
      expect(relayerBalanceAfter - initialRelayerBalance).to.equal(0n)

      // User should have received the reward minus the fee
      expect(userBalanceAfter - initialUserBalance).to.equal(userTotalReward)
    })

    it("should not take a fee when a relayer claims for a user without auto-voting enabled", async function () {
      // Create a test app
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(appOwner.address))
      await x2EarnApps.connect(owner).submitApp(appOwner.address, appOwner.address, appOwner.address, "metadataURI")
      await endorseApp(app1Id, appOwner)

      // Wait for next cycle and start emissions
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      const roundId = await xAllocationVoting.currentRoundId()

      // User votes manually with enough tokens to meet the threshold
      const votingThreshold = await xAllocationVoting.votingThreshold()
      const voteAmount = votingThreshold
      await xAllocationVoting.connect(user).castVote(roundId, [app1Id], [voteAmount])

      // Wait for the round to end
      await waitForRoundToEnd(roundId)

      // Check initial balances
      const initialRelayerBalance = await b3tr.balanceOf(relayer1.address)
      const initialUserBalance = await b3tr.balanceOf(user.address)

      // Get the expected rewards
      const userReward = await voterRewards.getReward(roundId, user.address)
      const userGMReward = await voterRewards.getGMReward(roundId, user.address)
      const userTotalReward = userReward + userGMReward

      // Relayer claims for user (who doesn't have auto-voting enabled)
      const tx = await voterRewards.connect(relayer1).claimReward(roundId, user.address)

      // Should emit RewardClaimedV2 event
      await expect(tx)
        .to.emit(voterRewards, "RewardClaimedV2")
        .withArgs(roundId, user.address, userReward, userGMReward)

      // Should NOT emit RelayerActionRegistered and RewardsDeposited events
      await expect(tx).to.not.emit(relayerRewardsPool, "RelayerActionRegistered")
      await expect(tx).to.not.emit(relayerRewardsPool, "RewardsDeposited")

      // Check balances after claim
      const relayerBalanceAfter = await b3tr.balanceOf(relayer1.address)
      const userBalanceAfter = await b3tr.balanceOf(user.address)

      // Relayer balance should not change
      expect(relayerBalanceAfter).to.equal(initialRelayerBalance)

      // User should have received the full reward
      expect(userBalanceAfter - initialUserBalance).to.equal(userTotalReward)
    })

    it("should revert when user claims their own rewards during early access period if auto-voting is enabled", async function () {
      // Create a test app
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(appOwner.address))
      await x2EarnApps.connect(owner).submitApp(appOwner.address, appOwner.address, appOwner.address, "metadataURI")
      await endorseApp(app1Id, appOwner)

      // Wait for next cycle and start emissions
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      // Enable auto-voting for user
      await xAllocationVoting.connect(user).setUserVotingPreferences([app1Id])
      await xAllocationVoting.connect(user).toggleAutoVoting(user.address)

      // Start a new round
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      const roundId = await xAllocationVoting.currentRoundId()

      // Auto-vote for user
      await xAllocationVoting.connect(relayer1).castVoteOnBehalfOf(user.address, roundId)

      // Wait for the round to end
      await waitForRoundToEnd(roundId)

      // User claims their own rewards
      await expect(voterRewards.connect(user).claimReward(roundId, user.address)).to.be.revertedWith(
        "RelayerRewardsPool: auto-voting users cannot claim for themselves during early access period",
      )
    })

    it("should handle fee for auto-voting and non-auto-voting users", async function () {
      // Create a test app
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(appOwner.address))
      await x2EarnApps.connect(owner).submitApp(appOwner.address, appOwner.address, appOwner.address, "metadataURI")
      await endorseApp(app1Id, appOwner)

      // Wait for next cycle and start emissions
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      // Enable auto-voting for user
      await xAllocationVoting.connect(user).setUserVotingPreferences([app1Id])
      await xAllocationVoting.connect(user).toggleAutoVoting(user.address)

      // Start a new round
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      const roundId = await xAllocationVoting.currentRoundId()

      // Auto-vote for user
      const txVote = await xAllocationVoting.connect(relayer1).castVoteOnBehalfOf(user.address, roundId)
      const voteWeight = await relayerRewardsPool.getVoteWeight()
      await expect(txVote)
        .to.emit(relayerRewardsPool, "RelayerActionRegistered")
        .withArgs(relayer1.address, user.address, roundId, 1, voteWeight)

      // Cast vote for user1 manually
      await xAllocationVoting.connect(user1).castVote(roundId, [app1Id], [ethers.parseEther("1000")])

      // Wait for the round to end
      await waitForRoundToEnd(roundId)

      // Get the expected rewards
      const userReward = await voterRewards.getReward(roundId, user.address)
      const userGMReward = await voterRewards.getGMReward(roundId, user.address)
      const userTotalReward = userReward + userGMReward

      const user1Reward = await voterRewards.getReward(roundId, user1.address)
      const user1GMReward = await voterRewards.getGMReward(roundId, user1.address)
      const user1TotalReward = user1Reward + user1GMReward

      // 10% fee for auto-voting user
      const expectedFee = await voterRewards.getRelayerFee(roundId, user.address)

      // No fee for user1 because auto-voting is disabled
      const expectedUser1Fee = await voterRewards.getRelayerFee(roundId, user1.address)

      // Initial balances
      const initialRelayerBalance = await b3tr.balanceOf(relayer1.address)
      const initialUserBalance = await b3tr.balanceOf(user.address)
      const initialPoolTotal = await relayerRewardsPool.getTotalRewards(roundId)
      const claimWeight = await relayerRewardsPool.getClaimWeight()

      // Relayer claims for user
      const tx = await voterRewards.connect(relayer1).claimReward(roundId, user.address)

      // Action should be registered in the pool and fee deposited
      await expect(tx)
        .to.emit(relayerRewardsPool, "RelayerActionRegistered")
        .withArgs(relayer1.address, user.address, roundId, 2, claimWeight)
      await expect(tx)
        .to.emit(relayerRewardsPool, "RewardsDeposited")
        .withArgs(roundId, expectedFee, initialPoolTotal + expectedFee)

      // Check balances after claim
      const relayerBalanceAfter = await b3tr.balanceOf(relayer1.address)
      const userBalanceAfter = await b3tr.balanceOf(user.address)

      // Relayer should NOT receive the fee directly
      expect(relayerBalanceAfter - initialRelayerBalance).to.equal(0n)
      expect(userBalanceAfter - initialUserBalance).to.equal(userTotalReward)

      // Fee should be deposited to the pool
      const poolTotalAfter = await relayerRewardsPool.getTotalRewards(roundId)
      expect(poolTotalAfter - initialPoolTotal).to.equal(expectedFee)

      // User1 should have received the full reward
      await voterRewards.connect(user1).claimReward(roundId, user1.address)
      const user1BalanceAfter = await b3tr.balanceOf(user1.address)
      expect(user1BalanceAfter).to.equal(user1TotalReward)
      expect(expectedUser1Fee).to.equal(0n)
    })

    it("should handle fee for relayer claiming their own rewards", async function () {
      // Setup additional relayer
      const relayer2 = otherAccounts[5]
      await relayerRewardsPool.connect(owner).registerRelayer(relayer2.address)

      // Create a test app
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(appOwner.address))
      await x2EarnApps.connect(owner).submitApp(appOwner.address, appOwner.address, appOwner.address, "metadataURI")
      await endorseApp(app1Id, appOwner)

      // Wait for next cycle and start emissions
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      // Enable auto-voting for both users
      await xAllocationVoting.connect(user).setUserVotingPreferences([app1Id])
      await xAllocationVoting.connect(user).toggleAutoVoting(user.address)
      await xAllocationVoting.connect(user1).setUserVotingPreferences([app1Id])
      await xAllocationVoting.connect(user1).toggleAutoVoting(user1.address)
      // Start a new round
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      const roundId = await xAllocationVoting.currentRoundId()

      // Relayer1 auto-votes for user (earns VOTE action)
      await xAllocationVoting.connect(relayer1).castVoteOnBehalfOf(user.address, roundId)

      // Relayer2 auto-votes for user1 (earns VOTE action)
      await xAllocationVoting.connect(relayer2).castVoteOnBehalfOf(user1.address, roundId)

      // Wait for the round to end
      await waitForRoundToEnd(roundId)

      // Get initial pool state
      const initialPoolTotal = await relayerRewardsPool.getTotalRewards(roundId)
      const claimWeight = await relayerRewardsPool.getClaimWeight()

      // Relayer1 claims for user (earns CLAIM action)
      const userFee = await voterRewards.getRelayerFee(roundId, user.address)
      const tx1 = await voterRewards.connect(relayer1).claimReward(roundId, user.address)

      await expect(tx1)
        .to.emit(relayerRewardsPool, "RelayerActionRegistered")
        .withArgs(relayer1.address, user.address, roundId, 2, claimWeight) // 2nd action for relayer1

      // Relayer2 claims for user1 (earns CLAIM action)
      const user1Fee = await voterRewards.getRelayerFee(roundId, user1.address)
      const tx2 = await voterRewards.connect(relayer2).claimReward(roundId, user1.address)

      await expect(tx2)
        .to.emit(relayerRewardsPool, "RelayerActionRegistered")
        .withArgs(relayer2.address, user1.address, roundId, 2, claimWeight) // 2nd action for relayer2

      // Check that fees were deposited to the pool
      const poolTotalAfterClaims = await relayerRewardsPool.getTotalRewards(roundId)
      const totalFeesDeposited = userFee + user1Fee
      expect(poolTotalAfterClaims - initialPoolTotal).to.equal(totalFeesDeposited)

      // Check that rewards are claimable for both relayers
      const relayer1ClaimableRewards = await relayerRewardsPool.claimableRewards(relayer1.address, roundId)
      const relayer2ClaimableRewards = await relayerRewardsPool.claimableRewards(relayer2.address, roundId)

      // Both relayers should have equal claimable rewards since they performed the same weighted actions
      expect(relayer1ClaimableRewards).to.be.gt(0n)
      expect(relayer2ClaimableRewards).to.be.gt(0n)
      expect(relayer1ClaimableRewards).to.equal(relayer2ClaimableRewards)

      // Check initial relayer balances
      const initialRelayer1Balance = await b3tr.balanceOf(relayer1.address)
      const initialRelayer2Balance = await b3tr.balanceOf(relayer2.address)

      // Now relayers claim their own rewards from the pool
      const claimTx1 = await relayerRewardsPool.claimRewards(roundId, relayer1.address)
      await expect(claimTx1)
        .to.emit(relayerRewardsPool, "RelayerRewardsClaimed")
        .withArgs(relayer1.address, roundId, relayer1ClaimableRewards)

      const claimTx2 = await relayerRewardsPool.claimRewards(roundId, relayer2.address)
      await expect(claimTx2)
        .to.emit(relayerRewardsPool, "RelayerRewardsClaimed")
        .withArgs(relayer2.address, roundId, relayer2ClaimableRewards)

      // Check final balances - relayers should have received their rewards
      const finalRelayer1Balance = await b3tr.balanceOf(relayer1.address)
      const finalRelayer2Balance = await b3tr.balanceOf(relayer2.address)

      expect(finalRelayer1Balance - initialRelayer1Balance).to.equal(relayer1ClaimableRewards)
      expect(finalRelayer2Balance - initialRelayer2Balance).to.equal(relayer2ClaimableRewards)

      expect(await relayerRewardsPool.claimableRewards(relayer1.address, roundId)).to.equal(0n)
      expect(await relayerRewardsPool.claimableRewards(relayer2.address, roundId)).to.equal(0n)

      // Verify relayers cannot claim again
      await expect(relayerRewardsPool.claimRewards(roundId, relayer1.address)).to.be.revertedWithCustomError(
        relayerRewardsPool,
        "RewardsAlreadyClaimed",
      )
      await expect(relayerRewardsPool.claimRewards(roundId, relayer2.address)).to.be.revertedWithCustomError(
        relayerRewardsPool,
        "RewardsAlreadyClaimed",
      )
    })

    it("should correctly apply fee cap when calculated fee exceeds cap", async function () {
      // This test verifies that the fee cap (100 B3TR) is correctly applied
      // when the calculated fee (10% of reward) would exceed the cap

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(appOwner.address))
      await x2EarnApps.connect(owner).submitApp(appOwner.address, appOwner.address, appOwner.address, "metadataURI")
      await endorseApp(app1Id, appOwner)

      // Wait for next cycle and start emissions
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      // Enable auto-voting for user
      await xAllocationVoting.connect(user).setUserVotingPreferences([app1Id])
      await xAllocationVoting.connect(user).toggleAutoVoting(user.address)

      // Start a new round
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      const roundId = await xAllocationVoting.currentRoundId()

      // Auto-vote for user
      await xAllocationVoting.connect(relayer1).castVoteOnBehalfOf(user.address, roundId)
      await waitForRoundToEnd(roundId)

      // Get net rewards and fee from contract
      const netUserReward = await voterRewards.getReward(roundId, user.address)
      const netUserGMReward = await voterRewards.getGMReward(roundId, user.address)
      const actualFee = await voterRewards.getRelayerFee(roundId, user.address)

      // Calculate raw total reward (before fees)
      const rawTotalReward = netUserReward + netUserGMReward + actualFee

      const feePercentage = await relayerRewardsPool.getRelayerFeePercentage()
      const feeDenominator = await relayerRewardsPool.getRelayerFeeDenominator()
      const feeCap = await relayerRewardsPool.getFeeCap()

      // Calculate what the fee would be without cap applied to RAW total
      const calculatedFeeWithoutCap = (rawTotalReward * feePercentage) / feeDenominator

      // Verify fee cap logic
      if (calculatedFeeWithoutCap > feeCap) {
        expect(actualFee).to.equal(feeCap, "Fee should be capped at maximum fee cap")
        expect(actualFee < calculatedFeeWithoutCap).to.be.true
      } else {
        expect(actualFee).to.equal(calculatedFeeWithoutCap, "Fee should equal calculated fee when under cap")
        expect(actualFee).to.equal((rawTotalReward * 10n) / 100n, "Fee should be exactly 10% of raw total")
      }

      // Verify the mathematical relationship
      expect(calculatedFeeWithoutCap).to.equal(
        (rawTotalReward * 10n) / 100n,
        "Calculated fee should be 10% of RAW total reward",
      )

      // Verify fee parameters are as expected
      expect(feePercentage).to.equal(10n, "Fee percentage should be 10")
      expect(feeDenominator).to.equal(100n, "Fee denominator should be 100")
      expect(feeCap).to.equal(ethers.parseEther("100"), "Fee cap should be 100 B3TR")

      // Verify that net + fee = raw (accounting for proportional distribution)
      expect(netUserReward + netUserGMReward + actualFee).to.equal(
        rawTotalReward,
        "Net rewards plus fee should equal raw total",
      )
    })

    it("[Edge Case] should handle when one user becomes non-person during auto-voting round", async function () {
      // This test verifies that when a user loses their personhood status (gets blacklisted, etc)
      // during an auto-voting round, the system properly handles the dynamic reduction of
      // expected actions. It ensures that:
      //
      // 1. Auto-voting is disabled for the blacklisted user
      // 2. Expected total actions are reduced appropriately
      // 3. Relayer rewards remain claimable for successful actions
      // 4. The round can still complete successfully with reduced participation
      //
      // This prevents scenarios where blacklisted users could block relayer rewards
      // by being counted in expected actions but unable to actually vote.

      // Setup additional relayer
      const relayer2 = otherAccounts[5]
      await relayerRewardsPool.connect(owner).registerRelayer(relayer2.address)

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(appOwner.address))
      await x2EarnApps.connect(owner).submitApp(appOwner.address, appOwner.address, appOwner.address, "metadataURI")
      await endorseApp(app1Id, appOwner)

      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      // Enable auto-voting for both users
      await xAllocationVoting.connect(user).setUserVotingPreferences([app1Id])
      await xAllocationVoting.connect(user).toggleAutoVoting(user.address)
      await xAllocationVoting.connect(user1).setUserVotingPreferences([app1Id])
      await xAllocationVoting.connect(user1).toggleAutoVoting(user1.address)

      // Start a new round - both users should be counted in total actions
      await waitForNextCycle(emissions)
      const tx = await emissions.connect(minterAccount).distribute()

      const roundId = await xAllocationVoting.currentRoundId()

      // Verify that expected actions are set for 2 auto-voting users (2 users * 2 actions each = 4 total)
      const voteWeight = await relayerRewardsPool.getVoteWeight()
      const claimWeight = await relayerRewardsPool.getClaimWeight()
      const expectedTotalActions = 4 // 2 users * 2 actions each
      const expectedTotalWeightedActions = 2n * (voteWeight + claimWeight) // 2 users * (vote + claim weights)

      await expect(tx)
        .to.emit(relayerRewardsPool, "TotalAutoVotingActionsSet")
        .withArgs(roundId, 2, expectedTotalActions, expectedTotalWeightedActions, 2) // 2 relayers registered

      expect(await relayerRewardsPool.totalActions(roundId)).to.equal(expectedTotalActions)
      expect(await relayerRewardsPool.totalWeightedActions(roundId)).to.equal(expectedTotalWeightedActions)

      // Successfully cast vote for first user
      await xAllocationVoting.connect(relayer1).castVoteOnBehalfOf(user.address, roundId)

      // Un-whitelist user1 to make them non-person
      await veBetterPassport.connect(owner).blacklist(user1.address)

      // Verify user1 is no longer a person
      const [isPerson] = await veBetterPassport.isPersonAtTimepoint(user1.address, await xAllocationVoting.clock())
      expect(isPerson).to.be.false

      // Calculate expected values after reduction
      const reducedTotalActions = expectedTotalActions - 2 // Remove 2 actions for 1 user
      const reducedTotalWeightedActions = expectedTotalWeightedActions - (voteWeight + claimWeight) // Remove weighted actions for 1 user

      // Attempt to cast vote for user1 should toggle off auto-voting and reduce expected actions
      const castVoteTx = xAllocationVoting.connect(relayer2).castVoteOnBehalfOf(user1.address, roundId)
      await expect(castVoteTx).to.emit(xAllocationVoting, "AutoVotingToggled").withArgs(user1.address, false)
      await expect(castVoteTx)
        .to.emit(xAllocationVoting, "AutoVoteSkipped")
        .withArgs(user1.address, roundId, false, 1, await vot3.balanceOf(user1.address))
      await expect(castVoteTx).to.not.emit(xAllocationVoting, "AllocationVoteCast")

      // Check that expected actions reduction event is emitted
      await expect(castVoteTx)
        .to.emit(relayerRewardsPool, "ExpectedActionsReduced")
        .withArgs(roundId, 1, reducedTotalActions, reducedTotalWeightedActions)

      expect(await relayerRewardsPool.totalActions(roundId)).to.equal(reducedTotalActions)
      expect(await relayerRewardsPool.totalWeightedActions(roundId)).to.equal(reducedTotalWeightedActions)

      // Verify user1 auto-voting is now disabled and app preferences were cleared
      expect(await xAllocationVoting.isUserAutoVotingEnabledAtTimepoint(user1.address, await xAllocationVoting.clock()))
        .to.be.false
      expect(await xAllocationVoting.getUserVotingPreferences(user1.address)).to.deep.equal([])

      await waitForRoundToEnd(roundId)

      // Only relayer1 should be able to claim rewards for user (who successfully voted)
      const userReward = await voterRewards.getReward(roundId, user.address)
      const userFee = await voterRewards.getRelayerFee(roundId, user.address)

      expect(userReward).to.be.gt(0)
      expect(userFee).to.be.gt(0)

      // Relayer1 claims for user
      await voterRewards.connect(relayer1).claimReward(roundId, user.address)

      // Verify that with reduced expected actions, relayer rewards are still claimable
      // Even though only 1 user voted instead of 2, the round is still valid
      expect(await relayerRewardsPool.isRewardClaimable(roundId)).to.be.true

      // Check that completed weighted actions match the reduced total weighted actions
      const completedWeightedActions = await relayerRewardsPool.completedWeightedActions(roundId)
      expect(completedWeightedActions).to.equal(reducedTotalWeightedActions)

      // Relayer1 should be able to claim their proportional rewards
      const relayer1ClaimableRewards = await relayerRewardsPool.claimableRewards(relayer1.address, roundId)
      expect(relayer1ClaimableRewards).to.be.gt(0)

      await relayerRewardsPool.claimRewards(roundId, relayer1.address)

      // Verify relayer2 gets no rewards since they performed no successful actions
      expect(await relayerRewardsPool.claimableRewards(relayer2.address, roundId)).to.equal(0)
    })

    it("[Race Condition] should handle when 2 relayers try to vote for same user in same block", async function () {
      // This test verifies that when multiple relayers attempt to vote for the same user
      // in the same block, only one vote succeeds and only that relayer gets credit.
      // This prevents double-voting and ensures fair relayer reward distribution.

      // Setup additional relayer
      const relayer2 = otherAccounts[5]
      await relayerRewardsPool.connect(owner).registerRelayer(relayer2.address)

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(appOwner.address))
      await x2EarnApps.connect(owner).submitApp(appOwner.address, appOwner.address, appOwner.address, "metadataURI")
      await endorseApp(app1Id, appOwner)

      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      // Enable auto-voting for user
      await xAllocationVoting.connect(user).setUserVotingPreferences([app1Id])
      await xAllocationVoting.connect(user).toggleAutoVoting(user.address)

      // Start a new round
      await waitForNextCycle(emissions)
      await emissions.connect(minterAccount).distribute()

      const roundId = await xAllocationVoting.currentRoundId()
      const voteWeight = await relayerRewardsPool.getVoteWeight()

      // First relayer successfully votes
      const tx1 = await xAllocationVoting.connect(relayer1).castVoteOnBehalfOf(user.address, roundId)
      await expect(tx1)
        .to.emit(relayerRewardsPool, "RelayerActionRegistered")
        .withArgs(relayer1.address, user.address, roundId, 1, voteWeight)

      // Verify the vote was cast
      await expect(tx1).to.emit(xAllocationVoting, "AllocationVoteCast")

      // Second relayer tries to vote for the same user - should fail
      await expect(
        xAllocationVoting.connect(relayer2).castVoteOnBehalfOf(user.address, roundId),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorAlreadyCastVote")

      // Verify only relayer1 got credit for the vote
      const relayer1Actions = await relayerRewardsPool.totalRelayerActions(relayer1.address, roundId)
      const relayer2Actions = await relayerRewardsPool.totalRelayerActions(relayer2.address, roundId)

      expect(relayer1Actions).to.equal(1)
      expect(relayer2Actions).to.equal(0)

      // Wait for round to end and claim rewards
      await waitForRoundToEnd(roundId)

      const userReward = await voterRewards.getReward(roundId, user.address)
      const userFee = await voterRewards.getRelayerFee(roundId, user.address)
      expect(userReward).to.be.gt(0)
      expect(userFee).to.be.gt(0)

      // Both relayers try to claim - first one succeeds
      const claimWeight = await relayerRewardsPool.getClaimWeight()
      const claimTx = await voterRewards.connect(relayer1).claimReward(roundId, user.address)
      await expect(claimTx)
        .to.emit(relayerRewardsPool, "RelayerActionRegistered")
        .withArgs(relayer1.address, user.address, roundId, 2, claimWeight)

      // Second relayer tries to claim for same user - should fail
      await expect(voterRewards.connect(relayer2).claimReward(roundId, user.address)).to.be.revertedWith(
        "VoterRewards: reward must be greater than 0",
      )

      // Verify final relayer action counts
      const finalRelayer1Actions = await relayerRewardsPool.totalRelayerActions(relayer1.address, roundId)
      const finalRelayer2Actions = await relayerRewardsPool.totalRelayerActions(relayer2.address, roundId)

      expect(finalRelayer1Actions).to.equal(2) // Vote + Claim
      expect(finalRelayer2Actions).to.equal(0) // No successful actions

      // Verify relayer rewards distribution
      const relayer1ClaimableRewards = await relayerRewardsPool.claimableRewards(relayer1.address, roundId)
      const relayer2ClaimableRewards = await relayerRewardsPool.claimableRewards(relayer2.address, roundId)

      expect(relayer1ClaimableRewards).to.be.gt(0) // Relayer1 should get all rewards
      expect(relayer2ClaimableRewards).to.equal(0) // Relayer2 should get nothing
    })
  })
})
