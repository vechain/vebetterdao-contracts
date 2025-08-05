import path from "path"

type ImageData = {
  levelName: string
  levelAttributes: Record<string, number>
}

export const METADATA_PATH = path.join(__dirname, "../../../metadata/galaxyMember/metadata")
export const IMAGE_PATH = path.join(__dirname, "../../../metadata/galaxyMember/images")

export const description =
  "Galaxy Member is a membership NFT to the VeBetterDAO ecosystem. It grants you access to exclusive features and benefits."

export const GM_IMAGES_DATA: ImageData[] = [
  {
    levelName: "Earth",
    levelAttributes: {
      Level: 1,
    },
  },
  {
    levelName: "Moon",
    levelAttributes: {
      Level: 2,
    },
  },
  {
    levelName: "Mercury",
    levelAttributes: {
      Level: 3,
    },
  },
  {
    levelName: "Venus",
    levelAttributes: {
      Level: 4,
    },
  },
  {
    levelName: "Mars",
    levelAttributes: {
      Level: 5,
    },
  },
  {
    levelName: "Jupiter",
    levelAttributes: {
      Level: 6,
    },
  },
  {
    levelName: "Saturn",
    levelAttributes: {
      Level: 7,
    },
  },
]
