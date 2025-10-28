import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { expect } from "chai"
import { ethers } from "hardhat"
import { describe, it } from "mocha"

import { deployAndUpgrade, deployProxyOnly, initializeProxy, upgradeProxy } from "../../scripts/helpers"
import {
  B3TRGovernor,
  B3TRGovernorV1,
  B3TRGovernorV2,
  B3TRGovernorV3,
  B3TRGovernorV4,
  B3TRGovernorV5,
  B3TRGovernorV6,
  B3TRGovernorV7,
} from "../../typechain-types"
import { DeployInstance, getOrDeployContractInstances } from "../helpers"
import {
  getProposalIdFromTx,
  getVot3Tokens,
  startNewAllocationRound,
  waitForBlock,
  waitForCurrentRoundToEnd,
  waitForNextBlock,
} from "../helpers/common"
import { GRANT_PROPOSAL_TYPE, setupProposer, STANDARD_PROPOSAL_TYPE, startNewRoundAndGetRoundId } from "./fixture.test"

describe("Governance - V7 Upgrade - @shard4f", function () {
  it("Should preserve proposal data through version upgrades and add proposal type support", async () => {
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
      veBetterPassport,
      minterAccount,
      otherAccounts,
      emissions,
      grantsManager,
      galaxyMember,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    // Setup proposer for this test
    const proposer = otherAccounts[0]
    await setupProposer(proposer, b3tr, vot3, minterAccount)

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
          quorumPercentage: config.B3TR_GOVERNOR_QUORUM_PERCENTAGE, // quorum percentage
          initialDepositThreshold: config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD, // deposit threshold
          initialMinVotingDelay: config.B3TR_GOVERNOR_MIN_VOTING_DELAY, // delay before vote starts
          initialVotingThreshold: config.B3TR_GOVERNOR_VOTING_THRESHOLD, // voting threshold
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

    const roundIdforV1 = await startNewRoundAndGetRoundId(emissions, xAllocationVoting)

    const txV1 = await governorV1.connect(proposer).propose([], [], [], "descriptionV1", roundIdforV1, 0, {
      gasLimit: 10_000_000,
    })
    const proposeReceiptV1 = await txV1.wait()
    const eventV1 = proposeReceiptV1?.logs[0]

    const decodedV1Logs = governorV1.interface.parseLog({
      topics: [...(eventV1?.topics as string[])],
      data: eventV1 ? eventV1.data : "",
    })

    const proposalIdV1 = ethers.toBigInt(decodedV1Logs?.args[0])

    // Verify proposal exists and get initial data
    const proposerV1 = await governorV1.proposalProposer(proposalIdV1)
    const stateV1 = await governorV1.state(proposalIdV1)

    expect(proposerV1).to.equal(proposer.address)
    expect(stateV1).to.equal(ethers.toBigInt(0)) // Pending state

    // Upgrade V1 -> V2
    const governorV2 = (await upgradeProxy("B3TRGovernorV1", "B3TRGovernorV2", governorContractAddress, [], {
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
    })) as B3TRGovernorV2

    const roundIdforV2 = await startNewRoundAndGetRoundId(emissions, xAllocationVoting)

    const txV2 = await governorV2.connect(proposer).propose([], [], [], "descriptionV2", roundIdforV2, 0, {
      gasLimit: 10_000_000,
    })
    const proposeReceiptV2 = await txV2.wait()
    const eventV2 = proposeReceiptV2?.logs[0]

    const decodedV2Logs = governorV2.interface.parseLog({
      topics: [...(eventV2?.topics as string[])],
      data: eventV2 ? eventV2.data : "",
    })

    const proposalIdV2 = ethers.toBigInt(decodedV2Logs?.args[0])

    // Verify proposal exists and get initial data
    const proposerV2 = await governorV2.proposalProposer(proposalIdV2)
    const stateV2 = await governorV2.state(proposalIdV2)

    expect(proposerV2).to.equal(proposer.address)
    expect(stateV2).to.equal(ethers.toBigInt(0)) // Pending state

    // Upgrade V2 -> V3
    const governorV3 = (await upgradeProxy("B3TRGovernorV2", "B3TRGovernorV3", governorContractAddress, [], {
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
    })) as B3TRGovernorV3

    expect(await governorV3.version()).to.equal("3")

    // Verify both proposals persisted through V2 -> V3 upgrade
    expect(await governorV3.proposalProposer(proposalIdV1)).to.equal(proposerV1)
    expect(await governorV3.state(proposalIdV1)).to.equal(ethers.toBigInt(7)) //At this stage should be a failed proposal
    expect(await governorV3.proposalProposer(proposalIdV2)).to.equal(proposer.address)
    expect(await governorV3.state(proposalIdV2)).to.equal(ethers.toBigInt(0))

    // Upgrade V3 -> V4
    const governorV4 = (await upgradeProxy(
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
    )) as B3TRGovernorV4

    expect(await governorV4.version()).to.equal("4")

    // Verify all proposals persisted through V3 -> V4 upgrade
    expect(await governorV4.proposalProposer(proposalIdV1)).to.equal(proposerV1)
    expect(await governorV4.state(proposalIdV1)).to.equal(ethers.toBigInt(7)) //At this stage should be a failed proposal
    expect(await governorV4.proposalProposer(proposalIdV2)).to.equal(proposer.address)
    expect(await governorV4.state(proposalIdV2)).to.equal(ethers.toBigInt(0))

    // Upgrade V4 -> V5
    const governorV5 = (await upgradeProxy("B3TRGovernorV4", "B3TRGovernorV5", governorContractAddress, [], {
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
    })) as B3TRGovernorV5

    expect(await governorV5.version()).to.equal("5")

    // Verify all proposals persisted through V4 -> V5 upgrade
    expect(await governorV5.proposalProposer(proposalIdV1)).to.equal(proposerV1)
    expect(await governorV5.state(proposalIdV1)).to.equal(ethers.toBigInt(7)) //At this stage should be a failed proposal
    expect(await governorV5.proposalProposer(proposalIdV2)).to.equal(proposer.address)
    expect(await governorV5.state(proposalIdV2)).to.equal(ethers.toBigInt(0))

    // Create another proposal in V5 (still no proposal type concept)
    await waitForBlock(1)
    const roundIdforV5 = await startNewRoundAndGetRoundId(emissions, xAllocationVoting)

    const txV5 = await governorV5.connect(proposer).propose([], [], [], "descriptionV5", roundIdforV5, 0, {
      gasLimit: 10_000_000,
    })
    const proposeReceiptV5 = await txV5.wait()
    const eventV5 = proposeReceiptV5?.logs[0]

    const decodedV5Logs = governorV5.interface.parseLog({
      topics: [...(eventV5?.topics as string[])],
      data: eventV5 ? eventV5.data : "",
    })

    const proposalIdV5 = ethers.toBigInt(decodedV5Logs?.args[0])

    // Verify proposal exists and get initial data
    const proposerV5 = await governorV5.proposalProposer(proposalIdV5)
    const stateV5 = await governorV5.state(proposalIdV5)

    expect(proposerV5).to.equal(proposer.address)
    expect(stateV5).to.equal(ethers.toBigInt(0)) // Pending state

    // Upgrade V5 -> V6
    const governorV6 = (await upgradeProxy("B3TRGovernorV5", "B3TRGovernorV6", governorContractAddress, [], {
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
    })) as B3TRGovernorV6

    expect(await governorV6.version()).to.equal("6")

    // Upgrade V6 -> V7 (current version with proposal types)
    const governorV7 = (await upgradeProxy(
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      governorContractAddress,
      [
        {
          grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD, //Grant deposit threshold
          grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD, //Grant voting threshold
          grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE, //Grant quorum percentage
          grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP, //Grant deposit threshold cap
          standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP, //Standard deposit threshold cap
          standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT, //Standard GM weight
          grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT, //Grant GM weight
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
    )) as B3TRGovernorV7

    expect(await governorV7.version()).to.equal("7")

    // Verify all proposals persisted through V6 -> V7 upgrade
    expect(await governorV7.proposalProposer(proposalIdV1)).to.equal(proposerV1)
    expect(await governorV7.state(proposalIdV1)).to.equal(ethers.toBigInt(7)) //At this stage should be a failed proposal
    expect(await governorV7.proposalProposer(proposalIdV2)).to.equal(proposer.address)
    expect(await governorV7.state(proposalIdV2)).to.equal(ethers.toBigInt(7)) //At this stage should be a failed proposal
    expect(await governorV7.proposalProposer(proposalIdV5)).to.equal(proposer.address)
    expect(await governorV7.state(proposalIdV5)).to.equal(ethers.toBigInt(0))

    // Test proposal type functionality - old proposals should default to Standard (0)
    expect(await governorV7.proposalType(proposalIdV1)).to.equal(ethers.toBigInt(0)) // Standard type
    expect(await governorV7.proposalType(proposalIdV2)).to.equal(ethers.toBigInt(0)) // Standard type
    expect(await governorV7.proposalType(proposalIdV5)).to.equal(ethers.toBigInt(0)) // Standard type

    // Create new proposals in V7 with explicit proposal types
    await waitForBlock(1)
    const roundIdforV7 = await startNewRoundAndGetRoundId(emissions, xAllocationVoting)

    const txV7 = await governorV7.connect(proposer).propose([], [], [], "descriptionV7", roundIdforV7, 0, {
      gasLimit: 10_000_000,
    })
    const proposeReceiptV7 = await txV7.wait()
    const eventV7 = proposeReceiptV7?.logs[0]

    const decodedV7Logs = governorV7.interface.parseLog({
      topics: [...(eventV7?.topics as string[])],
      data: eventV7 ? eventV7.data : "",
    })

    const proposalIdV7 = ethers.toBigInt(decodedV7Logs?.args[0])

    // Verify proposal exists and get initial data
    const proposerV7 = await governorV7.proposalProposer(proposalIdV7)
    const stateV7 = await governorV7.state(proposalIdV7)

    expect(proposerV7).to.equal(proposer.address)
    expect(stateV7).to.equal(ethers.toBigInt(0)) // Pending state

    // Verify new proposals have correct types
    expect(await governorV7.proposalType(proposalIdV7)).to.equal(ethers.toBigInt(0))

    // Verify all proposal data is still accessible
    expect(await governorV7.proposalProposer(proposalIdV7)).to.equal(proposer.address)
    expect(await governorV7.state(proposalIdV7)).to.equal(ethers.toBigInt(0))
  })

  it("Should fallback to old quorum numerator if timepoint is before the upgrade", async () => {
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
      veBetterPassport,
      grantsManager,
      galaxyMember,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    const governorV6 = (await deployAndUpgrade(
      ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4", "B3TRGovernorV5", "B3TRGovernorV6"],
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
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6],
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
        ],
      },
    )) as B3TRGovernorV6

    const v6QuorumNumerator = await governorV6["quorumNumerator()"]()
    const v6QuorumNumeratorBlockNumber = await ethers.provider.getBlockNumber()
    await waitForBlock(20)

    const governorV7 = (await upgradeProxy(
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      await governorV6.getAddress(),
      [
        {
          grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD, //Grant deposit threshold
          grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD, //Grant voting threshold
          grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE, //Grant quorum percentage
          grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP, //Grant deposit threshold cap
          standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP, //Standard deposit threshold cap
          standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT, //Standard GM weight
          grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT, //Grant GM weight
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
    )) as B3TRGovernorV7

    //Update standard quorum numerator
    const proposalStandardType = ethers.toBigInt(0)
    const newQuorumNumerator = v6QuorumNumerator + 2n
    await governorV7.connect(owner).updateQuorumNumeratorByType(newQuorumNumerator, proposalStandardType)

    const v7QuorumNumeratorLatest = await governorV7["quorumNumerator()"]()
    const v7QuorumNumeratorByTypeAtBlock = await governorV7["quorumNumeratorByProposalType(uint256,uint8)"](
      v6QuorumNumeratorBlockNumber,
      proposalStandardType,
    )
    const v7QuorumNumeratorByTypeLatest = await governorV7["quorumNumeratorByProposalType(uint8)"](proposalStandardType)

    //Querying without a timepoint should return the latest quorum numerator
    expect(v7QuorumNumeratorLatest).to.be.equal(newQuorumNumerator)

    //Querying with a timepoint should return the quorum numerator at that timepoint
    //Which in this case is before the upgrade, so should be the same as the v6 quorum numerator
    expect(v7QuorumNumeratorByTypeAtBlock).to.be.equal(v6QuorumNumerator)

    //Querying with a timepoint should return the quorum numerator at that timepoint
    //Which in this case is after the upgrade, so should be the same as the new quorum numerator
    expect(v7QuorumNumeratorByTypeLatest).to.be.equal(newQuorumNumerator)
  })

  it("Should be able to upgrade from V6 to V7 and have the same quorum numerator for past timepoints", async () => {
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
      veBetterPassport,
      galaxyMember,
      grantsManager,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    const governorV6 = (await deployAndUpgrade(
      ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4", "B3TRGovernorV5", "B3TRGovernorV6"],
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
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6],
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
        ],
      },
    )) as B3TRGovernorV6

    //Check if the quorum numerator is the same as the config
    const v6QuorumNumerator1 = await governorV6["quorumNumerator()"]()
    expect(v6QuorumNumerator1).to.be.equal(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE)
    const v6QuorumNumeratorBlockNumber1 = await ethers.provider.getBlockNumber()
    //Set the quorum to config - 1
    await governorV6.connect(owner).updateQuorumNumerator(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE - 1))
    await waitForBlock(20)

    //Set the quorum to config + 10
    await governorV6.connect(owner).updateQuorumNumerator(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE + 10))
    const v6QuorumNumerator2 = await governorV6["quorumNumerator()"]()
    const v6QuorumNumeratorBlockNumber2 = await ethers.provider.getBlockNumber()
    expect(v6QuorumNumerator2).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE + 10))
    await waitForBlock(20)

    //Set the quorum to config + 20
    await governorV6.connect(owner).updateQuorumNumerator(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE + 20))
    const v6QuorumNumerator3 = await governorV6["quorumNumerator()"]()
    const v6QuorumNumeratorBlockNumber3 = await ethers.provider.getBlockNumber()
    expect(v6QuorumNumerator3).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE + 20))
    await waitForBlock(20)

    const governorV7 = (await upgradeProxy(
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      await governorV6.getAddress(),
      [
        {
          grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD, //Grant deposit threshold
          grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD, //Grant voting threshold
          grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE, //Grant quorum percentage
          grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP, //Grant deposit threshold cap
          standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP, //Standard deposit threshold cap
          standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT, //Standard GM weight
          grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT, //Grant GM weight
          galaxyMember: await galaxyMember.getAddress(), //GalaxyMember contract
          grantsManager: await grantsManager.getAddress(), //GrantsManager contract
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
    )) as B3TRGovernorV7

    //Check if the quorum after upgrade is the same as the quorum set in the last timepoint
    const v7QuorumNumerator = await governorV7["quorumNumerator()"]()
    expect(v7QuorumNumerator).to.be.equal(v6QuorumNumerator3)

    //Check if the quorum at the timepoint where it was set to config - 1 is the same as the quorum set in the last timepoint
    const v7QuorumNumeratorAtBlock1 = await governorV7["quorumNumeratorByProposalType(uint256,uint8)"](
      v6QuorumNumeratorBlockNumber1, //Timepoint
      STANDARD_PROPOSAL_TYPE, //Proposal type
    )
    expect(v7QuorumNumeratorAtBlock1).to.be.equal(v6QuorumNumerator1)

    //Check if the quorum at the timepoint where it was set to config + 10 is the same as the quorum set in the last timepoint
    const v7QuorumNumeratorAtBlock2 = await governorV7["quorumNumeratorByProposalType(uint256,uint8)"](
      v6QuorumNumeratorBlockNumber2, //Timepoint
      STANDARD_PROPOSAL_TYPE, //Proposal type
    )
    expect(v7QuorumNumeratorAtBlock2).to.be.equal(v6QuorumNumerator2)

    //Check if the quorum at the timepoint where it was set to config + 20 is the same as the quorum set in the last timepoint
    const v7QuorumNumeratorAtBlock3 = await governorV7["quorumNumeratorByProposalType(uint256,uint8)"](
      v6QuorumNumeratorBlockNumber3, //Timepoint
      STANDARD_PROPOSAL_TYPE, //Proposal type
    )
    expect(v7QuorumNumeratorAtBlock3).to.be.equal(v6QuorumNumerator3)
  })

  it("Should not break initialization to V7 if never set the quorum in previous version", async () => {
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
      veBetterPassport,
      grantsManager,
      galaxyMember,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    const governorV6 = (await deployAndUpgrade(
      ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4", "B3TRGovernorV5", "B3TRGovernorV6"],
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
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6],
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
        ],
      },
    )) as B3TRGovernorV6

    const governorV7 = (await upgradeProxy(
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      await governorV6.getAddress(),
      [
        {
          grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD, //Grant deposit threshold
          grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD, //Grant voting threshold
          grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE, //Grant quorum percentage
          grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP, //Grant deposit threshold cap
          standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP, //Standard deposit threshold cap
          standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT, //Standard GM weight
          grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT, //Grant GM weight
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
    )) as B3TRGovernorV7

    //Check if the quorum after upgrade is the same as the quorum initialized in previous version
    const v7QuorumNumerator = await governorV7["quorumNumerator()"]()
    expect(v7QuorumNumerator).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE))

    const v7QuorumNumeratorByType = await governorV7["quorumNumeratorByProposalType(uint8)"](
      STANDARD_PROPOSAL_TYPE, //Proposal type
    )
    expect(v7QuorumNumeratorByType).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_QUORUM_PERCENTAGE))

    //Check if the GM weight is the same as the GM weight initialized in previous version
    const v7StandardGMWeight = await governorV7.getRequiredGMLevelByProposalType(STANDARD_PROPOSAL_TYPE)
    expect(v7StandardGMWeight).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT))

    const v7GrantGMWeight = await governorV7.getRequiredGMLevelByProposalType(GRANT_PROPOSAL_TYPE)
    expect(v7GrantGMWeight).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_GRANT_GM_WEIGHT))

    // Check if the grantsManager is the same as the grantsManager initialized in previous version
    const v7GrantsManager = await governorV7.getGrantsManagerContract()
    expect(v7GrantsManager).to.be.equal(await grantsManager.getAddress())

    // Check if the galaxyMember is the same as the galaxyMember initialized in previous version
    const v7GalaxyMember = await governorV7.getGalaxyMemberContract()
    expect(v7GalaxyMember).to.be.equal(await galaxyMember.getAddress())

    // Check if the voting threshold is the same as the voting threshold initialized in previous version
    const v7VotingThresholdGrant = await governorV7.votingThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
    expect(v7VotingThresholdGrant).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD))

    const v7VotingThresholdStandard = await governorV7.votingThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
    expect(v7VotingThresholdStandard).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_VOTING_THRESHOLD))
  })

  it("Should not break '''depositThreshold''' if proposal created before the v7 upgrade and threshold is greater than the cap", async function () {
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
      veBetterPassport,
      galaxyMember,
      grantsManager,
      minterAccount,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance
    const proposer = owner

    //Deploy until V6
    const governorV6 = (await deployAndUpgrade(
      ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4", "B3TRGovernorV5", "B3TRGovernorV6"],
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
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6],
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
        ],
      },
    )) as B3TRGovernorV6

    expect(await governorV6.version()).to.equal("6")

    // Setup proposer with VOT3
    await setupProposer(proposer, b3tr, vot3, minterAccount)

    //Loops until the threshold is greater than the cap
    let currentThreshold = await governorV6.depositThreshold()
    let currentRoundId = await startNewAllocationRound()
    while (currentThreshold < ethers.toBigInt(config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP)) {
      await waitForCurrentRoundToEnd()
      currentRoundId = await startNewAllocationRound()
      currentThreshold = await governorV6.depositThreshold()
    }

    //Create a proposal with a threshold greater than the cap
    const voteStartsInRoundId = ethers.toBigInt(currentRoundId) + 1n

    // Create a proposal on V6 with threshold 270.020
    const tx = await governorV6.connect(proposer).propose([], [], [], "proposal", voteStartsInRoundId.toString(), 0, {
      gasLimit: 10_000_000,
    })

    const proposalId = await getProposalIdFromTx(tx)
    const v6ProposalDepositThreshold = await governorV6.proposalDepositThreshold(proposalId)

    // Upgrade V6 -> V7
    const governorV7 = (await upgradeProxy(
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      await governorV6.getAddress(),
      [
        {
          grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD, //Grant deposit threshold
          grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD, //Grant voting threshold
          grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE, //Grant quorum percentage
          grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP, //Grant deposit threshold cap
          standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP, //Standard deposit threshold cap
          standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT, //Standard GM weight
          grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT, //Grant GM weight
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
    )) as B3TRGovernorV7
    expect(await governorV7.version()).to.equal("7")

    const v7ProposalDepositThreshold = await governorV7.proposalDepositThreshold(proposalId)

    //Proposal deposit threshold should be the same as the one in V6
    expect(v7ProposalDepositThreshold).to.be.equal(v6ProposalDepositThreshold)

    //Contract threshold should now be the cap, since before upgrade was greater than the cap
    const contractThresholdForStandardProposal = await governorV7.depositThresholdByProposalType(STANDARD_PROPOSAL_TYPE)
    expect(contractThresholdForStandardProposal).to.be.equal(
      ethers.toBigInt(config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP),
    )

    //Proposals created after the upgrade should have the cap as threshold
    const proposal2Tx = await governorV7
      .connect(proposer)
      .propose([], [], [], "proposal2", voteStartsInRoundId.toString(), 0, {
        gasLimit: 10_000_000,
      })
    const proposal2Id = await getProposalIdFromTx(proposal2Tx)
    const proposal2DepositThreshold = await governorV7.proposalDepositThreshold(proposal2Id)
    expect(proposal2DepositThreshold).to.be.equal(ethers.toBigInt(config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP))
  })

  it("Should not break '''isDepositReached''' if proposal created before the v7 upgrade and threshold was met", async function () {
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
      veBetterPassport,
      galaxyMember,
      grantsManager,
      minterAccount,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance
    const proposer = owner

    //Deploy until V6
    const governorV6 = (await deployAndUpgrade(
      ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4", "B3TRGovernorV5", "B3TRGovernorV6"],
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
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6],
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
        ],
      },
    )) as B3TRGovernorV6

    expect(await governorV6.version()).to.equal("6")

    // Setup proposer with VOT3
    await setupProposer(proposer, b3tr, vot3, minterAccount)

    //Loops until the threshold is greater than the cap
    let currentThreshold = await governorV6.depositThreshold()
    let currentRoundId = await startNewAllocationRound()
    while (currentThreshold < ethers.toBigInt(config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP)) {
      await waitForCurrentRoundToEnd()
      currentRoundId = await startNewAllocationRound()
      currentThreshold = await governorV6.depositThreshold()
    }

    //Create a proposal with a threshold greater than the cap
    const voteStartsInRoundId = ethers.toBigInt(currentRoundId) + 1n

    // Create a proposal on V6 with threshold 270.020
    const tx = await governorV6.connect(proposer).propose([], [], [], "proposal", voteStartsInRoundId.toString(), 0, {
      gasLimit: 10_000_000,
    })

    const proposalId = await getProposalIdFromTx(tx)
    const v6ProposalDepositThreshold = await governorV6.proposalDepositThreshold(proposalId)

    //Make the proposal reach the deposit threshold
    await getVot3Tokens(owner, ethers.formatEther(v6ProposalDepositThreshold))
    await vot3
      .connect(owner)
      .approve(await governorV6.getAddress(), ethers.parseEther(v6ProposalDepositThreshold.toString()))
    await governorV6.connect(proposer).deposit(v6ProposalDepositThreshold, proposalId)

    //Proposal should change state to supported
    expect(await governorV6.proposalDepositReached(proposalId)).to.be.equal(true)

    // Upgrade V6 -> V7
    const governorV7 = (await upgradeProxy(
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      await governorV6.getAddress(),
      [
        {
          grantDepositThreshold: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD, //Grant deposit threshold
          grantVotingThreshold: config.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD, //Grant voting threshold
          grantQuorum: config.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE, //Grant quorum percentage
          grantDepositThresholdCap: config.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP, //Grant deposit threshold cap
          standardDepositThresholdCap: config.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP, //Standard deposit threshold cap
          standardGMWeight: config.B3TR_GOVERNOR_STANDARD_GM_WEIGHT, //Standard GM weight
          grantGMWeight: config.B3TR_GOVERNOR_GRANT_GM_WEIGHT, //Grant GM weight
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
    )) as B3TRGovernor
    expect(await governorV7.version()).to.equal("7")

    //Proposal should remain in supported state after upgrade
    expect(await governorV7.proposalDepositReached(proposalId)).to.be.equal(true)
  })

  it("Should loop the length of the quorum numerator history when initializing the new quorum numerator and preserve the checkpoints", async function () {
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
      veBetterPassport,
      galaxyMember,
      grantsManager,
      minterAccount,
    } = (await getOrDeployContractInstances({
      forceDeploy: true,
    })) as DeployInstance

    //Deploy until V6
    const governorV6 = (await deployAndUpgrade(
      ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernorV3", "B3TRGovernorV4", "B3TRGovernorV5", "B3TRGovernorV6"],
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
      ],
      {
        versions: [undefined, 2, 3, 4, 5, 6],
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
        ],
      },
    )) as B3TRGovernorV6

    expect(await governorV6.version()).to.equal("6")

    //Fetch and update quorum numerator 10 times, and store the values in an array
    const newQuorumNumeratorArr = [2, 5, 2, 3, 10, 30, 24, 10, 7, 1]
    const quorumNumeratorHistoryBlocks = []
    for (const i of newQuorumNumeratorArr) {
      await waitForNextBlock()
      await governorV6.updateQuorumNumerator(i)
      // Get the block number where this update happened
      const blockNumber = await ethers.provider.getBlockNumber()
      quorumNumeratorHistoryBlocks.push(blockNumber)

      // Check if the update works
      const currentQuorum = await governorV6["quorumNumerator()"]()
      expect(currentQuorum).to.be.equal(i)
    }

    //Upgrade V6 -> V7
    const governorV7 = (await upgradeProxy(
      "B3TRGovernorV6",
      "B3TRGovernorV7",
      await governorV6.getAddress(),
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
    )) as B3TRGovernorV7

    expect(await governorV7.version()).to.equal("7")

    // Verify that all checkpoints are preserved after v7 upgrade
    for (let i = 0; i < newQuorumNumeratorArr.length; i++) {
      const expectedValue = newQuorumNumeratorArr[i]
      const blockNumber = quorumNumeratorHistoryBlocks[i]

      // Use quorumNumeratorByProposalType method to get quorum at specific timepoint
      const v7QuorumAtBlock = await governorV7["quorumNumeratorByProposalType(uint256,uint8)"](
        blockNumber,
        STANDARD_PROPOSAL_TYPE,
      )

      expect(v7QuorumAtBlock).to.be.equal(
        expectedValue,
        `Quorum value mismatch at block ${blockNumber}. Expected: ${expectedValue}, Got: ${v7QuorumAtBlock}`,
      )
    }

    // Also verify that the current quorum matches the last set value
    const currentV7Quorum = await governorV7["quorumNumerator()"]()
    const lastSetValue = newQuorumNumeratorArr[newQuorumNumeratorArr.length - 1]
    expect(currentV7Quorum).to.be.equal(
      lastSetValue,
      `Current quorum should match the last set value. Expected: ${lastSetValue}, Got: ${currentV7Quorum}`,
    )
  })
})
