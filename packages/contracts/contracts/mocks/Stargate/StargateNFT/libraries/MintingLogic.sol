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
import { Token } from "./Token.sol";
import { Clock } from "./Clock.sol";
import { IStargateNFT } from "../../interfaces/IStargateNFT.sol";
import { Errors } from "./Errors.sol";
import { Levels } from "./Levels.sol";
import { IStargate } from "../../interfaces/IStargate.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
/// ------------------ Version 3 ------------------ //
/// - When unstaking, if the token has VET held by the protocol, we transfer them to this contract by interacting with the Hayabysa Stargate contract
/// - Removed the _autorenew parameter from stakeAndDelegate and migrateAndDelegate, since it is not needed anymore
/// - Added the _validator parameter to stakeAndDelegate and migrateAndDelegate, since it is now required to delegate the token
/// - Interact with the Stargate contract to delegate the token instead of the StargateDelegation contract
/// - Removed the migrate function, since we want to enfore entering the delegation
/// - moved the following functions to the Stargate contract:
///   - stake
///   - unstake
///   - stakeAndDelegate
///   - migrateAndDelegate
/// - added a new mint method that mints a new nft without checking the msg.value
/// - added a new burn method that burns a token without checking the msg.value
library MintingLogic {
    using EnumerableSet for EnumerableSet.UintSet;
    using SafeERC20 for IERC20;

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

    /**
     * @notice Emitted when a whitelist entry is removed
     * @param owner The address of the whitelist entry
     */
    event WhitelistEntryRemoved(address owner);

    /// @notice Emitted when a token maturity period is boosted
    event MaturityPeriodBoosted(
        uint256 indexed tokenId,
        address indexed paidBy,
        uint256 paidAmount,
        uint256 boostedBlocks
    );

    // ------------------ Setters ------------------ //

    /// @notice Mints an NFT
    /// @param _levelId The ID of the token level to mint
    /// @param _to The address to mint the NFT to
    /// @return tokenId The ID of the minted NFT
    function mint(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        address _to
    ) external returns (uint256 tokenId) {
        return _mint($, _levelId, _to);
    }

    function burn(DataTypes.StargateNFTStorage storage $, uint256 _tokenId) external {
        _burn($, _tokenId);
    }

    function boostOnBehalfOf(
        DataTypes.StargateNFTStorage storage $,
        address _sender,
        uint256 _tokenId
    ) external {
        // check that the token is not already boosted
        if ($.maturityPeriodEndBlock[_tokenId] <= Clock._clock()) {
            revert Errors.MaturityPeriodEnded(_tokenId);
        }

        uint256 requiredBoostAmount = _boostAmount($, _tokenId);

        uint256 balance = $.vthoToken.balanceOf(_sender);
        // check that the boost amount is enough
        if ($.vthoToken.balanceOf(_sender) < requiredBoostAmount) {
            revert Errors.InsufficientBalance(
                address($.vthoToken),
                _sender,
                requiredBoostAmount,
                balance
            );
        }

        // check the allowance
        uint256 allowance = $.vthoToken.allowance(_sender, address(this));
        if (allowance < requiredBoostAmount) {
            revert Errors.InsufficientAllowance(
                _sender,
                address(this),
                allowance,
                requiredBoostAmount
            );
        }

        // get the boosted blocks
        uint256 boostedBlocks = $.maturityPeriodEndBlock[_tokenId] - Clock._clock();
        // set the maturity period end block
        $.maturityPeriodEndBlock[_tokenId] = Clock._clock();

        // burn the VTHO boost amount by transferring to a address(0)
        $.vthoToken.safeTransferFrom(_sender, address(0), requiredBoostAmount);

        // emit the event
        emit MaturityPeriodBoosted(_tokenId, _sender, requiredBoostAmount, boostedBlocks);
    }

    /// @notice Returns the amount of VET required to boost a token's maturity period
    /// @param _tokenId The ID of the token to boost
    /// @return boostAmount The amount of VET required to boost the token's maturity period
    function boostAmount(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId
    ) external view returns (uint256) {
        return _boostAmount($, _tokenId);
    }

    /// @notice Migrates a token from the legacy nodes contract to StargateNFT, and calls the
    /// Stargate contract to delegate the token. This way the user can do both actions
    /// in a single transaction, without having to call the Stargate contract separately.
    /// @param _tokenId The ID of the token to migrate
    function migrate(DataTypes.StargateNFTStorage storage $, uint256 _tokenId) external {
        // Migrate the token
        _migrate($, _tokenId);
    }

    // ------------------ Internal ------------------ //
    /// @dev Internal function for {mint}
    function _mint(
        DataTypes.StargateNFTStorage storage $,
        uint8 _levelId,
        address _to
    ) internal returns (uint256 tokenId) {
        // Get token level spec (reverts if not found)
        DataTypes.Level memory level = Levels._getLevel($, _levelId);

        // Validate level circulating supply has not reached cap
        if (Levels._getCirculatingSupply($, _levelId) >= $.cap[_levelId]) {
            revert Errors.LevelCapReached(_levelId);
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
            vetAmountStaked: level.vetAmountRequiredToStake,
            lastVetGeneratedVthoClaimTimestamp_deprecated: Clock._timestamp()
        });

        // Update the maturity period end block
        $.maturityPeriodEndBlock[tokenId] = Clock._clock() + level.maturityBlocks;

        // Call the mint callback on the main contract to mint the NFT
        IStargateNFT(address(this))._safeMintCallback(_to, tokenId);

        // solhint-disable-next-line reentrancy -  Allow emiting event after callback
        emit TokenMinted(_to, _levelId, false, tokenId, level.vetAmountRequiredToStake);

        return tokenId;
    }

    function _burn(DataTypes.StargateNFTStorage storage $, uint256 _tokenId) internal {
        // Get token, will revert if token does not exist
        DataTypes.Token memory token = Token._getToken($, _tokenId);

        // Get the owner of the token
        address owner = IStargateNFT(address(this)).ownerOf(_tokenId);
        // Burn the token
        IStargateNFT(address(this))._burnCallback(_tokenId);
        // here we are already calling the _burnCallback which
        // calls _burn and calls _update, the manager is already removed
        // in the _update function

        // Clean up token state
        delete $.tokens[_tokenId];
        delete $.maturityPeriodEndBlock[_tokenId];

        // Update circulating supply, update cap if token is X
        Levels._decrementLevelCirculatingSupply($, token.levelId);
        if ($.levels[token.levelId].isX) {
            $.cap[token.levelId]--;
        }
        // Emit event
        // solhint-disable-next-line reentrancy -  This function is secure against reentrancy
        emit TokenBurned(owner, token.levelId, _tokenId, token.vetAmountStaked);
    }

    /// @dev Internal function used by {migrate} and {migrateAndDelegate}
    /// @dev Refer to the migration strategy written at the top of the file
    function _migrate(DataTypes.StargateNFTStorage storage $, uint256 _tokenId) internal {
        // Validate tokenId is not 0
        if (_tokenId == 0) {
            revert Errors.ValueCannotBeZero();
        }

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
        // assume the msg.value is the exact amount required for the level
        uint256 vetAmountRequiredToStake = Levels._getLevel($, level).vetAmountRequiredToStake;

        // Update the circulating supply and the cap
        Levels._incrementLevelCirculatingSupply($, level);
        $.cap[level]++;

        // Update tokens mapping
        $.tokens[_tokenId] = DataTypes.Token({
            tokenId: _tokenId,
            levelId: level,
            mintedAtBlock: Clock._clock(),
            vetAmountStaked: vetAmountRequiredToStake,
            lastVetGeneratedVthoClaimTimestamp_deprecated: Clock._timestamp()
        });

        // Update the maturity period end block
        // Note: maturity period is not applied to migrated tokens
        $.maturityPeriodEndBlock[_tokenId] = Clock._clock();

        // Destroy the token in the legacy nodes contract
        $.legacyNodes.downgradeTo(_tokenId, 0);

        // Call the mint callback on the main contract to mint the NFT
        IStargateNFT(address(this))._safeMintCallback(owner, _tokenId);

        // Verify after
        // - if the token level ID on StargateNFT is zero, ie minting failed
        // - if the token owner on legacy nodes contract is not the address zero, ie token was not burned
        if ($.tokens[_tokenId].levelId == 0 || $.legacyNodes.idToOwner(_tokenId) != address(0)) {
            revert Errors.TokenMigrationFailed(_tokenId);
        }

        // solhint-disable-next-line reentrancy -  Allow emitting event after callback
        emit TokenMinted(owner, level, true, _tokenId, vetAmountRequiredToStake);
    }

    function _boostAmount(
        DataTypes.StargateNFTStorage storage $,
        uint256 _tokenId
    ) internal view returns (uint256) {
        // get the maturity period end block
        uint64 maturityPeriodEndBlock = $.maturityPeriodEndBlock[_tokenId];
        // if the token is already matured, the boost amount is 0
        if (Clock._clock() > maturityPeriodEndBlock) {
            return 0;
        }
        // calculate the boost amount
        return
            (maturityPeriodEndBlock - Clock._clock()) *
            $.boostPricePerBlock[$.tokens[_tokenId].levelId];
    }
}
