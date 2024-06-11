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

import { X2EarnAppsDataTypes } from "../../libraries/X2EarnAppsDataTypes.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { X2EarnAppsUpgradeable } from "../X2EarnAppsUpgradeable.sol";

/**
 * @title AppsStorageUpgradeable
 * @dev Contract to manage the x2earn apps storage.
 * Through this contract, the x2earn apps can be added, retrieved, indexed, and managed (update metadata and receiver address).
 */
abstract contract AppsStorageUpgradeable is Initializable, X2EarnAppsUpgradeable {
  /// @custom:storage-location erc7201:b3tr.storage.X2EarnApps.AppsStorage
  struct AppsStorageStorage {
    // Mapping from app ID to app
    mapping(bytes32 appId => X2EarnAppsDataTypes.App) _apps;
    // List of app IDs to enable retrieval of all _apps
    bytes32[] _appIds;
  }

  // keccak256(abi.encode(uint256(keccak256("b3tr.storage.X2EarnApps.AppsStorage")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant AppsStorageStorageLocation =
    0xb6909058bd527140b8d55a44344c5e42f1f148f1b3b16df7641882df8dd72900;

  function _getAppsStorageStorage() internal pure returns (AppsStorageStorage storage $) {
    assembly {
      $.slot := AppsStorageStorageLocation
    }
  }

  /**
   * @dev Initializes the contract
   */
  function __AppsStorage_init() internal onlyInitializing {
    __AppsStorage_init_unchained();
  }

  function __AppsStorage_init_unchained() internal onlyInitializing {}

  // ---------- Internal ---------- //

  /**
   * @dev Internal function that should add an app. Called by {addApp}.
   *
   * @param receiverAddress the address where the app should receive allocation funds
   * @param admin the address of the admin
   * @param appName the name of the app
   * @param metadataURI the metadata URI of the app
   *
   * Emits a {AppAdded} event.
   */
  function _addApp(
    address receiverAddress,
    address admin,
    string memory appName,
    string memory metadataURI
  ) internal virtual override {
    if (receiverAddress == address(0)) {
      revert X2EarnInvalidAddress(receiverAddress);
    }
    if (admin == address(0)) {
      revert X2EarnInvalidAddress(admin);
    }

    AppsStorageStorage storage $ = _getAppsStorageStorage();
    bytes32 id = hashAppName(appName);

    if (appExists(id)) {
      revert X2EarnAppAlreadyExists(id);
    }

    // Store the new app
    $._apps[id] = X2EarnAppsDataTypes.App(id, receiverAddress, appName, metadataURI, block.timestamp);
    $._appIds.push(id);
    _setAppAdmin(id, admin);
    _setVotingEligibility(id, true);

    emit AppAdded(id, receiverAddress, appName, true);
  }

  /**
   * @dev Update the metadata URI of the app
   *
   * @param appId the hashed name of the app
   * @param metadataURI the metadata URI of the app
   *
   * Emits a {AppMetadataURIUpdated} event.
   */
  function _updateAppMetadata(bytes32 appId, string memory metadataURI) internal virtual override {
    if (!appExists(appId)) {
      revert X2EarnNonexistentApp(appId);
    }

    AppsStorageStorage storage $ = _getAppsStorageStorage();
    $._apps[appId].metadataURI = metadataURI;

    emit AppMetadataURIUpdated(appId, $._apps[appId].metadataURI, metadataURI);
  }

  /**
   * @dev Update the address where the x2earn app receives allocation funds
   *
   * @param appId the hashed name of the app
   * @param newReceiverAddress the address of the new receiver
   */
  function _updateAppReceiverAddress(bytes32 appId, address newReceiverAddress) internal virtual override {
    if (newReceiverAddress == address(0)) {
      revert X2EarnInvalidAddress(newReceiverAddress);
    }

    if (!appExists(appId)) {
      revert X2EarnNonexistentApp(appId);
    }

    AppsStorageStorage storage $ = _getAppsStorageStorage();
    $._apps[appId].receiverAddress = newReceiverAddress;

    emit AppReceiverAddressUpdated(appId, $._apps[appId].receiverAddress, newReceiverAddress);
  }

  // ---------- Getters ---------- //
  /**
   * @dev See {IX2EarnApps-appExists}.
   */
  function appExists(bytes32 appId) public view override returns (bool) {
    AppsStorageStorage storage $ = _getAppsStorageStorage();

    return $._apps[appId].receiverAddress != address(0);
  }

  /**
   * @dev See {IX2EarnApps-app}.
   */
  function app(bytes32 appId) public view virtual returns (X2EarnAppsDataTypes.App memory) {
    if (!appExists(appId)) {
      revert X2EarnNonexistentApp(appId);
    }

    AppsStorageStorage storage $ = _getAppsStorageStorage();
    return $._apps[appId];
  }

  /**
   * @dev Get all apps
   */
  function apps() public view returns (X2EarnAppsDataTypes.App[] memory) {
    AppsStorageStorage storage $ = _getAppsStorageStorage();

    X2EarnAppsDataTypes.App[] memory allApps = new X2EarnAppsDataTypes.App[]($._appIds.length);
    uint256 length = $._appIds.length;
    for (uint i = 0; i < length; i++) {
      allApps[i] = $._apps[$._appIds[i]];
    }
    return allApps;
  }

  /**
   * @dev Get the receiver address of the app
   *
   * @param appId the hashed name of the app
   */
  function appReceiverAddress(bytes32 appId) public view virtual returns (address) {
    AppsStorageStorage storage $ = _getAppsStorageStorage();

    return $._apps[appId].receiverAddress;
  }

  /**
   * @dev Get the baseURI and metadata URI of the app concatenated
   *
   * @param appId the hashed name of the app
   */
  function appURI(bytes32 appId) public view returns (string memory) {
    if (!appExists(appId)) {
      revert X2EarnNonexistentApp(appId);
    }

    AppsStorageStorage storage $ = _getAppsStorageStorage();

    return string(abi.encodePacked(baseURI(), $._apps[appId].metadataURI));
  }
}
