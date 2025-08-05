import fs from "fs/promises"
import { toIPFSURL, uploadDirectoryToIPFS, zipFolder } from "../../helpers"
import path from "path"

/**
 * Interface for the NFT metadata.
 * @see NFT Metadata Standards](https://docs.opensea.io/docs/metadata-standards)
 */
interface Metadata {
  name: string
  description: string
  image: string
}

const description = "Creator NFT is a community of builders and innovators contributing to the VeBetter DAO ecosystem."

const METADATA_PATH = path.join(__dirname, "../../../metadata/creatorNFT/metadata")
const IMAGE_ZIP_PATH = path.join(__dirname, "../../../metadata/creatorNFT/images.zip")
const IMAGE_PATH = path.join(__dirname, "../../../metadata/creatorNFT/images")

/**
 * Generates the NFT metadata for a given level.
 *
 * @param name - The name of the level.
 * @param description - The description of the level.
 * @param imagesCID - The CID of the images directory on IPFS.
 * @param image - The image file for the level.
 *
 * @returns The generated NFT metadata.
 */
function generateMetadata(name: string, description: string, image: string): Metadata {
  return {
    name,
    description,
    image: image,
  }
}

/**
 * Asynchronously saves the generated NFT metadata.
 * @param metadata - The `Metadata` object to save.
 */
async function saveMetadataToFile(metadata: Metadata, fileName: string): Promise<void> {
  await fs.writeFile(`${METADATA_PATH}/${fileName}.json`, JSON.stringify(metadata, null, 2))
  console.log(`Metadata saved to ${METADATA_PATH}/${fileName}`)
}

/**
 * Main function to generate and save NFT metadata.
 */
async function generateAndSaveMetadata(): Promise<void> {
  try {
    // 1. Ensure the zip folder exists
    await zipFolder(IMAGE_PATH, IMAGE_ZIP_PATH)

    // 2. Upload images to IPFS and get URL
    const [imagesIpfsUrl, images, folderName] = await uploadDirectoryToIPFS(IMAGE_ZIP_PATH, IMAGE_PATH)

    console.log("Creator NFT Images IPFS URL:", toIPFSURL(imagesIpfsUrl, undefined, folderName))

    const image = toIPFSURL(imagesIpfsUrl, images[0].name, folderName)
    const metadata = generateMetadata("VeBetterDAO Creator", description, image)
    await saveMetadataToFile(metadata, String(1))
  } catch (error) {
    console.error("Error generating metadata:", error)
    throw error // Rethrow the error after logging to handle it further up the call stack.
  }
}

// Generate and save the NFT metadata
generateAndSaveMetadata()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Unhandled error:", error)
    process.exit(1)
  })
