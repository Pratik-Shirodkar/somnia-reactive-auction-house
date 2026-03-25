import { useState } from 'react';
import { BundleAuctionForm } from './BundleAuctionForm';
import type { WalletClient } from 'viem';

interface BundleAuctionExampleProps {
  walletClient: WalletClient | null;
  account: string;
}

/**
 * Example usage of BundleAuctionForm component
 * 
 * This component demonstrates how to integrate the BundleAuctionForm
 * into your application with proper error handling and success callbacks.
 */
export function BundleAuctionExample({ walletClient, account }: BundleAuctionExampleProps) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSuccess = (auctionId: bigint) => {
    setMessage({
      type: 'success',
      text: `Bundle auction created successfully! Auction ID: ${auctionId.toString()}`
    });
    
    // Clear message after 5 seconds
    setTimeout(() => setMessage(null), 5000);
  };

  const handleError = (errorMessage: string) => {
    setMessage({
      type: 'error',
      text: errorMessage
    });
    
    // Clear message after 5 seconds
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="bundle-auction-example">
      {message && (
        <div className={`toast ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <BundleAuctionForm
        walletClient={walletClient}
        account={account}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </div>
  );
}
