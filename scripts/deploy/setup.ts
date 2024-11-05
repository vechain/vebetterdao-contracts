import { Emissions, Treasury, X2EarnApps } from "../../typechain-types"
import { SeedStrategy, getSeedAccounts, getTestKeys } from "../helpers/seedAccounts"
import { bootstrapEmissions } from "../helpers/emissions"
import { addXDapps } from "../helpers/xApp"
import { airdropB3trFromTreasury } from "../helpers/airdrop"

const accounts = getTestKeys(13)

export const APPS = [
  {
    address: accounts[6].address,
    name: "Vyvo",
    metadataURI: "bafkreid3dbmrxe3orutmptc43me5gnvskz7hu53bjnlfgafwu6xb53w3mi",
  },
  {
    address: accounts[7].address,
    name: "Mugshot",
    metadataURI: "bafkreidqiirz4ekvzyme5ll3obhh6fmcbt67uipqljeh6cvbb5mvkks2f4",
  },
  {
    address: accounts[9].address,
    name: "Cleanify",
    metadataURI: "bafkreifmgtvgcvgibtrvcmbao4zc2cn2z4ga6xxp3wro5a7z5cdtfxnvrq",
  },
  {
    address: accounts[10].address,
    name: "Non Fungible Book Club (NFBC)",
    metadataURI: "bafkreift6bsmzrjnxvdwkrpmxntbwpsrrxjvsvliycnfxoqznb63poeyka",
  },
  {
    address: accounts[11].address,
    name: "Green Ambassador Challenge",
    metadataURI: "bafkreigui2fiwnir3r3k32w7c3irbbdbfkpqanbisxarz7f6gqxk4gzeay",
  },
  {
    address: accounts[11].address,
    name: "GreenCart",
    metadataURI: "bafkreif3wf422t4z6zyiztirmpplcdmemldk24dc3a4kow6ug5nznzmvhm",
  },
  {
    address: accounts[12].address,
    name: "EVearn",
    metadataURI: "bafkreicz2cslyuzbmj2msmgyzpz2tqwmbyifb7yvb5jbnydp4yx4jnkfny",
  },
]

export const setupLocalEnvironment = async (emissions: Emissions, treasury: Treasury, x2EarnApps: X2EarnApps) => {
  const start = performance.now()
  console.log("================ Setup local environment ================")

  // Define specific accounts
  const admin = accounts[0]

  // Bootstrap emissions
  const emissionsContract = await emissions.getAddress()
  await bootstrapEmissions(emissionsContract, admin)

  // Add x-apps to the XAllocationPool
  const x2EarnAppsAddress = await x2EarnApps.getAddress()
  await addXDapps(x2EarnAppsAddress, admin, APPS)

  // Seed the first 5 accounts with some tokens
  const treasuryAddress = await treasury.getAddress()
  const seedAccounts = getSeedAccounts(SeedStrategy.FIXED, 5, 0)
  await airdropB3trFromTreasury(treasuryAddress, admin, seedAccounts)

  const end = new Date(performance.now() - start)
  console.log(`Setup complete in ${end.getMinutes()}m ${end.getSeconds()}s`)
}

export const setupTestEnvironment = async (emissions: Emissions, x2EarnApps: X2EarnApps) => {
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
  await addXDapps(x2EarnAppsAddress, admin, APPS)
  console.log("x-apps added")

  const end = performance.now()
  console.log(`Setup complete in ${end - start}ms`)
}
