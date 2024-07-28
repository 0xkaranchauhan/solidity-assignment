const { ethers, upgrades } = require("hardhat");

const PROXY = "0x2086dA6BDF78bA284a32d254FB785885a9832F79";
const NAME = "NFTStaker"

async function main() {
    const Contract = await ethers.getContractFactory(NAME);
    // const upgraded = await upgrades.upgradeProxy(PROXY, Contract, { kind: 'uups', unsafeAllow: ['constructor'], call: 'initialize' });
    const upgraded = await upgrades.upgradeProxy(PROXY, Contract, { kind: 'uups', call: 'initialize' });
    console.log(`UUPS Proxy Pattern V2 is upgraded in proxy address: ${upgraded.address}`);
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

