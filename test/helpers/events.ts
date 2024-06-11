import { BaseContract } from "ethers"
import { XAllocationVoting } from "../../typechain-types"
import { getOrDeployContractInstances } from "./deploy"

export const filterEventsByName = (events: any[], eventName: string) => {
  return events.filter(event => event.fragment && event.fragment.name === eventName)
}

export const decodeEvents = (contract: BaseContract, events: any[]) => {
  return events.map(event => {
    return decodeEvent(event, contract)
  })
}

export const decodeEvent = (event: any, contract: BaseContract) => {
  return contract.interface.parseLog({
    topics: event.topics,
    data: event.data,
  })
}

export const parseRoundStartedEvent = (
  event: any,
  xAllocationVoting: XAllocationVoting,
): {
  roundId: number
  proposer: string
  voteStart: BigInt
  voteEnd: BigInt
  appsIds: string[]
} => {
  const decoded = decodeEvent(event, xAllocationVoting)

  return {
    roundId: parseInt(decoded?.args[0].toString()),
    proposer: decoded?.args[1],
    voteStart: decoded?.args[2],
    voteEnd: decoded?.args[3],
    appsIds: decoded?.args[4],
  }
}

export const parseAllocationVoteCastEvent = (event: any, xAllocationVoting: XAllocationVoting) => {
  const decoded = decodeEvent(event, xAllocationVoting)

  return {
    voter: decoded?.args[0],
    roundId: decoded?.args[1],
    apps: decoded?.args[2],
    voteWeights: decoded?.args[3],
  }
}

export const parseAppAddedEvent = async (event: any) => {
  const { x2EarnApps } = await getOrDeployContractInstances({ forceDeploy: false })
  const decoded = decodeEvent(event, x2EarnApps)

  return {
    id: decoded?.args[0],
    address: decoded?.args[1],
  }
}
