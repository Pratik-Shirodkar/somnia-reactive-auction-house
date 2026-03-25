import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Award, ChevronLeft, ChevronRight } from 'lucide-react';

interface LeaderboardEntry {
  user: string;
  totalVolume: bigint;
  auctionsWon: bigint;
  reputation: bigint;
}

interface LeaderboardTableProps {
  entries?: LeaderboardEntry[];
  wsConnected?: boolean;
  pageSize?: number;
}

export function LeaderboardTable({ entries = [], wsConnected = false, pageSize = 10 }: LeaderboardTableProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [displayEntries, setDisplayEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (entries.length > 0) {
      setDisplayEntries(entries);
    }
  }, [entries]);

  const totalPages = Math.ceil(displayEntries.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, displayEntries.length);
  const currentEntries = displayEntries.slice(startIndex, endIndex);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatVolume = (volume: bigint) => {
    const eth = Number(volume) / 1e18;
    if (eth >= 1000) return `${(eth / 1000).toFixed(2)}K`;
    return eth.toFixed(2);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy size={18} color="#fbbf24" />;
      case 2:
        return <Medal size={18} color="#9ca3af" />;
      case 3:
        return <Award size={18} color="#cd7f32" />;
      default:
        return null;
    }
  };

  const getReputationBadge = (reputation: bigint) => {
    const rep = Number(reputation);
    if (rep >= 1000) return { label: 'Elite', color: '#8b5cf6' };
    if (rep >= 500) return { label: 'Expert', color: '#3b82f6' };
    if (rep >= 100) return { label: 'Pro', color: '#10b981' };
    return { label: 'Novice', color: '#6b7280' };
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="leaderboard-table"
    >
      <div className="leaderboard-header">
        <div className="header-title">
          <Trophy size={20} />
          <h3>Top Bidders</h3>
        </div>
        {wsConnected && (
          <div className="live-indicator">
            <div className="live-dot" />
            <span>Live</span>
          </div>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Address</th>
              <th>Total Volume</th>
              <th>Auctions Won</th>
              <th>Reputation</th>
            </tr>
          </thead>
          <tbody>
            {currentEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  No leaderboard data available
                </td>
              </tr>
            ) : (
              currentEntries.map((entry, index) => {
                const rank = startIndex + index + 1;
                const badge = getReputationBadge(entry.reputation);
                return (
                  <motion.tr
                    key={entry.user}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <td>
                      <div className="rank-cell">
                        {getRankIcon(rank)}
                        <span className="rank-number">{rank}</span>
                      </div>
                    </td>
                    <td>
                      <code className="address-cell">{formatAddress(entry.user)}</code>
                    </td>
                    <td>
                      <strong>{formatVolume(entry.totalVolume)} STT</strong>
                    </td>
                    <td>{entry.auctionsWon.toString()}</td>
                    <td>
                      <div className="reputation-cell">
                        <span
                          className="reputation-badge"
                          style={{ backgroundColor: badge.color }}
                        >
                          {badge.label}
                        </span>
                        <span className="reputation-score">{entry.reputation.toString()}</span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={handlePrevPage}
            disabled={currentPage === 0}
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <span className="pagination-info">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            className="pagination-btn"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
