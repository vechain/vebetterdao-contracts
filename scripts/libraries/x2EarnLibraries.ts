import { ethers } from "hardhat"

export async function x2EarnLibraries() {
  // NOTE: V1 libraries do not exist, libraries were added in V2 of X2EarnApps contract

  // Deploy Passport Checks LogicV2
  const AdministrationUtilsV2 = await ethers.getContractFactory("AdministrationUtilsV2")
  const AdministrationUtilsLibV2 = await AdministrationUtilsV2.deploy()
  await AdministrationUtilsLibV2.waitForDeployment()

  // Deploy Passport ConfiguratorV2
  const EndorsementUtilsV2 = await ethers.getContractFactory("EndorsementUtilsV2")
  const EndorsementUtilsLibV2 = await EndorsementUtilsV2.deploy()
  await EndorsementUtilsLibV2.waitForDeployment()

  // Deploy Passport Delegation LogicV2
  const VoteEligibilityUtilsV2 = await ethers.getContractFactory("VoteEligibilityUtilsV2")
  const VoteEligibilityUtilsLibV2 = await VoteEligibilityUtilsV2.deploy()
  await VoteEligibilityUtilsLibV2.waitForDeployment()

  // Deploy Passport Checks LogicV3 -- Latest version
  const AdministrationUtils = await ethers.getContractFactory("AdministrationUtils")
  const AdministrationUtilsLib = await AdministrationUtils.deploy()
  await AdministrationUtilsLib.waitForDeployment()

  // Deploy Passport ConfiguratorV3 -- Latest version
  const EndorsementUtils = await ethers.getContractFactory("EndorsementUtils")
  const EndorsementUtilsLib = await EndorsementUtils.deploy()
  await EndorsementUtilsLib.waitForDeployment()

  // Deploy Passport Delegation LogicV3 -- Latest version
  const VoteEligibilityUtils = await ethers.getContractFactory("VoteEligibilityUtils")
  const VoteEligibilityUtilsLib = await VoteEligibilityUtils.deploy()
  await VoteEligibilityUtilsLib.waitForDeployment()

  return {
    AdministrationUtilsV2: AdministrationUtilsLibV2,
    EndorsementUtilsV2: EndorsementUtilsLibV2,
    VoteEligibilityUtilsV2: VoteEligibilityUtilsLibV2,
    AdministrationUtils: AdministrationUtilsLib,
    EndorsementUtils: EndorsementUtilsLib,
    VoteEligibilityUtils: VoteEligibilityUtilsLib,
  }
}
