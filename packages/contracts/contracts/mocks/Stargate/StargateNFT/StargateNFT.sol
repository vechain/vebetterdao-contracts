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

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import { ERC721EnumerableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import { ERC721PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IERC165 } from "@openzeppelin/contracts/interfaces/IERC165.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IStargateNFT } from "../interfaces/IStargateNFT.sol";
import { ITokenAuction } from "../interfaces/ITokenAuction.sol";
import { IStargateDelegation } from "../interfaces/IStargateDelegation.sol";
import { DataTypes } from "./libraries/DataTypes.sol";
import { MintingLogic } from "./libraries/MintingLogic.sol";
import { Token } from "./libraries/Token.sol";
import { Clock } from "./libraries/Clock.sol";
import { Settings } from "./libraries/Settings.sol";
import { Errors } from "./libraries/Errors.sol";
import { Levels } from "./libraries/Levels.sol";
import { TokenManager } from "./libraries/TokenManager.sol";
import { IStargate } from "../interfaces/IStargate.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title StargateNFT
/// @notice This contract is used to mint NFTs representing the staking position of the owner in the VeChain protocol,
/// and minting and burning is callable only by the Stargate contract. It is a continuation of the legacy TokenAuction (X-Node and Eco Nodes) collection,
/// and owners of the legacy NFTs can migrate their nodes and replace them with StargateNFTs.
/// StargateNFT contract is upgradable, and was originally deployed to handle the staking, unstaking and migration directly, but
/// with the deployment of the Stargate contract and the release of Hayabusa, this contract was upgraded to V3, transferring the responsibility
/// of staking, unstaking and migration to the Stargate contract.
///
/// This contract handles the maturity period of an NFT, which means that the NFT cannot be used to delegate to a validator until the maturity period ends.
/// Every NFT level has a different maturity period, and the maturity period is set when the NFT is minted. Migrated NFTs have no maturity period.
/// Users can decide to skip the maturity period by calling the boost function and paying a fee (VTHO).
///
/// The key differences between the legacy Nodes contract and the Stargate NFT collection are:
/// 01. Users hard stake their VET in the contract instead of soft staking in the wallet
/// 02. There is no possibility to upgrade/downgrade NFTs, once the NFT is minted it will always stay in the same level
/// 03. A user (or contract) can hold multiple NFTs, each with a different level
/// Conditions for migrating nodes:
/// 01. Own a node which is not maturing or on auction, +4h since last transfer, hold/send VET to the contract
/// 02. Migrated nodes will have no maturity period and the node on the legacy contract will be destroyed
/// Some other peculiarities of the Stargate NFT collection are:
/// 01. Users must deposit the exact amount of VET required to mint an NFT of a certain level, no more, no less
/// 02. The NFTs have a maturity period, after which they can start generate rewards by delegating to a validator - see Stargate contract
/// 03. All NFT levels have a cap, we are adding 3 new levels at launch, and more levels can be added in the future
///
/// In version 1 and 2 this contract was also storing the VET amount staked by the owners, and since before Hayabusa just holding VET was enough to generate VTHO,
/// this contract was also allowing owners to claim those base VTHO rewards.
/// Since with the release of Hayabusa VTHO is not generated anymore by holding VET, all functionalities related to VTHO were removed from this contract.
/// @dev This contract is UUPS upgradable and AccessControl protected.
///
/// ===================== VERSION 2 ===================== //
/// Some users incorrectly migrated their nodes and we added a functionality to allow those users to recover those tokens.
///
/// Storage changes:
/// - Added a new whitelistEntries mapping to the StargateNFTStorage
///
/// Other changes:
/// - New initializeV2 function to the StargateNFT contract, for initializing the whitelist entries
/// - New WHITELISTER_ROLE, for adding and removing whitelist entries
/// - New getWhitelistEntry function, for getting a whitelist entry
/// - Settings library: New addWhitelistEntry function, for adding (and updating) a whitelist entry
/// - Settings library: New removeWhitelistEntry function, for removing a whitelist entry
/// - MintingLogic library: New internal function _migrateFromWhitelist, called by migrate and migrateAndDelegate,
/// for migrating a token if it's on the whitelist
///
/// ===================== VERSION 3 ===================== //
/// The version 3 of this contract represents the release of Hayabusa, together with the release of the Stargate contract that acts as an entry point
/// for all interactions with the protocol and with minting and burning the NFTs.
///
/// Storage changes:
/// - Marked vthoToken, stargateDelegation, vthoGenerationEndTimestamp as deprecated storage values that won't be set/used from V3
///
/// Other changes:
/// - Removed everything related to vet generated vtho (setters, getters, library), since VTHO generation is now handled by the Stargate contract; (left only some getters for debugging purposes)
/// - Removed getters to optimize contract size: normalTokensCount, addWhitelistEntry, removeWhitelistEntry, setStargateDelegation, setLegacyNodes, stargateDelegation, getCap, canTransfer,
///   ownsNormalToken, isNormalToken, levelsOwnedBy
/// - Removed setters to optimize contract size: setStargateDelegation, setLegacyNodes, updateLevelCap, updateLevel
/// - NFT is now always transferable, even when it is delegated to a validator
/// - Claimable delegation rewards are not automatically claimed anymore upon a token transfer, only during unstake, and such action is handled by the Stargate contract
/// - Removed the migrate function, since we want to enforce entering the delegation
/// - Moved the following functions to the Stargate contract:
///   - stake
///   - unstake
///   - stakeAndDelegate
///   - migrateAndDelegate
/// - Added a new mint and burn methods, accessible only by the Stargate contract
/// - Added a boost feature that allows users to skip the maturity period by paying a fee (VTHO)
/// - Added a helper function to transfer the VET stored in this contract to the new Stargate contract
/// - Added the possibility for an owner to add a manager to his NFT; The access level of the managers are handled in the Stargate contract.
///   Upon a transfer, the manager is removed from the token.
/// - Added a function to migrate the manager of a token to the StargateNFT contract, this function is only callable by the DEFAULT_ADMIN_ROLE
/// so we can migrate the storage from NodeManagementV3 to StargateNFT, after the migration we can remove this function
contract StargateNFT is
  AccessControlUpgradeable,
  ERC721Upgradeable,
  ERC721EnumerableUpgradeable,
  ERC721PausableUpgradeable,
  ReentrancyGuardUpgradeable,
  UUPSUpgradeable,
  IStargateNFT
{
  using EnumerableSet for EnumerableSet.UintSet;

  uint256 public constant REWARD_MULTIPLIER_SCALING_FACTOR = 100;
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  bytes32 public constant LEVEL_OPERATOR_ROLE = keccak256("LEVEL_OPERATOR_ROLE");
  bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
  bytes32 public constant WHITELISTER_ROLE = keccak256("WHITELISTER_ROLE");
  bytes32 public constant TOKEN_MANAGER_MIGRATOR_ROLE = keccak256("TOKEN_MANAGER_MIGRATOR_ROLE");

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  // ---------- Storage ---------- //

  // keccak256(abi.encode(uint256(keccak256("storage.StargateNFT")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant StargateNFTStorageLocation =
    0xec49bc12bd9c2cfd865ff38825256c053d253acea1262d51e4c4821cc4d5b700;

  function _getStargateNFTStorage() private pure returns (DataTypes.StargateNFTStorage storage $) {
    assembly {
      $.slot := StargateNFTStorageLocation
    }
  }

  /// @notice Returns the version of the contract, manually updated with each upgrade
  /// @return version - the version of the contract
  function version() public pure returns (uint256) {
    return 3;
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
    $.stargateDelegation_deprecated = IStargateDelegation(_initParams.stargateDelegation);
    $.vthoToken = IERC20(_initParams.vthoToken);
    $.currentTokenId = _initParams.legacyLastTokenId;
    $.baseTokenURI = _initParams.baseTokenURI;
  }

  /// @notice Initializes the contract v2
  /// @dev Not doing anything here, since in V3 we removed the logic for whitelist entries
  function initializeV2(
    DataTypes.WhitelistEntryInit[] memory _whitelistEntries
  ) external onlyRole(UPGRADER_ROLE) reinitializer(2) {
    // Do nothing
  }

  function initializeV3(
    address stargate,
    uint8[] memory levelIds,
    uint256[] memory boostPricesPerBlock
  ) external onlyRole(UPGRADER_ROLE) reinitializer(3) {
    if (stargate == address(0)) {
      revert Errors.AddressCannotBeZero();
    }

    if (levelIds.length != boostPricesPerBlock.length) {
      revert Errors.ArraysLengthMismatch();
    }

    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    $.stargate = IStargate(stargate);
    for (uint256 i; i < levelIds.length; i++) {
      Levels.updateLevelBoostPricePerBlock($, levelIds[i], boostPricesPerBlock[i]);
    }
  }

  // ---------- Modifiers ---------- //

  /// @notice Modifier to restrict access to only the Hayabusa Stargate contract
  /// @dev Only the Hayabusa Stargate contract can call this function
  modifier onlyStargate() {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    if (msg.sender != address($.stargate)) {
      revert Errors.UnauthorizedCaller(msg.sender);
    }
    _;
  }

  // ---------- Authorizers ---------- //

  /// @notice Authorizes the upgrade of the contract
  /// @param newImplementation - the new implementation address
  function _authorizeUpgrade(address newImplementation) internal virtual override onlyRole(UPGRADER_ROLE) {}

  // ---------- Callbacks ---------- //

  /// @inheritdoc IStargateNFT
  function _safeMintCallback(address to, uint256 tokenId) external {
    // Validate caller is this contract
    if (msg.sender != address(this)) {
      revert Errors.UnauthorizedCaller(msg.sender);
    }

    _safeMint(to, tokenId);
  }

  /// @inheritdoc IStargateNFT
  function _burnCallback(uint256 tokenId) external {
    // Validate caller is this contract
    if (msg.sender != address(this)) {
      revert Errors.UnauthorizedCaller(msg.sender);
    }
    _burn(tokenId);
  }

  // ---------- Pausing Functions ---------- //

  /// @inheritdoc IStargateNFT
  function pause() public onlyRole(PAUSER_ROLE) {
    _pause();
  }

  /// @inheritdoc IStargateNFT
  function unpause() public onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  // ---------- Level Functions ---------- //

  /// @inheritdoc IStargateNFT
  function addLevel(DataTypes.LevelAndSupply memory _levelAndSupply) public onlyRole(LEVEL_OPERATOR_ROLE) {
    Levels.addLevel(_getStargateNFTStorage(), _levelAndSupply);
  }

  /// @inheritdoc IStargateNFT
  function getLevelIds() external view returns (uint8[] memory) {
    return Levels.getLevelIds(_getStargateNFTStorage());
  }

  /// @inheritdoc IStargateNFT
  function getLevel(uint8 _levelId) external view returns (DataTypes.Level memory) {
    return Levels.getLevel(_getStargateNFTStorage(), _levelId);
  }

  /// @inheritdoc IStargateNFT
  function getLevels() external view returns (DataTypes.Level[] memory) {
    return Levels.getLevels(_getStargateNFTStorage());
  }

  /// @inheritdoc IStargateNFT
  function getLevelsCirculatingSupplies() external view returns (uint208[] memory) {
    return Levels.getLevelsCirculatingSupplies(_getStargateNFTStorage());
  }

  /// @inheritdoc IStargateNFT
  function getLevelSupply(uint8 _levelId) public view returns (uint208 circulating, uint32 cap) {
    (circulating, cap) = Levels.getLevelSupply(_getStargateNFTStorage(), _levelId);
  }

  /// @inheritdoc IStargateNFT
  function getCirculatingSupplyAtBlock(uint8 _levelId, uint48 _blockNumber) external view returns (uint208) {
    return Levels.getCirculatingSupplyAtBlock(_getStargateNFTStorage(), _levelId, _blockNumber);
  }

  /// @inheritdoc IStargateNFT
  function getLevelsCirculatingSuppliesAtBlock(uint48 _blockNumber) external view returns (uint208[] memory) {
    return Levels.getLevelsCirculatingSuppliesAtBlock(_getStargateNFTStorage(), _blockNumber);
  }

  // ---------- Token Functions ---------- //

  /// @inheritdoc IStargateNFT
  function getCurrentTokenId() external view returns (uint256) {
    return _getStargateNFTStorage().currentTokenId;
  }

  /// @inheritdoc IStargateNFT
  function getToken(uint256 _tokenId) public view returns (DataTypes.Token memory) {
    return Token.getToken(_getStargateNFTStorage(), _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function getTokenLevel(uint256 _tokenId) external view returns (uint8) {
    return _getStargateNFTStorage().tokens[_tokenId].levelId;
  }

  /// @inheritdoc IStargateNFT
  function tokensOwnedBy(address _owner) external view returns (DataTypes.Token[] memory) {
    return Token.tokensOwnedBy(_getStargateNFTStorage(), _owner);
  }

  /// @inheritdoc IStargateNFT
  function ownerTotalVetStaked(address _owner) external view returns (uint256) {
    return Token.ownerTotalVetStaked(_getStargateNFTStorage(), _owner);
  }

  /// @inheritdoc IStargateNFT
  function idsOwnedBy(address _owner) public view returns (uint256[] memory) {
    return Token.idsOwnedBy(_owner);
  }

  /// @inheritdoc IStargateNFT
  function tokenExists(uint256 _tokenId) external view returns (bool) {
    address owner = _ownerOf(_tokenId);
    if (owner == address(0)) {
      return false;
    }

    return true;
  }

  // ---------- Boosting Functions ---------- //

  /// @inheritdoc IStargateNFT
  function boost(uint256 _tokenId) external nonReentrant whenNotPaused {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    MintingLogic.boostOnBehalfOf($, msg.sender, _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function boostAmount(uint256 _tokenId) external view returns (uint256) {
    return MintingLogic.boostAmount(_getStargateNFTStorage(), _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function boostAmountOfLevel(uint8 _levelId) external view returns (uint256) {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    return $.boostPricePerBlock[_levelId] * $.levels[_levelId].maturityBlocks;
  }

  /// @inheritdoc IStargateNFT
  function boostPricePerBlock(uint8 _levelId) external view returns (uint256) {
    return _getStargateNFTStorage().boostPricePerBlock[_levelId];
  }

  /// @inheritdoc IStargateNFT
  function maturityPeriodEndBlock(uint256 _tokenId) external view returns (uint64) {
    return Token.maturityPeriodEndBlock(_getStargateNFTStorage(), _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function isUnderMaturityPeriod(uint256 _tokenId) external view returns (bool) {
    return Token.isUnderMaturityPeriod(_getStargateNFTStorage(), _tokenId);
  }

  // ---------- Token Manager Functions ---------- //

  /// @inheritdoc IStargateNFT
  function addTokenManager(address _manager, uint256 _tokenId) external {
    TokenManager.addTokenManager(_getStargateNFTStorage(), _manager, _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function removeTokenManager(uint256 _tokenId) external {
    TokenManager.removeTokenManager(_getStargateNFTStorage(), _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function getTokenManager(uint256 _tokenId) external view returns (address) {
    return TokenManager.getTokenManager(_getStargateNFTStorage(), _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function idsManagedBy(address _user) external view returns (uint256[] memory) {
    return TokenManager.idsManagedBy(_getStargateNFTStorage(), _user);
  }

  /// @inheritdoc IStargateNFT
  function tokensManagedBy(address _user) external view returns (DataTypes.Token[] memory) {
    return TokenManager.tokensManagedBy(_getStargateNFTStorage(), _user);
  }

  /// @inheritdoc IStargateNFT
  function isTokenManager(address _manager, uint256 _tokenId) external view returns (bool) {
    return TokenManager.isTokenManager(_getStargateNFTStorage(), _manager, _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function isManagedByOwner(uint256 _tokenId) external view returns (bool) {
    return TokenManager.isManagedByOwner(_getStargateNFTStorage(), _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function tokensOverview(address _user) external view returns (DataTypes.TokenOverview[] memory) {
    return TokenManager.tokensOverview(_getStargateNFTStorage(), _user);
  }

  // ---------- Base URI Functions ---------- //

  /// @inheritdoc IStargateNFT
  function setBaseURI(string memory _baseTokenURI) external onlyRole(MANAGER_ROLE) {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    Settings.setBaseURI($, _baseTokenURI);
  }

  /// @inheritdoc IStargateNFT
  function baseURI() external view returns (string memory) {
    return _baseURI();
  }

  // ---------- Stargate functions ---------- //

  /// @inheritdoc IStargateNFT
  function mint(
    uint8 _levelId,
    address _to
  ) external onlyStargate nonReentrant whenNotPaused returns (uint256 tokenId) {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    return MintingLogic.mint($, _levelId, _to);
  }

  /// @inheritdoc IStargateNFT
  function burn(uint256 _tokenId) external onlyStargate nonReentrant whenNotPaused {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    MintingLogic.burn($, _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function migrate(uint256 _tokenId) external onlyStargate nonReentrant whenNotPaused {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    MintingLogic.migrate($, _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function boostOnBehalfOf(address _sender, uint256 _tokenId) external onlyStargate nonReentrant whenNotPaused {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    MintingLogic.boostOnBehalfOf($, _sender, _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function getStargate() external view returns (address) {
    return address(_getStargateNFTStorage().stargate);
  }

  // ---------- Clock Functions ---------- //

  /// @inheritdoc IStargateNFT
  function clock() public view returns (uint48) {
    return Clock.clock();
  }

  /// @inheritdoc IStargateNFT
  function CLOCK_MODE() public pure returns (string memory) {
    return Clock.CLOCK_MODE();
  }

  /// @inheritdoc IStargateNFT
  function timestamp() public view returns (uint48) {
    return Clock.timestamp();
  }

  // ---------- VTHO Functions ---------- //

  /// @inheritdoc IStargateNFT
  function getVthoTokenAddress() external view returns (address) {
    return address(_getStargateNFTStorage().vthoToken);
  }

  // ---------- Legacy Nodes Functions ---------- //

  /// @inheritdoc IStargateNFT
  function xTokensCount() external view returns (uint208) {
    return Token.xTokensCount(_getStargateNFTStorage());
  }

  /// @inheritdoc IStargateNFT
  function ownsXToken(address _owner) external view returns (bool) {
    return Token.ownsXToken(_getStargateNFTStorage(), _owner);
  }

  /// @inheritdoc IStargateNFT
  function isXToken(uint256 _tokenId) external view returns (bool) {
    return Token.isXToken(_getStargateNFTStorage(), _tokenId);
  }

  /// @inheritdoc IStargateNFT
  function legacyNodes() external view returns (ITokenAuction) {
    return _getStargateNFTStorage().legacyNodes;
  }

  // ---------- Override Functions ---------- //

  /// @notice Public override of the ERC721Upgradeable.tokenURI function
  /// @param _tokenId - the token ID to get the token URI for
  /// @return tokenURI - the token URI string if the token level ID is not 0, empty string otherwise
  function tokenURI(uint256 _tokenId) public view override(ERC721Upgradeable) returns (string memory) {
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

  // ---------- Internal Functions ---------- //

  /// @notice Internal override of the _update function
  /// @param _to - the new owner of the NFT
  /// @param _tokenId - the token ID of the NFT
  /// @param _auth - the address that is authorizing the transfer
  /// @return the address of the new owner
  function _update(
    address _to,
    uint256 _tokenId,
    address _auth
  ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721PausableUpgradeable) returns (address) {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();

    address manager = $.tokenIdToManager[_tokenId];

    // Remove the manager from the token
    if (manager != address(0)) {
      delete $.tokenIdToManager[_tokenId];
      $.managerToTokenIds[manager].remove(_tokenId);

      emit TokenManagerRemoved(_tokenId, manager);
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

  // ---------- Temporary Functions ---------- //

  /// @inheritdoc IStargateNFT
  function transferBalance(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    uint256 balance = address(this).balance;
    if (amount > balance) {
      revert Errors.InsufficientContractBalance(balance, amount);
    }
    (bool success, ) = payable(address($.stargate)).call{ value: amount }("");
    if (!success) {
      revert Errors.VetTransferFailed(address($.stargate), amount);
    }
  }

  /// @inheritdoc IStargateNFT
  function migrateTokenManager(uint256 _tokenId, address _manager) external onlyRole(TOKEN_MANAGER_MIGRATOR_ROLE) {
    DataTypes.StargateNFTStorage storage $ = _getStargateNFTStorage();
    TokenManager.migrateTokenManager($, _tokenId, _manager);
  }
}
