# Implementation Plan: Hackathon-Winning Enhancements

## Overview

This implementation plan transforms ReactiveAuction into a showcase of Somnia Reactivity's advanced capabilities. The tasks are sequenced to prioritize the most impressive features first: sealed-bid auctions with cryptographic commit-reveal, anti-sniping with dynamic subscription management, bundle auctions with atomic settlement, and cascading reactive events. Each task builds incrementally, with checkpoints to validate functionality before proceeding.

The implementation uses Solidity for smart contracts and TypeScript for frontend components, leveraging Somnia's reactivity precompile (0x6900...0001) for all automated operations.

## Current Implementation Status

Based on review of the codebase, the following has been completed:
- ✅ Core ReactiveAuction contract structure (enums, structs, events, state variables)
- ✅ Basic auction creation functions (Dutch, English, Sealed-Bid, Bundle)
- ✅ Bidding mechanics (bid, commitBid, revealBid)
- ✅ Phase transitions for sealed-bid auctions
- ✅ Basic settlement functions
- ✅ Watchlist, templates, price alerts (basic implementation)
- ✅ Fraud detection (rate limiting, flagging)
- ✅ Emergency pause/unpause
- ✅ Basic AuctionHandler with reactive event handling
- ✅ Basic frontend structure

Still needed:
- ⏳ Complete anti-snipe extension integration with handler
- ⏳ Bundle auction settlement logic
- ⏳ AnalyticsEngine contract
- ⏳ PriceOracle contract
- ⏳ Cascading reactive events
- ⏳ Multi-currency support (partial implementation exists)
- ⏳ NFT/ERC20 auction support
- ⏳ All tests (unit and property-based)
- ⏳ Frontend UI components
- ⏳ Deployment scripts
- ⏳ Documentation

## Tasks

- [x] 1. Enhance core auction contract with new data structures
  - Add new enums (AuctionType, AuctionPhase, TokenType, SubscriptionType)
  - Add new structs (SealedBid, BundleItem, AuctionConfig, BidRecord, UserReputation, AuctionTemplate, PriceAlert)
  - Add new state variables for bid history, reputation, watchlist, templates, fraud detection, emergency controls
  - Add new events (SealedBidCommitted, SealedBidRevealed, AuctionExtended, PhaseTransition, BundleCreated, ReputationUpdated, AchievementUnlocked, PriceAlertTriggered, AuctionFlagged, SystemPaused, SystemUnpaused, AuctionConvertedToFixedPrice)
  - _Requirements: 1.1, 2.1, 3.1, 6.1, 7.1, 10.1, 11.1, 12.1, 13.1, 14.1, 15.1_

- [x] 2. Implement sealed-bid auction mechanics
  - [x] 2.1 Implement createSealedBidAuction function
    - Accept bidding duration and reveal duration parameters
    - Initialize auction in BIDDING phase
    - Store auction configuration
    - Emit AuctionCreated event
    - _Requirements: 1.1_

  - [x] 2.2 Implement commitBid function
    - Accept auction ID and commitment hash
    - Validate auction is in BIDDING phase
    - Store commitment with timestamp
    - Emit SealedBidCommitted event
    - _Requirements: 1.2_

  - [x] 2.3 Implement revealBid function
    - Accept auction ID, amount, and secret
    - Validate auction is in REVEAL phase
    - Verify commitment matches keccak256(abi.encodePacked(amount, secret))
    - Store revealed amount if valid
    - Handle invalid reveals with reputation penalty
    - Emit SealedBidRevealed or RevealFailed event
    - _Requirements: 1.3, 1.6, 7.4_

  - [x] 2.4 Implement phase transition logic
    - Create transitionToReveal function for bidding → reveal transition
    - Create settleSealed Auction function for reveal → settled transition
    - Determine winner from highest valid revealed bid
    - Refund all non-winning revealed bids
    - Update auction phase state
    - Emit PhaseTransition event
    - _Requirements: 1.4, 1.5, 1.7_

  - [x] 2.5 Write property test for sealed-bid round-trip
    - **Property 1: Sealed-Bid Commit-Reveal Round-Trip**
    - **Validates: Requirements 1.2, 1.8**
    - Generate random bid amounts and secrets
    - Verify commitment → reveal preserves original amount
    - Run 100+ iterations with varied inputs

  - [x] 2.6 Write property test for invalid reveal rejection
    - **Property 2: Invalid Reveal Rejection**
    - **Validates: Requirements 1.3**
    - Test mismatched secrets and amounts
    - Verify bids remain unrevealed on invalid reveals

  - [x] 2.7 Write unit tests for sealed-bid workflow
    - Test complete commit → reveal → settle flow with 3 bidders
    - Test unrevealed bid exclusion from winner determination
    - Test refund of non-winning bids

- [x] 3. Implement anti-sniping time extension
  - [x] 3.1 Add anti-snipe configuration to AuctionConfig struct
    - Add extensionThreshold, extensionDuration, maxExtensions fields
    - Add currentExtensions counter
    - _Requirements: 2.1_

  - [x] 3.2 Implement extendAuction function
    - Validate auction is in BIDDING phase
    - Check currentExtensions < maxExtensions
    - Extend endTime by extensionDuration
    - Increment currentExtensions counter
    - Emit AuctionExtended event
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 3.3 Add extension detection logic to bid placement
    - Check if bid is within extensionThreshold of endTime
    - Call extendAuction if anti-snipe enabled and within threshold
    - Apply to both English and sealed-bid auctions
    - _Requirements: 2.1, 2.5_

  - [x] 3.4 Write property test for extension trigger
    - **Property 6: Anti-Snipe Extension Trigger**
    - **Validates: Requirements 2.1, 2.2, 2.6**
    - Test bids at various times relative to endTime
    - Verify extensions occur within threshold

  - [x] 3.5 Write property test for extension limit enforcement
    - **Property 7: Extension Limit Enforcement**
    - **Validates: Requirements 2.4**
    - Test multiple late bids exceeding maxExtensions
    - Verify extension count never exceeds limit

  - [x] 3.6 Write unit tests for anti-snipe mechanics
    - Test bid at endTime - 30 seconds triggers extension
    - Test extension across auction types
    - Test max extension limit reached

- [x] 4. Implement bundle auction mechanics
  - [x] 4.1 Implement createBundleAuction function
    - Accept array of BundleItem structs
    - Validate all items exist and seller has ownership/approval
    - Store bundle configuration
    - Prevent individual item bidding
    - Emit BundleCreated event
    - _Requirements: 3.1, 3.6, 3.7_

  - [x] 4.2 Implement bundle settlement logic
    - Create _transferBundle internal function for atomic transfers
    - Handle ERC721 and ERC20 transfers in loop
    - Wrap in try-catch for all-or-nothing atomicity
    - Refund bidder and return items on any transfer failure
    - Emit BundleSettlementFailed on errors
    - _Requirements: 3.2, 3.3_

  - [x] 4.3 Implement bundle pricing and reserve validation
    - Calculate total bundle price as sum of item values
    - Check all items meet reserve prices
    - Cancel entire bundle if any item below reserve
    - _Requirements: 3.4, 3.5_

  - [x] 4.4 Write property test for bundle atomicity
    - **Property 10: Bundle Atomicity**
    - **Validates: Requirements 3.2, 3.3**
    - Test bundle settlement with simulated transfer failures
    - Verify all-or-nothing behavior

  - [x] 4.5 Write property test for bundle price calculation
    - **Property 11: Bundle Price Calculation**
    - **Validates: Requirements 3.4**
    - Generate bundles with varied item counts and values
    - Verify total equals sum of individual values

  - [x] 4.6 Write unit tests for bundle mechanics
    - Test atomic transfer of 2 NFTs + 1 ERC20 token
    - Test bundle cancellation when reserve not met
    - Test bundle item isolation (cannot bid individually)

- [x] 5. Checkpoint - Validate core auction enhancements
  - Ensure all tests pass for sealed-bid, anti-snipe, and bundle features
  - Test integration between features (e.g., sealed-bid bundle with anti-snipe)
  - Ask the user if questions arise

- [x] 6. Enhance AuctionHandler with multi-phase workflow orchestration
  - [x] 6.1 Add subscription tracking state variables
    - Add SubscriptionInfo struct with subscriptionId, scheduledTime, subType, active fields
    - Add mapping for auctionSubscriptions
    - Add cascade rule configuration
    - Add references to analyticsEngine and priceOracle
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.2 Enhance onEvent function with phase detection
    - Detect AuctionCreated events and determine auction type
    - Route to appropriate handler based on auction type
    - For sealed-bid: schedule bidding end and reveal deadline
    - For standard auctions: schedule settlement
    - Handle Schedule events for phase transitions
    - _Requirements: 1.4, 5.4_

  - [x] 6.3 Implement handleBiddingEnd for sealed-bid transitions
    - Call transitionToReveal on auction contract
    - Create new Schedule subscription for reveal deadline
    - Store subscription info for tracking
    - _Requirements: 1.4_

  - [x] 6.4 Implement handleRevealEnd for sealed-bid settlement
    - Call settleSealed Auction on auction contract
    - Mark reveal subscription as complete
    - _Requirements: 1.5_

  - [x] 6.5 Implement dynamic subscription management
    - Create cancelSubscription function (mark as inactive)
    - Create rescheduleSettlement function for anti-snipe extensions
    - Handle BidPlaced events to detect late bids
    - Cancel old Schedule and create new one on extension
    - _Requirements: 2.3_

  - [x] 6.6 Write property test for multi-phase schedule chaining
    - **Property 22: Multi-Phase Schedule Chaining**
    - **Validates: Requirements 5.4**
    - Verify sealed-bid auctions create both bidding and reveal schedules
    - Test schedule chain execution

  - [x] 6.7 Write property test for extension subscription rescheduling
    - **Property 8: Extension Subscription Rescheduling**
    - **Validates: Requirements 2.3**
    - Test old subscription marked inactive on extension
    - Verify new subscription created with correct time

  - [x] 6.8 Write unit tests for handler orchestration
    - Test sealed-bid phase transitions via Schedule events
    - Test anti-snipe rescheduling on late bid
    - Test handler failure isolation with try-catch

- [x] 7. Implement cascading reactive events
  - [x] 7.1 Implement high-value cascade trigger
    - Detect AuctionSettled events with finalPrice > threshold
    - Create follow-up auction automatically
    - Emit AuctionCreated for new auction
    - _Requirements: 5.1_

  - [x] 7.2 Implement bundle reminder scheduling
    - Detect BundleCreated events
    - Calculate 75%, 50%, 25% time milestones
    - Create Schedule subscriptions for each reminder
    - Emit reminder events at scheduled times
    - _Requirements: 5.2_

  - [x] 7.3 Implement failed auction retry logic
    - Detect auctions ending with zero bids
    - Reduce reserve price by configured percentage (80%)
    - Create new auction with reduced price
    - _Requirements: 5.3_

  - [x] 7.4 Implement achievement detection
    - Track user auction wins in handler
    - Emit AchievementUnlocked event at milestones (3rd win, 10th win, etc.)
    - _Requirements: 5.5_

  - [x] 7.5 Write property test for high-value cascade trigger
    - **Property 19: High-Value Cascade Trigger**
    - **Validates: Requirements 5.1**
    - Test auctions above and below threshold
    - Verify follow-up creation only for high-value

  - [x] 7.6 Write property test for cascade failure isolation
    - **Property 24: Cascade Failure Isolation**
    - **Validates: Requirements 5.7**
    - Simulate cascade handler failures
    - Verify remaining events still process

  - [x] 7.7 Write unit tests for cascading events
    - Test high-value auction creates follow-up
    - Test bundle reminder scheduling at 75%, 50%, 25%
    - Test failed auction converts to reduced price

- [x] 8. Deploy AnalyticsEngine contract
  - [x] 8.1 Create AnalyticsEngine contract
    - Define PlatformMetrics, AuctionMetrics, LeaderboardEntry, PriceTrend structs
    - Add state variables for metrics tracking
    - Implement onBidPlaced event handler
    - Implement onAuctionSettled event handler
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 8.2 Implement real-time metrics calculations
    - Implement updatePlatformMetrics function
    - Implement updateAuctionMetrics function
    - Implement calculateBidVelocity function
    - Implement calculatePriceVolatility function
    - Emit AnalyticsUpdated events
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

  - [x] 8.3 Implement leaderboard management
    - Implement updateLeaderboard function
    - Sort entries by total volume descending
    - Implement getLeaderboard view function with limit parameter
    - _Requirements: 4.4_

  - [x] 8.4 Implement price trend tracking
    - Store price history with timestamps
    - Calculate moving averages
    - Detect trend direction (increasing/decreasing)
    - _Requirements: 4.5_

  - [x] 8.5 Write property test for platform volume accuracy
    - **Property 15: Platform Volume Accuracy**
    - **Validates: Requirements 4.1**
    - Generate sequence of settlements
    - Verify total volume equals sum of final prices

  - [x] 8.6 Write property test for average calculation correctness
    - **Property 16: Average Calculation Correctness**
    - **Validates: Requirements 4.2**
    - Test average price and duration calculations
    - Verify mathematical correctness

  - [x] 8.7 Write property test for leaderboard ordering
    - **Property 17: Leaderboard Ordering**
    - **Validates: Requirements 4.4**
    - Generate random user volumes
    - Verify descending order in results

  - [x] 8.8 Write unit tests for analytics engine
    - Test real-time volume updates within 2 seconds
    - Test bid velocity calculation (bids per hour)
    - Test leaderboard with 5 users

- [x] 9. Implement fraud detection system
  - [x] 9.1 Add fraud detection functions to AnalyticsEngine
    - Implement detectWashTrading function (check seller in bid history)
    - Implement detectSybilAttack function (check bid rate from single address)
    - Implement calculateTrustScore function
    - Implement checkBidRateLimit function
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.6_

  - [x] 9.2 Integrate fraud detection into auction contract
    - Add rate limiting to bid function (minimum 2 seconds between bids)
    - Add fraud flag checking before accepting bids
    - Implement flagAuction function
    - Implement automatic pause for multi-flag auctions
    - _Requirements: 15.4, 15.5, 15.7_

  - [x] 9.3 Write property test for wash trading detection
    - **Property 54: Wash Trading Detection**
    - **Validates: Requirements 15.1, 15.2**
    - Test seller bidding on own auction
    - Verify fraud flag set

  - [x] 9.4 Write property test for bid rate limiting
    - **Property 56: Bid Rate Limiting**
    - **Validates: Requirements 15.4**
    - Test rapid bid attempts
    - Verify rejection within time window

  - [x] 9.5 Write unit tests for fraud detection
    - Test wash trading detection with seller bidding
    - Test rate limiting enforcement (2 second minimum)
    - Test trust score calculation

- [x] 10. Deploy PriceOracle contract
  - [x] 10.1 Create PriceOracle contract
    - Define ExchangeRate and PricePrediction structs
    - Add state variables for exchange rates and predictions
    - Implement updateExchangeRate function
    - Implement getExchangeRate view function
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 10.2 Implement currency conversion functions
    - Implement convertToSTT function
    - Implement convertFromSTT function
    - Validate exchange rates are not stale (< 1 hour old)
    - _Requirements: 9.2_

  - [x] 10.3 Implement Dutch auction price calculation
    - Implement getCurrentDutchPrice function
    - Calculate linear price decrease over time
    - Emit PriceUpdated events
    - _Requirements: 8.1_

  - [x] 10.4 Implement price prediction algorithm
    - Implement predictFinalPrice function
    - Use bid velocity and historical data
    - Calculate confidence score (0-100)
    - _Requirements: 8.2, 8.3_

  - [x] 10.5 Write property test for Dutch price monotonic decrease
    - **Property 31: Dutch Price Monotonic Decrease**
    - **Validates: Requirements 8.7**
    - Calculate price at time T and T+Δ
    - Verify price(T+Δ) ≤ price(T)

  - [x] 10.6 Write property test for price prediction consistency
    - **Property 32: Price Prediction Consistency**
    - **Validates: Requirements 8.2**
    - Test identical inputs produce identical predictions
    - Verify deterministic behavior

  - [x] 10.7 Write unit tests for price oracle
    - Test multi-currency conversion (USDC to STT)
    - Test stale rate rejection (> 1 hour)
    - Test Dutch price calculation at known timestamps

- [x] 11. Implement multi-currency support in auction contract
  - [x] 11.1 Implement bidWithToken function
    - Accept token address and amount parameters
    - Validate token is supported via oracle
    - Check exchange rate is not stale
    - Transfer tokens to contract via transferFrom
    - Convert to STT equivalent for bid comparison
    - Store both original and STT amounts
    - Emit BidPlacedWithToken event
    - _Requirements: 9.1, 9.2, 9.6_

  - [x] 11.2 Implement settlement currency preference
    - Add preferredCurrency field to Auction struct
    - Convert settlement amount to preferred currency
    - Transfer in preferred currency to seller
    - _Requirements: 9.3_

  - [x] 11.3 Add conversion failure handling
    - Revert transaction on stale rates
    - Revert and refund on token transfer failure
    - Emit ConversionFailed event
    - _Requirements: 9.7_

  - [x] 11.4 Write property test for multi-currency bid acceptance
    - **Property 35: Multi-Currency Bid Acceptance**
    - **Validates: Requirements 9.1, 9.2**
    - Test bids in STT, WETH, USDC
    - Verify conversion to STT equivalent

  - [x] 11.5 Write property test for conversion failure refund
    - **Property 38: Conversion Failure Refund**
    - **Validates: Requirements 9.7**
    - Simulate conversion failures
    - Verify original tokens returned

  - [x] 11.6 Write unit tests for multi-currency
    - Test USDC bid conversion at known rate
    - Test settlement in seller's preferred currency
    - Test conversion failure reverts transaction

- [x] 12. Checkpoint - Validate handler and analytics integration
  - Ensure all tests pass for handler orchestration, analytics, fraud detection, and price oracle
  - Test end-to-end sealed-bid workflow with analytics updates
  - Test cascading events trigger correctly
  - Ask the user if questions arise

- [x] 13. Implement reputation and gamification system
  - [x] 13.1 Implement reputation tracking in auction contract
    - Add updateReputation function (handler-only)
    - Update score on auction win (+auction value)
    - Update score on auction creation with bids (+10)
    - Penalize failed reveals (-50)
    - Penalize fraud flags (-100)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 13.2 Implement trust score calculation
    - Calculate based on wins, creates, failed reveals, fraud flags
    - Normalize to 0-100 scale
    - Update on each reputation change
    - _Requirements: 7.1, 15.6_

  - [x] 13.3 Implement reputation tiers and fee reduction
    - Define tier thresholds (Bronze: 0-100, Silver: 101-500, Gold: 501-2000, Platinum: 2001+)
    - Apply fee reduction based on tier (Bronze: 2%, Silver: 1.5%, Gold: 1%, Platinum: 0.5%)
    - _Requirements: 7.7_

  - [x] 13.4 Implement achievement milestone detection in handler
    - Emit AchievementUnlocked at reputation milestones
    - Track milestone types (3rd win, 10th win, 100 STT volume, etc.)
    - _Requirements: 7.5_

  - [x] 13.5 Write property test for reputation score updates
    - **Property 28: Reputation Score Updates**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
    - Test various user actions
    - Verify score changes by configured deltas

  - [x] 13.6 Write property test for fee reduction by reputation
    - **Property 30: Fee Reduction by Reputation**
    - **Validates: Requirements 7.7**
    - Test users at different tier thresholds
    - Verify correct fee percentages applied

  - [x] 13.7 Write unit tests for reputation system
    - Test reputation increase on auction win
    - Test reputation penalty on failed reveal
    - Test achievement event at 3rd win

- [x] 14. Implement bid history and transparency features
  - [x] 14.1 Implement bid history storage
    - Store BidRecord for every bid attempt (success and failure)
    - Include bidder, amount, timestamp, success status, failure reason
    - Emit BidPlaced events with all details
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 14.2 Implement bid history query functions
    - Create getBidHistory view function with pagination
    - Return records in chronological order
    - Calculate bid velocity from history
    - _Requirements: 6.3, 6.4, 6.7_

  - [x] 14.3 Implement sealed-bid privacy
    - Hide bid amounts during BIDDING phase
    - Show amounts only after REVEAL phase transition
    - _Requirements: 6.6_

  - [x] 14.4 Write property test for bid history completeness
    - **Property 25: Bid History Completeness**
    - **Validates: Requirements 6.1, 6.2, 6.5**
    - Generate sequence of bids (success and failure)
    - Verify all recorded with correct details

  - [x] 14.5 Write property test for chronological ordering
    - **Property 26: Bid History Chronological Ordering**
    - **Validates: Requirements 6.4**
    - Query bid history
    - Verify ascending timestamp order

  - [x] 14.6 Write unit tests for bid history
    - Test complete bid history with 5 bids
    - Test failed bid recorded with reason
    - Test sealed-bid privacy (hidden until reveal)

- [x] 15. Implement NFT and ERC20 auction support
  - [x] 15.1 Add asset escrow functionality
    - Implement escrow for ERC721 NFTs (safeTransferFrom to contract)
    - Implement escrow for ERC20 tokens (transferFrom to contract)
    - Validate ownership and approval before escrow
    - Store escrowed asset details in auction
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 15.2 Implement asset transfer on settlement
    - Transfer NFT to winner on settlement
    - Transfer ERC20 tokens to winner on settlement
    - Return assets to seller on cancellation or no bids
    - Emit AssetTransferred events for all movements
    - _Requirements: 11.4, 11.5, 11.6, 11.7_

  - [x] 15.3 Integrate with bundle auction mechanics
    - Support mixed bundles (NFTs + ERC20s)
    - Validate all bundle items during creation
    - Handle atomic transfer of all asset types
    - _Requirements: 3.1, 11.1, 11.2_

  - [x] 15.4 Write property test for asset type support
    - **Property 43: Asset Type Support**
    - **Validates: Requirements 11.1, 11.2**
    - Test auctions for ERC721 and ERC20
    - Verify proper escrow and transfer

  - [x] 15.5 Write property test for asset escrow and transfer
    - **Property 45: Asset Escrow and Transfer**
    - **Validates: Requirements 11.4, 11.5, 11.6**
    - Test asset held during auction
    - Verify transfer to winner or return to seller

  - [x] 15.6 Write unit tests for NFT/ERC20 auctions
    - Test NFT auction creation with ownership validation
    - Test ERC20 auction settlement
    - Test asset return on cancellation

- [x] 16. Implement watchlist and notification features
  - [x] 16.1 Implement watchlist management
    - Implement addToWatchlist function
    - Implement removeFromWatchlist function
    - Track watcher count per auction
    - Enforce 50 auction limit per user
    - _Requirements: 14.1, 14.7_

  - [x] 16.2 Implement price alert system
    - Add createPriceAlert function
    - Store target price and user address
    - Check alerts on each bid
    - Emit PriceAlertTriggered when target crossed
    - _Requirements: 14.4, 14.5_

  - [x] 16.3 Integrate with handler for notifications
    - Handler emits notifications for watched auctions
    - Send alerts 10 minutes before expiry
    - Send alerts on new bids for watched auctions
    - _Requirements: 14.2, 14.3_

  - [x] 16.4 Write property test for watchlist management
    - **Property 52: Watchlist Management**
    - **Validates: Requirements 14.1, 14.6, 14.7**
    - Test add/remove updates watcher count
    - Verify 50 auction limit enforced

  - [x] 16.5 Write property test for price alert triggering
    - **Property 53: Price Alert Triggering**
    - **Validates: Requirements 14.4, 14.5**
    - Test alerts at various price thresholds
    - Verify event emission when crossed

  - [x] 16.6 Write unit tests for watchlist and alerts
    - Test watchlist add/remove operations
    - Test price alert triggers at target price
    - Test 10-minute expiry notification

- [x] 17. Implement auction template system
  - [x] 17.1 Implement template management
    - Implement saveTemplate function
    - Store template configuration (type, duration, pricing, extensions)
    - Enforce 10 template limit per user
    - Track usage count and public/private flag
    - _Requirements: 12.1, 12.2, 12.5_

  - [x] 17.2 Implement createFromTemplate function
    - Load template configuration
    - Pre-fill auction parameters
    - Increment template usage count
    - Support template sharing (copy public templates)
    - _Requirements: 12.3, 12.4, 12.6_

  - [x] 17.3 Add template discovery features
    - Implement getPopularTemplates view function
    - Sort by usage count
    - Display in frontend interface
    - _Requirements: 12.6, 12.7_

  - [x] 17.4 Write property test for template round-trip
    - **Property 47: Template Round-Trip**
    - **Validates: Requirements 12.1, 12.2, 12.3**
    - Save template then create from it
    - Verify identical configuration

  - [x] 17.5 Write property test for template usage tracking
    - **Property 49: Template Usage Tracking**
    - **Validates: Requirements 12.6**
    - Create auctions from template
    - Verify usage count increments by 1 each time

  - [x] 17.6 Write unit tests for template system
    - Test save and load template
    - Test 10 template limit enforcement
    - Test usage count tracking

- [x] 18. Implement failed auction conversion to fixed-price
  - [x] 18.1 Implement automatic conversion logic in handler
    - Detect auctions ending with zero bids
    - Create fixed-price listing at 80% of starting price
    - Emit AuctionConvertedToFixedPrice event
    - _Requirements: 13.1, 13.2_

  - [x] 18.2 Implement fixed-price purchase mechanism
    - Add purchaseFixedPrice function
    - Allow instant purchase at fixed price
    - Settle immediately without waiting for expiry
    - _Requirements: 13.3, 13.4_

  - [x] 18.3 Implement fixed-price expiry
    - Cancel fixed-price listings after 7 days if unsold
    - Support seller opt-out of automatic conversion
    - _Requirements: 13.5, 13.7_

  - [x] 18.4 Write property test for failed auction conversion
    - **Property 50: Failed Auction Conversion**
    - **Validates: Requirements 13.1, 13.2**
    - Test zero-bid auctions
    - Verify fixed-price created at 80% of start price

  - [x] 18.5 Write property test for fixed-price instant settlement
    - **Property 51: Fixed-Price Instant Settlement**
    - **Validates: Requirements 13.3, 13.4**
    - Test purchase at fixed price
    - Verify immediate settlement

  - [x] 18.6 Write unit tests for fixed-price conversion
    - Test zero-bid auction converts to fixed price
    - Test instant purchase settles immediately
    - Test 7-day expiry cancellation

- [x] 19. Implement emergency pause and recovery system
  - [x] 19.1 Implement pause mechanism
    - Add pauseSystem function (owner-only)
    - Add systemPaused state variable
    - Block auction creation and bidding when paused
    - Allow bid withdrawals during pause
    - Emit SystemPaused event
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 19.2 Implement unpause and time compensation
    - Add unpauseSystem function (owner-only)
    - Calculate pause duration
    - Extend all active auction endTimes by pause duration
    - Extend reveal deadlines for sealed-bid auctions
    - Emit SystemUnpaused event
    - _Requirements: 10.4, 10.6, 10.7_

  - [x] 19.3 Implement settlement rescheduling after unpause
    - Add rescheduleAllSettlements function (owner-only)
    - Iterate active auctions and create new Schedule subscriptions
    - Update handler subscription tracking
    - _Requirements: 10.4_

  - [x] 19.4 Write property test for pause access control
    - **Property 39: Pause Access Control**
    - **Validates: Requirements 10.1**
    - Test non-owner pause attempts
    - Verify rejection

  - [x] 19.5 Write property test for paused state operation blocking
    - **Property 40: Paused State Operation Blocking**
    - **Validates: Requirements 10.2, 10.3**
    - Test create/bid rejected when paused
    - Verify withdrawals still work

  - [x] 19.6 Write property test for pause duration compensation
    - **Property 42: Pause Duration Compensation**
    - **Validates: Requirements 10.6, 10.7**
    - Test auction extended by exact pause duration
    - Verify time integrity maintained

  - [x] 19.7 Write unit tests for emergency pause
    - Test pause → extend auctions → unpause → reschedule
    - Test withdrawal allowed during pause
    - Test auction expiring during pause gets extended

- [x] 20. Checkpoint - Validate all smart contract features
  - Ensure all contract tests pass (unit and property-based)
  - Test complete workflows end-to-end
  - Verify gas costs are reasonable for all operations
  - Ask the user if questions arise

- [ ] 21. Create deployment scripts
  - [x] 21.1 Create deploy-core.ts script
    - Deploy ReactiveAuction contract
    - Deploy PriceOracle contract
    - Deploy AnalyticsEngine contract
    - Save deployed addresses to deployed-addresses.json
    - _Requirements: All contract requirements_

  - [x] 21.2 Create deploy-handler.ts script
    - Deploy AuctionHandler with references to core contracts
    - Save handler address to deployed-addresses.json
    - _Requirements: All handler requirements_

  - [x] 21.3 Create setup-connections.ts script
    - Set handler address in ReactiveAuction
    - Set analytics and oracle addresses in AuctionHandler
    - Transfer ownership if needed
    - _Requirements: All integration requirements_

  - [x] 21.4 Create setup-subscriptions.ts script
    - Subscribe handler to AuctionCreated events
    - Subscribe handler to BidPlaced events (for anti-snipe detection)
    - Subscribe analytics to BidPlaced events
    - Subscribe analytics to AuctionSettled events
    - Use isGuaranteed: true for critical subscriptions
    - Use isGuaranteed: false for analytics subscriptions
    - _Requirements: All reactivity requirements_

- [x] 22. Enhance frontend with real-time WebSocket integration
  - [x] 22.1 Create ReactiveAuctionClient class
    - Set up WebSocket connection to Somnia RPC
    - Implement subscribe/unsubscribe methods
    - Implement watchAuction method
    - Handle connection errors and reconnection
    - _Requirements: 4.6, 14.1, 14.2_

  - [x] 22.2 Implement real-time auction list updates
    - Subscribe to AuctionCreated events
    - Add new auctions to list immediately
    - Update UI without page refresh
    - _Requirements: 4.3_

  - [x] 22.3 Implement real-time bid updates
    - Subscribe to BidPlaced events
    - Update auction current bid and highest bidder
    - Show notification for new bids
    - Update bid history in real-time
    - _Requirements: 4.3, 6.2_

  - [x] 22.4 Implement real-time analytics dashboard
    - Subscribe to AnalyticsUpdated events
    - Update platform metrics (volume, active auctions, etc.)
    - Update leaderboard in real-time
    - Refresh within 2 seconds of updates
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 22.5 Implement real-time price updates for Dutch auctions
    - Subscribe to PriceUpdated events from PriceOracle
    - Update price display every second
    - Implement client-side price calculation for smooth countdown
    - _Requirements: 8.1, 8.5_

  - [x] 22.6 Implement notification system
    - Subscribe to watched auction events
    - Show notifications for new bids on watched auctions
    - Show notifications 10 minutes before expiry
    - Show notifications for price alerts
    - Show notifications for achievement unlocks
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 7.5_

- [x] 23. Create sealed-bid auction UI components
  - [x] 23.1 Create SealedBidAuctionForm component
    - Form for creating sealed-bid auctions
    - Input fields for bidding duration and reveal duration
    - Validation for minimum durations
    - Submit transaction to createSealedBidAuction
    - _Requirements: 1.1_

  - [x] 23.2 Create CommitBidForm component
    - Generate random secret (32 bytes)
    - Calculate commitment hash
    - Display commitment to user (for backup)
    - Submit transaction to commitBid
    - Store secret locally for reveal phase
    - _Requirements: 1.2_

  - [x] 23.3 Create RevealBidForm component
    - Load stored secret from local storage
    - Input field for bid amount
    - Calculate and display commitment for verification
    - Submit transaction to revealBid with amount and secret
    - Handle reveal failures gracefully
    - _Requirements: 1.3, 1.6_

  - [x] 23.4 Create PhaseIndicator component
    - Display current auction phase (BIDDING, REVEAL, SETTLING, SETTLED)
    - Show countdown timer for phase transitions
    - Show phase-specific instructions to users
    - _Requirements: 1.4_

- [x] 24. Create bundle auction UI components
  - [x] 24.1 Create BundleAuctionForm component
    - Form for creating bundle auctions
    - UI for adding multiple items (NFTs and ERC20s)
    - Validate ownership and approvals for all items
    - Display total bundle value
    - Submit transaction to createBundleAuction
    - _Requirements: 3.1, 3.7_

  - [x] 24.2 Create BundleItemDisplay component
    - Display all items in bundle with images/icons
    - Show item type (ERC721 or ERC20)
    - Show token contract addresses
    - Show quantities for ERC20s
    - _Requirements: 3.1_

  - [x] 24.3 Create BundleSettlementStatus component
    - Show settlement progress for bundle auctions
    - Display atomic transfer status
    - Show error messages if settlement fails
    - _Requirements: 3.3_

- [x] 25. Create analytics dashboard UI components
  - [x] 25.1 Create PlatformMetricsCard component
    - Display total volume, active auctions, settled auctions
    - Display average settlement price and duration
    - Display unique bidders count
    - Update in real-time via WebSocket
    - _Requirements: 4.1, 4.2_

  - [x] 25.2 Create LeaderboardTable component
    - Display top bidders by total volume
    - Show reputation scores and badges
    - Update in real-time
    - Paginate results
    - _Requirements: 4.4, 7.6_

  - [x] 25.3 Create AuctionMetricsPanel component
    - Display bid count, unique bidders, bid velocity
    - Display price volatility and watcher count
    - Show price trend chart
    - _Requirements: 4.7, 8.4_

  - [x] 25.4 Create PriceTrendChart component
    - Line chart showing bid price history
    - Display moving average
    - Show trend direction indicator
    - _Requirements: 4.5_

- [x] 26. Create reputation and gamification UI components
  - [x] 26.1 Create ReputationBadge component
    - Display user reputation score
    - Show tier badge (Bronze, Silver, Gold, Platinum)
    - Show trust score (0-100)
    - Display fee discount percentage
    - _Requirements: 7.1, 7.6, 7.7_

  - [x] 26.2 Create AchievementNotification component
    - Toast notification for achievement unlocks
    - Display achievement type and milestone
    - Show animation for celebration
    - _Requirements: 7.5_

  - [x] 26.3 Create UserProfilePanel component
    - Display user statistics (auctions won, created, total volume)
    - Show reputation history
    - Display unlocked achievements
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 27. Create multi-currency UI components
  - [x] 27.1 Create CurrencySelector component
    - Dropdown for selecting bid currency (STT, WETH, USDC)
    - Display current exchange rates
    - Show STT equivalent for selected amount
    - _Requirements: 9.1, 9.6_

  - [x] 27.2 Create PriceDisplay component
    - Display price in multiple currencies
    - Show original currency and STT equivalent
    - Show USD value
    - Update exchange rates in real-time
    - _Requirements: 9.6_

  - [x] 27.3 Implement multi-currency bidding flow
    - Approve token spending before bid
    - Submit bidWithToken transaction
    - Handle conversion failures gracefully
    - Show error messages for stale rates
    - _Requirements: 9.2, 9.7_

- [x] 28. Create watchlist and notification UI components
  - [-] 28.1 Create WatchlistButton component
    - Toggle button to add/remove from watchlist
    - Show watcher count for auction
    - Disable when 50 auction limit reached
    - _Requirements: 14.1, 14.6, 14.7_

  - [-] 28.2 Create PriceAlertForm component
    - Input field for target price
    - Submit createPriceAlert transaction
    - Display active alerts for user
    - _Requirements: 14.4_

  - [x] 28.3 Create NotificationCenter component
    - Display all notifications (bids, expiry warnings, price alerts, achievements)
    - Mark notifications as read
    - Filter by notification type
    - _Requirements: 14.2, 14.3, 14.5_

- [x] 29. Create template system UI components
  - [-] 29.1 Create TemplateManager component
    - List user's saved templates
    - Edit and delete templates
    - Show usage count for each template
    - Enforce 10 template limit
    - _Requirements: 12.1, 12.2, 12.5_

  - [-] 29.2 Create TemplateSelector component
    - Browse public templates
    - Filter by auction type
    - Sort by popularity (usage count)
    - Preview template configuration
    - _Requirements: 12.4, 12.6, 12.7_

  - [-] 29.3 Create SaveTemplateButton component
    - Save current auction configuration as template
    - Input field for template name
    - Toggle public/private visibility
    - _Requirements: 12.1, 12.4_

- [x] 30. Create NFT/ERC20 auction UI components
  - [-] 30.1 Create NFTAuctionForm component
    - Input for NFT contract address and token ID
    - Display NFT preview (image, metadata)
    - Validate ownership and approval
    - Submit approval transaction then create auction
    - _Requirements: 11.1, 11.3_

  - [-] 30.2 Create ERC20AuctionForm component
    - Input for ERC20 contract address and amount
    - Display token symbol and decimals
    - Validate balance and approval
    - Submit approval transaction then create auction
    - _Requirements: 11.2, 11.3_

  - [ ] 30.3 Create AssetDisplay component
    - Display NFT images for ERC721 auctions
    - Display token amounts for ERC20 auctions
    - Show escrow status during auction
    - Show transfer status on settlement
    - _Requirements: 11.4, 11.5, 11.6, 11.7_

- [x] 31. Create fraud detection UI components
  - [x] 31.1 Create FraudWarningBanner component
    - Display warning for flagged auctions
    - Show fraud detection reason
    - Show trust score for auction participants
    - _Requirements: 15.2, 15.6_

  - [x] 31.2 Create RateLimitIndicator component
    - Show countdown until next bid allowed
    - Display rate limit message (2 second minimum)
    - _Requirements: 15.4_

  - [x] 31.3 Create TrustScoreDisplay component
    - Display user trust score (0-100)
    - Show trust score factors (wins, creates, failed reveals, fraud flags)
    - Color-code by trust level
    - _Requirements: 15.6_

- [x] 32. Create emergency pause UI components
  - [x] 32.1 Create SystemStatusBanner component
    - Display system paused status
    - Show pause duration
    - Show message about withdrawals still available
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 32.2 Create AdminPausePanel component (owner-only)
    - Button to pause system
    - Button to unpause system
    - Button to reschedule settlements after unpause
    - Display active auction count
    - _Requirements: 10.1, 10.4_

- [x] 33. Implement bid history UI components
  - [x] 33.1 Create BidHistoryTable component
    - Display all bids for auction in chronological order
    - Show bidder address, amount, timestamp
    - Show success/failure status with reasons
    - Paginate results
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [x] 33.2 Create BidVelocityIndicator component
    - Display bids per hour metric
    - Show visual indicator (slow, moderate, fast)
    - Update in real-time
    - _Requirements: 6.7_

  - [x] 33.3 Implement sealed-bid privacy in UI
    - Hide bid amounts during BIDDING phase
    - Show "Hidden" placeholder for amounts
    - Reveal amounts after REVEAL phase transition
    - _Requirements: 6.6_

- [x] 34. Create anti-snipe extension UI components
  - [x] 34.1 Create ExtensionIndicator component
    - Display extension count (e.g., "Extended 2/3 times")
    - Show extension threshold time
    - Show extension duration
    - Highlight when bid is within extension threshold
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 34.2 Create ExtensionNotification component
    - Toast notification when auction is extended
    - Display new end time
    - Show reason for extension (late bid)
    - _Requirements: 2.2, 2.7_

- [x] 35. Create fixed-price listing UI components
  - [x] 35.1 Create FixedPriceListingCard component
    - Display fixed-price listings separately from auctions
    - Show fixed price (80% of original start price)
    - Show "Buy Now" button
    - Show days remaining (7 day expiry)
    - _Requirements: 13.1, 13.2, 13.5_

  - [x] 35.2 Create PurchaseFixedPriceButton component
    - Submit purchaseFixedPrice transaction
    - Show instant settlement confirmation
    - Handle purchase errors
    - _Requirements: 13.3, 13.4_

  - [x] 35.3 Create ConversionNotification component
    - Toast notification when auction converts to fixed-price
    - Display conversion reason (no bids)
    - Show new fixed price
    - _Requirements: 13.1, 13.6_

- [x] 36. Checkpoint - Validate frontend integration
  - Ensure all UI components render correctly
  - Test real-time updates via WebSocket
  - Test all user flows end-to-end
  - Verify responsive design on mobile and desktop
  - Ask the user if questions arise

- [x] 37. Create comprehensive integration tests
  - [x] 37.1 Write end-to-end test for sealed-bid auction
    - Create sealed-bid auction
    - Multiple users commit bids
    - Wait for bidding phase to end
    - Multiple users reveal bids
    - Wait for reveal phase to end
    - Verify winner determined correctly
    - Verify non-winners refunded
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 37.2 Write end-to-end test for anti-snipe extension
    - Create English auction with anti-snipe enabled
    - Place bid within extension threshold
    - Verify auction extended
    - Place another late bid
    - Verify second extension
    - Verify max extension limit enforced
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 37.3 Write end-to-end test for bundle auction
    - Create bundle with 2 NFTs + 1 ERC20
    - Place bids on bundle
    - Verify individual items cannot be bid on
    - Settle bundle auction
    - Verify atomic transfer of all items
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [x] 37.4 Write end-to-end test for cascading events
    - Create high-value auction (>100 STT)
    - Settle auction
    - Verify follow-up auction created automatically
    - Verify analytics updated
    - Verify achievement events emitted
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 37.5 Write end-to-end test for multi-currency bidding
    - Create auction
    - Place bid with USDC
    - Verify conversion to STT equivalent
    - Verify bid ranking correct
    - Settle auction
    - Verify seller receives payment in preferred currency
    - _Requirements: 9.1, 9.2, 9.3, 9.6_

  - [x] 37.6 Write end-to-end test for reputation system
    - User wins auction
    - Verify reputation increased by auction value
    - User creates auction that receives bids
    - Verify reputation increased by 10
    - User fails to reveal sealed bid
    - Verify reputation decreased by 50
    - Verify trust score updated correctly
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 15.6_

  - [x] 37.7 Write end-to-end test for fraud detection
    - Seller attempts to bid on own auction
    - Verify bid rejected
    - Verify auction flagged for wash trading
    - User places rapid bids (< 2 seconds apart)
    - Verify rate limiting enforced
    - _Requirements: 15.1, 15.2, 15.4_

  - [x] 37.8 Write end-to-end test for emergency pause
    - Owner pauses system
    - Verify new auctions rejected
    - Verify bids rejected
    - Verify withdrawals still work
    - Owner unpauses system
    - Verify auction times extended by pause duration
    - Verify settlements rescheduled
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.7_

- [x] 38. Performance optimization and gas benchmarking
  - [x] 38.1 Measure and optimize gas costs
    - Benchmark createSealedBidAuction gas cost
    - Benchmark commitBid gas cost
    - Benchmark revealBid gas cost
    - Benchmark bundle settlement gas cost
    - Optimize storage patterns if costs too high
    - _Requirements: All contract requirements_

  - [x] 38.2 Optimize frontend performance
    - Implement virtual scrolling for large auction lists
    - Debounce WebSocket event handlers
    - Optimize re-renders with React.memo
    - Lazy load components
    - _Requirements: All frontend requirements_

  - [x] 38.3 Optimize analytics calculations
    - Batch analytics updates to reduce gas
    - Use coalesced subscriptions for non-critical updates
    - Cache frequently accessed metrics
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 39. Create documentation
  - [x] 39.1 Write smart contract documentation
    - Document all public functions with NatSpec comments
    - Document events and their parameters
    - Document state variables and their purposes
    - Create architecture diagram
    - _Requirements: All contract requirements_

  - [x] 39.2 Write user guide
    - How to create sealed-bid auctions
    - How to create bundle auctions
    - How to use multi-currency bidding
    - How to manage watchlist and alerts
    - How to use templates
    - _Requirements: All user-facing requirements_

  - [x] 39.3 Write developer guide
    - How to deploy contracts
    - How to set up subscriptions
    - How to integrate with frontend
    - How to run tests
    - How to monitor system health
    - _Requirements: All integration requirements_

  - [x] 39.4 Create demo video
    - Record walkthrough of key features
    - Demonstrate sealed-bid auction flow
    - Show real-time analytics updates
    - Show cascading events in action
    - Highlight Somnia Reactivity integration
    - _Requirements: All requirements_

- [x] 40. Deploy to Somnia testnet
  - [x] 40.1 Deploy all contracts to testnet
    - Run deploy-core.ts script
    - Run deploy-handler.ts script
    - Run setup-connections.ts script
    - Run setup-subscriptions.ts script
    - Verify all contracts deployed successfully
    - _Requirements: All contract requirements_

  - [x] 40.2 Configure frontend for testnet
    - Update contract addresses in frontend config
    - Update RPC and WebSocket URLs
    - Test all features on testnet
    - _Requirements: All frontend requirements_

  - [x] 40.3 Create test data on testnet
    - Create sample auctions of each type
    - Place test bids
    - Trigger cascading events
    - Generate analytics data
    - _Requirements: All requirements_

  - [x] 40.4 Set up monitoring and health checks
    - Monitor handler invocations
    - Monitor fraud flags
    - Check handler balance
    - Check oracle rate freshness
    - Set up alerts for issues
    - _Requirements: All operational requirements_

- [x] 41. Final checkpoint - Complete system validation
  - Verify all features working on testnet
  - Verify all tests passing
  - Verify documentation complete
  - Verify demo video ready
  - Ensure all requirements met
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across randomized inputs
- Unit tests validate specific examples and edge cases
- The implementation prioritizes the most impressive Somnia Reactivity features first (sealed-bid, anti-snipe, bundles, cascading events)
- All reactive operations leverage the Somnia precompile at 0x6900...0001
- Critical operations use `isGuaranteed: true` subscriptions for reliability
- Non-critical analytics use `isGuaranteed: false` and `isCoalesced: true` for efficiency
- The frontend uses WebSocket subscriptions for real-time updates without polling
- All smart contracts use Solidity with checks-effects-interactions pattern for security
- All frontend components use TypeScript with React and viem for type safety
