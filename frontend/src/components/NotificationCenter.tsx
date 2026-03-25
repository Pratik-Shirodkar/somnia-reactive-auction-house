import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import type { Notification } from '../hooks/useNotifications';

interface NotificationCenterProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export function NotificationCenter({ notifications, onDismiss }: NotificationCenterProps) {
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} />;
      case 'error':
        return <AlertCircle size={18} />;
      case 'warning':
        return <AlertTriangle size={18} />;
      default:
        return <Info size={18} />;
    }
  };

  return (
    <div className="notification-center">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className={`notification notification-${notification.type}`}
          >
            <div className="notification-icon">
              {getIcon(notification.type)}
            </div>
            <div className="notification-content">
              <div className="notification-title">{notification.title}</div>
              <div className="notification-message">{notification.message}</div>
            </div>
            <button
              className="notification-close"
              onClick={() => onDismiss(notification.id)}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
