import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileText, TrendingUp, Filter } from 'lucide-react';
import type { WalletClient } from 'viem';

interface TemplateSelectorProps {
  walletClient: WalletClient | null;
  onSelect: (template: AuctionTemplate) => void;
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

export function TemplateSelector({ walletClient, onSelect, onError }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<AuctionTemplate[]>([]);
  const [filterType, setFilterType] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'popularity' | 'recent'>('popularity');
  const [selectedTemplate, setSelectedTemplate] = useState<AuctionTemplate | null>(null);

  const loadPublicTemplates = useCallback(async () => {
    if (!walletClient) return;

    try {
      // In a real implementation, we'd query all users' public templates
      // For now, we'll show a placeholder
      setTemplates([]);
    } catch (e) {
      console.error('Failed to load public templates:', e);
      onError('Failed to load public templates');
    }
  }, [walletClient, onError]);

  useEffect(() => {
    loadPublicTemplates();
  }, [loadPublicTemplates]);

  const filteredTemplates = templates.filter(t => 
    filterType === null || t.auctionType === filterType
  );

  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (sortBy === 'popularity') {
      return Number(b.usageCount) - Number(a.usageCount);
    }
    return 0; // Recent would need timestamp
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="template-selector"
    >
      <div className="form-header">
        <FileText size={20} />
        <h3>Browse Public Templates</h3>
      </div>

      <div className="template-filters">
        <div className="filter-group">
          <label>
            <Filter size={14} /> Auction Type
          </label>
          <select value={filterType ?? ''} onChange={(e) => setFilterType(e.target.value ? Number(e.target.value) : null)}>
            <option value="">All Types</option>
            {AUCTION_TYPE_NAMES.map((name, index) => (
              <option key={index} value={index}>{name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>
            <TrendingUp size={14} /> Sort By
          </label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'popularity' | 'recent')}>
            <option value="popularity">Most Popular</option>
            <option value="recent">Most Recent</option>
          </select>
        </div>
      </div>

      {sortedTemplates.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <p>No public templates available</p>
          <small>Be the first to share a template with the community!</small>
        </div>
      ) : (
        <div className="templates-grid">
          {sortedTemplates.map((template, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.02 }}
              className={`template-card ${selectedTemplate === template ? 'selected' : ''}`}
              onClick={() => setSelectedTemplate(template)}
            >
              <div className="template-header">
                <h4>{template.name}</h4>
                <span className="template-type">{AUCTION_TYPE_NAMES[template.auctionType]}</span>
              </div>
              <div className="template-preview">
                <div className="preview-row">
                  <span>Start Price:</span>
                  <strong>{(Number(template.startPrice) / 1e18).toFixed(2)} STT</strong>
                </div>
                {template.auctionType === 0 && (
                  <div className="preview-row">
                    <span>End Price:</span>
                    <strong>{(Number(template.endPrice) / 1e18).toFixed(2)} STT</strong>
                  </div>
                )}
                <div className="preview-row">
                  <span>Duration:</span>
                  <strong>{Number(template.duration) / 60} minutes</strong>
                </div>
              </div>
              <div className="template-stats">
                <TrendingUp size={14} />
                <span>Used {Number(template.usageCount)} times</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {selectedTemplate && (
        <button
          className="btn btn-primary"
          onClick={() => onSelect(selectedTemplate)}
        >
          Use This Template
        </button>
      )}
    </motion.div>
  );
}
