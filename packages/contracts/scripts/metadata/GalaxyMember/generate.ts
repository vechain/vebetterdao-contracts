import fs from "fs/promises"
import path from "path"
import { toIPFSURL, uploadBlobToIPFS } from "../../helpers"
import { IMAGE_PATH, GM_IMAGES_DATA, METADATA_PATH, description } from "./const"

/**
 * Interface for an NFT attribute.
 */
interface Attribute {
  trait_type: string
  value: string | number
}

/**
 * Interface for the NFT metadata.
 * @see NFT Metadata Standards](https://docs.opensea.io/docs/metadata-standards)
 */
interface Metadata {
  name: string
  description: string
  image: string
  attributes: Attribute[]
}

/**
 * Converts a record of attributes into an array of `Attribute` objects.
 *
 * @param attributes - A record object containing the attributes to convert.
 * @returns An array of `Attribute` objects.
 */
function convertAttributes(attributes: Record<string, string | number>): Attribute[] {
  return Object.entries(attributes).map(([key, value]) => ({ trait_type: key, value }))
}

/**
 * Generates the NFT metadata for a given level.
 *
 * @param name - The name of the level.
 * @param description - The description of the level.
 * @param imagesCID - The CID of the images directory on IPFS.
 * @param attributes - The attributes of the level.
 * @param image - The image file for the level.
 *
 * @returns The generated NFT metadata.
 */
function generateMetadata(
  name: string,
  description: string,
  attributes: Record<string, string | number>,
  image: string,
): Metadata {
  return {
    name,
    description,
    image: image,
    attributes: convertAttributes(attributes),
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
 * Asynchronously gets the NFT images from the IMAGE_PATH.
 * @returns An array of NFT image file names.
 */
async function getNFTImages(): Promise<string[]> {
  //Get only the png files in the IMAGE_PATH
  const images = (await fs.readdir(IMAGE_PATH)).filter(file => file.toLowerCase().endsWith(".png"))
  return images
}

/**
 * Asynchronously gets the image blob for a given image name.
 * @param imageName - The name of the image to get the blob for.
 * @returns A promise that resolves to the image blob.
 */
async function getImageBlob(imageName: string): Promise<Blob> {
  const imagePath = path.join(IMAGE_PATH, imageName)
  const imageBuffer = await fs.readFile(imagePath)
  return new Blob([imageBuffer], { type: "image/png" })
}

/**
 * Main function to generate and save NFT metadata.
 */
async function generateAndSaveMetadata(): Promise<void> {
  try {
    // 1. Check if levelNames matches the amount of images in the IMAGE_PATH
    const images = await getNFTImages()
    if (GM_IMAGES_DATA.length !== images.length) {
      throw new Error("Galaxy Member images and data do not match")
    }

    // 2. Upload each image individually and store the CID
    const imageCids = await Promise.all(
      GM_IMAGES_DATA.map(async ({ levelName }, index) => {
        console.log(`Uploading image ${levelName}, path -> ${images[index]}`)
        const imageBlob = await getImageBlob(images[index])
        const cid = await uploadBlobToIPFS(imageBlob, images[index])
        console.log(`GM Image ${levelName} uploaded to CID -> ${cid}`)
        return cid
      }),
    )

    // 3. Generate and save the metadata for each level
    await Promise.all(
      GM_IMAGES_DATA.map(async ({ levelName, levelAttributes }, index) => {
        //Format the image CID to be used in the metadata (eg. ipfs://<cid>)
        const image = toIPFSURL(imageCids[index])
        const metadata = generateMetadata(levelName, description, levelAttributes, image)
        const fileName = String(index + 1)
        return await saveMetadataToFile(metadata, fileName)
      }),
    )

    return
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
