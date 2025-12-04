import { ethers } from "hardhat"
import {
  // ------------------- LATEST VERSION ------------------- //
  PassportChecksLogic,
  PassportConfigurator,
  PassportDelegationLogic,
  PassportEntityLogic,
  PassportPersonhoodLogic,
  PassportPoPScoreLogic,
  PassportSignalingLogic,
  PassportWhitelistAndBlacklistLogic,
  // ------------------- V1 ------------------- //
  PassportChecksLogicV1,
  PassportConfiguratorV1,
  PassportDelegationLogicV1,
  PassportEntityLogicV1,
  PassportPersonhoodLogicV1,
  PassportPoPScoreLogicV1,
  PassportSignalingLogicV1,
  PassportWhitelistAndBlacklistLogicV1,
  // ------------------- V2 ------------------- //
  PassportChecksLogicV2,
  PassportConfiguratorV2,
  PassportDelegationLogicV2,
  PassportEntityLogicV2,
  PassportPersonhoodLogicV2,
  PassportPoPScoreLogicV2,
  PassportSignalingLogicV2,
  PassportWhitelistAndBlacklistLogicV2,
  // ------------------- V3 ------------------- //
  PassportChecksLogicV3,
  PassportConfiguratorV3,
  PassportDelegationLogicV3,
  PassportEntityLogicV3,
  PassportPersonhoodLogicV3,
  PassportPoPScoreLogicV3,
  PassportSignalingLogicV3,
  PassportWhitelistAndBlacklistLogicV3,
} from "../../typechain-types"

interface DeployPassportLibrariesArgs {
  logOutput?: boolean
  latestVersionOnly?: boolean
}

export type PassportLatestLibraries = {
  PassportChecksLogic: PassportChecksLogic
  PassportConfigurator: PassportConfigurator
  PassportEntityLogic: PassportEntityLogic
  PassportDelegationLogic: PassportDelegationLogic
  PassportPersonhoodLogic: PassportPersonhoodLogic
  PassportPoPScoreLogic: PassportPoPScoreLogic
  PassportSignalingLogic: PassportSignalingLogic
  PassportWhitelistAndBlacklistLogic: PassportWhitelistAndBlacklistLogic
}

export type PassportLibraries = PassportLatestLibraries & {
  PassportChecksLogicV1: PassportChecksLogicV1
  PassportConfiguratorV1: PassportConfiguratorV1
  PassportEntityLogicV1: PassportEntityLogicV1
  PassportDelegationLogicV1: PassportDelegationLogicV1
  PassportPersonhoodLogicV1: PassportPersonhoodLogicV1
  PassportPoPScoreLogicV1: PassportPoPScoreLogicV1
  PassportSignalingLogicV1: PassportSignalingLogicV1
  PassportWhitelistAndBlacklistLogicV1: PassportWhitelistAndBlacklistLogicV1
  PassportChecksLogicV2: PassportChecksLogicV2
  PassportConfiguratorV2: PassportConfiguratorV2
  PassportEntityLogicV2: PassportEntityLogicV2
  PassportDelegationLogicV2: PassportDelegationLogicV2
  PassportPersonhoodLogicV2: PassportPersonhoodLogicV2
  PassportPoPScoreLogicV2: PassportPoPScoreLogicV2
  PassportSignalingLogicV2: PassportSignalingLogicV2
  PassportWhitelistAndBlacklistLogicV2: PassportWhitelistAndBlacklistLogicV2
  PassportChecksLogicV3: PassportChecksLogicV3
  PassportConfiguratorV3: PassportConfiguratorV3
  PassportEntityLogicV3: PassportEntityLogicV3
  PassportDelegationLogicV3: PassportDelegationLogicV3
  PassportPersonhoodLogicV3: PassportPersonhoodLogicV3
  PassportPoPScoreLogicV3: PassportPoPScoreLogicV3
  PassportSignalingLogicV3: PassportSignalingLogicV3
  PassportWhitelistAndBlacklistLogicV3: PassportWhitelistAndBlacklistLogicV3
}

export async function passportLibraries<T extends DeployPassportLibrariesArgs>({
  logOutput = false,
  latestVersionOnly = false,
}: T): Promise<T["latestVersionOnly"] extends true ? PassportLatestLibraries : PassportLibraries> {
  // ------------------- LATEST VERSION ------------------- //
  // Deploy Passport Checks Logic
  const PassportChecksLogic = await ethers.getContractFactory("PassportChecksLogic")
  const PassportChecksLogicLib = (await PassportChecksLogic.deploy()) as PassportChecksLogic
  await PassportChecksLogicLib.waitForDeployment()
  logOutput && console.log("PassportChecksLogic Library deployed")

  // Deploy Passport Configurator
  const PassportConfigurator = await ethers.getContractFactory("PassportConfigurator")
  const PassportConfiguratorLib = (await PassportConfigurator.deploy()) as PassportConfigurator
  await PassportConfiguratorLib.waitForDeployment()
  logOutput && console.log("PassportConfigurator Library deployed")

  // Deploy Passport Entity Logic
  const PassportEntityLogic = await ethers.getContractFactory("PassportEntityLogic")
  const PassportEntityLogicLib = (await PassportEntityLogic.deploy()) as PassportEntityLogic
  await PassportEntityLogicLib.waitForDeployment()
  logOutput && console.log("PassportEntityLogic Library deployed")

  // Deploy Passport Delegation Logic
  const PassportDelegationLogic = await ethers.getContractFactory("PassportDelegationLogic")
  const PassportDelegationLogicLib = (await PassportDelegationLogic.deploy()) as PassportDelegationLogic
  await PassportDelegationLogicLib.waitForDeployment()
  logOutput && console.log("PassportDelegationLogic Library deployed")

  // Deploy Passport PoP Score Logic
  const PassportPoPScoreLogic = await ethers.getContractFactory("PassportPoPScoreLogic")
  const PassportPoPScoreLogicLib = (await PassportPoPScoreLogic.deploy()) as PassportPoPScoreLogic
  await PassportPoPScoreLogicLib.waitForDeployment()
  logOutput && console.log("PassportPoPScoreLogic Library deployed")

  // Deploy Passport Signaling Logic
  const PassportSignalingLogic = await ethers.getContractFactory("PassportSignalingLogic")
  const PassportSignalingLogicLib = (await PassportSignalingLogic.deploy()) as PassportSignalingLogic
  await PassportSignalingLogicLib.waitForDeployment()
  logOutput && console.log("PassportSignalingLogic Library deployed")

  // Deploy Passport Personhood Logic
  const PassportPersonhoodLogic = await ethers.getContractFactory("PassportPersonhoodLogic")
  const PassportPersonhoodLogicLib = (await PassportPersonhoodLogic.deploy()) as PassportPersonhoodLogic
  await PassportPersonhoodLogicLib.waitForDeployment()
  logOutput && console.log("PassportPersonhoodLogic Library deployed")

  // Deploy Passport Whitelist and Blacklist Logic
  const PassportWhitelistAndBlacklistLogic = await ethers.getContractFactory("PassportWhitelistAndBlacklistLogic")
  const PassportWhitelistAndBlacklistLogicLib =
    (await PassportWhitelistAndBlacklistLogic.deploy()) as PassportWhitelistAndBlacklistLogic
  await PassportWhitelistAndBlacklistLogicLib.waitForDeployment()
  logOutput && console.log("PassportWhitelistAndBlacklistLogic Library deployed")

  if (latestVersionOnly) {
    return {
      PassportChecksLogic: PassportChecksLogicLib,
      PassportConfigurator: PassportConfiguratorLib,
      PassportEntityLogic: PassportEntityLogicLib,
      PassportDelegationLogic: PassportDelegationLogicLib,
      PassportPersonhoodLogic: PassportPersonhoodLogicLib,
      PassportPoPScoreLogic: PassportPoPScoreLogicLib,
      PassportSignalingLogic: PassportSignalingLogicLib,
      PassportWhitelistAndBlacklistLogic: PassportWhitelistAndBlacklistLogicLib,
    } as T["latestVersionOnly"] extends true ? PassportLatestLibraries : PassportLibraries
  }

  // ------------------- DEPRECATED VERSION ------------------- //
  // ------------------- V1 ------------------- //
  // Deploy Passport Checks LogicV1
  const PassportChecksLogicV1 = await ethers.getContractFactory("PassportChecksLogicV1")
  const PassportChecksLogicV1Lib = (await PassportChecksLogicV1.deploy()) as PassportChecksLogicV1
  await PassportChecksLogicV1Lib.waitForDeployment()
  logOutput && console.log("PassportChecksLogicV1 Library deployed")

  // Deploy Passport ConfiguratorV1
  const PassportConfiguratorV1 = await ethers.getContractFactory("PassportConfiguratorV1")
  const PassportConfiguratorV1Lib = (await PassportConfiguratorV1.deploy()) as PassportConfiguratorV1
  await PassportConfiguratorV1Lib.waitForDeployment()
  logOutput && console.log("PassportConfiguratorV1 Library deployed")

  // Deploy Passport Entity LogicV1
  const PassportEntityLogicV1 = await ethers.getContractFactory("PassportEntityLogicV1")
  const PassportEntityLogicV1Lib = (await PassportEntityLogicV1.deploy()) as PassportEntityLogicV1
  await PassportEntityLogicV1Lib.waitForDeployment()
  logOutput && console.log("PassportEntityLogicV1 Library deployed")

  // Deploy Passport Delegation LogicV1
  const PassportDelegationLogicV1 = await ethers.getContractFactory("PassportDelegationLogicV1")
  const PassportDelegationLogicV1Lib = (await PassportDelegationLogicV1.deploy()) as PassportDelegationLogicV1
  await PassportDelegationLogicV1Lib.waitForDeployment()
  logOutput && console.log("PassportDelegationLogicV1 Library deployed")

  // Deploy Passport PoP Score LogicV1
  const PassportPoPScoreLogicV1 = await ethers.getContractFactory("PassportPoPScoreLogicV1")
  const PassportPoPScoreLogicV1Lib = (await PassportPoPScoreLogicV1.deploy()) as PassportPoPScoreLogicV1
  await PassportPoPScoreLogicV1Lib.waitForDeployment()
  logOutput && console.log("PassportPoPScoreLogicV1 Library deployed")

  // Deploy Passport Signaling LogicV1
  const PassportSignalingLogicV1 = await ethers.getContractFactory("PassportSignalingLogicV1")
  const PassportSignalingLogicV1Lib = (await PassportSignalingLogicV1.deploy()) as PassportSignalingLogicV1
  await PassportSignalingLogicV1Lib.waitForDeployment()
  logOutput && console.log("PassportSignalingLogicV1 Library deployed")

  // Deploy Passport Personhood LogicV1
  const PassportPersonhoodLogicV1 = await ethers.getContractFactory("PassportPersonhoodLogicV1")
  const PassportPersonhoodLogicV1Lib = (await PassportPersonhoodLogicV1.deploy()) as PassportPersonhoodLogicV1
  await PassportPersonhoodLogicV1Lib.waitForDeployment()
  logOutput && console.log("PassportPersonhoodLogicV1 Library deployed")

  // Deploy Passport Whitelist and Blacklist LogicV1
  const PassportWhitelistAndBlacklistLogicV1 = await ethers.getContractFactory("PassportWhitelistAndBlacklistLogicV1")
  const PassportWhitelistAndBlacklistLogicV1Lib =
    (await PassportWhitelistAndBlacklistLogicV1.deploy()) as PassportWhitelistAndBlacklistLogicV1
  await PassportWhitelistAndBlacklistLogicV1Lib.waitForDeployment()
  logOutput && console.log("PassportWhitelistAndBlacklistLogicV1 Library deployed")

  // ------------------- V2 ------------------- //
  // Deploy Passport Checks Logic
  const PassportChecksLogicV2 = await ethers.getContractFactory("PassportChecksLogicV2")
  const PassportChecksLogicLibV2 = (await PassportChecksLogicV2.deploy()) as PassportChecksLogicV2
  await PassportChecksLogicLibV2.waitForDeployment()
  logOutput && console.log("PassportChecksLogicV2 Library deployed")

  // Deploy Passport Configurator
  const PassportConfiguratorV2 = await ethers.getContractFactory("PassportConfiguratorV2")
  const PassportConfiguratorLibV2 = (await PassportConfiguratorV2.deploy()) as PassportConfiguratorV2
  await PassportConfiguratorLibV2.waitForDeployment()
  logOutput && console.log("PassportConfiguratorV2 Library deployed")

  // Deploy Passport Entity Logic
  const PassportEntityLogicV2 = await ethers.getContractFactory("PassportEntityLogicV2")
  const PassportEntityLogicLibV2 = (await PassportEntityLogicV2.deploy()) as PassportEntityLogicV2
  await PassportEntityLogicLibV2.waitForDeployment()
  logOutput && console.log("PassportEntityLogicV2 Library deployed")

  // Deploy Passport Delegation Logic
  const PassportDelegationLogicV2 = await ethers.getContractFactory("PassportDelegationLogicV2")
  const PassportDelegationLogicLibV2 = (await PassportDelegationLogicV2.deploy()) as PassportDelegationLogicV2
  await PassportDelegationLogicLibV2.waitForDeployment()
  logOutput && console.log("PassportDelegationLogicV2 Library deployed")

  // Deploy Passport PoP Score Logic
  const PassportPoPScoreLogicV2 = await ethers.getContractFactory("PassportPoPScoreLogicV2")
  const PassportPoPScoreLogicLibV2 = (await PassportPoPScoreLogicV2.deploy()) as PassportPoPScoreLogicV2
  await PassportPoPScoreLogicLibV2.waitForDeployment()
  logOutput && console.log("PassportPoPScoreLogicV2 Library deployed")

  // Deploy Passport Signaling Logic
  const PassportSignalingLogicV2 = await ethers.getContractFactory("PassportSignalingLogicV2")
  const PassportSignalingLogicLibV2 = (await PassportSignalingLogicV2.deploy()) as PassportSignalingLogicV2
  await PassportSignalingLogicLibV2.waitForDeployment()
  logOutput && console.log("PassportSignalingLogicV2 Library deployed")

  // Deploy Passport Personhood Logic
  const PassportPersonhoodLogicV2 = await ethers.getContractFactory("PassportPersonhoodLogicV2")
  const PassportPersonhoodLogicLibV2 = (await PassportPersonhoodLogicV2.deploy()) as PassportPersonhoodLogicV2
  await PassportPersonhoodLogicLibV2.waitForDeployment()
  logOutput && console.log("PassportPersonhoodLogicV2 Library deployed")

  // Deploy Passport Whitelist and Blacklist Logic
  const PassportWhitelistAndBlacklistLogicV2 = await ethers.getContractFactory("PassportWhitelistAndBlacklistLogicV2")
  const PassportWhitelistAndBlacklistLogicLibV2 =
    (await PassportWhitelistAndBlacklistLogicV2.deploy()) as PassportWhitelistAndBlacklistLogicV2
  await PassportWhitelistAndBlacklistLogicLibV2.waitForDeployment()
  logOutput && console.log("PassportWhitelistAndBlacklistLogicV2 Library deployed")

  // ------------------- V3 ------------------- //
  // Deploy Passport Checks Logic V3
  const PassportChecksLogicV3 = await ethers.getContractFactory("PassportChecksLogicV3")
  const PassportChecksLogicV3Lib = (await PassportChecksLogicV3.deploy()) as PassportChecksLogicV3
  await PassportChecksLogicV3Lib.waitForDeployment()
  logOutput && console.log("PassportChecksLogicV3 Library deployed")

  // Deploy Passport Configurator V3
  const PassportConfiguratorV3 = await ethers.getContractFactory("PassportConfiguratorV3")
  const PassportConfiguratorV3Lib = (await PassportConfiguratorV3.deploy()) as PassportConfiguratorV3
  await PassportConfiguratorV3Lib.waitForDeployment()
  logOutput && console.log("PassportConfiguratorV3 Library deployed")

  // Deploy Passport Entity Logic V3
  const PassportEntityLogicV3 = await ethers.getContractFactory("PassportEntityLogicV3")
  const PassportEntityLogicV3Lib = (await PassportEntityLogicV3.deploy()) as PassportEntityLogicV3
  await PassportEntityLogicV3Lib.waitForDeployment()
  logOutput && console.log("PassportEntityLogicV3 Library deployed")

  // Deploy Passport Delegation Logic V3
  const PassportDelegationLogicV3 = await ethers.getContractFactory("PassportDelegationLogicV3")
  const PassportDelegationLogicV3Lib = (await PassportDelegationLogicV3.deploy()) as PassportDelegationLogicV3
  await PassportDelegationLogicV3Lib.waitForDeployment()
  logOutput && console.log("PassportDelegationLogicV3 Library deployed")

  // Deploy Passport PoP Score Logic V3
  const PassportPoPScoreLogicV3 = await ethers.getContractFactory("PassportPoPScoreLogicV3")
  const PassportPoPScoreLogicV3Lib = (await PassportPoPScoreLogicV3.deploy()) as PassportPoPScoreLogicV3
  await PassportPoPScoreLogicV3Lib.waitForDeployment()
  logOutput && console.log("PassportPoPScoreLogicV3 Library deployed")

  // Deploy Passport Signaling Logic V3
  const PassportSignalingLogicV3 = await ethers.getContractFactory("PassportSignalingLogicV3")
  const PassportSignalingLogicV3Lib = (await PassportSignalingLogicV3.deploy()) as PassportSignalingLogicV3
  await PassportSignalingLogicV3Lib.waitForDeployment()
  logOutput && console.log("PassportSignalingLogicV3 Library deployed")

  // Deploy Passport Personhood Logic V3
  const PassportPersonhoodLogicV3 = await ethers.getContractFactory("PassportPersonhoodLogicV3")
  const PassportPersonhoodLogicV3Lib = (await PassportPersonhoodLogicV3.deploy()) as PassportPersonhoodLogicV3
  await PassportPersonhoodLogicV3Lib.waitForDeployment()
  logOutput && console.log("PassportPersonhoodLogicV3 Library deployed")

  // Deploy Passport Whitelist and Blacklist Logic V3
  const PassportWhitelistAndBlacklistLogicV3 = await ethers.getContractFactory("PassportWhitelistAndBlacklistLogicV3")
  const PassportWhitelistAndBlacklistLogicV3Lib =
    (await PassportWhitelistAndBlacklistLogicV3.deploy()) as PassportWhitelistAndBlacklistLogicV3
  await PassportWhitelistAndBlacklistLogicV3Lib.waitForDeployment()
  logOutput && console.log("PassportWhitelistAndBlacklistLogicV3 Library deployed")

  // Deploy Clock Logic V3 (note: no typechain export for this library)
  const PassportClockLogicV3 = await ethers.getContractFactory("PassportClockLogicV3")
  const PassportClockLogicV3Lib = await PassportClockLogicV3.deploy()
  await PassportClockLogicV3Lib.waitForDeployment()
  logOutput && console.log("PassportClockLogicV3 Library deployed")

  // Deploy EIP712Signing Logic V3 (note: no typechain export for this library)
  const PassportEIP712SigningLogicV3 = await ethers.getContractFactory("PassportEIP712SigningLogicV3")
  const PassportEIP712SigningLogicV3Lib = await PassportEIP712SigningLogicV3.deploy()
  await PassportEIP712SigningLogicV3Lib.waitForDeployment()
  logOutput && console.log("PassportEIP712SigningLogicV3 Library deployed")

  return {
    PassportChecksLogicV1: PassportChecksLogicV1Lib,
    PassportConfiguratorV1: PassportConfiguratorV1Lib,
    PassportEntityLogicV1: PassportEntityLogicV1Lib,
    PassportDelegationLogicV1: PassportDelegationLogicV1Lib,
    PassportPersonhoodLogicV1: PassportPersonhoodLogicV1Lib,
    PassportPoPScoreLogicV1: PassportPoPScoreLogicV1Lib,
    PassportSignalingLogicV1: PassportSignalingLogicV1Lib,
    PassportWhitelistAndBlacklistLogicV1: PassportWhitelistAndBlacklistLogicV1Lib,

    PassportChecksLogicV2: PassportChecksLogicLibV2,
    PassportConfiguratorV2: PassportConfiguratorLibV2,
    PassportEntityLogicV2: PassportEntityLogicLibV2,
    PassportDelegationLogicV2: PassportDelegationLogicLibV2,
    PassportPersonhoodLogicV2: PassportPersonhoodLogicLibV2,
    PassportPoPScoreLogicV2: PassportPoPScoreLogicLibV2,
    PassportSignalingLogicV2: PassportSignalingLogicLibV2,
    PassportWhitelistAndBlacklistLogicV2: PassportWhitelistAndBlacklistLogicLibV2,

    PassportChecksLogicV3: PassportChecksLogicV3Lib,
    PassportConfiguratorV3: PassportConfiguratorV3Lib,
    PassportEntityLogicV3: PassportEntityLogicV3Lib,
    PassportDelegationLogicV3: PassportDelegationLogicV3Lib,
    PassportPersonhoodLogicV3: PassportPersonhoodLogicV3Lib,
    PassportPoPScoreLogicV3: PassportPoPScoreLogicV3Lib,
    PassportSignalingLogicV3: PassportSignalingLogicV3Lib,
    PassportWhitelistAndBlacklistLogicV3: PassportWhitelistAndBlacklistLogicV3Lib,

    // ------------------- LATEST VERSION ------------------- //
    PassportChecksLogic: PassportChecksLogicLib,
    PassportConfigurator: PassportConfiguratorLib,
    PassportEntityLogic: PassportEntityLogicLib,
    PassportDelegationLogic: PassportDelegationLogicLib,
    PassportPersonhoodLogic: PassportPersonhoodLogicLib,
    PassportPoPScoreLogic: PassportPoPScoreLogicLib,
    PassportSignalingLogic: PassportSignalingLogicLib,
    PassportWhitelistAndBlacklistLogic: PassportWhitelistAndBlacklistLogicLib,
  } as T["latestVersionOnly"] extends true ? PassportLatestLibraries : PassportLibraries
}
