const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const RPC_URL = "https://dream-rpc.somnia.network/";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

async function main() {
  const addresses = JSON.parse(fs.readFileSync('deployed-addresses.json', 'utf8'));
  const auctionArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/ReactiveAuction.sol/ReactiveAuction.json'), 'utf8'));
  const handlerArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/AuctionHandler.sol/AuctionHandler.json'), 'utf8'));

  const auction = new ethers.Contract(addresses.ReactiveAuction, auctionArtifact.abi, wallet);
  const handler = new ethers.Contract(addresses.AuctionHandler, handlerArtifact.abi, wallet);

  console.log("🔗 Linking handler (skipping if done)...");
  try {
    const tx1 = await auction.setHandler(handler.address);
    console.log("Waiting for link tx...");
    await tx1.wait();
  } catch (e) {
    console.log("Link failed or already done:", e.message || e);
  }

  console.log("💰 Funding handler (skipping if enough balance)...");
  const balance = await provider.getBalance(handler.address);
  if (balance.lt(ethers.utils.parseEther("30"))) {
    const tx2 = await wallet.sendTransaction({ to: handler.address, value: ethers.utils.parseEther('35') });
    await tx2.wait();
    console.log("Funded.");
  } else {
    console.log("Already funded.");
  }

  console.log("📡 Subscribing...");
  try {
    const tx3 = await handler.subscribeToAuctionCreated({ gasLimit: 1000000 });
    console.log("Waiting for subscription tx...");
    await tx3.wait();
    console.log("✅ DONE");
  } catch (e) {
    console.log("Subscription failed:", e.message || e);
  }
}
main().catch(console.error);
