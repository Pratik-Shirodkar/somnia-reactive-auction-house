// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/**
 * @title ReactiveAuction
 * @notice Enhanced Dutch, English, Sealed-Bid & Bundle Auction House powered by Somnia Reactivity.
 *         - Dutch auctions: price decays linearly from startPrice to endPrice over duration.
 *         - English auctions: ascending bids until expiry.
 *         - Sealed-bid auctions: commit-reveal cryptographic bidding.
 *         - Bundle auctions: multiple items, atomic settlement.
 *         - Settlement is triggered automatically by the AuctionHandler via Somnia's
 *           Schedule system event — no keeper bots, no off-chain servers.
 */
contract ReactiveAuction {

    // ═══════════════════════════════════════════════════
    //  ENUMS
    // ═══════════════════════════════════════════════════

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

    enum TokenType { NATIVE, ERC20, ERC721 }

    enum SubscriptionType {
        SETTLEMENT,
        REVEAL_DEADLINE,
        REMINDER,
        PRICE_UPDATE,
        ANALYTICS_UPDATE
    }

    enum ReputationAction {
        AUCTION_WON,
        AUCTION_CREATED_WITH_BIDS,
        FAILED_REVEAL,
        FRAUD_FLAG
    }

    // ═══════════════════════════════════════════════════
    //  STRUCTS
    // ═══════════════════════════════════════════════════

    struct SealedBid {
        address bidder;
        bytes32 commitment;      // keccak256(abi.encodePacked(amount, secret))
        uint256 revealedAmount;
        bool revealed;
        uint256 timestamp;
    }

    struct BundleItem {
        address tokenContract;   // NFT or ERC20 contract
        uint256 tokenId;         // For ERC721, 0 for ERC20
        uint256 amount;          // For ERC20, 1 for ERC721
        TokenType tokenType;
    }

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
        // Metadata
        string title;
        string description;
        string imageUrl;
        // Multi-currency
        address paymentToken;        // address(0) for native STT
        address preferredCurrency;   // Seller's preferred settlement currency
        bool noAutoConvert;          // Disable automatic fixed-price conversion
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

    struct PriceAlert {
        address user;
        uint256 auctionId;
        uint256 targetPrice;
        bool triggered;
    }

    // ═══════════════════════════════════════════════════
    //  STATE VARIABLES
    // ═══════════════════════════════════════════════════

    uint256 public nextAuctionId;
    mapping(uint256 => Auction) public auctions;
    uint256[] public activeAuctionIds;

    // Handler address — only the reactive handler can auto-settle
    address public handler;
    address public owner;

    // Sealed-bid data (cannot be inside Auction struct — Solidity limitation)
    mapping(uint256 => mapping(address => SealedBid)) public sealedBids;  // auctionId => bidder => SealedBid
    mapping(uint256 => address[]) public sealedBidders;                   // auctionId => list of bidders

    // Bundle items (cannot be inside Auction struct — Solidity limitation)
    mapping(uint256 => BundleItem[]) public bundleItems;                  // auctionId => items

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
    mapping(uint256 => PriceAlert[]) public priceAlerts;

    // Fraud detection
    mapping(address => uint256) public lastBidTimestamp;
    mapping(address => uint256) public bidCountLastHour;
    mapping(uint256 => bool) public flaggedAuctions;

    // Emergency controls
    bool public systemPaused;
    uint256 public pauseStartTime;

    // ═══════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        uint8 auctionType,
        uint256 startPrice,
        uint256 endPrice,
        uint256 startTime,
        uint256 endTime,
        string title
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        uint256 timestamp
    );

    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 finalPrice,
        uint256 timestamp
    );

    event AuctionCancelled(
        uint256 indexed auctionId,
        uint256 timestamp
    );

    event PriceUpdated(
        uint256 indexed auctionId,
        uint256 currentPrice,
        uint256 timestamp
    );

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

    event RevealFailed(
        uint256 indexed auctionId,
        address indexed bidder,
        string reason
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

    event BundleSettlementFailed(
        uint256 indexed auctionId,
        string reason
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

    event AssetTransferred(
        uint256 indexed auctionId,
        address indexed tokenContract,
        uint256 tokenId,
        address indexed recipient,
        TokenType tokenType
    );

    event BidPlacedWithToken(
        uint256 indexed auctionId,
        address indexed bidder,
        address token,
        uint256 tokenAmount,
        uint256 sttEquivalent,
        uint256 timestamp
    );

    event AnalyticsUpdated(
        uint256 indexed auctionId,
        uint256 bidCount,
        uint256 bidVelocity,
        uint256 timestamp
    );

    // ═══════════════════════════════════════════════════
    //  MODIFIERS
    // ═══════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyHandler() {
        require(msg.sender == handler, "Not handler");
        _;
    }

    modifier notPaused() {
        require(!systemPaused, "System is paused");
        _;
    }

    // ═══════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═══════════════════════════════════════════════════

    constructor() {
        owner = msg.sender;
    }

    function setHandler(address _handler) external onlyOwner {
        handler = _handler;
    }

    // ═══════════════════════════════════════════════════
    //  CREATE AUCTIONS
    // ═══════════════════════════════════════════════════

    /**
     * @notice Create a Dutch auction (price decreases over time)
     */
    function createDutchAuction(
        uint256 _startPrice,
        uint256 _endPrice,
        uint256 _durationSeconds,
        string calldata _title,
        string calldata _description,
        string calldata _imageUrl
    ) external notPaused returns (uint256) {
        require(_startPrice > _endPrice, "Start must exceed end price");
        require(_durationSeconds >= 60, "Min duration 60s");
        require(_durationSeconds <= 7 days, "Max duration 7 days");

        uint256 auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + _durationSeconds;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            auctionType: AuctionType.DUTCH,
            phase: AuctionPhase.BIDDING,
            startPrice: _startPrice,
            endPrice: _endPrice,
            currentBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            revealDeadline: 0,
            config: AuctionConfig({
                antiSnipeEnabled: false,
                extensionThreshold: 0,
                extensionDuration: 0,
                maxExtensions: 0,
                currentExtensions: 0
            }),
            title: _title,
            description: _description,
            imageUrl: _imageUrl,
            paymentToken: address(0),
            preferredCurrency: address(0),
            noAutoConvert: false
        });

        activeAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId, msg.sender, uint8(AuctionType.DUTCH),
            _startPrice, _endPrice, block.timestamp, endTime, _title
        );

        return auctionId;
    }

    /**
     * @notice Create a Dutch auction settled in an ERC20 token
     */
    function createDutchAuctionWithToken(
        uint256 _startPrice,
        uint256 _endPrice,
        uint256 _durationSeconds,
        string calldata _title,
        string calldata _description,
        string calldata _imageUrl,
        address _paymentToken
    ) external notPaused returns (uint256) {
        require(_paymentToken != address(0), "Payment token required");
        require(_startPrice > _endPrice, "Start must exceed end price");
        require(_durationSeconds >= 60, "Min duration 60s");
        require(_durationSeconds <= 7 days, "Max duration 7 days");

        uint256 auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + _durationSeconds;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            auctionType: AuctionType.DUTCH,
            phase: AuctionPhase.BIDDING,
            startPrice: _startPrice,
            endPrice: _endPrice,
            currentBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            revealDeadline: 0,
            config: AuctionConfig({
                antiSnipeEnabled: false,
                extensionThreshold: 0,
                extensionDuration: 0,
                maxExtensions: 0,
                currentExtensions: 0
            }),
            title: _title,
            description: _description,
            imageUrl: _imageUrl,
            paymentToken: _paymentToken,
            preferredCurrency: _paymentToken,
            noAutoConvert: false
        });

        activeAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId, msg.sender, uint8(AuctionType.DUTCH),
            _startPrice, _endPrice, block.timestamp, endTime, _title
        );

        return auctionId;
    }

    /**
     * @notice Create an English auction (ascending bids)
     */
    function createEnglishAuction(
        uint256 _startPrice,
        uint256 _durationSeconds,
        string calldata _title,
        string calldata _description,
        string calldata _imageUrl
    ) external notPaused returns (uint256) {
        require(_startPrice > 0, "Start price must be > 0");
        require(_durationSeconds >= 60, "Min duration 60s");
        require(_durationSeconds <= 7 days, "Max duration 7 days");

        uint256 auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + _durationSeconds;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            auctionType: AuctionType.ENGLISH,
            phase: AuctionPhase.BIDDING,
            startPrice: _startPrice,
            endPrice: 0,
            currentBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            revealDeadline: 0,
            config: AuctionConfig({
                antiSnipeEnabled: false,
                extensionThreshold: 0,
                extensionDuration: 0,
                maxExtensions: 0,
                currentExtensions: 0
            }),
            title: _title,
            description: _description,
            imageUrl: _imageUrl,
            paymentToken: address(0),
            preferredCurrency: address(0),
            noAutoConvert: false
        });

        activeAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId, msg.sender, uint8(AuctionType.ENGLISH),
            _startPrice, 0, block.timestamp, endTime, _title
        );

        return auctionId;
    }

    /**
     * @notice Create an English auction with anti-snipe protection enabled
     */
    function createEnglishAuctionWithAntiSnipe(
        uint256 _startPrice,
        uint256 _durationSeconds,
        string calldata _title,
        string calldata _description,
        string calldata _imageUrl,
        uint256 _extensionThreshold,
        uint256 _extensionDuration,
        uint256 _maxExtensions
    ) external notPaused returns (uint256) {
        require(_startPrice > 0, "Start price must be > 0");
        require(_durationSeconds >= 60, "Min duration 60s");
        require(_durationSeconds <= 7 days, "Max duration 7 days");
        require(_extensionThreshold > 0, "Extension threshold must be > 0");
        require(_extensionDuration > 0, "Extension duration must be > 0");
        require(_maxExtensions > 0, "Max extensions must be > 0");

        uint256 auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + _durationSeconds;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            auctionType: AuctionType.ENGLISH,
            phase: AuctionPhase.BIDDING,
            startPrice: _startPrice,
            endPrice: 0,
            currentBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            revealDeadline: 0,
            config: AuctionConfig({
                antiSnipeEnabled: true,
                extensionThreshold: _extensionThreshold,
                extensionDuration: _extensionDuration,
                maxExtensions: _maxExtensions,
                currentExtensions: 0
            }),
            title: _title,
            description: _description,
            imageUrl: _imageUrl,
            paymentToken: address(0),
            preferredCurrency: address(0),
            noAutoConvert: false
        });

        activeAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId, msg.sender, uint8(AuctionType.ENGLISH),
            _startPrice, 0, block.timestamp, endTime, _title
        );

        return auctionId;
    }

    /**
     * @notice Create an English auction settled in an ERC20 token
     */
    function createEnglishAuctionWithToken(
        uint256 _startPrice,
        uint256 _durationSeconds,
        string calldata _title,
        string calldata _description,
        string calldata _imageUrl,
        address _paymentToken
    ) external notPaused returns (uint256) {
        require(_paymentToken != address(0), "Payment token required");
        require(_startPrice > 0, "Start price must be > 0");
        require(_durationSeconds >= 60, "Min duration 60s");
        require(_durationSeconds <= 7 days, "Max duration 7 days");

        uint256 auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + _durationSeconds;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            auctionType: AuctionType.ENGLISH,
            phase: AuctionPhase.BIDDING,
            startPrice: _startPrice,
            endPrice: 0,
            currentBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            revealDeadline: 0,
            config: AuctionConfig({
                antiSnipeEnabled: false,
                extensionThreshold: 0,
                extensionDuration: 0,
                maxExtensions: 0,
                currentExtensions: 0
            }),
            title: _title,
            description: _description,
            imageUrl: _imageUrl,
            paymentToken: _paymentToken,
            preferredCurrency: _paymentToken,
            noAutoConvert: false
        });

        activeAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId, msg.sender, uint8(AuctionType.ENGLISH),
            _startPrice, 0, block.timestamp, endTime, _title
        );

        return auctionId;
    }

    /**
     * @notice Create a sealed-bid auction (commit-reveal)
     * @param _startPrice Minimum bid price
     * @param _biddingDuration Duration of the bidding (commit) phase
     * @param _revealDuration Duration of the reveal phase
     */
    function createSealedBidAuction(
        uint256 _startPrice,
        uint256 _biddingDuration,
        uint256 _revealDuration,
        string calldata _title,
        string calldata _description,
        string calldata _imageUrl
    ) external notPaused returns (uint256) {
        require(_startPrice > 0, "Start price must be > 0");
        require(_biddingDuration >= 60, "Min bidding duration 60s");
        require(_revealDuration >= 60, "Min reveal duration 60s");

        uint256 auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + _biddingDuration;
        uint256 revealDeadline = endTime + _revealDuration;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            auctionType: AuctionType.SEALED_BID,
            phase: AuctionPhase.BIDDING,
            startPrice: _startPrice,
            endPrice: 0,
            currentBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            revealDeadline: revealDeadline,
            config: AuctionConfig({
                antiSnipeEnabled: false,
                extensionThreshold: 0,
                extensionDuration: 0,
                maxExtensions: 0,
                currentExtensions: 0
            }),
            title: _title,
            description: _description,
            imageUrl: _imageUrl,
            paymentToken: address(0),
            preferredCurrency: address(0),
            noAutoConvert: false
        });

        activeAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId, msg.sender, uint8(AuctionType.SEALED_BID),
            _startPrice, 0, block.timestamp, endTime, _title
        );

        return auctionId;
    }

    /**
     * @notice Create a bundle auction (multiple items, atomic settlement)
     */
    function createBundleAuction(
        uint256 _startPrice,
        uint256 _duration,
        BundleItem[] calldata _items,
        string calldata _title,
        string calldata _description
    ) external notPaused returns (uint256) {
        require(_startPrice > 0, "Start price must be > 0");
        require(_duration >= 60, "Min duration 60s");
        require(_items.length > 0, "Bundle must have items");

        uint256 auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + _duration;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            auctionType: AuctionType.BUNDLE,
            phase: AuctionPhase.BIDDING,
            startPrice: _startPrice,
            endPrice: 0,
            currentBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            revealDeadline: 0,
            config: AuctionConfig({
                antiSnipeEnabled: false,
                extensionThreshold: 0,
                extensionDuration: 0,
                maxExtensions: 0,
                currentExtensions: 0
            }),
            title: _title,
            description: _description,
            imageUrl: "",
            paymentToken: address(0),
            preferredCurrency: address(0),
            noAutoConvert: false
        });

        for (uint256 i = 0; i < _items.length; i++) {
            bundleItems[auctionId].push(_items[i]);
        }

        activeAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId, msg.sender, uint8(AuctionType.BUNDLE),
            _startPrice, 0, block.timestamp, endTime, _title
        );
        emit BundleCreated(auctionId, _items.length, _startPrice);

        return auctionId;
    }

    // ═══════════════════════════════════════════════════
    //  BIDDING
    // ═══════════════════════════════════════════════════

    /**
     * @notice Place a bid / buy now
     *   - Dutch: pays getCurrentPrice(), instant settlement
     *   - English: must exceed current highest bid
     */
    function bid(uint256 _auctionId) external payable notPaused {
        Auction storage a = auctions[_auctionId];
        require(a.phase == AuctionPhase.BIDDING, "Auction not in bidding phase");
        require(block.timestamp < a.endTime, "Auction expired");
        require(a.paymentToken == address(0), "Use bidWithToken for token auctions");
        require(msg.sender != a.seller, "Seller cannot bid");
        require(!flaggedAuctions[_auctionId], "Auction is flagged");
        require(checkBidRateLimit(msg.sender), "Bid rate limit exceeded");

        lastBidTimestamp[msg.sender] = block.timestamp;
        bidCountLastHour[msg.sender]++;

        if (a.auctionType == AuctionType.DUTCH) {
            _bidDutch(a);
        } else if (a.auctionType == AuctionType.ENGLISH) {
            _bidEnglish(a);
        } else {
            revert("Use commitBid for sealed-bid auctions");
        }
    }

    function _bidDutch(Auction storage a) internal {
        uint256 currentPrice = _getDutchPrice(a);
        require(msg.value >= currentPrice, "Below current price");

        a.highestBidder = msg.sender;
        a.currentBid = currentPrice;
        a.phase = AuctionPhase.SETTLED;

        bidHistory[a.id].push(BidRecord({
            bidder: msg.sender,
            amount: currentPrice,
            timestamp: block.timestamp,
            successful: true,
            failureReason: ""
        }));

        // Pay seller
        (bool sent, ) = payable(a.seller).call{value: currentPrice}("");
        require(sent, "Payment to seller failed");

        // Refund excess
        if (msg.value > currentPrice) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - currentPrice}("");
            require(refunded, "Refund failed");
        }

        _removeFromActive(a.id);

        emit BidPlaced(a.id, msg.sender, currentPrice, block.timestamp);
        emit AuctionSettled(a.id, msg.sender, currentPrice, block.timestamp);
    }

    function _bidEnglish(Auction storage a) internal {
        uint256 minBid = a.currentBid == 0 ? a.startPrice : a.currentBid + (a.currentBid / 20); // 5% increment
        if (msg.value < minBid) {
            bidHistory[a.id].push(BidRecord({
                bidder: msg.sender,
                amount: msg.value,
                timestamp: block.timestamp,
                successful: false,
                failureReason: "Bid too low (min 5% above current)"
            }));
            (bool refunded, ) = payable(msg.sender).call{value: msg.value}("");
            require(refunded, "Refund failed");
            return;
        }

        // Refund previous highest bidder
        if (a.highestBidder != address(0)) {
            (bool refunded, ) = payable(a.highestBidder).call{value: a.currentBid}("");
            require(refunded, "Refund to previous bidder failed");
        }

        a.highestBidder = msg.sender;
        a.currentBid = msg.value;

        bidHistory[a.id].push(BidRecord({
            bidder: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            successful: true,
            failureReason: ""
        }));

        // Check price alerts
        _checkPriceAlerts(a.id, msg.value);

        // Anti-snipe check
        if (a.config.antiSnipeEnabled &&
            a.config.currentExtensions < a.config.maxExtensions &&
            block.timestamp >= a.endTime - a.config.extensionThreshold) {
            _extendAuction(a);
        }

        emit BidPlaced(a.id, msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Commit a sealed bid (hash of amount + secret)
     */
    function commitBid(uint256 _auctionId, bytes32 _commitment) external notPaused {
        Auction storage a = auctions[_auctionId];
        require(a.auctionType == AuctionType.SEALED_BID, "Not a sealed-bid auction");
        require(a.phase == AuctionPhase.BIDDING, "Not in bidding phase");
        require(block.timestamp < a.endTime, "Bidding phase ended");
        require(msg.sender != a.seller, "Seller cannot bid");
        require(sealedBids[_auctionId][msg.sender].commitment == bytes32(0), "Already committed");

        sealedBids[_auctionId][msg.sender] = SealedBid({
            bidder: msg.sender,
            commitment: _commitment,
            revealedAmount: 0,
            revealed: false,
            timestamp: block.timestamp
        });
        sealedBidders[_auctionId].push(msg.sender);

        emit SealedBidCommitted(_auctionId, msg.sender, _commitment, block.timestamp);
    }

    /**
     * @notice Reveal a sealed bid during the reveal phase
     */
    function revealBid(
        uint256 _auctionId,
        uint256 _amount,
        bytes32 _secret
    ) external payable notPaused {
        Auction storage a = auctions[_auctionId];
        require(a.auctionType == AuctionType.SEALED_BID, "Not a sealed-bid auction");
        require(a.phase == AuctionPhase.REVEAL, "Not in reveal phase");
        require(block.timestamp <= a.revealDeadline, "Reveal deadline passed");

        SealedBid storage sealedBid = sealedBids[_auctionId][msg.sender];
        require(sealedBid.commitment != bytes32(0), "No commitment found");
        require(!sealedBid.revealed, "Already revealed");

        // Verify commitment
        bytes32 computedCommitment = keccak256(abi.encodePacked(_amount, _secret));
        if (computedCommitment != sealedBid.commitment) {
            emit RevealFailed(_auctionId, msg.sender, "Invalid commitment");
            userReputation[msg.sender].failedReveals++;
            userReputation[msg.sender].trustScore = _calculateTrustScore(msg.sender);
            return;
        }

        // Verify funds
        if (msg.value < _amount) {
            emit RevealFailed(_auctionId, msg.sender, "Insufficient funds");
            if (msg.value > 0) {
                (bool refunded, ) = payable(msg.sender).call{value: msg.value}("");
                require(refunded, "Refund failed");
            }
            return;
        }

        // Valid reveal
        sealedBid.revealed = true;
        sealedBid.revealedAmount = _amount;

        // Refund excess
        if (msg.value > _amount) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - _amount}("");
            require(refunded, "Refund failed");
        }

        emit SealedBidRevealed(_auctionId, msg.sender, _amount, block.timestamp);
    }

    /**
     * @notice Bid using an ERC20 token (stub — full implementation in task 11)
     */
    function bidWithToken(
        uint256 _auctionId,
        address _token,
        uint256 _amount
    ) external notPaused {
        Auction storage a = auctions[_auctionId];
        require(a.phase == AuctionPhase.BIDDING, "Auction not in bidding phase");
        require(block.timestamp < a.endTime, "Auction expired");
        require(msg.sender != a.seller, "Seller cannot bid");
        require(!flaggedAuctions[_auctionId], "Auction is flagged");
        require(checkBidRateLimit(msg.sender), "Bid rate limit exceeded");
        require(a.paymentToken != address(0), "Auction requires native bidding");
        require(_token == a.paymentToken, "Unsupported token for auction");
        require(_amount > 0, "Amount must be > 0");

        lastBidTimestamp[msg.sender] = block.timestamp;
        bidCountLastHour[msg.sender]++;

        if (a.auctionType == AuctionType.DUTCH) {
            uint256 currentPrice = _getDutchPrice(a);
            require(_amount >= currentPrice, "Below current price");

            _safeTransferFrom(_token, msg.sender, a.seller, currentPrice);

            a.highestBidder = msg.sender;
            a.currentBid = currentPrice;
            a.phase = AuctionPhase.SETTLED;

            bidHistory[a.id].push(BidRecord({
                bidder: msg.sender,
                amount: currentPrice,
                timestamp: block.timestamp,
                successful: true,
                failureReason: ""
            }));

            _removeFromActive(a.id);

            emit BidPlaced(a.id, msg.sender, currentPrice, block.timestamp);
            emit BidPlacedWithToken(a.id, msg.sender, _token, currentPrice, currentPrice, block.timestamp);
            emit AuctionSettled(a.id, msg.sender, currentPrice, block.timestamp);
            return;
        }

        if (a.auctionType == AuctionType.ENGLISH || a.auctionType == AuctionType.BUNDLE) {
            uint256 minBid = a.currentBid == 0 ? a.startPrice : a.currentBid + (a.currentBid / 20);
            if (_amount < minBid) {
                bidHistory[a.id].push(BidRecord({
                    bidder: msg.sender,
                    amount: _amount,
                    timestamp: block.timestamp,
                    successful: false,
                    failureReason: "Bid too low (min 5% above current)"
                }));
                return;
            }

            _safeTransferFrom(_token, msg.sender, address(this), _amount);

            if (a.highestBidder != address(0) && a.currentBid > 0) {
                _safeTransfer(_token, a.highestBidder, a.currentBid);
            }

            a.highestBidder = msg.sender;
            a.currentBid = _amount;

            bidHistory[a.id].push(BidRecord({
                bidder: msg.sender,
                amount: _amount,
                timestamp: block.timestamp,
                successful: true,
                failureReason: ""
            }));

            _checkPriceAlerts(a.id, _amount);

            if (
                a.config.antiSnipeEnabled &&
                a.config.currentExtensions < a.config.maxExtensions &&
                block.timestamp >= a.endTime - a.config.extensionThreshold
            ) {
                _extendAuction(a);
            }

            emit BidPlaced(a.id, msg.sender, _amount, block.timestamp);
            emit BidPlacedWithToken(a.id, msg.sender, _token, _amount, _amount, block.timestamp);
            return;
        }

        revert("Use commitBid for sealed-bid auctions");
    }

    // ═══════════════════════════════════════════════════
    //  PHASE TRANSITIONS
    // ═══════════════════════════════════════════════════

    /**
     * @notice Transition a sealed-bid auction from BIDDING to REVEAL phase
     *         Called by the handler when the bidding period ends.
     */
    function transitionToReveal(uint256 _auctionId) external onlyHandler {
        Auction storage a = auctions[_auctionId];
        require(a.auctionType == AuctionType.SEALED_BID, "Not a sealed-bid auction");
        require(a.phase == AuctionPhase.BIDDING, "Not in bidding phase");

        AuctionPhase prev = a.phase;
        a.phase = AuctionPhase.REVEAL;

        emit PhaseTransition(_auctionId, prev, AuctionPhase.REVEAL, block.timestamp);
    }

    /**
     * @notice Settle a sealed-bid auction after the reveal phase ends.
     *         Determines winner from highest valid revealed bid.
     *         Called by the handler when the reveal deadline fires.
     */
    function settleSealedAuction(uint256 _auctionId) external onlyHandler {
        Auction storage a = auctions[_auctionId];
        require(a.auctionType == AuctionType.SEALED_BID, "Not a sealed-bid auction");
        require(a.phase == AuctionPhase.REVEAL, "Not in reveal phase");

        a.phase = AuctionPhase.SETTLING;
        emit PhaseTransition(_auctionId, AuctionPhase.REVEAL, AuctionPhase.SETTLING, block.timestamp);

        // Find highest valid revealed bid
        address winner = address(0);
        uint256 highestAmount = 0;
        address[] storage bidders = sealedBidders[_auctionId];

        for (uint256 i = 0; i < bidders.length; i++) {
            SealedBid storage sb = sealedBids[_auctionId][bidders[i]];
            if (sb.revealed && sb.revealedAmount > highestAmount) {
                highestAmount = sb.revealedAmount;
                winner = bidders[i];
            }
        }

        a.phase = AuctionPhase.SETTLED;
        _removeFromActive(_auctionId);

        if (winner != address(0)) {
            a.highestBidder = winner;
            a.currentBid = highestAmount;

            // Pay seller
            (bool sent, ) = payable(a.seller).call{value: highestAmount}("");
            require(sent, "Payment to seller failed");

            // Refund non-winning revealed bids
            for (uint256 i = 0; i < bidders.length; i++) {
                SealedBid storage sb = sealedBids[_auctionId][bidders[i]];
                if (sb.revealed && bidders[i] != winner && sb.revealedAmount > 0) {
                    (bool refunded, ) = payable(bidders[i]).call{value: sb.revealedAmount}("");
                    // Non-critical: log but don't revert if refund fails
                    if (!refunded) {
                        emit RevealFailed(_auctionId, bidders[i], "Refund failed");
                    }
                }
            }

            emit AuctionSettled(_auctionId, winner, highestAmount, block.timestamp);
        } else {
            emit AuctionCancelled(_auctionId, block.timestamp);
        }

        emit PhaseTransition(_auctionId, AuctionPhase.SETTLING, AuctionPhase.SETTLED, block.timestamp);
    }

    // ═══════════════════════════════════════════════════
    //  SETTLEMENT (called by AuctionHandler via Reactivity)
    // ═══════════════════════════════════════════════════

    /**
     * @notice Settle an expired English or Bundle auction.
     *         Called by the reactive handler when the Schedule system event fires.
     */
    function settleAuction(uint256 _auctionId) external {
        Auction storage a = auctions[_auctionId];
        require(a.phase == AuctionPhase.BIDDING, "Not in bidding phase");
        require(block.timestamp >= a.endTime, "Not expired yet");
        require(
            a.auctionType == AuctionType.ENGLISH || a.auctionType == AuctionType.BUNDLE,
            "Use settleSealedAuction for sealed-bid"
        );

        a.phase = AuctionPhase.SETTLED;

        if (a.highestBidder != address(0)) {
            if (a.paymentToken == address(0)) {
                (bool sent, ) = payable(a.seller).call{value: a.currentBid}("");
                require(sent, "Payment to seller failed");
            } else {
                _safeTransfer(a.paymentToken, a.seller, a.currentBid);
            }
            emit AuctionSettled(a.id, a.highestBidder, a.currentBid, block.timestamp);
        } else {
            emit AuctionCancelled(a.id, block.timestamp);
        }

        _removeFromActive(_auctionId);
    }

    /**
     * @notice Settle a bundle auction atomically — all items transfer or none do.
     *         Called by the reactive handler when the Schedule event fires.
     */
    function settleBundleAuction(uint256 _auctionId) external {
        Auction storage a = auctions[_auctionId];
        require(a.auctionType == AuctionType.BUNDLE, "Not a bundle auction");
        require(a.phase == AuctionPhase.BIDDING, "Not in bidding phase");
        require(block.timestamp >= a.endTime, "Not expired yet");

        a.phase = AuctionPhase.SETTLING;

        if (a.highestBidder == address(0)) {
            // No bids — cancel
            a.phase = AuctionPhase.CANCELLED;
            _removeFromActive(_auctionId);
            emit AuctionCancelled(_auctionId, block.timestamp);
            return;
        }

        // Check reserve: bundle price must meet startPrice
        if (a.currentBid < a.startPrice) {
            // Reserve not met — refund bidder and cancel
            (bool refunded, ) = payable(a.highestBidder).call{value: a.currentBid}("");
            if (!refunded) emit BundleSettlementFailed(_auctionId, "Refund failed");
            a.phase = AuctionPhase.CANCELLED;
            _removeFromActive(_auctionId);
            emit AuctionCancelled(_auctionId, block.timestamp);
            return;
        }

        // Attempt atomic transfer of all bundle items
        bool transferSuccess = _transferBundle(_auctionId, a.highestBidder);

        if (!transferSuccess) {
            // Refund bidder on failure
            (bool refunded, ) = payable(a.highestBidder).call{value: a.currentBid}("");
            if (!refunded) emit BundleSettlementFailed(_auctionId, "Refund failed after transfer failure");
            a.phase = AuctionPhase.CANCELLED;
            _removeFromActive(_auctionId);
            emit BundleSettlementFailed(_auctionId, "Item transfer failed");
            return;
        }

        // Pay seller
        (bool sent, ) = payable(a.seller).call{value: a.currentBid}("");
        require(sent, "Payment to seller failed");

        a.phase = AuctionPhase.SETTLED;
        _removeFromActive(_auctionId);
        emit AuctionSettled(_auctionId, a.highestBidder, a.currentBid, block.timestamp);
    }

    /**
     * @notice Atomically transfer all bundle items to the winner.
     * @return success true if all transfers succeeded
     */
    function _transferBundle(uint256 _auctionId, address _winner) internal returns (bool) {
        BundleItem[] storage items = bundleItems[_auctionId];
        for (uint256 i = 0; i < items.length; i++) {
            BundleItem storage item = items[i];
            if (item.tokenType == TokenType.ERC721) {
                // safeTransferFrom(from, to, tokenId)
                (bool ok, ) = item.tokenContract.call(
                    abi.encodeWithSignature(
                        "safeTransferFrom(address,address,uint256)",
                        auctions[_auctionId].seller,
                        _winner,
                        item.tokenId
                    )
                );
                if (!ok) return false;
                emit AssetTransferred(_auctionId, item.tokenContract, item.tokenId, _winner, TokenType.ERC721);
            } else if (item.tokenType == TokenType.ERC20) {
                (bool ok, bytes memory data) = item.tokenContract.call(
                    abi.encodeWithSelector(IERC20.transferFrom.selector, auctions[_auctionId].seller, _winner, item.amount)
                );
                if (!ok || (data.length > 0 && !abi.decode(data, (bool)))) return false;
                emit AssetTransferred(_auctionId, item.tokenContract, 0, _winner, TokenType.ERC20);
            }
        }
        return true;
    }

    /**
     * @notice Cancel an auction (only seller, only if no bids)
     */
    function cancelAuction(uint256 _auctionId) external {
        Auction storage a = auctions[_auctionId];
        require(msg.sender == a.seller, "Not seller");
        require(a.phase == AuctionPhase.BIDDING, "Not in bidding phase");
        require(a.highestBidder == address(0), "Has bids, cannot cancel");

        a.phase = AuctionPhase.CANCELLED;
        _removeFromActive(_auctionId);

        emit AuctionCancelled(a.id, block.timestamp);
    }

    // ═══════════════════════════════════════════════════
    //  ANTI-SNIPE EXTENSION
    // ═══════════════════════════════════════════════════

    /**
     * @notice Extend an auction's end time (anti-snipe). Called by handler or internally.
     */
    function extendAuction(uint256 _auctionId) external onlyHandler {
        Auction storage a = auctions[_auctionId];
        require(a.phase == AuctionPhase.BIDDING, "Not in bidding phase");
        _extendAuction(a);
    }

    function _extendAuction(Auction storage a) internal {
        require(a.config.currentExtensions < a.config.maxExtensions, "Max extensions reached");
        a.endTime += a.config.extensionDuration;
        a.config.currentExtensions++;
        emit AuctionExtended(a.id, a.endTime, a.config.currentExtensions, block.timestamp);
    }

    // ═══════════════════════════════════════════════════
    //  REPUTATION MANAGEMENT
    // ═══════════════════════════════════════════════════

    /**
     * @notice Update a user's reputation score. Called by handler only.
     */
    function updateReputation(
        address _user,
        int256 _scoreDelta,
        ReputationAction _action
    ) external onlyHandler {
        UserReputation storage rep = userReputation[_user];

        if (_scoreDelta > 0) {
            rep.score += uint256(_scoreDelta);
        } else {
            uint256 decrease = uint256(-_scoreDelta);
            rep.score = rep.score > decrease ? rep.score - decrease : 0;
        }

        if (_action == ReputationAction.AUCTION_WON) {
            rep.auctionsWon++;
        } else if (_action == ReputationAction.AUCTION_CREATED_WITH_BIDS) {
            rep.auctionsCreated++;
        } else if (_action == ReputationAction.FAILED_REVEAL) {
            rep.failedReveals++;
        }

        rep.trustScore = _calculateTrustScore(_user);

        string memory reason = _action == ReputationAction.AUCTION_WON ? "Auction won"
            : _action == ReputationAction.AUCTION_CREATED_WITH_BIDS ? "Auction created with bids"
            : _action == ReputationAction.FAILED_REVEAL ? "Failed reveal"
            : "Fraud flag";

        emit ReputationUpdated(_user, rep.score, rep.trustScore, reason);
    }

    function _calculateTrustScore(address _user) internal view returns (uint256) {
        UserReputation storage rep = userReputation[_user];
        uint256 total = rep.auctionsWon + rep.auctionsCreated;
        if (total == 0) return 50; // Default neutral score

        int256 raw = int256(rep.auctionsWon * 10)
            + int256(rep.auctionsCreated * 5)
            - int256(rep.failedReveals * 20);

        if (raw <= 0) return 0;
        uint256 score = uint256(raw) / total;
        return score > 100 ? 100 : score;
    }

    // ═══════════════════════════════════════════════════
    //  WATCHLIST MANAGEMENT
    // ═══════════════════════════════════════════════════

    function addToWatchlist(uint256 _auctionId) external {
        require(userWatchlist[msg.sender].length < 50, "Watchlist limit reached (50)");
        userWatchlist[msg.sender].push(_auctionId);
        auctionWatcherCount[_auctionId]++;
    }

    function removeFromWatchlist(uint256 _auctionId) external {
        uint256[] storage list = userWatchlist[msg.sender];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == _auctionId) {
                list[i] = list[list.length - 1];
                list.pop();
                if (auctionWatcherCount[_auctionId] > 0) {
                    auctionWatcherCount[_auctionId]--;
                }
                return;
            }
        }
    }

    // ═══════════════════════════════════════════════════
    //  TEMPLATE MANAGEMENT
    // ═══════════════════════════════════════════════════

    function saveTemplate(AuctionTemplate calldata _template) external {
        require(userTemplateCount[msg.sender] < 10, "Template limit reached (10)");
        uint256 templateId = userTemplateCount[msg.sender];
        userTemplates[msg.sender][templateId] = _template;
        userTemplateCount[msg.sender]++;
    }

    function createFromTemplate(uint256 _templateId) external notPaused returns (uint256) {
        require(_templateId < userTemplateCount[msg.sender], "Template not found");
        AuctionTemplate storage tmpl = userTemplates[msg.sender][_templateId];
        tmpl.usageCount++;

        uint256 auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + tmpl.duration;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            auctionType: tmpl.auctionType,
            phase: AuctionPhase.BIDDING,
            startPrice: tmpl.startPrice,
            endPrice: tmpl.endPrice,
            currentBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            revealDeadline: 0,
            config: tmpl.config,
            title: tmpl.name,
            description: "",
            imageUrl: "",
            paymentToken: address(0),
            preferredCurrency: address(0),
            noAutoConvert: false
        });

        activeAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId, msg.sender, uint8(tmpl.auctionType),
            tmpl.startPrice, tmpl.endPrice, block.timestamp, endTime, tmpl.name
        );

        return auctionId;
    }

    // ═══════════════════════════════════════════════════
    //  PRICE ALERTS
    // ═══════════════════════════════════════════════════

    function createPriceAlert(uint256 _auctionId, uint256 _targetPrice) external {
        priceAlerts[_auctionId].push(PriceAlert({
            user: msg.sender,
            auctionId: _auctionId,
            targetPrice: _targetPrice,
            triggered: false
        }));
    }

    function _checkPriceAlerts(uint256 _auctionId, uint256 _currentPrice) internal {
        PriceAlert[] storage alerts = priceAlerts[_auctionId];
        for (uint256 i = 0; i < alerts.length; i++) {
            if (!alerts[i].triggered && _currentPrice >= alerts[i].targetPrice) {
                alerts[i].triggered = true;
                emit PriceAlertTriggered(_auctionId, alerts[i].user, alerts[i].targetPrice, _currentPrice);
            }
        }
    }

    // ═══════════════════════════════════════════════════
    //  FRAUD DETECTION
    // ═══════════════════════════════════════════════════

    function flagAuction(uint256 _auctionId, string calldata _reason) external {
        flaggedAuctions[_auctionId] = true;
        emit AuctionFlagged(_auctionId, _reason, block.timestamp);
    }

    function checkBidRateLimit(address _bidder) internal view returns (bool) {
        if (lastBidTimestamp[_bidder] == 0) return true;
        return block.timestamp - lastBidTimestamp[_bidder] >= 2;
    }

    // ═══════════════════════════════════════════════════
    //  EMERGENCY CONTROLS
    // ═══════════════════════════════════════════════════

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

        // Extend all active auction end times by pause duration
        for (uint256 i = 0; i < activeAuctionIds.length; i++) {
            Auction storage a = auctions[activeAuctionIds[i]];
            a.endTime += pauseDuration;
            if (a.revealDeadline > 0) {
                a.revealDeadline += pauseDuration;
            }
        }

        emit SystemUnpaused(block.timestamp, pauseDuration);
    }

    // ═══════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════

    /**
     * @notice Get current price for a Dutch auction (decreases over time)
     */
    function getCurrentPrice(uint256 _auctionId) external view returns (uint256) {
        Auction storage a = auctions[_auctionId];
        require(a.auctionType == AuctionType.DUTCH, "Not a Dutch auction");
        return _getDutchPrice(a);
    }

    function _getDutchPrice(Auction storage a) internal view returns (uint256) {
        if (block.timestamp >= a.endTime) return a.endPrice;
        uint256 elapsed = block.timestamp - a.startTime;
        uint256 duration = a.endTime - a.startTime;
        uint256 priceDrop = ((a.startPrice - a.endPrice) * elapsed) / duration;
        return a.startPrice - priceDrop;
    }

    function getAuction(uint256 _auctionId) external view returns (Auction memory) {
        return auctions[_auctionId];
    }

    function getActiveAuctionIds() external view returns (uint256[] memory) {
        return activeAuctionIds;
    }

    function getActiveAuctionCount() external view returns (uint256) {
        return activeAuctionIds.length;
    }

    function getBidHistory(uint256 _auctionId) external view returns (BidRecord[] memory) {
        return bidHistory[_auctionId];
    }

    function getBundleItems(uint256 _auctionId) external view returns (BundleItem[] memory) {
        return bundleItems[_auctionId];
    }

    function getSealedBidders(uint256 _auctionId) external view returns (address[] memory) {
        return sealedBidders[_auctionId];
    }

    function getUserWatchlist(address _user) external view returns (uint256[] memory) {
        return userWatchlist[_user];
    }

    // ═══════════════════════════════════════════════════
    //  INTERNAL
    // ═══════════════════════════════════════════════════

    function _removeFromActive(uint256 _auctionId) internal {
        for (uint256 i = 0; i < activeAuctionIds.length; i++) {
            if (activeAuctionIds[i] == _auctionId) {
                activeAuctionIds[i] = activeAuctionIds[activeAuctionIds.length - 1];
                activeAuctionIds.pop();
                break;
            }
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Token transferFrom failed");
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Token transfer failed");
    }
}
