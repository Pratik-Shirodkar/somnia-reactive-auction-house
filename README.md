# ⚡ ReactiveAuction — On-Chain Auction House Powered by Somnia Reactivity

<div align="center">
  <h3>Dutch & English Auctions with Zero-Bot Auto-Settlement</h3>
  <p>No keepers. No polling. No off-chain servers. Just Somnia Native Reactivity.</p>
  
  <p>
    <img src="https://img.shields.io/badge/Somnia-Reactivity-7c3aed.svg" alt="Somnia Reactivity" />
    <img src="https://img.shields.io/badge/Solidity-0.8.24-363636.svg" alt="Solidity" />
    <img src="https://img.shields.io/badge/React-TypeScript-61dafb.svg" alt="React" />
    <img src="https://img.shields.io/badge/Network-Somnia%20Testnet-06b6d4.svg" alt="Testnet" />
  </p>
</div>

---

## 🎯 What is ReactiveAuction?

ReactiveAuction is a fully on-chain auction house that leverages **Somnia's Native On-chain Reactivity** to eliminate the need for keeper bots, cron jobs, or any off-chain infrastructure.

### The Problem
Traditional on-chain auctions require **external systems** to settle expired auctions:
- ❌ Chainlink Keepers (~$10/month per upkeep)
- ❌ Gelato / OpenZeppelin Defender
- ❌ Your own bot server running 24/7

### The Solution
ReactiveAuction uses **three Somnia Reactivity primitives** to make auctions fully autonomous:

| Reactivity Primitive | Usage | Traditional Equivalent |
|---|---|---|
| **`Schedule` System Event** | Auto-settles expired auctions at exact timestamp | Chainlink Keepers / Gelato |
| **`AuctionCreated` Event Subscription** | Handler auto-schedules settlement for new auctions | Off-chain event listener |
| **WebSocket Subscriptions** | Real-time UI updates (bids, settlements, price changes) | Polling every N seconds |

**Without Somnia Reactivity, this dApp needs 3 separate off-chain systems. With it, it needs zero.**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser (React)                    │
│                                                              │
│  • Connect MetaMask to Somnia Testnet                       │
│  • Create Dutch / English auctions                          │
│  • Place bids (instant for Dutch, ascending for English)    │
│  • Watch live event feed via WebSocket subscriptions         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                 Somnia Testnet (Chain ID 50312)               │
│                                                              │
│  ReactiveAuction.sol                                         │
│    ├── createDutchAuction()  → emits AuctionCreated          │
│    ├── createEnglishAuction()→ emits AuctionCreated          │
│    ├── bid()                 → emits BidPlaced               │
│    └── settleAuction()       → emits AuctionSettled          │
│                                                              │
│  AuctionHandler.sol (SomniaEventHandler)                     │
│    ├── onEvent(AuctionCreated) → creates Schedule sub        │
│    └── onEvent(Schedule)       → auto-calls settleAuction()  │
│                                                              │
│  Flow:                                                        │
│  1. User creates auction → AuctionCreated event emitted       │
│  2. AuctionHandler reacts → schedules auto-settlement         │
│  3. Schedule fires at endTime → AuctionHandler settles        │
│  4. No bots needed. Somnia validators do the work.           │
└──────────────────────────────────────────────────────────────┘
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
        _settleExpiredAuctions(); // Auto-settle!
    }
    if (eventTopics[0] == AUCTION_CREATED_SELECTOR) {
        _scheduleAutoSettlement(auctionId); // Schedule future settlement
    }
}
```

### 2. On-Chain: `Schedule` System Event
The handler creates a `Schedule` subscription at the exact millisecond timestamp when each auction expires. This is a one-off trigger that Somnia validators execute — no keeper infrastructure needed.

### 3. Off-Chain: WebSocket Subscriptions for Real-Time UI
The React frontend uses viem's `watchContractEvent` to subscribe to `AuctionCreated`, `BidPlaced`, and `AuctionSettled` events. The live event feed updates in real-time without polling.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MetaMask with Somnia Testnet configured
- STT tokens (from [faucet](https://testnet.somnia.network/))

### 1. Install Dependencies

```bash
# Root (contracts)
npm install

# Frontend
cd frontend && npm install && cd ..
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

Copy the deployed addresses from `deployed-addresses.json` into `frontend/src/config/chain.ts`.

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
│   ├── ReactiveAuction.sol      # Core auction logic (Dutch + English)
│   └── AuctionHandler.sol       # Somnia Event Handler (auto-settlement)
├── scripts/
│   └── deploy.ts                # Deploy + setup subscriptions
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Full dashboard UI
│   │   ├── config/chain.ts      # Somnia Testnet config
│   │   ├── abi/auction.ts       # Contract ABI
│   │   ├── index.css            # Design system (dark glassmorphism)
│   │   └── main.tsx             # Entry point
│   └── index.html
├── hardhat.config.ts            # Somnia Testnet network
├── package.json
└── README.md
```

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| Blockchain | Somnia Testnet (Chain ID 50312, EVM-compatible) |
| Smart Contracts | Solidity 0.8.24, Hardhat |
| Reactivity | `@somnia-chain/reactivity-contracts` (on-chain), viem WebSocket (off-chain) |
| Frontend | React 19 + TypeScript + Vite |
| Wallet | MetaMask (auto-adds Somnia Testnet) |
| Styling | Vanilla CSS (dark glassmorphism theme) |

---

## 🎯 Judging Criteria Alignment

| Criterion | How We Meet It |
|---|---|
| **Technical Excellence** | 3 Reactivity primitives (Schedule, EventHandler, WebSocket), clean architecture, well-tested contracts |
| **Real-Time UX** | Live event feed, Dutch price ticking down every second, instant bid confirmations |
| **Somnia Integration** | Deployed on Somnia Testnet, uses native precompile at `0x6900...0001`, minimum 32 STT subscription funding |
| **Potential Impact** | Auctions are a core DeFi primitive — ReactiveAuction demonstrates how Reactivity eliminates infrastructure costs for any time-bounded protocol |

---

## 📄 License

MIT

---

Built for the **Somnia Reactivity Mini Hackathon** 🏆
