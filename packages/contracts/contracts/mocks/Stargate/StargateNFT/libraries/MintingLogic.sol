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

import {DataTypes} from "./DataTypes.sol";
import {Token} from "./Token.sol";
import {Clock} from "./Clock.sol";
import {IStargateNFT} from "../../interfaces/IStargateNFT.sol";
import {Errors} from "./Errors.sol";
import {VetGeneratedVtho} from "./VetGeneratedVtho.sol";
import {Levels} from "./Levels.sol";

/// @title MintingLogic
/// @notice Library for the StargateNFT contract to stake VET and mint NFTs, migrate tokens from the legacy nodes contract,
/// to burn the NFTs and unstake the VET.
/// @dev Migration strategy:
/// Instead of setting the cap to 300 + another fixed value for reserved spots (eg: 60), we set the cap directly to 240.
/// When calling "stake" (so new users are minting) the cap cannot be exceeded.
/// When calling "migrate" (so legacy users are migrating) we increase the cap (so it will become 241).
/// Eg: for x nodes the cap is 0, which means no one can mint a xnode, but every time a user migrates the cap and circulating supply is increased by 1 for that x level.
/// By doing this we can also preserve the token ids: since we know the totalSupply of legacy nodes we can just say that all new nodes will start from previousTotalSupply + 1,
/// while all migrated nodes will have their original token id.
library MintingLogic {
    // ------------------ Events ------------------ //

    /// @notice Emitted when an NFT is minted
    event TokenMinted(
        address indexed owner,
        uint8 indexed levelId,
        bool indexed migrated,
        uint256 tokenId,
        uint256 vetAmountStaked
    );

    /// @notice Emitted when an NFT is burned
    event TokenBurned(
        address indexed owner,
        uint8 indexed levelId,
        uint256 tokenId,
        uint256 vetAmountStaked
    );

    // ------------------ Setters ------------------ //

    /// @notice Stakes VET and mints an NFT
    /// @param _levelId The ID of the token level to mint, VET as msg.value
    /// @return tokenId The ID of the minted NFT
    function stake(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId
    ) external returns (uint256 tokenId) {
        return _stake($, _levelId);
    }

    /// @notice Stakes VET and mints an NFT, and calls the StargateDelegation contract to delegate the token.
    /// This way the user can do both actions in a single transaction, without having to call the StargateDelegation contract separately.
    /// @param _levelId The ID of the token level to mint, VET as msg.value
    /// @param _autorenew Whether the token should be delegated forever
    /// @return tokenId The ID of the minted NFT
    function stakeAndDelegate(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        bool _autorenew
    ) external returns (uint256 tokenId) {
        // Stake the token
        tokenId = _stake($, _levelId);

        // Check if the owner changed in the stake process, if yes revert
        // (Eg: receiver is a smart contract with onERC721Received() fallback that transfers the NFT)
        address owner = IStargateNFT(address(this)).ownerOf(tokenId);
        if (owner != msg.sender) {
            revert Errors.NotOwner(tokenId, msg.sender, owner);
        }

        // Delegate the token
        $.stargateDelegation.delegate(tokenId, _autorenew);

        return tokenId;
    }

    /// @notice Migrates a token from the legacy nodes contract to StargateNFT, preserving the tokenId
    /// @param _tokenId The ID of the token to migrate
    function migrate(DataTypes.StargateNFTStorage storage $, uint256 _tokenId) external {
        return _migrate($, _tokenId);
    }

    /// @notice Migrates a token from the legacy nodes contract to StargateNFT, and calls the
    /// StargateDelegation contract to delegate the token. This way the user can do both actions
    /// in a single transaction, without having to call the StargateDelegation contract separately.
    /// @param _tokenId The ID of the token to migrate
    /// @param _autorenew Whether the token should be delegated forever
    function migrateAndDelegate(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId,
        bool _autorenew
    ) external {
        // Migrate the token
        _migrate($, _tokenId);

        // Check if the owner changed in the migration process, if yes revert
        // (Eg: receiver is a smart contract with onERC721Received() fallback that transfers the NFT)
        address owner = IStargateNFT(address(this)).ownerOf(_tokenId);
        if (owner != msg.sender) {
            // will revert if token owner changed during migrate proccess
            revert Errors.NotOwner(_tokenId, msg.sender, owner);
        }

        // Delegate the token
        $.stargateDelegation.delegate(_tokenId, _autorenew);
    }

    /// @notice Unstakes a token and returns the VET to the owner
    /// @dev If the token has pending VTHO rewards, claim them
    /// @param _tokenId The ID of the token to unstake
    function unstake(DataTypes.StargateNFTStorage storage $, uint256 _tokenId) external {
        // Get token, will revert if token does not exist
        DataTypes.Token memory token = Token._getToken($, _tokenId);

        // Validate token is staked and not delegated
        // - if the vet amount is 0, it is not staked
        // - if the delegation is active, it has not requested exit or is exiting
        // If any of these conditions are true, revert
        if (token.vetAmountStaked == 0 || $.stargateDelegation.isDelegationActive(_tokenId)) {
            revert Errors.TokenNotEligible(_tokenId);
        }

        // Validate the caller is the token owner
        address owner = IStargateNFT(address(this)).ownerOf(_tokenId);
        if (owner != msg.sender) {
            revert Errors.NotOwner(_tokenId, msg.sender, owner);
        }

        // Validate the contract has enough VET to transfer to the caller
        if (address(this).balance < token.vetAmountStaked) {
            revert Errors.InsufficientContractBalance(address(this).balance, token.vetAmountStaked);
        }

        // Burn the token (it will also claim any pending VTHO rewards)
        IStargateNFT(address(this))._burnCallback(_tokenId);

        // Clean up token state
        delete $.tokens[_tokenId];
        delete $.maturityPeriodEndBlock[_tokenId];

        // Update circulating supply, update cap if token is X
        Levels._decrementLevelCirculatingSupply($, token.levelId);
        if ($.levels[token.levelId].isX) {
            $.cap[token.levelId]--;
        }

        // Return VET to caller
        (bool success, ) = owner.call{value: token.vetAmountStaked}("");
        if (!success) {
            revert Errors.VetTransferFailed(owner, token.vetAmountStaked);
        }

        // Emit event
        // solhint-disable-next-line reentrancy -  This function is secure against reentrancy
        emit TokenBurned(owner, token.levelId, _tokenId, token.vetAmountStaked);
    }

    // ------------------ Internal ------------------ //

    /// @dev Internal function for {stake} and {stakeAndDelegate}
    function _stake(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId
    ) internal returns (uint256 tokenId) {
        // Get token level spec (reverts if not found)
        DataTypes.Level memory level = Levels._getLevel($, _levelId);

        // Validate level circulating supply has not reached cap
        if (Levels._getCirculatingSupply($, _levelId) >= $.cap[_levelId]) {
            revert Errors.LevelCapReached(_levelId);
        }

        // Validate staking amount, ie msg.value
        // is the exact amount needed for a specific NFT tier (no more, no less)
        if (msg.value != level.vetAmountRequiredToStake) {
            revert Errors.VetAmountMismatch(_levelId, level.vetAmountRequiredToStake, msg.value);
        }

        // Update token ID
        $.currentTokenId++;
        tokenId = $.currentTokenId;

        // Update the circulating supply
        Levels._incrementLevelCirculatingSupply($, _levelId);

        // Update tokens mapping
        $.tokens[tokenId] = DataTypes.Token({
            tokenId: tokenId,
            levelId: _levelId,
            mintedAtBlock: Clock._clock(),
            vetAmountStaked: msg.value,
            lastVthoClaimTimestamp: Clock._timestamp()
        });

        // Update the maturity period end block
        $.maturityPeriodEndBlock[tokenId] = Clock._clock() + level.maturityBlocks;

        // Call the mint callback on the main contract to mint the NFT
        IStargateNFT(address(this))._safeMintCallback(msg.sender, tokenId);

        // solhint-disable-next-line reentrancy -  Allow emiting event after callback
        emit TokenMinted(msg.sender, _levelId, false, tokenId, msg.value);

        return tokenId;
    }

    /// @dev Internal function used by {migrate} and {migrateAndDelegate}
    /// @dev Refer to the migration strategy written at the top of the file
    function _migrate(DataTypes.StargateNFTStorage storage $, uint256 _tokenId) internal {
        // Validate token is not migrated yet
        // - if token level ID is not 0, it already exists on StargateNFT
        // - if token owner is 0, it does not exist in legacy nodes contract - burned or not minted
        // If any of these conditions are true, revert
        if ($.tokens[_tokenId].levelId != 0 || $.legacyNodes.idToOwner(_tokenId) == address(0)) {
            revert Errors.TokenNotEligible(_tokenId);
        }

        // Get and validate token metadata
        // slither-disable-next-line unused-return -- Intentional truncation
        (
            address owner,
            uint8 level,
            bool onUpgrade,
            bool isOnAuction,
            uint64 lastTransferTime,
            ,

        ) = $.legacyNodes.getMetadata(_tokenId);

        // Validate the status of the token on legacy nodes contract
        // - if the token is on upgrade, it cannot be migrated
        // - if the token is on auction, it cannot be migrated
        // - if the token is not ready to be destroyed, it cannot be migrated
        if (
            onUpgrade ||
            isOnAuction ||
            Clock._timestamp() < lastTransferTime + $.legacyNodes.leadTime()
        ) {
            revert Errors.TokenNotReadyForMigration(_tokenId);
        }

        // Validate caller is token owner
        if (owner != msg.sender) {
            revert Errors.NotOwner(_tokenId, msg.sender, owner);
        }

        // Validate msg.value is the exact amount required for the level
        uint256 vetAmountRequiredToStake = Levels._getLevel($, level).vetAmountRequiredToStake;
        if (msg.value != vetAmountRequiredToStake) {
            revert Errors.VetAmountMismatch(level, vetAmountRequiredToStake, msg.value);
        }

        // Update the circulating supply and the cap
        Levels._incrementLevelCirculatingSupply($, level);
        $.cap[level]++;

        // Update tokens mapping
        $.tokens[_tokenId] = DataTypes.Token({
            tokenId: _tokenId,
            levelId: level,
            mintedAtBlock: Clock._clock(),
            vetAmountStaked: msg.value,
            lastVthoClaimTimestamp: Clock._timestamp()
        });

        // Update the maturity period end block
        // Note: maturity period is not applied to migrated tokens
        $.maturityPeriodEndBlock[_tokenId] = Clock._clock();

        // Destroy the token in the legacy nodes contract
        $.legacyNodes.downgradeTo(_tokenId, 0);

        // Call the mint callback on the main contract to mint the NFT
        IStargateNFT(address(this))._safeMintCallback(msg.sender, _tokenId);

        // Verify after
        // - if the token level ID on StargateNFT is zero, ie minting failed
        // - if the token owner on legacy nodes contract is not the address zero, ie token was not burned
        if ($.tokens[_tokenId].levelId == 0 || $.legacyNodes.idToOwner(_tokenId) != address(0)) {
            revert Errors.TokenMigrationFailed(_tokenId);
        }

        // solhint-disable-next-line reentrancy -  Allow emitting event after callback
        emit TokenMinted(msg.sender, level, true, _tokenId, msg.value);
    }
}
