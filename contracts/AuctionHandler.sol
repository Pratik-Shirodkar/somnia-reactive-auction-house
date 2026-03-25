// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ReactiveAuction.sol";

interface ISomniaEventHandler {
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) external;
}

interface ISomniaReactivityPrecompile {
    struct SubscriptionData {
        bytes32[4] eventTopics;
        address emitter;
        address handlerContractAddress;
        bytes4 handlerFunctionSelector;
        uint256 priorityFeePerGas;
        uint256 maxFeePerGas;
        uint256 gasLimit;
        bool isGuaranteed;
        bool isCoalesced;
    }
    function createSubscription(SubscriptionData calldata data) external returns (uint256);
}

/**
 * @title AuctionHandler
 * @notice Enhanced Somnia Reactive Event Handler with multi-phase workflow orchestration,
 *         dynamic subscription management, and cascading reactive events.
 */
contract AuctionHandler is ISomniaEventHandler {
    address public constant SOMNIA_REACTIVITY_PRECOMPILE = 0x6900000000000000000000000000000000000001;

    ReactiveAuction public auctionContract;
    address public owner;
    address public analyticsEngine;
    address public priceOracle;

    // ─── Subscription Tracking ────────────────────────────────────────────────

    enum SubscriptionType { SETTLEMENT, REVEAL_DEADLINE, REMINDER, PRICE_UPDATE, ANALYTICS_UPDATE }

    struct SubscriptionInfo {
        uint256 subscriptionId;
        uint256 scheduledTime;
        SubscriptionType subType;
        bool active;
    }

    /// auctionId => list of subscriptions
    mapping(uint256 => SubscriptionInfo[]) public auctionSubscriptions;

    // ─── Cascade / Achievement Tracking ──────────────────────────────────────

    uint256 public highValueThreshold = 100 ether;
    mapping(address => uint256) public userWins;

    // ─── Events ───────────────────────────────────────────────────────────────

    event SubscriptionCreated(uint256 indexed auctionId, uint256 subscriptionId, uint256 scheduledTime, SubscriptionType subType);
    event SubscriptionCancelled(uint256 indexed auctionId, SubscriptionType subType);
    event AutoSettlementTriggered(uint256 indexed auctionId, uint256 timestamp);
    event HandlerInvoked(address emitter, uint256 timestamp);
    event CascadeFollowUpCreated(uint256 indexed originalAuctionId, uint256 indexed newAuctionId);
    event BundleReminderScheduled(uint256 indexed auctionId, uint256 reminderTime, uint256 percentRemaining);
    event FailedAuctionConverted(uint256 indexed auctionId, uint256 fixedPrice);
    event AchievementDetected(address indexed user, uint256 wins);

    // ─── Event Selectors ─────────────────────────────────────────────────────

    bytes32 public constant SCHEDULE_SELECTOR       = keccak256("Schedule(uint256)");
    bytes32 public constant AUCTION_CREATED_SEL     = keccak256("AuctionCreated(uint256,address,uint8,uint256,uint256,uint256,uint256,string)");
    bytes32 public constant BID_PLACED_SEL          = keccak256("BidPlaced(uint256,address,uint256,uint256)");
    bytes32 public constant AUCTION_SETTLED_SEL     = keccak256("AuctionSettled(uint256,address,uint256,uint256)");
    bytes32 public constant AUCTION_EXTENDED_SEL    = keccak256("AuctionExtended(uint256,uint256,uint256,uint256)");
    bytes32 public constant BUNDLE_CREATED_SEL      = keccak256("BundleCreated(uint256,uint256,uint256)");

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _auctionContract) {
        auctionContract = ReactiveAuction(_auctionContract);
        owner = msg.sender;
    }

    // ─── Configuration ────────────────────────────────────────────────────────

    function setAnalyticsEngine(address _engine) external onlyOwner { analyticsEngine = _engine; }
    function setPriceOracle(address _oracle) external onlyOwner { priceOracle = _oracle; }
    function setHighValueThreshold(uint256 _threshold) external onlyOwner { highValueThreshold = _threshold; }

    // ─── Main Entry Point ─────────────────────────────────────────────────────

    /**
     * @notice Called by Somnia validators when a subscribed event fires.
     */
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) external override {
        emit HandlerInvoked(emitter, block.timestamp);

        // Schedule system event — process phase transitions and settlements
        if (emitter == SOMNIA_REACTIVITY_PRECOMPILE) {
            _processScheduledEvents();
            return;
        }

        if (emitter != address(auctionContract) || eventTopics.length == 0) return;

        bytes32 sig = eventTopics[0];

        if (sig == AUCTION_CREATED_SEL && eventTopics.length > 1) {
            uint256 auctionId = uint256(eventTopics[1]);
            _handleAuctionCreated(auctionId);
            return;
        }

        if (sig == BID_PLACED_SEL && eventTopics.length > 1) {
            uint256 auctionId = uint256(eventTopics[1]);
            _handleBidPlaced(auctionId);
            return;
        }

        if (sig == AUCTION_SETTLED_SEL && eventTopics.length > 2) {
            uint256 auctionId = uint256(eventTopics[1]);
            address winner = address(uint160(uint256(eventTopics[2])));
            uint256 finalPrice = data.length >= 32 ? abi.decode(data, (uint256)) : 0;
            _handleAuctionSettled(auctionId, winner, finalPrice);
            return;
        }

        if (sig == BUNDLE_CREATED_SEL && eventTopics.length > 1) {
            uint256 auctionId = uint256(eventTopics[1]);
            _handleBundleCreated(auctionId);
            return;
        }
    }

    // ─── 6.2 Phase Detection & Routing ───────────────────────────────────────

    function _handleAuctionCreated(uint256 _auctionId) internal {
        try auctionContract.getAuction(_auctionId) returns (ReactiveAuction.Auction memory a) {
            if (a.auctionType == ReactiveAuction.AuctionType.SEALED_BID) {
                // Schedule bidding end → reveal transition
                _createSchedule(_auctionId, a.endTime, SubscriptionType.SETTLEMENT, true);
            } else {
                // Schedule settlement for English/Dutch/Bundle
                _createSchedule(_auctionId, a.endTime, SubscriptionType.SETTLEMENT, true);
            }
        } catch {}
    }

    // ─── 6.3 handleBiddingEnd ────────────────────────────────────────────────

    function _handleBiddingEnd(uint256 _auctionId) internal {
        try auctionContract.transitionToReveal(_auctionId) {
            ReactiveAuction.Auction memory a = auctionContract.getAuction(_auctionId);
            // Schedule reveal deadline
            _createSchedule(_auctionId, a.revealDeadline, SubscriptionType.REVEAL_DEADLINE, true);
        } catch {}
    }

    // ─── 6.4 handleRevealEnd ─────────────────────────────────────────────────

    function _handleRevealEnd(uint256 _auctionId) internal {
        try auctionContract.settleSealedAuction(_auctionId) {
            emit AutoSettlementTriggered(_auctionId, block.timestamp);
            _markSubscriptionInactive(_auctionId, SubscriptionType.REVEAL_DEADLINE);
        } catch {}
    }

    // ─── 6.5 Dynamic Subscription Management ─────────────────────────────────

    function _handleBidPlaced(uint256 _auctionId) internal {
        try auctionContract.getAuction(_auctionId) returns (ReactiveAuction.Auction memory a) {
            // Detect late bid — if auction was extended, reschedule settlement
            if (a.config.antiSnipeEnabled && a.config.currentExtensions > 0) {
                _rescheduleSettlement(_auctionId, a.endTime);
            }
        } catch {}
    }

    function _rescheduleSettlement(uint256 _auctionId, uint256 _newEndTime) internal {
        // Mark old settlement subscription inactive
        _markSubscriptionInactive(_auctionId, SubscriptionType.SETTLEMENT);
        // Create new one with updated time
        _createSchedule(_auctionId, _newEndTime, SubscriptionType.SETTLEMENT, true);
    }

    function _markSubscriptionInactive(uint256 _auctionId, SubscriptionType _type) internal {
        SubscriptionInfo[] storage subs = auctionSubscriptions[_auctionId];
        for (uint256 i = 0; i < subs.length; i++) {
            if (subs[i].subType == _type && subs[i].active) {
                subs[i].active = false;
                emit SubscriptionCancelled(_auctionId, _type);
                break;
            }
        }
    }

    // ─── Scheduled Event Processing ───────────────────────────────────────────

    function _processScheduledEvents() internal {
        uint256[] memory activeIds = auctionContract.getActiveAuctionIds();
        for (uint256 i = 0; i < activeIds.length; i++) {
            uint256 id = activeIds[i];
            try auctionContract.getAuction(id) returns (ReactiveAuction.Auction memory a) {
                // Bidding phase ended → transition or settle
                if (a.phase == ReactiveAuction.AuctionPhase.BIDDING && block.timestamp >= a.endTime) {
                    if (a.auctionType == ReactiveAuction.AuctionType.SEALED_BID) {
                        _handleBiddingEnd(id);
                    } else if (a.auctionType == ReactiveAuction.AuctionType.BUNDLE) {
                        try auctionContract.settleBundleAuction(id) {
                            emit AutoSettlementTriggered(id, block.timestamp);
                        } catch {}
                    } else {
                        try auctionContract.settleAuction(id) {
                            emit AutoSettlementTriggered(id, block.timestamp);
                        } catch {}
                    }
                }
                // Reveal phase ended → settle sealed auction
                if (a.auctionType == ReactiveAuction.AuctionType.SEALED_BID &&
                    a.phase == ReactiveAuction.AuctionPhase.REVEAL &&
                    block.timestamp >= a.revealDeadline) {
                    _handleRevealEnd(id);
                }
            } catch {}
        }
    }

    // ─── Task 7: Cascading Reactive Events ───────────────────────────────────

    function _handleAuctionSettled(uint256 _auctionId, address _winner, uint256 _finalPrice) internal {
        // 7.1 High-value cascade: create follow-up auction
        if (_finalPrice >= highValueThreshold) {
            _createFollowUpAuction(_auctionId, _finalPrice);
        }

        // 7.4 Achievement detection
        if (_winner != address(0)) {
            userWins[_winner]++;
            uint256 wins = userWins[_winner];
            if (wins == 3 || wins == 10 || wins == 25 || wins == 50) {
                emit AchievementDetected(_winner, wins);
            }
        }

        // 7.3 Failed auction retry handled in _processScheduledEvents (no bids path)
    }

    function _createFollowUpAuction(uint256 _originalId, uint256 _finalPrice) internal {
        try auctionContract.getAuction(_originalId) returns (ReactiveAuction.Auction memory a) {
            uint256 duration = a.endTime > a.startTime ? a.endTime - a.startTime : 3600;
            try auctionContract.createEnglishAuction(
                _finalPrice / 2,  // Start at 50% of final price
                duration,
                string(abi.encodePacked("Follow-up: ", a.title)),
                "Auto-created follow-up auction",
                a.imageUrl
            ) returns (uint256 newId) {
                emit CascadeFollowUpCreated(_originalId, newId);
            } catch {}
        } catch {}
    }

    // 7.2 Bundle reminder scheduling
    function _handleBundleCreated(uint256 _auctionId) internal {
        try auctionContract.getAuction(_auctionId) returns (ReactiveAuction.Auction memory a) {
            uint256 duration = a.endTime - a.startTime;
            // Schedule reminders at 75%, 50%, 25% time remaining
            uint256[3] memory milestones = [
                a.startTime + (duration * 25) / 100,  // 75% remaining
                a.startTime + (duration * 50) / 100,  // 50% remaining
                a.startTime + (duration * 75) / 100   // 25% remaining
            ];
            uint256[3] memory percents = [uint256(75), uint256(50), uint256(25)];
            for (uint256 i = 0; i < 3; i++) {
                if (milestones[i] > block.timestamp) {
                    _createSchedule(_auctionId, milestones[i], SubscriptionType.REMINDER, false);
                    emit BundleReminderScheduled(_auctionId, milestones[i], percents[i]);
                }
            }
        } catch {}
    }

    // ─── Subscription Creation ────────────────────────────────────────────────

    function _createSchedule(
        uint256 _auctionId,
        uint256 _timestampSeconds,
        SubscriptionType _type,
        bool _isGuaranteed
    ) internal {
        uint256 scheduledTimeMs = _timestampSeconds * 1000;

        ISomniaReactivityPrecompile.SubscriptionData memory subData = ISomniaReactivityPrecompile.SubscriptionData({
            eventTopics: [SCHEDULE_SELECTOR, bytes32(scheduledTimeMs), bytes32(0), bytes32(0)],
            emitter: SOMNIA_REACTIVITY_PRECOMPILE,
            handlerContractAddress: address(this),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            priorityFeePerGas: 2 gwei,
            maxFeePerGas: 10 gwei,
            gasLimit: 2_000_000,
            isGuaranteed: _isGuaranteed,
            isCoalesced: !_isGuaranteed
        });

        try ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE).createSubscription(subData) returns (uint256 subId) {
            auctionSubscriptions[_auctionId].push(SubscriptionInfo({
                subscriptionId: subId,
                scheduledTime: _timestampSeconds,
                subType: _type,
                active: true
            }));
            emit SubscriptionCreated(_auctionId, subId, _timestampSeconds, _type);
        } catch {}
    }

    // ─── Owner Functions ──────────────────────────────────────────────────────

    function scheduleSettlement(uint256 _auctionId) external onlyOwner {
        ReactiveAuction.Auction memory a = auctionContract.getAuction(_auctionId);
        _createSchedule(_auctionId, a.endTime, SubscriptionType.SETTLEMENT, true);
    }

    function rescheduleAllSettlements() external onlyOwner {
        uint256[] memory activeIds = auctionContract.getActiveAuctionIds();
        for (uint256 i = 0; i < activeIds.length; i++) {
            ReactiveAuction.Auction memory a = auctionContract.getAuction(activeIds[i]);
            _markSubscriptionInactive(activeIds[i], SubscriptionType.SETTLEMENT);
            _createSchedule(activeIds[i], a.endTime, SubscriptionType.SETTLEMENT, true);
        }
    }

    function subscribeToAuctionCreated() external onlyOwner {
        ISomniaReactivityPrecompile.SubscriptionData memory subData = ISomniaReactivityPrecompile.SubscriptionData({
            eventTopics: [AUCTION_CREATED_SEL, bytes32(0), bytes32(0), bytes32(0)],
            emitter: address(auctionContract),
            handlerContractAddress: address(this),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            priorityFeePerGas: 2 gwei,
            maxFeePerGas: 10 gwei,
            gasLimit: 2_000_000,
            isGuaranteed: true,
            isCoalesced: false
        });
        ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE).createSubscription(subData);
    }

    function subscribeToAuctionEvents() external onlyOwner {
        bytes32[4] memory bidSel = [BID_PLACED_SEL, bytes32(0), bytes32(0), bytes32(0)];
        bytes32[4] memory settledSel = [AUCTION_SETTLED_SEL, bytes32(0), bytes32(0), bytes32(0)];
        bytes32[4] memory bundleSel = [BUNDLE_CREATED_SEL, bytes32(0), bytes32(0), bytes32(0)];

        ISomniaReactivityPrecompile precompile = ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE);

        precompile.createSubscription(ISomniaReactivityPrecompile.SubscriptionData({
            eventTopics: bidSel,
            emitter: address(auctionContract),
            handlerContractAddress: address(this),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            priorityFeePerGas: 2 gwei, maxFeePerGas: 10 gwei, gasLimit: 2_000_000,
            isGuaranteed: false, isCoalesced: true
        }));

        precompile.createSubscription(ISomniaReactivityPrecompile.SubscriptionData({
            eventTopics: settledSel,
            emitter: address(auctionContract),
            handlerContractAddress: address(this),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            priorityFeePerGas: 2 gwei, maxFeePerGas: 10 gwei, gasLimit: 2_000_000,
            isGuaranteed: true, isCoalesced: false
        }));

        precompile.createSubscription(ISomniaReactivityPrecompile.SubscriptionData({
            eventTopics: bundleSel,
            emitter: address(auctionContract),
            handlerContractAddress: address(this),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            priorityFeePerGas: 2 gwei, maxFeePerGas: 10 gwei, gasLimit: 2_000_000,
            isGuaranteed: false, isCoalesced: false
        }));
    }

    function getAuctionSubscriptions(uint256 _auctionId) external view returns (SubscriptionInfo[] memory) {
        return auctionSubscriptions[_auctionId];
    }

    receive() external payable {}
}
