import { motion } from 'framer-motion';
import { Activity, Users, Zap, TrendingUp, Eye } from 'lucide-react';
import { PriceTrendChart } from './PriceTrendChart';

interface AuctionMetrics {
  auctionId: bigint;
  bidCount: bigint;
  uniqueBidders: bigint;
  bidVelocity: bigint;
  priceVolatility: bigint;
  watcherCount: bigint;
  lastBidTimestamp: bigint;
  timeToFirstBid: bigint;
  averageTimeBetweenBids: bigint;
}

interface AuctionMetricsPanelProps {
  metrics?: AuctionMetrics;
  prices?: bigint[];
  timestamps?: bigint[];
}

export function AuctionMetricsPanel({ metrics, prices = [], timestamps = [] }: AuctionMetricsPanelProps) {
  const formatVelocity = (velocity: bigint) => {
    // Velocity is scaled by 1000 (bids per hour × 1000)
    const bidsPerHour = Number(velocity) / 1000;
    return bidsPerHour.toFixed(1);
  };

  const formatTime = (seconds: bigint) => {
    const s = Number(seconds);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
  };

  const defaultMetrics: AuctionMetrics = {
    auctionId: 0n,
    bidCount: 0n,
    uniqueBidders: 0n,
    bidVelocity: 0n,
    priceVolatility: 0n,
    watcherCount: 0n,
    lastBidTimestamp: 0n,
    timeToFirstBid: 0n,
    averageTimeBetweenBids: 0n,
  };

  const displayMetrics = metrics || defaultMetrics;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="auction-metrics-panel"
    >
      <div className="metrics-header">
        <Activity size={20} />
        <h3>Auction Analytics</h3>
      </div>

      <div className="metrics-grid">
        <motion.div
          className="metric-card"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <Activity size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Bid Count</div>
            <div className="metric-value">{displayMetrics.bidCount.toString()}</div>
          </div>
        </motion.div>

        <motion.div
          className="metric-card"
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

        <motion.div
          className="metric-card"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <Zap size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Bid Velocity</div>
            <div className="metric-value">{formatVelocity(displayMetrics.bidVelocity)} /hr</div>
          </div>
        </motion.div>

        <motion.div
          className="metric-card"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <TrendingUp size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Price Volatility</div>
            <div className="metric-value">{displayMetrics.priceVolatility.toString()}</div>
          </div>
        </motion.div>

        <motion.div
          className="metric-card"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <Eye size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Watchers</div>
            <div className="metric-value">{displayMetrics.watcherCount.toString()}</div>
          </div>
        </motion.div>

        <motion.div
          className="metric-card"
          whileHover={{ scale: 1.02 }}
        >
          <div className="metric-icon">
            <Activity size={18} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Avg Time Between Bids</div>
            <div className="metric-value">{formatTime(displayMetrics.averageTimeBetweenBids)}</div>
          </div>
        </motion.div>
      </div>

      {prices.length > 0 && (
        <div className="price-trend-section">
          <PriceTrendChart prices={prices} timestamps={timestamps} />
        </div>
      )}
    </motion.div>
  );
}
