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

import { X2EarnAppsDataTypes } from "../../libraries/X2EarnAppsDataTypes.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import { X2EarnAppsStorageTypes } from "./X2EarnAppsStorageTypes.sol";

/**
 * @title AppStorageUtils
 * @dev Utility library for managing app storage in X2EarnApps contract.
 */
library AppStorageUtils {
  using Checkpoints for Checkpoints.Trace208;
  error X2EarnInvalidStartIndex();
  error X2EarnNonexistentApp(bytes32 appId);
  error X2EarnAppAlreadyExists(bytes32 appId);
  error X2EarnInvalidAddress(address addr);
  error X2EarnUnverifiedCreator(address creator);
  error CreatorNFTAlreadyUsed(address creator);

  event AppAdded(bytes32 indexed id, address addr, string name, bool appAvailableForAllocationVoting);

  function appSubmitted(bytes32 appId) external view returns (bool) {
    return X2EarnAppsStorageTypes._getAppsStorageStorage()._apps[appId].id != bytes32(0);
  }

  function appExists(bytes32 appId) external view returns (bool) {
    return X2EarnAppsStorageTypes._getAppsStorageStorage()._apps[appId].createdAtTimestamp != 0;
  }

  function hashAppName(string memory appName) external pure returns (bytes32) {
    return keccak256(abi.encodePacked(appName));
  }

  function registerApp(address teamWalletAddr, address admin, string memory appName) external returns (bytes32) {
    X2EarnAppsStorageTypes.AppsStorageStorage storage $ = X2EarnAppsStorageTypes._getAppsStorageStorage();
    if (teamWalletAddr == address(0)) {
      revert X2EarnInvalidAddress(teamWalletAddr);
    }
    if (admin == address(0)) {
      revert X2EarnInvalidAddress(admin);
    }

    bytes32 id = keccak256(abi.encodePacked(appName));

    if ($._apps[id].id != bytes32(0)) {
      revert X2EarnAppAlreadyExists(id);
    }

    $._apps[id] = X2EarnAppsDataTypes.App(id, appName, 0);

    return id;
  }

  function getAppsInfo(
    bytes32[] memory appIds
  ) external view returns (X2EarnAppsDataTypes.AppWithDetailsReturnType[] memory) {
    X2EarnAppsStorageTypes.AppsStorageStorage storage $ = X2EarnAppsStorageTypes._getAppsStorageStorage();
    X2EarnAppsStorageTypes.AdministrationStorage storage adminStorage = X2EarnAppsStorageTypes
      ._getAdministrationStorage();
    X2EarnAppsStorageTypes.VoteEligibilityStorage storage voteStorage = X2EarnAppsStorageTypes
      ._getVoteEligibilityStorage();

    uint256 length = appIds.length;
    X2EarnAppsDataTypes.AppWithDetailsReturnType[] memory allApps = new X2EarnAppsDataTypes.AppWithDetailsReturnType[](
      length
    );

    for (uint i; i < length; i++) {
      X2EarnAppsDataTypes.App memory _app = $._apps[appIds[i]];
      bool appExistsNow = _app.createdAtTimestamp != 0;
      bool isEligibleNow = appExistsNow && voteStorage._isAppEligibleCheckpoints[_app.id].latest() == 1;

      allApps[i] = X2EarnAppsDataTypes.AppWithDetailsReturnType(
        _app.id,
        adminStorage._teamWalletAddress[_app.id],
        _app.name,
        adminStorage._metadataURI[_app.id],
        _app.createdAtTimestamp,
        isEligibleNow
      );
    }
    return allApps;
  }

  function app(bytes32 appId) external view returns (X2EarnAppsDataTypes.AppWithDetailsReturnType memory) {
    X2EarnAppsStorageTypes.AppsStorageStorage storage $ = X2EarnAppsStorageTypes._getAppsStorageStorage();
    X2EarnAppsStorageTypes.AdministrationStorage storage adminStorage = X2EarnAppsStorageTypes
      ._getAdministrationStorage();
    X2EarnAppsStorageTypes.VoteEligibilityStorage storage voteStorage = X2EarnAppsStorageTypes
      ._getVoteEligibilityStorage();

    if ($._apps[appId].id == bytes32(0)) {
      revert X2EarnNonexistentApp(appId);
    }

    X2EarnAppsDataTypes.App memory _app = $._apps[appId];
    bool appExistsNow = _app.createdAtTimestamp != 0;
    bool isEligibleNow = appExistsNow && voteStorage._isAppEligibleCheckpoints[appId].latest() == 1;

    return
      X2EarnAppsDataTypes.AppWithDetailsReturnType(
        _app.id,
        adminStorage._teamWalletAddress[appId],
        _app.name,
        adminStorage._metadataURI[appId],
        _app.createdAtTimestamp,
        isEligibleNow
      );
  }

  function apps() external view returns (X2EarnAppsDataTypes.AppWithDetailsReturnType[] memory) {
    X2EarnAppsStorageTypes.AppsStorageStorage storage $ = X2EarnAppsStorageTypes._getAppsStorageStorage();
    X2EarnAppsStorageTypes.AdministrationStorage storage adminStorage = X2EarnAppsStorageTypes
      ._getAdministrationStorage();
    X2EarnAppsStorageTypes.VoteEligibilityStorage storage voteStorage = X2EarnAppsStorageTypes
      ._getVoteEligibilityStorage();

    uint256 length = $._appIds.length;
    X2EarnAppsDataTypes.AppWithDetailsReturnType[] memory allApps = new X2EarnAppsDataTypes.AppWithDetailsReturnType[](
      length
    );

    for (uint i; i < length; i++) {
      bytes32 appId = $._appIds[i];
      X2EarnAppsDataTypes.App memory _app = $._apps[appId];
      bool appExistsNow = _app.createdAtTimestamp != 0;
      bool isEligibleNow = appExistsNow && voteStorage._isAppEligibleCheckpoints[appId].latest() == 1;

      allApps[i] = X2EarnAppsDataTypes.AppWithDetailsReturnType(
        _app.id,
        adminStorage._teamWalletAddress[appId],
        _app.name,
        adminStorage._metadataURI[appId],
        _app.createdAtTimestamp,
        isEligibleNow
      );
    }
    return allApps;
  }
}
