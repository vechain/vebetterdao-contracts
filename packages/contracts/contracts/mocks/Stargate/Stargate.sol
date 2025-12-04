// SPDX-License-Identifier: MIT

//        ✦     *        .         ✶         *        .       ✦       .
//  ✦   _______..___________.    ___      .______        _______      ___   .___________. _______   ✦
//     /       ||           |   /   \     |   _  \      /  _____|    /   \  |           ||   ____|  *
//    |   (----``---|  |----`  /  ^  \    |  |_)  |    |  |  __     /  ^  \ `---|  |----`|  |__      .
//     \   \        |  |      /  /_\  \   |      /     |  | |_ |   /  /_\  \    |  |     |   __|     ✶
// .----)   |       |  |     /  _____  \  |  |\  \----.|  |__| |  /  _____  \   |  |     |  |____   *
// |_______/        |__|    /__/     \__\ | _| `._____| \______| /__/     \__\  |__|     |_______|  ✦
//         *       .      ✦      *      .        ✶       *      ✦       .       *        ✶

pragma solidity 0.8.20;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IProtocolStaker } from "./interfaces/IProtocolStaker.sol";
import { IStargateNFT } from "./interfaces/IStargateNFT.sol";
import { IStargate } from "./interfaces/IStargate.sol";

import { DataTypes } from "./StargateNFT/libraries/DataTypes.sol";
import { Clock } from "./StargateNFT/libraries/Clock.sol";

/// @title Stargate
/// @notice This contract enables a user to stake and delegate their VET to a validator of the protocol (by interacting with the ProtocolStaker contract),
/// helping it to increase its probability of being selected to mine blocks. The owner of the NFT will accumulate rewards for each mined block by the selected validator.
/// The amount of rewards depends on the share of the effective stake from all the delegations of the validator in a period.
///
/// Delegation:
/// When the user delegates, the delegation is not active until the start of the next period of the validator. In the meantime, the user
/// can change the validator by calling the `delegate()` function again, cancel the delegation or unstake the token and get back the VET.
/// Once the delegation is active, the user can request to exit the delegation by calling `requestDelegationExit()`,
/// this will signal the exit to the protocol staking contract and will unlock the NFT and the VET at the start of the validator's next period.
/// When delegating the VET associated to the NFT is transferred to the ProtocolStaker contract, and after requesting the exit the VET are still there, and it requires
/// and extra interaction with the ProtocolStaker contract to withdraw the VET. For this reason, in many cases (during unstake or during a new delegation) this contract
/// to interact with the ProtocolStaker contract to withdraw the VET, and then possibily move it back to the ProtocolStaker contract again (in case of a new delegation).
///
/// Rewards:
/// The owner of the NFT can claim rewards for each completed period he was actively delegating to the validator by calling the `claimRewards()` function.
/// Rewards for ongoing periods are locked until the period ends, and can be tracked by calling the `lockedRewards()` function.
/// An user can check the rewards for the completed periods by calling the `claimableRewards()` function.
/// If an user wants to unstake or to delegate again, the rewards will be claimed automatically when calling the `unstake()` or `delegate()` functions.
/// Ownership of the NFT can be transferred to another address by interacting with the StargateNFT contract, and all the pending rewards and staked VET
/// will be transferred to the new owner.
///
/// Rewards edge cases:
/// Keep in mind that due the for loop the `claimRewards()` function can run out of gas if the number of periods is too high. Such situation should never occur on mainnet,
/// but it can happen on devnet. So for this reason we set a max number of claimable periods to 832, which is the maximum number of periods that can be claimed in a single transaction.
/// Nevertheless, if the NFT reaches the max number of claimable periods, the owner can call the `claimRewards()` function multiple times to claim all rewards.
/// The same goes for the `claimableRewards()` function, if the NFT reaches the max number of claimable periods, the owner can call the `claimableRewards()` with a batch parameter,
/// this will return the total claimable amount for for 832 periods per batch, so 0 to 831, 832 to 1663, etc.
/// Since the rewards are automatically claimed when unstaking or delegating again, it is advised to devs to use multiclauses transactions to claim the rewards before unstaking or delegating again.
///
/// Periods:
/// The start and end blocks of the validator period are not fixed and can change, and every validator has a different period duration.
/// For this reason the tokens of the same staker will not start claiming rewards at the same time. The "last claimed period" is tracked for each token and
/// is updated when the rewards are claimed.
/// To find out the claimable periods of a token, you can call the `claimableDelegationPeriods()` function.
/// Validator's periods are numbered incrementally by the protocol, so the first period is 1, the second is 2, etc. "Completed periods" refers to the latest id
/// of the completed period, which means that the current period (if validator is still active) is the next period of the completed periods (so +1).
///
/// StargateNFT:
/// This contract interacts with the `IStargateNFT` contract and handles the VET required when minting a new NFT.
/// Whenever an user stakes or unstakes this contract calls the `IStargateNFT.mint` and `IStargateNFT.burn` functions.
/// But the VET required to stake is handled by this contract.
/// The VET amount staked is tracked in the StargateNFT contract in the Token struct. Ideally this value should be stored in the Stargate contract,
/// but since the StargateNFT contract was already deployed and was already used to track this value before the deployment of this contract,
/// we decided to keep it in the StargateNFT contract to avoid extra complexity in the release of Hayabusa.
///
/// Pausability and Roles:
/// This contract is upgradable, pausable and has access control roles.
contract Stargate is
  AccessControlUpgradeable,
  ReentrancyGuardUpgradeable,
  UUPSUpgradeable,
  IStargate,
  PausableUpgradeable
{
  using Checkpoints for Checkpoints.Trace224;
  using SafeERC20 for IERC20;

  // ---------- Constants ------------ //

  /// @dev VTHO token address, which is a built-in token in the protocol
  IERC20 public constant VTHO_TOKEN = IERC20(0x0000000000000000000000000000456E65726779);

  /// @dev Validator status constants for better readability
  uint8 private constant VALIDATOR_STATUS_UNKNOWN = 0;
  uint8 private constant VALIDATOR_STATUS_QUEUED = 1;
  uint8 private constant VALIDATOR_STATUS_ACTIVE = 2;
  uint8 private constant VALIDATOR_STATUS_EXITED = 3;

  /// @dev Access control roles
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

  /// @dev Protocol probability multipliers or weights for the different node types
  uint8 public constant PROB_MULTIPLIER_NODE = 100;
  uint8 public constant PROB_MULTIPLIER_X_NODE = 150;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  // ---------- Storage ------------ //

  struct StargateStorage {
    // general mappings
    IProtocolStaker protocolStakerContract;
    IStargateNFT stargateNFTContract;
    // delegation mappings
    mapping(uint256 tokenId => uint256 delegationId) delegationIdByTokenId;
    // keep track of the last claimed period for each token
    mapping(uint256 tokenId => uint32 period) lastClaimedPeriod;
    // keep track of the total effective stake of the delegators for each validator checkpointed per period
    mapping(address validator => Checkpoints.Trace224 amount) delegatorsEffectiveStake;
    /// @dev Max number of claimable periods
    uint32 maxClaimablePeriods;
  }

  // keccak256(abi.encode(uint256(keccak256("storage.Stargate")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant StargateStorageLocation = 0xaf70fbb7e0f95b3e16b002fff11ff1ea2145b66dd31261eff20d74fda9749700;

  function _getStargateStorage() private pure returns (StargateStorage storage $) {
    assembly {
      $.slot := StargateStorageLocation
    }
  }

  function version() external pure returns (uint256) {
    return 1;
  }

  struct InitializeV1Params {
    address admin;
    address protocolStakerContract;
    address stargateNFTContract;
    uint32 maxClaimablePeriods;
  }

  /// @notice Initializes the contract
  function initialize(InitializeV1Params memory params) external initializer {
    if (
      params.protocolStakerContract == address(0) ||
      params.admin == address(0) ||
      params.stargateNFTContract == address(0) ||
      params.maxClaimablePeriods == 0
    ) {
      revert InvalidInitializationParams();
    }

    __UUPSUpgradeable_init();
    __AccessControl_init();
    __Pausable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, params.admin);

    StargateStorage storage $ = _getStargateStorage();
    $.protocolStakerContract = IProtocolStaker(params.protocolStakerContract);
    $.stargateNFTContract = IStargateNFT(params.stargateNFTContract);
    $.maxClaimablePeriods = params.maxClaimablePeriods;
  }

  // ---------- Modifiers ------------ //

  /// @notice Modifier to check if the caller is the owner of the token
  modifier onlyTokenOwner(uint256 _tokenId) {
    StargateStorage storage $ = _getStargateStorage();
    address owner = $.stargateNFTContract.ownerOf(_tokenId);
    if (owner != msg.sender) {
      revert UnauthorizedUser(msg.sender);
    }
    _;
  }

  // ---------- Authorizers ---------- //

  /// @notice Authorizes the upgrade of the contract
  /// @param newImplementation - the new implementation address
  function _authorizeUpgrade(address newImplementation) internal virtual override onlyRole(UPGRADER_ROLE) {}

  // ---------- Admin setters ---------- //

  /// @inheritdoc IStargate
  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
  }

  /// @inheritdoc IStargate
  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
  }

  // ---------- Staking ---------- //

  /// @inheritdoc IStargate
  function stake(uint8 _levelId) external payable whenNotPaused nonReentrant returns (uint256 tokenId) {
    StargateStorage storage $ = _getStargateStorage();
    DataTypes.Level memory level = $.stargateNFTContract.getLevel(_levelId);
    // validate msg.value
    if (msg.value != level.vetAmountRequiredToStake) {
      revert VetAmountMismatch(_levelId, level.vetAmountRequiredToStake, msg.value);
    }
    return $.stargateNFTContract.mint(_levelId, msg.sender);
  }

  /// @inheritdoc IStargate
  function unstake(uint256 _tokenId) external whenNotPaused onlyTokenOwner(_tokenId) nonReentrant {
    StargateStorage storage $ = _getStargateStorage();
    Delegation memory delegation = _getDelegationDetails($, _tokenId);
    DataTypes.Token memory token = $.stargateNFTContract.getToken(_tokenId);

    // check the delegation status
    // if the delegation is active, then NFT cannot be unstaked, since the VET is locked in the protocol
    if (delegation.status == DelegationStatus.ACTIVE) {
      revert InvalidDelegationStatus(_tokenId, DelegationStatus.ACTIVE);
    } else if (delegation.status != DelegationStatus.NONE) {
      // if the delegation is pending or exited
      // withdraw the VET from the protocol so we can transfer it back to the caller (which is also the owner of the NFT)
      $.protocolStakerContract.withdrawDelegation(delegation.delegationId);
      emit DelegationWithdrawn(
        _tokenId,
        delegation.validator,
        delegation.delegationId,
        delegation.stake,
        token.levelId
      );
    }

    if (delegation.status == DelegationStatus.PENDING) {
      // We emit an event to signal that the NFT exited the current pending delegation
      // to ensure that indexers can correctly track the delegation status
      emit DelegationExitRequested(_tokenId, delegation.validator, delegation.delegationId, Clock.clock());
    }

    // If the NFT has reached the max number of claimable periods, we revert to avoid any loss of rewards
    // In this case, the owner should separatly call the claimRewards() function multiple times to claim all rewards,
    // then call the unstake() function again.
    if (_exceedsMaxClaimablePeriods($, _tokenId)) {
      revert MaxClaimablePeriodsExceeded();
    }
    // ensure that the rewards are claimed
    _claimRewards($, _tokenId);

    // reset the mappings in storage regarding this delegation
    _resetDelegationDetails($, _tokenId);

    // burn the token
    $.stargateNFTContract.burn(_tokenId);

    // validate the contract has enough VET to transfer to the caller
    if (address(this).balance < token.vetAmountStaked) {
      revert InsufficientContractBalance(address(this).balance, token.vetAmountStaked);
    }

    // transfer the VET to the caller (which is also the owner of the NFT since only the owner can unstake)
    (bool success, ) = msg.sender.call{ value: token.vetAmountStaked }("");
    if (!success) {
      revert VetTransferFailed(msg.sender, token.vetAmountStaked);
    }
  }

  // ---------- Delegation ---------- //

  /// @inheritdoc IStargate
  function delegate(uint256 _tokenId, address _validator) external whenNotPaused onlyTokenOwner(_tokenId) nonReentrant {
    StargateStorage storage $ = _getStargateStorage();
    _delegate($, _tokenId, _validator);
  }

  /// @dev Internal function used to delegate a token to a validator
  /// @param _tokenId The ID of the token to delegate
  /// @param _validator The validator to delegate to
  /// @dev Emits a {IStargate.DelegationInitiated} event
  function _delegate(StargateStorage storage $, uint256 _tokenId, address _validator) private {
    // ensure token is not already delegated
    DelegationStatus status = _getDelegationStatus($, _tokenId);
    if (status == DelegationStatus.ACTIVE) {
      revert TokenAlreadyDelegated(_tokenId);
    }

    // ensure validator is in valid state
    (, , , , uint8 validatorStatus, ) = $.protocolStakerContract.getValidation(_validator);
    (, , uint32 validatorExitBlock, ) = $.protocolStakerContract.getValidationPeriodDetails(_validator);
    if (
      (validatorStatus != VALIDATOR_STATUS_ACTIVE && validatorStatus != VALIDATOR_STATUS_QUEUED) ||
      // if the validator has requested to exit, we cannot delegate to it
      validatorExitBlock != type(uint32).max
    ) {
      revert ValidatorNotActiveOrQueued(_validator);
    }

    // Tokens under matutiry period cannot be delegated
    if ($.stargateNFTContract.isUnderMaturityPeriod(_tokenId)) {
      revert TokenUnderMaturityPeriod(_tokenId);
    }

    // get the token details
    DataTypes.Token memory token = $.stargateNFTContract.getToken(_tokenId);
    if (token.levelId == 0) {
      revert InvalidToken(_tokenId);
    }

    uint256 currentDelegationId = $.delegationIdByTokenId[_tokenId];

    // If the token was previously exited or pending it means that the VET is still held in the protocol,
    // so we need to withdraw it and deposit again for the new delegation
    if (status == DelegationStatus.EXITED || status == DelegationStatus.PENDING) {
      (address currentValidator, , , ) = $.protocolStakerContract.getDelegation(currentDelegationId);

      $.protocolStakerContract.withdrawDelegation(currentDelegationId);

      emit DelegationWithdrawn(_tokenId, currentValidator, currentDelegationId, token.vetAmountStaked, token.levelId);

      if (status == DelegationStatus.PENDING) {
        // If the current delegation is pending, it means that the owner is changing the validator,
        // without requesting to exit first (which is allowed since the exit is not active yet)
        // so we emit an event to signal this action to the indexers
        emit DelegationExitRequested(_tokenId, currentValidator, currentDelegationId, Clock.clock());
      }
    }

    // if the token was previously delegated, check if the rewards for the previous delegation have been claimed
    if (currentDelegationId != 0) {
      if (_exceedsMaxClaimablePeriods($, _tokenId)) {
        // If the NFT has reached the max number of claimable periods, we revert to avoid any loss of rewards
        // In this case, the owner should separatly call the claimRewards() function multiple times to claim all rewards,
        // then call the delegate() function again.
        revert MaxClaimablePeriodsExceeded();
      }
      // claim pending rewards
      _claimRewards($, _tokenId);
    }

    // call the protocol to broadcast the delegation to the staking contract AND transfer the VET
    uint8 multiplier = $.stargateNFTContract.isXToken(_tokenId) ? PROB_MULTIPLIER_X_NODE : PROB_MULTIPLIER_NODE;
    uint256 delegationId = $.protocolStakerContract.addDelegation{ value: token.vetAmountStaked }(
      _validator,
      multiplier
    );

    // Get the latest completed period of the validator
    (, , , uint32 completedPeriods) = $.protocolStakerContract.getValidationPeriodDetails(_validator);

    // update the mappings regarding the delegation
    $.delegationIdByTokenId[_tokenId] = delegationId;
    // update the last claimed period to the current period of the validator
    // (aka: claimable periods will be from the next period)
    $.lastClaimedPeriod[_tokenId] = completedPeriods + 1; // current period

    // Increase the delegators effective stake in the next period
    _updatePeriodEffectiveStake($, _validator, _tokenId, completedPeriods + 2, true);

    emit DelegationInitiated(_tokenId, _validator, delegationId, token.vetAmountStaked, token.levelId, multiplier);
  }

  /// @inheritdoc IStargate
  function stakeAndDelegate(
    uint8 _levelId,
    address _validator
  ) external payable whenNotPaused nonReentrant returns (uint256 tokenId) {
    StargateStorage storage $ = _getStargateStorage();

    DataTypes.Level memory level = $.stargateNFTContract.getLevel(_levelId);
    // validate msg.value
    if (msg.value != level.vetAmountRequiredToStake) {
      revert VetAmountMismatch(_levelId, level.vetAmountRequiredToStake, msg.value);
    }

    // stake the VET and mint the NFT
    tokenId = $.stargateNFTContract.mint(_levelId, msg.sender);

    // skip the token maturity period
    $.stargateNFTContract.boostOnBehalfOf(msg.sender, tokenId);

    // delegate the token to the validator
    _delegate($, tokenId, _validator);
  }

  // Mock function to allow us testing the migration without the need to delegate to the protocol staker contract
  /// @param _tokenId The ID of the token to migrate
  /// @dev Emits a {IStargateNFT.TokenMigrated} event
  function migrate(uint256 _tokenId) external payable whenNotPaused nonReentrant {
    StargateStorage storage $ = _getStargateStorage();

    // get the level of the node from the legacy nodes contract
    (, uint8 level, , , , , ) = $.stargateNFTContract.legacyNodes().getMetadata(_tokenId);
    // get the vet amount required to stake for the level
    uint256 vetAmountRequiredToStake = $.stargateNFTContract.getLevel(level).vetAmountRequiredToStake;
    // validate the msg.value
    if (msg.value != vetAmountRequiredToStake) {
      revert VetAmountMismatch(level, vetAmountRequiredToStake, msg.value);
    }

    // migrate the token to the StargateNFT contract
    $.stargateNFTContract.migrate(_tokenId);
  }

  /// @inheritdoc IStargate
  function migrateAndDelegate(uint256 _tokenId, address _validator) external payable whenNotPaused nonReentrant {
    StargateStorage storage $ = _getStargateStorage();

    // get the level of the node from the legacy nodes contract
    (, uint8 level, , , , , ) = $.stargateNFTContract.legacyNodes().getMetadata(_tokenId);
    // get the vet amount required to stake for the level
    uint256 vetAmountRequiredToStake = $.stargateNFTContract.getLevel(level).vetAmountRequiredToStake;
    // validate the msg.value
    if (msg.value != vetAmountRequiredToStake) {
      revert VetAmountMismatch(level, vetAmountRequiredToStake, msg.value);
    }

    // migrate the token to the StargateNFT contract
    $.stargateNFTContract.migrate(_tokenId);

    // delegate the token to the validator
    _delegate($, _tokenId, _validator);
  }

  /// @inheritdoc IStargate
  function requestDelegationExit(uint256 _tokenId) external whenNotPaused onlyTokenOwner(_tokenId) nonReentrant {
    StargateStorage storage $ = _getStargateStorage();
    uint256 delegationId = $.delegationIdByTokenId[_tokenId];
    if (delegationId == 0) {
      revert DelegationNotFound(_tokenId);
    }

    Delegation memory delegation = _getDelegationDetails($, _tokenId);

    if (delegation.status == DelegationStatus.PENDING) {
      // if the delegation is pending, we can exit it immediately
      // by withdrawing the VET from the protocol
      $.protocolStakerContract.withdrawDelegation(delegationId);
      emit DelegationWithdrawn(
        _tokenId,
        delegation.validator,
        delegationId,
        delegation.stake,
        $.stargateNFTContract.getTokenLevel(_tokenId)
      );
      // and reset the mappings in storage regarding this delegation
      _resetDelegationDetails($, _tokenId);
    } else if (delegation.status == DelegationStatus.ACTIVE) {
      // If the delegation is active, we need to signal the exit to the protocol and wait for the end of the period

      // We do not allow the user to request an exit multiple times
      if (delegation.endPeriod != type(uint32).max) {
        revert DelegationExitAlreadyRequested();
      }

      $.protocolStakerContract.signalDelegationExit(delegationId);
    } else {
      revert InvalidDelegationStatus(_tokenId, delegation.status);
    }

    // decrease the effective stake
    // Get the latest completed period of the validator
    (, , , uint32 completedPeriods) = $.protocolStakerContract.getValidationPeriodDetails(delegation.validator);
    (, uint32 exitBlock) = $.protocolStakerContract.getDelegationPeriodDetails(delegationId);

    // decrease the effective stake
    _updatePeriodEffectiveStake($, delegation.validator, _tokenId, completedPeriods + 2, false);

    emit DelegationExitRequested(_tokenId, delegation.validator, delegationId, exitBlock);
  }

  /// @inheritdoc IStargate
  function getDelegationDetails(uint256 _tokenId) external view returns (Delegation memory) {
    return _getDelegationDetails(_getStargateStorage(), _tokenId);
  }

  /// @notice Private function to return the details of a delegation id
  /// @param _tokenId - the token ID
  /// @return The details of the delegation
  function _getDelegationDetails(StargateStorage storage $, uint256 _tokenId) private view returns (Delegation memory) {
    uint256 delegationId = $.delegationIdByTokenId[_tokenId];

    if (delegationId == 0) {
      return Delegation(0, address(0), 0, 0, 0, 0, false, DelegationStatus.NONE);
    }

    (address validator, uint256 delegatedStake, uint8 probabilityMultiplier, bool isLocked) = $
      .protocolStakerContract
      .getDelegation(delegationId);
    (uint32 startPeriod, uint32 endPeriod) = $.protocolStakerContract.getDelegationPeriodDetails(delegationId);

    DelegationStatus status = _getDelegationStatus($, _tokenId);

    return
      Delegation(
        delegationId,
        validator,
        delegatedStake,
        probabilityMultiplier,
        startPeriod,
        endPeriod,
        isLocked,
        status
      );
  }

  /// @inheritdoc IStargate
  function getDelegationStatus(uint256 _tokenId) external view returns (DelegationStatus) {
    return _getDelegationStatus(_getStargateStorage(), _tokenId);
  }

  /// @notice Private function to return the status of a specific delegation id
  /// @param _tokenId - the token ID
  /// @return The status of the delegation
  function _getDelegationStatus(StargateStorage storage $, uint256 _tokenId) private view returns (DelegationStatus) {
    uint256 delegationId = $.delegationIdByTokenId[_tokenId];
    if (delegationId == 0) {
      return DelegationStatus.NONE;
    }

    (address validator, uint256 delegationStake, , ) = $.protocolStakerContract.getDelegation(delegationId);

    // If the delegationId is not valid, the delegation is not active
    if (validator == address(0)) {
      return DelegationStatus.NONE;
    }

    (, , , , uint8 validatorStatus, ) = $.protocolStakerContract.getValidation(validator);
    (uint32 delegationStartPeriod, uint32 delegationEndPeriod) = $.protocolStakerContract.getDelegationPeriodDetails(
      delegationId
    );
    (, , , uint32 validatorCompletedPeriods) = $.protocolStakerContract.getValidationPeriodDetails(validator);

    uint32 currentValidatorPeriod = validatorCompletedPeriods + 1;
    bool userRequestedExit = delegationEndPeriod != type(uint32).max;
    bool delegationStarted = delegationStartPeriod <= currentValidatorPeriod;
    bool delegationEnded = userRequestedExit && delegationEndPeriod < currentValidatorPeriod;

    // Handle exited states first
    if (validatorStatus == VALIDATOR_STATUS_UNKNOWN || validatorStatus == VALIDATOR_STATUS_EXITED) {
      return DelegationStatus.EXITED;
    }

    if (delegationEnded) {
      return DelegationStatus.EXITED;
    }

    // If the user created a delegation (start period is not infinite)
    // and exited without signalling exit but by withdrawing the staked VET (while it was still in pending state)
    // we mark it as exited
    if (
      delegationStartPeriod != type(uint32).max && delegationEndPeriod == type(uint32).max && delegationStake == 0 // stake is 0 because the user withdrew the staked VET
    ) {
      return DelegationStatus.EXITED;
    }

    // Handle pending states
    if (validatorStatus == VALIDATOR_STATUS_QUEUED) {
      return DelegationStatus.PENDING;
    }

    if (validatorStatus == VALIDATOR_STATUS_ACTIVE && !delegationStarted) {
      return DelegationStatus.PENDING;
    }

    // Default to active if none of the above conditions are met
    return DelegationStatus.ACTIVE;
  }

  /// @inheritdoc IStargate
  function getDelegationIdOfToken(uint256 _tokenId) external view returns (uint256) {
    StargateStorage storage $ = _getStargateStorage();
    return $.delegationIdByTokenId[_tokenId];
  }

  /// @inheritdoc IStargate
  function hasRequestedExit(uint256 _tokenId) external view returns (bool) {
    StargateStorage storage $ = _getStargateStorage();
    return $.delegationIdByTokenId[_tokenId] != 0 && _getDelegationDetails($, _tokenId).endPeriod != type(uint32).max;
  }

  /// @inheritdoc IStargate
  function getDelegatorsEffectiveStake(address _validator, uint32 _period) external view returns (uint256) {
    StargateStorage storage $ = _getStargateStorage();
    return $.delegatorsEffectiveStake[_validator].upperLookup(_period);
  }

  /// @inheritdoc IStargate
  function getEffectiveStake(uint256 _tokenId) external view returns (uint256) {
    return _calculateEffectiveStake(_getStargateStorage(), _tokenId);
  }

  // ---------- Rewards  ---------- //

  /// @inheritdoc IStargate
  function claimRewards(uint256 _tokenId) external whenNotPaused nonReentrant {
    StargateStorage storage $ = _getStargateStorage();
    _claimRewards($, _tokenId);
  }

  /// @notice Internal function to claim the rewards for a token
  /// @param _tokenId - the token ID
  function _claimRewards(StargateStorage storage $, uint256 _tokenId) private {
    (uint32 firstClaimablePeriod, uint32 lastClaimablePeriod) = _claimableDelegationPeriods($, _tokenId);
    if (_exceedsMaxClaimablePeriods($, _tokenId)) {
      // We have set the max claimable periods to 832
      // since we want to add 831 more periods to the first claimable period
      // we need set the last claimable period to the first claimable period + 831
      // if we just add 832, we will exceed the last claimable period by 1 so
      // we need to subtract 1 from the last claimable period
      //
      // Example: if max claimable periods is set to 4
      // and the first claimable period is 1
      // we need to set the last claimable period to 1 + 4 - 1 = 4
      // so we are able to claim periods 1, 2, 3 and 4
      lastClaimablePeriod = firstClaimablePeriod + $.maxClaimablePeriods - 1;
    }

    uint256 claimableAmount = _claimableRewards($, _tokenId, 0);
    if (claimableAmount == 0) {
      return;
    }

    address tokenOwner = $.stargateNFTContract.ownerOf(_tokenId);

    $.lastClaimedPeriod[_tokenId] = lastClaimablePeriod;

    VTHO_TOKEN.safeTransfer(tokenOwner, claimableAmount);

    emit DelegationRewardsClaimed(
      tokenOwner,
      _tokenId,
      $.delegationIdByTokenId[_tokenId],
      claimableAmount,
      firstClaimablePeriod,
      lastClaimablePeriod
    );
  }

  /// @inheritdoc IStargate
  function claimableRewards(uint256 _tokenId) external view returns (uint256) {
    return _claimableRewards(_getStargateStorage(), _tokenId, 0);
  }

  /// @inheritdoc IStargate
  function claimableRewards(uint256 _tokenId, uint32 _batch) external view returns (uint256) {
    return _claimableRewards(_getStargateStorage(), _tokenId, _batch);
  }

  /// @notice Returns the claimable rewards for a token, which is the sum of the claimable rewards for each period
  /// between the last claimed period and the last claimable period.
  /// @param _tokenId - the token ID
  /// @return The claimable rewards for the token
  function _claimableRewards(
    StargateStorage storage $,
    uint256 _tokenId,
    uint32 _batch
  ) private view returns (uint256) {
    (uint32 firstClaimablePeriod, uint32 lastClaimablePeriod) = _claimableDelegationPeriods($, _tokenId);

    // Calculate batch range
    uint32 batchStart = firstClaimablePeriod + (_batch * $.maxClaimablePeriods);
    // subtract 1 from the batchEnd to avoid exceeding the last claimable period by 1
    uint32 batchEnd = batchStart + $.maxClaimablePeriods - 1;

    // Clamp batchEnd to not exceed lastClaimablePeriod
    if (batchEnd > lastClaimablePeriod) {
      batchEnd = lastClaimablePeriod;
    }

    // If batchStart is beyond the claimable range, nothing to claim
    if (batchStart > lastClaimablePeriod) {
      return 0;
    }

    uint256 claimableAmount;
    for (uint32 period = batchStart; period <= batchEnd; period++) {
      claimableAmount += _claimableRewardsForPeriod($, _tokenId, period);
    }

    return claimableAmount;
  }

  /// @notice Private function to return the claimable rewards for a token in a specific period
  /// @param _tokenId - the token ID
  /// @param _period - the period to check
  /// @return The claimable rewards for the token in the period
  function _claimableRewardsForPeriod(
    StargateStorage storage $,
    uint256 _tokenId,
    uint32 _period
  ) private view returns (uint256) {
    uint256 delegationId = $.delegationIdByTokenId[_tokenId];
    (address validator, , , ) = $.protocolStakerContract.getDelegation(delegationId);

    uint256 delegationPeriodRewards = $.protocolStakerContract.getDelegatorsRewards(validator, _period);

    // get the effective stake of the token
    uint256 effectiveStake = _calculateEffectiveStake($, _tokenId);
    // get the effective stake of the delegator in the period
    uint256 delegatorsEffectiveStake = $.delegatorsEffectiveStake[validator].upperLookup(_period);
    // avoid division by zero
    if (delegatorsEffectiveStake == 0) {
      return 0;
    }

    // return the claimable amount
    return (effectiveStake * delegationPeriodRewards) / delegatorsEffectiveStake;
  }

  /// @inheritdoc IStargate
  function lockedRewards(uint256 _tokenId) external view returns (uint256) {
    StargateStorage storage $ = _getStargateStorage();

    DelegationStatus status = _getDelegationStatus($, _tokenId);
    if (status != DelegationStatus.ACTIVE) {
      return 0;
    }
    (, uint32 lastClaimablePeriod) = _claimableDelegationPeriods($, _tokenId);

    return _claimableRewardsForPeriod($, _tokenId, lastClaimablePeriod + 1);
  }

  /// @inheritdoc IStargate
  function claimableDelegationPeriods(uint256 _tokenId) external view returns (uint32, uint32) {
    return _claimableDelegationPeriods(_getStargateStorage(), _tokenId);
  }

  /// @notice Private function to return the first and last claimable period of a token
  /// @param _tokenId - the token ID
  /// @return lastClaimedPeriod - the latest claimed period
  /// @return endPeriod - the end period of the latest delegation
  function _claimableDelegationPeriods(
    StargateStorage storage $,
    uint256 _tokenId
  ) private view returns (uint32, uint32) {
    // get the delegation
    uint256 delegationId = $.delegationIdByTokenId[_tokenId];
    // if the token does not have a delegation, return 0
    if (delegationId == 0) {
      return (0, 0);
    }
    (address validator, , , ) = $.protocolStakerContract.getDelegation(delegationId);
    if (validator == address(0)) {
      return (0, 0);
    }

    (uint32 startPeriod, uint32 endPeriod) = $.protocolStakerContract.getDelegationPeriodDetails(delegationId);
    (, , , uint32 completedPeriods) = $.protocolStakerContract.getValidationPeriodDetails(validator);

    // current validator period is the next period because
    // the current period is the one that is not completed yet
    uint32 currentValidatorPeriod = completedPeriods + 1;

    // next claimable period is the last claimed period + 1
    uint32 nextClaimablePeriod = $.lastClaimedPeriod[_tokenId] + 1;
    // if the next claimable period is before the start period, set it to the start period
    if (nextClaimablePeriod < startPeriod) {
      nextClaimablePeriod = startPeriod;
    }

    // check first for delegations that ended
    // endPeriod is not max if the delegation is exited or requested to exit
    // if the endPeriod is before the current validator period, it means the delegation ended
    // because if its equal it means they requested to exit but the current period is not over yet
    if (endPeriod != type(uint32).max && endPeriod < currentValidatorPeriod && endPeriod > nextClaimablePeriod) {
      return (nextClaimablePeriod, endPeriod);
    }

    // check that the start period is before the current validator period
    // and if it is, return the start period and the current validator period.
    // we use "less than" because if we use "less than or equal", even
    // if the delegation started, the current period rewards are not claimable
    if (nextClaimablePeriod < currentValidatorPeriod) {
      return (nextClaimablePeriod, completedPeriods);
    }

    // the rest are either pending, non existing or are active but have no claimable periods
    return (0, 0);
  }

  /// --------- Max Claimable Periods ---------- //

  /// @inheritdoc IStargate
  function getMaxClaimablePeriods() external view returns (uint32) {
    return _getStargateStorage().maxClaimablePeriods;
  }

  /// @inheritdoc IStargate
  function setMaxClaimablePeriods(uint32 _maxClaimablePeriods) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (_maxClaimablePeriods == 0) {
      revert InvalidMaxClaimablePeriods();
    }
    _getStargateStorage().maxClaimablePeriods = _maxClaimablePeriods;
  }

  /// @notice Returns true if the token exceeds the max claimable periods
  /// @param _tokenId - the token ID
  /// @return true if the token exceeds the max claimable periods
  function _exceedsMaxClaimablePeriods(StargateStorage storage $, uint256 _tokenId) private view returns (bool) {
    (uint32 firstClaimablePeriod, uint32 lastClaimablePeriod) = _claimableDelegationPeriods($, _tokenId);
    if (firstClaimablePeriod > lastClaimablePeriod) {
      return false;
    }

    if (lastClaimablePeriod - firstClaimablePeriod >= $.maxClaimablePeriods) {
      return true;
    }

    return false;
  }

  // ---------- Internal Helpers ---------- //

  /// @notice Resets the token's mappings regarding its delegation
  /// @param _tokenId - the token ID to reset the delegation details for
  function _resetDelegationDetails(StargateStorage storage $, uint256 _tokenId) private {
    delete $.delegationIdByTokenId[_tokenId];
    delete $.lastClaimedPeriod[_tokenId];
  }

  /// @notice Increases or decreases the delegators effective stake in the next period
  /// @dev The effective stake is the amount of VET that is staked by the token multiplied by the reward factor of the level,
  /// and is used to calculate the share of rewards of the delegator in the period by comparing the user's effective stake to the
  /// total effective stake of the validator.
  /// @dev This function uses Checkpoints to store the effective stake in a future period.
  /// @param _validator - the validator to increase the effective stake for
  /// @param _tokenId - the token ID to increase the effective stake for
  /// @param _period - the period to update the effective stake for
  /// @param _isIncrease - true if the effective stake should be increased, false if it should be decreased
  function _updatePeriodEffectiveStake(
    StargateStorage storage $,
    address _validator,
    uint256 _tokenId,
    uint32 _period,
    bool _isIncrease
  ) private {
    // calculate the effective stake
    uint256 effectiveStake = _calculateEffectiveStake($, _tokenId);

    // get the current effective stake
    uint256 currentValue = $.delegatorsEffectiveStake[_validator].upperLookup(_period);

    // calculate the updated effective stake
    uint256 updatedValue = _isIncrease ? currentValue + effectiveStake : currentValue - effectiveStake;

    // push the updated effective stake
    $.delegatorsEffectiveStake[_validator].push(_period, SafeCast.toUint224(updatedValue));
  }

  /// @notice Calculates the effective stake of a token which is the amount of VET that is staked by
  /// the token multiplied by the reward factor of the level.
  /// The effective stake is used to calculate the share of the delegator in the period.
  /// @param _tokenId - the token ID to calculate the effective stake for
  /// @return The effective stake of the token
  function _calculateEffectiveStake(StargateStorage storage $, uint256 _tokenId) private view returns (uint256) {
    DataTypes.Token memory token = $.stargateNFTContract.getToken(_tokenId);
    DataTypes.Level memory level = $.stargateNFTContract.getLevel(token.levelId);

    return (token.vetAmountStaked * level.scaledRewardFactor) / 100;
  }

  // ---------- Clock ---------- //

  /// @inheritdoc IStargate
  function clock() external view returns (uint48) {
    return Clock.clock();
  }

  /// @inheritdoc IStargate
  function CLOCK_MODE() external pure returns (string memory) {
    return Clock.CLOCK_MODE();
  }

  // ---------- Stargate NFT ---------- //

  /// @notice Returns the address of the StargateNFT contract
  /// @return stargateNFT - the StargateNFT contract
  function stargateNFT() external view returns (address) {
    StargateStorage storage $ = _getStargateStorage();
    return address($.stargateNFTContract);
  }

  // ---------- Fallback ---------- //

  // Called when the contract receives VET
  // Only the StargateNFT contract or the protocol staking contract should be able to transfer VET to this contract
  receive() external payable {
    StargateStorage storage $ = _getStargateStorage();
    if (msg.sender != address($.stargateNFTContract) && msg.sender != address($.protocolStakerContract)) {
      revert OnlyStargateNFTAndProtocolStaker();
    }
  }
}
