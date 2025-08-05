import { abi, keccak256 } from "thor-devkit"

export type JsonContractAbi = {
  _format: string
  contractName: string
  sourceName: string
  abi: abi.Event.Definition[] | abi.Function.Definition[]
}

/**
 * Used in GovernanaceFeaturedFunctions to display the function name and the parameters
 */
export type JsonContractType = {
  _format: string
  contractName: string
  abi: ((
    | Omit<abi.Function.Definition, "type" | "name" | "stateMutability" | "inputs">
    | Omit<abi.Event.Definition, "type" | "name" | "stateMutability" | "inputs">
  ) & {
    type: string
    name?: string
    stateMutability?: string
    inputs?: (Omit<abi.Function.Parameter, "indexed"> & {
      indexed?: boolean
    })[]
  })[]
  bytecode: string
}

/**
 * Given a calldata and a contract ABI, it tries to resolve the function that is being called from the calldata
 * @param calldata  The calldata to resolve
 * @param contractAbi  The ABI of the contract
 * @returns  The resolved function
 */
export const resolveAbiFunctionFromCalldata = (calldata: string, contractAbi: JsonContractAbi | JsonContractType) => {
  for (const method of contractAbi.abi) {
    if (method.type !== "function") continue

    // The first 4 bytes of the calldata are the function to call hash (function signature) i.e keccak256(methodNameAndParams)
    const functionToCallHash = calldata.slice(0, 10)
    const methodNameAndParams = `${method.name}(${method.inputs?.map(i => i.type).join(",")})`
    const methodNameAndParamsHash = `0x${keccak256(methodNameAndParams).toString("hex").slice(0, 8)}`

    if (functionToCallHash !== methodNameAndParamsHash) continue
    return method
  }
}
