import { ethers, network } from "hardhat"
import { expect } from "chai"
import {
  createProposalAndExecuteIt,
  bootstrapAndStartEmissions,
  bootstrapEmissions,
  participateInAllocationVoting,
} from "./helpers/common"
import { getOrDeployContractInstances } from "./helpers/deploy"
import { catchRevert } from "./helpers/exceptions"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { describe, it, before } from "mocha"
import { fundTreasuryVET, fundTreasuryVTHO } from "./helpers/fundTreasury"
import { B3TR, B3TRGovernor, MyERC1155, Treasury, Treasury__factory } from "../typechain-types"
import { createLocalConfig } from "@repo/config/contracts/envs/local"
import { deployProxy } from "../scripts/helpers"
import { getEventName } from "./helpers/events"
import { ZERO_ADDRESS } from "./helpers"

describe("Treasury", () => {
  let treasuryProxy: Treasury
  let b3tr: B3TR
  let vot3: any
  let galaxyMember: any
  let owner: HardhatEthersSigner
  let otherAccount: HardhatEthersSigner

  before(async () => {
    const config = createLocalConfig()
    config.B3TR_GOVERNOR_DEPOSIT_THRESHOLD = 1
    const info = await getOrDeployContractInstances({
      forceDeploy: true,
      config,
    })
    treasuryProxy = info.treasury
    owner = info.owner
    otherAccount = info.otherAccount
    b3tr = info.b3tr
    vot3 = info.vot3
    galaxyMember = info.galaxyMember

    await treasuryProxy.setTransferLimitVET(ethers.parseEther("1"))
    await treasuryProxy.setTransferLimitToken(await b3tr.getAddress(), ethers.parseEther("1"))
    await treasuryProxy.setTransferLimitToken(await vot3.getAddress(), ethers.parseEther("1"))

    await fundTreasuryVTHO(await treasuryProxy.getAddress(), ethers.parseEther("10"))
    await fundTreasuryVET(await treasuryProxy.getAddress(), 10)

    const operatorRole = await b3tr.MINTER_ROLE()
    await b3tr.grantRole(operatorRole, owner)
    await b3tr.mint(await treasuryProxy.getAddress(), ethers.parseEther("20"))
  })
  describe("Initilization", () => {
    it("Should revert if B3TR is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, vot3 } = await getOrDeployContractInstances({
        forceDeploy: false,
        config,
      })

      await expect(
        deployProxy("Treasury", [
          ZERO_ADDRESS,
          await vot3.getAddress(),
          owner.address,
          owner.address,
          owner.address,
          owner.address,
          config.TREASURY_TRANSFER_LIMIT_VET,
          config.TREASURY_TRANSFER_LIMIT_B3TR,
          config.TREASURY_TRANSFER_LIMIT_VOT3,
          config.TREASURY_TRANSFER_LIMIT_VTHO,
        ]),
      ).to.be.reverted
    })
    it("Should revert if VOT3 is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, b3tr } = await getOrDeployContractInstances({
        forceDeploy: false,
        config,
      })

      await expect(
        deployProxy("Treasury", [
          await b3tr.getAddress(),
          ZERO_ADDRESS,
          owner.address,
          owner.address,
          owner.address,
          owner.address,
          config.TREASURY_TRANSFER_LIMIT_VET,
          config.TREASURY_TRANSFER_LIMIT_B3TR,
          config.TREASURY_TRANSFER_LIMIT_VOT3,
          config.TREASURY_TRANSFER_LIMIT_VTHO,
        ]),
      ).to.be.reverted
    })
    it("Should revert if admin is set to zero address in initilisation", async () => {
      const config = createLocalConfig()
      const { owner, vot3, b3tr } = await getOrDeployContractInstances({
        forceDeploy: false,
        config,
      })

      await expect(
        deployProxy("Treasury", [
          await b3tr.getAddress(),
          await vot3.getAddress(),
          owner.address,
          ZERO_ADDRESS,
          owner.address,
          owner.address,
          config.TREASURY_TRANSFER_LIMIT_VET,
          config.TREASURY_TRANSFER_LIMIT_B3TR,
          config.TREASURY_TRANSFER_LIMIT_VOT3,
          config.TREASURY_TRANSFER_LIMIT_VTHO,
        ]),
      ).to.be.reverted
    })
  })
  describe("Tokens", () => {
    describe("VTHO", () => {
      it("should transfer VTHO", async () => {
        if (network.name == "hardhat") {
          return console.log(
            "Skipping VTHO transfer test on hardhat network as hardcoded VTHO contract address in Treasury does not exist",
          )
        }
        const balance = await treasuryProxy.getVTHOBalance()
        await expect(treasuryProxy.transferVTHO(otherAccount.address, ethers.parseEther("1"))).not.to.be.reverted
        expect(await treasuryProxy.getVTHOBalance()).to.be.lessThan(balance)
      })
      it("should revert if not called by GOVERNANCE_ROLE", async () => {
        await catchRevert(
          treasuryProxy.connect(otherAccount).transferVTHO(otherAccount.address, ethers.parseEther("1")),
        )
      })
      it("only governance can transfer VTHO", async () => {
        await catchRevert(
          treasuryProxy.connect(otherAccount).transferVTHO(otherAccount.address, ethers.parseEther("1")),
        )
      })
      it("should revert if contract is paused", async () => {
        await treasuryProxy.pause()
        await catchRevert(treasuryProxy.transferVTHO(otherAccount.address, ethers.parseEther("1")))
        await treasuryProxy.unpause()
      })
    })
    describe("VET", () => {
      it("should transfer VET", async () => {
        expect(await treasuryProxy.getVETBalance()).to.eql(ethers.parseEther("10"))
        await treasuryProxy.transferVET(otherAccount.address, ethers.parseEther("1"))
        expect(await treasuryProxy.getVETBalance()).to.eql(ethers.parseEther("9"))
      })
      it("should revert if not enough balance", async () => {
        await catchRevert(treasuryProxy.transferVET(otherAccount.address, ethers.parseEther("11")))
      })
      it("should revert if not called by GOVERNANCE_ROLE", async () => {
        await catchRevert(treasuryProxy.connect(otherAccount).transferVET(otherAccount.address, ethers.parseEther("1")))
      })
      it("Should revert if transfer exceeds limit", async () => {
        await catchRevert(treasuryProxy.transferVET(otherAccount.address, ethers.parseEther("2")))
      })
      it("Should be able to set transfer limit for VET", async () => {
        const tx = await treasuryProxy.connect(owner).setTransferLimitVET(ethers.parseEther("2"))
        const receipt = await tx.wait()

        const name = getEventName(receipt, treasuryProxy)
        expect(name).to.eql("TransferLimitVETUpdated")

        expect(await treasuryProxy.getTransferLimitVET()).to.eql(ethers.parseEther("2"))
        await treasuryProxy.transferVET(otherAccount.address, ethers.parseEther("2"))
        expect(await treasuryProxy.getVETBalance()).to.eql(ethers.parseEther("7"))

        await expect(treasuryProxy.connect(otherAccount).setTransferLimitVET(ethers.parseEther("2"))).to.be.reverted // not admin
      })
    })
    describe("B3TR", () => {
      it("should transfer B3TR", async () => {
        expect(await treasuryProxy.getB3TRBalance()).to.eql(ethers.parseEther("20"))
        await treasuryProxy.transferB3TR(otherAccount.address, ethers.parseEther("1"))
        expect(await treasuryProxy.getB3TRBalance()).to.eql(ethers.parseEther("19"))
      })
      it("should convert B3TR and recieve VOT3", async () => {
        await treasuryProxy.convertB3TR(ethers.parseEther("10"))
        expect(await treasuryProxy.getB3TRBalance()).to.eql(ethers.parseEther("9"))
        expect(await treasuryProxy.getVOT3Balance()).to.eql(ethers.parseEther("10"))
      })
      it("should revert if not enough balance", async () => {
        await catchRevert(treasuryProxy.transferB3TR(otherAccount.address, ethers.parseEther("11")))
      })
      it("should revert if not called by GOVERNANCE_ROLE", async () => {
        await catchRevert(
          treasuryProxy.connect(otherAccount).transferB3TR(otherAccount.address, ethers.parseEther("1")),
        )
      })
      it("should revert if contract is paused", async () => {
        await treasuryProxy.pause()
        await catchRevert(treasuryProxy.transferB3TR(otherAccount.address, ethers.parseEther("1")))
        await treasuryProxy.unpause()
      })
      it("should revert if b3tr contract is paused", async () => {
        await b3tr.pause()
        await catchRevert(treasuryProxy.transferB3TR(otherAccount.address, ethers.parseEther("1")))
        await b3tr.unpause()
      })
      it("can't convert more than balance", async () => {
        const balance = await treasuryProxy.getB3TRBalance()
        await catchRevert(treasuryProxy.convertB3TR(balance + 1n))
      })
      it("should return correct address for contract", async () => {
        expect(await treasuryProxy.b3trAddress()).to.eql(await b3tr.getAddress())
      })
      it("should revert convert if contract is paused", async () => {
        await treasuryProxy.pause()
        await catchRevert(treasuryProxy.convertB3TR(ethers.parseEther("1")))
        await treasuryProxy.unpause()
      })
      it("Should revert if transfer exceeds limit", async () => {
        await catchRevert(treasuryProxy.transferB3TR(otherAccount.address, ethers.parseEther("2")))
      })
      it("Should be able to set transfer limit", async () => {
        await treasuryProxy.connect(owner).setTransferLimitToken(await b3tr.getAddress(), ethers.parseEther("2"))
        expect(await treasuryProxy.getTransferLimitToken(await b3tr.getAddress())).to.eql(ethers.parseEther("2"))
        await treasuryProxy.transferB3TR(otherAccount.address, ethers.parseEther("2"))
        expect(await treasuryProxy.getB3TRBalance()).to.eql(ethers.parseEther("7"))

        await expect(
          treasuryProxy.connect(otherAccount).setTransferLimitToken(await b3tr.getAddress(), ethers.parseEther("2")),
        ).to.be.reverted // not admin
      })
    })
    describe("VOT3", () => {
      it("should transfer VOT3", async () => {
        expect(await treasuryProxy.getVOT3Balance()).to.eql(ethers.parseEther("10"))
        await treasuryProxy.transferVOT3(otherAccount.address, ethers.parseEther("1"))
        expect(await treasuryProxy.getVOT3Balance()).to.eql(ethers.parseEther("9"))
      })
      it("should convert VOT3 and recieve B3TR", async () => {
        await treasuryProxy.convertVOT3(ethers.parseEther("5"))
        expect(await treasuryProxy.getB3TRBalance()).to.eql(ethers.parseEther("12"))
        expect(await treasuryProxy.getVOT3Balance()).to.eql(ethers.parseEther("4"))
      })
      it("should revert if not enough converted B3TR to convert back", async () => {
        await catchRevert(treasuryProxy.convertVOT3(ethers.parseEther("11")))
      })
      it("should revert if not called by GOVERNANCE_ROLE", async () => {
        await catchRevert(
          treasuryProxy.connect(otherAccount).transferVOT3(otherAccount.address, ethers.parseEther("1")),
        )
      })
      it("should revert if contract is paused", async () => {
        await treasuryProxy.pause()
        await catchRevert(treasuryProxy.convertVOT3(ethers.parseEther("1")))
        await treasuryProxy.unpause()
      })
      it("should return correct address for contract", async () => {
        expect(await treasuryProxy.vot3Address()).to.eql(await vot3.getAddress())
      })
      it("should revert if not enough balance", async () => {
        await catchRevert(treasuryProxy.transferVOT3(otherAccount.address, ethers.parseEther("6")))
      })
      it("should revert if vot3 contract is paused", async () => {
        await vot3.pause()
        await catchRevert(treasuryProxy.transferVOT3(otherAccount.address, ethers.parseEther("1")))
        await vot3.unpause()
      })
      it("Should revert if transfer exceeds limit", async () => {
        await catchRevert(treasuryProxy.transferVOT3(otherAccount.address, ethers.parseEther("2")))
      })
      it("Should be able to set transfer limit", async () => {
        await treasuryProxy.convertB3TR(ethers.parseEther("10"))
        const tx = await treasuryProxy
          .connect(owner)
          .setTransferLimitToken(await vot3.getAddress(), ethers.parseEther("2"))
        const receipt = await tx.wait()

        const name = getEventName(receipt, treasuryProxy)
        expect(name).to.eql("TransferLimitUpdated")
        expect(await treasuryProxy.getTransferLimitToken(await vot3.getAddress())).to.eql(ethers.parseEther("2"))
        await treasuryProxy.transferVOT3(otherAccount.address, ethers.parseEther("2"))
        expect(await treasuryProxy.getVOT3Balance()).to.eql(ethers.parseEther("12"))

        await expect(
          treasuryProxy.connect(otherAccount).setTransferLimitToken(await vot3.getAddress(), ethers.parseEther("2")),
        ).to.be.reverted // not admin
      })
    })
    describe("ERC20", () => {
      it("should transfer ERC20", async () => {
        await b3tr.mint(await treasuryProxy.getAddress(), ethers.parseEther("10"))
        expect(await treasuryProxy.getB3TRBalance()).to.eql(ethers.parseEther("12"))
        expect(await treasuryProxy.getTokenBalance(await b3tr.getAddress())).to.eql(ethers.parseEther("12"))
        await treasuryProxy.transferTokens(await b3tr.getAddress(), otherAccount.address, ethers.parseEther("1"))
        expect(await treasuryProxy.getTokenBalance(await b3tr.getAddress())).to.eql(ethers.parseEther("11"))
      })
      it("should revert if not enough balance", async () => {
        await catchRevert(
          treasuryProxy.transferTokens(await vot3.getAddress(), otherAccount.address, ethers.parseEther("6")),
        )
      })
      it("should revert if not called by GOVERNANCE_ROLE", async () => {
        await catchRevert(
          treasuryProxy
            .connect(otherAccount)
            .transferTokens(await vot3.getAddress(), otherAccount.address, ethers.parseEther("1")),
        )
      })
      it("should revert if B3TR contract is paused", async () => {
        await b3tr.pause()
        await catchRevert(
          treasuryProxy.transferTokens(await b3tr.getAddress(), otherAccount.address, ethers.parseEther("1")),
        )
        await b3tr.unpause()
      })
      it("Should revert if transfer exceeds limit", async () => {
        await catchRevert(
          treasuryProxy.transferTokens(await vot3.getAddress(), otherAccount.address, ethers.parseEther("6")),
        )
      })
      it("Should be able to set transfer limit", async () => {
        await treasuryProxy.connect(owner).setTransferLimitToken(await b3tr.getAddress(), ethers.parseEther("2"))
        expect(await treasuryProxy.getTransferLimitToken(await b3tr.getAddress())).to.eql(ethers.parseEther("2"))
        await treasuryProxy.transferTokens(await b3tr.getAddress(), otherAccount.address, ethers.parseEther("2"))
        expect(await treasuryProxy.getTokenBalance(await b3tr.getAddress())).to.eql(ethers.parseEther("9"))

        await expect(
          treasuryProxy.connect(otherAccount).setTransferLimitToken(await b3tr.getAddress(), ethers.parseEther("2")),
        ).to.be.reverted // not admin
      })
    })
    describe("NFT", () => {
      it("should transfer NFT", async () => {
        // Bootstrap emissions
        await bootstrapEmissions()

        // Should be able to free mint after participating in allocation voting
        await participateInAllocationVoting(otherAccount)

        await expect(await galaxyMember.connect(otherAccount).freeMint()).not.to.be.reverted

        expect(await galaxyMember.balanceOf(otherAccount.address)).to.equal(1)
        await expect(
          await galaxyMember
            .connect(otherAccount)
            .transferFrom(otherAccount.address, await treasuryProxy.getAddress(), 0),
        ).not.to.be.reverted
        const MAGIC_ON_ERC721_RECEIVED = "0x150b7a02"
        expect(
          await treasuryProxy.onERC721Received(owner.address, otherAccount.address, 1, ethers.toUtf8Bytes("")),
        ).to.equal(MAGIC_ON_ERC721_RECEIVED)
        expect(await galaxyMember.balanceOf(await treasuryProxy.getAddress())).to.equal(1)

        expect(await treasuryProxy.getCollectionNFTBalance(await galaxyMember.getAddress())).to.equal(1)
        await expect(await treasuryProxy.transferNFT(await galaxyMember.getAddress(), otherAccount.address, 0)).not.to
          .be.reverted
        expect(await treasuryProxy.getCollectionNFTBalance(await galaxyMember.getAddress())).to.equal(0)
      })
      it("should revert if not called by GOVERNANCE_ROLE", async () => {
        await catchRevert(
          treasuryProxy.connect(otherAccount).transferNFT(await galaxyMember.getAddress(), otherAccount.address, 1),
        )
      })
      it("should revert if not enough balance", async () => {
        await catchRevert(treasuryProxy.transferNFT(await galaxyMember.getAddress(), otherAccount.address, 1))
      })
    })
    describe("ERC1155", () => {
      let erc1155: MyERC1155
      before(async () => {
        const erc1155ContractFactory = await ethers.getContractFactory("MyERC1155")
        erc1155 = await erc1155ContractFactory.deploy(owner.address)
      })
      it("should transfer ERC1155", async () => {
        await erc1155.connect(owner).mint(await treasuryProxy.getAddress(), 1, 1, new Uint8Array(0))
        expect(await treasuryProxy.getERC1155TokenBalance(await erc1155.getAddress(), 1)).to.eql(1n)

        await treasuryProxy.transferERC1155Tokens(await erc1155.getAddress(), owner.address, 1, 1, new Uint8Array(0))

        expect(await treasuryProxy.getERC1155TokenBalance(await erc1155.getAddress(), 1)).to.eql(0n)

        expect(await erc1155.balanceOf(owner.address, 1)).to.eql(1n)
      })
      it("should revert if not called by GOVERNANCE_ROLE", async () => {
        await catchRevert(
          treasuryProxy
            .connect(otherAccount)
            .transferERC1155Tokens(await erc1155.getAddress(), owner.address, 1, 1, new Uint8Array(0)),
        )
      })
      it("should revert if not enough balance", async () => {
        await catchRevert(
          treasuryProxy.transferERC1155Tokens(await erc1155.getAddress(), owner.address, 1, 1, new Uint8Array(0)),
        )
      })
      it("should be able to recieve a batch of ERC1155 tokens", async () => {
        await erc1155.connect(owner).mintBatch(await treasuryProxy.getAddress(), [2, 3], [2, 3], new Uint8Array(0))
        expect(await treasuryProxy.getERC1155TokenBalance(await erc1155.getAddress(), 2)).to.eql(2n)
        expect(await treasuryProxy.getERC1155TokenBalance(await erc1155.getAddress(), 3)).to.eql(3n)
      })
    })
  })
  describe("UUPS", () => {
    it("should upgrade", async () => {
      const newTreasury = await ethers.getContractFactory("Treasury")
      const newImplementation = await newTreasury.deploy()
      const emptyBytes = new Uint8Array(0)
      await treasuryProxy.upgradeToAndCall(await newImplementation.getAddress(), emptyBytes)
      const treasury = await ethers.getContractAt("Treasury", await treasuryProxy.getAddress())
      expect(await treasury.getVETBalance()).to.eql(ethers.parseEther("7"))
    })
    it("should revert if not called by ADMIN_ROLE", async () => {
      const newTreasury = await ethers.getContractFactory("Treasury")
      const newImplementation = await newTreasury.deploy()
      const emptyBytes = new Uint8Array(0)
      await catchRevert(
        treasuryProxy.connect(otherAccount).upgradeToAndCall(await newImplementation.getAddress(), emptyBytes),
      )
    })
    it("should return correct version", async () => {
      expect(await treasuryProxy.version()).to.eql("1")
    })
    it("can be initialized only once", async () => {
      await catchRevert(
        treasuryProxy.initialize(
          owner.address,
          owner.address,
          owner.address,
          owner.address,
          owner.address,
          owner.address,
          1,
          1,
          1,
          1,
        ),
      )
    })
  })
  describe("Pause", () => {
    it("should pause and unpause", async () => {
      expect(await treasuryProxy.hasRole(await treasuryProxy.PAUSER_ROLE(), owner.address)).to.eql(true)
      await treasuryProxy.pause()
      expect(await treasuryProxy.paused()).to.eql(true)
      await treasuryProxy.unpause()
      expect(await treasuryProxy.paused()).to.eql(false)
    })
    it("should revert if not called by ADMIN_ROLE", async () => {
      expect(await treasuryProxy.hasRole(await treasuryProxy.PAUSER_ROLE(), otherAccount.address)).to.eql(false)
      await catchRevert(treasuryProxy.connect(otherAccount).pause())
      await catchRevert(treasuryProxy.connect(otherAccount).unpause())
    })
  })
  describe("Timelock", () => {
    let tProxy: Treasury
    let governor: B3TRGovernor
    before(async () => {
      const info = await getOrDeployContractInstances({
        forceDeploy: true,
      })

      governor = info.governor

      const config = createLocalConfig()

      tProxy = (await deployProxy("Treasury", [
        await info.b3tr.getAddress(),
        await info.vot3.getAddress(),
        await info.timeLock.getAddress(),
        owner.address,
        owner.address,
        owner.address,
        config.TREASURY_TRANSFER_LIMIT_VET,
        config.TREASURY_TRANSFER_LIMIT_B3TR,
        config.TREASURY_TRANSFER_LIMIT_VOT3,
        config.TREASURY_TRANSFER_LIMIT_VTHO,
      ])) as Treasury

      await fundTreasuryVET(await tProxy.getAddress(), 10)
    })
    it("should execute transfer TX from proposal", async () => {
      const description = "Test Proposal: testing propsal for Transfer VET from tresausry"
      const treasuryContractFactory = await ethers.getContractFactory("Treasury")
      await bootstrapAndStartEmissions()

      await governor
        .connect(owner)
        .setWhitelistFunction(
          await tProxy.getAddress(),
          tProxy.interface.getFunction("transferVET").selector as string,
          true,
        )

      await createProposalAndExecuteIt(
        owner,
        otherAccount,
        tProxy,
        treasuryContractFactory,
        description,
        "transferVET",
        [owner.address, ethers.parseEther("1")],
      )

      expect(await tProxy.getVETBalance()).to.eql(ethers.parseEther("9"))
    })

    it("Should be able to set VET transfer limit through proposal", async () => {
      const treasuryContractFactory = await ethers.getContractFactory("Treasury")

      const description = "Test Proposal: testing propsal for setting VET transfer limit"

      await governor
        .connect(owner)
        .setWhitelistFunction(
          await tProxy.getAddress(),
          treasuryProxy.interface.getFunction("setTransferLimitVET").selector as string,
          true,
        )

      await createProposalAndExecuteIt(
        owner,
        otherAccount,
        tProxy,
        treasuryContractFactory,
        description,
        "setTransferLimitVET",
        [ethers.parseEther("3")],
      )

      expect(await tProxy.getTransferLimitVET()).to.eql(ethers.parseEther("3"))
    })

    it("Should be able to set token transfer limit through proposal", async () => {
      const treasuryContractFactory = await ethers.getContractFactory("Treasury")

      const description = "Test Proposal: testing propsal for setting token transfer limit"

      await governor
        .connect(owner)
        .setWhitelistFunction(
          await tProxy.getAddress(),
          treasuryProxy.interface.getFunction("setTransferLimitToken").selector as string,
          true,
        )

      await createProposalAndExecuteIt(
        owner,
        otherAccount,
        tProxy,
        treasuryContractFactory,
        description,
        "setTransferLimitToken",
        [await b3tr.getAddress(), ethers.parseEther("3")],
      )

      expect(await tProxy.getTransferLimitToken(await b3tr.getAddress())).to.eql(ethers.parseEther("3"))
    })
  })
  describe("Fallback", () => {
    it("Fallback function handles invalid calls", async () => {
      const nonExistentFuncSignature = "nonExistentFunction(uint256,uint256)"
      const treasuryWithFakeFunction = new ethers.Contract(
        await treasuryProxy.getAddress(),
        [...Treasury__factory.createInterface().fragments, `function ${nonExistentFuncSignature}`],
        owner,
      )
      await treasuryWithFakeFunction.nonExistentFunction(1, 1)
    })
  })
})
