import { useState, useEffect, useCallback, useMemo } from 'react';
import { encodePacked, formatEther, formatUnits, keccak256, maxUint256, parseEther, parseUnits, toHex, zeroAddress, type PublicClient, type WalletClient } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Plus, 
  RotateCw, 
  TrendingDown, 
  TrendingUp, 
  Gavel, 
  ShieldCheck, 
  PlusCircle,
  X,
  History,
  Trophy,
  LayoutGrid,
  Eye,
  EyeOff,
  BarChart3,
  Activity,
  ExternalLink
} from 'lucide-react';
import { getPublicClient, getWalletClient, CONTRACTS, somniaTestnet } from './config/chain';
import { AUCTION_ABI } from './abi/auction';
import { useReactiveAuction } from './hooks/useReactiveAuction';
import { useNotifications } from './hooks/useNotifications';
import { NotificationCenter } from './components/NotificationCenter';
import { PhaseIndicator, SealedBidAuctionForm, PlatformMetricsCard, LeaderboardTable, BidHistoryPanel } from './components';
import { LandingPage } from './components/LandingPage';
import './index.css';
import './landing.css';

type TabId = 'market' | 'analytics' | 'activity';

// Types
interface AuctionData {
  id: bigint;
  seller: string;
  auctionType: number;
  phase: number;
  startPrice: bigint;
  endPrice: bigint;
  currentBid: bigint;
  highestBidder: string;
  startTime: bigint;
  endTime: bigint;
  revealDeadline: bigint;
  config: {
    antiSnipeEnabled: boolean;
    extensionThreshold: bigint;
    extensionDuration: bigint;
    maxExtensions: bigint;
    currentExtensions: bigint;
  };
  title: string;
  description: string;
  imageUrl: string;
  paymentToken: string;
  preferredCurrency: string;
  noAutoConvert: boolean;
}

interface EventItem {
  id: string;
  type: 'created' | 'bid' | 'settled' | 'extended' | 'phase' | 'commit' | 'reveal';
  message: string;
  timestamp: number;
  txHash?: string;
}

// Emoji map for auctions without images
const AUCTION_EMOJIS = ['🎨', '💎', '🏆', '🎪', '🎭', '🌟', '🔮', '🎯', '🏛️', '⚡', '🦄', '🌈'];

const ERC20_ABI = [
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const;

const LEGACY_AUCTION_READ_ABI = [
  {
    type: 'function',
    name: 'getAuction',
    inputs: [{ name: '_auctionId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'seller', type: 'address' },
        { name: 'auctionType', type: 'uint8' },
        { name: 'status', type: 'uint8' },
        { name: 'startPrice', type: 'uint256' },
        { name: 'endPrice', type: 'uint256' },
        { name: 'currentBid', type: 'uint256' },
        { name: 'highestBidder', type: 'address' },
        { name: 'startTime', type: 'uint256' },
        { name: 'endTime', type: 'uint256' },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'imageUrl', type: 'string' },
      ],
    }],
    stateMutability: 'view',
  },
] as const;

const PHASE_LABELS = ['BIDDING', 'REVEAL', 'SETTLING', 'SETTLED', 'CANCELLED'];

function normalizeSecretToBytes32(secret: string) {
  const trimmed = secret.trim();
  if (trimmed.startsWith('0x') && trimmed.length === 66) return trimmed as `0x${string}`;
  return toHex(trimmed || 'somnia-reactive-secret', { size: 32 });
}

function normalizeLegacyAuction(legacy: any): AuctionData {
  return {
    id: legacy.id,
    seller: legacy.seller,
    auctionType: legacy.auctionType,
    phase: legacy.status === 0 ? 0 : 3,
    startPrice: legacy.startPrice,
    endPrice: legacy.endPrice,
    currentBid: legacy.currentBid,
    highestBidder: legacy.highestBidder,
    startTime: legacy.startTime,
    endTime: legacy.endTime,
    revealDeadline: 0n,
    config: {
      antiSnipeEnabled: false,
      extensionThreshold: 0n,
      extensionDuration: 0n,
      maxExtensions: 0n,
      currentExtensions: 0n,
    },
    title: legacy.title,
    description: legacy.description,
    imageUrl: legacy.imageUrl,
    paymentToken: zeroAddress,
    preferredCurrency: zeroAddress,
    noAutoConvert: false,
  } as AuctionData;
}

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [account, setAccount] = useState<string>('');
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [auctionsLoading, setAuctionsLoading] = useState(true);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('market');
  const [supportsSealedAuctions, setSupportsSealedAuctions] = useState(true);
  const [tokenDecimals, setTokenDecimals] = useState<Record<string, number>>({});
  const [tokenSymbols, setTokenSymbols] = useState<Record<string, string>>({});
  const [proofStats, setProofStats] = useState({
    created: 0,
    bids: 0,
    settled: 0,
    extensions: 0,
    phaseTransitions: 0,
    lastSettlementTx: '',
  });
  const [narrativeMode, setNarrativeMode] = useState(false);
  const [simAuctionId, setSimAuctionId] = useState('');
  const [simBidInput, setSimBidInput] = useState('');
  const [simResult, setSimResult] = useState('');
  const [circuitBreaker, setCircuitBreaker] = useState<{ active: boolean; reason: string }>({ active: false, reason: '' });
  const [, setTick] = useState(0);
  
  // Real-time features
  const { subscribe, unsubscribe, watchAuction, unwatchAuction, isWatchingAuction } = useReactiveAuction(publicClient);
  const { notifications, addNotification, dismissNotification } = useNotifications(); 

  useEffect(() => {
    setPublicClient(getPublicClient());
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const detectCapabilities = async () => {
      if (!publicClient) return;
      try {
        await publicClient.readContract({
          address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
          abi: AUCTION_ABI,
          functionName: 'getSealedBidders',
          args: [0n],
        });
        setSupportsSealedAuctions(true);
      } catch {
        setSupportsSealedAuctions(false);
      }
    };
    detectCapabilities();
  }, [publicClient]);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    try {
      const wc = await getWalletClient();
      const chainId = await wc.getChainId();
      if (chainId !== 50312) {
        showToast('error', 'Wrong Network. Switch to Somnia Testnet.');
        return;
      }
      const [addr] = await wc.getAddresses();
      setWalletClient(wc);
      setAccount(addr);
      showToast('success', `Vault Connected: ${addr.slice(0, 6)}...${addr.slice(-4)}`);
    } catch (e: any) {
      showToast('error', e.message || 'Connection Refused');
    }
  }, []);

  const switchNetwork = async () => {
    try {
      await getWalletClient();
      await connectWallet();
    } catch (e: any) {
      showToast('error', 'Network Switch Failed');
    }
  };

  const loadAuctions = useCallback(async () => {
    if (!publicClient) return;
    try {
      const activeIds = await publicClient.readContract({
        address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'getActiveAuctionIds',
      }) as bigint[];

      const results = await Promise.all(activeIds.map(async (id) => {
        try {
          return await publicClient.readContract({
            address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
            abi: AUCTION_ABI,
            functionName: 'getAuction',
            args: [id],
          }) as unknown as AuctionData;
        } catch {
          const legacy = await publicClient.readContract({
            address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
            abi: LEGACY_AUCTION_READ_ABI,
            functionName: 'getAuction',
            args: [id],
          }) as any;
          return normalizeLegacyAuction(legacy);
        }
      }));

      setAuctions(results);
    } catch (e) {
      console.error('Extraction Failed:', e);
    }
    setAuctionsLoading(false);
  }, [publicClient]);

  useEffect(() => {
    loadAuctions();
    const interval = setInterval(loadAuctions, 15000);
    return () => clearInterval(interval);
  }, [loadAuctions]);

  // Watch for events (off-chain reactivity)
  useEffect(() => {
    if (!publicClient) return;
    
    // Subscribe to auction created events
    const handleAuctionCreated = (data: any) => {
      addEvent('created', `<b>New Genesis</b>: "${data.title}"`, data.transactionHash);
      setProofStats(prev => ({ ...prev, created: prev.created + 1 }));
      loadAuctions();
      addNotification('success', 'New Auction Created', `"${data.title}" is now live!`, data.auctionId);
    };
    
    // Subscribe to bid placed events
    const handleBidPlaced = (data: any) => {
      addEvent('bid', `<b>Bid Inbound</b>: ${formatEther(data.amount)} STT on #${data.auctionId}`, data.transactionHash);
      setProofStats(prev => ({ ...prev, bids: prev.bids + 1 }));
      loadAuctions();
      
      // Notify if watching this auction
      if (isWatchingAuction(data.auctionId)) {
        addNotification('info', 'New Bid on Watched Auction', 
          `${formatEther(data.amount)} STT placed on auction #${data.auctionId}`, 
          data.auctionId);
      }
    };
    
    // Subscribe to auction settled events
    const handleAuctionSettled = (data: any) => {
      addEvent('settled', `<b>Finalized</b>: #${data.auctionId} at ${formatEther(data.finalPrice)} STT`, data.transactionHash);
      setProofStats(prev => ({ 
        ...prev, 
        settled: prev.settled + 1, 
        lastSettlementTx: data.transactionHash || prev.lastSettlementTx 
      }));
      loadAuctions();
      
      if (isWatchingAuction(data.auctionId)) {
        addNotification('success', 'Auction Settled', 
          `Auction #${data.auctionId} settled at ${formatEther(data.finalPrice)} STT`, 
          data.auctionId);
      }
    };
    
    // Subscribe to auction extended events
    const handleAuctionExtended = (data: any) => {
      addEvent('extended', `<b>Anti-Snipe</b>: #${data.auctionId} extended (${data.extensionCount})`, data.transactionHash);
      setProofStats(prev => ({ ...prev, extensions: prev.extensions + 1 }));
      loadAuctions();
      
      if (isWatchingAuction(data.auctionId)) {
        addNotification('warning', 'Auction Extended', 
          `Auction #${data.auctionId} extended due to late bid`, 
          data.auctionId);
      }
    };
    
    // Subscribe to phase transition events
    const handlePhaseTransition = (data: any) => {
      const fromPhase = PHASE_LABELS[Number(data.fromPhase)] || 'UNKNOWN';
      const toPhase = PHASE_LABELS[Number(data.toPhase)] || 'UNKNOWN';
      addEvent('phase', `<b>Phase</b>: #${data.auctionId} ${fromPhase} → ${toPhase}`, data.transactionHash);
      setProofStats(prev => ({ ...prev, phaseTransitions: prev.phaseTransitions + 1 }));
      loadAuctions();
      
      if (isWatchingAuction(data.auctionId)) {
        addNotification('info', 'Phase Transition', 
          `Auction #${data.auctionId} moved to ${toPhase} phase`, 
          data.auctionId);
      }
    };
    
    // Subscribe to sealed bid committed events
    const handleSealedBidCommitted = (data: any) => {
      addEvent('commit', `<b>Commit</b>: sealed bid on #${data.auctionId}`, data.transactionHash);
      loadAuctions();
    };
    
    // Subscribe to sealed bid revealed events
    const handleSealedBidRevealed = (data: any) => {
      addEvent('reveal', `<b>Reveal</b>: ${formatEther(data.amount)} STT on #${data.auctionId}`, data.transactionHash);
      loadAuctions();
    };
    
    // Subscribe to all events
    subscribe('auction_created', handleAuctionCreated);
    subscribe('bid_placed', handleBidPlaced);
    subscribe('auction_settled', handleAuctionSettled);
    subscribe('auction_extended', handleAuctionExtended);
    subscribe('phase_transition', handlePhaseTransition);
    subscribe('sealed_bid_committed', handleSealedBidCommitted);
    subscribe('sealed_bid_revealed', handleSealedBidRevealed);
    
    // Cleanup subscriptions
    return () => {
      unsubscribe('auction_created', handleAuctionCreated);
      unsubscribe('bid_placed', handleBidPlaced);
      unsubscribe('auction_settled', handleAuctionSettled);
      unsubscribe('auction_extended', handleAuctionExtended);
      unsubscribe('phase_transition', handlePhaseTransition);
      unsubscribe('sealed_bid_committed', handleSealedBidCommitted);
      unsubscribe('sealed_bid_revealed', handleSealedBidRevealed);
    };
  }, [publicClient, loadAuctions, subscribe, unsubscribe, isWatchingAuction, addNotification]);

  const addEvent = (type: EventItem['type'], message: string, txHash?: string) => {
    setEvents(prev => [{ id: Math.random().toString(), type, message, timestamp: Date.now(), txHash }, ...prev].slice(0, 20));
  };

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const formatTime = (endTime: bigint) => {
    const diff = Number(endTime) - Math.floor(Date.now() / 1000);
    if (diff <= 0) return { text: 'SETTLING...', expired: true, timerClass: 'expired' };
    const total = Number(endTime) - Math.floor(Date.now() / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    // Color class based on remaining ratio (using rough 5-minute benchmark)
    const ratio = total / 300;
    const timerClass = ratio > 0.5 ? 'timer-safe' : ratio > 0.1 ? 'timer-warn' : 'timer-critical';
    return { text: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`, expired: false, timerClass };
  };

  const getDutchPrice = (auction: AuctionData) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const start = auction.startTime;
    const end = auction.endTime;
    if (now >= end) return auction.endPrice;
    const priceDrop = ((auction.startPrice - auction.endPrice) * (now - start)) / (end - start);
    return auction.startPrice - priceDrop;
  };

  const resolveTokenDecimals = useCallback(async (token?: string) => {
    if (!token || token.toLowerCase() === zeroAddress) return 18;
    const tokenKey = token.toLowerCase();
    if (tokenDecimals[tokenKey] !== undefined) return tokenDecimals[tokenKey];
    if (!publicClient) return 18;

    try {
      const decimals = await publicClient.readContract({
        address: token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as number;
      const normalized = Number(decimals);
      setTokenDecimals(prev => prev[tokenKey] !== undefined ? prev : { ...prev, [tokenKey]: normalized });
      return normalized;
    } catch {
      return 18;
    }
  }, [publicClient, tokenDecimals]);

  const resolveTokenSymbol = useCallback(async (token?: string) => {
    if (!token || token.toLowerCase() === zeroAddress) return 'STT';
    const tokenKey = token.toLowerCase();
    if (tokenSymbols[tokenKey] !== undefined) return tokenSymbols[tokenKey];
    if (!publicClient) return 'TOKEN';

    try {
      const symbol = await publicClient.readContract({
        address: token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }) as string;
      const normalized = symbol || 'TOKEN';
      setTokenSymbols(prev => prev[tokenKey] !== undefined ? prev : { ...prev, [tokenKey]: normalized });
      return normalized;
    } catch {
      return 'TOKEN';
    }
  }, [publicClient, tokenSymbols]);

  const formatAuctionAmount = useCallback((auction: AuctionData, amount: bigint) => {
    const isTokenAuction = auction.paymentToken?.toLowerCase() !== zeroAddress;
    const decimals = isTokenAuction ? (tokenDecimals[auction.paymentToken.toLowerCase()] ?? 18) : 18;
    return formatUnits(amount, decimals);
  }, [tokenDecimals]);

  const getAuctionCurrencyLabel = useCallback((auction: AuctionData) => {
    if (!auction.paymentToken || auction.paymentToken.toLowerCase() === zeroAddress) return 'STT';
    return tokenSymbols[auction.paymentToken.toLowerCase()] ?? 'TOKEN';
  }, [tokenSymbols]);

  useEffect(() => {
    if (!publicClient || auctions.length === 0) return;

    const tokenAddresses = Array.from(new Set(
      auctions
        .map(a => a.paymentToken)
        .filter(token => token && token.toLowerCase() !== zeroAddress)
        .map(token => token.toLowerCase())
    ));

    tokenAddresses.forEach((token) => {
      if (tokenDecimals[token] !== undefined) return;
      resolveTokenDecimals(token);
    });

    tokenAddresses.forEach((token) => {
      if (tokenSymbols[token] !== undefined) return;
      resolveTokenSymbol(token);
    });
  }, [auctions, publicClient, tokenDecimals, tokenSymbols, resolveTokenDecimals, resolveTokenSymbol]);

  const auctionsToRender = auctions;
  const eventsToRender = events;

  useEffect(() => {
    const extensionsSaturated = auctionsToRender.some((auction) => {
      if (!auction.config) return false;
      return auction.config.maxExtensions > 0n && auction.config.currentExtensions >= auction.config.maxExtensions;
    });
    const highPhaseChurn = eventsToRender.slice(0, 10).filter((event) => event.type === 'phase').length >= 6;

    if (extensionsSaturated) {
      setCircuitBreaker({ active: true, reason: 'Anti-snipe extension ceiling reached on one or more auctions.' });
      return;
    }
    if (highPhaseChurn) {
      setCircuitBreaker({ active: true, reason: 'High phase churn detected. Refresh and verify market state.' });
      return;
    }
    setCircuitBreaker({ active: false, reason: '' });
  }, [auctionsToRender, eventsToRender]);

  const narrativeLines = useMemo(() => {
    const source = eventsToRender.slice(0, 5);
    if (source.length === 0) return ['No on-chain activity yet. Trigger a create or bid to start the narrative.'];
    return source.map((event, index) => {
      const prefix = `${source.length - index}.`;
      const text = event.message.replace(/<[^>]+>/g, '');
      return `${prefix} ${text}`;
    });
  }, [eventsToRender]);

  const formatEventTime = (ts: number) => {
    const date = new Date(ts);
    return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  const runScenarioSimulation = async () => {
    if (!publicClient) {
      setSimResult('RPC client unavailable. Connect to network first.');
      return;
    }

    const auctionIdInput = simAuctionId.trim();
    if (!auctionIdInput) {
      setSimResult('Enter auction id first.');
      return;
    }

    let parsedAuctionId: bigint;
    try {
      parsedAuctionId = BigInt(auctionIdInput);
    } catch {
      setSimResult('Auction id must be a valid integer.');
      return;
    }

    if (!simBidInput.trim()) {
      setSimResult('Enter a bid amount to validate against live state.');
      return;
    }

    try {
      let target: AuctionData;
      try {
        target = await publicClient.readContract({
          address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
          abi: AUCTION_ABI,
          functionName: 'getAuction',
          args: [parsedAuctionId],
        }) as unknown as AuctionData;
      } catch {
        const legacy = await publicClient.readContract({
          address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
          abi: LEGACY_AUCTION_READ_ABI,
          functionName: 'getAuction',
          args: [parsedAuctionId],
        }) as any;
        target = normalizeLegacyAuction(legacy);
      }

      const decimals = target.paymentToken?.toLowerCase() !== zeroAddress
        ? await resolveTokenDecimals(target.paymentToken)
        : 18;
      const parsed = parseUnits(simBidInput, decimals);

      if (target.phase !== 0) {
        setSimResult(`Auction #${target.id} is in ${PHASE_LABELS[target.phase] ?? 'UNKNOWN'} phase. Use commit/reveal flow if sealed.`);
        return;
      }

      if (target.auctionType === 0) {
        const dutchPrice = getDutchPrice(target);
        setSimResult(
          parsed >= dutchPrice
            ? `Live PASS: bid clears Dutch price (${formatAuctionAmount(target, dutchPrice)} ${getAuctionCurrencyLabel(target)}).`
            : `Live FAIL: bid below Dutch price (${formatAuctionAmount(target, dutchPrice)} ${getAuctionCurrencyLabel(target)}).`
        );
        return;
      }

      if (target.auctionType === 2) {
        setSimResult('Live check: sealed auction requires commit in bidding phase, then reveal same amount + secret in reveal phase.');
        return;
      }

      const minBid = target.currentBid === 0n ? target.startPrice : target.currentBid + target.currentBid / 20n;
      setSimResult(
        parsed >= minBid
          ? `Live PASS: bid meets minimum (${formatAuctionAmount(target, minBid)} ${getAuctionCurrencyLabel(target)}).`
          : `Live FAIL: bid below minimum (${formatAuctionAmount(target, minBid)} ${getAuctionCurrencyLabel(target)}).`
      );
    } catch {
      setSimResult('Validation failed. Check auction id, token decimals, or amount format.');
    }
  };

  const commitSealedBid = async (auctionId: bigint, amount: string, secretInput: string) => {
    if (!walletClient || !account) return showToast('error', 'Auth Required');
    if (circuitBreaker.active) return showToast('error', `Safety Lock: ${circuitBreaker.reason}`);
    setLoading(true);
    try {
      const amountUnits = parseEther(amount);
      const secretBytes32 = normalizeSecretToBytes32(secretInput);
      const commitment = keccak256(encodePacked(['uint256', 'bytes32'], [amountUnits, secretBytes32]));

      const hash = await walletClient.writeContract({
        account: account as `0x${string}`,
        address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'commitBid',
        args: [auctionId, commitment],
        maxFeePerGas: parseEther('0.00000002'),
        maxPriorityFeePerGas: parseEther('0.00000001'),
        chain: somniaTestnet,
      });

      localStorage.setItem(`sealed:${auctionId.toString()}:${account.toLowerCase()}`, JSON.stringify({ amount, secret: secretBytes32 }));
      showToast('success', `Commit sent: ${hash.slice(0, 14)}...`);
    } catch (e: any) {
      showToast('error', e?.shortMessage || e?.message || 'Commit failed');
    }
    setLoading(false);
  };

  const revealSealedBid = async (auctionId: bigint, amount: string, secretInput?: string) => {
    if (!walletClient || !account) return showToast('error', 'Auth Required');
    if (circuitBreaker.active) return showToast('error', `Safety Lock: ${circuitBreaker.reason}`);
    setLoading(true);
    try {
      const amountUnits = parseEther(amount);
      const cached = localStorage.getItem(`sealed:${auctionId.toString()}:${account.toLowerCase()}`);
      const cachedSecret = cached ? JSON.parse(cached)?.secret : '';
      const secretBytes32 = normalizeSecretToBytes32(secretInput || cachedSecret || 'somnia-reactive-secret');

      const hash = await walletClient.writeContract({
        account: account as `0x${string}`,
        address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
        abi: AUCTION_ABI,
        functionName: 'revealBid',
        args: [auctionId, amountUnits, secretBytes32],
        value: amountUnits,
        maxFeePerGas: parseEther('0.00000002'),
        maxPriorityFeePerGas: parseEther('0.00000001'),
        chain: somniaTestnet,
      });
      showToast('success', `Reveal sent: ${hash.slice(0, 14)}...`);
    } catch (e: any) {
      showToast('error', e?.shortMessage || e?.message || 'Reveal failed');
    }
    setLoading(false);
  };

  const placeBid = async (auctionId: bigint, amount: string, paymentToken?: string, auctionType?: number) => {
    if (!walletClient || !account) return showToast('error', 'Auth Required');
    if (circuitBreaker.active) return showToast('error', `Safety Lock: ${circuitBreaker.reason}`);
    setLoading(true);
    try {
      const isTokenAuction = !!paymentToken && paymentToken.toLowerCase() !== zeroAddress;
      const decimals = isTokenAuction ? await resolveTokenDecimals(paymentToken) : 18;
      let parsedAmount = parseUnits(amount, decimals);
      if (auctionType === 0) {
        parsedAmount = parsedAmount + (parsedAmount / 100n) + 1n;
      }

      if (isTokenAuction && publicClient) {
        const allowance = await publicClient.readContract({
          address: paymentToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [account as `0x${string}`, CONTRACTS.AUCTION_HOUSE as `0x${string}`],
        }) as bigint;

        if (allowance < parsedAmount) {
          showToast('success', 'Approving token spend...');
          await walletClient.writeContract({
            account: account as `0x${string}`,
            address: paymentToken as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CONTRACTS.AUCTION_HOUSE as `0x${string}`, maxUint256],
            maxFeePerGas: parseEther('0.00000002'),
            maxPriorityFeePerGas: parseEther('0.00000001'),
            chain: somniaTestnet,
          });
        }
      }

      const hash = await walletClient.writeContract(
        isTokenAuction
          ? {
              account: account as `0x${string}`,
              address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
              abi: AUCTION_ABI,
              functionName: 'bidWithToken',
              args: [auctionId, paymentToken as `0x${string}`, parsedAmount],
              maxFeePerGas: parseEther('0.00000002'),
              maxPriorityFeePerGas: parseEther('0.00000001'),
              chain: somniaTestnet,
            }
          : {
              account: account as `0x${string}`,
              address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
              abi: AUCTION_ABI,
              functionName: 'bid',
              args: [auctionId],
              value: parsedAmount,
              maxFeePerGas: parseEther('0.00000002'),
              maxPriorityFeePerGas: parseEther('0.00000001'),
              chain: somniaTestnet,
            }
      );
      showToast('success', `Tx Broadcast: ${hash.slice(0, 14)}...`);
    } catch (e: any) {
      const message = e?.shortMessage || e?.message || 'Transaction failed';
      showToast('error', message);
    }
    setLoading(false);
  };

  // Derive analytics data from local state
  const platformMetrics = useMemo(() => ({
    totalVolume: auctionsToRender.reduce((s, a) => s + a.currentBid, 0n),
    totalAuctions: BigInt(auctionsToRender.length),
    activeAuctions: BigInt(auctionsToRender.filter(a => a.phase === 0 || a.phase === 1).length),
    settledAuctions: BigInt(proofStats.settled),
    averageSettlementPrice: auctionsToRender.length > 0 ? auctionsToRender.reduce((s, a) => s + a.currentBid, 0n) / BigInt(auctionsToRender.length || 1) : 0n,
    averageDuration: 300n,
    totalBids: BigInt(proofStats.bids),
    uniqueBidders: BigInt(new Set(auctionsToRender.map(a => a.highestBidder).filter(b => b !== zeroAddress)).size),
  }), [auctionsToRender, proofStats]);

  if (showLanding) {
    return <LandingPage onLaunchApp={() => setShowLanding(false)} />;
  }

  return (
    <>
      {/* Animated background orbs */}
      <div className="bg-orbs">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
      <header className="header">
        <div className="header-brand">
          <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>⚡ ReactiveAuction</motion.h1>
          <span className="tag">SHANNON_TESTNET</span>
        </div>
        <div className="header-right">
          <div className="reactivity-badge">
            <span className="dot"></span>
            BK_REACTIVITY_V2
          </div>
          {account ? (
            <div className="wallet-actions">
               <button className="btn btn-secondary" onClick={switchNetwork}>
                <RotateCw size={14} /> Switch
              </button>
              <div className="wallet-info">
                <ShieldCheck size={14} /> {account.slice(0, 8)}
              </div>
            </div>
          ) : (
            <button className="btn btn-connect" onClick={connectWallet}>
              <PlusCircle size={14} /> Connect Vault
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <div className="stats-bar">
          {[
            { label: 'Network Pulse', value: auctionsToRender.length, icon: <Zap size={18} /> },
            { label: 'Dutch Liquidity', value: auctionsToRender.filter(a => a.auctionType === 0).length, icon: <TrendingDown size={18} /> },
            { label: 'Ascending Bid', value: auctionsToRender.filter(a => a.auctionType === 1).length, icon: <TrendingUp size={18} /> },
            { label: 'Global Vol', value: formatEther(auctionsToRender.reduce((s, a) => s + a.currentBid, 0n)) + ' STT', icon: <Trophy size={18} /> }
          ].map((s, i) => (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={s.label} className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="label">{s.label}</div>
                <div style={{ opacity: 0.3 }}>{s.icon}</div>
              </div>
              <div className="value">{s.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Tab Navigation */}
        <nav className="tab-nav">
          <button className={`tab-btn ${activeTab === 'market' ? 'active' : ''}`} onClick={() => setActiveTab('market')}>
            <LayoutGrid size={18} /> Market
            {auctionsToRender.length > 0 && <span className="tab-badge">{auctionsToRender.length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            <BarChart3 size={18} /> Analytics
          </button>
          <button className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>
            <Activity size={18} /> Activity
            {eventsToRender.length > 0 && <span className="tab-badge">{eventsToRender.length}</span>}
          </button>
        </nav>

        {/* ===== MARKET TAB ===== */}
        {activeTab === 'market' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key="market">
            <div className="section-header">
              <h2><LayoutGrid size={22} style={{ verticalAlign: 'middle', marginRight: '10px' }} /> LIVE_MARKET</h2>
              <div className="filters">
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                  <Plus size={16} /> Create Registry
                </button>
                <button className="btn btn-secondary" onClick={loadAuctions}>
                  <RotateCw size={16} /> Sync
                </button>
              </div>
            </div>

            {auctionsLoading ? (
              <div className="skeleton-grid">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-image" />
                    <div className="skeleton-body">
                      <div className="skeleton-block skeleton-title" />
                      <div className="skeleton-block skeleton-desc" />
                      <div className="skeleton-block skeleton-price" />
                      <div className="skeleton-block skeleton-btn" />
                    </div>
                  </div>
                ))}
              </div>
            ) : auctionsToRender.length === 0 ? (
              <div className="empty-state">
                <Zap size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                <h3>ARENA_STANDBY</h3>
                <p>No active smart contracts detected in current registry.</p>
              </div>
            ) : (
              <div className="auction-grid">
                {auctionsToRender.map((a) => (
                  <AuctionCard 
                    key={a.id.toString()} 
                    auction={a} 
                    account={account}
                    publicClient={publicClient}
                    getDutchPrice={getDutchPrice} 
                    formatTime={formatTime} 
                    formatAmount={formatAuctionAmount} 
                    getCurrencyLabel={getAuctionCurrencyLabel} 
                    onBid={placeBid} 
                    onCommit={commitSealedBid} 
                    onReveal={revealSealedBid} 
                    loading={loading}
                    isWatching={isWatchingAuction(a.id)}
                    onToggleWatch={(auctionId: bigint) => {
                      if (isWatchingAuction(auctionId)) {
                        unwatchAuction(auctionId);
                        showToast('info', `Stopped watching auction #${auctionId}`);
                      } else {
                        watchAuction(auctionId);
                        showToast('success', `Now watching auction #${auctionId}`);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ===== ANALYTICS TAB ===== */}
        {activeTab === 'analytics' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key="analytics">
            <div className="section-header">
              <h2><BarChart3 size={22} style={{ verticalAlign: 'middle', marginRight: '10px' }} /> ANALYTICS_ENGINE</h2>
            </div>
            <div className="analytics-grid">
              <div className="analytics-full">
                <PlatformMetricsCard metrics={platformMetrics} wsConnected={true} />
              </div>
              <div className="analytics-full">
                <LeaderboardTable entries={[]} wsConnected={true} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== ACTIVITY TAB ===== */}
        {activeTab === 'activity' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key="activity">
            <div className="proof-panel">
              <h3><ShieldCheck size={16} /> REACTIVITY_PROOF</h3>
              <div className="proof-grid">
                <div><span>Botless Execution</span><strong>ACTIVE</strong></div>
                <div><span>Created Events</span><strong>{proofStats.created}</strong></div>
                <div><span>Bid Events</span><strong>{proofStats.bids}</strong></div>
                <div><span>Auto Settled</span><strong>{proofStats.settled}</strong></div>
                <div><span>Anti-Snipe Ext</span><strong>{proofStats.extensions}</strong></div>
                <div><span>Phase Shifts</span><strong>{proofStats.phaseTransitions}</strong></div>
              </div>
              <p className="proof-tx">Last settle tx: {proofStats.lastSettlementTx ? `${proofStats.lastSettlementTx.slice(0, 12)}...` : 'n/a'}</p>
            </div>

            <div className={`safety-panel ${circuitBreaker.active ? 'active' : ''}`}>
              <h3><Zap size={16} /> TRUST_CIRCUIT_BREAKER</h3>
              <p>{circuitBreaker.active ? circuitBreaker.reason : 'System healthy. Live bidding and sealed actions are enabled.'}</p>
            </div>

            <div className="simulator-panel">
              <h3><TrendingUp size={16} /> LIVE_VALIDATOR</h3>
              <div className="simulator-controls">
                <input value={simAuctionId} onChange={(e) => setSimAuctionId(e.target.value)} placeholder="Auction id" />
                <input value={simBidInput} onChange={(e) => setSimBidInput(e.target.value)} placeholder="Bid amount" />
                <button className="btn btn-secondary" onClick={runScenarioSimulation}>Validate</button>
              </div>
              {simResult && <p className="simulator-result">{simResult}</p>}
            </div>

            <button className="btn btn-secondary" onClick={() => setNarrativeMode(v => !v)} style={{ marginBottom: '20px' }}>
              <History size={16} /> {narrativeMode ? 'Narrative: ON' : 'Narrative: OFF'}
            </button>

            {narrativeMode && (
              <div className="narrative-panel">
                <h3><History size={16} /> NARRATIVE_MODE</h3>
                <div className="narrative-lines">
                  {narrativeLines.map((line, idx) => (
                    <p key={`${line}-${idx}`}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            {eventsToRender.length > 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="event-feed">
                <h3><History size={16} /> REACTIVE_TIMELINE</h3>
                <div style={{ overflow: 'hidden' }}>
                  <AnimatePresence>
                    {eventsToRender.map((e) => (
                      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} key={e.id} className="event-item">
                        <div className={`event-icon ${e.type}`}>
                          {e.type === 'created' ? <Plus size={14} /> : e.type === 'bid' ? <Gavel size={14} /> : e.type === 'settled' ? <ShieldCheck size={14} /> : <Zap size={14} />}
                        </div>
                        <div className="event-content">
                          <span className="event-text" dangerouslySetInnerHTML={{ __html: e.message }}></span>
                          <small>{formatEventTime(e.timestamp)} {e.txHash ? `• ${e.txHash.slice(0, 10)}...` : ''}</small>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <div className="empty-state">
                <History size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                <h3>NO_EVENTS</h3>
                <p>Create an auction or place a bid to see real-time events here.</p>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>⚡ ReactiveAuction</h3>
            <p>Fully on-chain auction house powered by Somnia Native Reactivity. Zero bots. Zero keepers. Zero off-chain infrastructure.</p>
          </div>
          <div className="footer-section">
            <h4>Network</h4>
            <ul>
              <li><a href="https://shannon-explorer.somnia.network/" target="_blank" rel="noopener noreferrer">Shannon Explorer <ExternalLink size={11} /></a></li>
              <li><a href="https://testnet.somnia.network/" target="_blank" rel="noopener noreferrer">Faucet <ExternalLink size={11} /></a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Contracts</h4>
            <ul>
              <li><a href={`https://shannon-explorer.somnia.network/address/${CONTRACTS.AUCTION_HOUSE}`} target="_blank" rel="noopener noreferrer">Auction {CONTRACTS.AUCTION_HOUSE.slice(0, 8)}... <ExternalLink size={11} /></a></li>
              <li><a href={`https://shannon-explorer.somnia.network/address/${CONTRACTS.HANDLER}`} target="_blank" rel="noopener noreferrer">Handler {CONTRACTS.HANDLER.slice(0, 8)}... <ExternalLink size={11} /></a></li>
            </ul>
          </div>
          <hr className="footer-divider" />
          <div className="footer-bottom">
            <span>© 2026 ReactiveAuction — Somnia Reactivity Hackathon</span>
            <div className="footer-badges">
              <span className="footer-badge">Chain ID: 50312</span>
              <span className="footer-badge">Solidity 0.8.24</span>
              <span className="footer-badge">React 19</span>
            </div>
          </div>
        </div>
      </footer>

      {showCreateModal && <CreateAuctionModal walletClient={walletClient} account={account} supportsSealedAuctions={supportsSealedAuctions} resolveTokenDecimals={resolveTokenDecimals} resolveTokenSymbol={resolveTokenSymbol} onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); loadAuctions(); }} showToast={showToast} />}
      {toast && <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className={`toast ${toast.type}`}>{toast.message}</motion.div>}
    </>
  );
}

function AuctionCard({ auction, account, publicClient, getDutchPrice, formatTime, formatAmount, getCurrencyLabel, onBid, onCommit, onReveal, loading, isWatching, onToggleWatch }: any) {
  const [bidAmount, setBidAmount] = useState('');
  const [commitAmount, setCommitAmount] = useState('');
  const [revealAmount, setRevealAmount] = useState('');
  const [secret, setSecret] = useState('');
  const isDutch = auction.auctionType === 0;
  const isSealed = auction.auctionType === 2;
  const isTokenAuction = !!auction.paymentToken && auction.paymentToken.toLowerCase() !== zeroAddress;
  const currencyLabel = getCurrencyLabel(auction);
  const activeEndTime = isSealed && auction.phase === 1 ? auction.revealDeadline : auction.endTime;
  const timer = formatTime(activeEndTime);
  const currentPrice = isDutch ? getDutchPrice(auction) : auction.currentBid || auction.startPrice;
  const emoji = AUCTION_EMOJIS[Number(auction.id) % AUCTION_EMOJIS.length];

  const minBid = auction.currentBid === 0n ? auction.startPrice : auction.currentBid + auction.currentBid / 20n;
  const isOwnAuction = !!account && account.toLowerCase() === auction.seller.toLowerCase();
  const phaseLabel = PHASE_LABELS[Number(auction.phase)] || 'UNKNOWN';

  const ensureSecret = () => {
    if (secret.trim()) return secret;
    const generated = toHex(`secret-${Date.now()}-${auction.id.toString()}`, { size: 32 });
    setSecret(generated);
    return generated;
  };

  const cardClass = isDutch ? 'dutch-card' : isSealed ? '' : 'english-card';

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`auction-card ${cardClass}`}>
      <div className="auction-card-image">
        {emoji}
        <span className={`auction-type-badge ${isDutch ? 'badge-dutch' : 'badge-english'}`}>{isDutch ? 'DUTCH' : isSealed ? 'SEALED' : 'ASCENDING'}</span>
        <button 
          onClick={() => onToggleWatch(auction.id)} 
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: isWatching ? 'rgba(16, 185, 129, 0.8)' : 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s'
          }}
          title={isWatching ? 'Unwatch auction' : 'Watch auction'}
        >
          {isWatching ? <Eye size={18} color="white" /> : <EyeOff size={18} color="white" />}
        </button>
      </div>
      <div className="auction-card-body">
        <h3>{auction.title || `CONTRACT_#${auction.id}`}</h3>
        <p className="description">{auction.description}</p>
        
        {/* Use PhaseIndicator component for sealed auctions */}
        {isSealed && (
          <PhaseIndicator 
            phase={auction.phase}
            endTime={auction.endTime}
            revealDeadline={auction.revealDeadline}
            auctionType={auction.auctionType}
          />
        )}
        
        {!isSealed && <div className="seller-info">Phase: {phaseLabel}</div>}
        {auction.config?.currentExtensions > 0n && <div className="seller-info">Anti-Snipe Extensions: {auction.config.currentExtensions.toString()}</div>}
        <div className="price-section">
          <div className="price-current">
            <span className="label">Valuation</span>
            <span className="amount">{formatAmount(auction, currentPrice)} <span style={{ fontSize: '0.6rem' }}>{currencyLabel}</span></span>
          </div>
          <div className="countdown">
            <span className="label">TTL</span>
            <span className={`time ${timer.expired ? 'expired' : timer.timerClass || ''}`}>{timer.text}</span>
          </div>
        </div>
        <div className="seller-info">Origin: {auction.seller.slice(0, 10)}...</div>
        {isTokenAuction && <div className="seller-info">Token: {auction.paymentToken.slice(0, 10)}...</div>}
        {!timer.expired && (
          isSealed ? (
            auction.phase === 0 ? (
              <div className="sealed-actions">
                <input type="text" placeholder="Commit amount (STT)" value={commitAmount} onChange={e => setCommitAmount(e.target.value)} />
                <input type="text" placeholder="Secret (optional, auto-generated)" value={secret} onChange={e => setSecret(e.target.value)} />
                <button className="btn btn-english" onClick={() => onCommit(auction.id, commitAmount, ensureSecret())} disabled={loading || !commitAmount || isOwnAuction}>
                  {isOwnAuction ? 'Own Auction' : 'Commit Bid'}
                </button>
              </div>
            ) : (
              <div className="sealed-actions">
                <input type="text" placeholder="Reveal amount (STT)" value={revealAmount} onChange={e => setRevealAmount(e.target.value)} />
                <input type="text" placeholder="Secret used at commit" value={secret} onChange={e => setSecret(e.target.value)} />
                <button className="btn btn-dutch" onClick={() => onReveal(auction.id, revealAmount, secret)} disabled={loading || !revealAmount || isOwnAuction}>
                  {isOwnAuction ? 'Own Auction' : 'Reveal Bid'}
                </button>
              </div>
            )
          ) : isDutch ? (
            <button className="btn btn-dutch" onClick={() => onBid(auction.id, formatAmount(auction, currentPrice), auction.paymentToken, auction.auctionType)} disabled={loading || isOwnAuction} style={{ width: '100%' }}>
              <Zap size={14} /> {isOwnAuction ? 'Own Auction' : `Instant Buy (${currencyLabel})`}
            </button>
          ) : (
            <div className="bid-input-group">
              <input type="text" placeholder={`Min: ${formatAmount(auction, minBid)}`} value={bidAmount} onChange={e => setBidAmount(e.target.value)} />
              <button className="btn btn-english" onClick={() => onBid(auction.id, bidAmount, auction.paymentToken, auction.auctionType)} disabled={loading || !bidAmount || isOwnAuction}>{isOwnAuction ? 'Own Auction' : 'Bid'}</button>
            </div>
          )
        )}
        <BidHistoryPanel auctionId={auction.id} publicClient={publicClient} />
      </div>
    </motion.div>
  );
}

function CreateAuctionModal({ walletClient, account, supportsSealedAuctions, resolveTokenDecimals, resolveTokenSymbol, onClose, onCreated, showToast }: any) {
  const [type, setType] = useState<'dutch' | 'english' | 'sealed'>('dutch');
  const [title, setTitle] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [endPrice, setEndPrice] = useState('');
  const [duration, setDuration] = useState('300');
  const [revealDuration, setRevealDuration] = useState('300');
  const [paymentToken, setPaymentToken] = useState('');
  const [unitLabel, setUnitLabel] = useState('STT');
  const [tokenDecimalsPreview, setTokenDecimalsPreview] = useState(18);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      const tokenAddress = paymentToken.trim();
      if (!tokenAddress) {
        setUnitLabel('STT');
        setTokenDecimalsPreview(18);
        return;
      }

      try {
        const decimals = await resolveTokenDecimals(tokenAddress);
        const symbol = await resolveTokenSymbol(tokenAddress);
        if (!cancelled) {
          setTokenDecimalsPreview(decimals);
          setUnitLabel(symbol || 'TOKEN');
        }
      } catch {
        if (!cancelled) {
          setTokenDecimalsPreview(18);
          setUnitLabel('TOKEN');
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [paymentToken, resolveTokenDecimals, resolveTokenSymbol]);

  const handleCreate = async () => {
    if (!walletClient || !account) return showToast('error', 'Auth Locked');
    if (type === 'sealed' && !supportsSealedAuctions) {
      return showToast('error', 'Current deployed contract does not support sealed auctions. Redeploy latest contract and update address.');
    }
    setCreating(true);
    try {
      const tokenAddress = paymentToken.trim();
      const useToken = type !== 'sealed' && tokenAddress.length > 0;
      const decimals = useToken ? await resolveTokenDecimals(tokenAddress) : 18;

      const args = type === 'dutch'
        ? useToken
          ? [parseUnits(startPrice, decimals), parseUnits(endPrice, decimals), BigInt(duration), title, '', '', tokenAddress]
          : [parseEther(startPrice), parseEther(endPrice), BigInt(duration), title, '', '']
        : type === 'english'
          ? useToken
            ? [parseUnits(startPrice, decimals), BigInt(duration), title, '', '', tokenAddress]
            : [parseEther(startPrice), BigInt(duration), title, '', '']
          : [parseEther(startPrice), BigInt(duration), BigInt(revealDuration), title, '', ''];

      const functionName = type === 'dutch'
        ? (useToken ? 'createDutchAuctionWithToken' : 'createDutchAuction')
        : type === 'english'
          ? (useToken ? 'createEnglishAuctionWithToken' : 'createEnglishAuction')
          : 'createSealedBidAuction';
      
      await walletClient.writeContract({
        account: account as `0x${string}`,
        address: CONTRACTS.AUCTION_HOUSE as `0x${string}`,
        abi: AUCTION_ABI,
        functionName,
        args,
        maxFeePerGas: parseEther('0.00000002'),
        chain: somniaTestnet,
      });
      showToast('success', 'Genesis Created');
      onCreated();
    } catch (e: any) {
      showToast('error', e?.shortMessage || e?.message || 'Execution Failed');
    }
    setCreating(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2>NEW_GENESIS</h2>
          <X size={20} onClick={onClose} style={{ cursor: 'pointer', opacity: 0.5 }} />
        </div>
        <div className="type-selector">
          <div className={`type-option ${type === 'dutch' ? 'active dutch' : ''}`} onClick={() => setType('dutch')}>📉 DUTCH</div>
          <div className={`type-option ${type === 'english' ? 'active english' : ''}`} onClick={() => setType('english')}>📈 ASCENDING</div>
          <div className={`type-option ${type === 'sealed' ? 'active english' : ''} ${!supportsSealedAuctions ? 'disabled' : ''}`} onClick={() => supportsSealedAuctions && setType('sealed')}>🔐 SEALED</div>
        </div>
        {!supportsSealedAuctions && <div className="seller-info">Sealed mode disabled: connected contract is older and lacks sealed-bid methods.</div>}
        
        {/* Use SealedBidAuctionForm component for sealed auctions */}
        {type === 'sealed' && supportsSealedAuctions ? (
          <SealedBidAuctionForm
            walletClient={walletClient}
            account={account}
            onSuccess={(auctionId) => {
              showToast('success', `Sealed auction created: #${auctionId}`);
              onCreated();
            }}
            onError={(message) => showToast('error', message)}
          />
        ) : (
          <>
            <div className="form-group"><label>Asset Title</label><input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="form-group"><label>Initial Valuation ({unitLabel})</label><input value={startPrice} onChange={e => setStartPrice(e.target.value)} /></div>
            {type === 'dutch' && <div className="form-group"><label>Floor Valuation ({unitLabel})</label><input value={endPrice} onChange={e => setEndPrice(e.target.value)} /></div>}
            {type !== 'sealed' && (
              <div className="form-group">
                <label>Payment Token (optional ERC20 address)</label>
                <input value={paymentToken} onChange={e => setPaymentToken(e.target.value)} placeholder="0x... (leave empty for STT)" />
                {!!paymentToken.trim() && <small style={{ opacity: 0.7 }}>Using token units with {tokenDecimalsPreview} decimals</small>}
              </div>
            )}
            <div className="form-group">
              <label>Window (Sec)</label>
              <select value={duration} onChange={e => setDuration(e.target.value)}>
                <option value="300">300 (PROD)</option>
                <option value="60">60 (TEST)</option>
              </select>
            </div>
            {type === 'sealed' && (
              <div className="form-group">
                <label>Reveal Window (Sec)</label>
                <select value={revealDuration} onChange={e => setRevealDuration(e.target.value)}>
                  <option value="300">300 (PROD)</option>
                  <option value="60">60 (TEST)</option>
                </select>
              </div>
            )}
            <button className={`btn ${type === 'dutch' ? 'btn-dutch' : 'btn-english'}`} onClick={handleCreate} disabled={creating} style={{ width: '100%', marginTop: '20px' }}>
              {creating ? 'SYSTRAN_INIT...' : 'DEPLOY_CONTRACT'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
