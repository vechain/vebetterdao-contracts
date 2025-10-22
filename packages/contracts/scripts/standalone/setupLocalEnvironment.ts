import { ethers } from "hardhat"
import {
  B3TR,
  Emissions,
  VOT3,
  XAllocationVoting,
  B3TRGovernor,
  Treasury,
  X2EarnApps,
  TokenAuction,
} from "../../typechain-types"
import { setupEnvironment } from "../deploy/setup"
import localConfig from "@repo/config/local"

async function main() {
  console.log("================ Setting up local environment from deployed contracts")
  console.log("Using local config:", localConfig.environment)

  // Get the deployer account
  const [deployer] = await ethers.getSigners()
  console.log("Using deployer account:", deployer.address)

  try {
    // Connect to all deployed contracts using addresses from local config
    console.log("Connecting to deployed contracts...")

    const emissions = (await ethers.getContractAt(
      "Emissions",
      localConfig.emissionsContractAddress,
    )) as unknown as Emissions

    const treasury = (await ethers.getContractAt(
      "Treasury",
      localConfig.treasuryContractAddress,
    )) as unknown as Treasury

    const x2EarnApps = (await ethers.getContractAt(
      "X2EarnApps",
      localConfig.x2EarnAppsContractAddress,
    )) as unknown as X2EarnApps

    const governor = (await ethers.getContractAt(
      "B3TRGovernor",
      localConfig.b3trGovernorAddress,
    )) as unknown as B3TRGovernor

    const xAllocationVoting = (await ethers.getContractAt(
      "XAllocationVoting",
      localConfig.xAllocationVotingContractAddress,
    )) as unknown as XAllocationVoting

    const b3tr = (await ethers.getContractAt("B3TR", localConfig.b3trContractAddress)) as unknown as B3TR

    const vot3 = (await ethers.getContractAt("VOT3", localConfig.vot3ContractAddress)) as unknown as VOT3

    // For nodeManagement, we use the address from the config
    const vechainNodesMock = (await ethers.getContractAt(
      "TokenAuction",
      localConfig.tokenAuctionContractAddress,
    )) as unknown as TokenAuction

    console.log("All contracts connected successfully!")

    // Verify contracts are accessible
    console.log("Verifying contract connections...")
    console.log("- B3TR name:", await b3tr.name())
    console.log("- VOT3 name:", await vot3.name())
    console.log("- Emissions address:", await emissions.getAddress())
    console.log("- Treasury address:", await treasury.getAddress())

    // Call setupEnvironment with local config
    console.log("================ Calling setupEnvironment...")
    await setupEnvironment(
      "local", // EnvConfig type expects string literal
      emissions,
      treasury,
      x2EarnApps,
      governor,
      xAllocationVoting,
      b3tr,
      vot3,
      vechainNodesMock,
    )

    console.log("================ Setup completed successfully!")
  } catch (error) {
    console.error("Error during setup:", error)
    process.exit(1)
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => {
      console.log("Script completed successfully")
      process.exit(0)
    })
    .catch(error => {
      console.error("Script failed:", error)
      process.exit(1)
    })
}

export default main
