import { getOrDeployContractInstances } from "./deploy"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

export const createNodeHolder = async (level: number, endorser: HardhatEthersSigner) => {
  const { vechainNodesMock } = await getOrDeployContractInstances({})

  await vechainNodesMock.addToken(endorser.address, level, false, 0, 0)

  return await vechainNodesMock.ownerToId(endorser.address)
}
