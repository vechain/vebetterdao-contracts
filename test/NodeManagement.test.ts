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

describe("Node Management - @shard4", function () {
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

      expect(await nodeManagement.version()).to.equal("1")
    })
  })

  describe("Admin", () => {
    it("Admin can set vechain nodes contract address", async function () {
      const { owner, nodeManagement } = await getOrDeployContractInstances({ forceDeploy: true })

      const initialAddress = await nodeManagement.getVechainNodesContract()

      await nodeManagement.connect(owner).setVechainNodesContract(owner.address)

      const updatedAddress = await nodeManagement.getVechainNodesContract()
      expect(updatedAddress).to.eql(owner.address)
      expect(updatedAddress).to.not.eql(initialAddress)
    })
    it("Only Admin can set vechain nodes contract address", async function () {
      const { owner, otherAccount, nodeManagement } = await getOrDeployContractInstances({ forceDeploy: true })

      await expect(nodeManagement.connect(otherAccount).setVechainNodesContract(owner.address)).to.be.reverted
    })
  })

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
})
