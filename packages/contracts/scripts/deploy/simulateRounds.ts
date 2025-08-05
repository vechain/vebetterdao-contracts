import { B3TR, VOT3, VoterRewards, XAllocationVoting } from "../../typechain-types"
import { moveBlocks } from "../../test/helpers"
import { SeedStrategy, getSeedAccounts, getTestKeys } from "../helpers/seedAccounts"
import { distributeEmissions, startEmissions, toggleQuadraticRewarding } from "../helpers/emissions"
import { airdropB3trFromTreasury, airdropVTHO, transferErc20 } from "../helpers/airdrop"
import { convertB3trForVot3 } from "../helpers/swap"
import { castVotesToXDapps } from "../helpers/xApp"
import { claimVoterRewards } from "../helpers/voterRewards"
import { getConfig } from "@repo/config"
import { ethers } from "hardhat"
import { whitelist } from "../helpers/ve-better-passport"

const NUM_ROUNDS = 10
const ACCT_OFFSET = 100
// Number of users to seed. If you increase this number you will need to increase the EMISSIONS_CYCLE_DURATION to make sure there is enough time to vote
const NUM_USERS_TO_SEED = 300
const SEED_STRATEGY = SeedStrategy.RANDOM

export const simulateRounds = async () => {
  const start = performance.now()
  console.log("================")
  console.log("Running simulation...")

  // Get the latest config and create the contracts
  const config = getConfig()
  const b3tr: B3TR = await ethers.getContractAt("B3TR", config.b3trContractAddress)
  const vot3: VOT3 = await ethers.getContractAt("VOT3", config.vot3ContractAddress)
  const xAllocationVoting: XAllocationVoting = await ethers.getContractAt(
    "XAllocationVoting",
    config.xAllocationVotingContractAddress,
  )
  const voterRewards: VoterRewards = await ethers.getContractAt("VoterRewards", config.voterRewardsContractAddress)

  const accounts = getTestKeys(10)
  const seedAccounts = getSeedAccounts(SEED_STRATEGY, NUM_USERS_TO_SEED, ACCT_OFFSET)

  // Define specific accounts
  const admin = accounts[0]
  const migrationAccount = accounts[9]

  // Whitelist all seed accounts
  await whitelist(
    seedAccounts.map(account => account.key.address.toString()),
    admin,
    config.veBetterPassportContractAddress,
  )

  // Airdrop VTHO
  await airdropVTHO(
    seedAccounts.map(acct => acct.key.address),
    500n,
    admin,
  )

  // Airdrop B3TR from Treasury
  //// Top the treasury up with tokens from the migration account
  const bal = await b3tr.balanceOf(migrationAccount.address.toString())
  await transferErc20(await b3tr.getAddress(), migrationAccount, config.treasuryContractAddress, bal)
  await airdropB3trFromTreasury(config.treasuryContractAddress, admin, seedAccounts)

  // Convert B3TR for VOT3
  await convertB3trForVot3(b3tr, vot3, seedAccounts)

  // Start emissions
  let roundId = parseInt((await xAllocationVoting.currentRoundId()).toString())
  if (roundId === 0) {
    await startEmissions(config.emissionsContractAddress, admin)
    roundId = parseInt((await xAllocationVoting.currentRoundId()).toString())
  }
  const startingRound = roundId.valueOf()

  // Casting random votes to xDapps
  let xDapps = (await xAllocationVoting.getAppsOfRound(roundId)).map(app => app.id)
  if (xDapps.length == 0) {
    console.log(`No xDapps found for round ${roundId}, waiting for next round`)
    await waitForRoundToEnd(roundId, xAllocationVoting)
    await distributeEmissions(config.emissionsContractAddress, admin)
    roundId = parseInt((await xAllocationVoting.currentRoundId()).toString())
    xDapps = (await xAllocationVoting.getAppsOfRound(roundId)).map(app => app.id)
  }
  await castVotesToXDapps(vot3, xAllocationVoting, seedAccounts, roundId, xDapps, true)

  // Wait for round to end
  await waitForRoundToEnd(roundId, xAllocationVoting)

  // Claim voter rewards
  await claimVoterRewards(voterRewards, roundId, admin, seedAccounts, true)

  // Convert B3TR for VOT3
  await convertB3trForVot3(b3tr, vot3, seedAccounts)

  for (let i = 1; i < startingRound + NUM_ROUNDS; i++) {
    // Disable quadratic rewarding after 10 rounds, then enable it again after 20 rounds
    if (i === 10 || i === 30) {
      await toggleQuadraticRewarding(voterRewards, admin)
    }

    await distributeEmissions(config.emissionsContractAddress, admin)
    const roundId = parseInt((await xAllocationVoting.currentRoundId()).toString())
    console.log(`Casting random votes to xDapps for round ${roundId}...`)
    await castVotesToXDapps(vot3, xAllocationVoting, seedAccounts, roundId, xDapps, true)
    await waitForRoundToEnd(roundId, xAllocationVoting)
    await claimVoterRewards(voterRewards, roundId, admin, seedAccounts, true)

    // Convert B3TR for VOT3
    await convertB3trForVot3(b3tr, vot3, seedAccounts)
  }

  const end = performance.now()
  console.log(`Simulation complete in ${end - start}ms`)
}

const waitForRoundToEnd = async (roundId: number, xAllocationVoting: XAllocationVoting) => {
  const deadline = await xAllocationVoting.roundDeadline(roundId)
  const currentBlock = await xAllocationVoting.clock()
  await moveBlocks(parseInt((deadline - currentBlock + BigInt(1)).toString()))
}
