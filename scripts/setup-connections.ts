import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting up contract connections with:", deployer.address);

  const addrPath = path.join(__dirname, "../deployed-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addrPath, "utf8"));

  const { ReactiveAuction: auctionAddr, AuctionHandler: handlerAddr,
          AnalyticsEngine: analyticsAddr, PriceOracle: oracleAddr } = addresses;

  if (!auctionAddr || !handlerAddr) throw new Error("Missing core addresses. Run deploy scripts first.");

  // Connect contracts
  const auction   = await ethers.getContractAt("ReactiveAuction", auctionAddr);
  const handler   = await ethers.getContractAt("AuctionHandler",  handlerAddr);

  // 1. Set handler on auction contract
  console.log("1. Setting handler on ReactiveAuction...");
  await (await auction.setHandler(handlerAddr)).wait();
  console.log("   Done.");

  // 2. Set analytics + oracle on handler
  if (analyticsAddr) {
    console.log("2. Setting AnalyticsEngine on AuctionHandler...");
    await (await handler.setAnalyticsEngine(analyticsAddr)).wait();
    console.log("   Done.");
  }
  if (oracleAddr) {
    console.log("3. Setting PriceOracle on AuctionHandler...");
    await (await handler.setPriceOracle(oracleAddr)).wait();
    console.log("   Done.");
  }

  // 3. Set handler on AnalyticsEngine
  if (analyticsAddr) {
    console.log("4. Setting handler on AnalyticsEngine...");
    const analytics = await ethers.getContractAt("AnalyticsEngine", analyticsAddr);
    await (await analytics.setHandler(handlerAddr)).wait();
    console.log("   Done.");
  }

  // 4. Set handler on PriceOracle
  if (oracleAddr) {
    console.log("5. Setting handler on PriceOracle...");
    const oracle = await ethers.getContractAt("PriceOracle", oracleAddr);
    await (await oracle.setHandler(handlerAddr)).wait();
    console.log("   Done.");
  }

  console.log("\nAll connections established.");
}

main().catch((err) => { console.error(err); process.exit(1); });
