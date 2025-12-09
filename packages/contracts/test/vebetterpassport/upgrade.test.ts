import { deployProxyOnly, initializeProxy, upgradeProxy } from "../../scripts/helpers/upgrades"
import { getOrDeployContractInstances } from "../helpers/deploy"
import { expect } from "chai"
import { describe, it } from "mocha"
import { VeBetterPassportV1, VeBetterPassportV2, VeBetterPassportV3, VeBetterPassport } from "../../typechain-types"
import { createTestConfig } from "../helpers/config"

describe("VeBetterPassport Upgrade - @shard8a", function () {
  it("Should upgrade from V1 -> V2 -> V3 -> V4 (latest) and preserve storage", async function () {
    const config = createTestConfig()
    const {
      owner,
      galaxyMember,
      x2EarnApps,
      passportChecksLogicV1,
      passportConfiguratorV1,
      passportDelegationLogicV1,
      passportPersonhoodLogicV1,
      passportPoPScoreLogicV1,
      passportSignalingLogicV1,
      passportEntityLogicV1,
      passportWhitelistAndBlacklistLogicV1,
      passportChecksLogicV2,
      passportConfiguratorV2,
      passportDelegationLogicV2,
      passportPersonhoodLogicV2,
      passportPoPScoreLogicV2,
      passportSignalingLogicV2,
      passportEntityLogicV2,
      passportWhitelistAndBlacklistLogicV2,
      passportChecksLogicV3,
      passportConfiguratorV3,
      passportDelegationLogicV3,
      passportPersonhoodLogicV3,
      passportPoPScoreLogicV3,
      passportSignalingLogicV3,
      passportWhitelistAndBlacklistLogicV3,
      passportEntityLogicV3,
      passportChecksLogic,
      passportConfigurator,
      passportDelegationLogic,
      passportPersonhoodLogic,
      passportPoPScoreLogic,
      passportSignalingLogic,
      passportWhitelistAndBlacklistLogic,
      passportEntityLogic,
      xAllocationVoting: deployedXAllocationVoting, // Use deployed instance if available
    } = await getOrDeployContractInstances({
      forceDeploy: true,
      config,
    })

    // Use deployed xAllocationVoting or deploy a mock if needed for initialization
    const xAllocationVotingAddress = deployedXAllocationVoting
      ? await deployedXAllocationVoting.getAddress()
      : owner.address

    // Deploy V1 Proxy
    const veBetterPassportContractAddress = await deployProxyOnly("VeBetterPassportV1", {
      PassportChecksLogicV1: await passportChecksLogicV1.getAddress(),
      PassportConfiguratorV1: await passportConfiguratorV1.getAddress(),
      PassportEntityLogicV1: await passportEntityLogicV1.getAddress(),
      PassportDelegationLogicV1: await passportDelegationLogicV1.getAddress(),
      PassportPersonhoodLogicV1: await passportPersonhoodLogicV1.getAddress(),
      PassportPoPScoreLogicV1: await passportPoPScoreLogicV1.getAddress(),
      PassportSignalingLogicV1: await passportSignalingLogicV1.getAddress(),
      PassportWhitelistAndBlacklistLogicV1: await passportWhitelistAndBlacklistLogicV1.getAddress(),
    })

    // Initialize V1
    const veBetterPassportV1 = (await initializeProxy(
      veBetterPassportContractAddress,
      "VeBetterPassportV1",
      [
        {
          x2EarnApps: await x2EarnApps.getAddress(),
          xAllocationVoting: xAllocationVotingAddress,
          galaxyMember: await galaxyMember.getAddress(),
          signalingThreshold: config.VEPASSPORT_BOT_SIGNALING_THRESHOLD,
          roundsForCumulativeScore: config.VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE,
          minimumGalaxyMemberLevel: config.VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL,
          blacklistThreshold: config.VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE,
          whitelistThreshold: config.VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE,
          maxEntitiesPerPassport: config.VEPASSPORT_PASSPORT_MAX_ENTITIES,
          decayRate: config.VEPASSPORT_DECAY_RATE,
        },
        {
          admin: owner.address,
          botSignaler: owner.address,
          upgrader: owner.address,
          settingsManager: owner.address,
          roleGranter: owner.address,
          blacklister: owner.address,
          whitelister: owner.address,
          actionRegistrar: owner.address,
          actionScoreManager: owner.address,
        },
      ],
      {
        PassportChecksLogicV1: await passportChecksLogicV1.getAddress(),
        PassportConfiguratorV1: await passportConfiguratorV1.getAddress(),
        PassportEntityLogicV1: await passportEntityLogicV1.getAddress(),
        PassportDelegationLogicV1: await passportDelegationLogicV1.getAddress(),
        PassportPersonhoodLogicV1: await passportPersonhoodLogicV1.getAddress(),
        PassportPoPScoreLogicV1: await passportPoPScoreLogicV1.getAddress(),
        PassportSignalingLogicV1: await passportSignalingLogicV1.getAddress(),
        PassportWhitelistAndBlacklistLogicV1: await passportWhitelistAndBlacklistLogicV1.getAddress(),
      },
    )) as VeBetterPassportV1

    expect(await veBetterPassportV1.version()).to.equal("1")

    // Upgrade V1 -> V2
    const veBetterPassportV2 = (await upgradeProxy(
      "VeBetterPassportV1",
      "VeBetterPassportV2",
      await veBetterPassportV1.getAddress(),
      [], // No initialization args for V2 upgrade
      {
        version: 2,
        libraries: {
          PassportChecksLogicV2: await passportChecksLogicV2.getAddress(),
          PassportConfiguratorV2: await passportConfiguratorV2.getAddress(),
          PassportEntityLogicV2: await passportEntityLogicV2.getAddress(),
          PassportDelegationLogicV2: await passportDelegationLogicV2.getAddress(),
          PassportPersonhoodLogicV2: await passportPersonhoodLogicV2.getAddress(),
          PassportPoPScoreLogicV2: await passportPoPScoreLogicV2.getAddress(),
          PassportSignalingLogicV2: await passportSignalingLogicV2.getAddress(),
          PassportWhitelistAndBlacklistLogicV2: await passportWhitelistAndBlacklistLogicV2.getAddress(),
        },
      },
    )) as VeBetterPassportV2

    expect(await veBetterPassportV2.version()).to.equal("2")

    // Upgrade V2 -> V3
    const veBetterPassportV3 = (await upgradeProxy(
      "VeBetterPassportV2",
      "VeBetterPassportV3",
      await veBetterPassportV2.getAddress(),
      [], // No initialization args for V3 upgrade
      {
        version: 3,
        libraries: {
          PassportChecksLogicV3: await passportChecksLogicV3.getAddress(),
          PassportConfiguratorV3: await passportConfiguratorV3.getAddress(),
          PassportEntityLogicV3: await passportEntityLogicV3.getAddress(),
          PassportDelegationLogicV3: await passportDelegationLogicV3.getAddress(),
          PassportPersonhoodLogicV3: await passportPersonhoodLogicV3.getAddress(),
          PassportPoPScoreLogicV3: await passportPoPScoreLogicV3.getAddress(),
          PassportSignalingLogicV3: await passportSignalingLogicV3.getAddress(),
          PassportWhitelistAndBlacklistLogicV3: await passportWhitelistAndBlacklistLogicV3.getAddress(),
        },
      },
    )) as VeBetterPassportV3

    // Upgrade V3 -> V4 (latest)
    const veBetterPassportV4 = (await upgradeProxy(
      "VeBetterPassportV3",
      "VeBetterPassport",
      await veBetterPassportV3.getAddress(),
      [config.CONTRACTS_ADMIN_ADDRESS], // initializeV4: resetSignaler address
      {
        version: 4,
        libraries: {
          PassportChecksLogic: await passportChecksLogic.getAddress(),
          PassportConfigurator: await passportConfigurator.getAddress(),
          PassportEntityLogic: await passportEntityLogic.getAddress(),
          PassportDelegationLogic: await passportDelegationLogic.getAddress(),
          PassportPersonhoodLogic: await passportPersonhoodLogic.getAddress(),
          PassportPoPScoreLogic: await passportPoPScoreLogic.getAddress(),
          PassportSignalingLogic: await passportSignalingLogic.getAddress(),
          PassportWhitelistAndBlacklistLogic: await passportWhitelistAndBlacklistLogic.getAddress(),
        },
      },
    )) as VeBetterPassport

    expect(await veBetterPassportV4.version()).to.equal("4")

    const adminRoleV1 = await veBetterPassportV1.DEFAULT_ADMIN_ROLE()
    const ownerHasAdminV1 = await veBetterPassportV1.hasRole(adminRoleV1, owner.address)
    const thresholdV1 = await veBetterPassportV1.thresholdPoPScore()

    const adminRoleV2 = await veBetterPassportV2.DEFAULT_ADMIN_ROLE()
    const ownerHasAdminV2 = await veBetterPassportV2.hasRole(adminRoleV2, owner.address)
    const thresholdV2 = await veBetterPassportV2.thresholdPoPScore()

    const adminRoleV3 = await veBetterPassportV3.DEFAULT_ADMIN_ROLE()
    const ownerHasAdminV3 = await veBetterPassportV3.hasRole(adminRoleV3, owner.address)
    const thresholdV3 = await veBetterPassportV3.thresholdPoPScore()

    const adminRoleV4 = await veBetterPassportV4.DEFAULT_ADMIN_ROLE()
    const ownerHasAdminV4 = await veBetterPassportV4.hasRole(adminRoleV4, owner.address)
    const thresholdV4 = await veBetterPassportV4.thresholdPoPScore()

    expect(ownerHasAdminV1).to.be.true
    expect(ownerHasAdminV2).to.equal(ownerHasAdminV1) // Check admin role persisted
    expect(thresholdV2).to.equal(thresholdV1)

    expect(ownerHasAdminV3).to.equal(ownerHasAdminV2) // Check admin role persisted
    expect(thresholdV3).to.equal(thresholdV2)

    expect(ownerHasAdminV4).to.equal(ownerHasAdminV3) // Check admin role persisted
    expect(thresholdV4).to.equal(thresholdV3)

    // Check if the RESET_SIGNALER_ROLE was assigned during V4 initialization
    const RESET_SIGNALER_ROLE = await veBetterPassportV4.RESET_SIGNALER_ROLE()
    expect(await veBetterPassportV4.hasRole(RESET_SIGNALER_ROLE, config.CONTRACTS_ADMIN_ADDRESS)).to.be.true

    // Verify a role granted in V1 still exists in V4
    const SETTINGS_MANAGER_ROLE = await veBetterPassportV4.SETTINGS_MANAGER_ROLE()
    expect(await veBetterPassportV4.hasRole(SETTINGS_MANAGER_ROLE, owner.address)).to.be.true
  })
})
