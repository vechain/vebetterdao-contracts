import { ethers } from "hardhat"

export async function governanceLibraries() {
  // ---------------------- Version 1 ----------------------
  // Deploy Governor Clock Logic
  const GovernorClockLogicV1 = await ethers.getContractFactory("GovernorClockLogicV1")
  const GovernorClockLogicLibV1 = await GovernorClockLogicV1.deploy()
  await GovernorClockLogicLibV1.waitForDeployment()

  // Deploy Governor Configurator
  const GovernorConfiguratorV1 = await ethers.getContractFactory("GovernorConfiguratorV1")
  const GovernorConfiguratorLibV1 = await GovernorConfiguratorV1.deploy()
  await GovernorConfiguratorLibV1.waitForDeployment()

  // Deploy Governor Function Restrictions Logic
  const GovernorFunctionRestrictionsLogicV1 = await ethers.getContractFactory("GovernorFunctionRestrictionsLogicV1")
  const GovernorFunctionRestrictionsLogicLibV1 = await GovernorFunctionRestrictionsLogicV1.deploy()
  await GovernorFunctionRestrictionsLogicLibV1.waitForDeployment()

  // Deploy Governor Governance Logic
  const GovernorGovernanceLogicV1 = await ethers.getContractFactory("GovernorGovernanceLogicV1")
  const GovernorGovernanceLogicLibV1 = await GovernorGovernanceLogicV1.deploy()
  await GovernorGovernanceLogicLibV1.waitForDeployment()

  // Deploy Governor Quorum Logic
  const GovernorQuorumLogicV1 = await ethers.getContractFactory("GovernorQuorumLogicV1", {
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
    },
  })
  const GovernorQuorumLogicLibV1 = await GovernorQuorumLogicV1.deploy()
  await GovernorQuorumLogicLibV1.waitForDeployment()

  // Deploy Governor Proposal Logic
  const GovernorProposalLogicV1 = await ethers.getContractFactory("GovernorProposalLogicV1", {
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
    },
  })
  const GovernorProposalLogicLibV1 = await GovernorProposalLogicV1.deploy()
  await GovernorProposalLogicLibV1.waitForDeployment()

  // Governance Voting Logic
  // Deploy Governor Votes Logic
  const GovernorVotesLogicV1 = await ethers.getContractFactory("GovernorVotesLogicV1", {
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
    },
  })
  const GovernorVotesLogicLibV1 = await GovernorVotesLogicV1.deploy()
  await GovernorVotesLogicLibV1.waitForDeployment()

  // Deploy Governor Deposit Logic
  const GovernorDepositLogicV1 = await ethers.getContractFactory("GovernorDepositLogicV1", {
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
    },
  })
  const GovernorDepositLogicLibV1 = await GovernorDepositLogicV1.deploy()
  await GovernorDepositLogicLibV1.waitForDeployment()

  // Deploy Governor State Logic
  const GovernorStateLogicV1 = await ethers.getContractFactory("GovernorStateLogicV1", {
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
    },
  })
  const GovernorStateLogicLibV1 = await GovernorStateLogicV1.deploy()
  await GovernorStateLogicLibV1.waitForDeployment()

  // ---------------------- Version 3 ----------------------

  const GovernorClockLogicV3 = await ethers.getContractFactory("GovernorClockLogicV3")
  const GovernorClockLogicLibV3 = await GovernorClockLogicV3.deploy()
  await GovernorClockLogicLibV3.waitForDeployment()

  // Deploy Governor Configurator
  const GovernorConfiguratorV3 = await ethers.getContractFactory("GovernorConfiguratorV3")
  const GovernorConfiguratorLibV3 = await GovernorConfiguratorV3.deploy()
  await GovernorConfiguratorLibV3.waitForDeployment()

  // Deploy Governor Function Restrictions Logic
  const GovernorFunctionRestrictionsLogicV3 = await ethers.getContractFactory("GovernorFunctionRestrictionsLogicV3")
  const GovernorFunctionRestrictionsLogicLibV3 = await GovernorFunctionRestrictionsLogicV3.deploy()
  await GovernorFunctionRestrictionsLogicLibV3.waitForDeployment()

  // Deploy Governor Governance Logic
  const GovernorGovernanceLogicV3 = await ethers.getContractFactory("GovernorGovernanceLogicV3")
  const GovernorGovernanceLogicLibV3 = await GovernorGovernanceLogicV3.deploy()
  await GovernorGovernanceLogicLibV3.waitForDeployment()

  // Deploy Governor Quorum Logic
  const GovernorQuorumLogicV3 = await ethers.getContractFactory("GovernorQuorumLogicV3", {
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
    },
  })
  const GovernorQuorumLogicLibV3 = await GovernorQuorumLogicV3.deploy()
  await GovernorQuorumLogicLibV3.waitForDeployment()

  // Deploy Governor Proposal Logic
  const GovernorProposalLogicV3 = await ethers.getContractFactory("GovernorProposalLogicV3", {
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
    },
  })
  const GovernorProposalLogicLibV3 = await GovernorProposalLogicV3.deploy()
  await GovernorProposalLogicLibV3.waitForDeployment()

  // Governance Voting Logic
  // Deploy Governor Votes Logic
  const GovernorVotesLogicV3 = await ethers.getContractFactory("GovernorVotesLogicV3", {
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
    },
  })
  const GovernorVotesLogicLibV3 = await GovernorVotesLogicV3.deploy()
  await GovernorVotesLogicLibV3.waitForDeployment()

  // Deploy Governor Deposit Logic
  const GovernorDepositLogicV3 = await ethers.getContractFactory("GovernorDepositLogicV3", {
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
    },
  })
  const GovernorDepositLogicLibV3 = await GovernorDepositLogicV3.deploy()
  await GovernorDepositLogicLibV3.waitForDeployment()

  // Deploy Governor State Logic
  const GovernorStateLogicV3 = await ethers.getContractFactory("GovernorStateLogicV3", {
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
    },
  })
  const GovernorStateLogicLibV3 = await GovernorStateLogicV3.deploy()
  await GovernorStateLogicLibV3.waitForDeployment()

  /// ---------------------- Version 4 ----------------------
  // Deploy Governor Clock Logic
  const GovernorClockLogic = await ethers.getContractFactory("GovernorClockLogic")
  const GovernorClockLogicLib = await GovernorClockLogic.deploy()
  await GovernorClockLogicLib.waitForDeployment()

  // Deploy Governor Configurator
  const GovernorConfigurator = await ethers.getContractFactory("GovernorConfigurator")
  const GovernorConfiguratorLib = await GovernorConfigurator.deploy()
  await GovernorConfiguratorLib.waitForDeployment()

  // Deploy Governor Function Restrictions Logic
  const GovernorFunctionRestrictionsLogic = await ethers.getContractFactory("GovernorFunctionRestrictionsLogic")
  const GovernorFunctionRestrictionsLogicLib = await GovernorFunctionRestrictionsLogic.deploy()
  await GovernorFunctionRestrictionsLogicLib.waitForDeployment()

  // Deploy Governor Governance Logic
  const GovernorGovernanceLogic = await ethers.getContractFactory("GovernorGovernanceLogic")
  const GovernorGovernanceLogicLib = await GovernorGovernanceLogic.deploy()
  await GovernorGovernanceLogicLib.waitForDeployment()

  // Deploy Governor Quorum Logic
  const GovernorQuorumLogic = await ethers.getContractFactory("GovernorQuorumLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorQuorumLogicLib = await GovernorQuorumLogic.deploy()
  await GovernorQuorumLogicLib.waitForDeployment()

  // Deploy Governor Proposal Logic
  const GovernorProposalLogic = await ethers.getContractFactory("GovernorProposalLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorProposalLogicLib = await GovernorProposalLogic.deploy()
  await GovernorProposalLogicLib.waitForDeployment()

  // Deploy Governor Votes Logic
  const GovernorVotesLogic = await ethers.getContractFactory("GovernorVotesLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorVotesLogicLib = await GovernorVotesLogic.deploy()
  await GovernorVotesLogicLib.waitForDeployment()

  // Deploy Governor Deposit Logic
  const GovernorDepositLogic = await ethers.getContractFactory("GovernorDepositLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorDepositLogicLib = await GovernorDepositLogic.deploy()
  await GovernorDepositLogicLib.waitForDeployment()

  // Deploy Governor State Logic
  const GovernorStateLogic = await ethers.getContractFactory("GovernorStateLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorStateLogicLib = await GovernorStateLogic.deploy()
  await GovernorStateLogicLib.waitForDeployment()

  return {
    GovernorClockLogicLibV1,
    GovernorConfiguratorLibV1,
    GovernorFunctionRestrictionsLogicLibV1,
    GovernorGovernanceLogicLibV1,
    GovernorQuorumLogicLibV1,
    GovernorProposalLogicLibV1,
    GovernorVotesLogicLibV1,
    GovernorDepositLogicLibV1,
    GovernorStateLogicLibV1,
    GovernorClockLogicLibV3,
    GovernorConfiguratorLibV3,
    GovernorFunctionRestrictionsLogicLibV3,
    GovernorGovernanceLogicLibV3,
    GovernorQuorumLogicLibV3,
    GovernorProposalLogicLibV3,
    GovernorVotesLogicLibV3,
    GovernorDepositLogicLibV3,
    GovernorStateLogicLibV3,
    GovernorClockLogicLib,
    GovernorConfiguratorLib,
    GovernorFunctionRestrictionsLogicLib,
    GovernorGovernanceLogicLib,
    GovernorQuorumLogicLib,
    GovernorProposalLogicLib,
    GovernorVotesLogicLib,
    GovernorDepositLogicLib,
    GovernorStateLogicLib,
  }
}
