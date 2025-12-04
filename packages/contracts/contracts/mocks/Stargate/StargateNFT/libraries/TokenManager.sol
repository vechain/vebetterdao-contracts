// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import { DataTypes } from "./DataTypes.sol";
import { Errors } from "./Errors.sol";
import { Token } from "./Token.sol";
import { IStargateNFT } from "../../interfaces/IStargateNFT.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title TokenManagement
/// @notice Library for the StargateNFT contract to handle token ownership and token managers.

library TokenManager {
    using EnumerableSet for EnumerableSet.UintSet;

    /// @notice Emitted when a token manager is added to a token
    event TokenManagerAdded(uint256 indexed tokenId, address indexed manager);

    /// @notice Emitted when a token manager is removed from a token
    event TokenManagerRemoved(uint256 indexed tokenId, address indexed manager);

    /// @notice Adds a token manager to a token
    /// @dev This function allows a token owner to add a manager to their token
    /// @dev Previously called `setDelegatee` in TokenManagementV3.
    /// @param _manager The address of the manager to add
    /// @param _tokenId The ID of the token to add the manager to
    /// @dev Emits a {TokenManagerAdded} event
    function addTokenManager(
        DataTypes.StargateNFTStorage storage $,
        address _manager,
        uint256 _tokenId
    ) external {
        // Check if the delegatee address is the zero address
        if (_manager == address(0)) {
            revert Errors.ManagerZeroAddress();
        }

        // Check if the delegatee is the same as the caller,
        // a token owner by defualt is the token manager and cannot
        // be the manager of their own token
        if (msg.sender == _manager) {
            revert Errors.SelfManager();
        }

        // Check that the caller owns the token
        // Will revert if token does not exist
        address owner = IStargateNFT(address(this)).ownerOf(_tokenId);
        if (owner != msg.sender) {
            revert Errors.NotOwner(_tokenId, msg.sender, owner);
        }

        // Check if token ID is already delegated to another user and
        // if so remove the delegation
        if ($.tokenIdToManager[_tokenId] != address(0)) {
            address currentManager = $.tokenIdToManager[_tokenId];
            // Emit event for delegation removal
            emit TokenManagerRemoved(_tokenId, currentManager);
            // Remove delegation
            $.managerToTokenIds[currentManager].remove(_tokenId);
        }

        // Update mappings for delegation
        $.managerToTokenIds[_manager].add(_tokenId); // Add token ID to delegatee's set
        $.tokenIdToManager[_tokenId] = _manager; // Map token ID to delegatee

        // Emit event for delegation
        emit TokenManagerAdded(_tokenId, _manager);
    }

    /// @notice Migrate a token manager to the StargateNFT contract without doing any checks,
    /// this function is used to migrate the storage from NodeManagementV3 to StargateNFT,
    /// after the migration we can remove this function
    /// @param _tokenId The ID of the token to migrate
    /// @param _manager The address of the manager to migrate
    function migrateTokenManager(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId,
        address _manager
    ) external {
        address currentManager = $.tokenIdToManager[_tokenId];
        // Check if the manager is the zero address
        if (currentManager != address(0)) {
            $.managerToTokenIds[currentManager].remove(_tokenId);
            emit TokenManagerRemoved(_tokenId, currentManager);
        }
        // Update mappings for delegation
        $.managerToTokenIds[_manager].add(_tokenId);
        $.tokenIdToManager[_tokenId] = _manager;

        // Emit event for delegation
        emit TokenManagerAdded(_tokenId, _manager);
    }

    /**
     * @notice Remove the manager of a token.
     * @dev This function allows a token owner to remove the manager of their token, effectively revoking the manager's access to the token.
     * @dev Previously called `removeDelegatee` in TokenManagementV3.
     * @param _tokenId The ID of the token to remove the manager from.
     */
    function removeTokenManager(DataTypes.StargateNFTStorage storage $, uint256 _tokenId) external {
        address currentManager = $.tokenIdToManager[_tokenId];
        // Check if the caller is the token manager or the token owner
        if (
            currentManager != msg.sender &&
            IStargateNFT(address(this)).ownerOf(_tokenId) != msg.sender
        ) {
            revert Errors.NotTokenManagerOrOwner(_tokenId);
        }
        // Check if the token has no manager
        if (currentManager == address(0)) {
            revert Errors.NoTokenManager(_tokenId);
        }
        // Remove the delegation
        $.managerToTokenIds[currentManager].remove(_tokenId);
        delete $.tokenIdToManager[_tokenId];

        // Emit event for delegation removal
        emit TokenManagerRemoved(_tokenId, currentManager);
    }

    // ---------- Getters ---------- //

    /**
     * @notice Retrieves the address of the user managing the token ID endorsement either through ownership or delegation.
     * @dev If the token is delegated, this function returns the delegatee's address. If the token is not delegated, it returns the owner's address.
     * @param _tokenId The ID of the token for which the manager address is being retrieved.
     * @return tokenManager The address of the manager of the specified token.
     */
    function getTokenManager(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId
    ) external view returns (address) {
        return _getTokenManager($, _tokenId);
    }

    /**
     * @notice Retrieve the token IDs associated with a user, either through direct ownership or as a manager.
     * @param _user The address of the user to check.
     * @return uint256[] The token IDs associated with the user.
     */
    function idsManagedBy(
        DataTypes.StargateNFTStorage storage $,
        address _user
    ) external view returns (uint256[] memory) {
        return _idsManagedBy($, _user);
    }

    function tokensManagedBy(
        DataTypes.StargateNFTStorage storage $,
        address _user
    ) external view returns (DataTypes.Token[] memory) {
        // Get the token IDs managed by the user
        uint256[] memory tokenIds = _idsManagedBy($, _user);
        // Create an array to hold the tokens
        DataTypes.Token[] memory tokens = new DataTypes.Token[](tokenIds.length);
        // Populate the array with the tokens
        for (uint256 i; i < tokenIds.length; i++) {
            tokens[i] = $.tokens[tokenIds[i]];
        }
        return tokens;
    }

    /**
     * @notice Check if an address is a token manager.
     * @param _manager The address of the manager to check.
     * @param _tokenId The ID of the token to check.
     * @return bool True if the address is a token manager, false otherwise.
     */
    function isTokenManager(
        DataTypes.StargateNFTStorage storage $,
        address _manager,
        uint256 _tokenId
    ) external view returns (bool) {
        return _getTokenManager($, _tokenId) == _manager;
    }

    /**
     * @notice Check if a token is managed by the owner.
     * @param _tokenId The ID of the token to check.
     * @return bool True if the token is managed by the owner, false otherwise.
     */
    function isManagedByOwner(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId
    ) external view returns (bool) {
        // Will revert if token does not exist
        IStargateNFT(address(this)).ownerOf(_tokenId);
        // If the token has no manager, it is managed by the owner
        return $.tokenIdToManager[_tokenId] == address(0);
    }

    // ---------- Internal Functions ---------- //

    /**
     * @notice Internal function to retrieve the token IDs managed by a user.
     * @param _user The address of the user to check.
     * @return uint256[] The token IDs managed by the user.
     */
    function _idsManagedBy(
        DataTypes.StargateNFTStorage storage $,
        address _user
    ) internal view returns (uint256[] memory) {
        if (_user == address(0)) {
            revert Errors.AddressCannotBeZero();
        }
        // Get the token IDs managed by the user
        EnumerableSet.UintSet storage managedTokenIdsSet = $.managerToTokenIds[_user];

        // Get the token IDs owned by the user
        uint256[] memory ownedTokenIds = Token._idsOwnedBy(_user);
        // Get the length of the managed token IDs
        uint256 managedLen = managedTokenIdsSet.length();
        // Get the length of the owned token IDs
        uint256 ownedLen = ownedTokenIds.length;

        uint256[] memory tokenIds = new uint256[](ownedLen + managedLen);
        uint256 validCount = 0;

        // Populate the array with the managed token IDs
        for (uint256 i; i < managedLen; ) {
            tokenIds[validCount++] = managedTokenIdsSet.at(i);
            unchecked {
                ++i;
            }
        }

        // itereate over the owned token IDs and add the token IDs that are managed by the user
        for (uint256 i; i < ownedLen; ) {
            // we assume all tokens exists because we use the balanceOf function to get the token IDs
            uint256 tokenId = ownedTokenIds[i];
            // if the token manager is not set, it means the owner is managing the token
            if ($.tokenIdToManager[tokenId] == address(0)) {
                tokenIds[validCount++] = tokenId;
            }
            unchecked {
                ++i;
            }
        }

        // there might be the case that the owner of a token has a manager
        // in that case the tokenIds array might be larger than the valid count
        // so we need to trim the array
        if (validCount < tokenIds.length) {
            assembly {
                mstore(tokenIds, validCount)
            }
        }

        return tokenIds;
    }

    /**
     * @notice Internal function to get the token manager of a token.
     * Will return the owner of the token if the token is not managed by anyone.
     * @param _tokenId The ID of the token to get the manager of
     * @return tokenManager The address of the manager of the token.
     */
    function _getTokenManager(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId
    ) internal view returns (address) {
        // If token has a manager, return the token manager's address
        if ($.tokenIdToManager[_tokenId] != address(0)) {
            return $.tokenIdToManager[_tokenId];
        }

        return IStargateNFT(address(this)).ownerOf(_tokenId);
    }

    /// @notice Function to get the overview of the tokens related to a user
    /// A token is related to a user if it is owned by the user or if it is managed by the user
    /// This includes:
    /// - Tokens owned by the user and managed by the user
    /// - Tokens owned by the user and not managed by the user
    /// - Tokens managed by the user and not owned by the user
    /// @param _user The address of the user to get the overview of the tokens
    /// @return DataTypes.TokenOverview[] The overview of the tokens related to the user
    function tokensOverview(
        DataTypes.StargateNFTStorage storage $,
        address _user
    ) external view returns (DataTypes.TokenOverview[] memory) {
        if (_user == address(0)) {
            revert Errors.AddressCannotBeZero();
        }

        // Get the token IDs owned and managed by the user
        uint256[] memory ownedTokenIds = Token._idsOwnedBy(_user);
        // Get the token IDs managed by the user
        EnumerableSet.UintSet storage managedTokenIdsSet = $.managerToTokenIds[_user];
        // Get the length of the owned token IDs
        uint256 ownedLen = ownedTokenIds.length;
        // Get the length of the managed token IDs
        uint256 managedLen = managedTokenIdsSet.length();

        // Create an array to hold the token overviews
        DataTypes.TokenOverview[] memory tokenOverviews = new DataTypes.TokenOverview[](
            ownedLen + managedLen
        );
        uint256 validCount = 0;

        // Populate the array with the owned token overviews
        for (uint256 i; i < ownedLen; ) {
            // Get the manager of the token
            // we avoid using the internal function _getTokenManager to avoid the extra gas
            // from the external calls to the StargateNFT contract
            address manager = $.tokenIdToManager[ownedTokenIds[i]];
            // If the token has no manager, set the user as the manager
            if (manager == address(0)) {
                manager = _user;
            }
            uint256 tokenId = ownedTokenIds[i];
            tokenOverviews[validCount++] = DataTypes.TokenOverview({
                id: tokenId,
                owner: _user,
                manager: manager,
                levelId: $.tokens[tokenId].levelId
            });
            unchecked {
                ++i;
            }
        }

        // Populate the array with the managed token overviews
        for (uint256 i; i < managedLen; ) {
            uint256 tokenId = managedTokenIdsSet.at(i);
            tokenOverviews[validCount++] = DataTypes.TokenOverview({
                id: tokenId,
                owner: IStargateNFT(address(this)).ownerOf(tokenId),
                manager: _user,
                levelId: $.tokens[tokenId].levelId
            });
            unchecked {
                ++i;
            }
        }

        // here there is no need to trim the array because the valid count is the same as the length of the array
        // so we can return the token overviews directly
        return tokenOverviews;
    }
}
