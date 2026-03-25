import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Award, Target, Zap, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface AchievementNotificationProps {
  achievementType: string;
  milestone: number;
  onDismiss?: () => void;
  autoHideDuration?: number;
}

const getAchievementColor = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('auction')) return '#fbbf24';
  if (lowerType.includes('volume')) return '#8b5cf6';
  if (lowerType.includes('reputation')) return '#10b981';
  if (lowerType.includes('bid')) return '#3b82f6';
  return '#6366f1';
};

const renderAchievementIcon = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('auction')) return <Trophy size={24} />;
  if (lowerType.includes('volume')) return <Star size={24} />;
  if (lowerType.includes('reputation')) return <Award size={24} />;
  if (lowerType.includes('bid')) return <Target size={24} />;
  return <Zap size={24} />;
};

export function AchievementNotification({
  achievementType,
  milestone,
  onDismiss,
  autoHideDuration = 5000,
}: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const color = getAchievementColor(achievementType);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  }, [onDismiss]);

  useEffect(() => {
    if (autoHideDuration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [autoHideDuration, handleDismiss]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -50 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 20,
          }}
          className="achievement-notification"
          style={{ borderColor: color }}
        >
          <motion.div
            className="achievement-icon"
            style={{ backgroundColor: color }}
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: 2,
              repeatDelay: 0.3,
            }}
          >
            {renderAchievementIcon(achievementType)}
          </motion.div>

          <div className="achievement-content">
            <div className="achievement-title">Achievement Unlocked!</div>
            <div className="achievement-type">{achievementType}</div>
            <div className="achievement-milestone">Milestone: {milestone}</div>
          </div>

          <motion.div
            className="achievement-sparkles"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ✨
          </motion.div>

          <button
            className="achievement-close"
            onClick={handleDismiss}
            aria-label="Dismiss achievement"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
