import inquirer from "inquirer"
import { execSync } from "child_process"

interface SelectDeploy {
  name: string
  description: string
}

const selectDeployConfigs: Record<string, SelectDeploy> = {
  "Deploy All": {
    name: "deploy-all",
    description: "Deploy all contracts in the project",
  },
  "VeBetter Passport": {
    name: "ve-better-passport",
    description: "Deploy only this contract",
  },
  "X2Earn Creator": {
    name: "x2-earn-creator",
    description: "Deploy only this contract",
  },
  "Node Management": {
    name: "node-management",
    description: "Deploy only this contract",
  },
  "Multi Sig": {
    name: "b3tr-multi-sig",
    description: "Deploy only this contract",
  },
  "Grants Manager": {
    name: "grants-manager",
    description: "Deploy only this contract",
  },
} as const

async function upgradeContract() {
  try {
    const env = process.env.NEXT_PUBLIC_APP_ENV
    if (!env) throw new Error("Environment variable NEXT_PUBLIC_APP_ENV is not set.")

    console.log("Deploying contracts on", env)

    // I want deployChoices to show the key of selectDeployConfigs and description, and I want it to return the name inside the object when selected
    const deployChoices = Object.entries(selectDeployConfigs).map(([key, value]) => {
      return {
        name: `${key} - ${value.description}`,
        value: value.name,
      }
    })

    // Prompt the user to select contracts to deploy
    const userChoice = await inquirer.prompt<{ deploy: string }>({
      type: "list",
      name: "deploy",
      message: "Which contracts do you want to deploy?",
      choices: deployChoices,
    })

    switch (userChoice.deploy) {
      case "ve-better-passport":
        console.log("Deploying VeBetter Passport")
        // Set environment variables
        process.env.CONTRACT_TO_DEPLOY = userChoice.deploy
        // Run the upgrade script
        execSync(`turbo run deploy:contract:${env}`, { stdio: "inherit" })
        break
      case "x2-earn-creator":
        console.log("Deploying X2Earn Creator")
        // Set environment variables
        process.env.CONTRACT_TO_DEPLOY = userChoice.deploy
        // Run the upgrade script
        execSync(`turbo run deploy:contract:${env}`, { stdio: "inherit" })
        break
      case "node-management":
        console.log("Deploying Node Management")
        // Set environment variables
        process.env.CONTRACT_TO_DEPLOY = userChoice.deploy
        // Run the upgrade script
        execSync(`turbo run deploy:contract:${env}`, { stdio: "inherit" })
        break
      case "b3tr-multi-sig":
        console.log("Deploying Multi Sig")
        // Set environment variables
        process.env.CONTRACT_TO_DEPLOY = userChoice.deploy
        // Run the upgrade script
        execSync(`turbo run deploy:contract:${env}`, { stdio: "inherit" })
        break
      case "grants-manager":
        console.log("Deploying Grants Manager")
        // Set environment variables
        process.env.CONTRACT_TO_DEPLOY = userChoice.deploy
        // Run the upgrade script
        execSync(`turbo run deploy:contract:${env}`, { stdio: "inherit" })
        break
      case "deploy-all":
        console.log("Deploying all contracts")
        // Run the upgrade script
        execSync(`turbo run deploy:${env}`, { stdio: "inherit" })
        break
      default:
        throw new Error("Invalid choice")
    }

    console.log("\nDeploy complete!")
  } catch (error) {
    console.error("Deploy failed:", error)
    process.exit(1)
  }
}

upgradeContract()
