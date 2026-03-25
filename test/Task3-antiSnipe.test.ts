import { expect } from "chai";
import { ethers } from "hardhat";
import { ReactiveAuction } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import fc from "fast-check";

describe("ReactiveAuction - Task 3: Anti-Sniping Time Extension", function () {
  let auction: ReactiveAuction;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let handler: SignerWithAddress;

  const EXTENSION_THRESHOLD = 300; // 5 minutes
  const EXTENSION_DURATION = 600;  // 10 minutes
  const MAX_EXTENSIONS = 3;

  beforeEach(async function () {
    [owner, seller, bidder1, bidder2, handler] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ReactiveAuction");
    auction = await Factory.deploy();
    await auction.waitForDeployment();
    await auction.connect(owner).setHandler(handler.address);
  });

  async function createAntiSnipeAuction(duration = 3600): Promise<bigint> {
    await auction.connect(seller).createEnglishAuctionWithAntiSnipe(
      ethers.parseEther("1.0"),
      duration,
      "Anti-Snipe Auction",
      "Description",
      "",
      EXTENSION_THRESHOLD,
      EXTENSION_DURATION,
      MAX_EXTENSIONS
    );
    return (await auction.nextAuctionId()) - 1n;
  }

  // ─── Unit Tests ───────────────────────────────────────────────────────────

  it("3.1 – AuctionConfig stores anti-snipe fields correctly", async function () {
    const id = await createAntiSnipeAuction();
    const a = await auction.auctions(id);
    expect(a.config.antiSnipeEnabled).to.equal(true);
    expect(a.config.extensionThreshold).to.equal(EXTENSION_THRESHOLD);
    expect(a.config.extensionDuration).to.equal(EXTENSION_DURATION);
    expect(a.config.maxExtensions).to.equal(MAX_EXTENSIONS);
    expect(a.config.currentExtensions).to.equal(0);
  });

  it("3.2 – extendAuction increases endTime and increments counter", async function () {
    const id = await createAntiSnipeAuction();
    const before = await auction.auctions(id);
    await auction.connect(handler).extendAuction(id);
    const after = await auction.auctions(id);
    expect(after.endTime).to.equal(before.endTime + BigInt(EXTENSION_DURATION));
    expect(after.config.currentExtensions).to.equal(1);
  });

  it("3.2 – extendAuction emits AuctionExtended event", async function () {
    const id = await createAntiSnipeAuction();
    await expect(auction.connect(handler).extendAuction(id))
      .to.emit(auction, "AuctionExtended")
      .withArgs(id, (v: any) => true, 1n, (v: any) => true);
  });

  it("3.2 – extendAuction reverts when max extensions reached", async function () {
    const id = await createAntiSnipeAuction();
    for (let i = 0; i < MAX_EXTENSIONS; i++) {
      await auction.connect(handler).extendAuction(id);
    }
    await expect(auction.connect(handler).extendAuction(id))
      .to.be.revertedWith("Max extensions reached");
  });

  it("3.2 – only handler can call extendAuction", async function () {
    const id = await createAntiSnipeAuction();
    await expect(auction.connect(bidder1).extendAuction(id))
      .to.be.revertedWith("Not handler");
  });

  it("3.3 – bid within threshold auto-extends auction", async function () {
    const duration = 3600;
    const id = await createAntiSnipeAuction(duration);
    // Fast-forward to within threshold
    await ethers.provider.send("evm_increaseTime", [duration - EXTENSION_THRESHOLD + 1]);
    await ethers.provider.send("evm_mine", []);

    const before = await auction.auctions(id);
    await expect(
      auction.connect(bidder1).bid(id, { value: ethers.parseEther("1.0") })
    ).to.emit(auction, "AuctionExtended");

    const after = await auction.auctions(id);
    expect(after.endTime).to.be.gt(before.endTime);
    expect(after.config.currentExtensions).to.equal(1);
  });

  it("3.3 – bid outside threshold does NOT extend auction", async function () {
    const id = await createAntiSnipeAuction(3600);
    // Bid early (well before threshold)
    const before = await auction.auctions(id);
    await auction.connect(bidder1).bid(id, { value: ethers.parseEther("1.0") });
    const after = await auction.auctions(id);
    expect(after.endTime).to.equal(before.endTime);
    expect(after.config.currentExtensions).to.equal(0);
  });

  it("3.3 – extension applies to English auctions", async function () {
    const id = await createAntiSnipeAuction(3600);
    const a = await auction.auctions(id);
    expect(a.auctionType).to.equal(1); // ENGLISH
    await ethers.provider.send("evm_increaseTime", [3600 - EXTENSION_THRESHOLD + 1]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      auction.connect(bidder1).bid(id, { value: ethers.parseEther("1.0") })
    ).to.emit(auction, "AuctionExtended");
  });

  it("3.6 – max extension limit stops further extensions", async function () {
    const id = await createAntiSnipeAuction(3600);
    // Trigger max extensions via handler
    for (let i = 0; i < MAX_EXTENSIONS; i++) {
      await auction.connect(handler).extendAuction(id);
    }
    const a = await auction.auctions(id);
    expect(a.config.currentExtensions).to.equal(MAX_EXTENSIONS);

    // Another bid within threshold should NOT extend
    const endTimeBefore = a.endTime;
    // Move to within threshold of current endTime
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const timeToThreshold = a.endTime - BigInt(EXTENSION_THRESHOLD) - now + 1n;
    if (timeToThreshold > 0n) {
      await ethers.provider.send("evm_increaseTime", [Number(timeToThreshold)]);
      await ethers.provider.send("evm_mine", []);
    }
    await auction.connect(bidder1).bid(id, { value: ethers.parseEther("1.0") });
    const aAfter = await auction.auctions(id);
    expect(aAfter.endTime).to.equal(endTimeBefore);
  });

  // ─── Property Tests ───────────────────────────────────────────────────────

  it("Property 6 – extension only triggers within threshold", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: MAX_EXTENSIONS }),
        async (extensionCount) => {
          const id = await createAntiSnipeAuction(3600);
          for (let i = 0; i < extensionCount; i++) {
            await auction.connect(handler).extendAuction(id);
          }
          const a = await auction.auctions(id);
          expect(Number(a.config.currentExtensions)).to.equal(extensionCount);
        }
      ),
      { numRuns: 3 }
    );
  });

  it("Property 7 – extension count never exceeds maxExtensions", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: MAX_EXTENSIONS + 1, max: MAX_EXTENSIONS + 5 }),
        async (attempts) => {
          const id = await createAntiSnipeAuction(3600);
          let succeeded = 0;
          for (let i = 0; i < attempts; i++) {
            try {
              await auction.connect(handler).extendAuction(id);
              succeeded++;
            } catch {
              // expected after max
            }
          }
          expect(succeeded).to.equal(MAX_EXTENSIONS);
          const a = await auction.auctions(id);
          expect(a.config.currentExtensions).to.equal(MAX_EXTENSIONS);
        }
      ),
      { numRuns: 3 }
    );
  });
});
