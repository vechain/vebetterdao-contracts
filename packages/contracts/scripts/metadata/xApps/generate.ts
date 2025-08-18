import fs from "fs/promises"
import { copyImages, toIPFSURL, uploadDirectoryToIPFS, zipFolder } from "../../helpers"
import path from "path"
import { ethers } from "ethers"

interface SocialUrl {
  name: string
  url: string
}

interface AppUrl {
  code: string
  url: string
}

interface XAppMetadata {
  name: string
  description: string
  external_url: string
  logo: string
  banner: string
  screenshots: string[]
  social_urls: SocialUrl[]
  app_urls: AppUrl[]
  ve_world: {
    banner: string
    featured_image: string
  }
}

const SRC_JSON_PATH = path.join(__dirname, `../../../metadata/xApps/src/json`)
const MEDIA_PATH = path.join(__dirname, "../../../metadata/xApps/src/media")
const OUTPUT_PATH = path.join(__dirname, `../../../metadata/xApps/output`)

/**
 * Main function to generate and save x-apps metadata.
 */
async function generateAndSaveMetadata(): Promise<void> {
  try {
    // get metadata templates from the source directory
    const files = await fs.readdir(SRC_JSON_PATH)

    // for each file, generate metadata and save to output folder
    for (const file of files) {
      const metadata: XAppMetadata = await generateMetadata(file)

      // the output filename must be the hash of the name (which will also be the id of the x-app)
      const id = ethers.keccak256(ethers.toUtf8Bytes(metadata.name))
      await saveMetadataToFile(metadata, id)
    }
  } catch (error) {
    console.error("Error generating metadata:", error)
    throw error // Rethrow the error after logging to handle it further up the call stack.
  }
}

const generateMetadata = async (file: string): Promise<XAppMetadata> => {
  const metadata: XAppMetadata = JSON.parse(await fs.readFile(path.join(SRC_JSON_PATH, file), "utf-8"))
  const filename = path.parse(file).name

  await validateMediaFiles(filename)
  // Copy images to a new directory called images so that we can zip them
  copyImages(`${MEDIA_PATH}/${filename}`, `${MEDIA_PATH}/media`)
  // Zip the images directory
  await zipFolder(`${MEDIA_PATH}/media`, `${MEDIA_PATH}/media.zip`)

  const [imagesIpfsUrl] = await uploadDirectoryToIPFS(`${MEDIA_PATH}/media.zip`, `${MEDIA_PATH}/${filename}`)

  metadata.banner = toIPFSURL(imagesIpfsUrl, "banner.png", "media")
  metadata.logo = toIPFSURL(imagesIpfsUrl, "logo.png", "media")
  metadata.ve_world.banner = toIPFSURL(imagesIpfsUrl, "banner.png", "media")
  metadata.ve_world.featured_image = toIPFSURL(imagesIpfsUrl, "featured_image.png", "media")

  return metadata
}

const validateMediaFiles = async (filename: string) => {
  let media = await fs.readdir(`${MEDIA_PATH}/${filename}`)

  // Check and remove .DS_STORE files if they exist
  if (media.includes(".DS_Store")) {
    await fs.unlink(`${MEDIA_PATH}/${filename}/.DS_Store`) // This deletes the .DS_Store file
    media = media.filter(file => file !== ".DS_Store") // Update the media list
  }

  // media must contain 2 files: a logo and a banner
  if (media.length !== 3) {
    throw new Error(`Invalid media files for ${filename}`)
  }

  const logo = await fs.readFile(`${MEDIA_PATH}/${filename}/logo.png`)
  const banner = await fs.readFile(`${MEDIA_PATH}/${filename}/banner.png`)
  const ve_world_banner = await fs.readFile(`${MEDIA_PATH}/${filename}/ve_world_banner.png`)
  if (!logo || !banner || !ve_world_banner) {
    throw new Error(`Invalid media files for ${filename}`)
  }
}

/**
 * Asynchronously saves the generated metadata.
 * @param metadata - The `XAppMetadata` object to save.
 */
async function saveMetadataToFile(metadata: XAppMetadata, fileName: string): Promise<void> {
  await fs.writeFile(`${OUTPUT_PATH}/${fileName}.json`, JSON.stringify(metadata, null, 2))
  console.log(`Metadata saved to ${OUTPUT_PATH}/${fileName}`)
}

// Generate and save the NFT metadata
generateAndSaveMetadata()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Unhandled error:", error)
    process.exit(1)
  })
