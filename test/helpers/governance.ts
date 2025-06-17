import { ethers } from "hardhat"
import { getOrDeployContractInstances } from "./deploy"
import {
  bootstrapAndStartEmissions,
  getProposalIdFromTx,
  getVot3Tokens,
  waitForProposalToBeActive,
  waitForVotingPeriodToEnd,
} from "./common"
import { B3TRGovernor } from "../../typechain-types"

export const upgradeGovernanceToV2 = async (): Promise<B3TRGovernor> => {
  const { governor, xAllocationVoting, otherAccount, owner } = await getOrDeployContractInstances({})

  ////////////////////////////

  // ---------------------- Deploy Libraries V2 ----------------------
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

  // Start emissions
  await bootstrapAndStartEmissions()

  const B3TRGovernorV2 = await ethers.getContractFactory("B3TRGovernor", {
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
  })

  const newGovernor = await B3TRGovernorV2.deploy()
  await newGovernor.waitForDeployment()

  const V1Contract = await ethers.getContractAt("B3TRGovernor", await governor.getAddress())

  // Now we can create a proposal
  const encodedFunctionCall = V1Contract.interface.encodeFunctionData("upgradeToAndCall", [
    await newGovernor.getAddress(),
    "0x",
  ])

  const descriptionUpgrade = "Upgrading Governance contracts"
  const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(descriptionUpgrade))
  const currentRoundId = await xAllocationVoting.currentRoundId()

  const txGovernorUpgrade = await governor
    .connect(owner)
    .propose([await governor.getAddress()], [0], [encodedFunctionCall], descriptionUpgrade, currentRoundId + 1n, 0, {
      gasLimit: 10_000_000,
    })

  const proposalIdGovernor = await getProposalIdFromTx(txGovernorUpgrade)

  await getVot3Tokens(otherAccount, "10000")

  await waitForProposalToBeActive(proposalIdGovernor)

  await governor.connect(otherAccount).castVote(proposalIdGovernor, 1)
  await waitForVotingPeriodToEnd(proposalIdGovernor)

  await governor.queue([await governor.getAddress()], [0], [encodedFunctionCall], descriptionHash)

  await governor.execute([await governor.getAddress()], [0], [encodedFunctionCall], descriptionHash)

  // Check that the new implementation works
  const governorV2 = B3TRGovernorV2.attach(await governor.getAddress()) as B3TRGovernor

  return governorV2
}
