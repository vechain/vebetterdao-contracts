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
enum RelayerActionV1 {
  VOTE, // Casting votes on behalf of users
  CLAIM // Claiming rewards for users
}

/**
 * @title IRelayerRewardsPoolV1
 * @author VeBetterDAO
 * @notice Interface for the RelayerRewardsPool contract that manages rewards for relayers
 * who perform auto-voting actions on behalf of users.
 */
interface IRelayerRewardsPoolV1 {
  // =========================== Events ===========================

  event TotalAutoVotingActionsSet(
    uint256 indexed roundId,
    uint256 totalAutoVoteUsers,
    uint256 totalActions,
    uint256 totalWeightedActions,
    uint256 numRelayers
  );

  event ExpectedActionsReduced(
    uint256 indexed roundId,
    uint256 userCount,
    uint256 newTotalActions,
    uint256 newTotalWeightedActions
  );

  event RelayerActionRegistered(
    address indexed relayer,
    address indexed voter,
    uint256 indexed roundId,
    uint256 actionCount,
    uint256 weight
  );

  event RewardsDeposited(uint256 indexed roundId, uint256 amount, uint256 totalRewards);

  event RelayerRewardsClaimed(address indexed relayer, uint256 indexed roundId, uint256 amount);

  event VoteWeightUpdated(uint256 newWeight, uint256 oldWeight);

  event ClaimWeightUpdated(uint256 newWeight, uint256 oldWeight);

  event RelayerFeePercentageUpdated(uint256 newFee, uint256 oldFee);

  event FeeCapUpdated(uint256 newFee, uint256 oldFee);

  event RelayerFeeDenominatorUpdated(uint256 newDenominator, uint256 oldDenominator);

  event RelayerRegistered(address indexed relayer);

  event RelayerUnregistered(address indexed relayer);

  event EarlyAccessBlocksUpdated(uint256 newBlocks, uint256 oldBlocks);

  event B3TRAddressUpdated(address indexed newAddress, address indexed oldAddress);

  event EmissionsAddressUpdated(address indexed newAddress, address indexed oldAddress);

  event XAllocationVotingAddressUpdated(address indexed newAddress, address indexed oldAddress);

  // =========================== Custom Errors ===========================

  error RelayerAlreadyRegistered(address relayer);

  error RelayerNotRegistered(address relayer);

  error UnauthorizedUnregister(address caller, address relayer);

  error RoundNotEnded(uint256 roundId);

  error RewardsAlreadyClaimed(address relayer, uint256 roundId);

  error NoRewardsToClaim(address relayer, uint256 roundId);

  error TransferFailed();

  error InvalidParameter(string parameter);

  // =========================== Getters ===========================

  function getTotalRewards(uint256 roundId) external view returns (uint256);

  function isRewardClaimable(uint256 roundId) external view returns (bool);

  function totalRelayerActions(address relayer, uint256 roundId) external view returns (uint256);

  function totalActions(uint256 roundId) external view returns (uint256);

  function getRelayerFeeDenominator() external view returns (uint256);

  function getRelayerFeePercentage() external view returns (uint256);

  function getFeeCap() external view returns (uint256);

  function getVoteWeight() external view returns (uint256);

  function getClaimWeight() external view returns (uint256);

  function totalRelayerWeightedActions(address relayer, uint256 roundId) external view returns (uint256);

  function totalWeightedActions(uint256 roundId) external view returns (uint256);

  function completedWeightedActions(uint256 roundId) external view returns (uint256);

  function isRegisteredRelayer(address relayer) external view returns (bool);

  function getRegisteredRelayers() external view returns (address[] memory);

  function claimableRewards(address relayer, uint256 roundId) external view returns (uint256);

  function getEarlyAccessBlocks() external view returns (uint256);

  function isVoteEarlyAccessActive(uint256 roundId) external view returns (bool);

  function isClaimEarlyAccessActive(uint256 roundId) external view returns (bool);

  function calculateRelayerFee(uint256 totalReward) external view returns (uint256);

  function getMissedAutoVotingUsersCount(uint256 roundId) external view returns (uint256);

  // =========================== Setters ===========================

  function setTotalActionsForRound(uint256 roundId, uint256 totalAutoVotingUsers) external;

  function setFeeCap(uint256 newFeeCap) external;

  function reduceExpectedActionsForRound(uint256 roundId, uint256 userCount) external;

  function registerRelayerAction(address relayer, address voter, uint256 roundId, RelayerActionV1 action) external;

  function claimRewards(uint256 roundId, address relayer) external;

  function deposit(uint256 amount, uint256 roundId) external;

  function validateVoteDuringEarlyAccess(uint256 roundId, address voter, address caller) external view;

  function validateClaimDuringEarlyAccess(uint256 roundId, address voter, address caller) external view;
}
