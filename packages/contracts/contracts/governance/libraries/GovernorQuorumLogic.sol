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

import { GovernorStorageTypes } from "./GovernorStorageTypes.sol";
import { GovernorClockLogic } from "./GovernorClockLogic.sol";
import { GovernorVotesLogic } from "./GovernorVotesLogic.sol";
import { GovernorProposalLogic } from "./GovernorProposalLogic.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import { GovernorTypes } from "./GovernorTypes.sol";

/// @title GovernorQuorumLogic
/// @notice Library for managing quorum numerators using checkpointed data structures.
library GovernorQuorumLogic {
  using Checkpoints for Checkpoints.Trace208;

  /// @notice Error that is thrown when the new quorum numerator exceeds the denominator.
  /// @param quorumNumerator The attempted new numerator that failed the update.
  /// @param quorumDenominator The denominator against which the numerator was compared.
  error GovernorInvalidQuorumFraction(uint256 quorumNumerator, uint256 quorumDenominator);

  /// @notice Emitted when the quorum numerator is updated.
  /// @param oldNumerator The numerator before the update.
  /// @param newNumerator The numerator after the update.
  event QuorumNumeratorUpdated(uint256 oldNumerator, uint256 newNumerator);

  /// @notice Emitted when the quorum numerator for a specific proposal type is updated.
  /// @param oldNumerator The numerator before the update.
  /// @param newNumerator The numerator after the update.
  /// @param proposalType The type of proposal.
  event QuorumNumeratorUpdatedByType(
    uint256 oldNumerator,
    uint256 newNumerator,
    GovernorTypes.ProposalType proposalType
  );
  /** ------------------ GETTERS ------------------ **/

  /// @notice Retrieves the quorum denominator, which is a constant in this implementation.
  /// @return The quorum denominator (constant value of 100).
  function quorumDenominator() internal pure returns (uint256) {
    return 100;
  }

  /// @notice Retrieves the quorum numerator at a specific timepoint using checkpoint data.
  /// @param self The storage structure containing the quorum numerator history.
  /// @param timepoint The specific timepoint for which to fetch the numerator.
  /// @return The quorum numerator at the given timepoint.
  function quorumNumerator(
    GovernorStorageTypes.GovernorStorage storage self,
    uint256 timepoint
  ) public view returns (uint256) {
    GovernorTypes.ProposalType proposalType = GovernorTypes.ProposalType.Standard;
    uint256 length = self.proposalTypeQuorum[proposalType]._checkpoints.length;

    // Optimistic search, check the latest checkpoint
    Checkpoints.Checkpoint208 storage latest = self.proposalTypeQuorum[proposalType]._checkpoints[length - 1];
    uint48 latestKey = latest._key;
    uint208 latestValue = latest._value;
    if (latestKey <= timepoint) {
      return latestValue;
    }

    // Otherwise, do the binary search
    return self.proposalTypeQuorum[proposalType].upperLookupRecent(SafeCast.toUint48(timepoint));
  }
  /// @notice Retrieves the quorum numerator at a specific timepoint using checkpoint data.
  /// @param self The storage structure containing the quorum numerator history.
  /// @param timepoint The specific timepoint for which to fetch the numerator.
  /// @return The quorum numerator at the given timepoint.
  function quorumNumeratorByProposalType(
    GovernorStorageTypes.GovernorStorage storage self,
    uint256 timepoint,
    GovernorTypes.ProposalType proposalTypeValue
  ) public view returns (uint256) {
    return _quorumNumeratorByProposalType(self, timepoint, proposalTypeValue);
  }

  /// @notice Retrieves the latest quorum numerator using the GovernorClockLogic library.
  /// @param self The storage structure containing the quorum numerator history.
  /// @return The latest quorum numerator.
  function quorumNumerator(GovernorStorageTypes.GovernorStorage storage self) public view returns (uint256) {
    GovernorTypes.ProposalType proposalType = GovernorTypes.ProposalType.Standard;
    return self.proposalTypeQuorum[proposalType].latest();
  }

  /**
   * @notice Retrieves the latest quorum numerator for a specific proposal type.
   * @param self The storage structure containing the quorum numerator history.
   * @param proposalTypeValue The type of proposal.
   * @return The latest quorum numerator for the proposal type.
   */
  function quorumNumeratorByProposalType(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalTypeValue
  ) public view returns (uint256) {
    return self.proposalTypeQuorum[proposalTypeValue].latest();
  }

  /**
   * @notice Checks if the quorum has been reached for a proposal.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @return True if the quorum has been reached, false otherwise.
   */
  function isQuorumReached(
    GovernorStorageTypes.GovernorStorage storage self,
    uint256 proposalId
  ) external view returns (bool) {
    return quorumReached(self, proposalId);
  }

  /**
   * @notice Returns the quorum for a specific timepoint.
   * @param self The storage reference for the GovernorStorage.
   * @param timepoint The specific timepoint.
   * @return The quorum at the given timepoint.
   */
  function quorum(GovernorStorageTypes.GovernorStorage storage self, uint256 timepoint) public view returns (uint256) {
    return (self.vot3.getPastTotalSupply(timepoint) * quorumNumerator(self, timepoint)) / quorumDenominator();
  }
  /**
   * @notice Returns the quorum for a specific timepoint and proposal type.
   * @param self The storage reference for the GovernorStorage.
   * @param timepoint The specific timepoint.
   * @param proposalTypeValue The type of proposal.
   * @return The quorum at the given timepoint and proposal type.
   */
  function quorumByProposalType(
    GovernorStorageTypes.GovernorStorage storage self,
    uint256 timepoint,
    GovernorTypes.ProposalType proposalTypeValue
  ) public view returns (uint256) {
    return
      (self.vot3.getPastTotalSupply(timepoint) * quorumNumeratorByProposalType(self, timepoint, proposalTypeValue)) /
      quorumDenominator();
  }

  /** ------------------ SETTERS ------------------ **/

  /**
   * @notice Updates the quorum numerator to a new value at a specified time, emitting an event upon success.
   * @dev This function should only be called from governance actions where numerators need updating.
   * @dev New numerator must be smaller or equal to the denominator.
   * @param self The storage structure containing the quorum numerator history.
   * @param newQuorumNumerator The new value for the quorum numerator.
   */
  function updateQuorumNumerator(
    GovernorStorageTypes.GovernorStorage storage self,
    uint256 newQuorumNumerator
  ) external {
    _updateQuorumNumeratorByType(self, newQuorumNumerator, GovernorTypes.ProposalType.Standard);
  }
  /**
   * @notice Updates the quorum numerator for a specific proposal type to a new value at a specified time, emitting an event upon success.
   * @dev This function should only be called from governance actions where numerators need updating.
   * @dev New numerator must be smaller or equal to the denominator.
   * @param self The storage structure containing the quorum numerator history.
   * @param newQuorumNumerator The new value for the quorum numerator.
   * @param proposalTypeValue The type of proposal.
   */
  function updateQuorumNumeratorByType(
    GovernorStorageTypes.GovernorStorage storage self,
    uint256 newQuorumNumerator,
    GovernorTypes.ProposalType proposalTypeValue
  ) external {
    _updateQuorumNumeratorByType(self, newQuorumNumerator, proposalTypeValue);
  }

  /** ------------------ INTERNAL FUNCTIONS ------------------ **/

  /**
   * @dev Internal function to check if the quorum has been reached for a proposal.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @return True if the quorum has been reached, false otherwise.
   */
  function quorumReached(
    GovernorStorageTypes.GovernorStorage storage self,
    uint256 proposalId
  ) internal view returns (bool) {
    GovernorTypes.ProposalType proposalType = self.proposalType[proposalId];

    return
      quorumByProposalType(self, GovernorProposalLogic._proposalSnapshot(self, proposalId), proposalType) <=
      self.proposalTotalVotes[proposalId];
  }
  /**
   * @notice Internal function to retrieve the quorum numerator for a specific proposal type at a given timepoint.
   * @param self The storage reference for the GovernorStorage.
   * @param timepoint The specific timepoint for which to fetch the numerator.
   * @param proposalTypeValue The type of proposal.
   * @return The quorum numerator at the given timepoint for the specified proposal type.
   */
  function _quorumNumeratorByProposalType(
    GovernorStorageTypes.GovernorStorage storage self,
    uint256 timepoint,
    GovernorTypes.ProposalType proposalTypeValue
  ) internal view returns (uint256) {
    uint256 length = self.proposalTypeQuorum[proposalTypeValue]._checkpoints.length;

    // Optimistic search, check the latest checkpoint
    Checkpoints.Checkpoint208 storage latest = self.proposalTypeQuorum[proposalTypeValue]._checkpoints[length - 1];
    uint48 latestKey = latest._key;
    uint208 latestValue = latest._value;
    if (latestKey <= timepoint) {
      return latestValue;
    }

    // Otherwise, do the binary search
    return self.proposalTypeQuorum[proposalTypeValue].upperLookupRecent(SafeCast.toUint48(timepoint));
  }
  /**
   * @notice Internal function to update the quorum numerator for a specific proposal type.
   * @dev This function should only be called from governance actions where numerators need updating.
   * @dev New numerator must be smaller or equal to the denominator.
   * @param self The storage structure containing the quorum numerator history.
   * @param newQuorumNumerator The new value for the quorum numerator.
   * @param proposalTypeValue The type of proposal.
   */
  function _updateQuorumNumeratorByType(
    GovernorStorageTypes.GovernorStorage storage self,
    uint256 newQuorumNumerator,
    GovernorTypes.ProposalType proposalTypeValue
  ) internal {
    uint256 denominator = quorumDenominator();
    uint256 oldQuorumNumerator = quorumNumeratorByProposalType(self, proposalTypeValue);

    if (newQuorumNumerator > denominator) {
      revert GovernorInvalidQuorumFraction(newQuorumNumerator, denominator);
    }

    self.proposalTypeQuorum[proposalTypeValue].push(
      GovernorClockLogic.clock(self),
      SafeCast.toUint208(newQuorumNumerator)
    );
    emit QuorumNumeratorUpdated(oldQuorumNumerator, newQuorumNumerator);
    emit QuorumNumeratorUpdatedByType(oldQuorumNumerator, newQuorumNumerator, proposalTypeValue);
  }
}
