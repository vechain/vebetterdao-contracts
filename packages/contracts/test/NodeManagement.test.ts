import { ethers } from "hardhat"
import { expect } from "chai"
import {
  ZERO_ADDRESS,
  catchRevert,
  filterEventsByName,
  getOrDeployContractInstances,
  createNodeHolder,
} from "./helpers"
import { describe, it } from "mocha"
import { getImplementationAddress } from "@openzeppelin/upgrades-core"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { NodeManagement, NodeManagementV1 } from "../typechain-types"
import { deployProxy, upgradeProxy } from "../scripts/helpers"

describe.skip("Node Management -@shard5", function () {
  describe("Contract upgradeablity", () => {
    it("Cannot initialize twice", async function () {
      const { nodeManagement, vechainNodesMock, owner } = await getOrDeployContractInstances({ forceDeploy: true })
      await catchRevert(nodeManagement.initialize(await vechainNodesMock.getAddress(), owner.address, owner.address))
    })

    it("User with UPGRADER_ROLE should be able to upgrade the contract", async function () {
      const { nodeManagement, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("NodeManagement")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await nodeManagement.getAddress())

      const UPGRADER_ROLE = await nodeManagement.UPGRADER_ROLE()
      expect(await nodeManagement.hasRole(UPGRADER_ROLE, owner.address)).to.eql(true)

      await expect(nodeManagement.connect(owner).upgradeToAndCall(await implementation.getAddress(), "0x")).to.not.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await nodeManagement.getAddress())

      expect(newImplAddress.toUpperCase()).to.not.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Only user with UPGRADER_ROLE should be able to upgrade the contract", async function () {
      const { nodeManagement, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      // Deploy the implementation contract
      const Contract = await ethers.getContractFactory("NodeManagement")
      const implementation = await Contract.deploy()
      await implementation.waitForDeployment()

      const currentImplAddress = await getImplementationAddress(ethers.provider, await nodeManagement.getAddress())

      const UPGRADER_ROLE = await nodeManagement.UPGRADER_ROLE()
      expect(await nodeManagement.hasRole(UPGRADER_ROLE, otherAccount.address)).to.eql(false)

      await expect(nodeManagement.connect(otherAccount).upgradeToAndCall(await implementation.getAddress(), "0x")).to.be
        .reverted

      const newImplAddress = await getImplementationAddress(ethers.provider, await nodeManagement.getAddress())

      expect(newImplAddress.toUpperCase()).to.eql(currentImplAddress.toUpperCase())
      expect(newImplAddress.toUpperCase()).to.not.eql((await implementation.getAddress()).toUpperCase())
    })

    it("Should return correct version of the contract", async () => {
      const { nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      expect(await nodeManagement.version()).to.equal("2")
    })

    it("Should be no state conflicts after upgrade", async () => {
      const { owner, otherAccount, otherAccounts, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      const nodeManagementV1 = (await deployProxy("NodeManagementV1", [
        await vechainNodesMock.getAddress(),
        owner.address,
        owner.address,
      ])) as NodeManagementV1

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await createNodeHolder(4, otherAccounts[0]) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      const tx = await vechainNodesMock.addToken(otherAccounts[2].address, 7, false, 0, 0)

      // Wait for the transaction to be mined
      const receipt = await tx.wait()
      if (!receipt) throw new Error("No receipt")

      // Retrieve the block where the transaction was included
      const block = await ethers.provider.getBlock(receipt.blockNumber)
      if (!block) throw new Error("No block")

      await nodeManagementV1.connect(owner).delegateNode(otherAccount.address)
      await nodeManagementV1.connect(otherAccounts[0]).delegateNode(otherAccount.address)
      await nodeManagementV1.connect(otherAccounts[1]).delegateNode(otherAccount.address)

      let storageSlots = []

      const initialSlot = BigInt("0x895b04a03424f581b1c6717e3715bbb5ceb9c40a4e5b61a13e84096251cf8f00") // Slot 0 of VoterRewards

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlots.push(await ethers.provider.getStorage(await nodeManagementV1.getAddress(), i))
      }

      storageSlots = storageSlots.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      ) // removing empty slots

      const nodeManagement = (await upgradeProxy(
        "NodeManagementV1",
        "NodeManagement",
        await nodeManagementV1.getAddress(),
        [],
        {
          version: 2,
        },
      )) as NodeManagement

      const storageSlotsAfter = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await nodeManagement.getAddress(), i))
      }

      // Check if storage slots are the same after upgrade
      for (let i = 0; i < storageSlots.length; i++) {
        expect(storageSlots[i]).to.equal(storageSlotsAfter[i])
      }

      // Check if all nodes are delegated to the same address
      expect(await nodeManagement.getNodeIds(otherAccount.address)).to.eql([1n, 2n, 3n])

      // Check node owners are not delegated to themselves
      expect(await nodeManagement.getNodeIds(owner.address)).to.eql([])
      expect(await nodeManagement.getNodeIds(otherAccounts[0].address)).to.eql([])
      expect(await nodeManagement.getNodeIds(otherAccounts[1].address)).to.eql([])
    })
  })

  // describe("Admin", () => {
  //   it("Admin can set vechain nodes contract address", async function () {
  //     const { owner, nodeManagement } = await getOrDeployContractInstances({ forceDeploy: true })

  //     const initialAddress = await nodeManagement.getVechainNodesContract()

  //     await nodeManagement.connect(owner).setVechainNodesContract(owner.address)

  //     const updatedAddress = await nodeManagement.getVechainNodesContract()
  //     expect(updatedAddress).to.eql(owner.address)
  //     expect(updatedAddress).to.not.eql(initialAddress)
  //   })

  //   it("Only Admin can set vechain nodes contract address", async function () {
  //     const { owner, otherAccount, nodeManagement } = await getOrDeployContractInstances({ forceDeploy: true })

  //     await expect(nodeManagement.connect(otherAccount).setVechainNodesContract(owner.address)).to.be.reverted
  //   })
  // })

  describe("Node Delegation", () => {
    it("Should allow node owner to delegate node", async function () {
      const { owner, otherAccount, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      const tx = await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      const delegatee = await nodeManagement.getNodeManager(nodeId)
      expect(delegatee).to.equal(otherAccount.address)

      // Check if event was emitted
      const txReceipt = await tx.wait()
      if (!txReceipt) throw new Error("No receipt")
      const nodeDelegated = filterEventsByName(txReceipt.logs, "NodeDelegated")
      expect(nodeDelegated).not.to.eql([])
    })

    it("Should allow node owner to remove delegation", async function () {
      const { owner, otherAccount, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership and delegation
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      const delegatee = await nodeManagement.getNodeManager(nodeId)
      expect(delegatee).to.equal(otherAccount.address)

      const tx = await nodeManagement.connect(owner).removeNodeDelegation()

      const newManager = await nodeManagement.getNodeManager(nodeId)

      // Node should no longer be delegated -> manager should be the owner
      expect(newManager).to.equal(owner.address)

      // Check if event was emitted
      const txReceipt = await tx.wait()
      if (!txReceipt) throw new Error("No receipt")
      const nodeDelegated = filterEventsByName(txReceipt.logs, "NodeDelegated")
      expect(nodeDelegated).not.to.eql([])
    })

    it("Should revert if non-node owner tries to delegate a node", async function () {
      const { otherAccount, owner, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      await expect(nodeManagement.connect(otherAccount).delegateNode(owner.address)).to.be.revertedWithCustomError(
        nodeManagement,
        "NodeManagementNonNodeHolder",
      )
    })

    it("Should revert if node owner tries to delegate themselves", async function () {
      const { owner, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      // Node cannot be delegated to themselves
      await expect(nodeManagement.connect(owner).delegateNode(owner.address)).to.be.revertedWithCustomError(
        nodeManagement,
        "NodeManagementSelfDelegation",
      )
    })

    it("Should revert if node is getting delegated to the zero address", async function () {
      const { owner, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership and delegation
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      await vechainNodesMock.ownerToId(owner.address)

      // Node cannot be delegated to the zero address
      await expect(nodeManagement.connect(owner).delegateNode(ZERO_ADDRESS)).to.be.revertedWithCustomError(
        nodeManagement,
        "NodeManagementZeroAddress",
      )
    })

    it("A user can have multiple nodes delegated to them", async function () {
      const { owner, otherAccount, nodeManagement, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await createNodeHolder(2, otherAccounts[0]) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await createNodeHolder(2, otherAccounts[1]) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      await nodeManagement.connect(owner).delegateNode(otherAccount.address)
      await nodeManagement.connect(otherAccounts[0]).delegateNode(otherAccount.address)
      await nodeManagement.connect(otherAccounts[1]).delegateNode(otherAccount.address)

      // Check if all nodes are delegated to the same address
      expect(await nodeManagement.getNodeIds(otherAccount.address)).to.eql([1n, 2n, 3n])

      // Check node owners are not delegated to themselves
      expect(await nodeManagement.getNodeIds(owner.address)).to.eql([])
      expect(await nodeManagement.getNodeIds(otherAccounts[0].address)).to.eql([])
      expect(await nodeManagement.getNodeIds(otherAccounts[1].address)).to.eql([])
    })

    it("A node owner should be able to re-delegate node", async function () {
      const { owner, nodeManagement, vechainNodesMock, otherAccount, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

      // Mock node ownership and delegation
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      await vechainNodesMock.ownerToId(owner.address)

      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      expect(await nodeManagement.getNodeManager(await vechainNodesMock.ownerToId(owner.address))).to.equal(
        otherAccount.address,
      )

      // Should be able to re-delegate the node
      const tx = await nodeManagement.connect(owner).delegateNode(otherAccounts[1].address)

      expect(await nodeManagement.getNodeManager(await vechainNodesMock.ownerToId(owner.address))).to.equal(
        otherAccounts[1].address,
      )

      // Check if two events were emitted
      const txReceipt = await tx.wait()
      if (!txReceipt) throw new Error("No receipt")

      const nodeDelegated = filterEventsByName(txReceipt.logs, "NodeDelegated")
      expect(nodeDelegated.length).to.eql(2)

      // Other account should not be the manager
      expect(await nodeManagement.getNodeIds(otherAccount.address)).to.eql([])
    })

    it("Should revert if non node owner is trying to remove delegation", async function () {
      const { nodeManagement, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      await expect(nodeManagement.connect(otherAccount).removeNodeDelegation()).to.be.revertedWithCustomError(
        nodeManagement,
        "NodeManagementNonNodeHolder",
      )
    })

    it("Should revert if non node owner is trying to remove delegation if node is not delegated", async function () {
      const { nodeManagement, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      // Node should not be delegated at this point so this should revert
      await expect(nodeManagement.connect(owner).removeNodeDelegation()).to.be.revertedWithCustomError(
        nodeManagement,
        "NodeManagementNodeNotDelegated",
      )
    })

    it("If a node is downgraded to level NONE, it cannot be delegated", async function () {
      const { owner, nodeManagement, vechainNodesMock, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(7, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      // Skip ahead 1 day
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      //Downgrade the node to level NONE
      const nodeId = await vechainNodesMock.ownerToId(owner.address)
      await vechainNodesMock.connect(owner).downgradeTo(nodeId, 0)

      await expect(nodeManagement.connect(owner).delegateNode(otherAccounts[5].address)).to.be.revertedWithCustomError(
        nodeManagement,
        "NodeManagementNonNodeHolder",
      )
    })

    it("If a node is tranfserred new owner can re-delegate to another account to manage", async function () {
      const { owner, nodeManagement, vechainNodesMock, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(7, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      // delegate the node
      await nodeManagement.connect(owner).delegateNode(otherAccounts[5].address)

      // Skip ahead 1 day
      await time.setNextBlockTimestamp((await time.latest()) + 86400)
      // Transfer the node to the other account
      await vechainNodesMock.connect(owner).transfer(otherAccounts[0].address, 1)

      // Account 5 should still be the manager
      expect(await nodeManagement.getNodeManager(1)).to.equal(otherAccounts[5].address)

      // Should be able to re-delegate the node
      await nodeManagement.connect(otherAccounts[0]).delegateNode(otherAccounts[1].address)

      // Account 1 should now be the manager
      expect(await nodeManagement.getNodeManager(1)).to.equal(otherAccounts[1].address)
    })

    it("If a node is tranfserred that was delegated new owner can remove delegation if they want to manage it", async function () {
      const { owner, nodeManagement, vechainNodesMock, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(7, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      // delegate the node
      await nodeManagement.connect(owner).delegateNode(otherAccounts[5].address)

      // Skip ahead 1 day
      await time.setNextBlockTimestamp((await time.latest()) + 86400)
      // Transfer the node to the other account
      await vechainNodesMock.connect(owner).transfer(otherAccounts[0].address, 1)

      // Account 5 should still be the manager
      expect(await nodeManagement.getNodeManager(1)).to.equal(otherAccounts[5].address)

      // Should be able to re-delegate the node
      await nodeManagement.connect(otherAccounts[0]).removeNodeDelegation()

      // Account 0 should now be the manager
      expect(await nodeManagement.getNodeManager(1)).to.equal(otherAccounts[0].address)

      // Account 1 should not be the manager
      expect(await nodeManagement.getNodeIds(otherAccounts[1].address)).to.eql([])
    })
  })

  describe("Node Management", () => {
    it("Should return the owner as the node manager if the node has not been delegated", async function () {
      const { owner, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      // Node should not be delegated at this point so the manager should be the owner
      const manager = await nodeManagement.getNodeManager(nodeId)
      expect(manager).to.equal(owner.address)
    })

    it("Should return the correct node manager if the node has been delegated", async function () {
      const { owner, otherAccount, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      // Node should be delegated at this point so the manager should be the delegatee
      const manager = await nodeManagement.getNodeManager(nodeId)
      expect(manager).to.equal(otherAccount.address)
    })

    it("Should return the correct node manager if the node has been re-delegated", async function () {
      const { owner, otherAccount, nodeManagement, vechainNodesMock, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      // Node should be delegated at this point so the manager should be the delegatee
      let manager = await nodeManagement.getNodeManager(nodeId)
      expect(manager).to.equal(otherAccount.address)

      await nodeManagement.connect(owner).delegateNode(otherAccounts[0].address)

      // Node should be delegated at this point so the manager should be the delegatee
      manager = await nodeManagement.getNodeManager(nodeId)
      expect(manager).to.equal(otherAccounts[0].address)
    })

    it("Should return the correct node manager if the node has been re-delegated multiple times", async function () {
      const { owner, otherAccount, nodeManagement, vechainNodesMock, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      // Node should be delegated at this point so the manager should be the delegatee
      let manager = await nodeManagement.getNodeManager(nodeId)
      expect(manager).to.equal(otherAccount.address)

      await nodeManagement.connect(owner).delegateNode(otherAccounts[0].address)

      // Node should be delegated at this point so the manager should be the delegatee
      manager = await nodeManagement.getNodeManager(nodeId)
      expect(manager).to.equal(otherAccounts[0].address)

      await nodeManagement.connect(owner).delegateNode(otherAccounts[1].address)

      // Node should be delegated at this point so the manager should be the delegatee
      manager = await nodeManagement.getNodeManager(nodeId)
      expect(manager).to.equal(otherAccounts[1].address)
    })

    it("should return the correct node level", async function () {
      const { owner, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      // Node should not be delegated at this point so the level should be 2
      const nodeLevel = await nodeManagement.getNodeLevel(nodeId)
      expect(nodeLevel).to.equal(2)
    })

    it("Should return correct node level of a user owning a node", async function () {
      const { owner, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await vechainNodesMock.ownerToId(owner.address)

      // Node should not be delegated at this point so the level should be 2
      const nodeLevels = await nodeManagement.getUsersNodeLevels(owner.address)
      expect(nodeLevels[0]).to.equal(2n)
    })

    it("Should return correct node level of a user managing multiple nodes", async function () {
      const { owner, otherAccount, nodeManagement, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await createNodeHolder(4, otherAccounts[0]) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await createNodeHolder(7, otherAccounts[1]) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      await nodeManagement.connect(owner).delegateNode(otherAccount.address)
      await nodeManagement.connect(otherAccounts[0]).delegateNode(otherAccount.address)
      await nodeManagement.connect(otherAccounts[1]).delegateNode(otherAccount.address)

      // Node should not be delegated at this point so the level should be 2
      const nodeLevels = await nodeManagement.getUsersNodeLevels(otherAccount.address)
      expect(nodeLevels).to.eql([2n, 4n, 7n])
    })

    it("Should return true if a user owning a node is checked for being a node manager", async function () {
      const { owner, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      // Node should not be delegated at this point so the level should be 2
      const isManager = await nodeManagement.isNodeManager(owner.address, nodeId)
      expect(isManager).to.equal(true)
    })

    it("Should return true if a user with a node delegated is checked for being a node manager", async function () {
      const { owner, otherAccount, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await vechainNodesMock.ownerToId(owner.address)

      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      // Node should be delegated at this point so the other account should be the manager
      const isManager = await nodeManagement.isNodeManager(otherAccount.address, 1)
      expect(isManager).to.equal(true)
    })

    it("Should return false if a user owning a node who delegated it is checked for being a node manager", async function () {
      const { owner, otherAccount, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await vechainNodesMock.ownerToId(owner.address)

      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      // Node should be delegated at this point so the other account should be the manager and owner should not be
      const isManager = await nodeManagement.isNodeManager(owner.address, 1)
      expect(isManager).to.equal(false)
    })

    it("Should return false if a user not owning a node is checked for being a node manager", async function () {
      const { owner, otherAccount, nodeManagement, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13
      await vechainNodesMock.ownerToId(owner.address)

      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      const isManager = await nodeManagement.isNodeManager(otherAccount.address, 2)
      expect(isManager).to.equal(false)
    })

    it("If a node is delegated to a user and the owner transfers the node, the same user should be the manager", async function () {
      const { owner, otherAccount, nodeManagement, vechainNodesMock, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      await nodeManagement.connect(owner).delegateNode(otherAccounts[5].address)

      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      // Transfer the node to the other account
      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)
      await vechainNodesMock.connect(owner).transfer(otherAccount.address, 1)

      const manager = await nodeManagement.getNodeManager(nodeId)
      expect(manager).to.equal(otherAccounts[5].address)
    })

    it("If a node is delegated to a user and the owner transfers the node, the same user should be the manager", async function () {
      const { owner, otherAccount, nodeManagement, vechainNodesMock, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
          deployMocks: true,
        })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      await nodeManagement.connect(owner).delegateNode(otherAccounts[5].address)

      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      // Transfer the node to the other account
      // Skip ahead 1 day to be able to transfer node
      await time.setNextBlockTimestamp((await time.latest()) + 86400)
      await vechainNodesMock.connect(owner).transfer(otherAccount.address, 1)

      const manager = await nodeManagement.getNodeManager(nodeId)
      expect(manager).to.equal(otherAccounts[5].address)
    })

    it("If a node is delegated and downgraded to level NONE false gets returned when check is user NODE manager", async function () {
      const { owner, nodeManagement, vechainNodesMock, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(7, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      await nodeManagement.connect(owner).delegateNode(otherAccounts[5].address)

      // Skip ahead 1 day
      await time.setNextBlockTimestamp((await time.latest()) + 86400)

      //Downgrade the node to level NONE
      const nodeId = await vechainNodesMock.ownerToId(owner.address)
      await vechainNodesMock.connect(owner).downgradeTo(nodeId, 0)

      const manager = await nodeManagement.isNodeManager(otherAccounts[5].address, 1)
      expect(manager).to.equal(false)
    })
  })

  describe("isNodeHolder Function", () => {
    it("Should return true for a user who owns a node", async function () {
      const { owner, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Node strength level 2 corresponds (Thunder) to an endorsement score of 13

      // Check if the owner is a node holder
      const isHolder = await nodeManagement.isNodeHolder(owner.address)
      expect(isHolder).to.equal(true)
    })

    it("Should return true for a user who only has delegated nodes", async function () {
      const { owner, otherAccount, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership and delegation
      await createNodeHolder(2, owner)
      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      // Check if the delegatee is a node holder
      const isHolder = await nodeManagement.isNodeHolder(otherAccount.address)
      expect(isHolder).to.equal(true)
    })

    it("Should return true for a user who both owns and has delegated nodes", async function () {
      const { owner, otherAccount, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership for both owned and delegated nodes
      await createNodeHolder(2, otherAccount) // Own node
      await createNodeHolder(4, owner) // Node to delegate

      // Delegate owner's node to otherAccount
      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      // Check if the user with both owned and delegated nodes is a holder
      const isHolder = await nodeManagement.isNodeHolder(otherAccount.address)
      expect(isHolder).to.equal(true)
    })

    it("Should return false for a user who neither owns nor has delegated nodes", async function () {
      const { otherAccount, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Check if a user with no nodes is a holder
      const isHolder = await nodeManagement.isNodeHolder(otherAccount.address)
      expect(isHolder).to.equal(false)
    })

    it("Should return false for zero address", async function () {
      const { nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Check if zero address is a holder
      const isHolder = await nodeManagement.isNodeHolder(ZERO_ADDRESS)
      expect(isHolder).to.equal(false)
    })
  })

  describe("Additional Node Management Functions", () => {
    it("Should correctly identify if a node is delegated", async function () {
      const { owner, otherAccount, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner)

      // Initially node should not be delegated
      expect(await nodeManagement.isNodeDelegated(1)).to.equal(false)

      // Delegate the node
      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      // Now node should be delegated
      expect(await nodeManagement.isNodeDelegated(1)).to.equal(true)
    })

    it("Should correctly identify if a user is a node delegator", async function () {
      const { owner, otherAccount, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner)

      // Initially owner should not be a delegator
      expect(await nodeManagement.isNodeDelegator(owner.address)).to.equal(false)

      // Delegate the node
      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      // Now owner should be a delegator
      expect(await nodeManagement.isNodeDelegator(owner.address)).to.equal(true)

      // Other account should not be a delegator
      expect(await nodeManagement.isNodeDelegator(otherAccount.address)).to.equal(false)
    })

    it("Should return correct direct node ownership", async function () {
      const { owner, otherAccount, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner)

      // Owner should have node ID 1
      expect(await nodeManagement.getDirectNodeOwnership(owner.address)).to.equal(1n)

      // Other account should have no node
      expect(await nodeManagement.getDirectNodeOwnership(otherAccount.address)).to.equal(0n)
    })

    it("Should return correct user node details for a single node", async function () {
      const { owner, otherAccount, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock node ownership
      await createNodeHolder(2, owner) // Level 2 = Thunder node

      // Check owner's node details before delegation
      const nodesInfo = await nodeManagement.getUserNodes(owner.address)
      expect(nodesInfo.length).to.equal(1)

      const nodeInfo = nodesInfo[0]
      expect(nodeInfo.nodeId).to.equal(1n)
      expect(nodeInfo.nodeLevel).to.equal(2) // Thunder node
      expect(nodeInfo.xNodeOwner).to.equal(owner.address)
      expect(nodeInfo.isXNodeHolder).to.equal(true)
      expect(nodeInfo.isXNodeDelegated).to.equal(false)
      expect(nodeInfo.isXNodeDelegator).to.equal(false)
      expect(nodeInfo.isXNodeDelegatee).to.equal(false)
      expect(nodeInfo.delegatee).to.equal(ZERO_ADDRESS)

      // Delegate the node
      await nodeManagement.connect(owner).delegateNode(otherAccount.address)

      // Check owner's node details after delegation (should be empty array as node is delegated)
      const ownerNodesAfterDelegation = await nodeManagement.getUserNodes(owner.address)
      expect(ownerNodesAfterDelegation.length).to.equal(1)
      const ownerNodesAfterDelegationInfo = ownerNodesAfterDelegation[0]
      expect(ownerNodesAfterDelegationInfo.nodeId).to.equal(1n)
      expect(ownerNodesAfterDelegationInfo.nodeLevel).to.equal(2) // Thunder node
      expect(ownerNodesAfterDelegationInfo.xNodeOwner).to.equal(owner.address)
      expect(ownerNodesAfterDelegationInfo.isXNodeHolder).to.equal(true)
      expect(ownerNodesAfterDelegationInfo.isXNodeDelegated).to.equal(true)
      expect(ownerNodesAfterDelegationInfo.isXNodeDelegator).to.equal(true)
      expect(ownerNodesAfterDelegationInfo.isXNodeDelegatee).to.equal(false)
      expect(ownerNodesAfterDelegationInfo.delegatee).to.equal(otherAccount.address)

      // Check delegatee's node details
      const delegateeNodes = await nodeManagement.getUserNodes(otherAccount.address)
      expect(delegateeNodes.length).to.equal(1)

      const delegatedNodeInfo = delegateeNodes[0]
      expect(delegatedNodeInfo.nodeId).to.equal(1n)
      expect(delegatedNodeInfo.nodeLevel).to.equal(2) // Thunder node
      expect(delegatedNodeInfo.xNodeOwner).to.equal(owner.address)
      expect(delegatedNodeInfo.isXNodeHolder).to.equal(true)
      expect(delegatedNodeInfo.isXNodeDelegated).to.equal(true)
      expect(delegatedNodeInfo.isXNodeDelegator).to.equal(false)
      expect(delegatedNodeInfo.isXNodeDelegatee).to.equal(true)
      expect(delegatedNodeInfo.delegatee).to.equal(otherAccount.address)
    })

    it("Should return correct user node details for multiple nodes", async function () {
      const { owner, otherAccount, otherAccounts, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Mock multiple node ownerships with different levels
      await createNodeHolder(2, owner) // Thunder node
      await createNodeHolder(4, otherAccounts[0]) // Mjolnir node
      await createNodeHolder(7, otherAccounts[1]) // VeThor X node

      // Delegate all nodes to otherAccount
      await nodeManagement.connect(owner).delegateNode(otherAccount.address)
      await nodeManagement.connect(otherAccounts[0]).delegateNode(otherAccount.address)
      await nodeManagement.connect(otherAccounts[1]).delegateNode(otherAccount.address)

      // Check delegatee's node details
      const delegateeNodes = await nodeManagement.getUserNodes(otherAccount.address)
      expect(delegateeNodes.length).to.equal(3)

      // Check first node (Thunder)
      const nodeInfo1 = delegateeNodes[0]
      expect(nodeInfo1.nodeId).to.equal(1n)
      expect(nodeInfo1.nodeLevel).to.equal(2) // Thunder node
      expect(nodeInfo1.xNodeOwner).to.equal(owner.address)
      expect(nodeInfo1.isXNodeHolder).to.equal(true)
      expect(nodeInfo1.isXNodeDelegated).to.equal(true)
      expect(nodeInfo1.isXNodeDelegator).to.equal(false)
      expect(nodeInfo1.isXNodeDelegatee).to.equal(true)
      expect(nodeInfo1.delegatee).to.equal(otherAccount.address)

      // Check second node (Mjolnir)
      const nodeInfo2 = delegateeNodes[1]
      expect(nodeInfo2.nodeId).to.equal(2n)
      expect(nodeInfo2.nodeLevel).to.equal(4) // Mjolnir node
      expect(nodeInfo2.xNodeOwner).to.equal(otherAccounts[0].address)
      expect(nodeInfo2.isXNodeHolder).to.equal(true)
      expect(nodeInfo2.isXNodeDelegated).to.equal(true)
      expect(nodeInfo2.isXNodeDelegator).to.equal(false)
      expect(nodeInfo2.isXNodeDelegatee).to.equal(true)
      expect(nodeInfo2.delegatee).to.equal(otherAccount.address)

      // Check third node (VeThor X)
      const nodeInfo3 = delegateeNodes[2]
      expect(nodeInfo3.nodeId).to.equal(3n)
      expect(nodeInfo3.nodeLevel).to.equal(7) // VeThor X node
      expect(nodeInfo3.xNodeOwner).to.equal(otherAccounts[1].address)
      expect(nodeInfo3.isXNodeHolder).to.equal(true)
      expect(nodeInfo3.isXNodeDelegated).to.equal(true)
      expect(nodeInfo3.isXNodeDelegator).to.equal(false)
      expect(nodeInfo3.isXNodeDelegatee).to.equal(true)
      expect(nodeInfo3.delegatee).to.equal(otherAccount.address)
    })

    it("Should return empty array for user without any nodes", async function () {
      const { otherAccount, nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Check nodes for user without any ownership or delegation
      const nodesInfo = await nodeManagement.getUserNodes(otherAccount.address)

      // Should return empty array
      expect(nodesInfo.length).to.equal(0)
      expect(nodesInfo).to.eql([])
    })

    it("Should return empty array for zero address", async function () {
      const { nodeManagement } = await getOrDeployContractInstances({
        forceDeploy: true,
        deployMocks: true,
      })

      // Check nodes for zero address
      const nodesInfo = await nodeManagement.getUserNodes(ZERO_ADDRESS)

      // Should return empty array
      expect(nodesInfo.length).to.equal(0)
      expect(nodesInfo).to.eql([])
    })
  })

  describe("Storage Preservation During Upgrades", () => {
    it("Should not break storage when upgrading from v1 to current version", async function () {
      const { owner, otherAccount, vechainNodesMock } = await getOrDeployContractInstances({
        forceDeploy: false,
        deployMocks: true,
      })

      // Deploy current version first to set up initial state
      const nodeManagementV1 = (await deployProxy("NodeManagementV1", [
        await vechainNodesMock.getAddress(),
        owner.address,
        owner.address,
      ])) as NodeManagementV1

      // Set up initial state with current version
      await createNodeHolder(2, owner)
      await nodeManagementV1.connect(owner).delegateNode(otherAccount.address)

      const nodeId = await vechainNodesMock.ownerToId(owner.address)

      // Verify initial state
      expect(await nodeManagementV1.getNodeManager(nodeId)).to.equal(otherAccount.address)

      // Get storage slots before upgrade
      const initialSlot = BigInt(0)
      const storageSlots = []

      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlots.push(await ethers.provider.getStorage(await nodeManagementV1.getAddress(), i))
      }

      // Filter out empty slots
      const filteredSlots = storageSlots.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      )

      // Deploy V1 implementation and upgrade to it
      const nodeManagement = (await upgradeProxy(
        "NodeManagementV1",
        "NodeManagement",
        await nodeManagementV1.getAddress(),
        [],
        {
          version: 2,
        },
      )) as NodeManagement

      // Get storage slots after downgrade
      const storageSlotsAfter = []
      for (let i = initialSlot; i < initialSlot + BigInt(100); i++) {
        storageSlotsAfter.push(await ethers.provider.getStorage(await nodeManagement.getAddress(), i))
      }

      // Filter empty slots
      const filteredSlotsAfter = storageSlotsAfter.filter(
        slot => slot !== "0x0000000000000000000000000000000000000000000000000000000000000000",
      )

      // Verify storage slots remain unchanged
      for (let i = 0; i < filteredSlots.length; i++) {
        expect(filteredSlots[i]).to.equal(filteredSlotsAfter[i])
      }

      // Verify functionality still works
      expect(await nodeManagement.getNodeManager(nodeId)).to.equal(otherAccount.address)
    })
  })
})
