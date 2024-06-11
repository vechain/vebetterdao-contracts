import fs from "fs/promises"
import path from "path"

/**
 * Reads files from a directory and returns an array of `File` objects.
 *
 * @param dirPath - The path to the directory to read.
 * @returns A promise that resolves to an array of `File` objects.
 *
 * @throws An error if the directory does not exist.
 */
async function readFilesFromDirectory(dirPath: string): Promise<File[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files: File[] = []

  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = path.join(dirPath, entry.name)
      const content = await fs.readFile(filePath)
      const mimeType = "image/png" // TODO: Get the MIME type from the file
      const file: File = new File([content], entry.name, { type: mimeType })
      files.push(file)
    }
  }

  return files
}

export { readFilesFromDirectory }
