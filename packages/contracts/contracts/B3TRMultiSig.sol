// SPDX-License-Identifier: MIT

//                                      #######
//                                 ################
//                               ####################
//                             ###########   #########
//                            #########      #########
//          #######          #########       #########
//          #########       #########      ##########
//           ##########     ########     ####################
//            ##########   #########  #########################
//              ################### ############################
//               #################  ##########          ########
//                 ##############      ###              ########
//                  ############                       #########
//                    ##########                     ##########
//                     ########                    ###########
//                       ###                    ############
//                                          ##############
//                                    #################
//                                   ##############
//                                   #########

pragma solidity 0.8.20;

/// @title MultiSigWallet
contract B3TRMultiSig {
  // Events
  event Submission(uint256 indexed transactionId);
  event Confirmation(address indexed sender, uint256 indexed transactionId);
  event Revocation(address indexed sender, uint256 indexed transactionId);
  event Execution(uint256 indexed transactionId);
  event ExecutionFailure(uint256 indexed transactionId);
  event OwnerAdded(address indexed owner);
  event OwnerRemoved(address indexed owner);
  event RequirementChanged(uint256 required);

  // Constants
  uint256 public constant MAX_OWNER_COUNT = 50;

  // State
  address[] public owners;
  mapping(address => bool) public isOwner;
  uint256 public required;
  Transaction[] public transactions;
  mapping(uint256 => mapping(address => bool)) public confirmations;

  struct Transaction {
    address destination;
    uint256 value;
    bytes data;
    bool executed;
  }

  // Modifiers
  modifier onlyWallet() {
    require(msg.sender == address(this), "Only wallet can call");
    _;
  }

  modifier ownerExists(address owner) {
    require(isOwner[owner], "Owner does not exist");
    _;
  }

  modifier ownerDoesNotExist(address owner) {
    require(!isOwner[owner], "Owner already exists");
    _;
  }

  modifier transactionExists(uint256 txId) {
    require(txId < transactions.length, "Transaction does not exist");
    _;
  }

  modifier confirmed(uint256 txId, address owner) {
    require(confirmations[txId][owner], "Transaction not confirmed");
    _;
  }

  modifier notConfirmed(uint256 txId, address owner) {
    require(!confirmations[txId][owner], "Transaction already confirmed");
    _;
  }

  modifier notExecuted(uint256 txId) {
    require(!transactions[txId].executed, "Transaction already executed");
    _;
  }

  modifier validRequirement(uint256 ownerCount, uint256 _required) {
    require(
      ownerCount > 0 && _required > 0 && _required <= ownerCount && ownerCount <= MAX_OWNER_COUNT,
      "Invalid requirements"
    );
    _;
  }

  // Constructor
  constructor(address[] memory _owners, uint256 _required) validRequirement(_owners.length, _required) {
    for (uint256 i = 0; i < _owners.length; i++) {
      address owner = _owners[i];
      require(owner != address(0), "Zero address");
      require(!isOwner[owner], "Duplicate owner");
      isOwner[owner] = true;
      owners.push(owner);
    }
    required = _required;
  }

  // Fallback to accept VET
  receive() external payable {}

  // @notice Fallback function to handle incoming VET when data is sent
  fallback() external payable {}

  // Wallet logic
  function submitTransaction(
    address destination,
    uint256 value,
    bytes calldata data
  ) external ownerExists(msg.sender) returns (uint256 txId) {
    txId = transactions.length;
    transactions.push(Transaction({ destination: destination, value: value, data: data, executed: false }));
    emit Submission(txId);
    confirmTransaction(txId);
  }

  function confirmTransaction(
    uint256 txId
  ) public ownerExists(msg.sender) transactionExists(txId) notConfirmed(txId, msg.sender) {
    confirmations[txId][msg.sender] = true;
    emit Confirmation(msg.sender, txId);
    executeTransaction(txId);
  }

  function revokeConfirmation(
    uint256 txId
  ) external ownerExists(msg.sender) confirmed(txId, msg.sender) notExecuted(txId) {
    confirmations[txId][msg.sender] = false;
    emit Revocation(msg.sender, txId);
  }

  function executeTransaction(
    uint256 txId
  ) public ownerExists(msg.sender) confirmed(txId, msg.sender) notExecuted(txId) {
    Transaction storage txn = transactions[txId];
    if (_isConfirmed(txId)) {
      txn.executed = true;
      (bool success, ) = txn.destination.call{ value: txn.value }(txn.data);
      if (success) {
        emit Execution(txId);
      } else {
        emit ExecutionFailure(txId);
        txn.executed = false;
      }
    }
  }

  function _isConfirmed(uint256 txId) internal view returns (bool) {
    uint count = 0;
    for (uint i = 0; i < owners.length; i++) {
      if (confirmations[txId][owners[i]]) count += 1;
      if (count == required) return true;
    }
    return false;
  }

  // Admin functions
  function addOwner(
    address owner
  ) external onlyWallet ownerDoesNotExist(owner) validRequirement(owners.length + 1, required) {
    isOwner[owner] = true;
    owners.push(owner);
    emit OwnerAdded(owner);
  }

  function removeOwner(address owner) external onlyWallet ownerExists(owner) {
    // Do not allow to remove last owner
    if (owners.length == 1) {
      revert("Cannot remove owner");
    }
    
    isOwner[owner] = false;
    for (uint256 i = 0; i < owners.length; i++) {
      if (owners[i] == owner) {
        owners[i] = owners[owners.length - 1];
        owners.pop();
        break;
      }
    }

    if (required > owners.length) {
      changeRequirement(owners.length);
    }

    emit OwnerRemoved(owner);
  }

  function replaceOwner(
    address oldOwner,
    address newOwner
  ) external onlyWallet ownerExists(oldOwner) ownerDoesNotExist(newOwner) {
    for (uint256 i = 0; i < owners.length; i++) {
      if (owners[i] == oldOwner) {
        owners[i] = newOwner;
        break;
      }
    }
    isOwner[oldOwner] = false;
    isOwner[newOwner] = true;
    emit OwnerRemoved(oldOwner);
    emit OwnerAdded(newOwner);
  }

  function changeRequirement(uint256 _required) public onlyWallet validRequirement(owners.length, _required) {
    required = _required;
    emit RequirementChanged(_required);
  }

  // View functions
  function getOwners() external view returns (address[] memory) {
    return owners;
  }

  function getTransactionCount(bool pending, bool executed) public view returns (uint256 count) {
    for (uint256 i = 0; i < transactions.length; i++) {
      if ((pending && !transactions[i].executed) || (executed && transactions[i].executed)) {
        count += 1;
      }
    }
    return count;
  }

  function getTransactionIds(
    uint256 from,
    uint256 to,
    bool pending,
    bool executed
  ) external view returns (uint256[] memory txIds) {
    require(to >= from, "Invalid range");
    uint256[] memory temp = new uint256[](transactions.length);
    uint256 count = 0;

    for (uint256 i = 0; i < transactions.length; i++) {
      if ((pending && !transactions[i].executed) || (executed && transactions[i].executed)) {
        temp[count] = i;
        count++;
      }
    }

    require(to <= count, "Range exceeds results");

    txIds = new uint256[](to - from);
    for (uint256 i = from; i < to; i++) {
      txIds[i - from] = temp[i];
    }
  }

  function getConfirmations(uint256 txId) external view returns (address[] memory) {
    address[] memory confirmationsTemp = new address[](owners.length);
    uint256 count = 0;

    for (uint256 i = 0; i < owners.length; i++) {
      if (confirmations[txId][owners[i]]) {
        confirmationsTemp[count] = owners[i];
        count++;
      }
    }

    address[] memory result = new address[](count);
    for (uint256 i = 0; i < count; i++) {
      result[i] = confirmationsTemp[i];
    }
    return result;
  }

  function isConfirmed(uint256 txId) external view returns (bool) {
    return _isConfirmed(txId);
  }
}
