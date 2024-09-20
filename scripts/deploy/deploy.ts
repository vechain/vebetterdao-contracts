import { ethers, network } from "hardhat"
import {
  B3TR,
  Emissions,
  VOT3,
  XAllocationVoting,
  TimeLock,
  B3TRGovernor,
  GalaxyMember,
  VoterRewards,
  XAllocationPool,
  Treasury,
  X2EarnApps,
  X2EarnRewardsPool,
} from "../../typechain-types"
import { ContractsConfig } from "../../config/contracts/type"
import { HttpNetworkConfig } from "hardhat/types"
import { setupLocalEnvironment, setupTestEnvironment } from "./setup"
import { simulateRounds } from "./simulateRounds"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { deployAndUpgrade, deployProxy, deployLibraries } from "../helpers"
import { shouldRunSimulation } from "../../config/contracts"

// GalaxyMember NFT Values
const name = "VeBetterDAO Galaxy Member"
const symbol = "GM"

export async function deployAll(config: ContractsConfig) {
  const start = performance.now()
  const networkConfig = network.config as HttpNetworkConfig
  console.log(
    `================  Deploying contracts on ${network.name} (${networkConfig.url}) with ${config.NEXT_PUBLIC_APP_ENV} configurations ================`,
  )
  const [deployer] = await ethers.getSigners()

  // We use a temporary admin to deploy and initialize contracts then transfer role to the real admin
  // Also we have many roles in our contracts but we currently use one wallet for all roles
  const TEMP_ADMIN = network.name === "vechain_solo" ? config.CONTRACTS_ADMIN_ADDRESS : deployer.address
  console.log("Temporary admin set to ", TEMP_ADMIN)

  // ---------- Contracts Deployment ---------- //

  // ---------------------- Deploy Libraries ----------------------
  const {
    GovernorClockLogicLibV1,
    GovernorConfiguratorLibV1,
    GovernorDepositLogicLibV1,
    GovernorFunctionRestrictionsLogicLibV1,
    GovernorProposalLogicLibV1,
    GovernorQuorumLogicLibV1,
    GovernorVotesLogicLibV1,
    GovernorStateLogicLibV1,
    GovernorClockLogicLib,
    GovernorConfiguratorLib,
    GovernorDepositLogicLib,
    GovernorFunctionRestrictionsLogicLib,
    GovernorProposalLogicLib,
    GovernorQuorumLogicLib,
    GovernorVotesLogicLib,
    GovernorStateLogicLib,
  } = await deployLibraries()

  // ---------------------- Deploy Contracts ----------------------
  const b3tr = await deployB3trToken(
    TEMP_ADMIN,
    TEMP_ADMIN, // Minter
    config.CONTRACTS_ADMIN_ADDRESS, // Pauser
  )

  const vot3 = (await deployProxy("VOT3", [
    config.CONTRACTS_ADMIN_ADDRESS, // admin
    config.CONTRACTS_ADMIN_ADDRESS, // pauser
    config.CONTRACTS_ADMIN_ADDRESS, // upgrader
    await b3tr.getAddress(),
  ])) as VOT3
  console.log(`Vot3 deployed at ${await vot3.getAddress()}`)

  const timelock = (await deployProxy("TimeLock", [
    config.TIMELOCK_MIN_DELAY,
    [], // proposers
    [], // executors
    TEMP_ADMIN, // admin
    config.CONTRACTS_ADMIN_ADDRESS, // upgrader
  ])) as TimeLock
  console.log(`TimeLock deployed at ${await timelock.getAddress()}`)

  const treasury = (await deployProxy("Treasury", [
    await b3tr.getAddress(),
    await vot3.getAddress(),
    await timelock.getAddress(),
    TEMP_ADMIN, // admin
    config.CONTRACTS_ADMIN_ADDRESS, // upgrader
    config.CONTRACTS_ADMIN_ADDRESS, //pauser
    config.TREASURY_TRANSFER_LIMIT_VET,
    config.TREASURY_TRANSFER_LIMIT_B3TR,
    config.TREASURY_TRANSFER_LIMIT_VOT3,
    config.TREASURY_TRANSFER_LIMIT_VTHO,
  ])) as Treasury
  console.log(`Treasury deployed at ${await treasury.getAddress()}`)

  const x2EarnApps = (await deployProxy("X2EarnApps", [
    config.XAPP_BASE_URI,
    [TEMP_ADMIN], //admins
    config.CONTRACTS_ADMIN_ADDRESS, // upgrader
    TEMP_ADMIN, // governance role
  ])) as X2EarnApps
  console.log(`X2EarnApps deployed at ${await x2EarnApps.getAddress()}`)

  const x2EarnRewardsPool = (await deployAndUpgrade(
    ["X2EarnRewardsPoolV1", "X2EarnRewardsPool"],
    [
      [
        config.CONTRACTS_ADMIN_ADDRESS, // admin
        config.CONTRACTS_ADMIN_ADDRESS, // contracts address manager
        config.CONTRACTS_ADMIN_ADDRESS, // upgrader
        await b3tr.getAddress(),
        await x2EarnApps.getAddress(),
      ],
      [
        config.CONTRACTS_ADMIN_ADDRESS, // impact admin address
        config.X_2_EARN_INITIAL_IMPACT_KEYS, // impact keys
      ],
    ],
    {
      versions: [undefined, 2],
    },
  )) as X2EarnRewardsPool

  console.log(`X2EarnRewardsPool deployed at ${await x2EarnRewardsPool.getAddress()}`)

  const xAllocationPool = (await deployAndUpgrade(
    ["XAllocationPoolV1", "XAllocationPool"],
    [
      [
        TEMP_ADMIN, // admin
        config.CONTRACTS_ADMIN_ADDRESS, // upgrader
        TEMP_ADMIN, // contractsAddressManager
        await b3tr.getAddress(),
        await treasury.getAddress(),
        await x2EarnApps.getAddress(),
        await x2EarnRewardsPool.getAddress(),
      ],
      [],
    ],
    {
      versions: [undefined, 2],
    },
  )) as XAllocationPool

  console.log(`XAllocationPool deployed at ${await xAllocationPool.getAddress()}`)

  // Deploy the GalaxyMember contract with Max Mintable Level 1
  const galaxyMember = (await deployProxy("GalaxyMember", [
    {
      name: name,
      symbol: symbol,
      admin: TEMP_ADMIN,
      upgrader: config.CONTRACTS_ADMIN_ADDRESS,
      pauser: config.CONTRACTS_ADMIN_ADDRESS,
      minter: config.CONTRACTS_ADMIN_ADDRESS,
      contractsAddressManager: TEMP_ADMIN,
      maxLevel: 1,
      baseTokenURI: config.GM_NFT_BASE_URI,
      b3trToUpgradeToLevel: config.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL,
      b3tr: await b3tr.getAddress(),
      treasury: await treasury.getAddress(),
    },
  ])) as GalaxyMember
  console.log(`GalaxyMember deployed at ${await galaxyMember.getAddress()}`)

  const emissions = (await deployProxy("Emissions", [
    {
      minter: TEMP_ADMIN,
      admin: TEMP_ADMIN,
      upgrader: config.CONTRACTS_ADMIN_ADDRESS,
      contractsAddressManager: TEMP_ADMIN,
      decaySettingsManager: TEMP_ADMIN,
      b3trAddress: await b3tr.getAddress(),
      destinations: [
        await xAllocationPool.getAddress(),
        config.VOTE_2_EARN_POOL_ADDRESS,
        await treasury.getAddress(),
        config.MIGRATION_ADDRESS,
      ],
      initialXAppAllocation: config.INITIAL_X_ALLOCATION,
      cycleDuration: config.EMISSIONS_CYCLE_DURATION,
      decaySettings: [
        config.EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE,
        config.EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE,
        config.EMISSIONS_X_ALLOCATION_DECAY_PERIOD,
        config.EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD,
      ],
      treasuryPercentage: config.EMISSIONS_TREASURY_PERCENTAGE,
      maxVote2EarnDecay: config.EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE,
      migrationAmount: config.MIGRATION_AMOUNT,
    },
  ])) as Emissions
  console.log(`Emissions deployed at ${await emissions.getAddress()}`)

  const voterRewards = (await deployAndUpgrade(
    ["VoterRewardsV1", "VoterRewards"],
    [
      [
        TEMP_ADMIN, // admin
        config.CONTRACTS_ADMIN_ADDRESS, // upgrader
        config.CONTRACTS_ADMIN_ADDRESS, // contractsAddressManager
        await emissions.getAddress(),
        await galaxyMember.getAddress(),
        await b3tr.getAddress(),
        config.VOTER_REWARDS_LEVELS,
        config.VOTER_REWARDS_MULTIPLIER,
      ],
      [],
    ],
    {
      versions: [undefined, 2],
    },
  )) as VoterRewards

  const xAllocationVoting = (await deployProxy("XAllocationVoting", [
    {
      vot3Token: await vot3.getAddress(),
      quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE,
      initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1,
      timeLock: await timelock.getAddress(),
      voterRewards: await voterRewards.getAddress(),
      emissions: await emissions.getAddress(),
      admins: [await timelock.getAddress(), TEMP_ADMIN],
      upgrader: config.CONTRACTS_ADMIN_ADDRESS,
      contractsAddressManager: TEMP_ADMIN,
      x2EarnAppsAddress: await x2EarnApps.getAddress(),
      baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
      appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
      votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
    },
  ])) as XAllocationVoting
  console.log(`XAllocationVoting deployed at ${await xAllocationVoting.getAddress()}`)

  const governor = (await deployAndUpgrade(
    ["B3TRGovernorV1", "B3TRGovernorV2", "B3TRGovernor"],
    [
      [
        {
          vot3Token: await vot3.getAddress(),
          timelock: await timelock.getAddress(),
          xAllocationVoting: await xAllocationVoting.getAddress(),
          b3tr: await b3tr.getAddress(),
          quorumPercentage: config.B3TR_GOVERNOR_QUORUM_PERCENTAGE,
          initialDepositThreshold: config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD,
          initialMinVotingDelay: config.B3TR_GOVERNOR_MIN_VOTING_DELAY,
          initialVotingThreshold: config.B3TR_GOVERNOR_VOTING_THRESHOLD,
          voterRewards: await voterRewards.getAddress(),
          isFunctionRestrictionEnabled: true,
        },
        {
          governorAdmin: TEMP_ADMIN,
          pauser: config.CONTRACTS_ADMIN_ADDRESS,
          contractsAddressManager: config.CONTRACTS_ADMIN_ADDRESS,
          proposalExecutor: config.CONTRACTS_ADMIN_ADDRESS,
          governorFunctionSettingsRoleAddress: TEMP_ADMIN,
        },
      ],
      [],
      [],
    ],
    {
      versions: [undefined, 2, 3],
      libraries: [
        {
          GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
          GovernorConfiguratorV1: await GovernorConfiguratorLibV1.getAddress(),
          GovernorDepositLogicV1: await GovernorDepositLogicLibV1.getAddress(),
          GovernorFunctionRestrictionsLogicV1: await GovernorFunctionRestrictionsLogicLibV1.getAddress(),
          GovernorProposalLogicV1: await GovernorProposalLogicLibV1.getAddress(),
          GovernorQuorumLogicV1: await GovernorQuorumLogicLibV1.getAddress(),
          GovernorStateLogicV1: await GovernorStateLogicLibV1.getAddress(),
          GovernorVotesLogicV1: await GovernorVotesLogicLibV1.getAddress(),
        },
        {
          GovernorClockLogicV1: await GovernorClockLogicLibV1.getAddress(),
          GovernorConfiguratorV1: await GovernorConfiguratorLibV1.getAddress(),
          GovernorDepositLogicV1: await GovernorDepositLogicLibV1.getAddress(),
          GovernorFunctionRestrictionsLogicV1: await GovernorFunctionRestrictionsLogicLibV1.getAddress(),
          GovernorProposalLogicV1: await GovernorProposalLogicLibV1.getAddress(),
          GovernorQuorumLogicV1: await GovernorQuorumLogicLibV1.getAddress(),
          GovernorStateLogicV1: await GovernorStateLogicLibV1.getAddress(),
          GovernorVotesLogicV1: await GovernorVotesLogicLibV1.getAddress(),
        },
        {
          GovernorClockLogic: await GovernorClockLogicLib.getAddress(),
          GovernorConfigurator: await GovernorConfiguratorLib.getAddress(),
          GovernorDepositLogic: await GovernorDepositLogicLib.getAddress(),
          GovernorFunctionRestrictionsLogic: await GovernorFunctionRestrictionsLogicLib.getAddress(),
          GovernorProposalLogic: await GovernorProposalLogicLib.getAddress(),
          GovernorQuorumLogic: await GovernorQuorumLogicLib.getAddress(),
          GovernorStateLogic: await GovernorStateLogicLib.getAddress(),
          GovernorVotesLogic: await GovernorVotesLogicLib.getAddress(),
        },
      ],
    },
  )) as B3TRGovernor

  console.log(`Governor deployed at ${await governor.getAddress()}`)

  const date = new Date(performance.now() - start)
  console.log(`Contracts deployed in ${date.getMinutes()}m ${date.getSeconds()}s`)

  const contractAddresses: Record<string, string> = {
    B3TR: await b3tr.getAddress(),
    B3TRGovernor: await governor.getAddress(),
    Emissions: await emissions.getAddress(),
    GalaxyMember: await galaxyMember.getAddress(),
    TimeLock: await timelock.getAddress(),
    Treasury: await treasury.getAddress(),
    VOT3: await vot3.getAddress(),
    VoterRewards: await voterRewards.getAddress(),
    X2EarnApps: await x2EarnApps.getAddress(),
    X2EarnRewardsPool: await x2EarnRewardsPool.getAddress(),
    XAllocationPool: await xAllocationPool.getAddress(),
    XAllocationVoting: await xAllocationVoting.getAddress(),
  }

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

  await setWhitelistedFunctions(contractAddresses, config, governor, deployer, libraries) // Set whitelisted functions for governor proposals

  // ---------- Configure contract roles for setup ---------- //

  console.log("================ Configuring contract roles for setup")

  // TODO: Uncomment this line to pause public minting of GM NFTs when deploying to Mainnet
  // await galaxyMember.connect(admin).setIsPublicMintingPaused(true)
  // console.log("Public minting of GM NFTs paused")

  // Grant MINTER_ROLE on B3TR to emissions contract so it can bootstrap and distribute
  await b3tr
    .connect(deployer)
    .grantRole(await b3tr.MINTER_ROLE(), await emissions.getAddress())
    .then(async tx => await tx.wait())
  console.log("Minter role granted to emissions contract")

  // Set proposer, canceller and executor role to timelock
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE()
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE()
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE()
  await timelock.connect(deployer).grantRole(PROPOSER_ROLE, await governor.getAddress())
  await timelock.connect(deployer).grantRole(EXECUTOR_ROLE, await governor.getAddress())
  await timelock.connect(deployer).grantRole(CANCELLER_ROLE, await governor.getAddress())
  console.log("Proposer, executor and canceller role granted to governor")

  // Grant treasury GOVERNANCE_ROLE to treasury contract admin for intial phases of project
  const GOVERNANCE_ROLE = await treasury.GOVERNANCE_ROLE()
  await treasury.connect(deployer).grantRole(GOVERNANCE_ROLE, TEMP_ADMIN)
  console.log("Governance role granted to treasury contract admin")

  // Grant Vote Registrar role to XAllocationVoting
  await voterRewards
    .connect(deployer)
    .grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await xAllocationVoting.getAddress())
    .then(async tx => await tx.wait())
  console.log("Vote registrar role granted to XAllocationVoting")
  // Grant Vote Registrar role to B3TRGovernor
  await voterRewards
    .connect(deployer)
    .grantRole(await voterRewards.VOTE_REGISTRAR_ROLE(), await governor.getAddress())
    .then(async tx => await tx.wait())
  console.log("Vote registrar role granted to B3TRGovernor")

  // Emissions contract should be able to start new rounds
  await xAllocationVoting
    .connect(deployer)
    .grantRole(await xAllocationVoting.ROUND_STARTER_ROLE(), await emissions.getAddress())
    .then(async tx => await tx.wait())
  console.log("Admin role granted to emissions contract")

  // Set X allocations governor
  await emissions
    .connect(deployer)
    .setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
    .then(async tx => await tx.wait())
  // Set voter rewards address in emissions
  await emissions
    .connect(deployer)
    .setVote2EarnAddress(await voterRewards.getAddress())
    .then(async tx => await tx.wait())
  console.log("XAllocationsGovernor and Vote2Earn address set in Emissions contract")

  // Setup XAllocationPool addresses
  await xAllocationPool
    .connect(deployer)
    .setXAllocationVotingAddress(await xAllocationVoting.getAddress())
    .then(async tx => await tx.wait())
  await xAllocationPool
    .connect(deployer)
    .setEmissionsAddress(await emissions.getAddress())
    .then(async tx => await tx.wait())
  console.log("XAllocationVoting and Emissions address set in XAllocationPool contract")

  // Set xAllocationVoting and B3TRGovernor address in GalaxyMember
  await galaxyMember
    .connect(deployer)
    .setXAllocationsGovernorAddress(await xAllocationVoting.getAddress())
    .then(async tx => await tx.wait())
  await galaxyMember
    .connect(deployer)
    .setB3trGovernorAddress(await governor.getAddress())
    .then(async tx => await tx.wait())
  console.log("XAllocationsGovernor and B3trGovernor address set in GalaxyMember contract")

  //Set the emissions address as the ROUND_STARTER_ROLE in XAllocationVoting
  const roundStarterRole = await xAllocationVoting.ROUND_STARTER_ROLE()
  await xAllocationVoting
    .connect(deployer)
    .grantRole(roundStarterRole, await emissions.getAddress())
    .then(async tx => await tx.wait())
  console.log("Round starter role granted to emissions contract")

  // ---------- Setup Contracts ---------- //
  // Notice: admin account allowed to perform actions is retrieved again inside the setup functions
  if (network.name === "vechain_testnet") {
    await setupTestEnvironment(emissions, x2EarnApps)
  } else if (network.name === "vechain_solo") {
    await setupLocalEnvironment(emissions, treasury, x2EarnApps)
  }

  // ---------- Run Simulation ---------- //
  if (shouldRunSimulation()) {
    await simulateRounds(b3tr, vot3, xAllocationVoting, emissions, voterRewards, treasury)
  }

  // ---------- Role updates ---------- //
  // Do not update roles on solo network since we are already using the predifined address and it would just increase dev time
  if (network.name === "vechain_testnet") {
    console.log("================ Updating contract roles after setup ================ ")
    console.log("New admin address", config.CONTRACTS_ADMIN_ADDRESS)

    // we will need to have  an admin that triggers the minting function to execute the mainnet migration
    await b3tr
      .connect(deployer)
      .grantRole(await b3tr.MINTER_ROLE(), config.CONTRACTS_ADMIN_ADDRESS)
      .then(async tx => await tx.wait())
    console.log("Minter role granted to new admin on ", await b3tr.getAddress())
    await transferMinterRole(b3tr, deployer, TEMP_ADMIN, await emissions.getAddress())
    await transferAdminRole(b3tr, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferContractsAddressManagerRole(galaxyMember, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(galaxyMember, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferMinterRole(emissions, deployer, deployer.address, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(emissions, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferAdminRole(voterRewards, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferContractsAddressManagerRole(xAllocationPool, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(xAllocationPool, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await xAllocationVoting
      .connect(deployer)
      .grantRole(await xAllocationVoting.GOVERNANCE_ROLE(), config.CONTRACTS_ADMIN_ADDRESS)
      .then(async tx => await tx.wait())
    console.log("Governance role granted to admin in ", await xAllocationVoting.getAddress())
    await transferContractsAddressManagerRole(xAllocationVoting, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(xAllocationVoting, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferGovernanceRole(treasury, deployer, deployer.address, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(treasury, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferGovernorFunctionSettingsRole(governor, deployer, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(governor, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferGovernanceRole(x2EarnApps, deployer, deployer.address, config.CONTRACTS_ADMIN_ADDRESS)
    await transferAdminRole(x2EarnApps, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    await transferAdminRole(timelock, deployer, config.CONTRACTS_ADMIN_ADDRESS)

    console.log("Roles updated successfully!")

    console.log("================ Validating roles ================ ")
    // B3TR
    await validateContractRole(b3tr, await emissions.getAddress(), TEMP_ADMIN, await b3tr.MINTER_ROLE())
    await validateContractRole(b3tr, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await b3tr.MINTER_ROLE())
    await validateContractRole(b3tr, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await b3tr.DEFAULT_ADMIN_ROLE())
    await validateContractRole(b3tr, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await b3tr.PAUSER_ROLE())

    // VOT3
    await validateContractRole(vot3, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await vot3.DEFAULT_ADMIN_ROLE())
    await validateContractRole(vot3, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await vot3.UPGRADER_ROLE())
    await validateContractRole(vot3, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await vot3.PAUSER_ROLE())

    // Timelock
    await validateContractRole(timelock, await governor.getAddress(), TEMP_ADMIN, await timelock.PROPOSER_ROLE())
    await validateContractRole(timelock, await governor.getAddress(), TEMP_ADMIN, await timelock.EXECUTOR_ROLE())
    await validateContractRole(timelock, await governor.getAddress(), TEMP_ADMIN, await timelock.CANCELLER_ROLE())
    await validateContractRole(
      timelock,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await timelock.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(timelock, await timelock.getAddress(), TEMP_ADMIN, await timelock.DEFAULT_ADMIN_ROLE())
    await validateContractRole(timelock, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await timelock.UPGRADER_ROLE())

    // B3TRGovernor
    await validateContractRole(
      governor,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await governor.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      governor,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await governor.GOVERNOR_FUNCTIONS_SETTINGS_ROLE(),
    )
    await validateContractRole(governor, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await governor.PAUSER_ROLE())
    await validateContractRole(
      governor,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await governor.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )
    await validateContractRole(
      governor,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await governor.PROPOSAL_EXECUTOR_ROLE(),
    )

    // Emissions
    await validateContractRole(emissions, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await emissions.MINTER_ROLE())
    await validateContractRole(
      emissions,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await emissions.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(emissions, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await emissions.UPGRADER_ROLE())

    // VoterRewards
    await validateContractRole(
      voterRewards,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await voterRewards.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      voterRewards,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await voterRewards.UPGRADER_ROLE(),
    )
    await validateContractRole(
      voterRewards,
      await xAllocationVoting.getAddress(),
      TEMP_ADMIN,
      await voterRewards.VOTE_REGISTRAR_ROLE(),
    )
    await validateContractRole(
      voterRewards,
      await governor.getAddress(),
      TEMP_ADMIN,
      await voterRewards.VOTE_REGISTRAR_ROLE(),
    )
    await validateContractRole(
      voterRewards,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await voterRewards.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )

    // XAllocationPool
    await validateContractRole(
      xAllocationPool,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationPool.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      xAllocationPool,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationPool.UPGRADER_ROLE(),
    )
    await validateContractRole(
      xAllocationPool,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationPool.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )

    // XAllocationVoting
    await validateContractRole(
      xAllocationVoting,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationVoting.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      xAllocationVoting,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationVoting.UPGRADER_ROLE(),
    )
    await validateContractRole(
      xAllocationVoting,
      await emissions.getAddress(),
      TEMP_ADMIN,
      await xAllocationVoting.ROUND_STARTER_ROLE(),
    )
    await validateContractRole(
      xAllocationVoting,
      await timelock.getAddress(),
      TEMP_ADMIN,
      await xAllocationVoting.GOVERNANCE_ROLE(),
    )
    await validateContractRole(
      xAllocationVoting,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationVoting.GOVERNANCE_ROLE(),
    )
    await validateContractRole(
      xAllocationVoting,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await xAllocationVoting.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )

    // Treasury
    await validateContractRole(treasury, await timelock.getAddress(), TEMP_ADMIN, await treasury.GOVERNANCE_ROLE())
    await validateContractRole(
      treasury,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await treasury.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(treasury, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await treasury.UPGRADER_ROLE())
    await validateContractRole(treasury, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await treasury.PAUSER_ROLE())

    // X2EarnApps
    await validateContractRole(
      x2EarnApps,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await x2EarnApps.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(x2EarnApps, config.CONTRACTS_ADMIN_ADDRESS, TEMP_ADMIN, await x2EarnApps.UPGRADER_ROLE())
    await validateContractRole(
      x2EarnApps,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await x2EarnApps.GOVERNANCE_ROLE(),
    )

    // GalaxyMember
    await validateContractRole(
      galaxyMember,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await galaxyMember.DEFAULT_ADMIN_ROLE(),
    )
    await validateContractRole(
      galaxyMember,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await galaxyMember.UPGRADER_ROLE(),
    )
    await validateContractRole(
      galaxyMember,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await galaxyMember.CONTRACTS_ADDRESS_MANAGER_ROLE(),
    )
    await validateContractRole(
      galaxyMember,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await galaxyMember.PAUSER_ROLE(),
    )
    await validateContractRole(
      galaxyMember,
      config.CONTRACTS_ADMIN_ADDRESS,
      TEMP_ADMIN,
      await galaxyMember.MINTER_ROLE(),
    )

    console.log("Roles validated successfully!")
  }

  console.log("contracts", {
    b3trContractAddress: await b3tr.getAddress(),
    vot3ContractAddress: await vot3.getAddress(),
    b3trGovernorAddress: await governor.getAddress(),
    timelockContractAddress: await timelock.getAddress(),
    xAllocationPoolContractAddress: await xAllocationPool.getAddress(),
    xAllocationVotingContractAddress: await xAllocationVoting.getAddress(),
    emissionsContractAddress: await emissions.getAddress(),
    voterRewardsContractAddress: await voterRewards.getAddress(),
    galaxyMemberContractAddress: await galaxyMember.getAddress(),
    treasuryContractAddress: await treasury.getAddress(),
    x2EarnAppsContractAddress: await x2EarnApps.getAddress(),
  })

  const end = new Date(performance.now() - start)
  console.log(`Total execution time: ${end.getMinutes()}m ${end.getSeconds()}s`)

  return {
    governor: governor,
    timelock: timelock,
    b3tr: b3tr,
    vot3: vot3,
    galaxyMember: galaxyMember,
    xAllocationPool: xAllocationPool,
    xAllocationVoting: xAllocationVoting,
    emissions: emissions,
    voterRewards: voterRewards,
    treasury: treasury,
    x2EarnApps: x2EarnApps,
    x2EarnRewardsPool: x2EarnRewardsPool,
  }
  // close the script
}

const transferAdminRole = async (
  contract:
    | B3TR
    | VOT3
    | GalaxyMember
    | Emissions
    | VoterRewards
    | XAllocationPool
    | XAllocationVoting
    | Treasury
    | B3TRGovernor
    | X2EarnApps
    | TimeLock,
  oldAdmin: HardhatEthersSigner,
  newAdminAddress: string,
) => {
  if (oldAdmin.address === newAdminAddress)
    throw new Error("Admin role not transferred. New admin is the same as old admin")

  const adminRole = await contract.DEFAULT_ADMIN_ROLE()
  await contract
    .connect(oldAdmin)
    .grantRole(adminRole, newAdminAddress)
    .then(async tx => await tx.wait())
  await contract
    .connect(oldAdmin)
    .renounceRole(adminRole, oldAdmin.address)
    .then(async tx => await tx.wait())

  const newAdminSet = await contract.hasRole(adminRole, newAdminAddress)
  const oldAdminRemoved = !(await contract.hasRole(adminRole, oldAdmin.address))
  if (!newAdminSet || !oldAdminRemoved)
    throw new Error("Admin role not set correctly on " + (await contract.getAddress()))

  console.log("Admin role transferred successfully on " + (await contract.getAddress()))
}

const transferMinterRole = async (
  contract: Emissions | B3TR,
  admin: HardhatEthersSigner,
  oldMinterAddress: string,
  newMinterAddress?: string,
) => {
  if (!newMinterAddress && oldMinterAddress === newMinterAddress)
    throw new Error("Minter role not transferred. New minter is the same as old minter")

  const minterRole = await contract.MINTER_ROLE()

  // If newMinterAddress is provided, set a new minter before revoking the old one
  // otherwise just revoke the old one
  if (newMinterAddress) {
    await contract
      .connect(admin)
      .grantRole(minterRole, newMinterAddress)
      .then(async tx => await tx.wait())
    await contract
      .connect(admin)
      .revokeRole(minterRole, oldMinterAddress)
      .then(async tx => await tx.wait())

    const newMinterSet = await contract.hasRole(minterRole, newMinterAddress)
    const oldMinterRemoved = !(await contract.hasRole(minterRole, oldMinterAddress))
    if (!newMinterSet || !oldMinterRemoved)
      throw new Error("Minter role not set correctly on " + (await contract.getAddress()))

    console.log("Minter role transferred successfully on " + (await contract.getAddress()))
  } else {
    await contract
      .connect(admin)
      .revokeRole(minterRole, oldMinterAddress)
      .then(async tx => await tx.wait())

    const oldMinterRemoved = !(await contract.hasRole(minterRole, oldMinterAddress))
    if (!oldMinterRemoved) throw new Error("Minter role not removed correctly on " + (await contract.getAddress()))

    console.log("Minter role revoked (without granting new) successfully on " + (await contract.getAddress()))
  }
}

// Transfer governance role to treasury contract admin for intial phases of project
const transferGovernanceRole = async (
  contract: Treasury | X2EarnApps,
  admin: HardhatEthersSigner,
  oldAddress: string,
  newAddress?: string,
) => {
  if (!newAddress && oldAddress === newAddress)
    throw new Error("Governance role not transferred. New governance is the same as old governance")

  const governanceRole = await contract.GOVERNANCE_ROLE()

  // If newAddress is provided, set a new admin before revoking the old one
  // otherwise just revoke the old one
  if (newAddress) {
    await contract
      .connect(admin)
      .grantRole(governanceRole, newAddress)
      .then(async tx => await tx.wait())
    await contract
      .connect(admin)
      .revokeRole(governanceRole, oldAddress)
      .then(async tx => await tx.wait())

    const newGovernanceSet = await contract.hasRole(governanceRole, newAddress)
    const oldGovernanceRemoved = !(await contract.hasRole(governanceRole, oldAddress))
    if (!newGovernanceSet || !oldGovernanceRemoved)
      throw new Error("Minter role not set correctly on " + (await contract.getAddress()))

    console.log("Governance role transferred successfully on " + (await contract.getAddress()))
  } else {
    await contract
      .connect(admin)
      .revokeRole(governanceRole, oldAddress)
      .then(async tx => await tx.wait())

    const oldGovernanceRemoved = !(await contract.hasRole(governanceRole, oldAddress))
    if (!oldGovernanceRemoved)
      throw new Error("Governance role not removed correctly on " + (await contract.getAddress()))

    console.log("Governance role revoked (without granting new) successfully on " + (await contract.getAddress()))
  }
}

const transferContractsAddressManagerRole = async (
  contract: GalaxyMember | XAllocationPool | XAllocationVoting | Emissions,
  admin: HardhatEthersSigner,
  newAddress: string,
) => {
  if (admin.address === newAddress) throw new Error("Role not transferred. New address is the same as old address")

  const contractsAddressManagerRole = await contract.CONTRACTS_ADDRESS_MANAGER_ROLE()

  await contract
    .connect(admin)
    .grantRole(contractsAddressManagerRole, newAddress)
    .then(async tx => await tx.wait())
  await contract
    .connect(admin)
    .renounceRole(contractsAddressManagerRole, admin.address)
    .then(async tx => await tx.wait())

  const newRoleSet = await contract.hasRole(contractsAddressManagerRole, newAddress)
  const oldRoleRemoved = !(await contract.hasRole(contractsAddressManagerRole, admin.address))

  if (!newRoleSet || !oldRoleRemoved) throw new Error("Role not set correctly on " + (await contract.getAddress()))

  console.log("Contract Address Manager Role transferred successfully on " + (await contract.getAddress()))
}

const transferGovernorFunctionSettingsRole = async (
  contract: B3TRGovernor,
  admin: HardhatEthersSigner,
  newAddress: string,
) => {
  const governorFunctionSettingsRole = await contract.GOVERNOR_FUNCTIONS_SETTINGS_ROLE()

  await contract
    .connect(admin)
    .grantRole(governorFunctionSettingsRole, newAddress)
    .then(async tx => await tx.wait())
  await contract
    .connect(admin)
    .renounceRole(governorFunctionSettingsRole, admin.address)
    .then(async tx => await tx.wait())

  const newRoleSet = await contract.hasRole(governorFunctionSettingsRole, newAddress)
  const oldRoleRemoved = !(await contract.hasRole(governorFunctionSettingsRole, admin.address))

  if (!newRoleSet || !oldRoleRemoved) throw new Error("Role not set correctly on " + (await contract.getAddress()))

  console.log("Governor Function Settings Role transferred successfully on " + (await contract.getAddress()))
}

async function deployB3trToken(admin: string, minter: string, pauser: string): Promise<B3TR> {
  const B3trContract = await ethers.getContractFactory("B3TR") // Use the global variable
  const contract = await B3trContract.deploy(admin, minter, pauser)

  await contract.waitForDeployment()

  console.log(`B3tr deployed at ${await contract.getAddress()}`)

  return contract
}

/**
 * Set the whitelisted functions from config
 * Performs the following steps for each contract:
 *    1. Get the function signatures from the contract factory
 *    2. Set the whitelisted functions in the governor contract
 *
 * @param contractAddresses - Addresses of the deployed contracts
 * @param config - Contracts configuration
 * @param governor - B3TRGovernor contract instance
 * @param admin - Admin signer
 *
 * @note - For ambiguous functions (functions with same name), the function signature is used to differentiate them
 * e.g., instead of using "setVoterRewards", we use "setVoterRewards(address)" in the config
 */
export const setWhitelistedFunctions = async (
  contractAddresses: Record<string, string>,
  config: ContractsConfig,
  governor: B3TRGovernor,
  admin: HardhatEthersSigner,
  libraries: Record<string, Record<string, string>>,
) => {
  const { B3TR_GOVERNOR_WHITELISTED_METHODS } = config

  for (const [contract, functions] of Object.entries(B3TR_GOVERNOR_WHITELISTED_METHODS)) {
    // Check if the current contract requires linking with any libraries
    const contractLibraries = libraries[contract]

    // Getting the contract factory with or without libraries as needed
    const contractFactory = contractLibraries
      ? await ethers.getContractFactory(contract, { libraries: contractLibraries })
      : await ethers.getContractFactory(contract)

    const whitelistFunctionSelectors = []

    for (const func of functions) {
      const sig = contractFactory.interface.getFunction(func)?.selector

      if (sig) whitelistFunctionSelectors.push(sig)
    }

    if (whitelistFunctionSelectors.length !== 0) {
      await governor
        .connect(admin)
        .setWhitelistFunctions(contractAddresses[contract], whitelistFunctionSelectors, true)
        .then(async tx => await tx.wait())
    }
  }
}

// Function that checks that roles are set correctly on the contracts
const validateContractRole = async (
  contract:
    | B3TR
    | VOT3
    | GalaxyMember
    | Emissions
    | VoterRewards
    | XAllocationPool
    | XAllocationVoting
    | Treasury
    | TimeLock
    | B3TRGovernor
    | X2EarnRewardsPool
    | X2EarnApps,
  expectedAddress: string,
  tempAdmin: string,
  role: string,
) => {
  const roleSet = await contract.hasRole(role, expectedAddress)
  // Check that the temporary admin does not have the role
  const roleRemoved = !(await contract.hasRole(role, tempAdmin))

  if (!roleSet || !roleRemoved)
    throw new Error("Role " + role + " not set correctly on " + (await contract.getAddress()))
}
