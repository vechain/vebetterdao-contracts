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

import { GovernorStorageTypesV8 } from "./GovernorStorageTypesV8.sol";
import { GovernorStateLogicV8 } from "./GovernorStateLogicV8.sol";
import { GovernorTypesV8 } from "./GovernorTypesV8.sol";
import { GovernorConfiguratorV8 } from "./GovernorConfiguratorV8.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { GovernorClockLogicV8 } from "./GovernorClockLogicV8.sol";
/// @title GovernorDepositLogic Library
/// @notice Library for managing deposits related to proposals in the Governor contract.
/// @dev This library provides functions to deposit and withdraw tokens for proposals, and to get deposit-related information.
library GovernorDepositLogicV8 {
  using Checkpoints for Checkpoints.Trace208;
  /// @dev Emitted when a deposit is made to a proposal.
  event ProposalDeposit(address indexed depositor, uint256 indexed proposalId, uint256 amount);

  /// @dev Emitted when a deposit is withdrawn from a proposal.
  event ProposalWithdraw(address indexed withdrawer, uint256 indexed proposalId, uint256 amount);

  /// @dev Thrown when there is no deposit to withdraw.
  error GovernorNoDepositToWithdraw(uint256 proposalId, address depositer);

  /// @dev Thrown when the deposit amount is invalid (must be greater than 0).
  error GovernorInvalidDepositAmount();

  /// @dev Thrown when the proposal ID does not exist.
  error GovernorNonexistentProposal(uint256 proposalId);

  /// @dev Thrown when the grantee tries to deposit for their own grant.
  error GranteeCannotDepositOwnGrant(uint256 proposalId);

  // --------------- SETTERS ---------------
  /**
   * @notice Deposits tokens for a proposal.
   * @dev Proposer and proposal sponsors can contribute towards a proposal's deposit using this function. The proposal must be in the Pending state to make a deposit. The amount deposited from an address is tracked and can be withdrawn by the same address when the voting round is over.
   * @param self The storage reference for the GovernorStorage.
   * @param amount The amount of tokens to deposit.
   * @param proposalId The ID of the proposal.
   */
  function deposit(GovernorStorageTypesV8.GovernorStorage storage self, uint256 amount, uint256 proposalId) external {
    if (amount == 0) {
      revert GovernorInvalidDepositAmount();
    }

    GovernorTypesV8.ProposalCore storage proposal = self.proposals[proposalId];

    if (proposal.roundIdVoteStart == 0) {
      revert GovernorNonexistentProposal(proposalId);
    }

    if (proposal.proposer == msg.sender && self.proposalType[proposalId] == GovernorTypesV8.ProposalType.Grant) {
      revert GranteeCannotDepositOwnGrant(proposalId);
    }

    GovernorStateLogicV8.validateStateBitmap(
      self,
      proposalId,
      GovernorStateLogicV8.encodeStateBitmap(GovernorTypesV8.ProposalState.Pending)
    );

    proposal.depositAmount += amount;

    depositFunds(self, amount, msg.sender, proposalId);
  }

  /**
   * @notice Withdraws tokens previously deposited to a proposal.
   * @dev A depositor can only withdraw their tokens once the proposal is no longer Pending or Active. Each address can only withdraw once per proposal. Reverts if no deposits are available to withdraw or if the deposits have already been withdrawn by the message sender. Reverts if the token transfer fails.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal to withdraw deposits from.
   * @param depositer The address of the depositor.
   */
  function withdraw(GovernorStorageTypesV8.GovernorStorage storage self, uint256 proposalId, address depositer) external {
    uint256 amount = self.deposits[proposalId][depositer];

    GovernorStateLogicV8.validateStateBitmap(
      self,
      proposalId,
      GovernorStateLogicV8.ALL_PROPOSAL_STATES_BITMAP ^
        GovernorStateLogicV8.encodeStateBitmap(GovernorTypesV8.ProposalState.Pending)
    );

    if (amount == 0) {
      revert GovernorNoDepositToWithdraw(proposalId, depositer);
    }

    self.deposits[proposalId][depositer] = 0;

    uint208 currentVotes = self.depositsVotingPower[depositer].upperLookupRecent(GovernorClockLogicV8.clock(self));
    uint208 newVotes = SafeCast.toUint208(currentVotes - amount);
    self.depositsVotingPower[depositer].push(GovernorClockLogicV8.clock(self), newVotes);

    require(self.vot3.transfer(depositer, amount), "B3TRGovernor: transfer failed");

    emit ProposalWithdraw(depositer, proposalId, amount);
  }

  /**
   * @notice Internal function to deposit tokens to a proposal and store the deposit in the deposits checkpoint.
   * @dev Emits a {ProposalDeposit} event.
   * @param self The storage reference for the GovernorStorage.
   * @param amount The amount of tokens to deposit.
   * @param depositor The address of the depositor.
   * @param proposalId The ID of the proposal.
   */
  function depositFunds(
    GovernorStorageTypesV8.GovernorStorage storage self,
    uint256 amount,
    address depositor,
    uint256 proposalId
  ) internal {
    require(self.vot3.transferFrom(depositor, address(this), amount), "B3TRGovernor: transfer failed");

    self.deposits[proposalId][depositor] += amount;

    uint208 currentVotes = self.depositsVotingPower[depositor].upperLookupRecent(GovernorClockLogicV8.clock(self));
    uint208 newVotes = currentVotes + SafeCast.toUint208(amount);
    self.depositsVotingPower[depositor].push(GovernorClockLogicV8.clock(self), newVotes);

    emit ProposalDeposit(depositor, proposalId, amount);
  }

  // --------------- GETTERS ---------------
  /**
   * @notice Returns the amount of tokens deposited by a user for a proposal.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @param user The address of the user.
   * @return uint256 The amount of tokens deposited by the user.
   */
  function getUserDeposit(
    GovernorStorageTypesV8.GovernorStorage storage self,
    uint256 proposalId,
    address user
  ) internal view returns (uint256) {
    return self.deposits[proposalId][user];
  }

  /**
   * @notice Returns the deposit threshold for a proposal.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @return uint256 The deposit threshold for the proposal.
   */
  function proposalDepositThreshold(
    GovernorStorageTypesV8.GovernorStorage storage self,
    uint256 proposalId
  ) internal view returns (uint256) {
    return self.proposals[proposalId].depositThreshold;
  }

  /**
   * @notice Returns the total amount of deposits made to a proposal.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @return uint256 The total amount of deposits made to the proposal.
   */
  function getProposalDeposits(
    GovernorStorageTypesV8.GovernorStorage storage self,
    uint256 proposalId
  ) internal view returns (uint256) {
    return self.proposals[proposalId].depositAmount;
  }

  /**
   * @notice Returns true if the threshold of deposits required to reach a proposal has been reached.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalId The ID of the proposal.
   * @return True if the deposit threshold has been reached, false otherwise.
   */
  function proposalDepositReached(
    GovernorStorageTypesV8.GovernorStorage storage self,
    uint256 proposalId
  ) internal view returns (bool) {
    GovernorTypesV8.ProposalCore storage proposal = self.proposals[proposalId];
    return proposal.depositAmount >= proposal.depositThreshold;
  }

  /**
   * @notice Internal function to calculate the deposit threshold for a proposal type as a percentage of the total supply of B3TR tokens.
   * @dev In case the percentage based threshold is greater than the max threshold, the max threshold is returned.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The type of proposal.
   * @return uint256 The deposit threshold for the proposal type.
   */
  function _depositThresholdByProposalType(
    GovernorStorageTypesV8.GovernorStorage storage self,
    GovernorTypesV8.ProposalType proposalType
  ) internal view returns (uint256) {
    uint256 percentageBasedThreshold = (GovernorConfiguratorV8.getDepositThresholdPercentage(self, proposalType) *
      self.b3tr.totalSupply()) / 100;
    uint256 maxThreshold = GovernorConfiguratorV8.getDepositThresholdCap(self, proposalType);

    if (percentageBasedThreshold > maxThreshold) {
      return maxThreshold;
    }

    return percentageBasedThreshold;
  }
  /**
   * @notice Returns the deposit threshold for a proposal type.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The type of proposal.
   * @return uint256 The deposit threshold for the proposal type.
   */
  function depositThresholdByProposalType(
    GovernorStorageTypesV8.GovernorStorage storage self,
    GovernorTypesV8.ProposalType proposalType
  ) external view returns (uint256) {
    return _depositThresholdByProposalType(self, proposalType);
  }

  /**
   * @notice Returns the deposit voting power for a given account at a given timepoint.
   * @param self The storage reference for the GovernorStorage.
   * @param account The address of the account.
   * @param timepoint The timepoint.
   * @return The deposit voting power.
   */
  function getDepositVotingPower(
    GovernorStorageTypesV8.GovernorStorage storage self,
    address account,
    uint256 timepoint
  ) public view returns (uint256) {
    return self.depositsVotingPower[account].upperLookupRecent(SafeCast.toUint48(timepoint));
  }
}
