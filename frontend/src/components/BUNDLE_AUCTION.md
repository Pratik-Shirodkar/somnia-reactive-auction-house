# Bundle Auction Component

## Overview

The `BundleAuctionForm` component allows users to create bundle auctions on the ReactiveAuction contract. Bundle auctions enable selling multiple items (NFTs and ERC20 tokens) together in a single auction with atomic settlement.

## Features

- ✅ Add multiple bundle items (ERC721 NFTs and ERC20 tokens)
- ✅ Validate token contract addresses
- ✅ Configure token type, token ID (for NFTs), and amount (for ERC20s)
- ✅ Display total bundle value estimation
- ✅ Form validation for ownership and approvals
- ✅ Submit transaction to createBundleAuction
- ✅ Responsive design with glassmorphism UI

## Usage

```tsx
import { BundleAuctionForm } from './components';
import type { WalletClient } from 'viem';

function MyComponent() {
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [account, setAccount] = useState('');

  const handleSuccess = (auctionId: bigint) => {
    console.log('Bundle auction created:', auctionId);
  };

  const handleError = (message: string) => {
    console.error('Error:', message);
  };

  return (
    <BundleAuctionForm
      walletClient={walletClient}
      account={account}
      onSuccess={handleSuccess}
      onError={handleError}
    />
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `walletClient` | `WalletClient \| null` | Viem wallet client for transaction signing |
| `account` | `string` | Connected wallet address |
| `onSuccess` | `(auctionId: bigint) => void` | Callback when auction is created successfully |
| `onError` | `(message: string) => void` | Callback when an error occurs |

## Bundle Item Structure

Each bundle item has the following properties:

```typescript
interface BundleItem {
  tokenContract: string;  // Token contract address (0x...)
  tokenId: string;        // Token ID (for ERC721), "0" for ERC20
  amount: string;         // Amount (for ERC20), "1" for ERC721
  tokenType: number;      // 0=NATIVE, 1=ERC20, 2=ERC721
}
```

## Form Fields

### Required Fields
- **Title**: Bundle auction title
- **Starting Price**: Minimum bid price in STT
- **Duration**: Auction duration in seconds (minimum 60)
- **Bundle Items**: At least one item required

### Bundle Item Fields
- **Token Type**: ERC721 (NFT) or ERC20 (Token)
- **Token Contract Address**: Valid Ethereum address (0x...)
- **Token ID**: Required for ERC721 tokens
- **Amount**: Required for ERC20 tokens

## Validation

The component validates:
- ✅ Title is not empty
- ✅ Start price is greater than 0
- ✅ Duration is at least 60 seconds
- ✅ Token contract addresses are valid (0x + 40 hex characters)
- ✅ Token ID is provided for ERC721 tokens
- ✅ Amount is provided and > 0 for ERC20 tokens

## Important Notes

### Ownership & Approvals
Before creating a bundle auction, users must:
1. Own all the items in the bundle
2. Approve the ReactiveAuction contract to transfer each item
3. For ERC721: `setApprovalForAll(auctionContract, true)` or `approve(auctionContract, tokenId)`
4. For ERC20: `approve(auctionContract, amount)`

### Atomic Settlement
Bundle auctions use atomic settlement - all items transfer together or not at all. If any item transfer fails, the entire auction settlement fails.

## Contract Integration

The component calls the `createBundleAuction` function on the ReactiveAuction contract:

```solidity
function createBundleAuction(
    uint256 _startPrice,
    uint256 _duration,
    BundleItem[] calldata _items,
    string calldata _title,
    string calldata _description
) external returns (uint256)
```

## Example

See `BundleAuctionExample.tsx` for a complete integration example.

## Styling

The component uses the global CSS classes defined in `index.css`:
- `.bundle-auction-form`
- `.bundle-items-section`
- `.bundle-item`
- `.bundle-summary`

## Requirements Satisfied

This component satisfies the following requirements from the spec:
- **Requirement 3.1**: Bundle auction creation with multiple items
- **Requirement 3.7**: UI for adding NFTs and ERC20 tokens to bundles
