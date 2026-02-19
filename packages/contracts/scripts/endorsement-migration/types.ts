export interface EndorsementSnapshot {
  appId: string
  appName?: string
  nodeId: string
  currentPoints?: number
  points: number
}

export interface AppInfo {
  appId: string
  appName: string
}

export interface MigrationData {
  network: string
  fetchedAt: string
  blockNumber: number
  x2EarnAppsAddress: string
  endorsements: EndorsementSnapshot[]
  allApps?: AppInfo[]
}
