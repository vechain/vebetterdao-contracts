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

import { GovernorStorageTypes } from "./libraries/GovernorStorageTypes.sol";
import { GovernorTypes } from "./libraries/GovernorTypes.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IVeBetterPassport } from "../interfaces/IVeBetterPassport.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { GovernorClockLogic } from "./libraries/GovernorClockLogic.sol";

using Checkpoints for Checkpoints.Trace208;

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
    GovernorStorageTypes.GovernorStorage storage governorStorage = getGovernorStorage();

    // Validate and set the governor time lock storage
    require(address(initializationData.timelock) != address(0), "B3TRGovernor: timelock address cannot be zero");
    governorStorage.timelock = initializationData.timelock;

    // Set the governor function restrictions storage
    governorStorage.isFunctionRestrictionEnabled = initializationData.isFunctionRestrictionEnabled;

    // Validate and set the governor external contracts storage
    require(address(initializationData.b3tr) != address(0), "B3TRGovernor: B3TR address cannot be zero");
    require(address(initializationData.vot3Token) != address(0), "B3TRGovernor: Vot3 address cannot be zero");
    require(
      address(initializationData.xAllocationVoting) != address(0),
      "B3TRGovernor: xAllocationVoting address cannot be zero"
    );
    require(
      address(initializationData.voterRewards) != address(0),
      "B3TRGovernor: voterRewards address cannot be zero"
    );
    governorStorage.voterRewards = initializationData.voterRewards;
    governorStorage.xAllocationVoting = initializationData.xAllocationVoting;
    governorStorage.b3tr = initializationData.b3tr;
    governorStorage.vot3 = initializationData.vot3Token;

    // Set the governor general storage
    governorStorage.name = governorName;
    governorStorage.minVotingDelay = initializationData.initialMinVotingDelay;

    // Set the governor deposit storage
    governorStorage.depositThresholdPercentage_DEPRECATED = initializationData.initialDepositThreshold;

    // Set the governor votes storage
    governorStorage.votingThreshold_DEPRECATED = initializationData.initialVotingThreshold;
  }

  function __GovernorStorage_init_v4(IVeBetterPassport veBetterPassport) internal onlyInitializing {
    GovernorStorageTypes.GovernorStorage storage governorStorage = getGovernorStorage();
    governorStorage.veBetterPassport = veBetterPassport;
  }

  function __GovernorStorage_init_v7(
    GovernorTypes.InitializationDataV7 memory initializationDataV7
  ) internal onlyInitializing {
    GovernorStorageTypes.GovernorStorage storage governorStorage = getGovernorStorage();

    // Set deposit threshold for Standard proposal type
    governorStorage.proposalTypeDepositThresholdPercentage[GovernorTypes.ProposalType.Standard] = governorStorage
      .depositThresholdPercentage_DEPRECATED;

    // Set deposit threshold for Grant proposal type
    governorStorage.proposalTypeDepositThresholdPercentage[GovernorTypes.ProposalType.Grant] = initializationDataV7
      .grantDepositThreshold;

    // Set voting threshold for Standard proposal type
    governorStorage.proposalTypeVotingThreshold[GovernorTypes.ProposalType.Standard] = governorStorage
      .votingThreshold_DEPRECATED;

    // Set voting threshold for Grant proposal type
    governorStorage.proposalTypeVotingThreshold[GovernorTypes.ProposalType.Grant] = initializationDataV7
      .grantVotingThreshold;

    Checkpoints.Trace208 storage quorumNumeratorHistory_DEPRECATED = governorStorage.quorumNumeratorHistory_DEPRECATED;

    Checkpoints.Trace208 storage proposalTypeQuorum = governorStorage.proposalTypeQuorum[
      GovernorTypes.ProposalType.Standard
    ];

    // For each checkpoint in the old structure
    for (uint256 i = 0; i < quorumNumeratorHistory_DEPRECATED._checkpoints.length; i++) {
      // Get the old checkpoint data
      uint48 timepoint = quorumNumeratorHistory_DEPRECATED._checkpoints[i]._key;
      uint208 quorumNumerator = quorumNumeratorHistory_DEPRECATED._checkpoints[i]._value;

      // Push it to the new structure with the same timepoint and value
      proposalTypeQuorum.push(
        timepoint, // Use the same timepoint from the old checkpoint
        quorumNumerator // Use the same value from the old checkpoint
      );
    }

    // Set quorum for GRANT - manually implement the logic from _updateQuorumNumeratorByType
    governorStorage.proposalTypeQuorum[GovernorTypes.ProposalType.Grant].push(
      GovernorClockLogic.clock(governorStorage),
      SafeCast.toUint208(initializationDataV7.grantQuorum)
    );

    // Set deposit threshold cap for Standard proposal type
    governorStorage.proposalTypeDepositThresholdCap[GovernorTypes.ProposalType.Standard] = initializationDataV7
      .standardDepositThresholdCap;

    // Set deposit threshold cap for Grant proposal type
    governorStorage.proposalTypeDepositThresholdCap[GovernorTypes.ProposalType.Grant] = initializationDataV7
      .grantDepositThresholdCap;

    // Set GM weight for Standard proposal type
    governorStorage.requiredGMLevelByProposalType[GovernorTypes.ProposalType.Standard] = initializationDataV7.standardGMWeight;

    // Set GM weight for Grant proposal type
    governorStorage.requiredGMLevelByProposalType[GovernorTypes.ProposalType.Grant] = initializationDataV7.grantGMWeight;

    // Set GalaxyMember contract
    require(address(initializationDataV7.galaxyMember) != address(0), "B3TRGovernor: GalaxyMember address cannot be zero");
    governorStorage.galaxyMember = initializationDataV7.galaxyMember;

    // Set GrantsManager contract
    require(address(initializationDataV7.grantsManager) != address(0), "B3TRGovernor: GrantsManager address cannot be zero");
    governorStorage.grantsManager = initializationDataV7.grantsManager;
  }
}
