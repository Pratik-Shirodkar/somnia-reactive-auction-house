// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ReactiveAuction.sol";

/**
 * @title ISomniaEventHandler
 * @notice Interface for Somnia's native on-chain reactivity event handler.
 */
interface ISomniaEventHandler {
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) external;
}

/**
 * @title ISomniaReactivityPrecompile
 * @notice Precompile interface for creating on-chain subscriptions.
 */
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
 * @notice Somnia Reactive Event Handler for auto-settling auctions.
 * 
 *   Without Somnia Reactivity, you'd need Chainlink Keepers, Gelato,
 *   or your own bot server. With Reactivity, Somnia validators
 *   trigger settlement automatically — zero infrastructure required.
 */
contract AuctionHandler is ISomniaEventHandler {
    address public constant SOMNIA_REACTIVITY_PRECOMPILE = 0x6900000000000000000000000000000000000001;
    
    ReactiveAuction public auctionContract;
    address public owner;

    mapping(uint256 => uint256) public auctionSubscriptions;

    event SubscriptionCreated(uint256 indexed auctionId, uint256 subscriptionId, uint256 scheduledTime);
    event AutoSettlementTriggered(uint256 indexed auctionId, uint256 timestamp);
    event HandlerInvoked(address emitter, uint256 timestamp);

    bytes32 public constant SCHEDULE_SELECTOR = keccak256("Schedule(uint256)");
    bytes32 public constant AUCTION_CREATED_SELECTOR = keccak256("AuctionCreated(uint256,address,uint8,uint256,uint256,uint256,uint256,string)");

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _auctionContract) {
        auctionContract = ReactiveAuction(_auctionContract);
        owner = msg.sender;
    }

    /**
     * @notice Called by Somnia validators when a subscribed event fires.
     */
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata /* data */
    ) external override {
        emit HandlerInvoked(emitter, block.timestamp);

        // Handle system events (Schedule) — settle expired auctions
        if (emitter == SOMNIA_REACTIVITY_PRECOMPILE) {
            _settleExpiredAuctions();
            return;
        }
        
        // Handle AuctionCreated — schedule auto-settlement
        if (emitter == address(auctionContract) && eventTopics.length > 1 && eventTopics[0] == AUCTION_CREATED_SELECTOR) {
            uint256 auctionId = uint256(eventTopics[1]);
            _scheduleAutoSettlement(auctionId);
        }
    }

    function _scheduleAutoSettlement(uint256 _auctionId) internal {
        ReactiveAuction.Auction memory a = auctionContract.getAuction(_auctionId);
        uint256 endTimeMs = a.endTime * 1000;

        ISomniaReactivityPrecompile.SubscriptionData memory subData = ISomniaReactivityPrecompile.SubscriptionData({
            eventTopics: [SCHEDULE_SELECTOR, bytes32(endTimeMs), bytes32(0), bytes32(0)],
            emitter: SOMNIA_REACTIVITY_PRECOMPILE,
            handlerContractAddress: address(this),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            priorityFeePerGas: 2 gwei,
            maxFeePerGas: 10 gwei,
            gasLimit: 2_000_000,
            isGuaranteed: true,
            isCoalesced: false
        });

        uint256 subscriptionId = ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE).createSubscription(subData);
        auctionSubscriptions[_auctionId] = subscriptionId;

        emit SubscriptionCreated(_auctionId, subscriptionId, a.endTime);
    }

    function _settleExpiredAuctions() internal {
        uint256[] memory activeIds = auctionContract.getActiveAuctionIds();
        
        for (uint256 i = 0; i < activeIds.length; i++) {
            ReactiveAuction.Auction memory a = auctionContract.getAuction(activeIds[i]);
            
            if (a.status == ReactiveAuction.AuctionStatus.ACTIVE && block.timestamp >= a.endTime) {
                try auctionContract.settleAuction(activeIds[i]) {
                    emit AutoSettlementTriggered(activeIds[i], block.timestamp);
                } catch {
                    // Skip failed settlements
                }
            }
        }
    }

    /**
     * @notice Manually schedule auto-settlement for an auction
     */
    function scheduleSettlement(uint256 _auctionId) external onlyOwner {
        _scheduleAutoSettlement(_auctionId);
    }

    /**
     * @notice Subscribe to AuctionCreated events for auto-scheduling
     */
    function subscribeToAuctionCreated() external onlyOwner {
        ISomniaReactivityPrecompile.SubscriptionData memory subData = ISomniaReactivityPrecompile.SubscriptionData({
            eventTopics: [AUCTION_CREATED_SELECTOR, bytes32(0), bytes32(0), bytes32(0)],
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

    receive() external payable {}
}
