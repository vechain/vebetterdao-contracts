import { Emissions, TokenAuction, Treasury, X2EarnApps } from "../../typechain-types"
import { SeedStrategy, getSeedAccounts, getTestKeys } from "../helpers/seedAccounts"
import { bootstrapEmissions } from "../helpers/emissions"
import { mintVechainNodes } from "../helpers/vechainNodes"
import { endorseXApps, registerXDapps } from "../helpers/xApp"
import { airdropB3trFromTreasury } from "../helpers/airdrop"

const accounts = getTestKeys(13)

export const APPS = [
  {
    admin: accounts[6].address,
    teamWalletAddress: accounts[6].address,
    name: "Mugshot",
    metadataURI: "bafkreidqiirz4ekvzyme5ll3obhh6fmcbt67uipqljeh6cvbb5mvkks2f4",
  },
  {
    admin: accounts[6].address,
    teamWalletAddress: accounts[6].address,
    name: "Cleanify",
    metadataURI: "bafkreifmgtvgcvgibtrvcmbao4zc2cn2z4ga6xxp3wro5a7z5cdtfxnvrq",
  },
  {
    admin: accounts[6].address,
    teamWalletAddress: accounts[6].address,
    name: "GreenCart",
    metadataURI: "bafkreif3wf422t4z6zyiztirmpplcdmemldk24dc3a4kow6ug5nznzmvhm",
  },
  {
    admin: accounts[6].address,
    teamWalletAddress: accounts[6].address,
    name: "Green Ambassador Challenge",
    metadataURI: "bafkreigui2fiwnir3r3k32w7c3irbbdbfkpqanbisxarz7f6gqxk4gzeay",
  },
  {
    admin: accounts[6].address,
    teamWalletAddress: accounts[6].address,
    name: "Oily",
    metadataURI: "bafkreiegiuaukybbauhae3vdy2ktdqrehf4wzfg6rnfn5ebd36c2k6pmxa",
  },
  {
    admin: accounts[6].address,
    teamWalletAddress: accounts[6].address,
    name: "EVearn",
    metadataURI: "bafkreicz2cslyuzbmj2msmgyzpz2tqwmbyifb7yvb5jbnydp4yx4jnkfny",
  },
  {
    admin: accounts[6].address,
    teamWalletAddress: accounts[6].address,
    name: "Vyvo",
    metadataURI: "bafkreid3dbmrxe3orutmptc43me5gnvskz7hu53bjnlfgafwu6xb53w3mi",
  },
  {
    admin: accounts[6].address,
    teamWalletAddress: accounts[6].address,
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

export const setupLocalEnvironment = async (emissions: Emissions, treasury: Treasury, x2EarnApps: X2EarnApps, vechainNodesMock: TokenAuction) => {
  const start = performance.now()
  console.log("================ Setup local environment ================")

  // Define specific accounts
  const admin = accounts[0]

  // Bootstrap emissions
  const emissionsContract = await emissions.getAddress()
  await bootstrapEmissions(emissionsContract, admin)

  // Add x-apps to the XAllocationPool
  const x2EarnAppsAddress = await x2EarnApps.getAddress()
  await registerXDapps(x2EarnAppsAddress, admin, APPS)

  // Seed the first 5 accounts with some tokens
  const treasuryAddress = await treasury.getAddress()
  const allAccounts = getSeedAccounts(SeedStrategy.FIXED, 5 + APPS.length, 0)
  const seedAccounts = allAccounts.slice(0, 5)
  const endorserAccounts = allAccounts

  await airdropB3trFromTreasury(treasuryAddress, admin, seedAccounts)

    /**
   * First seed account will have a Mjolnir X Node
   * Second seed account will have a Thunder X Node
   * Third seed account will have a Strength X Node
   * Forth seed account will have a Mjölnir Economic Node
   * Fifth seed account will have a Thunder Economic Node
   * Remaining accounts with have a Mjolnir X Node -> These will have an endorsement score of 100
   */
    await mintVechainNodes(vechainNodesMock, endorserAccounts, padNodeTypes([7, 6, 5, 3, 2], endorserAccounts.length))

    // Get unendorsed XAPPs
    const unedorsedApps = await x2EarnApps.unendorsedAppIds()
    const appsToEndorse = unedorsedApps.slice(0, unedorsedApps.length / 2)
    await endorseXApps(endorserAccounts, x2EarnApps, appsToEndorse, vechainNodesMock)

  const end = new Date(performance.now() - start)
  console.log(`Setup complete in ${end.getMinutes()}m ${end.getSeconds()}s`)
}

export const setupTestEnvironment = async (emissions: Emissions, x2EarnApps: X2EarnApps, 
  vechainNodesMock: TokenAuction) => {
  console.log("================ Setup Testnet environment ================")
  const start = performance.now()

  const admin = accounts[0]

  // Bootstrap emissions
  const emissionsContract = await emissions.getAddress()
  await bootstrapEmissions(emissionsContract, admin)

  // Add x-apps to the XAllocationPool
  console.log("Adding x-apps...")

  // Add x-apps to the XAllocationPool
  const x2EarnAppsAddress = await x2EarnApps.getAddress()
  await registerXDapps(x2EarnAppsAddress, admin, APPS)
  console.log("x-apps added")

  // Creating NODE holders
  const allAccounts = getSeedAccounts(SeedStrategy.FIXED, 5 + APPS.length, 0)
  await mintVechainNodes(vechainNodesMock, allAccounts, padNodeTypes([7, 6, 5, 3, 2], allAccounts.length))
  console.log("NODE holders created")

  const end = performance.now()
  console.log(`Setup complete in ${end - start}ms`)
}
