import { ethers } from "hardhat"

export async function passportLibraries(latestOnly = false) {
  /// ______________ Latest ______________
  // Deploy Passport Checks Logic
  const PassportChecksLogic = await ethers.getContractFactory("PassportChecksLogic")
  const PassportChecksLogicLib = await PassportChecksLogic.deploy()
  await PassportChecksLogicLib.waitForDeployment()

  // Deploy Passport Configurator
  const PassportConfigurator = await ethers.getContractFactory("PassportConfigurator")
  const PassportConfiguratorLib = await PassportConfigurator.deploy()
  await PassportConfiguratorLib.waitForDeployment()

  // Deploy Passport Delegation Logic
  const PassportEntityLogic = await ethers.getContractFactory("PassportEntityLogic")
  const PassportEntityLogicLib = await PassportEntityLogic.deploy()
  await PassportEntityLogicLib.waitForDeployment()

  // Deploy Passport Delegation Logic
  const PassportDelegationLogic = await ethers.getContractFactory("PassportDelegationLogic")
  const PassportDelegationLogicLib = await PassportDelegationLogic.deploy()
  await PassportDelegationLogicLib.waitForDeployment()

  // Deploy Passport PoP Score Logic
  const PassportPoPScoreLogic = await ethers.getContractFactory("PassportPoPScoreLogic")
  const PassportPoPScoreLogicLib = await PassportPoPScoreLogic.deploy()
  await PassportPoPScoreLogicLib.waitForDeployment()

  // Deploy Passport Signaling Logic
  const PassportSignalingLogic = await ethers.getContractFactory("PassportSignalingLogic")
  const PassportSignalingLogicLib = await PassportSignalingLogic.deploy()
  await PassportSignalingLogicLib.waitForDeployment()

  // Deploy Passport Personhood Logic
  const PassportPersonhoodLogic = await ethers.getContractFactory("PassportPersonhoodLogic")
  const PassportPersonhoodLogicLib = await PassportPersonhoodLogic.deploy()
  await PassportPersonhoodLogicLib.waitForDeployment()

  // Deploy Passport Whitelist and Blacklist Logic
  const PassportWhitelistAndBlacklistLogic = await ethers.getContractFactory("PassportWhitelistAndBlacklistLogic")
  const PassportWhitelistAndBlacklistLogicLib = await PassportWhitelistAndBlacklistLogic.deploy()
  await PassportWhitelistAndBlacklistLogicLib.waitForDeployment()

  if (latestOnly) {
    return {
      PassportChecksLogic: PassportChecksLogicLib,
      PassportConfigurator: PassportConfiguratorLib,
      PassportEntityLogic: PassportEntityLogicLib,
      PassportDelegationLogic: PassportDelegationLogicLib,
      PassportPersonhoodLogic: PassportPersonhoodLogicLib,
      PassportPoPScoreLogic: PassportPoPScoreLogicLib,
      PassportSignalingLogic: PassportSignalingLogicLib,
      PassportWhitelistAndBlacklistLogic: PassportWhitelistAndBlacklistLogicLib,
    }
  }

  /// ______________ VERSION 1 ______________

  // Deploy Passport Checks LogicV1
  const PassportChecksLogicV1 = await ethers.getContractFactory("PassportChecksLogicV1")
  const PassportChecksLogicV1Lib = await PassportChecksLogicV1.deploy()
  await PassportChecksLogicV1Lib.waitForDeployment()

  // Deploy Passport ConfiguratorV1
  const PassportConfiguratorV1 = await ethers.getContractFactory("PassportConfiguratorV1")
  const PassportConfiguratorV1Lib = await PassportConfiguratorV1.deploy()
  await PassportConfiguratorV1Lib.waitForDeployment()

  // Deploy Passport Delegation LogicV1
  const PassportEntityLogicV1 = await ethers.getContractFactory("PassportEntityLogicV1")
  const PassportEntityLogicV1Lib = await PassportEntityLogicV1.deploy()
  await PassportEntityLogicV1Lib.waitForDeployment()

  // Deploy Passport Delegation LogicV1
  const PassportDelegationLogicV1 = await ethers.getContractFactory("PassportDelegationLogicV1")
  const PassportDelegationLogicV1Lib = await PassportDelegationLogicV1.deploy()
  await PassportDelegationLogicV1Lib.waitForDeployment()

  // Deploy Passport PoP Score LogicV1
  const PassportPoPScoreLogicV1 = await ethers.getContractFactory("PassportPoPScoreLogicV1")
  const PassportPoPScoreLogicV1Lib = await PassportPoPScoreLogicV1.deploy()
  await PassportPoPScoreLogicV1Lib.waitForDeployment()

  // Deploy Passport Signaling LogicV1
  const PassportSignalingLogicV1 = await ethers.getContractFactory("PassportSignalingLogicV1")
  const PassportSignalingLogicV1Lib = await PassportSignalingLogicV1.deploy()
  await PassportSignalingLogicV1Lib.waitForDeployment()

  // Deploy Passport Personhood LogicV1
  const PassportPersonhoodLogicV1 = await ethers.getContractFactory("PassportPersonhoodLogicV1")
  const PassportPersonhoodLogicV1Lib = await PassportPersonhoodLogicV1.deploy()
  await PassportPersonhoodLogicV1Lib.waitForDeployment()

  // Deploy Passport Whitelist and Blacklist LogicV1
  const PassportWhitelistAndBlacklistLogicV1 = await ethers.getContractFactory("PassportWhitelistAndBlacklistLogicV1")
  const PassportWhitelistAndBlacklistLogicV1Lib = await PassportWhitelistAndBlacklistLogicV1.deploy()
  await PassportWhitelistAndBlacklistLogicV1Lib.waitForDeployment()

  /// ______________ VERSION 2 ______________

  // Deploy Passport Checks Logic
  const PassportChecksLogicV2 = await ethers.getContractFactory("PassportChecksLogicV2")
  const PassportChecksLogicLibV2 = await PassportChecksLogicV2.deploy()
  await PassportChecksLogicLibV2.waitForDeployment()

  // Deploy Passport Configurator
  const PassportConfiguratorV2 = await ethers.getContractFactory("PassportConfiguratorV2")
  const PassportConfiguratorLibV2 = await PassportConfiguratorV2.deploy()
  await PassportConfiguratorLibV2.waitForDeployment()

  // Deploy Passport Delegation Logic
  const PassportEntityLogicV2 = await ethers.getContractFactory("PassportEntityLogicV2")
  const PassportEntityLogicLibV2 = await PassportEntityLogicV2.deploy()
  await PassportEntityLogicLibV2.waitForDeployment()

  // Deploy Passport Delegation Logic
  const PassportDelegationLogicV2 = await ethers.getContractFactory("PassportDelegationLogicV2")
  const PassportDelegationLogicLibV2 = await PassportDelegationLogicV2.deploy()
  await PassportDelegationLogicLibV2.waitForDeployment()

  // Deploy Passport PoP Score Logic
  const PassportPoPScoreLogicV2 = await ethers.getContractFactory("PassportPoPScoreLogicV2")
  const PassportPoPScoreLogicLibV2 = await PassportPoPScoreLogicV2.deploy()
  await PassportPoPScoreLogicLibV2.waitForDeployment()

  // Deploy Passport Signaling Logic
  const PassportSignalingLogicV2 = await ethers.getContractFactory("PassportSignalingLogicV2")
  const PassportSignalingLogicLibV2 = await PassportSignalingLogicV2.deploy()
  await PassportSignalingLogicLibV2.waitForDeployment()

  // Deploy Passport Personhood Logic
  const PassportPersonhoodLogicV2 = await ethers.getContractFactory("PassportPersonhoodLogicV2")
  const PassportPersonhoodLogicLibV2 = await PassportPersonhoodLogicV2.deploy()
  await PassportPersonhoodLogicLibV2.waitForDeployment()

  // Deploy Passport Whitelist and Blacklist Logic
  const PassportWhitelistAndBlacklistLogicV2 = await ethers.getContractFactory("PassportWhitelistAndBlacklistLogicV2")
  const PassportWhitelistAndBlacklistLogicLibV2 = await PassportWhitelistAndBlacklistLogicV2.deploy()
  await PassportWhitelistAndBlacklistLogicLibV2.waitForDeployment()

  /// ______________ VERSION 3 ______________

  // Deploy Passport Checks Logic V3
  const PassportChecksLogicV3 = await ethers.getContractFactory("PassportChecksLogicV3")
  const PassportChecksLogicV3Lib = await PassportChecksLogicV3.deploy()
  await PassportChecksLogicV3Lib.waitForDeployment()

  // Deploy Passport Configurator V3
  const PassportConfiguratorV3 = await ethers.getContractFactory("PassportConfiguratorV3")
  const PassportConfiguratorV3Lib = await PassportConfiguratorV3.deploy()
  await PassportConfiguratorV3Lib.waitForDeployment()

  // Deploy Passport Entity Logic V3
  const PassportEntityLogicV3 = await ethers.getContractFactory("PassportEntityLogicV3")
  const PassportEntityLogicV3Lib = await PassportEntityLogicV3.deploy()
  await PassportEntityLogicV3Lib.waitForDeployment()

  // Deploy Passport Delegation Logic V3
  const PassportDelegationLogicV3 = await ethers.getContractFactory("PassportDelegationLogicV3")
  const PassportDelegationLogicV3Lib = await PassportDelegationLogicV3.deploy()
  await PassportDelegationLogicV3Lib.waitForDeployment()

  // Deploy Passport PoP Score Logic V3
  const PassportPoPScoreLogicV3 = await ethers.getContractFactory("PassportPoPScoreLogicV3")
  const PassportPoPScoreLogicV3Lib = await PassportPoPScoreLogicV3.deploy()
  await PassportPoPScoreLogicV3Lib.waitForDeployment()

  // Deploy Passport Signaling Logic V3
  const PassportSignalingLogicV3 = await ethers.getContractFactory("PassportSignalingLogicV3")
  const PassportSignalingLogicV3Lib = await PassportSignalingLogicV3.deploy()
  await PassportSignalingLogicV3Lib.waitForDeployment()

  // Deploy Passport Personhood Logic V3
  const PassportPersonhoodLogicV3 = await ethers.getContractFactory("PassportPersonhoodLogicV3")
  const PassportPersonhoodLogicV3Lib = await PassportPersonhoodLogicV3.deploy()
  await PassportPersonhoodLogicV3Lib.waitForDeployment()

  // Deploy Passport Whitelist and Blacklist Logic V3
  const PassportWhitelistAndBlacklistLogicV3 = await ethers.getContractFactory("PassportWhitelistAndBlacklistLogicV3")
  const PassportWhitelistAndBlacklistLogicV3Lib = await PassportWhitelistAndBlacklistLogicV3.deploy()
  await PassportWhitelistAndBlacklistLogicV3Lib.waitForDeployment()

  // Deploy Clock Logic V3
  const PassportClockLogicV3 = await ethers.getContractFactory("PassportClockLogicV3")
  const PassportClockLogicV3Lib = await PassportClockLogicV3.deploy()
  await PassportClockLogicV3Lib.waitForDeployment()

  // Deploy EIP712Signing Logic V3
  const PassportEIP712SigningLogicV3 = await ethers.getContractFactory("PassportEIP712SigningLogicV3")
  const PassportEIP712SigningLogicV3Lib = await PassportEIP712SigningLogicV3.deploy()
  await PassportEIP712SigningLogicV3Lib.waitForDeployment()

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

    // V4 (latest)
    PassportChecksLogic: PassportChecksLogicLib,
    PassportConfigurator: PassportConfiguratorLib,
    PassportEntityLogic: PassportEntityLogicLib,
    PassportDelegationLogic: PassportDelegationLogicLib,
    PassportPersonhoodLogic: PassportPersonhoodLogicLib,
    PassportPoPScoreLogic: PassportPoPScoreLogicLib,
    PassportSignalingLogic: PassportSignalingLogicLib,
    PassportWhitelistAndBlacklistLogic: PassportWhitelistAndBlacklistLogicLib,
  }
}
