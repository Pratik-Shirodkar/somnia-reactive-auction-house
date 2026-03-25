# Technical Design: Hackathon-Winning Enhancements

## Overview

This design transforms ReactiveAuction into a showcase of Somnia Reactivity's capabilities through advanced auction mechanics, cascading event chains, and real-time analytics. The enhancements demonstrate patterns that competitors haven't explored: cryptographic commit-reveal schemes with reactive settlement, multi-phase workflows with dynamic subscription management, cross-contract event cascades, and real-time price discovery engines.

The current system provides basic Dutch/English auctions with single-event reactivity (Schedule → settle). These enhancements introduce:

- **Sealed-bid auctions** with commit-reveal cryptography and multi-phase reactive workflows
- **Anti-sniping protection** with dynamic Schedule event rescheduling
- **Bundle auctions** with atomic multi-item settlement
- **Cascading reactive events** where one event triggers creation of new subscriptions
- **Real-time analytics** computed reactively from bid streams
- **Reputation system** with achievement events and milestone tracking
- **Multi-currency support** with reactive price feed integration
- **NFT/ERC20 auctions** with escrow and atomic transfers
- **Fraud detection** using pattern analysis on reactive event streams

The architecture maintains the existing ReactiveAuction and AuctionHandler contracts while adding new specialized contracts for advanced features. All enhancements leverage Somnia's reactivity precompile (0x6900...0001) to eliminate off-chain infrastructure.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auction UI   │  │ Analytics    │  │ WebSocket    │          │
│  │ Components   │  │ Dashboard    │  │ Feed Client  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Smart Contract Layer                         │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ReactiveAuction (Enhanced)                   │  │
│  │  • Dutch/English/Sealed-Bid/Bundle auction types         │  │
│  │  • Anti-snipe extensions, bid history, reputation        │  │
│  │  • NFT/ERC20 escrow, multi-currency support              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           AuctionHandler (Enhanced)                       │  │
│  │  • Multi-phase workflow orchestration                     │  │
│  │  • Dynamic subscription management                        │  │
│  │  • Cascading event triggers                               │  │
│  │  • Schedule event rescheduling                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              AnalyticsEngine                              │  │
│  │  • Real-time volume/velocity calculations                │  │
│  │  • Price prediction and trend analysis                    │  │
│  │  • Leaderboard and reputation tracking                    │  │
│  │  • Fraud detection pattern matching                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              PriceOracle                                  │  │
│  │  • Multi-currency exchange rate feeds                     │  │
│  │  • Dutch auction price calculations                       │  │
│  │  • Price prediction algorithms                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Somnia Reactivity Precompile                        │
│                   (0x6900...0001)                                │
│  • Event subscriptions (AuctionCreated, BidPlaced, etc.)        │
│  • Schedule events (settlement, reveal deadlines, reminders)    │
│  • Guaranteed execution for critical operations                 │
│  • Dynamic subscription creation/cancellation                   │
└─────────────────────────────────────────────────────────────────┘
```

### Reactive Event Flow Patterns

#### Pattern 1: Multi-Phase Sealed-Bid Workflow

```
User creates sealed auction
    ↓
AuctionCreated event emitted
    ↓
Handler subscribes to Schedule(biddingEndTime)
    ↓
[Bidding Phase: users submit commitments]
    ↓
Schedule(biddingEndTime) fires
    ↓
Handler transitions auction to REVEAL phase
Handler subscribes to Schedule(revealEndTime)
    ↓
[Reveal Phase: users reveal bids]
    ↓
Schedule(revealEndTime) fires
    ↓
Handler determines winner from valid reveals
Handler settles auction automatically
```

#### Pattern 2: Anti-Snipe Dynamic Rescheduling

```
Auction active with Schedule(endTime) subscription
    ↓
BidPlaced event within extension threshold
    ↓
Handler detects late bid via onEvent()
Handler cancels existing Schedule subscription
Handler extends auction endTime
Handler creates new Schedule(newEndTime) subscription
    ↓
[Process repeats up to maxExtensions limit]
    ↓
Final Schedule(endTime) fires
    ↓
Handler settles auction
```

#### Pattern 3: Cascading Event Chain

```
High-value auction settles (>100 STT)
    ↓
AuctionSettled event emitted
    ↓
Handler detects high-value settlement
Handler creates follow-up auction automatically
Handler emits AuctionCreated for new auction
    ↓
New AuctionCreated triggers standard workflow
Handler schedules settlement for new auction
    ↓
[Cascade continues based on business logic]
```

#### Pattern 4: Real-Time Analytics Updates

```
BidPlaced event emitted
    ↓
AnalyticsEngine subscribed to BidPlaced
AnalyticsEngine.onEvent() triggered
    ↓
Update total platform volume
Update auction velocity metrics
Update bidder leaderboard
Recalculate price predictions
    ↓
Emit AnalyticsUpdated event
    ↓
Frontend WebSocket receives update
UI refreshes within 2 seconds
```

### Contract Interaction Patterns

The system uses three primary interaction patterns:

1. **User → Contract**: Direct function calls for auction creation, bidding, revealing
2. **Contract → Precompile**: Subscription creation via ISomniaReactivityPrecompile interface
3. **Precompile → Handler**: Automatic onEvent() invocation when subscribed events fire

All reactive operations use `isGuaranteed: true` for critical paths (settlement, reveal deadlines) and `isGuaranteed: false` for non-critical analytics updates.

## Components and Interfaces

### ReactiveAuction Contract (Enhanced)

Extends existing contract with new auction types and features.

#### New Enums and Structs

```solidity
enum AuctionType { 
    DUTCH,      // Price decreases over time
    ENGLISH,    // Ascending bids
    SEALED_BID, // Commit-reveal bidding
    BUNDLE      // Multiple items, atomic settlement
}

enum AuctionPhase {
    BIDDING,    // Active bidding period
    REVEAL,     // Sealed-bid reveal period (sealed auctions only)
    SETTLING,   // Settlement in progress
    SETTLED,    // Completed
    CANCELLED   // Cancelled by seller or system
}

struct SealedBid {
    address bidder;
    bytes32 commitment;  // keccak256(abi.encodePacked(amount, secret))
    uint256 revealedAmount;
    bool revealed;
    uint256 timestamp;
}

struct BundleItem {
    address tokenContract;  // NFT or ERC20 contract
    uint256 tokenId;        // For ERC721, 0 for ERC20
    uint256 amount;         // For ERC20, 1 for ERC721
    TokenType tokenType;
}

enum TokenType { NATIVE, ERC20, ERC721 }

struct AuctionConfig {
    bool antiSnipeEnabled;
    uint256 extensionThreshold;  // Seconds before end to trigger extension
    uint256 extensionDuration;   // Seconds to extend
    uint256 maxExtensions;       // Maximum number of extensions
    uint256 currentExtensions;   // Current extension count
}

struct Auction {
    uint256 id;
    address seller;
    AuctionType auctionType;
    AuctionPhase phase;
    
    // Pricing
    uint256 startPrice;
    uint256 endPrice;
    uint256 currentBid;
    address highestBidder;
    
    // Timing
    uint256 startTime;
    uint256 endTime;
    uint256 revealDeadline;  // For sealed-bid auctions
    
    // Configuration
    AuctionConfig config;
    
    // Bundle data
    BundleItem[] bundleItems;
    
    // Sealed-bid data
    mapping(address => SealedBid) sealedBids;
    address[] sealedBidders;
    
    // Metadata
    string title;
    string description;
    string imageUrl;
    
    // Multi-currency
    address paymentToken;  // address(0) for native STT
}

struct BidRecord {
    address bidder;
    uint256 amount;
    uint256 timestamp;
    bool successful;
    string failureReason;
}

struct UserReputation {
    uint256 score;
    uint256 auctionsWon;
    uint256 auctionsCreated;
    uint256 totalVolume;
    uint256 failedReveals;
    uint256 trustScore;  // 0-100
}

struct AuctionTemplate {
    string name;
    AuctionType auctionType;
    uint256 startPrice;
    uint256 endPrice;
    uint256 duration;
    AuctionConfig config;
    uint256 usageCount;
    bool isPublic;
}
```

#### New State Variables

```solidity
// Bid history tracking
mapping(uint256 => BidRecord[]) public bidHistory;

// Reputation system
mapping(address => UserReputation) public userReputation;

// Watchlist
mapping(address => uint256[]) public userWatchlist;
mapping(uint256 => uint256) public auctionWatcherCount;

// Templates
mapping(address => mapping(uint256 => AuctionTemplate)) public userTemplates;
mapping(address => uint256) public userTemplateCount;

// Price alerts
struct PriceAlert {
    address user;
    uint256 auctionId;
    uint256 targetPrice;
    bool triggered;
}
mapping(uint256 => PriceAlert[]) public priceAlerts;

// Fraud detection
mapping(address => uint256) public lastBidTimestamp;
mapping(address => uint256) public bidCountLastHour;
mapping(uint256 => bool) public flaggedAuctions;

// Emergency controls
bool public systemPaused;
uint256 public pauseStartTime;
```

#### Key Functions

```solidity
// Sealed-bid auction creation
function createSealedBidAuction(
    uint256 _startPrice,
    uint256 _biddingDuration,
    uint256 _revealDuration,
    string calldata _title,
    string calldata _description,
    string calldata _imageUrl
) external returns (uint256);

// Commit phase: submit cryptographic commitment
function commitBid(uint256 _auctionId, bytes32 _commitment) external;

// Reveal phase: reveal actual bid with secret
function revealBid(
    uint256 _auctionId,
    uint256 _amount,
    bytes32 _secret
) external payable;

// Bundle auction creation
function createBundleAuction(
    uint256 _startPrice,
    uint256 _duration,
    BundleItem[] calldata _items,
    string calldata _title,
    string calldata _description
) external returns (uint256);

// Anti-snipe extension (called by handler)
function extendAuction(uint256 _auctionId) external onlyHandler;

// Reputation management
function updateReputation(
    address _user,
    int256 _scoreDelta,
    ReputationAction _action
) external onlyHandler;

// Watchlist management
function addToWatchlist(uint256 _auctionId) external;
function removeFromWatchlist(uint256 _auctionId) external;

// Template management
function saveTemplate(AuctionTemplate calldata _template) external;
function createFromTemplate(uint256 _templateId) external returns (uint256);

// Multi-currency bidding
function bidWithToken(
    uint256 _auctionId,
    address _token,
    uint256 _amount
) external;

// Emergency controls
function pauseSystem() external onlyOwner;
function unpauseSystem() external onlyOwner;

// Fraud detection
function flagAuction(uint256 _auctionId, string calldata _reason) external;
function checkBidRateLimit(address _bidder) internal view returns (bool);
```

#### New Events

```solidity
event SealedBidCommitted(
    uint256 indexed auctionId,
    address indexed bidder,
    bytes32 commitment,
    uint256 timestamp
);

event SealedBidRevealed(
    uint256 indexed auctionId,
    address indexed bidder,
    uint256 amount,
    uint256 timestamp
);

event AuctionExtended(
    uint256 indexed auctionId,
    uint256 newEndTime,
    uint256 extensionCount,
    uint256 timestamp
);

event PhaseTransition(
    uint256 indexed auctionId,
    AuctionPhase fromPhase,
    AuctionPhase toPhase,
    uint256 timestamp
);

event BundleCreated(
    uint256 indexed auctionId,
    uint256 itemCount,
    uint256 totalValue
);

event ReputationUpdated(
    address indexed user,
    uint256 newScore,
    uint256 newTrustScore,
    string reason
);

event AchievementUnlocked(
    address indexed user,
    string achievementType,
    uint256 milestone
);

event PriceAlertTriggered(
    uint256 indexed auctionId,
    address indexed user,
    uint256 targetPrice,
    uint256 currentPrice
);

event AuctionFlagged(
    uint256 indexed auctionId,
    string reason,
    uint256 timestamp
);

event SystemPaused(uint256 timestamp);
event SystemUnpaused(uint256 timestamp, uint256 pauseDuration);

event AuctionConvertedToFixedPrice(
    uint256 indexed auctionId,
    uint256 fixedPrice,
    uint256 timestamp
);
```

### AuctionHandler Contract (Enhanced)

Orchestrates multi-phase workflows and cascading events.

#### New State Variables

```solidity
// Subscription tracking for dynamic management
struct SubscriptionInfo {
    uint256 subscriptionId;
    uint256 scheduledTime;
    SubscriptionType subType;
    bool active;
}

enum SubscriptionType {
    SETTLEMENT,
    REVEAL_DEADLINE,
    REMINDER,
    PRICE_UPDATE,
    ANALYTICS_UPDATE
}

mapping(uint256 => SubscriptionInfo[]) public auctionSubscriptions;

// Cascade configuration
struct CascadeRule {
    bytes32 eventSignature;
    uint256 minValue;  // Minimum auction value to trigger
    bool enabled;
}

mapping(bytes32 => CascadeRule) public cascadeRules;

// Analytics engine reference
address public analyticsEngine;
address public priceOracle;
```

#### Key Functions

```solidity
// Enhanced onEvent with multi-phase logic
function onEvent(
    address emitter,
    bytes32[] calldata eventTopics,
    bytes calldata data
) external override;

// Phase transition handlers
function handleBiddingEnd(uint256 _auctionId) internal;
function handleRevealEnd(uint256 _auctionId) internal;

// Dynamic subscription management
function cancelSubscription(uint256 _auctionId, SubscriptionType _type) internal;
function rescheduleSettlement(uint256 _auctionId, uint256 _newEndTime) internal;

// Cascade event handlers
function handleHighValueSettlement(uint256 _auctionId, uint256 _finalPrice) internal;
function createFollowUpAuction(uint256 _originalAuctionId) internal;
function scheduleReminders(uint256 _auctionId) internal;

// Failed auction handling
function handleFailedAuction(uint256 _auctionId) internal;
function convertToFixedPrice(uint256 _auctionId) internal;

// Achievement detection
function checkAchievements(address _user) internal;
```

### AnalyticsEngine Contract

Computes real-time statistics from reactive event streams.

#### State Variables

```solidity
struct PlatformMetrics {
    uint256 totalVolume;
    uint256 totalAuctions;
    uint256 activeAuctions;
    uint256 settledAuctions;
    uint256 averageSettlementPrice;
    uint256 averageDuration;
}

struct AuctionMetrics {
    uint256 auctionId;
    uint256 bidCount;
    uint256 uniqueBidders;
    uint256 bidVelocity;  // Bids per hour
    uint256 priceVolatility;
    uint256 watcherCount;
    uint256 lastBidTimestamp;
}

struct LeaderboardEntry {
    address user;
    uint256 totalVolume;
    uint256 auctionsWon;
    uint256 reputation;
}

PlatformMetrics public metrics;
mapping(uint256 => AuctionMetrics) public auctionMetrics;
LeaderboardEntry[] public leaderboard;

// Price trend tracking
struct PriceTrend {
    uint256[] prices;
    uint256[] timestamps;
    uint256 movingAverage;
    int256 trend;  // Positive = increasing, negative = decreasing
}

mapping(uint256 => PriceTrend) public priceTrends;
```

#### Key Functions

```solidity
// Event handlers (called via reactivity)
function onBidPlaced(
    uint256 _auctionId,
    address _bidder,
    uint256 _amount
) external onlyHandler;

function onAuctionSettled(
    uint256 _auctionId,
    uint256 _finalPrice
) external onlyHandler;

// Analytics calculations
function updatePlatformMetrics() internal;
function updateAuctionMetrics(uint256 _auctionId) internal;
function updateLeaderboard(address _user, uint256 _volume) internal;
function calculateBidVelocity(uint256 _auctionId) internal returns (uint256);
function calculatePriceVolatility(uint256 _auctionId) internal returns (uint256);

// Fraud detection
function detectWashTrading(uint256 _auctionId) internal returns (bool);
function detectSybilAttack(address _bidder) internal returns (bool);
function calculateTrustScore(address _user) internal returns (uint256);

// View functions for frontend
function getPlatformMetrics() external view returns (PlatformMetrics memory);
function getAuctionMetrics(uint256 _auctionId) external view returns (AuctionMetrics memory);
function getLeaderboard(uint256 _limit) external view returns (LeaderboardEntry[] memory);
function getPriceTrend(uint256 _auctionId) external view returns (PriceTrend memory);
```

### PriceOracle Contract

Manages multi-currency pricing and predictions.

#### State Variables

```solidity
struct ExchangeRate {
    uint256 rate;  // Price in STT (18 decimals)
    uint256 lastUpdate;
    bool active;
}

mapping(address => ExchangeRate) public exchangeRates;

struct PricePrediction {
    uint256 predictedPrice;
    uint256 confidence;  // 0-100
    uint256 timestamp;
}

mapping(uint256 => PricePrediction) public predictions;

// Supported tokens
address[] public supportedTokens;
```

#### Key Functions

```solidity
// Exchange rate management
function updateExchangeRate(address _token, uint256 _rate) external onlyHandler;
function getExchangeRate(address _token) external view returns (uint256);

// Price conversion
function convertToSTT(address _token, uint256 _amount) external view returns (uint256);
function convertFromSTT(address _token, uint256 _sttAmount) external view returns (uint256);

// Dutch auction price calculation
function getCurrentDutchPrice(uint256 _auctionId) external view returns (uint256);

// Price prediction
function predictFinalPrice(uint256 _auctionId) external view returns (PricePrediction memory);
function updatePrediction(uint256 _auctionId) internal;

// Anomaly detection
function detectPriceManipulation(uint256 _auctionId) external view returns (bool);
```

### Frontend WebSocket Integration

The frontend subscribes to contract events via Somnia's WebSocket RPC endpoint.

```typescript
interface WebSocketMessage {
    type: 'auction_created' | 'bid_placed' | 'auction_settled' | 
          'auction_extended' | 'phase_transition' | 'analytics_update' |
          'reputation_update' | 'achievement_unlocked' | 'price_alert';
    data: any;
    timestamp: number;
}

class ReactiveAuctionClient {
    private ws: WebSocket;
    private subscriptions: Map<string, Set<(data: any) => void>>;
    
    constructor(rpcUrl: string) {
        this.ws = new WebSocket(rpcUrl);
        this.subscriptions = new Map();
        this.setupEventHandlers();
    }
    
    // Subscribe to specific event types
    subscribe(eventType: string, callback: (data: any) => void): void;
    
    // Unsubscribe from events
    unsubscribe(eventType: string, callback: (data: any) => void): void;
    
    // Watch specific auction
    watchAuction(auctionId: number): void;
    
    // Get real-time analytics
    subscribeToAnalytics(callback: (metrics: any) => void): void;
}
```

## Data Models

### Auction State Machine

```
BIDDING ──────────────────────────────────────────────┐
   │                                                    │
   │ (sealed-bid: bidding period ends)                 │
   ▼                                                    │
REVEAL ────────────────────────────────────────────┐   │
   │                                                │   │
   │ (reveal period ends OR all revealed)           │   │
   │                                                │   │
   ▼                                                │   │
SETTLING ◄──────────────────────────────────────────┘   │
   │                                                    │
   │ (settlement complete)                              │
   ▼                                                    │
SETTLED                                                 │
                                                        │
CANCELLED ◄─────────────────────────────────────────────┘
   (seller cancels OR no bids OR fraud detected)
```

### Sealed-Bid Workflow

```
1. BIDDING Phase (duration: biddingDuration)
   - Users submit commitments: keccak256(abi.encodePacked(amount, secret))
   - No bid amounts visible on-chain
   - Handler has Schedule subscription for biddingEndTime

2. Transition: Schedule(biddingEndTime) fires
   - Handler calls transitionToReveal(auctionId)
   - Auction phase → REVEAL
   - Handler creates new Schedule(revealDeadline)

3. REVEAL Phase (duration: revealDuration)
   - Users call revealBid(auctionId, amount, secret)
   - Contract verifies: keccak256(abi.encodePacked(amount, secret)) == commitment
   - Valid reveals stored, invalid reveals rejected
   - Users who don't reveal forfeit eligibility

4. Transition: Schedule(revealDeadline) fires
   - Handler calls settleSealed Auction(auctionId)
   - Determine highest valid revealed bid
   - Transfer funds to seller
   - Refund non-winning bids
   - Auction phase → SETTLED
```

### Bundle Auction Data Structure

```solidity
struct BundleAuction {
    uint256 auctionId;
    BundleItem[] items;
    uint256 totalValue;
    
    // All items must be won together
    // Settlement is atomic: all transfers succeed or all revert
}

// Example: Art collection bundle
BundleItem[] items = [
    BundleItem({
        tokenContract: 0xNFT1,
        tokenId: 42,
        amount: 1,
        tokenType: TokenType.ERC721
    }),
    BundleItem({
        tokenContract: 0xNFT2,
        tokenId: 99,
        amount: 1,
        tokenType: TokenType.ERC721
    }),
    BundleItem({
        tokenContract: 0xERC20Token,
        tokenId: 0,
        amount: 1000 * 10**18,
        tokenType: TokenType.ERC20
    })
];
```

### Reputation Scoring Algorithm

```
Base Score Calculation:
- Auction won: +auction_value (in STT)
- Auction created with bids: +10 points
- Failed reveal: -50 points
- Flagged for fraud: -100 points

Trust Score (0-100):
trust_score = min(100, (
    (auctions_won * 10) +
    (auctions_created * 5) -
    (failed_reveals * 20) -
    (fraud_flags * 50)
) / total_auctions)

Reputation Tiers:
- Bronze: 0-100 points
- Silver: 101-500 points
- Gold: 501-2000 points
- Platinum: 2001+ points

Benefits by Tier:
- Bronze: Standard fees (2%)
- Silver: Reduced fees (1.5%)
- Gold: Reduced fees (1%), priority support
- Platinum: Reduced fees (0.5%), priority support, custom features
```

### Bid History Schema

```solidity
struct BidRecord {
    address bidder;
    uint256 amount;
    uint256 timestamp;
    bool successful;
    string failureReason;  // "Below minimum", "Rate limited", "Auction expired", etc.
}

// Indexed by auction ID
mapping(uint256 => BidRecord[]) public bidHistory;

// Query patterns:
// - Get all bids for auction: bidHistory[auctionId]
// - Get successful bids: filter where successful == true
// - Calculate bid velocity: (bid_count / time_range) * 3600
```

### Analytics Data Structures

```solidity
struct PlatformMetrics {
    uint256 totalVolume;           // Sum of all settled auction values
    uint256 totalAuctions;         // Total auctions created
    uint256 activeAuctions;        // Currently active
    uint256 settledAuctions;       // Successfully settled
    uint256 averageSettlementPrice; // Mean final price
    uint256 averageDuration;       // Mean auction duration
    uint256 totalBids;             // All bids placed
    uint256 uniqueBidders;         // Distinct bidder addresses
}

struct AuctionMetrics {
    uint256 auctionId;
    uint256 bidCount;
    uint256 uniqueBidders;
    uint256 bidVelocity;        // Bids per hour
    uint256 priceVolatility;    // Standard deviation of bid prices
    uint256 watcherCount;
    uint256 lastBidTimestamp;
    uint256 timeToFirstBid;     // Seconds from creation to first bid
    uint256 averageTimeBetweenBids;
}
```


### Fraud Detection Patterns

```solidity
// Wash trading detection
function detectWashTrading(uint256 _auctionId) internal returns (bool) {
    Auction storage auction = auctions[_auctionId];
    BidRecord[] storage history = bidHistory[_auctionId];
    
    // Check if seller is bidding on own auction
    for (uint i = 0; i < history.length; i++) {
        if (history[i].bidder == auction.seller) {
            return true;
        }
    }
    
    // Check for circular bidding patterns
    // (User A bids on User B's auction, User B bids on User A's auction)
    // Implementation requires cross-auction analysis
    
    return false;
}

// Sybil attack detection
function detectSybilAttack(address _bidder) internal returns (bool) {
    // Check if multiple addresses from same source
    // Heuristics:
    // - Funded from same address within short timeframe
    // - Similar bidding patterns
    // - Coordinated bid timing
    
    // Simplified: check bid rate from single address
    uint256 recentBids = bidCountLastHour[_bidder];
    return recentBids > 50;  // More than 50 bids/hour is suspicious
}

// Rate limiting
function checkBidRateLimit(address _bidder) internal view returns (bool) {
    uint256 timeSinceLastBid = block.timestamp - lastBidTimestamp[_bidder];
    return timeSinceLastBid >= 2;  // Minimum 2 seconds between bids
}
```

## Error Handling

### Error Types and Recovery Strategies

#### 1. Sealed-Bid Reveal Failures

**Error Scenarios:**
- User submits invalid secret (commitment doesn't match)
- User fails to reveal before deadline
- User reveals with insufficient funds

**Handling:**
```solidity
function revealBid(uint256 _auctionId, uint256 _amount, bytes32 _secret) external payable {
    Auction storage auction = auctions[_auctionId];
    require(auction.phase == AuctionPhase.REVEAL, "Not in reveal phase");
    
    SealedBid storage bid = auction.sealedBids[msg.sender];
    require(bid.commitment != bytes32(0), "No commitment found");
    require(!bid.revealed, "Already revealed");
    
    // Verify commitment
    bytes32 computedCommitment = keccak256(abi.encodePacked(_amount, _secret));
    if (computedCommitment != bid.commitment) {
        emit RevealFailed(_auctionId, msg.sender, "Invalid commitment");
        // Penalize reputation
        userReputation[msg.sender].failedReveals++;
        userReputation[msg.sender].trustScore = calculateTrustScore(msg.sender);
        return;  // Don't revert, allow other reveals to proceed
    }
    
    // Verify funds
    if (msg.value < _amount) {
        emit RevealFailed(_auctionId, msg.sender, "Insufficient funds");
        return;
    }
    
    // Valid reveal
    bid.revealed = true;
    bid.revealedAmount = _amount;
    emit SealedBidRevealed(_auctionId, msg.sender, _amount, block.timestamp);
}
```

**Recovery:** Failed reveals are logged but don't block other users. Unrevealed bids are simply excluded from winner determination.

#### 2. Bundle Settlement Failures

**Error Scenarios:**
- One NFT transfer fails (approval revoked, token burned)
- ERC20 transfer fails (insufficient balance, blacklisted address)
- Gas limit exceeded during multi-transfer

**Handling:**
```solidity
function settleBundleAuction(uint256 _auctionId) internal {
    Auction storage auction = auctions[_auctionId];
    require(auction.auctionType == AuctionType.BUNDLE, "Not a bundle");
    
    if (auction.highestBidder == address(0)) {
        // No bids - return items to seller
        _returnBundleToSeller(_auctionId);
        emit AuctionCancelled(_auctionId, block.timestamp);
        return;
    }
    
    // Attempt atomic transfer of all items
    try this._transferBundle(_auctionId, auction.seller, auction.highestBidder) {
        // Success - pay seller
        (bool sent, ) = payable(auction.seller).call{value: auction.currentBid}("");
        require(sent, "Payment failed");
        
        auction.phase = AuctionPhase.SETTLED;
        emit AuctionSettled(_auctionId, auction.highestBidder, auction.currentBid, block.timestamp);
    } catch Error(string memory reason) {
        // Transfer failed - refund bidder, return items to seller
        emit BundleSettlementFailed(_auctionId, reason);
        
        (bool refunded, ) = payable(auction.highestBidder).call{value: auction.currentBid}("");
        require(refunded, "Refund failed");
        
        _returnBundleToSeller(_auctionId);
        auction.phase = AuctionPhase.CANCELLED;
    }
}

function _transferBundle(
    uint256 _auctionId,
    address _from,
    address _to
) external {
    require(msg.sender == address(this), "Internal only");
    
    Auction storage auction = auctions[_auctionId];
    
    for (uint i = 0; i < auction.bundleItems.length; i++) {
        BundleItem memory item = auction.bundleItems[i];
        
        if (item.tokenType == TokenType.ERC721) {
            IERC721(item.tokenContract).safeTransferFrom(_from, _to, item.tokenId);
        } else if (item.tokenType == TokenType.ERC20) {
            IERC20(item.tokenContract).transferFrom(_from, _to, item.amount);
        }
    }
}
```

**Recovery:** All transfers wrapped in try-catch. If any transfer fails, entire bundle settlement reverts, funds returned, items returned to seller.

#### 3. Anti-Snipe Extension Failures

**Error Scenarios:**
- Handler fails to cancel old Schedule subscription
- Handler fails to create new Schedule subscription
- Extension limit reached but bids still arriving

**Handling:**
```solidity
function extendAuction(uint256 _auctionId) external onlyHandler {
    Auction storage auction = auctions[_auctionId];
    require(auction.phase == AuctionPhase.BIDDING, "Not in bidding phase");
    require(auction.config.antiSnipeEnabled, "Anti-snipe not enabled");
    require(
        auction.config.currentExtensions < auction.config.maxExtensions,
        "Max extensions reached"
    );
    
    uint256 newEndTime = auction.endTime + auction.config.extensionDuration;
    auction.endTime = newEndTime;
    auction.config.currentExtensions++;
    
    emit AuctionExtended(
        _auctionId,
        newEndTime,
        auction.config.currentExtensions,
        block.timestamp
    );
}

// In handler contract
function rescheduleSettlement(uint256 _auctionId, uint256 _newEndTime) internal {
    // Cancel existing subscription (best effort)
    SubscriptionInfo[] storage subs = auctionSubscriptions[_auctionId];
    for (uint i = 0; i < subs.length; i++) {
        if (subs[i].subType == SubscriptionType.SETTLEMENT && subs[i].active) {
            // Note: Somnia doesn't provide subscription cancellation in current API
            // Mark as inactive to prevent double-settlement
            subs[i].active = false;
        }
    }
    
    // Create new subscription
    _scheduleAutoSettlement(_auctionId, _newEndTime);
}
```

**Recovery:** If extension limit reached, auction proceeds to settlement normally. Handler tracks subscription state to prevent double-settlement.

#### 4. Multi-Currency Conversion Failures

**Error Scenarios:**
- Exchange rate feed unavailable
- Exchange rate stale (not updated recently)
- Token transfer fails during conversion

**Handling:**
```solidity
function bidWithToken(uint256 _auctionId, address _token, uint256 _amount) external {
    require(!systemPaused, "System paused");
    require(_token != address(0), "Use bid() for native STT");
    
    ExchangeRate memory rate = priceOracle.getExchangeRate(_token);
    require(rate.active, "Token not supported");
    require(block.timestamp - rate.lastUpdate < 1 hours, "Exchange rate stale");
    
    // Convert to STT equivalent
    uint256 sttEquivalent = priceOracle.convertToSTT(_token, _amount);
    
    // Transfer tokens to contract
    bool success = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    require(success, "Token transfer failed");
    
    // Process bid with STT equivalent value
    _processBid(_auctionId, msg.sender, sttEquivalent);
    
    emit BidPlacedWithToken(_auctionId, msg.sender, _token, _amount, sttEquivalent);
}
```

**Recovery:** Stale rates rejected. Failed token transfers revert entire transaction. Fallback: users can always bid with native STT.

#### 5. Emergency Pause Scenarios

**Error Scenarios:**
- Critical bug discovered in auction logic
- Exploit detected in fraud detection
- Network congestion causing settlement delays

**Handling:**
```solidity
function pauseSystem() external onlyOwner {
    require(!systemPaused, "Already paused");
    systemPaused = true;
    pauseStartTime = block.timestamp;
    
    emit SystemPaused(block.timestamp);
}

function unpauseSystem() external onlyOwner {
    require(systemPaused, "Not paused");
    
    uint256 pauseDuration = block.timestamp - pauseStartTime;
    systemPaused = false;
    
    // Extend all active auctions by pause duration
    uint256[] memory activeIds = getActiveAuctionIds();
    for (uint i = 0; i < activeIds.length; i++) {
        Auction storage auction = auctions[activeIds[i]];
        if (auction.phase == AuctionPhase.BIDDING || auction.phase == AuctionPhase.REVEAL) {
            auction.endTime += pauseDuration;
            if (auction.revealDeadline > 0) {
                auction.revealDeadline += pauseDuration;
            }
        }
    }
    
    emit SystemUnpaused(block.timestamp, pauseDuration);
    
    // Handler will need to reschedule all pending settlements
    // This is done via separate admin function to avoid gas limits
}

function rescheduleAllSettlements() external onlyOwner {
    require(!systemPaused, "System still paused");
    
    uint256[] memory activeIds = getActiveAuctionIds();
    for (uint i = 0; i < activeIds.length; i++) {
        auctionHandler.scheduleSettlement(activeIds[i]);
    }
}
```

**Recovery:** Pause prevents new actions but allows withdrawals. Unpause extends auction times to compensate. Admin manually reschedules settlements.

#### 6. Handler Execution Failures

**Error Scenarios:**
- Handler runs out of gas during onEvent()
- Handler contract has insufficient funds for gas
- Multiple events fire simultaneously causing race conditions

**Handling:**
```solidity
// In AuctionHandler
function onEvent(
    address emitter,
    bytes32[] calldata eventTopics,
    bytes calldata data
) external override {
    // Wrap all logic in try-catch to prevent handler from blocking
    try this._handleEventInternal(emitter, eventTopics, data) {
        emit HandlerSuccess(emitter, eventTopics[0], block.timestamp);
    } catch Error(string memory reason) {
        emit HandlerFailed(emitter, eventTopics[0], reason, block.timestamp);
        // Log failure but don't revert - allows other events to process
    } catch {
        emit HandlerFailed(emitter, eventTopics[0], "Unknown error", block.timestamp);
    }
}

function _handleEventInternal(
    address emitter,
    bytes32[] calldata eventTopics,
    bytes calldata data
) external {
    require(msg.sender == address(this), "Internal only");
    
    // Actual event handling logic
    // If this reverts, caught by onEvent()
}
```

**Recovery:** Handler failures logged but don't block other events. Admin can manually trigger failed operations. Critical operations (settlement) use `isGuaranteed: true` for higher reliability.

### Error Event Definitions

```solidity
event RevealFailed(uint256 indexed auctionId, address indexed bidder, string reason);
event BundleSettlementFailed(uint256 indexed auctionId, string reason);
event ExtensionFailed(uint256 indexed auctionId, string reason);
event ConversionFailed(uint256 indexed auctionId, address token, string reason);
event HandlerFailed(address indexed emitter, bytes32 indexed eventTopic, string reason, uint256 timestamp);
event SubscriptionFailed(uint256 indexed auctionId, SubscriptionType subType, string reason);
```

## Testing Strategy

### Dual Testing Approach

This system requires both unit tests for specific scenarios and property-based tests for universal correctness guarantees.

#### Unit Testing Focus

Unit tests validate specific examples, edge cases, and integration points:

- **Sealed-bid workflow**: Test complete commit → reveal → settle flow with 3 bidders
- **Bundle settlement**: Test atomic transfer of 2 NFTs + 1 ERC20 token
- **Anti-snipe extension**: Test bid at endTime - 30 seconds triggers extension
- **Emergency pause**: Test pause → extend auctions → unpause → reschedule
- **Multi-currency**: Test USDC bid conversion to STT at known exchange rate
- **Fraud detection**: Test wash trading detection with seller bidding on own auction
- **Reputation milestones**: Test achievement event at 3rd auction win
- **Failed auction conversion**: Test zero-bid auction converts to fixed price

#### Property-Based Testing Focus

Property tests verify universal properties across all inputs using randomized test data. Each test runs minimum 100 iterations.

**Property-Based Testing Library:** Use `@fast-check/ava` for TypeScript tests, `proptest` for Rust, or `Hypothesis` for Python test scripts.

**Test Configuration:**
```typescript
// Example configuration for fast-check
import fc from 'fast-check';

fc.assert(
  fc.property(
    // Generators for random test data
    fc.nat(),  // auction ID
    fc.ethereumAddress(),  // bidder
    fc.bigUint(),  // bid amount
    (auctionId, bidder, amount) => {
      // Property assertion
    }
  ),
  { numRuns: 100 }  // Minimum 100 iterations
);
```

**Property Test Tags:** Each test must include a comment referencing the design property:
```typescript
// Feature: hackathon-winning-enhancements, Property 1: Sealed-bid round-trip
test('sealed bid commit-reveal preserves bid amount', async (t) => {
  // Test implementation
});
```

### Test Environment Setup

```typescript
// Hardhat test configuration
import { ethers } from 'hardhat';
import { expect } from 'chai';
import fc from 'fast-check';

describe('ReactiveAuction Enhanced', () => {
  let auction: ReactiveAuction;
  let handler: AuctionHandler;
  let analytics: AnalyticsEngine;
  let oracle: PriceOracle;
  let owner: SignerWithAddress;
  let users: SignerWithAddress[];
  
  beforeEach(async () => {
    [owner, ...users] = await ethers.getSigners();
    
    // Deploy contracts
    const AuctionFactory = await ethers.getContractFactory('ReactiveAuction');
    auction = await AuctionFactory.deploy();
    
    const HandlerFactory = await ethers.getContractFactory('AuctionHandler');
    handler = await HandlerFactory.deploy(auction.address);
    
    const AnalyticsFactory = await ethers.getContractFactory('AnalyticsEngine');
    analytics = await AnalyticsFactory.deploy(auction.address);
    
    const OracleFactory = await ethers.getContractFactory('PriceOracle');
    oracle = await OracleFactory.deploy();
    
    // Wire up contracts
    await auction.setHandler(handler.address);
    await handler.setAnalyticsEngine(analytics.address);
    await handler.setPriceOracle(oracle.address);
  });
  
  // Unit tests and property tests follow
});
```

### Integration Testing with Somnia Reactivity

Testing reactive behavior requires simulating the Somnia precompile:

```solidity
// Mock precompile for testing
contract MockSomniaReactivityPrecompile {
    struct Subscription {
        uint256 id;
        bytes32[4] eventTopics;
        address emitter;
        address handler;
        bytes4 selector;
        bool active;
    }
    
    uint256 public nextSubscriptionId = 1;
    mapping(uint256 => Subscription) public subscriptions;
    
    function createSubscription(
        ISomniaReactivityPrecompile.SubscriptionData calldata data
    ) external returns (uint256) {
        uint256 id = nextSubscriptionId++;
        subscriptions[id] = Subscription({
            id: id,
            eventTopics: data.eventTopics,
            emitter: data.emitter,
            handler: data.handlerContractAddress,
            selector: data.handlerFunctionSelector,
            active: true
        });
        return id;
    }
    
    // Test helper: manually trigger subscription
    function triggerSubscription(
        uint256 _subscriptionId,
        bytes32[] calldata _eventTopics,
        bytes calldata _data
    ) external {
        Subscription memory sub = subscriptions[_subscriptionId];
        require(sub.active, "Subscription not active");
        
        ISomniaEventHandler(sub.handler).onEvent(
            sub.emitter,
            _eventTopics,
            _data
        );
    }
    
    // Test helper: simulate Schedule event
    function emitScheduleEvent(uint256 _timestamp) external {
        bytes32[] memory topics = new bytes32[](2);
        topics[0] = keccak256("Schedule(uint256)");
        topics[1] = bytes32(_timestamp);
        
        // Trigger all subscriptions listening for this Schedule event
        for (uint256 i = 1; i < nextSubscriptionId; i++) {
            Subscription memory sub = subscriptions[i];
            if (sub.active && sub.eventTopics[0] == topics[0]) {
                ISomniaEventHandler(sub.handler).onEvent(
                    address(this),
                    topics,
                    ""
                );
            }
        }
    }
}
```

### Performance Testing

Measure gas costs for critical operations:

```typescript
describe('Gas Benchmarks', () => {
  it('should measure sealed-bid auction gas costs', async () => {
    // Create auction
    const createTx = await auction.createSealedBidAuction(
      ethers.utils.parseEther('1'),
      300,  // 5 min bidding
      300,  // 5 min reveal
      'Test Auction',
      '',
      ''
    );
    const createReceipt = await createTx.wait();
    console.log('Create sealed auction gas:', createReceipt.gasUsed.toString());
    
    // Commit bid
    const commitment = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes32'],
        [ethers.utils.parseEther('1.5'), ethers.utils.randomBytes(32)]
      )
    );
    const commitTx = await auction.connect(users[0]).commitBid(0, commitment);
    const commitReceipt = await commitTx.wait();
    console.log('Commit bid gas:', commitReceipt.gasUsed.toString());
    
    // Reveal bid
    // ... measure reveal gas
    
    // Settlement
    // ... measure settlement gas
  });
});
```

### Security Testing

Specific security test cases:

```typescript
describe('Security Tests', () => {
  it('should prevent seller from bidding on own auction', async () => {
    const auctionId = await auction.createEnglishAuction(
      ethers.utils.parseEther('1'),
      300,
      'Test',
      '',
      ''
    );
    
    await expect(
      auction.bid(auctionId, { value: ethers.utils.parseEther('1.1') })
    ).to.be.revertedWith('Seller cannot bid');
  });
  
  it('should detect wash trading pattern', async () => {
    // Create auction as user[0]
    const auctionId = await auction.connect(users[0]).createEnglishAuction(
      ethers.utils.parseEther('1'),
      300,
      'Test',
      '',
      ''
    );
    
    // Attempt bid as user[0] (seller)
    await expect(
      auction.connect(users[0]).bid(auctionId, { value: ethers.utils.parseEther('1.1') })
    ).to.be.revertedWith('Seller cannot bid');
    
    // Verify fraud detection flags this
    const flagged = await analytics.detectWashTrading(auctionId);
    expect(flagged).to.be.true;
  });
  
  it('should enforce rate limiting', async () => {
    const auctionId = await auction.createEnglishAuction(
      ethers.utils.parseEther('1'),
      300,
      'Test',
      '',
      ''
    );
    
    // Place bid
    await auction.connect(users[0]).bid(auctionId, { 
      value: ethers.utils.parseEther('1.1') 
    });
    
    // Immediate second bid should fail
    await expect(
      auction.connect(users[0]).bid(auctionId, { 
        value: ethers.utils.parseEther('1.2') 
      })
    ).to.be.revertedWith('Rate limit exceeded');
    
    // Wait 2 seconds
    await ethers.provider.send('evm_increaseTime', [2]);
    await ethers.provider.send('evm_mine', []);
    
    // Now should succeed
    await expect(
      auction.connect(users[0]).bid(auctionId, { 
        value: ethers.utils.parseEther('1.2') 
      })
    ).to.not.be.reverted;
  });
});
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before defining properties, I analyzed all acceptance criteria for redundancy:

**Redundancies Identified:**
- Requirements 1.2 (store only commitment) and 1.8 (round-trip) can be combined - the round-trip property subsumes storage verification
- Requirements 2.1, 2.2, 2.6 (extension mechanics) can be combined into a single comprehensive extension property
- Requirements 3.2 (same bidder) and 3.3 (atomic transfer) both validate bundle atomicity - can be combined
- Requirements 6.1, 6.2, 6.5 (bid history storage) can be combined into a single completeness property
- Requirements 7.2, 7.3, 7.4 (reputation updates) can be combined into a single reputation calculation property
- Requirements 11.1, 11.2 (NFT/ERC20 support) can be combined into a single asset type property
- Requirements 11.4, 11.5, 11.6 (NFT custody) can be combined into a single escrow property

**Properties Retained:**
After reflection, 68 testable properties reduced to 52 unique properties that provide distinct validation value.

### Property 1: Sealed-Bid Commit-Reveal Round-Trip

*For any* valid bid amount and secret, committing the bid (as keccak256(amount, secret)) then revealing with the same amount and secret should result in a valid revealed bid with the original amount preserved.

**Validates: Requirements 1.2, 1.8**

### Property 2: Invalid Reveal Rejection

*For any* sealed-bid auction and commitment, attempting to reveal with a mismatched amount or secret should be rejected, and the bid should remain unrevealed.

**Validates: Requirements 1.3**

### Property 3: Unrevealed Bid Exclusion

*For any* sealed-bid auction with multiple commitments, only bids that are successfully revealed before the deadline should be considered for winner determination.

**Validates: Requirements 1.6**

### Property 4: Winner Determination from Valid Reveals

*For any* sealed-bid auction with revealed bids, the winner should be the bidder with the highest revealed amount among all valid reveals.

**Validates: Requirements 1.5**

### Property 5: Non-Winner Refund Completeness

*For any* settled sealed-bid auction, all revealed bids except the winning bid should be refunded to their respective bidders.

**Validates: Requirements 1.7**

### Property 6: Anti-Snipe Extension Trigger

*For any* auction with anti-sniping enabled, placing a bid within the extension threshold time before endTime should extend the auction by the configured extension duration, up to the maximum extension limit.

**Validates: Requirements 2.1, 2.2, 2.6**

### Property 7: Extension Limit Enforcement

*For any* auction with anti-sniping enabled, the number of extensions should never exceed the configured maxExtensions value, regardless of how many late bids arrive.

**Validates: Requirements 2.4**

### Property 8: Extension Subscription Rescheduling

*For any* auction that is extended, the previous Schedule subscription should be marked inactive and a new Schedule subscription should be created for the new endTime.

**Validates: Requirements 2.3**

### Property 9: Extension Across Auction Types

*For any* English or sealed-bid auction with anti-sniping enabled, the extension logic should function identically regardless of auction type.

**Validates: Requirements 2.5**

### Property 10: Bundle Atomicity

*For any* bundle auction settlement, either all items in the bundle should be transferred to the winner, or no items should be transferred (all-or-nothing atomicity).

**Validates: Requirements 3.2, 3.3**

### Property 11: Bundle Price Calculation

*For any* bundle auction, the total price should equal the sum of the individual item values or bids.

**Validates: Requirements 3.4**

### Property 12: Bundle Reserve Price Enforcement

*For any* bundle auction where at least one item fails to meet its reserve price, the entire bundle should be cancelled and no items should be transferred.

**Validates: Requirements 3.5**

### Property 13: Bundle Item Isolation

*For any* item that is part of a bundle, attempting to bid on that item individually should be rejected.

**Validates: Requirements 3.6**

### Property 14: Bundle Creation Validation

*For any* bundle creation attempt, all referenced items must exist, be owned by the seller, and have proper approvals, or the creation should be rejected.

**Validates: Requirements 3.7**

### Property 15: Platform Volume Accuracy

*For any* sequence of auction settlements, the total platform volume should equal the sum of all settled auction final prices.

**Validates: Requirements 4.1**

### Property 16: Average Calculation Correctness

*For any* set of settled auctions of a given type, the average settlement price should equal the sum of final prices divided by the count, and average duration should equal the sum of durations divided by the count.

**Validates: Requirements 4.2**

### Property 17: Leaderboard Ordering

*For any* leaderboard query, the returned entries should be sorted in descending order by total volume, with the highest volume bidder first.

**Validates: Requirements 4.4**

### Property 18: Bid Velocity Calculation

*For any* auction, the bid velocity (bids per hour) should equal the bid count divided by the time elapsed since auction start, multiplied by 3600.

**Validates: Requirements 4.7**

### Property 19: High-Value Cascade Trigger

*For any* auction that settles above the configured high-value threshold, a follow-up auction should be automatically created by the handler.

**Validates: Requirements 5.1**

### Property 20: Bundle Reminder Scheduling

*For any* bundle auction creation, Schedule events should be created for 75%, 50%, and 25% of the auction duration.

**Validates: Requirements 5.2**

### Property 21: Failed Auction Retry

*For any* auction that ends with zero bids, the handler should automatically create a new auction with the reserve price reduced by the configured percentage.

**Validates: Requirements 5.3**

### Property 22: Multi-Phase Schedule Chaining

*For any* sealed-bid auction, Schedule events should be created for both the bidding end time and the reveal deadline, forming a chain of scheduled operations.

**Validates: Requirements 5.4**

### Property 23: Cascade Subscription Creation

*For any* event that triggers a cascade, new subscriptions should be created dynamically for the follow-up operations.

**Validates: Requirements 5.6**

### Property 24: Cascade Failure Isolation

*For any* cascade event chain, if one event handler fails, the remaining events in the chain should still be processed.

**Validates: Requirements 5.7**

### Property 25: Bid History Completeness

*For any* auction, the bid history should contain records for all bid attempts (both successful and failed) with bidder address, amount, timestamp, success status, and failure reason (if applicable).

**Validates: Requirements 6.1, 6.2, 6.5**

### Property 26: Bid History Chronological Ordering

*For any* auction bid history query, the returned records should be ordered by timestamp in ascending order (earliest first).

**Validates: Requirements 6.4**

### Property 27: Sealed-Bid Privacy

*For any* sealed-bid auction in the BIDDING phase, querying bid amounts should return zero or hidden values, and only after transitioning to REVEAL phase should amounts become visible.

**Validates: Requirements 6.6**

### Property 28: Reputation Score Updates

*For any* user action (winning auction, creating auction with bids, failing to reveal), the reputation score should be updated by the configured delta for that action type.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 29: Reputation Milestone Events

*For any* user whose reputation crosses a configured milestone threshold, an achievement event should be emitted with the milestone type.

**Validates: Requirements 7.5**

### Property 30: Fee Reduction by Reputation

*For any* user with reputation above a tier threshold, the platform fee should be reduced according to the tier's fee percentage.

**Validates: Requirements 7.7**

### Property 31: Dutch Price Monotonic Decrease

*For any* Dutch auction, calculating the current price at time T and then at time T+Δ (where Δ > 0) should show that price(T+Δ) ≤ price(T), demonstrating monotonic price decrease.

**Validates: Requirements 8.7**

### Property 32: Price Prediction Consistency

*For any* auction with identical bid history and velocity, the price prediction algorithm should produce the same predicted final price.

**Validates: Requirements 8.2**

### Property 33: Volatility Calculation

*For any* auction with bid history, the price volatility should equal the standard deviation of all bid amounts.

**Validates: Requirements 8.4**

### Property 34: Manipulation Pattern Detection

*For any* auction where the seller places bids or where coordinated bidding patterns exist, the fraud detection system should flag the auction as suspicious.

**Validates: Requirements 8.6**

### Property 35: Multi-Currency Bid Acceptance

*For any* supported token (STT, WETH, USDC), placing a bid with that token should be accepted and converted to STT equivalent using the current exchange rate.

**Validates: Requirements 9.1, 9.2**

### Property 36: Settlement Currency Preference

*For any* auction, the seller should receive payment in their configured preferred currency, with automatic conversion if necessary.

**Validates: Requirements 9.3**

### Property 37: Dual Currency Display

*For any* bid placed in a non-native token, both the original token amount and the STT equivalent should be stored and retrievable.

**Validates: Requirements 9.6**

### Property 38: Conversion Failure Refund

*For any* bid where currency conversion fails, the transaction should revert and the original token amount should be returned to the bidder.

**Validates: Requirements 9.7**

### Property 39: Pause Access Control

*For any* address other than the contract owner, attempting to pause the system should be rejected.

**Validates: Requirements 10.1**

### Property 40: Paused State Operation Blocking

*For any* system in paused state, attempting to create auctions or place bids should be rejected, but withdrawing existing bids should succeed.

**Validates: Requirements 10.2, 10.3**

### Property 41: Unpause Settlement Rescheduling

*For any* active auction when the system is unpaused, a new Schedule subscription should be created for its settlement time.

**Validates: Requirements 10.4**

### Property 42: Pause Duration Compensation

*For any* auction active during a pause period, the auction endTime should be extended by exactly the pause duration upon unpause.

**Validates: Requirements 10.6, 10.7**

### Property 43: Asset Type Support

*For any* ERC721 NFT or ERC20 token, the system should support creating auctions for that asset type with proper escrow and transfer mechanics.

**Validates: Requirements 11.1, 11.2**

### Property 44: NFT Ownership Validation

*For any* NFT auction creation attempt, the transaction should be rejected if the seller does not own the NFT or has not granted transfer approval to the auction contract.

**Validates: Requirements 11.3**

### Property 45: Asset Escrow and Transfer

*For any* NFT or ERC20 auction, the asset should be held by the auction contract during the active period, then transferred to the winner on settlement or returned to the seller on cancellation.

**Validates: Requirements 11.4, 11.5, 11.6**

### Property 46: Asset Transfer Events

*For any* NFT or ERC20 transfer (to escrow, to winner, or back to seller), an AssetTransferred event should be emitted with complete transfer details.

**Validates: Requirements 11.7**

### Property 47: Template Round-Trip

*For any* auction configuration saved as a template, creating a new auction from that template should produce an auction with identical configuration parameters (type, duration, pricing, extensions).

**Validates: Requirements 12.1, 12.2, 12.3**

### Property 48: Template Limit Enforcement

*For any* user, attempting to save more than 10 templates should be rejected.

**Validates: Requirements 12.5**

### Property 49: Template Usage Tracking

*For any* template, each time an auction is created from it, the usage count should increment by exactly 1.

**Validates: Requirements 12.6**

### Property 50: Failed Auction Conversion

*For any* auction that ends with zero bids and no opt-out flag, a fixed-price listing should be automatically created with price set to 80% of the original starting price.

**Validates: Requirements 13.1, 13.2**

### Property 51: Fixed-Price Instant Settlement

*For any* fixed-price listing, purchasing at the fixed price should result in immediate settlement without waiting for an expiry time.

**Validates: Requirements 13.3, 13.4**

### Property 52: Watchlist Management

*For any* user, adding an auction to their watchlist should increment the auction's watcher count by 1, and removing it should decrement by 1, with a maximum of 50 watched auctions per user.

**Validates: Requirements 14.1, 14.6, 14.7**

### Property 53: Price Alert Triggering

*For any* price alert with a target price, when the auction's current price crosses the target threshold, a PriceAlertTriggered event should be emitted.

**Validates: Requirements 14.4, 14.5**

### Property 54: Wash Trading Detection

*For any* auction where the seller's address appears in the bid history, the fraud detection system should flag the auction for wash trading.

**Validates: Requirements 15.1, 15.2**

### Property 55: Sybil Attack Detection

*For any* address that places more than the configured threshold of bids within a time window, the fraud detection system should flag the address for potential sybil attack.

**Validates: Requirements 15.3**

### Property 56: Bid Rate Limiting

*For any* address, attempting to place bids with less than the minimum time interval between bids should be rejected.

**Validates: Requirements 15.4**

### Property 57: Fraud Restriction Enforcement

*For any* user flagged for fraud, attempting to place bids should be rejected until the flag is cleared.

**Validates: Requirements 15.5**

### Property 58: Trust Score Calculation

*For any* user, the trust score should be calculated as a function of auctions won, auctions created, failed reveals, and fraud flags, normalized to a 0-100 scale.

**Validates: Requirements 15.6**

### Property 59: Multi-Flag Automatic Pause

*For any* auction that receives fraud flags from multiple distinct sources exceeding the threshold, the auction should be automatically paused.

**Validates: Requirements 15.7**



## Security Considerations

### Cryptographic Security

**Sealed-Bid Commitment Scheme:**
- Uses keccak256 for commitment hashing, which is collision-resistant
- Secret must be sufficiently random (minimum 32 bytes entropy)
- Commitment cannot be reversed to reveal bid amount before reveal phase
- Replay attacks prevented by storing commitments per auction per bidder

**Potential Vulnerabilities:**
- Weak secret selection by users (mitigated by frontend generating strong secrets)
- Front-running during reveal phase (mitigated by batch reveal processing)
- MEV extraction during settlement (mitigated by using guaranteed subscriptions)

### Access Control

**Role-Based Permissions:**
```solidity
// Owner-only functions
- pauseSystem()
- unpauseSystem()
- setHandler()
- updateSystemConfig()

// Handler-only functions
- extendAuction()
- updateReputation()
- settleAuction()
- transitionPhase()

// User functions (with validation)
- createAuction() - requires asset ownership/approval
- bid() - requires sufficient funds, not seller
- revealBid() - requires valid commitment
- cancelAuction() - requires seller, no bids
```

**Attack Vectors:**
- Unauthorized pause: Prevented by onlyOwner modifier
- Handler impersonation: Handler address immutable after deployment
- Seller self-bidding: Explicitly blocked in bid validation
- Unauthorized settlement: Only handler can trigger settlement

### Reentrancy Protection

All external calls use checks-effects-interactions pattern:

```solidity
function settleAuction(uint256 _auctionId) external onlyHandler {
    Auction storage auction = auctions[_auctionId];
    
    // Checks
    require(auction.phase == AuctionPhase.BIDDING, "Not in bidding phase");
    require(block.timestamp >= auction.endTime, "Not expired");
    
    // Effects (state changes before external calls)
    auction.phase = AuctionPhase.SETTLED;
    _removeFromActive(_auctionId);
    
    // Interactions (external calls last)
    if (auction.highestBidder != address(0)) {
        (bool sent, ) = payable(auction.seller).call{value: auction.currentBid}("");
        require(sent, "Payment failed");
    }
    
    emit AuctionSettled(_auctionId, auction.highestBidder, auction.currentBid, block.timestamp);
}
```

**Reentrancy Risks:**
- Refund loops during bid replacement
- Bundle settlement with multiple token transfers
- Multi-currency conversion callbacks

**Mitigations:**
- Use OpenZeppelin's ReentrancyGuard for critical functions
- State updates before external calls
- Pull payment pattern for refunds where appropriate

### Economic Attacks

**Griefing Attacks:**
- Spam bidding: Mitigated by rate limiting (2 second minimum between bids)
- Fake commitments: Mitigated by reputation penalties for failed reveals
- Bundle manipulation: Mitigated by atomic settlement (all-or-nothing)

**Front-Running:**
- Bid sniping: Mitigated by anti-snipe extensions
- Reveal front-running: Mitigated by batch reveal processing
- Price manipulation: Mitigated by fraud detection patterns

**Sybil Attacks:**
- Multiple addresses from same source: Detected by coordinated bidding patterns
- Wash trading: Detected by seller-bidder relationship analysis
- Reputation farming: Mitigated by trust score calculation including fraud flags

### Smart Contract Security

**Integer Overflow/Underflow:**
- Solidity 0.8+ has built-in overflow protection
- All arithmetic operations automatically checked
- Explicit SafeMath not required but can be used for clarity

**Gas Limit Attacks:**
- Bundle settlement limited to reasonable item counts (max 10 items)
- Bid history pagination prevents unbounded loops
- Handler operations use try-catch to prevent blocking

**Timestamp Manipulation:**
- Auction timing uses block.timestamp (15-second tolerance acceptable)
- Critical timing uses Schedule events (validator-controlled)
- No reliance on exact timestamp precision

### Fraud Detection Security

**False Positive Mitigation:**
- Multiple detection heuristics required for flagging
- Manual review process for flagged auctions
- Reputation recovery mechanism for false flags

**Detection Evasion:**
- Pattern analysis across multiple auctions
- Cross-address correlation for sybil detection
- Velocity analysis for spam detection

### Upgrade and Recovery

**Emergency Procedures:**
- Pause mechanism for critical bugs
- Withdrawal allowed during pause
- Time extension compensation for paused auctions

**Upgrade Path:**
- Proxy pattern for contract upgrades (if needed)
- Data migration strategy for major version changes
- Backward compatibility for existing auctions

### External Dependencies

**Somnia Reactivity Precompile:**
- Trust assumption: Validators execute subscriptions correctly
- Failure mode: Handler includes manual trigger fallback
- Monitoring: Event logs track handler invocations

**Price Oracles:**
- Trust assumption: Exchange rate feeds are accurate
- Failure mode: Stale rate rejection, fallback to native STT
- Monitoring: Rate update timestamps tracked

**Token Contracts (ERC20/ERC721):**
- Trust assumption: Tokens follow standards
- Failure mode: Transfer failures revert entire transaction
- Validation: Ownership and approval checked before escrow

## Integration Patterns

### Somnia Reactivity Integration

**Subscription Creation Pattern:**

```solidity
function createScheduleSubscription(uint256 _timestamp) internal returns (uint256) {
    ISomniaReactivityPrecompile.SubscriptionData memory subData = 
        ISomniaReactivityPrecompile.SubscriptionData({
            eventTopics: [
                keccak256("Schedule(uint256)"),
                bytes32(_timestamp * 1000),  // Convert to milliseconds
                bytes32(0),
                bytes32(0)
            ],
            emitter: SOMNIA_REACTIVITY_PRECOMPILE,
            handlerContractAddress: address(this),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            priorityFeePerGas: 2 gwei,
            maxFeePerGas: 10 gwei,
            gasLimit: 2_000_000,
            isGuaranteed: true,  // Critical for settlement
            isCoalesced: false
        });
    
    return ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE)
        .createSubscription(subData);
}
```

**Event Subscription Pattern:**

```solidity
function subscribeToAuctionEvents() external onlyOwner {
    // Subscribe to AuctionCreated
    ISomniaReactivityPrecompile.SubscriptionData memory createSub = 
        ISomniaReactivityPrecompile.SubscriptionData({
            eventTopics: [
                keccak256("AuctionCreated(uint256,address,uint8,uint256,uint256,uint256,uint256,string)"),
                bytes32(0),  // Match any auction ID
                bytes32(0),  // Match any seller
                bytes32(0)
            ],
            emitter: address(auctionContract),
            handlerContractAddress: address(this),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            priorityFeePerGas: 1 gwei,
            maxFeePerGas: 5 gwei,
            gasLimit: 1_000_000,
            isGuaranteed: true,
            isCoalesced: false
        });
    
    ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE)
        .createSubscription(createSub);
    
    // Subscribe to BidPlaced for analytics
    ISomniaReactivityPrecompile.SubscriptionData memory bidSub = 
        ISomniaReactivityPrecompile.SubscriptionData({
            eventTopics: [
                keccak256("BidPlaced(uint256,address,uint256,uint256)"),
                bytes32(0),
                bytes32(0),
                bytes32(0)
            ],
            emitter: address(auctionContract),
            handlerContractAddress: address(analyticsEngine),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            priorityFeePerGas: 1 gwei,
            maxFeePerGas: 5 gwei,
            gasLimit: 500_000,
            isGuaranteed: false,  // Non-critical analytics
            isCoalesced: true     // Can batch multiple bids
        });
    
    ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE)
        .createSubscription(bidSub);
}
```

### Frontend WebSocket Integration

**Connection Setup:**

```typescript
import { createPublicClient, webSocket } from 'viem';
import { somniaTestnet } from './config/chain';

const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket('wss://dream-rpc.somnia.network/ws')
});

// Watch for auction events
const unwatchAuctionCreated = publicClient.watchContractEvent({
  address: CONTRACTS.AUCTION_HOUSE,
  abi: AUCTION_ABI,
  eventName: 'AuctionCreated',
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.log('New auction:', log.args);
      // Update UI state
      addAuctionToList(log.args);
    });
  }
});

// Watch for bid events
const unwatchBidPlaced = publicClient.watchContractEvent({
  address: CONTRACTS.AUCTION_HOUSE,
  abi: AUCTION_ABI,
  eventName: 'BidPlaced',
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.log('New bid:', log.args);
      // Update auction state
      updateAuctionBid(log.args.auctionId, log.args.amount);
      // Show notification
      showNotification(`New bid: ${formatEther(log.args.amount)} STT`);
    });
  }
});

// Watch for analytics updates
const unwatchAnalytics = publicClient.watchContractEvent({
  address: CONTRACTS.ANALYTICS_ENGINE,
  abi: ANALYTICS_ABI,
  eventName: 'AnalyticsUpdated',
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.log('Analytics update:', log.args);
      // Update dashboard
      updateDashboardMetrics(log.args);
    });
  }
});
```

**Real-Time Price Updates:**

```typescript
// Subscribe to PriceUpdated events for Dutch auctions
const watchDutchPrices = (auctionId: number) => {
  return publicClient.watchContractEvent({
    address: CONTRACTS.PRICE_ORACLE,
    abi: ORACLE_ABI,
    eventName: 'PriceUpdated',
    args: { auctionId: BigInt(auctionId) },
    onLogs: (logs) => {
      logs.forEach((log) => {
        // Update price display in real-time
        updateAuctionPrice(log.args.auctionId, log.args.currentPrice);
      });
    }
  });
};

// Client-side price calculation for smooth UI
const calculateDutchPrice = (auction: Auction): bigint => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const start = auction.startTime;
  const end = auction.endTime;
  
  if (now >= end) return auction.endPrice;
  
  const elapsed = now - start;
  const duration = end - start;
  const priceDrop = ((auction.startPrice - auction.endPrice) * elapsed) / duration;
  
  return auction.startPrice - priceDrop;
};

// Update every second for smooth countdown
setInterval(() => {
  dutchAuctions.forEach((auction) => {
    const currentPrice = calculateDutchPrice(auction);
    updatePriceDisplay(auction.id, currentPrice);
  });
}, 1000);
```

### NFT/ERC20 Integration

**NFT Auction Creation:**

```typescript
import { erc721ABI } from 'wagmi';

async function createNFTAuction(
  nftContract: Address,
  tokenId: bigint,
  startPrice: bigint,
  duration: number
) {
  // Step 1: Approve auction contract to transfer NFT
  const approveTx = await walletClient.writeContract({
    address: nftContract,
    abi: erc721ABI,
    functionName: 'approve',
    args: [CONTRACTS.AUCTION_HOUSE, tokenId]
  });
  
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  
  // Step 2: Create auction
  const bundleItems = [{
    tokenContract: nftContract,
    tokenId: tokenId,
    amount: 1n,
    tokenType: 2 // ERC721
  }];
  
  const createTx = await walletClient.writeContract({
    address: CONTRACTS.AUCTION_HOUSE,
    abi: AUCTION_ABI,
    functionName: 'createBundleAuction',
    args: [
      startPrice,
      BigInt(duration),
      bundleItems,
      'My NFT Auction',
      'Rare collectible'
    ]
  });
  
  return createTx;
}
```

**ERC20 Bidding:**

```typescript
import { erc20ABI } from 'wagmi';

async function bidWithERC20(
  auctionId: bigint,
  token: Address,
  amount: bigint
) {
  // Step 1: Approve auction contract to spend tokens
  const approveTx = await walletClient.writeContract({
    address: token,
    abi: erc20ABI,
    functionName: 'approve',
    args: [CONTRACTS.AUCTION_HOUSE, amount]
  });
  
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  
  // Step 2: Place bid with token
  const bidTx = await walletClient.writeContract({
    address: CONTRACTS.AUCTION_HOUSE,
    abi: AUCTION_ABI,
    functionName: 'bidWithToken',
    args: [auctionId, token, amount]
  });
  
  return bidTx;
}
```

### Analytics Dashboard Integration

**Real-Time Metrics Component:**

```typescript
interface PlatformMetrics {
  totalVolume: bigint;
  totalAuctions: number;
  activeAuctions: number;
  averagePrice: bigint;
  uniqueBidders: number;
}

function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  
  useEffect(() => {
    // Initial load
    const loadMetrics = async () => {
      const data = await publicClient.readContract({
        address: CONTRACTS.ANALYTICS_ENGINE,
        abi: ANALYTICS_ABI,
        functionName: 'getPlatformMetrics'
      });
      setMetrics(data);
    };
    
    loadMetrics();
    
    // Subscribe to updates
    const unwatch = publicClient.watchContractEvent({
      address: CONTRACTS.ANALYTICS_ENGINE,
      abi: ANALYTICS_ABI,
      eventName: 'AnalyticsUpdated',
      onLogs: (logs) => {
        logs.forEach((log) => {
          setMetrics(log.args.metrics);
        });
      }
    });
    
    return () => unwatch();
  }, []);
  
  if (!metrics) return <div>Loading...</div>;
  
  return (
    <div className="analytics-dashboard">
      <MetricCard 
        label="Total Volume" 
        value={formatEther(metrics.totalVolume) + ' STT'} 
      />
      <MetricCard 
        label="Active Auctions" 
        value={metrics.activeAuctions} 
      />
      <MetricCard 
        label="Unique Bidders" 
        value={metrics.uniqueBidders} 
      />
      <MetricCard 
        label="Avg Price" 
        value={formatEther(metrics.averagePrice) + ' STT'} 
      />
    </div>
  );
}
```

### Multi-Currency Price Display

```typescript
interface CurrencyDisplay {
  sttAmount: bigint;
  originalToken?: Address;
  originalAmount?: bigint;
}

function PriceDisplay({ sttAmount, originalToken, originalAmount }: CurrencyDisplay) {
  const [usdValue, setUsdValue] = useState<string>('');
  
  useEffect(() => {
    const fetchUsdValue = async () => {
      const rate = await publicClient.readContract({
        address: CONTRACTS.PRICE_ORACLE,
        abi: ORACLE_ABI,
        functionName: 'getExchangeRate',
        args: [USDC_ADDRESS]
      });
      
      const usd = (sttAmount * rate) / parseEther('1');
      setUsdValue(formatUnits(usd, 6));
    };
    
    fetchUsdValue();
  }, [sttAmount]);
  
  return (
    <div className="price-display">
      <div className="primary-price">
        {formatEther(sttAmount)} STT
      </div>
      {originalToken && originalAmount && (
        <div className="original-price">
          ({formatEther(originalAmount)} {getTokenSymbol(originalToken)})
        </div>
      )}
      <div className="usd-equivalent">
        ≈ ${usdValue} USD
      </div>
    </div>
  );
}
```

## Deployment Strategy

### Contract Deployment Order

1. **Deploy Core Contracts:**
   ```bash
   npx hardhat run scripts/deploy-core.ts --network somnia-testnet
   ```
   - ReactiveAuction (enhanced)
   - PriceOracle
   - AnalyticsEngine

2. **Deploy Handler:**
   ```bash
   npx hardhat run scripts/deploy-handler.ts --network somnia-testnet
   ```
   - AuctionHandler (with references to core contracts)

3. **Wire Up Contracts:**
   ```bash
   npx hardhat run scripts/setup-connections.ts --network somnia-testnet
   ```
   - Set handler address in ReactiveAuction
   - Set analytics and oracle addresses in Handler
   - Transfer ownership if needed

4. **Create Initial Subscriptions:**
   ```bash
   npx hardhat run scripts/setup-subscriptions.ts --network somnia-testnet
   ```
   - Subscribe handler to AuctionCreated events
   - Subscribe analytics to BidPlaced events
   - Subscribe oracle to price update triggers

### Configuration

**Environment Variables:**
```env
# Network
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_WS_URL=wss://dream-rpc.somnia.network/ws
CHAIN_ID=50312

# Contracts (populated after deployment)
AUCTION_HOUSE_ADDRESS=0x...
AUCTION_HANDLER_ADDRESS=0x...
ANALYTICS_ENGINE_ADDRESS=0x...
PRICE_ORACLE_ADDRESS=0x...

# Configuration
DEFAULT_EXTENSION_THRESHOLD=300  # 5 minutes
DEFAULT_EXTENSION_DURATION=300   # 5 minutes
MAX_EXTENSIONS=3
HIGH_VALUE_THRESHOLD=100000000000000000000  # 100 STT
RATE_LIMIT_SECONDS=2
MAX_TEMPLATES_PER_USER=10
MAX_WATCHLIST_PER_USER=50
```

### Monitoring and Maintenance

**Event Monitoring:**
```typescript
// Monitor handler invocations
publicClient.watchContractEvent({
  address: CONTRACTS.AUCTION_HANDLER,
  abi: HANDLER_ABI,
  eventName: 'HandlerInvoked',
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.log(`Handler invoked at ${log.args.timestamp}`);
      // Alert if handler failures detected
    });
  }
});

// Monitor fraud flags
publicClient.watchContractEvent({
  address: CONTRACTS.AUCTION_HOUSE,
  abi: AUCTION_ABI,
  eventName: 'AuctionFlagged',
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.warn(`Auction ${log.args.auctionId} flagged: ${log.args.reason}`);
      // Alert admin for review
    });
  }
});
```

**Health Checks:**
```typescript
async function performHealthCheck() {
  // Check contract responsiveness
  const activeCount = await publicClient.readContract({
    address: CONTRACTS.AUCTION_HOUSE,
    abi: AUCTION_ABI,
    functionName: 'getActiveAuctionCount'
  });
  
  // Check handler has funds for gas
  const handlerBalance = await publicClient.getBalance({
    address: CONTRACTS.AUCTION_HANDLER
  });
  
  if (handlerBalance < parseEther('0.1')) {
    console.warn('Handler balance low, refill needed');
  }
  
  // Check oracle rates are fresh
  const sttRate = await publicClient.readContract({
    address: CONTRACTS.PRICE_ORACLE,
    abi: ORACLE_ABI,
    functionName: 'getExchangeRate',
    args: [STT_ADDRESS]
  });
  
  const rateAge = Date.now() / 1000 - Number(sttRate.lastUpdate);
  if (rateAge > 3600) {
    console.warn('Exchange rates stale, update needed');
  }
  
  return {
    activeAuctions: Number(activeCount),
    handlerBalance: formatEther(handlerBalance),
    rateAge: rateAge
  };
}

// Run health check every 5 minutes
setInterval(performHealthCheck, 300000);
```

This design provides a comprehensive architecture for transforming ReactiveAuction into a hackathon-winning showcase of Somnia Reactivity's capabilities, with advanced auction mechanics, cascading event chains, real-time analytics, and robust security measures.

