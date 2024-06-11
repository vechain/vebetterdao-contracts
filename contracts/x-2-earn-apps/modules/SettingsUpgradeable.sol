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
 * @title SettingsUpgradeable
 * @dev Contract module that provides the settings functionalities of the x2earn apps.
 * Each app has a base URI that can be used to retrieve the metadata of the app. Eg: ipfs:// or some other gateway.
 */
abstract contract SettingsUpgradeable is Initializable, X2EarnAppsUpgradeable {
  /// @custom:storage-location erc7201:b3tr.storage.X2EarnApps.Settings
  struct SettingsStorage {
    string _baseURI;
  }

  // keccak256(abi.encode(uint256(keccak256("b3tr.storage.X2EarnApps.Settings")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant SettingsStorageLocation = 0x83b9a7e51f394efa93107c3888716138908bbbe611dfc86afa3639a826441100;

  function _getSettingsStorage() internal pure returns (SettingsStorage storage $) {
    assembly {
      $.slot := SettingsStorageLocation
    }
  }

  /**
   * @dev Sets the value for {baseURI}
   */
  function __Settings_init(string memory baseURI_) internal onlyInitializing {
    __Settings_init_unchained(baseURI_);
  }

  function __Settings_init_unchained(string memory baseURI_) internal onlyInitializing {
    SettingsStorage storage $ = _getSettingsStorage();
    $._baseURI = baseURI_;
  }

  // ---------- Setters ---------- //

  /**
   * @dev Update the base URI to retrieve the metadata of the x2earn apps
   *
   * @param baseURI_ the base URI for the contract
   *
   * Emits a {BaseURIUpdated} event.
   */
  function setBaseURI(string memory baseURI_) public virtual {
    _setBaseURI(baseURI_);
  }

  // ---------- Internal ---------- //

  /**
   * @dev Internal function to update the base URI to retrieve the metadata of the x2earn apps
   *
   * @param baseURI_ the base URI for the contract
   *
   * Emits a {BaseURIUpdated} event.
   */
  function _setBaseURI(string memory baseURI_) internal {
    SettingsStorage storage $ = _getSettingsStorage();

    emit BaseURIUpdated($._baseURI, baseURI_);

    $._baseURI = baseURI_;
  }

  // ---------- Getters ---------- //

  /**
   * @dev See {IX2EarnApps-baseURI}.
   */
  function baseURI() public view virtual override returns (string memory) {
    SettingsStorage storage $ = _getSettingsStorage();

    return $._baseURI;
  }
}
