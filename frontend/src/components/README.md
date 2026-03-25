# Sealed-Bid Auction UI Components

This directory contains React components for implementing sealed-bid auction functionality in the ReactiveAuction frontend.

## Components Overview

### 1. SealedBidAuctionForm

**Purpose:** Create a new sealed-bid auction with configurable bidding and reveal durations.

**Props:**
- `walletClient: WalletClient | null` - Viem wallet client for transaction signing
- `account: string` - Connected wallet address
- `onSuccess: (auctionId: bigint) => void` - Callback when auction is created
- `onError: (message: string) => void` - Callback for error handling

**Features:**
- Form validation for all required fields
- Minimum duration enforcement (60 seconds)
- Duration display in minutes for better UX
- Automatic form reset after successful creation
- Loading state during transaction

**Usage:**
```tsx
<SealedBidAuctionForm
  walletClient={walletClient}
  account={account}
  onSuccess={(auctionId) => console.log('Created:', auctionId)}
  onError={(msg) => showToast('error', msg)}
/>
```

---

### 2. CommitBidForm

**Purpose:** Submit a cryptographic commitment during the bidding phase of a sealed-bid auction.

**Props:**
- `auctionId: bigint` - ID of the auction to bid on
- `walletClient: WalletClient | null` - Viem wallet client
- `account: string` - Connected wallet address
- `onSuccess: () => void` - Callback when commitment is submitted
- `onError: (message: string) => void` - Error callback

**Features:**
- Random secret generation with crypto.getRandomValues
- Real-time commitment hash calculation
- Secret visibility toggle
- Automatic localStorage persistence for reveal phase
- Commitment hash preview before submission

**Commitment Calculation:**
```typescript
commitment = keccak256(encodePacked(['uint256', 'bytes32'], [amount, secret]))
```

**LocalStorage Format:**
```json
{
  "amount": "1.5",
  "secret": "0x1234...",
  "commitment": "0xabcd...",
  "timestamp": 1234567890
}
```

**Usage:**
```tsx
<CommitBidForm
  auctionId={auctionId}
  walletClient={walletClient}
  account={account}
  onSuccess={() => console.log('Committed')}
  onError={(msg) => showToast('error', msg)}
/>
```

---

### 3. RevealBidForm

**Purpose:** Reveal a committed bid during the reveal phase by providing the original amount and secret.

**Props:**
- `auctionId: bigint` - ID of the auction
- `walletClient: WalletClient | null` - Viem wallet client
- `account: string` - Connected wallet address
- `onSuccess: () => void` - Callback when reveal succeeds
- `onError: (message: string) => void` - Error callback

**Features:**
- Automatic loading of stored commitment from localStorage
- Option to use stored values or enter manually
- Secret visibility toggle
- Payment amount display in button
- Automatic cleanup of localStorage after successful reveal

**Important:** The reveal transaction must include the bid amount as payment (msg.value).

**Usage:**
```tsx
<RevealBidForm
  auctionId={auctionId}
  walletClient={walletClient}
  account={account}
  onSuccess={() => console.log('Revealed')}
  onError={(msg) => showToast('error', msg)}
/>
```

---

### 4. PhaseIndicator

**Purpose:** Display the current phase of a sealed-bid auction with countdown timer and visual timeline.

**Props:**
- `phase: number` - Current auction phase (0=BIDDING, 1=REVEAL, 2=SETTLING, 3=SETTLED, 4=CANCELLED)
- `endTime: bigint` - Unix timestamp when bidding phase ends
- `revealDeadline: bigint` - Unix timestamp when reveal phase ends
- `auctionType: number` - Auction type (only displays for type 2 = sealed-bid)

**Features:**
- Real-time countdown timer (updates every second)
- Phase-specific colors and icons
- Visual timeline showing progress through phases
- Phase-specific instructions for users
- Automatic expiry detection

**Phase Colors:**
- BIDDING: Blue (#3b82f6)
- REVEAL: Purple (#8b5cf6)
- SETTLING: Amber (#f59e0b)
- SETTLED: Green (#10b981)
- CANCELLED: Red (#ef4444)

**Usage:**
```tsx
<PhaseIndicator
  phase={auction.phase}
  endTime={auction.endTime}
  revealDeadline={auction.revealDeadline}
  auctionType={auction.auctionType}
/>
```

---

## Integration Guide

### Step 1: Import Components

```tsx
import {
  SealedBidAuctionForm,
  CommitBidForm,
  RevealBidForm,
  PhaseIndicator
} from './components';
```

### Step 2: Add to Auction Detail Page

```tsx
function AuctionDetail({ auction }) {
  // Only show for sealed-bid auctions
  if (auction.auctionType !== 2) return null;

  return (
    <div>
      {/* Always show phase indicator */}
      <PhaseIndicator
        phase={auction.phase}
        endTime={auction.endTime}
        revealDeadline={auction.revealDeadline}
        auctionType={auction.auctionType}
      />

      {/* Show commit form during bidding phase */}
      {auction.phase === 0 && (
        <CommitBidForm
          auctionId={auction.id}
          walletClient={walletClient}
          account={account}
          onSuccess={handleCommitSuccess}
          onError={handleError}
        />
      )}

      {/* Show reveal form during reveal phase */}
      {auction.phase === 1 && (
        <RevealBidForm
          auctionId={auction.id}
          walletClient={walletClient}
          account={account}
          onSuccess={handleRevealSuccess}
          onError={handleError}
        />
      )}
    </div>
  );
}
```

### Step 3: Add Create Button

```tsx
<button onClick={() => setShowCreateModal(true)}>
  Create Sealed-Bid Auction
</button>

{showCreateModal && (
  <div className="modal-overlay">
    <div className="modal">
      <SealedBidAuctionForm
        walletClient={walletClient}
        account={account}
        onSuccess={handleAuctionCreated}
        onError={handleError}
      />
    </div>
  </div>
)}
```

---

## Workflow

### Complete Sealed-Bid Auction Flow

1. **Creation Phase**
   - Seller uses `SealedBidAuctionForm` to create auction
   - Specifies bidding duration and reveal duration
   - Auction starts in BIDDING phase (phase 0)

2. **Bidding Phase (Phase 0)**
   - `PhaseIndicator` shows countdown to bidding end
   - Bidders use `CommitBidForm` to submit commitments
   - Commitments are cryptographic hashes (amount + secret)
   - No bid amounts are visible on-chain
   - Commitments stored in localStorage for later reveal

3. **Phase Transition (Automatic)**
   - When bidding time expires, handler transitions to REVEAL phase
   - `PhaseIndicator` updates to show reveal countdown

4. **Reveal Phase (Phase 1)**
   - `PhaseIndicator` shows countdown to reveal deadline
   - Bidders use `RevealBidForm` to reveal their bids
   - Must provide same amount and secret used in commitment
   - Payment sent with reveal transaction
   - Contract verifies commitment matches reveal

5. **Settlement (Automatic)**
   - When reveal time expires, handler settles auction
   - Highest valid revealed bid wins
   - Non-winning bids automatically refunded
   - Auction moves to SETTLED phase (phase 3)

---

## Security Considerations

### Secret Management

1. **Generation:** Use `crypto.getRandomValues()` for cryptographically secure random secrets
2. **Storage:** Secrets stored in localStorage (browser-specific, not synced)
3. **Transmission:** Secrets never sent to server, only used for local hash calculation
4. **Cleanup:** Automatically removed from localStorage after successful reveal

### Commitment Verification

The contract verifies reveals by recalculating the commitment:
```solidity
bytes32 computedCommitment = keccak256(abi.encodePacked(amount, secret));
require(computedCommitment == storedCommitment, "Invalid reveal");
```

### Best Practices

1. **Always save your secret** - Without it, you cannot reveal your bid
2. **Use the generated secret** - Don't use predictable values
3. **Reveal before deadline** - Late reveals are forfeited
4. **Match exact amount** - Reveal must use same amount as commitment

---

## Styling

All components use the existing design system from `index.css`:

- **Colors:** Defined in CSS variables (--accent, --card-bg, etc.)
- **Typography:** Outfit for headings, Inter for body text
- **Effects:** Glassmorphism, backdrop blur, smooth animations
- **Responsive:** Mobile-friendly with breakpoints at 768px

### Custom Classes

- `.sealed-auction-form` - Form container styling
- `.phase-indicator` - Phase display with timeline
- `.commitment-display` - Hash preview box
- `.warning-box` - Warning messages (amber)
- `.info-box` - Info messages (blue)
- `.timeline-step` - Timeline node styling

---

## Testing

### Manual Testing Checklist

- [ ] Create sealed-bid auction with valid parameters
- [ ] Verify bidding duration countdown works
- [ ] Commit bid with generated secret
- [ ] Verify commitment stored in localStorage
- [ ] Wait for phase transition to REVEAL
- [ ] Reveal bid with stored values
- [ ] Verify reveal with manual values works
- [ ] Test reveal with wrong secret (should fail)
- [ ] Test reveal with wrong amount (should fail)
- [ ] Verify localStorage cleanup after reveal

### Edge Cases

- [ ] Minimum duration validation (60 seconds)
- [ ] Empty/invalid form fields
- [ ] Wallet not connected
- [ ] Network errors during transaction
- [ ] Phase transition during user action
- [ ] Multiple commitments from same user
- [ ] Reveal without prior commitment

---

## Requirements Validation

These components satisfy the following requirements from the spec:

**Requirement 1.1:** ✅ Support creation of sealed-bid auctions with configurable durations
**Requirement 1.2:** ✅ Store only cryptographic commitment hash
**Requirement 1.3:** ✅ Reject reveals that don't match commitment
**Requirement 1.4:** ✅ Emit Schedule events for phase transitions
**Requirement 1.6:** ✅ Handle unrevealed bids (forfeit eligibility)

---

## Future Enhancements

Potential improvements for future iterations:

1. **Batch Reveals:** Allow revealing multiple bids at once
2. **Commitment Export:** Download commitment details as JSON
3. **QR Code Secret:** Generate QR code for secret backup
4. **Email Reminders:** Optional email notifications for phase transitions
5. **Bid History:** Show user's past commitments and reveals
6. **Analytics:** Track commitment vs reveal rates
7. **Multi-Currency:** Support ERC20 tokens for sealed bids

---

## Support

For issues or questions:
- Check the example file: `SealedBidAuctionExample.tsx`
- Review the design document: `.kiro/specs/hackathon-winning-enhancements/design.md`
- Check contract ABI: `frontend/src/abi/auction.ts`

---

## License

Part of the ReactiveAuction project for Somnia Reactivity Hackathon.
