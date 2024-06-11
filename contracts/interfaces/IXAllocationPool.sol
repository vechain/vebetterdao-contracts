// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IXAllocationPool {
  event AllocationRewardsClaimed(
    bytes32 indexed appId,
    uint256 roundId,
    uint256 amount,
    address indexed recipient,
    address caller,
    uint256 unallocatedAmount
  );

  function currentRoundEarnings(bytes32 appId) external view returns (uint256);

  function claimableAmount(uint256 roundId, bytes32 appId) external view returns (uint256, uint256);

  function roundEarnings(uint256 roundId, bytes32 appId) external view returns (uint256, uint256);

  function baseAllocationAmount(uint256 roundId) external view returns (uint256);

  function getAppShares(uint256 roundId, bytes32 appId) external view returns (uint256, uint256);

  function getMaxAppAllocation(uint256 roundId) external view returns (uint256);

  function version() external view returns (string memory);
}
