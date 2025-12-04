// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { DataTypes } from "../StargateNFT/libraries/DataTypes.sol";
import { ITokenAuction } from "./ITokenAuction.sol";

interface IStargateNFT is IERC165, IERC721, IERC721Enumerable {
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

    /**
     * @notice Emitted when an NFT is minted
     * @param owner The address that owns the newly minted NFT
     * @param levelId The level ID of the newly minted NFT
     * @param migrated Whether the token was migrated from legacy nodes contract
     * @param tokenId The ID of the newly minted NFT
     * @param vetAmountStaked The amount of VET staked to mint the NFT
     */
    event TokenMinted(
        address indexed owner,
        uint8 indexed levelId,
        bool indexed migrated,
        uint256 tokenId,
        uint256 vetAmountStaked
    );

    /**
     * @notice Emitted when an NFT is burned
     * @param owner The address that owns the newly burned NFT
     * @param levelId The level ID of the newly burned NFT
     * @param tokenId The ID of the newly burned NFT
     * @param vetAmountStaked The amount of VET staked to burn the NFT
     */
    event TokenBurned(
        address indexed owner,
        uint8 indexed levelId,
        uint256 tokenId,
        uint256 vetAmountStaked
    );

    /**
     * @notice Emitted when the base URI for the token metadata is updated
     * @param oldBaseURI The old base URI
     * @param newBaseURI The new base URI
     */
    event BaseURIUpdated(string oldBaseURI, string newBaseURI);

    /**
     * @notice Emitted when a whitelist entry is removed
     * @param owner The address of the whitelist entry
     */
    event WhitelistEntryRemoved(address owner);

    /**
     * @notice Emitted when a token manager is added to a token
     * @param tokenId The ID of the token
     * @param manager The address of the manager
     */
    event TokenManagerAdded(uint256 indexed tokenId, address indexed manager);

    /**
     * @notice Emitted when a token manager is removed from a token
     * @param tokenId The ID of the token
     * @param manager The address of the manager
     */
    event TokenManagerRemoved(uint256 indexed tokenId, address indexed manager);

    /** ------------------ Deprecated Events ------------------ */
    // These events are deprecated in V3 but we
    // keep them for backwards compatibility and
    // for indexing purposes

    /**
     * @notice Emitted when VTHO rewards are claimed for a token
     * @dev Not emitted anymore in V3, since we don't generate VTHO anymore
     * @param owner The address that claimed the rewards
     * @param tokenId The ID of the token for which rewards were claimed
     * @param amount The amount of VTHO rewards claimed
     * @dev Deprecated in V3
     */
    event BaseVTHORewardsClaimed(address indexed owner, uint256 indexed tokenId, uint256 amount);

    /**
     * @notice Emitted when the VTHO generation end timestamp is updated
     * @dev Not emitted anymore in V3, since there is no need to set this value anymore
     * @param oldVthoGenerationEndTimestamp The old VTHO generation end timestamp
     * @param newVthoGenerationEndTimestamp The new VTHO generation end timestamp
     */
    event VthoGenerationEndTimestampSet(
        uint48 oldVthoGenerationEndTimestamp,
        uint48 newVthoGenerationEndTimestamp
    );

    // ------------------ Functions ------------------ //

    function version() external view returns (uint256);

    /*------- Callbacks -------*/

    /// @notice Callback function to ERC721Upgradeable._safeMint, called by StargateNFTMinting.stake
    /// @dev Only the StargateNFT contract can call this function
    /// @param to - the address to mint the token to
    /// @param tokenId - the token ID of the token to mint
    function _safeMintCallback(address to, uint256 tokenId) external;

    /// @notice Callback function to ERC721Upgradeable._burn, called by StargateNFTMinting.unstake
    /// @dev Only the StargateNFT contract can call this function
    /// @param tokenId - the token ID of the token to burn
    function _burnCallback(uint256 tokenId) external;

    /*------- Pausing Functions -------*/

    /// @notice Pauses the StargateNFT contract
    /// @dev Only the PAUSER_ROLE can call this function
    /// @dev Pausing the contract will prevent minting
    function pause() external;

    /// @notice Unpauses the StargateNFT contract
    /// @dev Only the PAUSER_ROLE can call this function
    function unpause() external;

    /*------- Level Functions -------*/

    /// @notice Adds a new token level
    /// @param _levelAndSupply - The level and supply to add, see {DataTypes.LevelAndSupply}
    /// @dev Only the LEVEL_OPERATOR_ROLE can call this function
    /// Check the {Levels.addLevel} library function for more details
    /// Emits a {IStargateNFT.LevelUpdated} event
    /// Emits a {IStargateNFT.LevelCirculatingSupplyUpdated} event
    /// Emits a {IStargateNFT.LevelCapUpdated} event
    function addLevel(DataTypes.LevelAndSupply memory _levelAndSupply) external;

    /// @notice Returns a list of all token level spec IDs
    /// @return levelIds - The list of token level spec IDs
    function getLevelIds() external view returns (uint8[] memory);

    /// @notice Returns a token level spec for a given level ID
    /// @param _levelId The ID of the token level spec to return
    /// @return Level - The token level spec
    function getLevel(uint8 _levelId) external view returns (DataTypes.Level memory);

    /// @notice Returns a list of all token level specs
    /// @return levels - The list of token level specs
    function getLevels() external view returns (DataTypes.Level[] memory);

    /// @notice Returns the circulating supply for all levels
    /// @return circulatingSupplies An array of circulating supply values for all levels, sorted by level id
    function getLevelsCirculatingSupplies() external view returns (uint208[] memory);

    /// @notice Returns the circulating supply and cap for a given token level
    /// @param _levelId The ID of the token level to get supply data for
    /// @return circulating The circulating supply of the token level
    /// @return cap The cap of the token level
    function getLevelSupply(uint8 _levelId) external view returns (uint208 circulating, uint32 cap);

    /// @notice Returns the circulating supply for a given level at a specific block
    /// @param _levelId The ID of the level to get supply data for
    /// @param _blockNumber The block number to get the supply at
    /// @return circulatingSupply The circulating supply of the level at the specified block
    function getCirculatingSupplyAtBlock(
        uint8 _levelId,
        uint48 _blockNumber
    ) external view returns (uint208);

    /// @notice Returns the circulating supply for all levels at a certain block
    /// @param _blockNumber The block number to get the supply at
    /// @return circulatingSupplies An array of circulating supply values for all levels, sorted by level id
    function getLevelsCirculatingSuppliesAtBlock(
        uint48 _blockNumber
    ) external view returns (uint208[] memory);

    // ---------- Token Functions ---------- //

    /// @notice Get the latest token id that was minted
    /// @dev Ids start from the total supply of the legacy contrat
    /// @return currentTokenId the latest token id that was minted
    function getCurrentTokenId() external view returns (uint256);

    /// @notice Returns a token for a given token ID
    /// @param _tokenId The ID of the token to get
    /// @return token The token
    function getToken(uint256 _tokenId) external view returns (DataTypes.Token memory);

    /// @notice Returns the level ID of a given token
    /// @param _tokenId - the token ID of the NFT
    /// @return levelId - the level ID of the NFT
    function getTokenLevel(uint256 _tokenId) external view returns (uint8);

    /// @notice Returns the tokens owned by an address
    /// @param _owner The address to get tokens for
    /// @return tokens An array of tokens owned by the address
    function tokensOwnedBy(address _owner) external view returns (DataTypes.Token[] memory);

    /// @notice Returns the total VET staked by an address
    /// @param _owner The address to get total VET staked for
    /// @return totalVetStaked The total VET staked by the address
    function ownerTotalVetStaked(address _owner) external view returns (uint256);

    /// @notice Returns a list of token IDs for a given owner
    /// @param _owner The address of the owner to get token IDs for
    /// @return tokenIds The list of token IDs
    function idsOwnedBy(address _owner) external view returns (uint256[] memory);

    /// @notice Returns true if a token exists
    /// @param _tokenId The ID of the token to check
    /// @return True if the token exists, false otherwise
    function tokenExists(uint256 _tokenId) external view returns (bool);

    // ---------- Boosting Functions ------------ //

    /// @notice Boosts the maturity period of a token
    /// @dev This can only be called by the Stargate contract
    /// @param _tokenId The ID of the token to boost
    /// @dev Emits a {IStargateNFT.MaturityPeriodBoosted} event
    function boost(uint256 _tokenId) external;

    /// @notice Returns the amount of VTHO required to boost a token's maturity period
    /// @param _tokenId The ID of the token to boost
    /// @return boostAmount The amount of VTHO required to boost the token's maturity period
    function boostAmount(uint256 _tokenId) external view returns (uint256);

    /// @notice Returns the amount of VTHO required to boost a token's maturity period
    /// @param _levelId The level ID of the token to boost
    /// @return boostAmount The amount of VTHO required to boost the token's maturity period
    function boostAmountOfLevel(uint8 _levelId) external view returns (uint256);

    /// @notice Returns the boost price per block for a given level
    /// @param _levelId The level ID of the token to boost
    /// @return boostPricePerBlock The boost price per block for the level
    function boostPricePerBlock(uint8 _levelId) external view returns (uint256);

    /// @notice Returns the maturity period end block for a given token
    /// @param _tokenId The ID of the token to get maturity period end block for
    /// @return maturityPeriodEndBlock The maturity period end block
    function maturityPeriodEndBlock(uint256 _tokenId) external view returns (uint64);

    /// @notice Returns true if a token is in the maturity period
    /// @param _tokenId The ID of the token to check
    /// @return isInMaturityPeriod True if the token is in the maturity period, false otherwise
    function isUnderMaturityPeriod(uint256 _tokenId) external view returns (bool);

    // ---------- Token Manager Functions ---------- //

    /// @notice Adds a manager to a token
    /// @dev This manager can use the token for voting on VeVote
    /// or in B3TR but it cant calim rewards for themselves, transfer,
    /// delegate or unstake the token
    /// @dev If a token already has a manager, it will be removed and
    /// the new manager will be added
    /// @param _manager The address of the manager to add
    /// @param _tokenId The ID of the token to add the manager to
    /// @dev Emits a {IStargateNFT.TokenManagerAdded} event
    function addTokenManager(address _manager, uint256 _tokenId) external;

    /// @notice Removes a manager from a token
    /// @dev This manager can no longer use the token for voting on VeVote
    /// or in B3TR but it can still claim rewards for themselves, transfer,
    /// delegate or unstake the token
    /// @dev If a token has no manager, it will revert
    /// @param _tokenId The ID of the token to remove the manager from
    /// @dev Emits a {IStargateNFT.TokenManagerRemoved} event
    function removeTokenManager(uint256 _tokenId) external;

    /// @notice Returns the manager of a token, if the token does not have a manager
    /// it will return the owner of the token
    /// @param _tokenId The ID of the token to get the manager for
    /// @return manager The manager of the token
    function getTokenManager(uint256 _tokenId) external view returns (address);

    /// @notice Returns the list of:
    /// 1) Token ids managed by the user
    /// 2) Token ids owned by the user and not managed by someone else
    /// Token ids owned by the user, but managed by others, won't be returned
    /// @param _user The address of the user to get the tokens for
    /// @return tokenIds The list of token ids managed by the user
    function idsManagedBy(address _user) external view returns (uint256[] memory);

    /// @notice Returns the list of:
    /// 1) Tokens managed by the user
    /// 2) Tokens owned by the user and not managed by someone else
    /// Tokens owned by the user, but managed by others, won't be returned
    /// @param _user The address of the user to get the tokens for
    /// @return tokens The list of tokens managed by the user
    function tokensManagedBy(address _user) external view returns (DataTypes.Token[] memory);

    /// @notice Checks if an address is a manager of a token
    /// @param _manager The address of the manager to check
    /// @param _tokenId The ID of the token to check
    /// @return True if the address is a manager of the token, false otherwise
    function isTokenManager(address _manager, uint256 _tokenId) external view returns (bool);

    /// @notice Checks if a token is managed by the owner
    /// @param _tokenId The ID of the token to check
    /// @return True if the token is managed by the owner, false otherwise
    function isManagedByOwner(uint256 _tokenId) external view returns (bool);

    /// @notice Function to get the overview of the tokens related to a user
    /// A token is related to a user if it is owned by the user or if it is managed by the user
    /// This includes:
    /// - Tokens owned by the user and managed by the user
    /// - Tokens owned by the user and not managed by the user
    /// - Tokens managed by the user and not owned by the user
    /// @param _user The address of the user to get the overview of the tokens
    /// @return DataTypes.TokenOverview[] The overview of the tokens related to the user
    function tokensOverview(address _user) external view returns (DataTypes.TokenOverview[] memory);

    // ---------- Base URI Functions ---------- //

    /// @notice Sets the base URI for the token collection metadata
    /// @dev Only the MANAGER_ROLE can call this function
    /// @dev Metadata is hosted on IPFS, and the base URI is the base path to the collection metadata
    /// @param _baseTokenURI The new base URI
    /// @dev Emits a {IStargateNFT.BaseURIUpdated} event
    function setBaseURI(string memory _baseTokenURI) external;

    /// @notice Returns the base URI for the token collection metadata
    /// @return baseURI - the base URI string
    function baseURI() external view returns (string memory);

    // ---------- Stargate functions ---------- //

    /// @notice Mints a token from the StargateNFT contract
    /// @dev This can only be called by the Stargate contract
    /// @param _levelId The ID of the token level to mint
    /// @param _to The address to mint the token to
    /// @dev Emits a {IStargateNFT.TokenMinted} event
    function mint(uint8 _levelId, address _to) external returns (uint256 tokenId);

    /// @notice Burns a token from the StargateNFT contract
    /// @dev This can only be called by the Stargate contract
    /// @param _tokenId The ID of the token to burn
    /// @dev Emits a {IStargateNFT.TokenBurned} event
    function burn(uint256 _tokenId) external;

    /// @notice Migrates a token from the legacy nodes contract to StargateNFT to the same owner address
    /// as the owner of the token in the legacy nodes contract
    /// @dev This can only be called by the Stargate contract
    /// @param _tokenId The ID of the token to migrate
    /// @dev Emits a {IStargateNFT.TokenMinted} event and a {IStargateNFT.TokenMigrated} event
    function migrate(uint256 _tokenId) external;

    /// @notice Boosts the maturity period of a token
    /// @dev This can only be called by the Stargate contract
    /// @param _sender The address to boost the token for
    /// @param _tokenId The ID of the token to boost
    /// @dev Emits a {IStargateNFT.MaturityPeriodBoosted} event
    function boostOnBehalfOf(address _sender, uint256 _tokenId) external;

    /// @notice Returns the address of the Stargate contract
    /// @return stargate - the Stargate contract
    function getStargate() external view returns (address);

    // ---------- Clock Functions ---------- //

    /// @notice Returns the current block number
    /// @return blockNumber - the current block number
    function clock() external view returns (uint48);

    /// @notice Returns the clock mode
    function CLOCK_MODE() external view returns (string memory);

    /// @notice Returns the current timestamp
    /// @return timestamp - the current timestamp
    function timestamp() external view returns (uint48);

    // ---------- VTHO Functions ---------- //

    /// @notice Returns the address of the VTHO token contract
    /// @return vthoToken - the VTHO token contract
    function getVthoTokenAddress() external view returns (address);

    // ---------- Legacy Nodes Functions ---------- //

    /// @notice Returns the number of X tokens in circulation
    /// @dev Get the count of normal tokens by subtracting the count of X tokens from the total supply
    /// @return xTokensCount - the number of X tokens
    function xTokensCount() external view returns (uint208);

    /// @notice Checks if an owner owns an X token
    /// @param _owner The address of the owner to check
    /// @return True if the owner owns an X token, false otherwise
    function ownsXToken(address _owner) external view returns (bool);

    /// @notice Checks if a token is an X token
    /// @param _tokenId The ID of the token to check
    /// @return True if the token is an X token, false otherwise
    function isXToken(uint256 _tokenId) external view returns (bool);

    /// @notice Returns the legacy nodes contract
    /// @return legacyNodes - the legacy nodes contract
    function legacyNodes() external view returns (ITokenAuction);

    // ---------- Temporary Functions ---------- //

    /// @notice Transfers the balance of the contract to the Stargate contract
    /// @dev This function was created after the refactor on the StargateNFT and Stargate
    /// contracts. After the refactor, all VET is handled by Stargate, this means
    /// stake, stakeAndDelegate, unstake... functions were moved to the Stargate.
    /// Since up until now we were using the StagateNFT contract to handle the VET,
    /// we need to transfer back all the previous staked VET to the Stargate
    /// so user can delegate it and unstake it. This functions transfers all the VET
    /// to the Stargate contract in one go.
    /// This function is called by the admin after the upgrade to V3 and the
    /// Stargate variable is set to the correct value
    /// @dev Only the DEFAULT_ADMIN_ROLE can call this function
    /// @dev Emits a {IStargateNFT.VetTransferFailed} event
    function transferBalance(uint256 amount) external;

    /// @notice Migrate a token manager to the StargateNFT contract, this function is only callable by the DEFAULT_ADMIN_ROLE
    /// so we can migrate the storage from NodeManagementV3 to StargateNFT, after the migration we can remove this function
    /// @param _tokenId The ID of the token to migrate
    /// @param _manager The address of the manager to migrate
    function migrateTokenManager(uint256 _tokenId, address _manager) external;
}
