# ⚡ ReactiveAuction — On-Chain Auction House Powered by Somnia Reactivity

<div align="center">
  <h3>4 Auction Types · Zero-Bot Auto-Settlement · Real-Time Dashboard</h3>
  <p>No keepers. No polling. No off-chain servers. Just Somnia Native Reactivity.</p>
  
  <p>
    <a href="https://reactive-auction-h4rgtit3da-uc.a.run.app"><img src="https://img.shields.io/badge/🌐_Live_Demo-reactive--auction-7c3aed.svg" alt="Live Demo" /></a>
    <img src="https://img.shields.io/badge/Somnia-Reactivity-7c3aed.svg" alt="Somnia Reactivity" />
    <img src="https://img.shields.io/badge/Solidity-0.8.24-363636.svg" alt="Solidity" />
    <img src="https://img.shields.io/badge/React_19-TypeScript-61dafb.svg" alt="React" />
    <img src="https://img.shields.io/badge/Network-Somnia%20Testnet-06b6d4.svg" alt="Testnet" />
    <img src="https://img.shields.io/badge/Tests-105_passing-10b981.svg" alt="Tests" />
  </p>

  <p>
    <strong>
      <a href="https://reactive-auction-h4rgtit3da-uc.a.run.app">Live Demo</a> ·
      <a href="https://shannon-explorer.somnia.network/address/0x136D7081b7A98996B841f6BD72093491ff8964Ae">View on Explorer</a> ·
      <a href="https://testnet.somnia.network/">Get STT Tokens</a>
    </strong>
  </p>
</div>

---

## 🎯 What is ReactiveAuction?

ReactiveAuction is a **fully autonomous, on-chain auction house** that leverages **Somnia's Native On-chain Reactivity** to eliminate the need for keeper bots, cron jobs, or any off-chain infrastructure. It supports **4 auction types** — Dutch, English, Sealed-Bid, and Bundle — all of which settle themselves when they expire.

### The Problem
Traditional on-chain auctions require **external systems** to settle expired auctions:
- ❌ **Chainlink Keepers** — ~$10/month per upkeep contract
- ❌ **Gelato / OpenZeppelin Defender** — Off-chain relayer, single point of failure
- ❌ **Custom Bot Server** — Your own VPS running 24/7, DevOps overhead

### The Solution: $0/year
ReactiveAuction uses **three Somnia Reactivity primitives** to make auctions fully autonomous:

| Reactivity Primitive | Usage | Replaces |
|---|---|---|
| **`Schedule` System Event** | Auto-settles expired auctions at exact timestamp | Chainlink Keepers / Gelato |
| **`AuctionCreated` Event Subscription** | Handler auto-schedules settlement for new auctions | Off-chain event listener |
| **WebSocket Data Streams** | Real-time UI updates (bids, settlements, price ticks) | Polling every N seconds |

> **Without Somnia Reactivity, this dApp needs 3 separate off-chain systems. With it, it needs zero.**

---

## 🎨 Screenshots

### Landing Page
The professional landing page showcases all features, architecture, and a comparison table.

### Dashboard — Market Tab
Real-time auction marketplace with live bid cards, type badges (Dutch/English/Sealed), countdown timers with color-coded urgency (green → amber → red), and skeleton loading states.

### Dashboard — Analytics Tab
Platform metrics (Total Volume, Active/Settled Auctions, Avg Price, Unique Bidders) and a leaderboard of top bidders.

### Dashboard — Activity Tab
REACTIVITY_PROOF panel showing live botless execution stats, created/bid/settled event counts, and TRUST_CIRCUIT_BREAKER status.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     User's Browser (React 19)                     │
│                                                                   │
│  Landing Page → Launch App → Tabbed Dashboard                     │
│  ├── Market Tab    (Live auctions, bidding, auction creation)     │
│  ├── Analytics Tab (Platform metrics, leaderboard)                │
│  └── Activity Tab  (Event feed, proof panel, circuit breaker)     │
│                                                                   │
│  Real-time updates via Somnia WebSocket Data Streams              │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                 Somnia Shannon Testnet (Chain ID 50312)            │
│                                                                   │
│  ReactiveAuction.sol (0x136D70...964Ae)                           │
│    ├── createDutchAuction()    → Price decreases per-block        │
│    ├── createEnglishAuction()  → Classic ascending bids           │
│    ├── createSealedBidAuction()→ Commit-reveal cryptography       │
│    ├── createBundleAuction()   → Multi-asset batch auctions       │
│    ├── bid() / commitBid() / revealBid()                          │
│    ├── settleAuction()         → Winner receives assets           │
│    └── Anti-snipe protection   → Auto-extends on late bids        │
│                                                                   │
│  AuctionHandler.sol (0xdda32E...600F)                             │
│    ├── onEvent(AuctionCreated) → Creates Schedule subscription    │
│    └── onEvent(Schedule)       → Auto-calls settleAuction()       │
│                                                                   │
│  Flow:                                                            │
│  1. User creates auction → AuctionCreated event emitted           │
│  2. AuctionHandler reacts → Schedules auto-settlement             │
│  3. Schedule fires at endTime → AuctionHandler settles            │
│  4. No bots needed. Somnia validators do the work.                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎮 How Reactivity Was Used

### 1. On-Chain: `SomniaEventHandler` for Auto-Settlement
The `AuctionHandler` contract extends `ISomniaEventHandler`. When an auction is created, it:
- Listens for `AuctionCreated` events via an on-chain subscription
- Creates a `Schedule` subscription for the auction's `endTime`
- When the schedule fires, Somnia validators automatically invoke `onEvent()` → `settleAuction()`

```solidity
// AuctionHandler.sol — Somnia validators call this automatically
function onEvent(address emitter, bytes32[] calldata eventTopics, bytes calldata data) external override {
    if (emitter == SOMNIA_REACTIVITY_PRECOMPILE) {
        _settleExpiredAuctions(); // Schedule fired → Auto-settle!
    }
    if (eventTopics[0] == AUCTION_CREATED_SELECTOR) {
        _scheduleAutoSettlement(auctionId); // New auction → Schedule future settlement
    }
}
```

### 2. On-Chain: `Schedule` System Event
The handler creates a `Schedule` subscription at the exact millisecond timestamp when each auction expires. This is a one-off trigger that Somnia validators execute — no keeper infrastructure needed.

### 3. Off-Chain: WebSocket Data Streams for Real-Time UI
The React frontend uses viem's `watchContractEvent` to subscribe to `AuctionCreated`, `BidPlaced`, and `AuctionSettled` events. The event feed, dashboard stats, and auction cards all update in real-time without polling.

---

## ⚙️ Features

### Smart Contract
- **4 Auction Types** — Dutch (descending price), English (ascending bids), Sealed-Bid (commit-reveal), Bundle (multi-asset)
- **Auto-Settlement** — Somnia Reactivity schedules settlement at exact endTime
- **Anti-Snipe Protection** — English auctions auto-extend when late bids arrive
- **Sealed-Bid Cryptography** — `keccak256(abi.encodePacked(bidder, amount, secret))` commit-reveal scheme
- **Multi-Currency** — Native STT + any ERC20 token as payment
- **Minimum Bid Increments** — Configurable per-auction to prevent dust bids
- **105 Passing Tests** — Unit tests + property-based testing with fast-check

### Frontend
- **Professional Landing Page** — Hero, feature cards, architecture flow, comparison table, tech stack
- **Tabbed Dashboard** — Market / Analytics / Activity with animated transitions
- **Real-Time Updates** — WebSocket-powered, no polling
- **Skeleton Loading** — Shimmer cards while data loads
- **Countdown Timers** — Color-coded urgency (green → amber → red)
- **Auction Card Glow** — Type-specific hover effects (rose/Dutch, emerald/English)
- **Animated Background** — CSS-only gradient orbs
- **Bid History Panel** — Expandable per-auction on-chain bid history
- **Platform Analytics** — Volume, bidders, settled auctions, avg price

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MetaMask with [Somnia Testnet](https://testnet.somnia.network/) configured
- STT tokens from the [faucet](https://testnet.somnia.network/)

### 1. Install Dependencies

```bash
# Root (contracts)
npm install

# Frontend
cd frontend && npm install --legacy-peer-deps && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your deployer private key
```

### 3. Deploy Contracts

```bash
npx hardhat compile
npm run deploy
```

This will:
- Deploy `ReactiveAuction` and `AuctionHandler`
- Link the handler to the auction contract
- Fund the handler with 35 STT for subscriptions
- Create the initial `AuctionCreated` event subscription
- Save addresses to `deployed-addresses.json`

### 4. Update Frontend Config

Copy deployed addresses from `deployed-addresses.json` into `frontend/src/config/chain.ts`.

### 5. Run Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:5173

---

## 📁 Project Structure

```
auction-house/
├── contracts/
│   ├── ReactiveAuction.sol          # Core auction logic (4 auction types)
│   └── AuctionHandler.sol           # Somnia Event Handler (auto-settlement)
├── test/
│   ├── task1-coreAuction.test.ts    # Core auction tests
│   ├── task2-dutchAuction.test.ts   # Dutch auction tests
│   ├── task3-englishAuction.test.ts # English auction tests
│   └── task4-bundleAuction.test.ts  # Bundle auction tests
├── scripts/
│   └── deploy.ts                    # Deploy + setup subscriptions
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Dashboard (tabs, cards, forms)
│   │   ├── components/
│   │   │   ├── LandingPage.tsx      # Professional landing page
│   │   │   ├── BidHistoryPanel.tsx  # On-chain bid history
│   │   │   ├── PlatformMetricsCard.tsx
│   │   │   ├── LeaderboardTable.tsx
│   │   │   ├── SealedBidAuctionForm.tsx
│   │   │   ├── PhaseIndicator.tsx
│   │   │   └── NotificationCenter.tsx
│   │   ├── hooks/
│   │   │   ├── useReactiveAuction.ts  # WebSocket event subscriptions
│   │   │   └── useNotifications.ts
│   │   ├── config/chain.ts          # Somnia Testnet config
│   │   ├── abi/auction.ts           # Contract ABI
│   │   ├── index.css                # Design system (dark glassmorphism)
│   │   └── landing.css              # Landing page styles
│   └── index.html
├── Dockerfile                       # Multi-stage build for Cloud Run
├── nginx.conf                       # SPA routing config
├── hardhat.config.ts                # Somnia Testnet network
└── README.md
```

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| Blockchain | Somnia Shannon Testnet (Chain ID 50312, EVM-compatible) |
| Smart Contracts | Solidity 0.8.24, Hardhat, viaIR optimizer |
| Reactivity | `@somnia-chain/reactivity-contracts` (on-chain), WebSocket Data Streams (off-chain) |
| Frontend | React 19 + TypeScript + Vite 8 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Wallet | MetaMask (auto-adds Somnia Testnet) |
| Styling | Vanilla CSS (dark glassmorphism, animated gradients) |
| Hosting | Google Cloud Run |
| Testing | Mocha + Chai + fast-check (property-based) |

---

## 🔗 Deployed Contracts

| Contract | Address |
|----------|---------|
| ReactiveAuction | [`0x136D7081b7A98996B841f6BD72093491ff8964Ae`](https://shannon-explorer.somnia.network/address/0x136D7081b7A98996B841f6BD72093491ff8964Ae) |
| AuctionHandler | [`0xdda32E6AEd981881C8c671e763Ff916C69d9600F`](https://shannon-explorer.somnia.network/address/0xdda32E6AEd981881C8c671e763Ff916C69d9600F) |

---

## 🎯 Judging Criteria Alignment

| Criterion | How We Meet It |
|---|---|
| **Technical Excellence** | 3 Reactivity primitives (Schedule, EventHandler, WebSocket), 4 auction types, sealed-bid cryptography, anti-snipe protection, 105 passing tests |
| **Real-Time UX** | WebSocket-powered dashboard, Dutch price ticking down every second, countdown color transitions, skeleton loading, animated backgrounds |
| **Somnia Integration** | Deployed on Somnia Testnet, uses native precompile at `0x6900...0001`, Schedule + EventHandler subscriptions, minimum 32 STT subscription funding |
| **Code Quality** | Modular architecture, TypeScript throughout, comprehensive test suite with property-based testing, clean separation of concerns |
| **Potential Impact** | Auctions are a core DeFi primitive — ReactiveAuction demonstrates how Reactivity eliminates infrastructure costs for any time-bounded protocol |

---

## 📄 License

MIT

---

<div align="center">
  <p>Built for the <strong>Somnia Reactivity Hackathon 2026</strong> 🏆</p>
  <p>
    <a href="https://reactive-auction-h4rgtit3da-uc.a.run.app">Live Demo</a> ·
    <a href="https://shannon-explorer.somnia.network/address/0x136D7081b7A98996B841f6BD72093491ff8964Ae">Explorer</a> ·
    <a href="https://testnet.somnia.network/">Faucet</a>
  </p>
</div>
