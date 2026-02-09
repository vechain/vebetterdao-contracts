import { AppEnv } from "@repo/config/contracts"

export const getMnemonic = (required: boolean = true): string => {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV
  let mnemonic: string | undefined

  switch (appEnv) {
    case AppEnv.TESTNET_STAGING:
      mnemonic = process.env.TESTNET_STAGING_MNEMONIC
      break
    default: // Covers undefined appEnv or any other value
      mnemonic = process.env.MNEMONIC
      break
  }

  if (!mnemonic && required) {
    throw new Error(
      `Mnemonic not found for NEXT_PUBLIC_APP_ENV: ${appEnv}. Please ensure the corresponding environment variable (e.g., MNEMONIC, TESTNET_STAGING_MNEMONIC) is set.`,
    )
  }

  // Return a dummy mnemonic for build/compile operations
  return mnemonic || "dummy mnemonic dummy mnemonic dummy mnemonic dummy mnemonic dummy mnemonic dummy mnemonic"
}
