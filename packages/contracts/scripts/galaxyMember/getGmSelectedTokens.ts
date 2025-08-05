import { getConfig } from "@repo/config"
import { GalaxyMember__factory } from "../../typechain-types"
import { ethers } from "hardhat"
import fs from "fs/promises"

type Owner = {
  owner: string
  tokenId: string
}

/**
 * Starts a new round of emissions.
 *
 * @throws if the round cannot be started.
 */
const getGmSelectedTokens = async () => {
  const [signer] = await ethers.getSigners()

  const galaxyMember = GalaxyMember__factory.connect(getConfig().galaxyMemberContractAddress, signer)

  const totalSupply = await galaxyMember.totalSupply()

  const ownersWithoutSelectedToken: Owner[] = []

  for (let i = 1; i <= Number(totalSupply) + 1; i++) {
    console.log(`Getting owner of token ${i}`)
    try {
      const owner = await galaxyMember.ownerOf(i)
      const selectedTokenId = await galaxyMember.getSelectedTokenId(owner)

      if (selectedTokenId === 0n) {
        console.log(`Token ${i} of owner ${owner} is not selected`)
        ownersWithoutSelectedToken.push({ owner, tokenId: i.toString() })
      }
    } catch (e) {
      console.log(`Token ${i} does not exist or has been burned`)
    }
  }

  // Remove duplicate owners, keeping only the first occurrence
  const uniqueOwners: Owner[] = []
  const seenOwners = new Set<string>()

  for (const item of ownersWithoutSelectedToken) {
    if (!seenOwners.has(item.owner)) {
      seenOwners.add(item.owner)
      uniqueOwners.push(item)
    }
  }

  // Save the unique owners to a file
  await fs.writeFile("gmOwnersWithSelected.json", JSON.stringify({ recipients: uniqueOwners }, null, 2))
}

getGmSelectedTokens()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Error starting the round:", error)
    process.exit(1)
  })
