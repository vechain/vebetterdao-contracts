//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IProtocolStaker {
    event ValidationQueued(
        address indexed validator,
        address indexed endorser,
        uint32 period,
        uint256 stake
    );
    event ValidationWithdrawn(address indexed validator, uint256 stake);
    event ValidationSignaledExit(address indexed validator);
    event StakeIncreased(address indexed validator, uint256 added);
    event StakeDecreased(address indexed validator, uint256 removed);
    event BeneficiarySet(address indexed validator, address beneficiary);

    event DelegationAdded(
        address indexed validator,
        uint256 indexed delegationID,
        uint256 stake,
        uint8 multiplier
    );
    event DelegationWithdrawn(uint256 indexed delegationID, uint256 stake);
    event DelegationSignaledExit(uint256 indexed delegationID);

    /**
     * @dev totalStake returns all stakes and weight by active validators.
     */
    function totalStake() external view returns (uint256 totalStake, uint256 totalWeight);

    /**
     * @dev queuedStake returns all stakes by queued validators.
     */
    function queuedStake() external view returns (uint256 queuedStake);

    /**
     * @dev addValidation creates a validation to the queue.
     */
    function addValidation(address validator, uint32 period) external payable;

    /**
     * @dev increaseStake adds VET to the current stake of the queued/active validator.
     */
    function increaseStake(address validator) external payable;

    /**
     * @dev setBeneficiary sets the beneficiary address for a validator.
     */
    function setBeneficiary(address validator, address beneficiary) external;

    /**
     * @dev decreaseStake removes VET from the current stake of an active validator
     */
    function decreaseStake(address validator, uint256 amount) external;

    /**
     * @dev allows the caller to withdraw a stake when their status is set to exited
     */
    function withdrawStake(address validator) external;

    /**
     * @dev signalExit signals the intent to exit a validator position at the end of the staking period.
     */
    function signalExit(address validator) external;

    /**
     * @dev addDelegation creates a delegation position on a validator.
     */
    function addDelegation(
        address validator,
        uint8 multiplier // (% of msg.value) 100 for x1, 200 for x2, etc. This enforces a maximum of 2.56x multiplier
    ) external payable returns (uint256 delegationID);

    /**
     * @dev exitDelegation signals the intent to exit a delegation position at the end of the staking period.
     * Funds are available once the current staking period ends.
     */
    function signalDelegationExit(uint256 delegationID) external;

    /**
     * @dev withdrawDelegation withdraws the delegation position funds.
     */
    function withdrawDelegation(uint256 delegationID) external;

    /**
     * @dev getDelegation returns the validator, stake, and multiplier of a delegation.
     */
    function getDelegation(
        uint256 delegationID
    ) external view returns (address validator, uint256 stake, uint8 multiplier, bool isLocked);

    /**
     * @dev getDelegationPeriodDetails returns the start, end period and isLocked status of a delegation.
     */
    function getDelegationPeriodDetails(
        uint256 delegationID
    ) external view returns (uint32 startPeriod, uint32 endPeriod);

    /**
     * @dev getValidation returns the validator stake. endorser, stake, weight of a validator.
     */
    function getValidation(
        address validator
    )
        external
        view
        returns (
            address endorser,
            uint256 stake,
            uint256 weight,
            uint256 queuedStake,
            uint8 status,
            uint32 offlineBlock
        );

    /**
     * @dev getValidationPeriodDetails returns the validator period details. period, startBlock, exitBlock and completed periods for a validator.
     */
    function getValidationPeriodDetails(
        address validator
    )
        external
        view
        returns (uint32 period, uint32 startBlock, uint32 exitBlock, uint32 completedPeriods);

    /**
     * @dev getWithdrawable returns the amount of a validator's withdrawable VET.
     */
    function getWithdrawable(address id) external view returns (uint256 withdrawableVET);

    /**
     * @dev firstActive returns the head validatorId of the active validators.
     */
    function firstActive() external view returns (address firstActive);

    /**
     * @dev firstQueued returns the head validatorId of the queued validators.
     */
    function firstQueued() external view returns (address firstQueued);

    /**
     * @dev next returns the validator in a linked list
     */
    function next(address prev) external view returns (address nextValidation);

    /**
     * @dev getDelegatorsRewards returns all delegators rewards for the given validator address and staking period.
     */
    function getDelegatorsRewards(
        address validator,
        uint32 stakingPeriod
    ) external view returns (uint256 rewards);

    /**
     * @dev getValidationTotals returns the total locked, total locked weight,
     * total queued, total queued weight, total exiting and total exiting weight for a validator.
     */
    function getValidationTotals(
        address validator
    )
        external
        view
        returns (
            uint256 lockedVET,
            uint256 lockedWeight,
            uint256 queuedVET,
            uint256 exitingVET,
            uint256 nextPeriodWeight
        );

    /**
     * @dev getValidationsNum returns the number of active and queued validators.
     */
    function getValidationsNum() external view returns (uint64 activeCount, uint64 queuedCount);

    /**
     * @dev issuance returns the total amount of VTHO generated for the context of current block.
     */
    function issuance() external view returns (uint256 issued);
}
