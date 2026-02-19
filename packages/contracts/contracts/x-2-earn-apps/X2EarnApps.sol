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

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Time } from "@openzeppelin/contracts/utils/types/Time.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IX2EarnApps } from "../interfaces/IX2EarnApps.sol";
import { IX2EarnCreator } from "../interfaces/IX2EarnCreator.sol";
import { IX2EarnRewardsPool } from "../interfaces/IX2EarnRewardsPool.sol";
import { IXAllocationVotingGovernor } from "../interfaces/IXAllocationVotingGovernor.sol";
import { IVeBetterPassport } from "../interfaces/IVeBetterPassport.sol";
import { IStargateNFT } from "../mocks/Stargate/interfaces/IStargateNFT.sol";

import { X2EarnAppsDataTypes } from "../libraries/X2EarnAppsDataTypes.sol";
import { X2EarnAppsStorageTypes } from "./libraries/X2EarnAppsStorageTypes.sol";
import { EndorsementUtils } from "./libraries/EndorsementUtils.sol";
import { AppStorageUtils } from "./libraries/AppStorageUtils.sol";
import { AdministrationUtils } from "./libraries/AdministrationUtils.sol";
import { VoteEligibilityUtils } from "./libraries/VoteEligibilityUtils.sol";

/**
 * @title X2EarnApps
 * @notice This contract handles the x-2-earn applications of the VeBetterDAO ecosystem. The contract allows the insert, management and
 * eligibility of apps for the B3TR allocation rounds.
 * @dev The contract is using AccessControl to handle the admin and upgrader roles.
 * Only users with the DEFAULT_ADMIN_ROLE can add new apps, set the base URI and set the voting eligibility for an app.
 * Admins can also control the app metadata and management.
 * Each app has a set of admins and moderators that can manage the app and settings.
 *
 * -------------------- Version 2 --------------------
 * - The contract has been upgraded to version 2 to include the X2Earn endorsement system.
 * - Added libraries to reduce the contract size and improve readability.
 *
 * -------------------- Version 3 --------------------
 * - The contract has been upgraded to version 3 to add node cooldown period.
 *
 * -------------------- Version 4 --------------------
 * - Enabling by default the rewards pool for new apps submitted.
 *
 * -------------------- Version 5 --------------------
 * - Restricting one app per creator holding a creator NFT.
 * A check on submitApp is added to ensure that the number of creatorApps[creator] is 0.
 * This mapping is increased when a creator is added to an app, submit an app after approved by VBD, or got endorsed.
 *
 * -------------------- Version 6 --------------------
 * - Upon StarGate launch, we updated the NodeManagement contract to V3. This impacted mostly
 *   EndorsementUtils library.
 *   EndorsementUpgradeable module.
 *
 * -------------------- Version 7 --------------------
 * - Integrated Stargate NFT contract for node management and endorsement verification.
 * - Updated endorsement system to use Stargate NFT for node ownership and token management.
 *
 * -------------------- Version 8 --------------------
 * - Refactor: modules replaced with libraries for size optimization.
 * - Removed some unused functions to reduce contract size.
 * - Marked functions as external to reduce contract size.
 * - Flexible endorsement: partial points, multiple apps per node, 49-point cap per app, 110 total cap.
 * - New storage: activeEndorsements array with O(1) index lookup.
 * - Per-app cooldown instead of per-node cooldown.
 * - Migration support: pause mechanism and seedEndorsement().
 */
contract X2EarnApps is Initializable, IX2EarnApps, AccessControlUpgradeable, UUPSUpgradeable {
  using Checkpoints for Checkpoints.Trace208;
  using X2EarnAppsStorageTypes for *;

  /// @notice The role that can upgrade the contract.
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
  /// @notice The role that can manage the contract settings.
  bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
  /// @notice The role that can seed endorsements during migration.
  bytes32 public constant MIGRATION_ROLE = keccak256("MIGRATION_ROLE");

  /// @notice The maximum number of moderators allowed per app.
  uint256 public constant MAX_MODERATORS = 100;
  /// @notice The maximum number of reward distributors allowed per app.
  uint256 public constant MAX_REWARD_DISTRIBUTORS = 100;
  /// @notice The maximum number of creators allowed per app.
  uint256 public constant MAX_CREATORS = 3;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  // ---------- Modifiers ---------- //

  /**
   * @dev Modifier to restrict access to only the admin role and the app admin role.
   * @param role the role to check
   * @param appId the app ID
   */
  modifier onlyRoleAndAppAdmin(bytes32 role, bytes32 appId) {
    if (!hasRole(role, msg.sender) && !isAppAdmin(appId, msg.sender)) {
      revert X2EarnUnauthorizedUser(msg.sender);
    }
    _;
  }

  /**
   * @dev Modifier to restrict access to only the admin role, the app admin role and the app moderator role.
   * @param role the role to check
   * @param appId the app ID
   */
  modifier onlyRoleAndAppAdminOrModerator(bytes32 role, bytes32 appId) {
    if (!hasRole(role, msg.sender) && !isAppAdmin(appId, msg.sender) && !isAppModerator(appId, msg.sender)) {
      revert X2EarnUnauthorizedUser(msg.sender);
    }
    _;
  }

  // ---------- UUPS ---------- //

  /**
   * @dev See {UUPSUpgradeable-_authorizeUpgrade}
   */
  function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}

  /**
   * @notice Returns the version of the contract
   * @dev This should be updated every time a new version of implementation is deployed
   * @return string The version of the contract
   */
  function version() public pure virtual returns (string memory) {
    return "8";
  }

  /**
   * @notice Initialize V8 flexible endorsement configuration.
   * @param _maxPointsPerNodePerApp Max points a node can endorse to one app (default 49).
   * @param _maxPointsPerApp Max total points an app can receive (default 110).
   */
  function initializeV8(uint256 _maxPointsPerNodePerApp, uint256 _maxPointsPerApp) external reinitializer(8) {
    EndorsementUtils.setMaxPointsPerNodePerApp(_maxPointsPerNodePerApp);
    EndorsementUtils.setMaxPointsPerApp(_maxPointsPerApp);
  }

  // ---------- Clock ---------- //
  function clock() public view virtual returns (uint48) {
    return Time.blockNumber();
  }

  function CLOCK_MODE() external view virtual returns (string memory) {
    if (clock() != Time.blockNumber()) {
      revert ERC6372InconsistentClock();
    }
    return "mode=blocknumber&from=default";
  }

  // ---------- App Storage Getters ---------- //

  /**
   * @dev See {IX2EarnApps-hashAppName}.
   */
  function hashAppName(string memory appName) external pure returns (bytes32) {
    return keccak256(abi.encodePacked(appName));
  }

  /**
   * @dev See {IX2EarnApps-appExists}.
   */
  function appExists(bytes32 appId) public view returns (bool) {
    return AppStorageUtils.appExists(appId);
  }

  /**
   * @dev See {IX2EarnApps-app}.
   */
  function app(bytes32 appId) public view returns (X2EarnAppsDataTypes.AppWithDetailsReturnType memory) {
    return AppStorageUtils.app(appId);
  }

  /**
   * @dev See {IX2EarnApps-apps}.
   */
  function apps() external view returns (X2EarnAppsDataTypes.AppWithDetailsReturnType[] memory) {
    return AppStorageUtils.apps();
  }

  /**
   * @dev See {IX2EarnApps-appURI}.
   */
  function appURI(bytes32 appId) external view returns (string memory) {
    if (!AppStorageUtils.appSubmitted(appId)) {
      revert X2EarnNonexistentApp(appId);
    }
    return string(abi.encodePacked(baseURI(), metadataURI(appId)));
  }

  // ---------- Vote Eligibility ---------- //

  /**
   * @dev See {IX2EarnApps-allEligibleApps}.
   */
  function allEligibleApps() external view returns (bytes32[] memory) {
    return X2EarnAppsStorageTypes._getVoteEligibilityStorage()._eligibleApps;
  }

  /**
   * @dev See {IX2EarnApps-isBlacklisted}.
   */
  function isBlacklisted(bytes32 appId) public view returns (bool) {
    return X2EarnAppsStorageTypes._getVoteEligibilityStorage()._blackList[appId];
  }

  /**
   * @dev See {IX2EarnApps-isEligible}.
   */
  function isEligible(bytes32 appId, uint256 timepoint) public view returns (bool) {
    return VoteEligibilityUtils.isEligible(appId, timepoint, appExists(appId), clock());
  }

  /**
   * @dev See {IX2EarnApps-isEligibleNow}.
   */
  function isEligibleNow(bytes32 appId) public view returns (bool) {
    if (!appExists(appId)) {
      return false;
    }
    return X2EarnAppsStorageTypes._getVoteEligibilityStorage()._isAppEligibleCheckpoints[appId].latest() == 1;
  }

  /**
   * @dev See {IX2EarnApps-setVotingEligibility}.
   */
  function setVotingEligibility(bytes32 _appId, bool _isEligible) external virtual onlyRole(GOVERNANCE_ROLE) {
    if (!AppStorageUtils.appSubmitted(_appId)) {
      revert X2EarnNonexistentApp(_appId);
    }

    if (appExists(_appId)) {
      _setVotingEligibility(_appId, _isEligible);
    }

    if (isAppUnendorsed(_appId) && !_isEligible) {
      EndorsementUtils.updateUnendorsedApps(_appId, true);
    }

    _isEligible ? _validateAppCreators(_appId) : _revokeAppCreators(_appId);
    _setBlacklist(_appId, !_isEligible);
  }

  // ---------- Administration ---------- //

  /**
   * @dev See {IX2EarnApps-appAdmin}.
   */
  function appAdmin(bytes32 appId) external view returns (address) {
    return X2EarnAppsStorageTypes._getAdministrationStorage()._admin[appId];
  }

  /**
   * @dev Check if an account is the admin of the app.
   * @param appId the hashed name of the app
   * @param account the address of the account
   */
  function isAppAdmin(bytes32 appId, address account) public view returns (bool) {
    return X2EarnAppsStorageTypes._getAdministrationStorage()._admin[appId] == account;
  }

  /**
   * @dev Returns the list of moderators of the app.
   * @param appId the hashed name of the app
   */
  function appModerators(bytes32 appId) external view returns (address[] memory) {
    return X2EarnAppsStorageTypes._getAdministrationStorage()._moderators[appId];
  }

  /**
   * @dev Returns true if an account is moderator of the app.
   * @param appId the hashed name of the app
   * @param account the address of the account
   */
  function isAppModerator(bytes32 appId, address account) public view returns (bool) {
    return
      AdministrationUtils.isAppModerator(
        X2EarnAppsStorageTypes._getAdministrationStorage()._moderators,
        appId,
        account
      );
  }

  /**
   * @dev Returns the list of creators of the app.
   * @param appId the hashed name of the app
   */
  function appCreators(bytes32 appId) external view returns (address[] memory) {
    return X2EarnAppsStorageTypes._getAdministrationStorage()._creators[appId];
  }

  /**
   * @dev Returns true if the creator has already been used for another app.
   * @param creator the address of the creator
   */
  function isCreatorOfAnyApp(address creator) public view returns (bool) {
    return X2EarnAppsStorageTypes._getAdministrationStorage()._creatorApps[creator] > 0;
  }

  /**
   * @dev Get the number of apps created by a creator.
   * @param creator the address of the creator
   */
  function creatorApps(address creator) external view returns (uint256) {
    return X2EarnAppsStorageTypes._getAdministrationStorage()._creatorApps[creator];
  }

  /**
   * @dev Get the address where the x2earn app receives allocation funds.
   * @param appId the hashed name of the app
   */
  function teamWalletAddress(bytes32 appId) external view returns (address) {
    return X2EarnAppsStorageTypes._getAdministrationStorage()._teamWalletAddress[appId];
  }

  /**
   * @dev Function to get the percentage of the allocation reserved for the team.
   * @param appId the app id
   */
  function teamAllocationPercentage(bytes32 appId) external view returns (uint256) {
    return X2EarnAppsStorageTypes._getAdministrationStorage()._teamAllocationPercentage[appId];
  }

  /**
   * @dev Returns the list of reward distributors of the app.
   * @param appId the hashed name of the app
   */
  function rewardDistributors(bytes32 appId) external view returns (address[] memory) {
    return X2EarnAppsStorageTypes._getAdministrationStorage()._rewardDistributors[appId];
  }

  /**
   * @dev Returns true if an account is a reward distributor of the app.
   * @param appId the hashed name of the app
   * @param account the address of the account
   */
  function isRewardDistributor(bytes32 appId, address account) external view returns (bool) {
    return
      AdministrationUtils.isRewardDistributor(
        X2EarnAppsStorageTypes._getAdministrationStorage()._rewardDistributors,
        appId,
        account
      );
  }

  /**
   * @dev Get the metadata URI of the app.
   * @param appId the app id
   */
  function metadataURI(bytes32 appId) public view returns (string memory) {
    return X2EarnAppsStorageTypes._getAdministrationStorage()._metadataURI[appId];
  }

  // ---------- Endorsement Getters ---------- //

  /**
   * @dev See {IX2EarnApps-gracePeriod}.
   * @return The current grace period duration in blocks.
   */
  function gracePeriod() public view returns (uint256) {
    return EndorsementUtils.gracePeriod();
  }

  /**
   * @dev See {IX2EarnApps-cooldownPeriod}.
   * @return The current cooldown period duration in rounds.
   */
  function cooldownPeriod() public view returns (uint256) {
    return EndorsementUtils.cooldownPeriod();
  }

  /**
   * @dev See {IX2EarnApps-endorsementScoreThreshold}.
   */
  function endorsementScoreThreshold() external view returns (uint256) {
    return EndorsementUtils.endorsementScoreThreshold();
  }

  /**
   * @dev See {IX2EarnApps-isAppUnendorsed}.
   * @param appId The unique identifier of the app.
   * @return True if the app is pending endorsement.
   */
  function isAppUnendorsed(bytes32 appId) public view returns (bool) {
    return EndorsementUtils.isAppUnendorsed(appId, isBlacklisted(appId));
  }

  /**
   * @dev See {IX2EarnApps-unendorsedAppIds}.
   */
  function unendorsedAppIds() external view returns (bytes32[] memory) {
    return EndorsementUtils.unendorsedAppIds();
  }

  /**
   * @dev See {IX2EarnApps-unendorsedApps}.
   */
  function unendorsedApps() external view returns (X2EarnAppsDataTypes.AppWithDetailsReturnType[] memory) {
    bytes32[] memory appIds = EndorsementUtils.unendorsedAppIds();
    return AppStorageUtils.getAppsInfo(appIds);
  }

  /**
   * @dev See {IX2EarnApps-getScore}.
   */
  function getScore(bytes32 appId) external view returns (uint256) {
    return EndorsementUtils.getScore(appId);
  }

  /**
   * @notice Returns the endorsement score for an app at a specific block number.
   * @param appId The unique identifier of the app.
   * @param timepoint The block number to query.
   * @return The endorsement score at the given timepoint.
   */
  function getScoreAtTimepoint(bytes32 appId, uint256 timepoint) external view returns (uint256) {
    return EndorsementUtils.getScoreAtTimepoint(appId, timepoint);
  }

  /**
   * @dev See {IX2EarnApps-getEndorsers}.
   */
  function getEndorsers(bytes32 appId) external view returns (address[] memory) {
    return EndorsementUtils.getEndorsers(appId);
  }

  /**
   * @notice Get all endorser node IDs for an app.
   */
  function getEndorserNodes(bytes32 appId) external view returns (uint256[] memory) {
    return EndorsementUtils.getEndorserNodes(appId);
  }

  /**
   * @dev See {IX2EarnApps-getUsersEndorsementScore}.
   */
  function getUsersEndorsementScore(address user) external view returns (uint256) {
    return EndorsementUtils.getUsersEndorsementScore(user);
  }

  /**
   * @dev See {IX2EarnApps-getNodeEndorsementScore}.
   */
  function getNodeEndorsementScore(uint256 nodeId) external view returns (uint256) {
    return EndorsementUtils.getNodeEndorsementScore(nodeId);
  }

  /**
   * @notice Returns the endorsement score of a node level.
   * @param nodeLevel The node level.
   * @return The endorsement score of the node level.
   */
  function nodeLevelEndorsementScore(uint8 nodeLevel) external view returns (uint256) {
    return EndorsementUtils.nodeLevelEndorsementScore(nodeLevel);
  }

  // ---------- Contract Settings ---------- //

  /**
   * @dev See {IX2EarnApps-baseURI}.
   */
  function baseURI() public view returns (string memory) {
    return X2EarnAppsStorageTypes._getContractSettingsStorage()._baseURI;
  }

  /**
   * @dev Update the base URI to retrieve the metadata of the x2earn apps.
   * @param _baseURI the base URI for the contract
   *
   * Emits a {BaseURIUpdated} event.
   */
  function setBaseURI(string memory _baseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
    X2EarnAppsStorageTypes.ContractSettingsStorage storage $ = X2EarnAppsStorageTypes._getContractSettingsStorage();
    emit BaseURIUpdated($._baseURI, _baseURI);
    $._baseURI = _baseURI;
  }

  // ---------- App Management ---------- //

  /**
   * @dev See {IX2EarnApps-submitApp}.
   */
  function submitApp(
    address _teamWalletAddress,
    address _admin,
    string memory _appName,
    string memory _appMetadataURI
  ) external virtual {
    if (X2EarnAppsStorageTypes._getAdministrationStorage()._x2EarnCreatorContract.balanceOf(msg.sender) == 0) {
      revert X2EarnUnverifiedCreator(msg.sender);
    }
    if (isCreatorOfAnyApp(msg.sender)) {
      revert CreatorNFTAlreadyUsed(msg.sender);
    }

    bytes32 id = AppStorageUtils.registerApp(_teamWalletAddress, _admin, _appName);

    _setAppAdmin(id, _admin);
    _updateTeamWalletAddress(id, _teamWalletAddress);
    _updateAppMetadata(id, _appMetadataURI);
    _setTeamAllocationPercentage(id, 0);
    EndorsementUtils.setEndorsementStatus(id, false);
    _addCreator(id, msg.sender);
    _enableRewardsPoolForNewApp(id);

    emit AppAdded(id, _teamWalletAddress, _appName, false);
  }

  /**
   * @dev See {IX2EarnApps-setAppAdmin}.
   */
  function setAppAdmin(bytes32 _appId, address _newAdmin) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    _setAppAdmin(_appId, _newAdmin);
  }

  /**
   * @dev See {IX2EarnApps-updateTeamWalletAddress}.
   */
  function updateTeamWalletAddress(
    bytes32 _appId,
    address _newReceiverAddress
  ) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    _updateTeamWalletAddress(_appId, _newReceiverAddress);
  }

  /**
   * @dev See {IX2EarnApps-setTeamAllocationPercentage}.
   */
  function setTeamAllocationPercentage(
    bytes32 _appId,
    uint256 _percentage
  ) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    _setTeamAllocationPercentage(_appId, _percentage);
  }

  /**
   * @dev See {IX2EarnApps-addAppModerator}.
   */
  function addAppModerator(
    bytes32 _appId,
    address _moderator
  ) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    AdministrationUtils.addAppModerator(_appId, _moderator, AppStorageUtils.appSubmitted(_appId), MAX_MODERATORS);
  }

  /**
   * @dev See {IX2EarnApps-removeAppModerator}.
   */
  function removeAppModerator(
    bytes32 _appId,
    address _moderator
  ) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    AdministrationUtils.removeAppModerator(_appId, _moderator, AppStorageUtils.appSubmitted(_appId));
  }

  /**
   * @dev See {IX2EarnApps-removeAppCreator}.
   */
  function removeAppCreator(bytes32 _appId, address _creator) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    AdministrationUtils.removeAppCreator(_appId, _creator, AppStorageUtils.appSubmitted(_appId));
  }

  /**
   * @dev See {IX2EarnApps-addCreator}.
   */
  function addCreator(bytes32 _appId, address _creator) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    _addCreator(_appId, _creator);
  }

  /**
   * @dev See {IX2EarnApps-addRewardDistributor}.
   */
  function addRewardDistributor(
    bytes32 _appId,
    address _distributor
  ) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    AdministrationUtils.addRewardDistributor(
      _appId,
      _distributor,
      AppStorageUtils.appSubmitted(_appId),
      MAX_REWARD_DISTRIBUTORS
    );
  }

  /**
   * @dev See {IX2EarnApps-removeRewardDistributor}.
   */
  function removeRewardDistributor(
    bytes32 _appId,
    address _distributor
  ) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    AdministrationUtils.removeRewardDistributor(_appId, _distributor, AppStorageUtils.appSubmitted(_appId));
  }

  /**
   * @dev See {IX2EarnApps-enableRewardsPoolForNewApp}.
   */
  function enableRewardsPoolForNewApp(bytes32 _appId) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _enableRewardsPoolForNewApp(_appId);
  }

  /**
   * @dev See {IX2EarnApps-updateAppMetadata}.
   */
  function updateAppMetadata(
    bytes32 _appId,
    string memory _newMetadataURI
  ) external onlyRoleAndAppAdminOrModerator(DEFAULT_ADMIN_ROLE, _appId) {
    _updateAppMetadata(_appId, _newMetadataURI);
  }

  // ---------- Endorsement Management ---------- //

  /**
   * @notice Endorses an app with a specified number of points.
   * @param appId The unique identifier of the app being endorsed.
   * @param nodeId The unique identifier of the node they wish to use for endorsing app.
   * @param points The number of points to endorse with (max 49 per app).
   */
  function endorseApp(bytes32 appId, uint256 nodeId, uint256 points) external {
    EndorsementUtils.endorseApp(appId, nodeId, points, isBlacklisted(appId), appExists(appId), isEligibleNow(appId));

    if (EndorsementUtils.getScore(appId) >= EndorsementUtils.endorsementScoreThreshold()) {
      if (!isEligibleNow(appId)) {
        _setVotingEligibility(appId, true);
      }
    }
  }

  /**
   * @notice Unendorses an app by removing a specified number of points.
   * @param appId The unique identifier of the app being unendorsed.
   * @param nodeId The unique identifier of the node that will unendorse.
   * @param points The number of points to remove (0 = remove all points).
   */
  function unendorseApp(bytes32 appId, uint256 nodeId, uint256 points) external {
    bool stillEligible = EndorsementUtils.unendorseApp(
      appId,
      nodeId,
      points,
      isBlacklisted(appId),
      isEligibleNow(appId),
      clock()
    );

    if (!stillEligible && isEligibleNow(appId)) {
      _setVotingEligibility(appId, false);
    }
  }

  /**
   * @dev See {IX2EarnApps-checkEndorsement}.
   */
  function checkEndorsement(bytes32 appId) external returns (bool) {
    bool stillEligible = EndorsementUtils.checkEndorsement(appId, clock());

    if (!stillEligible && isEligibleNow(appId)) {
      _setVotingEligibility(appId, false);
    }

    return stillEligible;
  }

  /**
   * @dev See {IX2EarnApps-removeNodeEndorsement}.
   * @notice This function can be called by an XAPP admin that wishes to remove an endorsement from a specific node ID.
   */
  function removeNodeEndorsement(
    bytes32 _appId,
    uint256 _nodeId
  ) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    bool stillEligible = EndorsementUtils.removeNodeEndorsement(
      _appId,
      _nodeId,
      isBlacklisted(_appId),
      isEligibleNow(_appId),
      clock()
    );

    if (!stillEligible && isEligibleNow(_appId)) {
      _setVotingEligibility(_appId, false);
    }
  }

  /**
   * @dev See {IX2EarnApps-removeXAppSubmission}.
   * @notice This function can be called by an XAPP admin or contract admin that wishes to remove an XAPP submission.
   */
  function removeXAppSubmission(bytes32 _appId) external onlyRoleAndAppAdmin(DEFAULT_ADMIN_ROLE, _appId) {
    EndorsementUtils.removeXAppSubmission(_appId);
  }

  // ---------- Governance Settings ---------- //

  /**
   * @dev See {IX2EarnApps-updateGracePeriod}.
   */
  function updateGracePeriod(uint48 _newGracePeriod) external onlyRole(GOVERNANCE_ROLE) {
    EndorsementUtils.setGracePeriod(_newGracePeriod);
  }

  /**
   * @dev See {IX2EarnApps-updateCooldownPeriod}.
   */
  function updateCooldownPeriod(uint256 _newCooldownPeriod) external onlyRole(GOVERNANCE_ROLE) {
    EndorsementUtils.setCooldownPeriod(_newCooldownPeriod);
  }

  /**
   * @dev See {IX2EarnApps-updateNodeEndorsementScores}.
   */
  function updateNodeEndorsementScores(
    EndorsementUtils.NodeStrengthScores calldata _nodeStrengthScores
  ) external onlyRole(GOVERNANCE_ROLE) {
    EndorsementUtils.updateNodeEndorsementScores(_nodeStrengthScores);
  }

  /**
   * @dev See {IX2EarnApps-updateEndorsementScoreThreshold}.
   */
  function updateEndorsementScoreThreshold(uint256 _scoreThreshold) external onlyRole(GOVERNANCE_ROLE) {
    EndorsementUtils.updateEndorsementScoreThreshold(_scoreThreshold);
  }

  // ---------- V8 Endorsement Management ---------- //

  /**
   * @notice Pause all endorsement operations. Used during migration.
   */
  function pauseEndorsements() external onlyRole(GOVERNANCE_ROLE) {
    EndorsementUtils.setEndorsementsPaused(true);
  }

  /**
   * @notice Unpause endorsement operations. Used after migration.
   */
  function unpauseEndorsements() external onlyRole(GOVERNANCE_ROLE) {
    EndorsementUtils.setEndorsementsPaused(false);
  }

  /**
   * @notice Mark migration as completed. One-time operation.
   */
  function markMigrationComplete() external onlyRole(GOVERNANCE_ROLE) {
    EndorsementUtils.setMigrationCompleted(true);
  }

  /**
   * @notice Seed endorsement data during migration. Governance only.
   * @param appId The app being endorsed.
   * @param nodeId The node endorsing the app.
   * @param points The number of points to endorse.
   */
  function seedEndorsement(bytes32 appId, uint256 nodeId, uint256 points) external onlyRole(MIGRATION_ROLE) {
    EndorsementUtils.seedEndorsement(appId, nodeId, points);
  }

  /**
   * @notice Set the maximum points a single node can endorse to one app.
   * @param maxPoints The new max (default 49).
   */
  function setMaxPointsPerNodePerApp(uint256 maxPoints) external onlyRole(GOVERNANCE_ROLE) {
    EndorsementUtils.setMaxPointsPerNodePerApp(maxPoints);
  }

  /**
   * @notice Set the maximum total endorsement points an app can receive.
   * @param maxPoints The new max (default 110).
   */
  function setMaxPointsPerApp(uint256 maxPoints) external onlyRole(GOVERNANCE_ROLE) {
    EndorsementUtils.setMaxPointsPerApp(maxPoints);
  }

  /**
   * @notice Get available endorsement points for a node.
   */
  function getNodeAvailablePoints(uint256 nodeId) external view returns (uint256) {
    return EndorsementUtils.getNodeAvailablePoints(nodeId);
  }

  /**
   * @notice Get comprehensive info about a node's endorsement points.
   */
  function getNodePointsInfo(uint256 nodeId) external view returns (X2EarnAppsStorageTypes.NodePointsInfo memory) {
    return EndorsementUtils.getNodePointsInfo(nodeId);
  }

  /**
   * @notice Get all active endorsements for a node.
   */
  function getNodeActiveEndorsements(
    uint256 nodeId
  ) external view returns (X2EarnAppsStorageTypes.Endorsement[] memory) {
    return EndorsementUtils.getNodeActiveEndorsements(nodeId);
  }

  /**
   * @notice Check if a node can unendorse an app (cooldown expired).
   */
  function canUnendorse(uint256 nodeId, bytes32 appId) external view returns (bool) {
    return EndorsementUtils.canUnendorse(nodeId, appId);
  }

  /**
   * @notice Get the max points per node per app.
   */
  function maxPointsPerNodePerApp() external view returns (uint256) {
    return EndorsementUtils.maxPointsPerNodePerApp();
  }

  /**
   * @notice Get the max points per app.
   */
  function maxPointsPerApp() external view returns (uint256) {
    return EndorsementUtils.maxPointsPerApp();
  }

  /**
   * @notice Check if endorsements are paused.
   */
  function endorsementsPaused() external view returns (bool) {
    return EndorsementUtils.endorsementsPaused();
  }

  /**
   * @notice Check if the V8 migration has been completed.
   */
  function migrationCompleted() external view returns (bool) {
    return EndorsementUtils.migrationCompleted();
  }

  /**
   * @notice Get how many points a node has allocated to a specific app.
   */
  function getNodePointsForApp(uint256 nodeId, bytes32 appId) external view returns (uint256) {
    return EndorsementUtils.getNodePointsForApp(nodeId, appId);
  }

  /**
   * @notice Get the total points a node has used across all endorsements.
   */
  function getNodeUsedPoints(uint256 nodeId) external view returns (uint256) {
    return EndorsementUtils.getNodeUsedPoints(nodeId);
  }

  // ---------- Internal Functions ---------- //

  /**
   * @dev Internal function to set the voting eligibility of an app.
   * @param appId the app id
   * @param canBeVoted the voting eligibility status
   */
  function _setVotingEligibility(bytes32 appId, bool canBeVoted) internal {
    VoteEligibilityUtils.updateVotingEligibility(appId, canBeVoted, isEligibleNow(appId), clock());
  }

  /**
   * @dev Set the app in the blacklist.
   * @param _appId the app id
   * @param _isBlacklisted true if the app should be blacklisted
   *
   * Emits a {BlacklistUpdated} event.
   */
  function _setBlacklist(bytes32 _appId, bool _isBlacklisted) internal {
    X2EarnAppsStorageTypes.VoteEligibilityStorage storage $ = X2EarnAppsStorageTypes._getVoteEligibilityStorage();
    $._blackList[_appId] = _isBlacklisted;
    emit BlacklistUpdated(_appId, _isBlacklisted);
  }

  /**
   * @dev Internal function to set the admin address of the app.
   * @param appId the hashed name of the app
   * @param newAdmin the address of the new admin
   */
  function _setAppAdmin(bytes32 appId, address newAdmin) internal {
    AdministrationUtils.setAppAdmin(appId, newAdmin, AppStorageUtils.appSubmitted(appId));
  }

  /**
   * @dev Update the address where the x2earn app receives allocation funds.
   * @param appId the hashed name of the app
   * @param newTeamWalletAddress the address of the new wallet where the team will receive the funds
   */
  function _updateTeamWalletAddress(bytes32 appId, address newTeamWalletAddress) internal {
    AdministrationUtils.updateTeamWalletAddress(appId, newTeamWalletAddress, AppStorageUtils.appSubmitted(appId));
  }

  /**
   * @dev Update the metadata URI of the app.
   * @param appId the hashed name of the app
   * @param newMetadataURI the metadata URI of the app
   *
   * Emits a {AppMetadataURIUpdated} event.
   */
  function _updateAppMetadata(bytes32 appId, string memory newMetadataURI) internal {
    AdministrationUtils.updateAppMetadata(appId, newMetadataURI, AppStorageUtils.appSubmitted(appId));
  }

  /**
   * @dev Update the allocation percentage to reserve for the team.
   * @param appId the app id
   * @param newAllocationPercentage the new allocation percentage
   */
  function _setTeamAllocationPercentage(bytes32 appId, uint256 newAllocationPercentage) internal {
    AdministrationUtils.setTeamAllocationPercentage(
      appId,
      newAllocationPercentage,
      AppStorageUtils.appSubmitted(appId)
    );
  }

  /**
   * @dev Internal function to add a creator to the app.
   * @param appId the hashed name of the app
   * @param creator the address of the creator
   */
  function _addCreator(bytes32 appId, address creator) internal {
    AdministrationUtils.addCreator(appId, creator, AppStorageUtils.appSubmitted(appId), MAX_CREATORS);
  }

  /**
   * @dev Internal function to enable the rewards pool for a new app by default.
   * @param appId the hashed name of the app
   */
  function _enableRewardsPoolForNewApp(bytes32 appId) internal {
    AdministrationUtils.enableRewardsPoolForNewApp(
      X2EarnAppsStorageTypes._getAdministrationStorage()._x2EarnRewardsPoolContract,
      appId
    );
  }

  /**
   * @dev Function to revoke all creator roles from an app and burn the creator NFTs.
   * @param appId the app id
   */
  function _revokeAppCreators(bytes32 appId) internal {
    if (!isBlacklisted(appId)) {
      AdministrationUtils.revokeAppCreators(appId);
    }
  }

  /**
   * @dev Function to validate all creator roles for an app and mint the creator NFTs.
   * @param appId the app id
   */
  function _validateAppCreators(bytes32 appId) internal {
    if (isBlacklisted(appId)) {
      AdministrationUtils.validateAppCreators(appId);
    }
  }
}
