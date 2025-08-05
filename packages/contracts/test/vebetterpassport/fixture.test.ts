import { ethers } from "hardhat"
import { BytesLike } from "ethers"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { VeBetterPassport } from "../../typechain-types"
import { getOrDeployContractInstances } from "../helpers"
import { endorseApp } from "../helpers/xnodes"

interface SignalingFixture {
  veBetterPassport: VeBetterPassport
  owner: SignerWithAddress
  otherAccounts: SignerWithAddress[]
  x2EarnApps: any
  appId: BytesLike
  appAdmin: SignerWithAddress
  regularSignaler: SignerWithAddress
}

export async function setupSignalingFixture(): Promise<SignalingFixture> {
  const contracts = await getOrDeployContractInstances({
    forceDeploy: true,
  })
  const veBetterPassport = contracts.veBetterPassport
  const owner = contracts.owner
  const otherAccounts = contracts.otherAccounts
  const x2EarnApps = contracts.x2EarnApps

  // Create an app
  const appAdmin = otherAccounts[0]
  await x2EarnApps.connect(owner).submitApp(otherAccounts[0].address, appAdmin, otherAccounts[0].address, "metadataURI")
  const appId = ethers.keccak256(ethers.toUtf8Bytes(otherAccounts[0].address))
  await endorseApp(appId, otherAccounts[0])

  // Setup signalers
  const regularSignaler = otherAccounts[1]
  await veBetterPassport.connect(appAdmin).assignSignalerToAppByAppAdmin(appId, regularSignaler.address)
  await veBetterPassport.connect(owner).grantRole(await veBetterPassport.SIGNALER_ROLE(), owner.address)

  // Setup for registering actions
  await veBetterPassport.connect(owner).grantRole(await veBetterPassport.ACTION_REGISTRAR_ROLE(), owner.address)
  await veBetterPassport.connect(owner).setAppSecurity(appId, 1) // Set security to LOW

  return {
    veBetterPassport,
    owner,
    otherAccounts,
    x2EarnApps,
    appId,
    appAdmin,
    regularSignaler,
  }
}
