// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title X2EarnCreatorV1
/// @notice Deprecated V1 of X2EarnCreator. Kept for upgrade testing.
contract X2EarnCreatorV1 is
  Initializable,
  ERC721Upgradeable,
  ERC721PausableUpgradeable,
  ERC721EnumerableUpgradeable,
  AccessControlUpgradeable,
  UUPSUpgradeable
{
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

  error TransfersDisabled();
  error AlreadyOwnsNFT(address owner);
  error X2EarnCreatorUnauthorizedUser(address user);

  /// @custom:storage-location erc7201:b3tr.storage.X2EarnCreator
  struct X2EarnCreatorStorage {
    uint256 nextTokenId;
    string baseURI;
  }

  bytes32 private constant X2EarnCreatorStorageLocation =
    0xaf8fa2a2e81e5e00a4ef8747fbca475174c33b675ca2c56fe05a83bfd2d8fc00;

  function _getX2EarnCreatorStorage() private pure returns (X2EarnCreatorStorage storage $) {
    assembly {
      $.slot := X2EarnCreatorStorageLocation
    }
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(string calldata baseURI, address defaultAdmin) public initializer {
    __ERC721_init("X2EarnCreator", "X2C");
    __ERC721Pausable_init();
    __AccessControl_init();
    __UUPSUpgradeable_init();
    __ERC721Enumerable_init();

    X2EarnCreatorStorage storage $ = _getX2EarnCreatorStorage();

    require(bytes(baseURI).length > 0, "X2EarnCreator: baseURI is empty");
    $.baseURI = baseURI;

    require(defaultAdmin != address(0), "X2EarnCreator: zero address");

    _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);

    $.nextTokenId = 1;
  }

  modifier onlyRoleOrAdmin(bytes32 role) {
    if (!hasRole(role, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
      revert X2EarnCreatorUnauthorizedUser(msg.sender);
    }
    _;
  }

  function pause() public onlyRoleOrAdmin(PAUSER_ROLE) {
    _pause();
  }

  function unpause() public onlyRoleOrAdmin(PAUSER_ROLE) {
    _unpause();
  }

  function burn(uint256 tokenId) public onlyRoleOrAdmin(BURNER_ROLE) whenNotPaused {
    _burn(tokenId);
  }

  function safeMint(address to) public onlyRoleOrAdmin(MINTER_ROLE) whenNotPaused {
    if (balanceOf(to) > 0) {
      revert AlreadyOwnsNFT(to);
    }

    X2EarnCreatorStorage storage $ = _getX2EarnCreatorStorage();
    uint256 tokenId = $.nextTokenId++;

    _safeMint(to, tokenId);
  }

  function tokenURI(uint256 tokenId) public view override(ERC721Upgradeable) returns (string memory) {
    _requireOwned(tokenId);

    string memory baseURI = _baseURI();
    return baseURI;
  }

  function baseURI() public view returns (string memory) {
    X2EarnCreatorStorage storage $ = _getX2EarnCreatorStorage();
    return $.baseURI;
  }

  function version() public pure returns (string memory) {
    return "1";
  }

  function transferFrom(address, address, uint256) public pure override(ERC721Upgradeable, IERC721) {
    revert TransfersDisabled();
  }

  function safeTransferFrom(address, address, uint256, bytes memory) public pure override(ERC721Upgradeable, IERC721) {
    revert TransfersDisabled();
  }

  function approve(address, uint256) public pure override(ERC721Upgradeable, IERC721) {
    revert TransfersDisabled();
  }

  function setApprovalForAll(address, bool) public pure override(ERC721Upgradeable, IERC721) {
    revert TransfersDisabled();
  }

  function setBaseURI(string calldata newBaseURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
    X2EarnCreatorStorage storage $ = _getX2EarnCreatorStorage();
    $.baseURI = newBaseURI;
  }

  function _baseURI() internal view override(ERC721Upgradeable) returns (string memory) {
    X2EarnCreatorStorage storage $ = _getX2EarnCreatorStorage();
    return $.baseURI;
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyRoleOrAdmin(UPGRADER_ROLE) {}

  function _update(
    address to,
    uint256 tokenId,
    address auth
  ) internal override(ERC721Upgradeable, ERC721PausableUpgradeable, ERC721EnumerableUpgradeable) returns (address) {
    return super._update(to, tokenId, auth);
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function _increaseBalance(
    address account,
    uint128 value
  ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
    super._increaseBalance(account, value);
  }
}
