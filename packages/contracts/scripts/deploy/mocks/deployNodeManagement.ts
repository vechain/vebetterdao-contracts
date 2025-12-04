import { ethers } from "hardhat"
import { deployAndUpgrade } from "../../helpers"
import { NodeManagementV3 } from "../../../typechain-types"

export const deployNodeManagementMock = async ({
  stargateNFTProxyAddress,
  logOutput = false,
}: {
  stargateNFTProxyAddress: string
  logOutput: boolean
}) => {
  const deployer = (await ethers.getSigners())[0]

  logOutput && console.log("Deploying NodeManagement (V1→V2→V3)...")
  const nodeManagement = (await deployAndUpgrade(
    ["NodeManagementV1", "NodeManagementV2", "NodeManagementV3"],
    [
      [
        deployer.address, // vechain nodes mock, we do not care
        deployer.address,
        deployer.address,
      ],
      [],
      [stargateNFTProxyAddress],
    ],
    {
      versions: [undefined, 2, 3],
      logOutput: true,
    },
  )) as NodeManagementV3
  logOutput && console.log("NodeManagement deployed at: ", await nodeManagement.getAddress())

  return nodeManagement
}
