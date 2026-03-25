import { expect } from "chai";
import { ethers } from "hardhat";
import { ReactiveAuction } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import fc from "fast-check";

describe("ReactiveAuction - Task 2.4: Phase Transition Logic", function () {
  let auction: ReactiveAuction;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let bidder3: SignerWithAddress;
  let handler: SignerWithAddress;

  beforeEach(async function () {
    [owner, seller, bidder1, bidder2, bidder3, handler] = await ethers.getSigners();
    
    const ReactiveAuctionFactory = await ethers.getContractFactory("ReactiveAuction");
    auction = await ReactiveAuctionFactory.deploy();
    await auction.waitForDeployment();
    
    // Set handler for testing
    await auction.connect(owner).setHandler(handler.address);
  });

  async function createSealedAuctionWithBids(): Promise<bigint> {
    // Create sealed-bid auction
    await auction.connect(seller).createSealedBidAuction(
      ethers.parseEther("1.0"),
      3600, // 1 hour bidding
      1800, // 30 min reveal
      "Test Auction",
      "Description",
      ""
    );

    const auctionId = (await auction.nextAuctionId()) - 1n;

    // Three bidders commit
    const amount1 = ethers.parseEther("2.0");
    const amount2 = ethers.parseEther("3.0");
    const amount3 = ethers.parseEther("2.5");

    const secret1 = ethers.encodeBytes32String("secret1");
    const secret2 = ethers.encodeBytes32String("secret2");
    const secret3 = ethers.encodeBytes32String("secret3");

    const commitment1 = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [amount1, secret1]));
    const commitment2 = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [amount2, secret2]));
    const commitment3 = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [amount3, secret3]));

    await auction.connect(bidder1).commitBid(auctionId, commitment1);
    await auction.connect(bidder2).commitBid(auctionId, commitment2);
    await auction.connect(bidder3).commitBid(auctionId, commitment3);

    return auctionId;
  }

  describe("transitionToReveal Function", function () {
    it("should transition from BIDDING to REVEAL phase", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Fast forward past bidding phase
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // Transition to reveal
      await auction.connect(handler).transitionToReveal(auctionId);

      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.phase).to.equal(1); // REVEAL = 1
    });

    it("should emit PhaseTransition event", async function () {
      const auctionId = await createSealedAuctionWithBids();

      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        auction.connect(handler).transitionToReveal(auctionId)
      )
        .to.emit(auction, "PhaseTransition")
        .withArgs(auctionId, 0, 1, (timestamp: any) => true); // BIDDING(0) -> REVEAL(1)
    });

    it("should only allow handler to call transitionToReveal", async function () {
      const auctionId = await createSealedAuctionWithBids();

      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        auction.connect(bidder1).transitionToReveal(auctionId)
      ).to.be.revertedWith("Not handler");
    });

    it("should reject transition for non-sealed-bid auction", async function () {
      // Create Dutch auction
      await auction.connect(seller).createDutchAuction(
        ethers.parseEther("10.0"),
        ethers.parseEther("1.0"),
        3600,
        "Dutch Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      await expect(
        auction.connect(handler).transitionToReveal(auctionId)
      ).to.be.revertedWith("Not a sealed-bid auction");
    });

    it("should reject transition if not in BIDDING phase", async function () {
      const auctionId = await createSealedAuctionWithBids();

      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // First transition should succeed
      await auction.connect(handler).transitionToReveal(auctionId);

      // Second transition should fail
      await expect(
        auction.connect(handler).transitionToReveal(auctionId)
      ).to.be.revertedWith("Not in bidding phase");
    });
  });

  describe("settleSealedAuction Function", function () {
    it("should determine winner from highest valid revealed bid", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Bidders reveal (bidder2 has highest bid of 3.0 ETH)
      const amount1 = ethers.parseEther("2.0");
      const amount2 = ethers.parseEther("3.0");
      const amount3 = ethers.parseEther("2.5");

      const secret1 = ethers.encodeBytes32String("secret1");
      const secret2 = ethers.encodeBytes32String("secret2");
      const secret3 = ethers.encodeBytes32String("secret3");

      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });
      await auction.connect(bidder2).revealBid(auctionId, amount2, secret2, { value: amount2 });
      await auction.connect(bidder3).revealBid(auctionId, amount3, secret3, { value: amount3 });

      // Fast forward past reveal deadline
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);

      // Settle auction
      await auction.connect(handler).settleSealedAuction(auctionId);

      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.highestBidder).to.equal(bidder2.address);
      expect(auctionData.currentBid).to.equal(amount2);
    });

    it("should refund all non-winning revealed bids", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Bidders reveal
      const amount1 = ethers.parseEther("2.0");
      const amount2 = ethers.parseEther("3.0");
      const amount3 = ethers.parseEther("2.5");

      const secret1 = ethers.encodeBytes32String("secret1");
      const secret2 = ethers.encodeBytes32String("secret2");
      const secret3 = ethers.encodeBytes32String("secret3");

      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });
      await auction.connect(bidder2).revealBid(auctionId, amount2, secret2, { value: amount2 });
      await auction.connect(bidder3).revealBid(auctionId, amount3, secret3, { value: amount3 });

      // Record balances before settlement
      const balance1Before = await ethers.provider.getBalance(bidder1.address);
      const balance3Before = await ethers.provider.getBalance(bidder3.address);

      // Fast forward and settle
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Check non-winners were refunded
      const balance1After = await ethers.provider.getBalance(bidder1.address);
      const balance3After = await ethers.provider.getBalance(bidder3.address);

      expect(balance1After).to.equal(balance1Before + amount1);
      expect(balance3After).to.equal(balance3Before + amount3);
    });

    it("should update auction phase to SETTLED", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Bidders reveal
      const amount1 = ethers.parseEther("2.0");
      const secret1 = ethers.encodeBytes32String("secret1");
      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });

      // Fast forward and settle
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).settleSealedAuction(auctionId);

      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.phase).to.equal(3); // SETTLED = 3
    });

    it("should emit PhaseTransition events", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Bidders reveal
      const amount1 = ethers.parseEther("2.0");
      const secret1 = ethers.encodeBytes32String("secret1");
      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });

      // Fast forward and settle
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);

      // Should emit two PhaseTransition events: REVEAL -> SETTLING -> SETTLED
      const tx = await auction.connect(handler).settleSealedAuction(auctionId);
      const receipt = await tx.wait();

      const events = receipt!.logs.filter((log: any) => {
        try {
          const parsed = auction.interface.parseLog(log);
          return parsed?.name === "PhaseTransition";
        } catch {
          return false;
        }
      });

      expect(events.length).to.equal(2);
    });

    it("should pay seller the winning bid amount", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Bidders reveal
      const amount1 = ethers.parseEther("2.0");
      const amount2 = ethers.parseEther("3.0");

      const secret1 = ethers.encodeBytes32String("secret1");
      const secret2 = ethers.encodeBytes32String("secret2");

      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });
      await auction.connect(bidder2).revealBid(auctionId, amount2, secret2, { value: amount2 });

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

      // Fast forward and settle
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).settleSealedAuction(auctionId);

      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + amount2);
    });

    it("should emit AuctionSettled event with winner and final price", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Bidders reveal
      const amount1 = ethers.parseEther("2.0");
      const secret1 = ethers.encodeBytes32String("secret1");
      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });

      // Fast forward and settle
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        auction.connect(handler).settleSealedAuction(auctionId)
      )
        .to.emit(auction, "AuctionSettled")
        .withArgs(auctionId, bidder1.address, amount1, (timestamp: any) => true);
    });

    it("should handle auction with no revealed bids", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // No one reveals

      // Fast forward and settle
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        auction.connect(handler).settleSealedAuction(auctionId)
      )
        .to.emit(auction, "AuctionCancelled")
        .withArgs(auctionId, (timestamp: any) => true);

      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.highestBidder).to.equal(ethers.ZeroAddress);
    });

    it("should only allow handler to call settleSealedAuction", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Fast forward
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        auction.connect(bidder1).settleSealedAuction(auctionId)
      ).to.be.revertedWith("Not handler");
    });

    it("should reject settlement for non-sealed-bid auction", async function () {
      // Create Dutch auction
      await auction.connect(seller).createDutchAuction(
        ethers.parseEther("10.0"),
        ethers.parseEther("1.0"),
        3600,
        "Dutch Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      await expect(
        auction.connect(handler).settleSealedAuction(auctionId)
      ).to.be.revertedWith("Not a sealed-bid auction");
    });

    it("should reject settlement if not in REVEAL phase", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Try to settle while still in BIDDING phase
      await expect(
        auction.connect(handler).settleSealedAuction(auctionId)
      ).to.be.revertedWith("Not in reveal phase");
    });

    it("should remove auction from activeAuctionIds", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Bidders reveal
      const amount1 = ethers.parseEther("2.0");
      const secret1 = ethers.encodeBytes32String("secret1");
      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });

      const activeCountBefore = await auction.getActiveAuctionCount();

      // Fast forward and settle
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).settleSealedAuction(auctionId);

      const activeCountAfter = await auction.getActiveAuctionCount();
      expect(activeCountAfter).to.equal(activeCountBefore - 1n);
    });

    it("should handle partial reveals correctly", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Only bidder1 and bidder2 reveal (bidder3 doesn't)
      const amount1 = ethers.parseEther("2.0");
      const amount2 = ethers.parseEther("3.0");

      const secret1 = ethers.encodeBytes32String("secret1");
      const secret2 = ethers.encodeBytes32String("secret2");

      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });
      await auction.connect(bidder2).revealBid(auctionId, amount2, secret2, { value: amount2 });

      // Fast forward and settle
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Winner should be bidder2 (highest revealed bid)
      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.highestBidder).to.equal(bidder2.address);
      expect(auctionData.currentBid).to.equal(amount2);
    });
  });

  describe("Property-Based Tests", function () {
    it("Property: Winner should always be the highest revealed bidder", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.bigInt({ min: ethers.parseEther("0.1"), max: ethers.parseEther("10") }),
            { minLength: 2, maxLength: 5 }
          ),
          async (amounts) => {
            // Create auction
            await auction.connect(seller).createSealedBidAuction(
              ethers.parseEther("0.01"),
              3600,
              1800,
              "Property Test",
              "Description",
              ""
            );

            const auctionId = (await auction.nextAuctionId()) - 1n;
            const signers = await ethers.getSigners();
            const bidders = signers.slice(3, 3 + amounts.length);

            // Commit bids
            for (let i = 0; i < amounts.length; i++) {
              const secret = ethers.encodeBytes32String(`secret${i}`);
              const commitment = ethers.keccak256(
                ethers.solidityPacked(["uint256", "bytes32"], [amounts[i], secret])
              );
              await auction.connect(bidders[i]).commitBid(auctionId, commitment);
            }

            // Transition to reveal
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);
            await auction.connect(handler).transitionToReveal(auctionId);

            // Reveal all bids
            for (let i = 0; i < amounts.length; i++) {
              const secret = ethers.encodeBytes32String(`secret${i}`);
              await auction.connect(bidders[i]).revealBid(auctionId, amounts[i], secret, { value: amounts[i] });
            }

            // Settle
            await ethers.provider.send("evm_increaseTime", [1801]);
            await ethers.provider.send("evm_mine", []);
            await auction.connect(handler).settleSealedAuction(auctionId);

            // Find expected winner (highest amount)
            const maxAmount = amounts.reduce((max, amt) => amt > max ? amt : max, 0n);
            const expectedWinnerIndex = amounts.indexOf(maxAmount);
            const expectedWinner = bidders[expectedWinnerIndex].address;

            const auctionData = await auction.auctions(auctionId);
            expect(auctionData.highestBidder).to.equal(expectedWinner);
            expect(auctionData.currentBid).to.equal(maxAmount);
          }
        ),
        { numRuns: 10 }
      );
    });

    it("Property: All non-winners should be refunded", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.bigInt({ min: ethers.parseEther("0.1"), max: ethers.parseEther("5") }),
            { minLength: 2, maxLength: 4 }
          ),
          async (amounts) => {
            // Create auction
            await auction.connect(seller).createSealedBidAuction(
              ethers.parseEther("0.01"),
              3600,
              1800,
              "Refund Test",
              "Description",
              ""
            );

            const auctionId = (await auction.nextAuctionId()) - 1n;
            const signers = await ethers.getSigners();
            const bidders = signers.slice(3, 3 + amounts.length);

            // Commit bids
            for (let i = 0; i < amounts.length; i++) {
              const secret = ethers.encodeBytes32String(`secret${i}`);
              const commitment = ethers.keccak256(
                ethers.solidityPacked(["uint256", "bytes32"], [amounts[i], secret])
              );
              await auction.connect(bidders[i]).commitBid(auctionId, commitment);
            }

            // Transition to reveal
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);
            await auction.connect(handler).transitionToReveal(auctionId);

            // Reveal all bids
            for (let i = 0; i < amounts.length; i++) {
              const secret = ethers.encodeBytes32String(`secret${i}`);
              await auction.connect(bidders[i]).revealBid(auctionId, amounts[i], secret, { value: amounts[i] });
            }

            const escrowBeforeSettle = await ethers.provider.getBalance(await auction.getAddress());

            // Settle
            await ethers.provider.send("evm_increaseTime", [1801]);
            await ethers.provider.send("evm_mine", []);
            await auction.connect(handler).settleSealedAuction(auctionId);

            const escrowAfterSettle = await ethers.provider.getBalance(await auction.getAddress());

            // Contract escrow should be fully drained after paying seller + refunding revealed non-winners
            expect(escrowBeforeSettle).to.equal(amounts.reduce((sum, amt) => sum + amt, 0n));
            expect(escrowAfterSettle).to.equal(0n);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe("Requirement Validation", function () {
    it("Validates Requirements 1.4: Bidding → Reveal transition", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Verify in BIDDING phase
      let auctionData = await auction.auctions(auctionId);
      expect(auctionData.phase).to.equal(0); // BIDDING

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Verify in REVEAL phase
      auctionData = await auction.auctions(auctionId);
      expect(auctionData.phase).to.equal(1); // REVEAL
    });

    it("Validates Requirements 1.5: Reveal → Settled transition", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Reveal a bid
      const amount1 = ethers.parseEther("2.0");
      const secret1 = ethers.encodeBytes32String("secret1");
      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });

      // Verify in REVEAL phase
      let auctionData = await auction.auctions(auctionId);
      expect(auctionData.phase).to.equal(1); // REVEAL

      // Settle
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Verify in SETTLED phase
      auctionData = await auction.auctions(auctionId);
      expect(auctionData.phase).to.equal(3); // SETTLED
    });

    it("Validates Requirements 1.7: Refund all non-winning revealed bids", async function () {
      const auctionId = await createSealedAuctionWithBids();

      // Transition to reveal
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).transitionToReveal(auctionId);

      // Bidders reveal
      const amount1 = ethers.parseEther("2.0");
      const amount2 = ethers.parseEther("3.0");
      const amount3 = ethers.parseEther("2.5");

      const secret1 = ethers.encodeBytes32String("secret1");
      const secret2 = ethers.encodeBytes32String("secret2");
      const secret3 = ethers.encodeBytes32String("secret3");

      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });
      await auction.connect(bidder2).revealBid(auctionId, amount2, secret2, { value: amount2 });
      await auction.connect(bidder3).revealBid(auctionId, amount3, secret3, { value: amount3 });

      // Record balances
      const balance1Before = await ethers.provider.getBalance(bidder1.address);
      const balance3Before = await ethers.provider.getBalance(bidder3.address);

      // Settle
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Verify non-winners refunded (bidder1 and bidder3)
      const balance1After = await ethers.provider.getBalance(bidder1.address);
      const balance3After = await ethers.provider.getBalance(bidder3.address);

      expect(balance1After).to.equal(balance1Before + amount1);
      expect(balance3After).to.equal(balance3Before + amount3);
    });
  });
});
