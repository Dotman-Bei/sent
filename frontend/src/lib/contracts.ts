import { ethers } from "ethers";
import AgentRegistryAbi from "@/config/abis/AgentRegistry.json";
import BudgetVaultAbi from "@/config/abis/BudgetVault.json";
import CircuitBreakerAbi from "@/config/abis/CircuitBreaker.json";
import { CONTRACT_ADDRESSES } from "@/config/addresses";
import { BOT_CHAIN } from "@/config/chain";

export const ABIS = {
  AgentRegistry: AgentRegistryAbi,
  BudgetVault: BudgetVaultAbi,
  CircuitBreaker: CircuitBreakerAbi,
};

export { CONTRACT_ADDRESSES };

export const HALT_REASONS = [
  "NONE",
  "MAX_STEPS",
  "MAX_TOKENS",
  "MAX_GAS",
  "DEADLINE",
  "MANUAL",
] as const;

export type HaltReason = (typeof HALT_REASONS)[number];

export const REASON_LABEL: Record<HaltReason, string> = {
  NONE: "None",
  MAX_STEPS: "Step ceiling",
  MAX_TOKENS: "Token ceiling",
  MAX_GAS: "Gas ceiling",
  DEADLINE: "Deadline",
  MANUAL: "Manual halt",
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** True once deploy.ts has written real addresses into config/addresses.ts. */
// Widened to string[]: addresses.ts is `as const`, so the literal types would
// otherwise make this comparison a compile error after every deployment.
export const isDeployed = (Object.values(CONTRACT_ADDRESSES) as string[]).every(
  (a) => Boolean(a) && a !== ZERO_ADDRESS
);

// --------------------------------------------------------------------- types

export interface AgentView {
  id: string; // bytes32
  label: string; // decoded id
  owner: string;
  maxSteps: number;
  maxTokens: number;
  maxGas: number;
  deadline: number;
  active: boolean;
  steps: number;
  tokens: number;
  gas: number;
  createdAt: number;
  halted: boolean;
}

export interface HaltRecordView {
  agentId: string;
  label: string;
  reason: HaltReason;
  timestamp: number;
  stepCount: number;
  tokenCount: number;
  refunded: bigint;
  message: string;
}

export interface StepPoint {
  step: number;
  tokens: number; // cumulative
  agent: string;
}

// ----------------------------------------------------------------- providers

/** Read-only provider so the dashboard shows live data with no wallet connected. */
export function getReadProvider() {
  return new ethers.JsonRpcProvider(BOT_CHAIN.rpcUrl, BOT_CHAIN.chainId, {
    staticNetwork: true,
  });
}

type Runner = ethers.ContractRunner;

export const registryContract = (runner: Runner) =>
  new ethers.Contract(CONTRACT_ADDRESSES.AgentRegistry, ABIS.AgentRegistry, runner);

export const breakerContract = (runner: Runner) =>
  new ethers.Contract(CONTRACT_ADDRESSES.CircuitBreaker, ABIS.CircuitBreaker, runner);

export const vaultContract = (runner: Runner) =>
  new ethers.Contract(CONTRACT_ADDRESSES.BudgetVault, ABIS.BudgetVault, runner);

// ------------------------------------------------------------------- helpers

/** bytes32 <-> label. Labels are capped at 31 bytes by encodeBytes32String. */
export const encodeAgentId = (label: string) => ethers.encodeBytes32String(label);

export function decodeAgentId(id: string) {
  try {
    return ethers.decodeBytes32String(id);
  } catch {
    return `${id.slice(0, 10)}…`;
  }
}

/** Turn an ethers/MetaMask error into something a human can act on. */
export function readableError(error: unknown): string {
  const err = error as {
    shortMessage?: string;
    reason?: string;
    code?: string | number;
    info?: { error?: { message?: string } };
    message?: string;
  };
  if (err?.code === "ACTION_REJECTED" || err?.code === 4001) {
    return "Transaction rejected in wallet.";
  }
  const raw =
    err?.info?.error?.message ?? err?.shortMessage ?? err?.reason ?? err?.message ?? "";

  if (/AgentExists/i.test(raw)) return "An agent with that ID already exists. Pick another label.";
  if (/AlreadyHalted/i.test(raw)) return "This agent has already been halted.";
  if (/NotOwner/i.test(raw)) return "Only the agent owner can do that.";
  if (/InvalidBudget/i.test(raw)) return "Budget values must be greater than zero.";
  if (/InsufficientBalance/i.test(raw)) return "Insufficient vault balance.";
  if (/insufficient funds/i.test(raw)) return "Insufficient BOT for gas and escrow.";
  return raw ? raw.replace(/^execution reverted:?\s*/i, "") : "Transaction failed.";
}

// --------------------------------------------------------------------- reads

/** Every registered agent, merged with its live usage counters and halt state. */
export async function fetchAgents(runner: Runner): Promise<AgentView[]> {
  const registry = registryContract(runner);
  const breaker = breakerContract(runner);
  const ids: string[] = [...(await registry.getAgentIds())];

  return Promise.all(
    ids.map(async (id) => {
      const [view, halted] = await Promise.all([
        registry.getAgentView(id),
        breaker.halted(id),
      ]);
      const [owner, profile, steps, tokens, gas, createdAt] = view;
      return {
        id,
        label: decodeAgentId(id),
        owner,
        maxSteps: Number(profile.maxSteps),
        maxTokens: Number(profile.maxTokens),
        maxGas: Number(profile.maxGas),
        deadline: Number(profile.deadline),
        active: Boolean(profile.active),
        steps: Number(steps),
        tokens: Number(tokens),
        gas: Number(gas),
        createdAt: Number(createdAt),
        halted: Boolean(halted),
      } satisfies AgentView;
    })
  );
}

/** All halt proofs, newest first. Matches the spec's getHaltHistory() flow. */
export async function fetchHaltHistory(runner: Runner): Promise<HaltRecordView[]> {
  const breaker = breakerContract(runner);
  const records = await breaker.getHaltRecords();

  return [...records]
    .map((r: any) => ({
      agentId: r.agentId,
      label: decodeAgentId(r.agentId),
      reason: HALT_REASONS[Number(r.reason)] ?? "NONE",
      timestamp: Number(r.timestamp),
      stepCount: Number(r.stepCount),
      tokenCount: Number(r.tokenCount),
      refunded: BigInt(r.refunded),
      message: r.message,
    }))
    .reverse();
}

export async function fetchVaultStats(runner: Runner) {
  const vault = vaultContract(runner);
  const [locked, contractBalance] = await Promise.all([
    vault.totalLocked(),
    runner.provider!.getBalance(CONTRACT_ADDRESSES.BudgetVault),
  ]);
  return { totalLocked: BigInt(locked), contractBalance: BigInt(contractBalance) };
}

/**
 * Cumulative token consumption per agent, rebuilt from StepApproved logs.
 *
 * BOT Chain produces a block roughly every 0.75s, so a lookback measured in
 * blocks is a much shorter span of history than it looks: 20k blocks is only
 * ~4h. The default below is ~40h. RPCs cap getLogs ranges differently, so a
 * rejected range is retried at progressively smaller windows rather than
 * silently returning nothing.
 */
export async function fetchStepSeries(
  runner: Runner,
  lookbackBlocks = 200_000
): Promise<StepPoint[]> {
  const breaker = breakerContract(runner);
  const latest = await runner.provider!.getBlockNumber();

  const windows = [lookbackBlocks, 50_000, 20_000, 5_000].filter(
    (w, i, a) => w <= lookbackBlocks && a.indexOf(w) === i
  );

  for (const span of windows) {
    try {
      const from = Math.max(0, latest - span);
      const logs = await breaker.queryFilter(breaker.filters.StepApproved(), from, latest);

      const totals = new Map<string, number>();
      return logs.map((log) => {
        const { agentId, step, tokensUsed } = (log as ethers.EventLog).args as unknown as {
          agentId: string;
          step: bigint;
          tokensUsed: bigint;
        };
        const running = (totals.get(agentId) ?? 0) + Number(tokensUsed);
        totals.set(agentId, running);
        return { step: Number(step), tokens: running, agent: decodeAgentId(agentId) };
      });
    } catch {
      // Range rejected by the RPC — try a narrower window.
    }
  }
  return [];
}

// -------------------------------------------------------------------- writes

/** Register an agent budget. Any `escrowBot` sent is refunded on halt. */
export async function registerAgent(
  signer: ethers.Signer,
  params: {
    label: string;
    maxSteps: number;
    maxTokens: number;
    maxGas: number;
    durationSec: number;
    escrowBot?: string;
  }
) {
  const registry = registryContract(signer);
  const value = params.escrowBot ? ethers.parseEther(params.escrowBot) : 0n;
  const tx = await registry.registerAgent(
    encodeAgentId(params.label),
    params.maxSteps,
    params.maxTokens,
    params.maxGas,
    params.durationSec,
    { value }
  );
  return { hash: tx.hash as string, receipt: await tx.wait() };
}

/** The ⌘K kill switch. */
export async function manualHalt(signer: ethers.Signer, agentId: string, reason: string) {
  const breaker = breakerContract(signer);
  const id = agentId.startsWith("0x") && agentId.length === 66 ? agentId : encodeAgentId(agentId);
  const tx = await breaker.manualHalt(id, reason);
  return { hash: tx.hash as string, receipt: await tx.wait() };
}

export async function completeAgent(signer: ethers.Signer, agentId: string) {
  const breaker = breakerContract(signer);
  const tx = await breaker.completeAgent(agentId);
  return { hash: tx.hash as string, receipt: await tx.wait() };
}

export async function withdraw(signer: ethers.Signer, amountBot: string) {
  const vault = vaultContract(signer);
  const tx = await vault.withdraw(ethers.parseEther(amountBot));
  return { hash: tx.hash as string, receipt: await tx.wait() };
}

export async function vaultBalanceOf(runner: Runner, address: string): Promise<bigint> {
  return BigInt(await vaultContract(runner).balances(address));
}
