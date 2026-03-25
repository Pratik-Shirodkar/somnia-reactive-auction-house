# Real-Time WebSocket Integration

This document describes the real-time WebSocket integration implemented for the ReactiveAuction frontend.

## Overview

The frontend now features a comprehensive real-time event system that provides instant updates for all auction activities without requiring page refreshes or polling.

## Components

### 1. ReactiveAuctionClient (`src/lib/ReactiveAuctionClient.ts`)

A centralized client for managing WebSocket subscriptions to contract events.

**Features:**
- Subscribe/unsubscribe to specific event types
- Watch/unwatch individual auctions for notifications
- Automatic event routing to registered callbacks
- Clean separation of concerns

**Supported Events:**
- `auction_created` - New auctions created
- `bid_placed` - New bids placed
- `auction_settled` - Auctions finalized
- `auction_extended` - Anti-snipe extensions
- `phase_transition` - Phase changes (sealed auctions)
- `sealed_bid_committed` - Sealed bid commitments
- `sealed_bid_revealed` - Sealed bid reveals
- `analytics_updated` - Platform analytics updates (future)
- `price_updated` - Dutch auction price updates (future)
- `price_alert` - Price alert triggers (future)
- `achievement_unlocked` - User achievements (future)
- `reputation_updated` - Reputation changes (future)

**Usage:**
```typescript
const client = new ReactiveAuctionClient(publicClient);

// Subscribe to events
client.subscribe('bid_placed', (data) => {
  console.log('New bid:', data);
});

// Watch specific auction
client.watchAuction(auctionId);

// Cleanup
client.cleanup();
```

### 2. useReactiveAuction Hook (`src/hooks/useReactiveAuction.ts`)

React hook that manages the ReactiveAuctionClient lifecycle.

**Features:**
- Automatic client creation and cleanup
- Connection status tracking
- Convenient subscription management

**Usage:**
```typescript
const { 
  subscribe, 
  unsubscribe, 
  watchAuction, 
  unwatchAuction,
  isWatchingAuction,
  isConnected 
} = useReactiveAuction(publicClient);
```

### 3. Notification System

#### useNotifications Hook (`src/hooks/useNotifications.ts`)

Manages notification state and lifecycle.

**Features:**
- Add notifications with type, title, and message
- Auto-dismiss after 5 seconds
- Manual dismiss capability
- Notification history (last 50)

**Usage:**
```typescript
const { notifications, addNotification, dismissNotification } = useNotifications();

addNotification('success', 'Auction Created', 'Your auction is now live!');
```

#### NotificationCenter Component (`src/components/NotificationCenter.tsx`)

Visual notification display with animations.

**Features:**
- Animated entry/exit
- Color-coded by type (info, success, warning, error)
- Icon indicators
- Manual dismiss buttons
- Responsive design

## Integration in App.tsx

The main App component now includes:

1. **Real-time Event Subscriptions:**
   - Automatic subscription to all auction events
   - Event handlers that update UI state
   - Notification triggers for watched auctions

2. **Watchlist Functionality:**
   - Eye icon on auction cards to watch/unwatch
   - Visual indicator when watching
   - Notifications for watched auction events

3. **Notification Display:**
   - NotificationCenter component in header
   - Toast messages for user actions
   - Event-driven notifications

## Event Flow

```
Contract Event Emitted
    ↓
Viem watchContractEvent
    ↓
ReactiveAuctionClient.notifySubscribers()
    ↓
Event Handler in App.tsx
    ↓
State Updates + Notifications
    ↓
UI Re-renders
```

## Features Implemented

### Task 22.1: ReactiveAuctionClient Class ✅
- WebSocket connection via viem's watchContractEvent
- Subscribe/unsubscribe methods
- watchAuction/unwatchAuction methods
- Error handling and cleanup

### Task 22.2: Real-time Auction List Updates ✅
- Subscribe to AuctionCreated events
- Immediate auction list refresh
- Notification for new auctions

### Task 22.3: Real-time Bid Updates ✅
- Subscribe to BidPlaced events
- Update auction state immediately
- Notifications for watched auctions
- Bid history updates in real-time

### Task 22.4: Real-time Analytics Dashboard ⏳
- Infrastructure ready for AnalyticsUpdated events
- Event type defined in ReactiveAuctionClient
- Requires AnalyticsEngine contract deployment

### Task 22.5: Real-time Price Updates ⏳
- Infrastructure ready for PriceUpdated events
- Event type defined in ReactiveAuctionClient
- Requires PriceOracle contract deployment

### Task 22.6: Notification System ✅
- Watched auction notifications
- Bid notifications
- Settlement notifications
- Extension notifications
- Phase transition notifications

## Future Enhancements

1. **Analytics Dashboard:**
   - Subscribe to AnalyticsUpdated events
   - Real-time platform metrics
   - Leaderboard updates

2. **Price Updates:**
   - Subscribe to PriceUpdated events
   - Dutch auction price countdown
   - Client-side price calculation

3. **Advanced Notifications:**
   - 10-minute expiry warnings
   - Price alert triggers
   - Achievement unlocks
   - Reputation updates

4. **Persistence:**
   - Save watchlist to localStorage
   - Notification preferences
   - Event history

## Testing

Basic unit tests are provided in `src/lib/__tests__/ReactiveAuctionClient.test.ts`.

Run tests:
```bash
npm test
```

## Performance Considerations

- Event subscriptions are cleaned up on unmount
- Notifications auto-dismiss to prevent memory leaks
- Efficient state updates using React hooks
- Minimal re-renders through proper dependency management

## Browser Compatibility

The WebSocket integration uses viem's built-in WebSocket transport, which is compatible with:
- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- All modern mobile browsers

## Troubleshooting

**Events not firing:**
- Check that publicClient is initialized
- Verify contract address in config/chain.ts
- Ensure you're connected to Somnia testnet

**Notifications not showing:**
- Check browser console for errors
- Verify NotificationCenter is rendered
- Check notification state in React DevTools

**Memory leaks:**
- Ensure cleanup() is called on unmount
- Check that event handlers are properly unsubscribed
- Monitor notification count (should not exceed 50)
