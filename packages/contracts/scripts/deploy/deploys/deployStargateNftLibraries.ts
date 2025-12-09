import { ethers } from "hardhat"
import {
  // ------------------- LATEST VERSION ------------------- //
  Clock,
  Levels,
  MintingLogic,
  Settings,
  Token,
} from "../../../typechain-types"

interface DeployStargateNFTLibrariesArgs {
  logOutput?: boolean
}

export type StargateLibraries = {
  StargateNFTClockLib: Clock
  StargateNFTLevelsLib: Levels
  StargateNFTSettingsLib: Settings
  StargateNFTMintingLib: MintingLogic
  StargateNFTTokenLib: Token
}

export async function deployStargateNFTLibraries({
  logOutput = false,
}: DeployStargateNFTLibrariesArgs = {}): Promise<StargateLibraries> {
  // NOTE: No versioned libraries exist for Stargate NFT
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

  return {
    StargateNFTClockLib,
    StargateNFTLevelsLib,
    StargateNFTMintingLib,
    StargateNFTSettingsLib,
    StargateNFTTokenLib,
  }
}
