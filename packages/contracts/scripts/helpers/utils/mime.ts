import mimeTypes from "mime-types"

/**
 * Validates and returns the MIME type for a given filename
 * @param filename - The name of the file (e.g., 'image.png', 'data.json')
 * @returns The MIME type string
 * @throws Error if the file type is not supported
 */
export function getMimeType(filename: string): string {
  const mimeType = mimeTypes.lookup(filename)
  if (!mimeType) {
    throw new Error(`Unsupported file type: ${filename}. Please ensure the file has a valid extension.`)
  }
  return mimeType
}
