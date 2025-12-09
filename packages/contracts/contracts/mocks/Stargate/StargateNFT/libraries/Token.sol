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
import { IStargateNFT } from "../../interfaces/IStargateNFT.sol";
import { Clock } from "./Clock.sol";
import { Errors } from "./Errors.sol";
import { Levels } from "./Levels.sol";
import { IStargate } from "../../interfaces/IStargate.sol";

/// @title Token
/// @notice Library for the StargateNFT contract to get the token details
/// @dev The library exposes external functions but also internal functions that are used by other libraries
/// to avoid external calls and avoid the need to make this library a dependency of other libraries.
library Token {
    // ------------------ Token Maturity Getters ------------------ //

    /// @notice Returns the maturity period end block for a given token
    /// @param _tokenId The ID of the token to get maturity period end block for
    /// @return maturityPeriodEndBlock The maturity period end block
    function maturityPeriodEndBlock(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId
    ) public view returns (uint64) {
        _requireTokenExists(_tokenId);

        return $.maturityPeriodEndBlock[_tokenId];
    }

    /// @notice Returns true if a token is in the maturity period
    /// @param _tokenId The ID of the token to check
    /// @return isInMaturityPeriod True if the token is in the maturity period, false otherwise
    function isUnderMaturityPeriod(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId
    ) external view returns (bool) {
        _requireTokenExists(_tokenId);

        // Token is still maturing if maturityEndsAtBlock is in the future
        return $.maturityPeriodEndBlock[_tokenId] > Clock._clock();
    }

    // ------------------ Token Supply Getters ------------------ //

    /// @notice Returns the number of X tokens
    /// @return count The number of X tokens
    function xTokensCount(DataTypes.StargateNFTStorage storage $) external view returns (uint208) {
        uint208 count;
        uint8[] memory levelIds = Levels._getLevelIds($);

        for (uint256 i; i < levelIds.length; i++) {
            // Get level ID
            uint8 levelId = levelIds[i];

            // Get token level spec
            DataTypes.Level memory tokenLevelSpec = $.levels[levelId];

            // Count X tokens
            if (tokenLevelSpec.isX) {
                count += Levels._getCirculatingSupply($, levelId);
            }
        }

        return count;
    }

    // ------------------ Token Ownership Getters ------------------ //

    /// @notice Returns an array of token IDs owned by a given address
    /// @dev Replaces the original `ownerToId` mapping which can't support multiple tokens per owner
    /// @param _owner The address to get token IDs for
    /// @return An array of token IDs owned by the address
    function idsOwnedBy(address _owner) external view returns (uint256[] memory) {
        return _idsOwnedBy(_owner);
    }

    /// @notice Returns an array of token IDs owned by a given address
    /// @dev Replaces the original `ownerToId` mapping which can't support multiple tokens per owner
    /// @param _owner The address to get token IDs for
    /// @return An array of token IDs owned by the address
    // slither-disable-next-line calls-loop
    function _idsOwnedBy(address _owner) internal view returns (uint256[] memory) {
        // Get token count
        uint256 tokenCount = IStargateNFT(address(this)).balanceOf(_owner);

        // If owner has no tokens, return empty array
        if (tokenCount <= 0) {
            return new uint256[](0);
        }

        // Create array to store token IDs
        uint256[] memory tokenIds = new uint256[](tokenCount);

        // Get all token IDs in a single loop to avoid multiple external calls
        for (uint256 i; i < tokenCount; i++) {
            tokenIds[i] = IStargateNFT(address(this)).tokenOfOwnerByIndex(_owner, i);
        }

        return tokenIds;
    }

    /// @notice Getter relies on _idsOwnedBy, which uses balanceOf, which can revert
    /// @dev This function is used to get all tokens owned by an address
    /// @param _owner The address to get tokens for
    /// @return tokens An array of tokens owned by the address
    function tokensOwnedBy(
        DataTypes.StargateNFTStorage storage $,
        address _owner
    ) external view returns (DataTypes.Token[] memory) {
        uint256[] memory tokenIds = _idsOwnedBy(_owner);
        DataTypes.Token[] memory tokens = new DataTypes.Token[](tokenIds.length);
        for (uint256 i; i < tokenIds.length; i++) {
            tokens[i] = _getToken($, tokenIds[i]);
        }
        return tokens;
    }

    /// @notice Getter relies on _idsOwnedBy, which uses balanceOf, which can revert
    /// @dev This function is used to get the total VET staked by an address
    /// @param _owner The address to get total VET staked for
    /// @return totalVetStaked The total VET staked by the address
    function ownerTotalVetStaked(
        DataTypes.StargateNFTStorage storage $,
        address _owner
    ) external view returns (uint256) {
        uint256[] memory tokenIds = _idsOwnedBy(_owner);
        uint256 totalVetStaked;
        for (uint256 i; i < tokenIds.length; i++) {
            totalVetStaked += _getToken($, tokenIds[i]).vetAmountStaked;
        }
        return totalVetStaked;
    }

    /// @notice A helper function to check if an address has a token of specified type (X or not X)
    /// @dev This breaks the loop as soon as it finds a matching token, avoiding unnecessary iterations
    /// @dev WARNING: This function contains external calls in a loop, which is flagged by static analyzers.
    ///      This pattern is necessary due to ERC721Enumerable's token iteration model, but should be used with caution:
    ///      1. It returns early to minimize gas usage when possible
    ///      2. It should only be used in view functions, never in state-changing functions
    ///      3. This approach is acceptable for off-chain queries and UI/DApp integrations
    ///      4. For on-chain interactions, prefer using alternative data structures when possible
    /// @param $ The storage reference
    /// @param _target The address to check
    /// @param _isCheckingForX True if checking for X tokens, false if checking for normal tokens
    /// @return True if a matching token is found, false otherwise
    // slither-disable-next-line calls-loop
    function _hasTokenOfType(
        DataTypes.StargateNFTStorage storage $,
        address _target,
        bool _isCheckingForX
    ) internal view returns (bool) {
        // Get token count directly from the contract
        uint256 tokenCount = IStargateNFT(address(this)).balanceOf(_target);

        // If owner has no tokens, return false
        if (tokenCount <= 0) {
            return false;
        }

        // Check each token one by one and return early if a match is found
        uint256[] memory ownedTokenIds = _idsOwnedBy(_target);
        for (uint256 i; i < tokenCount; i++) {
            // Get token ID directly from the contract
            uint256 tokenId = ownedTokenIds[i];
            DataTypes.Token memory token = _getToken($, tokenId);
            DataTypes.Level memory tokenLevelSpec = Levels._getLevel($, token.levelId);

            // If we're checking for X tokens and this is an X token, return true
            // If we're checking for normal tokens and this is not an X token, return true
            if (tokenLevelSpec.isX == _isCheckingForX) {
                return true;
            }
        }

        // No matching token found
        return false;
    }

    /// @notice Checks if an address owns any X tokens
    /// @dev Legacy compatibility function
    /// @param _target The address to check
    /// @return True if the address owns any X tokens, false otherwise
    function ownsXToken(
        DataTypes.StargateNFTStorage storage $,
        address _target
    ) external view returns (bool) {
        return _hasTokenOfType($, _target, true);
    }

    /// @notice Checks if a token is an X token
    /// @param _tokenId The ID of the token to check
    /// @return True if the token is an X token, false otherwise
    function isXToken(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId
    ) public view returns (bool) {
        DataTypes.Token memory token = _getToken($, _tokenId);
        DataTypes.Level memory tokenLevelSpec = Levels._getLevel($, token.levelId);
        return tokenLevelSpec.isX;
    }

    // ------------------ Token Detail Getters ------------------ //

    // Note: Function getMetadata either changes or is removed, since a number of the original return values are not applicable anymore
    // function getMetadata(uint256 _tokenId) external view returns (address, strengthLevel, bool, bool, uint64, uint64, uint64) {
    // }

    /// @notice Returns a token for a given token ID
    /// @param _tokenId The ID of the token to get
    /// @return token The token
    function getToken(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId
    ) external view returns (DataTypes.Token memory) {
        return _getToken($, _tokenId);
    }

    // ------------------ Token URI Getters ------------------ //

    /// @notice Returns the token URI for a given token ID and level ID
    /// @dev The token URI is shared between all tokens of the same level,
    /// with a suffix to indicate if the token is delegated or not
    /// @param _tokenId The token ID to get the token URI for
    /// @param _levelId The token level ID as string
    /// @return tokenURI The token URI string
    function tokenURI(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId,
        string memory _levelId
    ) external view returns (string memory) {
        return _tokenURI($, _tokenId, _levelId);
    }

    // ------------------ Internal Helper Functions ------------------ //

    /// @notice Returns a token for a given token ID
    /// @param _tokenId The ID of the token to get
    /// @return token The token
    function _getToken(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId
    ) internal view returns (DataTypes.Token memory) {
        _requireTokenExists(_tokenId);

        // Get token
        DataTypes.Token memory token = $.tokens[_tokenId];

        return token;
    }

    function _tokenExists(uint256 _tokenId) internal view returns (bool) {
        return IStargateNFT(address(this)).tokenExists(_tokenId);
    }

    /// @notice Throws if a token does not exist
    /// @param _tokenId The ID of the token to check
    function _requireTokenExists(uint256 _tokenId) internal view {
        // ERC721.ownerOf will revert if the token does not exist
        IStargateNFT(address(this)).ownerOf(_tokenId);
    }

    /// @dev See {tokenURI} for details
    function _tokenURI(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId,
        string memory _levelId
    ) internal view returns (string memory) {
        bool delegated = $.stargate.getDelegationStatus(_tokenId) ==
            IStargate.DelegationStatus.ACTIVE;

        return string.concat($.baseTokenURI, _levelId, delegated ? "_locked.json" : ".json");
    }
}
