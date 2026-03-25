const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "STT");

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

  const setTx = await auction.setHandler(handlerAddr);
  await setTx.wait();
  console.log("Handler linked");

  const remaining = await ethers.provider.getBalance(deployer.address);
  const reserve = ethers.parseEther("1");
  if (remaining > reserve) {
    const fundAmount = (remaining - reserve) / 4n;
    if (fundAmount > 0n) {
      try {
        const fundTx = await deployer.sendTransaction({
          to: handlerAddr,
          value: fundAmount,
        });
        await fundTx.wait();
        console.log("Handler funded with", ethers.formatEther(fundAmount), "STT");
      } catch (e) {
        console.log("Handler funding skipped:", e?.message || e);
      }
    }
  }

  try {
    const subTx = await handler.subscribeToAuctionCreated();
    await subTx.wait();
    console.log("Subscribed to AuctionCreated events");
  } catch (e) {
    console.log("Subscription setup skipped:", e?.message || e);
  }

  const addresses = {
    ReactiveAuction: auctionAddr,
    AuctionHandler: handlerAddr,
    chainId: 50312,
    rpc: "https://dream-rpc.somnia.network/",
    explorer: "https://shannon-explorer.somnia.network/",
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("Addresses saved to deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
