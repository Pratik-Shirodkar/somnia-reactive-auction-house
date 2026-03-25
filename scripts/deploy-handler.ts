import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AuctionHandler with:", deployer.address);

  const addrPath = path.join(__dirname, "../deployed-addresses.json");
  if (!fs.existsSync(addrPath)) throw new Error("Run deploy-core.ts first");
  const addresses = JSON.parse(fs.readFileSync(addrPath, "utf8"));

  if (!addresses.ReactiveAuction) throw new Error("ReactiveAuction address missing");

  console.log("Using ReactiveAuction:", addresses.ReactiveAuction);

  const AuctionHandler = await ethers.getContractFactory("AuctionHandler");
  const handler = await AuctionHandler.deploy(addresses.ReactiveAuction);
  await handler.waitForDeployment();
  const handlerAddr = await handler.getAddress();
  console.log("AuctionHandler:", handlerAddr);

  addresses.AuctionHandler = handlerAddr;
  fs.writeFileSync(addrPath, JSON.stringify(addresses, null, 2));
  console.log("Address saved to deployed-addresses.json");
}

main().catch((err) => { console.error(err); process.exit(1); });
