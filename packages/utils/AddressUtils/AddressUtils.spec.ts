/* eslint-disable max-len */
/* eslint-disable no-console */
import { HDNode, mnemonic } from "thor-devkit"
import { compareAddresses, compareListOfAddresses, isValid, leftPadWithZeros, regexPattern } from "./AddressUtils"

const address1 = "0xf077b491b355E64048cE21E3A6Fc4751eEeA77fa"
const address1NoHex = "f077b491b355E64048cE21E3A6Fc4751eEeA77fa"
const address2 = "0x435933c8064b4Ae76bE665428e0307eF2cCFBD68"

describe("compareAddresses - positive testing", () => {
  test("regular addresses - same", () => {
    expect(compareAddresses(address1, address1)).toBe(true)
  })

  test("regular addresses - different", () => {
    expect(compareAddresses(address1, address2)).toBe(false)
  })

  test("1 uppercase, 1 lowercase", () => {
    expect(compareAddresses(address1.toLowerCase(), address1.toUpperCase())).toBe(true)
  })

  test("both uppercase", () => {
    expect(compareAddresses(address1.toUpperCase(), address1.toUpperCase())).toBe(true)
  })

  test("both lowercase", () => {
    expect(compareAddresses(address1.toLowerCase(), address1.toLowerCase())).toBe(true)
  })

  test("generated node", () => {
    const hdNode = HDNode.fromMnemonic(mnemonic.generate())
    const rootAddress = hdNode.address

    expect(compareAddresses(rootAddress, rootAddress)).toBe(true)

    expect(compareAddresses(rootAddress, rootAddress.toUpperCase())).toBe(true)

    expect(compareAddresses(rootAddress, rootAddress.toUpperCase())).toBe(true)
  })
})

describe("compareAddresses - negative testing", () => {
  test("1 address, 1 not hex", () => {
    expect(compareAddresses(address1, "not hex")).toBe(false)
  })

  test("bad length", () => {
    expect(compareAddresses(address1.slice(0, 10), address1.slice(0, 10))).toBe(true)
  })

  test("equal strings - neither addresses", () => {
    expect(compareAddresses("VET", "VET")).toBe(true)
  })

  test("one address no hex", () => {
    expect(compareAddresses(address1, address1NoHex)).toBe(true)
  })
})

describe("compareListOfAddresses - positive testing", () => {
  test("same list", () => {
    expect(compareListOfAddresses([address1, address2], [address1, address2])).toBe(true)
  })

  test("same list, different order", () => {
    expect(compareListOfAddresses([address1, address2], [address2, address1])).toBe(true)
  })

  test("same list, different case", () => {
    expect(
      compareListOfAddresses(
        [address1.toLowerCase(), address2.toUpperCase()],
        [address2.toLowerCase(), address1.toUpperCase()],
      ),
    ).toBe(true)
  })
})

describe("compareListOfAddresses - negative testing", () => {
  test("different lists", () => {
    expect(compareListOfAddresses([address1, address2], [address1, address1])).toBe(false)
  })

  test("different lists, different order", () => {
    expect(compareListOfAddresses([address1, address2], [address2, address2])).toBe(false)
  })

  test("different lists, different case", () => {
    expect(
      compareListOfAddresses(
        [address1.toLowerCase(), address2.toUpperCase()],
        [address2.toLowerCase(), address2.toUpperCase()],
      ),
    ).toBe(false)
  })

  test("first list empty", () => {
    expect(compareListOfAddresses([], [address1, address2])).toBe(false)
  })

  test("second list empty", () => {
    expect(compareListOfAddresses([address1, address2], [])).toBe(false)
  })
})

describe("Is Valid Address", () => {
  test("valid address", () => {
    expect(isValid("0x0000000000000000000000000000456e65726779")).toBe(true)
  })
  test("No prefix", () => {
    expect(isValid("0000000000000000000000000000456e65726779")).toBe(true)
  })
  test("invalid length hex", () => {
    expect(isValid("0x0000000000000000000000000000456e6572677")).toBe(false)
  })
  test("Invalid prefix", () => {
    expect(isValid("1x0000000000000000000000000000456e65726779")).toBe(false)
  })
  test("Not Hex", () => {
    expect(isValid("0x0000000000000000000000000000456e6572677g")).toBe(false)
  })

  test("not a string", () => {
    // @ts-ignore
    expect(isValid(1234)).toBe(false)
  })
})

describe("regexPattern", () => {
  test("returns the correct result", () => {
    expect(regexPattern()).toStrictEqual(/^0x[a-fA-F0-9]{40}$/)
  })
})

describe("leftPadWithZeros", () => {
  test("no padding needed", () => {
    expect(leftPadWithZeros("0x1234", 4)).toBe("0x1234")
  })

  test("padding needed", () => {
    expect(leftPadWithZeros("0x1234", 8)).toBe("0x00001234")
  })

  test("no prefix, no padding needed", () => {
    expect(leftPadWithZeros("1234", 4)).toBe("0x1234")
  })

  test("no prefix, padding needed", () => {
    expect(leftPadWithZeros("1234", 8)).toBe("0x00001234")
  })

  test("not a string", () => {
    // @ts-ignore
    expect(() => leftPadWithZeros(1234, 8)).toThrow(TypeError)
  })

  test("given length is less than the string length", () => {
    expect(() => leftPadWithZeros("0x1234", 3)).toThrow(Error)
  })
})
