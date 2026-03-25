import { expect } from "chai";
import { ethers } from "hardhat";
import { ReactiveAuction } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import fc from "fast-check";

describe("ReactiveAuction - Task 2.2: commitBid", function () {
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
  });

  describe("Unit Tests", function () {
    it("should accept auction ID and commitment hash", async function () {
      // Create a sealed-bid auction
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600, // 1 hour bidding
        1800, // 30 min reveal
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;
      const amount = ethers.parseEther("2.0");
      const secret = ethers.encodeBytes32String("my-secret");
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount, secret])
      );

      // Commit bid
      await expect(
        auction.connect(bidder1).commitBid(auctionId, commitment)
      ).to.not.be.reverted;
    });

    it("should validate auction is in BIDDING phase", async function () {
      // Create a sealed-bid auction
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));

      // Should work in BIDDING phase
      await expect(
        auction.connect(bidder1).commitBid(auctionId, commitment)
      ).to.not.be.reverted;

      // Verify it's in BIDDING phase
      const auctionData = await auction.auctions(auctionId);
      expect(auctionData.phase).to.equal(0); // BIDDING = 0
    });

    it("should reject commitment for non-sealed-bid auction", async function () {
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
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));

      await expect(
        auction.connect(bidder1).commitBid(auctionId, commitment)
      ).to.be.revertedWith("Not a sealed-bid auction");
    });

    it("should store commitment with timestamp", async function () {
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
      const amount = ethers.parseEther("2.0");
      const secret = ethers.encodeBytes32String("my-secret");
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount, secret])
      );

      const blockBefore = await ethers.provider.getBlock("latest");
      const expectedTimestamp = blockBefore!.timestamp + 1;

      // Commit bid
      await auction.connect(bidder1).commitBid(auctionId, commitment);

      // Verify storage
      const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
      expect(sealedBid.bidder).to.equal(bidder1.address);
      expect(sealedBid.commitment).to.equal(commitment);
      expect(sealedBid.revealedAmount).to.equal(0n);
      expect(sealedBid.revealed).to.equal(false);
      expect(sealedBid.timestamp).to.be.closeTo(BigInt(expectedTimestamp), 5n);
    });

    it("should emit SealedBidCommitted event", async function () {
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
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));

      // Commit bid and check event
      await expect(
        auction.connect(bidder1).commitBid(auctionId, commitment)
      )
        .to.emit(auction, "SealedBidCommitted")
        .withArgs(
          auctionId,
          bidder1.address,
          commitment,
          (timestamp: any) => true // Any timestamp is acceptable
        );
    });

    it("should reject commitment after bidding phase ends", async function () {
      // Create auction with very short duration
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        60, // 60 seconds
        60,
        "Test Auction",
        "Description",
        ""
      );

      const auctionId = 0n;
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));

      // Fast forward time past bidding phase
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        auction.connect(bidder1).commitBid(auctionId, commitment)
      ).to.be.revertedWith("Bidding phase ended");
    });

    it("should reject seller from bidding on own auction", async function () {
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
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));

      await expect(
        auction.connect(seller).commitBid(auctionId, commitment)
      ).to.be.revertedWith("Seller cannot bid");
    });

    it("should reject duplicate commitment from same bidder", async function () {
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
      const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("test1"));
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("test2"));

      // First commitment should succeed
      await auction.connect(bidder1).commitBid(auctionId, commitment1);

      // Second commitment should fail
      await expect(
        auction.connect(bidder1).commitBid(auctionId, commitment2)
      ).to.be.revertedWith("Already committed");
    });

    it("should allow multiple bidders to commit", async function () {
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
      
      // Three different bidders commit
      const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("bidder1-secret"));
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("bidder2-secret"));
      const commitment3 = ethers.keccak256(ethers.toUtf8Bytes("bidder3-secret"));

      await auction.connect(bidder1).commitBid(auctionId, commitment1);
      await auction.connect(bidder2).commitBid(auctionId, commitment2);
      await auction.connect(bidder3).commitBid(auctionId, commitment3);

      // Verify all commitments stored
      const bid1 = await auction.sealedBids(auctionId, bidder1.address);
      const bid2 = await auction.sealedBids(auctionId, bidder2.address);
      const bid3 = await auction.sealedBids(auctionId, bidder3.address);

      expect(bid1.commitment).to.equal(commitment1);
      expect(bid2.commitment).to.equal(commitment2);
      expect(bid3.commitment).to.equal(commitment3);
    });

    it("should add bidder to sealedBidders array", async function () {
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
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));

      await auction.connect(bidder1).commitBid(auctionId, commitment);

      // Check bidder was added to array
      const bidders = await auction.getSealedBidders(auctionId);
      expect(bidders.length).to.equal(1);
      expect(bidders[0]).to.equal(bidder1.address);
    });

    it("should reject commitment when system is paused", async function () {
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
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));

      // Pause system
      await auction.connect(owner).pauseSystem();

      await expect(
        auction.connect(bidder1).commitBid(auctionId, commitment)
      ).to.be.revertedWith("System is paused");
    });
  });

  describe("Property-Based Tests", function () {
    it("Property: Valid commitments should always be accepted during bidding phase", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: 1n, max: ethers.parseEther("100") }),
          fc.string({ minLength: 1, maxLength: 32 }),
          async (amount, secretStr) => {
            // Create fresh auction for each test
            await auction.connect(seller).createSealedBidAuction(
              ethers.parseEther("1.0"),
              3600,
              1800,
              "Property Test",
              "Description",
              ""
            );

            const auctionId = await auction.nextAuctionId() - 1n;
            const secret = ethers.encodeBytes32String(secretStr);
            const commitment = ethers.keccak256(
              ethers.solidityPacked(["uint256", "bytes32"], [amount, secret])
            );

            // Should not revert
            await expect(
              auction.connect(bidder1).commitBid(auctionId, commitment)
            ).to.not.be.reverted;

            // Verify commitment stored
            const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
            expect(sealedBid.commitment).to.equal(commitment);
            expect(sealedBid.revealed).to.equal(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    it("Property: Commitment hash should be stored exactly as provided", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 32, maxLength: 32 }),
          async (randomBytes) => {
            // Create auction
            await auction.connect(seller).createSealedBidAuction(
              ethers.parseEther("1.0"),
              3600,
              1800,
              "Hash Test",
              "Description",
              ""
            );

            const auctionId = await auction.nextAuctionId() - 1n;
            const commitment = ethers.hexlify(randomBytes);

            await auction.connect(bidder1).commitBid(auctionId, commitment);

            // Verify exact hash stored
            const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
            expect(sealedBid.commitment).to.equal(commitment);
          }
        ),
        { numRuns: 20 }
      );
    });

    it("Property: Multiple bidders should be able to commit independently", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 32 }), { minLength: 2, maxLength: 5 }),
          async (secrets) => {
            // Create auction
            await auction.connect(seller).createSealedBidAuction(
              ethers.parseEther("1.0"),
              3600,
              1800,
              "Multi-bidder Test",
              "Description",
              ""
            );

            const auctionId = await auction.nextAuctionId() - 1n;
            const signers = await ethers.getSigners();
            const bidders = signers.slice(2, 2 + secrets.length); // Skip owner and seller

            // Each bidder commits
            for (let i = 0; i < secrets.length; i++) {
              const secret = ethers.encodeBytes32String(secrets[i]);
              const amount = ethers.parseEther((i + 1).toString());
              const commitment = ethers.keccak256(
                ethers.solidityPacked(["uint256", "bytes32"], [amount, secret])
              );

              await auction.connect(bidders[i]).commitBid(auctionId, commitment);
            }

            // Verify all commitments stored
            const storedBidders = await auction.getSealedBidders(auctionId);
            expect(storedBidders.length).to.equal(secrets.length);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe("Requirement 1.2 Validation", function () {
    it("Validates Requirement 1.2: Store only cryptographic commitment hash", async function () {
      // Create auction
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Requirement Test",
        "Description",
        ""
      );

      const auctionId = 0n;
      const amount = ethers.parseEther("5.0");
      const secret = ethers.encodeBytes32String("super-secret");
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount, secret])
      );

      // Commit bid
      await auction.connect(bidder1).commitBid(auctionId, commitment);

      // Verify ONLY the commitment hash is stored, not the amount or secret
      const sealedBid = await auction.sealedBids(auctionId, bidder1.address);
      
      expect(sealedBid.commitment).to.equal(commitment);
      expect(sealedBid.revealedAmount).to.equal(0n); // Amount not stored yet
      expect(sealedBid.revealed).to.equal(false); // Not revealed yet
      
      // The actual amount and secret should not be recoverable from storage
      // Only the cryptographic hash is stored
    });
  });
});
