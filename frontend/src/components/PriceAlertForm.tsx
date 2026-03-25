import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import type { WalletClient } from 'viem';
import { parseEther } from 'viem';
import { CONTRACTS, somniaTestnet } from '../config/chain';
import { AUCTION_ABI } from '../abi/auction';

interface PriceAlertFormProps {
  walletClient: WalletClient | null;
  account: string;
  auctionId: bigint;
  onSuccess: () => void;
  onError: (message: string) => void;
}

interface PriceAlert {
  user: string;
  auctionId: bigint;
  targetPrice: bigint;
  triggered: boolean;
}

export function PriceAlertForm({ walletClient, account, auctionId, onSuccess, onError }: PriceAlertFormProps) {
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  useEffect(() => {
    loadAlerts();
  }, [auctionId, account]);

  const loadAlerts = async () => {
    setAlerts((prev) => prev.filter((alert) => !alert.triggered));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!walletClient || !account) {
      onError('Wallet not connected');
      return;
    }

    if (!targetPrice || parseFloat(targetPrice) <= 0) {
      onError('Valid target price is required');
      return;
    }

    setLoading(true);
    try {
      await walletClient.writeContract({
        account: account as `0x${string}`,
        address: CONTRACTS.AUCTION_HOUSE,
        abi: AUCTION_ABI,
        functionName: 'createPriceAlert',
        args: [auctionId, parseEther(targetPrice)],
        chain: somniaTestnet,
      });

      setAlerts((prev) => [
        {
          user: account,
          auctionId,
          targetPrice: parseEther(targetPrice),
          triggered: false,
        },
        ...prev,
      ]);

      setTargetPrice('');
      onSuccess();
    } catch (e: any) {
      onError(e?.shortMessage || e?.message || 'Failed to create price alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="price-alert-form"
    >
      <div className="form-header">
        <Bell size={20} />
        <h3>Price Alerts</h3>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="targetPrice">Target Price (STT)</label>
          <input
            id="targetPrice"
            type="number"
            step="0.01"
            min="0"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="1.0"
            required
          />
          <small>Get notified when the price reaches this value</small>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !walletClient}
        >
          {loading ? 'Creating...' : 'Create Alert'}
        </button>
      </form>

      {alerts.length > 0 && (
        <div className="active-alerts">
          <h4>Active Alerts</h4>
          <div className="alerts-list">
            {alerts.map((alert, index) => (
              <div key={index} className="alert-item">
                <Bell size={14} />
                <span>{(Number(alert.targetPrice) / 1e18).toFixed(2)} STT</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
