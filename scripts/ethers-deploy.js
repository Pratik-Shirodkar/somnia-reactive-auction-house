const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const RPC_URL = "https://dream-rpc.somnia.network/";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("PRIVATE_KEY missing in .env");
  process.exit(1);
}

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

async function deploy() {
  console.log(`Deploying with: ${wallet.address}`);
  const balance = await wallet.getBalance();
  console.log(`Balance: ${ethers.utils.formatEther(balance)} STT`);

  const auctionArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/ReactiveAuction.sol/ReactiveAuction.json'), 'utf8'));
  const handlerArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/AuctionHandler.sol/AuctionHandler.json'), 'utf8'));

  // 1. Deploy Auction
  console.log("Deploying ReactiveAuction...");
  const AuctionFactory = new ethers.ContractFactory(auctionArtifact.abi, auctionArtifact.bytecode, wallet);
  const auction = await AuctionFactory.deploy();
  console.log("Waiting for auction deployment...");
  await auction.deployed();
  console.log(`✅ ReactiveAuction: ${auction.address}`);

  // 2. Deploy Handler
  console.log("Deploying AuctionHandler...");
  const HandlerFactory = new ethers.ContractFactory(handlerArtifact.abi, handlerArtifact.bytecode, wallet);
  const handler = await HandlerFactory.deploy(auction.address);
  console.log("Waiting for handler deployment...");
  await handler.deployed();
  console.log(`✅ AuctionHandler: ${handler.address}`);

  // 3. Set Handler
  console.log("Setting handler in auction...");
  const tx1 = await auction.setHandler(handler.address);
  await tx1.wait();

  // 4. Fund Handler
  console.log("Funding handler with 35 STT...");
  const tx2 = await wallet.sendTransaction({
    to: handler.address,
    value: ethers.utils.parseEther('35'),
  });
  await tx2.wait();

  // 5. Subscribe
  console.log("Creating subscription...");
  const tx3 = await handler.subscribeToAuctionCreated();
  await tx3.wait();

  const addresses = { ReactiveAuction: auction.address, AuctionHandler: handler.address };
  fs.writeFileSync('deployed-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("DONE ALL OPERATIONS");
}

deploy().catch(console.error);
