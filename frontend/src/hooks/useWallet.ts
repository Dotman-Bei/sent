import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { ADD_CHAIN_PARAMS, BOT_CHAIN, CHAIN_ID_HEX } from "@/config/chain";
import { readableError } from "@/lib/contracts";

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export interface WalletState {
  address: string | null;
  chainId: number | null;
  balance: bigint | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  isCorrectChain: boolean;
  signer: ethers.JsonRpcSigner | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

/**
 * MetaMask connection scoped to BOT Chain Mainnet. Adds the network to the
 * wallet if the user does not have it yet, per the submission checklist.
 */
export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasWallet = typeof window !== "undefined" && Boolean(window.ethereum);

  const syncAccount = useCallback(async (account: string | null) => {
    if (!account || !window.ethereum) {
      setAddress(null);
      setSigner(null);
      setBalance(null);
      return;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const nextSigner = await provider.getSigner();
    const network = await provider.getNetwork();

    setAddress(ethers.getAddress(account));
    setSigner(nextSigner);
    setChainId(Number(network.chainId));
    setBalance(await provider.getBalance(account));
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("MetaMask not detected. Install it to register an agent budget.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      await syncAccount(accounts[0] ?? null);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setConnecting(false);
    }
  }, [syncAccount]);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    setError(null);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
    } catch (err) {
      // 4902 = chain unknown to the wallet; add it, then it becomes selected.
      const code = (err as { code?: number })?.code;
      if (code === 4902 || code === -32603) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [ADD_CHAIN_PARAMS],
          });
        } catch (addErr) {
          setError(readableError(addErr));
        }
      } else {
        setError(readableError(err));
      }
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address || !window.ethereum) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    setBalance(await provider.getBalance(address));
  }, [address]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setBalance(null);
    setError(null);
  }, []);

  // Reconnect silently if the site is already authorized, and follow changes.
  useEffect(() => {
    if (!window.ethereum) return;
    const eth = window.ethereum;

    eth
      .request({ method: "eth_accounts" })
      .then((accounts) => syncAccount((accounts as string[])[0] ?? null))
      .catch(() => undefined);

    eth
      .request({ method: "eth_chainId" })
      .then((id) => setChainId(Number(id)))
      .catch(() => undefined);

    const onAccountsChanged = (accounts: string[]) => syncAccount(accounts[0] ?? null);
    const onChainChanged = (id: string) => {
      setChainId(Number(id));
      // Re-derive the signer against the new network.
      eth
        .request({ method: "eth_accounts" })
        .then((accounts) => syncAccount((accounts as string[])[0] ?? null))
        .catch(() => undefined);
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);
    return () => {
      eth.removeListener("accountsChanged", onAccountsChanged);
      eth.removeListener("chainChanged", onChainChanged);
    };
  }, [syncAccount]);

  const isCorrectChain = chainId === BOT_CHAIN.chainId;

  return useMemo(
    () => ({
      address,
      chainId,
      balance,
      connecting,
      error,
      hasWallet,
      isCorrectChain,
      signer,
      connect,
      disconnect,
      switchNetwork,
      refreshBalance,
    }),
    [
      address,
      chainId,
      balance,
      connecting,
      error,
      hasWallet,
      isCorrectChain,
      signer,
      connect,
      disconnect,
      switchNetwork,
      refreshBalance,
    ]
  );
}
