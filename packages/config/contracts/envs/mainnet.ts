import { defineConfig } from "../defineConfig"
export function createMainnetConfig() {
  return defineConfig({
    NEXT_PUBLIC_APP_ENV: "mainnet",

    MIGRATION_ADDRESS: "0xdd6c4a8282e35f18829374b436cb5260d8eb718c",
    MIGRATION_AMOUNT: BigInt("3750000000000000000000000"), // 3.75 million B3TR tokens from pilot show

    B3TR_GOVERNOR_QUORUM_PERCENTAGE: 51, //Need 51% of voters to pass
    TIMELOCK_MIN_DELAY: 60480, // 1 week, time to wait before you can execute a queued proposa
    B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 2, // Percentage of total B3TR supply needed to be deposited to create a proposal
    B3TR_GOVERNOR_MIN_VOTING_DELAY: 25920, // 3 days, proposal needs to be created at least 3 days before it can be voted on
    B3TR_GOVERNOR_VOTING_THRESHOLD: BigInt("1000000000000000000"), // 1 vote
    //Grants proposal types
    B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD: 2, // Percentage of total B3TR supply needed to be deposited to create a proposal
    B3TR_GOVERNOR_GRANT_VOTING_THRESHOLD: BigInt("1000000000000000000"), // 1 vote
    B3TR_GOVERNOR_GRANT_QUORUM_PERCENTAGE: 2, // 2 -> Need 2% of voters to pass

    //Deposit threshold cap for grants and standard proposals
    B3TR_GOVERNOR_GRANT_DEPOSIT_THRESHOLD_CAP: BigInt("3500000000000000000000000"), // 3.5M B3TR
    B3TR_GOVERNOR_STANDARD_DEPOSIT_THRESHOLD_CAP: BigInt("5000000000000000000000000"), // 5M B3TR

    // GM weight requirements for proposal types
    B3TR_GOVERNOR_STANDARD_GM_WEIGHT: 2, // Requires GM level 2 (Moon) for standard proposals
    B3TR_GOVERNOR_GRANT_GM_WEIGHT: 2, // Requires GM level 2 (Moon) for grant proposals

    /*
      For ambiguous functions (functions with same name), the function signature is used to differentiate them
      e.g., instead of using "setVoterRewards", we use "setVoterRewards(address)"
    */
    B3TR_GOVERNOR_WHITELISTED_METHODS: {
      Treasury: ["transferB3TR"],
      B3TRGovernor: ["upgradeToAndCall"],
    },

    INITIAL_X_ALLOCATION: BigInt("2000000000000000000000000"), // 2M B3TR
    EMISSIONS_CYCLE_DURATION: 60480, // blocks - 60480 blocks - 1 week.
    EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE: 4, // 4% decay every cycle
    EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE: 20, // 20% decay every cycle
    EMISSIONS_X_ALLOCATION_DECAY_PERIOD: 912, // every 12 cycles
    EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD: 50, // every 50 cycles
    EMISSIONS_TREASURY_PERCENTAGE: 2500, // 25% of the emissions go to the treasury
    EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE: 80,
    EMISSIONS_IS_NOT_ALIGNED: true,

    X_ALLOCATION_VOTING_QUORUM_PERCENTAGE: 40, // 40 -> Need 40% of total supply to succeed
    X_ALLOCATION_VOTING_VOTING_THRESHOLD: BigInt("1000000000000000000"), // 1 vote
    X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE: 30, // % of tokens from each round that are equally distributed to all apps
    X_ALLOCATION_POOL_APP_SHARES_MAX_CAP: 20, // max % votes an app can receive in a round

    CONTRACTS_ADMIN_ADDRESS: "0xE3D511ce183D3C53813BEA223Fe1E51BB9fF14a4",
    VOTE_2_EARN_POOL_ADDRESS: "0xE3D511ce183D3C53813BEA223Fe1E51BB9fF14a4", //temporarily pointing to CONTRACTS_ADMIN_ADDRESS, then updated in the deploy script to point to the voterReward contract

    GM_NFT_BASE_URI: "ipfs://bafybeienna2npuyliqaqsrxziu4texyginznh5ewxcvlvlqcxfyw7ef52q/metadata/", // IPFS base URI for the GM NFT
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
    TREASURY_TRANSFER_LIMIT_VET: BigInt("200000000000000000000000"), // 200,000 VET
    TREASURY_TRANSFER_LIMIT_B3TR: BigInt("200000000000000000000000"), // 200,000 B3TR
    TREASURY_TRANSFER_LIMIT_VTHO: BigInt("3000000000000000000000000"), // 3,000,000 VTHO
    TREASURY_TRANSFER_LIMIT_VOT3: BigInt("500000000000000000000000"), // 50,000 VOT3

    // VERSION 2
    VECHAIN_NODES_CONTRACT_ADDRESS: "0xb81E9C5f9644Dec9e5e3Cac86b4461A222072302", // The contract address of the VeChainNodes contract on mainnet

    XAPP_GRACE_PERIOD: 120958, // 2 weeks -> max time to be unendorsed by node before being removed from the XAlloction voting rounds
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
    VEPASSPORT_BOT_SIGNALING_THRESHOLD: 2, // Address must be signaled more than X times to be considered a bot
    VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE: 12,
    VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL: 2,
    VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE: 20,
    VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE: 20,
    VEPASSPORT_PASSPORT_MAX_ENTITIES: 5,
    VEPASSPORT_DECAY_RATE: 0,

    CREATOR_NFT_URI: "ipfs://bafybeie2onvzl3xsod5becuswpdmi63gtq7wgjqhqjecehytt7wdeg4py4/metadata/1.json", // TODO: Update this with the actual IPFS URI

    X2EARN_NODE_COOLDOWN_PERIOD: 1, // 1 round

    MULTI_SIG_SIGNERS: [
      "0xe3d511ce183d3c53813bea223fe1e51bb9ff14a4",
      "0x4e4f66f189c8708964b44eba29481fddfafa59ba",
      "0x3bdda2E9F66e8c3fE96F7152b61566B282c2781C",
    ],

    GM_PERCENTAGE_OF_TREASURY: 2500, // 25% of the treasury will be used for GM Holder Rewards

    GM_MULTIPLIERS_V2: [110, 120, 150, 200, 250, 300, 500, 1000, 2500], // GM multipiers according
    VOTER_REWARDS_LEVELS_V2: [2, 3, 4, 5, 6, 7, 8, 9, 10], // Voter rewards levels for the new GM multipliers

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

    // Stargate contracts - TODO: Update these with the actual contract addresses
    STARGATE_NFT_CONTRACT_ADDRESS: "0x1856c533ac2d94340aaa8544d35a5c1d4a21dee7",
    STARGATE_DELEGATE_CONTRACT_ADDRESS: "0x4cb1c9ef05b529c093371264fab2c93cc6cddb0e",
    NODE_MANAGEMENT_CONTRACT_ADDRESS: "0xB0EF9D89C6b49CbA6BBF86Bf2FDf0Eee4968c6AB",

    // Milestones
    MINIMUM_MILESTONE_COUNT: 3,
  })
}
