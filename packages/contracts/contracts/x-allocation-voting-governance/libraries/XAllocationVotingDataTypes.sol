// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

/**
 * @title XAllocationVotingDataTypes
 * @notice Library defining data types used in the XAllocationVoting contract
 * @dev Contains storage structures and data types for allocation voting functionality
 */
library XAllocationVotingDataTypes {
  /**
   * @dev Storage structure for AutoVoting
   * @param _autoVotingEnabled Mapping of user addresses to their auto-voting status checkpoints
   * @param _userVotingPreferences Mapping of user addresses to their preferred app IDs
   * @param _totalAutoVotingUsers Checkpoint tracking total number of auto-voting users
   */
  struct AutoVotingStorage {
    mapping(address => Checkpoints.Trace208) _autoVotingEnabled;
    mapping(address => bytes32[]) _userVotingPreferences;
    Checkpoints.Trace208 _totalAutoVotingUsers;
  }
}
