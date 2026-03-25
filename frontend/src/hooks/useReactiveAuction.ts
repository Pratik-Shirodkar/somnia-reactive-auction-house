import { useEffect, useRef, useState } from 'react';
import { type PublicClient } from 'viem';
import { ReactiveAuctionClient, type EventType } from '../lib/ReactiveAuctionClient';

export function useReactiveAuction(publicClient: PublicClient | null) {
  const clientRef = useRef<ReactiveAuctionClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!publicClient) {
      setIsConnected(false);
      return;
    }

    // Create client
    clientRef.current = new ReactiveAuctionClient(publicClient);
    setIsConnected(true);

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.cleanup();
        clientRef.current = null;
      }
      setIsConnected(false);
    };
  }, [publicClient]);

  const subscribe = (eventType: EventType, callback: (data: any) => void) => {
    if (clientRef.current) {
      clientRef.current.subscribe(eventType, callback);
    }
  };

  const unsubscribe = (eventType: EventType, callback: (data: any) => void) => {
    if (clientRef.current) {
      clientRef.current.unsubscribe(eventType, callback);
    }
  };

  const watchAuction = (auctionId: bigint) => {
    if (clientRef.current) {
      clientRef.current.watchAuction(auctionId);
    }
  };

  const unwatchAuction = (auctionId: bigint) => {
    if (clientRef.current) {
      clientRef.current.unwatchAuction(auctionId);
    }
  };

  const isWatchingAuction = (auctionId: bigint): boolean => {
    return clientRef.current?.isWatchingAuction(auctionId) ?? false;
  };

  const getWatchedAuctions = (): bigint[] => {
    return clientRef.current?.getWatchedAuctions() ?? [];
  };

  return {
    client: clientRef.current,
    isConnected,
    subscribe,
    unsubscribe,
    watchAuction,
    unwatchAuction,
    isWatchingAuction,
    getWatchedAuctions,
  };
}
