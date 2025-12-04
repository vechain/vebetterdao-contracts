import { ethers } from "hardhat"

export const deployLegacyNodesMock = async ({ logOutput = false }) => {
  const deployer = (await ethers.getSigners())[0]

  logOutput && console.log("Deploying Mock Legacy Nodes Contracts")
  logOutput && console.log("-".repeat(40))

  logOutput && console.log("Deploying TokenAuction mock...")
  const TokenAuctionFactory = await ethers.getContractFactory("TokenAuction")
  const vechainNodesMock = await TokenAuctionFactory.deploy()
  await vechainNodesMock.waitForDeployment()

  const vechainNodesMockAddress = await vechainNodesMock.getAddress()
  logOutput && console.log(`TokenAuction deployed: ${vechainNodesMockAddress}`)

  logOutput && console.log("Deploying ClockAuction mock...")
  const ClockAuctionFactory = await ethers.getContractFactory("ClockAuction")
  const clockAuctionMock = await ClockAuctionFactory.deploy(vechainNodesMockAddress, deployer.address)
  await clockAuctionMock.waitForDeployment()

  const clockAuctionMockAddress = await clockAuctionMock.getAddress()
  logOutput && console.log(`ClockAuction deployed: ${clockAuctionMockAddress}`)

  logOutput && console.log("Configuring TokenAuction mock...")
  await vechainNodesMock.setSaleAuctionAddress(clockAuctionMockAddress)
  await vechainNodesMock.addOperator(deployer.address)

  return {
    vechainNodesMock,
    clockAuctionMock,
  }
}
