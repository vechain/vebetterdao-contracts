import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { expect } from "chai"
import { ethers } from "hardhat"
import { describe, it } from "mocha"

import { deployAndUpgrade, deployProxyOnly, initializeProxy, upgradeProxy } from "../../scripts/helpers"
import { B3TRGovernor, B3TRGovernorV1, B3TRGovernorV7 } from "../../typechain-types"
import { DeployInstance, getOrDeployContractInstances } from "../helpers"
import {
  getProposalIdFromTx,
  getVot3Tokens,
  moveBlocks,
  startNewAllocationRound,
  waitForBlock,
  waitForCurrentRoundToEnd,
  waitForNextBlock,
} from "../helpers/common"
import {
  GRANT_PROPOSAL_TYPE,
  setupProposer,
  setupVoter,
  STANDARD_PROPOSAL_TYPE,
  startNewRoundAndGetRoundId,
} from "./fixture.test"

describe("Governance - V8 Upgrade - @shard4g", function () {
  it("Should preserve non-executable V1 proposal through all upgrades and successfully approve it in V8", async () => {
    const config = createLocalConfig()
    const {
      owner,
      b3tr,
      timeLock,
      voterRewards,
      vot3,
      xAllocationVoting,
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
      governorProposalLogicLibV5,
      governorQuorumLogicLibV5,
      governorStateLogicLibV5,
      governorVotesLogicLibV5,
      governorClockLogicLibV6,
      governorConfiguratorLibV6,
      governorDepositLogicLibV6,
      governorFunctionRestrictionsLogicLibV6,
      governorProposalLogicLibV6,
      governorQuorumLogicLibV6,
      governorStateLogicLibV6,
      governorVotesLogicLibV6,
      governorClockLogicLibV7,
      governorConfiguratorLibV7,
      governorDepositLogicLibV7,
      governorFunctionRestrictionsLogicLibV7,
      governorProposalLogicLibV7,
      governorQuorumLogicLibV7,
      governorStateLogicLibV7,
      governorVotesLogicLibV7,
      governorConfiguratorLib,
      governorDepositLogicLib,
      governorFunctionRestrictionsLogicLib,
      governorProposalLogicLib,
      governorQuorumLogicLib,
      governorStateLogicLib,
      governorVotesLogicLib,
      governorClockLogicLib,
      veBetterPassport,
      minterAccount,
      otherAccounts,
      emissions,
      grantsManager,
      galaxyMember,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    // Setup proposer and voters for this test
    const proposer = otherAccounts[0]
    await setupProposer(proposer, b3tr, vot3, minterAccount)
    await setupVoter(proposer, b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)

    // Deploy V1 Governor Proxy
    const governorContractAddress = await deployProxyOnly("B3TRGovernorV1", {
      GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
      GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
      GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
      GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
      GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
      GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
      GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
      GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
    })

    // Initialize V1
    const governorV1 = (await initializeProxy(
      governorContractAddress,
      "B3TRGovernorV1",
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
          voterRewards: await voterRewards.getAddress(),
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
    )) as B3TRGovernorV1

    expect(await governorV1.version()).to.equal("1")

    // Grant Vote registrar role to Governor
    await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), governorContractAddress)

    // Create proposal in V1
    const roundId = await startNewRoundAndGetRoundId(emissions, xAllocationVoting)

    const txV1 = await governorV1.connect(proposer).propose([], [], [], "Test proposal from V1", roundId, 0, {
      gasLimit: 10_000_000,
    })
    const proposeReceiptV1 = await txV1.wait()
    const eventV1 = proposeReceiptV1?.logs[0]

    const decodedV1Logs = governorV1.interface.parseLog({
      topics: [...(eventV1?.topics as string[])],
      data: eventV1 ? eventV1.data : "",
    })

    const proposalId = ethers.toBigInt(decodedV1Logs?.args[0])

    // Verify proposal exists in V1
    expect(await governorV1.proposalProposer(proposalId)).to.equal(proposer.address)
    expect(await governorV1.state(proposalId)).to.equal(ethers.toBigInt(0)) // Pending state

    // Upgrade V1 -> V2
    await upgradeProxy("B3TRGovernorV1", "B3TRGovernorV2", governorContractAddress, [], {
      version: 2,
      libraries: {
        GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
        GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
        GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
        GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
        GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
        GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
        GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
        GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
      },
    })

    // Upgrade V2 -> V3
    await upgradeProxy("B3TRGovernorV2", "B3TRGovernorV3", governorContractAddress, [], {
      version: 3,
      libraries: {
        GovernorClockLogicV3: await governorClockLogicLibV3.getAddress(),
        GovernorConfiguratorV3: await governorConfiguratorLibV3.getAddress(),
        GovernorDepositLogicV3: await governorDepositLogicLibV3.getAddress(),
        GovernorFunctionRestrictionsLogicV3: await governorFunctionRestrictionsLogicLibV3.getAddress(),
        GovernorProposalLogicV3: await governorProposalLogicLibV3.getAddress(),
        GovernorQuorumLogicV3: await governorQuorumLogicLibV3.getAddress(),
        GovernorStateLogicV3: await governorStateLogicLibV3.getAddress(),
        GovernorVotesLogicV3: await governorVotesLogicLibV3.getAddress(),
      },
    })

    // Upgrade V3 -> V4
    await upgradeProxy(
      "B3TRGovernorV3",
      "B3TRGovernorV4",
      governorContractAddress,
      [await veBetterPassport.getAddress()],
      {
        version: 4,
        libraries: {
          GovernorClockLogicV4: await governorClockLogicLibV4.getAddress(),
          GovernorConfiguratorV4: await governorConfiguratorLibV4.getAddress(),
          GovernorDepositLogicV4: await governorDepositLogicLibV4.getAddress(),
          GovernorFunctionRestrictionsLogicV4: await governorFunctionRestrictionsLogicLibV4.getAddress(),
          GovernorProposalLogicV4: await governorProposalLogicLibV4.getAddress(),
          GovernorQuorumLogicV4: await governorQuorumLogicLibV4.getAddress(),
          GovernorStateLogicV4: await governorStateLogicLibV4.getAddress(),
          GovernorVotesLogicV4: await governorVotesLogicLibV4.getAddress(),
        },
      },
    )

    // Upgrade V4 -> V5
    await upgradeProxy("B3TRGovernorV4", "B3TRGovernorV5", governorContractAddress, [], {
      version: 5,
      libraries: {
        GovernorClockLogicV5: await governorClockLogicLibV5.getAddress(),
        GovernorConfiguratorV5: await governorConfiguratorLibV5.getAddress(),
        GovernorDepositLogicV5: await governorDepositLogicLibV5.getAddress(),
        GovernorFunctionRestrictionsLogicV5: await governorFunctionRestrictionsLogicLibV5.getAddress(),
        GovernorProposalLogicV5: await governorProposalLogicLibV5.getAddress(),
        GovernorQuorumLogicV5: await governorQuorumLogicLibV5.getAddress(),
        GovernorStateLogicV5: await governorStateLogicLibV5.getAddress(),
        GovernorVotesLogicV5: await governorVotesLogicLibV5.getAddress(),
      },
    })

    // Upgrade V5 -> V6
    await upgradeProxy("B3TRGovernorV5", "B3TRGovernorV6", governorContractAddress, [], {
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

    // Upgrade V6 -> V7
    await upgradeProxy(
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      governorContractAddress,
      [
        {
          grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD,
          grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD,
          grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE,
          grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP,
          standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP,
          standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT,
          grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT,
          galaxyMember: await galaxyMember.getAddress(),
          grantsManager: await grantsManager.getAddress(),
        },
      ],
      {
        version: 7,
        libraries: {
          GovernorClockLogicV7: await governorClockLogicLibV7.getAddress(),
          GovernorConfiguratorV7: await governorConfiguratorLibV7.getAddress(),
          GovernorDepositLogicV7: await governorDepositLogicLibV7.getAddress(),
          GovernorFunctionRestrictionsLogicV7: await governorFunctionRestrictionsLogicLibV7.getAddress(),
          GovernorProposalLogicV7: await governorProposalLogicLibV7.getAddress(),
          GovernorQuorumLogicV7: await governorQuorumLogicLibV7.getAddress(),
          GovernorStateLogicV7: await governorStateLogicLibV7.getAddress(),
          GovernorVotesLogicV7: await governorVotesLogicLibV7.getAddress(),
        },
      },
    )

    // Upgrade V7 -> V8 (latest version)
    const governorV8 = (await upgradeProxy("B3TRGovernorV7", "B3TRGovernor", governorContractAddress, [], {
      version: 8,
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
    })) as B3TRGovernor

    expect(await governorV8.version()).to.equal("8")

    // Verify proposal persisted through all upgrades
    expect(await governorV8.proposalProposer(proposalId)).to.equal(proposer.address)

    // Verify proposal type defaults to Standard (0) for old proposal
    expect(await governorV8.proposalType(proposalId)).to.equal(ethers.toBigInt(0))

    // Get deposit threshold and support the proposal
    const depositThreshold = await governorV8.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
    await getVot3Tokens(proposer, ethers.formatEther(depositThreshold))
    await vot3.connect(proposer).approve(await governorV8.getAddress(), depositThreshold)
    await governorV8.connect(proposer).deposit(depositThreshold, proposalId)

    // Verify deposit reached
    expect(await governorV8.proposalDepositReached(proposalId)).to.be.true

    // Wait for voting delay
    await moveBlocks(10)

    // Start a new round to move proposal to active
    await waitForCurrentRoundToEnd({ emissions, xAllocationVoting })
    await startNewAllocationRound({
      emissions,
      xAllocationVoting,
      minterAccount,
    })

    // Verify proposal is active
    expect(await governorV8.state(proposalId)).to.equal(ethers.toBigInt(1)) // Active state

    // Cast votes for the proposal
    await governorV8.connect(proposer).castVote(proposalId, 1)
    await governorV8.connect(otherAccounts[1]).castVote(proposalId, 1)
    await governorV8.connect(otherAccounts[2]).castVote(proposalId, 1)

    // Move to next round to finalize voting
    await waitForCurrentRoundToEnd({ emissions, xAllocationVoting })
    await startNewAllocationRound({
      emissions,
      xAllocationVoting,
      minterAccount,
    })

    // Verify proposal succeeded
    expect(await governorV8.state(proposalId)).to.equal(ethers.toBigInt(4)) // Succeeded state
  })

  it("Should preserve non-executable V1 proposal through all upgrades and fail due to deposit not met in V8", async () => {
    const config = createLocalConfig()
    const {
      owner,
      b3tr,
      timeLock,
      voterRewards,
      vot3,
      xAllocationVoting,
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
      governorProposalLogicLibV5,
      governorQuorumLogicLibV5,
      governorStateLogicLibV5,
      governorVotesLogicLibV5,
      governorClockLogicLibV6,
      governorConfiguratorLibV6,
      governorDepositLogicLibV6,
      governorFunctionRestrictionsLogicLibV6,
      governorProposalLogicLibV6,
      governorQuorumLogicLibV6,
      governorStateLogicLibV6,
      governorVotesLogicLibV6,
      governorClockLogicLibV7,
      governorConfiguratorLibV7,
      governorDepositLogicLibV7,
      governorFunctionRestrictionsLogicLibV7,
      governorProposalLogicLibV7,
      governorQuorumLogicLibV7,
      governorStateLogicLibV7,
      governorVotesLogicLibV7,
      governorConfiguratorLib,
      governorDepositLogicLib,
      governorFunctionRestrictionsLogicLib,
      governorProposalLogicLib,
      governorQuorumLogicLib,
      governorStateLogicLib,
      governorVotesLogicLib,
      governorClockLogicLib,
      veBetterPassport,
      minterAccount,
      otherAccounts,
      emissions,
      grantsManager,
      galaxyMember,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    // Setup proposer and voters for this test
    const proposer = otherAccounts[0]
    await setupProposer(proposer, b3tr, vot3, minterAccount)
    await setupVoter(proposer, b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)

    // Deploy V1 Governor Proxy
    const governorContractAddress = await deployProxyOnly("B3TRGovernorV1", {
      GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
      GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
      GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
      GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
      GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
      GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
      GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
      GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
    })

    // Initialize V1
    const governorV1 = (await initializeProxy(
      governorContractAddress,
      "B3TRGovernorV1",
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
          voterRewards: await voterRewards.getAddress(),
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
    )) as B3TRGovernorV1

    expect(await governorV1.version()).to.equal("1")

    // Grant Vote registrar role to Governor
    await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), governorContractAddress)

    // Create proposal in V1
    const roundId = await startNewRoundAndGetRoundId(emissions, xAllocationVoting)

    const txV1 = await governorV1.connect(proposer).propose([], [], [], "Test proposal from V1", roundId, 0, {
      gasLimit: 10_000_000,
    })
    const proposeReceiptV1 = await txV1.wait()
    const eventV1 = proposeReceiptV1?.logs[0]

    const decodedV1Logs = governorV1.interface.parseLog({
      topics: [...(eventV1?.topics as string[])],
      data: eventV1 ? eventV1.data : "",
    })

    const proposalId = ethers.toBigInt(decodedV1Logs?.args[0])

    // Verify proposal exists in V1
    expect(await governorV1.proposalProposer(proposalId)).to.equal(proposer.address)
    expect(await governorV1.state(proposalId)).to.equal(ethers.toBigInt(0)) // Pending state

    // Upgrade V1 -> V2
    await upgradeProxy("B3TRGovernorV1", "B3TRGovernorV2", governorContractAddress, [], {
      version: 2,
      libraries: {
        GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
        GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
        GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
        GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
        GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
        GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
        GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
        GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
      },
    })

    // Upgrade V2 -> V3
    await upgradeProxy("B3TRGovernorV2", "B3TRGovernorV3", governorContractAddress, [], {
      version: 3,
      libraries: {
        GovernorClockLogicV3: await governorClockLogicLibV3.getAddress(),
        GovernorConfiguratorV3: await governorConfiguratorLibV3.getAddress(),
        GovernorDepositLogicV3: await governorDepositLogicLibV3.getAddress(),
        GovernorFunctionRestrictionsLogicV3: await governorFunctionRestrictionsLogicLibV3.getAddress(),
        GovernorProposalLogicV3: await governorProposalLogicLibV3.getAddress(),
        GovernorQuorumLogicV3: await governorQuorumLogicLibV3.getAddress(),
        GovernorStateLogicV3: await governorStateLogicLibV3.getAddress(),
        GovernorVotesLogicV3: await governorVotesLogicLibV3.getAddress(),
      },
    })

    // Upgrade V3 -> V4
    await upgradeProxy(
      "B3TRGovernorV3",
      "B3TRGovernorV4",
      governorContractAddress,
      [await veBetterPassport.getAddress()],
      {
        version: 4,
        libraries: {
          GovernorClockLogicV4: await governorClockLogicLibV4.getAddress(),
          GovernorConfiguratorV4: await governorConfiguratorLibV4.getAddress(),
          GovernorDepositLogicV4: await governorDepositLogicLibV4.getAddress(),
          GovernorFunctionRestrictionsLogicV4: await governorFunctionRestrictionsLogicLibV4.getAddress(),
          GovernorProposalLogicV4: await governorProposalLogicLibV4.getAddress(),
          GovernorQuorumLogicV4: await governorQuorumLogicLibV4.getAddress(),
          GovernorStateLogicV4: await governorStateLogicLibV4.getAddress(),
          GovernorVotesLogicV4: await governorVotesLogicLibV4.getAddress(),
        },
      },
    )

    // Upgrade V4 -> V5
    await upgradeProxy("B3TRGovernorV4", "B3TRGovernorV5", governorContractAddress, [], {
      version: 5,
      libraries: {
        GovernorClockLogicV5: await governorClockLogicLibV5.getAddress(),
        GovernorConfiguratorV5: await governorConfiguratorLibV5.getAddress(),
        GovernorDepositLogicV5: await governorDepositLogicLibV5.getAddress(),
        GovernorFunctionRestrictionsLogicV5: await governorFunctionRestrictionsLogicLibV5.getAddress(),
        GovernorProposalLogicV5: await governorProposalLogicLibV5.getAddress(),
        GovernorQuorumLogicV5: await governorQuorumLogicLibV5.getAddress(),
        GovernorStateLogicV5: await governorStateLogicLibV5.getAddress(),
        GovernorVotesLogicV5: await governorVotesLogicLibV5.getAddress(),
      },
    })

    // Upgrade V5 -> V6
    await upgradeProxy("B3TRGovernorV5", "B3TRGovernorV6", governorContractAddress, [], {
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

    // Upgrade V6 -> V7
    await upgradeProxy(
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      governorContractAddress,
      [
        {
          grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD,
          grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD,
          grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE,
          grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP,
          standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP,
          standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT,
          grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT,
          galaxyMember: await galaxyMember.getAddress(),
          grantsManager: await grantsManager.getAddress(),
        },
      ],
      {
        version: 7,
        libraries: {
          GovernorClockLogicV7: await governorClockLogicLibV7.getAddress(),
          GovernorConfiguratorV7: await governorConfiguratorLibV7.getAddress(),
          GovernorDepositLogicV7: await governorDepositLogicLibV7.getAddress(),
          GovernorFunctionRestrictionsLogicV7: await governorFunctionRestrictionsLogicLibV7.getAddress(),
          GovernorProposalLogicV7: await governorProposalLogicLibV7.getAddress(),
          GovernorQuorumLogicV7: await governorQuorumLogicLibV7.getAddress(),
          GovernorStateLogicV7: await governorStateLogicLibV7.getAddress(),
          GovernorVotesLogicV7: await governorVotesLogicLibV7.getAddress(),
        },
      },
    )

    // Upgrade V7 -> V8 (latest version)
    const governorV8 = (await upgradeProxy("B3TRGovernorV7", "B3TRGovernor", governorContractAddress, [], {
      version: 8,
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
    })) as B3TRGovernor

    expect(await governorV8.version()).to.equal("8")

    // Verify proposal persisted through all upgrades
    expect(await governorV8.proposalProposer(proposalId)).to.equal(proposer.address)

    // Verify proposal type defaults to Standard (0) for old proposal
    expect(await governorV8.proposalType(proposalId)).to.equal(ethers.toBigInt(0))

    // Partially support the proposal (not enough to meet deposit threshold)
    const depositThreshold = await governorV8.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
    const partialDeposit = depositThreshold / 2n // Only deposit half of required amount
    await getVot3Tokens(proposer, ethers.formatEther(partialDeposit))
    await vot3.connect(proposer).approve(await governorV8.getAddress(), partialDeposit)
    await governorV8.connect(proposer).deposit(partialDeposit, proposalId)

    // Verify deposit NOT reached
    expect(await governorV8.proposalDepositReached(proposalId)).to.be.false

    // Wait for voting delay
    await moveBlocks(10)

    // Move through multiple rounds to expire the proposal without meeting deposit
    await waitForCurrentRoundToEnd({ emissions, xAllocationVoting })
    await startNewAllocationRound({
      emissions,
      xAllocationVoting,
      minterAccount,
    })

    await waitForCurrentRoundToEnd({ emissions, xAllocationVoting })
    await startNewAllocationRound({
      emissions,
      xAllocationVoting,
      minterAccount,
    })

    // Verify proposal failed due to deposit not met
    expect(await governorV8.state(proposalId)).to.equal(ethers.toBigInt(7)) // Failed state
  })

  it("Should preserve non-executable V1 proposal through all upgrades and fail due to rejection in voting phase in V8", async () => {
    const config = createLocalConfig()
    const {
      owner,
      b3tr,
      timeLock,
      voterRewards,
      vot3,
      xAllocationVoting,
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
      governorProposalLogicLibV5,
      governorQuorumLogicLibV5,
      governorStateLogicLibV5,
      governorVotesLogicLibV5,
      governorClockLogicLibV6,
      governorConfiguratorLibV6,
      governorDepositLogicLibV6,
      governorFunctionRestrictionsLogicLibV6,
      governorProposalLogicLibV6,
      governorQuorumLogicLibV6,
      governorStateLogicLibV6,
      governorVotesLogicLibV6,
      governorClockLogicLibV7,
      governorConfiguratorLibV7,
      governorDepositLogicLibV7,
      governorFunctionRestrictionsLogicLibV7,
      governorProposalLogicLibV7,
      governorQuorumLogicLibV7,
      governorStateLogicLibV7,
      governorVotesLogicLibV7,
      governorConfiguratorLib,
      governorDepositLogicLib,
      governorFunctionRestrictionsLogicLib,
      governorProposalLogicLib,
      governorQuorumLogicLib,
      governorStateLogicLib,
      governorVotesLogicLib,
      governorClockLogicLib,
      veBetterPassport,
      minterAccount,
      otherAccounts,
      emissions,
      grantsManager,
      galaxyMember,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    // Setup proposer and voters for this test
    const proposer = otherAccounts[0]
    await setupProposer(proposer, b3tr, vot3, minterAccount)
    await setupVoter(proposer, b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[2], b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[3], b3tr, vot3, minterAccount, owner, veBetterPassport)

    // Deploy V1 Governor Proxy
    const governorContractAddress = await deployProxyOnly("B3TRGovernorV1", {
      GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
      GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
      GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
      GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
      GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
      GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
      GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
      GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
    })

    // Initialize V1
    const governorV1 = (await initializeProxy(
      governorContractAddress,
      "B3TRGovernorV1",
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
          voterRewards: await voterRewards.getAddress(),
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
    )) as B3TRGovernorV1

    expect(await governorV1.version()).to.equal("1")

    // Grant Vote registrar role to Governor
    await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), governorContractAddress)

    // Create proposal in V1
    const roundId = await startNewRoundAndGetRoundId(emissions, xAllocationVoting)

    const txV1 = await governorV1.connect(proposer).propose([], [], [], "Test proposal from V1", roundId, 0, {
      gasLimit: 10_000_000,
    })
    const proposeReceiptV1 = await txV1.wait()
    const eventV1 = proposeReceiptV1?.logs[0]

    const decodedV1Logs = governorV1.interface.parseLog({
      topics: [...(eventV1?.topics as string[])],
      data: eventV1 ? eventV1.data : "",
    })

    const proposalId = ethers.toBigInt(decodedV1Logs?.args[0])

    // Verify proposal exists in V1
    expect(await governorV1.proposalProposer(proposalId)).to.equal(proposer.address)
    expect(await governorV1.state(proposalId)).to.equal(ethers.toBigInt(0)) // Pending state

    // Upgrade V1 -> V2
    await upgradeProxy("B3TRGovernorV1", "B3TRGovernorV2", governorContractAddress, [], {
      version: 2,
      libraries: {
        GovernorClockLogicV1: await governorClockLogicLibV1.getAddress(),
        GovernorConfiguratorV1: await governorConfiguratorLibV1.getAddress(),
        GovernorDepositLogicV1: await governorDepositLogicLibV1.getAddress(),
        GovernorFunctionRestrictionsLogicV1: await governorFunctionRestrictionsLogicLibV1.getAddress(),
        GovernorProposalLogicV1: await governorProposalLogicLibV1.getAddress(),
        GovernorQuorumLogicV1: await governorQuorumLogicLibV1.getAddress(),
        GovernorStateLogicV1: await governorStateLogicLibV1.getAddress(),
        GovernorVotesLogicV1: await governorVotesLogicLibV1.getAddress(),
      },
    })

    // Upgrade V2 -> V3
    await upgradeProxy("B3TRGovernorV2", "B3TRGovernorV3", governorContractAddress, [], {
      version: 3,
      libraries: {
        GovernorClockLogicV3: await governorClockLogicLibV3.getAddress(),
        GovernorConfiguratorV3: await governorConfiguratorLibV3.getAddress(),
        GovernorDepositLogicV3: await governorDepositLogicLibV3.getAddress(),
        GovernorFunctionRestrictionsLogicV3: await governorFunctionRestrictionsLogicLibV3.getAddress(),
        GovernorProposalLogicV3: await governorProposalLogicLibV3.getAddress(),
        GovernorQuorumLogicV3: await governorQuorumLogicLibV3.getAddress(),
        GovernorStateLogicV3: await governorStateLogicLibV3.getAddress(),
        GovernorVotesLogicV3: await governorVotesLogicLibV3.getAddress(),
      },
    })

    // Upgrade V3 -> V4
    await upgradeProxy(
      "B3TRGovernorV3",
      "B3TRGovernorV4",
      governorContractAddress,
      [await veBetterPassport.getAddress()],
      {
        version: 4,
        libraries: {
          GovernorClockLogicV4: await governorClockLogicLibV4.getAddress(),
          GovernorConfiguratorV4: await governorConfiguratorLibV4.getAddress(),
          GovernorDepositLogicV4: await governorDepositLogicLibV4.getAddress(),
          GovernorFunctionRestrictionsLogicV4: await governorFunctionRestrictionsLogicLibV4.getAddress(),
          GovernorProposalLogicV4: await governorProposalLogicLibV4.getAddress(),
          GovernorQuorumLogicV4: await governorQuorumLogicLibV4.getAddress(),
          GovernorStateLogicV4: await governorStateLogicLibV4.getAddress(),
          GovernorVotesLogicV4: await governorVotesLogicLibV4.getAddress(),
        },
      },
    )

    // Upgrade V4 -> V5
    await upgradeProxy("B3TRGovernorV4", "B3TRGovernorV5", governorContractAddress, [], {
      version: 5,
      libraries: {
        GovernorClockLogicV5: await governorClockLogicLibV5.getAddress(),
        GovernorConfiguratorV5: await governorConfiguratorLibV5.getAddress(),
        GovernorDepositLogicV5: await governorDepositLogicLibV5.getAddress(),
        GovernorFunctionRestrictionsLogicV5: await governorFunctionRestrictionsLogicLibV5.getAddress(),
        GovernorProposalLogicV5: await governorProposalLogicLibV5.getAddress(),
        GovernorQuorumLogicV5: await governorQuorumLogicLibV5.getAddress(),
        GovernorStateLogicV5: await governorStateLogicLibV5.getAddress(),
        GovernorVotesLogicV5: await governorVotesLogicLibV5.getAddress(),
      },
    })

    // Upgrade V5 -> V6
    await upgradeProxy("B3TRGovernorV5", "B3TRGovernorV6", governorContractAddress, [], {
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

    // Upgrade V6 -> V7
    await upgradeProxy(
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      governorContractAddress,
      [
        {
          grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD,
          grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD,
          grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE,
          grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP,
          standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP,
          standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT,
          grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT,
          galaxyMember: await galaxyMember.getAddress(),
          grantsManager: await grantsManager.getAddress(),
        },
      ],
      {
        version: 7,
        libraries: {
          GovernorClockLogicV7: await governorClockLogicLibV7.getAddress(),
          GovernorConfiguratorV7: await governorConfiguratorLibV7.getAddress(),
          GovernorDepositLogicV7: await governorDepositLogicLibV7.getAddress(),
          GovernorFunctionRestrictionsLogicV7: await governorFunctionRestrictionsLogicLibV7.getAddress(),
          GovernorProposalLogicV7: await governorProposalLogicLibV7.getAddress(),
          GovernorQuorumLogicV7: await governorQuorumLogicLibV7.getAddress(),
          GovernorStateLogicV7: await governorStateLogicLibV7.getAddress(),
          GovernorVotesLogicV7: await governorVotesLogicLibV7.getAddress(),
        },
      },
    )

    // Upgrade V7 -> V8 (latest version)
    const governorV8 = (await upgradeProxy("B3TRGovernorV7", "B3TRGovernor", governorContractAddress, [], {
      version: 8,
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
    })) as B3TRGovernor

    expect(await governorV8.version()).to.equal("8")

    // Verify proposal persisted through all upgrades
    expect(await governorV8.proposalProposer(proposalId)).to.equal(proposer.address)

    // Verify proposal type defaults to Standard (0) for old proposal
    expect(await governorV8.proposalType(proposalId)).to.equal(ethers.toBigInt(0))

    // Fully support the proposal to meet deposit threshold
    const depositThreshold = await governorV8.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
    await getVot3Tokens(proposer, ethers.formatEther(depositThreshold))
    await vot3.connect(proposer).approve(await governorV8.getAddress(), depositThreshold)
    await governorV8.connect(proposer).deposit(depositThreshold, proposalId)

    // Verify deposit reached
    expect(await governorV8.proposalDepositReached(proposalId)).to.be.true

    // Wait for voting delay
    await moveBlocks(10)

    // Start a new round to move proposal to active
    await waitForCurrentRoundToEnd({ emissions, xAllocationVoting })
    await startNewAllocationRound({
      emissions,
      xAllocationVoting,
      minterAccount,
    })

    // Verify proposal is active
    expect(await governorV8.state(proposalId)).to.equal(ethers.toBigInt(1)) // Active state

    // Cast votes AGAINST the proposal (more against than for)
    await governorV8.connect(proposer).castVote(proposalId, 1) // For
    await governorV8.connect(otherAccounts[1]).castVote(proposalId, 0) // Against
    await governorV8.connect(otherAccounts[2]).castVote(proposalId, 0) // Against
    await governorV8.connect(otherAccounts[3]).castVote(proposalId, 0) // Against

    // Move to next round to finalize voting
    await waitForCurrentRoundToEnd({ emissions, xAllocationVoting })
    await startNewAllocationRound({
      emissions,
      xAllocationVoting,
      minterAccount,
    })

    // Verify proposal was defeated (rejected)
    expect(await governorV8.state(proposalId)).to.equal(ethers.toBigInt(3)) // Defeated state
  })

  it("Should fallback to old quorum numerator if timepoint is before the V7 -> V8 upgrade", async () => {
    const config = createLocalConfig()
    const {
      owner,
      b3tr,
      timeLock,
      voterRewards,
      vot3,
      xAllocationVoting,
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
      governorProposalLogicLibV5,
      governorQuorumLogicLibV5,
      governorStateLogicLibV5,
      governorVotesLogicLibV5,
      governorClockLogicLibV6,
      governorConfiguratorLibV6,
      governorDepositLogicLibV6,
      governorFunctionRestrictionsLogicLibV6,
      governorProposalLogicLibV6,
      governorQuorumLogicLibV6,
      governorStateLogicLibV6,
      governorVotesLogicLibV6,
      governorClockLogicLibV7,
      governorConfiguratorLibV7,
      governorDepositLogicLibV7,
      governorFunctionRestrictionsLogicLibV7,
      governorProposalLogicLibV7,
      governorQuorumLogicLibV7,
      governorStateLogicLibV7,
      governorVotesLogicLibV7,
      governorConfiguratorLib,
      governorDepositLogicLib,
      governorFunctionRestrictionsLogicLib,
      governorProposalLogicLib,
      governorQuorumLogicLib,
      governorStateLogicLib,
      governorVotesLogicLib,
      governorClockLogicLib,
      veBetterPassport,
      galaxyMember,
      grantsManager,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    const governorV7 = (await deployAndUpgrade(
      [
        "B3TRGovernorV1",
        "B3TRGovernorV2",
        "B3TRGovernorV3",
        "B3TRGovernorV4",
        "B3TRGovernorV5",
        "B3TRGovernorV6",
        "B3TRGovernorV7",
      ],
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
            voterRewards: await voterRewards.getAddress(),
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
        [],
        [],
        [
          {
            grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD,
            grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD,
            grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE,
            grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP,
            standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP,
            standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT,
            grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT,
            galaxyMember: await galaxyMember.getAddress(),
            grantsManager: await grantsManager.getAddress(),
          },
        ],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6, 7],
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
          {
            GovernorClockLogicV6: await governorClockLogicLibV6.getAddress(),
            GovernorConfiguratorV6: await governorConfiguratorLibV6.getAddress(),
            GovernorDepositLogicV6: await governorDepositLogicLibV6.getAddress(),
            GovernorFunctionRestrictionsLogicV6: await governorFunctionRestrictionsLogicLibV6.getAddress(),
            GovernorProposalLogicV6: await governorProposalLogicLibV6.getAddress(),
            GovernorQuorumLogicV6: await governorQuorumLogicLibV6.getAddress(),
            GovernorStateLogicV6: await governorStateLogicLibV6.getAddress(),
            GovernorVotesLogicV6: await governorVotesLogicLibV6.getAddress(),
          },
          {
            GovernorClockLogicV7: await governorClockLogicLibV7.getAddress(),
            GovernorConfiguratorV7: await governorConfiguratorLibV7.getAddress(),
            GovernorDepositLogicV7: await governorDepositLogicLibV7.getAddress(),
            GovernorFunctionRestrictionsLogicV7: await governorFunctionRestrictionsLogicLibV7.getAddress(),
            GovernorProposalLogicV7: await governorProposalLogicLibV7.getAddress(),
            GovernorQuorumLogicV7: await governorQuorumLogicLibV7.getAddress(),
            GovernorStateLogicV7: await governorStateLogicLibV7.getAddress(),
            GovernorVotesLogicV7: await governorVotesLogicLibV7.getAddress(),
          },
        ],
      },
    )) as B3TRGovernorV7

    const v7QuorumNumerator = await governorV7["quorumNumerator()"]()
    const v7QuorumNumeratorBlockNumber = await ethers.provider.getBlockNumber()
    await waitForBlock(20)

    const governorV8 = (await upgradeProxy("B3TRGovernorV7", "B3TRGovernor", await governorV7.getAddress(), [], {
      version: 8,
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
    })) as B3TRGovernor

    //Update standard quorum numerator
    const proposalStandardType = ethers.toBigInt(0)
    const newQuorumNumerator = v7QuorumNumerator + 2n
    await governorV8.connect(owner).updateQuorumNumeratorByType(newQuorumNumerator, proposalStandardType)

    const v8QuorumNumeratorLatest = await governorV8["quorumNumerator()"]()
    const v8QuorumNumeratorByTypeAtBlock = await governorV8["quorumNumeratorByProposalType(uint256,uint8)"](
      v7QuorumNumeratorBlockNumber,
      proposalStandardType,
    )
    const v8QuorumNumeratorByTypeLatest = await governorV8["quorumNumeratorByProposalType(uint8)"](proposalStandardType)

    //Querying without a timepoint should return the latest quorum numerator
    expect(v8QuorumNumeratorLatest).to.be.equal(newQuorumNumerator)

    //Querying with a timepoint should return the quorum numerator at that timepoint
    //Which in this case is before the upgrade, so should be the same as the v7 quorum numerator
    expect(v8QuorumNumeratorByTypeAtBlock).to.be.equal(v7QuorumNumerator)

    //Querying with a timepoint should return the quorum numerator at that timepoint
    //Which in this case is after the upgrade, so should be the same as the new quorum numerator
    expect(v8QuorumNumeratorByTypeLatest).to.be.equal(newQuorumNumerator)
  })

  it("Should be able to upgrade from V7 to V8 and have the same quorum numerator for past timepoints", async () => {
    const config = createLocalConfig()
    const {
      owner,
      b3tr,
      timeLock,
      voterRewards,
      vot3,
      xAllocationVoting,
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
      governorProposalLogicLibV5,
      governorQuorumLogicLibV5,
      governorStateLogicLibV5,
      governorVotesLogicLibV5,
      governorClockLogicLibV6,
      governorConfiguratorLibV6,
      governorDepositLogicLibV6,
      governorFunctionRestrictionsLogicLibV6,
      governorProposalLogicLibV6,
      governorQuorumLogicLibV6,
      governorStateLogicLibV6,
      governorVotesLogicLibV6,
      governorClockLogicLibV7,
      governorConfiguratorLibV7,
      governorDepositLogicLibV7,
      governorFunctionRestrictionsLogicLibV7,
      governorProposalLogicLibV7,
      governorQuorumLogicLibV7,
      governorStateLogicLibV7,
      governorVotesLogicLibV7,
      governorConfiguratorLib,
      governorDepositLogicLib,
      governorFunctionRestrictionsLogicLib,
      governorProposalLogicLib,
      governorQuorumLogicLib,
      governorStateLogicLib,
      governorVotesLogicLib,
      governorClockLogicLib,
      veBetterPassport,
      galaxyMember,
      grantsManager,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    const governorV7 = (await deployAndUpgrade(
      [
        "B3TRGovernorV1",
        "B3TRGovernorV2",
        "B3TRGovernorV3",
        "B3TRGovernorV4",
        "B3TRGovernorV5",
        "B3TRGovernorV6",
        "B3TRGovernorV7",
      ],
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
            voterRewards: await voterRewards.getAddress(),
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
        [],
        [],
        [
          {
            grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD,
            grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD,
            grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE,
            grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP,
            standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP,
            standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT,
            grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT,
            galaxyMember: await galaxyMember.getAddress(),
            grantsManager: await grantsManager.getAddress(),
          },
        ],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6, 7],
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
          {
            GovernorClockLogicV6: await governorClockLogicLibV6.getAddress(),
            GovernorConfiguratorV6: await governorConfiguratorLibV6.getAddress(),
            GovernorDepositLogicV6: await governorDepositLogicLibV6.getAddress(),
            GovernorFunctionRestrictionsLogicV6: await governorFunctionRestrictionsLogicLibV6.getAddress(),
            GovernorProposalLogicV6: await governorProposalLogicLibV6.getAddress(),
            GovernorQuorumLogicV6: await governorQuorumLogicLibV6.getAddress(),
            GovernorStateLogicV6: await governorStateLogicLibV6.getAddress(),
            GovernorVotesLogicV6: await governorVotesLogicLibV6.getAddress(),
          },
          {
            GovernorClockLogicV7: await governorClockLogicLibV7.getAddress(),
            GovernorConfiguratorV7: await governorConfiguratorLibV7.getAddress(),
            GovernorDepositLogicV7: await governorDepositLogicLibV7.getAddress(),
            GovernorFunctionRestrictionsLogicV7: await governorFunctionRestrictionsLogicLibV7.getAddress(),
            GovernorProposalLogicV7: await governorProposalLogicLibV7.getAddress(),
            GovernorQuorumLogicV7: await governorQuorumLogicLibV7.getAddress(),
            GovernorStateLogicV7: await governorStateLogicLibV7.getAddress(),
            GovernorVotesLogicV7: await governorVotesLogicLibV7.getAddress(),
          },
        ],
      },
    )) as B3TRGovernorV7

    //Check if the quorum numerator is the same as the config
    const v7QuorumNumerator1 = await governorV7["quorumNumerator()"]()
    expect(v7QuorumNumerator1).to.be.equal(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE)
    const v7QuorumNumeratorBlockNumber1 = await ethers.provider.getBlockNumber()
    //Set the quorum to config - 1
    await governorV7
      .connect(owner)
      .updateQuorumNumeratorByType(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE - 1), STANDARD_PROPOSAL_TYPE)
    await waitForBlock(20)

    //Set the quorum to config + 10
    await governorV7
      .connect(owner)
      .updateQuorumNumeratorByType(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE + 10), STANDARD_PROPOSAL_TYPE)
    const v7QuorumNumerator2 = await governorV7["quorumNumerator()"]()
    const v7QuorumNumeratorBlockNumber2 = await ethers.provider.getBlockNumber()
    expect(v7QuorumNumerator2).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE + 10))
    await waitForBlock(20)

    //Set the quorum to config + 20
    await governorV7
      .connect(owner)
      .updateQuorumNumeratorByType(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE + 20), STANDARD_PROPOSAL_TYPE)
    const v7QuorumNumerator3 = await governorV7["quorumNumerator()"]()
    const v7QuorumNumeratorBlockNumber3 = await ethers.provider.getBlockNumber()
    expect(v7QuorumNumerator3).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE + 20))
    await waitForBlock(20)

    const governorV8 = (await upgradeProxy("B3TRGovernorV7", "B3TRGovernor", await governorV7.getAddress(), [], {
      version: 8,
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
    })) as B3TRGovernor

    //Check if the quorum after upgrade is the same as the quorum set in the last timepoint
    const v8QuorumNumerator = await governorV8["quorumNumerator()"]()
    expect(v8QuorumNumerator).to.be.equal(v7QuorumNumerator3)

    //Check if the quorum at the timepoint where it was set to config - 1 is the same as the quorum set in the last timepoint
    const v8QuorumNumeratorAtBlock1 = await governorV8["quorumNumeratorByProposalType(uint256,uint8)"](
      v7QuorumNumeratorBlockNumber1,
      STANDARD_PROPOSAL_TYPE,
    )
    expect(v8QuorumNumeratorAtBlock1).to.be.equal(v7QuorumNumerator1)

    //Check if the quorum at the timepoint where it was set to config + 10 is the same as the quorum set in the last timepoint
    const v8QuorumNumeratorAtBlock2 = await governorV8["quorumNumeratorByProposalType(uint256,uint8)"](
      v7QuorumNumeratorBlockNumber2,
      STANDARD_PROPOSAL_TYPE,
    )
    expect(v8QuorumNumeratorAtBlock2).to.be.equal(v7QuorumNumerator2)

    //Check if the quorum at the timepoint where it was set to config + 20 is the same as the quorum set in the last timepoint
    const v8QuorumNumeratorAtBlock3 = await governorV8["quorumNumeratorByProposalType(uint256,uint8)"](
      v7QuorumNumeratorBlockNumber3,
      STANDARD_PROPOSAL_TYPE,
    )
    expect(v8QuorumNumeratorAtBlock3).to.be.equal(v7QuorumNumerator3)
  })

  it("Should not break initialization to V8 if never set the quorum in previous version", async () => {
    const config = createLocalConfig()
    const {
      owner,
      b3tr,
      timeLock,
      voterRewards,
      vot3,
      xAllocationVoting,
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
      governorProposalLogicLibV5,
      governorQuorumLogicLibV5,
      governorStateLogicLibV5,
      governorVotesLogicLibV5,
      governorClockLogicLibV6,
      governorConfiguratorLibV6,
      governorDepositLogicLibV6,
      governorFunctionRestrictionsLogicLibV6,
      governorProposalLogicLibV6,
      governorQuorumLogicLibV6,
      governorStateLogicLibV6,
      governorVotesLogicLibV6,
      governorClockLogicLibV7,
      governorConfiguratorLibV7,
      governorDepositLogicLibV7,
      governorFunctionRestrictionsLogicLibV7,
      governorProposalLogicLibV7,
      governorQuorumLogicLibV7,
      governorStateLogicLibV7,
      governorVotesLogicLibV7,
      governorConfiguratorLib,
      governorDepositLogicLib,
      governorFunctionRestrictionsLogicLib,
      governorProposalLogicLib,
      governorQuorumLogicLib,
      governorStateLogicLib,
      governorVotesLogicLib,
      governorClockLogicLib,
      veBetterPassport,
      grantsManager,
      galaxyMember,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    const governorV7 = (await deployAndUpgrade(
      [
        "B3TRGovernorV1",
        "B3TRGovernorV2",
        "B3TRGovernorV3",
        "B3TRGovernorV4",
        "B3TRGovernorV5",
        "B3TRGovernorV6",
        "B3TRGovernorV7",
      ],
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
            voterRewards: await voterRewards.getAddress(),
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
        [],
        [],
        [
          {
            grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD,
            grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD,
            grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE,
            grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP,
            standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP,
            standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT,
            grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT,
            galaxyMember: await galaxyMember.getAddress(),
            grantsManager: await grantsManager.getAddress(),
          },
        ],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6, 7],
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
          {
            GovernorClockLogicV6: await governorClockLogicLibV6.getAddress(),
            GovernorConfiguratorV6: await governorConfiguratorLibV6.getAddress(),
            GovernorDepositLogicV6: await governorDepositLogicLibV6.getAddress(),
            GovernorFunctionRestrictionsLogicV6: await governorFunctionRestrictionsLogicLibV6.getAddress(),
            GovernorProposalLogicV6: await governorProposalLogicLibV6.getAddress(),
            GovernorQuorumLogicV6: await governorQuorumLogicLibV6.getAddress(),
            GovernorStateLogicV6: await governorStateLogicLibV6.getAddress(),
            GovernorVotesLogicV6: await governorVotesLogicLibV6.getAddress(),
          },
          {
            GovernorClockLogicV7: await governorClockLogicLibV7.getAddress(),
            GovernorConfiguratorV7: await governorConfiguratorLibV7.getAddress(),
            GovernorDepositLogicV7: await governorDepositLogicLibV7.getAddress(),
            GovernorFunctionRestrictionsLogicV7: await governorFunctionRestrictionsLogicLibV7.getAddress(),
            GovernorProposalLogicV7: await governorProposalLogicLibV7.getAddress(),
            GovernorQuorumLogicV7: await governorQuorumLogicLibV7.getAddress(),
            GovernorStateLogicV7: await governorStateLogicLibV7.getAddress(),
            GovernorVotesLogicV7: await governorVotesLogicLibV7.getAddress(),
          },
        ],
      },
    )) as B3TRGovernorV7

    const governorV8 = (await upgradeProxy("B3TRGovernorV7", "B3TRGovernor", await governorV7.getAddress(), [], {
      version: 8,
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
    })) as B3TRGovernor

    //Check if the quorum after upgrade is the same as the quorum initialized in previous version
    const v8QuorumNumerator = await governorV8["quorumNumerator()"]()
    expect(v8QuorumNumerator).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE))

    const v8QuorumNumeratorByType = await governorV8["quorumNumeratorByProposalType(uint8)"](STANDARD_PROPOSAL_TYPE)
    expect(v8QuorumNumeratorByType).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE))

    //Check if the GM weight is the same as the GM weight initialized in previous version
    const v8StandardGMWeight = await governorV8.getRequiredGMLevelByProposalType(STANDARD_PROPOSAL_TYPE)
    expect(v8StandardGMWeight).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT))

    const v8GrantGMWeight = await governorV8.getRequiredGMLevelByProposalType(GRANT_PROPOSAL_TYPE)
    expect(v8GrantGMWeight).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_GRANT_GM_WEIGHT))

    // Check if the grantsManager is the same as the grantsManager initialized in previous version
    const v8GrantsManager = await governorV8.getGrantsManagerContract()
    expect(v8GrantsManager).to.be.equal(await grantsManager.getAddress())

    // Check if the galaxyMember is the same as the galaxyMember initialized in previous version
    const v8GalaxyMember = await governorV8.getGalaxyMemberContract()
    expect(v8GalaxyMember).to.be.equal(await galaxyMember.getAddress())

    // Check if the voting threshold is the same as the voting threshold initialized in previous version
    const v8VotingThresholdStandard = await governorV8.votingThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
    expect(v8VotingThresholdStandard).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_VOTING_THRESHOLD))

    const v8VotingThresholdGrant = await governorV8.votingThresholdByProposalType(GRANT_PROPOSAL_TYPE)
    expect(v8VotingThresholdGrant).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD))
  })

  it("Should loop the length of the quorum numerator history when initializing and preserve the checkpoints from V7 to V8", async function () {
    const config = createLocalConfig()
    const {
      owner,
      b3tr,
      timeLock,
      voterRewards,
      vot3,
      xAllocationVoting,
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
      governorProposalLogicLibV5,
      governorQuorumLogicLibV5,
      governorStateLogicLibV5,
      governorVotesLogicLibV5,
      governorClockLogicLibV6,
      governorConfiguratorLibV6,
      governorDepositLogicLibV6,
      governorFunctionRestrictionsLogicLibV6,
      governorProposalLogicLibV6,
      governorQuorumLogicLibV6,
      governorStateLogicLibV6,
      governorVotesLogicLibV6,
      governorClockLogicLibV7,
      governorConfiguratorLibV7,
      governorDepositLogicLibV7,
      governorFunctionRestrictionsLogicLibV7,
      governorProposalLogicLibV7,
      governorQuorumLogicLibV7,
      governorStateLogicLibV7,
      governorVotesLogicLibV7,
      governorConfiguratorLib,
      governorDepositLogicLib,
      governorFunctionRestrictionsLogicLib,
      governorProposalLogicLib,
      governorQuorumLogicLib,
      governorStateLogicLib,
      governorVotesLogicLib,
      governorClockLogicLib,
      veBetterPassport,
      galaxyMember,
      grantsManager,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    //Deploy until V7
    const governorV7 = (await deployAndUpgrade(
      [
        "B3TRGovernorV1",
        "B3TRGovernorV2",
        "B3TRGovernorV3",
        "B3TRGovernorV4",
        "B3TRGovernorV5",
        "B3TRGovernorV6",
        "B3TRGovernorV7",
      ],
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
            voterRewards: await voterRewards.getAddress(),
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
        [],
        [],
        [
          {
            grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD,
            grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD,
            grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE,
            grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP,
            standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP,
            standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT,
            grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT,
            galaxyMember: await galaxyMember.getAddress(),
            grantsManager: await grantsManager.getAddress(),
          },
        ],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6, 7],
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
          {
            GovernorClockLogicV6: await governorClockLogicLibV6.getAddress(),
            GovernorConfiguratorV6: await governorConfiguratorLibV6.getAddress(),
            GovernorDepositLogicV6: await governorDepositLogicLibV6.getAddress(),
            GovernorFunctionRestrictionsLogicV6: await governorFunctionRestrictionsLogicLibV6.getAddress(),
            GovernorProposalLogicV6: await governorProposalLogicLibV6.getAddress(),
            GovernorQuorumLogicV6: await governorQuorumLogicLibV6.getAddress(),
            GovernorStateLogicV6: await governorStateLogicLibV6.getAddress(),
            GovernorVotesLogicV6: await governorVotesLogicLibV6.getAddress(),
          },
          {
            GovernorClockLogicV7: await governorClockLogicLibV7.getAddress(),
            GovernorConfiguratorV7: await governorConfiguratorLibV7.getAddress(),
            GovernorDepositLogicV7: await governorDepositLogicLibV7.getAddress(),
            GovernorFunctionRestrictionsLogicV7: await governorFunctionRestrictionsLogicLibV7.getAddress(),
            GovernorProposalLogicV7: await governorProposalLogicLibV7.getAddress(),
            GovernorQuorumLogicV7: await governorQuorumLogicLibV7.getAddress(),
            GovernorStateLogicV7: await governorStateLogicLibV7.getAddress(),
            GovernorVotesLogicV7: await governorVotesLogicLibV7.getAddress(),
          },
        ],
      },
    )) as B3TRGovernorV7

    expect(await governorV7.version()).to.equal("7")

    //Fetch and update quorum numerator 10 times, and store the values in an array
    const newQuorumNumeratorArr = [2, 5, 2, 3, 10, 30, 24, 10, 7, 1]
    const quorumNumeratorHistoryBlocks: number[] = []
    for (const i of newQuorumNumeratorArr) {
      await waitForNextBlock()
      await governorV7.updateQuorumNumeratorByType(i, STANDARD_PROPOSAL_TYPE)
      // Get the block number where this update happened
      const blockNumber = await ethers.provider.getBlockNumber()
      quorumNumeratorHistoryBlocks.push(blockNumber)

      // Check if the update works
      const currentQuorum = await governorV7["quorumNumerator()"]()
      expect(currentQuorum).to.be.equal(i)
    }

    //Upgrade V7 -> V8
    const governorV8 = (await upgradeProxy("B3TRGovernorV7", "B3TRGovernor", await governorV7.getAddress(), [], {
      version: 8,
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
    })) as B3TRGovernor

    expect(await governorV8.version()).to.equal("8")

    // Verify that all checkpoints are preserved after v8 upgrade
    for (let i = 0; i < newQuorumNumeratorArr.length; i++) {
      const expectedValue = newQuorumNumeratorArr[i]
      const blockNumber = quorumNumeratorHistoryBlocks[i]

      // Use quorumNumeratorByProposalType method to get quorum at specific timepoint
      const v8QuorumAtBlock = await governorV8["quorumNumeratorByProposalType(uint256,uint8)"](
        blockNumber,
        STANDARD_PROPOSAL_TYPE,
      )

      expect(v8QuorumAtBlock).to.be.equal(
        expectedValue,
        `Quorum value mismatch at block ${blockNumber}. Expected: ${expectedValue}, Got: ${v8QuorumAtBlock}`,
      )
    }

    // Also verify that the current quorum matches the last set value
    const currentV8Quorum = await governorV8["quorumNumerator()"]()
    const lastSetValue = newQuorumNumeratorArr[newQuorumNumeratorArr.length - 1]
    expect(currentV8Quorum).to.be.equal(
      lastSetValue,
      `Current quorum should match the last set value. Expected: ${lastSetValue}, Got: ${currentV8Quorum}`,
    )
  })
  it("Proposals approved in V7 should be approved in V8", async () => {
    const config = createLocalConfig()
    const {
      owner,
      b3tr,
      timeLock,
      voterRewards,
      vot3,
      xAllocationVoting,
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
      governorProposalLogicLibV5,
      governorQuorumLogicLibV5,
      governorStateLogicLibV5,
      governorVotesLogicLibV5,
      governorClockLogicLibV6,
      governorConfiguratorLibV6,
      governorDepositLogicLibV6,
      governorFunctionRestrictionsLogicLibV6,
      governorProposalLogicLibV6,
      governorQuorumLogicLibV6,
      governorStateLogicLibV6,
      governorVotesLogicLibV6,
      governorClockLogicLibV7,
      governorConfiguratorLibV7,
      governorDepositLogicLibV7,
      governorFunctionRestrictionsLogicLibV7,
      governorProposalLogicLibV7,
      governorQuorumLogicLibV7,
      governorStateLogicLibV7,
      governorVotesLogicLibV7,
      governorConfiguratorLib,
      governorDepositLogicLib,
      governorFunctionRestrictionsLogicLib,
      governorProposalLogicLib,
      governorQuorumLogicLib,
      governorStateLogicLib,
      governorVotesLogicLib,
      governorClockLogicLib,
      minterAccount,
      otherAccounts,
      B3trContract,
      veBetterPassport,
      grantsManager,
      galaxyMember,
      emissions,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    const governorV7 = (await deployAndUpgrade(
      [
        "B3TRGovernorV1",
        "B3TRGovernorV2",
        "B3TRGovernorV3",
        "B3TRGovernorV4",
        "B3TRGovernorV5",
        "B3TRGovernorV6",
        "B3TRGovernorV7",
      ],
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
            voterRewards: await voterRewards.getAddress(),
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
        [],
        [],
        [
          {
            grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD,
            grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD,
            grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE,
            grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP,
            standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP,
            standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT,
            grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT,
            galaxyMember: await galaxyMember.getAddress(),
            grantsManager: await grantsManager.getAddress(),
          },
        ],
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6, 7],
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
          {
            GovernorClockLogicV6: await governorClockLogicLibV6.getAddress(),
            GovernorConfiguratorV6: await governorConfiguratorLibV6.getAddress(),
            GovernorDepositLogicV6: await governorDepositLogicLibV6.getAddress(),
            GovernorFunctionRestrictionsLogicV6: await governorFunctionRestrictionsLogicLibV6.getAddress(),
            GovernorProposalLogicV6: await governorProposalLogicLibV6.getAddress(),
            GovernorQuorumLogicV6: await governorQuorumLogicLibV6.getAddress(),
            GovernorStateLogicV6: await governorStateLogicLibV6.getAddress(),
            GovernorVotesLogicV6: await governorVotesLogicLibV6.getAddress(),
          },
          {
            GovernorClockLogicV7: await governorClockLogicLibV7.getAddress(),
            GovernorConfiguratorV7: await governorConfiguratorLibV7.getAddress(),
            GovernorDepositLogicV7: await governorDepositLogicLibV7.getAddress(),
            GovernorFunctionRestrictionsLogicV7: await governorFunctionRestrictionsLogicLibV7.getAddress(),
            GovernorProposalLogicV7: await governorProposalLogicLibV7.getAddress(),
            GovernorQuorumLogicV7: await governorQuorumLogicLibV7.getAddress(),
            GovernorStateLogicV7: await governorStateLogicLibV7.getAddress(),
            GovernorVotesLogicV7: await governorVotesLogicLibV7.getAddress(),
          },
        ],
      },
    )) as B3TRGovernorV7

    await voterRewards.connect(owner).grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await governorV7.getAddress())

    //Create proposal
    const roundId = await startNewRoundAndGetRoundId(emissions, xAllocationVoting)

    const tx = await governorV7.connect(owner).propose([], [], [], "Test proposal", roundId, 0, {
      gasLimit: 10_000_000,
    })
    await tx.wait()
    const proposalId = await getProposalIdFromTx(tx)

    //Support Proposal
    const depositThreshold = await governorV7.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
    //Get more than the deposit threshold to support the proposal
    await getVot3Tokens(owner, ethers.formatEther(depositThreshold * 2n))
    await vot3.connect(owner).approve(await governorV7.getAddress(), depositThreshold * 2n)
    await governorV7.connect(owner).deposit(depositThreshold * 2n, proposalId)

    //Verify proposal is supported
    expect(await governorV7.proposalDepositReached(proposalId)).to.be.true

    //Setup user as voter
    await setupVoter(owner, b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[0], b3tr, vot3, minterAccount, owner, veBetterPassport)
    await setupVoter(otherAccounts[1], b3tr, vot3, minterAccount, owner, veBetterPassport)

    //Start new round
    await waitForCurrentRoundToEnd({ emissions, xAllocationVoting })
    await startNewAllocationRound({
      emissions,
      xAllocationVoting,
      minterAccount,
    })

    //Vote for proposal
    await governorV7.connect(owner).castVote(proposalId, 1)
    await governorV7.connect(otherAccounts[0]).castVote(proposalId, 1)
    await governorV7.connect(otherAccounts[1]).castVote(proposalId, 1)

    //Move to next round
    await waitForCurrentRoundToEnd({ emissions, xAllocationVoting })
    await startNewAllocationRound({
      emissions,
      xAllocationVoting,
      minterAccount,
    })

    //Verify proposal succeeded in V7
    const stateInV7 = await governorV7.state(proposalId)
    expect(stateInV7).to.equal(ethers.toBigInt(4)) // Succeeded state

    // Now upgrade to governor v8
    const governorV8 = (await upgradeProxy("B3TRGovernorV7", "B3TRGovernor", await governorV7.getAddress(), [], {
      version: 8,
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
    })) as B3TRGovernor
    const stateInV8 = await governorV8.state(proposalId)

    expect(stateInV8).to.equal(stateInV7)
  })
})
