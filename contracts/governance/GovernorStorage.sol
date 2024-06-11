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

pragma solidity ^0.8.20;

import { GovernorStorageTypes } from "./libraries/GovernorStorageTypes.sol";
import { GovernorTypes } from "./libraries/GovernorTypes.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title GovernorStorage
/// @notice Contract used as storage of the B3TRGovernor contract.
/// @dev It defines the storage layout of the B3TRGovernor contract.
contract GovernorStorage is Initializable {
  // keccak256(abi.encode(uint256(keccak256("GovernorStorageLocation")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant GovernorStorageLocation = 0xd09a0aaf4ab3087bae7fa25ef74ddd4e5a4950980903ce417e66228cf7dc7b00;

  /// @dev Internal function to access the governor storage slot.
  function getGovernorStorage() internal pure returns (GovernorStorageTypes.GovernorStorage storage $) {
    assembly {
      $.slot := GovernorStorageLocation
    }
  }

  /// @dev Initializes the governor storage
  function __GovernorStorage_init(
    GovernorTypes.InitializationData memory initializationData,
    string memory governorName
  ) internal onlyInitializing {
    __GovernorStorage_init_unchained(initializationData, governorName);
  }

  /// @dev Part of the initialization process that configures the governor storage.
  function __GovernorStorage_init_unchained(
    GovernorTypes.InitializationData memory initializationData,
    string memory governorName
  ) internal onlyInitializing {
    // Set the governor time lock storage
    GovernorStorageTypes.GovernorStorage storage governorStorage = getGovernorStorage();
    governorStorage.timelock = initializationData.timelock;

    // Set the governor function restrictions storage
    governorStorage.isFunctionRestrictionEnabled = initializationData.isFunctionRestrictionEnabled;

    // Set the governor external contracts storage
    governorStorage.voterRewards = initializationData.voterRewards;
    governorStorage.xAllocationVoting = initializationData.xAllocationVoting;
    governorStorage.b3tr = initializationData.b3tr;
    governorStorage.vot3 = initializationData.vot3Token;

    // Set the governor general storage
    governorStorage.name = governorName;
    governorStorage.minVotingDelay = initializationData.initialMinVotingDelay;

    // Set the governor deposit storage
    governorStorage.depositThresholdPercentage = initializationData.initialDepositThreshold;

    // Set the governor votes storage
    governorStorage.votingThreshold = initializationData.initialVotingThreshold;
  }
}
