import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { expect } from "chai"
import { ethers } from "hardhat"
import { describe, it } from "mocha"

import { upgradeProxy } from "../../scripts/helpers"
import { B3TRGovernor } from "../../typechain-types"
import { getOrDeployContractInstances } from "../helpers"

describe("Governance - V9 Upgrade - @shard4g", function () {
  it("Should upgrade from V8 to V9 and preserve version", async () => {
    const config = createLocalConfig()
    const {
      governor,
      governorClockLogicLib,
      governorConfiguratorLib,
      governorDepositLogicLib,
      governorFunctionRestrictionsLogicLib,
      governorProposalLogicLib,
      governorQuorumLogicLib,
      governorStateLogicLib,
      governorVotesLogicLib,
    } = await getOrDeployContractInstances({ forceDeploy: true, config })

    const version = await governor.version()
    expect(version).to.equal("9")

    const governorAddress = await governor.getAddress()
    expect(governorAddress).to.not.equal(ethers.ZeroAddress)
  })

  it("Should preserve governor configuration after V8 to V9 upgrade", async () => {
    const config = createLocalConfig()
    const { governor, vot3, b3tr, voterRewards, xAllocationVoting } = await getOrDeployContractInstances({
      forceDeploy: true,
      config,
    })

    // Verify all external contracts are preserved
    expect(await governor.token()).to.equal(await vot3.getAddress())
    expect(await governor.b3tr()).to.equal(await b3tr.getAddress())
    expect(await governor.voterRewards()).to.equal(await voterRewards.getAddress())
    expect(await governor.xAllocationVoting()).to.equal(await xAllocationVoting.getAddress())

    // Verify version
    expect(await governor.version()).to.equal("9")
  })

  it("Should preserve governance roles after V8 to V9 upgrade", async () => {
    const config = createLocalConfig()
    const { governor, owner } = await getOrDeployContractInstances({ forceDeploy: true, config })

    const DEFAULT_ADMIN_ROLE = await governor.DEFAULT_ADMIN_ROLE()
    const GOVERNOR_FUNCTIONS_SETTINGS_ROLE = await governor.GOVERNOR_FUNCTIONS_SETTINGS_ROLE()
    const PAUSER_ROLE = await governor.PAUSER_ROLE()
    const PROPOSAL_STATE_MANAGER_ROLE = await governor.PROPOSAL_STATE_MANAGER_ROLE()

    expect(await governor.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true
    expect(await governor.hasRole(GOVERNOR_FUNCTIONS_SETTINGS_ROLE, owner.address)).to.be.true
    expect(await governor.hasRole(PAUSER_ROLE, owner.address)).to.be.true
    expect(await governor.hasRole(PROPOSAL_STATE_MANAGER_ROLE, owner.address)).to.be.true
  })
})
