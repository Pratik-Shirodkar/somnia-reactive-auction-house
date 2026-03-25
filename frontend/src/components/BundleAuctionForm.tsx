import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Plus, Trash2, Clock } from 'lucide-react';
import type { WalletClient } from 'viem';
import { parseEther } from 'viem';
import { CONTRACTS, somniaTestnet } from '../config/chain';
import { AUCTION_ABI } from '../abi/auction';

interface BundleAuctionFormProps {
  walletClient: WalletClient | null;
  account: string;
  onSuccess: (auctionId: bigint) => void;
  onError: (message: string) => void;
}

interface BundleItem {
  tokenContract: string;
  tokenId: string;
  amount: string;
  tokenType: number; // 0=NATIVE, 1=ERC20, 2=ERC721
}

export function BundleAuctionForm({ walletClient, account, onSuccess, onError }: BundleAuctionFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [duration, setDuration] = useState('300'); // 5 minutes default
  const [items, setItems] = useState<BundleItem[]>([
    { tokenContract: '', tokenId: '0', amount: '1', tokenType: 2 } // Default: ERC721
  ]);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    setItems([...items, { tokenContract: '', tokenId: '0', amount: '1', tokenType: 2 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof BundleItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotalValue = () => {
    // Simple estimation - in production, would query token prices
    return startPrice ? parseFloat(startPrice) : 0;
  };

  const validateItems = () => {
    for (const item of items) {
      if (!item.tokenContract || !item.tokenContract.match(/^0x[a-fA-F0-9]{40}$/)) {
        return 'Invalid token contract address';
      }
      if (item.tokenType === 2 && (!item.tokenId || item.tokenId === '')) {
        return 'Token ID required for ERC721';
      }
      if (item.tokenType === 1 && (!item.amount || parseFloat(item.amount) <= 0)) {
        return 'Amount required for ERC20';
      }
    }
    return null;
  };

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

    const durationNum = parseInt(duration);
    if (durationNum < 60) {
      onError('Duration must be at least 60 seconds');
      return;
    }

    const itemsError = validateItems();
    if (itemsError) {
      onError(itemsError);
      return;
    }

    setLoading(true);
    try {
      // Convert items to contract format
      const bundleItems = items.map(item => ({
        tokenContract: item.tokenContract as `0x${string}`,
        tokenId: BigInt(item.tokenId || '0'),
        amount: BigInt(item.amount || '1'),
        tokenType: item.tokenType
      }));

      await walletClient.writeContract({
        account: account as `0x${string}`,
        address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'createBundleAuction',
        args: [
          parseEther(startPrice),
          BigInt(durationNum),
          bundleItems,
          title,
          description,
        ] as any,
        maxFeePerGas: parseEther('0.00000002'),
        maxPriorityFeePerGas: parseEther('0.00000001'),
        chain: somniaTestnet,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setStartPrice('');
      setDuration('300');
      setItems([{ tokenContract: '', tokenId: '0', amount: '1', tokenType: 2 }]);

      onSuccess(0n); // Auction ID will be determined from event
    } catch (e: any) {
      onError(e?.shortMessage || e?.message || 'Failed to create bundle auction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bundle-auction-form"
      onSubmit={handleSubmit}
    >
      <div className="form-header">
        <Package size={20} />
        <h3>Create Bundle Auction</h3>
      </div>
      
      <div className="form-description">
        <p>Bundle multiple NFTs and ERC20 tokens into a single auction with atomic settlement.</p>
      </div>

      <div className="form-group">
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter bundle title"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your bundle"
          rows={3}
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

      <div className="form-group">
        <label htmlFor="duration">
          <Clock size={14} /> Duration (seconds) *
        </label>
        <input
          id="duration"
          type="number"
          min="60"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          required
        />
        <small>{Math.floor(parseInt(duration || '0') / 60)} minutes</small>
      </div>

      <div className="bundle-items-section">
        <div className="section-header">
          <h4>Bundle Items ({items.length})</h4>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addItem}
          >
            <Plus size={16} /> Add Item
          </button>
        </div>

        {items.map((item, index) => (
          <div key={index} className="bundle-item">
            <div className="item-header">
              <span>Item {index + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => removeItem(index)}
                  title="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="form-group">
              <label>Token Type</label>
              <select
                value={item.tokenType}
                onChange={(e) => updateItem(index, 'tokenType', parseInt(e.target.value))}
              >
                <option value={2}>ERC721 (NFT)</option>
                <option value={1}>ERC20 (Token)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Token Contract Address *</label>
              <input
                type="text"
                value={item.tokenContract}
                onChange={(e) => updateItem(index, 'tokenContract', e.target.value)}
                placeholder="0x..."
                required
              />
            </div>

            {item.tokenType === 2 && (
              <div className="form-group">
                <label>Token ID *</label>
                <input
                  type="number"
                  value={item.tokenId}
                  onChange={(e) => updateItem(index, 'tokenId', e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
            )}

            {item.tokenType === 1 && (
              <div className="form-group">
                <label>Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.amount}
                  onChange={(e) => updateItem(index, 'amount', e.target.value)}
                  placeholder="1.0"
                  required
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bundle-summary">
        <div className="summary-row">
          <span>Total Items:</span>
          <strong>{items.length}</strong>
        </div>
        <div className="summary-row">
          <span>Estimated Value:</span>
          <strong>{calculateTotalValue().toFixed(2)} STT</strong>
        </div>
      </div>

      <div className="warning-box">
        <strong>⚠️ Important:</strong> Ensure you own all items and have approved this contract to transfer them.
        Bundle settlement is atomic - all items transfer together or not at all.
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading || !walletClient}
      >
        {loading ? 'Creating...' : 'Create Bundle Auction'}
      </button>
    </motion.form>
  );
}
