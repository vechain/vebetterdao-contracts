import { ethers } from "hardhat"
import { expect } from "chai"
import { getOrDeployContractInstances } from "./helpers"
import { describe, it } from "mocha"
import { ZeroAddress } from "ethers"

describe("B3TR Multi Sig - @shard0", function () {
  describe("Constructor", function () {
    it("should deploy the contract", async function () {
      const { b3trMultiSig } = await getOrDeployContractInstances({ forceDeploy: false })
      await b3trMultiSig.waitForDeployment()
      const address = await b3trMultiSig.getAddress()

      expect(address).not.to.eql(undefined)
    })

    it("Initializes owners correctly", async function () {
      const { b3trMultiSig, owner, otherAccount, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      const owners = await b3trMultiSig.getOwners()
      expect(owners).to.eql([owner.address, otherAccount.address, minterAccount.address])
    })

    it("Sets required confirmations", async function () {
      const { b3trMultiSig } = await getOrDeployContractInstances({
        forceDeploy: false,
      })

      const threshold = await b3trMultiSig.required()
      expect(threshold).to.eql(2n)
    })

    it("Rejects duplicate owners", async function () {
      const { owner } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      const B3TRMultiSig = await ethers.getContractFactory("B3TRMultiSig")
      await expect(B3TRMultiSig.deploy([owner.address, owner.address, owner.address], 2)).to.be.reverted
    })

    it("Rejects zero address", async function () {
      const { owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      const B3TRMultiSig = await ethers.getContractFactory("B3TRMultiSig")
      await expect(B3TRMultiSig.deploy([ZeroAddress, owner.address, otherAccount.address], 2)).to.be.reverted
    })

    it("Rejects if required is greater than owner count", async function () {
      const { owner, otherAccount, minterAccount } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      const B3TRMultiSig = await ethers.getContractFactory("B3TRMultiSig")
      await expect(B3TRMultiSig.deploy([minterAccount.address, owner.address, otherAccount.address], 10)).to.be.reverted
    })
  })

  describe("Submit Transaction", function () {
    it("Owner can submit transaction", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      await expect(b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall)).to
        .not.be.reverted
    })
    it("Emits Submission and Confirmation", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      const tx = b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall)

      await expect(tx).to.emit(b3trMultiSig, "Submission").withArgs(1)

      await expect(tx).to.emit(b3trMultiSig, "Confirmation").withArgs(owner.address, 1)
    })
    it("Non Owner cannot submit transaction", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: false,
      })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      await expect(
        b3trMultiSig.connect(otherAccounts[1]).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall),
      ).to.be.reverted
    })
  })

  describe("Confirm Transaction", function () {
    it("Owner can confirm transaction", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0)).to.not.be.reverted

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])
    })

    it("TX creator is automatically confirmed", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])
    })

    it("Emits confiration event", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "Confirmation")
        .withArgs(otherAccount.address, 0)

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])
    })

    it("Double-confirmation fails", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(owner).confirmTransaction(0)).to.be.reverted
    })

    it("Non Owner cannot confirm", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccounts[1]).confirmTransaction(0)).to.be.reverted
    })
  })

  describe("Revoke Transaction", function () {
    it("Owner can revoke transaction", async function () {
      const { b3trMultiSig, B3trContract, b3tr, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(owner).revokeConfirmation(0)).to.not.be.reverted

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([])
    })

    it("Should emit event revoked", async function () {
      const { b3trMultiSig, B3trContract, b3tr, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(owner).revokeConfirmation(0))
        .to.emit(b3trMultiSig, "Revocation")
        .withArgs(owner.address, 0)
    })

    it("Should revert if revoking before confirming", async function () {
      const { b3trMultiSig, B3trContract, b3tr, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("10"),
      ])

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccount).revokeConfirmation(0)).to.be.reverted
    })
  })

  describe("Execute Transaction", function () {
    it("Transaction gets executed succesfully", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const MINTER_ROLE = await b3tr.MINTER_ROLE()
      await b3tr.connect(owner).grantRole(MINTER_ROLE, await b3trMultiSig.getAddress())

      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccounts[10].address,
        ethers.parseEther("10"),
      ])

      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(0n)

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "Confirmation")
        .withArgs(otherAccount.address, 0)

      // 2/3 confirmations done -> Executution should have happened
      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])

      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(ethers.parseEther("10"))

      expect(await b3trMultiSig.isConfirmed(0)).to.eql(true)
    })

    it("Should revert if trying to execute an already executed transaction", async function () {
      const { b3trMultiSig, B3trContract, b3tr, owner, otherAccount } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const MINTER_ROLE = await b3tr.MINTER_ROLE()
      await b3tr.connect(owner).grantRole(MINTER_ROLE, await b3trMultiSig.getAddress())

      const encoded = B3trContract.interface.encodeFunctionData("mint", [otherAccount.address, ethers.parseEther("1")])
      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encoded)
      await b3trMultiSig.connect(otherAccount).confirmTransaction(0)

      // Already executed
      await expect(b3trMultiSig.connect(owner).executeTransaction(0)).to.be.revertedWith("Transaction already executed")
    })

    it("Should emit event if executed succesfully", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const MINTER_ROLE = await b3tr.MINTER_ROLE()
      await b3tr.connect(owner).grantRole(MINTER_ROLE, await b3trMultiSig.getAddress())

      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccounts[10].address,
        ethers.parseEther("10"),
      ])

      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(0n)

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "Execution")
        .withArgs(0)

      // 2/3 confirmations done -> Executution should have happened
      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])

      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(ethers.parseEther("10"))
    })

    it("Should emit event if executed unsuccesfully", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccounts[10].address,
        ethers.parseEther("10"),
      ])

      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(0n)

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      // Should fail as the multi sig does not have the minter role
      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "ExecutionFailure")
        .withArgs(0)

      // 2/3 confirmations done -> Executution should have happened
      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])

      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(ethers.parseEther("0"))
    })

    it("Should be able to retry if unsuccesfully", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccounts[10].address,
        ethers.parseEther("10"),
      ])

      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(0n)

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      // Should fail as the multi sig does not have the minter role
      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "ExecutionFailure")
        .withArgs(0)

      // 2/3 confirmations done -> Executution should have happened
      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])

      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(ethers.parseEther("0"))

      // Granting the minter role to the multisig
      const MINTER_ROLE = await b3tr.MINTER_ROLE()
      await b3tr.connect(owner).grantRole(MINTER_ROLE, await b3trMultiSig.getAddress())

      // Retry
      await b3trMultiSig.connect(owner).executeTransaction(0)

      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(ethers.parseEther("10"))
    })

    it("Should not be able to retry if succesful", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })
      const MINTER_ROLE = await b3tr.MINTER_ROLE()
      await b3tr.connect(owner).grantRole(MINTER_ROLE, await b3trMultiSig.getAddress())

      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccounts[10].address,
        ethers.parseEther("10"),
      ])
      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(0n)

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      // Confirming the transaction
      await b3trMultiSig.connect(otherAccount).confirmTransaction(0)

      expect(await b3trMultiSig.getConfirmations(0))
        .to.eql([owner.address, otherAccount.address])
        .to.emit(b3trMultiSig, "S")
        .withArgs(otherAccount.address, 0)

      // Should fail as the multi sig does not have the minter role
      await expect(b3trMultiSig.connect(otherAccount).executeTransaction(0)).to.be.reverted
    })
  })

  describe("Owner Management", function () {
    it("Proposal must be made to add new owner", async function () {
      const { b3trMultiSig, minterAccount, b3tr, otherAccount, owner, otherAccounts } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const owners = await b3trMultiSig.getOwners()
      expect(owners).to.eql([owner.address, otherAccount.address, minterAccount.address])

      const B3TRMultiSig = await ethers.getContractFactory("B3TRMultiSig")
      const encodedFunctionCall = B3TRMultiSig.interface.encodeFunctionData("addOwner", [otherAccounts[10].address])

      await b3trMultiSig.connect(owner).submitTransaction(await b3trMultiSig.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "Confirmation")
        .withArgs(otherAccount.address, 0)

      // 2/3 confirmations done -> Executution should have happened
      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])

      expect(await b3trMultiSig.getOwners()).to.eql([
        owner.address,
        otherAccount.address,
        minterAccount.address,
        otherAccounts[10].address,
      ])
    })

    it("Should revert if proposal is not made to add new owner", async function () {
      const { b3trMultiSig, minterAccount, otherAccount, owner, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const owners = await b3trMultiSig.getOwners()
      expect(owners).to.eql([owner.address, otherAccount.address, minterAccount.address])

      await expect(b3trMultiSig.connect(owner).addOwner(otherAccounts[10].address)).to.be.reverted

      expect(await b3trMultiSig.getOwners()).to.eql([owner.address, otherAccount.address, minterAccount.address])
    })

    it("Proposal can be made to remove owner", async function () {
      const { b3trMultiSig, minterAccount, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const owners = await b3trMultiSig.getOwners()
      expect(owners).to.eql([owner.address, otherAccount.address, minterAccount.address])

      const B3TRMultiSig = await ethers.getContractFactory("B3TRMultiSig")
      const encodedFunctionCall = B3TRMultiSig.interface.encodeFunctionData("removeOwner", [minterAccount.address])

      await b3trMultiSig.connect(owner).submitTransaction(await b3trMultiSig.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "Confirmation")
        .withArgs(otherAccount.address, 0)

      // 2/3 confirmations done -> Executution should have happened
      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])

      expect(await b3trMultiSig.getOwners()).to.eql([owner.address, otherAccount.address])
    })

    it("Proposal can be made to remove owner", async function () {
      const { b3trMultiSig, minterAccount, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const owners = await b3trMultiSig.getOwners()
      expect(owners).to.eql([owner.address, otherAccount.address, minterAccount.address])

      const B3TRMultiSig = await ethers.getContractFactory("B3TRMultiSig")
      const encodedFunctionCall = B3TRMultiSig.interface.encodeFunctionData("removeOwner", [minterAccount.address])

      await b3trMultiSig.connect(owner).submitTransaction(await b3trMultiSig.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "Confirmation")
        .withArgs(otherAccount.address, 0)

      // 2/3 confirmations done -> Executution should have happened
      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])

      expect(await b3trMultiSig.getOwners()).to.eql([owner.address, otherAccount.address])

      const encodedFunctionCall2 = B3TRMultiSig.interface.encodeFunctionData("removeOwner", [otherAccount.address])

      await b3trMultiSig.connect(owner).submitTransaction(await b3trMultiSig.getAddress(), 0, encodedFunctionCall2) /// TxId will be 0

      await b3trMultiSig.connect(otherAccount).confirmTransaction(1)

      expect(await b3trMultiSig.getOwners()).to.eql([owner.address])

      const encodedFunctionCall3 = B3TRMultiSig.interface.encodeFunctionData("removeOwner", [owner.address])
      await b3trMultiSig.connect(owner).submitTransaction(await b3trMultiSig.getAddress(), 0, encodedFunctionCall3) /// TxId will be 0

      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(1)).to.be.reverted

      expect(await b3trMultiSig.getOwners()).to.eql([owner.address])
    })

    it("If owners becomes less than required confirmations confiratirmations becomes equal to number of owners", async function () {
      const { minterAccount, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const B3TRMultiSig = await ethers.getContractFactory("B3TRMultiSig")
      const b3trMultiSig = await B3TRMultiSig.deploy([owner.address, otherAccount.address, minterAccount.address], 3)

      const owners = await b3trMultiSig.getOwners()
      expect(owners).to.eql([owner.address, otherAccount.address, minterAccount.address])

      expect(await b3trMultiSig.required()).to.eql(3n)

      const encodedFunctionCall = B3TRMultiSig.interface.encodeFunctionData("removeOwner", [minterAccount.address])

      await b3trMultiSig.connect(owner).submitTransaction(await b3trMultiSig.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "Confirmation")
        .withArgs(otherAccount.address, 0)

      await expect(b3trMultiSig.connect(minterAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "Confirmation")
        .withArgs(minterAccount.address, 0)

      // 2/3 confirmations done -> Executution should have happened
      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])

      expect(await b3trMultiSig.getOwners()).to.eql([owner.address, otherAccount.address])

      expect(await b3trMultiSig.required()).to.eql(2n)
    })

    it("Should be able to SWAP owners", async function () {
      const { minterAccount, otherAccount, owner, b3trMultiSig, otherAccounts } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const B3TRMultiSig = await ethers.getContractFactory("B3TRMultiSig")

      const owners = await b3trMultiSig.getOwners()
      expect(owners).to.eql([owner.address, otherAccount.address, minterAccount.address])

      const encodedFunctionCall = B3TRMultiSig.interface.encodeFunctionData("replaceOwner", [
        minterAccount.address,
        otherAccounts[10].address,
      ])

      //Current owners are [owner, otherAccount, minterAccount]
      expect(await b3trMultiSig.getOwners()).to.eql([owner.address, otherAccount.address, minterAccount.address])

      await b3trMultiSig.connect(owner).submitTransaction(await b3trMultiSig.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address])

      await expect(b3trMultiSig.connect(otherAccount).confirmTransaction(0))
        .to.emit(b3trMultiSig, "Confirmation")
        .withArgs(otherAccount.address, 0)

      // 2/3 confirmations done -> Executution should have happened
      expect(await b3trMultiSig.getConfirmations(0)).to.eql([owner.address, otherAccount.address])

      expect(await b3trMultiSig.getOwners()).to.eql([owner.address, otherAccount.address, otherAccounts[10].address])

      expect(await b3trMultiSig.isOwner(minterAccount.address)).to.eql(false)
      expect(await b3trMultiSig.isOwner(otherAccounts[10].address)).to.eql(true)
    })
  })

  describe("View Functions - getTransactionCount & getTransactionIds", function () {
    it("Correctly returns count for pending and executed transactions", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const MINTER_ROLE = await b3tr.MINTER_ROLE()
      await b3tr.connect(owner).grantRole(MINTER_ROLE, await b3trMultiSig.getAddress())

      // Submit TX 0 - Not executed yet
      const encodedCall1 = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("1"),
      ])
      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedCall1)

      // Submit TX 1 - Will be executed
      const encodedCall2 = B3trContract.interface.encodeFunctionData("mint", [
        minterAccount.address,
        ethers.parseEther("2"),
      ])
      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedCall2)
      await b3trMultiSig.connect(otherAccount).confirmTransaction(1)

      const pendingCount = await b3trMultiSig.getTransactionCount(true, false)
      const executedCount = await b3trMultiSig.getTransactionCount(false, true)
      const allCount = await b3trMultiSig.getTransactionCount(true, true)

      expect(pendingCount).to.eql(1n)
      expect(executedCount).to.eql(1n)
      expect(allCount).to.eql(2n)
    })

    it("Correctly returns transaction IDs by status and range", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner, minterAccount } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const MINTER_ROLE = await b3tr.MINTER_ROLE()
      await b3tr.connect(owner).grantRole(MINTER_ROLE, await b3trMultiSig.getAddress())

      // TX 0 - Not executed
      const encodedCall1 = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("3"),
      ])
      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedCall1)

      // TX 1 - Executed
      const encodedCall2 = B3trContract.interface.encodeFunctionData("mint", [
        minterAccount.address,
        ethers.parseEther("4"),
      ])
      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedCall2)
      await b3trMultiSig.connect(otherAccount).confirmTransaction(1)

      // Test valid range for executed tx
      const executedTxIds = await b3trMultiSig.getTransactionIds(0, 1, false, true)
      expect(executedTxIds).to.eql([1n])

      // Test valid range for pending tx
      const pendingTxIds = await b3trMultiSig.getTransactionIds(0, 1, true, false)
      expect(pendingTxIds).to.eql([0n])

      // Test full list
      const allTxIds = await b3trMultiSig.getTransactionIds(0, 2, true, true)
      expect(allTxIds).to.eql([0n, 1n])
    })

    it("Reverts if range is invalid", async function () {
      const { b3trMultiSig, B3trContract, b3tr, otherAccount, owner } = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      const encodedCall = B3trContract.interface.encodeFunctionData("mint", [
        otherAccount.address,
        ethers.parseEther("5"),
      ])
      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedCall)

      // Should revert when `to < from`
      await expect(b3trMultiSig.getTransactionIds(2, 1, true, true)).to.be.revertedWith("Invalid range")

      // Should revert when `to > matching tx count`
      await expect(b3trMultiSig.getTransactionIds(0, 2, true, false)).to.be.revertedWith("Range exceeds results")
    })
  })

  describe("B3TR Management", function () {
    it("B3TR should be able to grant DEFUALT_ADMIN_ROLE to multisig", async function () {
      const { b3trMultiSig, minterAccount, b3tr, otherAccount, owner, otherAccounts, B3trContract } =
        await getOrDeployContractInstances({
          forceDeploy: true,
        })

      const DEFAULT_ADMIN_ROLE = await b3tr.DEFAULT_ADMIN_ROLE()
      const MINTER_ROLE = await b3tr.MINTER_ROLE()
      // Granting the default role to the multisig
      await b3tr.connect(owner).grantRole(DEFAULT_ADMIN_ROLE, await b3trMultiSig.getAddress())

      expect(await b3tr.hasRole(DEFAULT_ADMIN_ROLE, await b3trMultiSig.getAddress())).to.eql(true)
      expect(await b3tr.hasRole(MINTER_ROLE, await b3trMultiSig.getAddress())).to.eql(false)

      // MultiSig should be able to grant MINTER_ROLE to itself
      const encodedFunctionCall = B3trContract.interface.encodeFunctionData("grantRole", [
        MINTER_ROLE,
        await b3trMultiSig.getAddress(),
      ])

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall) /// TxId will be 0

      // Confirming the transaction
      await b3trMultiSig.connect(otherAccount).confirmTransaction(0)

      // Transaction has 2 votes and now should be executed
      expect(await b3tr.hasRole(MINTER_ROLE, await b3trMultiSig.getAddress())).to.eql(true)

      // Should now be able to mint
      const encodedFunctionCall2 = B3trContract.interface.encodeFunctionData("mint", [
        otherAccounts[10].address,
        ethers.parseEther("10"),
      ])

      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(0n)

      await b3trMultiSig.connect(owner).submitTransaction(await b3tr.getAddress(), 0, encodedFunctionCall2) /// TxId will be 1

      await b3trMultiSig.connect(minterAccount).confirmTransaction(1)

      // Got 2 confirmations -> Executed
      expect(await b3tr.balanceOf(otherAccounts[10].address)).to.eql(ethers.parseEther("10"))
    })
  })
})
