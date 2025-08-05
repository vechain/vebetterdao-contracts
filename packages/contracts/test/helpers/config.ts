import { defineConfig } from "@repo/config/contracts/defineConfig"

export function createTestConfig() {
  return defineConfig({
    NEXT_PUBLIC_APP_ENV: "local",

    B3TR_GOVERNOR_QUORUM_PERCENTAGE: 4, // 4 -> Need 4% of voters to pass
    TIMELOCK_MIN_DELAY: 30, //after a vote passes, you have 5 min before you can vote queue the proposal
    B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 2, // 2% of total B3TR supply needed to be deposited to create a proposal
    B3TR_GOVERNOR_MIN_VOTING_DELAY: 1, // 1 -> 1 block before the vote starts
    B3TR_GOVERNOR_VOTING_THRESHOLD: BigInt("1000000000000000000"), // 1 vote
    B3TR_GOVERNOR_WHITELISTED_METHODS: {
      B3TR: ["tokenDetails"],
    },

    EMISSIONS_CYCLE_DURATION: 12, // 12 blocks - 2 minutes.
    EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE: 4, // 4% decay every cycle
    EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE: 20,
    EMISSIONS_X_ALLOCATION_DECAY_PERIOD: 12,
    EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD: 50,
    EMISSIONS_TREASURY_PERCENTAGE: 2500, // 25%
    EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE: 80,
    EMISSIONS_IS_NOT_ALIGNED: false,

    X_ALLOCATION_VOTING_QUORUM_PERCENTAGE: 40, // 40 -> Need 40% of total supply to succeed
    X_ALLOCATION_VOTING_VOTING_THRESHOLD: BigInt("1000000000000000000"), // 1 vote

    X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE: 30, // min amount of X tokens that a project will get each round
    X_ALLOCATION_POOL_APP_SHARES_MAX_CAP: 20, // an app can get max % in allocation round

    CONTRACTS_ADMIN_ADDRESS: "0xf077b491b355E64048cE21E3A6Fc4751eEeA77fa", //1st account from mnemonic of solo network
    VOTE_2_EARN_POOL_ADDRESS: "0x435933c8064b4Ae76bE665428e0307eF2cCFBD68", //2nd account from mnemonic of solo network

    INITIAL_X_ALLOCATION: BigInt("2000000000000000000000000"), // 2M

    /*
        Level => B3TR Required
  
        2 (Moon) => 10,000 B3TR
        3 (Mercury) => 25,000 B3TR
        4 (Venus) => 50,000 B3TR
        5 (Mars) => 100,000 B3TR
        6 (Jupiter) => 250,000 B3TR
        7 (Saturn) => 500,000 B3TR
        8 (Uranus) => 2,500,000 B3TR
        9 (Neptune) => 5,000,000 B3TR
        10 (Galaxy) => 25,000,000 B3TR
      */
    GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL: [
      10000000000000000000000n,
      25000000000000000000000n,
      50000000000000000000000n,
      100000000000000000000000n,
      250000000000000000000000n,
      500000000000000000000000n,
      2500000000000000000000000n,
      5000000000000000000000000n,
      25000000000000000000000000n,
    ],

    GM_NFT_BASE_URI: "ipfs://test/", // IPFS base URI for the Galaxy Member contract,

    GM_NFT_MAX_LEVEL: 1,

    /*
      Vechain Node => Free Upgrade Level
      None => 1
      Strength => 2
      Thunder => 4
      Mjolnir => 6
      VeThorX => 2
      StrengthX => 4
      ThunderX => 6
      MjolnirX => 7
    */
    GM_NFT_NODE_TO_FREE_LEVEL: [1, 2, 4, 6, 2, 4, 6, 7],

    VOTER_REWARDS_LEVELS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],

    /*
      Level => Percentage Multiplier
  
      2 (Moon) => 10% (1.1x)
      3 (Mercury) => 20% (1.2x)
      4 (Venus) => 50% (1.5x)
      5 (Mars) => 100% (2x)
      6 (Jupiter) => 150% (2.5x)
      7 (Saturn) => 200% (3x)
      8 (Uranus) => 400% (5x)
      9 (Neptune) => 900% (10x)
      10 (Galaxy) => 2400% (25x)
    */
    VOTER_REWARDS_MULTIPLIER: [0, 10, 20, 50, 100, 150, 200, 400, 900, 2400],

    XAPP_BASE_URI: "ipfs://",

    /*
      Token transfer limits. These values are not final and are for testing purposes only.
    */
    TREASURY_TRANSFER_LIMIT_VET: BigInt("1000000000000000000"), // 1 VET
    TREASURY_TRANSFER_LIMIT_B3TR: BigInt("1000000000000000000"), // 1 B3TR
    TREASURY_TRANSFER_LIMIT_VTHO: BigInt("1000000000000000000"), // 1 VTHO
    TREASURY_TRANSFER_LIMIT_VOT3: BigInt("1000000000000000000"), // 1 VOT3

    // Migration
    MIGRATION_ADDRESS: "0x865306084235Bf804c8Bba8a8d56890940ca8F0b", // 10th account from mnemonic of solo network
    MIGRATION_AMOUNT: BigInt("3750000000000000000000000"), // 3.75 million B3TR tokens from pilot show

    // version 2
    XAPP_GRACE_PERIOD: 120960, // 120960 blocks = 2 weeks
    VECHAIN_NODES_CONTRACT_ADDRESS: "0xb81E9C5f9644Dec9e5e3Cac86b4461A222072302", // The contract address of the VeChainNodes contract on mainnet
    // X 2 Earn Rewards Pool
    X_2_EARN_INITIAL_IMPACT_KEYS: [
      "carbon",
      "water",
      "energy",
      "waste_mass",
      "education_time",
      "timber",
      "plastic",
      "trees_planted",
    ],

    // VeBetterPassport
    VEPASSPORT_BOT_SIGNALING_THRESHOLD: 2,
    VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE: 5,
    VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL: 2,
    VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE: 2,
    VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE: 2,
    VEPASSPORT_PASSPORT_MAX_ENTITIES: 5,
    VEPASSPORT_DECAY_RATE: 0,

    CREATOR_NFT_URI: "ipfs://BASE_URI",

    X2EARN_NODE_COOLDOWN_PERIOD: 0,

    MULTI_SIG_SIGNERS: [
      "0xf077b491b355E64048cE21E3A6Fc4751eEeA77fa",
      "0x435933c8064b4Ae76bE665428e0307eF2cCFBD68",
      "0x0F872421Dc479F3c11eDd89512731814D0598dB5",
    ],

    GM_PERCENTAGE_OF_TREASURY: 2500,

    GM_MULTIPLIERS_V2: [110, 120, 150, 200, 250, 300, 500, 1000, 2500], // GM multipiers according
    VOTER_REWARDS_LEVELS_V2: [2, 3, 4, 5, 6, 7, 8, 9, 10], // Voter rewards levels according to GM level

    /*
    Level => B3TR Required (halved)

    2 (Moon) => 5,000 B3TR
    3 (Mercury) => 12,500 B3TR
    4 (Venus) => 25,000 B3TR
    5 (Mars) => 50,000 B3TR
    6 (Jupiter) => 125,000 B3TR
    7 (Saturn) => 250,000 B3TR
    8 (Uranus) => 1,250,000 B3TR
    9 (Neptune) => 2,500,000 B3TR
    10 (Galaxy) => 12,500,000 B3TR
*/
    GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL_V2: [
      5000000000000000000000n,
      12500000000000000000000n,
      25000000000000000000000n,
      50000000000000000000000n,
      125000000000000000000000n,
      250000000000000000000000n,
      1250000000000000000000000n,
      2500000000000000000000000n,
      12500000000000000000000000n,
    ],
  })
}
