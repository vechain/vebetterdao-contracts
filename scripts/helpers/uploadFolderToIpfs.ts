import { getFolderName, toIPFSURL, uploadDirectoryToIPFS, zipFolder } from "."

export async function uploadMetadataToIpfs(METADATA_PATH: string): Promise<void> {
  try {
    // Zip the directory and get the path to the zip file
    await zipFolder(METADATA_PATH, `${METADATA_PATH}.zip`)
    const [metadataIpfsUrl] = await uploadDirectoryToIPFS(`${METADATA_PATH}.zip`, METADATA_PATH)

    console.log("Metadata IPFS URL:", toIPFSURL(metadataIpfsUrl, undefined, getFolderName(METADATA_PATH)))
  } catch (error) {
    console.error("Error uploading metadata to IPFS:", error)
    throw error // Rethrow the error after logging to handle it further up the call stack.
  }
}
