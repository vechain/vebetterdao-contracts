import fs from "fs"
import path from "path"
import FormData from "form-data"
import archiver from "archiver"

/**
 * Reads files from a directory and returns an array of `File` objects.
 *
 * @param dirPath - The path to the directory to read.
 * @returns A promise that resolves to an array of `File` objects.
 *
 * @throws An error if the directory does not exist.
 */
async function readFilesFromDirectory(dirPath: string): Promise<File[]> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  const files: File[] = []

  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = path.join(dirPath, entry.name)
      const content = await fs.promises.readFile(filePath)
      const mimeType = "image/png" // TODO: Get the MIME type from the file
      const file: File = new File([content], entry.name, { type: mimeType })
      files.push(file)
    }
  }

  return files
}

function formData(path: string): FormData {
  // Create a form data instance
  const form = new FormData()
  form.append("file", fs.createReadStream(path))
  return form
}

function getFolderName(folderPath: string): string {
  return path.basename(folderPath)
}

function copyImages(srcFolder: string, destFolder: string): string {
  // Ensure the destination folder exists
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true })
  }

  // Read all files in the source folder
  const files = fs.readdirSync(srcFolder)

  // Copy each image file from the source folder to the destination folder
  files.forEach(file => {
    const srcFilePath = path.join(srcFolder, file)
    const destFilePath = path.join(destFolder, file)

    // Check if the file is an image (you can extend this to check for specific image types)
    if (file.match(/\.(jpg|jpeg|png|gif)$/i)) {
      fs.copyFileSync(srcFilePath, destFilePath)
    }
  })

  return destFolder
}

async function zipFolder(sourceDir: string, outPath: fs.PathLike): Promise<void> {
  // Ensure that the stream truncates (overwrites) the file if it already exists
  const stream = fs.createWriteStream(outPath, { flags: "w" })

  const archive = archiver("zip", { zlib: { level: 9 } })

  return new Promise<void>((resolve, reject) => {
    archive
      .directory(sourceDir, path.basename(sourceDir)) // Keeps the root folder
      .on("error", (err: any) => reject(err))
      .pipe(stream)

    stream.on("close", () => resolve())

    archive.finalize()
  })
}

/**
 * Save the deployed contracts addresses to a file.
 * @param contracts - The deployed contracts
 * @param libraries - The deployed libraries
 */
async function saveContractsToFile(
  contracts: Record<string, string>,
  libraries: {
    B3TRGovernor: Record<string, string>
  },
): Promise<void> {
  const OUTPUT_PATH = path.join(__dirname, `../../deploy_output`)

  // Reset the output directory
  if (fs.existsSync(OUTPUT_PATH)) {
    fs.rmSync(OUTPUT_PATH, { recursive: true })
  }
  // Ensure the output directory exists
  fs.mkdirSync(OUTPUT_PATH)

  await fs.promises.writeFile(`${OUTPUT_PATH}/contracts.txt`, JSON.stringify(contracts, null, 2))
  await fs.promises.writeFile(`${OUTPUT_PATH}/libraries.txt`, JSON.stringify(libraries, null, 2))
  console.log(`Contracts and libraries addresses saved to ${OUTPUT_PATH}`)
}

/**
 * Save new libraries deployed to a file
 * @param contracts - The deployed contracts
 * @param libraries - The deployed libraries
 */
async function saveLibrariesToFile(libraries: { B3TRGovernor: Record<string, string> }): Promise<void> {
  const OUTPUT_PATH = path.join(__dirname, `../../deploy_output`)
  const LIBRARY_FILE_PATH = path.join(OUTPUT_PATH, "libraries.txt")

  // Ensure the output directory exists
  if (!fs.existsSync(OUTPUT_PATH)) {
    fs.mkdirSync(OUTPUT_PATH)
  }

  // Remove the existing libraries file if it exists
  if (fs.existsSync(LIBRARY_FILE_PATH)) {
    fs.unlinkSync(LIBRARY_FILE_PATH)
  }

  // Write the new libraries file
  await fs.promises.writeFile(LIBRARY_FILE_PATH, JSON.stringify(libraries, null, 2))
  console.log(`Libraries addresses saved to ${LIBRARY_FILE_PATH}`)
}

export {
  readFilesFromDirectory,
  formData,
  getFolderName,
  zipFolder,
  copyImages,
  saveContractsToFile,
  saveLibrariesToFile,
}
