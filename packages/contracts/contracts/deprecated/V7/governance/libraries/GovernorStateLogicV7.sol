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

import { GovernorTypesV7 } from "./GovernorTypesV7.sol";
import { GovernorStorageTypesV7 } from "./GovernorStorageTypesV7.sol";
import { GovernorProposalLogicV7 } from "./GovernorProposalLogicV7.sol";
import { GovernorVotesLogicV7 } from "./GovernorVotesLogicV7.sol";
import { GovernorQuorumLogicV7 } from "./GovernorQuorumLogicV7.sol";
import { GovernorClockLogicV7 } from "./GovernorClockLogicV7.sol";
import { GovernorDepositLogicV7 } from "./GovernorDepositLogicV7.sol";

/// @title GovernorStateLogicV7
/// @notice Library for Governor state logic, managing the state transitions and validations of governance proposals.
library GovernorStateLogicV7 {
  /// @notice Bitmap representing all possible proposal states.
  bytes32 internal constant ALL_PROPOSAL_STATES_BITMAP =
    bytes32((2 ** (uint8(type(GovernorTypesV7.ProposalState).max) + 1)) - 1);

  /// @dev Thrown when the `proposalId` does not exist.
  /// @param proposalId The ID of the proposal that does not exist.
  error GovernorNonexistentProposal(uint256 proposalId);

  /// @dev Thrown when the current state of a proposal does not match the expected states.
  /// @param proposalId The ID of the proposal.
  /// @param current The current state of the proposal.
  /// @param expectedStates The expected states of the proposal as a bitmap.
  error GovernorUnexpectedProposalState(
    uint256 proposalId,
    GovernorTypesV7.ProposalState current,
    bytes32 expectedStates
  );

  /** ------------------ GETTERS ------------------ **/

  /**
   * @notice Retrieves the current state of a proposal.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @return The current state of the proposal.
   */
  function state(
    GovernorStorageTypesV7.GovernorStorage storage self,
    uint256 proposalId
  ) external view returns (GovernorTypesV7.ProposalState) {
    return _state(self, proposalId);
  }

  /** ------------------ INTERNAL FUNCTIONS ------------------ **/

  /**
   * @dev Internal function to validate the current state of a proposal against expected states.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @param allowedStates The bitmap of allowed states.
   * @return The current state of the proposal.
   */
  function validateStateBitmap(
    GovernorStorageTypesV7.GovernorStorage storage self,
    uint256 proposalId,
    bytes32 allowedStates
  ) internal view returns (GovernorTypesV7.ProposalState) {
    GovernorTypesV7.ProposalState currentState = _state(self, proposalId);
    if (encodeStateBitmap(currentState) & allowedStates == bytes32(0)) {
      revert GovernorUnexpectedProposalState(proposalId, currentState, allowedStates);
    }
    return currentState;
  }

  /**
   * @dev Encodes a `ProposalState` into a `bytes32` representation where each bit enabled corresponds to the underlying position in the `ProposalState` enum.
   * @param proposalState The state to encode.
   * @return The encoded state bitmap.
   */
  function encodeStateBitmap(GovernorTypesV7.ProposalState proposalState) internal pure returns (bytes32) {
    return bytes32(1 << uint8(proposalState));
  }

  /**
   * @notice Retrieves the current state of a proposal.
   * @dev See {IB3TRGovernor-state}.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @return The current state of the proposal.
   */
  function _state(
    GovernorStorageTypesV7.GovernorStorage storage self,
    uint256 proposalId
  ) internal view returns (GovernorTypesV7.ProposalState) {
    // Load the proposal into memory
    GovernorTypesV7.ProposalCore storage proposal = self.proposals[proposalId];
    bool proposalExecuted = proposal.executed;
    bool proposalCanceled = proposal.canceled;

    if (proposalExecuted) {
      return GovernorTypesV7.ProposalState.Executed;
    }

    if (proposalCanceled) {
      return GovernorTypesV7.ProposalState.Canceled;
    }

    if (proposal.roundIdVoteStart == 0) {
      revert GovernorNonexistentProposal(proposalId);
    }

    // Check if the proposal is pending
    if (self.xAllocationVoting.currentRoundId() < proposal.roundIdVoteStart) {
      return GovernorTypesV7.ProposalState.Pending;
    }

    uint256 currentTimepoint = GovernorClockLogicV7.clock(self);
    uint256 deadline = GovernorProposalLogicV7._proposalDeadline(self, proposalId);

    if (!GovernorDepositLogicV7.proposalDepositReached(self, proposalId)) {
      return GovernorTypesV7.ProposalState.DepositNotMet;
    }

    if (deadline >= currentTimepoint) {
      return GovernorTypesV7.ProposalState.Active;
    } else if (
      !GovernorQuorumLogicV7.quorumReached(self, proposalId) || !GovernorVotesLogicV7.voteSucceeded(self, proposalId)
    ) {
      return GovernorTypesV7.ProposalState.Defeated;
    } else if (GovernorProposalLogicV7.proposalEta(self, proposalId) == 0) {
      return GovernorTypesV7.ProposalState.Succeeded;
    } else {
      bytes32 queueid = self.timelockIds[proposalId];
      if (self.timelock.isOperationPending(queueid)) {
        return GovernorTypesV7.ProposalState.Queued;
      } else if (self.timelock.isOperationDone(queueid)) {
        return GovernorTypesV7.ProposalState.Executed;
      } else {
        return GovernorTypesV7.ProposalState.Canceled;
      }
    }
  }
}
