import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying core contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // 1. Deploy ReactiveAuction
  console.log("\n1. Deploying ReactiveAuction...");
  const ReactiveAuction = await ethers.getContractFactory("ReactiveAuction");
  const auction = await ReactiveAuction.deploy();
  await auction.waitForDeployment();
  const auctionAddr = await auction.getAddress();
  console.log("   ReactiveAuction:", auctionAddr);

  // 2. Deploy PriceOracle
  console.log("2. Deploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const oracle = await PriceOracle.deploy(auctionAddr);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("   PriceOracle:", oracleAddr);

  // 3. Deploy AnalyticsEngine
  console.log("3. Deploying AnalyticsEngine...");
  const AnalyticsEngine = await ethers.getContractFactory("AnalyticsEngine");
  const analytics = await AnalyticsEngine.deploy();
  await analytics.waitForDeployment();
  const analyticsAddr = await analytics.getAddress();
  console.log("   AnalyticsEngine:", analyticsAddr);

  // Save addresses
  const addresses = {
    ReactiveAuction: auctionAddr,
    PriceOracle: oracleAddr,
    AnalyticsEngine: analyticsAddr,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  const outPath = path.join(__dirname, "../deployed-addresses.json");
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(outPath)) {
    existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
  }
  fs.writeFileSync(outPath, JSON.stringify({ ...existing, ...addresses }, null, 2));
  console.log("\nAddresses saved to deployed-addresses.json");
}

main().catch((err) => { console.error(err); process.exit(1); });
