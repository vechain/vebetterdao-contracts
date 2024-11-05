import { getOrDeployContractInstances } from "./deploy"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

export const endorseApp = async (appId: string, endorser: HardhatEthersSigner) => {
  const { x2EarnApps } = await getOrDeployContractInstances({})

  // Create a MjolnirX node holder => score = 100
  const nodeId = await createNodeHolder(7, endorser)

  const tx = await x2EarnApps.connect(endorser).endorseApp(appId, nodeId)
  const txReceipt = await tx.wait()

  const event = txReceipt?.logs[0]

  if (!event) throw new Error("No endorsement event found")
}

export const createNodeHolder = async (level: number, endorser: HardhatEthersSigner) => {
  const { vechainNodesMock } = await getOrDeployContractInstances({})

  await vechainNodesMock.addToken(endorser.address, level, false, 0, 0)

  return await vechainNodesMock.ownerToId(endorser.address)
}
