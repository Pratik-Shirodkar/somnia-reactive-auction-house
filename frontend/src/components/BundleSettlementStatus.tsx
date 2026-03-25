import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface BundleSettlementStatusProps {
  phase: number;
  itemCount: number;
  errorMessage?: string;
}

const PHASE_LABELS = ['BIDDING', 'REVEAL', 'SETTLING', 'SETTLED', 'CANCELLED'];

export function BundleSettlementStatus({ phase, itemCount, errorMessage }: BundleSettlementStatusProps) {
  const isSettling = phase === 2;
  const isSettled = phase === 3;
  const isCancelled = phase === 4;
  const hasError = !!errorMessage;

  const getStatusIcon = () => {
    if (hasError || isCancelled) return <XCircle size={24} />;
    if (isSettled) return <CheckCircle size={24} />;
    if (isSettling) return <Clock size={24} />;
    return <AlertTriangle size={24} />;
  };

  const getStatusColor = () => {
    if (hasError || isCancelled) return '#ef4444';
    if (isSettled) return '#10b981';
    if (isSettling) return '#f59e0b';
    return '#6b7280';
  };

  const getStatusText = () => {
    if (hasError) return 'Settlement Failed';
    if (isCancelled) return 'Auction Cancelled';
    if (isSettled) return 'Settlement Complete';
    if (isSettling) return 'Settlement In Progress';
    return PHASE_LABELS[phase] || 'Unknown';
  };

  const getStatusDescription = () => {
    if (hasError) return errorMessage;
    if (isCancelled) return 'This bundle auction was cancelled.';
    if (isSettled) return `All ${itemCount} items have been transferred atomically to the winner.`;
    if (isSettling) return `Transferring ${itemCount} items atomically. This may take a moment...`;
    return 'Bundle auction is active.';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bundle-settlement-status"
      style={{ borderColor: getStatusColor() }}
    >
      <div className="status-header">
        <div className="status-icon" style={{ color: getStatusColor() }}>
          {getStatusIcon()}
        </div>
        <div className="status-info">
          <div className="status-label" style={{ color: getStatusColor() }}>
            {getStatusText()}
          </div>
          <div className="status-description">
            {getStatusDescription()}
          </div>
        </div>
      </div>

      {isSettling && (
        <div className="settlement-progress">
          <div className="progress-bar">
            <motion.div
              className="progress-fill"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ backgroundColor: getStatusColor() }}
            />
          </div>
          <div className="progress-text">
            Atomic transfer in progress...
          </div>
        </div>
      )}

      {hasError && (
        <div className="error-details">
          <strong>Error Details:</strong>
          <p>{errorMessage}</p>
          <div className="error-note">
            Bundle settlement is atomic - all items must transfer successfully or the entire transaction reverts.
          </div>
        </div>
      )}

      {isSettled && (
        <div className="success-details">
          <CheckCircle size={16} />
          <span>All {itemCount} items transferred successfully</span>
        </div>
      )}
    </motion.div>
  );
}
