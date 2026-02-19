import { ethers } from "hardhat"
import {
  Clock,
  Levels,
  MintingLogic,
  Settings,
  TokenManager,
  Token,
  StargateNFT,
  Stargate,
} from "../../../typechain-types"
import { deployUpgradeableWithoutInitialization, initializeProxyAllVersions } from "../../helpers"

enum TokenLevelId {
  // Extend legacy strengthLevel enum
  None,
  Strength,
  Thunder,
  Mjolnir,
  VeThorX,
  StrengthX,
  ThunderX,
  MjolnirX,
  Dawn,
  Lightning,
  Flash,
}

export const deployStargateMock = async ({
  logOutput = false,
  legacyNodesContractAddress,
  vthoTokenAddress,
}: {
  logOutput?: boolean
  legacyNodesContractAddress?: string
  vthoTokenAddress?: string
}) => {
  const deployer = (await ethers.getSigners())[0]

  // const deploy a mocked protocol staker contract
  const ProtocolStakerMock = await ethers.getContractFactory("ProtocolStakerMock")
  const protocolStakerMock = await ProtocolStakerMock.deploy()
  await protocolStakerMock.waitForDeployment()
  const protocolStakerMockAddress = await protocolStakerMock.getAddress()
  logOutput && console.log("ProtocolStakerMock deployed at: ", protocolStakerMockAddress)

  // Deploys the latest implementation of the contracts
  const {
    StargateNFTClockLib,
    StargateNFTLevelsLib,
    StargateNFTMintingLib,
    StargateNFTSettingsLib,
    StargateNFTTokenLib,
    StargateNFTTokenManagerLib,
  } = await deployStargateNFTLibraries({ logOutput })

  const stargateNFTProxyAddress = await deployUpgradeableWithoutInitialization(
    "StargateNFT",
    {
      Clock: await StargateNFTClockLib.getAddress(),
      Levels: await StargateNFTLevelsLib.getAddress(),
      MintingLogic: await StargateNFTMintingLib.getAddress(),
      Settings: await StargateNFTSettingsLib.getAddress(),
      Token: await StargateNFTTokenLib.getAddress(),
      TokenManager: await StargateNFTTokenManagerLib.getAddress(),
    },
    false,
  )
  logOutput && console.log("StargateNFT proxy deployed at: ", stargateNFTProxyAddress)

  const stargateProxyAddress = await deployUpgradeableWithoutInitialization(
    "Stargate",
    {
      Clock: await StargateNFTClockLib.getAddress(),
    },
    false,
  )
  logOutput && console.log("Stargate proxy deployed at: ", stargateProxyAddress)

  const stargateNFT = (await initializeProxyAllVersions(
    "StargateNFT",
    stargateNFTProxyAddress,
    [
      {
        args: [
          {
            tokenCollectionName: "StarGate Delegator Token",
            tokenCollectionSymbol: "SDT",
            baseTokenURI: "ipfs://bafybeibmpgruasnoqgyemcprpkygtelvxl3b5d2bf5aqqciw6dds33yw7y/metadata/",
            admin: deployer.address,
            upgrader: deployer.address,
            pauser: deployer.address,
            levelOperator: deployer.address,
            legacyNodes: legacyNodesContractAddress ?? deployer.address, // We set a random address since we do not care about the legacy ndodes on B3TR
            stargateDelegation: deployer.address, // We set a random address here as well since we do not care
            vthoToken: vthoTokenAddress ?? "0x0000000000000000000000000000456E65726779", // address of solo, testnet and mainnet
            legacyLastTokenId: 1000,
            levelsAndSupplies: [
              // Legacy normal levels
              {
                level: {
                  id: TokenLevelId.Strength,
                  name: "Strength",
                  isX: false,
                  vetAmountRequiredToStake: ethers.parseEther("100"),
                  scaledRewardFactor: 150,
                  maturityBlocks: 10,
                },
                cap: 2499, // 2500 - 1
                circulatingSupply: 0,
              },
              {
                level: {
                  id: TokenLevelId.Thunder,
                  name: "Thunder",
                  isX: false,
                  vetAmountRequiredToStake: ethers.parseEther("500"),
                  scaledRewardFactor: 250,
                  maturityBlocks: 20,
                },
                cap: 298, // 300 - (1 + 1 Strength upgrading)
                circulatingSupply: 0,
              },
              {
                level: {
                  id: TokenLevelId.Mjolnir,
                  name: "Mjolnir",
                  isX: false,
                  vetAmountRequiredToStake: ethers.parseEther("1500"),
                  scaledRewardFactor: 350,
                  // change this to 300 for boost tests
                  maturityBlocks: 300,
                },
                cap: 99, // 100 - 1
                circulatingSupply: 0,
              },
              // Legacy X Levels
              {
                level: {
                  id: TokenLevelId.VeThorX,
                  name: "VeThorX",
                  isX: true,
                  vetAmountRequiredToStake: ethers.parseEther("60"),
                  scaledRewardFactor: 200,
                  maturityBlocks: 0,
                },
                cap: 100, // 1
                circulatingSupply: 0,
              },
              {
                level: {
                  id: TokenLevelId.StrengthX,
                  name: "StrengthX",
                  isX: true,
                  vetAmountRequiredToStake: ethers.parseEther("160"),
                  scaledRewardFactor: 300,
                  maturityBlocks: 0,
                },
                cap: 100, // 1
                circulatingSupply: 0,
              },
              {
                level: {
                  id: TokenLevelId.ThunderX,
                  name: "ThunderX",
                  isX: true,
                  vetAmountRequiredToStake: ethers.parseEther("560"),
                  scaledRewardFactor: 400,
                  maturityBlocks: 0,
                },
                cap: 100, // No ThunderX
                circulatingSupply: 0,
              },
              {
                level: {
                  id: TokenLevelId.MjolnirX,
                  name: "MjolnirX",
                  isX: true,
                  vetAmountRequiredToStake: ethers.parseEther("1560"),
                  scaledRewardFactor: 500,
                  maturityBlocks: 0,
                },
                cap: 100, // 1
                circulatingSupply: 0,
              },
              // New levels
              {
                level: {
                  id: TokenLevelId.Dawn,
                  name: "Dawn",
                  isX: false,
                  vetAmountRequiredToStake: ethers.parseEther("1"),
                  scaledRewardFactor: 100,
                  maturityBlocks: 5,
                },
                cap: 500000,
                circulatingSupply: 0,
              },
              {
                level: {
                  id: TokenLevelId.Lightning,
                  name: "Lightning",
                  isX: false,
                  vetAmountRequiredToStake: ethers.parseEther("5"),
                  scaledRewardFactor: 115,
                  maturityBlocks: 10,
                },
                cap: 100000,
                circulatingSupply: 0,
              },
              {
                level: {
                  id: TokenLevelId.Flash,
                  name: "Flash",
                  isX: false,
                  vetAmountRequiredToStake: ethers.parseEther("20"),
                  scaledRewardFactor: 130,
                  maturityBlocks: 15,
                },
                cap: 25000,
                circulatingSupply: 0,
              },
            ],
          },
        ],
      }, // V1
      {
        args: [[]],
        version: 2,
      },
      {
        args: [
          stargateProxyAddress,
          [
            TokenLevelId.Dawn,
            TokenLevelId.Lightning,
            TokenLevelId.Flash,
            TokenLevelId.Strength,
            TokenLevelId.Thunder,
            TokenLevelId.Mjolnir,
          ],
          [
            539351851851852n,
            2870370370370370n,
            12523148148148100n,
            75925925925925900n,
            530092592592593000n,
            1995370370370370000n,
          ],
        ],
        version: 3,
      },
    ],
    false,
  )) as StargateNFT
  logOutput && console.log("StargateNFT initialized")

  const stargate = (await initializeProxyAllVersions(
    "Stargate",
    stargateProxyAddress,
    [
      {
        args: [
          {
            admin: deployer.address,
            protocolStakerContract: protocolStakerMockAddress,
            stargateNFTContract: stargateNFTProxyAddress,
            legacyNodesContract: legacyNodesContractAddress ?? deployer.address, // We do not care about the legacy nodes on B3TR
            maxClaimablePeriods: 832,
          },
        ],
      },
    ],
    false,
  )) as Stargate
  logOutput && console.log("Stargate initialized")

  return {
    stargateNFT,
    stargate,
  }
}

async function deployStargateNFTLibraries({ logOutput = false }): Promise<{
  StargateNFTClockLib: Clock
  StargateNFTLevelsLib: Levels
  StargateNFTSettingsLib: Settings
  StargateNFTMintingLib: MintingLogic
  StargateNFTTokenLib: Token
  StargateNFTTokenManagerLib: TokenManager
}> {
  // ------------------- LATEST VERSION ------------------- //
  // Deploy Clock Library
  const Clock = await ethers.getContractFactory("Clock")
  const StargateNFTClockLib = (await Clock.deploy()) as Clock
  await StargateNFTClockLib.waitForDeployment()
  logOutput && console.log("Clock Library deployed")

  // Deploy Levels Library
  const Levels = await ethers.getContractFactory("Levels")
  const StargateNFTLevelsLib = (await Levels.deploy()) as Levels
  await StargateNFTLevelsLib.waitForDeployment()
  logOutput && console.log("Levels Library deployed")

  // Deploy MintingLogic Library
  const MintingLogic = await ethers.getContractFactory("MintingLogic")
  const StargateNFTMintingLib = (await MintingLogic.deploy()) as MintingLogic
  await StargateNFTMintingLib.waitForDeployment()
  logOutput && console.log("MintingLogic Library deployed")

  // Deploy Settings Library
  const Settings = await ethers.getContractFactory("Settings")
  const StargateNFTSettingsLib = (await Settings.deploy()) as Settings
  await StargateNFTSettingsLib.waitForDeployment()
  logOutput && console.log("Settings Library deployed")

  // Deploy Token Library
  const Token = await ethers.getContractFactory("Token")
  const StargateNFTTokenLib = (await Token.deploy()) as Token
  await StargateNFTTokenLib.waitForDeployment()
  logOutput && console.log("Token Library deployed")

  // Deploy TokenManager Library
  const TokenManager = await ethers.getContractFactory("TokenManager")
  const StargateNFTTokenManagerLib = (await TokenManager.deploy()) as TokenManager
  await StargateNFTTokenManagerLib.waitForDeployment()
  logOutput && console.log("TokenManager Library deployed")

  return {
    StargateNFTClockLib,
    StargateNFTLevelsLib,
    StargateNFTMintingLib,
    StargateNFTSettingsLib,
    StargateNFTTokenLib,
    StargateNFTTokenManagerLib,
  }
}
