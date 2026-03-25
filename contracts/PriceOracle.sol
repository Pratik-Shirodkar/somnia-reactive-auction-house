// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ReactiveAuction.sol";

/**
 * @title PriceOracle
 * @notice Multi-currency exchange rates, Dutch auction price calculations,
 *         and price prediction algorithms for the ReactiveAuction platform.
 */
contract PriceOracle {

    address public owner;
    address public handler;

    uint256 public constant RATE_STALENESS_THRESHOLD = 1 hours;
    uint256 public constant PRICE_PRECISION = 1e18;

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct ExchangeRate {
        uint256 rate;       // Price in STT (18 decimals), e.g. 1 USDC = 1e18 STT
        uint256 lastUpdate;
        bool active;
    }

    struct PricePrediction {
        uint256 predictedPrice;
        uint256 confidence;   // 0-100
        uint256 timestamp;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    mapping(address => ExchangeRate) public exchangeRates;
    address[] public supportedTokens;
    mapping(address => bool) private tokenSupported;

    mapping(uint256 => PricePrediction) public predictions;

    // Bid history for predictions (auctionId => bid amounts)
    mapping(uint256 => uint256[]) private auctionBidHistory;
    mapping(uint256 => uint256[]) private auctionBidTimes;

    ReactiveAuction public auctionContract;

    // ─── Events ───────────────────────────────────────────────────────────────

    event ExchangeRateUpdated(address indexed token, uint256 rate, uint256 timestamp);
    event PriceUpdated(uint256 indexed auctionId, uint256 currentPrice, uint256 timestamp);
    event PredictionUpdated(uint256 indexed auctionId, uint256 predictedPrice, uint256 confidence);
    event TokenAdded(address indexed token);

    modifier onlyOwner()   { require(msg.sender == owner,   "Not owner");   _; }
    modifier onlyHandler() { require(msg.sender == handler || msg.sender == owner, "Not authorized"); _; }

    constructor(address _auctionContract) {
        owner = msg.sender;
        auctionContract = ReactiveAuction(_auctionContract);
    }

    function setHandler(address _handler) external onlyOwner { handler = _handler; }

    // ─── Exchange Rate Management ─────────────────────────────────────────────

    function addSupportedToken(address _token, uint256 _initialRate) external onlyOwner {
        require(_token != address(0), "Invalid token");
        require(!tokenSupported[_token], "Already supported");
        tokenSupported[_token] = true;
        supportedTokens.push(_token);
        exchangeRates[_token] = ExchangeRate({ rate: _initialRate, lastUpdate: block.timestamp, active: true });
        emit TokenAdded(_token);
        emit ExchangeRateUpdated(_token, _initialRate, block.timestamp);
    }

    function updateExchangeRate(address _token, uint256 _rate) external onlyHandler {
        require(tokenSupported[_token], "Token not supported");
        require(_rate > 0, "Rate must be > 0");
        exchangeRates[_token].rate = _rate;
        exchangeRates[_token].lastUpdate = block.timestamp;
        emit ExchangeRateUpdated(_token, _rate, block.timestamp);
    }

    function getExchangeRate(address _token) external view returns (uint256) {
        require(tokenSupported[_token], "Token not supported");
        ExchangeRate storage er = exchangeRates[_token];
        require(er.active, "Token rate inactive");
        require(block.timestamp - er.lastUpdate <= RATE_STALENESS_THRESHOLD, "Rate is stale");
        return er.rate;
    }

    function isRateStale(address _token) external view returns (bool) {
        if (!tokenSupported[_token]) return true;
        return block.timestamp - exchangeRates[_token].lastUpdate > RATE_STALENESS_THRESHOLD;
    }

    // ─── Currency Conversion ──────────────────────────────────────────────────

    /**
     * @notice Convert token amount to STT equivalent.
     */
    function convertToSTT(address _token, uint256 _amount) external view returns (uint256) {
        if (_token == address(0)) return _amount; // Native STT
        ExchangeRate storage er = exchangeRates[_token];
        require(er.active && tokenSupported[_token], "Token not supported");
        require(block.timestamp - er.lastUpdate <= RATE_STALENESS_THRESHOLD, "Rate is stale");
        return (_amount * er.rate) / PRICE_PRECISION;
    }

    /**
     * @notice Convert STT amount to token equivalent.
     */
    function convertFromSTT(address _token, uint256 _sttAmount) external view returns (uint256) {
        if (_token == address(0)) return _sttAmount;
        ExchangeRate storage er = exchangeRates[_token];
        require(er.active && tokenSupported[_token], "Token not supported");
        require(block.timestamp - er.lastUpdate <= RATE_STALENESS_THRESHOLD, "Rate is stale");
        require(er.rate > 0, "Invalid rate");
        return (_sttAmount * PRICE_PRECISION) / er.rate;
    }

    // ─── Dutch Auction Price ──────────────────────────────────────────────────

    /**
     * @notice Calculate current Dutch auction price (linear decrease).
     *         Emits PriceUpdated for WebSocket subscribers.
     */
    function getCurrentDutchPrice(uint256 _auctionId) external returns (uint256) {
        ReactiveAuction.Auction memory a = auctionContract.getAuction(_auctionId);
        require(a.auctionType == ReactiveAuction.AuctionType.DUTCH, "Not a Dutch auction");

        uint256 price;
        if (block.timestamp >= a.endTime) {
            price = a.endPrice;
        } else {
            uint256 elapsed  = block.timestamp - a.startTime;
            uint256 duration = a.endTime - a.startTime;
            uint256 drop     = ((a.startPrice - a.endPrice) * elapsed) / duration;
            price = a.startPrice - drop;
        }

        emit PriceUpdated(_auctionId, price, block.timestamp);
        return price;
    }

    /**
     * @notice Pure Dutch price calculation (no state change, for view use).
     */
    function getDutchPriceAt(
        uint256 _startPrice,
        uint256 _endPrice,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _atTime
    ) external pure returns (uint256) {
        if (_atTime >= _endTime) return _endPrice;
        if (_atTime <= _startTime) return _startPrice;
        uint256 elapsed  = _atTime - _startTime;
        uint256 duration = _endTime - _startTime;
        uint256 drop     = ((_startPrice - _endPrice) * elapsed) / duration;
        return _startPrice - drop;
    }

    // ─── Price Prediction ─────────────────────────────────────────────────────

    /**
     * @notice Record a bid for prediction purposes.
     */
    function recordBid(uint256 _auctionId, uint256 _amount) external onlyHandler {
        auctionBidHistory[_auctionId].push(_amount);
        auctionBidTimes[_auctionId].push(block.timestamp);
        _updatePrediction(_auctionId);
    }

    function _updatePrediction(uint256 _auctionId) internal {
        uint256[] storage bids = auctionBidHistory[_auctionId];
        if (bids.length == 0) return;

        uint256 latest = bids[bids.length - 1];

        // Simple prediction: extrapolate trend from last 3 bids
        uint256 predicted;
        uint256 confidence;

        if (bids.length == 1) {
            predicted  = latest;
            confidence = 30;
        } else if (bids.length == 2) {
            uint256 growth = bids[1] > bids[0] ? bids[1] - bids[0] : 0;
            predicted  = latest + growth;
            confidence = 50;
        } else {
            // Average growth over last 3 bids
            uint256 len = bids.length;
            uint256 g1  = bids[len - 1] > bids[len - 2] ? bids[len - 1] - bids[len - 2] : 0;
            uint256 g2  = bids[len - 2] > bids[len - 3] ? bids[len - 2] - bids[len - 3] : 0;
            uint256 avgGrowth = (g1 + g2) / 2;
            predicted  = latest + avgGrowth;
            confidence = len >= 5 ? 75 : 60;
        }

        predictions[_auctionId] = PricePrediction({
            predictedPrice: predicted,
            confidence: confidence,
            timestamp: block.timestamp
        });

        emit PredictionUpdated(_auctionId, predicted, confidence);
    }

    function predictFinalPrice(uint256 _auctionId) external view returns (PricePrediction memory) {
        return predictions[_auctionId];
    }

    // ─── Anomaly Detection ────────────────────────────────────────────────────

    function detectPriceManipulation(uint256 _auctionId) external view returns (bool) {
        uint256[] storage bids = auctionBidHistory[_auctionId];
        if (bids.length < 3) return false;

        // Flag if any single bid jump > 3× the previous bid
        for (uint256 i = 1; i < bids.length; i++) {
            if (bids[i] > bids[i - 1] * 3) return true;
        }
        return false;
    }

    // ─── View Helpers ─────────────────────────────────────────────────────────

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function isTokenSupported(address _token) external view returns (bool) {
        return tokenSupported[_token];
    }
}
