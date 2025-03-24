export type ContractsConfig = {
  NEXT_PUBLIC_APP_ENV: "local" | "testnet"

  B3TR_GOVERNOR_QUORUM_PERCENTAGE: number
  TIMELOCK_MIN_DELAY: number
  B3TR_GOVERNOR_DEPOSIT_THRESHOLD: number
  B3TR_GOVERNOR_MIN_VOTING_DELAY: number
  B3TR_GOVERNOR_VOTING_THRESHOLD: bigint
  B3TR_GOVERNOR_WHITELISTED_METHODS: Record<string, string[]>

  EMISSIONS_CYCLE_DURATION: number
  EMISSIONS_X_ALLOCATION_DECAY_PERCENTAGE: number
  EMISSIONS_VOTE_2_EARN_DECAY_PERCENTAGE: number
  EMISSIONS_X_ALLOCATION_DECAY_PERIOD: number
  EMISSIONS_VOTE_2_EARN_ALLOCATION_DECAY_PERIOD: number
  EMISSIONS_TREASURY_PERCENTAGE: number
  EMISSIONS_MAX_VOTE_2_EARN_DECAY_PERCENTAGE: number
  EMISSIONS_IS_NOT_ALIGNED: boolean

  X_ALLOCATION_VOTING_QUORUM_PERCENTAGE: number
  X_ALLOCATION_VOTING_VOTING_THRESHOLD: bigint

  X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE: number
  X_ALLOCATION_POOL_APP_SHARES_MAX_CAP: number

  CONTRACTS_ADMIN_ADDRESS: string

  VOTE_2_EARN_POOL_ADDRESS: string

  INITIAL_X_ALLOCATION: bigint

  GM_NFT_BASE_URI: string
  GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL: bigint[]
  GM_NFT_NODE_TO_FREE_LEVEL: number[]
  GM_NFT_MAX_LEVEL: number

  VOTER_REWARDS_LEVELS: number[]
  VOTER_REWARDS_MULTIPLIER: number[]

  XAPP_BASE_URI: string

  TREASURY_TRANSFER_LIMIT_VET: bigint
  TREASURY_TRANSFER_LIMIT_B3TR: bigint
  TREASURY_TRANSFER_LIMIT_VTHO: bigint
  TREASURY_TRANSFER_LIMIT_VOT3: bigint

  // Migration
  MIGRATION_ADDRESS: string
  MIGRATION_AMOUNT: bigint

  // X 2 Earn Rewards Pool
  X_2_EARN_INITIAL_IMPACT_KEYS: string[]

  // Endorsement
  VECHAIN_NODES_CONTRACT_ADDRESS: string
  XAPP_GRACE_PERIOD: number

  // VeBetterPassport
  VEPASSPORT_BOT_SIGNALING_THRESHOLD: number
  VEPASSPORT_ROUNDS_FOR_CUMULATIVE_PARTICIPATION_SCORE: number
  VEPASSPORT_GALAXY_MEMBER_MINIMUM_LEVEL: number
  VEPASSPORT_BLACKLIST_THRESHOLD_PERCENTAGE: number
  VEPASSPORT_WHITELIST_THRESHOLD_PERCENTAGE: number
  VEPASSPORT_PASSPORT_MAX_ENTITIES: number
  VEPASSPORT_DECAY_RATE: number

  CREATOR_NFT_URI: string

  X2EARN_NODE_COOLDOWN_PERIOD: number
}
