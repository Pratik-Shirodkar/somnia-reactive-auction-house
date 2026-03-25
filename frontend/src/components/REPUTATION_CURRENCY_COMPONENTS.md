# Reputation & Multi-Currency Components

This document describes the new components for reputation system and multi-currency support.

## Components Overview

### 1. ReputationBadge
Displays user reputation score with tier badge, trust score, and fee discount.

**Props:**
- `score: number` - User's reputation score
- `trustScore: number` - Trust score (0-100)
- `auctionsWon?: number` - Number of auctions won
- `totalVolume?: number` - Total volume in wei

**Reputation Tiers:**
- Bronze: 0-100 points (2% fee discount)
- Silver: 101-500 points (1.5% fee discount)
- Gold: 501-2000 points (1% fee discount)
- Platinum: 2001+ points (0.5% fee discount)

**Example:**
```tsx
import { ReputationBadge } from './components';

<ReputationBadge
  score={750}
  trustScore={85}
  auctionsWon={15}
  totalVolume={BigInt("5000000000000000000")}
/>
```

### 2. AchievementNotification
Toast notification for achievement unlocks with celebration animation.

**Props:**
- `achievementType: string` - Type of achievement (e.g., "First Auction Won")
- `milestone: number` - Milestone value
- `onDismiss?: () => void` - Callback when dismissed
- `autoHideDuration?: number` - Auto-hide duration in ms (default: 5000)

**Example:**
```tsx
import { AchievementNotification } from './components';

<AchievementNotification
  achievementType="Auction Master"
  milestone={10}
  onDismiss={() => console.log('Achievement dismissed')}
  autoHideDuration={5000}
/>
```

### 3. UserProfilePanel
Comprehensive user profile with statistics, reputation history, and achievements.

**Props:**
- `address: string` - User's wallet address
- `stats: UserStats` - User statistics object
  - `auctionsWon: number`
  - `auctionsCreated: number`
  - `totalVolume: number`
- `reputationScore: number` - Current reputation score
- `trustScore: number` - Trust score (0-100)
- `reputationHistory?: ReputationHistory[]` - Array of reputation changes
- `achievements?: Achievement[]` - Array of unlocked achievements

**Example:**
```tsx
import { UserProfilePanel } from './components';

<UserProfilePanel
  address="0x1234567890123456789012345678901234567890"
  stats={{
    auctionsWon: 15,
    auctionsCreated: 8,
    totalVolume: 5000000000000000000,
  }}
  reputationScore={750}
  trustScore={85}
  reputationHistory={[
    { timestamp: 1234567890, score: 50, action: 'Auction Won' },
    { timestamp: 1234567900, score: 10, action: 'Auction Created' },
  ]}
  achievements={[
    { type: 'First Win', milestone: 1, unlockedAt: 1234567890 },
    { type: 'Volume Master', milestone: 1000, unlockedAt: 1234567900 },
  ]}
/>
```

### 4. CurrencySelector
Dropdown for selecting bid currency with exchange rate display.

**Props:**
- `selectedCurrency: Currency` - Currently selected currency ('STT' | 'WETH' | 'USDC')
- `onCurrencyChange: (currency: Currency) => void` - Callback when currency changes
- `amount?: string` - Bid amount to show STT equivalent
- `exchangeRates?: ExchangeRate[]` - Array of exchange rates

**Example:**
```tsx
import { CurrencySelector } from './components';
import { useState } from 'react';

const [currency, setCurrency] = useState<'STT' | 'WETH' | 'USDC'>('STT');
const [amount, setAmount] = useState('1.0');

<CurrencySelector
  selectedCurrency={currency}
  onCurrencyChange={setCurrency}
  amount={amount}
  exchangeRates={[
    { currency: 'STT', rate: 1, symbol: 'STT' },
    { currency: 'WETH', rate: 2000, symbol: 'WETH' },
    { currency: 'USDC', rate: 1, symbol: 'USDC' },
  ]}
/>
```

### 5. PriceDisplay
Display price in multiple currencies with real-time updates.

**Props:**
- `priceInSTT: number` - Price in STT
- `originalCurrency?: string` - Original currency (default: 'STT')
- `originalAmount?: number` - Original amount
- `showUSD?: boolean` - Show USD value (default: true)
- `usdRate?: number` - STT to USD rate (default: 0.5)
- `updateInterval?: number` - Update interval in ms (default: 10000)
- `onRateUpdate?: () => void` - Callback on rate update

**Example:**
```tsx
import { PriceDisplay } from './components';

<PriceDisplay
  priceInSTT={2000}
  originalCurrency="WETH"
  originalAmount={1}
  showUSD={true}
  usdRate={0.5}
  updateInterval={10000}
  onRateUpdate={() => console.log('Rates updated')}
/>
```

## Integration with ReactiveAuction

These components are designed to work with the ReactiveAuction contract's reputation and multi-currency features:

### Reputation System
- Read user reputation from `userReputation` mapping in ReactiveAuction contract
- Listen to `ReputationUpdated` events for real-time updates
- Listen to `AchievementUnlocked` events to show achievement notifications

### Multi-Currency Support
- Use PriceOracle contract to fetch exchange rates
- Convert bid amounts using `convertToSTT` and `convertFromSTT` functions
- Display prices in multiple currencies for better UX

## Styling

All components use the existing design system with glassmorphism effects and the vibrant dark theme. CSS classes are added to `frontend/src/index.css`.

## Requirements Mapping

- **Task 26.1 (ReputationBadge)**: Requirements 7.1, 7.6, 7.7
- **Task 26.2 (AchievementNotification)**: Requirement 7.5
- **Task 26.3 (UserProfilePanel)**: Requirements 7.1, 7.2, 7.3
- **Task 27.1 (CurrencySelector)**: Requirements 9.1, 9.6
- **Task 27.2 (PriceDisplay)**: Requirement 9.6
