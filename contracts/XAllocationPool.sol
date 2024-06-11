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

pragma solidity ^0.8.20;

import { IXAllocationPool } from "./interfaces/IXAllocationPool.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import { Time } from "@openzeppelin/contracts/utils/types/Time.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IXAllocationVotingGovernor } from "./interfaces/IXAllocationVotingGovernor.sol";
import { ITreasury } from "./interfaces/ITreasury.sol";
import { IEmissions } from "./interfaces/IEmissions.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { IB3TR } from "./interfaces/IB3TR.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IX2EarnApps } from "./interfaces/IX2EarnApps.sol";

/**
 * @title XAllocationPool
 * @notice This contract is the receiver and distributor of weekly B3TR emissions for x2earn apps.
 * Funds can be claimed by the X2Earn apps at the end of each allocation round
 * @dev Interacts with the Emissions contract to get the amount of B3TR available for distribution in each round,
 * and the x2EarnApps contract to check app existence and receiver address.
 * The contract is using AccessControl to handle roles for upgrading the contract and external contract addresses.
 */
contract XAllocationPool is
  Initializable,
  IXAllocationPool,
  AccessControlUpgradeable,
  ReentrancyGuardUpgradeable,
  UUPSUpgradeable
{
  uint256 public constant PERCENTAGE_PRECISION_SCALING_FACTOR = 1e4;
  /// @notice The role that can upgrade the contract.
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
  /// @notice The role that can set the addresses of the contracts used by the VoterRewards contract.
  bytes32 public constant CONTRACTS_ADDRESS_MANAGER_ROLE = keccak256("CONTRACTS_ADDRESS_MANAGER_ROLE");

  /// @custom:storage-location erc7201:b3tr.storage.XAllocationPool
  struct XAllocationPoolStorage {
    IXAllocationVotingGovernor _xAllocationVoting;
    IEmissions _emissions;
    IB3TR b3tr;
    ITreasury treasury;
    IX2EarnApps x2EarnApps;
    mapping(bytes32 => mapping(uint256 => bool)) claimedRewards;
  }

  // keccak256(abi.encode(uint256(keccak256("b3tr.storage.XAllocationPool")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant XAllocationPoolStorageLocation =
    0xba46220259871765522240056f76631a28aa19c5092d6dd51d6b858b4ebcb300;

  function _getXAllocationPoolStorage() private pure returns (XAllocationPoolStorage storage $) {
    assembly {
      $.slot := XAllocationPoolStorageLocation
    }
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /**
   * @dev Initializes the contract.
   *
   * @param _admin The address of the admin.
   * @param upgrader The address of the upgrader.
   * @param contractsAddressManager The address of the contracts address manager.
   * @param _b3trAddress The address of the B3TR token.
   * @param _treasury The address of the VeBetterDAO treasury.
   * @param _x2EarnApps The address of the x2EarnApps contract.
   */
  function initialize(
    address _admin,
    address upgrader,
    address contractsAddressManager,
    address _b3trAddress,
    address _treasury,
    address _x2EarnApps
  ) public initializer {
    require(_b3trAddress != address(0), "XAllocationPool: new b3tr is the zero address");
    require(_treasury != address(0), "XAllocationPool: new treasury is the zero address");
    require(_x2EarnApps != address(0), "XAllocationPool: new x2EarnApps is the zero address");

    __AccessControl_init();
    __ReentrancyGuard_init();
    __UUPSUpgradeable_init();

    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    $.b3tr = IB3TR(_b3trAddress);
    $.treasury = ITreasury(_treasury);
    $.x2EarnApps = IX2EarnApps(_x2EarnApps);

    _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    _grantRole(UPGRADER_ROLE, upgrader);
    _grantRole(CONTRACTS_ADDRESS_MANAGER_ROLE, contractsAddressManager);
  }

  // @dev Emit when the xAllocationVoting contract is set
  event XAllocationVotingSet(address oldContractAddress, address newContractAddress);
  // @dev Emit when the emissions contract is set
  event EmissionsContractSet(address oldContractAddress, address newContractAddress);
  // @dev Emit when the treasury contract is set
  event TreasuryContractSet(address oldContractAddress, address newContractAddress);
  // @dev Emit when the x2EarnApps contract is set
  event X2EarnAppsContractSet(address oldContractAddress, address newContractAddress);

  // ---------- Authorizers ---------- //

  function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

  // ---------- Setters ---------- //

  /**
   * @dev Set the address of the XAllocationVotingGovernor contract.
   */
  function setXAllocationVotingAddress(address xAllocationVoting_) public onlyRole(CONTRACTS_ADDRESS_MANAGER_ROLE) {
    require(xAllocationVoting_ != address(0), "XAllocationPool: new xAllocationVoting is the zero address");

    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    $._xAllocationVoting = IXAllocationVotingGovernor(xAllocationVoting_);

    emit XAllocationVotingSet(address($._xAllocationVoting), xAllocationVoting_);
  }

  /**
   * @dev Set the address of the emissions contract.
   */
  function setEmissionsAddress(address emissions_) public onlyRole(CONTRACTS_ADDRESS_MANAGER_ROLE) {
    require(emissions_ != address(0), "XAllocationPool: new emissions is the zero address");

    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    $._emissions = IEmissions(emissions_);

    emit EmissionsContractSet(address($._emissions), emissions_);
  }

  /**
   * @dev Set the address of the treasury contract.
   */
  function setTreasuryAddress(address treasury_) public onlyRole(CONTRACTS_ADDRESS_MANAGER_ROLE) {
    require(treasury_ != address(0), "XAllocationPool: new treasury is the zero address");

    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    $.treasury = ITreasury(treasury_);

    emit TreasuryContractSet(address($.treasury), treasury_);
  }

  /**
   * @dev Set the address of the x2EarnApps contract.
   */
  function setX2EarnAppsAddress(address x2EarnApps_) public onlyRole(CONTRACTS_ADDRESS_MANAGER_ROLE) {
    require(x2EarnApps_ != address(0), "XAllocationPool: new x2EarnApps is the zero address");

    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    $.x2EarnApps = IX2EarnApps(x2EarnApps_);

    emit X2EarnAppsContractSet(address($.x2EarnApps), x2EarnApps_);
  }

  /**
   * @dev Claim the rewards for an app in a given round.
   * Anyone can call this function. Round must be valid and app must exist.
   * Unallocated rewards for each app will be sent to the VeBetterDAO treasury.
   *
   * @param roundId The round ID from XAllocationVoting contract for which to claim the rewards.
   * @param appId The ID of the app from X2EarnApps contract for which to claim the rewards.
   */
  function claim(uint256 roundId, bytes32 appId) public nonReentrant {
    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();

    require(!$.claimedRewards[appId][roundId], "XAllocationPool: rewards already claimed for this app and round");
    require(!xAllocationVoting().isActive(roundId), "XAllocationPool: round not ended yet");
    require($.x2EarnApps.appExists(appId), "XAllocationPool: app does not exist");

    (uint256 amountToClaim, uint256 unallocatedAmount) = claimableAmount(roundId, appId);
    require(amountToClaim > 0, "XAllocationPool: no rewards available for this app");

    // update the claimedRewards mapping
    $.claimedRewards[appId][roundId] = true;

    address receiverAddress = $.x2EarnApps.appReceiverAddress(appId);

    //check that contract has enough funds to pay the reward
    require($.b3tr.balanceOf(address(this)) >= (amountToClaim + unallocatedAmount), "Insufficient funds");

    // Transfer the rewards to the caller
    require($.b3tr.transfer(receiverAddress, amountToClaim), "Allocation transfer failed");

    // Transfer the unallocated rewards to the treasury
    if (unallocatedAmount > 0) {
      require(
        $.b3tr.transfer(address($.treasury), unallocatedAmount),
        "Transfer of unallocated rewards to treasury failed"
      );
    }

    // emit event
    emit AllocationRewardsClaimed(appId, roundId, amountToClaim, receiverAddress, msg.sender, unallocatedAmount);
  }

  // ---------- Internal and private ---------- //

  /**
   * @dev Returns the amount of $B3TR available for allocation in a given cycle.
   * Each cycle is linked to a x-allocation round and they share the same id.
   *
   * @param roundId The round ID for which to calculate the amount available for allocation.
   */
  function _emissionAmount(uint256 roundId) internal view returns (uint256) {
    IEmissions _emissions = emissions();
    require(_emissions != IEmissions(address(0)), "Emissions contract not set");

    // Amount available for this round (assuming the amount is already scaled by 1e18 for precision)
    return _emissions.getXAllocationAmount(roundId);
  }

  /**
   * @dev Returns the amount of $B3TR to be distrubuted to either the app or the treasury.
   * The amount is calculated based on the share of votes the app received.
   * The amount is scaled by 1e18 for precision.
   *
   * @param roundId The round ID for which to calculate the amount available for allocation.
   * @param share The percentage of the total votes the app received.
   */
  function _rewardAmount(uint256 roundId, uint256 share) internal view returns (uint256) {
    uint256 total = _emissionAmount(roundId);

    uint256 variableAllocationPercentage = 100 - xAllocationVoting().getRoundBaseAllocationPercentage(roundId);
    uint256 available = (total * variableAllocationPercentage) / 100;

    uint256 rewardAmount = (available * share) / PERCENTAGE_PRECISION_SCALING_FACTOR;
    return rewardAmount;
  }

  // ---------- Getters ---------- //

  /**
   * @dev Get how much an app can claim for a given round.
   *
   * @param roundId The round ID for which to calculate the amount available for allocation.
   * @param appId The ID of the app for which to calculate the amount available for allocation.
   */
  function claimableAmount(uint256 roundId, bytes32 appId) public view returns (uint256, uint256) {
    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    if ($.claimedRewards[appId][roundId] || xAllocationVoting().isActive(roundId)) {
      return (0, 0);
    }

    return roundEarnings(roundId, appId);
  }

  /**
   * @dev The amount of allocation to distribute to the apps is calculated in two parts:
   * - There is a minimum amount calculated through the `baseAllocationPercentage` of total available funds for the round divided by the number of eligible apps
   * - There is a variable amount (calculated upon the `variableAllocationPercentage` of total available funds) that depends on the amounts of votes that an app receives.
   * There is a cap to how much each x-app will be able to receive each round. Unallocated amount is calculated when the app share is greater than the max share an app get have.
   *
   * If a round fails then we calculate the % of received votes (shares) against the previous succeeded round.
   * If a round is succeeded then we calculate the % of received votes (shares) against it.
   * If a round is active then results should be treated as real time estimation and not final results, since voting is still in progress.
   *
   * @param roundId The round ID for which to calculate the amount available for allocation.
   * @param appId The ID of the app for which to calculate the amount available for allocation.
   *
   * @return appShare The percentage of the total votes the app received.
   * @return unallocatedShare The percentage of the total votes that were not allocated to the app.
   */
  function roundEarnings(uint256 roundId, bytes32 appId) public view returns (uint256, uint256) {
    IXAllocationVotingGovernor _xAllocationVoting = xAllocationVoting();

    require(_xAllocationVoting != IXAllocationVotingGovernor(address(0)), "XAllocationVotingGovernor contract not set");

    // if app did not participate in the round, return 0
    if (!_xAllocationVoting.isEligibleForVote(appId, roundId)) {
      return (0, 0);
    }

    uint256 lastSucceededRoundId;
    IXAllocationVotingGovernor.RoundState state = _xAllocationVoting.state(roundId);
    if (
      state == IXAllocationVotingGovernor.RoundState.Active || state == IXAllocationVotingGovernor.RoundState.Succeeded
    ) {
      lastSucceededRoundId = roundId;
    } else {
      // The first round is always considered as the last succeeded round
      lastSucceededRoundId = roundId == 1 ? roundId : _xAllocationVoting.latestSucceededRoundId(roundId - 1);
    }

    (uint256 appShare, uint256 unallocatedShare) = getAppShares(lastSucceededRoundId, appId);
    uint256 baseAllocationPerApp = baseAllocationAmount(roundId);
    uint256 variableAllocationForApp = _rewardAmount(roundId, appShare);
    uint256 unallocatedAmount = 0;
    if (unallocatedShare > 0) {
      unallocatedAmount = _rewardAmount(roundId, unallocatedShare);
    }

    return (baseAllocationPerApp + variableAllocationForApp, unallocatedAmount);
  }

  /**
   * @dev Fetches the id of the current round and calculates the earnings.
   * Usually when calling this function round is active, and the results should be treated as real time estimation and not final results.
   * If round ends and a new round did not start yet, then the results can be considered final.
   *
   * @param appId The ID of the app for which to calculate the amount available for allocation.
   */
  function currentRoundEarnings(bytes32 appId) public view returns (uint256) {
    IXAllocationVotingGovernor _xAllocationVoting = xAllocationVoting();

    require(_xAllocationVoting != IXAllocationVotingGovernor(address(0)), "XAllocationVotingGovernor contract not set");

    uint256 roundId = _xAllocationVoting.currentRoundId();

    (uint256 earnings, ) = roundEarnings(roundId, appId);
    return earnings;
  }

  /**
   * @dev Calculate the minimum amount of $B3TR that will be distributed to each qualified X Application in a given round.
   * `baseAllocationPercentage`% of allocations will be on average distributed to each qualified X Application as the base
   * part of the allocation (so all the x-apps in the ecosystem will receive a minimum amount of $B3TR).
   */
  function baseAllocationAmount(uint256 roundId) public view returns (uint256) {
    IXAllocationVotingGovernor _xAllocationVoting = xAllocationVoting();

    require(_xAllocationVoting != IXAllocationVotingGovernor(address(0)), "XAllocationVotingGovernor contract not set");

    uint256 total = _emissionAmount(roundId);
    bytes32[] memory eligibleApps = _xAllocationVoting.getAppIdsOfRound(roundId);

    uint256 available = (total * _xAllocationVoting.getRoundBaseAllocationPercentage(roundId)) / 100;

    uint256 amountPerApp = available / eligibleApps.length;
    return amountPerApp;
  }

  /**
   * @dev Returns the scaled quadratic funding percentage of votes for a given app in a given round.
   * When calculating the percentage of votes received we check if the app exceeds the max cap of shares, eg:
   * if an app has 80 votes out of 100, and the max cap is 50, then the app will have a share of 50% of the available funds.
   * The remaining 30% will be sent to the treasury.
   *
   * @param roundId The round ID for which to calculate the amount of votes received in percentage.
   * @param appId The ID of the app.
   */
  function getAppShares(uint256 roundId, bytes32 appId) public view returns (uint256, uint256) {
    IXAllocationVotingGovernor _xAllocationVoting = xAllocationVoting();

    require(_xAllocationVoting != IXAllocationVotingGovernor(address(0)), "XAllocationVotingGovernor contract not set");

    // if app did not participate in the round, return 0
    if (!_xAllocationVoting.isEligibleForVote(appId, roundId)) {
      return (0, 0);
    }

    uint256 totalVotesQF = _xAllocationVoting.totalVotesQF(roundId);
    uint256 appVotesQF = _xAllocationVoting.getAppVotesQF(roundId, appId);

    uint256 appVotesQFValue = appVotesQF * appVotesQF;

    // avoid division by zero
    if (appVotesQFValue == 0) return (0, 0);

    uint256 appShare = (appVotesQFValue * PERCENTAGE_PRECISION_SCALING_FACTOR) / totalVotesQF;

    // This is the amount unallocated if appShare is greater than max cap, this will be sent to treasury
    uint256 unallocatedShare = 0;

    // Cap the app share to the maximum variable allocation percentage so even if an app has 80 votes out of 100,
    // it will still get only a max of `appSharesCap` percentage of the available funds
    uint256 _allocationRewardMaxCap = scaledAppSharesCap(roundId);
    if (appShare > _allocationRewardMaxCap) {
      unallocatedShare = appShare - _allocationRewardMaxCap;
      appShare = _allocationRewardMaxCap;
    }

    // This number is scaled and should be divided by 100 to get the actual percentage on the FE
    return (appShare, unallocatedShare);
  }

  /**
   * @dev Check if app has already claimed the rewards for a given round.
   *
   * @param roundId The round ID for which to check if the app has claimed the rewards.
   * @param appId The ID of the app.
   */
  function claimed(uint256 roundId, bytes32 appId) public view returns (bool) {
    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    return $.claimedRewards[appId][roundId];
  }

  /**
   * @dev Returns the maximum app shares cap scaled by 1e2 for precision since our
   * shares calculation is scaled by 1e4.
   *
   * @param roundId The round ID
   */
  function scaledAppSharesCap(uint256 roundId) public view returns (uint256) {
    return xAllocationVoting().getRoundAppSharesCap(roundId) * 1e2;
  }

  /**
   * @dev Returns the maximum amount an app can claim for a given round.
   *
   * @param roundId The round ID
   */
  function getMaxAppAllocation(uint256 roundId) public view returns (uint256) {
    uint256 roundBaseAllocationAmount = baseAllocationAmount(roundId);
    uint256 maxAppShares = _rewardAmount(roundId, scaledAppSharesCap(roundId));
    return roundBaseAllocationAmount + maxAppShares;
  }

  /**
   * @dev Returns the XAllocationVotingGovernor contract.
   */
  function xAllocationVoting() public view returns (IXAllocationVotingGovernor) {
    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    return $._xAllocationVoting;
  }

  /**
   * @dev Returns the emissions contract.
   */
  function emissions() public view returns (IEmissions) {
    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    return $._emissions;
  }

  /**
   * @dev Returns the emissions contract.
   */
  function treasury() public view returns (ITreasury) {
    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    return $.treasury;
  }

  /**
   * @dev Returns the b3tr contract.
   */
  function b3tr() public view returns (IB3TR) {
    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    return $.b3tr;
  }

  /**
   * @dev Returns the x2EarnApp contract.
   */
  function x2EarnApps() public view returns (IX2EarnApps) {
    XAllocationPoolStorage storage $ = _getXAllocationPoolStorage();
    return $.x2EarnApps;
  }

  /**
   * @notice Returns the version of the contract
   * @dev Version of the governor instance (used in building the ERC712 domain separator). Default: "1"
   * @return sting The version of the contract
   */
  function version() public pure virtual returns (string memory) {
    return "1";
  }
}
