// SPDX-License-Identifier: MIT

//        ✦     *        .         ✶         *        .       ✦       .
//  ✦   _______..___________.    ___      .______        _______      ___   .___________. _______   ✦
//     /       ||           |   /   \     |   _  \      /  _____|    /   \  |           ||   ____|  *
//    |   (----``---|  |----`  /  ^  \    |  |_)  |    |  |  __     /  ^  \ `---|  |----`|  |__      .
//     \   \        |  |      /  /_\  \   |      /     |  | |_ |   /  /_\  \    |  |     |   __|     ✶
// .----)   |       |  |     /  _____  \  |  |\  \----.|  |__| |  /  _____  \   |  |     |  |____   *
// |_______/        |__|    /__/     \__\ | _| `._____| \______| /__/     \__\  |__|     |_______|  ✦
//         *       .      ✦      *      .        ✶       *      ✦       .       *        ✶

pragma solidity 0.8.20;

import { Time } from "@openzeppelin/contracts/utils/types/Time.sol";

/// @title Clock
/// @notice Library for the StargateNFT contract to get the current block number and clock mode
/// @dev The library exposes external functions but also internal functions that are used by other libraries
/// to avoid external calls and avoid the need to make this library a dependency of other libraries.
library Clock {
    // ------------------ Getters ------------------ //

    /// @notice Returns the current block number
    /// @return blockNumber - the current block number
    function clock() external view returns (uint48) {
        return _clock();
    }

    /// @notice Returns the current timestamp
    /// @return timestamp - the current timestamp
    function timestamp() external view returns (uint48) {
        return _timestamp();
    }

    /// @notice Returns the mode of the clock
    /// @return mode - the mode of the clock
    function CLOCK_MODE() external pure returns (string memory) {
        return _CLOCK_MODE();
    }

    // ------------------ Internal ------------------ //

    /// @notice Returns the current block number
    /// @return blockNumber - the current block number
    function _clock() internal view returns (uint48) {
        return Time.blockNumber();
    }

    /// @notice Returns the mode of the clock
    /// @return mode - the mode of the clock
    function _CLOCK_MODE() internal pure returns (string memory) {
        return "mode=blocknumber&from=default";
    }

    /// @notice Returns the current timestamp
    /// @return timestamp - the current timestamp
    function _timestamp() internal view returns (uint48) {
        return Time.timestamp();
    }
}
