import inquirer from "inquirer"
import { execSync } from "child_process"
import { functionConfig } from "./functionsConfig"
import { EnvConfig } from "@repo/config/contracts"
import { getConfig } from "@repo/config"

async function runFunction() {
  try {
    const env = process.env.NEXT_PUBLIC_APP_ENV
    if (!env) throw new Error("Environment variable NEXT_PUBLIC_APP_ENV is not set.")

    const config = getConfig(env as EnvConfig)

    // Prompt user to select a function
    const { functionName } = await inquirer.prompt<{ functionName: keyof typeof functionConfig }>({
      type: "list",
      name: "functionName",
      message: "Which function do you want to run?",
      choices: Object.keys(functionConfig),
    })

    const selectedFunction = functionConfig[functionName]

    console.log(`You are about to run:`)
    console.log(`\nFunction: ${selectedFunction.name}`)
    console.log(`Contract name: ${selectedFunction.contractName}`)
    console.log(`Contract address: ${(config as any)[selectedFunction.configAddressField]}`)
    console.log(`Function description: ${selectedFunction.description}`)
    console.log(`Environment: ${env}\n`)

    const { confirmRun } = await inquirer.prompt<{ confirmRun: boolean }>({
      type: "confirm",
      name: "confirmRun",
      message: `Do you want to proceed with running ${selectedFunction.name} on environment ${env}?`,
      default: false,
    })

    if (!confirmRun) {
      console.log("Execution aborted.")
      process.exit(0)
    }

    // Set environment variables to be picked up by Turbo task
    process.env.FUNCTION_TO_CALL = selectedFunction.file

    console.log(`\nStarting function ${selectedFunction.file} on ${env}...`)

    // Kick off the right turbo run task
    execSync(`turbo run call:contract:${env}`, { stdio: "inherit" })

    console.log("\nFunction executed successfully!")
  } catch (error) {
    console.error("Function execution failed:", error)
    process.exit(1)
  }
}

runFunction()
