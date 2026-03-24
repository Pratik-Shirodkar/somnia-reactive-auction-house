// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReactiveAuction
 * @notice Fully on-chain Dutch & English Auction House powered by Somnia Reactivity.
 *         - Dutch auctions: price decays linearly from startPrice to endPrice over duration.
 *         - English auctions: ascending bids until expiry.
 *         - Settlement is triggered automatically by the AuctionHandler via Somnia's
 *           Schedule system event — no keeper bots, no off-chain servers.
 */
contract ReactiveAuction {
    enum AuctionType { DUTCH, ENGLISH }
    enum AuctionStatus { ACTIVE, SETTLED, CANCELLED }

    struct Auction {
        uint256 id;
        address seller;
        AuctionType auctionType;
        AuctionStatus status;
        // Pricing
        uint256 startPrice;    // Starting price (wei)
        uint256 endPrice;      // Minimum price for Dutch (0 for English)
        uint256 currentBid;    // Highest bid (English only)
        address highestBidder; // Current leader (English only)
        // Timing
        uint256 startTime;
        uint256 endTime;
        // Metadata
        string title;
        string description;
        string imageUrl;
    }

    uint256 public nextAuctionId;
    mapping(uint256 => Auction) public auctions;
    uint256[] public activeAuctionIds;

    // Handler address — only the reactive handler can auto-settle
    address public handler;
    address public owner;

    // Events — these are what Somnia Reactivity subscribes to
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

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyHandler() {
        require(msg.sender == handler, "Not handler");
        _;
    }

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
     * @param _startPrice Starting price in wei
     * @param _endPrice Minimum price in wei (must be < startPrice)
     * @param _durationSeconds Auction duration
     * @param _title Auction title
     * @param _description Auction description
     * @param _imageUrl Image URL for the item
     */
    function createDutchAuction(
        uint256 _startPrice,
        uint256 _endPrice,
        uint256 _durationSeconds,
        string calldata _title,
        string calldata _description,
        string calldata _imageUrl
    ) external returns (uint256) {
        require(_startPrice > _endPrice, "Start must exceed end price");
        require(_durationSeconds >= 60, "Min duration 60s");
        require(_durationSeconds <= 7 days, "Max duration 7 days");

        uint256 auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + _durationSeconds;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            auctionType: AuctionType.DUTCH,
            status: AuctionStatus.ACTIVE,
            startPrice: _startPrice,
            endPrice: _endPrice,
            currentBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            title: _title,
            description: _description,
            imageUrl: _imageUrl
        });

        activeAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId,
            msg.sender,
            uint8(AuctionType.DUTCH),
            _startPrice,
            _endPrice,
            block.timestamp,
            endTime,
            _title
        );

        return auctionId;
    }

    /**
     * @notice Create an English auction (ascending bids)
     * @param _startPrice Minimum starting bid
     * @param _durationSeconds Auction duration
     * @param _title Auction title
     * @param _description Auction description
     * @param _imageUrl Image URL for the item
     */
    function createEnglishAuction(
        uint256 _startPrice,
        uint256 _durationSeconds,
        string calldata _title,
        string calldata _description,
        string calldata _imageUrl
    ) external returns (uint256) {
        require(_startPrice > 0, "Start price must be > 0");
        require(_durationSeconds >= 60, "Min duration 60s");
        require(_durationSeconds <= 7 days, "Max duration 7 days");

        uint256 auctionId = nextAuctionId++;
        uint256 endTime = block.timestamp + _durationSeconds;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            auctionType: AuctionType.ENGLISH,
            status: AuctionStatus.ACTIVE,
            startPrice: _startPrice,
            endPrice: 0,
            currentBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            title: _title,
            description: _description,
            imageUrl: _imageUrl
        });

        activeAuctionIds.push(auctionId);

        emit AuctionCreated(
            auctionId,
            msg.sender,
            uint8(AuctionType.ENGLISH),
            _startPrice,
            0,
            block.timestamp,
            endTime,
            _title
        );

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
    function bid(uint256 _auctionId) external payable {
        Auction storage a = auctions[_auctionId];
        require(a.status == AuctionStatus.ACTIVE, "Auction not active");
        require(block.timestamp < a.endTime, "Auction expired");
        require(msg.sender != a.seller, "Seller cannot bid");

        if (a.auctionType == AuctionType.DUTCH) {
            _bidDutch(a);
        } else {
            _bidEnglish(a);
        }
    }

    function _bidDutch(Auction storage a) internal {
        uint256 currentPrice = _getDutchPrice(a);
        require(msg.value >= currentPrice, "Below current price");

        // Instant settlement for Dutch auctions
        a.highestBidder = msg.sender;
        a.currentBid = currentPrice;
        a.status = AuctionStatus.SETTLED;

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
        require(msg.value >= minBid, "Bid too low (min 5% above current)");

        // Refund previous highest bidder
        if (a.highestBidder != address(0)) {
            (bool refunded, ) = payable(a.highestBidder).call{value: a.currentBid}("");
            require(refunded, "Refund to previous bidder failed");
        }

        a.highestBidder = msg.sender;
        a.currentBid = msg.value;

        emit BidPlaced(a.id, msg.sender, msg.value, block.timestamp);
    }

    // ═══════════════════════════════════════════════════
    //  SETTLEMENT (called by AuctionHandler via Reactivity)
    // ═══════════════════════════════════════════════════

    /**
     * @notice Settle an expired English auction. Called by the reactive handler
     *         when the Schedule system event fires at the auction's endTime.
     *         No keeper bots needed — Somnia validators trigger this automatically.
     */
    function settleAuction(uint256 _auctionId) external {
        Auction storage a = auctions[_auctionId];
        require(a.status == AuctionStatus.ACTIVE, "Not active");
        require(block.timestamp >= a.endTime, "Not expired yet");

        a.status = AuctionStatus.SETTLED;

        if (a.highestBidder != address(0)) {
            // Pay seller
            (bool sent, ) = payable(a.seller).call{value: a.currentBid}("");
            require(sent, "Payment to seller failed");

            emit AuctionSettled(a.id, a.highestBidder, a.currentBid, block.timestamp);
        } else {
            // No bids — return to seller
            emit AuctionCancelled(a.id, block.timestamp);
        }

        _removeFromActive(a.id);
    }

    /**
     * @notice Cancel an auction (only seller, only if no bids)
     */
    function cancelAuction(uint256 _auctionId) external {
        Auction storage a = auctions[_auctionId];
        require(msg.sender == a.seller, "Not seller");
        require(a.status == AuctionStatus.ACTIVE, "Not active");
        require(a.highestBidder == address(0), "Has bids, cannot cancel");

        a.status = AuctionStatus.CANCELLED;
        _removeFromActive(a.id);

        emit AuctionCancelled(a.id, block.timestamp);
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
}
