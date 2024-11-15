export type DeployUpgradeOptions = {
  libraries?: ({ [libraryName: string]: string } | undefined)[]
  versions?: (number | undefined)[]
  logOutput?: boolean
}
