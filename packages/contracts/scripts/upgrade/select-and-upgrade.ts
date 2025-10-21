import inquirer from "inquirer"
import { execSync } from "child_process"
import { EnvConfig } from "@repo/config/contracts"
import { upgradeConfig } from "./upgradesConfig"
import { getConfig } from "@repo/config"
import { ethers } from "hardhat"

async function upgradeContract() {
  try {
    const env = process.env.NEXT_PUBLIC_APP_ENV
    if (!env) throw new Error("Environment variable NEXT_PUBLIC_APP_ENV is not set.")

    const config = getConfig(process.env.NEXT_PUBLIC_APP_ENV as EnvConfig)

    // Prompt the user to select a contract to upgrade
    const { contract } = await inquirer.prompt<{ contract: keyof typeof upgradeConfig }>({
      type: "list",
      name: "contract",
      message: "Which contract do you want to upgrade?",
      choices: Object.keys(upgradeConfig),
    })

    const selectedContract = upgradeConfig[contract]

    const versionChoices = selectedContract.versions.map(version => ({
      name: `${version} - ${selectedContract.descriptions[version]}`,
      value: version,
    }))

    // Prompt the user to select the version to upgrade to
    const { version } = await inquirer.prompt<{ version: string }>({
      type: "list",
      name: "version",
      message: `Which version do you want to upgrade ${contract} to?`,
      choices: versionChoices,
    })

    const deployer = (await ethers.getSigners())[0]

    console.log(`You are about to upgrade the following contract:`)
    console.log(`\nContract: ${selectedContract.name}`)
    console.log(`Contract address: ${(config as any)[selectedContract.configAddressField]}`)
    console.log(`Version: ${version}`)
    console.log(`Upgrade description: ${selectedContract.descriptions[version]}`)
    console.log(`Upgrader wallet: ${deployer.address}`)
    console.log(`Environment: ${env}\n`)

    // Confirm the upgrade
    const { confirmUpgrade } = await inquirer.prompt<{ confirmUpgrade: boolean }>({
      type: "confirm",
      name: "confirmUpgrade",
      message: `Do you want to proceed with the upgrade of ${selectedContract.name} to version ${version} on environment ${env}?`,
      default: false,
    })

    if (!confirmUpgrade) {
      console.log("Upgrade aborted.")
      process.exit(0)
    }

    // Set environment variables
    process.env.CONTRACT_TO_UPGRADE = selectedContract.name
    process.env.CONTRACT_VERSION = version

    console.log(`\nStarting upgrade of ${selectedContract.name} to version ${version} on ${env}...`)

    // Run the upgrade script
    execSync(`turbo run upgrade:contract:${env}`, { stdio: "inherit" })

    console.log("\nUpgrade complete!")
  } catch (error) {
    console.error("Upgrade failed:", error)
    process.exit(1)
  }
}

upgradeContract()
