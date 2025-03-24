import { ethers } from "hardhat"

export async function passportLibraries() {
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

  //// ______________ VERSION 3 ______________

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
