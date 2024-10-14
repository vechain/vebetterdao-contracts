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

import { GovernorStorageTypesV3 } from "./GovernorStorageTypesV3.sol";
import { GovernorTypesV3 } from "./GovernorTypesV3.sol";
import { GovernorStateLogicV3 } from "./GovernorStateLogicV3.sol";
import { GovernorConfiguratorV3 } from "./GovernorConfiguratorV3.sol";
import { GovernorProposalLogicV3 } from "./GovernorProposalLogicV3.sol";
import { GovernorClockLogicV3 } from "./GovernorClockLogicV3.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title GovernorVotesLogicV3
/// @notice Library for handling voting logic in the Governor contract.
library GovernorVotesLogicV3 {
  using Checkpoints for Checkpoints.Trace208;

  /// @dev Thrown when a vote has already been cast by the voter.
  /// @param voter The address of the voter who already cast a vote.
  error GovernorAlreadyCastVote(address voter);

  /// @dev Thrown when an invalid vote type is used.
  error GovernorInvalidVoteType();

  /// @dev Thrown when the voting threshold is not met.
  /// @param threshold The required voting threshold.
  /// @param votes The actual votes received.
  error GovernorVotingThresholdNotMet(uint256 threshold, uint256 votes);

  /// @notice Emitted when a vote is cast without parameters.
  /// @param voter The address of the voter.
  /// @param proposalId The ID of the proposal being voted on.
  /// @param support The support value of the vote.
  /// @param weight The weight of the vote.
  /// @param power The voting power of the voter.
  /// @param reason The reason for the vote.
  event VoteCast(
    address indexed voter,
    uint256 indexed proposalId,
    uint8 support,
    uint256 weight,
    uint256 power,
    string reason
  );

  /// @notice Emits true if quadratic voting is disabled, false otherwise.
  /// @param disabled - The flag to enable or disable quadratic voting.
  event QuadraticVotingToggled(bool indexed disabled);

  /** ------------------ INTERNAL FUNCTIONS ------------------ **/

  /**
   * @dev Internal function to count a vote for a proposal.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @param account The address of the voter.
   * @param support The support value of the vote.
   * @param weight The weight of the vote.
   * @param power The voting power of the voter.
   */
  function _countVote(
    GovernorStorageTypesV3.GovernorStorage storage self,
    uint256 proposalId,
    address account,
    uint8 support,
    uint256 weight,
    uint256 power
  ) private {
    GovernorTypesV3.ProposalVote storage proposalVote = self.proposalVotes[proposalId];

    if (proposalVote.hasVoted[account]) {
      revert GovernorAlreadyCastVote(account);
    }
    proposalVote.hasVoted[account] = true;

    // if quadratic voting is disabled, use the weight as the vote otherwise use the power as the vote
    uint256 vote = isQuadraticVotingDisabledForCurrentRound(self) ? weight : power;

    if (support == uint8(GovernorTypesV3.VoteType.Against)) {
      proposalVote.againstVotes += vote;
    } else if (support == uint8(GovernorTypesV3.VoteType.For)) {
      proposalVote.forVotes += vote;
    } else if (support == uint8(GovernorTypesV3.VoteType.Abstain)) {
      proposalVote.abstainVotes += vote;
    } else {
      revert GovernorInvalidVoteType();
    }

    self.proposalTotalVotes[proposalId] += weight;

    // Save that user cast vote only the first time
    if (!self.hasVotedOnce[account]) {
      self.hasVotedOnce[account] = true;
    }
  }

  /**
   * @dev Internal function to check if the vote succeeded.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @return True if the vote succeeded, false otherwise.
   */
  function voteSucceeded(
    GovernorStorageTypesV3.GovernorStorage storage self,
    uint256 proposalId
  ) internal view returns (bool) {
    GovernorTypesV3.ProposalVote storage proposalVote = self.proposalVotes[proposalId];
    return proposalVote.forVotes > proposalVote.againstVotes;
  }

  /** ------------------ GETTERS ------------------ **/

  /**
   * @notice Retrieves the votes for a specific account at a given timepoint.
   * @param self The storage reference for the GovernorStorage.
   * @param account The address of the account.
   * @param timepoint The specific timepoint.
   * @return The votes of the account at the given timepoint.
   */
  function getVotes(
    GovernorStorageTypesV3.GovernorStorage storage self,
    address account,
    uint256 timepoint
  ) internal view returns (uint256) {
    return self.vot3.getPastVotes(account, timepoint);
  }

  /**
   * @notice Retrieves the quadratic voting power of an account at a given timepoint.
   * @param self The storage reference for the GovernorStorage.
   * @param account The address of the account.
   * @param timepoint The specific timepoint.
   * @return The quadratic voting power of the account.
   */
  function getQuadraticVotingPower(
    GovernorStorageTypesV3.GovernorStorage storage self,
    address account,
    uint256 timepoint
  ) external view returns (uint256) {
    // Scale the votes by 1e9 so that the number returned is 1e18
    return Math.sqrt(self.vot3.getPastVotes(account, timepoint)) * 1e9;
  }

  /**
   * @notice Checks if an account has voted on a specific proposal.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @param account The address of the account.
   * @return True if the account has voted, false otherwise.
   */
  function hasVoted(
    GovernorStorageTypesV3.GovernorStorage storage self,
    uint256 proposalId,
    address account
  ) internal view returns (bool) {
    return self.proposalVotes[proposalId].hasVoted[account];
  }

  /**
   * @notice Retrieves the votes for a proposal.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @return againstVotes The number of votes against the proposal.
   * @return forVotes The number of votes for the proposal.
   * @return abstainVotes The number of abstain votes.
   */
  function getProposalVotes(
    GovernorStorageTypesV3.GovernorStorage storage self,
    uint256 proposalId
  ) internal view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) {
    GovernorTypesV3.ProposalVote storage proposalVote = self.proposalVotes[proposalId];
    return (proposalVote.againstVotes, proposalVote.forVotes, proposalVote.abstainVotes);
  }

  /**
   * @notice Checks if a user has voted at least once.
   * @param self The storage reference for the GovernorStorage.
   * @param user The address of the user.
   * @return True if the user has voted once, false otherwise.
   */
  function userVotedOnce(GovernorStorageTypesV3.GovernorStorage storage self, address user) internal view returns (bool) {
    return self.hasVotedOnce[user];
  }

  /** ------------------ EXTERNAL FUNCTIONS ------------------ **/

  /**
   * @notice Casts a vote on a proposal.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @param voter The address of the voter.
   * @param support The support value of the vote.
   * @param reason The reason for the vote.
   * @return The weight of the vote.
   */
  function castVote(
    GovernorStorageTypesV3.GovernorStorage storage self,
    uint256 proposalId,
    address voter,
    uint8 support,
    string calldata reason
  ) external returns (uint256) {
    GovernorStateLogicV3.validateStateBitmap(
      self,
      proposalId,
      GovernorStateLogicV3.encodeStateBitmap(GovernorTypesV3.ProposalState.Active)
    );

    uint256 proposalSnapshot = GovernorProposalLogicV3._proposalSnapshot(self, proposalId);
    uint256 weight = self.vot3.getPastVotes(voter, proposalSnapshot);
    uint256 power = Math.sqrt(weight) * 1e9;

    if (weight < GovernorConfiguratorV3.getVotingThreshold(self)) {
      revert GovernorVotingThresholdNotMet(weight, GovernorConfiguratorV3.getVotingThreshold(self));
    }

    _countVote(self, proposalId, voter, support, weight, power);

    self.voterRewards.registerVote(proposalSnapshot, voter, weight, Math.sqrt(weight));

    emit VoteCast(voter, proposalId, support, weight, power, reason);

    return weight;
  }

  /**
   * @notice Toggle quadratic voting for a specific cycle.
   * @dev This function toggles the state of quadratic voting for a specific cycle.
   * @param self - The storage reference for the GovernorStorage.
   * The state will flip between enabled and disabled each time the function is called.
   */
  function toggleQuadraticVoting(GovernorStorageTypesV3.GovernorStorage storage self) external {
    bool isQuadraticDisabled =  self.quadraticVotingDisabled.upperLookupRecent(GovernorClockLogicV3.clock(self)) == 1; // 0: enabled, 1: disabled

    // If quadratic voting is disabled, set the new status to enabled, otherwise set it to disabled.
    uint208 newStatus = isQuadraticDisabled ? 0 : 1;

    // Toggle the status -> 0: enabled, 1: disabled
    self.quadraticVotingDisabled.push(GovernorClockLogicV3.clock(self), newStatus);

    // Emit an event to log the new quadratic voting status.
    emit QuadraticVotingToggled(!isQuadraticDisabled);
  }

  /**
   * @notice Check if quadratic voting is disabled at a specific round.
   * @dev To check if quadratic voting was disabled for a round, use the block number the round started.
   * @param self - The storage reference for the GovernorStorage.
   * @param roundId - The round ID for which to check if quadratic voting is disabled.
   * @return true if quadratic voting is disabled, false otherwise.
   */
  function isQuadraticVotingDisabledForRound(
    GovernorStorageTypesV3.GovernorStorage storage self,
    uint256 roundId
  ) external view returns (bool) {
    // Get the block number the round started.
    uint48 blockNumber = SafeCast.toUint48(self.xAllocationVoting.roundSnapshot(roundId));

    // Check if quadratic voting is enabled or disabled at the block number.
    return self.quadraticVotingDisabled.upperLookupRecent(blockNumber) == 1; // 0: enabled, 1: disabled
  }

  /**
   * @notice Check if quadratic voting is disabled for the current round.
   * @param self - The storage reference for the GovernorStorage.
   * @return true if quadratic voting is disabled, false otherwise.
   */
  function isQuadraticVotingDisabledForCurrentRound(
    GovernorStorageTypesV3.GovernorStorage storage self
  ) public view returns (bool) {
    // Get the block number the emission round started.
    uint256 roundStartBlock = self.xAllocationVoting.currentRoundSnapshot();

    // Check if quadratic voting is enabled or disabled for the current round.
    return self.quadraticVotingDisabled.upperLookupRecent(SafeCast.toUint48(roundStartBlock)) == 1; // 0: enabled, 1: disabled
  }
}
