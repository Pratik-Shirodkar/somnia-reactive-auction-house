# Requirements Document: Hackathon-Winning Enhancements

## Introduction

This document defines requirements for transforming ReactiveAuction into the winning submission for the Somnia Reactivity hackathon. The enhancements focus on demonstrating advanced reactivity patterns, superior real-time UX, and innovative features that differentiate this project from 70+ competitors including DeFi automation tools, gaming platforms, analytics dashboards, and NFT systems.

The current system provides Dutch and English auctions with basic auto-settlement. These enhancements will add sealed-bid auctions with cryptographic commitments, anti-sniping protection via automatic time extensions, cross-auction bundle mechanics, real-time analytics with cascading reactive updates, and gamification features—all leveraging Somnia Reactivity in ways competitors haven't demonstrated.

## Glossary

- **Auction_System**: The ReactiveAuction smart contract managing all auction types and settlements
- **Handler_System**: The AuctionHandler contract implementing ISomniaEventHandler for reactive triggers
- **Sealed_Bid_Auction**: An auction where bids are cryptographically hidden until reveal phase
- **Commitment**: A cryptographic hash of a bid amount and secret, submitted during bidding phase
- **Reveal_Phase**: Time period after bidding closes where bidders reveal their actual bids
- **Bundle**: A collection of multiple auction items that must be won together as a set
- **Anti_Snipe_Extension**: Automatic auction time extension when bids arrive near expiry
- **Cascade_Event**: A reactive event that triggers multiple downstream automated actions
- **Analytics_Engine**: Real-time calculation system for auction statistics and insights
- **Reputation_Score**: Numerical rating of user behavior based on auction participation
- **Bid_History**: Complete record of all bids placed on an auction
- **Price_Oracle**: System component that tracks and reports current auction valuations
- **WebSocket_Feed**: Real-time event subscription mechanism for frontend updates
- **Reactivity_Precompile**: Somnia's native contract at 0x6900...0001 for creating subscriptions
- **Schedule_Event**: Time-based system event that fires at specific timestamps
- **Guaranteed_Subscription**: Reactivity subscription with isGuaranteed=true for critical operations

## Requirements

### Requirement 1: Sealed-Bid Auction with Commit-Reveal

**User Story:** As an auction participant, I want to place hidden bids that are only revealed after bidding closes, so that I can bid my true valuation without being influenced by other bidders.

#### Acceptance Criteria

1. THE Auction_System SHALL support creation of sealed-bid auctions with configurable bidding and reveal durations
2. WHEN a user submits a sealed bid, THE Auction_System SHALL store only the cryptographic commitment hash
3. THE Auction_System SHALL reject reveal attempts that do not match the original commitment
4. WHEN the bidding phase ends, THE Handler_System SHALL emit a Schedule_Event for the reveal deadline
5. WHEN the reveal phase ends, THE Handler_System SHALL automatically determine the winner from valid reveals
6. IF a bidder fails to reveal before the deadline, THEN THE Auction_System SHALL forfeit their bid eligibility
7. THE Auction_System SHALL refund all non-winning revealed bids automatically after settlement
8. FOR ALL valid sealed bids, committing a bid then revealing with correct parameters SHALL produce a valid bid (round-trip property)

### Requirement 2: Anti-Sniping Time Extension

**User Story:** As an auction seller, I want the auction to automatically extend when last-second bids arrive, so that legitimate bidders have fair opportunity to respond.

#### Acceptance Criteria

1. WHEN a bid is placed within the extension threshold time, THE Auction_System SHALL extend the auction end time
2. THE Auction_System SHALL emit an AuctionExtended event containing the new end time
3. WHEN an auction is extended, THE Handler_System SHALL cancel the previous Schedule_Event and create a new one
4. THE Auction_System SHALL limit the maximum number of extensions to prevent infinite延长
5. THE Auction_System SHALL apply extension logic to both English and sealed-bid auctions
6. WHERE anti-sniping is enabled, THE Auction_System SHALL extend by the configured extension duration
7. THE WebSocket_Feed SHALL notify all subscribers immediately when an extension occurs

### Requirement 3: Auction Bundles with Atomic Settlement

**User Story:** As a seller, I want to create bundles of multiple items that must be won together, so that I can sell related items as a cohesive set.

#### Acceptance Criteria

1. THE Auction_System SHALL support creation of bundle auctions containing multiple item references
2. THE Auction_System SHALL enforce that all items in a bundle must be won by the same bidder
3. WHEN a bundle auction settles, THE Handler_System SHALL atomically transfer all items or revert entirely
4. THE Auction_System SHALL calculate bundle pricing as the sum of individual item bids
5. IF any item in a bundle fails to meet its reserve price, THEN THE Auction_System SHALL cancel the entire bundle
6. THE Auction_System SHALL prevent individual items in a bundle from being bid on separately
7. WHEN a bundle is created, THE Auction_System SHALL validate that all referenced items exist and are available

### Requirement 4: Real-Time Analytics Dashboard

**User Story:** As a platform user, I want to see live statistics about auction activity, so that I can make informed bidding decisions.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL calculate total platform volume in real-time as bids are placed
2. THE Analytics_Engine SHALL track average auction duration and settlement prices by auction type
3. WHEN any auction event occurs, THE Analytics_Engine SHALL update aggregate statistics within 2 seconds
4. THE Analytics_Engine SHALL maintain a leaderboard of top bidders by total volume
5. THE Analytics_Engine SHALL calculate and display price trends for similar auction items
6. THE WebSocket_Feed SHALL push analytics updates to subscribed clients without polling
7. THE Analytics_Engine SHALL compute auction velocity metrics showing bids per hour

### Requirement 5: Cascading Reactive Events

**User Story:** As a platform operator, I want complex auction scenarios to trigger multiple automated actions, so that sophisticated auction mechanics work without manual intervention.

#### Acceptance Criteria

1. WHEN a high-value auction settles, THE Handler_System SHALL automatically create a follow-up auction for related items
2. WHEN a bundle auction is created, THE Handler_System SHALL schedule reminder events at 75%, 50%, and 25% time remaining
3. WHEN an auction receives no bids, THE Handler_System SHALL automatically reduce the reserve price and restart
4. THE Handler_System SHALL chain multiple Schedule_Events for multi-phase auction workflows
5. WHEN a user wins their third auction, THE Handler_System SHALL emit an achievement event
6. THE Handler_System SHALL create cascading subscriptions where one event triggers creation of new subscriptions
7. IF a cascade event fails, THEN THE Handler_System SHALL log the failure and continue processing remaining events

### Requirement 6: Bid History and Transparency

**User Story:** As an auction participant, I want to see complete bid history with timestamps, so that I can verify auction integrity and make strategic decisions.

#### Acceptance Criteria

1. THE Auction_System SHALL store complete Bid_History for every auction including bidder, amount, and timestamp
2. THE Auction_System SHALL emit BidPlaced events containing all bid details for WebSocket_Feed subscription
3. THE Auction_System SHALL provide a view function returning paginated bid history for any auction
4. WHEN viewing bid history, THE Auction_System SHALL display bids in chronological order
5. THE Bid_History SHALL include both successful and failed bid attempts with failure reasons
6. WHERE privacy is required for sealed-bid auctions, THE Auction_System SHALL hide bid amounts until reveal phase
7. THE Auction_System SHALL calculate and display bid velocity showing time between consecutive bids

### Requirement 7: Reputation and Gamification System

**User Story:** As a platform user, I want to earn reputation points and achievements for auction participation, so that I can demonstrate my standing in the community.

#### Acceptance Criteria

1. THE Auction_System SHALL track Reputation_Score for each user based on auction participation
2. WHEN a user wins an auction, THE Auction_System SHALL increase their reputation by the auction value
3. WHEN a user creates an auction that receives bids, THE Auction_System SHALL increase their reputation
4. THE Auction_System SHALL decrease reputation for users who fail to reveal sealed bids
5. THE Handler_System SHALL emit achievement events when users reach reputation milestones
6. THE Auction_System SHALL display user reputation badges in the frontend interface
7. WHERE a user has high reputation, THE Auction_System SHALL offer reduced platform fees

### Requirement 8: Advanced Price Discovery

**User Story:** As a bidder, I want to see real-time price updates and predictions, so that I can make informed bidding decisions.

#### Acceptance Criteria

1. THE Price_Oracle SHALL calculate current Dutch auction prices every second and emit PriceUpdated events
2. THE Price_Oracle SHALL predict final settlement prices based on historical data and current bid velocity
3. WHEN bid velocity increases, THE Price_Oracle SHALL adjust price predictions within 5 seconds
4. THE Price_Oracle SHALL calculate price volatility metrics for each auction type
5. THE WebSocket_Feed SHALL push price updates to subscribers at 1-second intervals for active auctions
6. THE Price_Oracle SHALL identify and flag unusual bidding patterns that may indicate manipulation
7. FOR ALL Dutch auctions, calculating price at time T then at time T+1 SHALL show price decrease (monotonic property)

### Requirement 9: Multi-Currency Support with Automatic Conversion

**User Story:** As an international user, I want to bid using different tokens, so that I can participate without manual token swaps.

#### Acceptance Criteria

1. THE Auction_System SHALL accept bids in STT, WETH, and USDC tokens
2. WHEN a bid is placed in a non-native token, THE Auction_System SHALL convert to STT using current exchange rates
3. THE Auction_System SHALL settle auctions in the seller's preferred currency
4. THE Price_Oracle SHALL fetch exchange rates from Somnia-native price feeds
5. WHEN exchange rates update, THE Handler_System SHALL recalculate bid rankings within 10 seconds
6. THE Auction_System SHALL display bid amounts in both original currency and STT equivalent
7. IF currency conversion fails, THEN THE Auction_System SHALL reject the bid and return funds

### Requirement 10: Emergency Pause and Recovery

**User Story:** As a platform operator, I want to pause auctions in emergency situations, so that I can protect users from exploits or bugs.

#### Acceptance Criteria

1. THE Auction_System SHALL support emergency pause functionality restricted to contract owner
2. WHEN the system is paused, THE Auction_System SHALL reject all new auction creation and bidding
3. WHILE the system is paused, THE Auction_System SHALL allow users to withdraw existing bids
4. WHEN the system is unpaused, THE Handler_System SHALL reschedule all pending settlement events
5. THE Auction_System SHALL emit SystemPaused and SystemUnpaused events for WebSocket_Feed notification
6. THE Auction_System SHALL maintain auction time integrity by extending durations during pause periods
7. WHERE an auction expires during pause, THE Auction_System SHALL extend it by the pause duration upon unpause

### Requirement 11: NFT and ERC20 Token Auction Support

**User Story:** As a user, I want to auction NFTs and ERC20 tokens instead of just ETH, so that I can trade any digital asset.

#### Acceptance Criteria

1. THE Auction_System SHALL support auctions for ERC721 NFT tokens
2. THE Auction_System SHALL support auctions for ERC20 token amounts
3. WHEN creating an NFT auction, THE Auction_System SHALL verify the seller owns the token and has granted approval
4. WHEN an NFT auction settles, THE Auction_System SHALL transfer the NFT to the winner atomically
5. THE Auction_System SHALL escrow NFTs and tokens during active auctions
6. THE Auction_System SHALL return escrowed assets if auctions are cancelled or receive no bids
7. THE Auction_System SHALL emit AssetTransferred events for all NFT and token movements

### Requirement 12: Auction Templates and Quick Launch

**User Story:** As a frequent seller, I want to save auction configurations as templates, so that I can quickly create similar auctions.

#### Acceptance Criteria

1. THE Auction_System SHALL allow users to save auction configurations as reusable templates
2. THE Auction_System SHALL store template parameters including type, duration, pricing, and extensions
3. WHEN creating an auction from a template, THE Auction_System SHALL pre-fill all saved parameters
4. THE Auction_System SHALL support template sharing where users can copy public templates
5. THE Auction_System SHALL limit each user to 10 saved templates
6. WHEN a template is used, THE Auction_System SHALL track usage statistics
7. THE Auction_System SHALL display popular templates in the frontend interface

### Requirement 13: Automated Market Making for Failed Auctions

**User Story:** As a seller, I want failed auctions to automatically convert to fixed-price listings, so that I don't lose sales opportunities.

#### Acceptance Criteria

1. WHEN an auction ends with no bids, THE Handler_System SHALL automatically create a fixed-price listing
2. THE Handler_System SHALL set the fixed price at 80% of the original starting price
3. THE Auction_System SHALL allow instant purchase of fixed-price listings
4. WHEN a fixed-price listing sells, THE Auction_System SHALL settle immediately without waiting for expiry
5. THE Handler_System SHALL cancel fixed-price listings after 7 days if unsold
6. THE Auction_System SHALL emit AuctionConvertedToFixedPrice events for WebSocket_Feed notification
7. WHERE a seller opts out, THE Auction_System SHALL not create automatic fixed-price listings

### Requirement 14: Social Features and Auction Watching

**User Story:** As a user, I want to follow specific auctions and receive notifications, so that I don't miss bidding opportunities.

#### Acceptance Criteria

1. THE Auction_System SHALL allow users to add auctions to a watchlist
2. WHEN a watched auction receives a new bid, THE WebSocket_Feed SHALL send a notification to the watcher
3. THE Auction_System SHALL send notifications when watched auctions are 10 minutes from expiry
4. THE Auction_System SHALL allow users to set custom price alerts for specific auctions
5. WHEN a price alert triggers, THE Handler_System SHALL emit a PriceAlertTriggered event
6. THE Auction_System SHALL display the number of watchers for each auction
7. THE Auction_System SHALL limit each user to 50 watched auctions

### Requirement 15: Advanced Fraud Detection

**User Story:** As a platform operator, I want to detect and prevent fraudulent bidding patterns, so that auctions remain fair and trustworthy.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL detect wash trading patterns where the same user bids on their own auctions
2. WHEN suspicious activity is detected, THE Auction_System SHALL flag the auction for review
3. THE Analytics_Engine SHALL identify sybil attacks using multiple addresses from the same source
4. THE Auction_System SHALL rate-limit bid submissions to prevent spam attacks
5. WHEN a user is flagged for fraud, THE Auction_System SHALL restrict their bidding privileges
6. THE Analytics_Engine SHALL calculate trust scores based on bidding history and reputation
7. IF an auction has multiple fraud flags, THEN THE Auction_System SHALL automatically pause it

