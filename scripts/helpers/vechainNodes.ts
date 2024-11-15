import { TokenAuction } from "../../typechain-types"
import { AddressLike } from "ethers"
import { SeedAccount } from "./seedAccounts"

/**
 * Add a Vechain Node token of a specific level to the owner
 * @param level - The level of the node
 * @param owner - The address of the owner
 * @param vechainNodesMock - The VechainNodesMock contract
 */
export const addNodeToken = async (
  level: number,
  owner: AddressLike,
  vechainNodesMock: TokenAuction,
): Promise<void> => {
  if (!vechainNodesMock) throw new Error("VechainNodesMock not found")

  await vechainNodesMock.addToken(owner, level, false, 0, 0)
}

/**
 * Mint Vechain Nodes for a list of accounts
 * @param vechainNodes - The VechainNodesMock contract
 * @param accounts - The list of accounts
 */
export const mintVechainNodes = async (
  vechainNodes: TokenAuction,
  accounts: SeedAccount[],
  levels: number[],
): Promise<void> => {
  for (let i = 0; i < accounts.length; i++) {
    await addNodeToken(levels[i], accounts[i].key.address, vechainNodes)
  }
}
