import { ethers } from "hardhat"
import { expect } from "chai"
import {
  catchRevert,
  createProposalAndExecuteIt,
  filterEventsByName,
  getOrDeployContractInstances,
  getVot3Tokens,
  moveToCycle,
  parseAllocationVoteCastEvent,
  parseRoundStartedEvent,
  startNewAllocationRound,
  waitForRoundToEnd,
  bootstrapEmissions,
  getProposalIdFromTx,
  waitForProposalToBeActive,
  waitForVotingPeriodToEnd,
  bootstrapAndStartEmissions,
  waitForCurrentRoundToEnd,
  ZERO_ADDRESS,
  waitForNextBlock,
  payDeposit,
} from "./helpers"
import { describe, it } from "mocha"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { deployProxy } from "../scripts/helpers"
import { XAllocationVoting } from "../typechain-types"
import { createLocalConfig } from "../config/contracts/envs/local"

describe("X-Allocation Voting", function () {
  describe("Deployment", function () {
    it("Admins and addresses should be set correctly", async function () {
      const { xAllocationVoting, owner, timeLock, emissions, x2EarnApps } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000"

      expect(await xAllocationVoting.hasRole(ADMIN_ROLE, await timeLock.getAddress())).to.eql(true)
      expect(await xAllocationVoting.hasRole(ADMIN_ROLE, owner.address)).to.eql(true)

      expect(await xAllocationVoting.emissions()).to.eql(await emissions.getAddress())
      expect(await xAllocationVoting.x2EarnApps()).to.eql(await x2EarnApps.getAddress())
    })

    it("Should not support invalid interface", async function () {
      const { xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const INVALID_ID = "0xffffffff"
      expect(await xAllocationVoting.supportsInterface(INVALID_ID)).to.eql(false)
    })

    it("Can set multiple admins during deployment", async function () {
      const { voterRewards, timeLock, emissions, x2EarnApps, vot3, otherAccounts } = await getOrDeployContractInstances(
        {
          forceDeploy: false,
        },
      )
      const xAllocationVoting = (await deployProxy("XAllocationVoting", [
        {
          vot3Token: await vot3.getAddress(),
          quorumPercentage: 1,
          initialVotingPeriod: 2,
          timeLock: await timeLock.getAddress(),
          voterRewards: await voterRewards.getAddress(),
          emissions: await emissions.getAddress(),
          admins: [await timeLock.getAddress(), otherAccounts[2].address, otherAccounts[2].address],
          upgrader: otherAccounts[2].address,
          contractsAddressManager: otherAccounts[2].address,
          x2EarnAppsAddress: await x2EarnApps.getAddress(),
          baseAllocationPercentage: 2,
          appSharesCap: 2,
          votingThreshold: BigInt(1),
        },
      ])) as XAllocationVoting

      expect(
        await xAllocationVoting.hasRole(await xAllocationVoting.DEFAULT_ADMIN_ROLE(), await timeLock.getAddress()),
      ).to.eql(true)
      expect(
        await xAllocationVoting.hasRole(await xAllocationVoting.DEFAULT_ADMIN_ROLE(), otherAccounts[2].address),
      ).to.eql(true)
      expect(
        await xAllocationVoting.hasRole(await xAllocationVoting.DEFAULT_ADMIN_ROLE(), otherAccounts[2].address),
      ).to.eql(true)
    })

    it("Should support ERC 165 interface", async () => {
      const { xAllocationVoting } = await getOrDeployContractInstances({ forceDeploy: true })

      expect(await xAllocationVoting.supportsInterface("0x01ffc9a7")).to.equal(true) // ERC165
    })

    it("Should correctly return name and version", async function () {
      const { xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await xAllocationVoting.name()).to.eql("XAllocationVoting")
      expect(await xAllocationVoting.version()).to.eql("1")
    })

    it("Counting mode is set correctly", async function () {
      const { xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      expect(await xAllocationVoting.COUNTING_MODE()).to.eql("support=x-allocations&quorum=auto")
    })

    it("Clock mode is set correctly", async function () {
      const { xAllocationVoting, vot3 } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      expect(await xAllocationVoting.CLOCK_MODE()).to.eql(await vot3.CLOCK_MODE())
    })

    it("Clock returns block number if token does not implement clock function", async function () {
      const { xAllocationVoting, timeLock, voterRewards, emissions, otherAccounts, x2EarnApps, b3tr } =
        await getOrDeployContractInstances({
          forceDeploy: false,
        })

      let clock = await xAllocationVoting.clock()

      expect(parseInt(clock.toString())).to.eql(await ethers.provider.getBlockNumber())

      const xAllocationVotingWithB3TR = (await deployProxy("XAllocationVoting", [
        {
          vot3Token: await b3tr.getAddress(),
          quorumPercentage: 1,
          initialVotingPeriod: 2,
          timeLock: await timeLock.getAddress(),
          voterRewards: await voterRewards.getAddress(),
          emissions: await emissions.getAddress(),
          admins: [await timeLock.getAddress(), otherAccounts[2].address, otherAccounts[2].address],
          upgrader: otherAccounts[2].address,
          contractsAddressManager: otherAccounts[2].address,
          x2EarnAppsAddress: await x2EarnApps.getAddress(),
          baseAllocationPercentage: 2,
          appSharesCap: 2,
          votingThreshold: BigInt(1),
        },
      ])) as XAllocationVoting

      clock = await xAllocationVotingWithB3TR.clock()
      expect(parseInt(clock.toString())).to.eql(await ethers.provider.getBlockNumber())

      //CLOKC_MODE should return "mode=blocknumber&from=default"
      expect(await xAllocationVotingWithB3TR.CLOCK_MODE()).to.eql("mode=blocknumber&from=default")
    })

    it("Voter rewards address is set correctly", async function () {
      const { xAllocationVoting, voterRewards } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await xAllocationVoting.voterRewards()).to.eql(await voterRewards.getAddress())
    })

    it("Should revert if VOT3 is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, x2EarnApps, timeLock, emissions, voterRewards } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("XAllocationVoting", [
          {
            vot3Token: ZERO_ADDRESS,
            quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE, // quorum percentage
            initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1, // X Alloc voting period
            timeLock: await timeLock.getAddress(),
            voterRewards: await voterRewards.getAddress(),
            emissions: await emissions.getAddress(),
            admins: [await timeLock.getAddress(), owner.address],
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            x2EarnAppsAddress: await x2EarnApps.getAddress(),
            baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
            appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
            votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
          },
        ]),
      ).to.be.reverted
    })

    it("Should revert if VoterRewards is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, x2EarnApps, timeLock, emissions, vot3 } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("XAllocationVoting", [
          {
            vot3Token: await vot3.getAddress(),
            quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE, // quorum percentage
            initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1, // X Alloc voting period
            timeLock: await timeLock.getAddress(),
            voterRewards: ZERO_ADDRESS,
            emissions: await emissions.getAddress(),
            admins: [await timeLock.getAddress(), owner.address],
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            x2EarnAppsAddress: await x2EarnApps.getAddress(),
            baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
            appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
            votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
          },
        ]),
      ).to.be.reverted
    })

    it("Should revert if Emissions is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, x2EarnApps, timeLock, vot3, voterRewards } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("XAllocationVoting", [
          {
            vot3Token: await vot3.getAddress(),
            quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE, // quorum percentage
            initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1, // X Alloc voting period
            timeLock: await timeLock.getAddress(),
            voterRewards: await voterRewards.getAddress(),
            emissions: ZERO_ADDRESS,
            admins: [await timeLock.getAddress(), owner.address],
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            x2EarnAppsAddress: await x2EarnApps.getAddress(),
            baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
            appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
            votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
          },
        ]),
      ).to.be.reverted
    })

    it("Should revert if an admin is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, x2EarnApps, timeLock, vot3, voterRewards, emissions } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await expect(
        deployProxy("XAllocationVoting", [
          {
            vot3Token: await vot3.getAddress(),
            quorumPercentage: config.X_ALLOCATION_VOTING_QUORUM_PERCENTAGE, // quorum percentage
            initialVotingPeriod: config.EMISSIONS_CYCLE_DURATION - 1, // X Alloc voting period
            timeLock: await timeLock.getAddress(),
            voterRewards: await voterRewards.getAddress(),
            emissions: await emissions.getAddress(),
            admins: [await timeLock.getAddress(), ZERO_ADDRESS],
            upgrader: owner.address,
            contractsAddressManager: owner.address,
            x2EarnAppsAddress: await x2EarnApps.getAddress(),
            baseAllocationPercentage: config.X_ALLOCATION_POOL_BASE_ALLOCATION_PERCENTAGE,
            appSharesCap: config.X_ALLOCATION_POOL_APP_SHARES_MAX_CAP,
            votingThreshold: config.X_ALLOCATION_VOTING_VOTING_THRESHOLD,
          },
        ]),
      ).to.be.reverted
    })
  })

  describe("Contract upgradeablity", () => {
    it("Admin should be able to upgrade the contract", async function () {
      const { xAllocationVoting, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("XAllocationVoting")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await xAllocationVoting.getAddress())

      const UPGRADER_ROLE = await xAllocationVoting.UPGRADER_ROLE()
      expect(await xAllocationVoting.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(xAllocationVoting.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await xAllocationVoting.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only admin should be able to upgrade the contract", async function () {
      const { xAllocationVoting, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("TimeLock")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await xAllocationVoting.getAddress())

      const UPGRADER_ROLE = await xAllocationVoting.UPGRADER_ROLE()
      expect(await xAllocationVoting.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(xAllocationVoting.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to
        .be.reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await xAllocationVoting.getAddress())

      expect(newImplAddress.toUpperCase()).to.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.not.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Admin can change UPGRADER_ROLE", async function () {
      const { xAllocationVoting, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("TimeLock")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await xAllocationVoting.getAddress())

      const UPGRADER_ROLE = await xAllocationVoting.UPGRADER_ROLE()
      expect(await xAllocationVoting.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(xAllocationVoting.connect(owner).grantRole(UPGRADER_ROLE, otherAccount.address)).to.not.be.reverted
      await expect(xAllocationVoting.connect(owner).revokeRole(UPGRADER_ROLE, owner.address)).to.not.be.reverted

      await expect(xAllocationVoting.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to
        .not.be.reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await xAllocationVoting.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("should be able to upgrade the xAllocationVoting contract through governance", async function () {
      const config = createLocalConfig()
      config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 0
      const { xAllocationVoting, timeLock, governor, owner, otherAccount, vot3 } = await getOrDeployContractInstances({
        forceDeploy: true,
        config,
      })

      await getVot3Tokens(otherAccount, "1000")
      await vot3.connect(otherAccount).approve(await governor.getAddress(), "1000")

      const UPGRADER_ROLE = await xAllocationVoting.UPGRADER_ROLE()
      await expect(xAllocationVoting.connect(owner).grantRole(UPGRADER_ROLE, await timeLock.getAddress())).to.not.be
        .reverted

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("XAllocationVoting")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      await bootstrapAndStartEmissions()

      // V1 Contract
      const V1Contract = await ethers.getContractAt("XAllocationVoting", await xAllocationVoting.getAddress())

      // Now we can create a proposal
      const encodedFunctionCall = V1Contract.interface.encodeFunctionData("upgradeToAndCall", [
        await implementation.getAddress(),
        "0x",
      ])
      const description = "Upgrading XAllocationVoting contracts"
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
      const currentRoundId = await xAllocationVoting.currentRoundId()

      const tx = await governor
        .connect(owner)
        .propose(
          [await xAllocationVoting.getAddress()],
          [0],
          [encodedFunctionCall],
          description,
          currentRoundId + 1n,
          0,
        )

      const proposalId = await getProposalIdFromTx(tx)
      await waitForProposalToBeActive(proposalId)

      await governor.connect(otherAccount).castVote(proposalId, 1)
      await waitForVotingPeriodToEnd(proposalId)
      expect(await governor.state(proposalId)).to.eql(4n) // succeded

      await governor.queue([await xAllocationVoting.getAddress()], [0], [encodedFunctionCall], descriptionHash)
      expect(await governor.state(proposalId)).to.eql(5n)

      await governor.execute([await xAllocationVoting.getAddress()], [0], [encodedFunctionCall], descriptionHash)
      expect(await governor.state(proposalId)).to.eql(6n)

      const newImplAddress = await getImplementationAddress(ethers.provider, await xAllocationVoting.getAddress())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Cannot initialize twice", async function () {
      const { owner, xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await catchRevert(
        xAllocationVoting.initialize({
          vot3Token: owner.address,
          quorumPercentage: 1,
          initialVotingPeriod: 1,
          timeLock: owner.address,
          voterRewards: owner.address,
          emissions: owner.address,
          admins: [owner.address],
          upgrader: owner.address,
          contractsAddressManager: owner.address,
          x2EarnAppsAddress: owner.address,
          baseAllocationPercentage: 2,
          appSharesCap: 2,
          votingThreshold: BigInt(1),
        }),
      )
    })

    it("Should return correct version of the contract", async () => {
      const { xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await xAllocationVoting.version()).to.equal("1")
    })
  })

  describe("Settings", function () {
    describe("General settings", function () {
      it("Contract should not be able to receive ether", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({ forceDeploy: false })

        await expect(
          owner.sendTransaction({
            to: await xAllocationVoting.getAddress(),
            value: ethers.parseEther("1.0"), // Sends exactly 1.0 ether
          }),
        ).to.be.reverted

        expect(await ethers.provider.getBalance(await xAllocationVoting.getAddress())).to.eql(0n)
      })

      describe("emissions address", function () {
        it("Admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set a new emissions contract correctly", async function () {
          const { xAllocationVoting, owner } = await getOrDeployContractInstances({
            forceDeploy: true,
          })
          await bootstrapAndStartEmissions()

          expect(
            await xAllocationVoting.hasRole(await xAllocationVoting.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address),
          ).to.be.true

          await xAllocationVoting.connect(owner).setEmissionsAddress(owner.address)

          const updatedEmissionsAddress = await xAllocationVoting.emissions()
          expect(updatedEmissionsAddress).to.eql(owner.address)
        })

        it("Cannot set a new emissions contract to zero address", async function () {
          const { xAllocationVoting, owner } = await getOrDeployContractInstances({
            forceDeploy: true,
          })
          await bootstrapAndStartEmissions()

          await expect(xAllocationVoting.connect(owner).setEmissionsAddress(ZERO_ADDRESS)).to.be.reverted

          const updatedEmissionsAddress = await xAllocationVoting.emissions()
          expect(updatedEmissionsAddress).to.not.eql(ZERO_ADDRESS)
        })

        it("Only admin with CONTRACTS_ADDRESS_MANAGER_ROLE should be able to set a new emissions contract", async function () {
          const { xAllocationVoting, otherAccount } = await getOrDeployContractInstances({
            forceDeploy: true,
          })

          expect(
            await xAllocationVoting.hasRole(
              await xAllocationVoting.CONTRACTS_ADDRESS_MANAGER_ROLE(),
              otherAccount.address,
            ),
          ).to.be.false

          await expect(xAllocationVoting.connect(otherAccount).setEmissionsAddress(otherAccount.address)).to.be.reverted
        })
      })

      describe("x2EarnApps address", function () {
        it("Admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set x2EarnApps address correctly", async function () {
          const { xAllocationVoting, owner } = await getOrDeployContractInstances({
            forceDeploy: true,
          })

          expect(
            await xAllocationVoting.hasRole(await xAllocationVoting.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address),
          ).to.be.true

          await xAllocationVoting.connect(owner).setX2EarnAppsAddress(owner.address)

          const updatedX2EarnAppsAddress = await xAllocationVoting.x2EarnApps()
          expect(updatedX2EarnAppsAddress).to.eql(owner.address)
        })

        it("Cannot set x2EarnApps address to zero address", async function () {
          const { xAllocationVoting, owner } = await getOrDeployContractInstances({
            forceDeploy: true,
          })

          await expect(xAllocationVoting.connect(owner).setX2EarnAppsAddress(ZERO_ADDRESS)).to.be.reverted

          const updatedX2EarnAppsAddress = await xAllocationVoting.x2EarnApps()
          expect(updatedX2EarnAppsAddress).to.not.eql(ZERO_ADDRESS)
        })

        it("Only admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set x2EarnApps address", async function () {
          const { xAllocationVoting, otherAccount } = await getOrDeployContractInstances({
            forceDeploy: true,
          })

          expect(
            await xAllocationVoting.hasRole(
              await xAllocationVoting.CONTRACTS_ADDRESS_MANAGER_ROLE(),
              otherAccount.address,
            ),
          ).to.be.false

          await expect(xAllocationVoting.connect(otherAccount).setX2EarnAppsAddress(otherAccount.address)).to.be
            .reverted
        })
      })

      describe("VoterRewards address", function () {
        it("Admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set voter rewards address correctly", async function () {
          const { xAllocationVoting, owner } = await getOrDeployContractInstances({
            forceDeploy: true,
          })

          expect(
            await xAllocationVoting.hasRole(await xAllocationVoting.CONTRACTS_ADDRESS_MANAGER_ROLE(), owner.address),
          ).to.be.true

          await xAllocationVoting.connect(owner).setVoterRewardsAddress(owner.address)

          const updatedVoterRewardsAddress = await xAllocationVoting.voterRewards()
          expect(updatedVoterRewardsAddress).to.eql(owner.address)
        })

        it("Cannot set voter rewards address to zero address", async function () {
          const { xAllocationVoting, owner } = await getOrDeployContractInstances({
            forceDeploy: true,
          })

          await expect(xAllocationVoting.connect(owner).setVoterRewardsAddress(ZERO_ADDRESS)).to.be.reverted

          const updatedVoterRewardsAddress = await xAllocationVoting.voterRewards()
          expect(updatedVoterRewardsAddress).to.not.eql(ZERO_ADDRESS)
        })

        it("Only admin with CONTRACTS_ADDRESS_MANAGER_ROLE can set voter rewards address", async function () {
          const { xAllocationVoting, otherAccount } = await getOrDeployContractInstances({
            forceDeploy: true,
          })

          expect(
            await xAllocationVoting.hasRole(
              await xAllocationVoting.CONTRACTS_ADDRESS_MANAGER_ROLE(),
              otherAccount.address,
            ),
          ).to.be.false

          await expect(xAllocationVoting.connect(otherAccount).setVoterRewardsAddress(otherAccount.address)).to.be
            .reverted
        })
      })
    })

    describe("Voting threshold", function () {
      it("can update voting threshold through governance", async function () {
        const {
          owner,
          xAllocationVoting,
          governorClockLogicLib,
          governorConfiguratorLib,
          governorDepositLogicLib,
          governorFunctionRestrictionsLogicLib,
          governorProposalLogicLib,
          governorQuorumLogicLib,
          governorStateLogicLib,
          governorVotesLogicLib,
        } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newThreshold = 10n
        await createProposalAndExecuteIt(
          owner,
          owner,
          xAllocationVoting,
          await ethers.getContractFactory("B3TRGovernor", {
            libraries: {
              GovernorClockLogic: await governorClockLogicLib.getAddress(),
              GovernorConfigurator: await governorConfiguratorLib.getAddress(),
              GovernorDepositLogic: await governorDepositLogicLib.getAddress(),
              GovernorFunctionRestrictionsLogic: await governorFunctionRestrictionsLogicLib.getAddress(),
              GovernorProposalLogic: await governorProposalLogicLib.getAddress(),
              GovernorQuorumLogic: await governorQuorumLogicLib.getAddress(),
              GovernorStateLogic: await governorStateLogicLib.getAddress(),
              GovernorVotesLogic: await governorVotesLogicLib.getAddress(),
            },
          }),
          "Update Voting Threshold",
          "setVotingThreshold",
          [newThreshold],
        )

        const updatedThreshold = await xAllocationVoting.votingThreshold()
        expect(updatedThreshold).to.eql(newThreshold)
      })

      it("only governance can update voting threshold", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        const newThreshold = 10n

        await catchRevert(xAllocationVoting.connect(owner).setVotingThreshold(newThreshold))

        const updatedThreshold = await xAllocationVoting.votingThreshold()
        expect(updatedThreshold).to.not.eql(newThreshold)
      })
    })

    describe("Quorum", function () {
      it("Governance can change quorum percentage", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })
        await bootstrapAndStartEmissions()

        await createProposalAndExecuteIt(
          owner,
          owner,
          xAllocationVoting,
          await ethers.getContractFactory("XAllocationVoting"),
          "Updating quorum numerator",
          "updateQuorumNumerator",
          [1],
        )

        // @ts-ignore
        const quorumNumerator = await xAllocationVoting.quorumNumerator()
        expect(quorumNumerator).to.eql(1n)
      })

      it("Only governance can change quorum percentage", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({ forceDeploy: true })

        await expect(xAllocationVoting.connect(owner).updateQuorumNumerator(1)).to.be.reverted
      })

      it("Cannot set the quorum nominator higher than the denominator", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })
        await bootstrapAndStartEmissions()

        await expect(
          createProposalAndExecuteIt(
            owner,
            owner,
            xAllocationVoting,
            await ethers.getContractFactory("XAllocationVoting"),
            "Updating quorum numerator",
            "updateQuorumNumerator",
            [(await xAllocationVoting.quorumDenominator()) + 1n],
          ),
        ).to.be.reverted
      })

      it("Can get quorum of round successfully", async function () {
        const { xAllocationVoting, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await getVot3Tokens(otherAccount, "1000")

        // Bootstrap emissions
        await bootstrapEmissions()

        const round1 = await startNewAllocationRound()
        await waitForRoundToEnd(round1)

        const quorum = await xAllocationVoting.roundQuorum(round1)

        const snapshot = await xAllocationVoting.roundSnapshot(round1)
        const quorumAtSnapshot = await xAllocationVoting.quorum(snapshot)

        expect(quorum).to.eql(quorumAtSnapshot)
      })

      it("Returns the quorum numerator correctly at a specific timepoint", async function () {
        const { xAllocationVoting, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })

        await getVot3Tokens(otherAccount, "1000")

        // @ts-ignore
        const initialQuorumNumerator = await xAllocationVoting.quorumNumerator()

        // Bootstrap emissions
        await bootstrapAndStartEmissions()

        await createProposalAndExecuteIt(
          otherAccount,
          otherAccount,
          xAllocationVoting,
          await ethers.getContractFactory("XAllocationVoting"),
          "Updating quorum numerator",
          "updateQuorumNumerator",
          [1],
        )

        const snapshot = await xAllocationVoting.roundSnapshot(1)
        //@ts-ignore
        const quorumNumerator = await xAllocationVoting.quorumNumerator(snapshot, {})

        expect(quorumNumerator).to.eql(initialQuorumNumerator)
      })
    })

    describe("Voting period", function () {
      it("Can set voting period only through governance", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({ forceDeploy: false })
        await expect(xAllocationVoting.connect(owner).setVotingPeriod(10)).to.be.reverted
      })

      it("Can set voting period if less than emissions cycle duration", async function () {
        const { xAllocationVoting, owner, emissions, governor, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })
        await bootstrapAndStartEmissions()
        await getVot3Tokens(otherAccount, "30000")
        const cycleDuration = await emissions.cycleDuration()

        // Now we can create a proposal
        const encodedFunctionCall = xAllocationVoting.interface.encodeFunctionData("setVotingPeriod", [
          cycleDuration - 1n,
        ])
        const description = "Updating voting period"
        const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
        const currentRoundId = await xAllocationVoting.currentRoundId()

        const tx = await governor
          .connect(owner)
          .propose(
            [await xAllocationVoting.getAddress()],
            [0],
            [encodedFunctionCall],
            description,
            currentRoundId + 1n,
            0,
          )

        const proposalId = await getProposalIdFromTx(tx)
        await payDeposit(proposalId, owner)

        await waitForProposalToBeActive(proposalId)
        await governor.connect(otherAccount).castVote(proposalId, 1)
        await waitForVotingPeriodToEnd(proposalId)
        expect(await governor.state(proposalId)).to.eql(4n) // succeeded

        await governor.queue([await xAllocationVoting.getAddress()], [0], [encodedFunctionCall], descriptionHash)
        expect(await governor.state(proposalId)).to.eql(5n)

        await governor.execute([await xAllocationVoting.getAddress()], [0], [encodedFunctionCall], descriptionHash)
        expect(await governor.state(proposalId)).to.eql(6n)

        const votingPeriod = await xAllocationVoting.votingPeriod()
        expect(votingPeriod).to.eql(cycleDuration - 1n)
      })

      it("Cannot set voting period to 0", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({
          forceDeploy: true,
        })
        await bootstrapAndStartEmissions()

        await expect(
          createProposalAndExecuteIt(
            owner,
            owner,
            xAllocationVoting,
            await ethers.getContractFactory("XAllocationVoting"),
            "Updating voting period",
            "setVotingPeriod",
            [0],
          ),
        ).to.be.reverted

        const votingPeriod = await xAllocationVoting.votingPeriod()
        expect(votingPeriod).to.not.eql(0n)
      })

      it("Cannot set voting period if not less than emissions cycle duration", async function () {
        const { xAllocationVoting, owner, emissions, governor, otherAccount } = await getOrDeployContractInstances({
          forceDeploy: true,
        })
        await bootstrapAndStartEmissions()
        await getVot3Tokens(otherAccount, "30000")
        const cycleDuration = await emissions.cycleDuration()
        const beforeVotingPeriod = await xAllocationVoting.votingPeriod()

        // Now we can create a proposal
        const encodedFunctionCall = xAllocationVoting.interface.encodeFunctionData("setVotingPeriod", [cycleDuration])
        const description = "Updating voting period"
        const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
        const currentRoundId = await xAllocationVoting.currentRoundId()

        const tx = await governor
          .connect(owner)
          .propose(
            [await xAllocationVoting.getAddress()],
            [0],
            [encodedFunctionCall],
            description,
            currentRoundId + 1n,
            0,
          )

        const proposalId = await getProposalIdFromTx(tx)
        await payDeposit(proposalId, owner)

        await waitForProposalToBeActive(proposalId)
        await governor.connect(otherAccount).castVote(proposalId, 1)
        await waitForVotingPeriodToEnd(proposalId)
        expect(await governor.state(proposalId)).to.eql(4n) // succeded

        await governor.queue([await xAllocationVoting.getAddress()], [0], [encodedFunctionCall], descriptionHash)
        expect(await governor.state(proposalId)).to.eql(5n)

        await expect(
          governor.execute([await xAllocationVoting.getAddress()], [0], [encodedFunctionCall], descriptionHash),
        ).to.be.reverted

        const afterVotingPeriod = await xAllocationVoting.votingPeriod()
        expect(afterVotingPeriod).to.eql(beforeVotingPeriod)
      })
    })

    describe("Admin settings", function () {
      it("Admin can set a new admin", async function () {
        const { xAllocationVoting, owner, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })

        const ADMIN_ROLE = await xAllocationVoting.DEFAULT_ADMIN_ROLE()
        expect(await xAllocationVoting.hasRole(ADMIN_ROLE, otherAccounts[0].address)).to.eql(false)
        expect(await xAllocationVoting.hasRole(ADMIN_ROLE, owner.address)).to.eql(true)

        await xAllocationVoting.connect(owner).grantRole(ADMIN_ROLE, otherAccounts[0].address)

        expect(await xAllocationVoting.hasRole(ADMIN_ROLE, otherAccounts[0].address)).to.eql(true)
      })

      it("Only admin can set a new admin", async function () {
        const { xAllocationVoting, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })

        const ADMIN_ROLE = await xAllocationVoting.DEFAULT_ADMIN_ROLE()
        expect(await xAllocationVoting.hasRole(ADMIN_ROLE, otherAccounts[0].address)).to.eql(false)

        await expect(xAllocationVoting.connect(otherAccounts[0]).grantRole(ADMIN_ROLE, otherAccounts[0].address)).to.be
          .reverted
      })

      it("GOVERNANCE_ROLE can change allocation percentage", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({ forceDeploy: true })

        const initialPercentage = await xAllocationVoting.baseAllocationPercentage()

        const GOVERNANCE_ROLE = await xAllocationVoting.GOVERNANCE_ROLE()
        await xAllocationVoting.connect(owner).grantRole(GOVERNANCE_ROLE, owner.address)

        await xAllocationVoting.connect(owner).setBaseAllocationPercentage(3)

        const updatedPercentage = await xAllocationVoting.baseAllocationPercentage()
        expect(updatedPercentage).to.eql(3n)
        expect(updatedPercentage).to.not.eql(initialPercentage)
      })

      it("Only GOVERNANCE_ROLE can change allocation percentage", async function () {
        const { xAllocationVoting, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })

        const initialPercentage = await xAllocationVoting.baseAllocationPercentage()

        const GOVERNANCE_ROLE = await xAllocationVoting.GOVERNANCE_ROLE()
        expect(await xAllocationVoting.hasRole(GOVERNANCE_ROLE, otherAccounts[0].address)).to.eql(false)

        await expect(xAllocationVoting.connect(otherAccounts[0]).setBaseAllocationPercentage(3)).to.be.reverted

        const updatedPercentage = await xAllocationVoting.baseAllocationPercentage()
        expect(updatedPercentage).to.eql(initialPercentage)
      })
    })

    describe("Earnings settings", function () {
      it("Max allocation percentage can be 100", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({ forceDeploy: true })

        const initialPercentage = await xAllocationVoting.baseAllocationPercentage()

        const GOVERNANCE_ROLE = await xAllocationVoting.GOVERNANCE_ROLE()
        await xAllocationVoting.connect(owner).grantRole(GOVERNANCE_ROLE, owner.address)

        await xAllocationVoting.connect(owner).setBaseAllocationPercentage(100)

        const updatedPercentage = await xAllocationVoting.baseAllocationPercentage()
        expect(updatedPercentage).to.eql(100n)
        expect(updatedPercentage).to.not.eql(initialPercentage)

        await expect(xAllocationVoting.connect(owner).setBaseAllocationPercentage(101)).to.be.reverted
      })

      it("GOVERNANCE_ROLE can change app shares cap", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({ forceDeploy: true })

        const initialCap = await xAllocationVoting.appSharesCap()

        const GOVERNANCE_ROLE = await xAllocationVoting.GOVERNANCE_ROLE()
        await xAllocationVoting.connect(owner).grantRole(GOVERNANCE_ROLE, owner.address)

        await xAllocationVoting.connect(owner).setAppSharesCap(3)

        const updatedCap = await xAllocationVoting.appSharesCap()
        expect(updatedCap).to.eql(3n)
        expect(updatedCap).to.not.eql(initialCap)
      })

      it("Max app shares cap can be 100", async function () {
        const { xAllocationVoting, owner } = await getOrDeployContractInstances({ forceDeploy: true })

        const initialCap = await xAllocationVoting.appSharesCap()

        const GOVERNANCE_ROLE = await xAllocationVoting.GOVERNANCE_ROLE()
        await xAllocationVoting.connect(owner).grantRole(GOVERNANCE_ROLE, owner.address)

        await xAllocationVoting.connect(owner).setAppSharesCap(100)

        const updatedCap = await xAllocationVoting.appSharesCap()
        expect(updatedCap).to.eql(100n)
        expect(updatedCap).to.not.eql(initialCap)

        await expect(xAllocationVoting.connect(owner).setAppSharesCap(101)).to.be.reverted
      })

      it("Only GOVERNANCE_ROLE can change app shares cap", async function () {
        const { xAllocationVoting, otherAccounts } = await getOrDeployContractInstances({ forceDeploy: true })

        const initialCap = await xAllocationVoting.appSharesCap()

        const GOVERNANCE_ROLE = await xAllocationVoting.GOVERNANCE_ROLE()
        expect(await xAllocationVoting.hasRole(GOVERNANCE_ROLE, otherAccounts[0].address)).to.eql(false)

        await expect(xAllocationVoting.connect(otherAccounts[0]).setAppSharesCap(3)).to.be.reverted

        const updatedCap = await xAllocationVoting.appSharesCap()
        expect(updatedCap).to.eql(initialCap)
      })
    })
  })

  describe("Allocation rounds", function () {
    it("Should be able to start a new allocation round successfully", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      const tx = await xAllocationVoting.connect(owner).startNewRound()
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      // Event should be emitted
      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      expect(roundCreated).not.to.eql([])

      const { roundId, proposer, voteStart, voteEnd, appsIds } = parseRoundStartedEvent(
        roundCreated[0],
        xAllocationVoting,
      )
      expect(roundId).to.eql(1)
      expect(proposer).to.eql(owner.address)
      expect(voteStart.toString()).to.eql(receipt.blockNumber.toString())
      expect(voteEnd).to.eql(BigInt(receipt.blockNumber.toString()) + (await xAllocationVoting.votingPeriod()))
      expect(appsIds).to.eql(await xAllocationVoting.getAppIdsOfRound(roundId))

      //Proposal should be active
      const roundState = await xAllocationVoting.state(roundId)
      expect(roundState).to.eql(BigInt(0))

      const round = await xAllocationVoting.getRound(roundId)
      expect(round.proposer).to.eql(owner.address)
      expect(round.voteStart.toString()).to.eql(receipt.blockNumber.toString())
      expect(round.voteDuration).to.eql(await xAllocationVoting.votingPeriod())
    })

    it("Should not be able to start a new allocation round if there is an active one", async function () {
      const { xAllocationVoting, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await getVot3Tokens(otherAccount, "1000")

      const tx = await xAllocationVoting.connect(owner).startNewRound()
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      // Event should be emitted
      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      expect(roundCreated).not.to.eql([])

      const { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)

      // Proposal should be active
      const roundState = await xAllocationVoting.state(roundId)
      expect(roundState).to.eql(BigInt(0))

      // should not be able to start a new allocation round if there is an active one
      await catchRevert(xAllocationVoting.connect(owner).startNewRound())

      // should not be able to start a new allocation round if there is an active one
      await catchRevert(xAllocationVoting.connect(owner).startNewRound())
    })

    it("Should be able to start a new allocation round if the previous one ended", async function () {
      const { xAllocationVoting, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await getVot3Tokens(otherAccount, "1000")

      let tx = await xAllocationVoting.connect(owner).startNewRound()
      let receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      // Event should be emitted
      let roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      let { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)
      expect(roundId).to.eql(1)

      await waitForRoundToEnd(roundId)

      // should not be able to start a new allocation round if there is an active one
      tx = await xAllocationVoting.connect(owner).startNewRound()
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      expect(roundCreated).not.to.eql([])
      ;({ roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting))

      expect(roundId).to.eql(2)

      const currentRoundId = await xAllocationVoting.currentRoundId()
      expect(currentRoundId).to.eql(BigInt(2))
    }).timeout(18000000)

    it("New round is started each time an emission occurs", async function () {
      const { xAllocationVoting, emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      //no round at start
      let round = parseInt((await xAllocationVoting.currentRoundId()).toString())
      expect(round).to.eql(0)

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      // round should be created
      round = parseInt((await xAllocationVoting.currentRoundId()).toString())
      expect(round).to.eql(1)

      // should be active
      let state = await xAllocationVoting.state(round)
      expect(state).to.eql(0n)

      // distribute second emission (should start also new round)
      await moveToCycle(3)

      // first round should be ended and successfull (total supply is 0)
      state = await xAllocationVoting.state(round)
      expect(state).to.eql(2n)

      // round should be created
      round = parseInt((await xAllocationVoting.currentRoundId()).toString())
      expect(round).to.eql(2)
    })

    it("Only user with role should be able to start a new allocation round", async function () {
      const { xAllocationVoting, otherAccounts, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      const roundStarterRole = await xAllocationVoting.ROUND_STARTER_ROLE()
      expect(await xAllocationVoting.hasRole(roundStarterRole, otherAccounts[7].address)).to.eql(false)
      await expect(xAllocationVoting.connect(otherAccounts[7]).startNewRound()).to.be.reverted

      // grant role
      await xAllocationVoting.connect(owner).grantRole(roundStarterRole, otherAccounts[7].address)
      expect(await xAllocationVoting.hasRole(roundStarterRole, otherAccounts[7].address)).to.eql(true)
      await expect(xAllocationVoting.connect(otherAccounts[7]).startNewRound()).to.not.be.reverted
    })

    it("Current round snapshot and deadline are correctly returned", async function () {
      const { xAllocationVoting, emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()
      const roundSnapshot = await xAllocationVoting.currentRoundSnapshot()
      const deadline = await xAllocationVoting.currentRoundDeadline()

      expect(roundSnapshot).to.eql(await xAllocationVoting.roundSnapshot(roundId))
      expect(deadline).to.eql(await xAllocationVoting.roundDeadline(roundId))
    })

    it("Should correctly store the round proposer", async function () {
      const { xAllocationVoting, emissions, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()
      const roundProposer = await xAllocationVoting.roundProposer(roundId)

      expect(roundProposer).to.eql(await emissions.getAddress())
    })

    it("Cannot get state of non-existing round", async function () {
      const { xAllocationVoting } = await getOrDeployContractInstances({ forceDeploy: true })

      await expect(xAllocationVoting.state(1)).to.be.reverted
    })

    it("I can start a new round if no one voted in the previous one", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner, emissions, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await getVot3Tokens(otherAccount, "1000")

      await emissions.connect(minterAccount).start()

      let roundId = await xAllocationVoting.currentRoundId()
      expect(roundId).to.eql(1n)

      await waitForRoundToEnd(Number(roundId))
      expect(await xAllocationVoting.state(roundId)).to.eql(1n) // quorum failed

      await expect(emissions.distribute()).to.not.be.reverted
      roundId = await xAllocationVoting.currentRoundId()
      expect(roundId).to.eql(2n)
    })
  })

  describe("Allocation Voting", function () {
    it("I cannot cast a vote with higher balance than I have", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      await getVot3Tokens(otherAccount, "1000")

      const tx = await xAllocationVoting.startNewRound()
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")
      // Event should be emitted
      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      const { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)

      // I cannot cast a vote with higher balance than I have
      await catchRevert(xAllocationVoting.connect(otherAccount).castVote(roundId, [app1], [ethers.parseEther("1500")]))
    })

    it("I should be able to cast a vote", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner, emissions, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      await getVot3Tokens(otherAccount, "1000")

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()
      expect(roundId).to.eql(1n)

      // I should be able to cast a vote
      const tx = await xAllocationVoting.connect(otherAccount).castVote(roundId, [app1], [ethers.parseEther("1000")])
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      const allocationVoteCast = filterEventsByName(receipt.logs, "AllocationVoteCast")
      expect(allocationVoteCast).not.to.eql([])

      const {
        voter,
        apps: votedApps,
        voteWeights,
        roundId: votedRoundId,
      } = parseAllocationVoteCastEvent(allocationVoteCast[0], xAllocationVoting)
      expect(voter).to.eql(otherAccount.address)
      expect(votedRoundId).to.eql(roundId)
      expect(votedApps).to.eql([app1])
      expect(voteWeights).to.eql([ethers.parseEther("1000")])

      // Votes should be tracked correctly
      const appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("1000"))

      const totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("1000"))
    })

    it("I should not be able to cast vote if my total VOT3 holding is less than 1", async function () {
      const { x2EarnApps, xAllocationVoting, otherAccounts, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      await getVot3Tokens(otherAccount, "0.1")

      const tx = await xAllocationVoting.startNewRound()
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")
      // Event should be emitted
      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      const { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)

      // I cannot cast a vote twice for the same round
      await expect(
        xAllocationVoting.connect(otherAccount).castVote(roundId, [app1], [ethers.parseEther("0.1")]),
      ).to.be.revertedWithCustomError(xAllocationVoting, "GovernorVotingThresholdNotMet")
    })

    it("I should not be able to cast vote twice", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      await getVot3Tokens(otherAccount, "1000")

      let tx = await xAllocationVoting.startNewRound()
      let receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")
      // Event should be emitted
      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      const { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)

      // I should be able to cast a vote
      tx = await xAllocationVoting.connect(otherAccount).castVote(roundId, [app1], [ethers.parseEther("500")])
      receipt = await tx.wait()

      // I cannot cast a vote twice for the same round
      await catchRevert(xAllocationVoting.connect(otherAccount).castVote(roundId, [app1], [ethers.parseEther("500")]))
    })

    it("Cannot cast a vote if the allocation round ended", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      await getVot3Tokens(otherAccount, "1000")

      let tx = await xAllocationVoting.startNewRound()
      let receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")
      // Event should be emitted
      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      const { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)

      // I should be able to cast a vote
      tx = await xAllocationVoting.connect(otherAccount).castVote(roundId, [app1], [ethers.parseEther("500")])
      receipt = await tx.wait()

      await waitForRoundToEnd(roundId)

      // I cannot cast a vote if the round is not active
      await catchRevert(xAllocationVoting.connect(otherAccount).castVote(roundId, [app1], [ethers.parseEther("500")]))
    })

    it("I should be able to vote for multiple apps", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))

      await getVot3Tokens(otherAccount, "1000")

      let tx = await xAllocationVoting.startNewRound()
      let receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      expect(roundCreated).not.to.eql([])
      const { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)

      await waitForNextBlock()

      // both apps should be eligible for votes
      const app1Available = await xAllocationVoting.isEligibleForVote(app1, roundId)
      const app2Available = await xAllocationVoting.isEligibleForVote(app1, roundId)
      expect(app1Available).to.equal(true)
      expect(app2Available).to.equal(true)

      const avaiableApps = await x2EarnApps.allEligibleApps()
      expect(avaiableApps.length).to.equal(2)
      expect(avaiableApps[0]).to.equal(app1)
      expect(avaiableApps[1]).to.equal(app2)

      const appsVotedInSpecificRound = await xAllocationVoting.getAppIdsOfRound(roundId)
      expect(appsVotedInSpecificRound.length).to.equal(2)
      expect(appsVotedInSpecificRound[0]).to.equal(app1)
      expect(appsVotedInSpecificRound[1]).to.equal(app2)

      // I should be able to vote for multiple apps
      tx = await xAllocationVoting
        .connect(otherAccount)
        .castVote(roundId, [app1, app2], [ethers.parseEther("300"), ethers.parseEther("200")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      const allocationVoteCast = filterEventsByName(receipt.logs, "AllocationVoteCast")
      expect(roundCreated).not.to.eql([])
      const {
        voter,
        apps: votedApps,
        voteWeights,
        roundId: votedRoundId,
      } = parseAllocationVoteCastEvent(allocationVoteCast[0], xAllocationVoting)
      expect(voter).to.eql(otherAccount.address)
      expect(votedRoundId).to.eql(BigInt(roundId))
      expect(votedApps).to.eql([app1, app2])
      expect(voteWeights).to.eql([ethers.parseEther("300"), ethers.parseEther("200")])

      // Votes should be tracked correctly
      let appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("300"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("200"))

      const totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("500"))
    })

    it("Votes should be tracked correctly", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      const voter2 = otherAccounts[3]
      const voter3 = otherAccounts[4]

      await getVot3Tokens(otherAccount, "1000")
      await getVot3Tokens(voter2, "1000")
      await getVot3Tokens(voter3, "1000")

      let tx = await xAllocationVoting.startNewRound()
      let receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      expect(roundCreated).not.to.eql([])
      const { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)

      tx = await xAllocationVoting
        .connect(otherAccount)
        .castVote(roundId, [app1, app2], [ethers.parseEther("300"), ethers.parseEther("200")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      tx = await xAllocationVoting
        .connect(voter2)
        .castVote(roundId, [app1, app2], [ethers.parseEther("200"), ethers.parseEther("100")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      tx = await xAllocationVoting
        .connect(voter3)
        .castVote(roundId, [app1, app2], [ethers.parseEther("100"), ethers.parseEther("500")])
      receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      // Votes should be tracked correctly
      let appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("800"))

      let totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("1400"))

      // Total voters should be tracked correctly
      const totalVoters = await xAllocationVoting.totalVoters(roundId)
      expect(totalVoters).to.eql(BigInt(3))

      await waitForRoundToEnd(roundId)

      // Votes should be the same after round ended
      appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("600"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("800"))

      totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("1400"))
    })

    it("If no one votes everything is tracked correctly", async function () {
      const {
        xAllocationVoting,
        x2EarnApps,
        otherAccounts,
        otherAccount,
        owner,
        emissions,
        minterAccount,
        xAllocationPool,
      } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      await x2EarnApps.setTeamAllocationPercentage(app1, 100)

      await getVot3Tokens(otherAccount, "1000")

      await emissions.connect(minterAccount).start()

      const roundId = await xAllocationVoting.currentRoundId()
      expect(roundId).to.eql(1n)

      await waitForRoundToEnd(Number(roundId))
      expect(await xAllocationVoting.state(roundId)).to.eql(1n) // quorum failed

      // Votes should be tracked correctly
      const appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("0"))

      const totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("0"))

      const totalVoters = await xAllocationVoting.totalVoters(roundId)
      expect(totalVoters).to.eql(BigInt(0))

      const appShares = await xAllocationPool.getAppShares(roundId, app1)
      expect(appShares).to.eql([0n, 0n])

      const appEarnings = await xAllocationPool.roundEarnings(roundId, app1)
      expect(appEarnings).to.eql([
        await xAllocationPool.baseAllocationAmount(roundId),
        0n,
        await xAllocationPool.baseAllocationAmount(roundId),
        0n,
      ])
    })

    it("I should be able to vote only for apps available in the allocation round", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      const app3 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))

      await getVot3Tokens(otherAccount, "1000")

      const tx = await xAllocationVoting.startNewRound()
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      expect(roundCreated).not.to.eql([])
      const { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)

      await catchRevert(xAllocationVoting.connect(otherAccount).castVote(roundId, [app3], [ethers.parseEther("300")]))

      // Votes should be tracked correctly
      let appVotes = await xAllocationVoting.getAppVotes(roundId, app1)
      expect(appVotes).to.eql(ethers.parseEther("0"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app2)
      expect(appVotes).to.eql(ethers.parseEther("0"))
      appVotes = await xAllocationVoting.getAppVotes(roundId, app3)
      expect(appVotes).to.eql(ethers.parseEther("0"))

      const totalVotes = await xAllocationVoting.totalVotes(roundId)
      expect(totalVotes).to.eql(ethers.parseEther("0"))
    })

    it("Allocation round should be successfull if quorum was reached", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))

      await getVot3Tokens(otherAccount, "1000")

      let tx = await xAllocationVoting.startNewRound()
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      const timepoint = receipt.blockNumber

      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      expect(roundCreated).not.to.eql([])
      const { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)

      tx = await xAllocationVoting
        .connect(otherAccount)
        .castVote(roundId, [app1, app2], [ethers.parseEther("300"), ethers.parseEther("200")])

      await waitForRoundToEnd(roundId)

      // Check totalSupply
      const totalSupply = await vot3.getPastTotalSupply(timepoint)
      // Check quorum
      const quorum = await xAllocationVoting.quorum(timepoint)
      // calculate how much is needed to reach quorum from total supply
      const neededVotes = (Number(ethers.formatEther(quorum)) * Number(ethers.formatEther(totalSupply))) / 100
      expect(5000).to.be.greaterThan(neededVotes)

      // quorum should be reached and round should be successful
      expect(await xAllocationVoting.state(roundId)).to.eql(BigInt(2))
    }).timeout(18000000)

    it("Allocation round should be failed if quorum was not reached", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner, vot3 } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      // Bootstrap emissions
      await bootstrapEmissions()

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))

      await getVot3Tokens(otherAccount, "1000")

      let tx = await xAllocationVoting.startNewRound()
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")
      const timepoint = receipt.blockNumber

      const roundCreated = filterEventsByName(receipt.logs, "RoundCreated")
      expect(roundCreated).not.to.eql([])
      const { roundId } = parseRoundStartedEvent(roundCreated[0], xAllocationVoting)

      tx = await xAllocationVoting
        .connect(otherAccount)
        .castVote(roundId, [app1, app2], [ethers.parseEther("1"), ethers.parseEther("1")])

      await waitForRoundToEnd(roundId)

      // Check totalSupply
      const totalSupply = await vot3.getPastTotalSupply(timepoint)
      // Check quorum
      const quorum = await xAllocationVoting.quorum(timepoint)
      // calculate how much is needed to reach quorum from total supply
      const neededVotes = (Number(ethers.formatEther(quorum)) * Number(ethers.formatEther(totalSupply))) / 100
      expect(neededVotes).to.be.greaterThan(2)

      expect(await xAllocationVoting.state(roundId)).to.eql(BigInt(1))
    }).timeout(18000000)

    it("Can track apps available for voting on current and previous rounds correctly", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // 2 apps in round1
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      const round1 = await startNewAllocationRound()
      let getAppIdsOfRound = await xAllocationVoting.getAppIdsOfRound(round1)
      expect(getAppIdsOfRound.length).to.equal(2n)

      // add new app before round ends
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
      await waitForRoundToEnd(round1)

      // 4 apps in round2
      const round2 = await startNewAllocationRound()
      getAppIdsOfRound = await xAllocationVoting.getAppIdsOfRound(round2)
      expect(getAppIdsOfRound.length).to.equal(4n)

      // remove apps before round ends
      await x2EarnApps.setVotingEligibility(app1, false)
      await x2EarnApps.setVotingEligibility(app2, false)
      await waitForRoundToEnd(round2)

      // 2 app in round 3
      const round3 = await startNewAllocationRound()
      getAppIdsOfRound = await xAllocationVoting.getAppIdsOfRound(round3)
      expect(getAppIdsOfRound.length).to.equal(2n)

      // add another app before round ends
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")
      await waitForRoundToEnd(round3)

      // 3 apps in round 4
      const round4 = await startNewAllocationRound()
      getAppIdsOfRound = await xAllocationVoting.getAppIdsOfRound(round4)
      expect(getAppIdsOfRound.length).to.equal(3n)

      // I can still get old rounds
      getAppIdsOfRound = await xAllocationVoting.getAppIdsOfRound(round1)
      expect(getAppIdsOfRound.length).to.equal(2n)
      getAppIdsOfRound = await xAllocationVoting.getAppIdsOfRound(round2)
      expect(getAppIdsOfRound.length).to.equal(4n)
      getAppIdsOfRound = await xAllocationVoting.getAppIdsOfRound(round3)
      expect(getAppIdsOfRound.length).to.equal(2n)
    })

    it("I can fetch all apps with details available for voting", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // 2 apps in round1
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))
      const round1 = await startNewAllocationRound()
      const getAppIdsOfRound = await xAllocationVoting.getAppIdsOfRound(round1)
      expect(getAppIdsOfRound.length).to.equal(2n)

      const apps = await xAllocationVoting.getAppsOfRound(round1)
      expect(apps.length).to.equal(2n)
      expect(apps[0].id).to.equal(app1)
      expect(apps[1].id).to.equal(app2)
      expect(apps[0].name).to.equal(otherAccounts[0].address)
      expect(apps[1].name).to.equal(otherAccounts[1].address)
    })

    it("Stores that a user voted at least once", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      // Check if user voted
      let voted = await xAllocationVoting.hasVotedOnce(otherAccount.address)
      expect(voted).to.equal(false)

      await getVot3Tokens(otherAccount, "1")
      await getVot3Tokens(owner, "1000")

      const appName = "App"

      await x2EarnApps.connect(owner).addApp(otherAccount.address, otherAccount.address, appName, "metadataURI")
      const roundId = await startNewAllocationRound()

      // Vote
      await xAllocationVoting
        .connect(otherAccount)
        .castVote(roundId, [await x2EarnApps.hashAppName(appName)], [ethers.parseEther("1")])

      // Check if user voted
      voted = await xAllocationVoting.hasVotedOnce(otherAccount.address)
      expect(voted).to.equal(true)
    })

    it("Cannot cast vote with apps and weights length mismatch", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))

      await getVot3Tokens(otherAccount, "1000")

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      const roundId = await xAllocationVoting.currentRoundId()
      expect(roundId).to.eql(1n)

      // I should be able to cast a vote
      await catchRevert(
        xAllocationVoting
          .connect(otherAccount)
          .castVote(roundId, [app1Id], [ethers.parseEther("500"), ethers.parseEther("500")]),
      )
    })

    it("Cannot cast vote with no apps to vote for", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")

      await getVot3Tokens(otherAccount, "1000")

      // Bootstrap emissions
      await bootstrapAndStartEmissions()

      const roundId = await xAllocationVoting.currentRoundId()
      expect(roundId).to.eql(1n)

      // I should be able to cast a vote
      await catchRevert(xAllocationVoting.connect(otherAccount).castVote(roundId, [], []))
    })

    // quorumReached
    it("Quorum is reached correctly", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccount, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // add apps
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[0].address, otherAccounts[0].address, otherAccounts[0].address, "metadataURI")
      const app1 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[1].address, otherAccounts[1].address, otherAccounts[1].address, "metadataURI")
      const app2 = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[1].address))

      await getVot3Tokens(otherAccount, "1000")

      // Bootstrap emissions
      await bootstrapAndStartEmissions()
      await waitForNextBlock()

      const roundId = await xAllocationVoting.currentRoundId()
      expect(roundId).to.eql(1n)

      expect(await xAllocationVoting.quorumReached(1)).to.eql(false)

      await xAllocationVoting
        .connect(otherAccount)
        .castVote(1, [app1, app2], [ethers.parseEther("500"), ethers.parseEther("500")])

      // quorum should be reached
      expect(await xAllocationVoting.quorumReached(1)).to.eql(true)

      waitForCurrentRoundToEnd()

      // quorum should be reached
      expect(await xAllocationVoting.quorumReached(1)).to.eql(true)
    })

    it("App shares cap per round is saved correctly", async function () {
      const { xAllocationVoting, emissions, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const GOVERNANCE_ROLE = await xAllocationVoting.GOVERNANCE_ROLE()
      await xAllocationVoting.connect(owner).grantRole(GOVERNANCE_ROLE, owner.address)

      await xAllocationVoting.setAppSharesCap(50)
      expect(await xAllocationVoting.appSharesCap()).to.eql(50n)

      // Bootstrap emissions
      await bootstrapAndStartEmissions()
      await waitForNextBlock()

      expect(await xAllocationVoting.getRoundAppSharesCap(1)).to.eql(50n)

      await xAllocationVoting.setAppSharesCap(60)

      expect(await xAllocationVoting.getRoundAppSharesCap(1)).to.eql(50n)

      await waitForCurrentRoundToEnd()
      expect(await xAllocationVoting.getRoundAppSharesCap(1)).to.eql(50n)

      await emissions.distribute()
      expect(await xAllocationVoting.getRoundAppSharesCap(2)).to.eql(60n)
    })
  })

  describe("Allocation Voting finalization", function () {
    it("Cannot finalize active round", async function () {
      const { xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const round1 = await startNewAllocationRound()

      await catchRevert(xAllocationVoting.finalizeRound(round1))

      const isFinalized = await xAllocationVoting.isFinalized(round1)
      expect(isFinalized).to.eql(false)
    })

    it("Previous round is finalized correctly when a new one starts", async function () {
      const { xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const round1 = await startNewAllocationRound()
      let isFinalized = await xAllocationVoting.isFinalized(round1)
      expect(isFinalized).to.eql(false)
      await waitForRoundToEnd(round1)

      isFinalized = await xAllocationVoting.isFinalized(round1)
      expect(isFinalized).to.eql(false)

      await startNewAllocationRound()

      isFinalized = await xAllocationVoting.isFinalized(round1)
      expect(isFinalized).to.eql(true)
    })

    it("Anyone can manually trigger round finalization", async function () {
      const { xAllocationVoting, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      await getVot3Tokens(otherAccount, "1000")

      const round1 = await startNewAllocationRound()
      await waitForRoundToEnd(round1)

      // should be failed since quorum is not reached
      const state = await xAllocationVoting.state(round1)
      expect(state).to.eql(1n)

      let isFinalized = await xAllocationVoting.isFinalized(round1)
      expect(isFinalized).to.eql(false)

      await xAllocationVoting.finalizeRound(round1)

      isFinalized = await xAllocationVoting.isFinalized(round1)
      expect(isFinalized).to.eql(true)
    })

    it("No issues occurs in finalizing a round twice", async function () {
      const { xAllocationVoting, emissions, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // we need to mint some token otherwise there is no quorum to reach
      await getVot3Tokens(otherAccount, "1000")

      // first round always succeeds
      await bootstrapAndStartEmissions()
      await waitForCurrentRoundToEnd()

      // start new round
      await emissions.distribute()

      // check that round 1 is finalized
      expect(await xAllocationVoting.isFinalized(1)).to.eql(true)

      const roundId = await xAllocationVoting.currentRoundId()
      await waitForCurrentRoundToEnd()

      // should be failed since quorum is not reached
      const state = await xAllocationVoting.state(roundId)
      expect(state).to.eql(1n)

      let isFinalized = await xAllocationVoting.isFinalized(roundId)
      expect(isFinalized).to.eql(false)

      await xAllocationVoting.finalizeRound(roundId)

      isFinalized = await xAllocationVoting.isFinalized(roundId)
      expect(isFinalized).to.eql(true)

      await expect(xAllocationVoting.finalizeRound(roundId)).to.not.be.reverted
      expect(await xAllocationVoting.isFinalized(roundId)).to.eql(true)
    })

    it("Round #1 is finalized even if quorum is not reached", async function () {
      const { xAllocationVoting, emissions, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // we need to mint some token otherwise there is no quorum to reach
      await getVot3Tokens(otherAccount, "1000")

      // first round always succeeds
      await bootstrapAndStartEmissions()
      await waitForCurrentRoundToEnd()

      // start new round
      await emissions.distribute()

      expect(await xAllocationVoting.state(1)).to.eql(1n) // quorum failed

      // check that round 1 is finalized
      expect(await xAllocationVoting.isFinalized(1)).to.eql(true)
      expect(await xAllocationVoting.latestSucceededRoundId(1)).to.eql(1n)
    })

    it("Can finalize failed round", async function () {
      const { xAllocationVoting, emissions, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // we need to mint some token otherwise there is no quorum to reach
      await getVot3Tokens(otherAccount, "1000")

      // first round always succeeds
      await bootstrapAndStartEmissions()
      await waitForCurrentRoundToEnd()

      // start and end new round
      await emissions.distribute()
      await waitForCurrentRoundToEnd()

      // start round 3, it should finalize round 2
      await emissions.distribute()

      expect(await xAllocationVoting.state(2)).to.eql(1n) // quorum failed
      expect(await xAllocationVoting.isFinalized(2)).to.eql(true)
      expect(await xAllocationVoting.latestSucceededRoundId(2)).to.eql(1n)
    })

    it("Cannot finalize active round", async function () {
      const { xAllocationVoting } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const round1 = await startNewAllocationRound()

      await catchRevert(xAllocationVoting.finalizeRound(round1))

      const isFinalized = await xAllocationVoting.isFinalized(round1)
      expect(isFinalized).to.eql(false)
    })

    it("Finalizing a failed round should point to the latest succeeded round", async function () {
      const { xAllocationVoting, emissions, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // we need to mint some token otherwise there is no quorum to reach
      await getVot3Tokens(otherAccount, "1000")

      // first round always succeeds
      await bootstrapAndStartEmissions()
      await waitForCurrentRoundToEnd()

      // start and end new round
      await emissions.distribute()
      await waitForCurrentRoundToEnd()

      // start round 3, it should finalize round 2
      await emissions.distribute()

      expect(await xAllocationVoting.state(2)).to.eql(1n) // quorum failed
      expect(await xAllocationVoting.isFinalized(2)).to.eql(true)
      expect(await xAllocationVoting.latestSucceededRoundId(2)).to.eql(1n)
    })
  })

  describe("Quadratic Funding", function () {
    it("Can get the correct QF app votes", async function () {
      const { xAllocationVoting, x2EarnApps, otherAccounts, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Bootstrap emissions
      await bootstrapEmissions()

      otherAccounts.forEach(async account => {
        await getVot3Tokens(account, "10000")
      })

      //Add apps

      const app1Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[2].address))
      const app2Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[3].address))
      const app3Id = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[4].address))
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[2].address, otherAccounts[2].address, otherAccounts[2].address, "metadataURI")
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[3].address, otherAccounts[3].address, otherAccounts[3].address, "metadataURI")
      await x2EarnApps
        .connect(owner)
        .addApp(otherAccounts[4].address, otherAccounts[4].address, otherAccounts[4].address, "metadataURI")

      //Start allocation round
      const round1 = await startNewAllocationRound()
      // Vote
      await xAllocationVoting
        .connect(otherAccounts[1])
        .castVote(
          round1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("900"), ethers.parseEther("100")],
        )
      await xAllocationVoting
        .connect(otherAccounts[2])
        .castVote(
          round1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("500"), ethers.parseEther("100")],
        )
      await xAllocationVoting
        .connect(otherAccounts[3])
        .castVote(
          round1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("0"), ethers.parseEther("100"), ethers.parseEther("100")],
        )
      await xAllocationVoting
        .connect(otherAccounts[4])
        .castVote(round1, [app2Id, app3Id], [ethers.parseEther("100"), ethers.parseEther("100")])

      await xAllocationVoting
        .connect(otherAccounts[5])
        .castVote(
          round1,
          [app1Id, app2Id, app3Id],
          [ethers.parseEther("1000"), ethers.parseEther("0"), ethers.parseEther("100")],
        )

      await waitForRoundToEnd(round1)

      const expectedUnsquaredVotesApp1 = Math.sqrt(0) + Math.sqrt(0) + Math.sqrt(0) + Math.sqrt(0) + Math.sqrt(1000)
      const app1VotesQF = await xAllocationVoting.getAppVotesQF(round1, app1Id)
      // sqrt of 10^18 is 10^9 hence we need to divide by 10^9
      expect(app1VotesQF).to.equal(ethers.parseEther(expectedUnsquaredVotesApp1.toString()) / 1000000000n)

      const expectedUnsquaredVotesApp2 =
        Math.sqrt(900) + Math.sqrt(500) + Math.sqrt(100) + Math.sqrt(100) + Math.sqrt(0)
      const app2VotesQF = await xAllocationVoting.getAppVotesQF(round1, app2Id)
      expect(app2VotesQF).to.equal(ethers.parseEther(expectedUnsquaredVotesApp2.toString()) / 1000000000n)

      const expectedUnsquaredVotesApp3 =
        Math.sqrt(100) + Math.sqrt(100) + Math.sqrt(100) + Math.sqrt(100) + Math.sqrt(100)
      const app3VotesQF = await xAllocationVoting.getAppVotesQF(round1, app3Id)
      expect(app3VotesQF).to.equal(ethers.parseEther(expectedUnsquaredVotesApp3.toString()) / 1000000000n)

      const expectedTotalVotesQF =
        expectedUnsquaredVotesApp1 ** 2 + expectedUnsquaredVotesApp2 ** 2 + expectedUnsquaredVotesApp3 ** 2
      const totalVotes = await xAllocationVoting.totalVotesQF(round1)

      expect(Number(ethers.formatEther(totalVotes)).toFixed(6)).to.equal(expectedTotalVotesQF.toFixed(6))

      const expectedAppShare1 = expectedUnsquaredVotesApp1 ** 2 / expectedTotalVotesQF
      const appShare1 = Number(app1VotesQF) ** 2 / Number(totalVotes)
      expect(appShare1.toFixed(6)).to.equal(expectedAppShare1.toFixed(6))
      expect(appShare1.toFixed(4)).to.equal("0.1145") // 11.45% of the total votes

      const expectedAppShare2 = expectedUnsquaredVotesApp2 ** 2 / expectedTotalVotesQF
      const appShare2 = Number(app2VotesQF) ** 2 / Number(totalVotes)
      expect(appShare2.toFixed(6)).to.equal(expectedAppShare2.toFixed(6))
      expect(appShare2.toFixed(4)).to.equal("0.5994") // 59.94% of the total votes

      const expectedAppShare3 = expectedUnsquaredVotesApp3 ** 2 / expectedTotalVotesQF
      const appShare3 = Number(app3VotesQF) ** 2 / Number(totalVotes)
      expect(appShare3.toFixed(6)).to.equal(expectedAppShare3.toFixed(6))
      expect(appShare3.toFixed(4)).to.equal("0.2862") // 28.61% of the total votes
    })
  })
})
