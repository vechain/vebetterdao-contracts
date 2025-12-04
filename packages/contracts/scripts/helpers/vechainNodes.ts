import { ethers } from "hardhat"
import { Stargate } from "../../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

/**
 * Add a Vechain Node token of a specific level to the owner
 * @param levelId - The level ID of the node
 * @param ownerPrivateKey - The private key of the owner (hex string with 0x prefix)
 * @param stargateMock - The StargateMock contract
 */
export const stakeVET = async (levelId: number, owner: HardhatEthersSigner, stargateMock: Stargate): Promise<void> => {
  if (!stargateMock) throw new Error("StargateMock not found")

  const stargateNFTAddress = await stargateMock.stargateNFT()
  const stargateNFT = await ethers.getContractAt("StargateNFT", stargateNFTAddress)

  const level = await stargateNFT.getLevel(levelId)
  if (!level) throw new Error("Level not found")

  // Create a signer from the private key
  // Connect the contract to the signer and stake
  const tx = await stargateMock.connect(owner).stake(levelId, { value: level.vetAmountRequiredToStake })
  await tx.wait()
  console.log("\n")
  console.log(`Stargate NFT staked with level ${levelId} for owner ${owner.address}`)
  console.log("\n")
}

/**
 * Mint Stargate NFTs for a list of accounts
 * @param vechainNodes - The VechainNodesMock contract
 * @param accounts - The list of accounts
 */
export const mintStargateNFTs = async (
  stargateMock: Stargate,
  accounts: HardhatEthersSigner[],
  levels: number[],
): Promise<void> => {
  for (let i = 0; i < accounts.length; i++) {
    // Convert Uint8Array private key to hex string
    await stakeVET(levels[i], accounts[i], stargateMock)
  }
}
