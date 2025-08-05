import fs from "fs/promises"
import { readFilesFromDirectory, uploadDirectoryToIPFS } from "../../helpers"
import path from "path"

const OUTPUT_PATH = path.join(__dirname, `../../../metadata/xApps/output`)

const uploadToIpfs = async () => {
  // upload all files in output folder to IPFS
  const entries = await readFilesFromDirectory(OUTPUT_PATH)
  for (const entry of entries) {
    if (entry.name === "images.zip") continue
    const file = await fs.readFile(OUTPUT_PATH + "/" + entry.name, "utf8")
    const [metadataIpfsUrl] = await uploadDirectoryToIPFS(OUTPUT_PATH + "/" + entry.name, OUTPUT_PATH)

    console.log("Metadata uploaded", JSON.parse(file).name, entry.name, metadataIpfsUrl)
  }
}

uploadToIpfs()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Unhandled error:", error)
    process.exit(1)
  })
