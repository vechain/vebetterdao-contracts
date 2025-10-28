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

/**
 * @title IGrantsManagerV1
 * @notice Interface for the GrantsManager contract that manages grant execution and milestone creation
 * @dev This contract handles the execution of approved grant proposals and manages milestone-based funding
 */
interface IGrantsManagerV1 {
  // ------------------ Events ------------------ //

  /**
   * @notice Emitted when a milestone is validated ( ready to be claimed by the receiver )
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   */
  event MilestoneValidated(uint256 indexed proposalId, uint256 indexed milestoneIndex);

  /**
   * @notice Emitted when a milestone is claimed
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   * @param amount The amount of the milestone
   */
  event MilestoneClaimed(uint256 indexed proposalId, uint256 indexed milestoneIndex, uint256 amount);

  /**
   * @notice Emitted when a milestone is rejected
   * @param proposalId The ID of the proposal
   * @param amount The amount of the milestone
   */
  event MilestoneRejectedAndFundsReturnedToTreasury(uint256 indexed proposalId, uint256 amount);

  /**
   * @notice Emitted when a milestone metadata URI is updated
   * @param proposalId The ID of the proposal
   * @param newMilestoneMetadataURI The new metadata URI
   */
  event MilestoneMetadataURIUpdated(uint256 indexed proposalId, string newMilestoneMetadataURI);

  /**
   * @notice Emitted when the grants receiver address is updated
   * @param proposalId The ID of the proposal
   * @param newGrantsReceiver The new grants receiver address
   */
  event GrantsReceiverUpdated(uint256 indexed proposalId, address newGrantsReceiver);

  /**
   * @notice Emitted when milestones are created for a proposal
   * @param proposalId The ID of the proposal
   * @param proposer The address of the proposer
   * @param grantsReceiver The address of the grants receiver
   * @param totalAmount The total amount of all milestones
   * @param metadataURI The IPFS hash containing milestone details
   */
  event MilestonesCreated(
    uint256 indexed proposalId,
    address indexed proposer,
    address indexed grantsReceiver,
    uint256 totalAmount,
    string metadataURI
  );

  /**
   * @notice Emitted when a grant is canceled
   * @param proposalId The ID of the proposal
   */
  event GrantCanceled(uint256 indexed proposalId);

  // ------------------ Errors ------------------ //

  /**
   * @notice Error thrown when a target is invalid
   * @param target The invalid target
   */
  error InvalidTarget(address target);

  /**
   * @notice Error thrown when a milestone amount is invalid
   */
  error InvalidAmount();

  /**
   * @notice Error thrown when a function selector is invalid
   * @param selector The invalid selector
   */
  error InvalidFunctionSelector(bytes4 selector);

  /**
   * @notice Error thrown when a milestone is already validated
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   */
  error MilestoneAlreadyApproved(uint256 proposalId, uint256 milestoneIndex);

  /**
   * @notice Error thrown when milestone amount is zero
   * @param milestoneIndex The index of the milestone with zero amount
   */
  error MilestoneAmountZero(uint256 milestoneIndex);

  /**
   * @notice Error thrown when milestone total amount is zero
   */
  error MilestoneTotalAmountZero();

  /**
   * @notice Error thrown when milestone claimed amount exceeds total amount
   * @param claimedAmount The amount claimed
   * @param totalAmount The total amount available
   */
  error MilestoneClaimedAmountExceedsTotalAmount(uint256 claimedAmount, uint256 totalAmount);

  /**
   * @notice Error thrown when number of milestones is less than minimum required
   * @param provided The number of milestones provided
   * @param required The minimum number of milestones required
   */
  error InvalidNumberOfMilestones(uint256 provided, uint256 required);

  /**
   * @notice Error thrown when milestone state is not pending
   * @param status The current status of the milestone
   */
  error MilestoneStateNotPending(MilestoneState status);

  /**
   * @notice Error thrown when previous milestone is not validated
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   */
  error PreviousMilestoneNotApproved(uint256 proposalId, uint256 milestoneIndex);

  /**
   * @notice Error thrown when milestone is already claimed
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   */
  error MilestoneAlreadyClaimed(uint256 proposalId, uint256 milestoneIndex);

  /**
   * @notice Error thrown when caller is not an admin or grants manager
   */
  error NotAuthorized();

  /**
   * @notice Error thrown when milestone is not validated
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   */
  error MilestoneNotApprovedByAdmin(uint256 proposalId, uint256 milestoneIndex);

  /**
   * @notice Error thrown when milestone index is invalid
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   */
  error InvalidMilestoneIndex(uint256 proposalId, uint256 milestoneIndex);

  /**
   * @notice Error thrown when milestone proposer is zero address
   */
  error MilestoneProposerZeroAddress();

  /**
   * @notice Error thrown when caller is not the grant receiver
   * @param caller The address of the caller
   * @param recipient The address of the recipient
   */
  error CallerIsNotTheGrantReceiver(address caller, address recipient);

  /**
   * @notice Error thrown when transfer fails
   */
  error TransferFailed();

  /**
   * @notice Error thrown when funds are insufficient
   * @param availableFunds The available funds
   * @param requiredFunds The required funds
   */
  error InsufficientFunds(uint256 availableFunds, uint256 requiredFunds);

  /**
   * @notice Error thrown when milestone details metadata URI is empty
   */
  error MilestoneDetailsMetadataURIEmpty();

  /**
   * @notice Error thrown when proposal is not executed
   * @param proposalId The ID of the proposal
   */
  error ProposalNotExecuted(uint256 proposalId);

  /**
   * @notice Error thrown when grant is already completed
   * @param proposalId The ID of the proposal
   */
  error GrantAlreadyCompleted(uint256 proposalId);

  /**
   * @notice Error thrown when grant is already rejected
   * @param proposalId The ID of the proposal
   */
  error GrantAlreadyRejected(uint256 proposalId);

  // ------------------ Structs and Enums ------------------ //

  /**
   * @notice GrantState enum to store the status of the grant
   * @dev This is the same as the ProposalState enum however with InDevelopment and Completed extra states
   */
  enum GrantState {
    Pending, // 0
    Active, // 1
    Canceled, // 2
    Defeated, // 3
    Succeeded, // 4
    Queued, // 5
    Executed, // 6
    DepositNotMet, // 7
    InDevelopment, // 8
    Completed // 9
  }

  /**
   * @notice MilestoneState enum to store the status of the milestone
   */
  enum MilestoneState {
    Pending, // 0 - default
    Approved, // 1 - approved by admin and claimable
    Claimed, // 2 - funds claimed by recipient
    Rejected // 3 - admin rejects
  }

  /**
   * @notice Milestone struct
   */
  struct Milestone {
    uint256 amount;
    bool isClaimed;
    bool isApproved;
    bool isRejected;
    string reason;
  }

  /**
   * @notice GrantProposal struct
   */
  struct GrantProposal {
    uint256 id;
    uint256 totalAmount;
    uint256 claimedAmount;
    address proposer;
    address grantsReceiver;
    Milestone[] milestones;
    string metadataURI;
  }

  // ------------------ Grants Manager Milestone Functions ------------------ //

  /**
   * @notice Creates milestones for a proposal
   * @param metadataURI The IPFS hash containing the milestones metadata
   * @param proposalId The ID of the proposal
   * @param proposer The address of the proposer
   * @param grantsReceiver The address of the grants receiver
   * @param calldatas The calldatas of the milestones
   */
  function createMilestones(
    string memory metadataURI,
    uint256 proposalId,
    address proposer,
    address grantsReceiver,
    bytes[] memory calldatas
  ) external;

  /**
   * @notice Returns a milestone for a proposal
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   * @return Milestone The milestone
   */
  function getMilestone(uint256 proposalId, uint256 milestoneIndex) external view returns (Milestone memory);

  /**
   * @notice Returns the milestones for a proposal
   * @param proposalId The ID of the proposal
   * @return GrantProposal struct created on proposeGrant
   */
  function getGrantProposal(uint256 proposalId) external view returns (GrantProposal memory);

  /**
   * @notice Returns the milestones for a proposal
   * @param proposalId The ID of the proposal
   * @return Milestone[] The milestones for the grant proposal
   */
  function getMilestones(uint256 proposalId) external view returns (Milestone[] memory);

  /**
   * @notice Approves a milestone
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   */
  function approveMilestones(uint256 proposalId, uint256 milestoneIndex) external;

  /**
   * @notice Approves a milestone with a reason
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   * @param reason The reason for approving the milestone
   * @notice This is used to approve a mi
   */
  function approveMilestoneWithReason(uint256 proposalId, uint256 milestoneIndex, string memory reason) external;
  /**
   * @notice Sets the minimum milestone count
   * @param minimumMilestoneCount The minimum milestone count
   */
  function setMinimumMilestoneCount(uint256 minimumMilestoneCount) external;

  /**
   * @notice Returns the minimum milestone count
   * @return The minimum milestone count
   */
  function getMinimumMilestoneCount() external view returns (uint256);

  /**
   * @notice Returns the state of a milestone
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   * @return MilestoneState The state of the milestone
   */
  function milestoneState(uint256 proposalId, uint256 milestoneIndex) external view returns (MilestoneState);

  /**
   * @notice Returns the state of a proposal
   * @param proposalId The ID of the proposal
   * @return GrantState The state of the proposal
   */
  function grantState(uint256 proposalId) external view returns (GrantState);

  /**
   * @notice Returns if a proposal is in development
   * @param proposalId The ID of the proposal
   * @return bool True if the proposal is in development, false otherwise
   */
  function isGrantCompleted(uint256 proposalId) external view returns (bool);

  /**
   * @notice Returns if a proposal is in development
   * @param proposalId The ID of the proposal
   * @return bool True if the proposal is in development, false otherwise
   */
  function isGrantInDevelopment(uint256 proposalId) external view returns (bool);

  /**
   * @notice Returns if a proposal is rejected
   * @param proposalId The ID of the proposal
   * @return bool True if one of the milestones is rejected, false otherwise
   */
  function isGrantRejected(uint256 proposalId) external view returns (bool);

  /**
   * @notice Rejects a milestone
   * @param proposalId The ID of the proposal
   */
  function rejectMilestones(uint256 proposalId) external;

  /**
   * @notice Returns the total amount for milestones
   * @param milestoneId The ID of the milestone
   * @return The total amount for the milestones
   */
  function getTotalAmountForMilestones(uint256 milestoneId) external view returns (uint256);

  // ------------------ Grants Manager Funds Functions ------------------ //
  /**
   * @notice Claims milestones
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   */
  function claimMilestone(uint256 proposalId, uint256 milestoneIndex) external;

  /**
   * @notice Returns if a milestone is claimable
   * @param proposalId The ID of the proposal
   * @param milestoneIndex The index of the milestone
   * @return bool True if the milestone is claimable, false otherwise
   */
  function isClaimable(uint256 proposalId, uint256 milestoneIndex) external view returns (bool);
  // ------------------ Grants Manager Contract Functions ------------------ //
  /**
   * @notice Sets the governor contract
   * @param _governor The address of the governor contract
   */
  function setGovernorContract(address _governor) external;

  /**
   * @notice Sets the treasury contract
   * @param _treasury The address of the treasury contract
   */
  function setTreasuryContract(address _treasury) external;

  /**
   * @notice Returns the governor contract
   * @return The address of the governor contract
   */
  function getGovernorContract() external view returns (address);

  /**
   * @notice Returns the treasury contract
   * @return The address of the treasury contract
   */
  function getTreasuryContract() external view returns (address);

  /**
   * @notice Returns the b3tr contract
   * @return The address of the b3tr contract
   */
  function getB3trContract() external view returns (address);

  /**
   * @notice Sets the b3tr contract
   * @param _b3tr The address of the b3tr contract
   */
  function setB3trContract(address _b3tr) external;

  /**
   * @notice Updates the grants receiver address
   * @param proposalId The ID of the proposal
   * @param newGrantsReceiver The new grants receiver address
   */
  function updateGrantsReceiver(uint256 proposalId, address newGrantsReceiver) external;

  /**
   * @notice Returns the grants receiver address
   * @param proposalId The ID of the proposal
   * @return The address of the grants receiver
   */
  function getGrantsReceiverAddress(uint256 proposalId) external view returns (address);

  // ------------------ Metadata Functions ------------------ //

  /**
   * @notice Updates the milestone description metadata URI for a proposal
   * @param proposalId The ID of the proposal
   * @param newMilestoneMetadataURI The milestone description metadata URI to set
   */
  function updateMilestoneMetadataURI(uint256 proposalId, string memory newMilestoneMetadataURI) external;

  /**
   * @notice Returns the milestone  metadata URI for a proposal
   * @param proposalId The ID of the proposal
   * @return The milestone  metadata URI for the proposal
   */
  function getMilestoneMetadataURI(uint256 proposalId) external view returns (string memory);
}
