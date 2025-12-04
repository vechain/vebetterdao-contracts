// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IProtocolStaker.sol";

/// The ProtocolStakerMock contract is a mock implementation of the IProtocolStaker interface.
/// It is used for unit testing the Stargate contract.
/// It has some helper functions to set the status of a validator or a delegation.
/// When a validation is added, it is automatically set as queued, and the start block is set to the current block.
/// When a delegation is added, it is automatically set as not locked, and the start period
/// is set to the next period after the validator completed its period.
/// Signal exit sets the exit block to the start block + the blocks completed by the validator + 1 period of blocks.
/// Signal delegation exit sets the end period to the current period.
/// Withdraw delegation sets the stake to 0.
/// Withdraw stake sets the stake to 0.
/// Total stake, queued stake, total weight, first active, first queued and next are all set to 0
/// and not implemented.
contract ProtocolStakerMock is IProtocolStaker {
  enum ValidatorStatus {
    UNKNOWN,
    QUEUED,
    ACTIVE,
    EXITED
  }

  struct Validation {
    uint32 startBlock;
    uint32 period;
    ValidatorStatus status;
    uint32 exitBlock;
    uint32 completedPeriods;
  }

  struct Delegation {
    address validator;
    uint256 stake;
    uint8 multiplier;
    bool isLocked;
    uint32 startPeriod;
    uint32 endPeriod;
  }

  mapping(address => Validation) public validations;
  mapping(uint256 => Delegation) public delegations;
  address private stargate;
  uint32 private delegationId;

  function helper__setDelegationValidator(uint256 _delegationID, address _validator) external {
    delegations[_delegationID].validator = _validator;
  }

  function helper__setStargate(address _stargate) external {
    stargate = _stargate;
  }

  function helper__setValidatorStatus(address _validator, ValidatorStatus _validatorStatus) external {
    validations[_validator].status = _validatorStatus;
  }

  function helper__setValidationExitBlock(address _validator, uint32 _exitBlock) external {
    validations[_validator].exitBlock = _exitBlock;
  }

  function helper__setDelegationIsLocked(uint256 _delegationID, bool _isLocked) external {
    delegations[_delegationID].isLocked = _isLocked;
  }

  function helper__setValidationCompletedPeriods(address _validator, uint32 _completedPeriods) external {
    validations[_validator].completedPeriods = _completedPeriods;
  }

  function helper__setDelegationStartPeriod(uint256 _delegationID, uint32 _startPeriod) external {
    delegations[_delegationID].startPeriod = _startPeriod;
  }

  function totalStake() external view returns (uint256 _totalStake, uint256 _totalWeight) {
    return (0, 0);
  }

  /**
   * @dev queuedStake returns all stakes by queued validators.
   */
  function queuedStake() external view returns (uint256 _queuedStake) {
    return 0;
  }

  /**
   * @dev addValidation creates a validation to the queue.
   */
  function addValidation(address _validator, uint32 _period) external payable {
    validations[_validator] = Validation({
      startBlock: uint32(block.number),
      status: ValidatorStatus.QUEUED,
      period: _period,
      exitBlock: type(uint32).max,
      completedPeriods: 0
    });
    return;
  }

  /**
   * @dev increaseStake adds VET to the current stake of the queued/active validator.
   */
  function increaseStake(address _validator) external payable {
    return;
  }

  /**
   * @dev setBeneficiary sets the beneficiary address for a validator.
   */
  function setBeneficiary(address _validator, address _beneficiary) external {
    return;
  }

  /**
   * @dev decreaseStake removes VET from the current stake of an active validator
   */
  function decreaseStake(address _validator, uint256 _amount) external {
    return;
  }

  /**
   * @dev allows the caller to withdraw a stake when their status is set to exited
   */
  function withdrawStake(address _validator) external {
    return;
  }

  /**
   * @dev signalExit signals the intent to exit a validator position at the end of the staking period.
   */
  function signalExit(address _validator) external {
    Validation memory validation = validations[_validator];
    // exit block is the start block + the blocks completed by the validator + 1 period of blocks
    validations[_validator].exitBlock = validation.startBlock + (validation.completedPeriods + 1) * validation.period;
  }

  /**
   * @dev addDelegation creates a delegation position on a validator.
   */
  function addDelegation(
    address _validator,
    uint8 _multiplier // (% of msg.value) 100 for x1, 200 for x2, etc. This enforces a maximum of 2.56x multiplier
  ) external payable returns (uint256) {
    delegationId++;
    delegations[delegationId] = Delegation({
      validator: _validator,
      stake: msg.value,
      multiplier: _multiplier,
      isLocked: false,
      // start period is the next period after the validator completed its period
      // +0 last completed period
      // +1 current period
      // +2 next period
      startPeriod: validations[_validator].completedPeriods + 2,
      // end period is infinite
      endPeriod: type(uint32).max
    });
    return delegationId;
  }

  /**
   * @dev exitDelegation signals the intent to exit a delegation position at the end of the staking period.
   * Funds are available once the current staking period ends.
   */
  function signalDelegationExit(uint256 _delegationID) external {
    // set the end period to the current period
    delegations[_delegationID].endPeriod = validations[delegations[_delegationID].validator].completedPeriods + 1;
  }

  /**
   * @dev withdrawDelegation withdraws the delegation position funds.
   */
  function withdrawDelegation(uint256 _delegationID) external {
    uint256 stake = delegations[_delegationID].stake;
    delegations[_delegationID].stake = 0;
    (bool success, ) = payable(stargate).call{ value: stake }("");
    if (!success) {
      revert("WithdrawDelegationFailed");
    }
  }

  /**
   * @dev getDelegation returns the validator, stake, and multiplier of a delegation.
   */
  function getDelegation(
    uint256 _delegationID
  ) external view returns (address validator, uint256 stake, uint8 multiplier, bool isLocked) {
    return (
      delegations[_delegationID].validator,
      delegations[_delegationID].stake,
      delegations[_delegationID].multiplier,
      delegations[_delegationID].isLocked
    );
  }

  /**
   * @dev getDelegationPeriodDetails returns the start, end period and isLocked status of a delegation.
   */
  function getDelegationPeriodDetails(
    uint256 _delegationID
  ) external view returns (uint32 startPeriod, uint32 endPeriod) {
    return (delegations[_delegationID].startPeriod, delegations[_delegationID].endPeriod);
  }

  /**
   * @dev getValidation returns the validator stake. endorser, stake, weight of a validator.
   */
  function getValidation(
    address _validator
  )
    external
    view
    returns (
      address _endorser,
      uint256 _stake,
      uint256 _weight,
      uint256 _queuedStake,
      uint8 _status,
      uint32 _offlineBlock
    )
  {
    Validation memory validation = validations[_validator];
    return (address(0), 0, 0, 0, uint8(validation.status), 0);
  }

  /**
   * @dev getValidationPeriodDetails returns the validator period details. period, startBlock, exitBlock and completed periods for a validator.
   */
  function getValidationPeriodDetails(
    address _validator
  ) external view returns (uint32 period, uint32 startBlock, uint32 exitBlock, uint32 completedPeriods) {
    Validation memory validation = validations[_validator];
    return (validation.period, validation.startBlock, validation.exitBlock, validation.completedPeriods);
  }

  /**
   * @dev getWithdrawable returns the amount of a validator's withdrawable VET.
   */
  function getWithdrawable(address _id) external view returns (uint256 withdrawableVET) {
    return 0;
  }

  /**
   * @dev firstActive returns the head validatorId of the active validators.
   */
  function firstActive() external view returns (address firstActive) {
    return address(0);
  }

  /**
   * @dev firstQueued returns the head validatorId of the queued validators.
   */
  function firstQueued() external view returns (address firstQueued) {
    return address(0);
  }

  /**
   * @dev next returns the validator in a linked list
   */
  function next(address _prev) external view returns (address nextValidation) {
    return address(0);
  }

  /**
   * @dev getDelegatorsRewards returns all delegators rewards for the given validator address and staking period.
   */
  function getDelegatorsRewards(address _validator, uint32 _stakingPeriod) external view returns (uint256 rewards) {
    if (_stakingPeriod > validations[_validator].completedPeriods + 1) {
      return 0;
    }
    return 0.1 ether;
  }

  /**
   * @dev getValidationTotals returns the total locked, total locked weight,
   * total queued, total queued weight, total exiting and total exiting weight for a validator.
   */
  function getValidationTotals(
    address _validator
  )
    external
    view
    returns (uint256 lockedVET, uint256 lockedWeight, uint256 queuedVET, uint256 exitingVET, uint256 nextPeriodWeight)
  {
    return (0, 0, 0, 0, 0);
  }

  /**
   * @dev getValidationsNum returns the number of active and queued validators.
   */
  function getValidationsNum() external view returns (uint64 activeCount, uint64 queuedCount) {
    return (0, 0);
  }

  /**
   * @dev issuance returns the total amount of VTHO generated for the context of current block.
   */
  function issuance() external pure returns (uint256 issued) {
    return 0;
  }
}
