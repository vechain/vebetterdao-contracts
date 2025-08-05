import { ethers } from "hardhat"

// StargateNFT initial token levels
const BLOCKS_PER_DAY = 6 * 60 * 24

export const initialTokenLevels = [
  // Legacy normal levels
  {
    level: {
      id: 1,
      name: "Strength",
      isX: false,
      vetAmountRequiredToStake: ethers.parseEther("100"),
      scaledRewardFactor: 150,
      maturityBlocks: BLOCKS_PER_DAY / 96,
    },
    cap: 872, // 2000 - 1128
    circulatingSupply: 0,
  },
  {
    level: {
      id: 2,
      name: "Thunder",
      isX: false,
      vetAmountRequiredToStake: ethers.parseEther("500"),
      scaledRewardFactor: 250,
      maturityBlocks: BLOCKS_PER_DAY / 96,
    },
    cap: 240, // 300 - 60
    circulatingSupply: 0,
  },
  {
    level: {
      id: 3,
      name: "Mjolnir",
      isX: false,
      vetAmountRequiredToStake: ethers.parseEther("1500"),
      scaledRewardFactor: 350,
      maturityBlocks: BLOCKS_PER_DAY / 96,
    },
    cap: 21, // 100 - 79
    circulatingSupply: 0,
  },
  // Legacy X Levels
  {
    level: {
      id: 4,
      name: "VeThorX",
      isX: true,
      vetAmountRequiredToStake: ethers.parseEther("60"),
      scaledRewardFactor: 200,
      maturityBlocks: BLOCKS_PER_DAY / 96,
    },
    cap: 0, // 800 - 800
    circulatingSupply: 0,
  },
  {
    level: {
      id: 5,
      name: "StrengthX",
      isX: true,
      vetAmountRequiredToStake: ethers.parseEther("160"),
      scaledRewardFactor: 300,
      maturityBlocks: BLOCKS_PER_DAY / 96,
    },
    cap: 0, // 862 - 862
    circulatingSupply: 0,
  },
  {
    level: {
      id: 6,
      name: "ThunderX",
      isX: true,
      vetAmountRequiredToStake: ethers.parseEther("560"),
      scaledRewardFactor: 400,
      maturityBlocks: BLOCKS_PER_DAY / 96,
    },
    cap: 0, // 179 - 179
    circulatingSupply: 0,
  },
  {
    level: {
      id: 7,
      name: "MjolnirX",
      isX: true,
      vetAmountRequiredToStake: ethers.parseEther("1560"),
      scaledRewardFactor: 500,
      maturityBlocks: BLOCKS_PER_DAY / 96,
    },
    cap: 0, // 148 - 148
    circulatingSupply: 0,
  },
  // New levels
  {
    level: {
      id: 8,
      name: "Dawn",
      isX: false,
      vetAmountRequiredToStake: ethers.parseEther("1"),
      scaledRewardFactor: 100,
      maturityBlocks: BLOCKS_PER_DAY / 96,
    },
    cap: 500000,
    circulatingSupply: 0,
  },
  {
    level: {
      id: 9,
      name: "Lightning",
      isX: false,
      vetAmountRequiredToStake: ethers.parseEther("5"),
      scaledRewardFactor: 115,
      maturityBlocks: BLOCKS_PER_DAY / 96,
    },
    cap: 100000,
    circulatingSupply: 0,
  },
  {
    level: {
      id: 10,
      name: "Flash",
      isX: false,
      vetAmountRequiredToStake: ethers.parseEther("20"),
      scaledRewardFactor: 130,
      maturityBlocks: BLOCKS_PER_DAY / 96,
    },
    cap: 250000,
    circulatingSupply: 0,
  },
]

// StargateDelegation initial values
export const vthoRewardPerBlock = [
  {
    levelId: 1,
    rewardPerBlock: ethers.parseUnits("0.122399797", 18), // 0.122399797 * 10^18
  },
  {
    levelId: 2,
    rewardPerBlock: ethers.parseUnits("0.975076104", 18), // 0.975076104 * 10^18
  },
  {
    levelId: 3,
    rewardPerBlock: ethers.parseUnits("3.900304414", 18), // 3.900304414 * 10^18
  },
  {
    levelId: 4,
    rewardPerBlock: ethers.parseUnits("0.076674277", 18), // 0.076674277 * 10^18
  },
  {
    levelId: 5,
    rewardPerBlock: ethers.parseUnits("0.313546423", 18), // 0.313546423 * 10^18
  },
  {
    levelId: 6,
    rewardPerBlock: ethers.parseUnits("1.365550482", 18), // 1.365550482 * 10^18
  },
  {
    levelId: 7,
    rewardPerBlock: ethers.parseUnits("4.872526636", 18), // 4.872526636 * 10^18
  },
  {
    levelId: 8,
    rewardPerBlock: ethers.parseUnits("0.000697615", 18), // 0.000697615 * 10^18
  },
  {
    levelId: 9,
    rewardPerBlock: ethers.parseUnits("0.003900304", 18), // 0.003900304 * 10^18
  },
]
