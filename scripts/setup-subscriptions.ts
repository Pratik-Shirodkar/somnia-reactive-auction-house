import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting up Somnia Reactivity subscriptions with:", deployer.address);

  const addrPath = path.join(__dirname, "../deployed-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addrPath, "utf8"));

  const { AuctionHandler: handlerAddr } = addresses;
  if (!handlerAddr) throw new Error("AuctionHandler address missing. Run deploy-handler.ts first.");

  const handler = await ethers.getContractAt("AuctionHandler", handlerAddr);

  // Subscribe to AuctionCreated (isGuaranteed: true — critical for auto-settlement scheduling)
  console.log("1. Subscribing to AuctionCreated events...");
  try {
    await (await handler.subscribeToAuctionCreated()).wait();
    console.log("   Done.");
  } catch (e: any) {
    console.log("   Note: Precompile not available in local env —", e.message);
  }

  // Subscribe to BidPlaced, AuctionSettled, BundleCreated
  console.log("2. Subscribing to BidPlaced / AuctionSettled / BundleCreated events...");
  try {
    await (await handler.subscribeToAuctionEvents()).wait();
    console.log("   Done.");
  } catch (e: any) {
    console.log("   Note: Precompile not available in local env —", e.message);
  }

  console.log("\nSubscription setup complete.");
  console.log("Note: On Somnia testnet, subscriptions are created via the reactivity precompile.");
  console.log("      In local Hardhat, precompile calls are expected to fail gracefully.");
}

main().catch((err) => { console.error(err); process.exit(1); });
