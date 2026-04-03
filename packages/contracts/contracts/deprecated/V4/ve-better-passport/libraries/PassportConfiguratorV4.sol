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

import { PassportStorageTypesV4 } from "./PassportStorageTypesV4.sol";
import { PassportTypesV4 } from "./PassportTypesV4.sol";
import { PassportClockLogicV4 } from "./PassportClockLogicV4.sol";
import { IX2EarnApps } from "../../../../interfaces/IX2EarnApps.sol";
import { IXAllocationVotingGovernor } from "../../../../interfaces/IXAllocationVotingGovernor.sol";
import { IGalaxyMember } from "../../../../interfaces/IGalaxyMember.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

/// @title PassportConfiguratorV4 Library
/// @notice Library for managing the configuration of a Passport contract.
/// @dev This library provides functions to set and get various configuration parameters and contracts used by the Passport contract.
library PassportConfiguratorV4 {
  using Checkpoints for Checkpoints.Trace208;

  // ---------- Getters ---------- //
  /// @notice Gets the x2EarnApps contract address
  function getX2EarnApps(PassportStorageTypesV4.PassportStorage storage self) internal view returns (IX2EarnApps) {
    return self.x2EarnApps;
  }

  /// @notice Gets the xAllocationVoting contract address
  function getXAllocationVoting(
    PassportStorageTypesV4.PassportStorage storage self
  ) internal view returns (IXAllocationVotingGovernor) {
    return self.xAllocationVoting;
  }

  /// @notice Gets the galaxy member contract address
  function getGalaxyMember(PassportStorageTypesV4.PassportStorage storage self) internal view returns (IGalaxyMember) {
    return self.galaxyMember;
  }

  // ---------- Setters ---------- //

  /// @notice Initializes the PassportStorage struct with the provided initialization data
  function initializePassportStorage(
    PassportStorageTypesV4.PassportStorage storage self,
    PassportTypesV4.InitializationData memory initializationData
  ) external {
    // Initialize the external contracts
    setX2EarnApps(self, initializationData.x2EarnApps);
    setXAllocationVoting(self, initializationData.xAllocationVoting);
    setGalaxyMember(self, initializationData.galaxyMember);

    // Initialize the bot signals threshold
    self.signalsThreshold = initializationData.signalingThreshold;

    // Initialize the minimum Galaxy Member level to be considered human by Personhood checks
    self.minimumGalaxyMemberLevel = initializationData.minimumGalaxyMemberLevel;

    // Initialize the participant score threshold to be considered human by Personhood checks
    self.popScoreThreshold.push(PassportClockLogicV4.clock(), 0);

    // Initialize the number of rounds for cumulative score
    self.roundsForCumulativeScore = initializationData.roundsForCumulativeScore;

    // Initialize the secuirty multiplier
    self.securityMultiplier[PassportTypesV4.APP_SECURITY.LOW] = 100;
    self.securityMultiplier[PassportTypesV4.APP_SECURITY.MEDIUM] = 200;
    self.securityMultiplier[PassportTypesV4.APP_SECURITY.HIGH] = 400;

    // Decay
    self.decayRate = initializationData.decayRate;

    // Set the threshold percentage of blacklisted or whitelisted entities to consider a passport user as blacklisted or whitelisted
    self.blacklistThreshold = initializationData.blacklistThreshold;
    self.whitelistThreshold = initializationData.whitelistThreshold;

    // Set the maximum number of entities per passport
    self.maxEntitiesPerPassport = initializationData.maxEntitiesPerPassport;
  }

  /// @notice Sets the X2EarnApps contract address
  /// @dev The X2EarnApps contract address can be modified by the CONTRACTS_ADDRESS_MANAGER_ROLE
  /// @param _x2EarnApps - the X2EarnApps contract address
  function setX2EarnApps(PassportStorageTypesV4.PassportStorage storage self, IX2EarnApps _x2EarnApps) public {
    require(address(_x2EarnApps) != address(0), "VeBetterPassportV4: x2EarnApps is the zero address");

    self.x2EarnApps = _x2EarnApps;
  }

  /// @dev Sets the xAllocationVoting contract
  /// @param self - the PassportStorage struct
  /// @param _xAllocationVoting - the xAllocationVoting contract address
  function setXAllocationVoting(
    PassportStorageTypesV4.PassportStorage storage self,
    IXAllocationVotingGovernor _xAllocationVoting
  ) public {
    require(address(_xAllocationVoting) != address(0), "VeBetterPassportV4: xAllocationVoting is the zero address");

    self.xAllocationVoting = _xAllocationVoting;
  }

  /// @notice Sets the galaxy member contract address
  /// @param self - the PassportStorage struct
  /// @param _galaxyMember - the galaxy member contract address
  function setGalaxyMember(PassportStorageTypesV4.PassportStorage storage self, IGalaxyMember _galaxyMember) public {
    require(address(_galaxyMember) != address(0), "VeBetterPassportV4: galaxyMember is the zero address");

    self.galaxyMember = _galaxyMember;
  }
}
