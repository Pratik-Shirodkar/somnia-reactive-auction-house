import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, Key, AlertCircle } from 'lucide-react';
import type { WalletClient } from 'viem';
import { parseEther, toHex } from 'viem';
import { CONTRACTS, somniaTestnet } from '../config/chain';
import { AUCTION_ABI } from '../abi/auction';

interface RevealBidFormProps {
  auctionId: bigint;
  walletClient: WalletClient | null;
  account: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

interface StoredCommitment {
  amount: string;
  secret: string;
  commitment: string;
  timestamp: number;
}

function normalizeSecretToBytes32(secret: string): `0x${string}` {
  const trimmed = secret.trim();
  if (trimmed.startsWith('0x') && trimmed.length === 66) {
    return trimmed as `0x${string}`;
  }
  return toHex(trimmed || 'somnia-reactive-secret', { size: 32 });
}

export function RevealBidForm({ auctionId, walletClient, account, onSuccess, onError }: RevealBidFormProps) {
  const [amount, setAmount] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storedData, setStoredData] = useState<StoredCommitment | null>(null);
  const [useStored, setUseStored] = useState(true);

  useEffect(() => {
    if (!account) return;

    const storageKey = `sealed:${auctionId.toString()}:${account.toLowerCase()}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const data: StoredCommitment = JSON.parse(stored);
        setStoredData(data);
        if (useStored) {
          setAmount(data.amount);
          setSecret(data.secret);
        }
      } catch (e) {
        console.error('Failed to parse stored commitment:', e);
      }
    }
  }, [auctionId, account, useStored]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!walletClient || !account) {
      onError('Wallet not connected');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      onError('Valid bid amount is required');
      return;
    }

    if (!secret.trim()) {
      onError('Secret is required');
      return;
    }

    setLoading(true);
    try {
      const amountUnits = parseEther(amount);
      const secretBytes32 = normalizeSecretToBytes32(secret);

      await walletClient.writeContract({
        account: account as `0x${string}`,
        address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'revealBid',
        args: [auctionId, amountUnits, secretBytes32],
        value: amountUnits,
        maxFeePerGas: parseEther('0.00000002'),
        maxPriorityFeePerGas: parseEther('0.00000001'),
        chain: somniaTestnet,
      });

      // Clear stored commitment after successful reveal
      const storageKey = `sealed:${auctionId.toString()}:${account.toLowerCase()}`;
      localStorage.removeItem(storageKey);

      onSuccess();
    } catch (e: any) {
      onError(e?.shortMessage || e?.message || 'Failed to reveal bid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="reveal-bid-form"
      onSubmit={handleSubmit}
    >
      <div className="form-header">
        <Eye size={20} />
        <h3>Reveal Sealed Bid</h3>
      </div>

      <div className="form-description">
        <p>Reveal your bid by providing the same amount and secret you used during commitment.</p>
      </div>

      {storedData && (
        <div className="info-box">
          <AlertCircle size={16} />
          <div>
            <strong>Stored Commitment Found</strong>
            <p>We found your commitment from {new Date(storedData.timestamp).toLocaleString()}</p>
            <label>
              <input
                type="checkbox"
                checked={useStored}
                onChange={(e) => setUseStored(e.target.checked)}
              />
              Use stored values
            </label>
          </div>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="amount">Bid Amount (STT) *</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1.0"
          required
          disabled={useStored && !!storedData}
        />
        {useStored && storedData && (
          <small>Using stored amount: {storedData.amount} STT</small>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="secret">
          <Key size={14} /> Secret *
        </label>
        <div className="input-with-button">
          <input
            id="secret"
            type={showSecret ? 'text' : 'password'}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter your secret"
            required
            disabled={useStored && !!storedData}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? 'Hide' : 'Show'}
          </button>
        </div>
        {useStored && storedData && (
          <small>Using stored secret</small>
        )}
      </div>

      {!storedData && (
        <div className="warning-box">
          <strong>⚠️ No Stored Commitment:</strong> Make sure you enter the exact amount and secret
          you used when committing your bid, or the reveal will fail.
        </div>
      )}

      <div className="info-box">
        <AlertCircle size={16} />
        <div>
          <strong>Payment Required:</strong> You must send {amount || '0'} STT with this transaction
          to complete the reveal.
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading || !walletClient}
      >
        {loading ? 'Revealing...' : `Reveal Bid (${amount || '0'} STT)`}
      </button>
    </motion.form>
  );
}
