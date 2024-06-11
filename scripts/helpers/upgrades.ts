import { BaseContract, Interface } from "ethers"
import { ethers } from "hardhat"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"

export const deployProxy = async (
  contractName: string,
  args: any[],
  libraries: { [libraryName: string]: string } = {},
): Promise<BaseContract> => {
  // Deploy the implementation contract
  // Deploy the implementation contract
  const Contract = await ethers.getContractFactory(contractName, {
    libraries: libraries,
  })
  const implementation = await Contract.deploy()
  await implementation.waitForDeployment()

  // Deploy the proxy contract, link it to the implementation and call the initializer
  const proxyFactory = await ethers.getContractFactory("B3TRProxy")
  const proxy = await proxyFactory.deploy(
    await implementation.getAddress(),
    getInitializerData(Contract.interface, args),
  )
  await proxy.waitForDeployment()

  const newImplementationAddress = await getImplementationAddress(ethers.provider, await proxy.getAddress())
  if (newImplementationAddress !== (await implementation.getAddress())) {
    throw new Error(
      `The implementation address is not the one expected: ${newImplementationAddress} !== ${await implementation.getAddress()}`,
    )
  }

  // Return an instance of the contract using the proxy address
  return Contract.attach(await proxy.getAddress())
}

export const upgradeProxy = async (
  previousVersionContractName: string,
  newVersionContractName: string,
  proxyAddress: string,
  args: any[] = [],
): Promise<BaseContract> => {
  // Deploy the implementation contract
  const Contract = await ethers.getContractFactory(newVersionContractName)
  const implementation = await Contract.deploy()
  await implementation.waitForDeployment()

  const currentImplementationContract = await ethers.getContractAt(previousVersionContractName, proxyAddress)

  const tx = await currentImplementationContract.upgradeToAndCall(
    await implementation.getAddress(),
    args.length > 0 ? getInitializerData(Contract.interface, args) : "0x",
  )
  await tx.wait()

  const newImplementationAddress = await getImplementationAddress(ethers.provider, proxyAddress)
  if (newImplementationAddress !== (await implementation.getAddress())) {
    throw new Error(
      `The implementation address is not the one expected: ${newImplementationAddress} !== ${await implementation.getAddress()}`,
    )
  }

  return Contract.attach(proxyAddress)
}

export function getInitializerData(contractInterface: Interface, args: any[]) {
  const initializer = "initialize"
  const fragment = contractInterface.getFunction(initializer)
  if (!fragment) {
    throw new Error(`Contract initializer not found`)
  }
  return contractInterface.encodeFunctionData(fragment, args)
}
