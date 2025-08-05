import {
  B3TR,
  B3TRGovernorV1,
  Emissions,
  TokenAuction,
  Treasury,
  VOT3,
  VoterRewards,
  X2EarnApps,
  XAllocationVoting,
} from "../../typechain-types"
import { SeedStrategy, getSeedAccounts, getTestKeys } from "../helpers/seedAccounts"
import { bootstrapEmissions, startEmissions } from "../helpers/emissions"
import { App, endorseXApps, registerXDapps } from "../helpers/xApp"
import { airdropB3trFromTreasury, airdropVTHO } from "../helpers/airdrop"
import { mintVechainNodes, proposeUpgradeGovernance } from "../helpers"
import { convertB3trForVot3 } from "../helpers/swap"
import { EnvConfig, getContractsConfig, shouldEndorseXApps } from "@repo/config/contracts"

const accounts = getTestKeys(17)
const xDappCreatorAccounts = accounts.slice(0, 8)

export const APPS: App[] = [
  {
    admin: accounts[6].address.toString(),
    teamWalletAddress: accounts[6].address.toString(),
    name: "Mugshot",
    metadataURI: "bafkreidqiirz4ekvzyme5ll3obhh6fmcbt67uipqljeh6cvbb5mvkks2f4",
  },
  {
    admin: accounts[6].address.toString(),
    teamWalletAddress: accounts[6].address.toString(),
    name: "Cleanify",
    metadataURI: "bafkreifmgtvgcvgibtrvcmbao4zc2cn2z4ga6xxp3wro5a7z5cdtfxnvrq",
  },
  {
    admin: accounts[6].address.toString(),
    teamWalletAddress: accounts[6].address.toString(),
    name: "GreenCart",
    metadataURI: "bafkreif3wf422t4z6zyiztirmpplcdmemldk24dc3a4kow6ug5nznzmvhm",
  },
  {
    admin: accounts[6].address.toString(),
    teamWalletAddress: accounts[6].address.toString(),
    name: "Green Ambassador Challenge",
    metadataURI: "bafkreigui2fiwnir3r3k32w7c3irbbdbfkpqanbisxarz7f6gqxk4gzeay",
  },
  {
    admin: accounts[6].address.toString(),
    teamWalletAddress: accounts[6].address.toString(),
    name: "Oily",
    metadataURI: "bafkreiegiuaukybbauhae3vdy2ktdqrehf4wzfg6rnfn5ebd36c2k6pmxa",
  },
  {
    admin: accounts[6].address.toString(),
    teamWalletAddress: accounts[6].address.toString(),
    name: "EVearn",
    metadataURI: "bafkreicz2cslyuzbmj2msmgyzpz2tqwmbyifb7yvb5jbnydp4yx4jnkfny",
  },
  {
    admin: accounts[6].address.toString(),
    teamWalletAddress: accounts[6].address.toString(),
    name: "Vyvo",
    metadataURI: "bafkreid3dbmrxe3orutmptc43me5gnvskz7hu53bjnlfgafwu6xb53w3mi",
  },
  {
    admin: accounts[6].address.toString(),
    teamWalletAddress: accounts[6].address.toString(),
    name: "Non Fungible Book Club (NFBC)",
    metadataURI: "bafkreift6bsmzrjnxvdwkrpmxntbwpsrrxjvsvliycnfxoqznb63poeyka",
  },
]

const padNodeTypes = (nodeTypes: number[], requiredLength: number) => {
  const paddingValue = 7

  while (nodeTypes.length < requiredLength) {
    nodeTypes.push(paddingValue)
  }

  return nodeTypes
}

export const setupEnvironment = async (
  config: EnvConfig,
  emissions: Emissions,
  treasury: Treasury,
  x2EarnApps: X2EarnApps,
  governor: B3TRGovernorV1,
  xAllocationVoting: XAllocationVoting,
  b3tr: B3TR,
  vot3: VOT3,
  vechainNodesMock: TokenAuction,
) => {
  switch (config) {
    case "local":
    case "testnet-staging":
    case "galactica-test":
      await setupLocalEnvironment(
        emissions,
        treasury,
        x2EarnApps,
        governor,
        xAllocationVoting,
        b3tr,
        vot3,
        vechainNodesMock,
        shouldEndorseXApps(),
      )
      break
    case "testnet":
      await setupTestEnvironment(emissions, x2EarnApps, vechainNodesMock)
      break
    case "mainnet":
      await setupMainnetEnvironment(emissions, x2EarnApps)
      break
    default:
      throw new Error(`Unsupported app environment: ${config}`)
  }
}

export const updateGMMultipliers = async (levels: number[], multipliers: number[], voterRewards: VoterRewards) => {
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]
    const multiplier = multipliers[i]

    // Update the multiplier for the level
    await voterRewards.setLevelToMultiplierNow(level, multiplier)
  }
}

export const setupLocalEnvironment = async (
  emissions: Emissions,
  treasury: Treasury,
  x2EarnApps: X2EarnApps,
  governor: B3TRGovernorV1,
  xAllocationVoting: XAllocationVoting,
  b3tr: B3TR,
  vot3: VOT3,
  vechainNodesMock: TokenAuction,
  endorseApps: boolean,
) => {
  const start = performance.now()
  console.log("================ Setup local environment")

  // Define specific accounts
  const admin = accounts[0]

  // Make sure the first 10 accounts have a VTHO balance
  await airdropVTHO(
    accounts.slice(1, 10).map(acct => acct.address),
    500n,
    admin,
  )

  // Bootstrap emissions
  const emissionsContract = await emissions.getAddress()
  await bootstrapEmissions(emissionsContract, admin)

  // Add x-apps to the XAllocationPool
  const x2EarnAppsAddress = await x2EarnApps.getAddress()
  await registerXDapps(x2EarnAppsAddress, xDappCreatorAccounts, APPS)

  // Seed the first 5 accounts with some tokens
  const treasuryAddress = await treasury.getAddress()
  const allAccounts = getSeedAccounts(SeedStrategy.FIXED, 5 + APPS.length, 0)
  const seedAccounts = allAccounts.slice(0, 5)
  const endorserAccounts = allAccounts

  await airdropVTHO(
    seedAccounts.map(acct => acct.key.address),
    500n,
    admin,
  )

  await airdropB3trFromTreasury(treasuryAddress, admin, seedAccounts)

  await convertB3trForVot3(b3tr, vot3, seedAccounts)

  /**
   * First seed account will have a Mjolnir X Node
   * Second seed account will have a Thunder X Node
   * Third seed account will have a Strength X Node
   * Forth seed account will have a Mjölnir Economic Node
   * Fifth seed account will have a Strength Economic Node
   * Remaining accounts with have a Mjolnir X Node -> These will have an endorsement score of 100
   */
  await mintVechainNodes(vechainNodesMock, endorserAccounts, padNodeTypes([7, 6, 5, 3, 1], endorserAccounts.length))

  await startEmissions(emissionsContract, admin)

  if (endorseApps) {
    // Get unendorsed XAPPs
    const unedorsedApps = await x2EarnApps.unendorsedAppIds()
    // const appsToEndorse = unedorsedApps.slice(0, unedorsedApps.length / 2)
    await endorseXApps(endorserAccounts, x2EarnApps, unedorsedApps, vechainNodesMock)
  }
  await proposeUpgradeGovernance(governor, xAllocationVoting)

  const end = new Date(performance.now() - start)

  console.log(`Setup complete in ${end.getMinutes()}m ${end.getSeconds()}s`)
}

export const setupTestEnvironment = async (
  emissions: Emissions,
  x2EarnApps: X2EarnApps,
  vechainNodesMock: TokenAuction,
) => {
  console.log("================ Setup Testnet environment")
  const start = performance.now()

  const admin = accounts[0]

  // Bootstrap emissions
  const emissionsContract = await emissions.getAddress()
  await bootstrapEmissions(emissionsContract, admin)

  // Add x-apps to the XAllocationPool
  console.log("Adding x-apps...")

  // Add x-apps to the XAllocationPool
  const x2EarnAppsAddress = await x2EarnApps.getAddress()
  await registerXDapps(x2EarnAppsAddress, xDappCreatorAccounts, APPS)
  console.log("x-apps added")

  // Creating NODE holders
  const allAccounts = getSeedAccounts(SeedStrategy.FIXED, 5 + APPS.length, 0)
  await mintVechainNodes(vechainNodesMock, allAccounts, padNodeTypes([7, 6, 5, 3, 2], allAccounts.length))
  console.log("NODE holders created")

  const end = performance.now()
  console.log(`Setup complete in ${end - start}ms`)
}

export const setupMainnetEnvironment = async (emissions: Emissions, x2EarnApps: X2EarnApps) => {
  console.log("================ Setup Mainnet environment")
  const start = performance.now()

  const mainnet_admin_addresses = new Map([
    ["Mugshot", "0xbfe2122a82c0aea091514f57c7713c3118101eda"],
    ["Cleanify", "0x6b020e5c8e8574388a275cc498b27e3eb91ec3f2"],
    ["GreenCart", "0x4e506ee842ba8ccce88e424522506f5b860e5c9b"],
    ["Green Ambassador Challenge", "0x15e74aeb00d367a5a20c61b469df30a25f0e602f"],
    ["Oily", "0xd52e3356231c9fa86bb9fab731f8c0c3f1018753"],
    ["EVearn", "0xb2919e12d035a484f8414643b606b2a180224f54"],
    ["Vyvo", "0x61ffc950b04090f5ce857ebf056852a6d27b0c3c"],
    ["Non Fungible Book Club (NFBC)", "0xbe50d2fae95b23082f351e290548365e84ec1780"],
  ])

  const admin = accounts[0]

  // Bootstrap emissions
  const emissionsContract = await emissions.getAddress()
  await bootstrapEmissions(emissionsContract, admin)

  // Add x-apps to the XAllocationPool
  console.log("Adding x-apps...")

  // Add x-apps to the XAllocationPool
  const x2EarnAppsAddress = await x2EarnApps.getAddress()

  // Overwrite the admin and teamWalletAddress with the mainnet addresses
  APPS.forEach(app => {
    const newAddress = mainnet_admin_addresses.get(app.name)
    if (newAddress) {
      app.admin = newAddress
      app.teamWalletAddress = newAddress
    } else {
      throw new Error(`Mainnet admin address not found for ${app.name}`)
    }

    console.log(app.name)
    console.log("Admin: ", app.admin)
    console.log("Team Wallet Address: ", app.teamWalletAddress)
  })

  await registerXDapps(x2EarnAppsAddress, xDappCreatorAccounts, APPS)
  console.log("x-apps added")

  const end = performance.now()
  console.log(`Setup complete in ${end - start}ms`)
}
