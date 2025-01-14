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

import "./x-allocation-voting-governance/XAllocationVotingGovernorV4.sol";
import "./x-allocation-voting-governance/modules/RoundVotesCountingUpgradeableV4.sol";
import "./x-allocation-voting-governance/modules/VotesUpgradeableV4.sol";
import "./x-allocation-voting-governance/modules/VotesQuorumFractionUpgradeableV4.sol";
import "./x-allocation-voting-governance/modules/VotingSettingsUpgradeableV4.sol";
import "./x-allocation-voting-governance/modules/RoundEarningsSettingsUpgradeableV4.sol";
import "./x-allocation-voting-governance/modules/RoundFinalizationUpgradeableV4.sol";
import "./x-allocation-voting-governance/modules/RoundsStorageUpgradeableV4.sol";
import "./x-allocation-voting-governance/modules/ExternalContractsUpgradeableV4.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title XAllocationVoting
 * @notice This contract handles the voting for the most supported x2Earn applications through periodic allocation rounds.
 * The user's voting power is calculated on his VOT3 holdings at the start of each round, using a "Quadratic Funding" formula.
 * @dev Rounds are started by the Emissions contract.
 * @dev Interacts with the X2EarnApps contract to get the app data (eg: app IDs, app existence, eligible apps for each round).
 * @dev Interacts with the VotingRewards contract to save the user from casting a vote.
 * @dev The contract is using AccessControl to handle roles for admin, governance, and round-starting operations.
 *
 * ----- Version 2 -----
 * - Integrated VeBetterPassport
 * - Added check to ensure that the vote weight for an XApp cast by a user is greater than the voting threshold
 *
 * ----- Version 3 -----
 * - Updated the X2EarnApps interface to support node endorsement feature
 *
 * ----- Version 4 -----
 * - Updated the X2EarnApps interface to support node cooldown functionality
 */
contract XAllocationVotingV4 is
  XAllocationVotingGovernorV4,
  VotingSettingsUpgradeableV4,
  RoundVotesCountingUpgradeableV4,
  VotesUpgradeableV4,
  VotesQuorumFractionUpgradeableV4,
  RoundEarningsSettingsUpgradeableV4,
  ExternalContractsUpgradeableV4,
  RoundsStorageUpgradeableV4,
  RoundFinalizationUpgradeableV4,
  AccessControlUpgradeable,
  UUPSUpgradeable
{
  /// @notice Role identifier for the address that can start a new round
  bytes32 public constant ROUND_STARTER_ROLE = keccak256("ROUND_STARTER_ROLE");
  /// @notice Role identifier for the address that can upgrade the contract
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
  /// @notice Role identifier for governance operations
  bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
  /// @notice The role that can set the addresses of the contracts used by the VoterRewards contract.
  bytes32 public constant CONTRACTS_ADDRESS_MANAGER_ROLE = keccak256("CONTRACTS_ADDRESS_MANAGER_ROLE");

  /**
   * @notice Data for initializing the contract
   * @param vot3Token The address of the VOT3 token used for voting
   * @param quorumPercentage quorum as a percentage of the total supply
   * @param initialVotingPeriod The round duration
   * @param timeLock Address of the timelock contract controlling governance actions
   * @param voterRewards The address of the VoterRewards contract
   * @param emissions The address of the Emissions contract
   * @param admins The addresses of the admins
   * @param upgrader The address of the upgrader
   * @param contractsAddressManager The address of the contracts address manager.
   * @param x2EarnAppsAddress The address of the X2EarnApps contract
   * @param baseAllocationPercentage A percentage of the total amount of allocations that should be equaly distributed to all apps in a round
   * @param appSharesCap Max amount of % of votes an app can get in a round
   * @param votingThreshold Minimum amount of VOT3 balance to cast a vote
   */
  struct InitializationData {
    IVotes vot3Token;
    uint256 quorumPercentage;
    uint32 initialVotingPeriod;
    address timeLock;
    IVoterRewards voterRewards;
    IEmissions emissions;
    address[] admins;
    address upgrader;
    address contractsAddressManager;
    IX2EarnApps x2EarnAppsAddress;
    uint256 baseAllocationPercentage;
    uint256 appSharesCap;
    uint256 votingThreshold;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /**
   * @notice Initialize the contract
   * @param data The initialization data
   */
  function initialize(InitializationData memory data) public initializer {
    require(address(data.vot3Token) != address(0), "XAllocationVoting: invalid VOT3 token address");
    require(address(data.voterRewards) != address(0), "XAllocationVoting: invalid VoterRewards address");
    require(address(data.emissions) != address(0), "XAllocationVoting: invalid Emissions address");

    __XAllocationVotingGovernor_init("XAllocationVoting");
    __ExternalContracts_init(data.x2EarnAppsAddress, data.emissions, data.voterRewards);
    __VotingSettings_init(data.initialVotingPeriod);
    __RoundVotesCounting_init(data.votingThreshold);
    __Votes_init(data.vot3Token);
    __VotesQuorumFraction_init(data.quorumPercentage);
    __RoundEarningsSettings_init(data.baseAllocationPercentage, data.appSharesCap);
    __RoundFinalization_init();
    __RoundsStorage_init();
    __AccessControl_init();
    __UUPSUpgradeable_init();

    for (uint256 i; i < data.admins.length; i++) {
      require(data.admins[i] != address(0), "XAllocationVoting: invalid admin address");
      _grantRole(DEFAULT_ADMIN_ROLE, data.admins[i]);
    }

    _grantRole(UPGRADER_ROLE, data.upgrader);
    _grantRole(GOVERNANCE_ROLE, data.timeLock);
    _grantRole(CONTRACTS_ADDRESS_MANAGER_ROLE, data.contractsAddressManager);
  }

  function initializeV2(IVeBetterPassport _veBetterPassport) public reinitializer(2) {
    __ExternalContracts_init_v2(_veBetterPassport);
  }

  // ---------- Setters ---------- //
  /**
   * @dev Set the address of the X2EarnApps contract
   */
  function setX2EarnAppsAddress(IX2EarnApps newX2EarnApps) external onlyRole(CONTRACTS_ADDRESS_MANAGER_ROLE) {
    _setX2EarnApps(newX2EarnApps);
  }

  /**
   * @dev Set the address of the Emissions contract
   */
  function setEmissionsAddress(IEmissions newEmissions) external onlyRole(CONTRACTS_ADDRESS_MANAGER_ROLE) {
    _setEmissions(newEmissions);
  }

  /**
   * @dev Set the address of the VoterRewards contract
   */
  function setVoterRewardsAddress(IVoterRewards newVoterRewards) external onlyRole(CONTRACTS_ADDRESS_MANAGER_ROLE) {
    _setVoterRewards(newVoterRewards);
  }

  /**
   * @dev Update the voting threshold. This operation can only be performed through a governance proposal.
   *
   * Emits a {VotingThresholdSet} event.
   */
  function setVotingThreshold(uint256 newVotingThreshold) public virtual override onlyRole(GOVERNANCE_ROLE) {
    super.setVotingThreshold(newVotingThreshold);
  }

  /**
   * @dev Start a new voting round for allocating funds to the x-apps
   */
  function startNewRound() public override onlyRole(ROUND_STARTER_ROLE) returns (uint256) {
    return super.startNewRound();
  }

  /**
   * @dev Set the max amount of shares an app can get in a round
   */
  function setAppSharesCap(uint256 appSharesCap_) external virtual override onlyRole(GOVERNANCE_ROLE) {
    _setAppSharesCap(appSharesCap_);
  }

  /**
   * @dev Set the base allocation percentage for funds distribution in a round
   */
  function setBaseAllocationPercentage(
    uint256 baseAllocationPercentage_
  ) public virtual override onlyRole(GOVERNANCE_ROLE) {
    _setBaseAllocationPercentage(baseAllocationPercentage_);
  }

  /**
   * @dev Set the voting period for a round
   */
  function setVotingPeriod(uint32 newVotingPeriod) public virtual onlyRole(GOVERNANCE_ROLE) {
    _setVotingPeriod(newVotingPeriod);
  }

  /**
   * @dev Update the quorum a round needs to reach to be successful
   */
  function updateQuorumNumerator(uint256 newQuorumNumerator) public virtual override onlyRole(GOVERNANCE_ROLE) {
    super.updateQuorumNumerator(newQuorumNumerator);
  }

  /**
   * @dev Set the VeBetterPassport contract
   */
  function setVeBetterPassport(IVeBetterPassport newVeBetterPassport) external onlyRole(GOVERNANCE_ROLE) {
    _setVeBetterPassport(newVeBetterPassport);
  }

  // ---------- Getters ---------- //

  /**
   * Returns the quorum for a given round
   */
  function roundQuorum(uint256 roundId) external view returns (uint256) {
    return quorum(roundSnapshot(roundId));
  }

  // ---------- Required overrides ---------- //

  function votingPeriod()
    public
    view
    override(XAllocationVotingGovernorV4, VotingSettingsUpgradeableV4)
    returns (uint256)
  {
    return super.votingPeriod();
  }

  function quorum(
    uint256 blockNumber
  ) public view override(XAllocationVotingGovernorV4, VotesQuorumFractionUpgradeableV4) returns (uint256) {
    return super.quorum(blockNumber);
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(AccessControlUpgradeable, XAllocationVotingGovernorV4) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  // ---------- Authorizations ------------ //

  function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
