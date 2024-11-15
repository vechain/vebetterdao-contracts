import { ethers } from "hardhat"

export async function x2EarnLibraries() {
  // Deploy Passport Checks LogicV1
  const AdministrationUtils = await ethers.getContractFactory("AdministrationUtils")
  const AdministrationUtilsLib = await AdministrationUtils.deploy()
  await AdministrationUtilsLib.waitForDeployment()

  // Deploy Passport ConfiguratorV1
  const EndorsementUtils = await ethers.getContractFactory("EndorsementUtils")
  const EndorsementUtilsLib = await EndorsementUtils.deploy()
  await EndorsementUtilsLib.waitForDeployment()

  // Deploy Passport Delegation LogicV1
  const VoteEligibilityUtils = await ethers.getContractFactory("VoteEligibilityUtils")
  const VoteEligibilityUtilsLib = await VoteEligibilityUtils.deploy()
  await VoteEligibilityUtilsLib.waitForDeployment()

  return {
    AdministrationUtils: AdministrationUtilsLib,
    EndorsementUtils: EndorsementUtilsLib,
    VoteEligibilityUtils: VoteEligibilityUtilsLib,
  }
}
