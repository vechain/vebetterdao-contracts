import { Address, HDKey, VET } from "@vechain/sdk-core"
import { getMnemonic } from "./env"
export type TestPk = {
  pk: Uint8Array
  address: Address
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

const mnemonic = getMnemonic()
const hdnode = HDKey.fromMnemonic(mnemonic.split(" "))

export const getTestKey = (index: number): TestPk => {
  const pk = hdnode.deriveChild(index)
  if (!pk.privateKey) {
    throw new Error("Private key not found")
  }
  return {
    pk: pk.privateKey,
    address: Address.ofPrivateKey(pk.privateKey),
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
  return VET.of(Math.floor(result)).wei
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
      amount: VET.of(10000).wei,
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
      amount: VET.of(((index + 1) * 5).toFixed(2)).wei,
    })
  })

  return seedAccounts
}
