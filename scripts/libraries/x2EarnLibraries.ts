import { ethers } from "hardhat"

export async function x2EarnLibraries() {
  // NOTE: V1 libraries do not exist, libraries were added in V2 of X2EarnApps contract

  // ---------------------- Version 2 ----------------------
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

  // ---------------------- Version 3 ----------------------
  const AdministrationUtilsV3 = await ethers.getContractFactory("AdministrationUtilsV3")
  const AdministrationUtilsLibV3 = await AdministrationUtilsV3.deploy()
  await AdministrationUtilsLibV3.waitForDeployment()

  const EndorsementUtilsV3 = await ethers.getContractFactory("EndorsementUtilsV3")
  const EndorsementUtilsLibV3 = await EndorsementUtilsV3.deploy()
  await EndorsementUtilsLibV3.waitForDeployment()

  const VoteEligibilityUtilsV3 = await ethers.getContractFactory("VoteEligibilityUtilsV3")
  const VoteEligibilityUtilsLibV3 = await VoteEligibilityUtilsV3.deploy()
  await VoteEligibilityUtilsLibV3.waitForDeployment()

  // ---------------------- Version 4  ----------------------
  const AdministrationUtils = await ethers.getContractFactory("AdministrationUtils")
  const AdministrationUtilsLib = await AdministrationUtils.deploy()
  await AdministrationUtilsLib.waitForDeployment()

  // Latest version
  const EndorsementUtils = await ethers.getContractFactory("EndorsementUtils")
  const EndorsementUtilsLib = await EndorsementUtils.deploy()
  await EndorsementUtilsLib.waitForDeployment()

  // Latest version
  const VoteEligibilityUtils = await ethers.getContractFactory("VoteEligibilityUtils")
  const VoteEligibilityUtilsLib = await VoteEligibilityUtils.deploy()
  await VoteEligibilityUtilsLib.waitForDeployment()

  return {
    AdministrationUtilsV2: AdministrationUtilsLibV2,
    EndorsementUtilsV2: EndorsementUtilsLibV2,
    VoteEligibilityUtilsV2: VoteEligibilityUtilsLibV2,
    AdministrationUtilsV3: AdministrationUtilsLibV3,
    EndorsementUtilsV3: EndorsementUtilsLibV3,
    VoteEligibilityUtilsV3: VoteEligibilityUtilsLibV3,
    AdministrationUtils: AdministrationUtilsLib,
    EndorsementUtils: EndorsementUtilsLib,
    VoteEligibilityUtils: VoteEligibilityUtilsLib,
  }
}
