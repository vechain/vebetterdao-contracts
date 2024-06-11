import { VECHAIN_DEFAULT_MNEMONIC } from "@vechain/hardhat-vechain"
import { unitsUtils, addressUtils, mnemonic } from "@vechain/sdk-core"

export type TestPk = {
  pk: Uint8Array
  pkHex: string
  address: string
}

export type SeedAccount = {
  key: TestPk
  amount: bigint
}

export enum SeedStrategy {
  RANDOM,
  FIXED,
  LINEAR,
}

const PHRASE = (process.env.MNEMONIC || VECHAIN_DEFAULT_MNEMONIC).split(" ")

export const TEST_DERIVATION_PATH = "m"

export const getTestKey = (index: number, derivationPath: string = TEST_DERIVATION_PATH): TestPk => {
  const pk = mnemonic.derivePrivateKey(PHRASE, `${derivationPath}/${index}`)
  const buffer = Buffer.from(pk)
  const pkHex = buffer.toString("hex")
  return {
    pk,
    pkHex,
    address: addressUtils.fromPrivateKey(pk),
  }
}

export const getTestKeys = (count: number): TestPk[] => {
  const accounts = []
  for (let i = 0; i < count; i++) {
    accounts.push(getTestKey(i))
  }

  return accounts
}

/**
 * Generates a random starting balance for an account
 * Lower balances are favoured based on a log scale
 * @param min
 * @param max
 * @returns
 */
const getRandomStartingBalance = (min: number, max: number): bigint => {
  const scale = Math.log(max) - Math.log(min)
  const random = Math.random() ** 6 // Raise to a power to skew towards smaller values.
  const result = Math.exp(Math.log(min) + scale * random)
  return unitsUtils.parseVET(Math.floor(result).toString())
}

/**
 * Get seed accounts based on the strategy
 * @param strategy the strategy to use
 * @param numAccounts the number of accounts to generate
 * @param acctOffset the offset to start the account index
 * @returns a list of seed accounts
 */
export const getSeedAccounts = (strategy: SeedStrategy, numAccounts: number, acctOffset: number): SeedAccount[] => {
  switch (strategy) {
    case SeedStrategy.RANDOM:
      return getSeedAccountsRandom(numAccounts, acctOffset)
    case SeedStrategy.LINEAR:
      return getSeedAccountsLinear(numAccounts, acctOffset)
    case SeedStrategy.FIXED:
      return getSeedAccountsFixed(numAccounts, acctOffset)
    default:
      throw new Error("Unknown seed strategy")
  }
}

const getSeedAccountsFixed = (numAccounts: number, acctOffset: number): SeedAccount[] => {
  const keys = getTestKeys(numAccounts + acctOffset)

  const seedAccounts: SeedAccount[] = []

  keys.slice(acctOffset).forEach(key => {
    seedAccounts.push({
      key,
      amount: unitsUtils.parseVET("200000"),
    })
  })

  return seedAccounts
}

const getSeedAccountsRandom = (numAccounts: number, acctOffset: number): SeedAccount[] => {
  const keys = getTestKeys(numAccounts + acctOffset)

  const seedAccounts: SeedAccount[] = []

  keys.slice(acctOffset).forEach(key => {
    seedAccounts.push({
      key,
      amount: getRandomStartingBalance(5, 1000),
    })
  })

  return seedAccounts
}

const getSeedAccountsLinear = (numAccounts: number, acctOffset: number): SeedAccount[] => {
  const keys = getTestKeys(numAccounts + acctOffset)

  const seedAccounts: SeedAccount[] = []

  keys.slice(acctOffset).forEach((key, index) => {
    seedAccounts.push({
      key,
      amount: unitsUtils.parseVET(((index + 1) * 5).toFixed(2)),
    })
  })

  return seedAccounts
}
