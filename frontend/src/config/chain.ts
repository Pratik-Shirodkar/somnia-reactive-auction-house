import { createPublicClient, createWalletClient, custom, http, defineChain } from 'viem';

export const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network/'] },
  },
  blockExplorers: {
    default: { name: 'Shannon Explorer', url: 'https://shannon-explorer.somnia.network/' },
  },
  testnet: true,
});

// Contract addresses — update after deployment
export const CONTRACTS = {
  ReactiveAuction: '0x0000000000000000000000000000000000000000', // UPDATE AFTER DEPLOY
  AuctionHandler: '0x0000000000000000000000000000000000000000',  // UPDATE AFTER DEPLOY
};

export function getPublicClient() {
  return createPublicClient({
    chain: somniaTestnet,
    transport: http(),
  });
}

export async function getWalletClient() {
  if (!window.ethereum) throw new Error('MetaMask not found');
  
  // Request accounts
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  
  // Switch to Somnia Testnet
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xC488' }], // 50312 in hex
    });
  } catch (e: any) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xC488',
          chainName: 'Somnia Shannon Testnet',
          nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
          rpcUrls: ['https://dream-rpc.somnia.network/'],
          blockExplorerUrls: ['https://shannon-explorer.somnia.network/'],
        }],
      });
    }
  }

  return createWalletClient({
    chain: somniaTestnet,
    transport: custom(window.ethereum),
  });
}
