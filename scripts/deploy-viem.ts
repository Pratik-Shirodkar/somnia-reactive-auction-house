import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther, 
  defineChain,
  encodeFunctionData,
  decodeEventLog,
  getContractAddress,
  keccak256
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network/'] } },
});

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env");

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: somniaTestnet, transport: http() });
const walletClient = createWalletClient({ chain: somniaTestnet, account, transport: http() });

async function deploy() {
  console.log(`Deploying with: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${Number(balance) / 1e18} STT`);

  const auctionArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/ReactiveAuction.sol/ReactiveAuction.json'), 'utf8'));
  const handlerArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/AuctionHandler.sol/AuctionHandler.json'), 'utf8'));

  // 1. Deploy Auction
  console.log("Deploying ReactiveAuction...");
  const hash1 = await walletClient.deployContract({
    abi: auctionArtifact.abi,
    bytecode: auctionArtifact.bytecode,
  });
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
  const auctionAddr = receipt1.contractAddress!;
  console.log(`✅ ReactiveAuction: ${auctionAddr}`);

  // 2. Deploy Handler
  console.log("Deploying AuctionHandler...");
  const hash2 = await walletClient.deployContract({
    abi: handlerArtifact.abi,
    bytecode: handlerArtifact.bytecode,
    args: [auctionAddr],
  });
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
  const handlerAddr = receipt2.contractAddress!;
  console.log(`✅ AuctionHandler: ${handlerAddr}`);

  // 3. Set Handler
  console.log("Setting handler in auction...");
  const hash3 = await walletClient.writeContract({
    address: auctionAddr,
    abi: auctionArtifact.abi,
    functionName: 'setHandler',
    args: [handlerAddr],
  });
  await publicClient.waitForTransactionReceipt({ hash: hash3 });

  // 4. Fund Handler
  console.log("Funding handler with 35 STT...");
  const hash4 = await walletClient.sendTransaction({
    to: handlerAddr,
    value: parseEther('35'),
  });
  await publicClient.waitForTransactionReceipt({ hash: hash4 });

  // 5. Subscribe
  console.log("Creating subscription...");
  const hash5 = await walletClient.writeContract({
    address: handlerAddr,
    abi: handlerArtifact.abi,
    functionName: 'subscribeToAuctionCreated',
  });
  await publicClient.waitForTransactionReceipt({ hash: hash5 });

  const addresses = { ReactiveAuction: auctionAddr, AuctionHandler: handlerAddr };
  fs.writeFileSync('deployed-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("DONE");
}

deploy().catch(console.error);
