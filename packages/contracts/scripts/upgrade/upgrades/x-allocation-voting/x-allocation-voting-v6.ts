import { getConfig } from "@repo/config"
import { upgradeProxy } from "../../../helpers"
import { EnvConfig } from "@repo/config/contracts"
import { XAllocationVoting } from "../../../../typechain-types"

async function main() {
  if (!process.env.NEXT_PUBLIC_APP_ENV) {
    throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  }

  const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

  console.log(
    `Upgrading XAllocationVoting contract at address: ${config.xAllocationVotingContractAddress} on network: ${config.network.name}`,
  )

  const xAllocationVotingV5 = (await upgradeProxy(
    "XAllocationVotingV5",
    "XAllocationVoting",
    config.xAllocationVotingContractAddress,
    [],
    {
      version: 6,
    },
  )) as XAllocationVoting

  console.log(`XAllocationVoting upgraded`)

  // check that upgrade was successful
  const version = await xAllocationVotingV5.version()
  console.log(`New XAllocationVoting version: ${version}`)

  if (parseInt(version) !== 6) {
    throw new Error(`XAllocationVoting version is not 6: ${version}`)
  }

  console.log("Execution completed")
  process.exit(0)
}

// Execute the main function
main()
