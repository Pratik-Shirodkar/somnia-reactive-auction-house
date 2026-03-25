import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Activity, CheckCircle, Users, DollarSign, Clock } from 'lucide-react';

interface PlatformMetrics {
  totalVolume: bigint;
  totalAuctions: bigint;
  activeAuctions: bigint;
  settledAuctions: bigint;
  averageSettlementPrice: bigint;
  averageDuration: bigint;
  totalBids: bigint;
  uniqueBidders: bigint;
}

interface PlatformMetricsCardProps {
  metrics?: PlatformMetrics;
  wsConnected?: boolean;
}

export function PlatformMetricsCard({ metrics, wsConnected = false }: PlatformMetricsCardProps) {
  const [displayMetrics, setDisplayMetrics] = useState<PlatformMetrics>({
    totalVolume: 0n,
    totalAuctions: 0n,
    activeAuctions: 0n,
    settledAuctions: 0n,
    averageSettlementPrice: 0n,
    averageDuration: 0n,
    totalBids: 0n,
    uniqueBidders: 0n,
  });

  useEffect(() => {
    if (metrics) {
      setDisplayMetrics(metrics);
    }
  }, [metrics]);

  const formatVolume = (volume: bigint) => {
    const eth = Number(volume) / 1e18;
    if (eth >= 1000) return `${(eth / 1000).toFixed(2)}K`;
    return eth.toFixed(2);
  };

  const formatDuration = (seconds: bigint) => {
    const s = Number(seconds);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="platform-metrics-card"
    >
      <div className="metrics-header">
        <div className="header-title">
          <TrendingUp size={20} />
          <h3>Platform Metrics</h3>
        </div>
        {wsConnected && (
          <div className="live-indicator">
            <div className="live-dot" />
            <span>Live</span>
          </div>
        )}
      </div>

      <div className="metrics-grid">
        <motion.div
          className="metric-item"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <DollarSign size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Total Volume</div>
            <div className="metric-value">{formatVolume(displayMetrics.totalVolume)} STT</div>
          </div>
        </motion.div>

        <motion.div
          className="metric-item"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <Activity size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Active Auctions</div>
            <div className="metric-value">{displayMetrics.activeAuctions.toString()}</div>
          </div>
        </motion.div>

        <motion.div
          className="metric-item"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <CheckCircle size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Settled Auctions</div>
            <div className="metric-value">{displayMetrics.settledAuctions.toString()}</div>
          </div>
        </motion.div>

        <motion.div
          className="metric-item"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <DollarSign size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Avg Settlement Price</div>
            <div className="metric-value">{formatVolume(displayMetrics.averageSettlementPrice)} STT</div>
          </div>
        </motion.div>

        <motion.div
          className="metric-item"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <Clock size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Avg Duration</div>
            <div className="metric-value">{formatDuration(displayMetrics.averageDuration)}</div>
          </div>
        </motion.div>

        <motion.div
          className="metric-item"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <Users size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Unique Bidders</div>
            <div className="metric-value">{displayMetrics.uniqueBidders.toString()}</div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
