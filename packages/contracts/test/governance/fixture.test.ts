import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import {
  B3TR,
  B3TRGovernor,
  Emissions,
  GovernorDepositLogicV1,
  GovernorProposalLogicV1,
  GovernorFunctionRestrictionsLogicV1,
  GovernorQuorumLogicV1,
  TimeLock,
  VOT3,
  VoterRewards,
  XAllocationVoting,
  GovernorClockLogicV1,
  GovernorStateLogicV1,
  GovernorVotesLogicV1,
  GovernorConfiguratorV1,
  VeBetterPassport,
  Treasury,
  GrantsManager,
  X2EarnApps,
  GalaxyMember,
} from "../../typechain-types"
import { getOrDeployContractInstances } from "../helpers"
import { ContractFactory, ContractTransactionReceipt } from "ethers"
import { ethers, expect } from "hardhat"
import {
  bootstrapAndStartEmissions,
  bootstrapEmissions,
  getVot3Tokens,
  waitForCurrentRoundToEnd,
} from "../helpers/common"

//Constants for proposal types
export const STANDARD_PROPOSAL_TYPE = ethers.toBigInt(0)
export const GRANT_PROPOSAL_TYPE = ethers.toBigInt(1)

interface GovernanceFixture {
  governor: B3TRGovernor
  vot3: VOT3
  b3tr: B3TR
  treasury: Treasury
  owner: SignerWithAddress
  timeLock: TimeLock
  xAllocationVoting: XAllocationVoting
  voterRewards: VoterRewards
  otherAccounts: SignerWithAddress[]
  proposer: SignerWithAddress
  voter: SignerWithAddress
  emissions: Emissions
  governorClockLogicLibV1: GovernorClockLogicV1
  governorConfiguratorLibV1: GovernorConfiguratorV1
  governorDepositLogicLibV1: GovernorDepositLogicV1
  governorFunctionRestrictionsLogicLibV1: GovernorFunctionRestrictionsLogicV1
  governorProposalLogicLibV1: GovernorProposalLogicV1
  governorQuorumLogicLibV1: GovernorQuorumLogicV1
  governorStateLogicLibV1: GovernorStateLogicV1
  governorVotesLogicLibV1: GovernorVotesLogicV1
  b3trContract: ContractFactory
  veBetterPassport: VeBetterPassport
  minterAccount: SignerWithAddress
  otherAccount: SignerWithAddress
  grantsManager: GrantsManager
  x2EarnApps: X2EarnApps
  creators: SignerWithAddress[]
  galaxyMember: GalaxyMember
}

export async function setupGovernanceFixture(): Promise<GovernanceFixture> {
  const deployInstances = await getOrDeployContractInstances({
    forceDeploy: true,
  })

  //Setup deploy instances
  const governor = deployInstances?.governor
  const vot3 = deployInstances?.vot3
  const b3tr = deployInstances?.b3tr
  const treasury = deployInstances?.treasury
  const owner = deployInstances?.owner
  const timeLock = deployInstances?.timeLock
  const xAllocationVoting = deployInstances?.xAllocationVoting
  const voterRewards = deployInstances?.voterRewards
  const emissions = deployInstances?.emissions
  const governorClockLogicLibV1 = deployInstances?.governorClockLogicLibV1
  const governorConfiguratorLibV1 = deployInstances?.governorConfiguratorLibV1
  const governorDepositLogicLibV1 = deployInstances?.governorDepositLogicLibV1
  const governorFunctionRestrictionsLogicLibV1 = deployInstances?.governorFunctionRestrictionsLogicLibV1
  const governorProposalLogicLibV1 = deployInstances?.governorProposalLogicLibV1
  const governorQuorumLogicLibV1 = deployInstances?.governorQuorumLogicLibV1
  const governorStateLogicLibV1 = deployInstances?.governorStateLogicLibV1
  const governorVotesLogicLibV1 = deployInstances?.governorVotesLogicLibV1
  const b3trContract = deployInstances?.B3trContract
  const veBetterPassport = deployInstances?.veBetterPassport
  const minterAccount = deployInstances?.minterAccount
  const grantsManager = deployInstances?.grantsManager
  const x2EarnApps = deployInstances?.x2EarnApps
  const creators = deployInstances?.creators
  const galaxyMember = deployInstances?.galaxyMember

  //Setup other accounts
  const otherAccounts = deployInstances?.otherAccounts
  const otherAccount = deployInstances?.otherAccount

  if (!otherAccounts || otherAccounts.length < 2) {
    throw new Error("Other accounts are not correctly set")
  }

  //Setup proposer and voter
  const proposer = otherAccounts[0]
  const voter = otherAccounts[1]

  if (
    !governor ||
    !vot3 ||
    !b3tr ||
    !treasury ||
    !owner ||
    !timeLock ||
    !xAllocationVoting ||
    !voterRewards ||
    !emissions ||
    !governorClockLogicLibV1 ||
    !governorConfiguratorLibV1 ||
    !governorDepositLogicLibV1 ||
    !governorFunctionRestrictionsLogicLibV1 ||
    !governorProposalLogicLibV1 ||
    !governorQuorumLogicLibV1 ||
    !governorStateLogicLibV1 ||
    !governorVotesLogicLibV1 ||
    !b3trContract ||
    !veBetterPassport ||
    !minterAccount ||
    !otherAccount ||
    !grantsManager ||
    !x2EarnApps ||
    !creators ||
    !galaxyMember
  ) {
    throw new Error("Deploy instances are not correctly set")
  }

  return {
    governor,
    vot3,
    b3tr,
    treasury,
    owner,
    timeLock,
    xAllocationVoting,
    voterRewards,
    otherAccounts,
    proposer,
    voter,
    emissions,
    governorClockLogicLibV1,
    governorConfiguratorLibV1,
    governorDepositLogicLibV1,
    governorFunctionRestrictionsLogicLibV1,
    governorProposalLogicLibV1,
    governorQuorumLogicLibV1,
    governorStateLogicLibV1,
    governorVotesLogicLibV1,
    b3trContract,
    veBetterPassport,
    minterAccount,
    otherAccount,
    grantsManager,
    x2EarnApps,
    creators,
    galaxyMember,
  }
}

// Common test helpers
export async function setupProposer(
  account: SignerWithAddress,
  b3tr: B3TR,
  vot3: VOT3,
  minterAccount: SignerWithAddress,
  amount: string = "1000",
) {
  await b3tr.connect(minterAccount).mint(account, ethers.parseEther(amount))
  await b3tr.connect(account).approve(await vot3.getAddress(), ethers.parseEther("9"))
  await vot3.connect(account).convertToVOT3(ethers.parseEther("9"), { gasLimit: 10_000_000 })
}

export async function setupVoter(
  voter: SignerWithAddress,
  b3tr: B3TR,
  vot3: VOT3,
  minterAccount: SignerWithAddress,
  owner: SignerWithAddress,
  veBetterPassport: VeBetterPassport,
) {
  await getVot3Tokens(voter, "10000", {
    b3tr,
    vot3,
    minterAccount,
  })

  // whitelist voter
  await veBetterPassport.connect(owner).whitelist(voter.address)
  await veBetterPassport.connect(owner).toggleCheck(1)
  expect(await veBetterPassport.isCheckEnabled(1)).to.be.true
  // expect voter to be person
  expect(await veBetterPassport.isPerson(voter.address)).to.deep.equal([true, "User is whitelisted"])
}

export async function startNewRoundAndGetRoundId(
  emissions: Emissions,
  xAllocationVoting: XAllocationVoting,
): Promise<string> {
  // to ensure that test will work correctly before creating a proposal we wait for current round to end
  // and start a new one
  if ((await emissions.nextCycle()) === 0n) {
    // if emissions are not started yet, we need to bootstrap and start them
    await bootstrapAndStartEmissions({ emissions, xAllocationVoting })
  } else {
    // otherwise we need to wait for the current round to end and start the next one
    await waitForCurrentRoundToEnd({ emissions, xAllocationVoting })
    await emissions.distribute()
  }
  return ((await xAllocationVoting.currentRoundId()) + 1n).toString()
}

export async function validateProposalEvents(
  governor: B3TRGovernor,
  receipt: ContractTransactionReceipt | null,
  expectedType: number,
  proposerAddress: string,
  description: string,
) {
  if (!receipt) {
    throw new Error("Receipt is null")
  }

  // Define required events based on proposal type
  const requiredEvents = ["ProposalCreated", "ProposalCreatedWithType"]

  // Find all relevant events in one pass
  const foundEvents: Record<string, any> = {}
  for (const log of receipt.logs) {
    try {
      const decoded = governor.interface.parseLog({
        topics: [...log.topics],
        data: log.data,
      })
      if (decoded && requiredEvents.includes(decoded.name)) {
        foundEvents[decoded.name] = decoded
      }
    } catch {
      // Skip logs that can't be decoded
    }
  }

  // Validate all required events are present
  for (const eventName of requiredEvents) {
    if (!foundEvents[eventName]) {
      throw new Error(`Required event ${eventName} not found`)
    }
  }

  // Validate ProposalCreated event details
  const proposalCreated = foundEvents["ProposalCreated"]
  if (proposalCreated.args[1] !== proposerAddress) {
    throw new Error(`Expected proposer ${proposerAddress}, got ${proposalCreated.args[1]}`)
  }
  if (proposalCreated.args[6] !== description) {
    throw new Error(`Expected description ${description}, got ${proposalCreated.args[6]}`)
  }

  // Validate ProposalCreatedWithType event details
  const proposalCreatedWithType = foundEvents["ProposalCreatedWithType"]
  if (proposalCreatedWithType.args[1] !== ethers.toBigInt(expectedType)) {
    throw new Error(`Expected type ${expectedType}, got ${proposalCreatedWithType.args[1]}`)
  }

  return {
    proposalId: proposalCreated.args[0],
    decodedProposalCreatedEvent: proposalCreated,
    decodedProposalCreatedWithTypeEvent: proposalCreatedWithType,
  }
}

export async function setupGovernanceFixtureWithEmissions(): Promise<GovernanceFixture> {
  const fixture = await setupGovernanceFixture()
  await bootstrapEmissions({ emissions: fixture.emissions })
  return fixture
}
