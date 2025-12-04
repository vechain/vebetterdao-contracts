import { getConfig } from "@repo/config"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { passportLibraries } from "../../libraries"
import { deployProxyOnly, initializeProxy } from "../../helpers"
import { VeBetterPassport } from "../../../typechain-types"
import { ethers } from "hardhat"

export async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const envConfig = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const deployer = (await ethers.getSigners())[0]

  console.log(
    `================  Deploying contracts on ${envConfig.network.name} (${envConfig.nodeUrl}) with ${envConfig.environment} configurations `,
  )
  console.log(`================  Address used to deploy: ${deployer.address}`)

  // We use a temporary admin to deploy and initialize contracts then transfer role to the real admin
  // Also we have many roles in our contracts but we currently use one wallet for all roles
  const TEMP_ADMIN = envConfig.network.name === "solo" ? contractsConfig.CONTRACTS_ADMIN_ADDRESS : deployer.address
  console.log("================================================================================")
  console.log("Temporary admin set to ", TEMP_ADMIN)
  console.log("Final admin will be set to ", contractsConfig.CONTRACTS_ADMIN_ADDRESS)
  console.log("================================================================================")

  console.log("Deploying VeBetter Passport Libraries")
  // Deploy Passport Libraries
  const {
    PassportChecksLogic,
    PassportConfigurator,
    PassportEntityLogic,
    PassportDelegationLogic,
    PassportPersonhoodLogic,
    PassportPoPScoreLogic,
    PassportSignalingLogic,
    PassportWhitelistAndBlacklistLogic,
  } = await passportLibraries({ logOutput: true, latestVersionOnly: false })

  const libraries: {
    VeBetterPassport: Record<string, string>
  } = {
    VeBetterPassport: {
      PassportChecksLogic: await PassportChecksLogic.getAddress(),
      PassportConfigurator: await PassportConfigurator.getAddress(),
      PassportEntityLogic: await PassportEntityLogic.getAddress(),
      PassportDelegationLogic: await PassportDelegationLogic.getAddress(),
      PassportPersonhoodLogic: await PassportPersonhoodLogic.getAddress(),
      PassportPoPScoreLogic: await PassportPoPScoreLogic.getAddress(),
      PassportSignalingLogic: await PassportSignalingLogic.getAddress(),
      PassportWhitelistAndBlacklistLogic: await PassportWhitelistAndBlacklistLogic.getAddress(),
    },
  }

  console.log(libraries)

  console.log("Deploying proxy for VeBetter Passport")
  // Initialization requires the address of the x2EarnRewardsPool, for this reason we will initialize it after
  const veBetterPassportContractAddress = await deployProxyOnly("VeBetterPassport", libraries.VeBetterPassport, true)

  const veBetterPassport = (await initializeProxy(
    veBetterPassportContractAddress,
    "VeBetterPassport",
    [
      {
        x2EarnApps: envConfig.x2EarnAppsContractAddress,
        xAllocationVoting: envConfig.xAllocationVotingContractAddress,
        galaxyMember: envConfig.galaxyMemberContractAddress,
        signalingThreshold: contractsConfig.VEPASSPORT_BOT_SIGNALING_THRESHOLD, //signalingThreshold
        roundsForCumulativeScore: contractsConfig.VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE, //roundsForCumulativeScore
        minimumGalaxyMemberLevel: contractsConfig.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL, //galaxyMemberMinimumLevel
        blacklistThreshold: contractsConfig.VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE, //blacklistThreshold
        whitelistThreshold: contractsConfig.VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE, //whitelistThreshold
        maxEntitiesPerPassport: contractsConfig.VEPASSPORT_PASSPORT_MAX_ENTITIES, //maxEntitiesPerPassport
        decayRate: contractsConfig.VEPASSPORT_DECAY_RATE, //decayRate
      },
      {
        admin: TEMP_ADMIN, // admins
        botSignaler: TEMP_ADMIN, // botSignaler
        upgrader: TEMP_ADMIN, // upgrader
        settingsManager: TEMP_ADMIN, // settingsManager
        roleGranter: TEMP_ADMIN, // roleGranter
        blacklister: TEMP_ADMIN, // blacklister
        whitelister: TEMP_ADMIN, // whitelistManager
        actionRegistrar: TEMP_ADMIN, // actionRegistrar
        actionScoreManager: TEMP_ADMIN, // actionScoreManager
        resetSignaler: TEMP_ADMIN, // resetSignaler
      },
    ],
    libraries.VeBetterPassport,
  )) as VeBetterPassport

  console.log(`================  Contract deployed `)
  console.log(`================  Configuring contract `)

  console.log("Checking that params are set correctly")
  const botSignalingThreshold = await veBetterPassport.signalingThreshold()
  console.log("Bot signaling threshold: ", botSignalingThreshold)
  const roundsForCumulativeScore = await veBetterPassport.roundsForCumulativeScore()
  console.log("Rounds for cumulative score: ", roundsForCumulativeScore)
  const decayRate = await veBetterPassport.decayRate()
  console.log("Decay rate: ", decayRate)
  const galaxyMemberMinimumLevel = await veBetterPassport.minimumGalaxyMemberLevel()
  console.log("Galaxy member minimum level: ", galaxyMemberMinimumLevel)
  const maxEntitiesPerPassport = await veBetterPassport.maxEntitiesPerPassport()
  console.log("Max entities per passport: ", maxEntitiesPerPassport)
  const blacklistThreshold = await veBetterPassport.blacklistThreshold()
  console.log("Blacklist threshold: ", blacklistThreshold)
  const whitelistThreshold = await veBetterPassport.whitelistThreshold()
  console.log("Whitelist threshold: ", whitelistThreshold)
  const popScoreThreshold = await veBetterPassport.thresholdPoPScore()
  console.log("Pop score threshold: ", popScoreThreshold)

  if (
    botSignalingThreshold !== BigInt(contractsConfig.VEPASSPORT_BOT_SIGNALING_THRESHOLD) ||
    roundsForCumulativeScore !== BigInt(contractsConfig.VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE) ||
    decayRate !== BigInt(contractsConfig.VEPASSPORT_DECAY_RATE) ||
    galaxyMemberMinimumLevel !== BigInt(contractsConfig.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL) ||
    maxEntitiesPerPassport !== BigInt(contractsConfig.VEPASSPORT_PASSPORT_MAX_ENTITIES) ||
    blacklistThreshold !== BigInt(contractsConfig.VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE) ||
    whitelistThreshold !== BigInt(contractsConfig.VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE) ||
    popScoreThreshold !== 0n
  ) {
    console.log("ERROR: Params are not set correctly")
  }

  console.log("Check that security level scores are set correctly")
  const none = await veBetterPassport.securityMultiplier(0)
  console.log("None: ", none)
  const low = await veBetterPassport.securityMultiplier(1)
  console.log("Low: ", low)
  const medium = await veBetterPassport.securityMultiplier(2)
  console.log("Medium: ", medium)
  const high = await veBetterPassport.securityMultiplier(3)
  console.log("High: ", high)
  if (none !== 0n || low !== 100n || medium !== 200n || high !== 400n) {
    console.log("ERROR: Security leve scores are not set correctly")
  }

  // seed apps levels
  const x2EarnAppsContract = await ethers.getContractAt("X2EarnApps", envConfig.x2EarnAppsContractAddress)
  const apps = await x2EarnAppsContract.apps()
  for (const app of apps) {
    console.log("Setting app level to LOW for ", app.name, app.id)
    await veBetterPassport.setAppSecurity(app.id, 1) // 1 = LOW

    // Check that the app security is set correctly
    const appSecurity = await veBetterPassport.appSecurity(app.id)
    if (appSecurity !== 1n) {
      console.log("ERROR: App security is not set correctly")
    }
  }

  // Check that all checks are disabled a part from participation score
  const enum checkTypes {
    UNDEFINED, // Default value for invalid or uninitialized checks
    WHITELIST_CHECK, // Check if the user is whitelisted
    BLACKLIST_CHECK, // Check if the user is blacklisted
    SIGNALING_CHECK, // Check if the user has been signaled too many times
    PARTICIPATION_SCORE_CHECK, // Check the user's participation score
    GM_OWNERSHIP_CHECK, // Check if the user owns a GM token
  }
  console.log("Enable Participation Score for VeBetterPassport")
  await veBetterPassport
    .connect(deployer)
    .toggleCheck(checkTypes.PARTICIPATION_SCORE_CHECK)
    .then(async tx => await tx.wait())

  const participationScoreCheckEnabled = await veBetterPassport.isCheckEnabled(checkTypes.PARTICIPATION_SCORE_CHECK)
  console.log("Participation score check enabled: ", participationScoreCheckEnabled)
  const whitelistCheckEnabled = await veBetterPassport.isCheckEnabled(checkTypes.WHITELIST_CHECK)
  console.log("Whitelist check enabled: ", whitelistCheckEnabled)
  const blacklistCheckEnabled = await veBetterPassport.isCheckEnabled(checkTypes.BLACKLIST_CHECK)
  console.log("Blacklist check enabled: ", blacklistCheckEnabled)
  const signalingCheckEnabled = await veBetterPassport.isCheckEnabled(checkTypes.SIGNALING_CHECK)
  console.log("Signaling check enabled: ", signalingCheckEnabled)
  const gmOwnershipCheckEnabled = await veBetterPassport.isCheckEnabled(checkTypes.GM_OWNERSHIP_CHECK)
  console.log("GM ownership check enabled: ", gmOwnershipCheckEnabled)
  if (!participationScoreCheckEnabled) {
    console.log("ERROR: participation score check is not enabled")
  }
  if (whitelistCheckEnabled || blacklistCheckEnabled || signalingCheckEnabled || gmOwnershipCheckEnabled) {
    console.log("ERROR: some checks are enabled")
  }

  console.log("================  Configuring roles")
  console.log(
    "INFO: roles will not be set automatically in this script, allowing the deployer to handle possible issues in the next days",
  )
  // UPGRADER_ROLE
  // ROLE_GRANTER
  // SETTINGS_MANAGER_ROLE
  // WHITELISTER_ROLE
  // ACTION_REGISTRAR_ROLE
  // ACTION_SCORE_MANAGER_ROLE
  // SIGNALER_ROLE
  // RESET_SIGNALER_ROLE

  console.log("================  Execution completed")
  process.exit(0)
}

// Execute the main function
main()
