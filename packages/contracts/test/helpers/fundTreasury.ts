import { ethers } from "hardhat"
import { getOrDeployContractInstances } from "./deploy"

export const VTHO_CONTRACT_ADDRESS = "0x0000000000000000000000000000456E65726779"

const VTHO_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "transfer",
    outputs: [
      {
        internalType: "bool",
        name: "success",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
]

export const fundTreasuryVTHO = async (address: string, amount: bigint) => {
  const contractVtho = await ethers.getContractAt(VTHO_ABI, VTHO_CONTRACT_ADDRESS)
  const tx = await contractVtho.transfer(address, amount)
  await tx.wait()
}

export const fundTreasuryVET = async (to: string, value: number) => {
  const [owner] = await ethers.getSigners()
  await owner.sendTransaction({
    to,
    value: ethers.parseEther(value.toString()),
  })
}

export const fundInB3TR = async (to: string, value: number) => {
  const [owner] = await ethers.getSigners()
  const instance = await getOrDeployContractInstances({})
  if (!instance?.b3tr) throw new Error("B3TR contract not found")
  await instance.b3tr.connect(owner).transfer(to, ethers.parseEther(value.toString()))
}
