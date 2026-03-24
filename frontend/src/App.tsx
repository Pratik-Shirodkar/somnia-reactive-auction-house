import { useState, useEffect, useCallback } from 'react';
import { formatEther, parseEther, type PublicClient, type WalletClient } from 'viem';
import { getPublicClient, getWalletClient, CONTRACTS } from './config/chain';
import { AUCTION_ABI } from './abi/auction';
import './index.css';

// Types
interface AuctionData {
  id: bigint;
  seller: string;
  auctionType: number;
  status: number;
  startPrice: bigint;
  endPrice: bigint;
  currentBid: bigint;
  highestBidder: string;
  startTime: bigint;
  endTime: bigint;
  title: string;
  description: string;
  imageUrl: string;
}

interface EventItem {
  id: string;
  type: 'created' | 'bid' | 'settled';
  message: string;
  timestamp: number;
}

// Emoji map for auctions without images
const AUCTION_EMOJIS = ['🎨', '💎', '🏆', '🎪', '🎭', '🌟', '🔮', '🎯', '🏛️', '⚡', '🦄', '🌈'];

export default function App() {
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [account, setAccount] = useState<string>('');
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [, setTick] = useState(0); // Force re-render for countdown

  // Init public client
  useEffect(() => {
    setPublicClient(getPublicClient());
  }, []);

  // Countdown ticker — update every second
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    try {
      const wc = await getWalletClient();
      const [addr] = await wc.getAddresses();
      setWalletClient(wc);
      setAccount(addr);
      showToast('success', `Connected: ${addr.slice(0, 6)}...${addr.slice(-4)}`);
    } catch (e: any) {
      showToast('error', e.message || 'Failed to connect wallet');
    }
  }, []);

  // Load auctions
  const loadAuctions = useCallback(async () => {
    if (!publicClient) return;
    try {
      const activeIds = await publicClient.readContract({
        address: CONTRACTS.ReactiveAuction as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'getActiveAuctionIds',
      }) as bigint[];

      const auctionPromises = activeIds.map(id =>
        publicClient.readContract({
          address: CONTRACTS.ReactiveAuction as `0x${string}`,
          abi: AUCTION_ABI,
          functionName: 'getAuction',
          args: [id],
        })
      );

      const results = await Promise.all(auctionPromises);
      setAuctions(results as unknown as AuctionData[]);
    } catch (e) {
      console.error('Failed to load auctions:', e);
    }
  }, [publicClient]);

  // Load on init and poll
  useEffect(() => {
    loadAuctions();
    const interval = setInterval(loadAuctions, 10000); // Fallback poll every 10s
    return () => clearInterval(interval);
  }, [loadAuctions]);

  // Watch for events (off-chain reactivity via logs)
  useEffect(() => {
    if (!publicClient) return;

    const unwatchCreated = publicClient.watchContractEvent({
      address: CONTRACTS.ReactiveAuction as `0x${string}`,
      abi: AUCTION_ABI,
      eventName: 'AuctionCreated',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any;
          addEvent('created', `New ${args.auctionType === 0 ? 'Dutch' : 'English'} auction: "${args.title}"`);
          loadAuctions();
        }
      },
    });

    const unwatchBid = publicClient.watchContractEvent({
      address: CONTRACTS.ReactiveAuction as `0x${string}`,
      abi: AUCTION_ABI,
      eventName: 'BidPlaced',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any;
          addEvent('bid', `Bid of ${formatEther(args.amount)} STT on auction #${args.auctionId}`);
          loadAuctions();
        }
      },
    });

    const unwatchSettled = publicClient.watchContractEvent({
      address: CONTRACTS.ReactiveAuction as `0x${string}`,
      abi: AUCTION_ABI,
      eventName: 'AuctionSettled',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as any;
          addEvent('settled', `Auction #${args.auctionId} settled for ${formatEther(args.finalPrice)} STT`);
          loadAuctions();
        }
      },
    });

    return () => {
      unwatchCreated();
      unwatchBid();
      unwatchSettled();
    };
  }, [publicClient, loadAuctions]);

  // Helpers
  const addEvent = (type: EventItem['type'], message: string) => {
    setEvents(prev => [{
      id: Date.now().toString() + Math.random(),
      type,
      message,
      timestamp: Date.now(),
    }, ...prev].slice(0, 20));
  };

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const formatTime = (endTime: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    const end = Number(endTime);
    const diff = end - now;
    if (diff <= 0) return { text: 'EXPIRED', expired: true };
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return { text: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`, expired: false };
  };

  const getDutchPrice = (auction: AuctionData) => {
    const now = Math.floor(Date.now() / 1000);
    const start = Number(auction.startTime);
    const end = Number(auction.endTime);
    if (now >= end) return auction.endPrice;
    const elapsed = now - start;
    const duration = end - start;
    const priceDrop = ((auction.startPrice - auction.endPrice) * BigInt(elapsed)) / BigInt(duration);
    return auction.startPrice - priceDrop;
  };

  // Place bid
  const placeBid = async (auctionId: bigint, amount: string) => {
    if (!walletClient || !account) return showToast('error', 'Connect wallet first');
    setLoading(true);
    try {
      const hash = await walletClient.writeContract({
        account: account as `0x${string}`,
        address: CONTRACTS.ReactiveAuction as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'bid',
        args: [auctionId],
        value: parseEther(amount),
      });
      showToast('success', `Bid placed! Tx: ${hash.slice(0, 10)}...`);
      setTimeout(loadAuctions, 3000);
    } catch (e: any) {
      showToast('error', e.message?.slice(0, 100) || 'Bid failed');
    }
    setLoading(false);
  };

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <h1>⚡ ReactiveAuction</h1>
          <span className="tag">Somnia Testnet</span>
        </div>
        <div className="header-right">
          <div className="reactivity-badge">
            <span className="dot"></span>
            Reactivity Active
          </div>
          {account ? (
            <div className="wallet-info">
              🟢 {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          ) : (
            <button className="btn btn-connect" onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="main">
        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat-card">
            <div className="label">Active Auctions</div>
            <div className="value">{auctions.length}</div>
          </div>
          <div className="stat-card">
            <div className="label">Dutch Auctions</div>
            <div className="value">{auctions.filter(a => a.auctionType === 0).length}</div>
          </div>
          <div className="stat-card">
            <div className="label">English Auctions</div>
            <div className="value">{auctions.filter(a => a.auctionType === 1).length}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Volume</div>
            <div className="value">
              {formatEther(auctions.reduce((sum, a) => sum + a.currentBid, 0n))} STT
            </div>
          </div>
        </div>

        {/* Live Event Feed */}
        {events.length > 0 && (
          <div className="event-feed">
            <h3>📡 Live Event Feed <span className="reactivity-badge"><span className="dot"></span> Powered by Somnia Reactivity</span></h3>
            {events.slice(0, 5).map(event => (
              <div key={event.id} className="event-item">
                <div className={`event-icon ${event.type}`}>
                  {event.type === 'created' ? '🆕' : event.type === 'bid' ? '💰' : '✅'}
                </div>
                <span className="event-text" dangerouslySetInnerHTML={{ __html: event.message }}></span>
                <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Auction Section */}
        <div className="section-header">
          <h2>🔥 Active Auctions</h2>
          <div className="filters">
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              + Create Auction
            </button>
            <button className="btn btn-secondary" onClick={loadAuctions}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Auction Grid */}
        {auctions.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">🏛️</div>
            <h3>No Active Auctions</h3>
            <p>Create the first auction on the Somnia Reactive Auction House!</p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              + Create Your First Auction
            </button>
          </div>
        ) : (
          <div className="auction-grid">
            {auctions.map((auction) => (
              <AuctionCard
                key={auction.id.toString()}
                auction={auction}
                getDutchPrice={getDutchPrice}
                formatTime={formatTime}
                onBid={placeBid}
                loading={loading}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateAuctionModal
          walletClient={walletClient}
          account={account}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadAuctions(); }}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </>
  );
}

// ═══════════════════════════════════════
//  AUCTION CARD COMPONENT
// ═══════════════════════════════════════
function AuctionCard({ auction, getDutchPrice, formatTime, onBid, loading }: {
  auction: AuctionData;
  getDutchPrice: (a: AuctionData) => bigint;
  formatTime: (endTime: bigint) => { text: string; expired: boolean };
  onBid: (id: bigint, amount: string) => void;
  loading: boolean;
}) {
  const [bidAmount, setBidAmount] = useState('');
  const isDutch = auction.auctionType === 0;
  const timer = formatTime(auction.endTime);
  const currentPrice = isDutch ? getDutchPrice(auction) : auction.currentBid || auction.startPrice;
  const emoji = AUCTION_EMOJIS[Number(auction.id) % AUCTION_EMOJIS.length];

  const handleBid = () => {
    if (isDutch) {
      onBid(auction.id, formatEther(currentPrice));
    } else {
      if (!bidAmount) return;
      onBid(auction.id, bidAmount);
    }
  };

  const minBid = auction.currentBid === 0n
    ? auction.startPrice
    : auction.currentBid + auction.currentBid / 20n;

  return (
    <div className={`auction-card ${isDutch ? 'dutch' : 'english'}`}>
      <div className="auction-card-image">
        {emoji}
        <span className={`auction-type-badge ${isDutch ? 'badge-dutch' : 'badge-english'}`}>
          {isDutch ? '📉 Dutch' : '📈 English'}
        </span>
      </div>
      <div className="auction-card-body">
        <h3>{auction.title || `Auction #${auction.id.toString()}`}</h3>
        <p className="description">{auction.description || 'No description provided'}</p>
        
        <div className="price-section">
          <div className="price-current">
            <span className="label">{isDutch ? 'Current Price' : auction.currentBid > 0n ? 'Highest Bid' : 'Starting Price'}</span>
            <span className={`amount ${isDutch ? 'dutch-price' : 'english-price'}`}>
              {formatEther(currentPrice)} STT
            </span>
          </div>
          <div className="countdown">
            <span className="label">Time Left</span>
            <span className={`time ${timer.expired ? 'expired' : ''}`}>{timer.text}</span>
          </div>
        </div>

        <div className="seller-info">
          Seller: {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
          {auction.highestBidder !== '0x0000000000000000000000000000000000000000' && (
            <> | Leader: {auction.highestBidder.slice(0, 6)}...{auction.highestBidder.slice(-4)}</>
          )}
        </div>

        {!timer.expired && (
          isDutch ? (
            <button
              className="btn btn-dutch"
              onClick={handleBid}
              disabled={loading}
              style={{ width: '100%' }}
            >
              ⚡ Buy Now for {formatEther(currentPrice)} STT
            </button>
          ) : (
            <div className="bid-input-group">
              <input
                type="text"
                placeholder={`Min: ${formatEther(minBid)} STT`}
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value)}
              />
              <button className="btn btn-english" onClick={handleBid} disabled={loading || !bidAmount}>
                Bid
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  CREATE AUCTION MODAL
// ═══════════════════════════════════════
function CreateAuctionModal({ walletClient, account, onClose, onCreated, showToast }: {
  walletClient: WalletClient | null;
  account: string;
  onClose: () => void;
  onCreated: () => void;
  showToast: (type: string, msg: string) => void;
}) {
  const [type, setType] = useState<'dutch' | 'english'>('dutch');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [endPrice, setEndPrice] = useState('');
  const [duration, setDuration] = useState('300'); // 5 min default
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!walletClient || !account) return showToast('error', 'Connect wallet first');
    if (!title || !startPrice) return showToast('error', 'Fill in required fields');

    setCreating(true);
    try {
      if (type === 'dutch') {
        if (!endPrice) return showToast('error', 'End price required for Dutch auctions');
        await walletClient.writeContract({
          account: account as `0x${string}`,
          address: CONTRACTS.ReactiveAuction as `0x${string}`,
          abi: AUCTION_ABI,
          functionName: 'createDutchAuction',
          args: [
            parseEther(startPrice),
            parseEther(endPrice),
            BigInt(duration),
            title,
            description,
            '',
          ],
        });
      } else {
        await walletClient.writeContract({
          account: account as `0x${string}`,
          address: CONTRACTS.ReactiveAuction as `0x${string}`,
          abi: AUCTION_ABI,
          functionName: 'createEnglishAuction',
          args: [
            parseEther(startPrice),
            BigInt(duration),
            title,
            description,
            '',
          ],
        });
      }
      showToast('success', 'Auction created! Reactivity will auto-settle it.');
      onCreated();
    } catch (e: any) {
      showToast('error', e.message?.slice(0, 100) || 'Creation failed');
    }
    setCreating(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>🏛️ Create New Auction</h2>

        <div className="type-selector">
          <div className={`type-option ${type === 'dutch' ? 'active dutch' : ''}`} onClick={() => setType('dutch')}>
            <h4>📉 Dutch Auction</h4>
            <p>Price drops over time</p>
          </div>
          <div className={`type-option ${type === 'english' ? 'active english' : ''}`} onClick={() => setType('english')}>
            <h4>📈 English Auction</h4>
            <p>Bids go up over time</p>
          </div>
        </div>

        <div className="form-group">
          <label>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Rare Digital Artifact" />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your auction item..." />
        </div>

        <div className="form-group">
          <label>{type === 'dutch' ? 'Start Price (STT) *' : 'Minimum Bid (STT) *'}</label>
          <input type="text" value={startPrice} onChange={e => setStartPrice(e.target.value)} placeholder="1.0" />
        </div>

        {type === 'dutch' && (
          <div className="form-group">
            <label>End Price (STT) *</label>
            <input type="text" value={endPrice} onChange={e => setEndPrice(e.target.value)} placeholder="0.1" />
          </div>
        )}

        <div className="form-group">
          <label>Duration</label>
          <select value={duration} onChange={e => setDuration(e.target.value)}>
            <option value="120">2 minutes</option>
            <option value="300">5 minutes</option>
            <option value="600">10 minutes</option>
            <option value="1800">30 minutes</option>
            <option value="3600">1 hour</option>
            <option value="86400">24 hours</option>
          </select>
        </div>

        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.8rem', color: '#10b981', marginBottom: '8px' }}>
          ⚡ <strong>Powered by Somnia Reactivity:</strong> Your auction will auto-settle when it expires via the AuctionHandler's Schedule subscription — no keeper bots needed!
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className={`btn ${type === 'dutch' ? 'btn-dutch' : 'btn-english'}`} onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : `Create ${type === 'dutch' ? 'Dutch' : 'English'} Auction`}
          </button>
        </div>
      </div>
    </div>
  );
}
