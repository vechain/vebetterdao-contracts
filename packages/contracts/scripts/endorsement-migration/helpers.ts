import { getConfig } from "@repo/config"
import { EnvConfig } from "@repo/config/contracts"
import { ethers } from "hardhat"
import path from "path"
import fs from "fs"
import type { MigrationData } from "./types"

const DATA_DIR = path.join(__dirname, "data")
const DATA_FILE = path.join(DATA_DIR, "endorsements.json")

export function getMigrationConfig() {
  const env = process.env.NEXT_PUBLIC_APP_ENV
  if (!env) throw new Error("Missing NEXT_PUBLIC_APP_ENV")
  return getConfig(env as EnvConfig)
}

export async function getX2EarnAppsContract() {
  const config = getMigrationConfig()
  return ethers.getContractAt("X2EarnApps", config.x2EarnAppsContractAddress)
}

export function getDataPath(): string {
  return DATA_FILE
}

export function loadMigrationData(): MigrationData {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Migration data not found at ${DATA_FILE}. Run 1_fetch.ts first.`)
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8")
  return JSON.parse(raw) as MigrationData
}

export function validateMigrationData(data: MigrationData): void {
  const config = getMigrationConfig()

  if (data.network !== config.network.name) {
    console.error(`Network mismatch: JSON="${data.network}", running on="${config.network.name}"`)
    process.exit(1)
  }

  if (data.x2EarnAppsAddress.toLowerCase() !== config.x2EarnAppsContractAddress.toLowerCase()) {
    console.error(
      `Contract address mismatch: JSON="${data.x2EarnAppsAddress}", config="${config.x2EarnAppsContractAddress}"`,
    )
    process.exit(1)
  }
}

export function saveMigrationData(data: MigrationData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8")
}
