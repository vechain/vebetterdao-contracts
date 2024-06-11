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

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { X2EarnAppsUpgradeable } from "../X2EarnAppsUpgradeable.sol";

/**
 * @title AdministrationUpgradeable
 * @dev Contract module that provides the administration functionalities of the x2earn apps.
 * Each app has an admin and a list of moderators that can manage the app.
 * The admin can add/remove moderators and change the admin address.
 * Those roles can be used to manage the app and its metadata.
 */
abstract contract AdministrationUpgradeable is Initializable, X2EarnAppsUpgradeable {
  /// @custom:storage-location erc7201:b3tr.storage.X2EarnApps.Administration
  struct AdministrationStorage {
    mapping(bytes32 appId => address[]) _moderators;
    mapping(bytes32 appId => address) _admin;
  }

  // keccak256(abi.encode(uint256(keccak256("b3tr.storage.X2EarnApps.Administration")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant AdministrationStorageLocation =
    0x5830f0e95c01712d916c34d9e2fa42e9f749b325b67bce7382d70bb99c623500;

  function _getAdministrationStorage() internal pure returns (AdministrationStorage storage $) {
    assembly {
      $.slot := AdministrationStorageLocation
    }
  }

  /**
   * @dev Initializes the contract
   */
  function __Administration_init() internal onlyInitializing {
    __Administration_init_unchained();
  }

  function __Administration_init_unchained() internal onlyInitializing {}

  // ---------- Setters ---------- //
  /**
   * @dev Internal function to set the admin address of the app
   *
   * @param appId the hashed name of the app
   * @param newAdmin the address of the new admin
   */
  function _setAppAdmin(bytes32 appId, address newAdmin) internal virtual override {
    if (!appExists(appId)) {
      revert X2EarnNonexistentApp(appId);
    }

    if (newAdmin == address(0)) {
      revert X2EarnInvalidAddress(newAdmin);
    }

    AdministrationStorage storage $ = _getAdministrationStorage();

    emit AppAdminUpdated(appId, $._admin[appId], newAdmin);

    $._admin[appId] = newAdmin;
  }

  /**
   * @dev Internal function to add a moderator to the app
   *
   * @param appId the hashed name of the app
   * @param moderator the address of the moderator
   */
  function _addAppModerator(bytes32 appId, address moderator) internal virtual override {
    if (moderator == address(0)) {
      revert X2EarnInvalidAddress(moderator);
    }

    if (!appExists(appId)) {
      revert X2EarnNonexistentApp(appId);
    }

    AdministrationStorage storage $ = _getAdministrationStorage();

    $._moderators[appId].push(moderator);

    emit ModeratorAddedToApp(appId, moderator);
  }

  /**
   * @dev Internal function to remove a moderator from the app
   *
   * @param appId the hashed name of the app
   * @param moderator the address of the moderator
   */
  function _removeAppModerator(bytes32 appId, address moderator) internal virtual override {
    if (moderator == address(0)) {
      revert X2EarnInvalidAddress(moderator);
    }

    if (!appExists(appId)) {
      revert X2EarnNonexistentApp(appId);
    }

    AdministrationStorage storage $ = _getAdministrationStorage();

    address[] storage moderators = $._moderators[appId];
    for (uint256 i = 0; i < moderators.length; i++) {
      if (moderators[i] == moderator) {
        moderators[i] = moderators[moderators.length - 1];
        moderators.pop();
        emit ModeratorRemovedFromApp(appId, moderator);
        break;
      }
    }
  }

  // ---------- Getters ---------- //

  /**
   * @dev Check if an account is the admin of the app
   *
   * @param appId the hashed name of the app
   * @param account the address of the account
   */
  function isAppAdmin(bytes32 appId, address account) public view returns (bool) {
    AdministrationStorage storage $ = _getAdministrationStorage();

    return $._admin[appId] == account;
  }

  /**
   * @dev See {IX2EarnApps-appAdmin}
   */
  function appAdmin(bytes32 appId) public view returns (address) {
    AdministrationStorage storage $ = _getAdministrationStorage();

    return $._admin[appId];
  }

  /**
   * @dev Returns the list of moderators of the app
   *
   * @param appId the hashed name of the app
   */
  function appModerators(bytes32 appId) public view returns (address[] memory) {
    AdministrationStorage storage $ = _getAdministrationStorage();

    return $._moderators[appId];
  }

  /**
   * @dev Returns true if an account is moderator of the app
   *
   * @param appId the hashed name of the app
   * @param account the address of the account
   */
  function isAppModerator(bytes32 appId, address account) public view returns (bool) {
    AdministrationStorage storage $ = _getAdministrationStorage();

    address[] memory moderators = $._moderators[appId];
    for (uint256 i = 0; i < moderators.length; i++) {
      if (moderators[i] == account) {
        return true;
      }
    }

    return false;
  }
}
