import { ethers } from "hardhat"

import { B3TRGovernorV1, XAllocationVoting } from "../../typechain-types"
import { uploadBlobToIPFS } from "./ipfs"

export const proposeUpgradeGovernance = async (
  governor: B3TRGovernorV1,
  xAllocationVoting: XAllocationVoting,
): Promise<void> => {
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

  // Create a Blob from the proposal metadata
  const metadataBlob = new Blob(
    [
      JSON.stringify({
        title: "Upgrade Governor to V2",
        shortDescription: "Upgrade Governor to V2",
        markdownDescription: "",
      }),
    ],
    {
      type: "application/json",
    },
  )

  // Upload the metadata Blob to IPFS
  const metadataUri = await uploadBlobToIPFS(metadataBlob, "metadata.json")

  const currentRoundId = await xAllocationVoting.currentRoundId()

  await governor.propose(
    [await governor.getAddress()],
    [0],
    [encodedFunctionCall],
    metadataUri,
    currentRoundId + 1n,
    0,
    {
      gasLimit: 10_000_000,
    },
  )
}
