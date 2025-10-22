import { ethers } from "hardhat"

export const autoVotingLibraries = async () => {
  const AutoVotingLogicFactory = await ethers.getContractFactory("AutoVotingLogic")
  const AutoVotingLogic = await AutoVotingLogicFactory.deploy()
  await AutoVotingLogic.waitForDeployment()

  return {
    AutoVotingLogic,
  }
}
