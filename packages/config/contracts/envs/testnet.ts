import { defineConfig } from "../defineConfig"

export function createTestnetConfig() {
  return defineConfig({
    NEXT_PUBLIC_APP_ENV: "testnet",
    MIGRATION_ADDRESS: "0x",
    // @ts-ignore
    MIGRATION_AMOUNT: "0",
    B3TR_CAP: 3_750_000, // 3_750_000 -> 3.75 million B3TR tokens for pilot show
    B3TR_GOVERNOR_QUORUM_PERCENTAGE: 4, // 4 -> Need 4% of voters to pass
    TIMELOCK_MIN_DELAY: 30, // time to wait before you can execute a queued proposal, 0 for immediate execution
    B3TR_GOVERNOR_DEPOSIT_THRESHOLD: 2, // Percentage of total B3TR supply needed to be deposited to create a proposal
    B3TR_GOVERNOR_MIN_VOTING_DELAY: 25920, // 3 days
    B3TR_GOVERNOR_VOTING_THRESHOLD: BigInt("1000000000000000000"), // 1 vote
    /*
      For ambiguous functions (functions with same name), the function signature is used to differentiate them
      e.g., instead of using "setVoterRewards", we use "setVoterRewards(address)"
    */
    B3TR_GOVERNOR_WHITELISTED_METHODS: {
      Treasury: ["transferB3TR"],
    },
    EMISSIONS_CYCLE_DURATION: 60480, // blocks - 60480 blocks - 1 week.
    EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE: 4, // 4% decay every cycle
    EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE: 20, // 20% decay every cycle
    EMISSIONS_X_ALLOCATION_DECAY_PERIOD: 999999, // should never decay in pilot show
    EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD: 999999, // should never decay in pilot show
    EMISSIONS_TREASURY_PERCENTAGE: 8750, // 87.5% of the emissions go to the treasury during pilot show
    EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE: 80,
    X_ALLOCATION_VOTING_QUORUM_PERCENTAGE: 40, // 40 -> Need 40% of total supply to succeed
    X_ALLOCATION_VOTING_VOTING_THRESHOLD: BigInt("1000000000000000000"), // 1 vote
    X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE: 30, // % of tokens from each round that are equally distributed to all apps
    X_ALLOCATION_POOL_APP_SHARES_MAX_CAP: 20, // max % votes an app can receive in a round
    CONTRACTS_ADMIN_ADDRESS: "0xE3D511ce183D3C53813BEA223Fe1E51BB9fF14a4",
    VOTE_2_EARN_POOL_ADDRESS: "0x435933c8064b4Ae76bE665428e0307eF2cCFBD68", //temporarily pointing to trasury, then updated in the deploy script to point to the voterReward contract
    INITIAL_X_ALLOCATION: BigInt("66666666666666666666666"), // 1M/15 rounded down -> 1/15th of the total supply for pilot show
    GM_NFT_BASE_URI: "ipfs://bafybeiahr3qobzujfkxi64o6wrigkmdagrvgfa566rqqth6jm5nq7vf24y/", // IPFS base URI for the GM NFT
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
    TREASURY_TRANSFER_LIMIT_VET: BigInt("0"),
    TREASURY_TRANSFER_LIMIT_B3TR: BigInt("0"),
    TREASURY_TRANSFER_LIMIT_VTHO: BigInt("0"),
    TREASURY_TRANSFER_LIMIT_VOT3: BigInt("0"),

    // Endorsement
    VECHAIN_NODES_CONTRACT_ADDRESS: "0x0747b39abc0de3d11c8ddfe2e7eed00aaa8d475c", // The contract address of the VeChainNodes contract on testnet
    XAPP_GRACE_PERIOD: 120960, // 2 weeks -> max time to be unendorsed by node before being removed from the XAlloction voting rounds (blocks)
    // Passport
    VEPASSPORT_BOT_SIGNALING_THRESHOLD: 2, // Address must be signaled more than X times to be considered a bot
    VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE: 12,
    VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL: 2,
    VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE: 20,
    VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE: 20,
    VEPASSPORT_PASSPORT_MAX_ENTITIES: 5,
    VEPASSPORT_DECAY_RATE: 0,

    CREATOR_NFT_URI: "ipfs://bafybeie2onvzl3xsod5becuswpdmi63gtq7wgjqhqjecehytt7wdeg4py4/metadata/1.json",

    X2EARN_NODE_COOLDOWN_PERIOD: 1, // 1 round

    MULTI_SIG_SIGNERS: [],

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

    // Stargate and NFTs related contracts -> they are already deployed from stargate project
    // See from more details: {https://github.com/vechain/stargate-contracts/blob/main/README.md }
    STARGATE_NFT_CONTRACT_ADDRESS: "0x1ec1d168574603ec35b9d229843b7c2b44bcb770",
    STARGATE_DELEGATE_CONTRACT_ADDRESS: "0x7240e3bc0d26431512d5b67dbd26d199205bffe8",
    NODE_MANAGEMENT_CONTRACT_ADDRESS: "0x8bcbfc20ee39c94f4e60afc5d78c402f70b4f3b2",

    // Milestones
    MINIMUM_MILESTONE_COUNT: 2, // test-compatibility

    // XAllocationPoolV7 unallocated funds
    X_ALLOCATION_POOL_UNALLOCATED_FUNDS_ROUND_IDS: [],
    X_ALLOCATION_POOL_UNALLOCATED_FUNDS_V7: [],
    DBA_DISTRIBUTION_START_ROUND: 1,
  })
}
