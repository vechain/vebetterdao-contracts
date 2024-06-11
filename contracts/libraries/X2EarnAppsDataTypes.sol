// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library X2EarnAppsDataTypes {
  struct App {
    bytes32 id;
    address receiverAddress;
    string name;
    string metadataURI;
    uint256 createdAtTimestamp;
  }
}
