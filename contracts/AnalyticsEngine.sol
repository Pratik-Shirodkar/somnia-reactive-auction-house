// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AnalyticsEngine
 * @notice Real-time auction analytics computed reactively from bid/settlement streams.
 *         Tracks platform volume, bid velocity, leaderboards, price trends, and fraud signals.
 */
contract AnalyticsEngine {

    address public owner;
    address public handler;

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct PlatformMetrics {
        uint256 totalVolume;
        uint256 totalAuctions;
        uint256 activeAuctions;
        uint256 settledAuctions;
        uint256 averageSettlementPrice;
        uint256 averageDuration;
        uint256 totalBids;
        uint256 uniqueBidders;
    }

    struct AuctionMetrics {
        uint256 auctionId;
        uint256 bidCount;
        uint256 uniqueBidders;
        uint256 bidVelocity;          // bids per hour (scaled ×1000)
        uint256 priceVolatility;      // std-dev proxy
        uint256 watcherCount;
        uint256 lastBidTimestamp;
        uint256 timeToFirstBid;
        uint256 averageTimeBetweenBids;
    }

    struct LeaderboardEntry {
        address user;
        uint256 totalVolume;
        uint256 auctionsWon;
        uint256 reputation;
    }

    struct PriceTrend {
        uint256[] prices;
        uint256[] timestamps;
        uint256 movingAverage;
        int256  trend;  // positive = increasing
    }

    // ─── State ────────────────────────────────────────────────────────────────

    PlatformMetrics public metrics;
    mapping(uint256 => AuctionMetrics) public auctionMetrics;
    LeaderboardEntry[] public leaderboard;
    mapping(address => uint256) private leaderboardIndex; // 1-based
    mapping(uint256 => PriceTrend) private priceTrends;

    // Fraud detection
    mapping(address => uint256[]) private userBidTimestamps;
    mapping(uint256 => mapping(address => bool)) private auctionBidders;
    mapping(address => bool) public flaggedUsers;

    // Unique bidder tracking
    mapping(address => bool) private knownBidders;

    // ─── Events ───────────────────────────────────────────────────────────────

    event AnalyticsUpdated(uint256 indexed auctionId, uint256 bidCount, uint256 bidVelocity, uint256 timestamp);
    event LeaderboardUpdated(address indexed user, uint256 totalVolume, uint256 rank);
    event FraudDetected(address indexed user, string reason);
    event PlatformMetricsUpdated(uint256 totalVolume, uint256 totalBids, uint256 timestamp);

    modifier onlyOwner()   { require(msg.sender == owner,   "Not owner");   _; }
    modifier onlyHandler() { require(msg.sender == handler, "Not handler"); _; }

    constructor() {
        owner = msg.sender;
    }

    function setHandler(address _handler) external onlyOwner { handler = _handler; }

    // ─── Event Handlers ───────────────────────────────────────────────────────

    /**
     * @notice Called by handler when a bid is placed.
     */
    function onBidPlaced(
        uint256 _auctionId,
        address _bidder,
        uint256 _amount,
        address _seller
    ) external onlyHandler {
        AuctionMetrics storage am = auctionMetrics[_auctionId];

        // First bid
        if (am.bidCount == 0) {
            am.auctionId = _auctionId;
            am.timeToFirstBid = block.timestamp;
            metrics.activeAuctions++;
        }

        // Track unique bidders per auction
        if (!auctionBidders[_auctionId][_bidder]) {
            auctionBidders[_auctionId][_bidder] = true;
            am.uniqueBidders++;
        }

        // Track global unique bidders
        if (!knownBidders[_bidder]) {
            knownBidders[_bidder] = true;
            metrics.uniqueBidders++;
        }

        // Average time between bids
        if (am.bidCount > 0 && am.lastBidTimestamp > 0) {
            uint256 elapsed = block.timestamp - am.lastBidTimestamp;
            am.averageTimeBetweenBids = (am.averageTimeBetweenBids * am.bidCount + elapsed) / (am.bidCount + 1);
        }

        am.bidCount++;
        am.lastBidTimestamp = block.timestamp;
        metrics.totalBids++;

        // Bid velocity: bids per hour (×1000 for precision)
        am.bidVelocity = _calculateBidVelocity(_auctionId);

        // Fraud checks
        _recordBidTimestamp(_bidder);
        if (_bidder == _seller) {
            flaggedUsers[_bidder] = true;
            emit FraudDetected(_bidder, "Wash trading: seller bidding on own auction");
        }
        if (_detectSybilAttack(_bidder)) {
            flaggedUsers[_bidder] = true;
            emit FraudDetected(_bidder, "Sybil attack: excessive bid rate");
        }

        emit AnalyticsUpdated(_auctionId, am.bidCount, am.bidVelocity, block.timestamp);
    }

    /**
     * @notice Called by handler when an auction settles.
     */
    function onAuctionSettled(
        uint256 _auctionId,
        address _winner,
        uint256 _finalPrice,
        uint256 _startTime
    ) external onlyHandler {
        metrics.totalVolume += _finalPrice;
        metrics.settledAuctions++;
        if (metrics.activeAuctions > 0) metrics.activeAuctions--;

        // Running average settlement price
        if (metrics.settledAuctions == 1) {
            metrics.averageSettlementPrice = _finalPrice;
        } else {
            metrics.averageSettlementPrice =
                (metrics.averageSettlementPrice * (metrics.settledAuctions - 1) + _finalPrice)
                / metrics.settledAuctions;
        }

        // Running average duration
        uint256 duration = block.timestamp > _startTime ? block.timestamp - _startTime : 0;
        if (metrics.settledAuctions == 1) {
            metrics.averageDuration = duration;
        } else {
            metrics.averageDuration =
                (metrics.averageDuration * (metrics.settledAuctions - 1) + duration)
                / metrics.settledAuctions;
        }

        // Update leaderboard
        _updateLeaderboard(_winner, _finalPrice);

        // Price trend
        _recordPriceTrend(_auctionId, _finalPrice);

        emit PlatformMetricsUpdated(metrics.totalVolume, metrics.totalBids, block.timestamp);
    }

    function onAuctionCreated(uint256 /*_auctionId*/) external onlyHandler {
        metrics.totalAuctions++;
    }

    // ─── Leaderboard ──────────────────────────────────────────────────────────

    function _updateLeaderboard(address _user, uint256 _volume) internal {
        uint256 idx = leaderboardIndex[_user];
        if (idx == 0) {
            leaderboard.push(LeaderboardEntry({ user: _user, totalVolume: _volume, auctionsWon: 1, reputation: 0 }));
            leaderboardIndex[_user] = leaderboard.length; // 1-based
        } else {
            leaderboard[idx - 1].totalVolume += _volume;
            leaderboard[idx - 1].auctionsWon++;
        }

        // Bubble up to maintain descending order (simple insertion sort step)
        uint256 pos = leaderboardIndex[_user] - 1;
        while (pos > 0 && leaderboard[pos].totalVolume > leaderboard[pos - 1].totalVolume) {
            // Swap
            LeaderboardEntry memory tmp = leaderboard[pos - 1];
            leaderboard[pos - 1] = leaderboard[pos];
            leaderboard[pos] = tmp;
            leaderboardIndex[leaderboard[pos - 1].user] = pos;       // 1-based
            leaderboardIndex[leaderboard[pos].user]     = pos + 1;   // 1-based
            pos--;
        }
        leaderboardIndex[_user] = pos + 1;

        emit LeaderboardUpdated(_user, leaderboard[pos].totalVolume, pos + 1);
    }

    // ─── Price Trends ─────────────────────────────────────────────────────────

    function _recordPriceTrend(uint256 _auctionId, uint256 _price) internal {
        PriceTrend storage pt = priceTrends[_auctionId];
        pt.prices.push(_price);
        pt.timestamps.push(block.timestamp);

        uint256 len = pt.prices.length;
        // Moving average (last 5 prices)
        uint256 window = len < 5 ? len : 5;
        uint256 sum = 0;
        for (uint256 i = len - window; i < len; i++) sum += pt.prices[i];
        pt.movingAverage = sum / window;

        // Trend: compare latest to moving average
        if (len >= 2) {
            pt.trend = int256(_price) - int256(pt.prices[len - 2]);
        }
    }

    // ─── Fraud Detection ──────────────────────────────────────────────────────

    function _recordBidTimestamp(address _bidder) internal {
        userBidTimestamps[_bidder].push(block.timestamp);
        // Keep only last 100 entries
        if (userBidTimestamps[_bidder].length > 100) {
            // Shift array (gas-expensive but bounded)
            for (uint256 i = 0; i < 99; i++) {
                userBidTimestamps[_bidder][i] = userBidTimestamps[_bidder][i + 1];
            }
            userBidTimestamps[_bidder].pop();
        }
    }

    function _detectSybilAttack(address _bidder) internal view returns (bool) {
        uint256[] storage timestamps = userBidTimestamps[_bidder];
        if (timestamps.length < 50) return false;
        // Check if 50+ bids in last hour
        uint256 oneHourAgo = block.timestamp - 3600;
        uint256 count = 0;
        for (uint256 i = timestamps.length; i > 0; i--) {
            if (timestamps[i - 1] >= oneHourAgo) count++;
            else break;
        }
        return count > 50;
    }

    function detectWashTrading(uint256 _auctionId, address _seller) external view returns (bool) {
        return auctionBidders[_auctionId][_seller];
    }

    function calculateTrustScore(address _user) external view returns (uint256) {
        if (flaggedUsers[_user]) return 0;
        uint256 idx = leaderboardIndex[_user];
        if (idx == 0) return 50; // neutral
        LeaderboardEntry memory entry = leaderboard[idx - 1];
        uint256 score = 50 + (entry.auctionsWon * 5);
        return score > 100 ? 100 : score;
    }

    // ─── Bid Velocity ─────────────────────────────────────────────────────────

    function _calculateBidVelocity(uint256 _auctionId) internal view returns (uint256) {
        AuctionMetrics storage am = auctionMetrics[_auctionId];
        if (am.bidCount == 0 || am.timeToFirstBid == 0) return 0;
        uint256 elapsed = block.timestamp - am.timeToFirstBid;
        if (elapsed == 0) return am.bidCount * 3600 * 1000;
        return (am.bidCount * 3600 * 1000) / elapsed;
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getPlatformMetrics() external view returns (PlatformMetrics memory) {
        return metrics;
    }

    function getAuctionMetrics(uint256 _auctionId) external view returns (AuctionMetrics memory) {
        return auctionMetrics[_auctionId];
    }

    function getLeaderboard(uint256 _limit) external view returns (LeaderboardEntry[] memory) {
        uint256 len = leaderboard.length < _limit ? leaderboard.length : _limit;
        LeaderboardEntry[] memory result = new LeaderboardEntry[](len);
        for (uint256 i = 0; i < len; i++) result[i] = leaderboard[i];
        return result;
    }

    function getPriceTrend(uint256 _auctionId) external view returns (PriceTrend memory) {
        return priceTrends[_auctionId];
    }
}
