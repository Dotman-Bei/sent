/**
 * BOT Chain network config, derived from the active chain id so the UI never
 * mislabels which network it is reading. Values verified against
 * dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/, note the testnet
 * lives on bohr.life, not botchain.ai.
 */
const env = import.meta.env;

interface ChainInfo {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
}

const KNOWN: Record<number, ChainInfo> = {
  677: {
    chainId: 677,
    name: "BOT Chain Mainnet",
    rpcUrl: "https://rpc.botchain.ai",
    explorerUrl: "https://scan.botchain.ai",
  },
  968: {
    chainId: 968,
    name: "BOT Chain Testnet",
    rpcUrl: "https://rpc.bohr.life",
    explorerUrl: "https://scan.bohr.life",
  },
  31337: {
    chainId: 31337,
    name: "Localhost",
    rpcUrl: "http://127.0.0.1:8545",
    explorerUrl: "",
  },
};

const chainId = Number(env.VITE_CHAIN_ID ?? 677);
const known = KNOWN[chainId];

export const BOT_CHAIN = {
  chainId,
  name: known?.name ?? `Chain ${chainId}`,
  rpcUrl: String(env.VITE_RPC_URL ?? known?.rpcUrl ?? "https://rpc.botchain.ai"),
  explorerUrl: String(env.VITE_EXPLORER_URL ?? known?.explorerUrl ?? ""),
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
} as const;

export const isTestnet = chainId === 968;

/** The hex chain id MetaMask expects. */
export const CHAIN_ID_HEX = `0x${BOT_CHAIN.chainId.toString(16)}`;

/** Payload for wallet_addEthereumChain. */
export const ADD_CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: BOT_CHAIN.name,
  nativeCurrency: BOT_CHAIN.nativeCurrency,
  rpcUrls: [BOT_CHAIN.rpcUrl],
  blockExplorerUrls: BOT_CHAIN.explorerUrl ? [BOT_CHAIN.explorerUrl] : [],
};

export const txUrl = (hash: string) =>
  BOT_CHAIN.explorerUrl ? `${BOT_CHAIN.explorerUrl}/tx/${hash}` : "";
export const addressUrl = (address: string) =>
  BOT_CHAIN.explorerUrl ? `${BOT_CHAIN.explorerUrl}/address/${address}` : "";
