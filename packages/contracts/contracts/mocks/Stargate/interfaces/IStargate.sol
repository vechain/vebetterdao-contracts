// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IStargate {
    // ---------- Errors ------------ //

    error UnauthorizedUser(address user);
    error DelegationExitAlreadyRequested();
    error InvalidDelegationStatus(uint256 tokenId, DelegationStatus status);
    error DelegationNotFound(uint256 tokenId);
    error TokenUnderMaturityPeriod(uint256 tokenId);
    error InvalidToken(uint256 tokenId);
    error ValidatorNotActiveOrQueued(address validator);
    error TokenAlreadyDelegated(uint256 tokenId);
    error OnlyStargateNFTAndProtocolStaker();
    error InvalidInitializationParams();
    error VetAmountMismatch(uint8 levelId, uint256 required, uint256 provided);
    error VetTransferFailed(address receiver, uint256 amount);
    error InsufficientContractBalance(uint256 contractBalance, uint256 tokenAmount);
    error MaxClaimablePeriodsExceeded();
    error InvalidMaxClaimablePeriods();

    // ---------- Events ------------ //

    /// @notice Emitted when a delegation is initiated
    /// @param tokenId The ID of the token that was delegated
    /// @param validator The validator that was delegated to
    /// @param delegationId The ID of the delegation
    /// @param amount The amount of VET delegated
    /// @param levelId The level ID of the token
    /// @param probabilityMultiplier The probability multiplier of the delegation
    event DelegationInitiated(
        uint256 indexed tokenId,
        address indexed validator,
        uint256 indexed delegationId,
        uint256 amount,
        uint8 levelId,
        uint8 probabilityMultiplier
    );

    /// @notice Emitted when a delegation exit is requested
    /// @dev When the delegation is pending, exit is immediate and this event is emitted
    /// @param tokenId The ID of the token that was delegated
    /// @param validator The validator that was delegated to
    /// @param delegationId The ID of the delegation
    /// @param exitBlock The block at which the delegation exit will be processed,
    /// in case the delegation is pending it will be the current block
    event DelegationExitRequested(
        uint256 indexed tokenId,
        address indexed validator,
        uint256 indexed delegationId,
        uint48 exitBlock
    );

    /// @notice Emitted when a delegation is withdrawn
    /// @dev This is emitted when the delegation is withdrawn, either because the user requested to exit
    /// or because the delegation is called with a new validator or if requestDelegationExit is called
    /// the delegation is still pending.
    /// @param tokenId The ID of the token that was delegated
    /// @param validator The validator that was delegated to
    /// @param delegationId The ID of the delegation
    /// @param amount The amount of VET withdrawn
    /// @param levelId The level ID of the token
    event DelegationWithdrawn(
        uint256 indexed tokenId,
        address indexed validator,
        uint256 indexed delegationId,
        uint256 amount,
        uint8 levelId
    );

    /// @notice Emitted when rewards are claimed
    /// @param receiver The address that claimed the rewards
    /// @param tokenId The ID of the token that claimed the rewards
    /// @param delegationId The ID of the delegation that claimed the rewards
    /// @param amount The amount of rewards claimed
    /// @param firstClaimedPeriod The first period that the rewards were claimed for
    /// @param lastClaimedPeriod The last period that the rewards were claimed for
    event DelegationRewardsClaimed(
        address indexed receiver,
        uint256 indexed tokenId,
        uint256 indexed delegationId,
        uint256 amount,
        uint32 firstClaimedPeriod,
        uint32 lastClaimedPeriod
    );

    // ---------- Data Types ------------ //

    struct Delegation {
        uint256 delegationId; // the latest delegation id for the token (can be pending, active, or exited)
        address validator; // the validator address
        uint256 stake; // the amount of VET delegated to the validator (that is the same as the price of the NFT)
        uint8 probabilityMultiplier; // a multiplier used to multiply the stake of the user when calculating the weight of the delegation (scaled by 100)
        uint32 startPeriod; // the period when the delegation became active
        uint32 endPeriod; // the period when the delegation ended (if exited); uint32.max if still active
        bool isLocked; // the delegation is locked while active, and it means that the VET cannot be withdrawn and user needs to request to exit
        DelegationStatus status;
    }

    /// @notice The status of a delegation returned by the StargateStaker contract
    /// @dev NONE: the delegation id is not valid, or user never delegated
    /// @dev PENDING: the user has selected a validator and staked the VET, but is waiting for the next period to start or for the validator to be become active
    /// @dev ACTIVE: the user is accumulating rewards; if the user requests to exit the delegation the status remains ACTIVE
    /// @dev EXITED: the user has exited the delegation or the validator exited and forced the user to exit or the user exited a pending delegation and the stake is now 0
    enum DelegationStatus {
        NONE,
        PENDING,
        ACTIVE,
        EXITED
    }

    // ---------- Pausable ------------ //

    /// @notice Pauses the StargateNFT contract
    /// @dev Only the DEFAULT_ADMIN_ROLE can call this function
    /// @dev Pausing the contract will prevent minting
    function pause() external;

    /// @notice Unpauses the StargateNFT contract
    /// @dev Only the DEFAULT_ADMIN_ROLE can call this function
    function unpause() external;

    // ---------- Staking ------------ //

    /// @notice Stakes VET and mints an NFT
    /// @param _levelId The ID of the token level to mint, VET as msg.value
    /// @return tokenId The ID of the minted NFT
    function stake(uint8 _levelId) external payable returns (uint256 tokenId);

    /// @notice Unstakes a token from the Stargate contract, will return the VET to the user and burn the NFT
    /// for token to be unstaked, its delegation status must not be ACTIVE
    /// @param _tokenId The ID of the token to unstake
    /// @dev Emits a {IStargate.TokenUnstaked} event
    function unstake(uint256 _tokenId) external;

    // ---------- Delegations ------------ //

    /// @notice Delegates the token to the validator to increase its probability of being selected as
    /// a validator and accumulate rewards for each mined block.
    /// The amount of rewards depends on the effective stake compared to the total effective stake of the validator.
    /// The delegation is not active until the start of the next period of the validator. In the meantime, the user
    /// can change the validator by calling this function again, cancel the delegation or unstaking the token.
    /// Once the delegation is active, the user can request to exit the delegation by calling requestDelegationExit.
    /// The token will remain delegated until the end of the validator period end block.
    ///
    /// This contract will need to move the VET associated to the token from the StargateNFT contract and deposit
    /// it in the protocol staking contract.
    /// If the token was previously delegated, the VET will be moved from the protocol staking contract to this contract
    /// again and then moved back to the protocol staking contract.
    ///
    /// @param _tokenId - the token ID to delegate
    /// @param _validator - the validator to delegate to
    function delegate(uint256 _tokenId, address _validator) external;

    /// @notice Stakes VET and mints an NFT, and delegates it
    /// @param _levelId The ID of the token level to mint, VET as msg.value
    /// @param _validator The validator to delegate to
    /// @return tokenId The ID of the minted NFT
    function stakeAndDelegate(
        uint8 _levelId,
        address _validator
    ) external payable returns (uint256 tokenId);

    /// @notice Migrates a token from the legacy nodes contract to StargateNFT, and delegates it
    /// @param _tokenId The ID of the token to migrate
    /// @param _validator The validator to delegate to
    function migrateAndDelegate(uint256 _tokenId, address _validator) external payable;

    /// @notice Requests a delegation exit by signalling the exit to the protocol staking contract.
    /// If the delegation is active, the user will need to wait for then end of the period to actually exit, if instead
    /// the delegation is pending the user will exit immediatly.
    /// Once the request to exit is signalled, the user cannot undo it and cannot request to exit again.
    /// @dev Exiting a pending delegation, differs from exiting an active delegation.
    /// In the first case, it is enough to withdraw the VET from the protocol, in the second case
    /// we will signal to the protocol to exit the delegation.
    /// @param _tokenId - the token ID to request the exit for
    function requestDelegationExit(uint256 _tokenId) external;

    /// @notice Returns the details of the delegation of a token
    /// @dev If the token does not have any delegation, it will return a set of default values
    /// @param _tokenId - the token ID
    /// @return The details of the delegation
    function getDelegationDetails(uint256 _tokenId) external view returns (Delegation memory);

    /// @notice Will fetch the latest delegation of a token and will return its status
    /// @param _tokenId - the token ID
    /// @return The status of the delegation
    function getDelegationStatus(uint256 _tokenId) external view returns (DelegationStatus);

    /// @notice Will return the latest delegation id of a token (regardless of its status)
    /// @param _tokenId - the token ID
    /// @return The delegation id
    function getDelegationIdOfToken(uint256 _tokenId) external view returns (uint256);

    /// @notice Will return true if the user has requested to exit the latest delegation (regardless of its status)
    /// @dev This will return true even if the delegation is EXITED
    /// @param _tokenId - the token ID
    /// @return True if the user has requested to exit the delegation
    function hasRequestedExit(uint256 _tokenId) external view returns (bool);

    /// @notice Returns the total effective stake of the delegators of a validator in a specific period
    /// @param _validator - the validator address
    /// @param _period - the period to check
    /// @return The total effective stake of the delegators of the validator in the period
    function getDelegatorsEffectiveStake(
        address _validator,
        uint32 _period
    ) external view returns (uint256);

    /// @notice Returns the effective stake of a token
    /// @dev The effective stake is the amount of VET that is staked by the token multiplied
    /// by the reward multiplier of the level, and is used to calculate the share of the delegator in the period.
    /// @param _tokenId - the token ID
    /// @return The effective stake of the token
    function getEffectiveStake(uint256 _tokenId) external view returns (uint256);

    // ---------- Rewards ------------ //

    /// @notice Claims all the rewards for a token
    /// @dev This function will claim the rewards for each period between the last
    /// claimed period and the last claimable period.
    /// @param _tokenId - the token ID
    function claimRewards(uint256 _tokenId) external;

    /// @notice Returns the claimable rewards for a token for batch 0 (first 832 periods)
    /// @dev This is the sum of the claimable rewards for each period between the last claimed period and the last claimable period.
    /// @param _tokenId - the token ID
    /// @return The claimable rewards for the token
    function claimableRewards(uint256 _tokenId) external view returns (uint256);

    /// @notice Returns the claimable rewards for a token for a specific batch
    /// @dev This is the sum of the claimable rewards for each period between the last claimed period and the last claimable period.
    /// @param _tokenId - the token ID
    /// @param _batch - the batch to check
    /// @return The claimable rewards for the token
    function claimableRewards(uint256 _tokenId, uint32 _batch) external view returns (uint256);

    /// @notice Returns the locked rewards for a token
    /// @dev When the delegation is active, the rewards rewards of the current period are locked
    /// and cannot be claimed until the next period. This function retur
    /// @param _tokenId - the token ID
    /// @return The locked rewards for the token
    function lockedRewards(uint256 _tokenId) external view returns (uint256);

    /// @notice Returns the latestClaimedPeriod and the endPeriod of the latest delegation of a token
    /// @param _tokenId - the token ID
    /// @return lastClaimedPeriod - the latest claimed period
    /// @return endPeriod - the end period of the latest delegation
    function claimableDelegationPeriods(uint256 _tokenId) external view returns (uint32, uint32);

    // ---------- Max Claimable Periods ---------- //

    /// @notice Returns the max claimable periods
    /// @return The max claimable periods
    function getMaxClaimablePeriods() external view returns (uint32);

    /// @notice Sets the max claimable periods
    /// @param _maxClaimablePeriods - the max claimable periods
    function setMaxClaimablePeriods(uint32 _maxClaimablePeriods) external;

    // ---------- Clock ------------ //

    /// @notice Returns the current clock
    /// @dev Call CLOCK_MODE() to know if the clock is in timestamp or block mode
    function clock() external view returns (uint48);

    /// @notice Returns the clock mode
    /// @dev Call clock() to know the current clock
    function CLOCK_MODE() external view returns (string memory);
}
