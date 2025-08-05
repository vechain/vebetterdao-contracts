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

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {ERC721PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IStargateNFT} from "../interfaces/IStargateNFT.sol";
import {ITokenAuction} from "../interfaces/ITokenAuction.sol";
import {IStargateDelegation} from "../interfaces/IStargateDelegation.sol";
import {DataTypes} from "./libraries/DataTypes.sol";
import {MintingLogic} from "./libraries/MintingLogic.sol";
import {Token} from "./libraries/Token.sol";
import {Clock} from "./libraries/Clock.sol";
import {Settings} from "./libraries/Settings.sol";
import {Errors} from "./libraries/Errors.sol";
import {VetGeneratedVtho} from "./libraries/VetGeneratedVtho.sol";
import {Levels} from "./libraries/Levels.sol";

/// @title StargateNFT
/// @notice This contract is used to stake VET and receive in return an NFT representing the staking position.
/// It is a continuation of the legacy TokenAuction (X-Node and Eco Nodes) collection, and owners of the legacy
/// NFTs can migrate their nodes to the new StargateNFT contract. The key differences between the legacy TokenAuction
/// and the Stargate NFT collection are:
/// 01. Users hard stake their VET in the contract instead of soft staking in the wallet
/// 02. There is no possibility to upgrade/downgrade NFTs, once the NFT is minted it will always stay in the same level
/// 03. A user (or contract) can hold multiple NFTs, each with a different levels
/// Conditions for migrating nodes:
/// 01. Own a node which is not maturing or on auction, +4h since last transfer, hold/send VET to the contract
/// 02. Migrated nodes will have no maturity period and the node on the legacy contract will be destroyed
/// Some other peculiarities of the Stargate NFT collection are:
/// 01. Users must deposit the exact amount of VET required to mint an NFT of a certain level, no more, no less
/// 02. The NFTs have a maturity period, after which they can start generate rewards for delegating to a validator node - see StargateDelegation contract
/// 03. All NFT levels have a cap, we are adding 3 new levels at launch, and more levels can be added in the future
/// 04. The NFTs are transferable only when the owner is not delegating
///
/// When Hayabusa hardfork is activated, the VTHO generation will stop, and the VTHO generation end timestamp will be set to the block number of the hardfork.
/// Since VTHO generation is calculated based on timestamp, instead of block number, we won't be able to know in advance the exact timestamp before
/// the hardfork will happen. For this reason the contract will be paused a few hours before the hardfork, and unpaused after we will know the exact timestamp,
/// to avoid any potential wrong vtho generation end timestamp and rewards calculation.
/// @dev This contract is UUPS upgradable and AccessControl protected.
contract StargateNFT is
    AccessControlUpgradeable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IStargateNFT
{
    uint256 public constant REWARD_MULTIPLIER_SCALING_FACTOR = 100;
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant LEVEL_OPERATOR_ROLE = keccak256("LEVEL_OPERATOR_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ---------- Storage ---------- //

    // keccak256(abi.encode(uint256(keccak256("storage.StargateNFT")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant StargateNFTStorageLocation =
        0xec49bc12bd9c2cfd865ff38825256c053d253acea1262d51e4c4821cc4d5b700;

    function _getStargateNFTStorage()
        private
        pure
        returns (DataTypes.StargateNFTStorage storage $)
    {
        assembly {
            $.slot := StargateNFTStorageLocation
        }
    }

    /// @notice Returns the version of the contract, manually updated with each upgrade
    /// @return version - the version of the contract
    function version() public pure returns (uint256) {
        return 1;
    }

    /// @notice Initializes the contract
    function initialize(DataTypes.StargateNFTInitParams memory _initParams) external initializer {
        // Validate the input addresses are not zero
        if (
            _initParams.admin == address(0) ||
            _initParams.upgrader == address(0) ||
            _initParams.pauser == address(0) ||
            _initParams.levelOperator == address(0) ||
            _initParams.legacyNodes == address(0) ||
            _initParams.vthoToken == address(0) ||
            _initParams.stargateDelegation == address(0)
        ) {
            revert Errors.AddressCannotBeZero();
        }

        // Validate string parameters are not empty
        if (
            bytes(_initParams.tokenCollectionName).length == 0 ||
            bytes(_initParams.tokenCollectionSymbol).length == 0 ||
            bytes(_initParams.baseTokenURI).length == 0
        ) {
            revert Errors.StringCannotBeEmpty();
        }

        // Validate legacy last token ID is greater than 0
        if (_initParams.legacyLastTokenId == 0) {
            revert Errors.ValueCannotBeZero();
        }

        // Validate list of token levels is not empty
        if (_initParams.levelsAndSupplies.length == 0) {
            revert Errors.ArrayCannotHaveZeroLength();
        }

        // Initialize the contract
        __ERC721_init(_initParams.tokenCollectionName, _initParams.tokenCollectionSymbol);
        __ERC721Enumerable_init();
        __ERC721Pausable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        // Grant roles to the admin, upgrader, pauser, and level operator
        _grantRole(DEFAULT_ADMIN_ROLE, _initParams.admin);
        _grantRole(UPGRADER_ROLE, _initParams.upgrader);
        _grantRole(PAUSER_ROLE, _initParams.pauser);
        _grantRole(LEVEL_OPERATOR_ROLE, _initParams.levelOperator);

        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        // Add provided token levels
        for (uint256 i; i < _initParams.levelsAndSupplies.length; i++) {
            Levels.addLevel($, _initParams.levelsAndSupplies[i]);
        }

        // Initialize the storage
        $.legacyNodes = ITokenAuction(_initParams.legacyNodes);
        $.stargateDelegation = IStargateDelegation(_initParams.stargateDelegation);
        $.vthoToken = IERC20(_initParams.vthoToken);
        $.currentTokenId = _initParams.legacyLastTokenId;
        $.baseTokenURI = _initParams.baseTokenURI;
    }

    // ---------- Authorizers ---------- //

    /// @notice Authorizes the upgrade of the contract
    /// @param newImplementation - the new implementation address
    function _authorizeUpgrade(
        address newImplementation
    ) internal virtual override onlyRole(UPGRADER_ROLE) {}

    // ---------- Callbacks ---------- //

    /// @notice Callback function to ERC721Upgradeable._safeMint, called by StargateNFTMinting.stake
    /// @dev Only the StargateNFT contract can call this function
    /// @param to - the address to mint the token to
    /// @param tokenId - the token ID of the token to mint
    function _safeMintCallback(address to, uint256 tokenId) external {
        // Validate caller is this contract
        if (msg.sender != address(this)) {
            revert Errors.UnauthorizedCaller(msg.sender);
        }

        _safeMint(to, tokenId);
    }

    /// @notice Callback function to ERC721Upgradeable._burn, called by StargateNFTMinting.unstake
    /// @dev Only the StargateNFT contract can call this function
    /// @param tokenId - the token ID of the token to burn
    function _burnCallback(uint256 tokenId) external {
        // Validate caller is this contract
        if (msg.sender != address(this)) {
            revert Errors.UnauthorizedCaller(msg.sender);
        }

        _burn(tokenId);
    }

    // ---------- Admin setters ---------- //

    /// @notice Pauses the StargateNFT contract
    /// @dev Only the PAUSER_ROLE can call this function
    /// @dev Pausing the contract will prevent minting
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses the StargateNFT contract
    /// @dev Only the PAUSER_ROLE can call this function
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Adds a new token level
    /// @param _levelAndSupply - The level and supply to add, see {DataTypes.LevelAndSupply}
    /// @dev Only the LEVEL_OPERATOR_ROLE can call this function
    /// Check the {Levels.addLevel} library function for more details
    /// Emits a {IStargateNFT.LevelUpdated} event
    /// Emits a {IStargateNFT.LevelCirculatingSupplyUpdated} event
    /// Emits a {IStargateNFT.LevelCapUpdated} event
    function addLevel(
        DataTypes.LevelAndSupply memory _levelAndSupply
    ) public onlyRole(LEVEL_OPERATOR_ROLE) {
        Levels.addLevel(_getStargateNFTStorage(), _levelAndSupply);
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
    /// Check the {Levels.updateLevel} library function for more details
    /// Emits a {IStargateNFT.LevelUpdated} event
    function updateLevel(
        uint8 _levelId,
        string memory _name,
        bool _isX,
        uint64 _maturityBlocks,
        uint64 _scaledRewardFactor,
        uint256 _vetAmountRequiredToStake
    ) public onlyRole(LEVEL_OPERATOR_ROLE) {
        Levels.updateLevel(
            _getStargateNFTStorage(),
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
    function updateLevelCap(uint8 _levelId, uint32 _cap) public onlyRole(LEVEL_OPERATOR_ROLE) {
        Levels.updateLevelCap(_getStargateNFTStorage(), _levelId, _cap);
    }

    /// @notice Sets the stargate delegation contract address
    /// @dev Only the DEFAULT_ADMIN_ROLE can call this function
    /// @param _stargateDelegation - the new stargate delegation address
    /// @dev Emits a {IStargateNFT.ContractAddressUpdated} event
    function setStargateDelegation(
        address _stargateDelegation
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
        Settings.setStargateDelegation($, _stargateDelegation);
    }

    /// @notice Sets the legacy nodes contract address, ie TokenAuction
    /// @dev Only the DEFAULT_ADMIN_ROLE can call this function
    /// @param _legacyNodes - the new legacy nodes address
    /// @dev Emits a {IStargateNFT.ContractAddressUpdated} event
    function setLegacyNodes(address _legacyNodes) public onlyRole(DEFAULT_ADMIN_ROLE) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
        Settings.setLegacyNodes($, _legacyNodes);
    }

    /// @notice Sets the VTHO token contract address
    /// @dev Only the DEFAULT_ADMIN_ROLE can call this function
    /// @param _vthoToken - the new VTHO token address
    /// @dev Emits a {IStargateNFT.ContractAddressUpdated} event
    function setVthoToken(address _vthoToken) public onlyRole(DEFAULT_ADMIN_ROLE) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
        Settings.setVthoToken($, _vthoToken);
    }

    /// @notice Set the timestamp when the protocol will stop generating VTHO by holding VET
    /// @dev By default it will be 0, meaning the protocol will keep generating VTHO indefinitely,
    /// once the VeChain foundation will know the exact timestamp when the VTHO generation will stop
    /// we will set this value. It can be set back to 0, but then rewards will be recalculated based on the
    /// current timestamp. So set it back to 0 with caution.
    /// @dev Only the DEFAULT_ADMIN_ROLE can call this function when the contract is paused. The reason the contract needs
    /// to be paused is to ensure that the value is adjusted in a controlled state, avoiding any potential wrong vtho generation end timestamp.
    /// @param _vthoGenerationEndTimestamp The timestamp when the protocol will stop generating VTHO by holding VET
    /// @dev Emits a {IStargateNFT.VthoGenerationEndTimestampUpdated} event
    function setVthoGenerationEndTimestamp(
        uint48 _vthoGenerationEndTimestamp
    ) external whenPaused onlyRole(DEFAULT_ADMIN_ROLE) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
        Settings.setVthoGenerationEndTimestamp($, _vthoGenerationEndTimestamp);
    }

    /// @notice Sets the base URI for the token collection metadata
    /// @dev Only the MANAGER_ROLE can call this function
    /// @dev Metadata is hosted on IPFS, and the base URI is the base path to the collection metadata
    /// @param _baseTokenURI The new base URI
    /// @dev Emits a {IStargateNFT.BaseURIUpdated} event
    function setBaseURI(string memory _baseTokenURI) external onlyRole(MANAGER_ROLE) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
        Settings.setBaseURI($, _baseTokenURI);
    }

    // ---------- User setters ---------- //

    /// @notice Stakes VET and mints an NFT
    /// @param _levelId The ID of the token level to mint, VET as msg.value
    /// @return tokenId The ID of the minted NFT
    /// @dev Emits a {IStargateNFT.TokenMinted} event
    function stake(
        uint8 _levelId
    ) external payable whenNotPaused nonReentrant returns (uint256 tokenId) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        tokenId = MintingLogic.stake($, _levelId);
    }

    /// @notice Stakes VET and mints an NFT, and delegates it
    /// @param _levelId The ID of the token level to mint, VET as msg.value
    /// @param _autorenew Whether the token should be delegated forever
    /// @return tokenId The ID of the minted NFT
    /// @dev Emits a {IStargateNFT.TokenMinted} event
    function stakeAndDelegate(
        uint8 _levelId,
        bool _autorenew
    ) external payable whenNotPaused nonReentrant returns (uint256 tokenId) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        tokenId = MintingLogic.stakeAndDelegate($, _levelId, _autorenew);
    }

    /// @notice Migrates a token from the legacy TokenAuction contract to the StargateNFT contract
    /// @param _tokenId - the token ID to migrate
    /// @dev Emits a {IStargateNFT.TokenMinted} event
    function migrate(uint256 _tokenId) external payable whenNotPaused nonReentrant {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        MintingLogic.migrate($, _tokenId);
    }

    /// @notice Migrates a token from the legacy nodes contract to StargateNFT, and delegates it
    /// @param _tokenId The ID of the token to migrate
    /// @param _autorenew Whether the token should be delegated forever
    /// @dev Emits a {IStargateNFT.TokenMinted} event
    function migrateAndDelegate(
        uint256 _tokenId,
        bool _autorenew
    ) external payable whenNotPaused nonReentrant {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        MintingLogic.migrateAndDelegate($, _tokenId, _autorenew);
    }

    /// @notice Unstakes a token from the StargateNFT contract, will return the VET to the user and burn the NFT
    /// @param _tokenId - the token ID to unstake
    /// @dev Emits a {IStargateNFT.TokenBurned} event
    function unstake(uint256 _tokenId) external whenNotPaused nonReentrant {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        MintingLogic.unstake($, _tokenId);
    }

    /// @notice Claims base VTHO rewards for a token, generated by the VeChain before the Hayabusa upgrade
    /// @param _tokenId - the token ID to claim rewards for
    /// @dev Emits a {IStargateNFT.BaseVTHORewardsClaimed} event
    function claimVetGeneratedVtho(uint256 _tokenId) external whenNotPaused nonReentrant {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        VetGeneratedVtho.claimRewards($, _tokenId);
    }

    // ---------- Getters ---------- //

    /// @notice Returns the current block number
    /// @return blockNumber - the current block number
    function clock() public view returns (uint48) {
        return Clock.clock();
    }

    /// @notice Returns the clock mode
    function CLOCK_MODE() public pure returns (string memory) {
        return Clock.CLOCK_MODE();
    }

    /// @notice Returns the current timestamp
    /// @return timestamp - the current timestamp
    function timestamp() public view returns (uint48) {
        return Clock.timestamp();
    }

    /// @notice Returns the address of the VTHO token contract
    /// @return vthoToken - the VTHO token contract
    function vthoToken() external view returns (IERC20) {
        return _getStargateNFTStorage().vthoToken;
    }

    /// @notice Returns the legacy nodes contract
    /// @return legacyNodes - the legacy nodes contract
    function legacyNodes() external view returns (ITokenAuction) {
        return _getStargateNFTStorage().legacyNodes;
    }

    /// @notice Returns the stargate delegation contract
    /// @return stargateDelegation - the stargate delegation contract
    function stargateDelegation() external view returns (IStargateDelegation) {
        return _getStargateNFTStorage().stargateDelegation;
    }

    /// @notice Returns the timestamp when the protocol will stop generating VTHO by holding VET
    /// @return vthoGenerationEndTimestamp - the timestamp when the protocol will stop generating VTHO by holding VET
    function vthoGenerationEndTimestamp() external view returns (uint48) {
        return _getStargateNFTStorage().vthoGenerationEndTimestamp;
    }

    /// @notice Returns a list of all token level spec IDs
    /// @return levelIds - The list of token level spec IDs
    function getLevelIds() external view returns (uint8[] memory) {
        return Levels.getLevelIds(_getStargateNFTStorage());
    }

    /// @notice Returns a token level spec for a given level ID
    /// @param _levelId The ID of the token level spec to return
    /// @return Level - The token level spec
    function getLevel(uint8 _levelId) external view returns (DataTypes.Level memory) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Levels.getLevel($, _levelId);
    }

    /// @notice Returns a list of all token level specs
    /// @return levels - The list of token level specs
    function getLevels() external view returns (DataTypes.Level[] memory) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Levels.getLevels($);
    }

    /// @notice Returns the circulating supply for all levels
    /// @return circulatingSupplies An array of circulating supply values for all levels, sorted by level id
    function getLevelsCirculatingSupplies() external view returns (uint208[] memory) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Levels.getLevelsCirculatingSupplies($);
    }

    /// @notice Returns the circulating supply and cap for a given token level
    /// @param _levelId The ID of the token level to get supply data for
    /// @return circulating The circulating supply of the token level
    /// @return cap The cap of the token level
    function getLevelSupply(uint8 _levelId) public view returns (uint208 circulating, uint32 cap) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        (circulating, cap) = Levels.getLevelSupply($, _levelId);
    }

    /// @notice Returns the circulating supply for a given level at a specific block
    /// @param _levelId The ID of the level to get supply data for
    /// @param _blockNumber The block number to get the supply at
    /// @return circulatingSupply The circulating supply of the level at the specified block
    function getCirculatingSupplyAtBlock(
        uint8 _levelId,
        uint48 _blockNumber
    ) external view returns (uint208) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Levels.getCirculatingSupplyAtBlock($, _levelId, _blockNumber);
    }

    /// @notice Returns the circulating supply for all levels at a certain block
    /// @param _blockNumber The block number to get the supply at
    /// @return circulatingSupplies An array of circulating supply values for all levels, sorted by level id
    function getLevelsCirculatingSuppliesAtBlock(
        uint48 _blockNumber
    ) external view returns (uint208[] memory) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Levels.getLevelsCirculatingSuppliesAtBlock($, _blockNumber);
    }

    /// @notice Returns the cap for a given token level
    /// @param _levelId The ID of the token level to get the cap for
    /// @return cap The cap of the token level
    function getCap(uint8 _levelId) external view returns (uint32) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
        return $.cap[_levelId];
    }

    /// @notice Get the latest token id that was minted
    /// @dev Ids start from the total supply of the legacy contrat
    /// @return currentTokenId the latest token id that was minted
    function getCurrentTokenId() external view returns (uint256) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return $.currentTokenId;
    }

    /// @notice Returns a token for a given token ID
    /// @param _tokenId The ID of the token to get
    /// @return token The token
    function getToken(uint256 _tokenId) public view returns (DataTypes.Token memory) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Token.getToken($, _tokenId);
    }

    /// @notice Returns the level ID of a given token
    /// @param _tokenId - the token ID of the NFT
    /// @return levelId - the level ID of the NFT
    function getTokenLevel(uint256 _tokenId) external view returns (uint8) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return $.tokens[_tokenId].levelId;
    }

    /// @notice Returns the tokens owned by an address
    /// @param _owner The address to get tokens for
    /// @return tokens An array of tokens owned by the address
    function tokensOwnedBy(address _owner) external view returns (DataTypes.Token[] memory) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Token.tokensOwnedBy($, _owner);
    }

    /// @notice Returns the levels owned by an address
    /// @param _owner The address to get levels for
    /// @return levels An array of levels owned by the address
    function levelsOwnedBy(address _owner) external view returns (uint8[] memory) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Token.levelsOwnedBy($, _owner);
    }

    /// @notice Returns the total VET staked by an address
    /// @param _owner The address to get total VET staked for
    /// @return totalVetStaked The total VET staked by the address
    function ownerTotalVetStaked(address _owner) external view returns (uint256) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Token.ownerTotalVetStaked($, _owner);
    }

    /// @notice Returns the maturity period end block for a given token
    /// @param _tokenId The ID of the token to get maturity period end block for
    /// @return maturityPeriodEndBlock The maturity period end block
    function maturityPeriodEndBlock(uint256 _tokenId) external view returns (uint64) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Token.maturityPeriodEndBlock($, _tokenId);
    }

    /// @notice Returns true if a token is in the maturity period
    /// @param _tokenId The ID of the token to check
    /// @return isInMaturityPeriod True if the token is in the maturity period, false otherwise
    function isUnderMaturityPeriod(uint256 _tokenId) external view returns (bool) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return Token.isUnderMaturityPeriod($, _tokenId);
    }

    /// @notice Returns true if the NFT is transferable, false otherwise
    /// @dev NFT is transferable if tokenId exists and the user is not delegating the NFT with the stargate delegation contract
    /// @param _tokenId - the token ID of the NFT
    /// @return true if the NFT is transferable, false otherwise
    function canTransfer(uint256 _tokenId) public view returns (bool) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return !$.stargateDelegation.isDelegationActive(_tokenId);
    }

    /// @notice Returns the base URI for the token collection metadata
    /// @return baseURI - the base URI string
    function baseURI() external view returns (string memory) {
        return _baseURI();
    }

    // ---------- Base VTHO Rewards generated by the VeChain protocol before the Hayabusa upgrade ---------- //

    /// @notice Calculates the amount of VTHO rewards available for a token
    /// @param _tokenId - the token ID to calculate rewards for
    /// @return amount - the amount of VTHO rewards available
    function claimableVetGeneratedVtho(uint256 _tokenId) external view returns (uint256) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return VetGeneratedVtho.claimableRewards($, _tokenId);
    }

    /// @notice Returns the timestamp of the last base VTHO reward claim
    /// @param _tokenId - the token ID to get the last claim timestamp for
    /// @return lastClaimTimestamp - the timestamp of the last base VTHO reward claim
    function getLastVetGeneratedVthoClaimTimestamp(
        uint256 _tokenId
    ) external view returns (uint48) {
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        return $.tokens[_tokenId].lastVthoClaimTimestamp;
    }

    /// @notice This function calculates the VTHO generated between two timestamps for
    /// a given amount of VET. The formula follows the official VTHO generation rate:
    /// VTHO = VET × 5×10^-9 × time_in_seconds.
    /// @param _t1 Time in seconds
    /// @param _t2 Time in seconds
    /// @param _vetAmount VET in wei
    /// @return vtho generated in wei
    function calculateVTHO(
        uint48 _t1,
        uint48 _t2,
        uint256 _vetAmount
    ) external pure returns (uint256) {
        return VetGeneratedVtho.calculateVTHO(_t1, _t2, _vetAmount);
    }

    // ---------- TokenAuction backwards compatibility getters ---------- //

    /// @notice Returns the number of normal tokens in circulation
    /// @return normalTokensCount - the number of normal tokens
    function normalTokensCount() external view returns (uint208) {
        return Token.normalTokensCount(_getStargateNFTStorage());
    }

    /// @notice Returns the number of X tokens in circulation
    /// @return xTokensCount - the number of X tokens
    function xTokensCount() external view returns (uint208) {
        return Token.xTokensCount(_getStargateNFTStorage());
    }

    /// @notice Returns a list of token IDs for a given owner
    /// @param _owner The address of the owner to get token IDs for
    /// @return tokenIds The list of token IDs
    function idsOwnedBy(address _owner) public view returns (uint256[] memory) {
        return Token.idsOwnedBy(_owner);
    }

    /// @notice Checks if an owner owns an X token
    /// @param _owner The address of the owner to check
    /// @return True if the owner owns an X token, false otherwise
    function ownsXToken(address _owner) external view returns (bool) {
        return Token.ownsXToken(_getStargateNFTStorage(), _owner);
    }

    /// @notice Checks if an owner owns a normal token
    /// @param _owner The address of the owner to check
    /// @return True if the owner owns a normal token, false otherwise
    function ownsNormalToken(address _owner) external view returns (bool) {
        return Token.ownsNormalToken(_getStargateNFTStorage(), _owner);
    }

    /// @notice Checks if a token is an X token
    /// @param _tokenId The ID of the token to check
    /// @return True if the token is an X token, false otherwise
    function isXToken(uint256 _tokenId) external view returns (bool) {
        return Token.isXToken(_getStargateNFTStorage(), _tokenId);
    }

    /// @notice Checks if a token is a normal token
    /// @param _tokenId The ID of the token to check
    /// @return True if the token is a normal token, false otherwise
    function isNormalToken(uint256 _tokenId) external view returns (bool) {
        return Token.isNormalToken(_getStargateNFTStorage(), _tokenId);
    }

    /// @notice Returns true if a token exists
    /// @param _tokenId The ID of the token to check
    /// @return True if the token exists, false otherwise
    function tokenExists(uint256 _tokenId) external view returns (bool) {
        address owner = _ownerOf(_tokenId);
        if (owner == address(0)) {
            return false;
        }

        return true;
    }

    // ---------- Override Functions ---------- //

    /// @notice Public override of the ERC721Upgradeable.tokenURI function
    /// @param _tokenId - the token ID to get the token URI for
    /// @return tokenURI - the token URI string if the token level ID is not 0, empty string otherwise
    function tokenURI(
        uint256 _tokenId
    ) public view override(ERC721Upgradeable) returns (string memory) {
        // check if the token exists
        _requireOwned(_tokenId);

        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

        // Get token level ID
        uint8 levelId = $.tokens[_tokenId].levelId;

        return Token.tokenURI($, _tokenId, Strings.toString(levelId));
    }

    /// @notice Public override of the supportsInterface function
    /// @param _interfaceId The interface ID to check
    /// @return true if the contract implements the interface, false otherwise
    function supportsInterface(
        bytes4 _interfaceId
    )
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable, IERC165)
        returns (bool)
    {
        return super.supportsInterface(_interfaceId);
    }

    /// @notice Internal override of the _update function
    /// @dev Before updating the NFT owner, we check if the NFT is transferable
    /// @dev If the token has rewards to claim, claim them (done to avoid loss of rewards when trading the NFT)
    /// @param _to - the new owner of the NFT
    /// @param _tokenId - the token ID of the NFT
    /// @param _auth - the address that is authorizing the transfer
    /// @return the address of the new owner
    function _update(
        address _to,
        uint256 _tokenId,
        address _auth
    )
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721PausableUpgradeable)
        returns (address)
    {
        if (!canTransfer(_tokenId)) {
            revert Errors.TokenLocked();
        }

        // Claim pending rewards to avoid loss of rewards when trading or burning the NFT
        // Base VTHO rewards
        DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
        if (VetGeneratedVtho.claimableRewards($, _tokenId) > 0) {
            VetGeneratedVtho.claimRewards($, _tokenId);
        }

        // Stargate Delegation rewards
        if ($.stargateDelegation.claimableRewards(_tokenId) > 0) {
            $.stargateDelegation.claimRewards(_tokenId);
        }

        return super._update(_to, _tokenId, _auth);
    }

    /// @notice Internal override of the _increaseBalance function
    /// @param account - the address to increase the balance for
    /// @param value - the amount to increase the balance by
    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._increaseBalance(account, value);
    }

    /// @notice Internal override of the ERC721Upgradeable._baseURI function
    /// @return baseURI - the base URI string
    function _baseURI() internal view override(ERC721Upgradeable) returns (string memory) {
        return _getStargateNFTStorage().baseTokenURI;
    }
}
