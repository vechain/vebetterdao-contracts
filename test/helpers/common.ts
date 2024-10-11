import { ethers, network } from "hardhat"
import { B3TR, GalaxyMember, VeBetterPassport } from "../../typechain-types"
import { BaseContract, ContractFactory, ContractTransactionResponse } from "ethers"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { getOrDeployContractInstances } from "./deploy"
import { mine } from "@nomicfoundation/hardhat-network-helpers"
import { clauseBuilder } from "@vechain/sdk-core"
import { type TransactionClause, type TransactionBody } from "@vechain/sdk-core"
import { ZERO_ADDRESS } from "./const"
import { buildTxBody, signAndSendTx } from "../../scripts/helpers/txHelper"
import { getTestKeys } from "../../scripts/helpers/seedAccounts"

export const waitForNextBlock = async () => {
  if (network.name === "hardhat") {
    await mine(1)
    return
  }

  // since we do not support ethers' evm_mine yet, do a vet transaction to force a block
  const clauses: TransactionClause[] = []
  clauses.push(clauseBuilder.transferVET(ZERO_ADDRESS, BigInt(1)))

  const accounts = getTestKeys(3)
  const signer = accounts[2]

  const body: TransactionBody = await buildTxBody(clauses, signer.address, 32, 10_000_000)

  if (!signer.pk) throw new Error("No private key")

  return await signAndSendTx(body, signer.pk)
}

export const moveBlocks = async (blocks: number) => {
  for (let i = 0; i < blocks; i++) {
    await waitForNextBlock()
  }
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
  const { xAllocationVoting, governor, emissions } = await getOrDeployContractInstances({})

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
    roundId.toString(),
    0,
    {
      gasLimit: 10_000_000,
    },
  )

  return tx
}

export const getProposalIdFromTx = async (tx: ContractTransactionResponse, depositPayed: boolean = false) => {
  const { governor } = await getOrDeployContractInstances({})
  const proposeReceipt = await tx.wait()
  const event = depositPayed ? proposeReceipt?.logs[3] : proposeReceipt?.logs[0]

  const decodedLogs = governor.interface.parseLog({
    topics: [...(event?.topics as string[])],
    data: event ? event.data : "",
  })

  return decodedLogs?.args[0]
}

export const payDeposit = async (proposalId: string, depositer: HardhatEthersSigner) => {
  const { governor, vot3 } = await getOrDeployContractInstances({})

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

export const waitForVotingPeriodToEnd = async (proposalId: number) => {
  const { governor } = await getOrDeployContractInstances({})

  const deadline = await governor.proposalDeadline(proposalId)

  const currentBlock = await governor.clock()

  await moveBlocks(parseInt((deadline - currentBlock + BigInt(1)).toString()))
}

export const waitForRoundToEnd = async (roundId: number | BigInt) => {
  const { xAllocationVoting } = await getOrDeployContractInstances({})

  if (typeof roundId === "bigint") roundId = parseInt(roundId.toString())
  if (typeof roundId !== "number") throw new Error("Invalid roundId")

  const deadline = await xAllocationVoting.roundDeadline(roundId)

  const currentBlock = await xAllocationVoting.clock()

  await moveBlocks(parseInt((deadline - currentBlock + BigInt(1)).toString()))
}

export const waitForCurrentRoundToEnd = async () => {
  const { xAllocationVoting } = await getOrDeployContractInstances({})

  const currentRoundId = await xAllocationVoting.currentRoundId()
  await waitForRoundToEnd(Number(currentRoundId))
  await waitForNextBlock()
}

export const waitForProposalToBeActive = async (proposalId: number): Promise<bigint> => {
  const { governor } = await getOrDeployContractInstances({})
  let proposalState = await governor.state(proposalId) // proposal id of the proposal in the beforeAll step

  if (proposalState.toString() !== "1") {
    await moveToCycle(parseInt((await governor.proposalStartRound(proposalId)).toString()) + 1)

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
export const getVot3Tokens = async (receiver: HardhatEthersSigner, amount: string) => {
  const { b3tr, vot3, minterAccount } = await getOrDeployContractInstances({ forceDeploy: false })

  // Mint some B3TR
  await b3tr.connect(minterAccount).mint(receiver, ethers.parseEther(amount))

  // Approve VOT3 to spend B3TR on behalf of otherAccount. N.B. this is an important step and could be included in a multi clause transaction
  await b3tr.connect(receiver).approve(await vot3.getAddress(), ethers.parseEther(amount))

  // Lock B3TR to get VOT3
  await vot3.connect(receiver).convertToVOT3(ethers.parseEther(amount))
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

  // load votes
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
  const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
  await governor.queue(contractsToCall, Array(functionsToCall.length).fill(0), encodedFunctionCalls, descriptionHash, {
    gasLimit: 10_000_000,
  })
  await waitForNextBlock()

  // execute it
  // console.log("Executing");
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

export const addAppThroughGovernance = async (
  proposer: HardhatEthersSigner,
  voter: HardhatEthersSigner,
  appName: string = "Bike 4 Life" + Math.random(),
  appAddress: string,
  metadataURI: string = "metadataURI",
) => {
  const { xAllocationVoting } = await getOrDeployContractInstances({})

  await createProposalAndExecuteIt(
    proposer,
    voter,
    xAllocationVoting,
    await ethers.getContractFactory("XAllocationVoting"),
    "Add app to the list",
    "addApp",
    [appAddress, appAddress, appName, metadataURI],
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

export const waitForNextCycle = async () => {
  const { emissions } = await getOrDeployContractInstances({})

  const blockNextCycle = await emissions.getNextCycleBlock()

  await waitForBlock(Number(blockNextCycle))
}

/**
 * It will move to the desired cycle without actually distribute it.
 * E.g: we are in cycle 1 (distributed) and want to move to cycle 3 (not distributed) then we call this funciton with cycle 3
 * and it will distribute the cycle 2 and stop before distributing the cycle 3
 */
export const moveToCycle = async (cycle: number) => {
  const { emissions, minterAccount } = await getOrDeployContractInstances({})

  const cycleToBeDistributed = await emissions.nextCycle()

  for (let i = 0; i < BigInt(cycle) - cycleToBeDistributed; i++) {
    await waitForNextCycle()
    await emissions.connect(minterAccount).distribute()
  }
}

export const voteOnApps = async (
  apps: string[],
  voters: HardhatEthersSigner[],
  votes: Array<Array<bigint>>,
  roundId: bigint,
) => {
  const { xAllocationVoting, veBetterPassport } = await getOrDeployContractInstances({})

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
  const { x2EarnApps } = await getOrDeployContractInstances({})

  let appIds: string[] = []
  for (const app of apps) {
    await x2EarnApps.connect(owner).addApp(app, app, app, "metadataURI")
    appIds.push(ethers.keccak256(ethers.toUtf8Bytes(app)))
  }

  return appIds
}

export const startNewAllocationRound = async (): Promise<number> => {
  const { emissions, xAllocationVoting, minterAccount } = await getOrDeployContractInstances({})
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

export const participateInAllocationVoting = async (user: HardhatEthersSigner, waitRoundToEnd: boolean = false) => {
  const { xAllocationVoting, x2EarnApps, owner, veBetterPassport } = await getOrDeployContractInstances({})

  await getVot3Tokens(user, "1")
  await getVot3Tokens(owner, "1000")

  await veBetterPassport.whitelist(user.address)
  if ((await veBetterPassport.isCheckEnabled(1)) === false) await veBetterPassport.toggleCheck(1)

  const appName = "App" + Math.random()

  await x2EarnApps.connect(owner).addApp(user.address, user.address, appName, "metadataURI")
  const roundId = await startNewAllocationRound()

  // Vote
  await xAllocationVoting
    .connect(user)
    .castVote(roundId, [await x2EarnApps.hashAppName(appName)], [ethers.parseEther("1")])

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

export const bootstrapEmissions = async () => {
  const { b3tr, owner, emissions, minterAccount } = await getOrDeployContractInstances({})
  // Grant minter role to emissions contract
  await b3tr.connect(owner).grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())

  // Bootstrap emissions
  await emissions.connect(minterAccount).bootstrap()
}

export const bootstrapAndStartEmissions = async () => {
  const { emissions, minterAccount } = await getOrDeployContractInstances({})
  await bootstrapEmissions()

  // Start emissions
  await emissions.connect(minterAccount).start()
}

export const upgradeNFTtoLevel = async (
  tokenId: number,
  level: number,
  nft: GalaxyMember,
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
  nft: GalaxyMember,
  b3tr: B3TR,
  owner: HardhatEthersSigner,
  minter: HardhatEthersSigner,
) => {
  const b3trToUpgrade = await nft.getB3TRtoUpgrade(tokenId)

  await b3tr.connect(minter).mint(owner.address, b3trToUpgrade)

  await b3tr.connect(owner).approve(await nft.getAddress(), b3trToUpgrade)

  await nft.connect(owner).upgrade(tokenId)
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
