import { getConfig } from "@repo/config"
import { X2EarnApps__factory } from "../../typechain-types"
import { ethers } from "hardhat"

interface AppWithCreator {
  id: string
  name: string
  creators: string[]
}

/**
 * Get all apps that have a creator
 *
 * @return all apps that have a creator, with the appId, the appName and the creators addresses
 */
const getAllAppsFromCreator = async () => {
  const [signer] = await ethers.getSigners()

  const x2EarnApps = X2EarnApps__factory.connect(getConfig().x2EarnAppsContractAddress, signer)

  // get all apps
  const allApps = await x2EarnApps.apps()
  const allAppsIdAndNames = allApps.map(app => ({ id: app[0], name: app[2] }))

  // get all creator for each app
  const allAppsWithCreators: AppWithCreator[] = await Promise.all(
    allAppsIdAndNames.map(async app => {
      const creators = await x2EarnApps.appCreators(app.id)
      return {
        ...app,
        creators: Array.from(creators),
      }
    }),
  )

  // remove apps with no creators
  const appsWithCreators = allAppsWithCreators.filter(app => app.creators.length > 0)
  return appsWithCreators
}

/**
 * Get apps that have a common creator
 *
 * Predicate: If they have a common creator -> one of the app have been submitted due to the previous app creator NFT
 * Result is an array, with the creator as the index, and a list of apps that have this creator
 * @return the string "xapp 1, xapp 2, xapp 3 " are sharing the same creator "creator address"
 */
const findCreatorsWithMultipleApps = async () => {
  const creatorToApps = new Map()
  const appsWithCreators = await getAllAppsFromCreator()

  for (const app of appsWithCreators) {
    for (const creator of app.creators) {
      if (!creatorToApps.has(creator)) {
        creatorToApps.set(creator, [])
      }
      creatorToApps.get(creator).push({
        appId: app.id,
        name: app.name,
      })
    }
  }
  const result: Record<string, AppWithCreator[]> = {}
  for (const [creator, apps] of creatorToApps.entries()) {
    if (apps.length > 1) {
      result[creator] = apps
    }
  }

  console.log("result", result)
  return Object.entries(result).map(([creator, apps]) => {
    return `${apps.map(app => app.name).join(", ")} are sharing the same creator ${creator}`
  })
}

findCreatorsWithMultipleApps()
  .then(console.log)
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Error finding creators with multiple apps:", error)
    process.exit(1)
  })
