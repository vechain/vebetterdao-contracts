import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import {
  B3TR,
  B3TRGovernor,
  Emissions,
  GalaxyMember,
  TimeLock,
  Treasury,
  VeBetterPassport,
  VOT3,
  VoterRewards,
  X2EarnApps,
  X2EarnCreator,
  X2EarnCreator__factory,
  X2EarnRewardsPool,
  XAllocationPool,
  XAllocationVoting,
} from "../../typechain-types"

export const transferAdminRole = async (
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

export const transferMinterRole = async (
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
export const transferGovernanceRole = async (
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

export const transferContractsAddressManagerRole = async (
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

export const transferDecaySettingsManagerRole = async (
  contract: Emissions,
  admin: HardhatEthersSigner,
  newAddress: string,
) => {
  if (admin.address === newAddress) throw new Error("Role not transferred. New address is the same as old address")

  const decaySettingsManagerRole = await contract.DECAY_SETTINGS_MANAGER_ROLE()

  await contract
    .connect(admin)
    .grantRole(decaySettingsManagerRole, newAddress)
    .then(async tx => await tx.wait())
  await contract
    .connect(admin)
    .renounceRole(decaySettingsManagerRole, admin.address)
    .then(async tx => await tx.wait())

  const newRoleSet = await contract.hasRole(decaySettingsManagerRole, newAddress)
  const oldRoleRemoved = !(await contract.hasRole(decaySettingsManagerRole, admin.address))

  if (!newRoleSet || !oldRoleRemoved) throw new Error("Role not set correctly on " + (await contract.getAddress()))

  console.log("Decay Settings Manager Role transferred successfully on " + (await contract.getAddress()))
}

export const transferGovernorFunctionSettingsRole = async (
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

// Function that checks that roles are set correctly on the contracts
export const validateContractRole = async (
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
    | X2EarnApps
    | VeBetterPassport
    | X2EarnCreator,
  expectedAddress: string,
  tempAdmin: string,
  role: string,
) => {
  if (expectedAddress === tempAdmin) return

  const roleSet = await contract.hasRole(role, expectedAddress)
  // Check that the temporary admin does not have the role
  const roleRemoved = !(await contract.hasRole(role, tempAdmin))

  if (!roleSet || !roleRemoved)
    throw new Error("Role " + role + " not set correctly on " + (await contract.getAddress()))
}

export const transferSettingsManagerRole = async (
  contract: VeBetterPassport,
  admin: HardhatEthersSigner,
  newAddress: string,
) => {
  if (admin.address === newAddress) return

  const settingsManagerRole = await contract.SETTINGS_MANAGER_ROLE()

  await contract
    .connect(admin)
    .grantRole(settingsManagerRole, newAddress)
    .then(async tx => await tx.wait())
  await contract
    .connect(admin)
    .renounceRole(settingsManagerRole, admin.address)
    .then(async tx => await tx.wait())

  const newRoleSet = await contract.hasRole(settingsManagerRole, newAddress)
  const oldRoleRemoved = !(await contract.hasRole(settingsManagerRole, admin.address))

  if (!newRoleSet || !oldRoleRemoved) throw new Error("Role not set correctly on " + (await contract.getAddress()))

  console.log("Settings Manager Role transferred successfully on " + (await contract.getAddress()))
}

export const transferUpgraderRole = async (
  contract: Emissions | XAllocationPool,
  admin: HardhatEthersSigner,
  newAddress: string,
) => {
  if (admin.address === newAddress) return

  const upgraderRole = await contract.UPGRADER_ROLE()

  await contract
    .connect(admin)
    .grantRole(upgraderRole, newAddress)
    .then(async tx => await tx.wait())
  await contract
    .connect(admin)
    .renounceRole(upgraderRole, admin.address)
    .then(async tx => await tx.wait())

  const newRoleSet = await contract.hasRole(upgraderRole, newAddress)
  const oldRoleRemoved = !(await contract.hasRole(upgraderRole, admin.address))

  if (!newRoleSet || !oldRoleRemoved) throw new Error("Role not set correctly on " + (await contract.getAddress()))
}
