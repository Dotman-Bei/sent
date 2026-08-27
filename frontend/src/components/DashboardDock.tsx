import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Ban,
  Bot,
  Coins,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { ethers } from "ethers";
import { Badge, Button, LiveDot, ProgressBar } from "@/components/ui";
import type { SentData } from "@/hooks/useSentData";
import type { AgentView } from "@/lib/contracts";
import { cn, compact, formatNumber, pct, timeUntil } from "@/lib/utils";

const CHART_LOOKBACK = 40;

export function DashboardDock({
  data,
  onRegister,
  onHalt,
}: {
  data: SentData;
  onRegister: () => void;
  onHalt: (agent: AgentView) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const activeAgents = data.agents.filter((a) => a.active && !a.halted);
  const protectedTokens = data.agents.reduce((sum, a) => sum + a.maxTokens, 0);

  const chartAgent = useMemo(() => {
    if (selected) return data.agents.find((a) => a.id === selected) ?? null;
    return activeAgents[0] ?? data.agents[0] ?? null;
  }, [selected, data.agents, activeAgents]);

  /** Cumulative tokens for the selected agent, from StepApproved logs. */
  const chartData = useMemo(() => {
    if (!chartAgent) return [];
    const points = data.series
      .filter((p) => p.agent === chartAgent.label)
      .slice(-CHART_LOOKBACK)
      .map((p) => ({ step: p.step, tokens: p.tokens, ceiling: chartAgent.maxTokens }));

    // Before any step is logged, anchor the chart at the origin so the ceiling
    // line and the empty state still read correctly.
    return points.length ? points : [{ step: 0, tokens: 0, ceiling: chartAgent.maxTokens }];
  }, [chartAgent, data.series]);

  return (
    <section id="dashboard" className="relative px-4 pb-24 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto max-w-6xl"
      >
        <div className="glass overflow-hidden rounded-3xl shadow-glow-emerald">
          {/* ------------------------------------------------ dock title bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-emerald/20 to-brand-cyan/10 text-brand-emerald">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Protocol control room</h2>
                <p className="text-xs text-text-muted">
                  {data.error ? (
                    <span className="text-brand-amber">{data.error}</span>
                  ) : data.lastUpdated ? (
                    <>Live from BOT Chain · refreshed {new Date(data.lastUpdated).toLocaleTimeString()}</>
                  ) : (
                    "Connecting to BOT Chain…"
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={data.refresh}>
                <RefreshCw className={cn("h-3.5 w-3.5", data.loading && "animate-spin")} />
                Refresh
              </Button>
              <Button size="sm" onClick={onRegister}>
                <Plus className="h-3.5 w-3.5" />
                New budget
              </Button>
            </div>
          </div>

          {/* ------------------------------------------------- metrics row */}
          <div className="grid grid-cols-2 divide-surface-border border-b border-surface-border sm:divide-x lg:grid-cols-4">
            <Metric
              icon={<Bot className="h-4 w-4" />}
              label="Active agents"
              value={compact(activeAgents.length)}
              sub={`${data.agents.length} registered`}
              tone="emerald"
            />
            <Metric
              icon={<ShieldAlert className="h-4 w-4" />}
              label="Protected tokens"
              value={compact(protectedTokens)}
              sub="ceiling under guard"
              tone="cyan"
            />
            <Metric
              icon={<Ban className="h-4 w-4" />}
              label="Halts fired"
              value={compact(data.halts.length)}
              sub="immutable proofs"
              tone="red"
              live={data.halts.length > 0}
            />
            <Metric
              icon={<Coins className="h-4 w-4" />}
              label="Vault escrow"
              value={`${Number(ethers.formatEther(data.totalLocked)).toFixed(3)}`}
              sub="BOT locked"
              tone="violet"
            />
          </div>

          <div className="grid gap-px bg-surface-border lg:grid-cols-[1.6fr_1fr]">
            {/* ------------------------------------------------- the chart */}
            <div className="bg-surface p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Token consumption vs ceiling</h3>
                  <p className="text-xs text-text-muted">
                    {chartAgent
                      ? `Agent "${chartAgent.label}" · ${formatNumber(chartAgent.tokens)} / ${formatNumber(chartAgent.maxTokens)} tokens`
                      : "No agents registered yet"}
                  </p>
                </div>
                {chartAgent && (
                  <Badge tone={chartAgent.halted ? "red" : "emerald"} dot>
                    {chartAgent.halted ? "Tripped" : "Armed"}
                  </Badge>
                )}
              </div>

              <div className="h-[240px] w-full">
                {chartAgent ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                      <defs>
                        <linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00F5A0" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#00D2FF" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="step"
                        stroke="#64748B"
                        tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
                        tickLine={false}
                        axisLine={false}
                        label={{
                          value: "step",
                          position: "insideBottomRight",
                          fill: "#64748B",
                          fontSize: 10,
                        }}
                      />
                      <YAxis
                        stroke="#64748B"
                        tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, Math.max(chartAgent.maxTokens * 1.15, 10)]}
                        tickFormatter={(v) => compact(v as number)}
                      />
                      <Tooltip
                        cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                        contentStyle={{
                          background: "#1A212D",
                          border: "1px solid rgba(255,255,255,0.16)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#94A3B8" }}
                        formatter={(value: number) => [formatNumber(value), "cumulative tokens"]}
                        labelFormatter={(label) => `Step ${label}`}
                      />
                      <ReferenceLine
                        y={chartAgent.maxTokens}
                        stroke="#FF4D4D"
                        strokeDasharray="4 4"
                        label={{
                          value: "circuit ceiling",
                          fill: "#FF4D4D",
                          fontSize: 10,
                          position: "insideTopRight",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="tokens"
                        stroke="#00F5A0"
                        strokeWidth={2}
                        fill="url(#tokenFill)"
                        dot={false}
                        isAnimationActive
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart loading={data.loading} onRegister={onRegister} />
                )}
              </div>
            </div>

            {/* -------------------------------------------- agent watchlist */}
            <div className="bg-surface p-5">
              <h3 className="mb-4 text-sm font-semibold">Agents under guard</h3>
              <div className="max-h-[276px] space-y-2 overflow-y-auto pr-1">
                {data.loading && data.agents.length === 0 && (
                  <div className="flex items-center gap-2 py-8 text-xs text-text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Reading AgentRegistry…
                  </div>
                )}

                {!data.loading && data.agents.length === 0 && (
                  <p className="py-8 text-xs leading-relaxed text-text-muted">
                    No agents registered yet. Create a budget to arm the breaker.
                  </p>
                )}

                {data.agents.map((agent) => (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    selected={chartAgent?.id === agent.id}
                    onSelect={() => setSelected(agent.id)}
                    onHalt={() => onHalt(agent)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ pieces */

function Metric({
  icon,
  label,
  value,
  sub,
  tone,
  live,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "cyan" | "red" | "violet";
  live?: boolean;
}) {
  const color = {
    emerald: "text-brand-emerald",
    cyan: "text-brand-cyan",
    red: "text-brand-red",
    violet: "text-brand-violet",
  }[tone];

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 text-text-muted">
        <span className={color}>{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
        {live && <LiveDot tone="red" />}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-[11px] text-text-muted">{sub}</p>
    </div>
  );
}

function AgentRow({
  agent,
  selected,
  onSelect,
  onHalt,
}: {
  agent: AgentView;
  selected: boolean;
  onSelect: () => void;
  onHalt: () => void;
}) {
  const stepPct = pct(agent.steps, agent.maxSteps);
  const tokenPct = pct(agent.tokens, agent.maxTokens);
  const worst = Math.max(stepPct, tokenPct);
  const tone = agent.halted ? "red" : worst >= 80 ? "amber" : "emerald";

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "cursor-pointer rounded-xl border p-3 transition-all",
        selected
          ? "border-brand-emerald/40 bg-brand-emerald/5"
          : "border-surface-border bg-surface-subtle hover:border-surface-border-strong"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs text-text-primary">{agent.label}</span>
        {agent.halted ? (
          <Badge tone="red">tripped</Badge>
        ) : agent.active ? (
          <Badge tone={worst >= 80 ? "amber" : "emerald"} dot>
            {worst >= 80 ? "at risk" : "armed"}
          </Badge>
        ) : (
          <Badge tone="neutral">closed</Badge>
        )}
      </div>

      <div className="mt-2.5 space-y-2">
        <Meter label="steps" used={agent.steps} max={agent.maxSteps} value={stepPct} tone={tone} />
        <Meter label="tokens" used={agent.tokens} max={agent.maxTokens} value={tokenPct} tone={tone} />
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="font-mono text-[10px] text-text-muted">
          deadline {timeUntil(agent.deadline)}
        </span>
        {!agent.halted && agent.active && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHalt();
            }}
            className="font-mono text-[10px] text-brand-red transition-colors hover:text-brand-red/80"
          >
            halt now →
          </button>
        )}
      </div>
    </div>
  );
}

function Meter({
  label,
  used,
  max,
  value,
  tone,
}: {
  label: string;
  used: number;
  max: number;
  value: number;
  tone: "emerald" | "amber" | "red";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-text-muted">
        <span>{label}</span>
        <span>
          {compact(used)}/{compact(max)}
        </span>
      </div>
      <ProgressBar value={value} tone={tone} />
    </div>
  );
}

function EmptyChart({ loading, onRegister }: { loading: boolean; onRegister: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-surface-border">
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      ) : (
        <>
          <Activity className="h-6 w-6 text-text-muted" />
          <p className="text-xs text-text-muted">Register an agent to start plotting usage</p>
          <Button size="sm" variant="secondary" onClick={onRegister}>
            Create budget
          </Button>
        </>
      )}
    </div>
  );
}
