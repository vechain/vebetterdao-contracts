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
import "../../interfaces/IB3TR.sol";
import "./interfaces/IRelayerRewardsPoolV1.sol";
import "../../interfaces/IEmissions.sol";
import "../../interfaces/IXAllocationVotingGovernor.sol";

/**
 * @title RelayerRewardsPoolV1
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
contract RelayerRewardsPoolV1 is
  AccessControlUpgradeable,
  ReentrancyGuardUpgradeable,
  UUPSUpgradeable,
  IRelayerRewardsPoolV1
{
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

  bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");

  /// @custom:storage-location erc7201:b3tr.storage.RelayerRewardsPool
  struct RelayerRewardsPoolStorage {
    IB3TR b3tr;
    IEmissions emissions;
    IXAllocationVotingGovernor xAllocationVoting;
    mapping(uint256 => uint256) totalRewards;
    mapping(uint256 => mapping(address => uint256)) relayerActions;
    mapping(uint256 => mapping(address => uint256)) relayerWeightedActions;
    mapping(uint256 => uint256) totalActions;
    mapping(uint256 => uint256) totalWeightedActions;
    mapping(uint256 => mapping(address => bool)) claimed;
    mapping(uint256 => uint256) completedActions;
    mapping(uint256 => uint256) completedWeightedActions;
    uint256 voteWeight;
    uint256 claimWeight;
    mapping(address => bool) registeredRelayers;
    address[] relayerAddresses;
    uint256 earlyAccessBlocks;
    uint256 relayerFeePercentage;
    uint256 relayerFeeDenominator;
    uint256 feeCap;
  }

  bytes32 private constant RelayerRewardsPoolStorageLocation =
    0x33676f94b2c7694b38dc9f1f29c59bfbb522294615c1bff34717ad1fa8926000;

  function _getRelayerRewardsPoolStorage() internal pure returns (RelayerRewardsPoolStorage storage $) {
    assembly {
      $.slot := RelayerRewardsPoolStorageLocation
    }
  }

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
    _grantRole(POOL_ADMIN_ROLE, admin);

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    $.b3tr = IB3TR(b3trAddress);
    $.emissions = IEmissions(emissionsAddress);
    $.xAllocationVoting = IXAllocationVotingGovernor(xAllocationVotingAddress);
    $.voteWeight = 3;
    $.claimWeight = 1;
    $.relayerFeePercentage = 10;
    $.relayerFeeDenominator = 100;
    $.feeCap = 100 ether;
    $.earlyAccessBlocks = 432000;
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

  function getRelayerFeeDenominator() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.relayerFeeDenominator;
  }

  function getRelayerFeePercentage() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.relayerFeePercentage;
  }

  function getFeeCap() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.feeCap;
  }

  function getVoteWeight() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.voteWeight;
  }

  function getClaimWeight() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.claimWeight;
  }

  function getTotalRewards(uint256 roundId) external view override returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.totalRewards[roundId];
  }

  function isRewardClaimable(uint256 roundId) external view override returns (bool) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    try $.emissions.isCycleEnded(roundId) returns (bool ended) {
      if (!ended) return false;
    } catch {
      return false;
    }

    uint256 roundTotalWeightedActions = $.totalWeightedActions[roundId];
    uint256 roundCompletedWeightedActions = $.completedWeightedActions[roundId];

    return roundCompletedWeightedActions >= roundTotalWeightedActions;
  }

  function totalRelayerActions(address relayer, uint256 roundId) external view override returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.relayerActions[roundId][relayer];
  }

  function totalActions(uint256 roundId) external view override returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.totalActions[roundId];
  }

  function claimableRewards(address relayer, uint256 roundId) external view override returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if (!this.isRewardClaimable(roundId)) {
      return 0;
    }

    if ($.claimed[roundId][relayer]) {
      return 0;
    }

    uint256 relayerWeightedActions = $.relayerWeightedActions[roundId][relayer];
    uint256 roundTotalWeightedActions = $.totalWeightedActions[roundId];
    uint256 totalRewards = $.totalRewards[roundId];

    if (relayerWeightedActions == 0 || roundTotalWeightedActions == 0) {
      return 0;
    }

    return (totalRewards * relayerWeightedActions) / roundTotalWeightedActions;
  }

  function isRegisteredRelayer(address relayer) external view returns (bool) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.registeredRelayers[relayer];
  }

  function getRegisteredRelayers() external view returns (address[] memory) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.relayerAddresses;
  }

  function getEarlyAccessBlocks() external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.earlyAccessBlocks;
  }

  function isVoteEarlyAccessActive(uint256 roundId) public view returns (bool) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 roundStartBlock = $.xAllocationVoting.roundSnapshot(roundId);
    return block.number < roundStartBlock + $.earlyAccessBlocks;
  }

  function isClaimEarlyAccessActive(uint256 roundId) public view returns (bool) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 roundEndBlock = $.xAllocationVoting.roundDeadline(roundId);
    return block.number < roundEndBlock + $.earlyAccessBlocks;
  }

  function totalRelayerWeightedActions(address relayer, uint256 roundId) external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.relayerWeightedActions[roundId][relayer];
  }

  function totalWeightedActions(uint256 roundId) external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.totalWeightedActions[roundId];
  }

  function completedWeightedActions(uint256 roundId) external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return $.completedWeightedActions[roundId];
  }

  function getMissedAutoVotingUsersCount(uint256 roundId) external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    uint256 expected = $.totalWeightedActions[roundId];
    uint256 completed = $.completedWeightedActions[roundId];

    if (completed >= expected) return 0;

    uint256 deficit = expected - completed;
    uint256 weightPerUser = $.voteWeight + $.claimWeight;
    uint256 missedUsers = deficit / weightPerUser;

    return missedUsers;
  }

  function validateVoteDuringEarlyAccess(uint256 roundId, address voter, address caller) external view {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if (!isVoteEarlyAccessActive(roundId)) {
      return;
    }

    require(
      caller != voter,
      "RelayerRewardsPool: auto-voting users cannot vote for themselves during early access period"
    );

    require(
      $.registeredRelayers[caller],
      "RelayerRewardsPool: caller is not a registered relayer during early access period"
    );
  }

  function validateClaimDuringEarlyAccess(uint256 roundId, address voter, address caller) external view {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if (!isClaimEarlyAccessActive(roundId)) {
      return;
    }

    require(
      caller != voter,
      "RelayerRewardsPool: auto-voting users cannot claim for themselves during early access period"
    );

    require(
      $.registeredRelayers[caller],
      "RelayerRewardsPool: caller is not a registered relayer during claim early access period"
    );
  }

  function getB3trAddress() external view returns (address) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return address($.b3tr);
  }

  function getEmissionsAddress() external view returns (address) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return address($.emissions);
  }

  function getXAllocationVotingAddress() external view returns (address) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    return address($.xAllocationVoting);
  }

  function setB3TRAddress(address b3trAddress) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (b3trAddress == address(0)) revert InvalidParameter("b3trAddress");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    address oldAddress = address($.b3tr);
    $.b3tr = IB3TR(b3trAddress);

    emit B3TRAddressUpdated(b3trAddress, oldAddress);
  }

  function setEmissionsAddress(address emissionsAddress) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (emissionsAddress == address(0)) revert InvalidParameter("emissionsAddress");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    address oldAddress = address($.emissions);
    $.emissions = IEmissions(emissionsAddress);

    emit EmissionsAddressUpdated(emissionsAddress, oldAddress);
  }

  function setXAllocationVotingAddress(address xAllocationVotingAddress) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (xAllocationVotingAddress == address(0)) revert InvalidParameter("xAllocationVotingAddress");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    address oldAddress = address($.xAllocationVoting);
    $.xAllocationVoting = IXAllocationVotingGovernor(xAllocationVotingAddress);

    emit XAllocationVotingAddressUpdated(xAllocationVotingAddress, oldAddress);
  }

  function setRelayerFeeDenominator(uint256 newDenominator) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    require(newDenominator > 0, "RelayerRewardsPool: Denominator must be > 0");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldDenominator = $.relayerFeeDenominator;
    $.relayerFeeDenominator = newDenominator;

    emit RelayerFeeDenominatorUpdated(newDenominator, oldDenominator);
  }

  function setRelayerFeePercentage(uint256 newFeePercentage) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    require(newFeePercentage > 0 && newFeePercentage <= 50, "RelayerRewardsPool: Fee must be > 0 and <= 50%");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldFeePercentage = $.relayerFeePercentage;
    $.relayerFeePercentage = newFeePercentage;

    emit RelayerFeePercentageUpdated(newFeePercentage, oldFeePercentage);
  }

  function setFeeCap(uint256 newFeeCap) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    require(newFeeCap > 0, "RelayerRewardsPool: Fee must be > 0");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldFeeCap = $.feeCap;
    $.feeCap = newFeeCap;

    emit FeeCapUpdated(newFeeCap, oldFeeCap);
  }

  function setVoteWeight(uint256 newWeight) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (newWeight == 0) revert InvalidParameter("voteWeight");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldWeight = $.voteWeight;
    $.voteWeight = newWeight;

    emit VoteWeightUpdated(newWeight, oldWeight);
  }

  function setClaimWeight(uint256 newWeight) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (newWeight == 0) revert InvalidParameter("claimWeight");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldWeight = $.claimWeight;
    $.claimWeight = newWeight;

    emit ClaimWeightUpdated(newWeight, oldWeight);
  }

  function claimRewards(uint256 roundId, address relayer) external override nonReentrant {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if (!$.emissions.isCycleEnded(roundId)) {
      revert RoundNotEnded(roundId);
    }

    if ($.claimed[roundId][relayer]) {
      revert RewardsAlreadyClaimed(relayer, roundId);
    }

    uint256 claimableAmount = this.claimableRewards(relayer, roundId);
    if (claimableAmount == 0) {
      revert NoRewardsToClaim(relayer, roundId);
    }

    $.claimed[roundId][relayer] = true;

    if (!$.b3tr.transfer(relayer, claimableAmount)) {
      revert TransferFailed();
    }

    emit RelayerRewardsClaimed(relayer, roundId, claimableAmount);
  }

  function registerRelayerAction(
    address relayer,
    address voter,
    uint256 roundId,
    RelayerActionV1 action
  ) external override onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (relayer == address(0)) revert InvalidParameter("relayer");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 weight = action == RelayerActionV1.VOTE ? $.voteWeight : $.claimWeight;

    $.relayerActions[roundId][relayer]++;
    $.completedActions[roundId]++;
    $.relayerWeightedActions[roundId][relayer] += weight;
    $.completedWeightedActions[roundId] += weight;

    emit RelayerActionRegistered(relayer, voter, roundId, $.relayerActions[roundId][relayer], weight);
  }

  function setTotalActionsForRound(
    uint256 roundId,
    uint256 totalAutoVotingUsers
  ) external override onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    $.totalActions[roundId] = totalAutoVotingUsers * 2;
    $.totalWeightedActions[roundId] = totalAutoVotingUsers * ($.voteWeight + $.claimWeight);

    emit TotalAutoVotingActionsSet(
      roundId,
      totalAutoVotingUsers,
      $.totalActions[roundId],
      $.totalWeightedActions[roundId],
      $.relayerAddresses.length
    );
  }

  function reduceExpectedActionsForRound(
    uint256 roundId,
    uint256 userCount
  ) external override onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (userCount == 0) revert InvalidParameter("userCount");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 actionsToReduce = userCount * 2;
    uint256 weightedActionsToReduce = userCount * ($.voteWeight + $.claimWeight);

    require(
      $.totalActions[roundId] >= actionsToReduce,
      "RelayerRewardsPool: cannot reduce more actions than available"
    );
    require(
      $.totalWeightedActions[roundId] >= weightedActionsToReduce,
      "RelayerRewardsPool: cannot reduce more weighted actions than available"
    );

    $.totalActions[roundId] -= actionsToReduce;
    $.totalWeightedActions[roundId] -= weightedActionsToReduce;

    emit ExpectedActionsReduced(roundId, userCount, $.totalActions[roundId], $.totalWeightedActions[roundId]);
  }

  function registerRelayer(address relayer) external {
    if (relayer == address(0)) revert InvalidParameter("relayer");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if ($.registeredRelayers[relayer]) {
      revert RelayerAlreadyRegistered(relayer);
    }

    $.registeredRelayers[relayer] = true;
    $.relayerAddresses.push(relayer);

    emit RelayerRegistered(relayer);
  }

  function unregisterRelayer(address relayer) external {
    if (
      relayer != msg.sender && !hasRole(POOL_ADMIN_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
    ) {
      revert UnauthorizedUnregister(msg.sender, relayer);
    }

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if (!$.registeredRelayers[relayer]) {
      revert RelayerNotRegistered(relayer);
    }

    delete $.registeredRelayers[relayer];

    for (uint256 i = 0; i < $.relayerAddresses.length; i++) {
      if ($.relayerAddresses[i] == relayer) {
        $.relayerAddresses[i] = $.relayerAddresses[$.relayerAddresses.length - 1];
        $.relayerAddresses.pop();
        break;
      }
    }

    emit RelayerUnregistered(relayer);
  }

  function setEarlyAccessBlocks(uint256 blocks) external onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();
    uint256 oldBlocks = $.earlyAccessBlocks;
    $.earlyAccessBlocks = blocks;

    emit EarlyAccessBlocksUpdated(blocks, oldBlocks);
  }

  function deposit(uint256 amount, uint256 roundId) external override onlyRoleOrAdmin(POOL_ADMIN_ROLE) {
    if (amount == 0) revert InvalidParameter("amount");

    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    if (!$.b3tr.transferFrom(msg.sender, address(this), amount)) {
      revert TransferFailed();
    }

    $.totalRewards[roundId] += amount;

    emit RewardsDeposited(roundId, amount, $.totalRewards[roundId]);
  }

  function calculateRelayerFee(uint256 totalReward) external view returns (uint256) {
    RelayerRewardsPoolStorage storage $ = _getRelayerRewardsPoolStorage();

    uint256 feePercent = $.relayerFeePercentage;
    uint256 denominator = $.relayerFeeDenominator;
    uint256 fee = (totalReward * feePercent) / denominator;

    return Math.min(fee, $.feeCap);
  }

  function version() external pure returns (string memory) {
    return "1";
  }
}
