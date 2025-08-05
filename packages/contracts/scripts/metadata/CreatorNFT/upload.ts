import { uploadMetadataToIpfs } from "../../helpers/uploadFolderToIpfs"
import path from "path"

const METADATA_PATH = path.join(__dirname, "../../../metadata/creatorNFT/metadata")

uploadMetadataToIpfs(METADATA_PATH)
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Unhandled error:", error)
    process.exit(1)
  })
