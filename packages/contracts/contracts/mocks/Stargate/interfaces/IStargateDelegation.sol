// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IStargateDelegation {
    /*------- Errors -------*/
    /// @notice Error thrown when a user is not authorized to perform an action
    error UnauthorizedUser(address user);
    /// @notice Error thrown when an NFT is under the maturity period
    error NFTUnderMaturityPeriod(uint256 tokenId);
    /// @notice Error thrown when an NFT is already delegated
    error NFTAlreadyDelegated(uint256 tokenId);
    /// @notice Error thrown when an NFT is not delegated
    error NFTNotDelegated(uint256 tokenId);
    /// @notice Error thrown when there are no rewards to claim
    error NoRewardsToClaim(uint256 tokenId);
    /// @notice Error thrown when an address is the zero address
    error AddressCannotBeZero();
    /// @notice Error thrown when a vtho reward per block per NFT level is invalid
    error InvalidVthoRewardPerBlock(uint256 level, uint256 value);
    /// @notice Error thrown when a delegation period is invalid
    error InvalidDelegationPeriod();
    /// @notice Error thrown when an array is empty
    error ArrayCannotBeEmpty();
    /// @notice Error thrown when an NFT level is invalid
    error InvalidNFTLevel(uint256 tokenId, uint256 level);
    /// @notice Error thrown when there is insufficient VTHO balance for rewards claim
    error InsufficientVthoBalanceForRewardsClaim(uint256 balance, uint256 required);
    /// @notice Error thrown when a VTHO transfer fails
    error VthoTransferFailed(address recipient, uint256 amount);
    /// @notice Error thrown when the rewards accumulation period ended
    error RewardsAccumulationPeriodEnded();
    /// @notice Error thrown when the user requests to exit delegation repeatedly
    error DelegationExitAlreadyRequested();

    /*------- Events -------*/
    /// @notice Event emitted when a delegation simulation is started
    event DelegationSimulationStarted(
        uint256 indexed tokenId,
        address indexed delegator,
        uint256 rewardsAccumulationStartBlock,
        bool indexed isDelegationForever,
        address caller
    );
    /// @notice Event emitted when a delegation exit is requested
    event DelegationExitRequested(uint256 indexed tokenId, uint256 delegationEndBlock);
    /// @notice Event emitted when a delegation rewards are claimed
    event DelegationRewardsClaimed(
        uint256 indexed tokenId,
        uint256 rewards,
        address indexed claimer,
        address indexed recipient
    );
    /// @notice Event emitted when the rewards accumulation end block is set
    event RewardsAccumulationEndBlockSet(uint256 rewardsAccumulationEndBlock);

    /*------- Functions -------*/

    function version() external view returns (uint256);

    function clock() external view returns (uint48);

    function CLOCK_MODE() external view returns (string memory);

    function delegate(uint256 _tokenId, bool _delegateForever) external;

    function requestDelegationExit(uint256 _tokenId) external;

    function claimRewards(uint256 _tokenId) external;

    function claimableRewards(uint256 _tokenId) external view returns (uint256);

    function accumulatedRewards(uint256 _tokenId) external view returns (uint256);

    function isDelegationActive(uint256 _tokenId) external view returns (bool);

    function getVthoRewardPerBlock(uint256 _level) external view returns (uint256);

    function getDelegationPeriod() external view returns (uint256);

    function getRewardsAccumulationEndBlock() external view returns (uint256);

    function getRewardsAccumulationStartBlock(uint256 _tokenId) external view returns (uint256);

    function getDelegationEndBlock(uint256 _tokenId) external view returns (uint256);

    function currentDelegationPeriodEndBlock(uint256 _tokenId) external view returns (uint256);

    function getDelegationDetails(
        uint256 _tokenId
    )
        external
        view
        returns (
            bool isDelegationActive,
            uint256 claimableRewards,
            uint256 rewardsAccumulationStartBlock,
            uint256 delegationEndBlock
        );
}
