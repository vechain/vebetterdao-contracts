// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IX2EarnApps } from "../../interfaces/IX2EarnApps.sol";
import { IXAllocationVotingGovernor } from "../../interfaces/IXAllocationVotingGovernor.sol";
import { XAllocationVotingDataTypes } from "./XAllocationVotingDataTypes.sol";
/**
 * @title AutoVotingLogic
 * @notice Library that handles user preferences for automatic voting in allocation rounds
 * @dev This library is intended to be used by the XAllocationVoting contract
 */
library AutoVotingLogic {
  using Checkpoints for Checkpoints.Trace208;

  /**
   * @notice Emitted when a user toggles their autovoting status
   * @param account The address of the user
   * @param enabled Whether autovoting is enabled or disabled
   */
  event AutoVotingToggled(address indexed account, bool enabled);

  /**
   * @notice Emitted when a user updates their preferred apps for autovoting
   * @param account The address of the user
   * @param apps The list of app IDs the user prefers to vote for
   */
  event PreferredAppsUpdated(address indexed account, bytes32[] apps);

  // ---------- Setters ---------- //

  /**
   * @dev Toggles autovoting for an account
   * @param $ The storage struct for AutoVoting preferences
   * @param xAllocationVotingGovernorAddress The address of the XAllocationVotingGovernor contract
   * @param account The address to toggle autovoting for
   * @param clock The current timepoint
   * @notice
   * User Enabled: false ──────────────────────→ true
   * Total Count:  100   ──────────────────────→ 101
   * User Prefs:   [existing preferences kept]
   *
   * User Enabled: true ──────────────────────→ false
   * Total Count:  101   ──────────────────────→ 100
   * User Prefs:   [app1, app2] ────────────────→ [] (deleted)
   */
  function toggleAutoVoting(
    XAllocationVotingDataTypes.AutoVotingStorage storage $,
    address xAllocationVotingGovernorAddress,
    address account,
    uint48 clock
  ) external {
    bool currentStatus = $._autoVotingEnabled[account].upperLookupRecent(clock) == 1;
    bool newStatus = !currentStatus;

    IXAllocationVotingGovernor xAllocationVotingGovernor = IXAllocationVotingGovernor(xAllocationVotingGovernorAddress);

    // If user is enabling autovoting (was disabled, now enabling), check eligibility
    if (!currentStatus) {
      xAllocationVotingGovernor.validatePersonhoodForCurrentRound(account);
      (, bool isValid) = xAllocationVotingGovernor.getAndValidateVotingPower(
        account,
        xAllocationVotingGovernor.currentRoundSnapshot()
      );
      require(isValid, "AutoVotingLogic: at least 1 VOT3 is required");
      require($._userVotingPreferences[account].length > 0, "AutoVotingLogic: must select at least one app");
    }

    // If user is disabling autovoting (was enabled, now disabling), clear preferences
    if (currentStatus) {
      delete $._userVotingPreferences[account];
    }

    // Push new checkpoint with toggled status
    $._autoVotingEnabled[account].push(clock, newStatus ? SafeCast.toUint208(1) : SafeCast.toUint208(0));

    uint208 currentTotal = $._totalAutoVotingUsers.upperLookupRecent(clock);
    uint208 newTotal = newStatus ? currentTotal + 1 : currentTotal - 1;
    $._totalAutoVotingUsers.push(clock, newTotal);

    emit AutoVotingToggled(account, newStatus);
  }

  /**
   * @dev Sets the voting preferences for an account
   * @param $ The storage struct for AutoVoting preferences
   * @param x2EarnAppsAddress The address of the X2EarnApps contract
   * @param account The address to set preferences for
   * @param apps The list of app IDs to vote for
   */
  function setUserVotingPreferences(
    XAllocationVotingDataTypes.AutoVotingStorage storage $,
    address x2EarnAppsAddress,
    address account,
    bytes32[] memory apps
  ) external {
    require(apps.length > 0, "AutoVotingLogic: no apps to vote for");
    require(apps.length <= 15, "AutoVotingLogic: must vote for less than 15 apps");

    IX2EarnApps x2EarnAppsContract = IX2EarnApps(x2EarnAppsAddress);

    // Iterate through the apps and percentages to calculate the total weight of votes cast by the voter
    for (uint256 i; i < apps.length; i++) {
      // app must be a valid app
      require(x2EarnAppsContract.appExists(apps[i]), "AutoVotingLogic: invalid app");

      // Check current app against ALL previous apps
      for (uint256 j; j < i; j++) {
        require(apps[i] != apps[j], "AutoVotingLogic: duplicate app");
      }
    }

    $._userVotingPreferences[account] = apps;

    emit PreferredAppsUpdated(account, apps);
  }

  // ---------- Getters ---------- //

  /**
   * @dev Checks if autovoting is enabled for an account at the latest timepoint
   * @param $ The storage struct for AutoVoting preferences
   * @param account The address to check
   * @return Whether autovoting is enabled for the account at the latest timepoint
   */
  function isAutoVotingEnabled(
    XAllocationVotingDataTypes.AutoVotingStorage storage $,
    address account
  ) external view returns (bool) {
    return $._autoVotingEnabled[account].latest() == 1;
  }

  /**
   * @dev Checks if autovoting is enabled for an account at a specific timepoint
   * @param $ The storage struct for AutoVoting preferences
   * @param account The address to check
   * @param timepoint The timepoint to check
   * @return Whether autovoting is enabled for the account at the specific timepoint
   */
  function isAutoVotingEnabledAtTimepoint(
    XAllocationVotingDataTypes.AutoVotingStorage storage $,
    address account,
    uint48 timepoint
  ) external view returns (bool) {
    return $._autoVotingEnabled[account].upperLookupRecent(timepoint) == 1;
  }

  /**
   * @dev Gets the voting preferences for an account
   * @param $ The storage struct for AutoVoting preferences
   * @param account The address to get preferences for
   * @return The list of app IDs the account prefers to vote for
   */
  function getUserVotingPreferences(
    XAllocationVotingDataTypes.AutoVotingStorage storage $,
    address account
  ) external view returns (bytes32[] memory) {
    return $._userVotingPreferences[account];
  }

  /**
   * @dev Gets the total number of users who enabled autovoting at a specific timepoint
   * @param $ The storage struct for AutoVoting preferences
   * @param timepoint The timepoint to check
   * @return The total number of users who enabled autovoting at the specific timepoint
   */
  function getTotalAutoVotingUsersAtTimepoint(
    XAllocationVotingDataTypes.AutoVotingStorage storage $,
    uint48 timepoint
  ) external view returns (uint208) {
    return $._totalAutoVotingUsers.upperLookupRecent(timepoint);
  }

  /**
   * @dev Gets the total number of users who enabled autovoting at the current timepoint
   * @param $ The storage struct for AutoVoting preferences
   * @param clock The current timepoint
   * @return The total number of users who enabled autovoting at the current timepoint
   */
  function getTotalAutoVotingUsers(
    XAllocationVotingDataTypes.AutoVotingStorage storage $,
    uint48 clock
  ) external view returns (uint208) {
    return $._totalAutoVotingUsers.upperLookupRecent(clock);
  }

  /**
   * @dev Prepares arrays for auto-voting by filtering eligible apps and calculating vote weights
   * @notice Returns empty arrays if voter has insufficient voting power
   * @notice Returns empty arrays if no eligible apps found
   *
   * @param xAllocationVotingGovernorAddress The address of the XAllocationVotingGovernor contract
   * @param voter The address of the voter
   * @param roundId The round ID to vote in
   * @param preferredApps Array of preferred app IDs
   *
   * @return finalAppIds Array of eligible app IDs
   * @return voteWeights Array of equal vote weights
   * @return votingPower The voting power of the voter
   */
  function prepareAutoVoteArrays(
    address xAllocationVotingGovernorAddress,
    address voter,
    uint256 roundId,
    bytes32[] memory preferredApps
  ) external view returns (bytes32[] memory finalAppIds, uint256[] memory voteWeights, uint256 votingPower) {
    IXAllocationVotingGovernor xAllocationVotingGovernor = IXAllocationVotingGovernor(xAllocationVotingGovernorAddress);

    (uint256 voterAvailableVotes, bool isValid) = xAllocationVotingGovernor.getAndValidateVotingPower(
      voter,
      xAllocationVotingGovernor.roundSnapshot(roundId)
    );

    votingPower = voterAvailableVotes;

    // If voter has insufficient voting power, return empty arrays
    if (!isValid) {
      return (new bytes32[](0), new uint256[](0), votingPower);
    }

    // Count and collect eligible apps
    uint256 len = preferredApps.length;
    bytes32[] memory tempAppIds = new bytes32[](len);
    uint256 count;

    for (uint256 i; i < len; ++i) {
      if (xAllocationVotingGovernor.isEligibleForVote(preferredApps[i], roundId)) {
        tempAppIds[count++] = preferredApps[i];
      }
    }

    // If no eligible apps found, return empty arrays
    if (count == 0) {
      return (new bytes32[](0), new uint256[](0), votingPower);
    }

    // Create final arrays with exact size
    finalAppIds = new bytes32[](count);
    voteWeights = new uint256[](count);
    uint256 votePerApp = votingPower / count;
    uint256 remainingVotes = votingPower % count;

    for (uint256 i; i < count; ++i) {
      finalAppIds[i] = tempAppIds[i];
      voteWeights[i] = votePerApp;

      // Distribute remainder: give 1 extra wei to first N apps
      // Edge case: when user has 1 VOT3 and select 3 apps, this will give 1 extra wei to the first app
      if (i < remainingVotes) {
        voteWeights[i] += 1;
      }
    }

    return (finalAppIds, voteWeights, votingPower);
  }
}
