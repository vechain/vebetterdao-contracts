import { B3TR, Emissions, Treasury, VOT3, VoterRewards, XAllocationVoting } from "../../typechain-types"
import { moveBlocks } from "../../test/helpers"
import { SeedStrategy, getSeedAccounts, getTestKeys } from "../helpers/seedAccounts"
import { distributeEmissions, startEmissions } from "../helpers/emissions"
import { airdropB3trFromTreasury, airdropVTHO, transferErc20 } from "../helpers/airdrop"
import { convertB3trForVot3 } from "../helpers/swap"
import { castVotesToXDapps } from "../helpers/xApp"
import { claimVoterRewards } from "../helpers/voterRewards"

const ACCT_OFFSET = 15
// Number of users to seed. If you increase this number you will need to increase the EMISSIONS_CYCLE_DURATION to make sure there is enough time to vote
const NUM_USERS_TO_SEED = 300
const SEED_STRATEGY = SeedStrategy.RANDOM

export const simulateRounds = async (
  b3tr: B3TR,
  vot3: VOT3,
  xAllocationVoting: XAllocationVoting,
  emissions: Emissions,
  voterRewards: VoterRewards,
  treasury: Treasury,
) => {
  const start = performance.now()
  console.log("Running simulation...")

  const accounts = getTestKeys(10)
  const seedAccounts = getSeedAccounts(SEED_STRATEGY, NUM_USERS_TO_SEED, ACCT_OFFSET)

  // Define specific accounts
  const admin = accounts[0]
  const migrationAccount = accounts[9]

  // Airdrop VTHO
  await airdropVTHO(seedAccounts, accounts[8])

  // Airdrop B3TR from Treasury
  const treasuryAddress = await treasury.getAddress()
  //// Top the treasury up with tokens from the migration account
  const bal = await b3tr.balanceOf(migrationAccount.address)
  await transferErc20(await b3tr.getAddress(), migrationAccount, treasuryAddress, bal)
  await airdropB3trFromTreasury(treasuryAddress, admin, seedAccounts)

  // Convert B3TR for VOT3
  await convertB3trForVot3(b3tr, vot3, seedAccounts)

  // Start emissions
  const emissionsContract = await emissions.getAddress()
  await startEmissions(emissionsContract, admin)
  const roundId = parseInt((await xAllocationVoting.currentRoundId()).toString())

  // console.log("Casting random votes to xDapps...")
  const xDapps = (await xAllocationVoting.getAppsOfRound(roundId)).map(app => app.id)
  await castVotesToXDapps(vot3, xAllocationVoting, seedAccounts, roundId, xDapps)

  // Wait for round to end
  await waitForRoundToEnd(roundId, xAllocationVoting)

  // Claim voter rewards
  await claimVoterRewards(voterRewards, roundId, admin, seedAccounts)

  // Convert B3TR for VOT3
  await convertB3trForVot3(b3tr, vot3, seedAccounts)

  for (let i = 1; i < 634; i++) {
    await distributeEmissions(emissionsContract, admin)
    const roundId = parseInt((await xAllocationVoting.currentRoundId()).toString())
    console.log(`Casting random votes to xDapps for round ${roundId}...`)
    await castVotesToXDapps(vot3, xAllocationVoting, seedAccounts, roundId, xDapps)
    await waitForRoundToEnd(roundId, xAllocationVoting)
    await claimVoterRewards(voterRewards, roundId, admin, seedAccounts)

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
