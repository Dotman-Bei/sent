import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// BOT Chain. chainId 677 was read live from https://rpc.botchain.ai
// (eth_chainId -> 0x2a5), note this differs from the 2017 quoted in build.md.
const BOTCHAIN_RPC_URL = process.env.BOTCHAIN_RPC_URL ?? "https://rpc.botchain.ai";
const BOTCHAIN_CHAIN_ID = Number(process.env.BOTCHAIN_CHAIN_ID ?? 677);

// BOT Chain Testnet (chainId 968). Note the RPC lives on bohr.life, not
// botchain.ai. Source: dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/
const TESTNET_RPC_URL = process.env.BOTCHAIN_TESTNET_RPC_URL ?? "https://rpc.bohr.life";
const TESTNET_CHAIN_ID = Number(process.env.BOTCHAIN_TESTNET_CHAIN_ID ?? 968);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    botchain: {
      url: BOTCHAIN_RPC_URL,
      chainId: BOTCHAIN_CHAIN_ID,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    botchain_testnet: {
      url: TESTNET_RPC_URL,
      chainId: TESTNET_CHAIN_ID,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      botchain: process.env.BOTCHAIN_EXPLORER_API_KEY ?? "no-key-required",
    },
    customChains: [
      {
        network: "botchain",
        chainId: BOTCHAIN_CHAIN_ID,
        urls: {
          apiURL: process.env.BOTCHAIN_EXPLORER_API ?? "https://scan.botchain.ai/api",
          browserURL: process.env.BOTCHAIN_EXPLORER_URL ?? "https://scan.botchain.ai",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
  },
};

export default config;
