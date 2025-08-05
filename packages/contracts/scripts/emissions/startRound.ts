import { getConfig } from "@repo/config"
import { Emissions__factory } from "../../typechain-types"
import { ethers } from "hardhat"
import { waitForNextCycle } from "../../test/helpers"

/**
 * Starts a new round of emissions.
 *
 * @throws if the round cannot be started.
 */
const startRound = async () => {
  const [signer] = await ethers.getSigners()

  const emissions = Emissions__factory.connect(getConfig().emissionsContractAddress, signer)

  const nextRound = await emissions.nextCycle()

  console.log("Waiting for the current round to end...")

  await waitForNextCycle()

  await Emissions__factory.connect(getConfig().emissionsContractAddress, signer).distribute()

  console.log(`Successfully started round ${nextRound}`)
}

startRound()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Error starting the round:", error)
    process.exit(1)
  })
