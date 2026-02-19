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

import { PassportTypes } from "../../ve-better-passport/libraries/PassportTypes.sol";
import { IVeBetterPassport } from "../../interfaces/IVeBetterPassport.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { X2EarnAppsStorageTypes } from "./X2EarnAppsStorageTypes.sol";

/**
 * @title VoteEligibilityUtils
 * @dev Utility library for managing voting eligibility status for applications within the system.
 * This library manages eligibility checkpoints, allowing for efficient tracking of voting eligibility
 * changes over time. Eligibility is tracked via Checkpoints to enable time-based queries.
 */
library VoteEligibilityUtils {
  using Checkpoints for Checkpoints.Trace208; // Checkpoints used to track eligibility changes over time

  /**
   * @dev Emitted when an app's eligibility for allocation voting changes.
   * @param appId The unique identifier of the app whose eligibility status was updated.
   * @param isAvailable The new eligibility status for the app.
   */
  event VotingEligibilityUpdated(bytes32 indexed appId, bool isAvailable);

  /**
   * @notice Error for when a future timepoint lookup is requested.
   * @param timepoint The requested timepoint for eligibility lookup.
   * @param clock The current timepoint.
   */
  error ERC5805FutureLookup(uint256 timepoint, uint48 clock);

  // ------------------------------- Setter Functions -------------------------------
  /**
   * @notice Updates an app's voting eligibility checkpoint.
   * @param appId The ID of the app to update eligibility for.
   * @param canBeVoted Boolean indicating whether the app is now eligible for voting.
   * @param isEligibleNow The current eligibility status of the app.
   * @param clock The current timepoint for the checkpoint.
   *
   * Emits a {VotingEligibilityUpdated} event.
   */
  function updateVotingEligibility(bytes32 appId, bool canBeVoted, bool isEligibleNow, uint48 clock) external {
    X2EarnAppsStorageTypes.VoteEligibilityStorage storage $ = X2EarnAppsStorageTypes._getVoteEligibilityStorage();

    // Exit if no state change is required
    if (isEligibleNow == canBeVoted) {
      return;
    }

    // Update eligibility checkpoint with the new status
    _pushCheckpoint(
      $._isAppEligibleCheckpoints[appId],
      clock,
      canBeVoted ? SafeCast.toUint208(1) : SafeCast.toUint208(0)
    );

    if (!canBeVoted) {
      // Remove app from eligibility if it is no longer eligible
      uint256 index = $._eligibleAppIndex[appId];
      uint256 lastIndex = $._eligibleApps.length - 1;
      bytes32 lastAppId = $._eligibleApps[lastIndex];

      $._eligibleApps[index] = lastAppId;
      $._eligibleAppIndex[lastAppId] = index;

      $._eligibleApps.pop();
      delete $._eligibleAppIndex[appId];
    } else {
      // Add app to eligibility if it is now eligible
      $._eligibleApps.push(appId);
      $._eligibleAppIndex[appId] = $._eligibleApps.length - 1;
    }

    emit VotingEligibilityUpdated(appId, canBeVoted);
  }

  // ------------------------------- Getter Functions -------------------------------
  /**
   * @notice Checks if an app is eligible for voting at a specific timepoint.
   * @param appId The ID of the app being queried.
   * @param timepoint The timepoint to check for eligibility.
   * @param appExists Boolean indicating if the app exists.
   * @param currentTimepoint The current timepoint.
   * @return Boolean indicating if the app is eligible for voting at the specified timepoint.
   *
   * Reverts with {ERC5805FutureLookup} if `timepoint` is in the future.
   */
  function isEligible(
    bytes32 appId,
    uint256 timepoint,
    bool appExists,
    uint48 currentTimepoint
  ) external view returns (bool) {
    X2EarnAppsStorageTypes.VoteEligibilityStorage storage $ = X2EarnAppsStorageTypes._getVoteEligibilityStorage();

    if (!appExists) {
      return false;
    }

    if (timepoint > currentTimepoint) {
      revert ERC5805FutureLookup(timepoint, currentTimepoint);
    }

    return $._isAppEligibleCheckpoints[appId].upperLookupRecent(SafeCast.toUint48(timepoint)) == 1;
  }

  // ------------------------------- Private Functions -------------------------------
  /**
   * @dev Stores a new eligibility checkpoint for an app.
   * @param store The checkpoint storage to update.
   * @param clock The current timepoint for the checkpoint.
   * @param delta The eligibility value to store in the checkpoint.
   * @return previousValue The value before the update.
   * @return newValue The updated value.
   */
  function _pushCheckpoint(
    Checkpoints.Trace208 storage store,
    uint48 clock,
    uint208 delta
  ) private returns (uint208 previousValue, uint208 newValue) {
    return store.push(clock, delta);
  }
}
