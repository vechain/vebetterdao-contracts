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

/// @title Errors
/// @notice Centralized error definitions for the StargateNFT contract and its libraries
/// @dev This library contains all custom errors used across the StargateNFT system
library Errors {
    // ------------------ Initialization Errors ------------------ //

    /// @notice Emitted when a zero address is provided as an argument to a function that does not accept it
    error AddressCannotBeZero();

    /// @notice Thrown upon initialization of contract when a string is empty, eg token collection name or symbol
    error StringCannotBeEmpty();

    /// @notice Thrown upon initialization of contract when a value is zero, eg legacy last token ID
    error ValueCannotBeZero();

    /// @notice Thrown upon initialization of contract when a list is empty, eg token levels
    error ArrayCannotHaveZeroLength();

    // ------------------ Token Errors ------------------ //

    /// @notice The NFT is locked and cannot be transferred
    error TokenLocked();

    /// @notice Thrown upon validation of a token id, when the token id does not exist on StargateNFT
    error TokenDoesNotExist(uint256 tokenId);

    // ------------------ Level Errors ------------------ //

    /// @notice Thrown upon adding new level or when setting the supply of a level, when the circulating supply is greater than the cap
    error CirculatingSupplyGreaterThanCap();

    /// @notice Thrown upon validation of a level id, when the token level spec is not found
    error LevelNotFound(uint8 levelId);

    /// @notice Thrown upon staking, when the circulating supply has reached cap for the level
    error LevelCapReached(uint8 levelId);

    // ------------------ Mint, Migrate and Burn Errors ------------------ //

    /// @notice Thrown upon staking or migrating a token, when the tx value is not the exact amount required for the level
    error VetAmountMismatch(uint8 levelId, uint256 required, uint256 provided);

    /// @notice Thrown upon migrating or unstaking a token, when the given token id cannot be migrated or unstaked
    error TokenNotEligible(uint256 tokenId);

    /// @notice Thrown upon migrating a token, when the token is in the process of being upgraded
    error TokenNotReadyForMigration(uint256 tokenId);

    /// @notice Thrown upon unstaking a token, when the VET transfer fails
    error VetTransferFailed(address caller, uint256 amount);

    /// @notice Thrown when the caller is not the token owner
    error NotOwner(uint256 tokenId, address caller, address owner);

    /// @notice Thrown upon unstaking a token, when the contract does not have enough VET to transfer to the caller
    error InsufficientContractBalance(uint256 contractBalance, uint256 tokenAmount);

    /// @notice Thrown at the end of the migration process, when contracts are not in the expected state
    error TokenMigrationFailed(uint256 tokenId);

    /// @notice Thrown when the token minting fails
    error TokenMintingFailed();

    // ------------------ Authorization Errors ------------------ //

    /// @notice The caller is not authorized to call the function
    error UnauthorizedCaller(address caller);

    // ------------------ VTHO Rewards Errors ------------------ //

    /// @notice Thrown when VTHO token transfer fails during claiming rewards
    error VthoTransferFailed();

    /// @notice Thrown when the token is not staking VET
    error NotStakingVet(uint256 tokenId);

    /// @notice Thrown when the token has no VTHO rewards to claim
    error NoBaseVthoRewardsToClaim(uint256 tokenId);

    // ------------------ Circulating Supply Errors ------------------ //

    /// @notice Thrown when the block number is in the future
    error BlockInFuture();
}
