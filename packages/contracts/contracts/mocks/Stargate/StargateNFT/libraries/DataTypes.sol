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

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import {ITokenAuction} from "../../interfaces/ITokenAuction.sol";
import {IStargateDelegation} from "../../interfaces/IStargateDelegation.sol";

/// @title DataTypes
/// @notice Library for the StargateNFT contract to store data structure definitions used across the contract and libraries
library DataTypes {
    using Checkpoints for Checkpoints.Trace208;

    struct StargateNFTStorage {
        uint48 vthoGenerationEndTimestamp; // this is the timestamp (in seconds) when the protocol will stop generating VTHO by holding VET
        uint8 MAX_LEVEL_ID; // Maximum level ID
        ITokenAuction legacyNodes; // TokenAuction contract
        IStargateDelegation stargateDelegation; // StargateDelegation contract
        IERC20 vthoToken; // VTHO token contract
        uint256 currentTokenId; // Token tracking: Current token ID
        string baseTokenURI; // Base URI for the token metadata
        mapping(uint8 levelId => Level) levels; // Token levels management: Mapping level ID to token level details
        mapping(uint8 levelId => Checkpoints.Trace208) circulatingSupply; // Token levels management: Mapping level ID to circulating supply
        mapping(uint8 levelId => uint32) cap; // Token levels management: Mapping level ID to cap aka max supply
        mapping(uint256 tokenId => Token) tokens; // Token tracking: Mapping token ID to token
        mapping(uint256 tokenId => uint64) maturityPeriodEndBlock; // Token tracking: Maturity period end block
    }

    struct StargateNFTInitParams {
        string tokenCollectionName; // ERC721 token collection name
        string tokenCollectionSymbol; // ERC721 token collection symbol
        string baseTokenURI; // Base URI for the token metadata
        address admin; // Access control: Default admin address
        address upgrader; // Access control: Upgrader address
        address pauser; // Access control: Pauser address
        address levelOperator; // Access control: Level operator address
        address legacyNodes; // Address of the legacy TokenAuction contract
        address stargateDelegation; // Address of the stargate delegation contract
        address vthoToken; // Address of the VTHO token contract
        uint256 legacyLastTokenId; // Last token ID minted in the legacy TokenAuction contract when the snapshot was taken
        LevelAndSupply[] levelsAndSupplies; // A list of levels and their supply
    }

    struct Level {
        string name; // Name of the level (e.g., "Thunder", "Mjolnir")
        bool isX; // Whether the level is for X-tokens
        uint8 id; // ID to identify the level, as a continuation of the legacy strength levels
        uint64 maturityBlocks; // Maturity period in blocks
        uint64 scaledRewardFactor; // Reward multiplier for that level scaled by 100 (i.e., 1.5 becomes 150)
        uint256 vetAmountRequiredToStake; // VET amount required for staking
    }

    struct LevelAndSupply {
        Level level; // Level details
        uint208 circulatingSupply; // Current circulating supply
        uint32 cap; // Maximum supply cap
    }

    struct Token {
        uint256 tokenId;
        uint8 levelId;
        uint64 mintedAtBlock;
        uint256 vetAmountStaked;
        uint48 lastVthoClaimTimestamp;
    }
}
