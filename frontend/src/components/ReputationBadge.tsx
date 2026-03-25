import { motion } from 'framer-motion';
import { Award, Shield, TrendingUp, Percent } from 'lucide-react';

interface ReputationBadgeProps {
  score: number;
  trustScore: number;
  auctionsWon?: number;
  totalVolume?: number;
}

type ReputationTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

interface TierInfo {
  name: ReputationTier;
  color: string;
  gradient: string;
  feeDiscount: number;
}

const getTierInfo = (score: number): TierInfo => {
  if (score >= 2001) {
    return {
      name: 'Platinum',
      color: '#e5e7eb',
      gradient: 'linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)',
      feeDiscount: 0.5,
    };
  }
  if (score >= 501) {
    return {
      name: 'Gold',
      color: '#fbbf24',
      gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      feeDiscount: 1.0,
    };
  }
  if (score >= 101) {
    return {
      name: 'Silver',
      color: '#9ca3af',
      gradient: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
      feeDiscount: 1.5,
    };
  }
  return {
    name: 'Bronze',
    color: '#cd7f32',
    gradient: 'linear-gradient(135deg, #cd7f32 0%, #a0522d 100%)',
    feeDiscount: 2.0,
  };
};

export function ReputationBadge({ score, trustScore, auctionsWon = 0, totalVolume = 0 }: ReputationBadgeProps) {
  const tier = getTierInfo(score);

  const formatVolume = (volume: number) => {
    const eth = volume / 1e18;
    if (eth >= 1000) return `${(eth / 1000).toFixed(2)}K`;
    return eth.toFixed(2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="reputation-badge-container"
    >
      <div className="reputation-badge-header">
        <div className="tier-badge" style={{ background: tier.gradient }}>
          <Award size={20} />
          <span className="tier-name">{tier.name}</span>
        </div>
        <div className="reputation-score">
          <TrendingUp size={16} />
          <span>{score}</span>
        </div>
      </div>

      <div className="reputation-stats">
        <div className="stat-item">
          <div className="stat-icon">
            <Shield size={16} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Trust Score</div>
            <div className="stat-value">{trustScore}/100</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">
            <Percent size={16} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Fee Discount</div>
            <div className="stat-value">{tier.feeDiscount}%</div>
          </div>
        </div>
      </div>

      {(auctionsWon > 0 || totalVolume > 0) && (
        <div className="reputation-details">
          <div className="detail-item">
            <span className="detail-label">Auctions Won:</span>
            <span className="detail-value">{auctionsWon}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total Volume:</span>
            <span className="detail-value">{formatVolume(totalVolume)} STT</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
