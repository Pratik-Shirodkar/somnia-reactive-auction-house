import { type PublicClient } from 'viem';
import { AUCTION_ABI } from '../abi/auction';
import { CONTRACTS } from '../config/chain';

export type EventType = 
  | 'auction_created' 
  | 'bid_placed' 
  | 'auction_settled' 
  | 'auction_extended' 
  | 'phase_transition' 
  | 'sealed_bid_committed'
  | 'sealed_bid_revealed'
  | 'analytics_updated'
  | 'price_updated'
  | 'price_alert'
  | 'achievement_unlocked'
  | 'reputation_updated';

export interface WebSocketMessage {
  type: EventType;
  data: any;
  timestamp: number;
}

type EventCallback = (data: any) => void;

export class ReactiveAuctionClient {
  private publicClient: PublicClient;
  private subscriptions: Map<EventType, Set<EventCallback>>;
  private unwatchFunctions: Map<EventType, () => void>;
  private watchedAuctions: Set<bigint>;

  constructor(publicClient: PublicClient) {
    this.publicClient = publicClient;
    this.subscriptions = new Map();
    this.unwatchFunctions = new Map();
    this.watchedAuctions = new Set();
  }

  /**
   * Subscribe to specific event types
   */
  subscribe(eventType: EventType, callback: EventCallback): void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    
    this.subscriptions.get(eventType)!.add(callback);

    // Set up contract event watcher if not already watching
    if (!this.unwatchFunctions.has(eventType)) {
      this.setupEventWatcher(eventType);
    }
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: EventType, callback: EventCallback): void {
    const callbacks = this.subscriptions.get(eventType);
    if (callbacks) {
      callbacks.delete(callback);
      
      // If no more callbacks, stop watching
      if (callbacks.size === 0) {
        this.stopEventWatcher(eventType);
      }
    }
  }

  /**
   * Watch specific auction for all events
   */
  watchAuction(auctionId: bigint): void {
    this.watchedAuctions.add(auctionId);
  }

  /**
   * Stop watching specific auction
   */
  unwatchAuction(auctionId: bigint): void {
    this.watchedAuctions.delete(auctionId);
  }

  /**
   * Check if auction is being watched
   */
  isWatchingAuction(auctionId: bigint): boolean {
    return this.watchedAuctions.has(auctionId);
  }

  /**
   * Get all watched auctions
   */
  getWatchedAuctions(): bigint[] {
    return Array.from(this.watchedAuctions);
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    this.unwatchFunctions.forEach((unwatch) => unwatch());
    this.unwatchFunctions.clear();
    this.subscriptions.clear();
    this.watchedAuctions.clear();
  }

  /**
   * Setup event watcher for specific event type
   */
  private setupEventWatcher(eventType: EventType): void {
    let unwatch: (() => void) | null = null;

    switch (eventType) {
      case 'auction_created':
        unwatch = this.publicClient.watchContractEvent({
          address: CONTRACTS.AUCTION_HOUSE,
          abi: AUCTION_ABI,
          eventName: 'AuctionCreated',
          onLogs: (logs) => {
            logs.forEach((log: any) => {
              this.notifySubscribers('auction_created', {
                auctionId: log.args.auctionId,
                seller: log.args.seller,
                auctionType: log.args.auctionType,
                startPrice: log.args.startPrice,
                endTime: log.args.endTime,
                title: log.args.title,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            });
          },
        });
        break;

      case 'bid_placed':
        unwatch = this.publicClient.watchContractEvent({
          address: CONTRACTS.AUCTION_HOUSE,
          abi: AUCTION_ABI,
          eventName: 'BidPlaced',
          onLogs: (logs) => {
            logs.forEach((log: any) => {
              this.notifySubscribers('bid_placed', {
                auctionId: log.args.auctionId,
                bidder: log.args.bidder,
                amount: log.args.amount,
                timestamp: log.args.timestamp,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            });
          },
        });
        break;

      case 'auction_settled':
        unwatch = this.publicClient.watchContractEvent({
          address: CONTRACTS.AUCTION_HOUSE,
          abi: AUCTION_ABI,
          eventName: 'AuctionSettled',
          onLogs: (logs) => {
            logs.forEach((log: any) => {
              this.notifySubscribers('auction_settled', {
                auctionId: log.args.auctionId,
                winner: log.args.winner,
                finalPrice: log.args.finalPrice,
                timestamp: log.args.timestamp,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            });
          },
        });
        break;

      case 'auction_extended':
        unwatch = this.publicClient.watchContractEvent({
          address: CONTRACTS.AUCTION_HOUSE,
          abi: AUCTION_ABI,
          eventName: 'AuctionExtended',
          onLogs: (logs) => {
            logs.forEach((log: any) => {
              this.notifySubscribers('auction_extended', {
                auctionId: log.args.auctionId,
                newEndTime: log.args.newEndTime,
                extensionCount: log.args.extensionCount,
                timestamp: log.args.timestamp,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            });
          },
        });
        break;

      case 'phase_transition':
        unwatch = this.publicClient.watchContractEvent({
          address: CONTRACTS.AUCTION_HOUSE,
          abi: AUCTION_ABI,
          eventName: 'PhaseTransition',
          onLogs: (logs) => {
            logs.forEach((log: any) => {
              this.notifySubscribers('phase_transition', {
                auctionId: log.args.auctionId,
                fromPhase: log.args.fromPhase,
                toPhase: log.args.toPhase,
                timestamp: log.args.timestamp,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            });
          },
        });
        break;

      case 'sealed_bid_committed':
        unwatch = this.publicClient.watchContractEvent({
          address: CONTRACTS.AUCTION_HOUSE,
          abi: AUCTION_ABI,
          eventName: 'SealedBidCommitted',
          onLogs: (logs) => {
            logs.forEach((log: any) => {
              this.notifySubscribers('sealed_bid_committed', {
                auctionId: log.args.auctionId,
                bidder: log.args.bidder,
                commitment: log.args.commitment,
                timestamp: log.args.timestamp,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            });
          },
        });
        break;

      case 'sealed_bid_revealed':
        unwatch = this.publicClient.watchContractEvent({
          address: CONTRACTS.AUCTION_HOUSE,
          abi: AUCTION_ABI,
          eventName: 'SealedBidRevealed',
          onLogs: (logs) => {
            logs.forEach((log: any) => {
              this.notifySubscribers('sealed_bid_revealed', {
                auctionId: log.args.auctionId,
                bidder: log.args.bidder,
                amount: log.args.amount,
                timestamp: log.args.timestamp,
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            });
          },
        });
        break;

      default:
        console.warn(`Event type ${eventType} not yet implemented`);
        return;
    }

    if (unwatch) {
      this.unwatchFunctions.set(eventType, unwatch);
    }
  }

  /**
   * Stop watching specific event type
   */
  private stopEventWatcher(eventType: EventType): void {
    const unwatch = this.unwatchFunctions.get(eventType);
    if (unwatch) {
      unwatch();
      this.unwatchFunctions.delete(eventType);
    }
  }

  /**
   * Notify all subscribers of an event
   */
  private notifySubscribers(eventType: EventType, data: any): void {
    const callbacks = this.subscriptions.get(eventType);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} callback:`, error);
        }
      });
    }
  }
}
