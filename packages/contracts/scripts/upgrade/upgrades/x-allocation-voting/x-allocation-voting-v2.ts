import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { XAllocationVoting } from "../../../../typechain-types"
import { ethers } from "hardhat"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)
  const network = config.network.name
  const env = config.environment
  const deployer = (await ethers.getSigners())[0]

  console.log(
    `Upgrading XAllocationVoting contract at address: ${config.xAllocationVotingContractAddress} on network: ${network} (env: ${env}) with deployer: ${deployer.address}`,
  )

  const xAllocationVotingV2 = (await upgradeProxy(
    "XAllocationVotingV1",
    "XAllocationVoting",
    config.xAllocationVotingContractAddress,
    [config.veBetterPassportContractAddress],
    {
      version: 2,
    },
  )) as XAllocationVoting

  console.log(`XAllocationVoting upgraded`)

  // check that upgrade was successful
  const version = await xAllocationVotingV2.version()
  console.log(`New XAllocationVoting version: ${version}`)

  if (parseInt(version) !== 2) {
    throw new Error(`XAllocationVoting version is not 2: ${version}`)
  }

  // check that the VeBetterPassport contract address is set
  const veBetterPassport = await xAllocationVotingV2.veBetterPassport()
  if (veBetterPassport !== config.veBetterPassportContractAddress) {
    throw new Error(`VeBetterPassport contract address is not the expected one: ${veBetterPassport}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
