import { motion } from 'framer-motion';
import { User, TrendingUp, Award, DollarSign, Calendar, Trophy } from 'lucide-react';

interface UserStats {
  auctionsWon: number;
  auctionsCreated: number;
  totalVolume: number;
}

interface ReputationHistory {
  timestamp: number;
  score: number;
  action: string;
}

interface Achievement {
  type: string;
  milestone: number;
  unlockedAt: number;
}

interface UserProfilePanelProps {
  address: string;
  stats: UserStats;
  reputationScore: number;
  trustScore: number;
  reputationHistory?: ReputationHistory[];
  achievements?: Achievement[];
}

export function UserProfilePanel({
  address,
  stats,
  reputationScore,
  reputationHistory = [],
  achievements = [],
}: UserProfilePanelProps) {
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatVolume = (volume: number) => {
    const eth = volume / 1e18;
    if (eth >= 1000) return `${(eth / 1000).toFixed(2)}K`;
    return eth.toFixed(2);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getTierName = (score: number) => {
    if (score >= 2001) return 'Platinum';
    if (score >= 501) return 'Gold';
    if (score >= 101) return 'Silver';
    return 'Bronze';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="user-profile-panel"
    >
      <div className="profile-header">
        <div className="profile-avatar">
          <User size={32} />
        </div>
        <div className="profile-info">
          <code className="profile-address">{formatAddress(address)}</code>
          <div className="profile-tier">{getTierName(reputationScore)} Tier</div>
        </div>
      </div>

      <div className="profile-stats">
        <motion.div
          className="stat-card"
          whileHover={{ scale: 1.02 }}
        >
          <div className="stat-icon">
            <Trophy size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Auctions Won</div>
            <div className="stat-value">{stats.auctionsWon}</div>
          </div>
        </motion.div>

        <motion.div
          className="stat-card"
          whileHover={{ scale: 1.02 }}
        >
          <div className="stat-icon">
            <Award size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Auctions Created</div>
            <div className="stat-value">{stats.auctionsCreated}</div>
          </div>
        </motion.div>

        <motion.div
          className="stat-card"
          whileHover={{ scale: 1.02 }}
        >
          <div className="stat-icon">
            <DollarSign size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Volume</div>
            <div className="stat-value">{formatVolume(stats.totalVolume)} STT</div>
          </div>
        </motion.div>

        <motion.div
          className="stat-card"
          whileHover={{ scale: 1.02 }}
        >
          <div className="stat-icon">
            <TrendingUp size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Reputation</div>
            <div className="stat-value">{reputationScore}</div>
          </div>
        </motion.div>
      </div>

      {reputationHistory.length > 0 && (
        <div className="reputation-history">
          <h4>
            <Calendar size={18} />
            Reputation History
          </h4>
          <div className="history-list">
            {reputationHistory.slice(0, 5).map((entry, index) => (
              <motion.div
                key={index}
                className="history-item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="history-date">{formatDate(entry.timestamp)}</div>
                <div className="history-action">{entry.action}</div>
                <div className="history-score">
                  {entry.score > 0 ? '+' : ''}{entry.score}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {achievements.length > 0 && (
        <div className="achievements-section">
          <h4>
            <Award size={18} />
            Unlocked Achievements
          </h4>
          <div className="achievements-grid">
            {achievements.map((achievement, index) => (
              <motion.div
                key={index}
                className="achievement-badge"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="achievement-icon">🏆</div>
                <div className="achievement-info">
                  <div className="achievement-type">{achievement.type}</div>
                  <div className="achievement-milestone">{achievement.milestone}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
