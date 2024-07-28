const { ethers, upgrades } = require("hardhat");

const NAME = "NFTStaker"

async function main() {
    const Contract = await ethers.getContractFactory(NAME);
    // const contract = await upgrades.deployProxy(Contract, [], { kind: 'uups', unsafeAllow: ['constructor'] });
    const contract = await upgrades.deployProxy(Contract, [8], { kind: 'uups', call: 'initialize' });
    await contract.deployed();
    console.log(`UUPS Proxy Pattern V1 is deployed to proxy address: ${contract.address}`);

}
// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
