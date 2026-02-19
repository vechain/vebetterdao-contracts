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

  // Create fresh contract instance each call to avoid VeChain adapter bug
  // where consecutive calls from the same signer lose calldata (data: '')
  const stargateAddress = await stargateMock.getAddress()
  const stargate = (await ethers.getContractAt("Stargate", stargateAddress)) as Stargate
  const stargateNFTAddress = await stargate.stargateNFT()
  const stargateNFT = await ethers.getContractAt("StargateNFT", stargateNFTAddress)

  const level = await stargateNFT.getLevel(levelId)
  if (!level) throw new Error("Level not found")

  const tx = await stargate.connect(owner).stake(levelId, { value: level.vetAmountRequiredToStake, gasLimit: 10000000 })
  await tx.wait()
  console.log(`Stargate NFT staked with level ${levelId} for owner ${owner.address}`)
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
    await stakeVET(levels[i], accounts[i], stargateMock)
  }
}
