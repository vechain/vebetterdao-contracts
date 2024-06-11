// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { X2EarnAppsDataTypes } from "../libraries/X2EarnAppsDataTypes.sol";

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
   * @dev The `addr` is not valid (eg: is the ZERO ADDRESS).
   */
  error X2EarnInvalidAddress(address addr);

  /**
   * @dev An app with the specified `appId` already exists.
   */
  error X2EarnAppAlreadyExists(bytes32 appId);

  /**
   * @dev The user is not authorized to perform the action.
   */
  error X2EarnUnauthorizedUser(address user);

  /**
   * @dev Lookup to future votes is not available.
   */
  error ERC5805FutureLookup(uint256 timepoint, uint48 clock);

  /**
   * @dev Event fired when a new app is added.
   */
  event AppAdded(bytes32 indexed id, address addr, string name, bool appAvailableForAllocationVoting);

  /**
   * @dev Event fired when an app Eligibility for allocation voting changes.
   */
  event VotingEligibilityUpdated(bytes32 indexed appId, bool isAvailable);

  /**
   * @dev Event fired when the admin adds a new moderator to the app.
   */
  event ModeratorAddedToApp(bytes32 indexed appId, address moderator);

  /**
   * @dev Event fired when the admin removes a moderator from the app.
   */
  event ModeratorRemovedFromApp(bytes32 indexed appId, address moderator);

  /**
   * @dev Event fired when the admin of an app changes.
   */
  event AppAdminUpdated(bytes32 indexed appId, address oldAdmin, address newAdmin);

  /**
   * @dev Event fired when the address where the x2earn app receives allocation funds is changed.
   */
  event AppReceiverAddressUpdated(bytes32 indexed appId, address oldReceiverAddress, address newReceiverAddress);

  /**
   * @dev Event fired when the metadata URI of the app is changed.
   */
  event AppMetadataURIUpdated(bytes32 indexed appId, string oldMetadataURI, string newMetadataURI);

  /**
   * @dev Event fired when the base URI is updated.
   */
  event BaseURIUpdated(string oldBaseURI, string newBaseURI);

  /**
   * @dev Generates the hash of the app name to be used as the app id.
   *
   * @param name the name of the app
   */
  function hashAppName(string memory name) external pure returns (bytes32);

  /**
   * @dev Add a new app to the x2earn apps.
   *
   * @param receiverAddress the address where the app should receive allocation funds
   * @param admin the address of the admin that will be able to manage the app and perform all administration actions
   * @param appName the name of the app
   * @param metadataURI the metadata URI of the app
   *
   * Emits a {AppAdded} event.
   */
  function addApp(address receiverAddress, address admin, string memory appName, string memory metadataURI) external;

  /**
   * @dev Get the app data by its id.
   *
   * @param appId the id of the app
   */
  function app(bytes32 appId) external view returns (X2EarnAppsDataTypes.App memory);

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
   * @dev Get the app admin.
   *
   * @param appId the id of the app
   */
  function appAdmin(bytes32 appId) external view returns (address);

  /**
   * @dev Update the address where the x2earn app receives allocation funds.
   *
   * @param appId the id of the app
   * @param newReceiverAddress the new address where the app should receive allocation funds
   *
   * Emits a {AppReceiverAddressUpdated} event.
   */
  function updateAppReceiverAddress(bytes32 appId, address newReceiverAddress) external;

  /**
   * @dev Get the address where the x2earn app receives allocation funds.
   *
   * @param appId the id of the app
   */
  function appReceiverAddress(bytes32 appId) external view returns (address);

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
   *
   * @param appId the id of the app
   */
  function appExists(bytes32 appId) external view returns (bool);

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
   * @notice Get the version of the contract.
   * @dev This should be updated every time a new version of implementation is deployed.
   */
  function version() external view returns (string memory);
}
