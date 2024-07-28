const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("NFTStaker", function () {
    let RandomNFT, randomNFT;
    let NFTStaker, nftStaker;
    let owner, addr1, addr2;
    let rewardPerBlock = 10;
    let delayPeriod = 0;
    let unbondingPeriod = 0;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy RandomNFT contract
        RandomNFT = await ethers.getContractFactory("RandomNFT");
        randomNFT = await upgrades.deployProxy(RandomNFT, [], { initializer: "initialize" });
        await randomNFT.deployed();

        // Deploy NFTStaker contract
        NFTStaker = await ethers.getContractFactory("NFTStaker");
        nftStaker = await upgrades.deployProxy(
            NFTStaker,
            [rewardPerBlock, delayPeriod, unbondingPeriod, randomNFT.address],
            { initializer: "initialize" }
        );
        await nftStaker.deployed();

        // Mint some NFTs to addr1 and addr2
        await randomNFT.connect(addr1).safeMint(addr1.address);
        await randomNFT.connect(addr1).safeMint(addr1.address);
        await randomNFT.connect(addr2).safeMint(addr2.address);
    });

    describe("Staking", function () {
        it("should allow users to stake NFTs", async function () {
            await randomNFT.connect(addr1).approve(nftStaker.address, 1);
            await randomNFT.connect(addr1).approve(nftStaker.address, 2);

            await nftStaker.connect(addr1).stake([1, 2]);

            const stakes = await nftStaker.stakes(addr1.address);
            expect(stakes.length).to.equal(2);
            expect(stakes[0].tokenId).to.equal(1);
            expect(stakes[1].tokenId).to.equal(2);
        });

        it("should emit Staked event on staking", async function () {
            await randomNFT.connect(addr1).approve(nftStaker.address, 1);

            await expect(nftStaker.connect(addr1).stake([1]))
                .to.emit(nftStaker, "Staked")
                .withArgs(addr1.address, 1);
        });

        it("should revert if no token IDs provided for staking", async function () {
            await expect(nftStaker.connect(addr1).stake([])).to.be.revertedWith("No token IDs provided");
        });
    });

    describe("Unstaking", function () {
        beforeEach(async function () {
            await randomNFT.connect(addr1).approve(nftStaker.address, 1);
            await nftStaker.connect(addr1).stake([1]);
        });

        it("should allow users to start unbonding NFTs", async function () {
            await nftStaker.connect(addr1).unstake([1]);

            const stakes = await nftStaker.stakes(addr1.address);
            expect(stakes[0].unbondingStartBlock).to.be.gt(0);
        });

        it("should emit Unstaked event on unstaking", async function () {
            await expect(nftStaker.connect(addr1).unstake([1]))
                .to.emit(nftStaker, "Unstaked")
                .withArgs(addr1.address, 1);
        });

        it("should revert if no token IDs provided for unstaking", async function () {
            await expect(nftStaker.connect(addr1).unstake([])).to.be.revertedWith("No token IDs provided");
        });
    });

    describe("Withdraw", function () {
        beforeEach(async function () {
            await randomNFT.connect(addr1).approve(nftStaker.address, 1);
            await nftStaker.connect(addr1).stake([1]);
            await nftStaker.connect(addr1).unstake([1]);
            await ethers.provider.send("evm_mine", []); // mine a block
        });

        it("should allow users to withdraw NFTs after unbonding period", async function () {
            await ethers.provider.send("evm_increaseTime", [unbondingPeriod * 15]);
            await ethers.provider.send("evm_mine", []);

            await nftStaker.connect(addr1).withdraw([1]);

            expect(await randomNFT.ownerOf(1)).to.equal(addr1.address);
        });

        it("should revert if unbonding period is not yet over", async function () {
            await expect(nftStaker.connect(addr1).withdraw([1])).to.be.reverted;
        });

        it("should revert if no token IDs provided for withdrawal", async function () {
            await expect(nftStaker.connect(addr1).withdraw([])).to.be.revertedWith("No token IDs provided");
        });
    });

    describe("Claim Rewards", function () {
        beforeEach(async function () {
            await randomNFT.connect(addr1).approve(nftStaker.address, 1);
            await nftStaker.connect(addr1).stake([1]);
            await ethers.provider.send("evm_mine", []); // mine a block
        });

        it("should allow users to claim rewards after delay period", async function () {
            await ethers.provider.send("evm_increaseTime", [delayPeriod * 15]);
            await ethers.provider.send("evm_mine", []);

            await expect(nftStaker.connect(addr1).claimRewards())
                .to.emit(nftStaker, "RewardClaimed")
                .withArgs(addr1.address, rewardPerBlock); // The reward is calculated based on one block
        });

        it("should revert if delay period not yet passed", async function () {
            await expect(nftStaker.connect(addr1).claimRewards()).to.be.revertedWith("Claim delay period not yet passed");
        });

        it("should revert if no rewards available", async function () {
            await nftStaker.connect(addr1).claimRewards(); // First claim
            await expect(nftStaker.connect(addr1).claimRewards()).to.be.revertedWith("No rewards available");
        });
    });

    describe("Admin Functions", function () {
        it("should allow the owner to update reward per block", async function () {
            await nftStaker.updateRewardPerBlock(20);
            expect(await nftStaker.rewardPerBlock()).to.equal(20);
        });

        it("should allow the owner to update delay period", async function () {
            await nftStaker.updateDelayPeriod(10);
            expect(await nftStaker.delayPeriod()).to.equal(10);
        });

        it("should allow the owner to update unbonding period", async function () {
            await nftStaker.updateUnbondingPeriod(20);
            expect(await nftStaker.unbondingPeriod()).to.equal(20);
        });

        it("should allow the owner to pause and unpause the contract", async function () {
            await nftStaker.pause();
            expect(await nftStaker.paused()).to.equal(true);

            await nftStaker.unpause();
            expect(await nftStaker.paused()).to.equal(false);
        });
    });
});
