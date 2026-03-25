import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import type { WalletClient } from 'viem';
import { CONTRACTS, getPublicClient, somniaTestnet } from '../config/chain';
import { AUCTION_ABI } from '../abi/auction';

interface WatchlistButtonProps {
  walletClient: WalletClient | null;
  account: string;
  auctionId: bigint;
  onError: (message: string) => void;
}

export function WatchlistButton({ walletClient, account, auctionId, onError }: WatchlistButtonProps) {
  const [isWatching, setIsWatching] = useState(false);
  const [watcherCount, setWatcherCount] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadWatchlistData = useCallback(async () => {
    const publicClient = getPublicClient();
    if (!publicClient || !account) return;

    try {
      // Get watcher count for this auction
      const count = await publicClient.readContract({
        address: CONTRACTS.AUCTION_HOUSE,
        abi: AUCTION_ABI,
        functionName: 'auctionWatcherCount',
        args: [auctionId],
      }) as bigint;
      setWatcherCount(Number(count));

      // Get user's watchlist
      const watchlist = await publicClient.readContract({
        address: CONTRACTS.AUCTION_HOUSE,
        abi: AUCTION_ABI,
        functionName: 'getUserWatchlist',
        args: [account as `0x${string}`],
      }) as bigint[];
      
      setWatchlistCount(watchlist.length);
      setIsWatching(watchlist.some(id => id === auctionId));
    } catch (e) {
      console.error('Failed to load watchlist data:', e);
    }
  }, [account, auctionId]);

  useEffect(() => {
    loadWatchlistData();
  }, [loadWatchlistData]);

  const toggleWatchlist = async () => {
    if (!walletClient || !account) {
      onError('Wallet not connected');
      return;
    }

    if (!isWatching && watchlistCount >= 50) {
      onError('Watchlist limit reached (50 auctions)');
      return;
    }

    setLoading(true);
    try {
      const functionName = isWatching ? 'removeFromWatchlist' : 'addToWatchlist';
      
      await walletClient.writeContract({
        account: account as `0x${string}`,
        address: CONTRACTS.AUCTION_HOUSE,
        abi: AUCTION_ABI,
        functionName,
        args: [auctionId],
        chain: somniaTestnet,
      });

      setIsWatching(!isWatching);
      setWatcherCount(prev => isWatching ? prev - 1 : prev + 1);
      setWatchlistCount(prev => isWatching ? prev - 1 : prev + 1);
    } catch (e: any) {
      onError(e?.shortMessage || e?.message || 'Failed to update watchlist');
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = !isWatching && watchlistCount >= 50;

  return (
    <motion.button
      whileHover={{ scale: isDisabled ? 1 : 1.05 }}
      whileTap={{ scale: isDisabled ? 1 : 0.95 }}
      onClick={toggleWatchlist}
      disabled={loading || !walletClient || isDisabled}
      className={`watchlist-btn ${isWatching ? 'watching' : ''} ${isDisabled ? 'disabled' : ''}`}
      title={isDisabled ? 'Watchlist limit reached (50)' : isWatching ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      {isWatching ? <Eye size={16} /> : <EyeOff size={16} />}
      <span>{watcherCount}</span>
    </motion.button>
  );
}
