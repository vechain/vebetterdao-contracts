// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { X2EarnAppsDataTypes } from "../libraries/X2EarnAppsDataTypes.sol";
import { EndorsementUtils } from "../x-2-earn-apps/libraries/EndorsementUtils.sol";
import { X2EarnAppsStorageTypes } from "../x-2-earn-apps/libraries/X2EarnAppsStorageTypes.sol";
import { IX2EarnCreator } from "./IX2EarnCreator.sol";
import { IXAllocationVotingGovernor } from "./IXAllocationVotingGovernor.sol";
import { IX2EarnRewardsPool } from "./IX2EarnRewardsPool.sol";
import { IStargateNFT } from "../mocks/Stargate/interfaces/IStargateNFT.sol";

/**
 * @title IX2EarnApps
 * @notice Interface for the X2EarnApps contract.
 * @dev The contract inheriting this interface should be able to manage the x2earn apps and their Eligibility for allocation voting.
 */
interface IX2EarnApps {
  /**
   * @dev The clock was incorrectly modified.
   */
  error ERC6372InconsistentClock();

  /**
   * @dev The `appId` doesn't exist.
   */
  error X2EarnNonexistentApp(bytes32 appId);

  /**
   * @dev The creator of the app doesn't exist.
   */
  error X2EarnNonexistentCreator(bytes32 appId, address creator);

  /**
   * @dev The `addr` is not valid (eg: is the ZERO ADDRESS).
   */
  error X2EarnInvalidAddress(address addr);

  /**
   * @dev The caller is already an endorser.
   */
  error X2EarnAlreadyEndorser();

  /**
   * @dev The caller is not a node holder.
   */
  error X2EarnNonNodeHolder();

  /**
   * @dev The caller is not an endorser.
   */
  error X2EarnNonEndorser();

  /**
   * @dev The `appId` is already endorsed.
   */
  error X2EarnAppAlreadyEndorsed(bytes32 appId);

  /**
   * @dev An app with the specified `appId` already exists.
   */
  error X2EarnAppAlreadyExists(bytes32 appId);

  /**
   * @dev The Vechain Node is in a cooldown period, and the action cannot be performed.
   */
  error X2EarnNodeCooldownActive();

  /**
   * @dev The user is not authorized to perform the action.
   */
  error X2EarnUnauthorizedUser(address user);

  /**
   * @dev The maximum number of creators has been reached.
   */
  error X2EarnMaxCreatorsReached(bytes32 appId);

  /**
   * @dev The caller is already the creator of the app.
   */
  error X2EarnAlreadyCreator(address creator);

  /**
   * @dev The caller is an unverified creator.
   */
  error X2EarnUnverifiedCreator(address creator);

  /**
   * @dev The creator NFT is already used for another app.
   */
  error CreatorNFTAlreadyUsed(address creator);

  /**
   * @dev Invalid start index for get apps pagination
   */
  error X2EarnInvalidStartIndex();

  /**
   * @notice Error indicating that an XAPP has already been included in a XAllocation Voting round and submission cant be removed.
   */
  error NodeManagementXAppAlreadyIncluded(bytes32 appId);

  /**
   * @dev Lookup to future votes is not available.
   */
  error ERC5805FutureLookup(uint256 timepoint, uint48 clock);

  /**
   * @dev The `percentage` is not valid.
   */
  error X2EarnInvalidAllocationPercentage(uint256 percentage);

  /**
   * @dev The `distributorAddress` is not valid.
   */
  error X2EarnNonexistentRewardDistributor(bytes32 appId, address distributorAddress);

  /**
   * @dev The `moderator` is not valid.
   */
  error X2EarnNonexistentModerator(bytes32 appId, address moderator);

  /**
   * @dev The maximum number of moderators has been reached.
   */
  error X2EarnMaxModeratorsReached(bytes32 appId);

  /**
   * @dev The app is blacklisted.
   */
  error X2EarnAppBlacklisted(bytes32 appId);

  /**
   * @dev The maximum number of reward distributors has been reached.
   */
  error X2EarnMaxRewardDistributorsReached(bytes32 appId);

  /**
   * @dev The maximum number of managers has been reached.
   */
  error X2EarnMaxManagersReached(bytes32 appId);

  /**
   * @dev The user has a node that cannot be used to endorse
   */
  error NodeNotAllowedToEndorse();

  // V8 errors
  /**
   * @dev Endorsements are currently paused (during migration).
   */
  error EndorsementsPaused();

  /**
   * @dev Cooldown period not expired for the specified node-app endorsement.
   */
  error CooldownNotExpired(uint256 nodeId, bytes32 appId);

  /**
   * @dev Exceeds maximum points allowed per app.
   */
  error ExceedsMaxPointsPerApp(bytes32 appId, uint256 current, uint256 max);

  /**
   * @dev Exceeds maximum points a single node can endorse to one app.
   */
  error ExceedsMaxPointsPerNode(uint256 nodeId, bytes32 appId, uint256 max);

  /**
   * @dev Node doesn't have enough available points.
   */
  error InsufficientAvailablePoints(uint256 nodeId, uint256 available, uint256 requested);

  /**
   * @dev Invalid points amount provided.
   */
  error InvalidPointsAmount();

  /**
   * @dev Event fired when a new app is added.
   */
  event AppAdded(bytes32 indexed id, address addr, string name, bool appAvailableForAllocationVoting);

  /**
   * @dev Event fired when an app Eligibility for allocation voting changes.
   */
  event VotingEligibilityUpdated(bytes32 indexed appId, bool isAvailable);

  /**
   * @dev Event fired when an app is blacklisted or unblacklisted.
   */
  event BlacklistUpdated(bytes32 indexed appId, bool isBlacklisted);

  /**
   * @dev Event fired when the score threshold is updated.
   */
  event EndorsementScoreThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

  /**
   * @dev Event fired when the admin adds a new moderator to the app.
   */
  event ModeratorAddedToApp(bytes32 indexed appId, address moderator);

  /**
   * @dev Event fired when the admin removes a moderator from the app.
   */
  event ModeratorRemovedFromApp(bytes32 indexed appId, address moderator);

  /**
   * @dev Event fired when the admin removes a creator from the app.
   */
  event CreatorRemovedFromApp(bytes32 indexed appId, address creator);

  /**
   * @dev Event fired when the admin adds a new creator to the app and new creator NFT is minted.
   */
  event CreatorAddedToApp(bytes32 indexed appId, address creatorAddress);

  /**
   * @dev Event fired when the admin adds a new reward distributor to the app.
   */
  event RewardDistributorAddedToApp(bytes32 indexed appId, address distributorAddress);

  /**
   * @dev Event fired when the admin removes a reward distributor from the app.
   */
  event RewardDistributorRemovedFromApp(bytes32 indexed appId, address distributorAddress);

  /**
   * @dev Event fired when the admin of an app changes.
   */
  event AppAdminUpdated(bytes32 indexed appId, address oldAdmin, address newAdmin);

  /**
   * @dev Event fired when the address where the x2earn app receives allocation funds is changed.
   */
  event TeamWalletAddressUpdated(bytes32 indexed appId, address oldTeamWalletAddress, address newTeamWalletAddress);

  /**
   * @dev Event fired when the metadata URI of the app is changed.
   */
  event AppMetadataURIUpdated(bytes32 indexed appId, string oldMetadataURI, string newMetadataURI);

  /**
   * @dev Event fired when the base URI is updated.
   */
  event BaseURIUpdated(string oldBaseURI, string newBaseURI);

  /**
   * @dev Event fired when the cooldown period duration is updated.
   */
  event CooldownPeriodUpdated(uint256 oldCooldownPeriod, uint256 newCooldownPeriod);

  /**
   * @dev Event fired when the grace period duration is updated.
   */
  event GracePeriodUpdated(uint256 oldGracePeriod, uint256 newGracePeriod);

  /**
   * @dev Event fired when the app endorsement status is updated.
   */
  event AppEndorsementStatusUpdated(bytes32 indexed appId, bool endorsed);

  /**
   * @dev Event fired when the app endorsement grace period is started.
   */
  event AppUnendorsedGracePeriodStarted(bytes32 indexed appId, uint48 startBlock, uint48 endBlock);

  /**
   * @dev Event fired when the team allocation percentage is updated.
   */
  event TeamAllocationPercentageUpdated(bytes32 indexed appId, uint256 oldPercentage, uint256 newPercentage);

  /**
   * @dev V8: Event fired when an app is endorsed with points.
   */
  event AppEndorsed(bytes32 indexed appId, uint256 indexed nodeId, address endorser, uint256 points);

  /**
   * @dev V8: Event fired when an app is unendorsed.
   */
  event AppUnendorsed(bytes32 indexed appId, uint256 indexed nodeId, uint256 points);

  /**
   * @dev V8: Event fired when endorsements paused state changes.
   */
  event EndorsementsPausedUpdated(bool paused);

  /**
   * @dev V8: Event fired when max points per node per app is updated.
   */
  event MaxPointsPerNodePerAppUpdated(uint256 oldMax, uint256 newMax);

  /**
   * @dev V8: Event fired when max points per app is updated.
   */
  event MaxPointsPerAppUpdated(uint256 oldMax, uint256 newMax);

  /**
   * @dev Event fired when the node strength scores are updated.
   */
  event NodeStrengthScoresUpdated(EndorsementUtils.NodeStrengthScores indexed nodeStrengthScores);

  /**
   * @dev Generates the hash of the app name to be used as the app id.
   *
   * @param name the name of the app
   */
  function hashAppName(string memory name) external pure returns (bytes32);

  /**
   * @dev Get the app data by its id.
   *
   * @param appId the id of the app
   */
  function app(bytes32 appId) external view returns (X2EarnAppsDataTypes.AppWithDetailsReturnType memory);

  /**
   * @notice Get all the apps that exist in the VeBetter DAO ecosystem.
   * @dev An XApp must have been included in at least one allocation round to be considered an existing app.
   */
  function apps() external view returns (X2EarnAppsDataTypes.AppWithDetailsReturnType[] memory);

  /**
   * @dev Add a new moderator to the app.
   *
   * @param appId the id of the app
   * @param moderator the address of the moderator
   *
   * Emits a {ModeratorAddedToApp} event.
   */
  function addAppModerator(bytes32 appId, address moderator) external;

  /**
   * @dev Remove a moderator from the app.
   *
   * @param appId the id of the app
   * @param moderator the address of the moderator
   *
   * Emits a {ModeratorRemovedFromApp} event.
   */
  function removeAppModerator(bytes32 appId, address moderator) external;

  /**
   * @dev Set the app admin.
   *
   * @param appId the id of the app
   * @param admin the address of the admin
   *
   * Emits a {AppAdminUpdated} event.
   */
  function setAppAdmin(bytes32 appId, address admin) external;

  /**
   * @dev Add a new creator to the app.
   *
   * @param appId the id of the app
   * @param creator the address of the creator
   *
   * Emits a {CreatorAddedToApp} event.
   */
  function addCreator(bytes32 appId, address creator) external;

  /**
   * @dev Check if a creator has already been used for another app.
   *
   * @param creator the address of the creator
   */
  function isCreatorOfAnyApp(address creator) external returns (bool);

  /**
   * @dev Remove a creator from the app.
   *
   * @param appId the id of the app
   * @param creator the address of the creator
   *
   * Emits a {CreatorRemovedFromApp} event.
   */
  function removeAppCreator(bytes32 appId, address creator) external;

  /**
   * @dev Get the creators of an app.
   *
   * @param appId the id of the app
   */
  function appCreators(bytes32 appId) external view returns (address[] memory);

  /**
   * @dev Get the number of apps created by an account.
   *
   * @param creator the address of the creator
   */
  function creatorApps(address creator) external view returns (uint256);

  /**
   * @dev Get the app admin.
   *
   * @param appId the id of the app
   */
  function appAdmin(bytes32 appId) external view returns (address);

  /**
   * @dev Check if an account is the admin of the app
   *
   * @param appId the hashed name of the app
   * @param account the address of the account
   */
  function isAppAdmin(bytes32 appId, address account) external view returns (bool);

  /**
   * @dev Update the address where the x2earn app receives allocation funds.
   *
   * @param appId the id of the app
   * @param newTeamWalletAddress the new address where the app should receive allocation funds
   *
   * Emits a {TeamWalletAddressUpdated} event.
   */
  function updateTeamWalletAddress(bytes32 appId, address newTeamWalletAddress) external;

  /**
   * @dev Get the address where the x2earn app receives allocation funds.
   *
   * @param appId the id of the app
   */
  function teamWalletAddress(bytes32 appId) external view returns (address);

  /**
   * @dev Function to get the percentage of the allocation sent to the team address each round.
   *
   * @param appId the app id
   */
  function teamAllocationPercentage(bytes32 appId) external view returns (uint256);

  /**
   * @dev Update the allocation percentage to be sent to the team
   *
   * @param appId the id of the app
   * @param percentage the new percentage of the allocation
   */
  function setTeamAllocationPercentage(bytes32 appId, uint256 percentage) external;

  /**
   * @dev Add a new reward distributor to the app.
   *
   * @param appId the id of the app
   * @param distributorAddress the address of the reward distributor
   *
   * Emits a {RewardDistributorAddedToApp} event.
   */
  function addRewardDistributor(bytes32 appId, address distributorAddress) external;

  /**
   * @dev Remove a reward distributor from the app.
   *
   * @param appId the id of the app
   * @param distributorAddress the address of the reward distributor
   *
   * Emits a {RewardDistributorRemovedFromApp} event.
   */
  function removeRewardDistributor(bytes32 appId, address distributorAddress) external;

  /**
   * @dev Returns true if an account is a reward distributor of the app
   *
   * @param appId the id of the app
   * @param distributorAddress the address of the account
   */
  function isRewardDistributor(bytes32 appId, address distributorAddress) external view returns (bool);

  /**
   * @dev Enable the rewards pool for a new app.
   *
   * @param appId the id of the app
   */
  function enableRewardsPoolForNewApp(bytes32 appId) external;

  /**
   * @notice Checks endorsements for a given app and updates its voting eligibility based on the endorsements' scores.
   *
   * @dev This function is intended to be called by a cron job prior to the start of each voting round.
   * If the app has less than 100 points, the grace period elasped is checked.
   * If the grace period elapsed by the app is greater than the threshold grace period, the app is marked as not eligible for voting.
   * If an endorser has lost its node status (level 0), it is removed from the endorsers list.
   *
   * @param appId The unique identifier of the app being checked.
   * @return True if the app is eligible for voting.
   */
  function checkEndorsement(bytes32 appId) external returns (bool);

  /**
   * @dev Update the metadata URI of the app.
   *
   * @param appId the id of the app
   * @param metadataURI the new metadata URI of the app containing details about the app
   *
   * Emits a {AppMetadataURIUpdated} event.
   */
  function updateAppMetadata(bytes32 appId, string memory metadataURI) external;

  /**
   * @dev Check if there is an app with the specified `appId`.
   * @dev This function should be used to check if an app exists is part of the VeBetter DAO ecosystem.
   * @notice An app is considered to exist if it has been included in at least one allocation round.
   *
   * @param appId the id of the app
   */
  function appExists(bytes32 appId) external view returns (bool);

  /**
   * @dev Check if an app is blacklisted.
   *
   * @param appId the id of the app
   */
  function isBlacklisted(bytes32 appId) external view returns (bool);

  /**
   * @dev Allow or deny an app to participate in the next allocation voting rounds.
   *
   * @param _appId the id of the app
   * @param _isEligible true if the app should be eligible for voting, false otherwise
   *
   * Emits a {VotingEligibilityUpdated} event.
   */
  function setVotingEligibility(bytes32 _appId, bool _isEligible) external;

  /**
   * @dev Get all the app ids that are eligible for voting in the next allocation rounds.
   */
  function allEligibleApps() external view returns (bytes32[] memory);

  /**
   * @dev Check if an app was allowed to participate in the allocation rounds in a specific timepoint.
   * XAllocationVoting contract can use this function to check if an app was eligible for voting in the block when the round starts.
   *
   * @param appId the id of the app
   * @param timepoint the timepoint when the app should be checked for Eligibility
   */
  function isEligible(bytes32 appId, uint256 timepoint) external view returns (bool);

  /**
   * @dev return the base URI for the contract
   */
  function baseURI() external view returns (string memory);

  /**
   * @dev return the grace period for an XApp to find new endorsers after the previous one was removed.
   */
  function gracePeriod() external view returns (uint256);

  /**
   * @dev return true if an app is pending for endorsement.
   */
  function isAppUnendorsed(bytes32 appId) external view returns (bool);

  /**
   * @notice Gets the ids of all apps that are looking for endorsement.
   * @return the ids of the apps that are pending for endorsement
   */
  function unendorsedAppIds() external view returns (bytes32[] memory);

  /**
   * @notice Gets the information about all apps that are looking for endorsement.
   * @return the information about the apps that are pending for endorsement
   */
  function unendorsedApps() external view returns (X2EarnAppsDataTypes.AppWithDetailsReturnType[] memory);

  /**
   * @dev Get the endorsement score of an app.
   *
   * @param appId the id of the app
   */
  function getScore(bytes32 appId) external returns (uint256);

  /**
   * @notice Returns the endorsement score for an app at a specific block number.
   * @param appId The unique identifier of the app.
   * @param timepoint The block number to query.
   * @return The endorsement score at the given timepoint.
   */
  function getScoreAtTimepoint(bytes32 appId, uint256 timepoint) external view returns (uint256);

  /**
   * @dev Get the endorsers of an app.
   *
   * @param appId the id of the app
   */
  function getEndorsers(bytes32 appId) external view returns (address[] memory);

  /**
   * @notice Get all endorser node IDs for an app.
   */
  function getEndorserNodes(bytes32 appId) external view returns (uint256[] memory);

  /**
   * @dev Get the endorsersment score of an individual.
   *
   * @param user the address of the user who holds a NODE
   */
  function getUsersEndorsementScore(address user) external view returns (uint256);

  /**
   * @dev Get the endorsersment score of a node ID.
   *
   * @param nodeId the ID of a node.
   */
  function getNodeEndorsementScore(uint256 nodeId) external view returns (uint256);

  /**
   * @notice Get the version of the contract.
   * @dev This should be updated every time a new version of implementation is deployed.
   */
  function version() external view returns (string memory);

  /**
   * @dev Register a new app.
   *
   * @param _teamWalletAddress the address where the app will receive the allocation funds
   * @param _admin the address of the admin
   * @param _appName the name of the app
   * @param _appMetadataURI the metadata URI of the app
   *
   * Emits a {AppAdded} event.
   */
  function submitApp(
    address _teamWalletAddress,
    address _admin,
    string memory _appName,
    string memory _appMetadataURI
  ) external;

  /**
   * @dev Update the the endorsement scores of each node level.
   *
   * @param _nodeStrengthScores The node level scores to update.
   *
   * Emits a {NodeStrengthScoreUpdated} event.
   */
  function updateNodeEndorsementScores(EndorsementUtils.NodeStrengthScores calldata _nodeStrengthScores) external;

  /**
   * @notice Update the endorsement score threshold
   * @dev This should be minimum endorsement score required for an app to be eligible for voting.
   *
   * @param _scoreThreshold the new score threshold
   *
   * Emits a {EndorsementScoreThresholdUpdated} event.
   */

  function updateEndorsementScoreThreshold(uint256 _scoreThreshold) external;

  /**
   * @notice This function can be called by an XAPP admin that wishes to remove an endorserment from a specific node ID
   * @dev Can only be valled by DEFAULT_ADMIN or XAPP admin
   * @param _appId The unique identifier of the app that wishes to be unendorsed.
   * @param _nodeId The unique identifier of the node they wish to remove from their list of endorsers.
   */
  function removeNodeEndorsement(bytes32 _appId, uint256 _nodeId) external;

  /**
   * @dev Get the score threshold.
   */
  function endorsementScoreThreshold() external view returns (uint256);

  /**
   * @dev Remove an XApps submission.
   */
  function removeXAppSubmission(bytes32 _appId) external;

  /**
   * @notice this function returns the endorsement score of a node level
   * @param nodeLevel The strength level of the node.
   * @return uint256 The endorsement score of the node level.
   */
  function nodeLevelEndorsementScore(uint8 nodeLevel) external view returns (uint256);

  /**
   * @dev Get the cooldown period for a node in seconds.
   */
  function cooldownPeriod() external view returns (uint256);

  /**
   * @notice Function to update the grace period.
   * @param _newGracePeriod The new grace period.
   * Emits a {GracePeriodUpdated} event.
   */
  function updateGracePeriod(uint48 _newGracePeriod) external;

  /**
   * @notice Function to update the cooldown period.
   * @param _newCooldownPeriod The new cooldown period.
   * Emits a {CooldownPeriodUpdated} event.
   */
  function updateCooldownPeriod(uint256 _newCooldownPeriod) external;

  // ---------- V8 Flexible Endorsement ---------- //

  /**
   * @notice Endorse an app with a specified number of points.
   * @param appId The app to endorse.
   * @param nodeId The node endorsing.
   * @param points Number of points to endorse.
   */
  function endorseApp(bytes32 appId, uint256 nodeId, uint256 points) external;

  /**
   * @notice Unendorse an app by removing points.
   * @param appId The app to unendorse.
   * @param nodeId The node unendorsing.
   * @param points Number of points to remove (0 = remove all).
   */
  function unendorseApp(bytes32 appId, uint256 nodeId, uint256 points) external;

  /**
   * @notice Pause endorsement operations.
   */
  function pauseEndorsements() external;

  /**
   * @notice Unpause endorsement operations.
   */
  function unpauseEndorsements() external;

  /**
   * @notice Seed endorsement during migration.
   */
  function seedEndorsement(bytes32 appId, uint256 nodeId, uint256 points) external;

  /**
   * @notice Mark migration as complete.
   */
  function markMigrationComplete() external;

  /**
   * @notice Set max points per node per app.
   */
  function setMaxPointsPerNodePerApp(uint256 maxPoints) external;

  /**
   * @notice Set max total points per app.
   */
  function setMaxPointsPerApp(uint256 maxPoints) external;

  /**
   * @notice Get available endorsement points for a node.
   */
  function getNodeAvailablePoints(uint256 nodeId) external view returns (uint256);

  /**
   * @notice Get comprehensive info about a node's endorsement points.
   */
  function getNodePointsInfo(uint256 nodeId) external view returns (X2EarnAppsStorageTypes.NodePointsInfo memory);

  /**
   * @notice Get all active endorsements for a node.
   */
  function getNodeActiveEndorsements(
    uint256 nodeId
  ) external view returns (X2EarnAppsStorageTypes.Endorsement[] memory);

  /**
   * @notice Check if node can unendorse an app (cooldown expired).
   */
  function canUnendorse(uint256 nodeId, bytes32 appId) external view returns (bool);

  /**
   * @notice Get max points per node per app.
   */
  function maxPointsPerNodePerApp() external view returns (uint256);

  /**
   * @notice Get max points per app.
   */
  function maxPointsPerApp() external view returns (uint256);

  /**
   * @notice Check if endorsements are paused.
   */
  function endorsementsPaused() external view returns (bool);

  /**
   * @notice V8 initializer for flexible endorsement config.
   */
  function initializeV8(uint256 _maxPointsPerNodePerApp, uint256 _maxPointsPerApp) external;
}
