const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const RPC_URL = "https://dream-rpc.somnia.network/";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

async function main() {
  const auctionArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/ReactiveAuction.sol/ReactiveAuction.json'), 'utf8'));
  const handlerArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/AuctionHandler.sol/AuctionHandler.json'), 'utf8'));

  console.log("🚀 Deploying Auction...");
  const AF = new ethers.ContractFactory(auctionArtifact.abi, auctionArtifact.bytecode, wallet);
  const auction = await AF.deploy();
  await auction.deployed();
  console.log(`✅ Auction: ${auction.address}`);

  console.log("🚀 Deploying Handler...");
  const HF = new ethers.ContractFactory(handlerArtifact.abi, handlerArtifact.bytecode, wallet);
  const handler = await HF.deploy(auction.address);
  await handler.deployed();
  console.log(`✅ Handler: ${handler.address}`);

  fs.writeFileSync('deployed-addresses.json', JSON.stringify({ ReactiveAuction: auction.address, AuctionHandler: handler.address }, null, 2));
}
main().catch(console.error);
