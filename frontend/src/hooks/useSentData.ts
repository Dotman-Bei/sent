import { useCallback, useEffect, useRef, useState } from "react";
import type { ethers } from "ethers";
import {
  type AgentView,
  type HaltRecordView,
  type StepPoint,
  fetchAgents,
  fetchHaltHistory,
  fetchStepSeries,
  fetchVaultStats,
  getReadProvider,
  isDeployed,
  vaultBalanceOf,
} from "@/lib/contracts";

export interface SentData {
  agents: AgentView[];
  halts: HaltRecordView[];
  series: StepPoint[];
  totalLocked: bigint;
  vaultBalance: bigint;
  myVaultBalance: bigint;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

const EMPTY: Omit<SentData, "refresh"> = {
  agents: [],
  halts: [],
  series: [],
  totalLocked: 0n,
  vaultBalance: 0n,
  myVaultBalance: 0n,
  loading: isDeployed,
  error: null,
  lastUpdated: null,
};

/**
 * Live protocol state, read through a public RPC so the landing page works
 * without a wallet. Polls on an interval (10s by default, per the spec).
 */
export function useSentData(address: string | null, pollMs = 10_000): SentData {
  const [state, setState] = useState(EMPTY);
  const provider = useRef<ethers.JsonRpcProvider | null>(null);
  const inFlight = useRef(false);

  if (!provider.current && isDeployed) {
    provider.current = getReadProvider();
  }

  const refresh = useCallback(async () => {
    if (!isDeployed) {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Contracts are not deployed yet. Run the deploy script.",
      }));
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const runner = provider.current!;
      const [agents, halts, vault, series, myVaultBalance] = await Promise.all([
        fetchAgents(runner),
        fetchHaltHistory(runner),
        fetchVaultStats(runner),
        fetchStepSeries(runner),
        address ? vaultBalanceOf(runner, address) : Promise.resolve(0n),
      ]);

      setState({
        agents,
        halts,
        series,
        totalLocked: vault.totalLocked,
        vaultBalance: vault.contractBalance,
        myVaultBalance,
        loading: false,
        error: null,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error:
          (err as Error)?.message?.slice(0, 160) ??
          "Could not reach BOT Chain RPC. Retrying…",
      }));
    } finally {
      inFlight.current = false;
    }
  }, [address]);

  useEffect(() => {
    refresh();
    if (!isDeployed) return;
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { ...state, refresh };
}
