const { ethers, upgrades } = require("hardhat");

async function deployRandomNFT() {
    const RandomNFT = await ethers.getContractFactory("RandomNFT");
    const randomNftContract = await upgrades.deployProxy(RandomNFT, [], { kind: 'uups', call: 'initialize' });
    await randomNftContract.deployed();
    console.log("RandomNFT UUPS Proxy Pattern V1 is deployed to proxy address:", randomNftContract.address);
    return randomNftContract.address;
}

async function deployNFTStaker(nftAddress) {
    const NFTStaker = await ethers.getContractFactory("NFTStaker");
    const nftStakerContract = await upgrades.deployProxy(NFTStaker, ["10000000000000000000", "86400", "10", nftAddress], { kind: 'uups', call: 'initialize' });
    await nftStakerContract.deployed();
    console.log("NFTStaker UUPS Proxy Pattern V1 is deployed to proxy address:", nftStakerContract.address);
}

async function main() {
    try {
        const nftAddress = await deployRandomNFT();
        await deployNFTStaker(nftAddress);
    } catch (error) {
        console.error("Deployment failed:", error);
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exitCode = 1;
});

// https://testnet.bscscan.com/address/0x1EA6Bc66c582B4d34462c7Cc6464866F6c9cdFe6
// https://testnet.bscscan.com/address/0x8009CeD8d035cEC2D2a98B992B6b4c56cd1904ed
