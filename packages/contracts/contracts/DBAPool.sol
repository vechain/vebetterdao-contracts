// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import { IX2EarnApps } from "./interfaces/IX2EarnApps.sol";
import { IB3TR } from "./interfaces/IB3TR.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { IXAllocationPool } from "./interfaces/IXAllocationPool.sol";
import { IX2EarnRewardsPool } from "./interfaces/IX2EarnRewardsPool.sol";
import { IDynamicBaseAllocationPool } from "./interfaces/IDynamicBaseAllocationPool.sol";

/**
 * @title DynamicBaseAllocationPool (DBA)
 * @notice This contract receives surplus B3TR allocations from XAllocationPool.
 * Initially acts as a wallet/treasury where the VeBetter team can manually distribute
 * surplus allocations to eligible apps. Future upgrades will add on-chain calculation
 * and permissionless distribution capabilities.
 *
 * --------- Version 2 ---------
 * - Add storage to track the reward amount for each app for each round
 * - Add seed function to seed historical rewards
 */
contract DBAPool is
  AccessControlUpgradeable,
  ReentrancyGuardUpgradeable,
  UUPSUpgradeable,
  PausableUpgradeable,
  IDynamicBaseAllocationPool
{
  /// @notice The role that can upgrade the contract.
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
  /// @notice The role that can distribute funds to apps.
  bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

  // ---------- Storage ---------- //

  /// @custom:storage-location erc7201:b3tr.storage.DBAPool
  struct DBAPoolStorage {
    IX2EarnApps x2EarnApps;
    IXAllocationPool xAllocationPool;
    IX2EarnRewardsPool x2EarnRewardsPool;
    IB3TR b3tr;
    uint256 distributionStartRound; // The round from which DBA rewards distribution starts
    mapping(uint256 roundId => bool) dbaRewardsDistributed; // Tracks if DBA rewards have been distributed for a round
    mapping(uint256 roundId => mapping(bytes32 appId => uint256 amount)) dbaRoundRewardsForApp; // Tracks the reward amount an app has received from the DBA
  }

  // keccak256(abi.encode(uint256(keccak256("b3tr.storage.DBAPool")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant DBAPoolStorageLocation = 0x4f3bb8da144f5f8e75f17301cb1e55dff8f5406135253ffe9ec628919faae200;

  function _getDBAPoolStorage() private pure returns (DBAPoolStorage storage $) {
    assembly {
      $.slot := DBAPoolStorageLocation
    }
  }

  // ---------- Initializers ---------- //

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  struct InitializeV1Params {
    address admin;
    address x2EarnApps;
    address xAllocationPool;
    address x2earnRewardsPool;
    address b3tr;
    uint256 distributionStartRound;
  }

  function initialize(InitializeV1Params memory params) public initializer {
    require(params.admin != address(0), "DBAPool: admin is the zero address");
    require(params.x2EarnApps != address(0), "DBAPool: x2EarnApps is the zero address");
    require(params.xAllocationPool != address(0), "DBAPool: xAllocationPool is the zero address");
    require(params.x2earnRewardsPool != address(0), "DBAPool: x2EarnRewardsPool is the zero address");
    require(params.b3tr != address(0), "DBAPool: b3tr is the zero address");
    require(params.distributionStartRound != 0, "DBAPool: distribution start round is zero");

    __AccessControl_init();
    __ReentrancyGuard_init();
    __UUPSUpgradeable_init();
    __Pausable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, params.admin);

    DBAPoolStorage storage $ = _getDBAPoolStorage();
    $.x2EarnApps = IX2EarnApps(params.x2EarnApps);
    $.xAllocationPool = IXAllocationPool(params.xAllocationPool);
    $.x2EarnRewardsPool = IX2EarnRewardsPool(params.x2earnRewardsPool);
    $.b3tr = IB3TR(params.b3tr);
    $.distributionStartRound = params.distributionStartRound;
  }

  // ---------- Authorizers ---------- //

  /**
   * @notice Authorizes the upgrade of the contract.
   * @param _newImplementation The new implementation address.
   */
  function _authorizeUpgrade(address _newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

  // ---------- Setters ---------- //

  /**
   * @notice Distributes DBA rewards to eligible apps for a specific round.
   * @dev This function equally distributes the unallocated funds sent to the DBA contract among the list of provided apps.
   * A lambda/off-chain service filters eligible apps based on the proposal criteria.
   * Can only be called once per round and only for rounds >= startRound.
   * @param _roundId The round ID for which to distribute DBA rewards.
   * @param _appIds Array of eligible app IDs (pre-filtered by off-chain service).
   */
  function distributeDBARewards(
    uint256 _roundId,
    bytes32[] memory _appIds
  ) external nonReentrant onlyRole(DISTRIBUTOR_ROLE) whenNotPaused {
    require(_appIds.length > 0, "DBAPool: no apps to distribute to");

    // Validate no duplicate appIds
    // While O(n²) time complexity, this is actually more gas-efficient than
    // storage-based approaches for typical array sizes in smart contracts
    for (uint256 i = 0; i < _appIds.length; i++) {
      for (uint256 j = i + 1; j < _appIds.length; j++) {
        require(_appIds[i] != _appIds[j], "DBAPool: duplicate app IDs not allowed");
      }
    }

    DBAPoolStorage storage $ = _getDBAPoolStorage();

    // Validate that round can be distributed based on different criteria
    require(_canDistributeDBARewards($, _roundId), "DBAPool: Round invalid or not ready to distribute");

    // Validate that contract has enough funds
    require($.b3tr.balanceOf(address(this)) > 0, "DBAPool: no funds available");

    // Calculate amount per app
    uint256 totalUnallocatedFunds = $.xAllocationPool.unallocatedFunds(_roundId);
    uint256 amountPerApp = totalUnallocatedFunds / _appIds.length;

    // Mark round as distributed
    $.dbaRewardsDistributed[_roundId] = true;

    // Distribute to each app
    for (uint256 i = 0; i < _appIds.length; i++) {
      bytes32 appId = _appIds[i];

      // Validate app exists
      require($.x2EarnApps.appExists(appId), "DBAPool: app does not exist");

      // Deposit the rewards to the X2EarnRewardsPool contract
      require(
        $.b3tr.approve(address($.x2EarnRewardsPool), amountPerApp),
        "DBAPool: Approval of B3TR token to x2EarnRewardsPool failed"
      );
      require(
        $.x2EarnRewardsPool.deposit(amountPerApp, appId),
        "DBAPool: Deposit of rewards allocation to x2EarnRewardsPool failed"
      );

      // Track the reward amount for the app for later on-chain-retrieval
      $.dbaRoundRewardsForApp[_roundId][appId] = amountPerApp;

      // Emit event for each app
      emit FundsDistributedToApp(appId, amountPerApp, _roundId);
    }
  }

  // ---------- Getters ---------- //

  /**
   * @notice Gets the reward amount distributed to a specific app for a specific round
   * @param _roundId The round ID to check
   * @param _appId The app ID to check
   * @return The reward amount for the app for the round or 0 if no rewards have been distributed
   */
  function dbaRoundRewardsForApp(uint256 _roundId, bytes32 _appId) external view returns (uint256) {
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    return $.dbaRoundRewardsForApp[_roundId][_appId];
  }

  /**
   * @notice Gets the current B3TR balance of this contract
   * @return The current B3TR balance
   */
  function b3trBalance() external view returns (uint256) {
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    return $.b3tr.balanceOf(address(this));
  }

  /**
   * @notice External getter to check if DBA rewards can be distributed for a specific round
   * @param _roundId The round ID to check
   * @return True if DBA rewards can be distributed for the round
   */
  function canDistributeDBARewards(uint256 _roundId) external view returns (bool) {
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    return _canDistributeDBARewards($, _roundId);
  }

  /**
   * @notice Internal function to check if DBA rewards can be distributed for a specific round
   * @param _roundId The round ID to check
   * @return True if DBA rewards can be distributed for the round
   */
  function _canDistributeDBARewards(DBAPoolStorage storage $, uint256 _roundId) internal view returns (bool) {
    // Round is valid if it's after the designated start round and rewards have not been distributed yet
    bool isRoundValid = _roundId >= $.distributionStartRound && !$.dbaRewardsDistributed[_roundId];

    // Unallocated funds must exist
    uint256 totalUnallocatedFunds = $.xAllocationPool.unallocatedFunds(_roundId);

    // All apps must have claimed their rewards for the round, otherwise the unallocated funds cannot be considered final
    bool allFundsClaimed = $.xAllocationPool.allFundsClaimed(_roundId);

    return isRoundValid && totalUnallocatedFunds > 0 && allFundsClaimed;
  }

  /**
   * @notice External getter to get the amount of funds to distribute for a specific round
   * @param _roundId The round ID to check
   * @return The amount of funds to distribute for the round
   */
  function fundsForRound(uint256 _roundId) external view returns (uint256) {
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    return $.xAllocationPool.unallocatedFunds(_roundId);
  }

  /**
   * @notice Checks if DBA rewards have been distributed for a specific round
   * @param _roundId The round ID to check
   * @return True if rewards have been distributed for the round
   */
  function isDBARewardsDistributed(uint256 _roundId) external view returns (bool) {
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    return $.dbaRewardsDistributed[_roundId];
  }

  /**
   * @notice Gets the starting round for DBA distribution
   * @return The starting round ID
   */
  function distributionStartRound() external view returns (uint256) {
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    return $.distributionStartRound;
  }

  /**
   * @notice Gets the X2EarnApps contract
   * @return The contract interface
   */
  function x2EarnApps() external view returns (IX2EarnApps) {
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    return $.x2EarnApps;
  }

  /**
   * @notice Gets the B3TR token contract
   * @return The contract interface
   */
  function b3tr() external view returns (IB3TR) {
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    return $.b3tr;
  }

  /**
   * @notice Gets the XAllocationPool contract
   * @return The contract interface
   */
  function xAllocationPool() external view returns (IXAllocationPool) {
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    return $.xAllocationPool;
  }

  /**
   * @notice Gets the X2EarnRewardsPool contract
   * @return The contract interface
   */
  function x2EarnRewardsPool() external view returns (IX2EarnRewardsPool) {
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    return $.x2EarnRewardsPool;
  }

  /**
   * @notice Gets the contract version
   * @return The version string
   */
  function version() external pure returns (string memory) {
    return "2";
  }

  // ---------- Admin functions ---------- //

  /**
   * @notice Pauses the contract
   */
  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
  }

  /**
   * @notice Unpauses the contract
   */
  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
  }

  /**
   * @notice Updates the X2EarnApps contract
   * @param _x2EarnApps The new contract interface
   */
  function setX2EarnApps(IX2EarnApps _x2EarnApps) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(address(_x2EarnApps) != address(0), "DBAPool: zero address");
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    $.x2EarnApps = _x2EarnApps;
  }

  /**
   * @notice Updates the XAllocationPool contract
   * @param _xAllocationPool The new contract interface
   */
  function setXAllocationPool(IXAllocationPool _xAllocationPool) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(address(_xAllocationPool) != address(0), "DBAPool: zero address");
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    $.xAllocationPool = _xAllocationPool;
  }

  /**
   * @notice Updates the X2EarnRewardsPool contract
   * @param _x2EarnRewardsPool The new contract interface
   */
  function setX2EarnRewardsPool(IX2EarnRewardsPool _x2EarnRewardsPool) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(address(_x2EarnRewardsPool) != address(0), "DBAPool: zero address");
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    $.x2EarnRewardsPool = _x2EarnRewardsPool;
  }

  /**
   * @notice Updates the distribution start round
   * @param _distributionStartRound The new distribution start round
   */
  function setDistributionStartRound(uint256 _distributionStartRound) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(_distributionStartRound != 0, "DBAPool: distribution start round is zero");
    DBAPoolStorage storage $ = _getDBAPoolStorage();
    $.distributionStartRound = _distributionStartRound;
  }

  /**
   * @notice Seeds the reward amounts for multiple apps across multiple rounds (batch operation)
   * @param _roundIds Array of round IDs to seed
   * @param _appIds Array of app IDs to seed
   * @param _amounts Array of amounts to seed
   */
  function seedDBARewardsForApps(
    uint256[] calldata _roundIds,
    bytes32[] calldata _appIds,
    uint256[] calldata _amounts
  ) external onlyRole(UPGRADER_ROLE) {
    require(_roundIds.length == _appIds.length, "DBAPool: arrays length mismatch");
    require(_roundIds.length == _amounts.length, "DBAPool: arrays length mismatch");
    require(_roundIds.length > 0, "DBAPool: empty arrays");

    DBAPoolStorage storage $ = _getDBAPoolStorage();

    for (uint256 i = 0; i < _roundIds.length; i++) {
      uint256 roundId = _roundIds[i];
      bytes32 appId = _appIds[i];
      uint256 amount = _amounts[i];

      // Validate amount
      require(amount > 0, "DBAPool: amount is zero");

      // Validate that the round is valid: after distribution start
      require(roundId >= $.distributionStartRound, "DBAPool: round is invalid");

      // Validate that the app exists
      require($.x2EarnApps.appExists(appId), "DBAPool: app does not exist");

      // If the app has already received rewards for the round, revert
      require($.dbaRoundRewardsForApp[roundId][appId] == 0, "DBAPool: app has already received rewards for the round");

      // Seed the reward amount
      $.dbaRoundRewardsForApp[roundId][appId] = amount;
    }
  }
}
