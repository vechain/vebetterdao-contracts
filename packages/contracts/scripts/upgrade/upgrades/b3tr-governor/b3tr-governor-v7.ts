import { getConfig } from "@repo/config"
import { saveLibrariesToFile, upgradeProxy } from "../../../helpers"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { B3TRGovernor } from "../../../../typechain-types"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log("Deploying new version of B3TRGovernor libraries")

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
      GovernorProposalLogic: await GovernorProposalLogicLib.getAddress(),
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

  const libraries: {
    B3TRGovernor: Record<string, string>
  } = {
    B3TRGovernor: {
      GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
      GovernorConfigurator: await GovernorConfiguratorLib.getAddress(),
      GovernorDepositLogic: await GovernorDepositLogicLib.getAddress(),
      GovernorFunctionRestrictionsLogic: await GovernorFunctionRestrictionsLogicLib.getAddress(),
      GovernorProposalLogic: await GovernorProposalLogicLib.getAddress(),
      GovernorQuorumLogic: await GovernorQuorumLogicLib.getAddress(),
      GovernorStateLogic: await GovernorStateLogicLib.getAddress(),
      GovernorVotesLogic: await GovernorVotesLogicLib.getAddress(),
    },
  }

  console.log("Libraries deployed")
  console.log("Libraries", libraries)

  console.log(
    `Upgrading B3TRGovernor contract at address: ${config.b3trGovernorAddress} on network: ${config.network.name}`,
  )

  const governor = (await upgradeProxy(
    "B3TRGovernorV6",
    "B3TRGovernor",
    config.b3trGovernorAddress,
    [
      {
        grantDepositThreshold: contractsConfig.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD, //Grant deposit threshold
        grantVotingThreshold: contractsConfig.B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD, //Grant voting threshold
        grantQuorum: contractsConfig.B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE, //Grant quorum percentage
        grantDepositThresholdCap: contractsConfig.B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP, //Grant deposit threshold cap
        standardDepositThresholdCap: contractsConfig.B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP, //Standard deposit threshold cap
        standardGMWeight: contractsConfig.B3TR_GOVERNOR_STANDARD_GM_WEIGHT, //Standard GM weight
        grantGMWeight: contractsConfig.B3TR_GOVERNOR_GRANT_GM_WEIGHT, //Grant GM weight
        galaxyMember: config.galaxyMemberContractAddress, //GalaxyMember contract
        grantsManager: config.grantsManagerContractAddress, // GrantsManager contract
      },
    ],
    {
      version: 7,
      libraries: {
        GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
        GovernorConfigurator: await GovernorConfiguratorLib.getAddress(),
        GovernorDepositLogic: await GovernorDepositLogicLib.getAddress(),
        GovernorFunctionRestrictionsLogic: await GovernorFunctionRestrictionsLogicLib.getAddress(),
        GovernorProposalLogic: await GovernorProposalLogicLib.getAddress(),
        GovernorQuorumLogic: await GovernorQuorumLogicLib.getAddress(),
        GovernorStateLogic: await GovernorStateLogicLib.getAddress(),
        GovernorVotesLogic: await GovernorVotesLogicLib.getAddress(),
      },
    },
  )) as B3TRGovernor

  console.log(`B3TRGovernor upgraded`)

  // check that upgrade was successful
  const version = await governor.version()
  console.log(`New B3TRGovernor version: ${version}`)

  if (parseInt(version) !== 7) {
    throw new Error(`B3TRGovernor version is not the expected one: ${version}`)
  }

  console.log("Execution completed")

  await saveLibrariesToFile(libraries)
  process.exit(0)
}

// Execute the main function
main()
