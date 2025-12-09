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

import { Checkpoints } from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import { Clock } from "./Clock.sol";
import { DataTypes } from "./DataTypes.sol";
import { Errors } from "./Errors.sol";

/// @title Levels
/// @notice Library for the StargateNFT contract to manage token levels
library Levels {
    using Checkpoints for Checkpoints.Trace208;

    // ------------------ Events ------------------ //

    /**
     * @notice Emitted when a token level is updated
     * @param levelId The ID of the level that was updated
     * @param name The new name of the level
     * @param isX The new X status
     * @param maturityBlocks The new maturity period in blocks
     * @param scaledRewardFactor The new scaled reward multiplier
     * @param vetAmountRequiredToStake The new VET amount required for staking
     */
    event LevelUpdated(
        uint8 indexed levelId,
        string name,
        bool isX,
        uint64 maturityBlocks,
        uint64 scaledRewardFactor,
        uint256 vetAmountRequiredToStake
    );

    /**
     * @notice Emitted when the circulating supply of a token level is updated
     * @param levelId The ID of the level supply that was updated
     * @param oldCirculatingSupply The old circulating supply
     * @param newCirculatingSupply The new circulating supply
     */
    event LevelCirculatingSupplyUpdated(
        uint8 indexed levelId,
        uint208 oldCirculatingSupply,
        uint208 newCirculatingSupply
    );

    /**
     * @notice Emitted when the cap of a token level is updated
     * @param levelId The ID of the level cap that was updated
     * @param oldCap The old cap
     * @param newCap The new cap
     */
    event LevelCapUpdated(uint8 indexed levelId, uint32 oldCap, uint32 newCap);

    /**
     * @notice Emitted when the boost price per block of a token level is updated
     * @param levelId The ID of the level boost price per block that was updated
     * @param oldBoostPricePerBlock The old boost price per block
     * @param newBoostPricePerBlock The new boost price per block
     */
    event LevelBoostPricePerBlockUpdated(
        uint8 indexed levelId,
        uint256 oldBoostPricePerBlock,
        uint256 newBoostPricePerBlock
    );

    // ------------------ Setters ------------------ //

    /// @notice Adds a new token level
    /// @param _levelAndSupply - The level and supply to add, see {DataTypes.LevelAndSupply}
    /// @dev A new level is valid if:
    /// - the id is consecutive to the last level id (We do not care about the level id in the input)
    /// - name is not empty
    /// - vetAmountRequiredToStake is greater than 0
    /// - circulatingSupply is not greater than cap
    /// Emits a {IStargateNFT.LevelUpdated} event
    /// Emits a {IStargateNFT.LevelCirculatingSupplyUpdated} event
    /// Emits a {IStargateNFT.LevelCapUpdated} event
    function addLevel(
        DataTypes.StargateNFTStorage storage $,
        DataTypes.LevelAndSupply memory _levelAndSupply
    ) external {
        // Increment MAX_LEVEL_ID
        $.MAX_LEVEL_ID++;

        // Override level ID to be the new MAX_LEVEL_ID (We do not care about the level id in the input)
        _levelAndSupply.level.id = $.MAX_LEVEL_ID;

        // Validate level fields
        _validateLevel(_levelAndSupply.level);

        // Validate supply
        if (_levelAndSupply.circulatingSupply > _levelAndSupply.cap) {
            revert Errors.CirculatingSupplyGreaterThanCap();
        }

        // Add new level to storage
        $.levels[_levelAndSupply.level.id] = _levelAndSupply.level;
        _checkpointLevelCirculatingSupply(
            $,
            _levelAndSupply.level.id,
            _levelAndSupply.circulatingSupply
        );
        $.cap[_levelAndSupply.level.id] = _levelAndSupply.cap;

        emit LevelUpdated(
            _levelAndSupply.level.id,
            _levelAndSupply.level.name,
            _levelAndSupply.level.isX,
            _levelAndSupply.level.maturityBlocks,
            _levelAndSupply.level.scaledRewardFactor,
            _levelAndSupply.level.vetAmountRequiredToStake
        );
        emit LevelCirculatingSupplyUpdated($.MAX_LEVEL_ID, 0, _levelAndSupply.circulatingSupply);
        emit LevelCapUpdated($.MAX_LEVEL_ID, 0, _levelAndSupply.cap);
    }

    /// @notice Updates a token level
    /// @param _levelId - The ID of the level to update
    /// @param _name - The name of the level
    /// @param _isX - Whether the level is an X level
    /// @param _maturityBlocks - The number of blocks before the level can earn rewards
    /// @param _scaledRewardFactor - The scaled reward multiplier for the level
    /// @param _vetAmountRequiredToStake - The amount of VET required to stake for the level
    /// @dev Only the LEVEL_OPERATOR_ROLE can call this function
    /// Use carefully, all fields are updated,
    /// if you want to update only some fields, fetch the level first, then update the fields you need to change
    /// A new level is valid if:
    /// - the id exists
    /// - name is not empty
    /// - vetAmountRequiredToStake is greater than 0
    /// Emits a {IStargateNFT.LevelUpdated} event
    function updateLevel(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        string memory _name,
        bool _isX,
        uint64 _maturityBlocks,
        uint64 _scaledRewardFactor,
        uint256 _vetAmountRequiredToStake
    ) external {
        _updateLevel(
            $,
            _levelId,
            _name,
            _isX,
            _maturityBlocks,
            _scaledRewardFactor,
            _vetAmountRequiredToStake
        );
    }

    /// @notice Updates the cap for a token level
    /// @param _levelId - The ID of the level to update
    /// @param _cap - The new cap for the level
    /// @dev Only the LEVEL_OPERATOR_ROLE can call this function
    /// Emits a {IStargateNFT.LevelCapUpdated} event
    function updateLevelCap(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        uint32 _cap
    ) external {
        _updateLevelCap($, _levelId, _cap);
    }

    /// @notice Updates the boost price per block for a token level
    /// @param _levelId - The ID of the level to update
    /// @param _boostPricePerBlock - The new boost price per block for the level
    /// @dev Only the LEVEL_OPERATOR_ROLE can call this function
    /// Emits a {IStargateNFT.LevelBoostPricePerBlockUpdated} event
    function updateLevelBoostPricePerBlock(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        uint256 _boostPricePerBlock
    ) external {
        _updateLevelBoostPricePerBlock($, _levelId, _boostPricePerBlock);
    }

    // ------------------ Getters ------------------ //

    function getLevelIds(
        DataTypes.StargateNFTStorage storage $
    ) external view returns (uint8[] memory) {
        return _getLevelIds($);
    }

    /// @notice Returns the level details for a given level ID
    /// @param _levelId The ID of the level to return
    /// @return level The level details
    function getLevel(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId
    ) external view returns (DataTypes.Level memory) {
        return _getLevel($, _levelId);
    }

    /// @notice Returns a list of all level details
    /// @return levels A list of all level details
    function getLevels(
        DataTypes.StargateNFTStorage storage $
    ) external view returns (DataTypes.Level[] memory) {
        DataTypes.Level[] memory levels = new DataTypes.Level[]($.MAX_LEVEL_ID);
        for (uint8 i; i < $.MAX_LEVEL_ID; i++) {
            levels[i] = _getLevel($, i + 1);
        }
        return levels;
    }

    /// @notice Returns the circulating supply for all levels
    /// @return circulatingSupplies An array of circulating supply values for all levels, sorted by level id
    function getLevelsCirculatingSupplies(
        DataTypes.StargateNFTStorage storage $
    ) external view returns (uint208[] memory) {
        uint208[] memory circulatingSupplies = new uint208[]($.MAX_LEVEL_ID);
        for (uint8 i; i < $.MAX_LEVEL_ID; i++) {
            circulatingSupplies[i] = _getCirculatingSupply($, i + 1);
        }
        return circulatingSupplies;
    }

    /// @notice Returns the circulating supply and cap for a given level
    /// @param _levelId The ID of the level to get supply data for
    /// @return circulating The circulating supply of the level
    /// @return cap The cap of the level
    function getLevelSupply(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId
    ) external view returns (uint208 circulating, uint32 cap) {
        // Validate level exists
        if (!_levelExists($, $.levels[_levelId].id)) {
            revert Errors.LevelNotFound(_levelId);
        }

        circulating = _getCirculatingSupply($, _levelId);
        cap = $.cap[_levelId];
    }

    /// @notice Returns the circulating supply for a given level at a specific block
    /// @param _levelId The ID of the level to get supply data for
    /// @param _blockNumber The block number to get the supply at
    /// @return circulatingSupply The circulating supply of the level at the specified block
    function getCirculatingSupplyAtBlock(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        uint48 _blockNumber
    ) external view returns (uint208) {
        return _getCirculatingSupplyAtBlock($, _levelId, _blockNumber);
    }

    /// @notice Returns the circulating supply for all levels at a certain block
    /// @param _blockNumber The block number to get the supply at
    /// @return circulatingSupplies An array of circulating supply values for all levels, sorted by level id
    function getLevelsCirculatingSuppliesAtBlock(
        DataTypes.StargateNFTStorage storage $,
        uint48 _blockNumber
    ) external view returns (uint208[] memory) {
        uint208[] memory circulatingSupplies = new uint208[]($.MAX_LEVEL_ID);
        for (uint8 i; i < $.MAX_LEVEL_ID; i++) {
            circulatingSupplies[i] = _getCirculatingSupplyAtBlock($, i + 1, _blockNumber);
        }
        return circulatingSupplies;
    }

    // ------------------ Internal functions ------------------ //

    /// @dev This is a helper function to validate the level details
    /// @param _level The level to validate
    function _validateLevel(DataTypes.Level memory _level) internal pure {
        // Name cannot be empty
        if (bytes(_level.name).length == 0) {
            revert Errors.StringCannotBeEmpty();
        }

        // VET amount required to stake must be greater than 0 for all levels except level 0
        if (_level.vetAmountRequiredToStake == 0) {
            revert Errors.ValueCannotBeZero();
        }
    }

    /// @dev See {updateLevel}
    function _updateLevel(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        string memory _name,
        bool _isX,
        uint64 _maturityBlocks,
        uint64 _scaledRewardFactor,
        uint256 _vetAmountRequiredToStake
    ) internal {
        // Validate level exists
        if (!_levelExists($, $.levels[_levelId].id)) {
            revert Errors.LevelNotFound(_levelId);
        }

        $.levels[_levelId].name = _name;
        $.levels[_levelId].isX = _isX;
        $.levels[_levelId].maturityBlocks = _maturityBlocks;
        $.levels[_levelId].scaledRewardFactor = _scaledRewardFactor;
        $.levels[_levelId].vetAmountRequiredToStake = _vetAmountRequiredToStake;

        // Validate level fields
        _validateLevel($.levels[_levelId]);

        emit LevelUpdated(
            _levelId,
            _name,
            _isX,
            _maturityBlocks,
            _scaledRewardFactor,
            _vetAmountRequiredToStake
        );
    }

    /// @dev See {updateLevelBoostPricePerBlock}
    function _updateLevelBoostPricePerBlock(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        uint256 _boostPricePerBlock
    ) internal {
        // Validate level exists
        if (!_levelExists($, $.levels[_levelId].id)) {
            revert Errors.LevelNotFound(_levelId);
        }

        emit LevelBoostPricePerBlockUpdated(
            _levelId,
            $.boostPricePerBlock[_levelId],
            _boostPricePerBlock
        );
        $.boostPricePerBlock[_levelId] = _boostPricePerBlock;
    }

    /// @dev See {updateLevelCap}
    function _updateLevelCap(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        uint32 _cap
    ) internal {
        // Validate level exists
        if (!_levelExists($, $.levels[_levelId].id)) {
            revert Errors.LevelNotFound(_levelId);
        }

        // Validate new cap is greater than or equal to current circulating supply
        if (_getCirculatingSupply($, _levelId) > _cap) {
            revert Errors.CirculatingSupplyGreaterThanCap();
        }

        // Update cap
        emit LevelCapUpdated(_levelId, $.cap[_levelId], _cap);
        $.cap[_levelId] = _cap;
    }

    /// @dev See {getLevelIds}
    function _getLevelIds(
        DataTypes.StargateNFTStorage storage $
    ) internal view returns (uint8[] memory) {
        uint8[] memory levelIds = new uint8[]($.MAX_LEVEL_ID);
        for (uint8 i; i < $.MAX_LEVEL_ID; i++) {
            levelIds[i] = i + 1;
        }
        return levelIds;
    }

    /// @dev See {getLevel}
    function _getLevel(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId
    ) internal view returns (DataTypes.Level memory) {
        // Get token level spec
        DataTypes.Level memory level = $.levels[_levelId];

        // Validate level exists
        if (!_levelExists($, level.id)) {
            revert Errors.LevelNotFound(_levelId);
        }

        return level;
    }

    /// @dev This is a helper function to get the latest circulating supply snapshot for the given level
    /// @param _levelId The ID of the level to get the circulating supply for
    /// @return circulatingSupply The latest/current circulating supply snapshot for the level
    function _getCirculatingSupply(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId
    ) internal view returns (uint208) {
        return $.circulatingSupply[_levelId].latest();
    }

    /// @dev See {getCirculatingSupplyAtBlock}
    function _getCirculatingSupplyAtBlock(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        uint48 _blockNumber
    ) internal view returns (uint208) {
        if (!_levelExists($, $.levels[_levelId].id)) {
            revert Errors.LevelNotFound(_levelId);
        }

        if (_blockNumber > Clock._clock()) {
            revert Errors.BlockInFuture();
        }

        return $.circulatingSupply[_levelId].upperLookupRecent(_blockNumber);
    }

    /// @dev This is a helper function to check if a level spec exists
    /// @param _levelId The ID of the level spec to check
    /// @return true if the level spec exists, false otherwise
    function _levelExists(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId
    ) internal view returns (bool) {
        return _levelId > 0 && _levelId <= $.MAX_LEVEL_ID;
    }

    /// @dev This is a helper function to increment the circulating supply for a given level
    /// Will get the most recent circulating supply snapshot, and increment it by 1
    /// Then checkpoint the new circulating supply
    /// @param _levelId The ID of the level to increment the circulating supply for
    function _incrementLevelCirculatingSupply(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId
    ) internal {
        uint208 circulatingSupply = _getCirculatingSupply($, _levelId);
        _checkpointLevelCirculatingSupply($, _levelId, circulatingSupply + 1);
    }

    /// @dev This is a helper function to decrement the circulating supply for a given level
    /// Will get the most recent circulating supply snapshot, and decrement it by 1
    /// Then checkpoint the new circulating supply
    /// @param _levelId The ID of the level to decrement the circulating supply for
    function _decrementLevelCirculatingSupply(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId
    ) internal {
        uint208 circulatingSupply = _getCirculatingSupply($, _levelId);
        _checkpointLevelCirculatingSupply($, _levelId, circulatingSupply - 1);
    }

    /// @dev This is a helper function to checkpoint the circulating supply for a given level
    /// @param _levelId The ID of the level to checkpoint the circulating supply for
    /// @param _circulatingSupply The circulating supply to checkpoint
    function _checkpointLevelCirculatingSupply(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        uint208 _circulatingSupply
    ) internal {
        $.circulatingSupply[_levelId].push(Clock._clock(), _circulatingSupply);
    }
}
