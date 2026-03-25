# ReactiveAuction — Features

## ⚡ Smart Contract

### 4 Auction Types
| Type | Mechanism | Settlement |
|------|-----------|-----------|
| **Dutch** | Price decreases per-block from start price to floor | First buyer wins at current price |
| **English** | Ascending bids with minimum increments | Highest bidder wins at endTime |
| **Sealed-Bid** | Cryptographic commit-reveal (`keccak256(bidder, amount, secret)`) | Highest revealed bid wins |
| **Bundle** | Multi-asset batch auctions | All-or-nothing settlement |

### Autonomous Settlement
- **Zero infrastructure** — No keeper bots, cron jobs, or off-chain servers
- **Schedule trigger** — Somnia validators fire `settleAuction()` at exact `endTime`
- **Event subscription** — `AuctionHandler` auto-schedules settlement for every new auction
- **Anti-snipe** — English auctions auto-extend when bids arrive in final minutes

### Multi-Currency
- Native STT payments
- Any ERC20 token as payment currency
- Automatic symbol/decimal resolution
- Token approval flow built into UI

### Security
- Commit-reveal cryptography for sealed-bid auctions
- Minimum bid increments to prevent dust bids
- Circuit breaker for unusual activity detection
- ReentrancyGuard on all state-changing functions

---

## 🎨 Frontend

### Landing Page
- Animated gradient hero text
- Problem/solution section with cost comparison
- 4 auction type feature cards with color-coded icons
- 3-step architecture flow diagram
- Traditional vs ReactiveAuction comparison table (8 features)
- Tech stack grid
- CTA section with explorer links

### Dashboard (3 Tabs)

#### Market Tab
- Live auction grid with real-time updates
- Type badges (Dutch / English / Sealed)
- Countdown timers with color urgency (green → amber → red)
- Auction card hover glow effects (type-specific)
- Skeleton loading states
- Create Auction modal (all 4 types)
- Bid History panel (expandable per-auction on-chain data)

#### Analytics Tab
- Platform Metrics — Total Volume, Active Auctions, Settled, Avg Price, Unique Bidders
- Leaderboard — Top bidders ranked by activity

#### Activity Tab
- REACTIVITY_PROOF panel — Botless execution status, event counts
- TRUST_CIRCUIT_BREAKER — System health status
- Live Validator — Test bid amounts against auction state
- Narrative Mode — Event timeline in human-readable format

### Real-Time (No Polling)
- WebSocket Data Streams via `watchContractEvent`
- Events: `AuctionCreated`, `BidPlaced`, `AuctionSettled`, `AuctionExtended`, `PhaseTransitioned`
- Toast notifications for important events
- Stats auto-update on every event

---

## 🧪 Testing

- **105 passing tests** across 4 test suites
- Unit tests for core auction mechanics
- Dutch auction price curve validation
- English auction bid increment enforcement
- Bundle auction multi-asset settlement
- Property-based testing with fast-check

---

## 🏗️ Infrastructure

- **Somnia Shannon Testnet** (Chain ID 50312)
- **Google Cloud Run** deployment with multi-stage Docker build
- **Nginx** SPA routing for client-side navigation
