import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying locally with account:", deployer.address);

  const AuctionFactory = await ethers.getContractFactory("ReactiveAuction");
  const auction = await AuctionFactory.deploy();
  await auction.waitForDeployment();
  const auctionAddr = await auction.getAddress();
  console.log("ReactiveAuction:", auctionAddr);

  const HandlerFactory = await ethers.getContractFactory("AuctionHandler");
  const handler = await HandlerFactory.deploy(auctionAddr);
  await handler.waitForDeployment();
  const handlerAddr = await handler.getAddress();
  console.log("AuctionHandler:", handlerAddr);

  const setHandlerTx = await auction.setHandler(handlerAddr);
  await setHandlerTx.wait();
  console.log("Handler linked in ReactiveAuction");

  const addresses = {
    ReactiveAuction: auctionAddr,
    AuctionHandler: handlerAddr,
    chainId: 31337,
    rpc: "http://127.0.0.1:8545",
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync("deployed-addresses.local.json", JSON.stringify(addresses, null, 2));
  console.log("Local addresses saved to deployed-addresses.local.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
