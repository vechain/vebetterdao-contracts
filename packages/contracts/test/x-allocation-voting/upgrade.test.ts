import { ethers } from "hardhat"
import { expect } from "chai"
import { describe, it } from "mocha"
import { deployProxy, deployAndUpgrade, upgradeProxy } from "../../scripts/helpers/upgrades"
import { getOrDeployContractInstances } from "../helpers/deploy"
import { createTestConfig } from "../helpers/config"
import {
  EmissionsV1,
  VoterRewardsV1,
  XAllocationVotingV3,
  XAllocationVotingV4,
  XAllocationVotingV5,
  XAllocationVotingV6,
  XAllocationVotingV7,
  XAllocationVoting,
  EmissionsV2,
  VoterRewardsV2,
} from "../../typechain-types"
import { getVot3Tokens } from "../helpers"
import { endorseApp } from "../helpers/xnodes"
import { waitForBlock } from "../helpers"
import { autoVotingLibraries } from "../../scripts/libraries"

describe("XAllocationVoting Upgrade - @shard14a", function () {
  type XAllocationContract =
    | XAllocationVotingV3
    | XAllocationVotingV4
    | XAllocationVotingV5
    | XAllocationVotingV6
    | XAllocationVotingV7
    | XAllocationVoting

  interface AppVotesForRound {
    [appId: string]: bigint
  }

  interface RoundVotesData {
    [roundId: number]: AppVotesForRound
  }

  interface UserVotesForRound {
    [userAddress: string]: boolean
  }

  interface RoundUserVotes {
    [roundId: number]: UserVotesForRound
  }

  /*
   * USAGE PATTERN:
   * -------------
   * This function is called immediately after each upgrade to ensure:
   * - No storage slots were corrupted during upgrade
   * - All mappings remain accessible and accurate
   * - Historical data spanning multiple rounds is preserved
   *
   * The test builds up expectedVotes and expectedUserVotes cumulatively,
   * so each validation checks the ENTIRE history, not just recent changes.
   */
  async function validateContractState(
    contract: XAllocationContract,
    expectedVersion: string,
    expectedRoundId: bigint,
    expectedVotes: RoundVotesData,
    expectedUserVotes: RoundUserVotes,
  ) {
    // Verify contract metadata is preserved
    expect(await contract.version()).to.equal(expectedVersion)
    expect(await contract.currentRoundId()).to.equal(expectedRoundId)

    // This ensures no voting data is lost across any upgrade
    for (const [roundId, appVotes] of Object.entries(expectedVotes)) {
      for (const [appId, expectedAmount] of Object.entries(appVotes)) {
        expect(await contract.getAppVotes(parseInt(roundId), appId)).to.equal(expectedAmount)
      }
    }

    // This ensures user participation history is completely preserved
    for (const [roundId, userVotes] of Object.entries(expectedUserVotes)) {
      for (const [userAddress, hasVoted] of Object.entries(userVotes)) {
        expect(await contract.hasVoted(parseInt(roundId), userAddress)).to.equal(hasVoted)
      }
    }
  }

  it("Should preserve all storage data across upgrades V3->V4->V5->V6->V7->V8", async () => {
    const config = createTestConfig()

    const configContracts = await getOrDeployContractInstances({
      forceDeploy: true,
    })

    const {
      otherAccounts,
      x2EarnApps,
      xAllocationPool,
      b3tr,
      vot3,
      galaxyMember,
      timeLock,
      treasury,
      owner,
      creators,
      veBetterPassport,
      minterAccount,
      governor,
    } = configContracts!

    const creator1 = creators[0]
    const creator2 = creators[1]
    const creator3 = creators[2]

    // Configure veBetterPassport for testing (no personhood requirements)
    await veBetterPassport.connect(owner).setThresholdPoPScore(0)
    await veBetterPassport.toggleCheck(4)

    // ========================================
    // DEPLOY: Emissions V1 -> V2 and VoterRewards V1 -> V2
    // ========================================
    const emissionsV1 = (await deployProxy("Emissions", [
      {
        minter: minterAccount.address,
        admin: owner.address,
        upgrader: owner.address,
        contractsAddressManager: owner.address,
        decaySettingsManager: owner.address,
        b3trAddress: await b3tr.getAddress(),
        destinations: [
          await xAllocationPool.getAddress(),
          owner.address,
          await treasury.getAddress(),
          config.MIGRATION_ADDRESS,
        ],
        initialXAppAllocation: config.INITIAL_X_ALLOCATION,
        cycleDuration: config.EMISSIONS_CYCLE_DURATION,
        decaySettings: [
          config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
          config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
          config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
          config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
        ],
        treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
        maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
        migrationAmount: config.MIGRATION_AMOUNT,
      },
    ])) as EmissionsV1

    // Upgrade Emissions to V2
    const emissions = (await upgradeProxy(
      "EmissionsV1",
      "Emissions",
      await emissionsV1.getAddress(),
      [config.EMISSIONS_IS_NOT_ALIGNED ?? false],
      {
        version: 2,
      },
    )) as EmissionsV2

    // Deploy VoterRewards V1
    const voterRewardsV1 = (await deployProxy("VoterRewardsV1", [
      owner.address, // admin
      owner.address, // upgrader
      owner.address, // contractsAddressManager
      await emissions.getAddress(),
      await galaxyMember.getAddress(),
      await b3tr.getAddress(),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      [0, 10, 20, 50, 100, 150, 200, 400, 900, 2400],
    ])) as VoterRewardsV1

    // Upgrade VoterRewards to V2
    const voterRewardsV2 = (await upgradeProxy(
      "VoterRewardsV1",
      "VoterRewards",
      await voterRewardsV1.getAddress(),
      [],
      {
        version: 2,
      },
    )) as VoterRewardsV2

    // Link VoterRewards to Emissions
    await emissions.connect(owner).setVote2EarnAddress(await voterRewardsV2.getAddress())

    // ========================================
    // DEPLOY: XAllocationVoting V1 -> V2 -> V3
    // ========================================
    const xAllocationVotingV3 = (await deployAndUpgrade(
      ["XAllocationVotingV1", "XAllocationVotingV2", "XAllocationVotingV3"],
      [
        [
          {
            vot3Token: await vot3.getAddress(),
            quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE,
            initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1,
            timeLock: await timeLock.getAddress(),
            voterRewards: await voterRewardsV2.getAddress(),
            emissions: await emissions.getAddress(),
            admins: [await timeLock.getAddress(), owner.address],
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            x2EarnAppsAddress: await x2EarnApps.getAddress(),
            baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
            appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
            votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
          },
        ],
        [await veBetterPassport.getAddress()],
        [],
      ],
      {
        versions: [undefined, 2, 3],
      },
    )) as XAllocationVotingV3

    expect(await xAllocationVotingV3.version()).to.equal("3")

    // ========================================
    // CONFIGURE: Link contracts and set roles
    // ========================================
    await emissions.setXAllocationsGovernorAddress(await xAllocationVotingV3.getAddress())
    expect(await emissions.xAllocationsGovernor()).to.eql(await xAllocationVotingV3.getAddress())

    await xAllocationPool.setXAllocationVotingAddress(await xAllocationVotingV3.getAddress())
    expect(await xAllocationPool.xAllocationVoting()).to.eql(await xAllocationVotingV3.getAddress())
    await xAllocationPool.setEmissionsAddress(await emissions.getAddress())
    expect(await xAllocationPool.emissions()).to.eql(await emissions.getAddress())

    // Grant Vote registrar role to XAllocationVoting
    await voterRewardsV2
      .connect(owner)
      .grantRole(await voterRewardsV2.VOTE_REGISTRAR_ROLE(), await xAllocationVotingV3.getAddress())

    // Grant admin role to voter rewards for registering x allocation voting
    await xAllocationVotingV3
      .connect(owner)
      .grantRole(await xAllocationVotingV3.DEFAULT_ADMIN_ROLE(), emissions.getAddress())

    // Set the emissions address and the admin as the ROUND_STARTER_ROLE in XAllocationVoting
    const roundStarterRole = await xAllocationVotingV3.ROUND_STARTER_ROLE()
    await xAllocationVotingV3
      .connect(owner)
      .grantRole(roundStarterRole, await emissions.getAddress())
      .then(async (tx: any) => await tx.wait())
    await xAllocationVotingV3
      .connect(owner)
      .grantRole(roundStarterRole, owner.address)
      .then(async (tx: any) => await tx.wait())

    // ========================================
    // SETUP: Test users, apps, and initial voting round
    // ========================================
    const user1 = otherAccounts[0]
    const user2 = otherAccounts[1]
    const user3 = otherAccounts[2]

    // Fund test users with VOT3 tokens for voting
    await getVot3Tokens(user1, "1000")
    await getVot3Tokens(user2, "1000")
    await getVot3Tokens(user3, "1000")

    // Create and endorse test apps
    const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
    const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
    const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
    await x2EarnApps
      .connect(creator1)
      .submitApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
    await x2EarnApps
      .connect(creator2)
      .submitApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
    await x2EarnApps
      .connect(creator3)
      .submitApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

    await endorseApp(app1Id, otherAccounts[2])
    await endorseApp(app2Id, otherAccounts[3])
    await endorseApp(app3Id, otherAccounts[4])

    // Initialize emissions system
    await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())
    await emissions.connect(minterAccount).bootstrap()

    // ========================================
    // ROUND 1: Initial voting in V3
    // ========================================
    await emissions.connect(minterAccount).start()
    const roundId1 = await xAllocationVotingV3.currentRoundId()
    expect(roundId1).to.equal(1n)

    // Execute initial votes
    await xAllocationVotingV3.connect(user1).castVote(roundId1, [app1Id], [ethers.parseEther("100")])
    await xAllocationVotingV3
      .connect(user2)
      .castVote(roundId1, [app1Id, app2Id], [ethers.parseEther("100"), ethers.parseEther("200")])

    // Validate V3 state before first upgrade
    await validateContractState(
      xAllocationVotingV3,
      "3",
      1n,
      {
        1: { [app1Id]: ethers.parseEther("200"), [app2Id]: ethers.parseEther("200"), [app3Id]: ethers.parseEther("0") },
      },
      { 1: { [user1.address]: true, [user2.address]: true, [user3.address]: false } },
    )

    // ========================================
    // UPGRADE V3 -> V4: First upgrade test
    // ========================================
    const xAllocationVotingV4 = (await upgradeProxy(
      "XAllocationVotingV3",
      "XAllocationVotingV4",
      await xAllocationVotingV3.getAddress(),
      [],
      {
        version: 4,
      },
    )) as XAllocationVotingV4

    // CRITICAL: Validate state preservation after V3->V4 upgrade
    await validateContractState(
      xAllocationVotingV4,
      "4",
      1n,
      {
        1: { [app1Id]: ethers.parseEther("200"), [app2Id]: ethers.parseEther("200"), [app3Id]: ethers.parseEther("0") },
      },
      { 1: { [user1.address]: true, [user2.address]: true, [user3.address]: false } },
    )

    // ========================================
    // UPGRADE V4 -> V5: Continue upgrade chain
    // ========================================
    const xAllocationVotingV5 = (await upgradeProxy(
      "XAllocationVotingV4",
      "XAllocationVotingV5",
      await xAllocationVotingV4.getAddress(),
      [],
      {
        version: 5,
      },
    )) as XAllocationVotingV5

    // CRITICAL: Validate state preservation after V4->V5 upgrade
    await validateContractState(
      xAllocationVotingV5,
      "5",
      1n,
      {
        1: { [app1Id]: ethers.parseEther("200"), [app2Id]: ethers.parseEther("200"), [app3Id]: ethers.parseEther("0") },
      },
      { 1: { [user1.address]: true, [user2.address]: true, [user3.address]: false } },
    )

    expect(await xAllocationVotingV5.state(1n)).to.equal(0n) // Active

    // Test voting functionality still works after upgrade
    await xAllocationVotingV5.connect(user3).castVote(roundId1, [app1Id], [ethers.parseEther("100")])
    expect(await xAllocationVotingV5.getAppVotes(roundId1, app1Id)).to.equal(ethers.parseEther("300"))
    expect(await xAllocationVotingV5.hasVoted(roundId1, user3.address)).to.be.true

    // ========================================
    // ROUND 1 -> ROUND 2: Complete cycle and test rewards
    // ========================================
    const blockNextCycle = await emissions.getNextCycleBlock()
    await waitForBlock(Number(blockNextCycle))
    expect(await emissions.isCycleEnded(1)).to.be.true

    await emissions.distribute()
    const roundId2 = await xAllocationVotingV5.currentRoundId()
    expect(roundId2).to.equal(2n)

    // Verify rewards distribution works correctly
    await expect(xAllocationPool.claim(1, app1Id)).not.to.be.reverted
    await expect(xAllocationPool.claim(1, app2Id)).not.to.be.reverted
    await expect(xAllocationPool.claim(1, app3Id)).not.to.be.reverted

    // ========================================
    // ROUND 2: Execute votes before V5->V6 upgrade
    // ========================================
    await xAllocationVotingV5.connect(user1).castVote(roundId2, [app1Id], [ethers.parseEther("100")])

    // ========================================
    // UPGRADE V5 -> V6: Continue upgrade chain
    // ========================================
    const xAllocationVotingV6 = (await upgradeProxy(
      "XAllocationVotingV5",
      "XAllocationVotingV6",
      await xAllocationVotingV5.getAddress(),
      [],
      {
        version: 6,
      },
    )) as XAllocationVotingV6

    // CRITICAL: Validate state preservation after V5->V6 upgrade (including both rounds)
    await validateContractState(
      xAllocationVotingV6,
      "6",
      roundId2,
      {
        1: { [app1Id]: ethers.parseEther("300"), [app2Id]: ethers.parseEther("200"), [app3Id]: ethers.parseEther("0") },
        2: { [app1Id]: ethers.parseEther("100"), [app2Id]: ethers.parseEther("0"), [app3Id]: ethers.parseEther("0") },
      },
      {
        1: { [user1.address]: true, [user2.address]: true, [user3.address]: true },
        2: { [user1.address]: true, [user2.address]: false, [user3.address]: false },
      },
    )

    expect(await xAllocationVotingV6.state(2n)).to.equal(0n) // Active

    // Test voting functionality still works after V6 upgrade
    await xAllocationVotingV6.connect(user3).castVote(roundId2, [app1Id], [ethers.parseEther("100")])
    expect(await xAllocationVotingV6.getAppVotes(roundId2, app1Id)).to.equal(ethers.parseEther("200"))

    // ========================================
    // ROUND 2 -> ROUND 3: Complete cycle and test rewards
    // ========================================
    await waitForBlock(Number(await emissions.getNextCycleBlock()))
    expect(await emissions.isCycleEnded(roundId2)).to.be.true

    await emissions.distribute()
    const roundId3 = await xAllocationVotingV6.currentRoundId()
    expect(roundId3).to.equal(3n)

    // Verify rewards distribution works correctly
    await expect(xAllocationPool.claim(2, app1Id)).to.not.be.reverted
    await expect(xAllocationPool.claim(2, app2Id)).to.not.be.reverted
    await expect(xAllocationPool.claim(2, app3Id)).to.not.be.reverted

    // ========================================
    // ROUND 3: Execute votes before V6->V7 upgrade
    // ========================================
    await xAllocationVotingV6.connect(user1).castVote(roundId3, [app1Id], [ethers.parseEther("100")])
    await xAllocationVotingV6.connect(user2).castVote(roundId3, [app1Id], [ethers.parseEther("100")])

    // ========================================
    // UPGRADE V6 -> V7: Governance features added
    // ========================================
    const xAllocationVotingV7 = (await upgradeProxy(
      "XAllocationVotingV6",
      "XAllocationVotingV7",
      await xAllocationVotingV6.getAddress(),
      [],
      {
        version: 7,
      },
    )) as XAllocationVotingV7

    // CRITICAL: Grant GOVERNANCE_ROLE to owner and set B3TR Governor in V7
    await xAllocationVotingV7.connect(owner).grantRole(await xAllocationVotingV7.GOVERNANCE_ROLE(), owner.address)
    await xAllocationVotingV7.connect(owner).setB3TRGovernor(await governor.getAddress())

    // CRITICAL: Validate state preservation after V6->V7 upgrade (all 3 rounds)
    await validateContractState(
      xAllocationVotingV7,
      "7",
      roundId3,
      {
        1: { [app1Id]: ethers.parseEther("300"), [app2Id]: ethers.parseEther("200"), [app3Id]: ethers.parseEther("0") },
        2: { [app1Id]: ethers.parseEther("200"), [app2Id]: ethers.parseEther("0"), [app3Id]: ethers.parseEther("0") },
        3: { [app1Id]: ethers.parseEther("200"), [app2Id]: ethers.parseEther("0"), [app3Id]: ethers.parseEther("0") },
      },
      {
        1: { [user1.address]: true, [user2.address]: true, [user3.address]: true },
        2: { [user1.address]: true, [user2.address]: false, [user3.address]: true },
        3: { [user1.address]: true, [user2.address]: true, [user3.address]: false },
      },
    )

    expect(await xAllocationVotingV7.state(3n)).to.equal(0n) // Active

    // ========================================
    // UPGRADE V7 -> V8: Final upgrade with auto-voting features
    // ========================================
    const { AutoVotingLogic } = await autoVotingLibraries()

    const xAllocationVoting = (await upgradeProxy(
      "XAllocationVotingV7",
      "XAllocationVoting",
      await xAllocationVotingV7.getAddress(),
      [],
      {
        version: 8,
        libraries: {
          AutoVotingLogic: await AutoVotingLogic.getAddress(),
        },
      },
    )) as XAllocationVoting

    // CRITICAL: Grant CONTRACTS_ADDRESS_MANAGER_ROLE and set B3TR Governor in V8
    await xAllocationVoting
      .connect(owner)
      .grantRole(await xAllocationVoting.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address)
    await xAllocationVoting.connect(owner).setB3TRGovernor(await governor.getAddress())

    // ========================================
    // FINAL VALIDATION: All historical data preserved in V8
    // ========================================
    await validateContractState(
      xAllocationVoting,
      "8",
      3n,
      {
        1: { [app1Id]: ethers.parseEther("300"), [app2Id]: ethers.parseEther("200"), [app3Id]: ethers.parseEther("0") },
        2: { [app1Id]: ethers.parseEther("200"), [app2Id]: ethers.parseEther("0"), [app3Id]: ethers.parseEther("0") },
        3: { [app1Id]: ethers.parseEther("200"), [app2Id]: ethers.parseEther("0"), [app3Id]: ethers.parseEther("0") },
      },
      {
        1: { [user1.address]: true, [user2.address]: true, [user3.address]: true },
        2: { [user1.address]: true, [user2.address]: false, [user3.address]: true },
        3: { [user1.address]: true, [user2.address]: true, [user3.address]: false },
      },
    )

    // Verify all historical data is still intact after final upgrade
    expect(await xAllocationVoting.getAppVotes(1, app1Id)).to.equal(ethers.parseEther("300"))
    expect(await xAllocationVoting.getAppVotes(2, app1Id)).to.equal(ethers.parseEther("200"))
    expect(await xAllocationVoting.hasVoted(1, user1.address)).to.be.true
    expect(await xAllocationVoting.hasVoted(2, user3.address)).to.be.true

    // ========================================
    // ROUND 3 -> ROUND 4: Test final functionality
    // ========================================
    await waitForBlock(Number(await emissions.getNextCycleBlock()))
    expect(await emissions.isCycleEnded(roundId3)).to.be.true
    expect(await xAllocationVoting.state(roundId3)).to.equal(1n) // NOT ACTIVE
    expect(await xAllocationVoting.votingThreshold()).to.be.greaterThan(0)

    await emissions.distribute()
    const getRoundId4 = await xAllocationVoting.currentRoundId()

    // Test that new votes can still be cast in V8
    await xAllocationVoting.connect(user2).castVote(getRoundId4, [app2Id], [ethers.parseEther("150")])
    expect(await xAllocationVoting.getAppVotes(getRoundId4, app2Id)).to.equal(ethers.parseEther("150"))
    expect(await xAllocationVoting.hasVoted(getRoundId4, user2.address)).to.be.true

    // ========================================
    // FINAL VERIFICATION: Contract addresses and functionality
    // ========================================
    expect(await xAllocationVoting.emissions()).to.equal(await emissions.getAddress())
    expect(await xAllocationVoting.voterRewards()).to.equal(await voterRewardsV2.getAddress())
    expect(await xAllocationVoting.x2EarnApps()).to.equal(await x2EarnApps.getAddress())
  })
})
