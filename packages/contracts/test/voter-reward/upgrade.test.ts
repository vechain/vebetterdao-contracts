const { ethers } = require("hardhat")
import { expect } from "chai"
import { describe, it } from "mocha"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { deployProxy, deployAndUpgrade, upgradeProxy } from "../../scripts/helpers/upgrades"
import { getOrDeployContractInstances, levels, multipliers } from "../helpers/deploy"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import {
  VoterRewardsV1,
  VoterRewardsV2,
  VoterRewardsV3,
  VoterRewardsV4,
  VoterRewardsV5,
  VoterRewards,
  GalaxyMemberV1,
  GalaxyMemberV2,
  GalaxyMember,
  EmissionsV2,
  Emissions,
  XAllocationVoting,
  B3TRGovernorV4,
  B3TRGovernorV5,
  RelayerRewardsPool,
} from "../../typechain-types"
import {
  getVot3Tokens,
  waitForRoundToEnd,
  waitForNextCycle,
  bootstrapAndStartEmissions,
  voteOnApps,
  catchRevert,
  moveBlocks,
  upgradeNFTtoLevel,
  waitForNextBlock,
} from "../helpers"
import { endorseApp } from "../helpers/xnodes"

describe("VoterRewards Upgrade Test - @shard10a", function () {
  let creator1: HardhatEthersSigner

  before(async function () {
    const config = await getOrDeployContractInstances({ forceDeploy: true })
    if (!config) throw new Error("Failed to deploy contracts")
    creator1 = config.creators[0]
  })

  it("Should not have state conflict after upgrading to V3 and V4", async () => {
    const config = createLocalConfig()
    const contractConfig = await getOrDeployContractInstances({
      forceDeploy: true,
    })
    if (!contractConfig) throw new Error("Failed to deploy contracts")

    const {
      otherAccounts,
      otherAccount: voter1,
      owner,
      emissions,
      b3tr,
      timeLock,
      vechainNodesMock,
      nodeManagement,
      vot3,
      treasury,
      x2EarnApps,
      xAllocationPool,
      governorClockLogicLibV1,
      governorConfiguratorLibV1,
      governorDepositLogicLibV1,
      governorFunctionRestrictionsLogicLibV1,
      governorProposalLogicLibV1,
      governorQuorumLogicLibV1,
      governorStateLogicLibV1,
      governorVotesLogicLibV1,
      governorClockLogicLibV3,
      governorConfiguratorLibV3,
      governorDepositLogicLibV3,
      governorFunctionRestrictionsLogicLibV3,
      governorProposalLogicLibV3,
      governorQuorumLogicLibV3,
      governorStateLogicLibV3,
      governorVotesLogicLibV3,
      governorClockLogicLibV4,
      governorConfiguratorLibV4,
      governorDepositLogicLibV4,
      governorFunctionRestrictionsLogicLibV4,
      governorProposalLogicLibV4,
      governorQuorumLogicLibV4,
      governorStateLogicLibV4,
      governorVotesLogicLibV4,
      veBetterPassport,
    } = contractConfig

    const galaxyMemberV1 = (await deployProxy("GalaxyMemberV1", [
      {
        name: "galaxyMember",
        symbol: "GM",
        admin: owner.address,
        upgrader: owner.address,
        pauser: owner.address,
        minter: owner.address,
        contractsAddressManager: owner.address,
        maxLevel: 1,
        baseTokenURI: config.GM_NFT_BASE_URI,
        xNodeMaxMintableLevels: [1, 2, 3, 4, 5, 6, 7],
        b3trToUpgradeToLevel: [1000000n],
        b3tr: await b3tr.getAddress(),
        treasury: await treasury.getAddress(),
      },
    ])) as GalaxyMemberV1

    const voterRewardsV1 = (await deployProxy("VoterRewardsV1", [
      owner.address, // admin
      owner.address, // upgrader
      owner.address, // contractsAddressManager
      await emissions.getAddress(),
      await galaxyMemberV1.getAddress(),
      await b3tr.getAddress(),
      levels,
      multipliers,
    ])) as VoterRewardsV1

    // Deploy XAllocationVoting
    const xAllocationVotingV2 = (await deployAndUpgrade(
      ["XAllocationVotingV1", "XAllocationVotingV2"],
      [
        [
          {
            vot3Token: await vot3.getAddress(),
            quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE, // quorum percentage
            initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1, // X Alloc voting period
            timeLock: await timeLock.getAddress(),
            voterRewards: await voterRewardsV1.getAddress(),
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
      ],
      {
        versions: [undefined, 2],
      },
    )) as XAllocationVoting

    // Deploy Governor
    const governorV4 = (await deployAndUpgrade(
      ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4"],
      [
        [
          {
            vot3Token: await vot3.getAddress(),
            timelock: await timeLock.getAddress(),
            xAllocationVoting: await xAllocationVotingV2.getAddress(),
            b3tr: await b3tr.getAddress(),
            quorumPercentage: config.B3TR_GOVERNOR_QUORUM_PERCENTAGE, // quorum percentage
            initialDepositThreshold: config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD, // deposit threshold
            initialMinVotingDelay: config.B3TR_GOVERNOR_MIN_VOTING_DELAY, // delay before vote starts
            initialVotingThreshold: config.B3TR_GOVERNOR_VOTING_THRESHOLD, // voting threshold
            voterRewards: await voterRewardsV1.getAddress(),
            isFunctionRestrictionEnabled: true,
          },
          {
            governorAdmin: owner.address,
            pauser: owner.address,
            contractsAddressManager: owner.address,
            proposalExecutor: owner.address,
            governorFunctionSettingsRoleAddress: owner.address,
          },
        ],
        [],
        [],
        [await veBetterPassport.getAddress()],
      ],
      {
        versions: [undefined, 2, 3, 4],
        libraries: [
          {
            GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
          },
          {
            GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
          },
          {
            GovernorClockLogicV3: await governorClockLogicLibV3.getAddress(),
            GovernorConfiguratorV3: await governorConfiguratorLibV3.getAddress(),
            GovernorDepositLogicV3: await governorDepositLogicLibV3.getAddress(),
            GovernorFunctionRestrictionsLogicV3: await governorFunctionRestrictionsLogicLibV3.getAddress(),
            GovernorProposalLogicV3: await governorProposalLogicLibV3.getAddress(),
            GovernorQuorumLogicV3: await governorQuorumLogicLibV3.getAddress(),
            GovernorStateLogicV3: await governorStateLogicLibV3.getAddress(),
            GovernorVotesLogicV3: await governorVotesLogicLibV3.getAddress(),
          },
          {
            GovernorClockLogicV4: await governorClockLogicLibV4.getAddress(),
            GovernorConfiguratorV4: await governorConfiguratorLibV4.getAddress(),
            GovernorDepositLogicV4: await governorDepositLogicLibV4.getAddress(),
            GovernorFunctionRestrictionsLogicV4: await governorFunctionRestrictionsLogicLibV4.getAddress(),
            GovernorProposalLogicV4: await governorProposalLogicLibV4.getAddress(),
            GovernorQuorumLogicV4: await governorQuorumLogicLibV4.getAddress(),
            GovernorStateLogicV4: await governorStateLogicLibV4.getAddress(),
            GovernorVotesLogicV4: await governorVotesLogicLibV4.getAddress(),
          },
        ],
      },
    )) as B3TRGovernorV4

    await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVotingV2.getAddress())

    // Grant Vote registrar role to XAllocationVoting
    await voterRewardsV1
      .connect(owner)
      .grantRole(await voterRewardsV1.VOTE_REGISTRAR_ROLE(), await xAllocationVotingV2.getAddress())
    // Grant Vote registrar role to Governor
    await voterRewardsV1
      .connect(owner)
      .grantRole(await voterRewardsV1.VOTE_REGISTRAR_ROLE(), await governorV4.getAddress())

    // Grant admin role to voter rewards for registering x allocation voting
    await xAllocationVotingV2
      .connect(owner)
      .grantRole(await xAllocationVotingV2.DEFAULT_ADMIN_ROLE(), emissions.getAddress())

    // Set xAllocationGovernor in emissions
    await emissions.connect(owner).setXAllocationsGovernorAddress(await xAllocationVotingV2.getAddress())
    await emissions.connect(owner).setVote2EarnAddress(await voterRewardsV1.getAddress())

    // Setup XAllocationPool addresses
    await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVotingV2.getAddress())
    await xAllocationPool.connect(owner).setEmissionsAddress(await emissions.getAddress())

    //Set the emissions address and the admin as the ROUND_STARTER_ROLE in XAllocationVoting
    const roundStarterRole = await xAllocationVotingV2.ROUND_STARTER_ROLE()
    await xAllocationVotingV2
      .connect(owner)
      .grantRole(roundStarterRole, await emissions.getAddress())
      .then(async tx => await tx.wait())
    await xAllocationVotingV2
      .connect(owner)
      .grantRole(roundStarterRole, owner.address)
      .then(async tx => await tx.wait())

    await x2EarnApps
      .connect(owner)
      .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
    const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
    await endorseApp(app1, otherAccounts[0])
    await x2EarnApps
      .connect(creator1)
      .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
    const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
    await endorseApp(app2, otherAccounts[1])
    const voter2 = otherAccounts[3]
    const voter3 = otherAccounts[4]

    await getVot3Tokens(voter1, "1000")
    await getVot3Tokens(voter2, "1000")
    await getVot3Tokens(voter3, "1000")

    // Bootstrap emissions
    await bootstrapAndStartEmissions()

    const roundId = await xAllocationVotingV2.currentRoundId()

    expect(roundId).to.equal(1)

    expect(Number(await xAllocationVotingV2.roundDeadline(roundId))).to.lt(Number(await emissions.getNextCycleBlock()))

    await veBetterPassport.whitelist(voter1.address)
    await veBetterPassport.whitelist(voter2.address)
    await veBetterPassport.whitelist(voter3.address)
    await veBetterPassport.toggleCheck(1)

    await xAllocationVotingV2.connect(voter1).castVote(roundId, [app1], [ethers.parseEther("1000")])
    await xAllocationVotingV2
      .connect(voter2)
      .castVote(roundId, [app1, app2], [ethers.parseEther("200"), ethers.parseEther("100")])
    await xAllocationVotingV2
      .connect(voter3)
      .castVote(roundId, [app1, app2], [ethers.parseEther("500"), ethers.parseEther("500")])

    expect(await emissions.isCycleEnded(1)).to.equal(false)

    await catchRevert(voterRewardsV1.claimReward(1, voter1.address))

    expect(await voterRewardsV1.cycleToVoterToTotal(1, voter1)).to.equal(ethers.parseEther("31.622776601"))

    expect(await voterRewardsV1.cycleToVoterToTotal(1, voter2)).to.equal(ethers.parseEther("17.320508075"))

    await catchRevert(voterRewardsV1.claimReward(1, voter2.address))

    expect(await voterRewardsV1.cycleToVoterToTotal(1, voter3)).to.equal(ethers.parseEther("31.622776601"))

    // Votes should be tracked correctly
    let appVotes = await xAllocationVotingV2.getAppVotes(roundId, app1)
    expect(appVotes).to.eql(ethers.parseEther("1700"))
    appVotes = await xAllocationVotingV2.getAppVotes(roundId, app2)
    expect(appVotes).to.eql(ethers.parseEther("600"))

    let totalVotes = await xAllocationVotingV2.totalVotes(roundId)
    expect(totalVotes).to.eql(ethers.parseEther("2300"))

    // Total voters should be tracked correctly
    let totalVoters = await xAllocationVotingV2.totalVoters(roundId)
    expect(totalVoters).to.eql(BigInt(3))

    // Voter rewards checks
    expect(await voterRewardsV1.cycleToTotal(1)).to.equal(ethers.parseEther("80.566061277")) // Total votes -> Math.sqrt(1000) + Math.sqrt(300) + Math.sqrt(1000)
    expect(await voterRewardsV1.cycleToTotal(1)).to.equal(
      (await voterRewardsV1.cycleToVoterToTotal(1, voter1)) +
        (await voterRewardsV1.cycleToVoterToTotal(1, voter2)) +
        (await voterRewardsV1.cycleToVoterToTotal(1, voter3)),
    ) // Total votes
    let storageSlots = []

    const initialSlot = BigInt("0x114e7ffaaf205d38cd05b17b56f3357806ef2ce889cb4748445ae91cdfc37c00") // Slot 0 of VoterRewards

    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlots.push(await ethers.provider.getStorage(await voterRewardsV1.getAddress(), i))
    }

    storageSlots = storageSlots.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    ) // removing empty slots

    const voterRewardsV2 = (await upgradeProxy(
      "VoterRewardsV1",
      "VoterRewardsV2",
      await voterRewardsV1.getAddress(),
      [],
      {
        version: 2,
      },
    )) as VoterRewardsV2

    let storageSlotsAfter = []

    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlotsAfter.push(await ethers.provider.getStorage(await voterRewardsV2.getAddress(), i))
    }

    // Check if storage slots are the same after upgrade
    for (let i = 0; i < storageSlots.length; i++) {
      expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
    }

    await waitForRoundToEnd(Number(roundId))

    // Votes should be the same after round ended
    appVotes = await xAllocationVotingV2.getAppVotes(roundId, app1)
    expect(appVotes).to.eql(ethers.parseEther("1700"))
    appVotes = await xAllocationVotingV2.getAppVotes(roundId, app2)
    expect(appVotes).to.eql(ethers.parseEther("600"))

    totalVotes = await xAllocationVotingV2.totalVotes(roundId)
    expect(totalVotes).to.eql(ethers.parseEther("2300"))

    await waitForNextCycle()

    expect(await emissions.isCycleDistributed(await emissions.nextCycle())).to.equal(false)
    expect(await emissions.isNextCycleDistributable()).to.equal(true)

    // Reward claiming
    expect(await emissions.isCycleDistributed(1)).to.equal(true)
    expect(await b3tr.balanceOf(await voterRewardsV2.getAddress())).to.equal(await emissions.getVote2EarnAmount(1))

    const voter1Rewards = await voterRewardsV2.getReward(1, voter1.address)
    const voter2Rewards = await voterRewardsV2.getReward(1, voter2.address)
    const voter3Rewards = await voterRewardsV2.getReward(1, voter3.address)

    await voterRewardsV2.connect(voter1).claimReward(1, voter1)

    expect(await b3tr.balanceOf(voter1.address)).to.equal(voter1Rewards)

    expect(await b3tr.balanceOf(await voterRewardsV2.getAddress())).to.equal(
      (await emissions.getVote2EarnAmount(1)) - voter1Rewards,
    )

    // Second round
    await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

    const roundId2 = await xAllocationVotingV2.currentRoundId()

    expect(roundId2).to.equal(2)

    expect(Number(await xAllocationVotingV2.roundDeadline(roundId))).to.lt(Number(await emissions.getNextCycleBlock()))

    await xAllocationVotingV2.connect(voter1).castVote(roundId2, [app2], [ethers.parseEther("1000")])
    await xAllocationVotingV2
      .connect(voter2)
      .castVote(roundId2, [app1, app2], [ethers.parseEther("100"), ethers.parseEther("500")])
    await xAllocationVotingV2
      .connect(voter3)
      .castVote(roundId2, [app1, app2], [ethers.parseEther("500"), ethers.parseEther("500")])

    expect(await emissions.isCycleEnded(2)).to.equal(false)

    await catchRevert(voterRewardsV2.claimReward(2, voter1.address))

    expect(await voterRewardsV2.cycleToVoterToTotal(2, voter1)).to.equal(ethers.parseEther("31.622776601"))

    expect(await voterRewardsV2.cycleToVoterToTotal(2, voter2)).to.equal(ethers.parseEther("24.494897427"))

    await catchRevert(voterRewardsV2.claimReward(2, voter2.address))

    expect(await voterRewardsV2.cycleToVoterToTotal(2, voter3)).to.equal(ethers.parseEther("31.622776601"))

    // Votes should be tracked correctly
    appVotes = await xAllocationVotingV2.getAppVotes(roundId2, app1)
    expect(appVotes).to.eql(ethers.parseEther("600"))
    appVotes = await xAllocationVotingV2.getAppVotes(roundId2, app2)
    expect(appVotes).to.eql(ethers.parseEther("2000"))

    totalVotes = await xAllocationVotingV2.totalVotes(roundId2)
    expect(totalVotes).to.eql(ethers.parseEther("2600"))

    // Total voters should be tracked correctly
    totalVoters = await xAllocationVotingV2.totalVoters(roundId2)
    expect(totalVoters).to.eql(BigInt(3))

    // Voter rewards checks
    expect(await voterRewardsV2.cycleToTotal(2)).to.equal(ethers.parseEther("87.740450629")) // Total votes -> Math.sqrt(1000) + Math.sqrt(300) + Math.sqrt(1000)
    expect(await voterRewardsV2.cycleToTotal(2)).to.equal(
      (await voterRewardsV2.cycleToVoterToTotal(2, voter1)) +
        (await voterRewardsV2.cycleToVoterToTotal(2, voter2)) +
        (await voterRewardsV2.cycleToVoterToTotal(2, voter3)),
    ) // Total votes

    await waitForRoundToEnd(Number(roundId2))

    // Votes should be the same after round ended
    appVotes = await xAllocationVotingV2.getAppVotes(roundId2, app1)
    expect(appVotes).to.eql(ethers.parseEther("600"))
    appVotes = await xAllocationVotingV2.getAppVotes(roundId2, app2)
    expect(appVotes).to.eql(ethers.parseEther("2000"))

    totalVotes = await xAllocationVotingV2.totalVotes(roundId2)
    expect(totalVotes).to.eql(ethers.parseEther("2600"))

    await waitForNextCycle()

    expect(await emissions.isCycleEnded(2)).to.equal(true)

    expect(await emissions.isCycleDistributed(await emissions.nextCycle())).to.equal(false)
    expect(await emissions.isNextCycleDistributable()).to.equal(true)

    // Reward claiming
    expect(await emissions.isCycleDistributed(2)).to.equal(true)
    expect(Number(await b3tr.balanceOf(await voterRewardsV2.getAddress()))).to.gt(
      Number(await emissions.getVote2EarnAmount(2)),
    ) // Voters of round 1 can still claim rewards of round 1 thus the balance of VoterRewards contract should be greater than the emission amount

    const voter1Rewards2 = await voterRewardsV2.getReward(2, voter1.address)
    const voter2Rewards2 = await voterRewardsV2.getReward(2, voter2.address)
    const voter3Rewards2 = await voterRewardsV2.getReward(2, voter3.address)

    await voterRewardsV2.connect(voter1).claimReward(2, voter1)
    await voterRewardsV2.connect(voter2).claimReward(2, voter2)
    await voterRewardsV2.connect(voter3).claimReward(2, voter3)

    expect(await b3tr.balanceOf(voter1.address)).to.equal(voter1Rewards + voter1Rewards2) // Voter 1 claimed also rewards of round 1
    expect(await b3tr.balanceOf(voter2.address)).to.equal(voter2Rewards2)
    expect(await b3tr.balanceOf(voter3.address)).to.equal(voter3Rewards2)

    // Voters of round 1 can still claim rewards of round 1
    await voterRewardsV2.connect(voter2).claimReward(1, voter2)
    await voterRewardsV2.connect(voter3).claimReward(1, voter3)

    expect(await b3tr.balanceOf(voter2.address)).to.equal(voter2Rewards + voter2Rewards2)
    expect(await b3tr.balanceOf(voter3.address)).to.equal(voter3Rewards + voter3Rewards2)

    // Check if storage slots are the same after upgrade
    storageSlots = []

    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlots.push(await ethers.provider.getStorage(await voterRewardsV2.getAddress(), i))
    }

    ;(await upgradeProxy(
      "GalaxyMemberV1",
      "GalaxyMemberV2",
      await galaxyMemberV1.getAddress(),
      [
        await vechainNodesMock.getAddress(),
        await nodeManagement.getAddress(),
        owner.address,
        config.GM_NFT_NODE_TO_FREE_LEVEL,
      ],
      { version: 2 },
    )) as unknown as GalaxyMemberV2

    const voterRewardsV3 = (await upgradeProxy(
      "VoterRewardsV2",
      "VoterRewardsV3",
      await voterRewardsV1.getAddress(),
      [],
      {
        version: 3,
      },
    )) as VoterRewardsV3

    await waitForNextCycle()

    // start round
    await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

    const roundId3 = await xAllocationVotingV2.currentRoundId()

    expect(roundId3).to.equal(3)

    await xAllocationVotingV2
      .connect(voter1)
      .castVote(roundId3, [app1, app2], [ethers.parseEther("0"), ethers.parseEther("1000")])
    await xAllocationVotingV2
      .connect(voter2)
      .castVote(roundId3, [app1, app2], [ethers.parseEther("100"), ethers.parseEther("500")])

    await waitForRoundToEnd(Number(roundId3))

    // Check storage slots after upgrade
    storageSlotsAfter = []

    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlotsAfter.push(await ethers.provider.getStorage(await voterRewardsV3.getAddress(), i))
    }

    // Check if storage slots are the same after upgrade
    for (let i = 0; i < storageSlots.length; i++) {
      expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
    }

    // Upgrade to V4
    await upgradeProxy("GalaxyMemberV2", "GalaxyMember", await galaxyMemberV1.getAddress(), [], {
      version: 3,
    })

    const voterRewardsV4 = (await upgradeProxy(
      "VoterRewardsV3",
      "VoterRewardsV4",
      await voterRewardsV1.getAddress(),
      [],
      {
        version: 3,
      },
    )) as VoterRewards

    let storageSlotsV4 = []
    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlotsV4.push(await ethers.provider.getStorage(await voterRewardsV4.getAddress(), i))
    }

    // Check if storage slots are the same after upgrade
    for (let i = 0; i < storageSlots.length; i++) {
      expect(storageSlotsAfter[i]).to.equal(storageSlotsV4[i])
    }

    await waitForNextCycle()

    // start round
    await emissions.connect(voter1).distribute() // Anyone can distribute the cycle

    const roundId4 = await xAllocationVotingV2.currentRoundId()

    expect(roundId4).to.equal(4)

    await xAllocationVotingV2
      .connect(voter1)
      .castVote(roundId4, [app1, app2], [ethers.parseEther("0"), ethers.parseEther("1000")])
    await xAllocationVotingV2
      .connect(voter2)
      .castVote(roundId4, [app1, app2], [ethers.parseEther("100"), ethers.parseEther("500")])

    // Wait for round to end
    const deadline = await xAllocationVotingV2.roundDeadline(roundId4)
    const currentBlock = await xAllocationVotingV2.clock()
    await moveBlocks(parseInt((deadline - currentBlock + BigInt(1)).toString()))

    await expect(voterRewardsV4.connect(voter1).claimReward(4, voter1)).to.emit(voterRewardsV4, "RewardClaimed")
    await expect(voterRewardsV4.connect(voter2).claimReward(4, voter2)).to.emit(voterRewardsV4, "RewardClaimed")
  })

  it("Should not have state conflict after upgrading to V5 and then to V6", async () => {
    // ========================================
    // INITIAL SETUP AND CONTRACT DEPLOYMENT
    // ========================================
    const config = createLocalConfig()
    const contractConfig = await getOrDeployContractInstances({
      forceDeploy: true,
    })
    if (!contractConfig) throw new Error("Failed to deploy contracts")

    const {
      otherAccounts,
      otherAccount: voter1,
      owner,
      b3tr,
      timeLock,
      nodeManagement,
      vot3,
      treasury,
      x2EarnApps,
      veBetterPassport,
      xAllocationPool,
      governorClockLogicLibV1,
      governorConfiguratorLibV1,
      governorDepositLogicLibV1,
      governorFunctionRestrictionsLogicLibV1,
      governorProposalLogicLibV1,
      governorQuorumLogicLibV1,
      governorStateLogicLibV1,
      governorVotesLogicLibV1,
      governorClockLogicLibV3,
      governorConfiguratorLibV3,
      governorDepositLogicLibV3,
      governorFunctionRestrictionsLogicLibV3,
      governorProposalLogicLibV3,
      governorQuorumLogicLibV3,
      governorStateLogicLibV3,
      governorVotesLogicLibV3,
      governorClockLogicLibV4,
      governorConfiguratorLibV4,
      governorDepositLogicLibV4,
      governorFunctionRestrictionsLogicLibV4,
      governorProposalLogicLibV4,
      governorQuorumLogicLibV4,
      governorStateLogicLibV4,
      governorVotesLogicLibV4,
      governorClockLogicLibV5,
      governorConfiguratorLibV5,
      governorDepositLogicLibV5,
      governorFunctionRestrictionsLogicLibV5,
      governorQuorumLogicLibV5,
      governorStateLogicLibV5,
      governorVotesLogicLibV5,
      governorProposalLogicLibV5,
      governorClockLogicLibV6,
      governorConfiguratorLibV6,
      governorDepositLogicLibV6,
      governorFunctionRestrictionsLogicLibV6,
      governorProposalLogicLibV6,
      governorQuorumLogicLibV6,
      governorStateLogicLibV6,
      governorVotesLogicLibV6,
      governorClockLogicLib,
      governorConfiguratorLib,
      governorDepositLogicLib,
      governorFunctionRestrictionsLogicLib,
      governorProposalLogicLib,
      governorQuorumLogicLib,
      governorStateLogicLib,
      governorVotesLogicLib,
      minterAccount,
    } = contractConfig

    const galaxyMember = (await deployAndUpgrade(
      ["GalaxyMemberV1", "GalaxyMember"],
      [
        [
          {
            name: "galaxyMember",
            symbol: "GM",
            admin: owner.address,
            upgrader: owner.address,
            pauser: owner.address,
            minter: owner.address,
            contractsAddressManager: owner.address,
            maxLevel: 10,
            baseTokenURI: config.GM_NFT_BASE_URI,
            b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
            b3tr: await b3tr.getAddress(),
            treasury: await treasury.getAddress(),
          },
        ],
        [owner.address, await nodeManagement.getAddress(), owner.address, config.GM_NFT_NODE_TO_FREE_LEVEL],
      ],
      { versions: [undefined, 2] },
    )) as unknown as GalaxyMember

    // Deploy Emissions contract
    const emissions = (await deployAndUpgrade(
      ["EmissionsV1", "EmissionsV2"],
      [
        [
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
        ],
        [config.EMISSIONS_IS_NOT_ALIGNED],
      ],
      {
        versions: [undefined, 2],
        logOutput: false,
      },
    )) as EmissionsV2

    // Deploy VoterRewards V4 contract
    const voterRewardsV4 = (await deployAndUpgrade(
      ["VoterRewardsV1", "VoterRewardsV2", "VoterRewardsV3", "VoterRewardsV4"],
      [
        [
          owner.address, // admin
          owner.address, // upgrader
          owner.address, // contractsAddressManager
          await emissions.getAddress(),
          await galaxyMember.getAddress(),
          await b3tr.getAddress(),
          levels,
          multipliers,
        ],
        [],
        [],
        [],
      ],
      {
        versions: [undefined, 2, 3, 4],
      },
    )) as VoterRewardsV4

    await voterRewardsV4.connect(owner).setEmissions(await emissions.getAddress())

    // Deploy XAllocationVoting contract
    const xAllocationVoting = (await deployAndUpgrade(
      [
        "XAllocationVotingV1",
        "XAllocationVotingV2",
        "XAllocationVotingV3",
        "XAllocationVotingV4",
        "XAllocationVotingV5",
      ],
      [
        [
          {
            vot3Token: await vot3.getAddress(),
            quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE, // quorum percentage
            initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1, // X Alloc voting period
            timeLock: await timeLock.getAddress(),
            voterRewards: await voterRewardsV4.getAddress(),
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
        [],
        [],
      ],
      {
        versions: [undefined, 2, 3, 4, 5],
        logOutput: false,
      },
    )) as XAllocationVoting

    // Deploy B3TR Governor V5 contract
    const governor = (await deployAndUpgrade(
      ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4", "B3TRGovernorV5"],
      [
        [
          {
            vot3Token: await vot3.getAddress(),
            timelock: await timeLock.getAddress(),
            xAllocationVoting: await xAllocationVoting.getAddress(),
            b3tr: await b3tr.getAddress(),
            quorumPercentage: config.B3TR_GOVERNOR_QUORUM_PERCENTAGE,
            initialDepositThreshold: config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD,
            initialMinVotingDelay: config.B3TR_GOVERNOR_MIN_VOTING_DELAY,
            initialVotingThreshold: config.B3TR_GOVERNOR_VOTING_THRESHOLD,
            voterRewards: await voterRewardsV4.getAddress(),
            isFunctionRestrictionEnabled: true,
          },
          {
            governorAdmin: owner.address, // admin
            pauser: owner.address, // botSignaler
            contractsAddressManager: owner.address, // upgrader
            proposalExecutor: owner.address, // settingsManager
            governorFunctionSettingsRoleAddress: owner.address, // roleGranter
          },
        ],
        [],
        [],
        [await veBetterPassport.getAddress()],
        [],
      ],
      {
        versions: [undefined, 2, 3, 4, 5],
        libraries: [
          {
            GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
          },
          {
            GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
            GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
            GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
            GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
            GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
            GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
            GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
            GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
          },
          {
            GovernorClockLogicV3: await governorClockLogicLibV3.getAddress(),
            GovernorConfiguratorV3: await governorConfiguratorLibV3.getAddress(),
            GovernorDepositLogicV3: await governorDepositLogicLibV3.getAddress(),
            GovernorFunctionRestrictionsLogicV3: await governorFunctionRestrictionsLogicLibV3.getAddress(),
            GovernorProposalLogicV3: await governorProposalLogicLibV3.getAddress(),
            GovernorQuorumLogicV3: await governorQuorumLogicLibV3.getAddress(),
            GovernorStateLogicV3: await governorStateLogicLibV3.getAddress(),
            GovernorVotesLogicV3: await governorVotesLogicLibV3.getAddress(),
          },
          {
            GovernorClockLogicV4: await governorClockLogicLibV4.getAddress(),
            GovernorConfiguratorV4: await governorConfiguratorLibV4.getAddress(),
            GovernorDepositLogicV4: await governorDepositLogicLibV4.getAddress(),
            GovernorFunctionRestrictionsLogicV4: await governorFunctionRestrictionsLogicLibV4.getAddress(),
            GovernorProposalLogicV4: await governorProposalLogicLibV4.getAddress(),
            GovernorQuorumLogicV4: await governorQuorumLogicLibV4.getAddress(),
            GovernorStateLogicV4: await governorStateLogicLibV4.getAddress(),
            GovernorVotesLogicV4: await governorVotesLogicLibV4.getAddress(),
          },
          {
            GovernorClockLogicV5: await governorClockLogicLibV5.getAddress(),
            GovernorConfiguratorV5: await governorConfiguratorLibV5.getAddress(),
            GovernorDepositLogicV5: await governorDepositLogicLibV5.getAddress(),
            GovernorFunctionRestrictionsLogicV5: await governorFunctionRestrictionsLogicLibV5.getAddress(),
            GovernorProposalLogicV5: await governorProposalLogicLibV5.getAddress(),
            GovernorQuorumLogicV5: await governorQuorumLogicLibV5.getAddress(),
            GovernorStateLogicV5: await governorStateLogicLibV5.getAddress(),
            GovernorVotesLogicV5: await governorVotesLogicLibV5.getAddress(),
          },
        ],
      },
    )) as B3TRGovernorV5

    // ========================================
    // SETUP ROLES AND PERMISSIONS
    // ========================================
    await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())

    // Grant Vote registrar role to XAllocationVoting
    await voterRewardsV4
      .connect(owner)
      .grantRole(await voterRewardsV4.VOTE_REGISTRAR_ROLE(), await xAllocationVoting.getAddress())
    // Grant Vote registrar role to Governor
    await voterRewardsV4
      .connect(owner)
      .grantRole(await voterRewardsV4.VOTE_REGISTRAR_ROLE(), await governor.getAddress())

    // Grant admin role to voter rewards for registering x allocation voting
    await xAllocationVoting
      .connect(owner)
      .grantRole(await xAllocationVoting.DEFAULT_ADMIN_ROLE(), emissions.getAddress())

    // Set xAllocationGovernor in emissions
    await emissions.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
    await emissions.connect(owner).setVote2EarnAddress(await voterRewardsV4.getAddress())

    // Setup XAllocationPool addresses
    await xAllocationPool.connect(owner).setXAllocationVotingAddress(await xAllocationVoting.getAddress())
    await xAllocationPool.connect(owner).setEmissionsAddress(await emissions.getAddress())

    await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

    //Set the emissions address and the admin as the ROUND_STARTER_ROLE in XAllocationVoting
    const roundStarterRole = await xAllocationVoting.ROUND_STARTER_ROLE()
    await xAllocationVoting
      .connect(owner)
      .grantRole(roundStarterRole, await emissions.getAddress())
      .then(async tx => await tx.wait())
    await xAllocationVoting
      .connect(owner)
      .grantRole(roundStarterRole, owner.address)
      .then(async tx => await tx.wait())

    await galaxyMember.connect(owner).setB3trGovernorAddress(await governor.getAddress())
    await galaxyMember.connect(owner).setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())

    // ========================================
    // SETUP APPS AND VOTERS
    // ========================================
    await x2EarnApps
      .connect(owner)
      .submitApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
    const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
    await endorseApp(app1, otherAccounts[0])
    await x2EarnApps
      .connect(creator1)
      .submitApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
    const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
    await endorseApp(app2, otherAccounts[1])
    const voter2 = otherAccounts[3]
    const voter3 = otherAccounts[4]

    await getVot3Tokens(voter1, "1000")
    await getVot3Tokens(voter2, "1000")
    await getVot3Tokens(voter3, "1000")

    await veBetterPassport.whitelist(voter1.address)
    await veBetterPassport.whitelist(voter2.address)
    await veBetterPassport.whitelist(voter3.address)
    await veBetterPassport.toggleCheck(1)

    // ========================================
    // START EMISSIONS AND FIRST ROUND
    // ========================================
    // Bootstrap emissions
    await emissions.connect(minterAccount).bootstrap()

    await emissions.connect(minterAccount).start()

    const roundId = await xAllocationVoting.currentRoundId()

    expect(roundId).to.equal(1)

    expect(await xAllocationVoting.roundDeadline(roundId)).to.lt(await emissions.getNextCycleBlock())

    // ========================================
    // ROUND 1: VOTING (PRE-UPGRADE)
    // ========================================
    // Vote on apps for the first round
    await voteOnApps(
      [app1, app2],
      [voter1, voter2, voter3],
      [
        [ethers.parseEther("1000"), ethers.parseEther("0")], // Voter 1 votes 1000 for app1
        [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
        [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
      ],
      roundId, // First round
      xAllocationVoting,
      veBetterPassport,
    )

    // Track Round 1 rewards before claiming
    const round1Voter1Reward = await voterRewardsV4.getReward(1, voter1.address)
    const round1Voter2Reward = await voterRewardsV4.getReward(1, voter2.address)
    const round1Voter3Reward = await voterRewardsV4.getReward(1, voter3.address)

    // Rewards to be claimed are the same for all voters:
    expect(await voterRewardsV4.getReward(1, voter1.address)).to.equal(666666666666666666666666n)
    expect(await voterRewardsV4.getReward(1, voter2.address)).to.equal(666666666666666666666666n)
    expect(await voterRewardsV4.getReward(1, voter3.address)).to.equal(666666666666666666666666n)

    await waitForRoundToEnd(Number(roundId), xAllocationVoting)

    await waitForNextCycle(emissions)

    // Claim Round 1 rewards - verify basic functionality works
    await expect(voterRewardsV4.connect(voter1).claimReward(1, voter1.address))
      .to.emit(voterRewardsV4, "RewardClaimed")
      .withArgs(1, voter1.address, 666666666666666666666666n)

    await expect(voterRewardsV4.connect(voter2).claimReward(1, voter2.address))
      .to.emit(voterRewardsV4, "RewardClaimed")
      .withArgs(1, voter2.address, 666666666666666666666666n)

    await expect(voterRewardsV4.connect(voter3).claimReward(1, voter3.address))
      .to.emit(voterRewardsV4, "RewardClaimed")
      .withArgs(1, voter3.address, 666666666666666666666666n)

    // ========================================
    // SETUP GM NFTS FOR MULTIPLIERS
    // ========================================
    // GM NFT token mint and upgrade
    await galaxyMember.connect(voter1).freeMint()

    await upgradeNFTtoLevel(1, 5, galaxyMember, b3tr, voter1, minterAccount) // Upgrading to level 5

    expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter1.address))).to.equal(5)

    await galaxyMember.connect(voter2).freeMint()

    await upgradeNFTtoLevel(2, 10, galaxyMember, b3tr, voter2, minterAccount) // Upgrading to level 10

    expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter2.address))).to.equal(10)

    await galaxyMember.connect(voter3).freeMint()
    await upgradeNFTtoLevel(3, 2, galaxyMember, b3tr, voter3, minterAccount) // Upgrading to level 2

    expect(await galaxyMember.levelOf(await galaxyMember.getSelectedTokenId(voter3.address))).to.equal(2)

    // ========================================
    // ROUND 2: VOTING (BEFORE V5 UPGRADE)
    // ========================================
    await emissions.connect(voter1).distribute() // Anyone can distribute the cycle
    const roundId2 = await xAllocationVoting.currentRoundId()

    expect(roundId2).to.equal(2)
    expect(await xAllocationVoting.roundDeadline(roundId2)).to.lt(await emissions.getNextCycleBlock())

    await waitForNextBlock()

    // ========================================
    // STORAGE VERIFICATION BEFORE V5 UPGRADE
    // ========================================
    let storageSlots = []

    const initialSlot = BigInt("0x114e7ffaaf205d38cd05b17b56f3357806ef2ce889cb4748445ae91cdfc37c00") // Slot 0 of VoterRewards

    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlots.push(await ethers.provider.getStorage(await voterRewardsV4.getAddress(), i))
    }

    storageSlots = storageSlots.filter(
      slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    ) // removing empty slots

    // ========================================
    // UPGRADE TO V5 (GM POOL SUPPORT)
    // ========================================
    // Upgrade Emissions and Voter Rewards to support GM Pool
    const emissionsLatest = (await upgradeProxy(
      "EmissionsV2",
      "Emissions",
      await emissions.getAddress(),
      [config.GM_PERCENTAGE_OF_TREASURY],
      {
        version: 3,
      },
    )) as unknown as Emissions

    const voterRewardsV5 = (await upgradeProxy(
      "VoterRewardsV4",
      "VoterRewardsV5",
      await voterRewardsV4.getAddress(),
      [config.VOTER_REWARDS_LEVELS_V2, config.GM_MULTIPLIERS_V2],
      {
        version: 5,
      },
    )) as VoterRewardsV5

    // Upgrade contracts that use interfaces
    await upgradeProxy("XAllocationVotingV5", "XAllocationVotingV6", await xAllocationVoting.getAddress(), [], {
      version: 6,
    })

    await upgradeProxy("XAllocationPoolV5", "XAllocationPool", await xAllocationPool.getAddress(), [], {
      version: 6,
    })

    await upgradeProxy("B3TRGovernorV5", "B3TRGovernorV6", await governor.getAddress(), [], {
      version: 6,
      libraries: {
        GovernorClockLogicV6: await governorClockLogicLibV6.getAddress(),
        GovernorConfiguratorV6: await governorConfiguratorLibV6.getAddress(),
        GovernorDepositLogicV6: await governorDepositLogicLibV6.getAddress(),
        GovernorFunctionRestrictionsLogicV6: await governorFunctionRestrictionsLogicLibV6.getAddress(),
        GovernorProposalLogicV6: await governorProposalLogicLibV6.getAddress(),
        GovernorQuorumLogicV6: await governorQuorumLogicLibV6.getAddress(),
        GovernorStateLogicV6: await governorStateLogicLibV6.getAddress(),
        GovernorVotesLogicV6: await governorVotesLogicLibV6.getAddress(),
      },
    })

    let storageSlotsAfter = []

    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      storageSlotsAfter.push(await ethers.provider.getStorage(await voterRewardsV5.getAddress(), i))
    }

    // Check if storage slots are the same after upgrade
    for (let i = 0; i < storageSlots.length; i++) {
      expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
    }

    expect(await voterRewardsV5.version()).to.equal("5")

    // ========================================
    // ROUND 2: VOTING (AFTER V5 UPGRADE)
    // ========================================
    // Vote on apps for the second round
    await voteOnApps(
      [app1, app2],
      [voter1, voter2, voter3],
      [
        [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
        [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
        [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
      ],
      roundId2, // Second round
      xAllocationVoting,
      veBetterPassport,
    )

    // Track Round 2 rewards before claiming
    const round2Voter1Reward = await voterRewardsV5.getReward(2, voter1.address)
    const round2Voter2Reward = await voterRewardsV5.getReward(2, voter2.address)
    const round2Voter3Reward = await voterRewardsV5.getReward(2, voter3.address)
    const round2Voter1GMReward = await voterRewardsV5.getGMReward(2, voter1.address)
    const round2Voter2GMReward = await voterRewardsV5.getGMReward(2, voter2.address)
    const round2Voter3GMReward = await voterRewardsV5.getGMReward(2, voter3.address)

    //------ Should still be using original GM reward formula for the round when upgrade happens ------//

    /*
        voter 1 = 31.62 reward weighted votes * 100% multiplier = 63.24 reward weighted power
        voter 2 = 31.62 reward weighted votes * 25x multiplier = 790.57 reward weighted power
        voter 3 = 31.62 reward weighted votes * 10% multiplier = 34.78 reward weighted power

        Total power = 888.60
        voter 1 allocation = 63.24 / 888.60 * 100 = 7.11%
        voter 2 allocation = 790.57 / 888.60 * 100 = 88.96%
        voter 3 allocation = 34.78 / 888.60 * 100 = 3.91%
      */
    expect(await voterRewardsV5.cycleToTotal(2)).to.equal(ethers.parseEther("888.6000224881")) // Total reward weighted votes
    expect(await voterRewardsV5.cycleToVoterToTotal(2, voter1)).to.equal(ethers.parseEther("63.245553202")) // Voter 1 reward weighted votes
    expect(await voterRewardsV5.cycleToVoterToTotal(2, voter2)).to.equal(ethers.parseEther("790.569415025")) // Voter 2 reward weighted votes
    expect(await voterRewardsV5.cycleToVoterToTotal(2, voter3)).to.equal(ethers.parseEther("34.7850542611")) // Voter 3 reward weighted votes

    /*
        voter 1 = 31.62 reward weighted votes * 100% multiplier = 63.24 reward weighted power
        voter 2 = 31.62 reward weighted votes * 25x multiplier = 790.57 reward weighted power
        voter 3 = 31.62 reward weighted votes * 10% multiplier = 34.78 reward weighted power

        Total power = 888.60
        voter 1 allocation = 63.24 / 888.60 * 100 = 7.11%
        voter 2 allocation = 790.57 / 888.60 * 100 = 88.96%
        voter 3 allocation = 34.78 / 888.60 * 100 = 3.91%
      */
    expect(await voterRewardsV5.getReward(2, voter1.address)).to.equal(142348754448398576512455n) // 7.11%
    expect(await voterRewardsV5.getReward(2, voter2.address)).to.equal(1779359430604982206405693n) // 88.96%
    expect(await voterRewardsV5.getReward(2, voter3.address)).to.equal(78291814946619217081850n) // 3.91%

    // Get GM rewards should be 0
    expect(await voterRewardsV5.getGMReward(2, voter1.address)).to.equal(0n)
    expect(await voterRewardsV5.getGMReward(2, voter2.address)).to.equal(0n)
    expect(await voterRewardsV5.getGMReward(2, voter3.address)).to.equal(0n)

    // GM pool is 0 for round 2
    expect(await emissionsLatest.getGMAmount(2)).to.equal(0n)

    // wait for next cycle
    await waitForNextCycle(emissionsLatest)

    // Distribute emissions
    await emissionsLatest.connect(minterAccount).distribute()

    // GM pool should have 25% of the treasury
    expect(await emissionsLatest.getGMAmount(3)).to.equal(ethers.parseEther("250000"))

    // Claim Round 2 rewards - verify V5 functionality works
    await expect(voterRewardsV5.connect(voter1).claimReward(2, voter1.address))
      .to.emit(voterRewardsV5, "RewardClaimedV2")
      .withArgs(2, voter1.address, 142348754448398576512455n, 0n)

    await expect(voterRewardsV5.connect(voter2).claimReward(2, voter2.address))
      .to.emit(voterRewardsV5, "RewardClaimedV2")
      .withArgs(2, voter2.address, 1779359430604982206405693n, 0n)

    await expect(voterRewardsV5.connect(voter3).claimReward(2, voter3.address))
      .to.emit(voterRewardsV5, "RewardClaimedV2")
      .withArgs(2, voter3.address, 78291814946619217081850n, 0n)

    // ========================================
    // ROUND 3: VOTING (V5 WITH GM POOL)
    // ========================================
    const roundId3 = await xAllocationVoting.currentRoundId()

    // Vote on apps for the third round
    await voteOnApps(
      [app1, app2],
      [voter1, voter2, voter3],
      [
        [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
        [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
        [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
      ],
      roundId3, // Third round
      xAllocationVoting,
      veBetterPassport,
    )

    // Track Round 3 rewards before claiming
    const round3Voter1Reward = await voterRewardsV5.getReward(3, voter1.address)
    const round3Voter2Reward = await voterRewardsV5.getReward(3, voter2.address)
    const round3Voter3Reward = await voterRewardsV5.getReward(3, voter3.address)
    const round3Voter1GMReward = await voterRewardsV5.getGMReward(3, voter1.address)
    const round3Voter2GMReward = await voterRewardsV5.getGMReward(3, voter2.address)
    const round3Voter3GMReward = await voterRewardsV5.getGMReward(3, voter3.address)

    // Total votes will no longer be effected by GM as that comes from standalone pool
    expect(await voterRewardsV5.cycleToTotal(3)).to.equal(ethers.parseEther("94.868329803")) // Total weighted votes (31.62 * 3)
    expect(await voterRewardsV5.cycleToVoterToTotal(3, voter1)).to.equal(ethers.parseEther("31.622776601")) // Voter 1 weighted vote
    expect(await voterRewardsV5.cycleToVoterToTotal(3, voter2)).to.equal(ethers.parseEther("31.622776601")) // Voter 2 weighted vote
    expect(await voterRewardsV5.cycleToVoterToTotal(3, voter3)).to.equal(ethers.parseEther("31.622776601")) // Voter 3 weighted vote

    // Total GM weight should be 2810
    /**
     *  voter 1 has level 5 GM NFT -> 2x multiplier (200)
     *  voter 2 has level 10 GM NFT -> 25x multiplier (2500)
     *  voter 3 has level 2 GM NFT -> 1.1x multiplier (110)
     *
     *  total = 200 + 2500 + 110 = 2810
     */
    expect(await voterRewardsV5.cycleToTotalGMWeight(3)).to.equal(2810n)
    expect(await voterRewardsV5.cycleToVoterToGMWeight(3, voter1)).to.equal(200n)
    expect(await voterRewardsV5.cycleToVoterToGMWeight(3, voter2)).to.equal(2500n)
    expect(await voterRewardsV5.cycleToVoterToGMWeight(3, voter3)).to.equal(110n)

    /**
     * There is 250000 in the GM pool for round 3
     *
     *  Rewards distribution should be:
     *  voter 1 = 200 / 2810 * 250000 = 17793.59 B3TR
     *  voter 2 = 2500 / 2810 * 250000 = 222419.92 B3TR
     *  voter 3 = 110 / 2810 * 250000 = 9786.45 B3TR
     */
    expect(await voterRewardsV5.getGMReward(3, voter1.address)).to.equal(ethers.parseEther("17793.594306049822064056"))
    expect(await voterRewardsV5.getGMReward(3, voter2.address)).to.equal(ethers.parseEther("222419.928825622775800711"))
    expect(await voterRewardsV5.getGMReward(3, voter3.address)).to.equal(ethers.parseEther("9786.476868327402135231"))

    /**
     *
     * There is 2000000 in the generic pool for round 3
     *
     *  Rewards distribution should no longer be affected by GM as that comes from standalone pool
     *
     *  Cycle to total = 94.868329803
     *  voter 1 = 31.62 / 94.868329803 * 2000000 = 666666.66 B3TR
     *  voter 2 = 31.62 / 94.868329803 * 2000000 = 666666.66 B3TR
     *  voter 3 = 31.62 / 94.868329803 * 2000000 = 666666.66 B3TR
     */
    expect(await voterRewardsV5.cycleToTotal(3)).to.equal(ethers.parseEther("94.868329803")) // Total weighted votes (31.62 * 3)
    expect(await voterRewardsV5.cycleToVoterToTotal(3, voter1)).to.equal(ethers.parseEther("31.622776601")) // Voter 1 weighted vote
    expect(await voterRewardsV5.cycleToVoterToTotal(3, voter2)).to.equal(ethers.parseEther("31.622776601")) // Voter 2 weighted vote
    expect(await voterRewardsV5.cycleToVoterToTotal(3, voter3)).to.equal(ethers.parseEther("31.622776601")) // Voter 3 weighted vote

    // Wait for next cycle
    await waitForNextCycle(emissionsLatest)

    // Distribute emissions
    await emissionsLatest.connect(minterAccount).distribute()

    // Claim Round 3 rewards - verify GM rewards functionality works
    await expect(voterRewardsV5.connect(voter1).claimReward(3, voter1.address))
      .to.emit(voterRewardsV5, "RewardClaimedV2")
      .withArgs(3, voter1.address, 666666666666666666666666n, 17793594306049822064056n)

    await expect(voterRewardsV5.connect(voter2).claimReward(3, voter2.address))
      .to.emit(voterRewardsV5, "RewardClaimedV2")
      .withArgs(3, voter2.address, 666666666666666666666666n, 222419928825622775800711n)

    await expect(voterRewardsV5.connect(voter3).claimReward(3, voter3.address))
      .to.emit(voterRewardsV5, "RewardClaimedV2")
      .withArgs(3, voter3.address, 666666666666666666666666n, 9786476868327402135231n)

    // ========================================
    // ROUND 4: GM MULTIPLIER UPDATES
    // ========================================
    // Can update GM multipliers, but it wont take effect until next cycle
    await voterRewardsV5.setLevelToMultiplier(2, 1000)
    await voterRewardsV5.setLevelToMultiplier(5, 2000)

    // Multiplier is set to latest update to level
    await expect(voterRewardsV5.setLevelToMultiplier(2, 50))
      .to.emit(voterRewardsV5, "LevelToMultiplierPending")
      .withArgs(2, 50)

    const roundId4 = await xAllocationVoting.currentRoundId()

    // Vote on apps for the fourth round
    await voteOnApps(
      [app1, app2],
      [voter1, voter2, voter3],
      [
        [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
        [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
        [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
      ],
      roundId4, // Fourth round
      xAllocationVoting,
      veBetterPassport,
    )

    // cycle to GM total should be same as before
    expect(await voterRewardsV5.cycleToTotalGMWeight(4)).to.equal(2810n)
    expect(await voterRewardsV5.cycleToVoterToGMWeight(4, voter1)).to.equal(200n)
    expect(await voterRewardsV5.cycleToVoterToGMWeight(4, voter2)).to.equal(2500n)
    expect(await voterRewardsV5.cycleToVoterToGMWeight(4, voter3)).to.equal(110n)

    await waitForNextCycle(emissionsLatest)
    await emissionsLatest.connect(minterAccount).distribute()

    // ========================================
    // ROUND 5: UPDATED GM MULTIPLIERS
    // ========================================
    // GM Multiplier should be updated as of this cycle
    const roundId5 = await xAllocationVoting.currentRoundId()

    await voteOnApps(
      [app1, app2],
      [voter1, voter2, voter3],
      [
        [ethers.parseEther("0"), ethers.parseEther("1000")], // Voter 1 votes 1000 for app2
        [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 2 votes 500 for app1 and 500 for app2
        [ethers.parseEther("500"), ethers.parseEther("500")], // Voter 3 votes 500 for app1 and 500 for app2
      ],
      roundId5, // Fifth round
      xAllocationVoting,
      veBetterPassport,
    )

    expect(await voterRewardsV5.cycleToVoterToGMWeight(5, voter1)).to.equal(2000n)
    expect(await voterRewardsV5.cycleToVoterToGMWeight(5, voter2)).to.equal(2500n)
    expect(await voterRewardsV5.cycleToVoterToGMWeight(5, voter3)).to.equal(50n)

    // ========================================
    // UPGRADE TO V6 (RELAYER FEES)
    // ========================================
    // Continue with V6 upgrade and relayer fee functionality testing

    // Deploy RelayerRewardsPool
    const relayerRewardsPool = (await deployProxy("RelayerRewardsPool", [
      owner.address,
      owner.address,
      await b3tr.getAddress(),
      await emissionsLatest.getAddress(),
      await xAllocationVoting.getAddress(),
    ])) as RelayerRewardsPool

    // Store V5 storage state before V6 upgrade
    const initialSlotV6 = BigInt("0x114e7ffaaf205d38cd05b17b56f3357806ef2ce889cb4748445ae91cdfc37c00")
    let storageSlotsV5 = []
    for (let i = initialSlotV6; i < initialSlotV6 + BigInt(20); i++) {
      storageSlotsV5.push(await ethers.provider.getStorage(await voterRewardsV5.getAddress(), i))
    }

    // Upgrade from V5 to V6 (will be updated after XAllocationVoting upgrade)
    const voterRewardsV6 = (await upgradeProxy(
      "VoterRewardsV5",
      "VoterRewards",
      await voterRewardsV5.getAddress(),
      [await xAllocationVoting.getAddress(), await relayerRewardsPool.getAddress()],
      {
        version: 6,
      },
    )) as VoterRewards

    // Verify storage compatibility after V6 upgrade
    let storageSlotsV6 = []
    for (let i = initialSlotV6; i < initialSlotV6 + BigInt(20); i++) {
      storageSlotsV6.push(await ethers.provider.getStorage(await voterRewardsV6.getAddress(), i))
    }
    for (let i = 0; i < storageSlotsV5.length; i++) {
      if (storageSlotsV5[i] !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        expect(storageSlotsV5[i]).to.equal(storageSlotsV6[i], `V6 upgrade: Storage slot ${i} should be preserved`)
      }
    }

    // Verify V6 initialization
    expect(await voterRewardsV6.version()).to.equal("6")
    expect(await voterRewardsV6.relayerRewardsPool()).to.equal(await relayerRewardsPool.getAddress())

    // Test V6 relayer fee functionality with real voting round
    const relayer1 = otherAccounts[5]

    // Register relayer in RelayerRewardsPool
    await relayerRewardsPool.connect(owner).registerRelayer(relayer1.address)

    // CRITICAL: Update emissions to distribute rewards to our upgraded VoterRewards V6
    await emissionsLatest.connect(owner).setVote2EarnAddress(await voterRewardsV6.getAddress())

    await upgradeProxy("B3TRGovernorV6", "B3TRGovernor", await governor.getAddress(), [], {
      version: 7,
      libraries: {
        GovernorClockLogic: await governorClockLogicLib.getAddress(),
        GovernorConfigurator: await governorConfiguratorLib.getAddress(),
        GovernorDepositLogic: await governorDepositLogicLib.getAddress(),
        GovernorFunctionRestrictionsLogic: await governorFunctionRestrictionsLogicLib.getAddress(),
        GovernorProposalLogic: await governorProposalLogicLib.getAddress(),
        GovernorQuorumLogic: await governorQuorumLogicLib.getAddress(),
        GovernorStateLogic: await governorStateLogicLib.getAddress(),
        GovernorVotesLogic: await governorVotesLogicLib.getAddress(),
      },
    })

    // Deploy AutoVotingLogic library
    const AutoVotingLogic = await ethers.deployContract("AutoVotingLogic")
    await AutoVotingLogic.waitForDeployment()

    // Upgrade XAllocationVoting to V8 (latest with auto-voting support)
    const xAllocationVotingV8 = (await upgradeProxy(
      "XAllocationVotingV6",
      "XAllocationVoting",
      await xAllocationVoting.getAddress(),
      [],
      {
        version: 8,
        libraries: { AutoVotingLogic: await AutoVotingLogic.getAddress() },
      },
    )) as XAllocationVoting

    await xAllocationVotingV8
      .connect(owner)
      .grantRole(await xAllocationVotingV8.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address)
    await xAllocationVotingV8.connect(owner).setB3TRGovernor(await governor.getAddress())
    await xAllocationVotingV8.connect(owner).setRelayerRewardsPoolAddress(await relayerRewardsPool.getAddress())
    await relayerRewardsPool
      .connect(owner)
      .grantRole(await relayerRewardsPool.POOL_ADMIN_ROLE(), await xAllocationVotingV8.getAddress())

    console.log("Upgraded XAllocationVoting to version:", await xAllocationVotingV8.version())

    // Update VoterRewards V6 to use the upgraded XAllocationVoting
    await voterRewardsV6.connect(owner).setXAllocationVoting(await xAllocationVotingV8.getAddress())

    // Grant VOTE_REGISTRAR_ROLE to the upgraded XAllocationVoting
    await voterRewardsV6
      .connect(owner)
      .grantRole(await voterRewardsV6.VOTE_REGISTRAR_ROLE(), await xAllocationVotingV8.getAddress())

    // Enable auto-voting for voter1
    await xAllocationVotingV8.connect(voter1).setUserVotingPreferences([app1])
    await xAllocationVotingV8.connect(voter1).toggleAutoVoting(voter1.address)

    // ========================================
    // ROUND 6: V6 TESTING WITH RELAYER FEES
    // ========================================

    // Start new round for V6 testing
    await waitForNextCycle(emissionsLatest)
    await emissionsLatest.connect(minterAccount).distribute()
    const roundIdV6 = await xAllocationVotingV8.currentRoundId()

    // Cast votes: voter1 via relayer (auto-voting), voter2 manually
    await xAllocationVotingV8.connect(relayer1).castVoteOnBehalfOf(voter1.address, roundIdV6)
    await xAllocationVotingV8.connect(voter2).castVote(roundIdV6, [app1], [ethers.parseEther("1000")])

    // Wait for next cycle and distribute to make rewards available
    await waitForNextCycle(emissionsLatest)
    await emissionsLatest.connect(minterAccount).distribute()

    // Test V6 reward calculations and track rewards
    const voter1Reward = await voterRewardsV6.getReward(roundIdV6, voter1.address)
    const voter1GMReward = await voterRewardsV6.getGMReward(roundIdV6, voter1.address)
    const voter1Fee = await voterRewardsV6.getRelayerFee(roundIdV6, voter1.address)

    const voter2Reward = await voterRewardsV6.getReward(roundIdV6, voter2.address)
    const voter2Fee = await voterRewardsV6.getRelayerFee(roundIdV6, voter2.address)

    // Verify V6 rewards are calculated correctly
    expect(voter1Reward).to.be.gt(0, "V6: Auto-voting user should have rewards")
    expect(voter2Reward).to.be.gt(0, "V6: Manual voting user should have rewards")

    // Verify V6 fee logic: auto-voting user has fees, manual voting user doesn't
    expect(voter1Fee).to.be.gt(0, "V6: Auto-voting user should have relayer fee")
    expect(voter2Fee).to.equal(0, "V6: Manual voting user should have zero fee")

    // Verify V6 fee calculation matches RelayerRewardsPool
    const rawTotalReward1 = voter1Reward + voter1GMReward + voter1Fee
    const expectedFee1 = await relayerRewardsPool.calculateRelayerFee(rawTotalReward1)
    expect(voter1Fee).to.equal(expectedFee1, "V6: Fee should match RelayerRewardsPool calculation")

    // Verify V6 fee cap logic
    const feePercentage = await relayerRewardsPool.getRelayerFeePercentage()
    const feeDenominator = await relayerRewardsPool.getRelayerFeeDenominator()
    const feeCap = await relayerRewardsPool.getFeeCap()
    const calculatedFee = (rawTotalReward1 * feePercentage) / feeDenominator
    const actualFee = calculatedFee > feeCap ? feeCap : calculatedFee
    expect(voter1Fee).to.equal(actualFee, "V6: Fee should respect cap")

    // ========================================
    // FINAL STATE INTEGRITY VERIFICATION
    // ========================================

    // Verify V6 contract is functional and state is intact
    expect(await voterRewardsV6.version()).to.equal("6", "V6 contract should report correct version")

    // Verify V6 fee logic works correctly (core V6 functionality)
    expect(voter1Fee).to.be.gt(0, "V6: Auto-voting user should have relayer fees")
    expect(voter2Fee).to.equal(0, "V6: Manual voting user should have zero fees")

    // Verify V6 rewards are calculated correctly
    expect(voter1Reward).to.be.gt(0, "V6: Auto-voting user should have rewards")
    expect(voter2Reward).to.be.gt(0, "V6: Manual voting user should have rewards")

    // Verify historical data is still accessible (state preservation check)
    expect(await voterRewardsV6.getReward(1, voter1.address)).to.equal(0, "Round 1 rewards should be claimed (zero)")
    expect(await voterRewardsV6.getReward(2, voter1.address)).to.equal(0, "Round 2 rewards should be claimed (zero)")
    expect(await voterRewardsV6.getReward(3, voter1.address)).to.equal(0, "Round 3 rewards should be claimed (zero)")

    // Verify contract can still query historical GM data
    expect(await voterRewardsV6.getGMReward(3, voter1.address)).to.equal(
      0,
      "Round 3 GM rewards should be claimed (zero)",
    )
    expect(await voterRewardsV6.getGMReward(3, voter2.address)).to.equal(
      0,
      "Round 3 GM rewards should be claimed (zero)",
    )
    expect(await voterRewardsV6.getGMReward(3, voter3.address)).to.equal(
      0,
      "Round 3 GM rewards should be claimed (zero)",
    )

    // Verify historical cycle data is still accessible (proves state preservation works functionally)
    expect(await voterRewardsV6.cycleToTotal(1)).to.be.gt(0, "Round 1 cycle total should be preserved")
    expect(await voterRewardsV6.cycleToTotal(2)).to.be.gt(0, "Round 2 cycle total should be preserved")
    expect(await voterRewardsV6.cycleToTotal(3)).to.be.gt(0, "Round 3 cycle total should be preserved")

    // Verify specific historical values are preserved
    expect(await voterRewardsV6.cycleToTotalGMWeight(3)).to.equal(2810n, "Round 3 GM weight should be preserved")
  })
})
