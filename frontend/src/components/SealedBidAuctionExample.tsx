/**
 * Example usage of Sealed-Bid Auction UI Components
 * 
 * This file demonstrates how to integrate the sealed-bid auction components
 * into your application. The components work together to provide a complete
 * sealed-bid auction workflow:
 * 
 * 1. SealedBidAuctionForm - Create a new sealed-bid auction
 * 2. PhaseIndicator - Display current auction phase and countdown
 * 3. CommitBidForm - Submit a cryptographic commitment during bidding phase
 * 4. RevealBidForm - Reveal the bid during reveal phase
 */

import { useState } from 'react';
import type { WalletClient } from 'viem';
import { SealedBidAuctionForm } from './SealedBidAuctionForm';
import { CommitBidForm } from './CommitBidForm';
import { RevealBidForm } from './RevealBidForm';
import { PhaseIndicator } from './PhaseIndicator';

interface AuctionData {
  id: bigint;
  auctionType: number;
  phase: number;
  endTime: bigint;
  revealDeadline: bigint;
}

interface SealedBidAuctionExampleProps {
  walletClient: WalletClient | null;
  account: string;
}

export function SealedBidAuctionExample({ 
  walletClient, 
  account 
}: SealedBidAuctionExampleProps) {
  const [selectedAuction] = useState<AuctionData | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCommitForm, setShowCommitForm] = useState(false);
  const [showRevealForm, setShowRevealForm] = useState(false);

  const handleAuctionCreated = (auctionId: bigint) => {
    console.log('Auction created:', auctionId);
    setShowCreateForm(false);
    // Refresh auction list or navigate to auction detail
  };

  const handleCommitSuccess = () => {
    console.log('Bid committed successfully');
    setShowCommitForm(false);
    // Refresh auction data
  };

  const handleRevealSuccess = () => {
    console.log('Bid revealed successfully');
    setShowRevealForm(false);
    // Refresh auction data
  };

  const handleError = (message: string) => {
    console.error('Error:', message);
    // Show toast notification
  };

  return (
    <div className="sealed-bid-auction-example">
      {/* Create Auction Button */}
      <button 
        className="btn btn-primary"
        onClick={() => setShowCreateForm(true)}
      >
        Create Sealed-Bid Auction
      </button>

      {/* Create Auction Form */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <SealedBidAuctionForm
              walletClient={walletClient}
              account={account}
              onSuccess={handleAuctionCreated}
              onError={handleError}
            />
          </div>
        </div>
      )}

      {/* Auction Detail View (when an auction is selected) */}
      {selectedAuction && (
        <div className="auction-detail">
          {/* Phase Indicator */}
          <PhaseIndicator
            phase={selectedAuction.phase}
            endTime={selectedAuction.endTime}
            revealDeadline={selectedAuction.revealDeadline}
            auctionType={selectedAuction.auctionType}
          />

          {/* Action Buttons based on phase */}
          {selectedAuction.phase === 0 && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowCommitForm(true)}
            >
              Commit Bid
            </button>
          )}

          {selectedAuction.phase === 1 && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowRevealForm(true)}
            >
              Reveal Bid
            </button>
          )}

          {/* Commit Bid Form */}
          {showCommitForm && (
            <div className="modal-overlay" onClick={() => setShowCommitForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <CommitBidForm
                  auctionId={selectedAuction.id}
                  walletClient={walletClient}
                  account={account}
                  onSuccess={handleCommitSuccess}
                  onError={handleError}
                />
              </div>
            </div>
          )}

          {/* Reveal Bid Form */}
          {showRevealForm && (
            <div className="modal-overlay" onClick={() => setShowRevealForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <RevealBidForm
                  auctionId={selectedAuction.id}
                  walletClient={walletClient}
                  account={account}
                  onSuccess={handleRevealSuccess}
                  onError={handleError}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Integration Notes:
 * 
 * 1. The PhaseIndicator should be displayed prominently on the auction detail page
 *    for sealed-bid auctions (auctionType === 2)
 * 
 * 2. Show CommitBidForm when phase === 0 (BIDDING)
 *    - Users can commit multiple times, but only the last commitment counts
 *    - The form automatically stores the commitment details in localStorage
 * 
 * 3. Show RevealBidForm when phase === 1 (REVEAL)
 *    - The form automatically loads stored commitment details
 *    - Users must send the bid amount as payment with the reveal transaction
 * 
 * 4. All forms handle their own loading states and error handling
 *    - Pass onSuccess and onError callbacks to handle results
 * 
 * 5. The components use the existing design system from index.css
 *    - They integrate seamlessly with the existing UI
 * 
 * 6. LocalStorage keys format: `sealed:${auctionId}:${userAddress}`
 *    - Automatically cleaned up after successful reveal
 *    - Users can manually clear if needed
 */
