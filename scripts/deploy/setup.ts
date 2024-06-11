import { Emissions, Treasury, X2EarnApps } from "../../typechain-types"
import { SeedStrategy, getSeedAccounts, getTestKeys } from "../helpers/seedAccounts"
import { bootstrapEmissions } from "../helpers/emissions"
import { addXDapps } from "../helpers/xApp"
import { airdropB3trFromTreasury } from "../helpers/airdrop"

const accounts = getTestKeys(13)

const APPS = [
  {
    address: accounts[6].address,
    name: "Vyvo",
    metadataURI: "bafkreigk7faih4jmdee4ritah6564jqpfn5s2gl4dcsvii7woijy5ls7ca",
  },
  {
    address: accounts[7].address,
    name: "Mugshot",
    metadataURI: "bafkreidaleehj2euzdmpystzaux5aandfwnhyzgfjkujebbixek7edyyzu",
  },
  {
    address: accounts[9].address,
    name: "Cleanify",
    metadataURI: "bafkreicw6g34t3th63z7hq3o4xkay6dkrei5ny5evyrlclw53gfz6o6lgu",
  },
  {
    address: accounts[10].address,
    name: "Non Fungible Book Club (NFBC)",
    metadataURI: "bafkreicdcol6afcsfb4efxmjzqsuonukn54jixmfqmfsirhw4wujvxfpxy",
  },
  {
    address: accounts[11].address,
    name: "Green Ambassador Challenge",
    metadataURI: "bafkreigrwjowwwcmdd7bdm3yqsquu77ufeqcao6mjbd2fednwo5qfmtldi",
  },
  {
    address: accounts[11].address,
    name: "GreenCart",
    metadataURI: "bafkreie6gdx7xugiemmubpfb6r5c4bdwfjucjtmb43mk2fhemyx3x3kvnu",
  },
  {
    address: accounts[12].address,
    name: "EVearn",
    metadataURI: "bafkreif5m23ikv6jphvjciv5uwtq3eqchinh5m5jexdo7atgxyf62az65y",
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
