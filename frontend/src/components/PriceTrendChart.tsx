import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PriceTrendChartProps {
  prices: bigint[];
  timestamps: bigint[];
}

export function PriceTrendChart({ prices, timestamps: _timestamps }: PriceTrendChartProps) {
  const chartData = useMemo(() => {
    if (prices.length === 0) return null;

    const priceNumbers = prices.map((p) => Number(p) / 1e18);
    const maxPrice = Math.max(...priceNumbers);
    const minPrice = Math.min(...priceNumbers);
    const priceRange = maxPrice - minPrice || 1;

    // Calculate moving average (window of 5)
    const movingAverage: number[] = [];
    for (let i = 0; i < priceNumbers.length; i++) {
      const start = Math.max(0, i - 4);
      const window = priceNumbers.slice(start, i + 1);
      const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
      movingAverage.push(avg);
    }

    // Calculate trend direction
    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (priceNumbers.length >= 2) {
      const recent = priceNumbers.slice(-3);
      const avg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
      const first = priceNumbers[0];
      const diff = ((avg - first) / first) * 100;
      if (diff > 5) trend = 'up';
      else if (diff < -5) trend = 'down';
    }

    // Generate SVG path for line chart
    const width = 100;
    const height = 60;
    const points = priceNumbers.map((price, index) => {
      const x = (index / (priceNumbers.length - 1 || 1)) * width;
      const y = height - ((price - minPrice) / priceRange) * height;
      return { x, y, price };
    });

    const maPoints = movingAverage.map((price, index) => {
      const x = (index / (movingAverage.length - 1 || 1)) * width;
      const y = height - ((price - minPrice) / priceRange) * height;
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const maPath = maPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return {
      points,
      maPoints,
      linePath,
      maPath,
      maxPrice,
      minPrice,
      trend,
      latestPrice: priceNumbers[priceNumbers.length - 1],
      latestMA: movingAverage[movingAverage.length - 1],
    };
  }, [prices]);

  if (!chartData || prices.length === 0) {
    return (
      <div className="price-trend-chart empty">
        <div className="empty-state">
          <TrendingUp size={24} />
          <p>No price data available</p>
        </div>
      </div>
    );
  }

  const getTrendIcon = () => {
    switch (chartData.trend) {
      case 'up':
        return <TrendingUp size={18} color="#10b981" />;
      case 'down':
        return <TrendingDown size={18} color="#ef4444" />;
      default:
        return <Minus size={18} color="#6b7280" />;
    }
  };

  const getTrendColor = () => {
    switch (chartData.trend) {
      case 'up':
        return '#10b981';
      case 'down':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getTrendLabel = () => {
    switch (chartData.trend) {
      case 'up':
        return 'Trending Up';
      case 'down':
        return 'Trending Down';
      default:
        return 'Stable';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="price-trend-chart"
    >
      <div className="chart-header">
        <h4>Price Trend</h4>
        <div className="trend-indicator" style={{ color: getTrendColor() }}>
          {getTrendIcon()}
          <span>{getTrendLabel()}</span>
        </div>
      </div>

      <div className="chart-container">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="chart-svg">
          {/* Grid lines */}
          <line x1="0" y1="15" x2="100" y2="15" stroke="#e5e7eb" strokeWidth="0.2" />
          <line x1="0" y1="30" x2="100" y2="30" stroke="#e5e7eb" strokeWidth="0.2" />
          <line x1="0" y1="45" x2="100" y2="45" stroke="#e5e7eb" strokeWidth="0.2" />

          {/* Moving average line */}
          <motion.path
            d={chartData.maPath}
            fill="none"
            stroke="#9ca3af"
            strokeWidth="0.5"
            strokeDasharray="2,2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
          />

          {/* Price line */}
          <motion.path
            d={chartData.linePath}
            fill="none"
            stroke={getTrendColor()}
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeInOut', delay: 0.2 }}
          />

          {/* Data points */}
          {chartData.points.map((point, index) => (
            <motion.circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="1"
              fill={getTrendColor()}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + index * 0.05 }}
            />
          ))}
        </svg>
      </div>

      <div className="chart-legend">
        <div className="legend-item">
          <div className="legend-line" style={{ backgroundColor: getTrendColor() }} />
          <span>Price: {chartData.latestPrice.toFixed(4)} STT</span>
        </div>
        <div className="legend-item">
          <div className="legend-line dashed" style={{ backgroundColor: '#9ca3af' }} />
          <span>MA: {chartData.latestMA.toFixed(4)} STT</span>
        </div>
      </div>

      <div className="chart-stats">
        <div className="stat">
          <span className="stat-label">High</span>
          <span className="stat-value">{chartData.maxPrice.toFixed(4)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Low</span>
          <span className="stat-value">{chartData.minPrice.toFixed(4)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Data Points</span>
          <span className="stat-value">{prices.length}</span>
        </div>
      </div>
    </motion.div>
  );
}
