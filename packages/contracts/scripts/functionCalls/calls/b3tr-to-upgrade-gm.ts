import { getConfig } from "@repo/config"
import { EnvConfig, getContractsConfig } from "@repo/config/contracts"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const contractsConfig = getContractsConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  const levels = [2, 3, 4, 5, 6, 7, 8, 9, 10]
  const b3trToUpgrade = contractsConfig.GM_NFT_B3TR_REQUIRED_TO_UPGRADE_TO_LEVEL_V2

  console.log(`📣 Executing function: setB3TRtoUpgradeToLevel`)
  console.log(`📍 Contract Address: ${config.galaxyMemberContractAddress}`)
  console.log(`🌐 Network: ${config.network.name}`)
  console.log(`🛠️  Parameters:`)
  console.table(
    levels.map((level, index) => ({
      Level: level,
      "B3TR ": b3trToUpgrade[index].toString(),
      "B3TR (formatted)": Number(ethers.formatEther(b3trToUpgrade[index].toString())).toFixed(2),
    })),
  )

  const emissionsContract = await ethers.getContractAt("Emissions", config.emissionsContractAddress)

  const emissionsVersion = await emissionsContract.version()
  if (parseInt(emissionsVersion) !== 3) {
    console.error(`❌ Emissions version is not 3: ${emissionsVersion}`)
    console.error("Please upgrade Emissions contract first")
    process.exit(1)
  }

  const voterRewardsContract = await ethers.getContractAt("VoterRewards", config.voterRewardsContractAddress)

  const voterRewardsVersion = await voterRewardsContract.version()
  if (parseInt(voterRewardsVersion) !== 5) {
    console.error(`❌ VoterRewards version is not 5: ${voterRewardsVersion}`)
    console.error("Please upgrade VoterRewards contract first")
    process.exit(1)
  }

  const galaxyMemberContract = await ethers.getContractAt("GalaxyMember", config.galaxyMemberContractAddress)

  const tx = await galaxyMemberContract.setB3TRtoUpgradeToLevel(b3trToUpgrade)
  await tx.wait()

  console.log(`🚀 Transaction executed @Block: ${tx.blockNumber}`)
  console.log(`🧾 Transaction Hash: ${tx.hash}`)

  console.log(`🔍 Verifying new B3TR upgrade costs...`)
  const levelChecks = await Promise.all(
    Array.from({ length: 10 }, (_, i) => galaxyMemberContract.getB3TRtoUpgradeToLevel(i + 1)),
  )

  console.table(
    levelChecks.map((amount, i) => ({
      Level: i + 1,
      "B3TR ": amount.toString(),
      "B3TR (formatted)": Number(ethers.formatEther(amount)).toFixed(2),
    })),
  )

  console.log(`✅ Execution completed successfully!`)
  process.exit(0)
}

// Execute the main function
main().catch(error => {
  console.error(error)
  process.exit(1)
})
