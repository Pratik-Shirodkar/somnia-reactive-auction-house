import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Lock, Eye, CheckCircle, XCircle } from 'lucide-react';

interface PhaseIndicatorProps {
  phase: number;
  endTime: bigint;
  revealDeadline: bigint;
  auctionType: number;
}

const PHASE_LABELS = ['BIDDING', 'REVEAL', 'SETTLING', 'SETTLED', 'CANCELLED'];

const PHASE_ICONS = {
  0: Lock,    // BIDDING
  1: Eye,     // REVEAL
  2: Clock,   // SETTLING
  3: CheckCircle, // SETTLED
  4: XCircle, // CANCELLED
};

const PHASE_COLORS = {
  0: '#3b82f6', // blue
  1: '#8b5cf6', // purple
  2: '#f59e0b', // amber
  3: '#10b981', // green
  4: '#ef4444', // red
};

const PHASE_INSTRUCTIONS = {
  0: 'Submit your sealed bid commitment during this phase. Your bid amount will remain hidden.',
  1: 'Reveal your bid by providing the same amount and secret you used during commitment.',
  2: 'The auction is being settled. Winner determination in progress.',
  3: 'This auction has been settled. The winner has been determined.',
  4: 'This auction has been cancelled.',
};

export function PhaseIndicator({ phase, endTime, revealDeadline, auctionType }: PhaseIndicatorProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      let targetTime: number;

      if (phase === 0) {
        // BIDDING phase - show time until bidding ends
        targetTime = Number(endTime);
      } else if (phase === 1) {
        // REVEAL phase - show time until reveal deadline
        targetTime = Number(revealDeadline);
      } else {
        // Other phases - no countdown
        setTimeRemaining('');
        setExpired(false);
        return;
      }

      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeRemaining('00:00:00');
        setExpired(true);
        return;
      }

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setTimeRemaining(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
      setExpired(false);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [phase, endTime, revealDeadline]);

  // Only show phase indicator for sealed-bid auctions (type 2)
  if (auctionType !== 2) {
    return null;
  }

  const PhaseIcon = PHASE_ICONS[phase as keyof typeof PHASE_ICONS] || Clock;
  const phaseColor = PHASE_COLORS[phase as keyof typeof PHASE_COLORS] || '#6b7280';
  const phaseLabel = PHASE_LABELS[phase] || 'UNKNOWN';
  const phaseInstruction = PHASE_INSTRUCTIONS[phase as keyof typeof PHASE_INSTRUCTIONS] || '';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="phase-indicator"
      style={{ borderColor: phaseColor }}
    >
      <div className="phase-header">
        <div className="phase-icon" style={{ backgroundColor: phaseColor }}>
          <PhaseIcon size={20} />
        </div>
        <div className="phase-info">
          <div className="phase-label" style={{ color: phaseColor }}>
            {phaseLabel}
          </div>
          {timeRemaining && (
            <div className={`phase-timer ${expired ? 'expired' : ''}`}>
              <Clock size={14} />
              {timeRemaining}
            </div>
          )}
        </div>
      </div>

      <div className="phase-instruction">
        {phaseInstruction}
      </div>

      {phase === 0 && (
        <div className="phase-timeline">
          <div className="timeline-step active">
            <div className="timeline-dot"></div>
            <div className="timeline-label">Commit Bids</div>
          </div>
          <div className="timeline-line"></div>
          <div className="timeline-step">
            <div className="timeline-dot"></div>
            <div className="timeline-label">Reveal Bids</div>
          </div>
          <div className="timeline-line"></div>
          <div className="timeline-step">
            <div className="timeline-dot"></div>
            <div className="timeline-label">Settlement</div>
          </div>
        </div>
      )}

      {phase === 1 && (
        <div className="phase-timeline">
          <div className="timeline-step completed">
            <div className="timeline-dot"></div>
            <div className="timeline-label">Commit Bids</div>
          </div>
          <div className="timeline-line completed"></div>
          <div className="timeline-step active">
            <div className="timeline-dot"></div>
            <div className="timeline-label">Reveal Bids</div>
          </div>
          <div className="timeline-line"></div>
          <div className="timeline-step">
            <div className="timeline-dot"></div>
            <div className="timeline-label">Settlement</div>
          </div>
        </div>
      )}

      {(phase === 2 || phase === 3) && (
        <div className="phase-timeline">
          <div className="timeline-step completed">
            <div className="timeline-dot"></div>
            <div className="timeline-label">Commit Bids</div>
          </div>
          <div className="timeline-line completed"></div>
          <div className="timeline-step completed">
            <div className="timeline-dot"></div>
            <div className="timeline-label">Reveal Bids</div>
          </div>
          <div className="timeline-line completed"></div>
          <div className="timeline-step active">
            <div className="timeline-dot"></div>
            <div className="timeline-label">Settlement</div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
