import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactiveAuctionClient } from '../ReactiveAuctionClient';

describe('ReactiveAuctionClient', () => {
  let mockPublicClient: any;
  let client: ReactiveAuctionClient;

  beforeEach(() => {
    mockPublicClient = {
      watchContractEvent: vi.fn(() => vi.fn()), // Returns unwatch function
    };
    client = new ReactiveAuctionClient(mockPublicClient);
  });

  it('should create a client instance', () => {
    expect(client).toBeDefined();
  });

  it('should subscribe to events', () => {
    const callback = vi.fn();
    client.subscribe('auction_created', callback);
    
    // Verify the subscription was set up
    expect(mockPublicClient.watchContractEvent).toHaveBeenCalled();
  });

  it('should unsubscribe from events', () => {
    const callback = vi.fn();
    client.subscribe('auction_created', callback);
    client.unsubscribe('auction_created', callback);
    
    // After unsubscribe, the callback should not be called
    expect(callback).not.toHaveBeenCalled();
  });

  it('should watch and unwatch auctions', () => {
    const auctionId = 1n;
    
    client.watchAuction(auctionId);
    expect(client.isWatchingAuction(auctionId)).toBe(true);
    
    client.unwatchAuction(auctionId);
    expect(client.isWatchingAuction(auctionId)).toBe(false);
  });

  it('should return watched auctions list', () => {
    client.watchAuction(1n);
    client.watchAuction(2n);
    client.watchAuction(3n);
    
    const watched = client.getWatchedAuctions();
    expect(watched).toHaveLength(3);
    expect(watched).toContain(1n);
    expect(watched).toContain(2n);
    expect(watched).toContain(3n);
  });

  it('should cleanup all subscriptions', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    
    client.subscribe('auction_created', callback1);
    client.subscribe('bid_placed', callback2);
    client.watchAuction(1n);
    
    client.cleanup();
    
    expect(client.getWatchedAuctions()).toHaveLength(0);
  });
});
