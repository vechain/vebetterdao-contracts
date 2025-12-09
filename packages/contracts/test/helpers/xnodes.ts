import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { ContractTransactionResponse } from "ethers"

import { getOrDeployContractInstances } from "./deploy"
import { mintLegacyNode } from "./common"
import { nodeManagement } from "../../typechain-types/contracts/mocks/Stargate"

export const getNodeIdFromStakeTx = async (tx: ContractTransactionResponse) => {
  const { stargateNftMock } = await getOrDeployContractInstances({})

  const nodeStakeTxReceipt = await tx.wait()

  // Find the Transfer event and decode it to get the tokenId
  const transferEvent = nodeStakeTxReceipt?.logs
    .map(log => {
      try {
        return stargateNftMock.interface.parseLog({ topics: log.topics as string[], data: log.data })
      } catch {
        return null
      }
    })
    .find(event => event?.name === "Transfer")

  if (!transferEvent) throw new Error("No Transfer event found")
  const nodeId = transferEvent.args.tokenId

  return nodeId
}

export const endorseApp = async (appId: string, endorser: HardhatEthersSigner, useLegacyNode: boolean = false) => {
  const { x2EarnApps, nodeManagement } = await getOrDeployContractInstances({})

  let nodeId: bigint
  // Create a MjolnirX node holder => score = 100
  if (useLegacyNode) {
    await mintLegacyNode(7, endorser)
    const ownerNodes = await nodeManagement.getUserNodes(endorser.address)
    nodeId = ownerNodes[0].nodeId
  } else {
    nodeId = await createNodeHolder(7, endorser)
  }

  const tx = await x2EarnApps.connect(endorser).endorseApp(appId, nodeId)
  const txReceipt = await tx.wait()

  const event = txReceipt?.logs[0]

  if (!event) throw new Error("No endorsement event found")

  return { nodeId, txReceipt }
}

export const createNodeHolder = async (level: number, endorser: HardhatEthersSigner) => {
  const { stargateMock, stargateNftMock } = await getOrDeployContractInstances({})

  const nodeStakeTx = await stargateMock
    .connect(endorser)
    .stake(level, { value: (await stargateNftMock.getLevel(level)).vetAmountRequiredToStake })

  const nodeId = await getNodeIdFromStakeTx(nodeStakeTx)

  return nodeId
}

export const createLegacyNodeHolder = async (level: number, endorser: HardhatEthersSigner) => {
  const { nodeManagement } = await getOrDeployContractInstances({})

  await mintLegacyNode(level, endorser)
  const ownerNodes = await nodeManagement.getUserNodes(endorser.address)
  return ownerNodes[0].nodeId
}
