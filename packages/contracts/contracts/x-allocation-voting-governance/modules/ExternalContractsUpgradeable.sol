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

import { XAllocationVotingGovernor } from "../XAllocationVotingGovernor.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IEmissions } from "../../interfaces/IEmissions.sol";
import { IX2EarnApps } from "../../interfaces/IX2EarnApps.sol";
import { IVoterRewards } from "../../interfaces/IVoterRewards.sol";
import { IVeBetterPassport } from "../../interfaces/IVeBetterPassport.sol";
import { IB3TRGovernor } from "../../interfaces/IB3TRGovernor.sol";
import { IRelayerRewardsPool } from "../../interfaces/IRelayerRewardsPool.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/**
 * @title ExternalContractsUpgradeable
 * @dev Extension of {XAllocationVotingGovernor} that handles the storage of external contracts for the XAllocationVotingGovernor.
 */
abstract contract ExternalContractsUpgradeable is Initializable, XAllocationVotingGovernor {
  /// @custom:storage-location erc7201:b3tr.storage.XAllocationVotingGovernor.ExternalContracts
  struct ExternalContractsStorage {
    IX2EarnApps _x2EarnApps;
    IEmissions _emissions;
    IVoterRewards _voterRewards;
    IVeBetterPassport _veBetterPassport;
    IB3TRGovernor _b3trGovernor;
    IRelayerRewardsPool _relayerRewardsPool;
  }

  // keccak256(abi.encode(uint256(keccak256("b3tr.storage.XAllocationVotingGovernor.ExternalContracts")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant ExternalContractsStorageLocation =
    0x1da8cbbb2b12987a437595605432a6bbe84c08e9685afaaee593f05659f50d00;

  function _getExternalContractsStorage() internal pure returns (ExternalContractsStorage storage $) {
    assembly {
      $.slot := ExternalContractsStorageLocation
    }
  }

  // @dev Emit when the emissions contract is set
  event EmissionsSet(address oldContractAddress, address newContractAddress);
  // @dev Emit when the X2EarnApps contract is set
  event X2EarnAppsSet(address oldContractAddress, address newContractAddress);
  // @dev Emit when the voter rewards contract is set
  event VoterRewardsSet(address oldContractAddress, address newContractAddress);
  // @dev Emit when the VeBetterPassport contract is set
  event VeBetterPassportSet(address oldContractAddress, address newContractAddress);
  // @dev Emit when the RelayerRewardsPool contract is set
  event RelayerRewardsPoolSet(address oldContractAddress, address newContractAddress);
  // @dev Emit when the B3TRGovernor contract is set
  event B3TRGovernorSet(address oldContractAddress, address newContractAddress);

  /**
   * @dev Initializes the contract
   * @param initialX2EarnApps The initial X2EarnApps contract address
   * @param initialEmissions The initial Emissions contract address
   * @param initialVoterRewards The initial VoterRewards contract address
   */
  function __ExternalContracts_init(
    IX2EarnApps initialX2EarnApps,
    IEmissions initialEmissions,
    IVoterRewards initialVoterRewards
  ) internal onlyInitializing {
    __ExternalContracts_init_unchained(initialX2EarnApps, initialEmissions, initialVoterRewards);
  }

  function __ExternalContracts_init_unchained(
    IX2EarnApps initialX2EarnApps,
    IEmissions initialEmissions,
    IVoterRewards initialVoterRewards
  ) internal onlyInitializing {
    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    $._x2EarnApps = initialX2EarnApps;
    $._emissions = initialEmissions;
    $._voterRewards = initialVoterRewards;
  }

  // ------- Getters ------- //
  /**
   * @dev The X2EarnApps contract.
   */
  function x2EarnApps() public view virtual override returns (IX2EarnApps) {
    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    return $._x2EarnApps;
  }

  /**
   * @dev The emissions contract.
   */
  function emissions() public view override returns (IEmissions) {
    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    return $._emissions;
  }

  /**
   * @dev Get the voter rewards contract
   */
  function voterRewards() public view override returns (IVoterRewards) {
    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    return $._voterRewards;
  }

  function veBetterPassport() public view override returns (IVeBetterPassport) {
    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    return $._veBetterPassport;
  }

  /**
   * @dev Get the B3TRGovernor contract
   */
  function b3trGovernor() public view override returns (IB3TRGovernor) {
    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    return $._b3trGovernor;
  }

  /**
   * @dev Get the RelayerRewardsPool contract
   */
  function relayerRewardsPool() public view override returns (IRelayerRewardsPool) {
    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    return $._relayerRewardsPool;
  }

  // ------- Internal Functions ------- //

  /**
   * @dev Sets the emissions contract.
   *
   * Emits a {EmissionContractSet} event
   */
  function _setEmissions(IEmissions newEmisionsAddress) internal virtual {
    if (address(newEmisionsAddress) == address(0)) revert InvalidContractAddress("emissions");

    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    $._emissions = IEmissions(newEmisionsAddress);
    emit EmissionsSet(address($._emissions), address(newEmisionsAddress));
  }

  /**
   * @dev Sets the X2EarnApps contract
   * @param newX2EarnApps The new X2EarnApps contract address
   *
   * Emits a {X2EarnAppsSet} event
   */
  function _setX2EarnApps(IX2EarnApps newX2EarnApps) internal virtual {
    if (address(newX2EarnApps) == address(0)) revert InvalidContractAddress("X2EarnApps");

    ExternalContractsStorage storage $ = _getExternalContractsStorage();

    $._x2EarnApps = newX2EarnApps;
    emit X2EarnAppsSet(address($._x2EarnApps), address(newX2EarnApps));
  }

  /**
   * @dev Sets the voter rewards contract
   * @param newVoterRewards The new voter rewards contract address
   */
  function _setVoterRewards(IVoterRewards newVoterRewards) internal virtual {
    if (address(newVoterRewards) == address(0)) revert InvalidContractAddress("voter rewards");

    ExternalContractsStorage storage $ = _getExternalContractsStorage();

    $._voterRewards = newVoterRewards;
    emit VoterRewardsSet(address($._voterRewards), address(newVoterRewards));
  }

  /**
   * @dev Sets the VeBetterPassport contract
   * @param newVeBetterPassport The new VeBetterPassport contract address
   */
  function _setVeBetterPassport(IVeBetterPassport newVeBetterPassport) internal virtual {
    if (address(newVeBetterPassport) == address(0)) revert InvalidContractAddress("VeBetterPassport");

    ExternalContractsStorage storage $ = _getExternalContractsStorage();

    $._veBetterPassport = newVeBetterPassport;
    emit VeBetterPassportSet(address($._veBetterPassport), address(newVeBetterPassport));
  }

  /**
   * @dev Sets the B3TRGovernor contract
   * @param newB3TRGovernor The new B3TRGovernor contract address
   */
  function _setB3TRGovernor(IB3TRGovernor newB3TRGovernor) internal virtual {
    if (address(newB3TRGovernor) == address(0)) revert InvalidContractAddress("B3TRGovernor");

    ExternalContractsStorage storage $ = _getExternalContractsStorage();

    $._b3trGovernor = newB3TRGovernor;
    emit B3TRGovernorSet(address($._b3trGovernor), address(newB3TRGovernor));
  }

  /**
   * @dev Sets the RelayerRewardsPool contract
   * @param newRelayerRewardsPool The new RelayerRewardsPool contract address
   */
  function _setRelayerRewardsPool(IRelayerRewardsPool newRelayerRewardsPool) internal virtual {
    if (address(newRelayerRewardsPool) == address(0)) revert InvalidContractAddress("RelayerRewardsPool");

    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    $._relayerRewardsPool = newRelayerRewardsPool;

    emit RelayerRewardsPoolSet(address($._relayerRewardsPool), address(newRelayerRewardsPool));
  }
}
