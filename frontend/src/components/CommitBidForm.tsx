import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Key, Hash } from 'lucide-react';
import type { WalletClient } from 'viem';
import { parseEther, keccak256, encodePacked, toHex } from 'viem';
import { CONTRACTS, somniaTestnet } from '../config/chain';
import { AUCTION_ABI } from '../abi/auction';

interface CommitBidFormProps {
  auctionId: bigint;
  walletClient: WalletClient | null;
  account: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

function normalizeSecretToBytes32(secret: string): `0x${string}` {
  const trimmed = secret.trim();
  if (trimmed.startsWith('0x') && trimmed.length === 66) {
    return trimmed as `0x${string}`;
  }
  return toHex(trimmed || 'somnia-reactive-secret', { size: 32 });
}

export function CommitBidForm({ auctionId, walletClient, account, onSuccess, onError }: CommitBidFormProps) {
  const [amount, setAmount] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [commitment, setCommitment] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateSecret = () => {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const hexSecret = '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    setSecret(hexSecret);
    calculateCommitment(amount, hexSecret);
  };

  const calculateCommitment = (bidAmount: string, bidSecret: string) => {
    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      setCommitment('');
      return;
    }

    try {
      const amountUnits = parseEther(bidAmount);
      const secretBytes32 = normalizeSecretToBytes32(bidSecret);
      const hash = keccak256(encodePacked(['uint256', 'bytes32'], [amountUnits, secretBytes32]));
      setCommitment(hash);
    } catch (e) {
      setCommitment('');
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (secret) {
      calculateCommitment(value, secret);
    }
  };

  const handleSecretChange = (value: string) => {
    setSecret(value);
    if (amount) {
      calculateCommitment(amount, value);
    }
  };

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

    if (!commitment) {
      onError('Commitment hash could not be calculated');
      return;
    }

    setLoading(true);
    try {
      await walletClient.writeContract({
        account: account as `0x${string}`,
        address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'commitBid',
        args: [auctionId, commitment as `0x${string}`],
        maxFeePerGas: parseEther('0.00000002'),
        maxPriorityFeePerGas: parseEther('0.00000001'),
        chain: somniaTestnet,
      });

      // Store commitment details in localStorage for reveal phase
      const storageKey = `sealed:${auctionId.toString()}:${account.toLowerCase()}`;
      localStorage.setItem(storageKey, JSON.stringify({
        amount,
        secret: normalizeSecretToBytes32(secret),
        commitment,
        timestamp: Date.now(),
      }));

      onSuccess();
    } catch (e: any) {
      onError(e?.shortMessage || e?.message || 'Failed to commit bid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="commit-bid-form"
      onSubmit={handleSubmit}
    >
      <div className="form-header">
        <Lock size={20} />
        <h3>Commit Sealed Bid</h3>
      </div>

      <div className="form-description">
        <p>Your bid amount will be hidden until the reveal phase. Keep your secret safe!</p>
      </div>

      <div className="form-group">
        <label htmlFor="amount">Bid Amount (STT) *</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="1.0"
          required
        />
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
            onChange={(e) => handleSecretChange(e.target.value)}
            placeholder="Enter or generate a secret"
            required
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? 'Hide' : 'Show'}
          </button>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={generateSecret}
          style={{ marginTop: '0.5rem' }}
        >
          Generate Random Secret
        </button>
      </div>

      {commitment && (
        <div className="commitment-display">
          <label>
            <Hash size={14} /> Commitment Hash
          </label>
          <div className="commitment-hash">
            {commitment}
          </div>
          <small>This hash will be submitted on-chain</small>
        </div>
      )}

      <div className="warning-box">
        <strong>⚠️ Important:</strong> Save your secret! You'll need it to reveal your bid later.
        Your bid details are stored locally in your browser.
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading || !walletClient || !commitment}
      >
        {loading ? 'Committing...' : 'Commit Bid'}
      </button>
    </motion.form>
  );
}
