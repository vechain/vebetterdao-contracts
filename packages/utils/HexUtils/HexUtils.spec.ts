import { removePrefix, addPrefix, validate, isValid, compare, generateRandom } from "./HexUtils"

const hexLowercaseHasPrefix = "0x38983243287eef8773264910fe003"
const hexLowercaseNoPrefix = "38983243287eef8773264910fe003"
const hexUppercaseHasPrefixUppercase = "0X38983243287EEF8773264910FE003"
const hexUppercaseHasPrefixLowercase = "0x38983243287EEF8773264910FE003"
const hexUppercaseNoPrefix = "38983243287EEF8773264910FE003"
const hexMixedcaseHasPrefix = "0x38983243287eEf8773264910Fe003"
const hexMixedcaseNoPrefix = "38983243287eEf8773264910Fe003"
const invalidHex = "0xfsdjkvbdjkfbkjn"
const hexMultiplePrefixes = "0x0X38983243287eef8773264910fe003"

// Remove Prefix
describe("HexUtils tests", () => {
  test("Remove prefix - valid hex lowercase with prefix", () => {
    const result = removePrefix(hexLowercaseHasPrefix)
    expect(result).toBe(hexLowercaseNoPrefix)
  })

  test("Remove prefix - valid hex lowercase without prefix", () => {
    const result = removePrefix(hexLowercaseNoPrefix)
    expect(result).toBe(hexLowercaseNoPrefix)
  })

  test("Remove prefix - valid hex uppercase with prefix", () => {
    const result = removePrefix(hexUppercaseHasPrefixUppercase)
    expect(result).toBe(hexUppercaseNoPrefix)
  })

  test("Remove prefix - valid hex uppercase without prefix", () => {
    const result = removePrefix(hexUppercaseNoPrefix)
    expect(result).toBe(hexUppercaseNoPrefix)
  })

  test("Remove prefix - valid hex mixedcase with prefix", () => {
    const result = removePrefix(hexMixedcaseHasPrefix)
    expect(result).toBe(hexMixedcaseNoPrefix)
  })

  test("Remove prefix - valid hex mixedcase without prefix", () => {
    const result = removePrefix(hexMixedcaseNoPrefix)
    expect(result).toBe(hexMixedcaseNoPrefix)
  })

  test("Remove prefix - invalid hex string", () => {
    expect(() => removePrefix(invalidHex)).toThrow()
  })

  test("Remove prefix - multiple prefix hex string", () => {
    expect(() => removePrefix(hexMultiplePrefixes)).toThrow()
  })

  // Add Prefix

  test("Add prefix - valid hex lowercase with prefix", () => {
    const result = addPrefix(hexLowercaseHasPrefix)
    expect(result).toBe(hexLowercaseHasPrefix)
  })

  test("Add prefix - valid hex lowercase without prefix", () => {
    const result = addPrefix(hexLowercaseNoPrefix)
    expect(result).toBe(hexLowercaseHasPrefix)
  })

  test("Add prefix - valid hex uppercase with prefix", () => {
    const result = addPrefix(hexUppercaseHasPrefixUppercase)
    expect(result).toBe(hexUppercaseHasPrefixLowercase)
  })

  test("Add prefix - valid hex uppercase without prefix", () => {
    const result = addPrefix(hexUppercaseNoPrefix)
    expect(result).toBe(hexUppercaseHasPrefixLowercase)
  })

  test("Add prefix - valid hex mixedcase with prefix", () => {
    const result = addPrefix(hexMixedcaseHasPrefix)
    expect(result).toBe(hexMixedcaseHasPrefix)
  })

  test("Add prefix - valid hex mixedcase without prefix", () => {
    const result = addPrefix(hexMixedcaseNoPrefix)
    expect(result).toBe(hexMixedcaseHasPrefix)
  })

  test("Add prefix - invalid hex string", () => {
    expect(() => addPrefix(invalidHex)).toThrow()
  })

  test("Add prefix - multiple prefix hex string", () => {
    expect(() => addPrefix(hexMultiplePrefixes)).toThrow()
  })

  // Validate

  test("Validate - hex lowercase has prefix", () => {
    expect(() => validate(hexLowercaseHasPrefix)).not.toThrow()
  })

  test("Validate - hex lowercase no prefix", () => {
    expect(() => validate(hexLowercaseNoPrefix)).not.toThrow()
  })

  test("Validate - hex uppercase has prefix uppercase", () => {
    expect(() => validate(hexUppercaseHasPrefixUppercase)).not.toThrow()
  })

  test("Validate - hex uppercase has prefix lowercase", () => {
    expect(() => validate(hexUppercaseHasPrefixLowercase)).not.toThrow()
  })

  test("Validate - hex uppercase no prefix", () => {
    expect(() => validate(hexUppercaseNoPrefix)).not.toThrow()
  })

  test("Validate - hex mixedcase has prefix", () => {
    expect(() => validate(hexMixedcaseHasPrefix)).not.toThrow()
  })

  test("Validate - hex mixedcase no prefix", () => {
    expect(() => validate(hexMixedcaseNoPrefix)).not.toThrow()
  })

  test("Validate - invalid hex string", () => {
    expect(() => validate(invalidHex)).toThrow()
  })

  test("Validate - multiple prefix hex string", () => {
    expect(() => validate(hexMultiplePrefixes)).toThrow()
  })

  // Is Valid

  test("Is Valid - hex lowercase has prefix", () => {
    expect(isValid(hexLowercaseHasPrefix)).toBeTruthy()
  })

  test("Is Valid - hex lowercase no prefix", () => {
    expect(isValid(hexLowercaseNoPrefix)).toBeTruthy()
  })

  test("Is Valid - hex uppercase has prefix uppercase", () => {
    expect(isValid(hexUppercaseHasPrefixUppercase)).toBeTruthy()
  })

  test("Is Valid - hex uppercase has prefix lowercase", () => {
    expect(isValid(hexUppercaseHasPrefixLowercase)).toBeTruthy()
  })

  test("Is Valid - hex uppercase no prefix", () => {
    expect(isValid(hexUppercaseNoPrefix)).toBeTruthy()
  })

  test("Is Valid - hex mixedcase has prefix", () => {
    expect(isValid(hexMixedcaseHasPrefix)).toBeTruthy()
  })

  test("Is Valid - hex mixedcase no prefix", () => {
    expect(isValid(hexMixedcaseNoPrefix)).toBeTruthy()
  })

  test("Is Valid - invalid hex string", () => {
    expect(isValid(invalidHex)).toBeFalsy()
  })

  test("Is Valid - multiple prefix hex string", () => {
    expect(isValid(hexMultiplePrefixes)).toBeFalsy()
  })

  describe("compare", () => {
    test("compare - hex lowercase has prefix", () => {
      expect(compare(hexLowercaseHasPrefix, hexLowercaseHasPrefix)).toBeTruthy()
    })

    test("compare - hex lowercase no prefix", () => {
      expect(compare(hexLowercaseNoPrefix, hexLowercaseNoPrefix)).toBeTruthy()
    })

    test("compare - hex uppercase has prefix uppercase", () => {
      expect(compare(hexUppercaseHasPrefixUppercase, hexUppercaseHasPrefixUppercase)).toBeTruthy()
    })

    test("compare - hex uppercase has prefix lowercase", () => {
      expect(compare(hexUppercaseHasPrefixLowercase, hexUppercaseHasPrefixLowercase)).toBeTruthy()
    })

    test("compare - hex uppercase no prefix", () => {
      expect(compare(hexUppercaseNoPrefix, hexUppercaseNoPrefix)).toBeTruthy()
    })

    test("compare - hex mixedcase has prefix", () => {
      expect(compare(hexMixedcaseHasPrefix, hexMixedcaseHasPrefix)).toBeTruthy()
    })

    test("compare - hex mixedcase no prefix", () => {
      expect(compare(hexMixedcaseNoPrefix, hexMixedcaseNoPrefix)).toBeTruthy()
    })

    test("compare - hex lowercase mix prefix", () => {
      expect(compare(hexLowercaseHasPrefix, hexLowercaseNoPrefix)).toBeTruthy()
    })

    test("compare hex with non hex", () => {
      expect(compare(hexLowercaseHasPrefix, "test")).toBeFalsy()
    })

    test("different hex should be false", () => {
      expect(compare("0x23", "0x2345")).toBeFalsy()
    })
  })

  // Generate Random
  test("Generate Random", () => {
    for (let len = 1; len < 1000; len++) {
      const randHex = generateRandom(len)
      expect(isValid(randHex)).toBeTruthy()
      expect(randHex.length).toBe(len + 2)
      expect(/^0x/.test(randHex)).toBeTruthy()
    }
  })

  test("Generate Random - length 0", () => {
    expect(() => generateRandom(0)).toThrow()
  })

  test("Generate Random - length -1", () => {
    expect(() => generateRandom(-1)).toThrow()
  })
})
