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

import { IB3TRGovernor } from "./interfaces/IB3TRGovernor.sol";
import { ITreasury } from "./interfaces/ITreasury.sol";
import { IB3TR } from "./interfaces/IB3TR.sol";
import { IGrantsManager } from "./interfaces/IGrantsManager.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { GovernorStateLogic } from "./governance/libraries/GovernorStateLogic.sol";
import { GovernorProposalLogic } from "./governance/libraries/GovernorProposalLogic.sol";
import { GovernorTypes } from "./governance/libraries/GovernorTypes.sol";
/**
 * @title GrantsManager
 * @notice Contract that manages grant funds milestone validation and claiming
 */
contract GrantsManager is
  IGrantsManager,
  AccessControlUpgradeable,
  PausableUpgradeable,
  ReentrancyGuardUpgradeable,
  UUPSUpgradeable
{
  // ------------------ ROLES ------------------ //
  bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
  bytes32 public constant GRANTS_APPROVER_ROLE = keccak256("GRANTS_APPROVER_ROLE");
  bytes32 public constant GRANTS_REJECTOR_ROLE = keccak256("GRANTS_REJECTOR_ROLE");
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

  // ------------------ STORAGE MANAGEMENT ------------------ //
  /// @notice Storage structure for GrantsManager
  /// @custom:storage-location erc7201:b3tr.storage.GrantsManager
  struct GrantsManagerStorage {
    mapping(uint256 proposalId => GrantProposal grantProposal) grant;
    IB3TRGovernor governor;
    ITreasury treasury;
    IB3TR b3tr;
    uint256 minimumMilestoneCount;
  }

  // keccak256(abi.encode(uint256(keccak256("b3tr.storage.GrantsManager")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant GrantsManagerStorageLocation =
    0x827ef7a586340a0afd9df4d10dcd47e35ee20572dbc95830311fcb8284606d00;

  function _getGrantsManagerStorage() private pure returns (GrantsManagerStorage storage $) {
    assembly {
      $.slot := GrantsManagerStorageLocation
    }
  }

  // ------------------ INITIALIZATION ------------------ //
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address _governor,
    address _treasury,
    address defaultAdmin,
    address _b3tr,
    uint256 _minimumMilestoneCount
  ) external initializer {
    require(_governor != address(0), "Governor address cannot be 0");
    require(_treasury != address(0), "Treasury address cannot be 0");
    require(_b3tr != address(0), "B3TR address cannot be 0");
    require(defaultAdmin != address(0), "Default admin address cannot be 0");
    require(_minimumMilestoneCount > 0, "Minimum milestone count cannot be 0");

    __UUPSUpgradeable_init();
    __AccessControl_init();
    __Pausable_init();
    __ReentrancyGuard_init();

    _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    _grantRole(GOVERNANCE_ROLE, _governor);

    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    $.governor = IB3TRGovernor(_governor);
    $.treasury = ITreasury(_treasury);
    $.b3tr = IB3TR(_b3tr);
    $.minimumMilestoneCount = _minimumMilestoneCount;
  }

  // ------------------ MODIFIERS ------------------ //
  modifier onlyAdminOrGovernanceRole() {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    if (!(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(GOVERNANCE_ROLE, _msgSender()))) {
      revert NotAuthorized();
    }
    _;
  }

  modifier onlyRoleOrGovernance(bytes32 role) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    if (!(hasRole(role, _msgSender()) || hasRole(GOVERNANCE_ROLE, _msgSender()))) {
      revert NotAuthorized();
    }
    _;
  }

  modifier onlyGovernor() {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    if (!(hasRole(GOVERNANCE_ROLE, _msgSender()))) {
      revert NotAuthorized();
    }
    _;
  }
  modifier onlyGrantsReceiverOrGovernance(uint256 proposalId) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    if (!(hasRole(GOVERNANCE_ROLE, _msgSender()) || _msgSender() == $.grant[proposalId].grantsReceiver)) {
      revert NotAuthorized();
    }
    _;
  }

  // ------------------ Grants Manager Milestone Functions ------------------ //
  /**
   * @dev Internal function to create milestones for a proposal.
   * @param metadataURI The IPFS hash containing the milestones descriptions
   * @param proposalId The ID of the proposal
   * @param proposer The address of the proposer
   * @param calldatas The calldatas of the milestones
   */
  function createMilestones(
    string memory metadataURI,
    uint256 proposalId,
    address proposer,
    address grantsReceiver,
    bytes[] memory calldatas
  ) external onlyGovernor whenNotPaused {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();

    GrantProposal storage m = $.grant[proposalId];
    uint256 totalAmount = 0;

    for (uint256 i = 0; i < calldatas.length; i++) {
      bytes memory data = calldatas[i];

      // Extract selector for safety check
      bytes4 selector;
      assembly {
        selector := mload(add(data, 32))
      }
      if (selector != bytes4(keccak256("transferB3TR(address,uint256)"))) {
        revert InvalidFunctionSelector(selector);
      }
      bytes memory slicedData = new bytes(data.length - 4);
      for (uint256 j = 0; j < slicedData.length; j++) {
        slicedData[j] = data[j + 4];
      }

      // Decode arguments
      (address recipient, uint256 amount) = abi.decode(slicedData, (address, uint256));

      if (recipient != address(this)) {
        revert InvalidTarget(recipient);
      }
      if (amount == 0) {
        revert InvalidAmount();
      }

      totalAmount += amount;
      $.grant[proposalId].milestones.push(
        Milestone({ amount: amount, isClaimed: false, isApproved: false, isRejected: false, reason: "" })
      );
    }

    m.id = proposalId;
    m.proposer = proposer;
    m.metadataURI = metadataURI;
    m.totalAmount = totalAmount;
    m.claimedAmount = 0; // 0 because the milestone is not claimed yet
    m.grantsReceiver = grantsReceiver;

    _validateMilestones(m);
    emit MilestonesCreated(proposalId, proposer, grantsReceiver, totalAmount, metadataURI);
  }

  /**
   * @notice Returns a milestone for a proposal.
   * @param proposalId The id of the proposal
   * @param milestoneIndex The index of the milestone
   * @return Milestone The milestone
   */
  function getMilestone(uint256 proposalId, uint256 milestoneIndex) external view returns (Milestone memory) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();

    return $.grant[proposalId].milestones[milestoneIndex];
  }

  // ------------------ Milestone State Functions ------------------ //

  /**
   * @notice Returns if a proposal is rejected
   * @param proposalId The id of the proposal
   * @return bool True if the proposal is rejected, false otherwise
   * @dev A grant is rejected when at least one milestone is rejected
   */
  function isGrantRejected(uint256 proposalId) public view returns (bool) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    GrantProposal memory grant = $.grant[proposalId];
    for (uint256 i = 0; i < grant.milestones.length; i++) {
      if (grant.milestones[i].isRejected) {
        return true;
      }
    }
    return false;
  }

  /**
   * @notice Returns if a proposal is in development
   * @param proposalId The id of the proposal
   * @return bool True if the proposal is in development, false otherwise
   * @dev A grant is in development when:
   * 1. The proposal has been executed AND
   * 2. At least one milestone is still pending
   */
  function isGrantInDevelopment(uint256 proposalId) public view returns (bool) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    GrantProposal memory grant = $.grant[proposalId];
    GovernorTypes.ProposalState proposalState = $.governor.state(proposalId);

    // If proposal is not in a valid state, it's not in development
    if (proposalState != GovernorTypes.ProposalState.Executed) {
      return false;
    }

    for (uint256 i = 0; i < grant.milestones.length; i++) {
      MilestoneState _milestoneState = _getMilestoneState(proposalId, i);
      if (_milestoneState == MilestoneState.Pending) {
        return true;
      }
    }
    return false;
  }

  /**
   * @notice Returns if a proposal is completed
   * @param proposalId The id of the proposal
   * @return bool True if the proposal is completed, false otherwise
   * @dev Ascending order status of the milestones, so last one is the one that determines the status of the grant
   */
  function isGrantCompleted(uint256 proposalId) public view returns (bool) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    GrantProposal memory grant = $.grant[proposalId];
    GovernorTypes.ProposalState proposalState = $.governor.state(proposalId);

    // If proposal is not executed, it's not completed
    if (proposalState != GovernorTypes.ProposalState.Executed) {
      return false;
    }

    // If last milestone is pending or rejected, the grant is not completed
    MilestoneState lastState = _getMilestoneState(proposalId, grant.milestones.length - 1);
    if (lastState == MilestoneState.Pending || lastState == MilestoneState.Rejected) {
      return false;
    }

    return true;
  }

  /**
   * @notice Returns the state of a milestone
   * @param proposalId The id of the proposal
   * @param milestoneIndex The index of the milestone
   * @return status The state of the milestone {see IGrantsManager:MilestoneState }
   */
  function _getMilestoneState(
    uint256 proposalId,
    uint256 milestoneIndex
  ) internal view returns (MilestoneState status) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    GrantProposal memory grant = $.grant[proposalId];
    Milestone memory milestone = grant.milestones[milestoneIndex];

    if (milestone.isRejected) {
      return MilestoneState.Rejected;
    }

    if (milestone.isClaimed) {
      return MilestoneState.Claimed;
    }

    if (milestone.isApproved) {
      return MilestoneState.Approved;
    }

    return MilestoneState.Pending;
  }

  /**
   * @notice Returns the milestones for a proposal.
   * @param proposalId The id of the proposal
   * @return GrantProposal The milestones for the proposal
   */
  function getMilestones(uint256 proposalId) external view returns (Milestone[] memory) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    return $.grant[proposalId].milestones;
  }

  /**
   * @notice Returns the grant proposal for a proposal.
   * @param proposalId The id of the proposal
   * @return GrantProposal The grant proposal for the proposal
   */
  function getGrantProposal(uint256 proposalId) external view returns (GrantProposal memory) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    return $.grant[proposalId];
  }

  /**
   * @notice Approves a milestone
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   */
  function approveMilestones(
    uint256 proposalId,
    uint256 milestoneIndex
  ) external onlyRoleOrGovernance(GRANTS_APPROVER_ROLE) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();

    _checkProposalState(proposalId);
    _checkMilestoneState(proposalId, milestoneIndex);

    // The previous milestone should be approved or claimed
    if (milestoneIndex > 0) {
      MilestoneState previousState = _getMilestoneState(proposalId, milestoneIndex - 1);
      if (previousState != MilestoneState.Approved && previousState != MilestoneState.Claimed) {
        revert PreviousMilestoneNotApproved(proposalId, milestoneIndex - 1);
      }
    }

    $.grant[proposalId].milestones[milestoneIndex].isApproved = true;
    emit MilestoneValidated(proposalId, milestoneIndex);
  }

  /**
   * @notice Approves a milestone with a reason
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   * @param reason The reason for approving the milestone
   */
  function approveMilestoneWithReason(
    uint256 proposalId,
    uint256 milestoneIndex,
    string memory reason
  ) external onlyRoleOrGovernance(GRANTS_APPROVER_ROLE) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();

    _checkProposalState(proposalId);
    _checkMilestoneState(proposalId, milestoneIndex);

    // The previous milestone should be approved or claimed
    if (milestoneIndex > 0) {
      MilestoneState previousState = _getMilestoneState(proposalId, milestoneIndex - 1);
      if (previousState != MilestoneState.Approved && previousState != MilestoneState.Claimed) {
        revert PreviousMilestoneNotApproved(proposalId, milestoneIndex - 1);
      }
    }

    $.grant[proposalId].milestones[milestoneIndex].isApproved = true;
    $.grant[proposalId].milestones[milestoneIndex].reason = reason;
    emit MilestoneValidated(proposalId, milestoneIndex);
  }

  /**
   * @notice Sets the minimum number of milestones for a grant proposal
   * @param minimumMilestoneCount The minimum milestone count
   */
  function setMinimumMilestoneCount(uint256 minimumMilestoneCount) external onlyRole(DEFAULT_ADMIN_ROLE) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    $.minimumMilestoneCount = minimumMilestoneCount;
  }

  /**
   * @notice Returns the minimum milestone count for a proposal.
   * @return uint256 The minimum milestone count.
   */
  function getMinimumMilestoneCount() external view returns (uint256) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    return $.minimumMilestoneCount;
  }

  /**
   * @notice Returns the state of a milestone
   * @param proposalId The id of the proposal
   * @param milestoneIndex The index of the milestone
   * @return MilestoneState The state of the milestone
   */
  function milestoneState(uint256 proposalId, uint256 milestoneIndex) external view returns (MilestoneState) {
    return _getMilestoneState(proposalId, milestoneIndex);
  }

  /**
   * @notice Rejects a milestone
   * @param proposalId The ID of the proposal
   */
  function rejectMilestones(uint256 proposalId) external onlyRoleOrGovernance(GRANTS_REJECTOR_ROLE) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    Milestone[] memory milestones = $.grant[proposalId].milestones;

    if (isGrantCompleted(proposalId)) {
      revert GrantAlreadyCompleted(proposalId);
    }
    if (isGrantRejected(proposalId)) {
      revert GrantAlreadyRejected(proposalId);
    }

    // Reject all pending milestones
    for (uint256 i = 0; i < milestones.length; i++) {
      if (_getMilestoneState(proposalId, i) == MilestoneState.Pending) {
        // reject the milestone
        $.grant[proposalId].milestones[i].isRejected = true;
      }
    }

    // Transfer the remaining amount to the treasury
    _transferRemainingAmountToTreasury(proposalId);
    emit GrantCanceled(proposalId);
  }

  /**
   * @notice Returns the total amount for milestones
   * @param milestoneId The ID of the milestone
   * @return The total amount for the milestones
   */
  function getTotalAmountForMilestones(uint256 milestoneId) external view returns (uint256) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    return $.grant[milestoneId].totalAmount;
  }

  // ------------------ Grants Manager Funds Functions ------------------ //
  /**
   * @notice Claims funds for a validated milestone
   * @param proposalId The ID of the grant proposal
   * @param milestoneIndex The index of the milestone to claim
   */
  function claimMilestone(uint256 proposalId, uint256 milestoneIndex) external nonReentrant whenNotPaused {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();

    GrantProposal storage m = $.grant[proposalId];
    if (milestoneIndex >= m.milestones.length) {
      revert InvalidMilestoneIndex(proposalId, milestoneIndex);
    }

    address grantsReceiver = m.grantsReceiver;
    if (msg.sender != grantsReceiver) {
      revert CallerIsNotTheGrantReceiver(msg.sender, grantsReceiver);
    }

    // check that the milestone is validated or not already claimed
    Milestone memory milestone = m.milestones[milestoneIndex];
    // get the state of the milestone
    MilestoneState _milestoneState = _getMilestoneState(proposalId, milestoneIndex);
    if (_milestoneState != MilestoneState.Approved && _milestoneState != MilestoneState.Claimed) {
      revert MilestoneNotApprovedByAdmin(proposalId, milestoneIndex);
    }

    // check that the milestone is not already  if (GovernorStateLogic.state($.governor, proposalId) == GovernorTypes.ProposalState.Canceled) {
    if (_milestoneState == MilestoneState.Claimed) {
      revert MilestoneAlreadyClaimed(proposalId, milestoneIndex);
    }

    // Check if contract has enough B3TR balance
    if ($.b3tr.balanceOf(address(this)) < milestone.amount) {
      revert InsufficientFunds($.b3tr.balanceOf(address(this)), milestone.amount);
    }

    // Transfer B3TR tokens to grants receiver
    bool success = $.b3tr.transfer(grantsReceiver, milestone.amount);
    if (!success) {
      revert TransferFailed();
    }

    // Update the claimed amount of the proposal
    m.milestones[milestoneIndex].isClaimed = true;
    m.claimedAmount += milestone.amount;
    emit MilestoneClaimed(proposalId, milestoneIndex, milestone.amount);
  }

  /**
   * @notice Returns if a milestone is claimable
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   * @return bool True if the milestone is claimable, false otherwise
   */
  function isClaimable(uint256 proposalId, uint256 milestoneIndex) external view returns (bool) {
    return _getMilestoneState(proposalId, milestoneIndex) == MilestoneState.Approved;
  }

  /**
   * @notice Returns the state of a grant {see IGrantsManager:GrantState }
   * @param proposalId The id of the proposal
   * @return GrantState The state of the grant
   */
  function grantState(uint256 proposalId) external view returns (GrantState) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    GovernorTypes.ProposalState proposalState = $.governor.state(proposalId);

    if (isGrantRejected(proposalId)) {
      return GrantState.Canceled;
    }

    if (isGrantInDevelopment(proposalId)) {
      return GrantState.InDevelopment;
    }

    if (isGrantCompleted(proposalId)) {
      return GrantState.Completed;
    }

    return GrantState(uint256(proposalState));
  }

  // ------------------ Grants Manager Contract Functions ------------------ //
  /**
   * @notice Sets the governor contract
   * @param _governor The address of the governor contract
   */
  function setGovernorContract(address _governor) external onlyRole(DEFAULT_ADMIN_ROLE) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    $.governor = IB3TRGovernor(_governor);
  }

  /**
   * @notice Returns the governor contract
   * @return The address of the governor contract
   */
  function getGovernorContract() external view returns (address) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    return address($.governor);
  }

  /**
   * @notice Updates the grants receiver address
   * @param proposalId The ID of the proposal
   * @param newGrantsReceiver The address of the grants receiver contract
   * @dev Only the grants receiver or governance can update the grants receiver address
   */
  function updateGrantsReceiver(
    uint256 proposalId,
    address newGrantsReceiver
  ) external onlyGrantsReceiverOrGovernance(proposalId) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    $.grant[proposalId].grantsReceiver = newGrantsReceiver;
    emit GrantsReceiverUpdated(proposalId, newGrantsReceiver);
  }

  /**
   * @notice Returns the grants receiver address
   * @param proposalId The ID of the proposal
   * @return The address of the grants receiver
   */
  function getGrantsReceiverAddress(uint256 proposalId) external view returns (address) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    return $.grant[proposalId].grantsReceiver;
  }

  /**
   * @notice Sets the treasury contract
   * @param _treasury The address of the treasury contract
   */
  function setTreasuryContract(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    $.treasury = ITreasury(_treasury);
  }

  /**
   * @notice Returns the treasury contract
   * @return The address of the treasury contract
   */
  function getTreasuryContract() external view returns (address) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    return address($.treasury);
  }

  /**
   * @notice Returns the b3tr contract
   * @return The address of the b3tr contract
   */
  function getB3trContract() external view returns (address) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    return address($.b3tr);
  }

  /**
   * @notice Sets the b3tr contract
   * @param _b3tr The address of the b3tr contract
   */
  function setB3trContract(address _b3tr) external onlyRole(DEFAULT_ADMIN_ROLE) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    $.b3tr = IB3TR(_b3tr);
  }

  /**
   * @notice Pauses all token transfers and minting functions
   * @dev Only callable by accounts with the PAUSER_ROLE or the DEFAULT_ADMIN_ROLE
   */
  function pause() public onlyRoleOrGovernance(PAUSER_ROLE) {
    _pause();
  }

  /**
   * @notice Unpauses the contract to resume token transfers and minting
   * @dev Only callable by accounts with the PAUSER_ROLE or the DEFAULT_ADMIN_ROLE
   */
  function unpause() public onlyRoleOrGovernance(PAUSER_ROLE) {
    _unpause();
  }

  // ------------------ Metadata Functions ------------------ //

  /**
   * @notice Updates the metadata URI for a milestone
   * @param proposalId The ID of the proposal
   * @param newMilestoneMetadataURI The new IPFS hash containing the updated milestone descriptions
   * @notice The JSON is {milestone1: {details: ..., duration: timestamp}, milestone2: {details: ..., duration: timestamp}}
   */
  function updateMilestoneMetadataURI(uint256 proposalId, string memory newMilestoneMetadataURI) external {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    if (msg.sender != $.grant[proposalId].proposer) {
      revert NotAuthorized();
    }
    $.grant[proposalId].metadataURI = newMilestoneMetadataURI;

    emit MilestoneMetadataURIUpdated(proposalId, newMilestoneMetadataURI);
  }

  /**
   * @notice Returns the metadata URI for a milestone
   * @param proposalId The ID of the proposal
   * @return The metadata URI for the milestone
   */
  function getMilestoneMetadataURI(uint256 proposalId) external view returns (string memory) {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    return $.grant[proposalId].metadataURI;
  }

  /**
   * @notice Validates the milestones
   * @param grant The milestones to validate
   */
  function _validateMilestones(GrantProposal memory grant) internal view {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();

    if (msg.sender != address($.governor)) {
      revert NotAuthorized();
    }

    // Check the proposer
    if (grant.proposer == address(0)) {
      revert MilestoneProposerZeroAddress();
    }

    // Check the milestones details metadata URI
    if (bytes(grant.metadataURI).length == 0) {
      revert MilestoneDetailsMetadataURIEmpty();
    }

    // Check the milestones amounts
    for (uint256 i = 0; i < grant.milestones.length; i++) {
      if (grant.milestones[i].amount == 0) {
        revert MilestoneAmountZero(i);
      }
    }

    if (grant.totalAmount == 0) {
      revert MilestoneTotalAmountZero();
    }

    if (grant.claimedAmount > grant.totalAmount) {
      revert MilestoneClaimedAmountExceedsTotalAmount(grant.claimedAmount, grant.totalAmount);
    }

    // Check the minimum milestone count
    if (grant.milestones.length < $.minimumMilestoneCount) {
      revert InvalidNumberOfMilestones(grant.milestones.length, $.minimumMilestoneCount);
    }
  }

  /**
   * @notice Transfers the remaining amount to the treasury
   * @param proposalId The ID of the proposal
   */
  function _transferRemainingAmountToTreasury(uint256 proposalId) internal {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    uint256 remainingAmount = $.grant[proposalId].totalAmount - $.grant[proposalId].claimedAmount;
    if (remainingAmount > 0) {
      // Make sure we have the balance before trying to transfer
      uint256 currentBalance = $.b3tr.balanceOf(address(this));
      if (currentBalance < remainingAmount) {
        revert InsufficientFunds(currentBalance, remainingAmount);
      }

      $.b3tr.transfer(address($.treasury), remainingAmount);
    }
    emit MilestoneRejectedAndFundsReturnedToTreasury(proposalId, remainingAmount);
  }

  /**
   * @notice Checks if the proposal state is executed
   * @param proposalId The ID of the proposal
   */
  function _checkProposalState(uint256 proposalId) internal view {
    GrantsManagerStorage storage $ = _getGrantsManagerStorage();
    GovernorTypes.ProposalState proposalState = $.governor.state(proposalId);
    if (proposalState != GovernorTypes.ProposalState.Executed) {
      revert ProposalNotExecuted(proposalId);
    }
  }

  /**
   * @notice Checks if the milestone state is pending
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   */
  function _checkMilestoneState(uint256 proposalId, uint256 milestoneIndex) internal view {
    MilestoneState _milestoneState = _getMilestoneState(proposalId, milestoneIndex);
    if (_milestoneState != MilestoneState.Pending) {
      revert MilestoneStateNotPending(_milestoneState);
    }
  }

  /**
   * @notice Returns the version of the contract
   * @return The version of the contract
   */
  function version() external pure returns (uint256) {
    return 1;
  }

  // ------------------ Overrides ------------------ //
  /**
   * @notice Authorize upgrade for UUPS
   * @dev Only addresses with the UPGRADER_ROLE can upgrade the contract
   */
  function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
