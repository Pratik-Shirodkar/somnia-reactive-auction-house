import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // Deploy ReactiveAuction
  console.log("\n📦 Deploying ReactiveAuction...");
  const AuctionFactory = await ethers.getContractFactory("ReactiveAuction");
  const auction = await AuctionFactory.deploy();
  await auction.waitForDeployment();
  const auctionAddr = await auction.getAddress();
  console.log("✅ ReactiveAuction deployed at:", auctionAddr);

  // Deploy AuctionHandler
  console.log("\n📦 Deploying AuctionHandler...");
  const HandlerFactory = await ethers.getContractFactory("AuctionHandler");
  const handler = await HandlerFactory.deploy(auctionAddr);
  await handler.waitForDeployment();
  const handlerAddr = await handler.getAddress();
  console.log("✅ AuctionHandler deployed at:", handlerAddr);

  // Set handler in auction contract
  console.log("\n🔗 Setting handler in ReactiveAuction...");
  const setTx = await auction.setHandler(handlerAddr);
  await setTx.wait();
  console.log("✅ Handler set");

  // Fund handler with STT for subscriptions (need 32 STT minimum)
  console.log("\n💰 Funding handler with STT for subscriptions...");
  const fundTx = await deployer.sendTransaction({
    to: handlerAddr,
    value: ethers.parseEther("35"),
  });
  await fundTx.wait();
  console.log("✅ Handler funded with 35 STT");

  // Subscribe to AuctionCreated events
  console.log("\n📡 Creating Reactivity subscription for AuctionCreated events...");
  try {
    const subTx = await handler.subscribeToAuctionCreated();
    await subTx.wait();
    console.log("✅ Subscribed to AuctionCreated events");
  } catch (e: any) {
    console.log("⚠️ Subscription creation failed (may need manual setup):", e.message);
  }

  console.log("\n════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("════════════════════════════════════════");
  console.log(`  ReactiveAuction:  ${auctionAddr}`);
  console.log(`  AuctionHandler:   ${handlerAddr}`);
  console.log(`  Network:          Somnia Testnet (Chain ID 50312)`);
  console.log(`  Explorer:         https://shannon-explorer.somnia.network/`);
  console.log("════════════════════════════════════════");

  // Write addresses to a file for the frontend
  const fs = require("fs");
  const addresses = {
    ReactiveAuction: auctionAddr,
    AuctionHandler: handlerAddr,
    chainId: 50312,
    rpc: "https://dream-rpc.somnia.network/",
    explorer: "https://shannon-explorer.somnia.network/",
    deployedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("\n📄 Addresses saved to deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
