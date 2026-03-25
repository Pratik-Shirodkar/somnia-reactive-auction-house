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
  AUCTION_HOUSE: '0x136D7081b7A98996B841f6BD72093491ff8964Ae' as `0x${string}`,
  HANDLER: '0xdda32E6AEd981881C8c671e763Ff916C69d9600F' as `0x${string}`,
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
