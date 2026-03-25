import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileText, TrendingUp } from 'lucide-react';
import type { WalletClient } from 'viem';
import { CONTRACTS, getPublicClient } from '../config/chain';
import { AUCTION_ABI } from '../abi/auction';

interface TemplateManagerProps {
  walletClient: WalletClient | null;
  account: string;
  onError: (message: string) => void;
}

interface AuctionTemplate {
  name: string;
  auctionType: number;
  startPrice: bigint;
  endPrice: bigint;
  duration: bigint;
  config: {
    antiSnipeEnabled: boolean;
    extensionThreshold: bigint;
    extensionDuration: bigint;
    maxExtensions: bigint;
    currentExtensions: bigint;
  };
  usageCount: bigint;
  isPublic: boolean;
}

const AUCTION_TYPE_NAMES = ['Dutch', 'English', 'Sealed-Bid', 'Bundle'];

export function TemplateManager({ walletClient, account, onError }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<AuctionTemplate[]>([]);
  const [templateCount, setTemplateCount] = useState(0);

  const loadTemplates = useCallback(async () => {
    const publicClient = getPublicClient();
    if (!publicClient || !account) return;

    try {
      const count = await publicClient.readContract({
        address: CONTRACTS.AUCTION_HOUSE,
        abi: AUCTION_ABI,
        functionName: 'userTemplateCount',
        args: [account as `0x${string}`],
      }) as bigint;

      setTemplateCount(Number(count));

      const loadedTemplates: AuctionTemplate[] = [];
      for (let i = 0; i < Number(count); i++) {
        const template = await publicClient.readContract({
          address: CONTRACTS.AUCTION_HOUSE,
          abi: AUCTION_ABI,
          functionName: 'userTemplates',
          args: [account as `0x${string}`, BigInt(i)],
        }) as AuctionTemplate;
        
        if (template.name) {
          loadedTemplates.push(template);
        }
      }

      setTemplates(loadedTemplates);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  }, [account]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const deleteTemplate = async (index: number) => {
    void index;
    onError('Template deletion is not supported by the deployed contract yet.');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="template-manager"
    >
      <div className="form-header">
        <FileText size={20} />
        <h3>My Templates ({templateCount}/10)</h3>
      </div>

      {templateCount >= 10 && (
        <div className="warning-box">
          Template limit reached. Delete a template to create new ones.
        </div>
      )}

      {templates.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <p>No templates saved yet</p>
          <small>Save auction configurations as templates for quick reuse</small>
        </div>
      ) : (
        <div className="templates-list">
          {templates.map((template, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="template-item"
            >
              <div className="template-info">
                <div className="template-header">
                  <h4>{template.name}</h4>
                  <span className="template-type">{AUCTION_TYPE_NAMES[template.auctionType]}</span>
                </div>
                <div className="template-details">
                  <span>Start: {(Number(template.startPrice) / 1e18).toFixed(2)} STT</span>
                  {template.auctionType === 0 && (
                    <span>End: {(Number(template.endPrice) / 1e18).toFixed(2)} STT</span>
                  )}
                  <span>Duration: {Number(template.duration) / 60}m</span>
                </div>
                <div className="template-stats">
                  <TrendingUp size={14} />
                  <span>Used {Number(template.usageCount)} times</span>
                  {template.isPublic && <span className="badge">Public</span>}
                </div>
              </div>
              <div className="template-actions">
                <button
                  className="btn-icon"
                  onClick={() => deleteTemplate(index)}
                  disabled={!walletClient}
                  title="Delete template"
                >
                  ×
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
