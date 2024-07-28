require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [{
      version: "0.8.20", settings: {
        optimizer: { enabled: true, runs: 200, },
      },
    },],
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        details: {
          yulDetails: {
            optimizerSteps: "u",
          },
        },
      },
    },
  },
  networks: {
    bscTestnet: {
      url: process.env.BSC_SCAN_TESTNET_URL,
      accounts: [process.env.KEY], saveDeployments: true,
    },
  },
  etherscan: { apiKey: { bscTestnet: process.env.BSC_SCAN_TESTNET_API, } },
};

//npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS "Constructor argument 1"
