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

import { PassportStorageTypesV3 } from "./PassportStorageTypesV3.sol";
import { Time } from "@openzeppelin/contracts/utils/types/Time.sol";

/// @title PassportClockLogicV3 Library
/// @notice Library for managing the clock logic as specified in EIP-6372.
library PassportClockLogicV3 {
  /**
   * @notice Returns the current timepoint which is the current block number.
   * @return The current block number.
   */
  function clock() internal view returns (uint48) {
    return Time.blockNumber();
  }

  /**
   * @notice Returns the machine-readable description of the clock mode as specified in EIP-6372.
   * @dev It returns the default block number mode.
   * @return The clock mode as a string.
   */
  // solhint-disable-next-line func-name-mixedcase
  function CLOCK_MODE() internal pure returns (string memory) {
    return "mode=blocknumber&from=default";
  }
}
