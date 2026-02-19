import { ethers } from "hardhat"
import {
  // ------------------- LATEST VERSION ------------------- //
  GovernorClockLogic,
  GovernorConfigurator,
  GovernorDepositLogic,
  GovernorFunctionRestrictionsLogic,
  GovernorGovernanceLogic,
  GovernorProposalLogic,
  GovernorQuorumLogic,
  GovernorStateLogic,
  GovernorVotesLogic,
  // ------------------- V1 ------------------- //
  GovernorClockLogicV1,
  GovernorConfiguratorV1,
  GovernorDepositLogicV1,
  GovernorFunctionRestrictionsLogicV1,
  GovernorGovernanceLogicV1,
  GovernorProposalLogicV1,
  GovernorQuorumLogicV1,
  GovernorStateLogicV1,
  GovernorVotesLogicV1,
  // ------------------- V3 ------------------- //
  GovernorClockLogicV3,
  GovernorConfiguratorV3,
  GovernorDepositLogicV3,
  GovernorFunctionRestrictionsLogicV3,
  GovernorGovernanceLogicV3,
  GovernorProposalLogicV3,
  GovernorQuorumLogicV3,
  GovernorStateLogicV3,
  GovernorVotesLogicV3,
  // ------------------- V4 ------------------- //
  GovernorClockLogicV4,
  GovernorConfiguratorV4,
  GovernorDepositLogicV4,
  GovernorFunctionRestrictionsLogicV4,
  GovernorGovernanceLogicV4,
  GovernorProposalLogicV4,
  GovernorQuorumLogicV4,
  GovernorStateLogicV4,
  GovernorVotesLogicV4,
  // ------------------- V5 ------------------- //
  GovernorClockLogicV5,
  GovernorConfiguratorV5,
  GovernorDepositLogicV5,
  GovernorFunctionRestrictionsLogicV5,
  GovernorGovernanceLogicV5,
  GovernorProposalLogicV5,
  GovernorQuorumLogicV5,
  GovernorStateLogicV5,
  GovernorVotesLogicV5,
  // ------------------- V6 ------------------- //
  GovernorClockLogicV6,
  GovernorConfiguratorV6,
  GovernorDepositLogicV6,
  GovernorFunctionRestrictionsLogicV6,
  GovernorGovernanceLogicV6,
  GovernorProposalLogicV6,
  GovernorQuorumLogicV6,
  GovernorStateLogicV6,
  GovernorVotesLogicV6,
  // ------------------- V7 ------------------- //
  GovernorClockLogicV7,
  GovernorConfiguratorV7,
  GovernorDepositLogicV7,
  GovernorFunctionRestrictionsLogicV7,
  GovernorGovernanceLogicV7,
  GovernorProposalLogicV7,
  GovernorQuorumLogicV7,
  GovernorStateLogicV7,
  GovernorVotesLogicV7,
  // ------------------- V8 ------------------- //
  GovernorClockLogicV8,
  GovernorConfiguratorV8,
  GovernorDepositLogicV8,
  GovernorFunctionRestrictionsLogicV8,
  GovernorProposalLogicV8,
  GovernorQuorumLogicV8,
  GovernorStateLogicV8,
  GovernorVotesLogicV8,
  GovernorGovernanceLogicV8,
} from "../../typechain-types"

interface DeployGovernanceLibrariesArgs {
  logOutput?: boolean
  latestVersionOnly?: boolean
}

export type GovernanceLatestLibraries = {
  GovernorClockLogicLib: GovernorClockLogic
  GovernorConfiguratorLib: GovernorConfigurator
  GovernorFunctionRestrictionsLogicLib: GovernorFunctionRestrictionsLogic
  GovernorGovernanceLogicLib: GovernorGovernanceLogic
  GovernorQuorumLogicLib: GovernorQuorumLogic
  GovernorProposalLogicLib: GovernorProposalLogic
  GovernorVotesLogicLib: GovernorVotesLogic
  GovernorDepositLogicLib: GovernorDepositLogic
  GovernorStateLogicLib: GovernorStateLogic
}

export type GovernanceLibraries = GovernanceLatestLibraries & {
  GovernorClockLogicLibV1: GovernorClockLogicV1
  GovernorConfiguratorLibV1: GovernorConfiguratorV1
  GovernorFunctionRestrictionsLogicLibV1: GovernorFunctionRestrictionsLogicV1
  GovernorGovernanceLogicLibV1: GovernorGovernanceLogicV1
  GovernorQuorumLogicLibV1: GovernorQuorumLogicV1
  GovernorProposalLogicLibV1: GovernorProposalLogicV1
  GovernorVotesLogicLibV1: GovernorVotesLogicV1
  GovernorDepositLogicLibV1: GovernorDepositLogicV1
  GovernorStateLogicLibV1: GovernorStateLogicV1
  GovernorClockLogicLibV3: GovernorClockLogicV3
  GovernorConfiguratorLibV3: GovernorConfiguratorV3
  GovernorFunctionRestrictionsLogicLibV3: GovernorFunctionRestrictionsLogicV3
  GovernorGovernanceLogicLibV3: GovernorGovernanceLogicV3
  GovernorQuorumLogicLibV3: GovernorQuorumLogicV3
  GovernorProposalLogicLibV3: GovernorProposalLogicV3
  GovernorVotesLogicLibV3: GovernorVotesLogicV3
  GovernorDepositLogicLibV3: GovernorDepositLogicV3
  GovernorStateLogicLibV3: GovernorStateLogicV3
  GovernorClockLogicLibV4: GovernorClockLogicV4
  GovernorConfiguratorLibV4: GovernorConfiguratorV4
  GovernorFunctionRestrictionsLogicLibV4: GovernorFunctionRestrictionsLogicV4
  GovernorGovernanceLogicLibV4: GovernorGovernanceLogicV4
  GovernorQuorumLogicLibV4: GovernorQuorumLogicV4
  GovernorProposalLogicLibV4: GovernorProposalLogicV4
  GovernorVotesLogicLibV4: GovernorVotesLogicV4
  GovernorDepositLogicLibV4: GovernorDepositLogicV4
  GovernorStateLogicLibV4: GovernorStateLogicV4
  GovernorClockLogicLibV5: GovernorClockLogicV5
  GovernorConfiguratorLibV5: GovernorConfiguratorV5
  GovernorFunctionRestrictionsLogicLibV5: GovernorFunctionRestrictionsLogicV5
  GovernorGovernanceLogicLibV5: GovernorGovernanceLogicV5
  GovernorQuorumLogicLibV5: GovernorQuorumLogicV5
  GovernorProposalLogicLibV5: GovernorProposalLogicV5
  GovernorVotesLogicLibV5: GovernorVotesLogicV5
  GovernorDepositLogicLibV5: GovernorDepositLogicV5
  GovernorStateLogicLibV5: GovernorStateLogicV5
  GovernorClockLogicLibV6: GovernorClockLogicV6
  GovernorConfiguratorLibV6: GovernorConfiguratorV6
  GovernorFunctionRestrictionsLogicLibV6: GovernorFunctionRestrictionsLogicV6
  GovernorGovernanceLogicLibV6: GovernorGovernanceLogicV6
  GovernorQuorumLogicLibV6: GovernorQuorumLogicV6
  GovernorProposalLogicLibV6: GovernorProposalLogicV6
  GovernorVotesLogicLibV6: GovernorVotesLogicV6
  GovernorDepositLogicLibV6: GovernorDepositLogicV6
  GovernorStateLogicLibV6: GovernorStateLogicV6
  GovernorClockLogicLibV7: GovernorClockLogicV7
  GovernorConfiguratorLibV7: GovernorConfiguratorV7
  GovernorDepositLogicLibV7: GovernorDepositLogicV7
  GovernorFunctionRestrictionsLogicLibV7: GovernorFunctionRestrictionsLogicV7
  GovernorProposalLogicLibV7: GovernorProposalLogicV7
  GovernorQuorumLogicLibV7: GovernorQuorumLogicV7
  GovernorStateLogicLibV7: GovernorStateLogicV7
  GovernorVotesLogicLibV7: GovernorVotesLogicV7
  GovernorGovernanceLogicLibV7: GovernorGovernanceLogicV7
  GovernorClockLogicLibV8: GovernorClockLogicV8
  GovernorConfiguratorLibV8: GovernorConfiguratorV8
  GovernorDepositLogicLibV8: GovernorDepositLogicV8
  GovernorFunctionRestrictionsLogicLibV8: GovernorFunctionRestrictionsLogicV8
  GovernorProposalLogicLibV8: GovernorProposalLogicV8
  GovernorQuorumLogicLibV8: GovernorQuorumLogicV8
  GovernorStateLogicLibV8: GovernorStateLogicV8
  GovernorVotesLogicLibV8: GovernorVotesLogicV8
  GovernorGovernanceLogicLibV8: GovernorGovernanceLogicV8
}

export async function governanceLibraries<T extends DeployGovernanceLibrariesArgs>({
  logOutput = false,
  latestVersionOnly = false,
}: T): Promise<T["latestVersionOnly"] extends true ? GovernanceLatestLibraries : GovernanceLibraries> {
  // ------------------- LATEST VERSION ------------------- //
  // Deploy Governor Clock Logic
  const GovernorClockLogic = await ethers.getContractFactory("GovernorClockLogic")
  const GovernorClockLogicLib = (await GovernorClockLogic.deploy()) as GovernorClockLogic
  await GovernorClockLogicLib.waitForDeployment()
  logOutput && console.log("GovernorClockLogic Library deployed")

  // Deploy Governor Configurator
  const GovernorConfigurator = await ethers.getContractFactory("GovernorConfigurator")
  const GovernorConfiguratorLib = (await GovernorConfigurator.deploy()) as GovernorConfigurator
  await GovernorConfiguratorLib.waitForDeployment()
  logOutput && console.log("GovernorConfigurator Library deployed")

  // Deploy Governor Function Restrictions Logic
  const GovernorFunctionRestrictionsLogic = await ethers.getContractFactory("GovernorFunctionRestrictionsLogic")
  const GovernorFunctionRestrictionsLogicLib =
    (await GovernorFunctionRestrictionsLogic.deploy()) as GovernorFunctionRestrictionsLogic
  await GovernorFunctionRestrictionsLogicLib.waitForDeployment()
  logOutput && console.log("GovernorFunctionRestrictionsLogic Library deployed")

  // Deploy Governor Governance Logic
  const GovernorGovernanceLogic = await ethers.getContractFactory("GovernorGovernanceLogic")
  const GovernorGovernanceLogicLib = (await GovernorGovernanceLogic.deploy()) as GovernorGovernanceLogic
  await GovernorGovernanceLogicLib.waitForDeployment()
  logOutput && console.log("GovernorGovernanceLogic Library deployed")

  // Deploy Governor Quorum Logic
  const GovernorQuorumLogic = await ethers.getContractFactory("GovernorQuorumLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorQuorumLogicLib = (await GovernorQuorumLogic.deploy()) as GovernorQuorumLogic
  await GovernorQuorumLogicLib.waitForDeployment()
  logOutput && console.log("GovernorQuorumLogic Library deployed")

  // Deploy Governor Proposal Logic
  const GovernorProposalLogic = await ethers.getContractFactory("GovernorProposalLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorProposalLogicLib = (await GovernorProposalLogic.deploy()) as GovernorProposalLogic
  await GovernorProposalLogicLib.waitForDeployment()
  logOutput && console.log("GovernorProposalLogic Library deployed")

  // Deploy Governor Votes Logic
  const GovernorVotesLogic = await ethers.getContractFactory("GovernorVotesLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
      GovernorProposalLogic: await GovernorProposalLogicLib.getAddress(),
    },
  })
  const GovernorVotesLogicLib = (await GovernorVotesLogic.deploy()) as GovernorVotesLogic
  await GovernorVotesLogicLib.waitForDeployment()
  logOutput && console.log("GovernorVotesLogic Library deployed")

  // Deploy Governor Deposit Logic
  const GovernorDepositLogic = await ethers.getContractFactory("GovernorDepositLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorDepositLogicLib = (await GovernorDepositLogic.deploy()) as GovernorDepositLogic
  await GovernorDepositLogicLib.waitForDeployment()
  logOutput && console.log("GovernorDepositLogic Library deployed")

  // Deploy Governor State Logic
  const GovernorStateLogic = await ethers.getContractFactory("GovernorStateLogic", {
    libraries: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
    },
  })
  const GovernorStateLogicLib = (await GovernorStateLogic.deploy()) as GovernorStateLogic
  await GovernorStateLogicLib.waitForDeployment()
  logOutput && console.log("GovernorStateLogic Library deployed")

  if (latestVersionOnly) {
    return {
      GovernorClockLogicLib,
      GovernorConfiguratorLib,
      GovernorFunctionRestrictionsLogicLib,
      GovernorGovernanceLogicLib,
      GovernorQuorumLogicLib,
      GovernorProposalLogicLib,
      GovernorVotesLogicLib,
      GovernorDepositLogicLib,
      GovernorStateLogicLib,
    } as T["latestVersionOnly"] extends true ? GovernanceLatestLibraries : GovernanceLibraries
  }

  // ------------------- DEPRECATED VERSION ------------------- //
  // ------------------- V1 ------------------- //
  // Deploy Governor Clock Logic
  const GovernorClockLogicV1 = await ethers.getContractFactory("GovernorClockLogicV1")
  const GovernorClockLogicLibV1 = (await GovernorClockLogicV1.deploy()) as GovernorClockLogicV1
  await GovernorClockLogicLibV1.waitForDeployment()
  logOutput && console.log("GovernorClockLogicV1 Library deployed")

  // Deploy Governor Configurator
  const GovernorConfiguratorV1 = await ethers.getContractFactory("GovernorConfiguratorV1")
  const GovernorConfiguratorLibV1 = (await GovernorConfiguratorV1.deploy()) as GovernorConfiguratorV1
  await GovernorConfiguratorLibV1.waitForDeployment()
  logOutput && console.log("GovernorConfiguratorV1 Library deployed")

  // Deploy Governor Function Restrictions Logic
  const GovernorFunctionRestrictionsLogicV1 = await ethers.getContractFactory("GovernorFunctionRestrictionsLogicV1")
  const GovernorFunctionRestrictionsLogicLibV1 =
    (await GovernorFunctionRestrictionsLogicV1.deploy()) as GovernorFunctionRestrictionsLogicV1
  await GovernorFunctionRestrictionsLogicLibV1.waitForDeployment()
  logOutput && console.log("GovernorFunctionRestrictionsLogicV1 Library deployed")

  // Deploy Governor Governance Logic
  const GovernorGovernanceLogicV1 = await ethers.getContractFactory("GovernorGovernanceLogicV1")
  const GovernorGovernanceLogicLibV1 = (await GovernorGovernanceLogicV1.deploy()) as GovernorGovernanceLogicV1
  await GovernorGovernanceLogicLibV1.waitForDeployment()
  logOutput && console.log("GovernorGovernanceLogicV1 Library deployed")

  // Deploy Governor Quorum Logic
  const GovernorQuorumLogicV1 = await ethers.getContractFactory("GovernorQuorumLogicV1", {
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
    },
  })
  const GovernorQuorumLogicLibV1 = (await GovernorQuorumLogicV1.deploy()) as GovernorQuorumLogicV1
  await GovernorQuorumLogicLibV1.waitForDeployment()
  logOutput && console.log("GovernorQuorumLogicV1 Library deployed")

  // Deploy Governor Proposal Logic
  const GovernorProposalLogicV1 = await ethers.getContractFactory("GovernorProposalLogicV1", {
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
    },
  })
  const GovernorProposalLogicLibV1 = (await GovernorProposalLogicV1.deploy()) as GovernorProposalLogicV1
  await GovernorProposalLogicLibV1.waitForDeployment()
  logOutput && console.log("GovernorProposalLogicV1 Library deployed")

  // Deploy Governor Votes Logic
  const GovernorVotesLogicV1 = await ethers.getContractFactory("GovernorVotesLogicV1", {
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
    },
  })
  const GovernorVotesLogicLibV1 = (await GovernorVotesLogicV1.deploy()) as GovernorVotesLogicV1
  await GovernorVotesLogicLibV1.waitForDeployment()
  logOutput && console.log("GovernorVotesLogicV1 Library deployed")

  // Deploy Governor Deposit Logic
  const GovernorDepositLogicV1 = await ethers.getContractFactory("GovernorDepositLogicV1", {
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
    },
  })
  const GovernorDepositLogicLibV1 = (await GovernorDepositLogicV1.deploy()) as GovernorDepositLogicV1
  await GovernorDepositLogicLibV1.waitForDeployment()
  logOutput && console.log("GovernorDepositLogicV1 Library deployed")

  // Deploy Governor State Logic
  const GovernorStateLogicV1 = await ethers.getContractFactory("GovernorStateLogicV1", {
    libraries: {
      GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
    },
  })
  const GovernorStateLogicLibV1 = (await GovernorStateLogicV1.deploy()) as GovernorStateLogicV1
  await GovernorStateLogicLibV1.waitForDeployment()
  logOutput && console.log("GovernorStateLogicV1 Library deployed")

  // ------------------- V3 ------------------- //
  const GovernorClockLogicV3 = await ethers.getContractFactory("GovernorClockLogicV3")
  const GovernorClockLogicLibV3 = (await GovernorClockLogicV3.deploy()) as GovernorClockLogicV3
  await GovernorClockLogicLibV3.waitForDeployment()
  logOutput && console.log("GovernorClockLogicV3 Library deployed")

  // Deploy Governor Configurator
  const GovernorConfiguratorV3 = await ethers.getContractFactory("GovernorConfiguratorV3")
  const GovernorConfiguratorLibV3 = (await GovernorConfiguratorV3.deploy()) as GovernorConfiguratorV3
  await GovernorConfiguratorLibV3.waitForDeployment()
  logOutput && console.log("GovernorConfiguratorV3 Library deployed")

  // Deploy Governor Function Restrictions Logic
  const GovernorFunctionRestrictionsLogicV3 = await ethers.getContractFactory("GovernorFunctionRestrictionsLogicV3")
  const GovernorFunctionRestrictionsLogicLibV3 =
    (await GovernorFunctionRestrictionsLogicV3.deploy()) as GovernorFunctionRestrictionsLogicV3
  await GovernorFunctionRestrictionsLogicLibV3.waitForDeployment()
  logOutput && console.log("GovernorFunctionRestrictionsLogicV3 Library deployed")

  // Deploy Governor Governance Logic
  const GovernorGovernanceLogicV3 = await ethers.getContractFactory("GovernorGovernanceLogicV3")
  const GovernorGovernanceLogicLibV3 = (await GovernorGovernanceLogicV3.deploy()) as GovernorGovernanceLogicV3
  await GovernorGovernanceLogicLibV3.waitForDeployment()
  logOutput && console.log("GovernorGovernanceLogicV3 Library deployed")

  // Deploy Governor Quorum Logic
  const GovernorQuorumLogicV3 = await ethers.getContractFactory("GovernorQuorumLogicV3", {
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
    },
  })
  const GovernorQuorumLogicLibV3 = (await GovernorQuorumLogicV3.deploy()) as GovernorQuorumLogicV3
  await GovernorQuorumLogicLibV3.waitForDeployment()
  logOutput && console.log("GovernorQuorumLogicV3 Library deployed")

  // Deploy Governor Proposal Logic
  const GovernorProposalLogicV3 = await ethers.getContractFactory("GovernorProposalLogicV3", {
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
    },
  })
  const GovernorProposalLogicLibV3 = (await GovernorProposalLogicV3.deploy()) as GovernorProposalLogicV3
  await GovernorProposalLogicLibV3.waitForDeployment()
  logOutput && console.log("GovernorProposalLogicV3 Library deployed")

  // Deploy Governor Votes Logic
  const GovernorVotesLogicV3 = await ethers.getContractFactory("GovernorVotesLogicV3", {
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
    },
  })
  const GovernorVotesLogicLibV3 = (await GovernorVotesLogicV3.deploy()) as GovernorVotesLogicV3
  await GovernorVotesLogicLibV3.waitForDeployment()
  logOutput && console.log("GovernorVotesLogicV3 Library deployed")

  // Deploy Governor Deposit Logic
  const GovernorDepositLogicV3 = await ethers.getContractFactory("GovernorDepositLogicV3", {
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
    },
  })
  const GovernorDepositLogicLibV3 = (await GovernorDepositLogicV3.deploy()) as GovernorDepositLogicV3
  await GovernorDepositLogicLibV3.waitForDeployment()
  logOutput && console.log("GovernorDepositLogicV3 Library deployed")

  // Deploy Governor State Logic
  const GovernorStateLogicV3 = await ethers.getContractFactory("GovernorStateLogicV3", {
    libraries: {
      GovernorClockLogicV3: await GovernorClockLogicLibV3.getAddress(),
    },
  })
  const GovernorStateLogicLibV3 = (await GovernorStateLogicV3.deploy()) as GovernorStateLogicV3
  await GovernorStateLogicLibV3.waitForDeployment()
  logOutput && console.log("GovernorStateLogicV3 Library deployed")

  // ------------------- V4 ------------------- //
  // Deploy Governor Clock Logic
  const GovernorClockLogicV4 = await ethers.getContractFactory("GovernorClockLogicV4")
  const GovernorClockLogicLibV4 = (await GovernorClockLogicV4.deploy()) as GovernorClockLogicV4
  await GovernorClockLogicLibV4.waitForDeployment()
  logOutput && console.log("GovernorClockLogicV4 Library deployed")

  // Deploy Governor Configurator
  const GovernorConfiguratorV4 = await ethers.getContractFactory("GovernorConfiguratorV4")
  const GovernorConfiguratorLibV4 = (await GovernorConfiguratorV4.deploy()) as GovernorConfiguratorV4
  await GovernorConfiguratorLibV4.waitForDeployment()
  logOutput && console.log("GovernorConfiguratorV4 Library deployed")

  // Deploy Governor Function Restrictions Logic
  const GovernorFunctionRestrictionsLogicV4 = await ethers.getContractFactory("GovernorFunctionRestrictionsLogicV4")
  const GovernorFunctionRestrictionsLogicLibV4 =
    (await GovernorFunctionRestrictionsLogicV4.deploy()) as GovernorFunctionRestrictionsLogicV4
  await GovernorFunctionRestrictionsLogicLibV4.waitForDeployment()
  logOutput && console.log("GovernorFunctionRestrictionsLogicV4 Library deployed")

  // Deploy Governor Governance Logic
  const GovernorGovernanceLogicV4 = await ethers.getContractFactory("GovernorGovernanceLogicV4")
  const GovernorGovernanceLogicLibV4 = (await GovernorGovernanceLogicV4.deploy()) as GovernorGovernanceLogicV4
  await GovernorGovernanceLogicLibV4.waitForDeployment()
  logOutput && console.log("GovernorGovernanceLogicV4 Library deployed")

  // Deploy Governor Quorum Logic
  const GovernorQuorumLogicV4 = await ethers.getContractFactory("GovernorQuorumLogicV4", {
    libraries: {
      GovernorClockLogicV4: await GovernorClockLogicLibV4.getAddress(),
    },
  })
  const GovernorQuorumLogicLibV4 = (await GovernorQuorumLogicV4.deploy()) as GovernorQuorumLogicV4
  await GovernorQuorumLogicLibV4.waitForDeployment()
  logOutput && console.log("GovernorQuorumLogicV4 Library deployed")

  // Deploy Governor Proposal Logic
  const GovernorProposalLogicV4 = await ethers.getContractFactory("GovernorProposalLogicV4", {
    libraries: {
      GovernorClockLogicV4: await GovernorClockLogicLibV4.getAddress(),
    },
  })
  const GovernorProposalLogicLibV4 = (await GovernorProposalLogicV4.deploy()) as GovernorProposalLogicV4
  await GovernorProposalLogicLibV4.waitForDeployment()
  logOutput && console.log("GovernorProposalLogicV4 Library deployed")

  // Deploy Governor Votes Logic
  const GovernorVotesLogicV4 = await ethers.getContractFactory("GovernorVotesLogicV4", {
    libraries: {
      GovernorClockLogicV4: await GovernorClockLogicLibV4.getAddress(),
    },
  })
  const GovernorVotesLogicLibV4 = (await GovernorVotesLogicV4.deploy()) as GovernorVotesLogicV4
  await GovernorVotesLogicLibV4.waitForDeployment()
  logOutput && console.log("GovernorVotesLogicV4 Library deployed")

  // Deploy Governor Deposit Logic
  const GovernorDepositLogicV4 = await ethers.getContractFactory("GovernorDepositLogicV4", {
    libraries: {
      GovernorClockLogicV4: await GovernorClockLogicLibV4.getAddress(),
    },
  })
  const GovernorDepositLogicLibV4 = (await GovernorDepositLogicV4.deploy()) as GovernorDepositLogicV4
  await GovernorDepositLogicLibV4.waitForDeployment()
  logOutput && console.log("GovernorDepositLogicV4 Library deployed")

  // Deploy Governor State Logic
  const GovernorStateLogicV4 = await ethers.getContractFactory("GovernorStateLogicV4", {
    libraries: {
      GovernorClockLogicV4: await GovernorClockLogicLibV4.getAddress(),
    },
  })
  const GovernorStateLogicLibV4 = (await GovernorStateLogicV4.deploy()) as GovernorStateLogicV4
  await GovernorStateLogicLibV4.waitForDeployment()
  logOutput && console.log("GovernorStateLogicV4 Library deployed")

  // ------------------- V5 ------------------- //
  // Deploy Governor Clock Logic
  const GovernorClockLogicV5 = await ethers.getContractFactory("GovernorClockLogicV5")
  const GovernorClockLogicLibV5 = (await GovernorClockLogicV5.deploy()) as GovernorClockLogicV5
  await GovernorClockLogicLibV5.waitForDeployment()
  logOutput && console.log("GovernorClockLogicV5 Library deployed")

  // Deploy Governor Configurator
  const GovernorConfiguratorV5 = await ethers.getContractFactory("GovernorConfiguratorV5")
  const GovernorConfiguratorLibV5 = (await GovernorConfiguratorV5.deploy()) as GovernorConfiguratorV5
  await GovernorConfiguratorLibV5.waitForDeployment()
  logOutput && console.log("GovernorConfiguratorV5 Library deployed")

  // Deploy Governor Function Restrictions Logic
  const GovernorFunctionRestrictionsLogicV5 = await ethers.getContractFactory("GovernorFunctionRestrictionsLogicV5")
  const GovernorFunctionRestrictionsLogicLibV5 =
    (await GovernorFunctionRestrictionsLogicV5.deploy()) as GovernorFunctionRestrictionsLogicV5
  await GovernorFunctionRestrictionsLogicLibV5.waitForDeployment()
  logOutput && console.log("GovernorFunctionRestrictionsLogicV5 Library deployed")

  // Deploy Governor Governance Logic
  const GovernorGovernanceLogicV5 = await ethers.getContractFactory("GovernorGovernanceLogicV5")
  const GovernorGovernanceLogicLibV5 = (await GovernorGovernanceLogicV5.deploy()) as GovernorGovernanceLogicV5
  await GovernorGovernanceLogicLibV5.waitForDeployment()
  logOutput && console.log("GovernorGovernanceLogicV5 Library deployed")

  // Deploy Governor Quorum Logic
  const GovernorQuorumLogicV5 = await ethers.getContractFactory("GovernorQuorumLogicV5", {
    libraries: {
      GovernorClockLogicV5: await GovernorClockLogicLibV5.getAddress(),
    },
  })
  const GovernorQuorumLogicLibV5 = (await GovernorQuorumLogicV5.deploy()) as GovernorQuorumLogicV5
  await GovernorQuorumLogicLibV5.waitForDeployment()
  logOutput && console.log("GovernorQuorumLogicV5 Library deployed")

  // Deploy Governor Proposal Logic
  const GovernorProposalLogicV5 = await ethers.getContractFactory("GovernorProposalLogicV5", {
    libraries: {
      GovernorClockLogicV5: await GovernorClockLogicLibV5.getAddress(),
    },
  })
  const GovernorProposalLogicLibV5 = (await GovernorProposalLogicV5.deploy()) as GovernorProposalLogicV5
  await GovernorProposalLogicLibV5.waitForDeployment()
  logOutput && console.log("GovernorProposalLogicV5 Library deployed")

  // Deploy Governor Votes Logic
  const GovernorVotesLogicV5 = await ethers.getContractFactory("GovernorVotesLogicV5", {
    libraries: {
      GovernorClockLogicV5: await GovernorClockLogicLibV5.getAddress(),
    },
  })
  const GovernorVotesLogicLibV5 = (await GovernorVotesLogicV5.deploy()) as GovernorVotesLogicV5
  await GovernorVotesLogicLibV5.waitForDeployment()
  logOutput && console.log("GovernorVotesLogicV5 Library deployed")

  // Deploy Governor Deposit Logic
  const GovernorDepositLogicV5 = await ethers.getContractFactory("GovernorDepositLogicV5", {
    libraries: {
      GovernorClockLogicV5: await GovernorClockLogicLibV5.getAddress(),
    },
  })
  const GovernorDepositLogicLibV5 = (await GovernorDepositLogicV5.deploy()) as GovernorDepositLogicV5
  await GovernorDepositLogicLibV5.waitForDeployment()
  logOutput && console.log("GovernorDepositLogicV5 Library deployed")

  // Deploy Governor State Logic
  const GovernorStateLogicV5 = await ethers.getContractFactory("GovernorStateLogicV5", {
    libraries: {
      GovernorClockLogicV5: await GovernorClockLogicLibV5.getAddress(),
    },
  })
  const GovernorStateLogicLibV5 = (await GovernorStateLogicV5.deploy()) as GovernorStateLogicV5
  await GovernorStateLogicLibV5.waitForDeployment()
  logOutput && console.log("GovernorStateLogicV5 Library deployed")

  // ------------------- V6 ------------------- //
  // Deploy Governor Clock Logic
  const GovernorClockLogicV6 = await ethers.getContractFactory("GovernorClockLogicV6")
  const GovernorClockLogicLibV6 = (await GovernorClockLogicV6.deploy()) as GovernorClockLogicV6
  await GovernorClockLogicLibV6.waitForDeployment()
  logOutput && console.log("GovernorClockLogicV6 Library deployed")

  // Deploy Governor Configurator
  const GovernorConfiguratorV6 = await ethers.getContractFactory("GovernorConfiguratorV6")
  const GovernorConfiguratorLibV6 = (await GovernorConfiguratorV6.deploy()) as GovernorConfiguratorV6
  await GovernorConfiguratorLibV6.waitForDeployment()
  logOutput && console.log("GovernorConfiguratorV6 Library deployed")

  // Deploy Governor Function Restrictions Logic
  const GovernorFunctionRestrictionsLogicV6 = await ethers.getContractFactory("GovernorFunctionRestrictionsLogicV6")
  const GovernorFunctionRestrictionsLogicLibV6 =
    (await GovernorFunctionRestrictionsLogicV6.deploy()) as GovernorFunctionRestrictionsLogicV6
  await GovernorFunctionRestrictionsLogicLibV6.waitForDeployment()
  logOutput && console.log("GovernorFunctionRestrictionsLogicV6 Library deployed")

  // Deploy Governor Governance Logic
  const GovernorGovernanceLogicV6 = await ethers.getContractFactory("GovernorGovernanceLogicV6")
  const GovernorGovernanceLogicLibV6 = (await GovernorGovernanceLogicV6.deploy()) as GovernorGovernanceLogicV6
  await GovernorGovernanceLogicLibV6.waitForDeployment()
  logOutput && console.log("GovernorGovernanceLogicV6 Library deployed")

  // Deploy Governor Quorum Logic
  const GovernorQuorumLogicV6 = await ethers.getContractFactory("GovernorQuorumLogicV6", {
    libraries: {
      GovernorClockLogicV6: await GovernorClockLogicLibV6.getAddress(),
    },
  })
  const GovernorQuorumLogicLibV6 = (await GovernorQuorumLogicV6.deploy()) as GovernorQuorumLogicV6
  await GovernorQuorumLogicLibV6.waitForDeployment()
  logOutput && console.log("GovernorQuorumLogicV6 Library deployed")

  // Deploy Governor Proposal Logic
  const GovernorProposalLogicV6 = await ethers.getContractFactory("GovernorProposalLogicV6", {
    libraries: {
      GovernorClockLogicV6: await GovernorClockLogicLibV6.getAddress(),
    },
  })
  const GovernorProposalLogicLibV6 = (await GovernorProposalLogicV6.deploy()) as GovernorProposalLogicV6
  await GovernorProposalLogicLibV6.waitForDeployment()
  logOutput && console.log("GovernorProposalLogicV6 Library deployed")

  // Deploy Governor Votes Logic
  const GovernorVotesLogicV6 = await ethers.getContractFactory("GovernorVotesLogicV6", {
    libraries: {
      GovernorClockLogicV6: await GovernorClockLogicLibV6.getAddress(),
    },
  })
  const GovernorVotesLogicLibV6 = (await GovernorVotesLogicV6.deploy()) as GovernorVotesLogicV6
  await GovernorVotesLogicLibV6.waitForDeployment()
  logOutput && console.log("GovernorVotesLogicV6 Library deployed")

  // Deploy Governor Deposit Logic
  const GovernorDepositLogicV6 = await ethers.getContractFactory("GovernorDepositLogicV6", {
    libraries: {
      GovernorClockLogicV6: await GovernorClockLogicLibV6.getAddress(),
    },
  })
  const GovernorDepositLogicLibV6 = (await GovernorDepositLogicV6.deploy()) as GovernorDepositLogicV6
  await GovernorDepositLogicLibV6.waitForDeployment()
  logOutput && console.log("GovernorDepositLogicV6 Library deployed")

  // Deploy Governor State Logic
  const GovernorStateLogicV6 = await ethers.getContractFactory("GovernorStateLogicV6", {
    libraries: {
      GovernorClockLogicV6: await GovernorClockLogicLibV6.getAddress(),
    },
  })
  const GovernorStateLogicLibV6 = (await GovernorStateLogicV6.deploy()) as GovernorStateLogicV6
  await GovernorStateLogicLibV6.waitForDeployment()
  logOutput && console.log("GovernorStateLogicV6 Library deployed")

  // ------------------- V7 ------------------- //
  const GovernorClockLogicV7 = await ethers.getContractFactory("GovernorClockLogicV7")
  const GovernorClockLogicLibV7 = (await GovernorClockLogicV7.deploy()) as GovernorClockLogicV7
  await GovernorClockLogicLibV7.waitForDeployment()
  logOutput && console.log("GovernorClockLogicV7 Library deployed")

  const GovernorConfiguratorV7 = await ethers.getContractFactory("GovernorConfiguratorV7")
  const GovernorConfiguratorLibV7 = (await GovernorConfiguratorV7.deploy()) as GovernorConfiguratorV7
  await GovernorConfiguratorLibV7.waitForDeployment()
  logOutput && console.log("GovernorConfiguratorV7 Library deployed")

  const GovernorDepositLogicV7 = await ethers.getContractFactory("GovernorDepositLogicV7", {
    libraries: {
      GovernorClockLogicV7: await GovernorClockLogicLibV7.getAddress(),
    },
  })
  const GovernorDepositLogicLibV7 = (await GovernorDepositLogicV7.deploy()) as GovernorDepositLogicV7
  await GovernorDepositLogicLibV7.waitForDeployment()
  logOutput && console.log("GovernorDepositLogicV7 Library deployed")

  const GovernorFunctionRestrictionsLogicV7 = await ethers.getContractFactory("GovernorFunctionRestrictionsLogicV7")
  const GovernorFunctionRestrictionsLogicLibV7 =
    (await GovernorFunctionRestrictionsLogicV7.deploy()) as GovernorFunctionRestrictionsLogicV7
  await GovernorFunctionRestrictionsLogicLibV7.waitForDeployment()
  logOutput && console.log("GovernorFunctionRestrictionsLogicV7 Library deployed")

  const GovernorProposalLogicV7 = await ethers.getContractFactory("GovernorProposalLogicV7", {
    libraries: {
      GovernorClockLogicV7: await GovernorClockLogicLibV7.getAddress(),
    },
  })
  const GovernorProposalLogicLibV7 = (await GovernorProposalLogicV7.deploy()) as GovernorProposalLogicV7
  await GovernorProposalLogicLibV7.waitForDeployment()
  logOutput && console.log("GovernorProposalLogicV7 Library deployed")

  const GovernorQuorumLogicV7 = await ethers.getContractFactory("GovernorQuorumLogicV7", {
    libraries: {
      GovernorClockLogicV7: await GovernorClockLogicLibV7.getAddress(),
    },
  })
  const GovernorQuorumLogicLibV7 = (await GovernorQuorumLogicV7.deploy()) as GovernorQuorumLogicV7
  await GovernorQuorumLogicLibV7.waitForDeployment()
  logOutput && console.log("GovernorQuorumLogicV7 Library deployed")

  const GovernorStateLogicV7 = await ethers.getContractFactory("GovernorStateLogicV7", {
    libraries: {
      GovernorClockLogicV7: await GovernorClockLogicLibV7.getAddress(),
    },
  })
  const GovernorStateLogicLibV7 = (await GovernorStateLogicV7.deploy()) as GovernorStateLogicV7
  await GovernorStateLogicLibV7.waitForDeployment()
  logOutput && console.log("GovernorStateLogicV7 Library deployed")

  const GovernorVotesLogicV7 = await ethers.getContractFactory("GovernorVotesLogicV7", {
    libraries: {
      GovernorClockLogicV7: await GovernorClockLogicLibV7.getAddress(),
      GovernorProposalLogicV7: await GovernorProposalLogicLibV7.getAddress(),
    },
  })
  const GovernorVotesLogicLibV7 = (await GovernorVotesLogicV7.deploy()) as GovernorVotesLogicV7
  await GovernorVotesLogicLibV7.waitForDeployment()
  logOutput && console.log("GovernorVotesLogicV7 Library deployed")

  const GovernorGovernanceLogicV7 = await ethers.getContractFactory("GovernorGovernanceLogicV7")
  const GovernorGovernanceLogicLibV7 = (await GovernorGovernanceLogicV7.deploy()) as GovernorGovernanceLogicV7
  await GovernorGovernanceLogicLibV7.waitForDeployment()
  logOutput && console.log("GovernorGovernanceLogicV7 Library deployed")

  // ------------------- V8 ------------------- //

  const GovernorClockLogicV8 = await ethers.getContractFactory("GovernorClockLogicV8")
  const GovernorClockLogicLibV8 = (await GovernorClockLogicV8.deploy()) as GovernorClockLogicV8
  await GovernorClockLogicLibV8.waitForDeployment()
  logOutput && console.log("GovernorClockLogicV8 Library deployed")

  const GovernorConfiguratorV8 = await ethers.getContractFactory("GovernorConfiguratorV8")
  const GovernorConfiguratorLibV8 = (await GovernorConfiguratorV8.deploy()) as GovernorConfiguratorV8
  await GovernorConfiguratorLibV8.waitForDeployment()
  logOutput && console.log("GovernorConfiguratorV8 Library deployed")

  const GovernorDepositLogicV8 = await ethers.getContractFactory("GovernorDepositLogicV8", {
    libraries: {
      GovernorClockLogicV8: await GovernorClockLogicLibV8.getAddress(),
    },
  })
  const GovernorDepositLogicLibV8 = (await GovernorDepositLogicV8.deploy()) as GovernorDepositLogicV8
  await GovernorDepositLogicLibV8.waitForDeployment()
  logOutput && console.log("GovernorDepositLogicV8 Library deployed")

  const GovernorFunctionRestrictionsLogicV8 = await ethers.getContractFactory("GovernorFunctionRestrictionsLogicV8")
  const GovernorFunctionRestrictionsLogicLibV8 =
    (await GovernorFunctionRestrictionsLogicV8.deploy()) as GovernorFunctionRestrictionsLogicV8
  await GovernorFunctionRestrictionsLogicLibV8.waitForDeployment()
  logOutput && console.log("GovernorFunctionRestrictionsLogicV8 Library deployed")

  const GovernorProposalLogicV8 = await ethers.getContractFactory("GovernorProposalLogicV8", {
    libraries: {
      GovernorClockLogicV8: await GovernorClockLogicLibV8.getAddress(),
    },
  })
  const GovernorProposalLogicLibV8 = (await GovernorProposalLogicV8.deploy()) as GovernorProposalLogicV8
  await GovernorProposalLogicLibV8.waitForDeployment()
  logOutput && console.log("GovernorProposalLogicV8 Library deployed")

  const GovernorQuorumLogicV8 = await ethers.getContractFactory("GovernorQuorumLogicV8", {
    libraries: {
      GovernorClockLogicV8: await GovernorClockLogicLibV8.getAddress(),
    },
  })
  const GovernorQuorumLogicLibV8 = (await GovernorQuorumLogicV8.deploy()) as GovernorQuorumLogicV8
  await GovernorQuorumLogicLibV8.waitForDeployment()
  logOutput && console.log("GovernorQuorumLogicV8 Library deployed")

  const GovernorStateLogicV8 = await ethers.getContractFactory("GovernorStateLogicV8", {
    libraries: {
      GovernorClockLogicV8: await GovernorClockLogicLibV8.getAddress(),
    },
  })
  const GovernorStateLogicLibV8 = (await GovernorStateLogicV8.deploy()) as GovernorStateLogicV8
  await GovernorStateLogicLibV8.waitForDeployment()
  logOutput && console.log("GovernorStateLogicV8 Library deployed")

  const GovernorVotesLogicV8 = await ethers.getContractFactory("GovernorVotesLogicV8", {
    libraries: {
      GovernorClockLogicV8: await GovernorClockLogicLibV8.getAddress(),
      GovernorProposalLogicV8: await GovernorProposalLogicLibV8.getAddress(),
    },
  })
  const GovernorVotesLogicLibV8 = (await GovernorVotesLogicV8.deploy()) as GovernorVotesLogicV8
  await GovernorVotesLogicLibV8.waitForDeployment()
  logOutput && console.log("GovernorVotesLogicV8 Library deployed")

  const GovernorGovernanceLogicV8 = await ethers.getContractFactory("GovernorGovernanceLogicV8")
  const GovernorGovernanceLogicLibV8 = (await GovernorGovernanceLogicV8.deploy()) as GovernorGovernanceLogicV8
  await GovernorGovernanceLogicLibV8.waitForDeployment()
  logOutput && console.log("GovernorGovernanceLogicV8 Library deployed")

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
    GovernorClockLogicLibV4,
    GovernorConfiguratorLibV4,
    GovernorFunctionRestrictionsLogicLibV4,
    GovernorGovernanceLogicLibV4,
    GovernorQuorumLogicLibV4,
    GovernorProposalLogicLibV4,
    GovernorVotesLogicLibV4,
    GovernorDepositLogicLibV4,
    GovernorStateLogicLibV4,
    GovernorClockLogicLibV5,
    GovernorConfiguratorLibV5,
    GovernorFunctionRestrictionsLogicLibV5,
    GovernorGovernanceLogicLibV5,
    GovernorQuorumLogicLibV5,
    GovernorProposalLogicLibV5,
    GovernorVotesLogicLibV5,
    GovernorDepositLogicLibV5,
    GovernorStateLogicLibV5,
    GovernorClockLogicLib,
    GovernorConfiguratorLib,
    GovernorFunctionRestrictionsLogicLib,
    GovernorGovernanceLogicLib,
    GovernorQuorumLogicLib,
    GovernorProposalLogicLib,
    GovernorVotesLogicLib,
    GovernorDepositLogicLib,
    GovernorStateLogicLib,
    GovernorClockLogicLibV6,
    GovernorConfiguratorLibV6,
    GovernorFunctionRestrictionsLogicLibV6,
    GovernorGovernanceLogicLibV6,
    GovernorQuorumLogicLibV6,
    GovernorProposalLogicLibV6,
    GovernorVotesLogicLibV6,
    GovernorDepositLogicLibV6,
    GovernorStateLogicLibV6,
    GovernorClockLogicLibV7,
    GovernorConfiguratorLibV7,
    GovernorDepositLogicLibV7,
    GovernorFunctionRestrictionsLogicLibV7,
    GovernorProposalLogicLibV7,
    GovernorQuorumLogicLibV7,
    GovernorStateLogicLibV7,
    GovernorVotesLogicLibV7,
    GovernorGovernanceLogicLibV7,
    GovernorClockLogicLibV8,
    GovernorConfiguratorLibV8,
    GovernorDepositLogicLibV8,
    GovernorFunctionRestrictionsLogicLibV8,
    GovernorProposalLogicLibV8,
    GovernorQuorumLogicLibV8,
    GovernorStateLogicLibV8,
    GovernorVotesLogicLibV8,
    GovernorGovernanceLogicLibV8,
  } as T["latestVersionOnly"] extends true ? GovernanceLatestLibraries : GovernanceLibraries
}
