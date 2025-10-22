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

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IB3TR.sol";
import "./interfaces/IRelayerRewardsPool.sol";
import "./interfaces/IEmissions.sol";
import "./interfaces/IXAllocationVotingGovernor.sol";

/**
 * @title RelayerRewardsPool
 * @author VeBetterDAO
 * @notice This contract manages rewards for relayers who perform auto-voting actions on behalf of users.
 *
 * @dev The contract is:
 * - upgradeable using UUPSUpgradeable
 * - using AccessControl to handle admin and relayer roles
 * - using ReentrancyGuard to prevent reentrancy attacks
 * - following the ERC-7201 standard for storage layout
 *
 * Roles:
 * - DEFAULT_ADMIN_ROLE: Super admin role for critical operations (contract upgrades, role management)
 * - UPGRADER_ROLE: Can upgrade the contract
 * - POOL_ADMIN_ROLE: For pool administration functions (manage relayers, weights, settings)
 */
contract RelayerRewardsPool is
  AccessControlUpgradeable,
  ReentrancyGuardUpgradeable,
  UUPSUpgradeable,
  IRelayerRewardsPool
{
  /// @notice The role that can upgrade the contract
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

  /// @notice The role for pool administration functions
  bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");

  /// @custom:storage-location erc7201:b3tr.storage.RelayerRewardsPool
  struct RelayerRewardsPoolStorage {
    IB3TR b3tr;
    IEmissions emissions;
    IXAllocationVotingGovernor xAllocationVoting;
    // roundId => total rewards available for the round
    mapping(uint256 => uint256) totalRewards;
    // roundId => relayer => number of actions performed
    mapping(uint256 => mapping(address => uint256)) relayerActions;
    // roundId => relayer => weighted actions performed
    mapping(uint256 => mapping(address => uint256)) relayerWeightedActions;
    // roundId => total actions required for the round
    mapping(uint256 => uint256) totalActions;
    // roundId => total weighted actions required for the round
    mapping(uint256 => uint256) totalWeightedActions;
    // roundId => relayer => has claimed rewards
    mapping(uint256 => mapping(address => bool)) claimed;
    // roundId => total actions completed
    mapping(uint256 => uint256) completedActions;
    // roundId => total weighted actions completed
    mapping(uint256 => uint256) completedWeightedActions;
    // configurable weights for different action types
    uint256 voteWeight;
    uint256 claimWeight;
    // registered relayers set
    mapping(address => bool) registeredRelayers;
    // array to track all registered relayers
    address[] relayerAddresses;
    // number of blocks for exclusive early access
    uint256 earlyAccessBlocks;
    // relayer fee as whole percent (10 = 10%)
    uint256 relayerFeePercentage;
    // relayer fee denominator
    uint256 relayerFeeDenominator;
    // maximum fee in token wei (use `100 ether` for 100 tokens)
    uint256 feeCap;
  }

  // keccak256(abi.encode(uint256(keccak256("b3tr.storage.RelayerRewardsPool")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant RelayerRewardsPoolStorageLocation =
    0x33676f94b2c7694b38dc9f1f29c59bfbb522294615c1bff34717ad1fa8926000;

  /// @notice Get the RelayerRewardsPoolStorage struct from the specified storage slot
  function _getRelayerRewardsPoolStorage() internal pure returns (RelayerRewardsPoolStorage storage $) {
    assembly {
      $.slot := RelayerRewardsPoolStorageLocation
    }
  }

  /// @notice Modifier to check if the caller has either the default admin or pool admin role
  modifier onlyRoleOrAdmin(bytes32 role) {
    require(
      hasRole(role, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
      "RelayerRewardsPool: caller must have admin or pool admin role"
    );
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /**
   * @notice Initialize the contract
   * @param admin The admin address
   * @param upgrader The upgrader address
   * @param b3trAddress The B3TR contract address
   * @param emissionsAddress The Emissions contract address
   * @param xAllocationVotingAddress The XAllocationVoting contract address
   */
  function initialize(
    address admin,
    address upgrader,
    address b3trAddress,
    address emissionsAddress,
    address xAllocationVotingAddress
  ) public initializer {
    require(admin != address(0), "RelayerRewardsPool: admin cannot be zero address");
    require(upgrader != address(0), "RelayerRewardsPool: upgrader cannot be zero address");
    require(b3trAddress != address(0), "RelayerRewardsPool: b3tr cannot be zero address");
    require(emissionsAddress != address(0), "RelayerRewardsPool: emissions cannot be zero address");
    require(xAllocationVotingAddress != address(0), "RelayerRewardsPool: xAllocationVoting cannot be zero address");

    __AccessControl_init();
    __ReentrancyGuard_init();
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(UPGRADER_ROLE, upgrader);
    _grantRole(POOL_ADMIN_ROLE, admin); // Grant pool admin role to the initial admin

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    $.b3tr = IB3TR(b3trAddress);
    $.emissions = IEmissions(emissionsAddress);
    $.xAllocationVoting = IXAllocationVotingGovernor(xAllocationVotingAddress);

    // Initialize default weights
    $.voteWeight = 3; // Higher weight for vote actions (more gas intensive)
    $.claimWeight = 1; // Base weight for claim actions

    // Set relayer fee to 10% using fraction representation
    // Fee calculation: relayerFeePercentage / relayerFeeDenominator = 10/100 = 10%
    $.relayerFeePercentage = 10;
    $.relayerFeeDenominator = 100;

    // Initialize default fee cap 100 B3TR
    $.feeCap = 100 ether;

    // Initialize default early access period (e.g., 1 block ~= 10 seconds on VeChain)
    $.earlyAccessBlocks = 432000; // 120 hours = 5 days
  }

  /**
   * @notice Authorizes upgrade to a new implementation
   * @param newImplementation The address of the new implementation
   */
  function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

  // ----------------------- Getters -----------------------

  /**
   * @notice Get the current relayer fee denominator
   * @return The current relayer fee denominator
   */
  function getRelayerFeeDenominator() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.relayerFeeDenominator;
  }

  /**
   * @notice Get the current relayer fee percentage
   * @return The current relayer fee percentage
   */
  function getRelayerFeePercentage() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.relayerFeePercentage;
  }

  /**
   * @notice Get the current fee cap
   * @return The current fee cap
   */
  function getFeeCap() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.feeCap;
  }

  /**
   * @notice Get the current vote weight
   * @return The current vote weight
   */
  function getVoteWeight() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.voteWeight;
  }

  /**
   * @notice Get the current claim weight
   * @return The current claim weight
   */
  function getClaimWeight() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.claimWeight;
  }

  /**
   * @notice Returns the total rewards available for distribution among relayers in a round
   * @param roundId The round ID to check
   * @return The total reward amount for the round
   */
  function getTotalRewards(uint256 roundId) external view override returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.totalRewards[roundId];
  }

  /**
   * @notice Checks if rewards are claimable for a specific round
   * @param roundId The round ID to check
   * @return True if rewards are claimable, false otherwise
   */
  function isRewardClaimable(uint256 roundId) external view override returns (bool) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    // Check if the round has ended
    try $.emissions.isCycleEnded(roundId) returns (bool ended) {
      if (!ended) return false;
    } catch {
      return false;
    }

    uint256 roundTotalWeightedActions = $.totalWeightedActions[roundId];
    uint256 roundCompletedWeightedActions = $.completedWeightedActions[roundId];

    return roundCompletedWeightedActions >= roundTotalWeightedActions;
  }

  /**
   * @notice Returns the number of actions performed by a relayer in a specific round
   * @param relayer The relayer address
   * @param roundId The round ID
   * @return The number of actions performed by the relayer
   */
  function totalRelayerActions(address relayer, uint256 roundId) external view override returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.relayerActions[roundId][relayer];
  }

  /**
   * @notice Returns the total number of actions required for a round
   * @param roundId The round ID
   * @return The total number of actions required for the round
   */
  function totalActions(uint256 roundId) external view override returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.totalActions[roundId];
  }

  /**
   * @notice Returns the claimable reward amount for a relayer in a specific round
   * @param relayer The relayer address
   * @param roundId The round ID
   * @return The claimable reward amount
   */
  function claimableRewards(address relayer, uint256 roundId) external view override returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    // Check if rewards are claimable for this round
    if (!this.isRewardClaimable(roundId)) {
      return 0;
    }

    // Check if already claimed
    if ($.claimed[roundId][relayer]) {
      return 0;
    }

    uint256 relayerWeightedActions = $.relayerWeightedActions[roundId][relayer];
    uint256 roundTotalWeightedActions = $.totalWeightedActions[roundId];
    uint256 totalRewards = $.totalRewards[roundId];

    if (relayerWeightedActions == 0 || roundTotalWeightedActions == 0) {
      return 0;
    }

    // Calculate proportional reward based on weighted actions performed
    return (totalRewards * relayerWeightedActions) / roundTotalWeightedActions;
  }

  /**
   * @notice Check if an address is a registered relayer
   * @param relayer The address to check
   * @return True if the address is a registered relayer
   */
  function isRegisteredRelayer(address relayer) external view returns (bool) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.registeredRelayers[relayer];
  }

  /**
   * @notice Get all registered relayers
   * @return Array of registered relayer addresses
   */
  function getRegisteredRelayers() external view returns (address[] memory) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.relayerAddresses;
  }

  /**
   * @notice Get the number of early access blocks
   * @return The number of blocks for early access period
   */
  function getEarlyAccessBlocks() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.earlyAccessBlocks;
  }

  /**
   * @notice Check if early access period is active for a given round
   * @param roundId The round ID
   * @return True if early access period is still active
   */
  function isVoteEarlyAccessActive(uint256 roundId) public view returns (bool) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 roundStartBlock = $.xAllocationVoting.roundSnapshot(roundId);
    return block.number < roundStartBlock + $.earlyAccessBlocks;
  }

  /**
   * @notice Check if claim early access period is active for a given round
   * @param roundId The round ID
   * @return True if claim early access period is still active
   */
  function isClaimEarlyAccessActive(uint256 roundId) public view returns (bool) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 roundEndBlock = $.xAllocationVoting.roundDeadline(roundId);
    return block.number < roundEndBlock + $.earlyAccessBlocks;
  }

  /**
   * @notice Returns the total weighted actions performed by a relayer in a specific round
   * @param relayer The relayer address
   * @param roundId The round ID
   * @return The total weighted actions performed by the relayer
   */
  function totalRelayerWeightedActions(address relayer, uint256 roundId) external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.relayerWeightedActions[roundId][relayer];
  }

  /**
   * @notice Returns the total weighted actions required for a round
   * @param roundId The round ID
   * @return The total weighted actions required for the round
   */
  function totalWeightedActions(uint256 roundId) external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.totalWeightedActions[roundId];
  }

  /**
   * @notice Returns the total completed weighted actions for a round
   * @param roundId The round ID
   * @return The total completed weighted actions for the round
   */
  function completedWeightedActions(uint256 roundId) external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.completedWeightedActions[roundId];
  }

  /**
   * @notice Calculates the number of auto-voting users who were completely missed (no vote cast)
   * @dev Only counts users where BOTH vote AND claim actions were missed
   * @dev Partial completions (vote done but claim missing) are NOT counted as missed users
   * @param roundId The round ID to check
   * @return The number of auto-voting users who were completely missed
   */
  function getMissedAutoVotingUsersCount(uint256 roundId) external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    uint256 expected = $.totalWeightedActions[roundId];
    uint256 completed = $.completedWeightedActions[roundId];

    // If all actions completed or over-completed, no missed users
    if (completed >= expected) return 0;

    uint256 deficit = expected - completed;

    // Convert weighted deficit back to user count
    // Each user requires: voteWeight (for voting) + claimWeight (for claiming)
    uint256 weightPerUser = $.voteWeight + $.claimWeight;

    // Only count FULL users missed (both vote AND claim)
    // Integer division automatically floors, so partial users are not counted
    uint256 missedUsers = deficit / weightPerUser;

    return missedUsers;
  }

  /**
   * @notice Validates if an action can proceed for an auto-voting user
   * @param roundId The round ID
   * @param voter The voter whose action is being performed
   * @param caller The address attempting to perform the action
   * @dev Reverts if action is not allowed during early access period
   */
  function validateVoteDuringEarlyAccess(uint256 roundId, address voter, address caller) external view {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    // Check if early access period is still active
    if (!isVoteEarlyAccessActive(roundId)) {
      // After early access, anyone can perform actions
      return;
    }

    // During early access period, user cannot perform actions for themselves
    require(
      caller != voter,
      "RelayerRewardsPool: auto-voting users cannot vote for themselves during early access period"
    );

    // Only registered relayers can perform actions during early access
    require(
      $.registeredRelayers[caller],
      "RelayerRewardsPool: caller is not a registered relayer during early access period"
    );
  }

  /**
   * @notice Validates if a claim can proceed for an auto-voting user
   * @param roundId The round ID
   * @param voter The voter whose action is being performed
   * @param caller The address attempting to perform the action
   * @dev Reverts if action is not allowed during early access period
   */
  function validateClaimDuringEarlyAccess(uint256 roundId, address voter, address caller) external view {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if (!isClaimEarlyAccessActive(roundId)) {
      // After early access period, anyone can claim
      return;
    }

    // During early access period, user cannot claim for themselves
    require(
      caller != voter,
      "RelayerRewardsPool: auto-voting users cannot claim for themselves during early access period"
    );

    // Only registered relayers can claim during early access
    require(
      $.registeredRelayers[caller],
      "RelayerRewardsPool: caller is not a registered relayer during claim early access period"
    );
  }

  /**
   * @notice Get the B3TR contract address
   * @return The B3TR contract address
   */
  function getB3trAddress() external view returns (address) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return address($.b3tr);
  }

  /**
   * @notice Get the Emissions contract address
   * @return The Emissions contract address
   */
  function getEmissionsAddress() external view returns (address) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return address($.emissions);
  }

  /**
   * @notice Get the XAllocationVoting contract address
   * @return The XAllocationVoting contract address
   */
  function getXAllocationVotingAddress() external view returns (address) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return address($.xAllocationVoting);
  }

  // ----------------------- Actions -----------------------

  /**
   * @notice Set the B3TR contract address
   * @param b3trAddress The B3TR contract address
   */
  function setB3TRAddress(address b3trAddress) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (b3trAddress == address(0)) revert InvalidParameter("b3trAddress");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    address oldAddress = address($.b3tr);
    $.b3tr = IB3TR(b3trAddress);

    emit B3TRAddressUpdated(b3trAddress, oldAddress);
  }

  /**
   * @notice Set the Emissions contract address
   * @param emissionsAddress The Emissions contract address
   */
  function setEmissionsAddress(address emissionsAddress) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (emissionsAddress == address(0)) revert InvalidParameter("emissionsAddress");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    address oldAddress = address($.emissions);
    $.emissions = IEmissions(emissionsAddress);

    emit EmissionsAddressUpdated(emissionsAddress, oldAddress);
  }

  /**
   * @notice Set the XAllocationVoting contract address
   * @param xAllocationVotingAddress The XAllocationVoting contract address
   */
  function setXAllocationVotingAddress(address xAllocationVotingAddress) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (xAllocationVotingAddress == address(0)) revert InvalidParameter("xAllocationVotingAddress");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    address oldAddress = address($.xAllocationVoting);
    $.xAllocationVoting = IXAllocationVotingGovernor(xAllocationVotingAddress);

    emit XAllocationVotingAddressUpdated(xAllocationVotingAddress, oldAddress);
  }

  /**
   * @notice Set the relayer fee denominator
   * @param newDenominator The new relayer fee denominator
   */
  function setRelayerFeeDenominator(uint256 newDenominator) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    require(newDenominator > 0, "RelayerRewardsPool: Denominator must be > 0");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldDenominator = $.relayerFeeDenominator;
    $.relayerFeeDenominator = newDenominator;

    emit RelayerFeeDenominatorUpdated(newDenominator, oldDenominator);
  }

  /// @notice Set the relayer fee percentage
  /// @param newFeePercentage - The new relayer fee percentage
  /// @dev Unit: whole percent where 1 == 1%
  function setRelayerFeePercentage(uint256 newFeePercentage) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    require(newFeePercentage > 0 && newFeePercentage <= 50, "RelayerRewardsPool: Fee must be > 0 and <= 50%");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldFeePercentage = $.relayerFeePercentage;
    $.relayerFeePercentage = newFeePercentage;

    emit RelayerFeePercentageUpdated(newFeePercentage, oldFeePercentage);
  }

  /// @notice Set the fee cap for the relayer.
  /// @param newFeeCap The new fee cap
  function setFeeCap(uint256 newFeeCap) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    require(newFeeCap > 0, "RelayerRewardsPool: Fee must be > 0");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldFeeCap = $.feeCap;
    $.feeCap = newFeeCap;

    emit FeeCapUpdated(newFeeCap, oldFeeCap);
  }

  /**
   * @notice Set the vote weight
   * @param newWeight The new vote weight
   */
  function setVoteWeight(uint256 newWeight) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (newWeight == 0) revert InvalidParameter("voteWeight");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldWeight = $.voteWeight;
    $.voteWeight = newWeight;

    emit VoteWeightUpdated(newWeight, oldWeight);
  }

  /**
   * @notice Set the claim weight
   * @param newWeight The new claim weight
   */
  function setClaimWeight(uint256 newWeight) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (newWeight == 0) revert InvalidParameter("claimWeight");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldWeight = $.claimWeight;
    $.claimWeight = newWeight;

    emit ClaimWeightUpdated(newWeight, oldWeight);
  }

  /**
   * @notice Allows a relayer to claim their rewards for a specific round
   * @param relayer The relayer address
   * @param roundId The round ID
   */
  function claimRewards(uint256 roundId, address relayer) external override nonReentrant {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    // Check if the round has ended
    if (!$.emissions.isCycleEnded(roundId)) {
      revert RoundNotEnded(roundId);
    }

    // Check if already claimed
    if ($.claimed[roundId][relayer]) {
      revert RewardsAlreadyClaimed(relayer, roundId);
    }

    // Calculate claimable rewards
    uint256 claimableAmount = this.claimableRewards(relayer, roundId);
    if (claimableAmount == 0) {
      revert NoRewardsToClaim(relayer, roundId);
    }

    // Mark as claimed
    $.claimed[roundId][relayer] = true;

    // Transfer rewards
    if (!$.b3tr.transfer(relayer, claimableAmount)) {
      revert TransferFailed();
    }

    emit RelayerRewardsClaimed(relayer, roundId, claimableAmount);
  }

  /**
   * @notice Registers an action performed by a relayer in a specific round
   * @param relayer The relayer address
   * @param voter The voter address
   * @param roundId The round ID
   * @param action The type of action performed (VOTE or CLAIM)
   */
  function registerRelayerAction(
    address relayer,
    address voter,
    uint256 roundId,
    RelayerAction action
  ) external override onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (relayer == address(0)) revert InvalidParameter("relayer");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    // Get weight based on action type
    uint256 weight = action == RelayerAction.VOTE ? $.voteWeight : $.claimWeight;

    // Update action counts
    $.relayerActions[roundId][relayer]++;
    $.completedActions[roundId]++;

    // Update weighted actions
    $.relayerWeightedActions[roundId][relayer] += weight;
    $.completedWeightedActions[roundId] += weight;

    emit RelayerActionRegistered(relayer, voter, roundId, $.relayerActions[roundId][relayer], weight);
  }

  /**
   * @notice Sets the total number of actions required for a round
   * @dev This should be called when the round starts based on the number of users with auto-voting enabled
   * @param roundId The round ID
   * @param totalAutoVotingUsers The total number of auto-voting users
   */
  function setTotalActionsForRound(
    uint256 roundId,
    uint256 totalAutoVotingUsers
  ) external override onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    // Each auto-voting user requires 2 actions: 1 vote + 1 claim
    // This means that the total number of actions required for the round is totalAutoVotingUsers * 2
    $.totalActions[roundId] = totalAutoVotingUsers * 2;

    // Weighted actions are the sum of the vote and claim weights
    $.totalWeightedActions[roundId] = totalAutoVotingUsers * ($.voteWeight + $.claimWeight);

    emit TotalAutoVotingActionsSet(
      roundId,
      totalAutoVotingUsers,
      $.totalActions[roundId],
      $.totalWeightedActions[roundId],
      $.relayerAddresses.length
    );
  }

  /**
   * @notice Reduces the total expected actions for a round when an auto-voting user cannot vote
   * @param roundId The round ID
   * @param userCount The number of users to remove from expected actions (typically 1)
   */
  function reduceExpectedActionsForRound(
    uint256 roundId,
    uint256 userCount
  ) external override onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (userCount == 0) revert InvalidParameter("userCount");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    // Calculate reduction amounts
    uint256 actionsToReduce = userCount * 2; // Each user requires 2 actions (vote + claim)
    uint256 weightedActionsToReduce = userCount * ($.voteWeight + $.claimWeight);

    // Ensure we don't reduce below zero
    require(
      $.totalActions[roundId] >= actionsToReduce,
      "RelayerRewardsPool: cannot reduce more actions than available"
    );
    require(
      $.totalWeightedActions[roundId] >= weightedActionsToReduce,
      "RelayerRewardsPool: cannot reduce more weighted actions than available"
    );

    // Reduce the totals
    $.totalActions[roundId] -= actionsToReduce;
    $.totalWeightedActions[roundId] -= weightedActionsToReduce;

    emit ExpectedActionsReduced(roundId, userCount, $.totalActions[roundId], $.totalWeightedActions[roundId]);
  }

  /**
   * @notice Register a relayer for early access to auto-voting actions
   * @param relayer The address of the relayer to register
   */
  function registerRelayer(address relayer) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (relayer == address(0)) revert InvalidParameter("relayer");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if ($.registeredRelayers[relayer]) {
      revert RelayerAlreadyRegistered(relayer);
    }

    $.registeredRelayers[relayer] = true;
    $.relayerAddresses.push(relayer);

    emit RelayerRegistered(relayer);
  }

  /**
   * @notice Unregister a relayer from early access
   * @param relayer The address of the relayer to unregister
   */
  function unregisterRelayer(address relayer) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if (!$.registeredRelayers[relayer]) {
      revert RelayerNotRegistered(relayer);
    }

    delete $.registeredRelayers[relayer];

    // Remove from array (swap with last element and pop)
    for (uint256 i = 0; i < $.relayerAddresses.length; i++) {
      if ($.relayerAddresses[i] == relayer) {
        $.relayerAddresses[i] = $.relayerAddresses[$.relayerAddresses.length - 1];
        $.relayerAddresses.pop();
        break;
      }
    }

    emit RelayerUnregistered(relayer);
  }

  /**
   * @notice Set the number of blocks for early access period
   * @param blocks The number of blocks for early access
   */
  function setEarlyAccessBlocks(uint256 blocks) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldBlocks = $.earlyAccessBlocks;
    $.earlyAccessBlocks = blocks;

    emit EarlyAccessBlocksUpdated(blocks, oldBlocks);
  }

  /**
   * @notice Deposits B3TR tokens into the pool for a specific round
   * @param amount The amount of B3TR tokens to deposit
   * @param roundId The round ID to deposit for
   */
  function deposit(uint256 amount, uint256 roundId) external override onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (amount == 0) revert InvalidParameter("amount");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if (!$.b3tr.transferFrom(msg.sender, address(this), amount)) {
      revert TransferFailed();
    }

    $.totalRewards[roundId] += amount;

    emit RewardsDeposited(roundId, amount, $.totalRewards[roundId]);
  }

  /**
   * @notice Calculate relayer fee from total reward
   * @param totalReward Total reward amount in wei
   * @return Relayer fee in wei
   */
  function calculateRelayerFee(uint256 totalReward) external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    uint256 feePercent = $.relayerFeePercentage;
    uint256 denominator = $.relayerFeeDenominator;

    uint256 fee = (totalReward * feePercent) / denominator;

    return Math.min(fee, $.feeCap);
  }

  /**
   * @notice Returns the contract version
   * @return The version string
   */
  function version() external pure returns (string memory) {
    return "1";
  }
}
