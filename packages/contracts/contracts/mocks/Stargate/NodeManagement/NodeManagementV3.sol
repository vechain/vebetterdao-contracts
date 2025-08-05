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

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {VechainNodesDataTypes} from "./libraries/VechainNodesDataTypes.sol";
import {ITokenAuction} from "../interfaces/ITokenAuction.sol";
import {INodeManagementV3} from "../interfaces/INodeManagement/INodeManagementV3.sol";
import {IStargateNFT} from "../interfaces/IStargateNFT.sol";
import {DataTypes} from "../StargateNFT/libraries/DataTypes.sol";

/**
 * @title NodeManagement
 * @notice This contract was originally created and used by VeBetter DAO to manage node ownership and delegation.
 * It supports delegation, retrieval of managed nodes, and integration with legacy VeChain Nodes and token auction contracts.
 * Since the creation of the Stargate NFT contract, this contract has been moved under the Stargate team umbrella, and
 * it is now used to manage node delegation also for the Stargate NFT contract. But most importantly,
 * developers can use this contract to easily migrate from pointing to the legacy vechain nodes contract to the new Stargate NFT contract.
 * In fact, this contract will point to both the legacy vechain nodes contract and the new Stargate NFT contract, allowing
 * a easy way to check node ownership and delegation for both.
 * @dev The contract is upgradeable using the UUPS proxy pattern and implements role-based access control for secure upgrades.
 * @dev Important: The legacy and new vechain nodes contracts share the same token IDs.
 *
 * ------------------------ Version 2 ------------------------
 * - Add function to check if Node is delegated
 * - Add function to check if user is a delegator
 * - Add function to get users owned node ID
 * - Add function to retrieve detailed information about a user's nodes (both delegated and owned)
 *
 * ------------------------ Version 3 ------------------------
 * This version aligns with the Stargate NFT contract which is the new vechain nodes contract, making {vechainNodesContract} legacy.
 * Since users have an indefinite amount of time to migrate their nodes from the old to the new contract, this contract is used to manage
 * node ownership and delegation for both the old and new contracts.
 * - Added stargateNft contract address to storage
 * - Check everywhere also ownerships in the stargate NFT contract
 * - Deprecated removeNodeDelegation() function
 * - Deprecated delegateNode(address) function
 */
contract NodeManagementV3 is INodeManagementV3, AccessControlUpgradeable, UUPSUpgradeable {
    using EnumerableSet for EnumerableSet.UintSet;

    error AddressCannotBeZero();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @custom:storage-location erc7201:b3tr.storage.NodeManagement
    struct NodeManagementStorage {
        ITokenAuction vechainNodesContract; // The token auction contract
        mapping(address => EnumerableSet.UintSet) delegateeToNodeIds; // Map delegatee address to set of node IDs
        mapping(uint256 => address) nodeIdToDelegatee; // Map node ID to delegatee address
        IStargateNFT stargateNft; // The stargate NFT contract, aka: the new vechain nodes contract
    }

    // keccak256(abi.encode(uint256(keccak256("b3tr.storage.NodeManagement")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant NodeManagementStorageLocation =
        0x895b04a03424f581b1c6717e3715bbb5ceb9c40a4e5b61a13e84096251cf8f00;

    /**
     * @notice Retrieve the storage reference for node delegation data.
     * @dev Internal pure function to get the storage slot for node delegation data using inline assembly.
     */
    function _getNodeManagementStorage() internal pure returns (NodeManagementStorage storage $) {
        assembly {
            $.slot := NodeManagementStorageLocation
        }
    }

    /**
     * @notice Initialize the contract with the specified VeChain Nodes contract, admin, and upgrader addresses.
     * @dev This function initializes the contract and sets the initial values for the VeChain Nodes contract address and other roles. It should be called only once during deployment.
     * @param _vechainNodesContract The address of the VeChain Nodes contract.
     * @param _admin The address to be granted the default admin role.
     * @param _upgrader The address to be granted the upgrader role.
     */
    function initialize(
        address _vechainNodesContract,
        address _admin,
        address _upgrader
    ) external initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();

        if (_admin == address(0)) {
            revert AddressCannotBeZero();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _upgrader);

        NodeManagementStorage storage $ = _getNodeManagementStorage();
        $.vechainNodesContract = ITokenAuction(_vechainNodesContract);
        emit VechainNodeContractSet(address(0), _vechainNodesContract);
    }

    /// @notice No op for v2
    function initializeV2() external onlyRole(UPGRADER_ROLE) reinitializer(2) {}

    /// @notice We added the stargate NFT contract in v3, so we need to initialize it
    function initializeV3(address _stargateNft) external onlyRole(UPGRADER_ROLE) reinitializer(3) {
        if (_stargateNft == address(0)) {
            revert AddressCannotBeZero();
        }

        NodeManagementStorage storage $ = _getNodeManagementStorage();
        $.stargateNft = IStargateNFT(_stargateNft);
        emit StargateNftSet(address(0), _stargateNft);
    }

    // ---------- Setters ---------- //
    /**
     * @notice Delegate a node to another address.
     * @dev This function allows a node owner to delegate their node to another address.
     * @param delegatee The address to delegate the node to.
     * @param nodeId The ID of the node to delegate.
     */
    function delegateNode(address delegatee, uint256 nodeId) public virtual {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        // Check if the delegatee address is the zero address
        if (delegatee == address(0)) {
            revert NodeManagementZeroAddress();
        }

        // Check if the delegatee is the same as the caller,
        // a node owner by defualt is the node manager and cannot delegate to themselves
        if (msg.sender == delegatee) {
            revert NodeManagementSelfDelegation();
        }

        // Check that the user owns the node
        // If node does not exist, it returns false and it will revert
        if (!isDirectNodeOwner(msg.sender, nodeId)) {
            revert NodeManagementNotNodeOwner(nodeId);
        }

        address currentDelegatee = $.nodeIdToDelegatee[nodeId];

        // Check if node ID is already delegated to another user and
        // if so remove the delegation
        if (currentDelegatee != address(0)) {
            // Emit event for delegation removal
            emit NodeDelegated(nodeId, currentDelegatee, false);
            // Remove delegation
            $.delegateeToNodeIds[currentDelegatee].remove(nodeId);
        }

        // Update mappings for delegation
        $.delegateeToNodeIds[delegatee].add(nodeId); // Add node ID to delegatee's set
        $.nodeIdToDelegatee[nodeId] = delegatee; // Map node ID to delegatee

        // Emit event for delegation
        emit NodeDelegated(nodeId, delegatee, true);
    }

    /**
     * @notice Remove the delegation of a node.
     * @dev This function allows a node owner to remove the delegation of their node, effectively revoking the delegatee's access to the node.
     * @param nodeId The ID of the node to remove the delegation from.
     */
    function removeNodeDelegation(uint256 nodeId) public virtual {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        // Check that the user either manages the node or owns it directly
        if (!isNodeManager(msg.sender, nodeId) && !isDirectNodeOwner(msg.sender, nodeId)) {
            revert NodeManagementNotNodeOwnerOrManager(nodeId);
        }

        // Check if node is delegated
        address delegatee = $.nodeIdToDelegatee[nodeId];
        if (delegatee == address(0)) {
            revert NodeManagementNodeNotDelegated();
        }

        // Remove delegation
        $.delegateeToNodeIds[delegatee].remove(nodeId);
        delete $.nodeIdToDelegatee[nodeId];

        // Emit event for delegation removal
        emit NodeDelegated(nodeId, delegatee, false);
    }

    /**
     * @notice Set the address of the VeChain Nodes contract.
     * @dev This function allows the admin to update the address of the VeChain Nodes contract.
     * @param vechainNodesContract The new address of the VeChain Nodes contract.
     */
    function setVechainNodesContract(
        address vechainNodesContract
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (vechainNodesContract == address(0)) {
            revert AddressCannotBeZero();
        }

        NodeManagementStorage storage $ = _getNodeManagementStorage();

        emit VechainNodeContractSet(address($.vechainNodesContract), vechainNodesContract);
        $.vechainNodesContract = ITokenAuction(vechainNodesContract);
    }

    /**
     * @notice Set the address of the Stargate NFT contract.
     * @dev This function allows the admin to update the address of the Stargate NFT contract.
     * @param stargateNft The new address of the Stargate NFT contract.
     */
    function setStargateNft(address stargateNft) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (stargateNft == address(0)) {
            revert AddressCannotBeZero();
        }

        NodeManagementStorage storage $ = _getNodeManagementStorage();

        emit StargateNftSet(address($.stargateNft), stargateNft);
        $.stargateNft = IStargateNFT(stargateNft);
    }

    // ---------- Getters ---------- //

    /**
     * @notice Retrieves the address of the user managing the node ID endorsement either through ownership or delegation.
     * @dev If the node is delegated, this function returns the delegatee's address. If the node is not delegated, it returns the owner's address.
     * @param nodeId The ID of the node for which the manager address is being retrieved.
     * @return nodeManager The address of the manager of the specified node.
     */
    function getNodeManager(uint256 nodeId) public view returns (address nodeManager) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        (bool nodeExists, ) = exists(nodeId);
        if (!nodeExists) {
            return address(0);
        }

        // If node is delegated, return the delegatee's address
        address delegatee = $.nodeIdToDelegatee[nodeId];
        if (delegatee != address(0)) {
            return delegatee;
        }

        return getNodeOwner(nodeId);
    }

    /**
     * @notice Retrieves the true owner of a node.
     * @dev This function retrieves the owner of a node, either from the VeChainNodes contract or the StargateNFT contract.
     * @dev This function will revert if the node does not exist.
     * @param nodeId The ID of the node to check.
     * @return nodeOwner The address of the owner of the specified node.
     */
    function getNodeOwner(uint256 nodeId) public view returns (address nodeOwner) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();
        (bool nodeExists, VechainNodesDataTypes.NodeSource nodeSource) = exists(nodeId);
        if (!nodeExists) {
            return address(0);
        }

        if (nodeSource == VechainNodesDataTypes.NodeSource.VeChainNodes) {
            return $.vechainNodesContract.idToOwner(nodeId);
        }

        return $.stargateNft.ownerOf(nodeId);
    }

    /**
     * @notice Retrieve the node IDs associated with a user, either through direct ownership or delegation.
     * @dev If a node was burned after the delegation, the id will still be returned in the array.
     * Be sure to check if the node exists before using it.
     * @param user The address of the user to check.
     * @return uint256[] The node IDs associated with the user.
     */
    function getNodeIds(address user) public view returns (uint256[] memory) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        uint256[] memory nodeIds = getNodesDelegatedTo(user);

        // Get the node ID directly owned by the user
        uint256 ownedNodeId = $.vechainNodesContract.ownerToId(user);
        if (ownedNodeId != 0 && $.nodeIdToDelegatee[ownedNodeId] == address(0)) {
            // If the user directly owns a node, add it to the array
            nodeIds = _appendToArray(nodeIds, ownedNodeId);
        }

        // Check also the stargateNft
        uint256[] memory stargateNodeIds = $.stargateNft.idsOwnedBy(user);
        if (stargateNodeIds.length > 0) {
            for (uint256 i; i < stargateNodeIds.length; i++) {
                // do not consider duplicates
                if (
                    stargateNodeIds[i] != 0 && $.nodeIdToDelegatee[stargateNodeIds[i]] == address(0)
                ) {
                    nodeIds = _appendToArray(nodeIds, stargateNodeIds[i]);
                }
            }
        }

        return nodeIds;
    }

    /**
     * @notice Retrieve the node IDs delegated to a user.
     * @param user The address of the user to check.
     * @return uint256[] The node IDs delegated to the user.
     */
    function getNodesDelegatedTo(address user) public view returns (uint256[] memory) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();
        // Get the set of node IDs delegated to the user
        EnumerableSet.UintSet storage nodeIdsSet = $.delegateeToNodeIds[user];

        // Calculate the total number of node IDs
        uint256 count = nodeIdsSet.length();

        // Create an array to hold the node IDs
        uint256[] memory nodeIds = new uint256[](count);
        uint256 validCount = 0;

        // Populate the array with node IDs from the set
        for (uint256 i; i < count; i++) {
            (bool nodeExists, ) = exists(nodeIdsSet.at(i));
            if (!nodeExists) {
                continue;
            }

            nodeIds[validCount++] = nodeIdsSet.at(i);
        }

        // Trim excess slots from array if necessary
        if (validCount < nodeIds.length) {
            assembly {
                mstore(nodeIds, validCount)
            }
        }

        return nodeIds;
    }

    /**
     * @notice Check if a user is holding a specific node ID either directly or through delegation.
     * @param user The address of the user to check.
     * @param nodeId The node ID to check for.
     * @return bool True if the user is holding the node ID and it is a valid node.
     */
    function isNodeManager(address user, uint256 nodeId) public view virtual returns (bool) {
        if (user == address(0)) {
            revert NodeManagementZeroAddress();
        }

        // Will revert if node does not exist
        address nodeManager = getNodeManager(nodeId);

        // If delegatee, or owner, then return true, otherwise false
        return nodeManager == user;
    }

    /**
     * @notice Check if a node is delegated.
     * @param nodeId The node ID to check for.
     * @return bool True if the node is delegated.
     */
    function isNodeDelegated(uint256 nodeId) public view returns (bool) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        (bool nodeExists, ) = exists(nodeId);
        if (!nodeExists) {
            return false;
        }

        return $.nodeIdToDelegatee[nodeId] != address(0);
    }

    /**
     * @notice Check if a user is a delegator.
     * @param user The address of the user to check.
     * @return bool True if the user is a delegator.
     */
    function isNodeDelegator(address user) public view returns (bool) {
        // first we do direct call to check if user is node owner
        uint256 nodeId = getDirectNodeOwnership(user);
        // if it is then we check if node is delegated
        if (nodeId != 0) {
            // if node is delegated then we return true
            return isNodeDelegated(nodeId);
        }

        // otherwise we return false
        return false;
    }

    /**
     * @notice Check if a user is a node holder (either directly or through delegation).
     * @param user The address of the user to check.
     * @return bool True if the user is a node holder.
     */
    function isNodeHolder(address user) public view returns (bool) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        // Check if the user directly owns a node
        if (getDirectNodeOwnership(user) != 0) {
            return true;
        }

        // Check if the user is a delegatee of any node
        uint256[] memory nodeIds = getNodeIds(user);
        for (uint256 i; i < nodeIds.length; i++) {
            if ($.nodeIdToDelegatee[nodeIds[i]] == user) {
                return true;
            }
        }

        return false;
    }

    /**
     * @notice Retrieves detailed information about all of a user's nodes, including owned and delegated nodes.
     * @param user The address of the user to check.
     * @return NodeInfo[] Array of node information structures.
     */
    function getUserNodes(address user) public view returns (NodeInfo[] memory) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        uint256[] memory nodeIds = getNodesDelegatedTo(user);

        // Get the node ID directly owned by the user
        uint256[] memory ownedNodeIds = getDirectNodesOwnership(user);
        // If the user directly owns nodes, append them to the nodeIds array
        if (ownedNodeIds.length > 0) {
            uint256[] memory combinedNodeIds = new uint256[](nodeIds.length + ownedNodeIds.length);
            for (uint256 i; i < nodeIds.length; i++) {
                combinedNodeIds[i] = nodeIds[i];
            }
            for (uint256 j; j < ownedNodeIds.length; j++) {
                combinedNodeIds[nodeIds.length + j] = ownedNodeIds[j];
            }
            nodeIds = combinedNodeIds;
        }

        // Create array to store node information
        NodeInfo[] memory nodesInfo = new NodeInfo[](nodeIds.length);

        // Populate information for each node
        for (uint256 i; i < nodeIds.length; i++) {
            uint256 currentNodeId = nodeIds[i];

            (bool nodeExists, VechainNodesDataTypes.NodeSource nodeSource) = exists(currentNodeId);
            if (!nodeExists) {
                continue;
            }

            address currentNodeOwner = nodeSource == VechainNodesDataTypes.NodeSource.VeChainNodes
                ? $.vechainNodesContract.idToOwner(currentNodeId)
                : $.stargateNft.ownerOf(currentNodeId);

            address currentDelegatee = $.nodeIdToDelegatee[currentNodeId];
            bool isCurrentNodeDelegated = currentDelegatee != address(0);
            bool isNodeOwnedByUser = currentNodeOwner == user;

            nodesInfo[i] = NodeInfo({
                nodeId: currentNodeId,
                nodeLevel: getNodeLevel(currentNodeId),
                xNodeOwner: currentNodeOwner,
                isXNodeHolder: true, // If it's in the nodeIds array, user is either owner or delegatee
                isXNodeDelegated: isCurrentNodeDelegated,
                isXNodeDelegator: isNodeOwnedByUser && isCurrentNodeDelegated,
                isXNodeDelegatee: currentDelegatee == user,
                delegatee: currentDelegatee
            });
        }

        return nodesInfo;
    }

    /**
     * @notice Retrieves the node level of a given node ID.
     * @dev Internal function to get the node level of a token ID. The node level is determined based on the metadata associated with the token ID.
     * @param nodeId The token ID of the endorsing node.
     * @return levelId The node level of the specified token ID.
     */
    function getNodeLevel(uint256 nodeId) public view returns (uint8 levelId) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        (bool nodeExists, VechainNodesDataTypes.NodeSource nodeSource) = exists(nodeId);
        if (!nodeExists) {
            return 0;
        }

        if (nodeSource == VechainNodesDataTypes.NodeSource.VeChainNodes) {
            (, uint8 nodeLevel, , , , , ) = $.vechainNodesContract.getMetadata(nodeId);

            return nodeLevel;
        }

        if (nodeSource == VechainNodesDataTypes.NodeSource.StargateNFT) {
            return $.stargateNft.getTokenLevel(nodeId);
        }
    }

    /**
     * @notice Retrieves the node levels of a user's managed nodes.
     * @dev This function retrieves the node levels of the nodes managed by the specified user, either through ownership or delegation.
     * @param user The address of the user managing the nodes.
     * @return uint8[] The node levels of the nodes managed by the user.
     */
    function getUsersNodeLevels(address user) public view returns (uint8[] memory) {
        // Retrieve the node IDs managed by the specified user
        uint256[] memory nodeIds = getNodeIds(user);

        // Initialize an array to hold the node levels
        uint8[] memory nodeLevels = new uint8[](nodeIds.length);

        // Retrieve the node level for each node ID and store it in the nodeLevels array
        for (uint256 i; i < nodeIds.length; i++) {
            nodeLevels[i] = getNodeLevel(nodeIds[i]);
        }

        // Return the array of node levels
        return nodeLevels;
    }

    /// @notice Check if a node exists in the VeChainNodes contract or the StargateNFT contract
    /// @dev To know if a node exists we need to call first the VeChainNodes contract and
    /// check if the owner is not address(0), then the StargateNFT contract. If it does not exist in both contracts
    /// we return false, otherwise we return true.
    /// @param nodeId The ID of the node to check.
    /// @return bool True if the node exists, false otherwise.
    /// @return NodeSource The source of the node.
    function exists(uint256 nodeId) public view returns (bool, VechainNodesDataTypes.NodeSource) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        address owner = $.vechainNodesContract.idToOwner(nodeId);
        if (owner != address(0)) {
            return (true, VechainNodesDataTypes.NodeSource.VeChainNodes);
        }

        bool existsInStargate = $.stargateNft.tokenExists(nodeId);
        if (existsInStargate) {
            return (true, VechainNodesDataTypes.NodeSource.StargateNFT);
        }

        return (false, VechainNodesDataTypes.NodeSource.None);
    }

    /**
     * @notice Checks if a node is a legacy node (existing in the old vechainNodesContract, or a new node in the stargateNft).
     * @param nodeId The ID of the node to check.
     * @return isLegacy True if the node is a legacy node, false if it is a new node or if the node does not exist.
     */
    function isLegacyNode(uint256 nodeId) public view returns (bool isLegacy) {
        (bool nodeExists, VechainNodesDataTypes.NodeSource nodeSource) = exists(nodeId);
        if (!nodeExists) {
            return false;
        }

        if (nodeSource == VechainNodesDataTypes.NodeSource.VeChainNodes) {
            return true;
        }

        return false;
    }

    /**
     * @notice Check if a user directly owns a node (not delegated).
     * @dev For compatibility issues we return only the first node owned by the user in the StargateNFT contract, even if
     * the user could have multiple nodes. Use the getDirectNodesOwnership() for a better implementation.
     * @param user The address of the user to check.
     * @return uint256 The ID of the owned node (0 if none). If the user has multiple nodes, the first one is returned.
     */
    function getDirectNodeOwnership(address user) public view returns (uint256) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();
        uint256 nodeId = $.vechainNodesContract.ownerToId(user);
        if (nodeId != 0) {
            return nodeId;
        }

        // If no id returned from the vechainNodesContract, we check the stargateNft
        uint256[] memory nodeIds = $.stargateNft.idsOwnedBy(user);
        if (nodeIds.length > 0) {
            return nodeIds[0];
        }

        // If no id returned from the stargateNft, we return 0
        return 0;
    }

    /**
     * @notice Retrieves the node IDs directly owned by a user.
     * @param user The address of the user to check.
     * @return uint256[] The node IDs directly owned by the user. If no nodes are owned, an empty array is returned.
     */
    function getDirectNodesOwnership(address user) public view returns (uint256[] memory) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        uint256 legacyNodeId = $.vechainNodesContract.ownerToId(user);
        uint256[] memory nodeIds = $.stargateNft.idsOwnedBy(user);

        // Calculate the correct size - if legacyNodeId is not 0, add 1 to the array length
        uint256 totalLength = nodeIds.length;
        if (legacyNodeId != 0) {
            totalLength += 1;
        }

        uint256[] memory userOwnedNodes = new uint256[](totalLength);

        // Fill the array with the node IDs
        uint256 currentIndex = 0;
        if (legacyNodeId != 0) {
            userOwnedNodes[currentIndex] = legacyNodeId;
            currentIndex++;
        }

        // Add Stargate NFT nodes
        for (uint256 i; i < nodeIds.length; i++) {
            userOwnedNodes[currentIndex + i] = nodeIds[i];
        }

        return userOwnedNodes;
    }

    /**
     * @notice Returns all tokens associated with a user, including owned and delegated ones.
     * @dev This function retrieves only tokens that have been migrated to the new Stargate NFT contract.
     * @param user The user address to query.
     * @return tokens An array of DataTypes.Token structs owned or delegated to the user.
     */
    function getUserStargateNFTsInfo(
        address user
    ) public view returns (DataTypes.Token[] memory tokens) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        // Fetch owned tokens directly in a single call
        DataTypes.Token[] memory ownedTokens = $.stargateNft.tokensOwnedBy(user);
        uint256 ownedLength = ownedTokens.length;

        // Get delegated token IDs (may include burned tokens)
        EnumerableSet.UintSet storage delegatedSet = $.delegateeToNodeIds[user];
        uint256 delegatedLength = delegatedSet.length();

        // Allocate maximum size (owned + delegated), will shrink later
        tokens = new DataTypes.Token[](ownedLength + delegatedLength);
        uint256 count;

        // Copy owned tokens
        for (uint256 i; i < ownedLength; ++i) {
            if ($.nodeIdToDelegatee[ownedTokens[i].tokenId] == address(0))
                tokens[count++] = ownedTokens[i];
        }

        // Fetch delegated tokens (handle burned/missing tokens via try/catch)
        for (uint256 i; i < delegatedLength; ++i) {
            uint256 tokenId = delegatedSet.at(i);
            if (!$.stargateNft.tokenExists(tokenId)) {
                continue;
            }

            tokens[count++] = $.stargateNft.getToken(tokenId);
        }

        // Trim excess slots from array if necessary
        if (count < tokens.length) {
            assembly {
                mstore(tokens, count)
            }
        }

        return tokens;
    }

    /**
     * @notice Checks if a user is the direct owner of a node.
     * @param user The address of the user to check.
     * @param nodeId The ID of the node to check.
     * @return isOwner True if the user is the direct owner of the node, false otherwise.
     */
    function isDirectNodeOwner(address user, uint256 nodeId) public view returns (bool isOwner) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();

        (bool tokenExists, VechainNodesDataTypes.NodeSource nodeType) = exists(nodeId);

        if (!tokenExists) {
            return false;
        }

        if (nodeType == VechainNodesDataTypes.NodeSource.VeChainNodes) {
            return user == $.vechainNodesContract.idToOwner(nodeId);
        }

        if (nodeType == VechainNodesDataTypes.NodeSource.StargateNFT) {
            return user == $.stargateNft.ownerOf(nodeId);
        }
    }

    /**
     * @notice Returns the Vechain node contract instance.
     * @return ITokenAuction The instance of the Vechain node contract.
     */
    function getVechainNodesContract() external view returns (ITokenAuction) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();
        return $.vechainNodesContract;
    }

    /**
     * @notice Returns the Stargate NFT contract instance.
     * @return IStargateNFT The instance of the Stargate NFT contract.
     */
    function getStargateNft() external view returns (IStargateNFT) {
        NodeManagementStorage storage $ = _getNodeManagementStorage();
        return $.stargateNft;
    }

    /**
     * @notice Retrieves the current version of the contract.
     * @return string The current version of the contract.
     */
    function version() external pure virtual returns (string memory) {
        return "3";
    }

    // ---------- Internal ---------- //

    /**
     * @notice Appends an element to an array.
     * @dev Internal function to append an element to an array.
     * @param array The array to append to.
     * @param element The element to append.
     * @return uint256[] The new array with the appended element.
     */
    function _appendToArray(
        uint256[] memory array,
        uint256 element
    ) internal pure returns (uint256[] memory) {
        uint256[] memory newArray = new uint256[](array.length + 1);
        for (uint256 i; i < array.length; i++) {
            newArray[i] = array[i];
        }
        newArray[array.length] = element;
        return newArray;
    }

    /**
     * @notice Authorize the upgrade to a new implementation.
     * @dev Internal function to authorize the upgrade to a new contract implementation. This function is restricted to addresses with the upgrader role.
     * @param newImplementation The address of the new contract implementation.
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal virtual override onlyRole(UPGRADER_ROLE) {}
}
