// SPDX-License-Identifier: MIT

//                                      #######
//                                 ################
//                               ####################
//                             ###########   #########
//                            #########      #########
//          #######          #########       #########
//          #########       #########      ##########
//           ##########     ########     ####################
//            ##########   #########  #########################
//              ################### ############################
//               #################  ##########          ########
//                 ##############      ###              ########
//                  ############                       #########
//                    ##########                     ##########
//                     ########                    ###########
//                       ###                    ############
//                                          ##############
//                                    #################
//                                   ##############
//                                   #########

pragma solidity 0.8.20;

/**
 * @notice Enum for different types of relayer actions
 */
enum RelayerAction {
  VOTE, // Casting votes on behalf of users
  CLAIM // Claiming rewards for users
}

/**
 * @title IRelayerRewardsPool
 * @author VeBetterDAO
 * @notice Interface for the RelayerRewardsPool contract that manages rewards for relayers
 * who perform auto-voting actions on behalf of users.
 */
interface IRelayerRewardsPool {
  // =========================== Events ===========================

  /**
   * @notice Emitted when early access vote allocations are set for a round
   * @param roundId The round ID
   * @param totalAutoVoteUsers The total number of auto-voting users
   * @param totalActions The total number of actions to be allocated
   * @param totalWeightedActions The total weighted actions to be allocated
   * @param numRelayers The number of registered relayers
   */
  event TotalAutoVotingActionsSet(
    uint256 indexed roundId,
    uint256 totalAutoVoteUsers,
    uint256 totalActions,
    uint256 totalWeightedActions,
    uint256 numRelayers
  );

  /**
   * @notice Emitted when expected actions are reduced for a round
   * @param roundId The round ID
   * @param userCount The number of users removed from expected actions
   * @param newTotalActions The new total actions required
   * @param newTotalWeightedActions The new total weighted actions required
   */
  event ExpectedActionsReduced(
    uint256 indexed roundId,
    uint256 userCount,
    uint256 newTotalActions,
    uint256 newTotalWeightedActions
  );

  /**
   * @notice Emitted when a relayer action is registered
   * @param relayer The relayer address
   * @param voter The voter address
   * @param roundId The round ID
   * @param actionCount The new total action count for the relayer
   * @param weight The weight of the action
   */
  event RelayerActionRegistered(
    address indexed relayer,
    address indexed voter,
    uint256 indexed roundId,
    uint256 actionCount,
    uint256 weight
  );

  /**
   * @notice Emitted when rewards are deposited for a round
   * @param roundId The round ID
   * @param amount The amount deposited
   * @param totalRewards The new total rewards for the round
   */
  event RewardsDeposited(uint256 indexed roundId, uint256 amount, uint256 totalRewards);

  /**
   * @notice Emitted when a relayer claims rewards
   * @param relayer The relayer address
   * @param roundId The round ID
   * @param amount The amount claimed
   */
  event RelayerRewardsClaimed(address indexed relayer, uint256 indexed roundId, uint256 amount);

  /**
   * @notice Emitted when vote weight is updated
   * @param newWeight The new vote weight
   * @param oldWeight The old vote weight
   */
  event VoteWeightUpdated(uint256 newWeight, uint256 oldWeight);

  /**
   * @notice Emitted when claim weight is updated
   * @param newWeight The new claim weight
   * @param oldWeight The old claim weight
   */
  event ClaimWeightUpdated(uint256 newWeight, uint256 oldWeight);

  /**
   * @notice Emitted when relayer fee percentage is updated
   * @param newFee The new relayer fee percentage
   * @param oldFee The old relayer fee percentage
   */
  event RelayerFeePercentageUpdated(uint256 newFee, uint256 oldFee);

  /**
   * @notice Emitted when fee cap is updated
   * @param newFee The new fee cap
   * @param oldFee The old fee cap
   */
  event FeeCapUpdated(uint256 newFee, uint256 oldFee);

  /**
   * @notice Emitted when relayer fee denominator is updated
   * @param newDenominator The new relayer fee denominator
   * @param oldDenominator The old relayer fee denominator
   */
  event RelayerFeeDenominatorUpdated(uint256 newDenominator, uint256 oldDenominator);

  /**
   * @notice Emitted when a relayer is registered
   * @param relayer The address of the registered relayer
   */
  event RelayerRegistered(address indexed relayer);

  /**
   * @notice Emitted when a relayer is unregistered
   * @param relayer The address of the unregistered relayer
   */
  event RelayerUnregistered(address indexed relayer);

  /**
   * @notice Emitted when early access blocks are updated
   * @param newBlocks The new number of early access blocks
   * @param oldBlocks The old number of early access blocks
   */
  event EarlyAccessBlocksUpdated(uint256 newBlocks, uint256 oldBlocks);

  /**
   * @notice Emitted when the B3TR contract address is updated
   * @param newAddress The new B3TR contract address
   * @param oldAddress The old B3TR contract address
   */
  event B3TRAddressUpdated(address indexed newAddress, address indexed oldAddress);

  /**
   * @notice Emitted when the Emissions contract address is updated
   * @param newAddress The new Emissions contract address
   * @param oldAddress The old Emissions contract address
   */
  event EmissionsAddressUpdated(address indexed newAddress, address indexed oldAddress);

  /**
   * @notice Emitted when the XAllocationVoting contract address is updated
   * @param newAddress The new XAllocationVoting contract address
   * @param oldAddress The old XAllocationVoting contract address
   */
  event XAllocationVotingAddressUpdated(address indexed newAddress, address indexed oldAddress);

  // =========================== Custom Errors ===========================

  /// @notice Custom error for when relayer is already registered
  error RelayerAlreadyRegistered(address relayer);

  /// @notice Custom error for when relayer is not registered
  error RelayerNotRegistered(address relayer);

  /// @notice Custom error for when a round has not ended yet
  error RoundNotEnded(uint256 roundId);

  /// @notice Custom error for when trying to claim rewards twice
  error RewardsAlreadyClaimed(address relayer, uint256 roundId);

  /// @notice Custom error for when there are no rewards to claim
  error NoRewardsToClaim(address relayer, uint256 roundId);

  /// @notice Custom error for when transfer fails
  error TransferFailed();

  /// @notice Custom error for invalid parameters
  error InvalidParameter(string parameter);

  // =========================== Getters ===========================

  /**
   * @notice Returns the total rewards available for distribution among relayers in a round
   * @param roundId The round ID to check
   * @return The total reward amount for the round
   */
  function getTotalRewards(uint256 roundId) external view returns (uint256);

  /**
   * @notice Checks if rewards are claimable for a specific round
   * @param roundId The round ID to check
   * @return True if rewards are claimable, false otherwise
   */
  function isRewardClaimable(uint256 roundId) external view returns (bool);

  /**
   * @notice Returns the number of actions performed by a relayer in a specific round
   * @param relayer The relayer address
   * @param roundId The round ID
   * @return The number of actions performed by the relayer
   */
  function totalRelayerActions(address relayer, uint256 roundId) external view returns (uint256);

  /**
   * @notice Returns the total number of actions required for a round
   * @dev There are 2 actions for auto-voting: cast vote on behalf and claim rewards for them
   * So, each user who enables auto-voting requires 2 actions
   * @param roundId The round ID
   * @return The total number of actions required for the round
   */
  function totalActions(uint256 roundId) external view returns (uint256);

  /**
   * @notice Get the current relayer fee denominator
   * @return The current relayer fee denominator
   */
  function getRelayerFeeDenominator() external view returns (uint256);

  /**
   * @notice Get the current relayer fee percentage
   * @return The current relayer fee percentage
   */
  function getRelayerFeePercentage() external view returns (uint256);

  /**
   * @notice Get the current fee cap
   * @return The current fee cap
   */
  function getFeeCap() external view returns (uint256);

  /**
   * @notice Get the current vote weight
   * @return The current vote weight
   */
  function getVoteWeight() external view returns (uint256);

  /**
   * @notice Get the current claim weight
   * @return The current claim weight
   */
  function getClaimWeight() external view returns (uint256);

  /**
   * @notice Returns the total weighted actions performed by a relayer in a specific round
   * @param relayer The relayer address
   * @param roundId The round ID
   * @return The total weighted actions performed by the relayer
   */
  function totalRelayerWeightedActions(address relayer, uint256 roundId) external view returns (uint256);

  /**
   * @notice Returns the total weighted actions required for a round
   * @param roundId The round ID
   * @return The total weighted actions required for the round
   */
  function totalWeightedActions(uint256 roundId) external view returns (uint256);

  /**
   * @notice Returns the total completed weighted actions for a round
   * @param roundId The round ID
   * @return The total completed weighted actions for the round
   */
  function completedWeightedActions(uint256 roundId) external view returns (uint256);

  /**
   * @notice Check if an address is a registered relayer
   * @param relayer The address to check
   * @return True if the address is a registered relayer
   */
  function isRegisteredRelayer(address relayer) external view returns (bool);

  /**
   * @notice Get all registered relayers
   * @return Array of registered relayer addresses
   */
  function getRegisteredRelayers() external view returns (address[] memory);

  /**
   * @notice Returns the claimable reward amount for a relayer in a specific round
   * @param relayer The relayer address
   * @param roundId The round ID
   * @return The claimable reward amount
   */
  function claimableRewards(address relayer, uint256 roundId) external view returns (uint256);

  /**
   * @notice Get the number of early access blocks
   * @return The number of blocks for early access period
   */
  function getEarlyAccessBlocks() external view returns (uint256);

  /**
   * @notice Check if early access period is active for a given round
   * @param roundId The round ID
   * @return True if early access period is still active
   */
  function isVoteEarlyAccessActive(uint256 roundId) external view returns (bool);

  /**
   * @notice Check if claim early access period is active for a given round
   * @param roundId The round ID
   * @return True if claim early access period is still active
   */
  function isClaimEarlyAccessActive(uint256 roundId) external view returns (bool);

  /**
   * @notice Calculate relayer fee from total reward
   * @param totalReward Total reward amount in wei
   * @return Relayer fee in wei
   */
  function calculateRelayerFee(uint256 totalReward) external view returns (uint256);

  /**
   * @notice Get the number of missed auto-voting users for a round
   * @param roundId The round ID
   * @return The number of missed auto-voting users
   */
  function getMissedAutoVotingUsersCount(uint256 roundId) external view returns (uint256);

  // =========================== Setters ===========================

  /**
   * @notice Sets the total number of actions required for a round
   * @param roundId The round ID
   * @param totalAutoVotingUsers The total number of auto-voting users
   */
  function setTotalActionsForRound(uint256 roundId, uint256 totalAutoVotingUsers) external;

  /**
   * @notice Set the fee cap for the relayer.
   * @param newFeeCap The new fee cap
   */
  function setFeeCap(uint256 newFeeCap) external;

  /**
   * @notice Reduces the total expected actions for a round when an auto-voting user cannot vote
   * @dev This should be called when a user has auto-voting enabled but no eligible apps to vote for
   * @param roundId The round ID
   * @param userCount The number of users to remove from expected actions (typically 1)
   */
  function reduceExpectedActionsForRound(uint256 roundId, uint256 userCount) external;

  /**
   * @notice Registers an action performed by a relayer in a specific round
   * @param relayer The relayer address
   * @param voter The voter address
   * @param roundId The round ID
   * @param action The type of action performed (VOTE or CLAIM)
   */
  function registerRelayerAction(address relayer, address voter, uint256 roundId, RelayerAction action) external;

  /**
   * @notice Allows a relayer to claim their rewards for a specific round
   * @param relayer The relayer address
   * @param roundId The round ID
   */
  function claimRewards(uint256 roundId, address relayer) external;

  /**
   * @notice Deposits B3TR tokens into the pool for a specific round
   * @dev This function should be called by the VoterRewards contract
   * @param amount The amount of B3TR tokens to deposit
   * @param roundId The round ID to deposit for
   */
  function deposit(uint256 amount, uint256 roundId) external;

  /**
   * @notice Check if a relayer can perform an action during early access
   * @param roundId The round ID
   * @param voter The voter address
   * @param caller The caller address
   */
  function validateVoteDuringEarlyAccess(uint256 roundId, address voter, address caller) external view;

  /**
   * @notice Validates if a claim can proceed for an auto-voting user
   * @param roundId The round ID
   * @param voter The voter address
   * @param caller The caller address
   */
  function validateClaimDuringEarlyAccess(uint256 roundId, address voter, address caller) external view;
}
