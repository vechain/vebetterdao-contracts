import { ethers } from "hardhat"

export async function deployStargateNFTLibraries({ logOutput = false }: { logOutput?: boolean }) {
  // Deploy Clock Library
  const Clock = await ethers.getContractFactory("Clock")
  const StargateNFTClockLib = await Clock.deploy()
  await StargateNFTClockLib.waitForDeployment()
  logOutput && console.log("Clock Library deployed")

  // Deploy DataTypes Library
  const DataTypes = await ethers.getContractFactory("DataTypes")
  const StargateNFTTypesLib = await DataTypes.deploy()
  await StargateNFTTypesLib.waitForDeployment()
  logOutput && console.log("DataTypes Library deployed")

  // Deploy Levels Library
  const Levels = await ethers.getContractFactory("Levels")
  const StargateNFTLevelsLib = await Levels.deploy()
  await StargateNFTLevelsLib.waitForDeployment()
  logOutput && console.log("Levels Library deployed")

  // Deploy MintingLogic Library
  const MintingLogic = await ethers.getContractFactory("MintingLogic")
  const StargateNFTMintingLib = await MintingLogic.deploy()
  await StargateNFTMintingLib.waitForDeployment()
  logOutput && console.log("MintingLogic Library deployed")

  // Deploy Settings Library
  const Settings = await ethers.getContractFactory("Settings")
  const StargateNFTSettingsLib = await Settings.deploy()
  await StargateNFTSettingsLib.waitForDeployment()
  logOutput && console.log("Settings Library deployed")

  // Deploy Token Library
  const Token = await ethers.getContractFactory("Token")
  const StargateNFTTokenLib = await Token.deploy()
  await StargateNFTTokenLib.waitForDeployment()
  logOutput && console.log("Token Library deployed")

  // Deploy VetGeneratedVtho Library
  const VetGeneratedVtho = await ethers.getContractFactory("VetGeneratedVtho")
  const StargateNFTVetGeneratedVthoLib = await VetGeneratedVtho.deploy()
  await StargateNFTVetGeneratedVthoLib.waitForDeployment()
  logOutput && console.log("VetGeneratedVtho Library deployed")

  return {
    StargateNFTClockLib,
    StargateNFTTypesLib,
    StargateNFTMintingLib,
    StargateNFTSettingsLib,
    StargateNFTTokenLib,
    StargateNFTVetGeneratedVthoLib,
    StargateNFTLevelsLib,
  }
}
