import { expect } from "chai";
import { ethers } from "hardhat";
import { ReactiveAuction } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import fc from "fast-check";

describe("ReactiveAuction - Task 2.4: Phase Transition Logic", function () {
  let auction: ReactiveAuction;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let handler: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let bidder3: SignerWithAddress;

  beforeEach(async function () {
    [owner, seller, handler, bidder1, bidder2, bidder3] = await ethers.getSigners();
    
    const ReactiveAuctionFactory = await ethers.getContractFactory("ReactiveAuction");
    auction = await ReactiveAuctionFactory.deploy();
    await auction.waitForDeployment();

    // Set handler address
    await auction.connect(owner).setHandler(handler.address);
  });

  describe("Unit Tests - transitionToReveal", function () {
    it("should transition from BIDDING to REVEAL phase", async function () {
      // Create sealed-bid auction
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      // Verify initial phase
      let auctionData = await auction.auctions(auctionId);
      expect(auctionData.phase).to.equal(0); // BIDDING

      // Transition to REVEAL
      await auction.connect(handler).transitionToReveal(auctionId);

      // Verify phase changed
      auctionData = await auction.auctions(auctionId);
      expect(auctionData.phase).to.equal(1); // REVEAL
    });

    it("should emit PhaseTransition event", async function () {
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      await expect(
        auction.connect(handler).transitionToReveal(auctionId)
      )
        .to.emit(auction, "PhaseTransition")
        .withArgs(
          auctionId,
          0, // BIDDING
          1, // REVEAL
          (timestamp: any) => true
        );
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
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      // First transition to REVEAL
      await auction.connect(handler).transitionToReveal(auctionId);

      // Try to transition again
      await expect(
        auction.connect(handler).transitionToReveal(auctionId)
      ).to.be.revertedWith("Not in bidding phase");
    });

    it("should only allow handler to call transitionToReveal", async function () {
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      await expect(
        auction.connect(bidder1).transitionToReveal(auctionId)
      ).to.be.revertedWith("Not handler");
    });
  });

  describe("Unit Tests - settleSealedAuction", function () {
    async function setupAuctionWithBids() {
      // Create auction
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      // Commit bids
      const amount1 = ethers.parseEther("2.0");
      const secret1 = ethers.encodeBytes32String("secret1");
      const commitment1 = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount1, secret1])
      );

      const amount2 = ethers.parseEther("3.0");
      const secret2 = ethers.encodeBytes32String("secret2");
      const commitment2 = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount2, secret2])
      );

      const amount3 = ethers.parseEther("2.5");
      const secret3 = ethers.encodeBytes32String("secret3");
      const commitment3 = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount3, secret3])
      );

      await auction.connect(bidder1).commitBid(auctionId, commitment1);
      await auction.connect(bidder2).commitBid(auctionId, commitment2);
      await auction.connect(bidder3).commitBid(auctionId, commitment3);

      // Transition to REVEAL
      await auction.connect(handler).transitionToReveal(auctionId);

      // Reveal bids
      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });
      await auction.connect(bidder2).revealBid(auctionId, amount2, secret2, { value: amount2 });
      await auction.connect(bidder3).revealBid(auctionId, amount3, secret3, { value: amount3 });

      return { auctionId, amount1, amount2, amount3 };
    }

    it("should determine winner from highest valid revealed bid", async function () {
      const { auctionId, amount2 } = await setupAuctionWithBids();

      // Settle auction
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Verify winner (bidder2 with 3.0 ETH)
      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.highestBidder).to.equal(bidder2.address);
      expect(auctionData.currentBid).to.equal(amount2);
    });

    it("should refund all non-winning revealed bids", async function () {
      const { auctionId, amount1, amount3 } = await setupAuctionWithBids();

      // Record balances before settlement
      const bidder1BalanceBefore = await ethers.provider.getBalance(bidder1.address);
      const bidder3BalanceBefore = await ethers.provider.getBalance(bidder3.address);

      // Settle auction
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Verify refunds (bidder1 and bidder3 should get refunds)
      const bidder1BalanceAfter = await ethers.provider.getBalance(bidder1.address);
      const bidder3BalanceAfter = await ethers.provider.getBalance(bidder3.address);

      expect(bidder1BalanceAfter).to.equal(bidder1BalanceBefore + amount1);
      expect(bidder3BalanceAfter).to.equal(bidder3BalanceBefore + amount3);
    });

    it("should transfer winning bid to seller", async function () {
      const { auctionId, amount2 } = await setupAuctionWithBids();

      // Record seller balance before settlement
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

      // Settle auction
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Verify seller received payment
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + amount2);
    });

    it("should update auction phase to SETTLED", async function () {
      const { auctionId } = await setupAuctionWithBids();

      // Settle auction
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Verify phase
      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.phase).to.equal(3); // SETTLED
    });

    it("should emit PhaseTransition events", async function () {
      const { auctionId } = await setupAuctionWithBids();

      // Should emit two PhaseTransition events: REVEAL->SETTLING and SETTLING->SETTLED
      const tx = await auction.connect(handler).settleSealedAuction(auctionId);
      const receipt = await tx.wait();

      // Filter PhaseTransition events
      const phaseTransitionEvents = receipt?.logs.filter(
        (log: any) => {
          try {
            const parsed = auction.interface.parseLog(log);
            return parsed?.name === "PhaseTransition";
          } catch {
            return false;
          }
        }
      );

      expect(phaseTransitionEvents?.length).to.equal(2);
    });

    it("should emit AuctionSettled event", async function () {
      const { auctionId, amount2 } = await setupAuctionWithBids();

      await expect(
        auction.connect(handler).settleSealedAuction(auctionId)
      )
        .to.emit(auction, "AuctionSettled")
        .withArgs(
          auctionId,
          bidder2.address,
          amount2,
          (timestamp: any) => true
        );
    });

    it("should handle auction with no revealed bids", async function () {
      // Create auction
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      // Commit but don't reveal
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await auction.connect(bidder1).commitBid(auctionId, commitment);

      // Transition to REVEAL
      await auction.connect(handler).transitionToReveal(auctionId);

      // Settle without any reveals
      await expect(
        auction.connect(handler).settleSealedAuction(auctionId)
      ).to.emit(auction, "AuctionCancelled");

      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.highestBidder).to.equal(ethers.ZeroAddress);
    });

    it("should exclude unrevealed bids from winner determination", async function () {
      // Create auction
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      // Bidder1 commits highest but doesn't reveal
      const amount1 = ethers.parseEther("5.0");
      const secret1 = ethers.encodeBytes32String("secret1");
      const commitment1 = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount1, secret1])
      );

      // Bidder2 commits and reveals
      const amount2 = ethers.parseEther("2.0");
      const secret2 = ethers.encodeBytes32String("secret2");
      const commitment2 = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount2, secret2])
      );

      await auction.connect(bidder1).commitBid(auctionId, commitment1);
      await auction.connect(bidder2).commitBid(auctionId, commitment2);

      // Transition to REVEAL
      await auction.connect(handler).transitionToReveal(auctionId);

      // Only bidder2 reveals
      await auction.connect(bidder2).revealBid(auctionId, amount2, secret2, { value: amount2 });

      // Settle
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Bidder2 should win despite having lower bid (bidder1 didn't reveal)
      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.highestBidder).to.equal(bidder2.address);
      expect(auctionData.currentBid).to.equal(amount2);
    });

    it("should reject settlement if not in REVEAL phase", async function () {
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      // Try to settle while still in BIDDING phase
      await expect(
        auction.connect(handler).settleSealedAuction(auctionId)
      ).to.be.revertedWith("Not in reveal phase");
    });

    it("should reject settlement for non-sealed-bid auction", async function () {
      // Create English auction
      await auction.connect(seller).createEnglishAuction(
        ethers.parseEther("1.0"),
        3600,
        "English Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      await expect(
        auction.connect(handler).settleSealedAuction(auctionId)
      ).to.be.revertedWith("Not a sealed-bid auction");
    });

    it("should only allow handler to call settleSealedAuction", async function () {
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;

      // Transition to REVEAL
      await auction.connect(handler).transitionToReveal(auctionId);

      await expect(
        auction.connect(bidder1).settleSealedAuction(auctionId)
      ).to.be.revertedWith("Not handler");
    });

    it("should remove auction from active list", async function () {
      const { auctionId } = await setupAuctionWithBids();

      // Verify auction is in active list before settlement
      const activeIdBefore = await auction.activeAuctionIds(0);
      expect(activeIdBefore).to.equal(auctionId);

      // Settle auction
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Verify auction removed from active list
      await expect(auction.activeAuctionIds(0)).to.be.reverted;
    });
  });

  describe("Property-Based Tests", function () {
    it("Property: Winner should always be the highest revealed bid", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.bigInt({ min: ethers.parseEther("0.1"), max: ethers.parseEther("10") }),
            { minLength: 2, maxLength: 5 }
          ),
          async (amounts) => {
            // Create auction
            await auction.connect(seller).createSealedBidAuction(
              ethers.parseEther("0.05"),
              3600,
              1800,
              "Property Test",
              "Description",
              ""
            );

            const auctionId = await auction.nextAuctionId() - 1n;
            const signers = await ethers.getSigners();
            const bidders = signers.slice(3, 3 + amounts.length);

            // Commit and reveal all bids
            for (let i = 0; i < amounts.length; i++) {
              const secret = ethers.encodeBytes32String(`secret${i}`);
              const commitment = ethers.keccak256(
                ethers.solidityPacked(["uint256", "bytes32"], [amounts[i], secret])
              );

              await auction.connect(bidders[i]).commitBid(auctionId, commitment);
            }

            // Transition to REVEAL
            await auction.connect(handler).transitionToReveal(auctionId);

            // Reveal all bids
            for (let i = 0; i < amounts.length; i++) {
              const secret = ethers.encodeBytes32String(`secret${i}`);
              await auction.connect(bidders[i]).revealBid(auctionId, amounts[i], secret, {
                value: amounts[i]
              });
            }

            // Settle
            await auction.connect(handler).settleSealedAuction(auctionId);

            // Find expected winner (highest amount)
            const maxAmount = amounts.reduce((max, amt) => amt > max ? amt : max, 0n);
            const winnerIndex = amounts.findIndex(amt => amt === maxAmount);

            // Verify winner
            const auctionData = await auction.auctions(auctionId);
            expect(auctionData.highestBidder).to.equal(bidders[winnerIndex].address);
            expect(auctionData.currentBid).to.equal(maxAmount);
          }
        ),
        { numRuns: 10 }
      );
    });

    it("Property: All non-winning bids should be refunded", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.bigInt({ min: ethers.parseEther("0.1"), max: ethers.parseEther("5") }),
            { minLength: 3, maxLength: 5 }
          ),
          async (amounts) => {
            // Create auction
            await auction.connect(seller).createSealedBidAuction(
              ethers.parseEther("0.05"),
              3600,
              1800,
              "Refund Test",
              "Description",
              ""
            );

            const auctionId = await auction.nextAuctionId() - 1n;
            const signers = await ethers.getSigners();
            const bidders = signers.slice(3, 3 + amounts.length);

            // Record initial balances
            const initialBalances = await Promise.all(
              bidders.map(b => ethers.provider.getBalance(b.address))
            );

            // Commit and reveal all bids
            for (let i = 0; i < amounts.length; i++) {
              const secret = ethers.encodeBytes32String(`secret${i}`);
              const commitment = ethers.keccak256(
                ethers.solidityPacked(["uint256", "bytes32"], [amounts[i], secret])
              );
              await auction.connect(bidders[i]).commitBid(auctionId, commitment);
            }

            await auction.connect(handler).transitionToReveal(auctionId);

            const revealTxs = [];
            for (let i = 0; i < amounts.length; i++) {
              const secret = ethers.encodeBytes32String(`secret${i}`);
              const tx = await auction.connect(bidders[i]).revealBid(auctionId, amounts[i], secret, {
                value: amounts[i]
              });
              revealTxs.push(tx);
            }

            // Calculate gas costs
            const gasCosts = await Promise.all(
              revealTxs.map(async (tx) => {
                const receipt = await tx.wait();
                return receipt!.gasUsed * tx.gasPrice!;
              })
            );

            // Settle
            await auction.connect(handler).settleSealedAuction(auctionId);

            // Find winner
            const maxAmount = amounts.reduce((max, amt) => amt > max ? amt : max, 0n);
            const winnerIndex = amounts.findIndex(amt => amt === maxAmount);

            // Verify non-winners got refunds
            for (let i = 0; i < amounts.length; i++) {
              const finalBalance = await ethers.provider.getBalance(bidders[i].address);
              
              if (i === winnerIndex) {
                // Winner should have paid their bid
                expect(finalBalance).to.be.closeTo(
                  initialBalances[i] - amounts[i] - gasCosts[i],
                  ethers.parseEther("0.001") // Small tolerance for gas variations
                );
              } else {
                // Non-winners should be refunded (minus gas)
                expect(finalBalance).to.be.closeTo(
                  initialBalances[i] - gasCosts[i],
                  ethers.parseEther("0.001")
                );
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it("Property: Phase transitions should always follow correct sequence", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (numBidders) => {
            // Create auction
            await auction.connect(seller).createSealedBidAuction(
              ethers.parseEther("0.1"),
              3600,
              1800,
              "Phase Test",
              "Description",
              ""
            );

            const auctionId = await auction.nextAuctionId() - 1n;

            // Initial phase should be BIDDING
            let auctionData = await auction.auctions(auctionId);
            expect(auctionData.phase).to.equal(0); // BIDDING

            // Commit some bids
            const signers = await ethers.getSigners();
            for (let i = 0; i < numBidders; i++) {
              const bidder = signers[3 + i];
              const amount = ethers.parseEther((i + 1).toString());
              const secret = ethers.encodeBytes32String(`secret${i}`);
              const commitment = ethers.keccak256(
                ethers.solidityPacked(["uint256", "bytes32"], [amount, secret])
              );
              await auction.connect(bidder).commitBid(auctionId, commitment);
            }

            // Transition to REVEAL
            await auction.connect(handler).transitionToReveal(auctionId);
            auctionData = await auction.auctions(auctionId);
            expect(auctionData.phase).to.equal(1); // REVEAL

            // Reveal bids
            for (let i = 0; i < numBidders; i++) {
              const bidder = signers[3 + i];
              const amount = ethers.parseEther((i + 1).toString());
              const secret = ethers.encodeBytes32String(`secret${i}`);
              await auction.connect(bidder).revealBid(auctionId, amount, secret, {
                value: amount
              });
            }

            // Settle
            await auction.connect(handler).settleSealedAuction(auctionId);
            auctionData = await auction.auctions(auctionId);
            expect(auctionData.phase).to.equal(3); // SETTLED
          }
        ),
        { numRuns: 5 }
      );
    });

    it("Property: Unrevealed bids should never win", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 0, max: 4 }),
          async (totalBidders, numRevealed) => {
            if (numRevealed >= totalBidders) return; // Skip if all reveal

            // Create auction
            await auction.connect(seller).createSealedBidAuction(
              ethers.parseEther("0.1"),
              3600,
              1800,
              "Unrevealed Test",
              "Description",
              ""
            );

            const auctionId = await auction.nextAuctionId() - 1n;
            const signers = await ethers.getSigners();
            const bidders = signers.slice(3, 3 + totalBidders);

            // Commit all bids (unrevealed have higher amounts)
            for (let i = 0; i < totalBidders; i++) {
              const amount = ethers.parseEther((totalBidders - i).toString()); // Descending amounts
              const secret = ethers.encodeBytes32String(`secret${i}`);
              const commitment = ethers.keccak256(
                ethers.solidityPacked(["uint256", "bytes32"], [amount, secret])
              );
              await auction.connect(bidders[i]).commitBid(auctionId, commitment);
            }

            await auction.connect(handler).transitionToReveal(auctionId);

            // Only reveal first numRevealed bids
            for (let i = 0; i < numRevealed; i++) {
              const amount = ethers.parseEther((totalBidders - i).toString());
              const secret = ethers.encodeBytes32String(`secret${i}`);
              await auction.connect(bidders[i]).revealBid(auctionId, amount, secret, {
                value: amount
              });
            }

            // Settle
            await auction.connect(handler).settleSealedAuction(auctionId);

            // Winner must be one of the revealed bidders
            const auctionData = await auction.auctions(auctionId);
            if (numRevealed > 0) {
              const revealedAddresses = bidders.slice(0, numRevealed).map(b => b.address);
              expect(revealedAddresses).to.include(auctionData.highestBidder);
            } else {
              // No reveals = no winner
              expect(auctionData.highestBidder).to.equal(ethers.ZeroAddress);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe("Requirements Validation", function () {
    it("Validates Requirement 1.4: Handler emits Schedule_Event for reveal deadline", async function () {
      // Note: This test validates the contract side - handler scheduling is tested in handler tests
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Requirement Test",
        "Description",
        ""
      );

      const auctionId = 0n;

      // Verify auction has reveal deadline set
      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.revealDeadline).to.be.gt(auctionData.endTime);
      expect(auctionData.revealDeadline).to.equal(auctionData.endTime + 1800n);
    });

    it("Validates Requirement 1.5: Handler determines winner from valid reveals", async function () {
      // Create auction with multiple bids
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Winner Test",
        "Description",
        ""
      );

      const auctionId = 0n;

      // Commit three bids
      const amounts = [
        ethers.parseEther("2.0"),
        ethers.parseEther("3.5"), // Highest
        ethers.parseEther("2.8")
      ];

      const bidders = [bidder1, bidder2, bidder3];

      for (let i = 0; i < 3; i++) {
        const secret = ethers.encodeBytes32String(`secret${i}`);
        const commitment = ethers.keccak256(
          ethers.solidityPacked(["uint256", "bytes32"], [amounts[i], secret])
        );
        await auction.connect(bidders[i]).commitBid(auctionId, commitment);
      }

      await auction.connect(handler).transitionToReveal(auctionId);

      // Reveal all
      for (let i = 0; i < 3; i++) {
        const secret = ethers.encodeBytes32String(`secret${i}`);
        await auction.connect(bidders[i]).revealBid(auctionId, amounts[i], secret, {
          value: amounts[i]
        });
      }

      // Settle and verify winner is bidder2 (highest bid)
      await auction.connect(handler).settleSealedAuction(auctionId);

      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.highestBidder).to.equal(bidder2.address);
      expect(auctionData.currentBid).to.equal(amounts[1]);
    });

    it("Validates Requirement 1.7: Refund all non-winning revealed bids", async function () {
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Refund Test",
        "Description",
        ""
      );

      const auctionId = 0n;

      const amount1 = ethers.parseEther("2.0");
      const amount2 = ethers.parseEther("3.0");
      const amount3 = ethers.parseEther("2.5");

      // Commit and reveal
      const secret1 = ethers.encodeBytes32String("secret1");
      const secret2 = ethers.encodeBytes32String("secret2");
      const secret3 = ethers.encodeBytes32String("secret3");

      const commitment1 = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount1, secret1])
      );
      const commitment2 = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount2, secret2])
      );
      const commitment3 = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount3, secret3])
      );

      await auction.connect(bidder1).commitBid(auctionId, commitment1);
      await auction.connect(bidder2).commitBid(auctionId, commitment2);
      await auction.connect(bidder3).commitBid(auctionId, commitment3);

      await auction.connect(handler).transitionToReveal(auctionId);

      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });
      await auction.connect(bidder2).revealBid(auctionId, amount2, secret2, { value: amount2 });
      await auction.connect(bidder3).revealBid(auctionId, amount3, secret3, { value: amount3 });

      // Record balances
      const balance1Before = await ethers.provider.getBalance(bidder1.address);
      const balance3Before = await ethers.provider.getBalance(bidder3.address);

      // Settle
      await auction.connect(handler).settleSealedAuction(auctionId);

      // Verify refunds for non-winners
      const balance1After = await ethers.provider.getBalance(bidder1.address);
      const balance3After = await ethers.provider.getBalance(bidder3.address);

      expect(balance1After).to.equal(balance1Before + amount1);
      expect(balance3After).to.equal(balance3Before + amount3);
    });
  });
});
