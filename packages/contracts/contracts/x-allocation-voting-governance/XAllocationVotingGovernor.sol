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

import { ERC165Upgradeable } from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { IXAllocationVotingGovernor, IERC6372 } from "../interfaces/IXAllocationVotingGovernor.sol";
import { IXAllocationPool } from "../interfaces/IXAllocationPool.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IX2EarnApps } from "../interfaces/IX2EarnApps.sol";
import { IEmissions } from "../interfaces/IEmissions.sol";
import { IVoterRewards } from "../interfaces/IVoterRewards.sol";
import { IVeBetterPassport } from "../interfaces/IVeBetterPassport.sol";
import { IRelayerRewardsPool, RelayerAction } from "../interfaces/IRelayerRewardsPool.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IB3TRGovernor } from "../interfaces/IB3TRGovernor.sol";

/**
 * @title XAllocationVotingGovernor
 * @dev Core of the voting system of allocation rounds, designed to be extended through various modules.
 *
 * This contract is abstract and requires several functions to be implemented in various modules:
 * - A counting module must implement {quorum}, {_quorumReached}, {_voteSucceeded}, and {_countVote}
 * - A voting module must implement {_getVotes}, {clock}, and {CLOCK_MODE}
 * - A settings module must implement {votingPeriod}
 * - An external contracts module must implement {x2EarnApps}, {emissions}, {voterRewards} and {b3trGovernor}
 * - A rounds storage module must implement {_startNewRound}, {roundSnapshot}, {roundDeadline}, and {currentRoundId}
 * - A rounds finalization module must implement {finalize}
 * - A earnings settings module must implement {_snapshotRoundEarningsCap}
 *
 * ----- Version 2 -----
 * - Integrated VeBetterPassport
 *
 * ----- Version 5 -----
 * - Fixed duplicate app voting in same transaction in {RoundVotesCountingUpgradeable._countVote}
 *
 * ----- Version 7 -----
 * - Added B3TRGovernor contract to the contract
 *
 * ----- Version 8 -----
 * - Added autovoting functionality allowing users to enable automatic voting with predefined app preferences
 * - Added refactoring to code for voting
 * - Integrate RelayerRewardsPool contract to handle relayer rewards for autovoting
 */
abstract contract XAllocationVotingGovernor is
  Initializable,
  ContextUpgradeable,
  ERC165Upgradeable,
  IXAllocationVotingGovernor
{
  bytes32 private constant ALL_ROUND_STATES_BITMAP = bytes32((2 ** (uint8(type(RoundState).max) + 1)) - 1);

  /// @custom:storage-location erc7201:b3tr.storage.XAllocationVotingGovernor
  struct XAllocationVotingGovernorStorage {
    string _name;
  }

  // keccak256(abi.encode(uint256(keccak256("b3tr.storage.XAllocationVotingGovernor")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant XAllocationVotingGovernorStorageLocation =
    0x7fb63bcd433c69110ad961bfbe38aef51814cbb9e11af6fe21011ae43fb4be00;

  function _getXAllocationVotingGovernorStorage() internal pure returns (XAllocationVotingGovernorStorage storage $) {
    assembly {
      $.slot := XAllocationVotingGovernorStorageLocation
    }
  }

  /**
   * @dev Sets the value for {name}
   */
  function __XAllocationVotingGovernor_init(string memory name_) internal onlyInitializing {
    __XAllocationVotingGovernor_init_unchained(name_);
  }

  function __XAllocationVotingGovernor_init_unchained(string memory name_) internal onlyInitializing {
    XAllocationVotingGovernorStorage storage $ = _getXAllocationVotingGovernorStorage();
    $._name = name_;
  }

  // ---------- Setters ---------- //

  /**
   * @dev Starts a new round of voting to allocate funds to x-2-earn applications.
   */
  function startNewRound() public virtual returns (uint256) {
    address proposer = _msgSender();

    // check that there isn't an already ongoing round
    // but only do it after we have at least 1 round otherwise it will fail with `GovernorNonexistentRound`
    uint256 currentRound = currentRoundId();
    if (currentRound > 0) {
      require(!isActive(currentRound), "XAllocationVotingGovernor: there can be only one round per time");
    }

    return _startNewRound(proposer);
  }

  /**
   * @dev Cast a vote for a set of x-2-earn applications.
   * @notice Only addresses with a valid passport can vote.
   * @notice Reverts if autovoting is enabled for the voter.
   */
  function castVote(uint256 roundId, bytes32[] memory appIds, uint256[] memory voteWeights) public virtual {
    require(appIds.length == voteWeights.length, "XAllocationVotingGovernor: apps and weights length mismatch");
    require(appIds.length > 0, "XAllocationVotingGovernor: no apps to vote for");

    if (this.isUserAutoVotingEnabledAtTimepoint(_msgSender(), SafeCast.toUint48(currentRoundSnapshot()))) {
      revert AutoVotingEnabled(_msgSender());
    }

    validatePersonhoodForCurrentRound(_msgSender());

    _handleCastVote(_msgSender(), roundId, appIds, voteWeights, false);
  }

  // ---------- Internal and Private ---------- //

  /**
   * @dev Cast a vote for a set of x-2-earn applications on behalf of an account (used for autovoting).
   * @notice Reverts if autovoting is not enabled for the voter.
   */
  function castVoteOnBehalfOf(address voter, uint256 roundId) public {
    if (!this.isUserAutoVotingEnabledAtTimepoint(voter, SafeCast.toUint48(roundSnapshot(roundId)))) {
      revert AutoVotingNotEnabled(voter);
    }

    _checkEarlyAccessEligibility(roundId, voter);

    (bool isPerson, ) = veBetterPassport().isPersonAtTimepoint(voter, SafeCast.toUint48(currentRoundSnapshot()));

    bytes32[] memory appIds = _getUserVotingPreferences(voter);

    (bytes32[] memory finalAppIds, uint256[] memory voteWeights, uint256 votingPower) = _prepareAutoVoteArrays(
      voter,
      roundId,
      appIds
    );

    // We disable auto-voting if,
    // - voter is not a person
    // - there are no eligible apps
    // - voter has insufficient voting power
    if (!isPerson || finalAppIds.length == 0) {
      // Only toggle and reduce expected actions if autovoting is enabled
      if (_isAutoVotingEnabled(voter)) {
        _toggleAutoVoting(voter);
        relayerRewardsPool().reduceExpectedActionsForRound(roundId, 1);
      }
      emit AutoVoteSkipped(voter, roundId, isPerson, finalAppIds.length, votingPower);
      return;
    }

    _handleCastVote(voter, roundId, finalAppIds, voteWeights, true);
  }

  /**  @dev Internal function to handle common voting logic
   * @param voter The address casting the vote
   * @param roundId The round ID to vote in
   * @param appIds Array of app IDs to vote for
   * @param voteWeights Array of vote weights for each app
   * @param isAutoVote Whether this is an auto vote (affects events and relayer rewards)
   */
  function _handleCastVote(
    address voter,
    uint256 roundId,
    bytes32[] memory appIds,
    uint256[] memory voteWeights,
    bool isAutoVote
  ) internal {
    _validateStateBitmap(roundId, _encodeStateBitmap(RoundState.Active));

    _countVote(roundId, voter, appIds, voteWeights);

    if (isAutoVote) {
      relayerRewardsPool().registerRelayerAction(_msgSender(), voter, roundId, RelayerAction.VOTE);
      emit AllocationAutoVoteCast(voter, roundId, appIds, voteWeights);
    }
  }

  /**
   * @dev Validate that the voter is a person at the current round snapshot
   * @param voter The voter address
   */
  function validatePersonhoodForCurrentRound(address voter) public view returns (bool) {
    (bool isPerson, string memory explanation) = veBetterPassport().isPersonAtTimepoint(
      voter,
      SafeCast.toUint48(currentRoundSnapshot())
    );
    if (!isPerson) {
      revert GovernorPersonhoodVerificationFailed(voter, explanation);
    }
    return isPerson;
  }

  /**
   * @dev Gets total voting power (voting power + deposit voting power) for an account and validates it meets the minimum threshold for auto-voting
   */
  function getAndValidateVotingPower(address account, uint256 timepoint) public view returns (uint256, bool) {
    uint256 voterAvailableVotes = getTotalVotingPower(account, timepoint);
    bool isValid = voterAvailableVotes >= 1 ether;
    return (voterAvailableVotes, isValid);
  }

  /**
   * @dev Check if the caller is eligible to perform relayer actions during early access period
   * @param roundId The current round ID
   */
  function _checkEarlyAccessEligibility(uint256 roundId, address voter) internal view {
    relayerRewardsPool().validateVoteDuringEarlyAccess(roundId, voter, _msgSender());
  }

  /**
   * @dev Check that the current state of a round matches the requirements described by the `allowedStates` bitmap.
   * This bitmap should be built using `_encodeStateBitmap`.
   *
   * If requirements are not met, reverts with a {GovernorUnexpectedRoundState} error.
   */
  function _validateStateBitmap(uint256 roundId, bytes32 allowedStates) private view returns (RoundState) {
    RoundState currentState = state(roundId);
    if (_encodeStateBitmap(currentState) & allowedStates == bytes32(0)) {
      revert GovernorUnexpectedRoundState(roundId, currentState, allowedStates);
    }
    return currentState;
  }

  // ---------- Getters ---------- //

  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(IERC165, ERC165Upgradeable) returns (bool) {
    return interfaceId == type(IXAllocationVotingGovernor).interfaceId || super.supportsInterface(interfaceId);
  }

  /**
   * @dev Returns the name of the governor.
   */
  function name() public view virtual returns (string memory) {
    XAllocationVotingGovernorStorage storage $ = _getXAllocationVotingGovernorStorage();
    return $._name;
  }

  /**
   * @dev Returns the version of the governor.
   */
  function version() public view virtual returns (string memory) {
    return "8";
  }

  /**
   * @dev Checks if the specified round is in active state or not.
   */
  function isActive(uint256 roundId) public view virtual override returns (bool) {
    return state(roundId) == RoundState.Active;
  }

  /**
   * @dev Returns the current state of a round.
   */
  function state(uint256 roundId) public view virtual returns (RoundState) {
    uint256 snapshot = roundSnapshot(roundId);

    if (snapshot == 0) {
      revert GovernorNonexistentRound(roundId);
    }

    uint256 currentTimepoint = clock();

    uint256 deadline = roundDeadline(roundId);

    if (deadline >= currentTimepoint) {
      return RoundState.Active;
    } else if (!_voteSucceeded(roundId)) {
      return RoundState.Failed;
    } else {
      return RoundState.Succeeded;
    }
  }

  /**
   * @dev Checks if the quorum has been reached for a given round.
   */
  function quorumReached(uint256 roundId) public view returns (bool) {
    return _quorumReached(roundId);
  }

  /**
   * @dev Returns the available votes votes for a given account at a given timepoint.
   */
  function getVotes(address account, uint256 timepoint) public view virtual returns (uint256) {
    return _getVotes(account, timepoint, "");
  }

  /**
   * @dev Get the total voting power (VOT3 tokens + deposits) for a voter at a given timepoint
   * @param voter The address of the voter
   * @param roundStart The start of the round (timepoint)
   * @return Combined voting power from held tokens and proposal deposits
   */
  function getTotalVotingPower(address voter, uint256 roundStart) public view virtual returns (uint256) {
    uint256 voterAvailableVotesWithDeposit = getDepositVotingPower(voter, roundStart);
    uint256 voterAvailableVotes = getVotes(voter, roundStart) + voterAvailableVotesWithDeposit;

    return voterAvailableVotes;
  }

  /**
   * @dev Checks if the given appId can be voted for in the given round.
   */
  function isEligibleForVote(bytes32 appId, uint256 roundId) public view virtual returns (bool) {
    return x2EarnApps().isEligible(appId, roundSnapshot(roundId));
  }

  /**
   * @dev Encodes a `RoundState` into a `bytes32` representation where each bit enabled corresponds to
   * the underlying position in the `RoundState` enum. For example:
   *
   * 0x000...10000
   *   ^^^^^^------ ...
   *          ^---- Succeeded
   *           ^--- Failed
   *            ^-- Active
   */
  function _encodeStateBitmap(RoundState roundState) internal pure returns (bytes32) {
    return bytes32(1 << uint8(roundState));
  }

  // ---------- Virtual ---------- //

  /**
   * @dev Internal function to store a vote in storage.
   */
  function _countVote(
    uint256 roundId,
    address account,
    bytes32[] memory appIds,
    uint256[] memory voteWeights
  ) internal virtual;

  /**
   * @dev Internal function to save the app shares cap and base allocation percentage for a round.
   */
  function _snapshotRoundEarningsCap(uint256 roundId) internal virtual;

  /**
   * @dev Internal function to check if the quorum has been reached for a given round.
   */
  function _quorumReached(uint256 roundId) internal view virtual returns (bool);

  /**
   * @dev Internal function to check if the vote has succeeded for a given round.
   */
  function _voteSucceeded(uint256 roundId) internal view virtual returns (bool);

  /**
   * @dev Internal function that starts a new round of voting to allocate funds to x-2-earn applications.
   */
  function _startNewRound(address proposer) internal virtual returns (uint256);

  /**
   * @dev Internal function to get the available votes for a given account at a given timepoint.
   */
  function _getVotes(address account, uint256 timepoint, bytes memory params) internal view virtual returns (uint256);

  /**
   * @dev Function to store the last succeeded round once a round ends.
   */
  function finalizeRound(uint256 roundId) public virtual;

  /**
   * @dev Clock used for flagging checkpoints. Can be overridden to implement timestamp based checkpoints (and voting), in which case {CLOCK_MODE} should be overridden as well to match.
   */
  function clock() public view virtual returns (uint48);

  /**
   * @dev Machine-readable description of the clock as specified in EIP-6372.
   */
  function CLOCK_MODE() public view virtual returns (string memory);

  /**
   * @dev Returns the voting duration.
   */
  function votingPeriod() public view virtual returns (uint256);

  /**
   * @dev Returns the quorum for a given timepoint.
   */
  function quorum(uint256 timepoint) public view virtual returns (uint256);

  /**
   * @dev Returns the block number when the round starts.
   */
  function roundSnapshot(uint256 roundId) public view virtual returns (uint256);

  /**
   * @dev Returns the block number when the round ends.
   */
  function roundDeadline(uint256 roundId) public view virtual returns (uint256);

  /**
   * @dev Returns the latest round id.
   */
  function currentRoundId() public view virtual returns (uint256);

  /**
   * @dev Returns the X2EarnApps contract.
   */
  function currentRoundSnapshot() public view virtual returns (uint256);

  /**
   * @dev Returns the X2EarnApps contract.
   */
  function x2EarnApps() public view virtual returns (IX2EarnApps);

  /**
   * @dev Returns the VeBetterPassport contract.
   */
  function veBetterPassport() public view virtual returns (IVeBetterPassport);

  /**
   * @dev Returns the Emissions contract.
   */
  function emissions() public view virtual returns (IEmissions);

  /**
   * @dev Returns the VoterRewards contract.
   */
  function voterRewards() public view virtual returns (IVoterRewards);

  /**
   * @dev Returns the B3TRGovernor contract.
   */
  function b3trGovernor() public view virtual returns (IB3TRGovernor);

  /**
   * @dev Returns the deposit voting power for a given account at a given timepoint.
   */
  function getDepositVotingPower(address account, uint256 timepoint) public view virtual returns (uint256) {
    return b3trGovernor().getDepositVotingPower(account, timepoint);
  }

  /**
   * @dev Returns the RelayerRewardsPool contract.
   */
  function relayerRewardsPool() public view virtual returns (IRelayerRewardsPool);

  /**
   * @dev Toggles autovoting for an account
   */
  function _toggleAutoVoting(address account) internal virtual;

  /**
   * @dev Checks if autovoting is enabled for an account
   */
  function _isAutoVotingEnabled(address account) internal view virtual returns (bool);

  /**
   * @dev Checks if autovoting is enabled for an account at a specific timepoint
   */
  function _isAutoVotingEnabledAtTimepoint(address account, uint48 timepoint) internal view virtual returns (bool);

  /**
   * @dev Returns the voting preferences for an account
   */
  function _getUserVotingPreferences(address account) internal view virtual returns (bytes32[] memory);

  /**
   * @dev Gets the total number of users who enabled autovoting at a specific timepoint
   */
  function _getTotalAutoVotingUsersAtTimepoint(uint48 timepoint) internal view virtual returns (uint208);

  /**
   * @dev Prepares arrays for auto-voting by filtering eligible apps and calculating vote weights
   */
  function _prepareAutoVoteArrays(
    address voter,
    uint256 roundId,
    bytes32[] memory preferredApps
  ) internal virtual returns (bytes32[] memory finalAppIds, uint256[] memory voteWeights, uint256 votingPower);
}
