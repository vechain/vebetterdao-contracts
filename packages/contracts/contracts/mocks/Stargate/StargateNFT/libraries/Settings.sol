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

import { DataTypes } from "./DataTypes.sol";
import { Errors } from "./Errors.sol";

/// @title Settings
/// @notice Library for the StargateNFT contract to handle settings and configuration
library Settings {
    // ------------------ Events ------------------ //
    /**
     * @notice Emitted when the base URI for the token metadata is updated
     * @param oldBaseURI The old base URI
     * @param newBaseURI The new base URI
     */
    event BaseURIUpdated(string oldBaseURI, string newBaseURI);

    // ------------------ Setters ------------------ //

    /// @notice Sets the base URI for the token collection metadata
    /// @dev Only the DEFAULT_ADMIN_ROLE can call this function
    /// @dev Metadata is hosted on IPFS, and the base URI is the base path to the collection metadata
    /// @param _baseTokenURI The new base URI
    /// @dev Emits a {IStargateNFT.BaseURIUpdated} event
    function setBaseURI(
        DataTypes.StargateNFTStorage storage $,
        string memory _baseTokenURI
    ) external {
        emit BaseURIUpdated($.baseTokenURI, _baseTokenURI);
        $.baseTokenURI = _baseTokenURI;
    }
}
