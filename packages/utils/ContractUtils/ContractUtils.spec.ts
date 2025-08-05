import { abi } from "thor-devkit"
import { resolveAbiFunctionFromCalldata } from "./ContractUtils"

describe("ContractUtils", () => {
  it("returns the correct function", () => {
    const contractAbi = {
      _format: "json",
      contractName: "test",
      sourceName: "test",
      abi: [
        {
          type: "function",
          name: "test",
          inputs: [
            {
              type: "string",
            },
          ],
        },
      ],
    }
    const functionAbiInstance = new abi.Function(contractAbi.abi[0] as abi.Function.Definition)
    const encodedCallData = functionAbiInstance.encode("test")
    //@ts-ignore
    expect(resolveAbiFunctionFromCalldata(encodedCallData, contractAbi)).toEqual({
      type: "function",
      name: "test",
      inputs: [
        {
          type: "string",
        },
      ],
    })
  }) // returns the correct function
})
