import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, ChevronDown, ChevronUp } from 'lucide-react';
import { formatEther, type PublicClient } from 'viem';
import { CONTRACTS } from '../config/chain';

// Local ABI for getBidHistory (not in main auction.ts ABI file)
const BID_HISTORY_ABI = [
  {
    type: 'function',
    name: 'getBidHistory',
    inputs: [{ name: '_auctionId', type: 'uint256' }],
    outputs: [{
      type: 'tuple[]',
      components: [
        { name: 'bidder', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' },
      ],
    }],
    stateMutability: 'view',
  },
] as const;

interface BidEntry {
  bidder: string;
  amount: bigint;
  timestamp: bigint;
}

interface BidHistoryPanelProps {
  auctionId: bigint;
  publicClient: PublicClient | null;
}

export function BidHistoryPanel({ auctionId, publicClient }: BidHistoryPanelProps) {
  const [bids, setBids] = useState<BidEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  const loadBidHistory = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    setError('');
    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
        abi: BID_HISTORY_ABI,
        functionName: 'getBidHistory',
        args: [auctionId],
      }) as unknown as BidEntry[];
      setBids(result);
    } catch {
      setError('Unable to fetch bid history');
      setBids([]);
    }
    setLoading(false);
  }, [publicClient, auctionId]);

  useEffect(() => {
    if (expanded) {
      loadBidHistory();
    }
  }, [expanded, loadBidHistory]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatTime = (ts: bigint) => {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bid-history-panel">
      <button
        className="bid-history-toggle"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="bid-history-toggle-left">
          <History size={14} />
          <span>Bid History</span>
          {bids.length > 0 && <span className="bid-count-badge">{bids.length}</span>}
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="bid-history-content">
              {loading ? (
                <div className="bid-history-skeleton">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-row">
                      <div className="skeleton-block skeleton-addr" />
                      <div className="skeleton-block skeleton-amount" />
                      <div className="skeleton-block skeleton-time" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="bid-history-empty">{error}</div>
              ) : bids.length === 0 ? (
                <div className="bid-history-empty">No bids placed yet</div>
              ) : (
                <div className="bid-history-list">
                  {bids.map((bid, idx) => (
                    <motion.div
                      key={`${bid.bidder}-${bid.timestamp}-${idx}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bid-history-row"
                    >
                      <code className="bid-addr">{formatAddress(bid.bidder)}</code>
                      <span className="bid-amount">{formatEther(bid.amount)} STT</span>
                      <span className="bid-time">{formatTime(bid.timestamp)}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
