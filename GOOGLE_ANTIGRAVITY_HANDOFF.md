# Google Antigravity Master Documentation — Reactive Auction House

Last updated: 2026-03-25

---

## 1) Executive Summary
Reactive Auction House is an end-to-end Somnia dApp with:
- On-chain auction execution (Dutch, English, Sealed-Bid, Bundle)
- Somnia reactivity orchestration for automated lifecycle transitions
- Real-time frontend updates via contract event subscriptions

This document is designed as a complete migration/continuation reference for Google Antigravity.

Current validated baseline:
- Root compile: PASS
- Root tests: PASS (105 passing)
- Frontend lint: PASS
- Frontend build: PASS

---

## 2) Repository Map

### Root
- `.env`, `.env.example`
- `package.json`, `package-lock.json`, `tsconfig.json`
- `hardhat.config.ts`
- `README.md`, `FEATURES.md`
- `deployed-addresses.json`, `deployed-addresses.local.json`
- `GOOGLE_ANTIGRAVITY_HANDOFF.md` (this file)

### Smart contracts
- `contracts/ReactiveAuction.sol`
- `contracts/AuctionHandler.sol`
- `contracts/AnalyticsEngine.sol`
- `contracts/PriceOracle.sol`

### Scripts
- `scripts/deploy.ts`
- `scripts/deploy-local.js`
- `scripts/deploy-local.ts`
- `scripts/deploy-core.ts`
- `scripts/deploy-handler.ts`
- `scripts/deploy-simple.js`
- `scripts/deploy-testnet.js`
- `scripts/deploy-viem.ts`
- `scripts/ethers-deploy.js`
- `scripts/setup-subscriptions.ts`
- `scripts/setup-connections.ts`
- `scripts/step1-deploy.js`
- `scripts/step2-setup.js`
- `scripts/test-rpc.js`
- `scripts/dev-all.js`

### Tests
- `test/ReactiveAuction.test.ts`
- `test/Task2.2-commitBid.test.ts`
- `test/Task2.3-revealBid.test.ts`
- `test/Task2.4-phaseTransition.test.ts`
- `test/Task2.4-phaseTransitions.test.ts`
- `test/Task3-antiSnipe.test.ts`
- `test/Task4-bundleAuction.test.ts`

### Frontend
- `frontend/package.json`, `frontend/package-lock.json`
- `frontend/index.html`, `frontend/vite.config.ts`, `frontend/eslint.config.js`
- `frontend/SEALED_BID_COMPONENTS.md`, `frontend/WEBSOCKET_INTEGRATION.md`
- `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/index.css`, `frontend/src/App.css`
- `frontend/src/abi/auction.ts`
- `frontend/src/config/chain.ts`
- `frontend/src/hooks/useReactiveAuction.ts`, `frontend/src/hooks/useNotifications.ts`
- `frontend/src/lib/ReactiveAuctionClient.ts`
- `frontend/src/components/*` (detailed in Section 7)

---

## 3) Network and Addressing

### Somnia testnet
- Chain ID: `50312`
- RPC: `https://dream-rpc.somnia.network/`
- Explorer: `https://shannon-explorer.somnia.network/`

### Latest deployed (testnet)
From `deployed-addresses.json`:
- ReactiveAuction: `0x136D7081b7A98996B841f6BD72093491ff8964Ae`
- AuctionHandler: `0xdda32E6AEd981881C8c671e763Ff916C69d9600F`

### Local development network
- Chain ID: `31337`
- RPC: `http://127.0.0.1:8545`
- Local addresses file: `deployed-addresses.local.json`

---

## 4) Build System and Tooling

### Root stack
- Hardhat 2.x
- Solidity `0.8.24` with optimizer + `viaIR`
- TypeChain + ethers v6 typings
- Mocha/Chai + fast-check property tests

### Frontend stack
- React 19 + TypeScript + Vite
- viem client stack (public + wallet)
- framer-motion + lucide-react
- ESLint flat config

### Important package caveat
Frontend has a known peer-range mismatch between:
- `@somnia-chain/reactivity@0.1.10`
- newer `viem`

Use `npm install --legacy-peer-deps` in `frontend` when needed.

---

## 5) Smart Contract System Design

### 5.1 ReactiveAuction.sol (core business logic)
Primary responsibilities:
- Auction creation and bidding flows
- Sealed-bid commit/reveal lifecycle
- Settlement and cancellation
- Anti-snipe extensions
- Reputation/watchlist/template/alert features
- Multi-currency helpers for token-based bidding

Key public/external functions (selected groups):

Creation:
- `createDutchAuction`
- `createDutchAuctionWithToken`
- `createEnglishAuction`
- `createEnglishAuctionWithAntiSnipe`
- `createEnglishAuctionWithToken`
- `createSealedBidAuction`
- `createBundleAuction`

Bidding:
- `bid`
- `bidWithToken`
- `commitBid`
- `revealBid`

Lifecycle:
- `transitionToReveal`
- `settleSealedAuction`
- `settleAuction`
- `settleBundleAuction`
- `cancelAuction`
- `extendAuction`

User/platform features:
- `updateReputation`
- `addToWatchlist`
- `removeFromWatchlist`
- `saveTemplate`
- `createFromTemplate`
- `createPriceAlert`
- `pauseSystem`
- `unpauseSystem`

Read helpers:
- `getCurrentPrice`
- `getAuction`
- `getActiveAuctionIds`
- `getActiveAuctionCount`
- `getBidHistory`
- `getBundleItems`
- `getSealedBidders`
- `getUserWatchlist`

Notable states:
- `AuctionType`: DUTCH / ENGLISH / SEALED_BID / BUNDLE
- `AuctionPhase`: BIDDING / REVEAL / SETTLING / SETTLED / CANCELLED

### 5.2 AuctionHandler.sol (reactivity orchestrator)
Primary responsibilities:
- Somnia `onEvent` callback entrypoint
- Scheduled phase transitions and settlements
- Subscription lifecycle management
- Dynamic settlement rescheduling when anti-snipe extension occurs
- Cascading post-settlement automations (follow-up/achievement)

Notable functions:
- `onEvent`
- `scheduleSettlement`
- `rescheduleAllSettlements`
- `subscribeToAuctionCreated`
- `subscribeToAuctionEvents`
- `getAuctionSubscriptions`

### 5.3 AnalyticsEngine.sol (metrics + fraud signals)
Primary responsibilities:
- Platform and per-auction metrics updates
- Leaderboard maintenance
- Price trend history aggregation
- Sybil/wash-trading signal detection

Notable functions:
- `onBidPlaced`
- `onAuctionSettled`
- `onAuctionCreated`
- `detectWashTrading`
- `calculateTrustScore`
- `getPlatformMetrics`
- `getAuctionMetrics`
- `getLeaderboard`
- `getPriceTrend`

### 5.4 PriceOracle.sol (rates + pricing + prediction)
Primary responsibilities:
- Token/STT exchange-rate registry
- Dutch price calculations
- Bid-based prediction updates
- Price manipulation signal checks

Notable functions:
- `addSupportedToken`
- `updateExchangeRate`
- `getExchangeRate`
- `isRateStale`
- `convertToSTT`
- `convertFromSTT`
- `getCurrentDutchPrice`
- `getDutchPriceAt`
- `recordBid`
- `predictFinalPrice`
- `detectPriceManipulation`

---

## 6) Reactivity and Event Model

Reactive flow (high level):
1. Auction created on `ReactiveAuction`
2. `AuctionHandler` receives event via Somnia reactivity
3. Handler creates schedule subscriptions for lifecycle deadlines
4. At schedule trigger, handler performs transition/settlement calls
5. Frontend receives contract events via viem watchers and updates UI in real time

Core event categories used in UI/logic:
- `AuctionCreated`
- `BidPlaced`
- `AuctionSettled`
- `AuctionExtended`
- `PhaseTransition`
- `SealedBidCommitted`
- `SealedBidRevealed`

---

## 7) Frontend Architecture

### 7.1 Runtime entry points
- `frontend/src/main.tsx` — app bootstrapping
- `frontend/src/App.tsx` — central integration and orchestration

### 7.2 Core frontend service layer
- `frontend/src/config/chain.ts`
  - chain metadata
  - contract addresses
  - `getPublicClient()`
  - `getWalletClient()` with network switch/add logic

- `frontend/src/abi/auction.ts`
  - frontend ABI surface for reads/writes/events
  - must stay aligned with `ReactiveAuction.sol`

- `frontend/src/lib/ReactiveAuctionClient.ts`
  - wrapper for real-time contract event subscriptions

### 7.3 Hooks
- `useReactiveAuction` — subscription/watch lifecycle control
- `useNotifications` — notification queue and dismissal logic

### 7.4 Component catalog
All components under `frontend/src/components/`:
- `AchievementNotification.tsx`
- `AuctionMetricsPanel.tsx`
- `BundleAuctionExample.tsx`
- `BundleAuctionForm.tsx`
- `BundleItemDisplay.tsx`
- `BundleSettlementStatus.tsx`
- `CommitBidForm.tsx`
- `CurrencySelector.tsx`
- `LeaderboardTable.tsx`
- `NotificationCenter.tsx`
- `PhaseIndicator.tsx`
- `PlatformMetricsCard.tsx`
- `PriceAlertForm.tsx`
- `PriceDisplay.tsx`
- `PriceTrendChart.tsx`
- `ReputationBadge.tsx`
- `RevealBidForm.tsx`
- `SealedBidAuctionExample.tsx`
- `SealedBidAuctionForm.tsx`
- `TemplateManager.tsx`
- `TemplateSelector.tsx`
- `UserProfilePanel.tsx`
- `WatchlistButton.tsx`

Export barrel: `frontend/src/components/index.ts`

Supporting component docs:
- `frontend/src/components/README.md`
- `frontend/src/components/BUNDLE_AUCTION.md`
- `frontend/src/components/REPUTATION_CURRENCY_COMPONENTS.md`

### 7.5 UX feature set currently represented
- Real-time event feed + notifications
- Sealed-bid create/commit/reveal interactions
- Phase indicators/countdowns
- Watchlist and alert interactions
- Bundle auction and analytics/reputation-oriented panels

---

## 8) Script Responsibilities

### Deployment and setup
- `scripts/deploy.ts`
  - deploys `ReactiveAuction` + `AuctionHandler`
  - links handler
  - funds handler
  - attempts subscription bootstrap
  - writes `deployed-addresses.json`

- `scripts/deploy-local.js`
  - local deployment for chain `31337`
  - writes `deployed-addresses.local.json`

- `scripts/setup-subscriptions.ts`
  - post-deploy subscription setup
  - gracefully handles local precompile limitations

### Dev orchestration
- `scripts/dev-all.js`
  - health-checks local RPC
  - starts hardhat node if needed
  - runs local deploy
  - starts frontend on port `5173`

### Utility and alternate deployment paths
- `scripts/test-rpc.js`
- other deployment variants (`deploy-core`, `deploy-handler`, `deploy-viem`, etc.)

---

## 9) Test Coverage Overview

Main behavioral coverage:
- Sealed-bid auction creation (`Task2.1` suite)
- Commitment flow (`Task2.2-commitBid.test.ts`)
- Reveal flow (`Task2.3-revealBid.test.ts`)
- Phase transition + settlement (`Task2.4-*`)
- Anti-snipe extensions (`Task3-antiSnipe.test.ts`)
- Bundle auctions (`Task4-bundleAuction.test.ts`)

Includes unit and property-based tests (`fast-check`) for invariants.

Current expected result:
- `npm run test` => 105 passing

---

## 10) Environment Configuration

### Root `.env`
Required for testnet deploy:
- `PRIVATE_KEY=0x...`

Recommended additional entries (if you extend scripts):
- RPC override(s)
- optional gas tuning values

### Frontend runtime configuration
`frontend/src/config/chain.ts` contains:
- chain id, rpc, explorer
- contract addresses (`AUCTION_HOUSE`, `HANDLER`)

If new deploy happens, update this file and/or introduce env-driven address loading.

---

## 11) Commands Cheat Sheet

### Root
- Install: `npm install`
- Compile: `npm run compile`
- Test: `npm run test`
- Testnet deploy: `npm run deploy`
- Local deploy: `npm run deploy:local`
- All-in-one local dev: `npm run dev:all`

### Frontend
- Install: `npm install --legacy-peer-deps`
- Dev server: `npm run dev -- --host 0.0.0.0 --port 5173`
- Lint: `npm run lint`
- Build: `npm run build`
- Preview: `npm run preview`

---

## 12) Migration Procedure to Google Antigravity

1. Import repository/workspace.
2. Run root install:
   - `npm install`
3. Run frontend install:
   - `cd frontend && npm install --legacy-peer-deps && cd ..`
4. Create `.env` with `PRIVATE_KEY`.
5. Run baseline validations:
   - `npm run compile`
   - `npm run test`
   - `cd frontend && npm run lint && npm run build`
6. Choose runtime path:
   - Fast path: `npm run dev:all`
   - Manual path: hardhat node + local deploy + frontend dev

---

## 13) Known Issues and Troubleshooting

### Dependency resolution
Symptom:
- Frontend install fails with peer dependency resolution errors.

Fix:
- Use `npm install --legacy-peer-deps` in `frontend`.

### Port 8545 in use but unhealthy
Symptom:
- `dev:all` cannot progress and indicates RPC health failures.

Fix:
- Identify process on 8545 and stop it.
- Re-run `npm run dev:all`.

### Hardhat `viaIR` caveat output
Symptom:
- Warning about limited stack traces under `viaIR`.

Status:
- Expected with current config; non-blocking.

### Vite chunk size warning
Symptom:
- Build warns about large minified chunk size.

Status:
- Non-blocking; optional optimization via code-splitting.

---

## 14) Continuation Roadmap (recommended)

Priority 1 — Operational hardening
- Add deterministic smoke test for local lifecycle:
  - create sealed-bid auction
  - commit/reveal
  - settle
  - validate frontend read state

Priority 2 — CI and automation
- Add CI pipeline for:
  - root compile + tests
  - frontend lint + build

Priority 3 — ABI integrity tooling
- Add script checking critical signature parity between:
  - `contracts/ReactiveAuction.sol`
  - `frontend/src/abi/auction.ts`

Priority 4 — Frontend performance
- Split heavy app modules from `App.tsx`.
- Re-measure chunk outputs and tune.

Priority 5 — Product completion
- Continue integrating/validating advanced modules (analytics, reputation, templates, alerts) end-to-end with deployed contract support.

---

## 15) Antigravity Kickoff Prompt (copy/paste)

"You are continuing a Somnia Reactive Auction House project. Start by running baseline checks (`npm run compile`, `npm run test`, `cd frontend && npm run lint && npm run build`). Confirm all are green. Then implement a localhost smoke test that verifies sealed-bid lifecycle (create, commit, reveal, settle) and frontend state sync. Keep changes minimal, typed, and production-safe."

---

## 16) Handoff Checklist

Before ending a work session, ensure:
- deployment address files are updated if deploy changed
- `frontend/src/config/chain.ts` matches intended network targets
- lockfiles are committed when dependencies change
- quality gates remain green
- this document is updated if architecture/scripts/features changed

---

This file is intended to be the single-source project handoff document for Google Antigravity continuation.
