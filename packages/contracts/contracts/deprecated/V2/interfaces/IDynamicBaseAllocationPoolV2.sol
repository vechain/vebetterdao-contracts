// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

interface IDynamicBaseAllocationPoolV2 {
  event FundsDistributedToApp(bytes32 indexed appId, uint256 amount, uint256 indexed roundId);

  function canDistributeDBARewards(uint256 _roundId) external view returns (bool);

  function distributeDBARewards(uint256 _roundId, bytes32[] memory _appIds) external;

  function fundsForRound(uint256 _roundId) external view returns (uint256);

  function isDBARewardsDistributed(uint256 _roundId) external view returns (bool);

  function distributionStartRound() external view returns (uint256);

  function dbaRoundRewardsForApp(uint256 _roundId, bytes32 _appId) external view returns (uint256);
}
