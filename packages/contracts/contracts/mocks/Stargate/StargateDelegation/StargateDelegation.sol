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

import {IStargateDelegation} from "../interfaces/IStargateDelegation.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Time} from "@openzeppelin/contracts/utils/types/Time.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IStargateNFT} from "../interfaces/IStargateNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title StargateDelegation
/// @notice This contract allows a user that owns a StargateNFT to start delegating, accumulate VTHO rewards during the delegation period and exit delegation.
/// The term "delegation" is used in the context of the Hayabusa protocol hardfork, when a user will delegate their staked VET to a validator.
/// This contract, though, is used to simulate the delegation process, so it's not used in the Hayabusa protocol, and VET are not transferred.
///
/// The contract will be filled with VTHO by the Foundation, and each NFT level will accumulate VTHO rewards at a different rate.
/// When a user starts delegating, the contract will lock the NFT (done in the StargateNFT contract by calling the isDelegationActive function) and
/// start accumulating rewards based on the NFT level.
/// When a user exits delegation, the contract will unlock the NFT and stop accumulating rewards.
///
/// Each delegation follows a delegationPeriod, which is set by the admin and is the same for all NFTs,
/// and it serves two main purposes:
/// 1. It defines a mandatory minimum duration for delegation (users can't exit before this period ends)
/// 2. It creates boundaries for when rewards can be claimed (only for completed periods)
///
/// The rewards are accumulated in the contract and can be claimed by the user at any time.
///
/// The contract is UUPS upgradable and AccessControl protected.
contract StargateDelegation is
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IStargateDelegation
{
    using SafeERC20 for IERC20;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ---------- Storage ------------ //

    struct StargateDelegationStorage {
        // external contracts
        IStargateNFT stargateNFT;
        IERC20 vthoToken;
        // contract settings
        mapping(uint256 levelId => uint256) vthoRewardPerBlock;
        uint256 delegationPeriod;
        uint256 rewardsAccumulationEndBlock; // after this block no one can accumulate rewards anymore
        // delegation parameters
        mapping(uint256 tokenId => uint256) rewardsAccumulationStartBlock; // block when the user can start accumulating rewards
        mapping(uint256 tokenId => uint256) delegationEndBlock; // block number when the user wants to end the delegation, it will be INFINITY if the user wants to delegate forever
    }

    // keccak256(abi.encode(uint256(keccak256("storage.StargateDelegation")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant StargateDelegationStorageLocation =
        0x1f4ebdcee447b4955d797076b2bbe9eaa6ae7665ae386dd37cbd5682712f9100;

    function _getStargateDelegationStorage()
        private
        pure
        returns (StargateDelegationStorage storage $)
    {
        assembly {
            $.slot := StargateDelegationStorageLocation
        }
    }

    /// @notice Returns the version of the contract, manually updated with each upgrade
    /// @return version - the version of the contract
    function version() public pure returns (uint256) {
        return 1;
    }

    struct StargateDelegationInitParams {
        address upgrader;
        address admin;
        address operator;
        address stargateNFT;
        address vthoToken;
        VthoRewardPerBlock[] vthoRewardPerBlock;
        uint256 delegationPeriod;
    }

    struct VthoRewardPerBlock {
        uint256 levelId;
        uint256 rewardPerBlock;
    }

    /// @notice Initializes the contract
    function initialize(StargateDelegationInitParams memory _initParams) external initializer {
        // Validate the input addresses are not zero
        if (
            _initParams.upgrader == address(0) ||
            _initParams.admin == address(0) ||
            _initParams.operator == address(0) ||
            _initParams.stargateNFT == address(0) ||
            _initParams.vthoToken == address(0)
        ) {
            revert AddressCannotBeZero();
        }

        // Validate the vthoRewardPerBlock array
        if (_initParams.vthoRewardPerBlock.length == 0) {
            revert ArrayCannotBeEmpty();
        }

        // Validate the delegationPeriod duration
        if (_initParams.delegationPeriod == 0) {
            revert InvalidDelegationPeriod();
        }

        // Initialize the contract
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        // Grant the roles to the admin and upgrader
        _grantRole(UPGRADER_ROLE, _initParams.upgrader);
        _grantRole(DEFAULT_ADMIN_ROLE, _initParams.admin);
        _grantRole(OPERATOR_ROLE, _initParams.operator);

        // Initialize storage
        StargateDelegationStorage storage $ = _getStargateDelegationStorage();
        $.stargateNFT = IStargateNFT(_initParams.stargateNFT);
        $.vthoToken = IERC20(_initParams.vthoToken);
        $.delegationPeriod = _initParams.delegationPeriod;

        // Initialize the vtho reward per block per NFT level
        for (uint256 i; i < _initParams.vthoRewardPerBlock.length; i++) {
            // All levels must have a reward rate greater than 0.
            if (_initParams.vthoRewardPerBlock[i].rewardPerBlock == 0) {
                revert InvalidVthoRewardPerBlock(
                    _initParams.vthoRewardPerBlock[i].levelId,
                    _initParams.vthoRewardPerBlock[i].rewardPerBlock
                );
            } else {
                $.vthoRewardPerBlock[_initParams.vthoRewardPerBlock[i].levelId] = _initParams
                    .vthoRewardPerBlock[i]
                    .rewardPerBlock;
            }
        }
    }

    // ---------- Modifiers ------------ //

    /// @notice Modifier to check if the user has the required role or is the DEFAULT_ADMIN_ROLE
    /// @param role - the role to check
    modifier onlyRoleOrAdmin(bytes32 role) {
        if (!hasRole(role, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedUser(msg.sender);
        }
        _;
    }

    // ---------- Authorizers ---------- //

    /// @notice Authorizes the upgrade of the contract
    /// @param newImplementation - the new implementation address
    function _authorizeUpgrade(
        address newImplementation
    ) internal virtual override onlyRole(UPGRADER_ROLE) {}

    // ---------- Setters ---------- //

    /// @notice Starts the delegation (used as a simulation for the Hayabusa hardfork) of an NFT during the Hayabusa hardfork on VeChainThor.
    /// Calling this function will lock the NFT in the StargateNFT contract (disabling transfers),
    /// and start accumulating rewards based on the NFT level.
    /// User can decide to delegate forever or only for the next delegationPeriod.
    /// @dev This function can be called by the owner of the NFT or by the StargateNFT contract when
    /// doing a stakeAndDelegate() or migrateAndDelegate()
    /// @dev Only the owner of the NFT can call this function.
    /// @param _tokenId - the tokenId of the NFT
    /// @param _delegateForever - true if the user wants to delegate forever, false otherwise
    function delegate(uint256 _tokenId, bool _delegateForever) external nonReentrant {
        StargateDelegationStorage storage $ = _getStargateDelegationStorage();

        // Check if user owns the NFT or if it's the StargateNFT contract calling the function
        // Eg: user calls stakeAndDelegate() from the StargateNFT contract
        address owner = $.stargateNFT.ownerOf(_tokenId);
        if (owner != msg.sender && msg.sender != address($.stargateNFT)) {
            revert UnauthorizedUser(msg.sender);
        }

        // If rewards accumulation period ended, we can't delegate
        if ($.rewardsAccumulationEndBlock != 0 && clock() >= $.rewardsAccumulationEndBlock) {
            revert RewardsAccumulationPeriodEnded();
        }

        // Validate the NFT is not already delegated
        if (isDelegationActive(_tokenId)) {
            revert NFTAlreadyDelegated(_tokenId);
        }

        // If user has not claimed his previous rewards, claim them,
        // so we can erase the states (delegationEndBlock, rewardsAccumulationStartBlock)
        // of the previous delegation safely
        if (claimableRewards(_tokenId) > 0) {
            _claimRewards(_tokenId);
        }

        // Check if the NFT level has a reward rate set
        uint256 levelId = $.stargateNFT.getTokenLevel(_tokenId);
        if ($.vthoRewardPerBlock[levelId] == 0) {
            revert InvalidNFTLevel(_tokenId, levelId);
        }

        // Store the block when the user can start accumulating rewards: if NFT is under maturity period,
        // then the user can start accumulating rewards after the maturity period ends, otherwise it can start accumulating rewards immediately
        $.rewardsAccumulationStartBlock[_tokenId] = $.stargateNFT.isUnderMaturityPeriod(_tokenId)
            ? $.stargateNFT.maturityPeriodEndBlock(_tokenId)
            : clock();

        // Store the block when the user will exit the delegation
        $.delegationEndBlock[_tokenId] = _delegateForever
            ? type(uint256).max
            : $.rewardsAccumulationStartBlock[_tokenId] + $.delegationPeriod;

        emit DelegationSimulationStarted(
            _tokenId,
            owner,
            $.rewardsAccumulationStartBlock[_tokenId],
            _delegateForever,
            msg.sender
        );
    }

    /// @notice Exits the delegation of an NFT during the Hayabusa hardfork on VeChainThor
    /// Calling this function will unlock the NFT at the end of the current delegationPeriod, and stop accumulating rewards.
    /// This action is irreversible. Designed to be a one-way switch: once a user submits the request, the NFT’s delegation is
    /// scheduled to end and the only way to resume delegating is to call delegate again after the exit has been processed.
    /// @dev Only the owner of the NFT can call this function.
    /// @param _tokenId - the tokenId of the NFT
    function requestDelegationExit(uint256 _tokenId) external nonReentrant {
        StargateDelegationStorage storage $ = _getStargateDelegationStorage();

        if ($.stargateNFT.ownerOf(_tokenId) != msg.sender) {
            revert UnauthorizedUser(msg.sender);
        }

        if (!isDelegationActive(_tokenId)) {
            revert NFTNotDelegated(_tokenId);
        }

        // If we've reached the accumulation end block (end of Stargate Simulation period), allow immediate exit
        // even if the user already requested to exit delegation before
        uint256 currentBlock = clock();
        if ($.rewardsAccumulationEndBlock != 0 && currentBlock >= $.rewardsAccumulationEndBlock) {
            $.delegationEndBlock[_tokenId] = currentBlock;
            emit DelegationExitRequested(_tokenId, currentBlock);
            return;
        }

        // If the user already requested to exit delegation, we revert, avoiding redundant calls
        if ($.delegationEndBlock[_tokenId] != type(uint256).max) {
            revert DelegationExitAlreadyRequested();
        }

        // Set the delegationEndBlock to the block after the end of the current delegationPeriod
        $.delegationEndBlock[_tokenId] = currentDelegationPeriodEndBlock(_tokenId) + 1;
        emit DelegationExitRequested(_tokenId, $.delegationEndBlock[_tokenId]);
    }

    /// @notice Claims the rewards for a given NFT
    /// @dev Rewards claiming can be triggered by anyone, but the rewards will be sent to the owner of the NFT.
    /// @param _tokenId - the tokenId of the NFT
    function claimRewards(uint256 _tokenId) public nonReentrant {
        _claimRewards(_tokenId);
    }

    /// @notice Internal function to claim the rewards for a given NFT
    /// @dev This function is used to claim the rewards for a given NFT
    /// @param _tokenId - the tokenId of the NFT
    function _claimRewards(uint256 _tokenId) internal {
        StargateDelegationStorage storage $ = _getStargateDelegationStorage();

        // Get the amount of rewards that the user can claim
        uint256 amountToClaim = claimableRewards(_tokenId);
        if (amountToClaim == 0) {
            revert NoRewardsToClaim(_tokenId);
        }

        // Check if the contract has enough VTHO balance to send the rewards
        if ($.vthoToken.balanceOf(address(this)) < amountToClaim) {
            revert InsufficientVthoBalanceForRewardsClaim(
                $.vthoToken.balanceOf(address(this)),
                amountToClaim
            );
        }

        // Update start block for rewards accumulation
        $.rewardsAccumulationStartBlock[_tokenId] = clock();

        // Send the rewards to the owner of the NFT and revert if it fails
        address recipient = $.stargateNFT.ownerOf(_tokenId);
        $.vthoToken.safeTransfer(recipient, amountToClaim);

        emit DelegationRewardsClaimed(_tokenId, amountToClaim, msg.sender, recipient);
    }

    // ---------- Admin Setters ---------- //

    /// @notice Sets the vtho reward per block per each NFT level for all levels
    /// @dev Only the admin can call this function, and this function will erase all existing levels
    /// This value will be used to calculate all unclaimed rewards, so messing with those values could
    /// lead to incorrect or unfair rewards calculations, use with caution.
    /// @param _vthoRewardPerBlock - the vtho reward per block per each NFT level
    function setVthoRewardPerBlockForAllLevels(
        VthoRewardPerBlock[] memory _vthoRewardPerBlock
    ) external onlyRoleOrAdmin(OPERATOR_ROLE) {
        // Validate the vthoRewardPerBlock array
        if (_vthoRewardPerBlock.length == 0) {
            revert ArrayCannotBeEmpty();
        }
        for (uint256 i; i < _vthoRewardPerBlock.length; i++) {
            if (_vthoRewardPerBlock[i].rewardPerBlock == 0) {
                revert InvalidVthoRewardPerBlock(
                    _vthoRewardPerBlock[i].levelId,
                    _vthoRewardPerBlock[i].rewardPerBlock
                );
            } else {
                // Update the vtho reward per block per each NFT level
                _getStargateDelegationStorage().vthoRewardPerBlock[
                    _vthoRewardPerBlock[i].levelId
                ] = _vthoRewardPerBlock[i].rewardPerBlock;
            }
        }
    }

    /// @notice Sets the vtho reward per block per each NFT level for a given level
    /// @dev Only the admin can call this function.
    /// This value will be used to calculate all unclaimed rewards, so messing with those values could
    /// lead to incorrect or unfair rewards calculations, use with caution.
    /// @param _level - the level of the NFT
    /// @param _vthoRewardPerBlock - the vtho reward per block
    function setVthoRewardPerBlockForLevel(
        uint256 _level,
        uint256 _vthoRewardPerBlock
    ) external onlyRoleOrAdmin(OPERATOR_ROLE) {
        _getStargateDelegationStorage().vthoRewardPerBlock[_level] = _vthoRewardPerBlock;
    }

    /// @notice Sets the rewards accumulation end block.
    /// @dev Only the operator can call this function
    /// @dev This function will be used to stop the rewards accumulation for all the NFTs
    /// that are currently in delegation. If it is reset to 0 and someone is still delegating,
    /// the contract will recalculate the rewards until the current block. Reset with caution.
    /// @param _rewardsAccumulationEndBlock - the rewards accumulation end block
    function setRewardsAccumulationEndBlock(
        uint256 _rewardsAccumulationEndBlock
    ) external onlyRoleOrAdmin(OPERATOR_ROLE) {
        _getStargateDelegationStorage().rewardsAccumulationEndBlock = _rewardsAccumulationEndBlock;
        emit RewardsAccumulationEndBlockSet(_rewardsAccumulationEndBlock);
    }

    // ---------- Getters ---------- //

    /// @dev Clock used for flagging checkpoints.
    function clock() public view virtual returns (uint48) {
        return Time.blockNumber();
    }

    /// @dev Returns the mode of the clock.
    function CLOCK_MODE() public view virtual returns (string memory) {
        return "mode=blocknumber&from=default";
    }

    /// @notice Returns the VTHO token address
    /// @return vtho - the VTHO token
    function getVthoToken() external view returns (IERC20) {
        return _getStargateDelegationStorage().vthoToken;
    }

    /// @notice Returns the stargateNFT address
    /// @return stargateNFT - the stargateNFT address
    function getStargateNFTContract() external view returns (IStargateNFT) {
        return _getStargateDelegationStorage().stargateNFT;
    }

    /// @notice Returns the vtho reward per block per each NFT level
    /// @return vthoRewardPerBlock - the vtho reward per block per each NFT level
    function getVthoRewardsPerBlock()
        external
        view
        returns (VthoRewardPerBlock[] memory vthoRewardPerBlock)
    {
        StargateDelegationStorage storage $ = _getStargateDelegationStorage();

        // call the stargateNFT contract to get the list of level ids
        uint8[] memory levelIds = $.stargateNFT.getLevelIds();

        // loop through the level ids and get the vtho reward per block for each level
        vthoRewardPerBlock = new VthoRewardPerBlock[](levelIds.length);
        for (uint256 i; i < levelIds.length; i++) {
            vthoRewardPerBlock[i] = VthoRewardPerBlock({
                levelId: levelIds[i],
                rewardPerBlock: $.vthoRewardPerBlock[levelIds[i]]
            });
        }
    }

    /// @notice Returns the vtho reward per block per each NFT level for a given level
    /// @param _level - the level of the NFT
    /// @return vthoRewardPerBlock - the vtho reward per block per each NFT level for a given level
    function getVthoRewardPerBlock(uint256 _level) external view returns (uint256) {
        return _getStargateDelegationStorage().vthoRewardPerBlock[_level];
    }

    /// @notice Returns the delegationPeriod duration
    /// @return delegationPeriod - the delegationPeriod duration
    function getDelegationPeriod() external view returns (uint256) {
        return _getStargateDelegationStorage().delegationPeriod;
    }

    /// @notice Returns the rewards accumulation end block
    /// @return rewardsAccumulationEndBlock - the rewards accumulation end block
    function getRewardsAccumulationEndBlock() external view returns (uint256) {
        return _getStargateDelegationStorage().rewardsAccumulationEndBlock;
    }

    /// @notice Returns if the NFT is locked, which is true only if the user is currently simulating delegation,
    /// which means that the current block number is higher than the delegationEndBlock
    /// @param _tokenId - the tokenId of the NFT
    /// @return isLocked - true if the NFT is locked, false otherwise
    function isDelegationActive(uint256 _tokenId) public view returns (bool) {
        return _getStargateDelegationStorage().delegationEndBlock[_tokenId] > clock();
    }

    /// @notice Returns the block when the user can start accumulating rewards for a given NFT
    /// @param _tokenId - the tokenId of the NFT
    /// @return rewardsAccumulationStartBlock - the block when the user can start accumulating rewards
    function getRewardsAccumulationStartBlock(uint256 _tokenId) external view returns (uint256) {
        return _getStargateDelegationStorage().rewardsAccumulationStartBlock[_tokenId];
    }

    /// @notice Returns the delegation end block for a given NFT
    /// @param _tokenId - the tokenId of the NFT
    /// @return delegationEndBlock - the delegation end block
    function getDelegationEndBlock(uint256 _tokenId) external view returns (uint256) {
        return _getStargateDelegationStorage().delegationEndBlock[_tokenId];
    }

    /// @notice Returns the end block of the current delegationPeriod for a given NFT
    /// Every tokenId's delegationPeriod starts when the user starts to delegate and ends after a duration of delegationPeriod blocks.
    /// To retrieve the end block of the current delegationPeriod for a given NFT, we:
    /// 1. If the NFT is still in maturity period, simply returns maturityEndBlock + delegationPeriod
    /// 2. For NFTs past maturity, calculates which delegationPeriod we're in based on blocks passed since accumulation started
    ///
    /// Eg: delegationPeriod is 10 blocks, user starts delegating at block 1, maturity period ends at block 5 (accumulation start), then:
    /// At block 2: returns 15 (maturity end + delegationPeriod = 5 + 10)
    /// At block 6: returns 15 (accumulation start + 1 delegationPeriod = 5 + 10)
    /// At block 11: returns 15 (accumulation start + 1 delegationPeriod = 5 + 10)
    /// At block 55: returns 65 (accumulation start + 5 delegationPeriod = 5 + 60)
    /// @param _tokenId - the tokenId of the NFT
    /// @return delegationPeriodEndBlock - the end block of the current delegationPeriod
    function currentDelegationPeriodEndBlock(uint256 _tokenId) public view returns (uint256) {
        if (!isDelegationActive(_tokenId)) {
            revert NFTNotDelegated(_tokenId);
        }

        StargateDelegationStorage storage $ = _getStargateDelegationStorage();

        // If the NFT is still under the maturity period, return the maturity period end block + delegationPeriod
        if ($.stargateNFT.isUnderMaturityPeriod(_tokenId)) {
            return $.stargateNFT.maturityPeriodEndBlock(_tokenId) + $.delegationPeriod;
        }

        // Calculate blocks passed since accumulation start
        uint256 blocksSinceAccumulationStart = clock() - $.rewardsAccumulationStartBlock[_tokenId];

        uint256 completedDelegationPeriods = blocksSinceAccumulationStart / $.delegationPeriod;

        return
            $.rewardsAccumulationStartBlock[_tokenId] +
            ((completedDelegationPeriods + 1) * $.delegationPeriod);
    }

    /// @notice Returns the claimable rewards for a given NFT
    /// @dev Rewards are calculated using the formula:
    /// rewards = rewardRate * (lastDelegationPeriodEndBlock - lastClaimBlock)
    /// where rewardRate is determined by the NFT's level.
    /// Rewards are only claimable up to the current delegationPeriod boundary.
    ///
    /// The calculation follows these steps:
    /// 1. Calculates how many delegationPeriods have been completed since delegation started
    /// 2. Determines the exact block number where the last delegationPeriod completed
    /// 3. Calculate raw rewards based on blocks passed
    ///
    /// Eg: delegationPeriod is 10 blocks, user starts delegating at block 1, we are in bock 15, then
    /// claimable rewards are the rewards user accumulated from block 1 until block 10.
    /// Every time user claims rewards, we update the lastClaimBlock for the NFT, so if user
    /// calls this function at block 16, then the claimable rewards are 0.
    /// @param _tokenId - the tokenId of the NFT
    /// @return claimableRewards - the claimable rewards
    function claimableRewards(uint256 _tokenId) public view returns (uint256) {
        StargateDelegationStorage storage $ = _getStargateDelegationStorage();

        uint256 currentBlock = clock();

        // If current block is before delegation start (because of the maturity period), there are no rewards
        if (currentBlock < $.rewardsAccumulationStartBlock[_tokenId]) {
            return 0;
        }

        // Calculate the last completed delegationPeriod block
        uint256 blocksSinceAccumulationStart = currentBlock -
            $.rewardsAccumulationStartBlock[_tokenId];
        uint256 completedDelegationPeriods = blocksSinceAccumulationStart / $.delegationPeriod;

        // If no delegationPeriods completed yet, return 0
        if (completedDelegationPeriods == 0) {
            return 0;
        }

        // slither-disable-next-line divide-before-multiply -- Intentional truncation to find last completed period boundary
        uint256 lastCompletedDelegationPeriodBlock = $.rewardsAccumulationStartBlock[_tokenId] +
            (completedDelegationPeriods * $.delegationPeriod);

        // Determine the end block for reward calculation
        uint256 endBlock = isDelegationActive(_tokenId)
            ? lastCompletedDelegationPeriodBlock
            : $.delegationEndBlock[_tokenId];

        // If we reached the block when the contract stops allowing rewards accumulation,
        // we use the rewards accumulation end block as the end block for reward calculation
        uint256 rewardsAccumulationEndBlock = $.rewardsAccumulationEndBlock;
        if (endBlock > rewardsAccumulationEndBlock && rewardsAccumulationEndBlock != 0) {
            endBlock = rewardsAccumulationEndBlock;
        }

        return _calculateRewards($, _tokenId, endBlock);
    }

    /// @notice Returns the accumulated rewards for a given NFT
    /// Differently from claimableRewards, this function returns the sum of all the rewards that the user has accumulated since the last claim,
    /// without taking into accounts delegationPeriod duration.
    /// eg: delegationPeriod is 10 blocks, user starts delegating at block 1, we are in bock 15, then
    /// accumulated rewards are the rewards user accumulated since block 1 until block 15, even if
    /// the actual claimable rewards are the ones until block 10.
    /// @param _tokenId - the tokenId of the NFT
    /// @return accumulatedRewards - the accumulated rewards
    function accumulatedRewards(uint256 _tokenId) public view returns (uint256) {
        StargateDelegationStorage storage $ = _getStargateDelegationStorage();

        // Determine the end block for reward calculation
        uint256 endBlock = isDelegationActive(_tokenId) ? clock() : $.delegationEndBlock[_tokenId];

        // If we reached the block when the contract stops allowing rewards accumulation,
        // we use the rewards accumulation end block as the end block for reward calculation
        if (endBlock > $.rewardsAccumulationEndBlock && $.rewardsAccumulationEndBlock != 0) {
            endBlock = $.rewardsAccumulationEndBlock;
        }

        return _calculateRewards($, _tokenId, endBlock);
    }

    /// @notice Internal function to calculate the rewards for a given NFT and a given end block
    /// @param _tokenId - the tokenId of the NFT
    /// @param _endBlock - the end block for reward calculation
    /// @return rewards - the rewards
    function _calculateRewards(
        StargateDelegationStorage storage $,
        uint256 _tokenId,
        uint256 _endBlock
    ) internal view returns (uint256) {
        uint256 lastClaimBlock = $.rewardsAccumulationStartBlock[_tokenId];

        // If end block is less than or equal to last claim block, no rewards
        if (_endBlock <= lastClaimBlock) {
            return 0;
        }

        // If rewardsAccumulationEndBlock is set and the last claim happened after it,
        // then no more rewards should accumulate
        if ($.rewardsAccumulationEndBlock != 0 && lastClaimBlock >= $.rewardsAccumulationEndBlock) {
            return 0;
        }

        // Get the NFT level
        uint256 levelId = $.stargateNFT.getTokenLevel(_tokenId);

        // Calculate the rewards based on the blocks that passed since the last claim
        uint256 rewardRate = $.vthoRewardPerBlock[levelId];
        uint256 blocksPassed = _endBlock - lastClaimBlock;

        if (rewardRate == 0 || blocksPassed == 0) {
            return 0;
        }

        return rewardRate * blocksPassed;
    }

    /// @notice Returns the details of the delegation for a given NFT
    /// @param _tokenId - the tokenId of the NFT
    /// @return isDelegationActive - true if the delegation is active, false otherwise
    /// @return claimableRewards - the claimable rewards
    /// @return rewardsAccumulationStartBlock - the block when the rewards accumulation started
    /// @return delegationEndBlock - the block when the delegation ends
    function getDelegationDetails(
        uint256 _tokenId
    ) external view returns (bool, uint256, uint256, uint256) {
        StargateDelegationStorage storage $ = _getStargateDelegationStorage();

        return (
            isDelegationActive(_tokenId),
            claimableRewards(_tokenId),
            $.rewardsAccumulationStartBlock[_tokenId],
            $.delegationEndBlock[_tokenId]
        );
    }
}
