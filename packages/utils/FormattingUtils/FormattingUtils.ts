import { BigNumber } from "bignumber.js"
import { isFinite } from "lodash"

export const ROUND_DECIMAL_ZERO = 0
export const ROUND_DECIMAL_DEFAULT = 2
export const ROUND_DECIMAL_PRECISE = 6

export const getCompactFormatter = (decimalPlaces?: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: decimalPlaces,
  })

// const locale = detectLocale()

export type DateType = "short" | "full" | "long" | "medium" | undefined

/**
 * Format the number human friendly
 * @param formattedValue - value in string or number
 * @param originalValue - value in string or number to determine if the original value is 0
 * @param symbol - (optional) symbol to append at end of number (with a space)
 * @returns the formatted number
 */

function roundDownSignificantDigits(numbers: number, decimals: number = 0) {
  if (typeof numbers !== "number" || typeof decimals !== "number") {
    throw new Error("Invalid input: number and decimals must be of type number")
  }

  const significantDigits = parseInt(numbers.toExponential().split("e-")[1] || "0", 10)

  const effectiveDecimals = Math.max(0, decimals + significantDigits)
  const scaleFactor = Math.pow(10, effectiveDecimals)

  return Math.floor(numbers * scaleFactor) / scaleFactor
}

export const humanNumber = (
  formattedValue: BigNumber.Value,
  originalValue?: BigNumber.Value,
  symbol: string | null = null,
) => {
  const suffix = symbol ? " " + symbol : ""

  originalValue = originalValue || formattedValue
  let formatter = new Intl.NumberFormat("en", {
    style: "decimal",
    minimumFractionDigits: Number.parseFloat(formattedValue.toString()) % 1 === 0 ? 0 : 2,
  })

  let value = formatter.format(roundDownSignificantDigits(Number(formattedValue), 2))

  //If the original number got scaled down to 0
  if (!isZero(originalValue) && isZero(value)) {
    value = "< 0.01"
  }

  return value + suffix
}

export const isZero = (value?: BigNumber.Value) => {
  if (!value && value !== 0) return false
  return new BigNumber(value).isZero()
}

/**
 * Format address
 * @param address - the address
 * @param lengthBefore - (optional, default 4) the characters to show before the dots
 * @param lengthAfter - (optional, default 4) the characters to show after the dots
 * @returns the formatted address
 */
export const humanAddress = (address: string, lengthBefore = 4, lengthAfter = 10) => {
  const before = address.substring(0, lengthBefore)
  const after = address.substring(address.length - lengthAfter)
  return `${before}…${after}`
}

export const humanDomain = (domain: string, lengthBefore = 8, lengthAfter = 6) => {
  // if domain is smaller than lengthBefore + lengthAfter, return the domain
  if (domain.length <= lengthBefore + lengthAfter) return domain

  const before = domain.substring(0, lengthBefore)
  const after = domain.substring(domain.length - lengthAfter)
  return `${before}…${after}`
}

export const humanUrl = (url: string, lengthBefore = 8, lengthAfter = 6) => {
  const before = url.substring(0, lengthBefore)
  const after = url.substring(url.length - lengthAfter)
  return `${before}…${after}`
}

export const formatAlias = (alias: string, maxLength = 18, lengthBefore = 6, lengthAfter = 6) => {
  if (alias.length <= maxLength) return alias
  const before = alias.substring(0, lengthBefore)
  const after = alias.substring(alias.length - lengthAfter)
  const formatted = `${before}…${after}`

  if (formatted.length > alias.length - 2) return alias

  return formatted
}

/**
 * Modify url to remove Protocol from prefix
 * @param url - raw token balance
 * @returns url without HTTP / HTTPS prefix
 */
export const removeUrlProtocolAndPath = (url: string) => {
  return new URL(url).host
}

// /**
//  * Format currency
//  */
// export const formatCurrency = (currency: CURRENCY): string => {
//     let name = "Dollar (US)"
//     switch (currency) {
//         case CURRENCY.EUR:
//             name = "Euro"
//             break
//         case CURRENCY.USD:
//         default:
//     }

//     return `${currency} - ${name}`
// }

export const limitChars = (text: string) => {
  if (text.length <= 24) {
    return text
  } else {
    return text.slice(0, 24)
  }
}

/**
 * Function to validate an array of strings representing percentages.
 *
 * This function takes in an array of strings, each of which is expected to represent a percentage.
 * Each string should be in the format "<number>%", where "<number>" can be any value between 0 and 100.
 * The function returns `true` if all strings in the array conform to this format and the numbers are within the valid range.
 * It returns `false` otherwise.
 *
 * Note that this function does not check whether the sum of the percentages exceeds 100%.
 *
 * @example
 * ```typescript
 * console.log(validateStringPercentages(["50%", "60%"]));  // Returns true
 * console.log(validateStringPercentages(["50", "60%"]));  // Returns false
 * console.log(validateStringPercentages(["150%", "60%"]));  // Returns false
 * ```
 *
 * @param percentages - An array of strings to be validated.
 *
 * @returns A boolean value indicating whether all strings in the input array are valid percentages.
 */
export const validateStringPercentages = (percentages: string[]): boolean => {
  // Check if percentages is a non-empty array
  if (percentages.length === 0) return false

  for (const percentage of percentages) {
    // Check if string ends with '%'
    if (!percentage.endsWith("%")) {
      return false
    }

    // Check if the prefix is a valid number between 0 and 100
    let value = Number(percentage.slice(0, -1))
    if (!isFinite(value) || value < 0 || value > 100) {
      return false
    }
  }

  // If we made it this far, all strings are valid percentages
  return true
}

export function formatToHumanNumber(
  amount: string,
  decimals: number,
  formatToCurrency = true,
  locale = "en-US",
): string {
  // Convert the amount to a floating point number
  const numberAmount = parseFloat(amount)

  if (isNaN(numberAmount)) {
    return "Invalid amount"
  }

  const scale = 100

  // Round the number to the specified decimal places
  const roundedAmount = Math.floor(numberAmount * scale) / scale

  const options: Intl.NumberFormatOptions = formatToCurrency
    ? { style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }

  const formatter = new Intl.NumberFormat(locale, options)

  let amountString = formatter.format(numberAmount)

  if (!isZero(numberAmount) && isZero(roundedAmount)) {
    amountString = "< 0.01"
  }

  return amountString
}
