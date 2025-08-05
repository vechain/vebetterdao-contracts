import { AppEnv } from "@repo/config/contracts"

export const getMnemonic = (): string => {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV
  let mnemonic: string | undefined

  switch (appEnv) {
    case AppEnv.TESTNET_STAGING:
      mnemonic = process.env.TESTNET_STAGING_MNEMONIC
      break
    case AppEnv.GALACTICA_TEST:
      mnemonic = process.env.GALACTICA_TEST_MNEMONIC
      break
    default: // Covers undefined appEnv or any other value
      mnemonic = process.env.MNEMONIC
      break
  }

  if (!mnemonic) {
    throw new Error(
      `Mnemonic not found for NEXT_PUBLIC_APP_ENV: ${appEnv}. Please ensure the corresponding environment variable (e.g., MNEMONIC, TESTNET_STAGING_MNEMONIC, GALACTICA_TEST_MNEMONIC) is set.`,
    )
  }

  return mnemonic
}
