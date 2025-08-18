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

import { GovernorStorageTypes } from "./GovernorStorageTypes.sol";
import { IVOT3 } from "../../interfaces/IVOT3.sol";
import { IVoterRewards } from "../../interfaces/IVoterRewards.sol";
import { IXAllocationVotingGovernor } from "../../interfaces/IXAllocationVotingGovernor.sol";
import { TimelockControllerUpgradeable } from "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";
import { IB3TR } from "../../interfaces/IB3TR.sol";
import { IVeBetterPassport } from "../../interfaces/IVeBetterPassport.sol";
import { GovernorProposalLogic } from "./GovernorProposalLogic.sol";
import { GovernorTypes } from "./GovernorTypes.sol";
import { IGalaxyMember } from "../../interfaces/IGalaxyMember.sol";
import { IGrantsManager } from "../../interfaces/IGrantsManager.sol";

/// @title GovernorConfigurator Library
/// @notice Library for managing the configuration of a Governor contract.
/// @dev This library provides functions to set and get various configuration parameters and contracts used by the Governor contract.
library GovernorConfigurator {
  /// @dev Emitted when the `votingThreshold` is set.
  event VotingThresholdSet(uint256 oldVotingThreshold, uint256 newVotingThreshold);

  /// @dev Emitted when the minimum delay before vote starts is set.
  event MinVotingDelaySet(uint256 oldMinMinVotingDelay, uint256 newMinVotingDelay);

  /// @dev Emitted when the deposit threshold percentage is set.
  event DepositThresholdSet(uint256 oldDepositThreshold, uint256 newDepositThreshold);

  /// @dev Emitted when the voter rewards contract is set.
  event VoterRewardsSet(address oldContractAddress, address newContractAddress);

  /// @dev Emitted when the XAllocationVotingGovernor contract is set.
  event XAllocationVotingSet(address oldContractAddress, address newContractAddress);

  /// @dev Emitted when the timelock controller used for proposal execution is modified.
  event TimelockChange(address oldTimelock, address newTimelock);

  /// @dev Emitted when the VeBetterPassport contract is set.
  event VeBetterPassportSet(address oldVeBetterPassport, address newVeBetterPassport);

  /// @dev The deposit threshold is not in the valid range for a percentage - 0 to 100.
  error GovernorDepositThresholdNotInRange(uint256 depositThreshold);

  /// @dev The GM level is not in the valid range - 0 to max level.
  error GMLevelAboveMaxLevel(uint256 gmLevel);

  /// @dev Emitted when the `votingThreshold` for a proposal type is set.
  event VotingThresholdSetV2(
    GovernorTypes.ProposalType proposalType,
    uint256 oldVotingThreshold,
    uint256 newVotingThreshold
  );

  /// @dev Emitted when the deposit threshold percentage for a proposal type is set.
  event DepositThresholdSetV2(
    GovernorTypes.ProposalType proposalType,
    uint256 oldDepositThreshold,
    uint256 newDepositThreshold
  );
  /// @dev Emitted when the deposit threshold cap for a proposal type is set.
  event DepositThresholdCapSet(
    GovernorTypes.ProposalType proposalType,
    uint256 oldDepositThresholdCap,
    uint256 newDepositThresholdCap
  );

  /// @dev Emitted when the required GM level for a proposal type is set.
  event RequiredGMLevelSet(
    GovernorTypes.ProposalType proposalType,
    uint256 oldRequiredGMLevel,
    uint256 newRequiredGMLevel
  );

  /**------------------ SETTERS ------------------**/

  /**
   * @notice Sets the VeBetterPassport contract.
   * @dev Sets a new VeBetterPassport contract and emits a {VeBetterPassportSet} event.
   * @param self The storage reference for the GovernorStorage.
   * @param newVeBetterPassport The new VeBetterPassport contract.
   */
  function setVeBetterPassport(
    GovernorStorageTypes.GovernorStorage storage self,
    IVeBetterPassport newVeBetterPassport
  ) external {
    emit VeBetterPassportSet(address(self.veBetterPassport), address(newVeBetterPassport));
    self.veBetterPassport = newVeBetterPassport;
  }

  /**
   * @notice Sets the minimum delay before vote starts.
   * @dev Sets a new minimum voting delay and emits a {MinVotingDelaySet} event.
   * @param self The storage reference for the GovernorStorage.
   * @param newMinVotingDelay The new minimum voting delay.
   */
  function setMinVotingDelay(GovernorStorageTypes.GovernorStorage storage self, uint256 newMinVotingDelay) external {
    emit MinVotingDelaySet(self.minVotingDelay, newMinVotingDelay);
    self.minVotingDelay = newMinVotingDelay;
  }

  /**
   * @notice Sets the voter rewards contract.
   * @dev Sets a new voter rewards contract and emits a {VoterRewardsSet} event.
   * @param self The storage reference for the GovernorStorage.
   * @param newVoterRewards The new voter rewards contract.
   */
  function setVoterRewards(GovernorStorageTypes.GovernorStorage storage self, IVoterRewards newVoterRewards) external {
    require(address(newVoterRewards) != address(0), "GovernorConfigurator: voterRewards address cannot be zero");
    emit VoterRewardsSet(address(self.voterRewards), address(newVoterRewards));
    self.voterRewards = newVoterRewards;
  }

  /**
   * @notice Sets the XAllocationVotingGovernor contract.
   * @dev Sets a new XAllocationVotingGovernor contract and emits a {XAllocationVotingSet} event.
   * @param self The storage reference for the GovernorStorage.
   * @param newXAllocationVoting The new XAllocationVotingGovernor contract.
   */
  function setXAllocationVoting(
    GovernorStorageTypes.GovernorStorage storage self,
    IXAllocationVotingGovernor newXAllocationVoting
  ) external {
    require(
      address(newXAllocationVoting) != address(0),
      "GovernorConfigurator: xAllocationVoting address cannot be zero"
    );
    emit XAllocationVotingSet(address(self.xAllocationVoting), address(newXAllocationVoting));
    self.xAllocationVoting = newXAllocationVoting;
  }

  /**
   * @notice Updates the timelock controller.
   * @dev Sets a new timelock controller and emits a {TimelockChange} event.
   * @param self The storage reference for the GovernorStorage.
   * @param newTimelock The new timelock controller.
   */
  function updateTimelock(
    GovernorStorageTypes.GovernorStorage storage self,
    TimelockControllerUpgradeable newTimelock
  ) external {
    require(address(newTimelock) != address(0), "GovernorConfigurator: timelock address cannot be zero");
    emit TimelockChange(address(self.timelock), address(newTimelock));
    self.timelock = newTimelock;
  }

  /**
   * @notice Sets the deposit threshold percentage for a proposal type.
   * @dev Sets a new deposit threshold percentage for a proposal type and emits a {DepositThresholdSet} event.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The proposal type.
   * @param newDepositThreshold The new deposit threshold percentage.
   */
  function setProposalTypeDepositThresholdPercentage(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalType,
    uint256 newDepositThreshold
  ) external {
    require(GovernorProposalLogic.isValidProposalType(proposalType), "GovernorConfigurator: invalid proposal type");
    if (newDepositThreshold > 100) {
      revert GovernorDepositThresholdNotInRange(newDepositThreshold);
    }
    _setProposalTypeDepositThresholdPercentage(self, proposalType, newDepositThreshold); //
  }

  /**
   * @notice Sets the deposit threshold percentage for a proposal type.
   * @dev Sets a new deposit threshold percentage for a proposal type and emits a {DepositThresholdSet} event.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The proposal type.
   * @param newDepositThreshold The new deposit threshold percentage.
   */
  function _setProposalTypeDepositThresholdPercentage(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalType,
    uint256 newDepositThreshold
  ) internal {
    emit DepositThresholdSetV2(
      proposalType,
      self.proposalTypeDepositThresholdPercentage[proposalType],
      newDepositThreshold
    );
    self.proposalTypeDepositThresholdPercentage[proposalType] = newDepositThreshold;
  }

  /**
   * @notice Sets the voting threshold for a proposal type.
   * @dev Sets a new voting threshold for a proposal type and emits a {VotingThresholdSet} event.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The proposal type.
   * @param newVotingThreshold The new voting threshold.
   */
  function setProposalTypeVotingThreshold(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalType,
    uint256 newVotingThreshold
  ) external {
    require(GovernorProposalLogic.isValidProposalType(proposalType), "GovernorConfigurator: invalid proposal type");
    _setProposalTypeVotingThreshold(self, proposalType, newVotingThreshold);
  }

  /**
   * @notice Sets the voting threshold for a proposal type.
   * @dev Sets a new voting threshold for a proposal type and emits a {VotingThresholdSet} event.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The proposal type.
   * @param newVotingThreshold The new voting threshold.
   */
  function _setProposalTypeVotingThreshold(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalType,
    uint256 newVotingThreshold
  ) internal {
    emit VotingThresholdSetV2(proposalType, self.proposalTypeVotingThreshold[proposalType], newVotingThreshold);
    self.proposalTypeVotingThreshold[proposalType] = newVotingThreshold;
  }

  /**
   * @notice Sets the deposit threshold cap for a proposal type.
   * @dev Sets a new deposit threshold cap for a proposal type and emits a {DepositThresholdCapSet} event.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The proposal type.
   * @param newDepositThresholdCap The new deposit threshold cap.
   */
  function setProposalTypeDepositThresholdCap(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalType,
    uint256 newDepositThresholdCap
  ) external {
    require(GovernorProposalLogic.isValidProposalType(proposalType), "GovernorConfigurator: invalid proposal type");
    _setProposalTypeDepositThresholdCap(self, proposalType, newDepositThresholdCap);
  }

  /**
   * @notice Sets the deposit threshold cap for a proposal type.
   * @dev Sets a new deposit threshold cap for a proposal type and emits a {DepositThresholdCapSet} event.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The proposal type.
   * @param newDepositThresholdCap The new deposit threshold cap.
   */
  function _setProposalTypeDepositThresholdCap(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalType,
    uint256 newDepositThresholdCap
  ) internal {
    emit DepositThresholdCapSet(
      proposalType,
      self.proposalTypeDepositThresholdCap[proposalType],
      newDepositThresholdCap
    );
    self.proposalTypeDepositThresholdCap[proposalType] = newDepositThresholdCap;
  }

  function setGalaxyMemberContract(
    GovernorStorageTypes.GovernorStorage storage self,
    IGalaxyMember newGalaxyMember
  ) external {
    require(address(newGalaxyMember) != address(0), "GovernorConfigurator: GalaxyMember address cannot be zero");
    _setGalaxyMemberContract(self, newGalaxyMember);
  }

  /**
   * @notice Sets the GalaxyMember contract.
   * @param self The storage reference for the GovernorStorage.
   * @param newGalaxyMember The new GalaxyMember contract.
   */
  function _setGalaxyMemberContract(
    GovernorStorageTypes.GovernorStorage storage self,
    IGalaxyMember newGalaxyMember
  ) internal {
    require(address(newGalaxyMember) != address(0), "GovernorConfigurator: GalaxyMember address cannot be zero");
    self.galaxyMember = newGalaxyMember;
  }

  function setGrantsManagerContract(
    GovernorStorageTypes.GovernorStorage storage self,
    IGrantsManager newGrantsManager
  ) external {
    require(address(newGrantsManager) != address(0), "GovernorConfigurator: GrantsManager address cannot be zero");
    _setGrantsManagerContract(self, newGrantsManager);
  }

  /**
   * @notice Sets the GrantsManager contract.
   * @param self The storage reference for the GovernorStorage.
   * @param newGrantsManager The new GrantsManager contract.
   */
  function _setGrantsManagerContract(
    GovernorStorageTypes.GovernorStorage storage self,
    IGrantsManager newGrantsManager
  ) internal {
    require(address(newGrantsManager) != address(0), "GovernorConfigurator: GrantsManager address cannot be zero");
    self.grantsManager = newGrantsManager;
  }

  /**------------------ GETTERS ------------------**/
  /**
   * @notice Returns the voting threshold.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The proposal type.
   * @return The current voting threshold.
   */
  function getVotingThreshold(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalType
  ) internal view returns (uint256) {
    require(GovernorProposalLogic.isValidProposalType(proposalType), "GovernorConfigurator: invalid proposal type");
    return self.proposalTypeVotingThreshold[proposalType];
  }

  /**
   * @notice Returns the minimum delay before vote starts.
   * @param self The storage reference for the GovernorStorage.
   * @return The current minimum voting delay.
   */
  function getMinVotingDelay(GovernorStorageTypes.GovernorStorage storage self) internal view returns (uint256) {
    return self.minVotingDelay;
  }

  /**
   * @notice Returns the deposit threshold percentage.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The proposal type.
   * @return The current deposit threshold percentage.
   */
  function getDepositThresholdPercentage(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalType
  ) internal view returns (uint256) {
    require(GovernorProposalLogic.isValidProposalType(proposalType), "GovernorConfigurator: invalid proposal type");
    return self.proposalTypeDepositThresholdPercentage[proposalType];
  }

  /**
   * @notice Returns the VeBetterPassport contract.
   * @param self The storage reference for the GovernorStorage.
   * @return The current VeBetterPassport contract.
   */
  function veBetterPassport(
    GovernorStorageTypes.GovernorStorage storage self
  ) internal view returns (IVeBetterPassport) {
    return self.veBetterPassport;
  }

  /**
   * @notice Returns the deposit threshold cap for a proposal type.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalType The proposal type.
   * @return The current deposit threshold cap.
   */
  function getDepositThresholdCap(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalType
  ) internal view returns (uint256) {
    require(GovernorProposalLogic.isValidProposalType(proposalType), "GovernorConfigurator: invalid proposal type");
    return self.proposalTypeDepositThresholdCap[proposalType];
  }

  /**
   * @notice Returns the GalaxyMember contract.
   * @param self The storage reference for the GovernorStorage.
   * @return The current GalaxyMember contract.
   */
  function getGalaxyMemberContract(
    GovernorStorageTypes.GovernorStorage storage self
  ) internal view returns (IGalaxyMember) {
    return self.galaxyMember;
  }

  /**
   * @notice Returns the GrantsManager contract.
   * @param self The storage reference for the GovernorStorage.
   * @return The current GrantsManager contract.
   */
  function getGrantsManagerContract(
    GovernorStorageTypes.GovernorStorage storage self
  ) internal view returns (IGrantsManager) {
    return self.grantsManager;
  }

  /**
   * @notice Returns the GM weight for a proposal type.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalTypeValue The proposal type.
   * @return The current GM weight for the proposal type.
   */
  function getRequiredGMLevelByProposalType(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalTypeValue
  ) internal view returns (uint256) {
    require(
      GovernorProposalLogic.isValidProposalType(proposalTypeValue),
      "GovernorConfigurator: invalid proposal type"
    );
    return self.requiredGMLevelByProposalType[proposalTypeValue];
  }

  /**
   * @notice Sets the GM weight for a proposal type.
   * @param self The storage reference for the GovernorStorage.
   * @param proposalTypeValue The proposal type.
   * @param newGMWeight The new GM weight for the proposal type.
   */
  function setRequiredGMLevelByProposalType(
    GovernorStorageTypes.GovernorStorage storage self,
    GovernorTypes.ProposalType proposalTypeValue,
    uint256 newGMWeight
  ) internal {
    uint256 maxGMWeight = self.galaxyMember.MAX_LEVEL();
    uint256 oldRequiredGMLevel = self.requiredGMLevelByProposalType[proposalTypeValue];
    require(
      GovernorProposalLogic.isValidProposalType(proposalTypeValue),
      "GovernorConfigurator: invalid proposal type"
    );

    if (newGMWeight > maxGMWeight) {
      revert GMLevelAboveMaxLevel(newGMWeight);
    }
    emit RequiredGMLevelSet(proposalTypeValue, oldRequiredGMLevel, newGMWeight);
    self.requiredGMLevelByProposalType[proposalTypeValue] = newGMWeight;
  }
}
