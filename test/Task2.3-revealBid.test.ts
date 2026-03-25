import { expect } from "chai";
import { ethers } from "hardhat";
import { ReactiveAuction } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import fc from "fast-check";

describe("ReactiveAuction - Task 2.3: revealBid", function () {
  let auction: ReactiveAuction;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let bidder3: SignerWithAddress;

  beforeEach(async function () {
    [owner, seller, bidder1, bidder2, bidder3] = await ethers.getSigners();
    
    const ReactiveAuctionFactory = await ethers.getContractFactory("ReactiveAuction");
    auction = await ReactiveAuctionFactory.deploy();
    await auction.waitForDeployment();
    
    // Set owner as handler for testing purposes
    await auction.connect(owner).setHandler(owner.address);
  });

  async function createAndCommitBid(
    bidder: SignerWithAddress,
    amount: bigint,
    secret: string
  ): Promise<{ auctionId: bigint; commitment: string; secretBytes: string }> {
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
    const secretBytes = ethers.encodeBytes32String(secret);
    const commitment = ethers.keccak256(
      ethers.solidityPacked(["uint256", "bytes32"], [amount, secretBytes])
    );

    // Commit bid
    await auction.connect(bidder).commitBid(auctionId, commitment);

    return { auctionId, commitment, secretBytes };
  }

  async function transitionToRevealPhase(auctionId: bigint) {
    // Fast forward past bidding phase
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);

    // Transition to reveal phase (owner is set as handler in beforeEach)
    await auction.connect(owner).transitionToReveal(auctionId);
  }

  describe("Unit Tests", function () {
    it("should accept auction ID, amount, and secret", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount })
      ).to.not.be.reverted;
    });

    it("should validate auction is in REVEAL phase", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      // Try to reveal while still in BIDDING phase
      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount })
      ).to.be.revertedWith("Not in reveal phase");

      // Transition to reveal phase
      await transitionToRevealPhase(auctionId);

      // Now it should work
      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount })
      ).to.not.be.reverted;
    });

    it("should verify commitment matches keccak256(abi.encodePacked(amount, secret))", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      // Valid reveal
      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount })
      ).to.not.be.reverted;

      // Verify bid was revealed
      const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
      expect(sealedBid.revealed).to.equal(true);
      expect(sealedBid.revealedAmount).to.equal(amount);
    });

    it("should store revealed amount if valid", async function () {
      const amount = ethers.parseEther("3.5");
      const secret = "test-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      await auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount });

      const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
      expect(sealedBid.revealedAmount).to.equal(amount);
      expect(sealedBid.revealed).to.equal(true);
    });

    it("should handle invalid reveals with reputation penalty", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      // Get initial reputation
      const initialReputation = await auction.userReputation(bidder1.address);

      // Try to reveal with wrong amount
      const wrongAmount = ethers.parseEther("3.0");
      await auction.connect(bidder1).revealBid(auctionId, wrongAmount, secretBytes, { value: wrongAmount });

      // Check reputation was penalized
      const finalReputation = await auction.userReputation(bidder1.address);
      expect(finalReputation.failedReveals).to.equal(initialReputation.failedReveals + 1n);

      // Verify bid was NOT revealed
      const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
      expect(sealedBid.revealed).to.equal(false);
    });

    it("should emit SealedBidRevealed event on valid reveal", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount })
      )
        .to.emit(auction, "SealedBidRevealed")
        .withArgs(auctionId, bidder1.address, amount, (timestamp: any) => true);
    });

    it("should emit RevealFailed event on invalid commitment", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      const wrongAmount = ethers.parseEther("3.0");
      await expect(
        auction.connect(bidder1).revealBid(auctionId, wrongAmount, secretBytes, { value: wrongAmount })
      )
        .to.emit(auction, "RevealFailed")
        .withArgs(auctionId, bidder1.address, "Invalid commitment");
    });

    it("should reject reveal with wrong secret", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      const wrongSecret = ethers.encodeBytes32String("wrong-secret");
      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, wrongSecret, { value: amount })
      )
        .to.emit(auction, "RevealFailed")
        .withArgs(auctionId, bidder1.address, "Invalid commitment");
    });

    it("should reject reveal with insufficient funds", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      const insufficientAmount = ethers.parseEther("1.5");
      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: insufficientAmount })
      )
        .to.emit(auction, "RevealFailed")
        .withArgs(auctionId, bidder1.address, "Insufficient funds");
    });

    it("should refund excess funds when msg.value > amount", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      const excessAmount = ethers.parseEther("3.0");
      const balanceBefore = await ethers.provider.getBalance(bidder1.address);

      const tx = await auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: excessAmount });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(bidder1.address);

      // Should have spent only the bid amount + gas, excess refunded
      const expectedBalance = balanceBefore - amount - gasUsed;
      expect(balanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
    });

    it("should reject reveal after deadline", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      // Fast forward past reveal deadline
      await ethers.provider.send("evm_increaseTime", [1801]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount })
      ).to.be.revertedWith("Reveal deadline passed");
    });

    it("should reject reveal without prior commitment", async function () {
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;
      await transitionToRevealPhase(auctionId);

      const amount = ethers.parseEther("2.0");
      const secret = ethers.encodeBytes32String("my-secret");

      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secret, { value: amount })
      ).to.be.revertedWith("No commitment found");
    });

    it("should reject double reveal", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      // First reveal should succeed
      await auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount });

      // Second reveal should fail
      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount })
      ).to.be.revertedWith("Already revealed");
    });

    it("should reject reveal for non-sealed-bid auction", async function () {
      // Create a Dutch auction instead
      await auction.connect(seller).createDutchAuction(
        ethers.parseEther("10.0"),
        ethers.parseEther("1.0"),
        3600,
        "Dutch Auction",
        "Description",
        ""
      );

      const auctionId = 0n;
      const amount = ethers.parseEther("2.0");
      const secret = ethers.encodeBytes32String("my-secret");

      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secret, { value: amount })
      ).to.be.revertedWith("Not a sealed-bid auction");
    });

    it("should allow multiple bidders to reveal independently", async function () {
      // Create auction
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Multi-bidder Test",
        "Description",
        ""
      );

      const auctionId = 0n;

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

      await transitionToRevealPhase(auctionId);

      // All three reveal
      await auction.connect(bidder1).revealBid(auctionId, amount1, secret1, { value: amount1 });
      await auction.connect(bidder2).revealBid(auctionId, amount2, secret2, { value: amount2 });
      await auction.connect(bidder3).revealBid(auctionId, amount3, secret3, { value: amount3 });

      // Verify all revealed
      const bid1 = await auction.sealedBids(auctionId, bidder1.address);
      const bid2 = await auction.sealedBids(auctionId, bidder2.address);
      const bid3 = await auction.sealedBids(auctionId, bidder3.address);

      expect(bid1.revealed).to.equal(true);
      expect(bid1.revealedAmount).to.equal(amount1);
      expect(bid2.revealed).to.equal(true);
      expect(bid2.revealedAmount).to.equal(amount2);
      expect(bid3.revealed).to.equal(true);
      expect(bid3.revealedAmount).to.equal(amount3);
    });
  });

  describe("Property-Based Tests", function () {
    it("Property: Valid reveals should always succeed", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: ethers.parseEther("0.1"), max: ethers.parseEther("10") }),
          fc.string({ minLength: 1, maxLength: 31 }),
          async (amount, secretStr) => {
            const secret = ethers.encodeBytes32String(secretStr);
            const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secretStr);

            await transitionToRevealPhase(auctionId);

            // Should not revert
            await expect(
              auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount })
            ).to.not.be.reverted;

            // Verify revealed
            const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
            expect(sealedBid.revealed).to.equal(true);
            expect(sealedBid.revealedAmount).to.equal(amount);
          }
        ),
        { numRuns: 20 }
      );
    });

    it("Property: Invalid commitment should always fail and penalize reputation", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: ethers.parseEther("0.1"), max: ethers.parseEther("10") }),
          fc.string({ minLength: 1, maxLength: 31 }),
          fc.bigInt({ min: ethers.parseEther("0.1"), max: ethers.parseEther("10") }),
          async (amount, secretStr, wrongAmount) => {
            fc.pre(amount !== wrongAmount); // Ensure amounts are different

            const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secretStr);
            await transitionToRevealPhase(auctionId);

            const initialReputation = await auction.userReputation(bidder1.address);

            // Reveal with wrong amount
            await auction.connect(bidder1).revealBid(auctionId, wrongAmount, secretBytes, { value: wrongAmount });

            // Check reputation penalized
            const finalReputation = await auction.userReputation(bidder1.address);
            expect(finalReputation.failedReveals).to.equal(initialReputation.failedReveals + 1n);

            // Verify NOT revealed
            const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
            expect(sealedBid.revealed).to.equal(false);
          }
        ),
        { numRuns: 15 }
      );
    });

    it("Property: Excess funds should always be refunded", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: ethers.parseEther("0.1"), max: ethers.parseEther("5") }),
          fc.bigInt({ min: ethers.parseEther("0.1"), max: ethers.parseEther("5") }),
          fc.string({ minLength: 1, maxLength: 31 }),
          async (amount, excess, secretStr) => {
            fc.pre(excess > 0n); // Ensure there's excess

            const totalSent = amount + excess;
            const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secretStr);
            await transitionToRevealPhase(auctionId);

            const balanceBefore = await ethers.provider.getBalance(bidder1.address);

            const tx = await auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: totalSent });
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const balanceAfter = await ethers.provider.getBalance(bidder1.address);

            // Should have spent only the bid amount + gas
            const expectedBalance = balanceBefore - amount - gasUsed;
            expect(balanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  describe("Requirement Validation", function () {
    it("Validates Requirements 1.3: Verify commitment matches keccak256(abi.encodePacked(amount, secret))", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      // Valid reveal with correct commitment
      await expect(
        auction.connect(bidder1).revealBid(auctionId, amount, secretBytes, { value: amount })
      ).to.not.be.reverted;

      // Verify revealed
      const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
      expect(sealedBid.revealed).to.equal(true);
      expect(sealedBid.revealedAmount).to.equal(amount);
    });

    it("Validates Requirements 1.6: Reject reveal attempts that do not match commitment", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      // Try with wrong amount
      const wrongAmount = ethers.parseEther("3.0");
      await expect(
        auction.connect(bidder1).revealBid(auctionId, wrongAmount, secretBytes, { value: wrongAmount })
      )
        .to.emit(auction, "RevealFailed")
        .withArgs(auctionId, bidder1.address, "Invalid commitment");

      // Verify NOT revealed
      const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
      expect(sealedBid.revealed).to.equal(false);
    });

    it("Validates Requirements 7.4: Penalize reputation for failed reveals", async function () {
      const amount = ethers.parseEther("2.0");
      const secret = "my-secret";
      const { auctionId, secretBytes } = await createAndCommitBid(bidder1, amount, secret);

      await transitionToRevealPhase(auctionId);

      const initialReputation = await auction.userReputation(bidder1.address);
      const initialFailedReveals = initialReputation.failedReveals;

      // Invalid reveal
      const wrongAmount = ethers.parseEther("3.0");
      await auction.connect(bidder1).revealBid(auctionId, wrongAmount, secretBytes, { value: wrongAmount });

      // Check reputation was penalized
      const finalReputation = await auction.userReputation(bidder1.address);
      expect(finalReputation.failedReveals).to.equal(initialFailedReveals + 1n);
    });
  });
});
