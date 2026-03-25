import { expect } from "chai";
import { ethers } from "hardhat";
import { ReactiveAuction } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import fc from "fast-check";

describe("ReactiveAuction - Task 2.1: createSealedBidAuction", function () {
  let auction: ReactiveAuction;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let bidder1: SignerWithAddress;

  beforeEach(async function () {
    [owner, seller, bidder1] = await ethers.getSigners();
    
    const ReactiveAuctionFactory = await ethers.getContractFactory("ReactiveAuction");
    auction = await ReactiveAuctionFactory.deploy();
    await auction.waitForDeployment();
  });

  describe("Unit Tests", function () {
    it("should create a sealed-bid auction with correct parameters", async function () {
      const startPrice = ethers.parseEther("1.0");
      const biddingDuration = 3600; // 1 hour
      const revealDuration = 1800; // 30 minutes
      const title = "Test Sealed Auction";
      const description = "A test sealed-bid auction";
      const imageUrl = "https://example.com/image.png";

      const tx = await auction.connect(seller).createSealedBidAuction(
        startPrice,
        biddingDuration,
        revealDuration,
        title,
        description,
        imageUrl
      );

      const receipt = await tx.wait();
      const auctionId = 0n; // First auction

      // Verify auction was created
      const auctionData = await auction.auctions(auctionId);
      
      expect(auctionData.id).to.equal(auctionId);
      expect(auctionData.seller).to.equal(seller.address);
      expect(auctionData.auctionType).to.equal(2); // SEALED_BID = 2
      expect(auctionData.phase).to.equal(0); // BIDDING = 0
      expect(auctionData.startPrice).to.equal(startPrice);
      expect(auctionData.title).to.equal(title);
      expect(auctionData.description).to.equal(description);
      expect(auctionData.imageUrl).to.equal(imageUrl);
    });

    it("should initialize auction in BIDDING phase", async function () {
      const startPrice = ethers.parseEther("1.0");
      const biddingDuration = 3600;
      const revealDuration = 1800;

      await auction.connect(seller).createSealedBidAuction(
        startPrice,
        biddingDuration,
        revealDuration,
        "Test",
        "Description",
        ""
      );

      const auctionData = await auction.auctions(0);
      expect(auctionData.phase).to.equal(0); // BIDDING phase
    });

    it("should store auction configuration correctly", async function () {
      const startPrice = ethers.parseEther("2.5");
      const biddingDuration = 7200; // 2 hours
      const revealDuration = 3600; // 1 hour

      const blockBefore = await ethers.provider.getBlock("latest");
      const startTime = blockBefore!.timestamp + 1;

      await auction.connect(seller).createSealedBidAuction(
        startPrice,
        biddingDuration,
        revealDuration,
        "Config Test",
        "Testing configuration",
        "https://example.com/img.jpg"
      );

      const auctionData = await auction.auctions(0);
      
      // Verify timing configuration
      expect(auctionData.startTime).to.be.closeTo(BigInt(startTime), 5n);
      expect(auctionData.endTime).to.be.closeTo(BigInt(startTime + biddingDuration), 5n);
      expect(auctionData.revealDeadline).to.be.closeTo(
        BigInt(startTime + biddingDuration + revealDuration),
        5n
      );
    });

    it("should emit AuctionCreated event", async function () {
      const startPrice = ethers.parseEther("1.0");
      const biddingDuration = 3600;
      const revealDuration = 1800;
      const title = "Event Test Auction";

      await expect(
        auction.connect(seller).createSealedBidAuction(
          startPrice,
          biddingDuration,
          revealDuration,
          title,
          "Description",
          ""
        )
      )
        .to.emit(auction, "AuctionCreated")
        .withArgs(
          0n, // auctionId
          seller.address,
          2, // SEALED_BID type
          startPrice,
          0n, // endPrice (not used for sealed-bid)
          (value: any) => true, // startTime (any value)
          (value: any) => true, // endTime (any value)
          title
        );
    });

    it("should reject auction with zero start price", async function () {
      await expect(
        auction.connect(seller).createSealedBidAuction(
          0,
          3600,
          1800,
          "Invalid",
          "Zero price",
          ""
        )
      ).to.be.revertedWith("Start price must be > 0");
    });

    it("should reject auction with bidding duration < 60 seconds", async function () {
      await expect(
        auction.connect(seller).createSealedBidAuction(
          ethers.parseEther("1.0"),
          59, // Less than 60 seconds
          1800,
          "Invalid",
          "Short duration",
          ""
        )
      ).to.be.revertedWith("Min bidding duration 60s");
    });

    it("should reject auction with reveal duration < 60 seconds", async function () {
      await expect(
        auction.connect(seller).createSealedBidAuction(
          ethers.parseEther("1.0"),
          3600,
          59, // Less than 60 seconds
          "Invalid",
          "Short reveal",
          ""
        )
      ).to.be.revertedWith("Min reveal duration 60s");
    });

    it("should add auction to activeAuctionIds", async function () {
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "Active Test",
        "Description",
        ""
      );

      const activeId = await auction.activeAuctionIds(0);
      expect(activeId).to.equal(0n);
    });

    it("should increment nextAuctionId", async function () {
      const initialId = await auction.nextAuctionId();
      
      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("1.0"),
        3600,
        1800,
        "First",
        "Description",
        ""
      );

      const afterFirstId = await auction.nextAuctionId();
      expect(afterFirstId).to.equal(initialId + 1n);

      await auction.connect(seller).createSealedBidAuction(
        ethers.parseEther("2.0"),
        3600,
        1800,
        "Second",
        "Description",
        ""
      );

      const afterSecondId = await auction.nextAuctionId();
      expect(afterSecondId).to.equal(initialId + 2n);
    });
  });

  describe("Property-Based Tests", function () {
    it("Property: All valid sealed-bid auctions should be created successfully", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: 1n, max: 1000000000000000000n }), // startPrice (0.000000001 to 1 ETH)
          fc.integer({ min: 60, max: 604800 }), // biddingDuration (60s to 7 days)
          fc.integer({ min: 60, max: 604800 }), // revealDuration (60s to 7 days)
          fc.string({ minLength: 1, maxLength: 100 }), // title
          fc.string({ minLength: 0, maxLength: 500 }), // description
          async (startPrice, biddingDuration, revealDuration, title, description) => {
            const tx = await auction.connect(seller).createSealedBidAuction(
              startPrice,
              biddingDuration,
              revealDuration,
              title,
              description,
              ""
            );

            await tx.wait();
            
            // Verify auction was created
            const auctionId = await auction.nextAuctionId() - 1n;
            const auctionData = await auction.auctions(auctionId);
            
            expect(auctionData.seller).to.equal(seller.address);
            expect(auctionData.auctionType).to.equal(2); // SEALED_BID
            expect(auctionData.phase).to.equal(0); // BIDDING
            expect(auctionData.startPrice).to.equal(startPrice);
          }
        ),
        { numRuns: 20 } // Run 20 iterations for faster execution
      );
    });

    it("Property: Auction timing should be consistent with input parameters", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 60, max: 86400 }), // biddingDuration (60s to 1 day)
          fc.integer({ min: 60, max: 86400 }), // revealDuration (60s to 1 day)
          async (biddingDuration, revealDuration) => {
            const blockBefore = await ethers.provider.getBlock("latest");
            const expectedStartTime = blockBefore!.timestamp + 1;

            await auction.connect(seller).createSealedBidAuction(
              ethers.parseEther("1.0"),
              biddingDuration,
              revealDuration,
              "Timing Test",
              "Description",
              ""
            );

            const auctionId = await auction.nextAuctionId() - 1n;
            const auctionData = await auction.auctions(auctionId);
            
            // Allow small tolerance for block timestamp variations
            const tolerance = 10n;
            
            expect(auctionData.startTime).to.be.closeTo(BigInt(expectedStartTime), tolerance);
            expect(auctionData.endTime).to.be.closeTo(
              BigInt(expectedStartTime + biddingDuration),
              tolerance
            );
            expect(auctionData.revealDeadline).to.be.closeTo(
              BigInt(expectedStartTime + biddingDuration + revealDuration),
              tolerance
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it("Property: Invalid parameters should always be rejected", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 59 }), // Invalid bidding duration
          fc.integer({ min: 0, max: 59 }), // Invalid reveal duration
          async (invalidBidDuration, invalidRevealDuration) => {
            // Test zero price
            await expect(
              auction.connect(seller).createSealedBidAuction(
                0n,
                3600,
                1800,
                "Invalid",
                "Test",
                ""
              )
            ).to.be.revertedWith("Start price must be > 0");

            // Test invalid bidding duration
            await expect(
              auction.connect(seller).createSealedBidAuction(
                ethers.parseEther("1.0"),
                invalidBidDuration,
                1800,
                "Invalid",
                "Test",
                ""
              )
            ).to.be.revertedWith("Min bidding duration 60s");

            // Test invalid reveal duration
            await expect(
              auction.connect(seller).createSealedBidAuction(
                ethers.parseEther("1.0"),
                3600,
                invalidRevealDuration,
                "Invalid",
                "Test",
                ""
              )
            ).to.be.revertedWith("Min reveal duration 60s");
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
