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

import { XAllocationVotingGovernorV7 } from "../XAllocationVotingGovernorV7.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IEmissions } from "../../../../interfaces/IEmissions.sol";
import { IX2EarnApps } from "../../../../interfaces/IX2EarnApps.sol";
import { IVoterRewards } from "../../../../interfaces/IVoterRewards.sol";
import { IVeBetterPassport } from "../../../../interfaces/IVeBetterPassport.sol";
import { IB3TRGovernor } from "../../../../interfaces/IB3TRGovernor.sol";

/**
 * @title ExternalContractsUpgradeableV7
 * @dev Extension of {XAllocationVotingGovernorV7} that handles the storage of external contracts for the XAllocationVotingGovernorV7.
 */
abstract contract ExternalContractsUpgradeableV7 is Initializable, XAllocationVotingGovernorV7 {
  /// @custom:storage-location erc7201:b3tr.storage.XAllocationVotingGovernor.ExternalContracts
  struct ExternalContractsStorage {
    IX2EarnApps _x2EarnApps;
    IEmissions _emissions;
    IVoterRewards _voterRewards;
    IVeBetterPassport _veBetterPassport;
    IB3TRGovernor _b3trGovernor;
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

  function __ExternalContracts_init_v2(IVeBetterPassport _veBetterPassport) internal onlyInitializing {
    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    $._veBetterPassport = _veBetterPassport;
  }

  function __ExternalContracts_init_v3(IB3TRGovernor _b3trGovernor) internal onlyInitializing {
    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    $._b3trGovernor = _b3trGovernor;
  }

  // ------- Getters ------- //
  /**
   * @dev The X2EarnApps contract.
   */
  function x2EarnApps() public view override returns (IX2EarnApps) {
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

  // ------- Internal Functions ------- //

  /**
   * @dev Sets the emissions contract.
   *
   * Emits a {EmissionContractSet} event
   */
  function _setEmissions(IEmissions newEmisionsAddress) internal virtual {
    require(address(newEmisionsAddress) != address(0), "XAllocationVotingGovernor: emissions is the zero address");
    ExternalContractsStorage storage $ = _getExternalContractsStorage();

    emit EmissionsSet(address($._emissions), address(newEmisionsAddress));
    $._emissions = IEmissions(newEmisionsAddress);
  }

  /**
   * @dev Sets the X2EarnApps contract
   * @param newX2EarnApps The new X2EarnApps contract address
   *
   * Emits a {X2EarnAppsSet} event
   */
  function _setX2EarnApps(IX2EarnApps newX2EarnApps) internal virtual {
    require(address(newX2EarnApps) != address(0), "XAllocationVotingGovernor: new X2EarnApps is the zero address");

    ExternalContractsStorage storage $ = _getExternalContractsStorage();

    emit X2EarnAppsSet(address($._x2EarnApps), address(newX2EarnApps));
    $._x2EarnApps = newX2EarnApps;
  }

  /**
   * @dev Sets the voter rewards contract
   * @param newVoterRewards The new voter rewards contract address
   */
  function _setVoterRewards(IVoterRewards newVoterRewards) internal virtual {
    require(address(newVoterRewards) != address(0), "XAllocationVotingGovernor: new voter rewards is the zero address");

    ExternalContractsStorage storage $ = _getExternalContractsStorage();

    emit VoterRewardsSet(address($._voterRewards), address(newVoterRewards));
    $._voterRewards = newVoterRewards;
  }

  /**
   * @dev Sets the VeBetterPassport contract
   * @param newVeBetterPassport The new VeBetterPassport contract address
   */
  function _setVeBetterPassport(IVeBetterPassport newVeBetterPassport) internal virtual {
    require(
      address(newVeBetterPassport) != address(0),
      "XAllocationVotingGovernor: new VeBetterPassport is the zero address"
    );

    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    $._veBetterPassport = newVeBetterPassport;
  }

  /**
   * @dev Sets the B3TRGovernor contract
   * @param newB3TRGovernor The new B3TRGovernor contract address
   */
  function _setB3TRGovernor(IB3TRGovernor newB3TRGovernor) internal virtual {
    require(address(newB3TRGovernor) != address(0), "XAllocationVotingGovernor: new B3TRGovernor is the zero address");
    ExternalContractsStorage storage $ = _getExternalContractsStorage();
    $._b3trGovernor = newB3TRGovernor;
  }
}
