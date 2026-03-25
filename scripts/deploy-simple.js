const { createPublicClient, createWalletClient, http, parseEther, defineChain } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network/'] } },
});

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: somniaTestnet, transport: http() });
const walletClient = createWalletClient({ chain: somniaTestnet, account, transport: http() });

async function deploy() {
  const auctionArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/ReactiveAuction.sol/ReactiveAuction.json'), 'utf8'));
  const handlerArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/AuctionHandler.sol/AuctionHandler.json'), 'utf8'));

  console.log("Deploying ReactiveAuction...");
  const hash1 = await walletClient.deployContract({ abi: auctionArtifact.abi, bytecode: auctionArtifact.bytecode });
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
  const auctionAddr = receipt1.contractAddress;
  console.log("✅ Auction:", auctionAddr);

  console.log("Deploying AuctionHandler...");
  const hash2 = await walletClient.deployContract({ abi: handlerArtifact.abi, bytecode: handlerArtifact.bytecode, args: [auctionAddr] });
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
  const handlerAddr = receipt2.contractAddress;
  console.log("✅ Handler:", handlerAddr);

  console.log("Finalizing...");
  await walletClient.writeContract({ address: auctionAddr, abi: auctionArtifact.abi, functionName: 'setHandler', args: [handlerAddr] });
  await walletClient.sendTransaction({ to: handlerAddr, value: parseEther('35') });
  await walletClient.writeContract({ address: handlerAddr, abi: handlerArtifact.abi, functionName: 'subscribeToAuctionCreated' });

  fs.writeFileSync('deployed-addresses.json', JSON.stringify({ ReactiveAuction: auctionAddr, AuctionHandler: handlerAddr }, null, 2));
  console.log("DONE");
}

deploy().catch(console.error);
