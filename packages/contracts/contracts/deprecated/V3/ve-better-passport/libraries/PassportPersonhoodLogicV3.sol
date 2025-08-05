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

import { PassportStorageTypesV3 } from "./PassportStorageTypesV3.sol";
import { PassportChecksLogicV3 } from "./PassportChecksLogicV3.sol";
import { PassportSignalingLogicV3 } from "./PassportSignalingLogicV3.sol";
import { PassportDelegationLogicV3 } from "./PassportDelegationLogicV3.sol";
import { PassportPoPScoreLogicV3 } from "./PassportPoPScoreLogicV3.sol";
import { PassportClockLogicV3 } from "./PassportClockLogicV3.sol";
import { PassportEntityLogicV3 } from "./PassportEntityLogicV3.sol";
import { PassportWhitelistAndBlacklistLogicV3 } from "./PassportWhitelistAndBlacklistLogicV3.sol";
import { PassportTypesV3 } from "./PassportTypesV3.sol";

/**
 * @title PassportPersonhoodLogicV3
 * @dev A library that provides logic to determine whether a wallet is considered a "person" based on various checks.
 * It evaluates factors such as participation score, blacklist status, and delegation status.
 * This library supports both real-time personhood checks and checks at specific timepoints.
 */
library PassportPersonhoodLogicV3 {
  /**
   * @dev Checks if a wallet is a person or not based on the participation score, blacklisting, and GM holdings
   * @return person bool representing if the user is considered a person
   * @return reason string representing the reason for the result
   */
  function isPerson(
    PassportStorageTypesV3.PassportStorage storage self,
    address user
  ) external view returns (bool person, string memory reason) {
    // Get the current timepoint
    uint48 timepoint = PassportClockLogicV3.clock();

    // Resolve the address of the person based on the delegation status
    user = _resolvePersonhoodAddress(self, user, timepoint);

    // Check is the user is a person
    return _checkPassport(self, user, timepoint);
  }

  /**
   * @dev Checks if a wallet is a person or not at a specific timepoint based on the participation score, blacklisting, and GM holdings
   * @param user address of the user
   * @param timepoint uint256 of the timepoint
   * @return person bool representing if the user is considered a person
   * @return reason string representing the reason for the result
   */
  function isPersonAtTimepoint(
    PassportStorageTypesV3.PassportStorage storage self,
    address user,
    uint48 timepoint
  ) external view returns (bool person, string memory reason) {
    // Resolve the address of the person based on the delegation status
    user = _resolvePersonhoodAddress(self, user, timepoint);

    // Check is the user is a person
    return _checkPassport(self, user, timepoint);
  }

  // ---------- Internal & Private Functions ---------- //

  /**
   * @dev Resolves the address of the person based on their delegation status at a given timepoint.
   * If the user is a delegatee at the given timepoint, it returns the delegator's passport address.
   * If the user is neither a delegatee nor a delegator (or entity), it returns the user's own address,
   * representing their passport.
   *
   * @param self The storage object for the Passport contract containing all delegation data.
   * @param user The address of the user whose personhood is being resolved.
   * @param timepoint The timepoint (block number or timestamp) at which the delegation status is checked.
   *
   * @return The address of the resolved passport.
   * - Returns the delegator's passport if the user is a delegatee.
   * - Returns `address(0)` if the user is either a delegator or an entity at that timepoint.
   * - Returns the user's own address (passport) if no delegation is found.
   */
  function _resolvePersonhoodAddress(
    PassportStorageTypesV3.PassportStorage storage self,
    address user,
    uint256 timepoint
  ) private view returns (address) {
    if (PassportDelegationLogicV3._isDelegateeInTimepoint(self, user, timepoint)) {
      return PassportDelegationLogicV3._getDelegatorInTimepoint(self, user, timepoint); // Return the delegator's passport address
    } else if (
      PassportDelegationLogicV3._isDelegatorInTimepoint(self, user, timepoint) ||
      PassportEntityLogicV3._isEntityInTimepoint(self, user, timepoint)
    ) {
      return address(0); // Return zero address if they delegated their personhood or entity
    } else {
      return user; // Return the user's own passport address
    }
  }

  /**
   * @dev Checks whether a user meets the criteria to be considered a person (i.e., a valid passport holder)
   * based on various conditions such as delegation status, whitelist/blacklist status, signaling, participation score,
   * and node ownership.
   *
   * @param self The storage object for the Passport contract containing all relevant data.
   * @param user The address of the user whose passport status is being checked.
   *
   * @return person bool indicating whether the user meets the criteria.
   * @return reason string providing the reason or status for the result.
   *
   * Conditions checked:
   * - Returns `(false, "User has delegated their personhood")` if the user has delegated their personhood.
   * - Returns `(true, "User is whitelisted")` if the user is whitelisted.
   * - Returns `(false, "User is blacklisted")` if the user is blacklisted.
   * - Returns `(false, "User has been signaled too many times")` if the user has been signaled more than the threshold.
   * - Returns `(true, "User's participation score is above the threshold")` if the user's participation score meets or exceeds the threshold.
   * - Returns `(false, "User does not meet the criteria to be considered a person")` if none of the conditions are met.
   * - Returns `(true, "User's selected Galaxy Member is above the minimum level")` if the user's selected Galaxy Member is above the minimum level.
   *
   * Additional considerations:
   * - Checks for delegation status: If the user has delegated their personhood, they are not considered a valid passport holder.
   * - Checks if the user is in the whitelist or blacklist, with priority given to whitelist status.
   * - Evaluates the user's signaling status, participation score, and node ownership to determine validity.
   * - Checks if the user's selected Galaxy Member is above the minimum level.
   */
  function _checkPassport(
    PassportStorageTypesV3.PassportStorage storage self,
    address user,
    uint48 timepoint
  ) private view returns (bool person, string memory reason) {
    // Check if the user has delegated their personhood to another wallet
    if (user == address(0)) {
      return (false, "User has delegated their personhood");
    }

    // If a wallet is whitelisted, it is a person
    if (
      PassportChecksLogicV3._isCheckEnabled(self, PassportTypesV3.CheckType.WHITELIST_CHECK) &&
      PassportWhitelistAndBlacklistLogicV3._isPassportWhitelisted(self, user)
    ) {
      return (true, "User is whitelisted");
    }

    // If a wallet is blacklisted, it is not a person
    if (
      PassportChecksLogicV3._isCheckEnabled(self, PassportTypesV3.CheckType.BLACKLIST_CHECK) &&
      PassportWhitelistAndBlacklistLogicV3._isPassportBlacklisted(self, user)
    ) {
      return (false, "User is blacklisted");
    }

    // If a wallet is not whitelisted and has been signaled more than X times
    if (
      (PassportChecksLogicV3._isCheckEnabled(self, PassportTypesV3.CheckType.SIGNALING_CHECK) &&
        PassportSignalingLogicV3.signaledCounter(self, user) >= PassportSignalingLogicV3.signalingThreshold(self))
    ) {
      return (false, "User has been signaled too many times");
    }

    if (PassportChecksLogicV3._isCheckEnabled(self, PassportTypesV3.CheckType.PARTICIPATION_SCORE_CHECK)) {
      uint256 participationScore = PassportPoPScoreLogicV3._cumulativeScoreWithDecay(
        self,
        user,
        self.xAllocationVoting.currentRoundId()
      );

      // If the user's cumulated score in the last rounds is greater than or equal to the threshold
      if ((participationScore >= PassportPoPScoreLogicV3._thresholdPoPScoreAtTimepoint(self, timepoint))) {
        return (true, "User's participation score is above the threshold");
      }
    }

    // Check if user's selected GalaxyMember, in the timepoint, was above the minimum level
    if (PassportChecksLogicV3._isCheckEnabled(self, PassportTypesV3.CheckType.GM_OWNERSHIP_CHECK)) {
      uint256 selectedTokenId = self.galaxyMember.getSelectedTokenIdAtBlock(user, timepoint);

      if (
        selectedTokenId != 0 &&
        self.galaxyMember.levelOf(selectedTokenId) >= PassportChecksLogicV3.getMinimumGalaxyMemberLevel(self)
      ) {
        return (true, "User's selected Galaxy Member is above the minimum level");
      }
    }

    // If none of the conditions are met, return false with the default reason
    return (false, "User does not meet the criteria to be considered a person");
  }
}
