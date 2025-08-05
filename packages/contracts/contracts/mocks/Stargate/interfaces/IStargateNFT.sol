// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {DataTypes} from "../StargateNFT/libraries/DataTypes.sol";

interface IStargateNFT is IERC721, IERC721Enumerable {
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
     * @notice Emitted when the admin changes the address of a contract
     * @param oldContractAddress The old contract address
     * @param newContractAddress The new contract address
     */
    event ContractAddressUpdated(
        address oldContractAddress,
        address newContractAddress,
        string contractName
    );

    /**
     * @notice Emitted when VTHO rewards are claimed for a token
     * @param owner The address that claimed the rewards
     * @param tokenId The ID of the token for which rewards were claimed
     * @param amount The amount of VTHO rewards claimed
     */
    event BaseVTHORewardsClaimed(address indexed owner, uint256 indexed tokenId, uint256 amount);

    /**
     * @notice Emitted when the VTHO generation end timestamp is updated
     * @param oldVthoGenerationEndTimestamp The old VTHO generation end timestamp
     * @param newVthoGenerationEndTimestamp The new VTHO generation end timestamp
     */
    event VthoGenerationEndTimestampSet(
        uint48 oldVthoGenerationEndTimestamp,
        uint48 newVthoGenerationEndTimestamp
    );

    /**
     * @notice Emitted when the base URI for the token metadata is updated
     * @param oldBaseURI The old base URI
     * @param newBaseURI The new base URI
     */
    event BaseURIUpdated(string oldBaseURI, string newBaseURI);

    // ------------------ Functions ------------------ //

    function version() external view returns (uint256);

    function getLevelIds() external view returns (uint8[] memory);

    function getLevel(uint8 _levelId) external view returns (DataTypes.Level memory);

    function getLevels() external view returns (DataTypes.Level[] memory);

    function getLevelSupply(uint8 _levelId) external view returns (uint208 circulating, uint32 cap);

    function maturityPeriodEndBlock(uint256 _tokenId) external view returns (uint64);

    function isUnderMaturityPeriod(uint256 _tokenId) external view returns (bool);

    function canTransfer(uint256 _tokenId) external view returns (bool);

    function getTokenLevel(uint256 _tokenId) external view returns (uint8);

    function idsOwnedBy(address _owner) external view returns (uint256[] memory);

    function getToken(uint256 _tokenId) external view returns (DataTypes.Token memory);

    function tokensOwnedBy(address _owner) external view returns (DataTypes.Token[] memory);

    function getLevelsCirculatingSuppliesAtBlock(
        uint48 _blockNumber
    ) external view returns (uint208[] memory);

    function tokenExists(uint256 _tokenId) external view returns (bool);

    // ------------------ VTHO Rewards Functions ------------------ //

    function claimableVetGeneratedVtho(uint256 _tokenId) external view returns (uint256);

    function claimVetGeneratedVtho(uint256 _tokenId) external;

    /*------- Callbacks -------*/

    function _safeMintCallback(address to, uint256 tokenId) external;

    function _burnCallback(uint256 tokenId) external;

    /*------- Minting Functions -------*/

    function stake(uint8 _levelId) external payable returns (uint256 tokenId);

    function stakeAndDelegate(
        uint8 _levelId,
        bool _autorenew
    ) external payable returns (uint256 tokenId);

    function migrate(uint256 _tokenId) external payable;

    function migrateAndDelegate(uint256 _tokenId, bool _autorenew) external payable;

    function unstake(uint256 _tokenId) external;
}
