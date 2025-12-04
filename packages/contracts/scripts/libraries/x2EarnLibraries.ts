import { ethers } from "hardhat"
import {
  // ------------------- LATEST VERSION ------------------- //
  AdministrationUtils,
  EndorsementUtils,
  VoteEligibilityUtils,
  // ------------------- V2 ------------------- //
  AdministrationUtilsV2,
  EndorsementUtilsV2,
  VoteEligibilityUtilsV2,
  // ------------------- V3 ------------------- //
  AdministrationUtilsV3,
  EndorsementUtilsV3,
  VoteEligibilityUtilsV3,
  // ------------------- V4 ------------------- //
  AdministrationUtilsV4,
  EndorsementUtilsV4,
  VoteEligibilityUtilsV4,
  // ------------------- V5 ------------------- //
  AdministrationUtilsV5,
  EndorsementUtilsV5,
  VoteEligibilityUtilsV5,
  // ------------------- V6 ------------------- //
  VoteEligibilityUtilsV6,
  EndorsementUtilsV6,
  AdministrationUtilsV6,
} from "../../typechain-types"

interface DeployX2EarnLibrariesArgs {
  logOutput?: boolean
  latestVersionOnly?: boolean
}

export type X2EarnLatestLibraries = {
  AdministrationUtils: AdministrationUtils
  EndorsementUtils: EndorsementUtils
  VoteEligibilityUtils: VoteEligibilityUtils
}

export type X2EarnLibraries = X2EarnLatestLibraries & {
  AdministrationUtilsV2: AdministrationUtilsV2
  EndorsementUtilsV2: EndorsementUtilsV2
  VoteEligibilityUtilsV2: VoteEligibilityUtilsV2
  AdministrationUtilsV3: AdministrationUtilsV3
  EndorsementUtilsV3: EndorsementUtilsV3
  VoteEligibilityUtilsV3: VoteEligibilityUtilsV3
  AdministrationUtilsV4: AdministrationUtilsV4
  EndorsementUtilsV4: EndorsementUtilsV4
  VoteEligibilityUtilsV4: VoteEligibilityUtilsV4
  AdministrationUtilsV5: AdministrationUtilsV5
  EndorsementUtilsV5: EndorsementUtilsV5
  VoteEligibilityUtilsV5: VoteEligibilityUtilsV5
  AdministrationUtilsV6: AdministrationUtilsV6
  EndorsementUtilsV6: EndorsementUtilsV6
  VoteEligibilityUtilsV6: VoteEligibilityUtilsV6
}

export async function x2EarnLibraries<T extends DeployX2EarnLibrariesArgs>({
  logOutput = false,
  latestVersionOnly = false,
}: T): Promise<T["latestVersionOnly"] extends true ? X2EarnLatestLibraries : X2EarnLibraries> {
  // NOTE: V1 libraries do not exist, libraries were added in V2 of X2EarnApps contract

  // ------------------- LATEST VERSION ------------------- //
  // Deploy Administration Utils
  const AdministrationUtils = await ethers.getContractFactory("AdministrationUtils")
  const AdministrationUtilsLib = (await AdministrationUtils.deploy()) as AdministrationUtils
  await AdministrationUtilsLib.waitForDeployment()
  logOutput && console.log("AdministrationUtils Library deployed")

  // Deploy Endorsement Utils
  const EndorsementUtils = await ethers.getContractFactory("EndorsementUtils")
  const EndorsementUtilsLib = (await EndorsementUtils.deploy()) as EndorsementUtils
  await EndorsementUtilsLib.waitForDeployment()
  logOutput && console.log("EndorsementUtils Library deployed")

  // Deploy Vote Eligibility Utils
  const VoteEligibilityUtils = await ethers.getContractFactory("VoteEligibilityUtils")
  const VoteEligibilityUtilsLib = (await VoteEligibilityUtils.deploy()) as VoteEligibilityUtils
  await VoteEligibilityUtilsLib.waitForDeployment()
  logOutput && console.log("VoteEligibilityUtils Library deployed")

  if (latestVersionOnly) {
    return {
      AdministrationUtils: AdministrationUtilsLib,
      EndorsementUtils: EndorsementUtilsLib,
      VoteEligibilityUtils: VoteEligibilityUtilsLib,
    } as T["latestVersionOnly"] extends true ? X2EarnLatestLibraries : X2EarnLibraries
  }

  // ------------------- DEPRECATED VERSION ------------------- //
  // ------------------- V2 ------------------- //
  // Deploy Administration Utils V2
  const AdministrationUtilsV2 = await ethers.getContractFactory("AdministrationUtilsV2")
  const AdministrationUtilsLibV2 = (await AdministrationUtilsV2.deploy()) as AdministrationUtilsV2
  await AdministrationUtilsLibV2.waitForDeployment()
  logOutput && console.log("AdministrationUtilsV2 Library deployed")

  // Deploy Endorsement Utils V2
  const EndorsementUtilsV2 = await ethers.getContractFactory("EndorsementUtilsV2")
  const EndorsementUtilsLibV2 = (await EndorsementUtilsV2.deploy()) as EndorsementUtilsV2
  await EndorsementUtilsLibV2.waitForDeployment()
  logOutput && console.log("EndorsementUtilsV2 Library deployed")

  // Deploy Vote Eligibility Utils V2
  const VoteEligibilityUtilsV2 = await ethers.getContractFactory("VoteEligibilityUtilsV2")
  const VoteEligibilityUtilsLibV2 = (await VoteEligibilityUtilsV2.deploy()) as VoteEligibilityUtilsV2
  await VoteEligibilityUtilsLibV2.waitForDeployment()
  logOutput && console.log("VoteEligibilityUtilsV2 Library deployed")

  // ------------------- V3 ------------------- //
  const AdministrationUtilsV3 = await ethers.getContractFactory("AdministrationUtilsV3")
  const AdministrationUtilsLibV3 = (await AdministrationUtilsV3.deploy()) as AdministrationUtilsV3
  await AdministrationUtilsLibV3.waitForDeployment()
  logOutput && console.log("AdministrationUtilsV3 Library deployed")

  const EndorsementUtilsV3 = await ethers.getContractFactory("EndorsementUtilsV3")
  const EndorsementUtilsLibV3 = (await EndorsementUtilsV3.deploy()) as EndorsementUtilsV3
  await EndorsementUtilsLibV3.waitForDeployment()
  logOutput && console.log("EndorsementUtilsV3 Library deployed")

  const VoteEligibilityUtilsV3 = await ethers.getContractFactory("VoteEligibilityUtilsV3")
  const VoteEligibilityUtilsLibV3 = (await VoteEligibilityUtilsV3.deploy()) as VoteEligibilityUtilsV3
  await VoteEligibilityUtilsLibV3.waitForDeployment()
  logOutput && console.log("VoteEligibilityUtilsV3 Library deployed")

  // ------------------- V4 ------------------- //
  const AdministrationUtilsV4 = await ethers.getContractFactory("AdministrationUtilsV4")
  const AdministrationUtilsLibV4 = (await AdministrationUtilsV4.deploy()) as AdministrationUtilsV4
  await AdministrationUtilsLibV4.waitForDeployment()
  logOutput && console.log("AdministrationUtilsV4 Library deployed")

  const EndorsementUtilsV4 = await ethers.getContractFactory("EndorsementUtilsV4")
  const EndorsementUtilsLibV4 = (await EndorsementUtilsV4.deploy()) as EndorsementUtilsV4
  await EndorsementUtilsLibV4.waitForDeployment()
  logOutput && console.log("EndorsementUtilsV4 Library deployed")

  const VoteEligibilityUtilsV4 = await ethers.getContractFactory("VoteEligibilityUtilsV4")
  const VoteEligibilityUtilsLibV4 = (await VoteEligibilityUtilsV4.deploy()) as VoteEligibilityUtilsV4
  await VoteEligibilityUtilsLibV4.waitForDeployment()
  logOutput && console.log("VoteEligibilityUtilsV4 Library deployed")

  // ------------------- V5 ------------------- //
  const AdministrationUtilsV5 = await ethers.getContractFactory("AdministrationUtilsV5")
  const AdministrationUtilsLibV5 = (await AdministrationUtilsV5.deploy()) as AdministrationUtilsV5
  await AdministrationUtilsLibV5.waitForDeployment()
  logOutput && console.log("AdministrationUtilsV5 Library deployed")

  const EndorsementUtilsV5 = await ethers.getContractFactory("EndorsementUtilsV5")
  const EndorsementUtilsLibV5 = (await EndorsementUtilsV5.deploy()) as EndorsementUtilsV5
  await EndorsementUtilsLibV5.waitForDeployment()
  logOutput && console.log("EndorsementUtilsV5 Library deployed")

  const VoteEligibilityUtilsV5 = await ethers.getContractFactory("VoteEligibilityUtilsV5")
  const VoteEligibilityUtilsLibV5 = (await VoteEligibilityUtilsV5.deploy()) as VoteEligibilityUtilsV5
  await VoteEligibilityUtilsLibV5.waitForDeployment()
  logOutput && console.log("VoteEligibilityUtilsV5 Library deployed")

  // ---------------------- Version 6 ----------------------

  const AdministrationUtilsV6 = await ethers.getContractFactory("AdministrationUtilsV6")
  const AdministrationUtilsLibV6 = await AdministrationUtilsV6.deploy()
  await AdministrationUtilsLibV6.waitForDeployment()

  const EndorsementUtilsV6 = await ethers.getContractFactory("EndorsementUtilsV6")
  const EndorsementUtilsLibV6 = await EndorsementUtilsV6.deploy()
  await EndorsementUtilsLibV6.waitForDeployment()

  const VoteEligibilityUtilsV6 = await ethers.getContractFactory("VoteEligibilityUtilsV6")
  const VoteEligibilityUtilsLibV6 = await VoteEligibilityUtilsV6.deploy()
  await VoteEligibilityUtilsLibV6.waitForDeployment()

  return {
    // ------------------- V2 ------------------- //
    AdministrationUtilsV2: AdministrationUtilsLibV2,
    EndorsementUtilsV2: EndorsementUtilsLibV2,
    VoteEligibilityUtilsV2: VoteEligibilityUtilsLibV2,
    // ------------------- V3 ------------------- //
    AdministrationUtilsV3: AdministrationUtilsLibV3,
    EndorsementUtilsV3: EndorsementUtilsLibV3,
    VoteEligibilityUtilsV3: VoteEligibilityUtilsLibV3,
    // ------------------- V4 ------------------- //
    AdministrationUtilsV4: AdministrationUtilsLibV4,
    EndorsementUtilsV4: EndorsementUtilsLibV4,
    VoteEligibilityUtilsV4: VoteEligibilityUtilsLibV4,
    // ------------------- V5 ------------------- //
    AdministrationUtilsV5: AdministrationUtilsLibV5,
    EndorsementUtilsV5: EndorsementUtilsLibV5,
    VoteEligibilityUtilsV5: VoteEligibilityUtilsLibV5,
    // ------------------- V6 ------------------- //
    AdministrationUtilsV6: AdministrationUtilsLibV6,
    EndorsementUtilsV6: EndorsementUtilsLibV6,
    VoteEligibilityUtilsV6: VoteEligibilityUtilsLibV6,
    // ------------------- LATEST VERSION ------------------- //
    AdministrationUtils: AdministrationUtilsLib,
    EndorsementUtils: EndorsementUtilsLib,
    VoteEligibilityUtils: VoteEligibilityUtilsLib,
  } as T["latestVersionOnly"] extends true ? X2EarnLatestLibraries : X2EarnLibraries
}
