import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Clock, Eye } from 'lucide-react';
import type { WalletClient } from 'viem';
import { parseEther } from 'viem';
import { CONTRACTS, somniaTestnet } from '../config/chain';
import { AUCTION_ABI } from '../abi/auction';

interface SealedBidAuctionFormProps {
  walletClient: WalletClient | null;
  account: string;
  onSuccess: (auctionId: bigint) => void;
  onError: (message: string) => void;
}

export function SealedBidAuctionForm({ walletClient, account, onSuccess, onError }: SealedBidAuctionFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [biddingDuration, setBiddingDuration] = useState('300'); // 5 minutes default
  const [revealDuration, setRevealDuration] = useState('300'); // 5 minutes default
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!walletClient || !account) {
      onError('Wallet not connected');
      return;
    }

    if (!title.trim()) {
      onError('Title is required');
      return;
    }

    if (!startPrice || parseFloat(startPrice) <= 0) {
      onError('Valid start price is required');
      return;
    }

    const biddingDurationNum = parseInt(biddingDuration);
    const revealDurationNum = parseInt(revealDuration);

    if (biddingDurationNum < 60) {
      onError('Bidding duration must be at least 60 seconds');
      return;
    }

    if (revealDurationNum < 60) {
      onError('Reveal duration must be at least 60 seconds');
      return;
    }

    setLoading(true);
    try {
      await walletClient.writeContract({
        account: account as `0x${string}`,
        address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'createSealedBidAuction',
        args: [
          parseEther(startPrice),
          BigInt(biddingDurationNum),
          BigInt(revealDurationNum),
          title,
          description,
          imageUrl,
        ],
        maxFeePerGas: parseEther('0.00000002'),
        maxPriorityFeePerGas: parseEther('0.00000001'),
        chain: somniaTestnet,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setImageUrl('');
      setStartPrice('');
      setBiddingDuration('300');
      setRevealDuration('300');

      onSuccess(0n); // Auction ID will be determined from event
    } catch (e: any) {
      onError(e?.shortMessage || e?.message || 'Failed to create sealed-bid auction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sealed-auction-form"
      onSubmit={handleSubmit}
    >
      <div className="form-header">
        <Lock size={20} />
        <h3>Create Sealed-Bid Auction</h3>
      </div>
      
      <div className="form-description">
        <p>Sealed-bid auctions use cryptographic commitments to hide bid amounts until the reveal phase.</p>
      </div>

      <div className="form-group">
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter auction title"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your item"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label htmlFor="imageUrl">Image URL</label>
        <input
          id="imageUrl"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
        />
      </div>

      <div className="form-group">
        <label htmlFor="startPrice">Starting Price (STT) *</label>
        <input
          id="startPrice"
          type="number"
          step="0.01"
          min="0"
          value={startPrice}
          onChange={(e) => setStartPrice(e.target.value)}
          placeholder="1.0"
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="biddingDuration">
            <Clock size={14} /> Bidding Duration (seconds) *
          </label>
          <input
            id="biddingDuration"
            type="number"
            min="60"
            value={biddingDuration}
            onChange={(e) => setBiddingDuration(e.target.value)}
            required
          />
          <small>{Math.floor(parseInt(biddingDuration || '0') / 60)} minutes</small>
        </div>

        <div className="form-group">
          <label htmlFor="revealDuration">
            <Eye size={14} /> Reveal Duration (seconds) *
          </label>
          <input
            id="revealDuration"
            type="number"
            min="60"
            value={revealDuration}
            onChange={(e) => setRevealDuration(e.target.value)}
            required
          />
          <small>{Math.floor(parseInt(revealDuration || '0') / 60)} minutes</small>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading || !walletClient}
      >
        {loading ? 'Creating...' : 'Create Sealed-Bid Auction'}
      </button>
    </motion.form>
  );
}
