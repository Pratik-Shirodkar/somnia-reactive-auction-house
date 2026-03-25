import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, RefreshCw } from 'lucide-react';

interface PriceDisplayProps {
  priceInSTT: number;
  originalCurrency?: string;
  originalAmount?: number;
  showUSD?: boolean;
  usdRate?: number; // STT to USD rate
  updateInterval?: number; // milliseconds
  onRateUpdate?: () => void;
}

export function PriceDisplay({
  priceInSTT,
  originalCurrency = 'STT',
  originalAmount,
  showUSD = true,
  usdRate = 0.5, // Default: 1 STT = 0.5 USD
  updateInterval = 10000,
  onRateUpdate,
}: PriceDisplayProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    if (updateInterval > 0) {
      const interval = setInterval(() => {
        setIsUpdating(true);
        setLastUpdate(Date.now());
        onRateUpdate?.();
        setTimeout(() => setIsUpdating(false), 500);
      }, updateInterval);

      return () => clearInterval(interval);
    }
  }, [updateInterval, onRateUpdate]);

  const formatPrice = (price: number) => {
    if (price >= 1000) return `${(price / 1000).toFixed(2)}K`;
    return price.toFixed(4);
  };

  const calculateUSD = () => {
    return (priceInSTT * usdRate).toFixed(2);
  };

  const getTimeSinceUpdate = () => {
    const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <motion.div
      className="price-display"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="price-header">
        <div className="price-label">
          <TrendingUp size={16} />
          <span>Current Price</span>
        </div>
        <motion.div
          className="update-indicator"
          animate={{ rotate: isUpdating ? 360 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <RefreshCw size={14} />
          <span className="update-time">{getTimeSinceUpdate()}</span>
        </motion.div>
      </div>

      <div className="price-values">
        {originalCurrency !== 'STT' && originalAmount && (
          <motion.div
            className="price-original"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="price-amount">{formatPrice(originalAmount)}</span>
            <span className="price-currency">{originalCurrency}</span>
          </motion.div>
        )}

        <motion.div
          className="price-stt"
          animate={{
            scale: isUpdating ? [1, 1.05, 1] : 1,
          }}
          transition={{ duration: 0.3 }}
        >
          <DollarSign size={20} />
          <span className="price-amount">{formatPrice(priceInSTT)}</span>
          <span className="price-currency">STT</span>
        </motion.div>

        {showUSD && (
          <motion.div
            className="price-usd"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="usd-label">≈</span>
            <span className="usd-amount">${calculateUSD()}</span>
            <span className="usd-currency">USD</span>
          </motion.div>
        )}
      </div>

      {originalCurrency !== 'STT' && (
        <div className="price-conversion">
          <span className="conversion-text">
            1 {originalCurrency} = {(priceInSTT / (originalAmount || 1)).toFixed(4)} STT
          </span>
        </div>
      )}
    </motion.div>
  );
}
