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

import { GovernorStorageTypesV7 } from "./libraries/GovernorStorageTypesV7.sol";
import { GovernorTypesV7 } from "./libraries/GovernorTypesV7.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IVeBetterPassport } from "../../../interfaces/IVeBetterPassport.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { GovernorClockLogicV7 } from "./libraries/GovernorClockLogicV7.sol";

using Checkpoints for Checkpoints.Trace208;

/// @title GovernorStorage
/// @notice Contract used as storage of the B3TRGovernor contract.
/// @dev It defines the storage layout of the B3TRGovernor contract.
contract GovernorStorageV7 is Initializable {
  // keccak256(abi.encode(uint256(keccak256("GovernorStorageLocation")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant GovernorStorageLocation = 0xd09a0aaf4ab3087bae7fa25ef74ddd4e5a4950980903ce417e66228cf7dc7b00;

  /// @dev Internal function to access the governor storage slot.
  function getGovernorStorage() internal pure returns (GovernorStorageTypesV7.GovernorStorage storage $) {
    assembly {
      $.slot := GovernorStorageLocation
    }
  }

  /// @dev Initializes the governor storage
  function __GovernorStorage_init(
    GovernorTypesV7.InitializationData memory initializationData,
    string memory governorName
  ) internal onlyInitializing {
    __GovernorStorage_init_unchained(initializationData, governorName);
  }

  /// @dev Part of the initialization process that configures the governor storage.
  function __GovernorStorage_init_unchained(
    GovernorTypesV7.InitializationData memory initializationData,
    string memory governorName
  ) internal onlyInitializing {
    GovernorStorageTypesV7.GovernorStorage storage governorStorage = getGovernorStorage();

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
    GovernorStorageTypesV7.GovernorStorage storage governorStorage = getGovernorStorage();
    governorStorage.veBetterPassport = veBetterPassport;
  }

  function __GovernorStorage_init_v7(
    GovernorTypesV7.InitializationDataV7 memory initializationDataV7
  ) internal onlyInitializing {
    GovernorStorageTypesV7.GovernorStorage storage governorStorage = getGovernorStorage();

    // Set deposit threshold for Standard proposal type
    governorStorage.proposalTypeDepositThresholdPercentage[GovernorTypesV7.ProposalType.Standard] = governorStorage
      .depositThresholdPercentage_DEPRECATED;

    // Set deposit threshold for Grant proposal type
    governorStorage.proposalTypeDepositThresholdPercentage[GovernorTypesV7.ProposalType.Grant] = initializationDataV7
      .grantDepositThreshold;

    // Set voting threshold for Standard proposal type
    governorStorage.proposalTypeVotingThreshold[GovernorTypesV7.ProposalType.Standard] = governorStorage
      .votingThreshold_DEPRECATED;

    // Set voting threshold for Grant proposal type
    governorStorage.proposalTypeVotingThreshold[GovernorTypesV7.ProposalType.Grant] = initializationDataV7
      .grantVotingThreshold;

    Checkpoints.Trace208 storage quorumNumeratorHistory_DEPRECATED = governorStorage.quorumNumeratorHistory_DEPRECATED;

    Checkpoints.Trace208 storage proposalTypeQuorum = governorStorage.proposalTypeQuorum[
      GovernorTypesV7.ProposalType.Standard
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
    governorStorage.proposalTypeQuorum[GovernorTypesV7.ProposalType.Grant].push(
      GovernorClockLogicV7.clock(governorStorage),
      SafeCast.toUint208(initializationDataV7.grantQuorum)
    );

    // Set deposit threshold cap for Standard proposal type
    governorStorage.proposalTypeDepositThresholdCap[GovernorTypesV7.ProposalType.Standard] = initializationDataV7
      .standardDepositThresholdCap;

    // Set deposit threshold cap for Grant proposal type
    governorStorage.proposalTypeDepositThresholdCap[GovernorTypesV7.ProposalType.Grant] = initializationDataV7
      .grantDepositThresholdCap;

    // Set GM weight for Standard proposal type
    governorStorage.requiredGMLevelByProposalType[GovernorTypesV7.ProposalType.Standard] = initializationDataV7
      .standardGMWeight;

    // Set GM weight for Grant proposal type
    governorStorage.requiredGMLevelByProposalType[GovernorTypesV7.ProposalType.Grant] = initializationDataV7
      .grantGMWeight;

    // Set GalaxyMember contract
    require(
      address(initializationDataV7.galaxyMember) != address(0),
      "B3TRGovernor: GalaxyMember address cannot be zero"
    );
    governorStorage.galaxyMember = initializationDataV7.galaxyMember;

    // Set GrantsManager contract
    require(
      address(initializationDataV7.grantsManager) != address(0),
      "B3TRGovernor: GrantsManager address cannot be zero"
    );
    governorStorage.grantsManager = initializationDataV7.grantsManager;
  }
}
