import { motion } from 'framer-motion';
import { Package, Coins, Image } from 'lucide-react';

interface BundleItem {
  tokenContract: string;
  tokenId: bigint;
  amount: bigint;
  tokenType: number; // 0=NATIVE, 1=ERC20, 2=ERC721
}

interface BundleItemDisplayProps {
  items: BundleItem[];
}

const TOKEN_TYPE_LABELS = {
  0: 'NATIVE',
  1: 'ERC20',
  2: 'ERC721',
};

export function BundleItemDisplay({ items }: BundleItemDisplayProps) {
  const getIcon = (tokenType: number) => {
    switch (tokenType) {
      case 2:
        return <Image size={18} />;
      case 1:
        return <Coins size={18} />;
      default:
        return <Package size={18} />;
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bundle-item-display">
      <div className="bundle-header">
        <Package size={20} />
        <h4>Bundle Items ({items.length})</h4>
      </div>

      <div className="bundle-items-list">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bundle-item-card"
          >
            <div className="item-icon">
              {getIcon(item.tokenType)}
            </div>
            <div className="item-details">
              <div className="item-type">
                {TOKEN_TYPE_LABELS[item.tokenType as keyof typeof TOKEN_TYPE_LABELS] || 'UNKNOWN'}
              </div>
              <div className="item-contract">
                {formatAddress(item.tokenContract)}
              </div>
              {item.tokenType === 2 && (
                <div className="item-token-id">
                  Token ID: {item.tokenId.toString()}
                </div>
              )}
              {item.tokenType === 1 && (
                <div className="item-amount">
                  Amount: {item.amount.toString()}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
