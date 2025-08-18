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

import { GovernorTypesV6 } from "./GovernorTypesV6.sol";
import { GovernorStorageTypesV6 } from "./GovernorStorageTypesV6.sol";
import { GovernorProposalLogicV6 } from "./GovernorProposalLogicV6.sol";
import { GovernorVotesLogicV6 } from "./GovernorVotesLogicV6.sol";
import { GovernorQuorumLogicV6 } from "./GovernorQuorumLogicV6.sol";
import { GovernorClockLogicV6 } from "./GovernorClockLogicV6.sol";
import { GovernorDepositLogicV6 } from "./GovernorDepositLogicV6.sol";

/// @title GovernorStateLogicV6
/// @notice Library for Governor state logic, managing the state transitions and validations of governance proposals.
library GovernorStateLogicV6 {
  /// @notice Bitmap representing all possible proposal states.
  bytes32 internal constant ALL_PROPOSAL_STATES_BITMAP =
    bytes32((2 ** (uint8(type(GovernorTypesV6.ProposalState).max) + 1)) - 1);

  /// @dev Thrown when the `proposalId` does not exist.
  /// @param proposalId The ID of the proposal that does not exist.
  error GovernorNonexistentProposal(uint256 proposalId);

  /// @dev Thrown when the current state of a proposal does not match the expected states.
  /// @param proposalId The ID of the proposal.
  /// @param current The current state of the proposal.
  /// @param expectedStates The expected states of the proposal as a bitmap.
  error GovernorUnexpectedProposalState(
    uint256 proposalId,
    GovernorTypesV6.ProposalState current,
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
    GovernorStorageTypesV6.GovernorStorage storage self,
    uint256 proposalId
  ) external view returns (GovernorTypesV6.ProposalState) {
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
    GovernorStorageTypesV6.GovernorStorage storage self,
    uint256 proposalId,
    bytes32 allowedStates
  ) internal view returns (GovernorTypesV6.ProposalState) {
    GovernorTypesV6.ProposalState currentState = _state(self, proposalId);
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
  function encodeStateBitmap(GovernorTypesV6.ProposalState proposalState) internal pure returns (bytes32) {
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
    GovernorStorageTypesV6.GovernorStorage storage self,
    uint256 proposalId
  ) internal view returns (GovernorTypesV6.ProposalState) {
    // Load the proposal into memory
    GovernorTypesV6.ProposalCore storage proposal = self.proposals[proposalId];
    bool proposalExecuted = proposal.executed;
    bool proposalCanceled = proposal.canceled;

    if (proposalExecuted) {
      return GovernorTypesV6.ProposalState.Executed;
    }

    if (proposalCanceled) {
      return GovernorTypesV6.ProposalState.Canceled;
    }

    if (proposal.roundIdVoteStart == 0) {
      revert GovernorNonexistentProposal(proposalId);
    }

    // Check if the proposal is pending
    if (self.xAllocationVoting.currentRoundId() < proposal.roundIdVoteStart) {
      return GovernorTypesV6.ProposalState.Pending;
    }

    uint256 currentTimepoint = GovernorClockLogicV6.clock(self);
    uint256 deadline = GovernorProposalLogicV6._proposalDeadline(self, proposalId);

    if (!GovernorDepositLogicV6.proposalDepositReached(self, proposalId)) {
      return GovernorTypesV6.ProposalState.DepositNotMet;
    }

    if (deadline >= currentTimepoint) {
      return GovernorTypesV6.ProposalState.Active;
    } else if (
      !GovernorQuorumLogicV6.quorumReached(self, proposalId) || !GovernorVotesLogicV6.voteSucceeded(self, proposalId)
    ) {
      return GovernorTypesV6.ProposalState.Defeated;
    } else if (GovernorProposalLogicV6.proposalEta(self, proposalId) == 0) {
      return GovernorTypesV6.ProposalState.Succeeded;
    } else {
      bytes32 queueid = self.timelockIds[proposalId];
      if (self.timelock.isOperationPending(queueid)) {
        return GovernorTypesV6.ProposalState.Queued;
      } else if (self.timelock.isOperationDone(queueid)) {
        return GovernorTypesV6.ProposalState.Executed;
      } else {
        return GovernorTypesV6.ProposalState.Canceled;
      }
    }
  }
}
