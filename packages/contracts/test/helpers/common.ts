import { ethers, network } from "hardhat"
import {
  B3TR,
  Emissions,
  GalaxyMember,
  StargateNFT,
  VeBetterPassport,
  XAllocationVoting,
  Errors__factory,
  B3TRGovernor,
  GrantsManager,
  TimeLock,
  Treasury,
  VOT3,
  EmissionsV2,
  GalaxyMemberV5,
  GalaxyMemberV4,
  GalaxyMemberV3,
  GalaxyMemberV1,
  GalaxyMemberV2,
} from "../../typechain-types"
import { BaseContract, ContractFactory, ContractTransactionResponse, AddressLike } from "ethers"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { getOrDeployContractInstances } from "./deploy"
import { mine } from "@nomicfoundation/hardhat-network-helpers"
import { Clause, Units, VTHO } from "@vechain/sdk-core"
import { type TransactionClause } from "@vechain/sdk-core"
import { TransactionUtils } from "@repo/utils"
import { getConfig } from "@repo/config"
import { ThorClient } from "@vechain/sdk-network"
import { getTestKeys } from "../../scripts/helpers/seedAccounts"
import { endorseApp } from "./xnodes"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { createLocalConfig } from "@repo/config/contracts/envs/local"

const thorClient = ThorClient.at(getConfig().nodeUrl)

export const waitForNextBlock = async () => {
  if (network.name === "hardhat") {
    await mine(1)
    return
  }

  const accounts = getTestKeys(2)
  const source = accounts[0]
  const target = accounts[1]

  if (!source.pk) throw new Error("No private key")

  // since we do not support ethers' evm_mine yet, do a vet transaction to force a block
  const clauses: TransactionClause[] = []
  clauses.push(Clause.transferVTHOToken(target.address, VTHO.of(1, Units.wei)))

  await TransactionUtils.sendTx(thorClient, clauses, source.pk)
}

export const moveBlocks = async (blocks: number) => {
  for (let i = 0; i < blocks; i++) {
    await waitForNextBlock()
  }
}

// Extract the Contracts type from the deployment function
type Contracts = Awaited<ReturnType<typeof getOrDeployContractInstances>>

// Allow overriding fixture contracts instead of redeploying each time
export const getContractInstances = async (overrides?: Partial<Contracts>): Promise<NonNullable<Contracts>> => {
  const instances = await getOrDeployContractInstances({})
  if (!instances) throw new Error("Failed to get contract instances")
  return {
    ...instances,
    ...overrides,
  }
}

export const getRoundId = async (contractToPassToMethods?: any) => {
  const { emissions, xAllocationVoting } = await getContractInstances(contractToPassToMethods)
  if ((await emissions.nextCycle()) === 0n) {
    await bootstrapAndStartEmissions(contractToPassToMethods)
  }
  const roundId = ((await xAllocationVoting.currentRoundId()) + 1n).toString()
  return roundId
}

export const createProposal = async (
  contractToCall: BaseContract,
  ContractFactory: ContractFactory,
  proposer: HardhatEthersSigner,
  description: string = "",
  functionTocall: string = "tokenDetails",
  values: any[] = [],
  roundId?: string | BigInt | number,
): Promise<ContractTransactionResponse> => {
  const deployInstances = await getOrDeployContractInstances({})

  const xAllocationVoting = deployInstances?.xAllocationVoting
  const governor = deployInstances?.governor
  const emissions = deployInstances?.emissions
  if (!xAllocationVoting || !governor || !emissions) throw new Error("Deploy instances are not correctly set")

  if (!roundId) {
    // to ensure that test will work correctly before creating a proposal we wait for current round to end
    // and start a new one
    if ((await emissions.nextCycle()) === 0n) {
      // if emissions are not started yet, we need to bootstrap and start them
      await bootstrapAndStartEmissions()
    } else {
      // otherwise we need to wait for the current round to end and start the next one
      await waitForCurrentRoundToEnd()
      await emissions.distribute()
    }
    roundId = ((await xAllocationVoting.currentRoundId()) + 1n).toString()
  }

  const address = await contractToCall.getAddress()
  const encodedFunctionCall = ContractFactory.interface.encodeFunctionData(functionTocall, values)

  const tx = await governor
    .connect(proposer)
    .propose([address], [0], [encodedFunctionCall], description, roundId.toString(), 0, {
      gasLimit: 10_000_000,
    })

  return tx
}

export const createGrantProposal = async (
  proposer: HardhatEthersSigner,
  targets: string[],
  calldatas: any[],
  values: bigint[] = [],
  description: string,
  depositAmount: number,
  grantsReceiver: string,
  milestonesDetailsMetadataURI: string,
  contractToPassToMethods?: any,
  roundId?: string,
) => {
  const { governor } = await getContractInstances(contractToPassToMethods)

  if (!roundId) {
    roundId = await getRoundId(contractToPassToMethods)
  }

  const noDepositAmountFromGrantee = 0

  const tx = await governor
    .connect(proposer)
    .proposeGrant(
      targets,
      values,
      calldatas,
      description,
      roundId,
      noDepositAmountFromGrantee,
      grantsReceiver,
      milestonesDetailsMetadataURI,
      {
        gasLimit: 10_000_000,
      },
    )

  return tx
}

export const createMultiContractProposalGrant = async (
  proposer: HardhatEthersSigner,
  calldatas: string[],
  values: bigint[],
  targets: string[],
  description: string,
  depositAmount: any,
  grantsReceiver: string,
  milestonesDetailsMetadataURI: string,
  roundId?: string,
  contractToPassToMethods?: any,
) => {
  const { governor } = await getContractInstances(contractToPassToMethods)

  if (!roundId) {
    roundId = await getRoundId(contractToPassToMethods)
  }

  const tx = await governor
    .connect(proposer)
    .proposeGrant(
      targets,
      values,
      calldatas,
      description,
      roundId.toString(),
      depositAmount,
      grantsReceiver,
      milestonesDetailsMetadataURI,
      {
        gasLimit: 10_000_000,
      },
    )
  return tx
}

export const createProposalWithMultipleFunctionsAndExecuteItGrant = async (
  proposer: HardhatEthersSigner,
  voter: HardhatEthersSigner,
  contractsToCall: BaseContract[],
  Contract: ContractFactory,
  description: string,
  functionsToCall: string[],
  args: any[][],
  depositAmount: any,
  grantsReceiver: string,
  milestonesDetailsMetadataURI: string,
  contractToPassToMethods?: any,
  roundId?: string,
) => {
  const { governor, veBetterPassport, owner, treasury } = await getContractInstances(contractToPassToMethods)

  await veBetterPassport.whitelist(voter.address)
  if ((await veBetterPassport.isCheckEnabled(1)) === false) await veBetterPassport.toggleCheck(1)

  // load votes
  // console.log("Loading votes")
  await getVot3Tokens(voter, "300000", contractToPassToMethods)
  await waitForNextBlock()

  if (!roundId) {
    roundId = await getRoundId(contractToPassToMethods)
  }

  const targets: string[] = []
  const calldatas: string[] = []
  const values: bigint[] = []

  for (let i = 0; i < functionsToCall.length; i++) {
    const func = functionsToCall[i]
    const argsForFunc = args[i]

    targets.push(await treasury.getAddress())
    calldatas.push(Contract.interface.encodeFunctionData(func, argsForFunc))
    values.push(0n)
  }

  const noDepositAmountFromGrantee = 0
  depositAmount = noDepositAmountFromGrantee
  // create a new proposal
  // console.log("Creating proposal")
  const tx = await createMultiContractProposalGrant(
    proposer,
    calldatas,
    values,
    targets,
    description,
    depositAmount,
    grantsReceiver,
    milestonesDetailsMetadataURI,
    roundId,
    contractToPassToMethods,
  )

  // change the all function to be compatible with grants proposal
  const proposalId = await getProposalIdFromGrantsProposalTx(tx, contractToPassToMethods)
  await payDeposit(proposalId, owner, contractToPassToMethods)

  // wait
  // console.log("Waiting for voting period to start")
  await waitForProposalToBeActive(proposalId, contractToPassToMethods)

  // vote
  // console.log("Voting")
  await governor.connect(voter).castVote(proposalId, 1, { gasLimit: 10_000_000 }) // vote for

  // wait
  // console.log("Waiting for voting period to end")
  await waitForVotingPeriodToEnd(proposalId, contractToPassToMethods)

  // queue it
  // console.log("Queueing")
  const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
  await governor.queue(targets, values, calldatas, descriptionHash, {
    gasLimit: 10_000_000,
  })
  await waitForNextBlock()

  // for all the contracts, whitelist the function
  for (const contract of contractsToCall) {
    await governor
      .connect(owner)
      .setWhitelistFunction(
        await contract.getAddress(),
        contract.interface.getFunction("transferB3TR")?.selector as string,
        true,
      )
  }
  // execute it
  // console.log("Executing")
  await governor.connect(owner).execute(targets, values, calldatas, descriptionHash, {
    gasLimit: 10_000_000,
  })

  return { proposalId, tx }
}

export const createProposalWithMultipleFunctions = async (
  proposer: HardhatEthersSigner,
  contractToCalls: BaseContract[],
  Contract: ContractFactory,
  description: string,
  functionsToCall: string[],
  args: any[],
  roundId?: string,
) => {
  const { governor, emissions, xAllocationVoting } = await getOrDeployContractInstances({})

  if (!roundId) {
    // to ensure that test will work correctly before creating a proposal we wait for current round to end
    // and start a new one
    if ((await emissions.nextCycle()) === 0n) {
      // if emissions are not started yet, we need to bootstrap and start them
      await bootstrapAndStartEmissions()
    } else {
      // otherwise we need to wait for the current round to end and start the next one
      await waitForCurrentRoundToEnd()
      await emissions.distribute()
    }
    roundId = ((await xAllocationVoting.currentRoundId()) + 1n).toString()
  }

  // create a new proposal
  const tx = await governor.connect(proposer).propose(
    contractToCalls,
    Array(functionsToCall.length).fill(0),
    functionsToCall.map((func, index) => {
      return Contract.interface.encodeFunctionData(func, args[index])
    }),
    description,
    roundId,
    0, //No deposit amount
  )

  return tx
}

export const getProposalIdFromTx = async (
  tx: ContractTransactionResponse,
  depositPayed: boolean = false,
  contractToPassToMethods?: any,
) => {
  const { governor } = await getContractInstances(contractToPassToMethods)
  const proposeReceipt = await tx.wait()
  const event = depositPayed ? proposeReceipt?.logs[3] : proposeReceipt?.logs[0]

  const decodedLogs = governor.interface.parseLog({
    topics: [...(event?.topics as string[])],
    data: event ? event.data : "",
  })

  return decodedLogs?.args[0]
}

export const getProposalIdFromGrantsProposalTx = async (
  tx: ContractTransactionResponse,
  contractToPassToMethods?: any,
) => {
  const { governor } = await getContractInstances(contractToPassToMethods)
  const proposeReceipt = await tx.wait()

  // Find the ProposalCreated event
  const proposalCreatedEvent = proposeReceipt?.logs.find(log => {
    try {
      const decoded = governor.interface.parseLog({
        topics: [...log.topics],
        data: log.data,
      })
      return decoded?.name === "ProposalCreated"
    } catch (e) {
      return false
    }
  })

  if (!proposalCreatedEvent) {
    throw new Error("ProposalCreated event not found")
  }

  // Parse the ProposalCreated event
  const decodedEvent = governor.interface.parseLog({
    topics: [...proposalCreatedEvent.topics],
    data: proposalCreatedEvent.data,
  })

  // The proposal ID is the first argument
  const proposalId = decodedEvent?.args[0]

  return proposalId
}

export const payDeposit = async (proposalId: string, depositer: HardhatEthersSigner, contractToPassToMethods?: any) => {
  const { governor, vot3 } = await getContractInstances(contractToPassToMethods)

  // get the proposal deposit amount
  const proposalThreshold = await governor.proposalDepositThreshold(proposalId)

  const vot3Balance = await vot3.balanceOf(depositer.address)
  if (proposalThreshold > vot3Balance) {
    //The proposer needs to have some delegated VOT3 to be able to create a proposal
    await getVot3Tokens(depositer, ethers.formatEther(proposalThreshold))
    // We also need to wait a block to update the proposer's votes snapshot
    await waitForNextBlock()
  }

  await vot3.connect(depositer).approve(await governor.getAddress(), proposalThreshold)
  await governor.connect(depositer).deposit(proposalThreshold, proposalId)
}

export const waitForVotingPeriodToEnd = async (proposalId: number, contractToPassToMethods?: any) => {
  const { governor } = await getContractInstances(contractToPassToMethods)

  const deadline = await governor.proposalDeadline(proposalId)

  const currentBlock = await governor.clock()

  await moveBlocks(parseInt((deadline - currentBlock + BigInt(1)).toString()))
}

export const waitForRoundToEnd = async (roundId: number | BigInt, xAllocationVoting?: XAllocationVoting) => {
  const instance = await getOrDeployContractInstances({
    forceDeploy: false,
  })

  if (!xAllocationVoting) xAllocationVoting = instance.xAllocationVoting as XAllocationVoting

  if (typeof roundId === "bigint") roundId = parseInt(roundId.toString())
  if (typeof roundId !== "number") throw new Error("Invalid roundId")

  const deadline = await xAllocationVoting.roundDeadline(roundId)

  const currentBlock = await xAllocationVoting.clock()

  await moveBlocks(parseInt((deadline - currentBlock + BigInt(1)).toString()))
}

export const waitForCurrentRoundToEnd = async (contractToPassToMethods?: any) => {
  const { xAllocationVoting } = await getContractInstances(contractToPassToMethods)

  const currentRoundId = await xAllocationVoting.currentRoundId()
  await waitForRoundToEnd(Number(currentRoundId), xAllocationVoting)
  await waitForNextBlock()
}

export const waitForProposalToBeActive = async (proposalId: number, contractToPassToMethods?: any): Promise<bigint> => {
  const { governor } = await getContractInstances(contractToPassToMethods)
  let proposalState = await governor.state(proposalId) // proposal id of the proposal in the beforeAll step

  if (proposalState.toString() !== "1") {
    await moveToCycle(parseInt((await governor.proposalStartRound(proposalId)).toString()) + 1, contractToPassToMethods)

    // Update the proposal state
    proposalState = await governor.state(proposalId)
  }

  return proposalState
}

/**
 * Calls the timelock to see if the operation is ready
 *
 * @param proposalId the proposal id
 */
export const waitForQueuedProposalToBeReady = async (proposalId: number) => {
  const { timeLock, governor } = await getOrDeployContractInstances({})

  const timelockId = await governor.getTimelockId(proposalId)

  let isOperationReady = await timeLock.isOperationReady(timelockId)

  do {
    await moveBlocks(1)
    isOperationReady = await timeLock.isOperationReady(timelockId)
  } while (isOperationReady === false)
}

// Mint some B3TR and Convert B3TR for VOT3
export const getVot3Tokens = async (receiver: HardhatEthersSigner, amount: string, contractToPassToMethods?: any) => {
  const { b3tr, vot3, minterAccount } = await getContractInstances(contractToPassToMethods)

  // Mint some B3TR
  await b3tr.connect(minterAccount).mint(receiver, ethers.parseEther(amount))

  // Approve VOT3 to spend B3TR on behalf of otherAccount. N.B. this is an important step and could be included in a multi clause transaction
  await b3tr.connect(receiver).approve(await vot3.getAddress(), ethers.parseEther(amount))

  // Lock B3TR to get VOT3
  await vot3.connect(receiver).convertToVOT3(ethers.parseEther(amount))
}

export const updateGMMultipliers = async () => {
  const config = createLocalConfig()
  const { voterRewards, owner } = await getOrDeployContractInstances({})

  for (let i = 0; i < config.VOTER_REWARDS_LEVELS_V2.length; i++) {
    const level = config.VOTER_REWARDS_LEVELS_V2[i]
    const multiplier = config.GM_MULTIPLIERS_V2[i]

    // Update the multiplier for the level
    await voterRewards.connect(owner).setLevelToMultiplier(level, multiplier)
  }
}

export const createProposalAndExecuteIt = async (
  proposer: HardhatEthersSigner,
  voter: HardhatEthersSigner,
  contractToCall: BaseContract,
  Contract: ContractFactory,
  description: string,
  functionToCall: string,
  args: any[] = [],
  roundId?: string | bigint | number,
) => {
  const { governor, veBetterPassport } = await getOrDeployContractInstances({})

  // console.log("Loading votes");
  await getVot3Tokens(voter, "30000")
  await waitForNextBlock()

  await veBetterPassport.whitelist(voter.address)
  if ((await veBetterPassport.isCheckEnabled(1)) === false) await veBetterPassport.toggleCheck(1)

  // create a new proposal
  // console.log("Creating proposal");
  const tx = await createProposal(contractToCall, Contract, proposer, description, functionToCall, args, roundId)
  const proposalId = await getProposalIdFromTx(tx)
  await payDeposit(proposalId, proposer)

  // wait
  // console.log("Waiting for voting period to start");
  await waitForProposalToBeActive(proposalId)

  // vote
  // console.log("Voting");
  await governor.connect(voter).castVote(proposalId, 1, { gasLimit: 10_000_000 }) // vote for

  // wait
  // console.log("Waiting for voting period to end");
  await waitForVotingPeriodToEnd(proposalId)

  // queue it
  // console.log("Queueing");
  const encodedFunctionCall = Contract.interface.encodeFunctionData(functionToCall, args)
  const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
  await governor.queue([await contractToCall.getAddress()], [0], [encodedFunctionCall], descriptionHash, {
    gasLimit: 10_000_000,
  })
  await waitForNextBlock()

  // execute it
  // console.log("Executing");
  const extecutionTX = await governor.execute(
    [await contractToCall.getAddress()],
    [0],
    [encodedFunctionCall],
    descriptionHash,
    {
      gasLimit: 10_000_000,
    },
  )

  return extecutionTX
}

export const createProposalWithMultipleFunctionsAndExecuteIt = async (
  proposer: HardhatEthersSigner,
  voter: HardhatEthersSigner,
  contractsToCall: BaseContract[],
  Contract: ContractFactory,
  description: string,
  functionsToCall: string[],
  args: any[][],
  roundId?: string,
) => {
  const { governor, emissions, xAllocationVoting, veBetterPassport } = await getOrDeployContractInstances({})

  await veBetterPassport.whitelist(voter.address)
  if ((await veBetterPassport.isCheckEnabled(1)) === false) await veBetterPassport.toggleCheck(1)

  // load votes
  // console.log("Loading votes");
  await getVot3Tokens(voter, "30000")
  await waitForNextBlock()

  if (!roundId) {
    // to ensure that test will work correctly before creating a proposal we wait for current round to end
    // and start a new one
    if ((await emissions.nextCycle()) === 0n) {
      // if emissions are not started yet, we need to bootstrap and start them
      await bootstrapAndStartEmissions()
    } else {
      // otherwise we need to wait for the current round to end and start the next one
      await waitForCurrentRoundToEnd()
      await emissions.distribute()
    }
    roundId = ((await xAllocationVoting.currentRoundId()) + 1n).toString()
  }

  // Encode functions
  const encodedFunctionCalls = functionsToCall.map((func, index) => {
    return Contract.interface.encodeFunctionData(func, args[index])
  })

  // create a new proposal
  const tx = await createProposalWithMultipleFunctions(
    proposer,
    contractsToCall,
    Contract,
    description,
    functionsToCall,
    args,
    roundId,
  )

  // change the all function to be compatible with grants proposal
  const proposalId = await getProposalIdFromGrantsProposalTx(tx)
  await payDeposit(proposalId, proposer)

  // wait
  // console.log("Waiting for voting period to start");
  await waitForProposalToBeActive(proposalId)

  // vote
  // console.log("Voting");
  await governor.connect(voter).castVote(proposalId, 1, { gasLimit: 10_000_000 }) // vote for

  // wait
  // console.log("Waiting for voting period to end");
  await waitForVotingPeriodToEnd(proposalId)

  // queue it
  // console.log("Queueing");
  const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
  await governor.queue(contractsToCall, Array(functionsToCall.length).fill(0), encodedFunctionCalls, descriptionHash, {
    gasLimit: 10_000_000,
  })
  await waitForNextBlock()

  // execute it
  console.log("Executing")
  await governor.execute(
    contractsToCall,
    Array(functionsToCall.length).fill(0),
    encodedFunctionCalls,
    descriptionHash,
    {
      gasLimit: 10_000_000,
    },
  )
}

export const waitForBlock = async (blockNumber: number) => {
  const currentBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber())

  if (!currentBlock?.number) throw new Error("Could not get current block number")

  if (currentBlock?.number < blockNumber) {
    // Get blocks required to wait
    const blocksToWait = blockNumber - currentBlock?.number

    if (blocksToWait > 0) await moveBlocks(blocksToWait)
  }
}

export const waitForNextCycle = async (emission?: Emissions | EmissionsV2) => {
  if (!emission) {
    const { emissions } = await getContractInstances()
    emission = emissions as Emissions
  }
  const blockNextCycle = await emission.getNextCycleBlock()

  await waitForBlock(Number(blockNextCycle))
}

/**
 * It will move to the desired cycle without actually distribute it.
 * E.g: we are in cycle 1 (distributed) and want to move to cycle 3 (not distributed) then we call this funciton with cycle 3
 * and it will distribute the cycle 2 and stop before distributing the cycle 3
 */
export const moveToCycle = async (cycle: number, contractToPassToMethods?: any) => {
  const { emissions, minterAccount } = await getContractInstances(contractToPassToMethods)

  const cycleToBeDistributed = await emissions.nextCycle()

  for (let i = 0; i < BigInt(cycle) - cycleToBeDistributed; i++) {
    await waitForNextCycle(emissions)
    await emissions.connect(minterAccount).distribute()
  }
}

export const voteOnApps = async (
  apps: string[],
  voters: HardhatEthersSigner[],
  votes: Array<Array<bigint>>,
  roundId: bigint,
  xAllocationVoting?: XAllocationVoting,
  veBetterPassport?: VeBetterPassport,
) => {
  const instance = await getOrDeployContractInstances({})
  if (!veBetterPassport) veBetterPassport = instance.veBetterPassport as VeBetterPassport
  if (!xAllocationVoting) xAllocationVoting = instance.xAllocationVoting as XAllocationVoting

  if ((await veBetterPassport.isCheckEnabled(1)) === false) await veBetterPassport.toggleCheck(1)

  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i]
    const voterVotes = votes[i]

    await veBetterPassport.whitelist(voter.address)

    // Filter out both zero votes and their corresponding apps
    const filteredData = apps
      .map((app, index) => ({
        app,
        vote: voterVotes[index],
      }))
      .filter(data => data.vote !== BigInt(0))

    // If there are any valid votes left, proceed with voting
    if (filteredData.length > 0) {
      const validApps = filteredData.map(data => data.app)
      const validVotes = filteredData.map(data => data.vote)

      // Execute the vote with the filtered non-zero votes and corresponding apps
      await xAllocationVoting.connect(voter).castVote(roundId, validApps, validVotes)
    }
  }
}

export const addAppsToAllocationVoting = async (apps: string[], owner: HardhatEthersSigner) => {
  const { x2EarnApps, otherAccounts } = await getOrDeployContractInstances({})

  let appIds: string[] = []
  let i = 0
  for (const app of apps) {
    await x2EarnApps.connect(owner).submitApp(app, app, app, "metadataURI")
    const appId = await x2EarnApps.hashAppName(app)
    appIds.push(appId)
    await endorseApp(appId, otherAccounts[i])
    i++
  }

  return appIds
}

export const startNewAllocationRound = async (contractToPassToMethods?: any): Promise<number> => {
  const { emissions, xAllocationVoting, minterAccount } = await getContractInstances(contractToPassToMethods)
  const nextCycle = await emissions.nextCycle()

  if (nextCycle === 0n) {
    await bootstrapAndStartEmissions()
  } else if (nextCycle === 1n) {
    await emissions.connect(minterAccount).start()
  } else if (await emissions.isCycleEnded(await emissions.getCurrentCycle())) {
    await emissions.distribute()
  }
  return Number(await xAllocationVoting.currentRoundId())
}

export const calculateBaseAllocationOffChain = async (roundId: number) => {
  const { emissions, xAllocationVoting } = await getOrDeployContractInstances({})

  // Amount available for this round (assuming the amount is already scaled by 1e18 for precision)
  let totalAmount = await emissions.getXAllocationAmount(roundId)

  let elegibleApps = await xAllocationVoting.getAppIdsOfRound(roundId)

  const baseAllcoationPercentage = await xAllocationVoting.getRoundBaseAllocationPercentage(roundId)

  let remaining = (totalAmount * baseAllcoationPercentage) / BigInt(100)

  let amountPerApp = remaining / BigInt(elegibleApps.length)

  return amountPerApp
}

export const calculateVariableAppAllocationOffChain = async (roundId: number, appId: string) => {
  const { emissions, xAllocationVoting, xAllocationPool } = await getOrDeployContractInstances({})

  // Amount available for this round (assuming the amount is already scaled by 1e18 for precision)
  let totalAmount = await emissions.getXAllocationAmount(roundId)

  let totalAvailable =
    (totalAmount * (BigInt(100) - (await xAllocationVoting.getRoundBaseAllocationPercentage(roundId)))) / BigInt(100)

  const roundAppShares = await xAllocationPool.getAppShares(roundId, appId)

  let appShares = roundAppShares[0] / BigInt(100)

  return (totalAvailable * appShares) / BigInt(100)
}

export const calculateUnallocatedAppAllocationOffChain = async (roundId: number, appId: string) => {
  const { emissions, xAllocationVoting, xAllocationPool } = await getOrDeployContractInstances({})

  // Amount available for this round (assuming the amount is already scaled by 1e18 for precision)
  let totalAmount = await emissions.getXAllocationAmount(roundId)

  let totalAvailable =
    (totalAmount * (BigInt(100) - (await xAllocationVoting.getRoundBaseAllocationPercentage(roundId)))) / BigInt(100)

  const roundAppShares = await xAllocationPool.getAppShares(roundId, appId)

  let appShares = roundAppShares[1] / BigInt(100)

  return (totalAvailable * appShares) / BigInt(100)
}

export const participateInAllocationVoting = async (
  user: HardhatEthersSigner,
  waitRoundToEnd: boolean = false,
  endorser?: HardhatEthersSigner,
) => {
  const { xAllocationVoting, x2EarnApps, owner, veBetterPassport, x2EarnCreator } = await getOrDeployContractInstances(
    {},
  )

  await getVot3Tokens(user, "1")
  await getVot3Tokens(owner, "1000")

  await veBetterPassport.whitelist(user.address)
  if ((await veBetterPassport.isCheckEnabled(1)) === false) await veBetterPassport.toggleCheck(1)

  // Get or create app ID
  let appId: string | undefined
  const appsAlreadySubmitted = await x2EarnApps.isCreatorOfAnyApp(user.address)

  if (!appsAlreadySubmitted) {
    // Create new app
    const appName = "App" + Math.random()
    if ((await x2EarnCreator.balanceOf(user.address)) === 0n) {
      await x2EarnCreator.connect(owner).safeMint(user.address)
    }
    await x2EarnApps.connect(user).submitApp(user.address, user.address, appName, "metadataURI")
    appId = await x2EarnApps.hashAppName(appName)
    await endorseApp(appId, endorser || owner)
  } else {
    // We will work with the already submitted app
    const allEligibleApps = await x2EarnApps.allEligibleApps()

    for (const app of allEligibleApps) {
      const creators = await x2EarnApps.appCreators(app)
      if (creators.length > 0 && creators[0].toLowerCase() === user.address.toLowerCase()) {
        appId = app
        break
      }
    }
    // If no app found for this user, use first eligible app as fallback
    if (!appId && allEligibleApps.length > 0) {
      appId = allEligibleApps[0]
      console.log("Using fallback app:", appId)
    } else if (!appId) {
      console.warn("No eligible apps found for user")
      return
    }
  }

  // Start round and vote (common for both paths)
  const roundId = await startNewAllocationRound()
  await xAllocationVoting.connect(user).castVote(roundId, [appId], [ethers.parseEther("1")])

  if (waitRoundToEnd) {
    await waitForRoundToEnd(roundId)
  }
}

export const participateInGovernanceVoting = async (
  user: HardhatEthersSigner,
  admin: HardhatEthersSigner,
  contractToCall: BaseContract,
  Contract: ContractFactory,
  description: string,
  functionToCall: string,
  args: any[] = [],
  waitProposalToEnd: boolean = false,
) => {
  const { governor, veBetterPassport } = await getOrDeployContractInstances({})

  await getVot3Tokens(user, "1")
  await getVot3Tokens(admin, "1000")

  await veBetterPassport.connect(admin).whitelist(user.address)
  if ((await veBetterPassport.isCheckEnabled(1)) === false) await veBetterPassport.toggleCheck(1)

  const tx = await createProposal(contractToCall, Contract, admin, description, functionToCall, args)
  const proposalId = await getProposalIdFromTx(tx)

  // pay for the deposit
  await payDeposit(proposalId, admin)

  await waitForProposalToBeActive(proposalId)

  // Vote
  await governor.connect(user).castVote(proposalId, 1)

  if (waitProposalToEnd) {
    await waitForVotingPeriodToEnd(proposalId)
  }
}

export const bootstrapEmissions = async (contractToPassToMethods?: any) => {
  const { b3tr, owner, emissions, minterAccount } = await getContractInstances(contractToPassToMethods)
  // Grant minter role to emissions contract
  await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

  // Bootstrap emissions
  await emissions.connect(minterAccount).bootstrap()
}

export const bootstrapAndStartEmissions = async (contractToPassToMethods?: any) => {
  const { emissions, minterAccount } = await getContractInstances(contractToPassToMethods)
  await bootstrapEmissions(contractToPassToMethods)

  // Start emissions
  await emissions.connect(minterAccount).start()
}

export const upgradeNFTtoLevel = async (
  tokenId: number,
  level: number,
  nft: GalaxyMember | GalaxyMemberV1 | GalaxyMemberV2 | GalaxyMemberV3 | GalaxyMemberV4 | GalaxyMemberV5,
  b3tr: B3TR,
  owner: HardhatEthersSigner,
  minter: HardhatEthersSigner,
) => {
  const currentLevel = await nft.levelOf(tokenId)

  for (let i = currentLevel; i < level; i++) {
    await upgradeNFTtoNextLevel(tokenId, nft, b3tr, owner, minter)
  }
}

export const upgradeNFTtoNextLevel = async (
  tokenId: number,
  nft: GalaxyMember | GalaxyMemberV1 | GalaxyMemberV2 | GalaxyMemberV3 | GalaxyMemberV4 | GalaxyMemberV5,
  b3tr: B3TR,
  owner: HardhatEthersSigner,
  minter: HardhatEthersSigner,
) => {
  const b3trToUpgrade = await nft.getB3TRtoUpgrade(tokenId)

  await b3tr.connect(minter).mint(owner.address, b3trToUpgrade)

  await b3tr.connect(owner).approve(await nft.getAddress(), b3trToUpgrade)

  await nft.connect(owner).upgrade(tokenId)
}

/**
 * Helper function to get storage slots.
 * @param contractAddress The address of the contract.
 * @param initialSlots The initial storage slots.
 * @returns Array of storage slots.
 */
export const getStorageSlots = async (contractAddress: AddressLike, ...initialSlots: bigint[]) => {
  const slots = []

  for (const initialSlot of initialSlots) {
    for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
      slots.push(await ethers.provider.getStorage(contractAddress, i))
    }
  }

  return slots.filter(slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000") // Removing empty slots
}

export const mintLegacyNode = async (
  level: number,
  owner: HardhatEthersSigner,
): Promise<[string, bigint, boolean, boolean, bigint, bigint, bigint]> => {
  const { vechainNodesMock } = await getOrDeployContractInstances({})

  if (!vechainNodesMock) throw new Error("VechainNodesMock not found")

  const blockNumBefore = await ethers.provider.getBlockNumber()
  const blockBefore = await ethers.provider.getBlock(blockNumBefore)
  if (!blockBefore) throw new Error("Block before not found")

  const timestampBefore = blockBefore.timestamp
  const nextBlockTimestamp = timestampBefore + 1000
  await time.setNextBlockTimestamp(nextBlockTimestamp)

  await vechainNodesMock.addToken(owner.address, level, false, 0, 0)

  return [
    owner.address,
    BigInt(level),
    false,
    false,
    ethers.toBigInt(nextBlockTimestamp),
    ethers.toBigInt(nextBlockTimestamp),
    ethers.toBigInt(nextBlockTimestamp),
  ]
}

export const delegateWithSignature = async (
  veBetterPassport: VeBetterPassport,
  delegator: HardhatEthersSigner,
  delegatee: HardhatEthersSigner,
  deadlineFromNow: number, // seconds from now
) => {
  const blockNumber = await ethers.provider.getBlockNumber()
  const currentBlockTimestamp = (await ethers.provider.getBlock(blockNumber))?.timestamp

  if (!currentBlockTimestamp) throw new Error("Could not get current block timestamp")

  // Calculate the deadline
  const deadline = currentBlockTimestamp + deadlineFromNow

  // Set up EIP-712 domain
  const domain = {
    name: "VeBetterPassport",
    version: "1",
    chainId: 1337,
    verifyingContract: await veBetterPassport.getAddress(),
  }
  let types = {
    Delegation: [
      { name: "delegator", type: "address" },
      { name: "delegatee", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
  }

  // Prepare the struct to sign
  const delegationData = {
    delegator: delegator.address,
    delegatee: delegatee.address,
    deadline,
  }

  // Create the EIP-712 signature for the delegator
  const signature = await delegator.signTypedData(domain, types, delegationData)

  // Perform the delegation using the signature
  await veBetterPassport.connect(delegatee).delegateWithSignature(delegator.address, deadline, signature)
}

export const linkEntityToPassportWithSignature = async (
  veBetterPassport: VeBetterPassport,
  passport: HardhatEthersSigner,
  entity: HardhatEthersSigner,
  deadlineFromNow: number, // seconds from now
) => {
  const blockNumber = await ethers.provider.getBlockNumber()
  const currentBlockTimestamp = (await ethers.provider.getBlock(blockNumber))?.timestamp

  if (!currentBlockTimestamp) throw new Error("Could not get current block timestamp")

  // Calculate the deadline
  const deadline = currentBlockTimestamp + deadlineFromNow

  // Set up EIP-712 domain
  const domain = {
    name: "VeBetterPassport",
    version: "1",
    chainId: 1337,
    verifyingContract: await veBetterPassport.getAddress(),
  }
  let types = {
    LinkEntity: [
      { name: "entity", type: "address" },
      { name: "passport", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
  }

  // Prepare the struct to sign
  const delegationData = {
    entity: entity.address,
    passport: passport.address,
    deadline,
  }

  // Create the EIP-712 signature for the delegator
  const signature = await entity.signTypedData(domain, types, delegationData)

  // Perform the delegation using the signature
  await veBetterPassport.connect(passport).linkEntityToPassportWithSignature(entity.address, deadline, signature)
}

export const getTwoUniqueRandomIndices = (max: number) => {
  const firstIndex = Math.floor(Math.random() * max)
  let secondIndex
  do {
    secondIndex = Math.floor(Math.random() * max)
  } while (secondIndex === firstIndex)
  return [firstIndex, secondIndex]
}

// Since we moved errors to a separate library, our tests expect the
// error from the library instead of from the contract.
// The most common pattern people use in their tests when using library
// errors is to create a test helper like this one.
export const getStargateNFTErrorsInterface = async (_stargateNFTContract?: StargateNFT) => {
  const { stargateNftMock } = await getOrDeployContractInstances({
    forceDeploy: false,
  })

  const addressToUse = _stargateNFTContract
    ? await _stargateNFTContract.getAddress()
    : await stargateNftMock.getAddress()

  return Errors__factory.connect(addressToUse, ethers.provider)
}
