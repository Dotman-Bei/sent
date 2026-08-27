import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Loader2, Search, ShieldX } from "lucide-react";
import { ethers } from "ethers";
import { Badge, Card, SectionLabel, inputClass } from "@/components/ui";
import { addressUrl } from "@/config/chain";
import { CONTRACT_ADDRESSES, HALT_REASONS, REASON_LABEL, type HaltReason } from "@/lib/contracts";
import type { SentData } from "@/hooks/useSentData";
import { cn, formatNumber, timeAgo } from "@/lib/utils";

const REASON_TONE: Record<HaltReason, "red" | "amber" | "violet" | "cyan" | "neutral"> = {
  NONE: "neutral",
  MAX_STEPS: "violet",
  MAX_TOKENS: "red",
  MAX_GAS: "amber",
  DEADLINE: "cyan",
  MANUAL: "neutral",
};

const FILTERS = ["ALL", ...HALT_REASONS.slice(1)] as const;

export function HaltExplorer({ data }: { data: SentData }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.halts.filter((h) => {
      const matchesFilter = filter === "ALL" || h.reason === filter;
      const matchesQuery =
        !q ||
        h.label.toLowerCase().includes(q) ||
        h.message.toLowerCase().includes(q) ||
        h.agentId.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [data.halts, query, filter]);

  return (
    <section id="explorer" className="relative border-t border-surface-border py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <SectionLabel>On-chain proof</SectionLabel>
            <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-[42px]">
              Live halt explorer
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-text-secondary">
              Every row is a <span className="font-mono text-brand-emerald">HaltRecord</span>{" "}
              read straight from{" "}
              <span className="font-mono text-brand-emerald">CircuitBreaker.getHaltHistory()</span>.
              Nothing here is written by a server.
            </p>
          </div>

          <a
            href={addressUrl(CONTRACT_ADDRESSES.CircuitBreaker)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-text-muted transition-colors hover:text-brand-emerald"
          >
            CircuitBreaker on explorer
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <Card>
          {/* ------------------------------------------------------ toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-4">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agent id or reason…"
                className={cn(inputClass, "py-2 pl-9 text-xs")}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-colors",
                    filter === f
                      ? "border-brand-emerald/40 bg-brand-emerald/10 text-brand-emerald"
                      : "border-surface-border text-text-muted hover:border-surface-border-strong hover:text-text-secondary"
                  )}
                >
                  {f === "ALL" ? "all" : f.replace("MAX_", "").toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* -------------------------------------------------------- table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-surface-border text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="px-5 py-3 font-medium">Agent</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                  <th className="px-5 py-3 font-medium">Message</th>
                  <th className="px-5 py-3 text-right font-medium">Steps</th>
                  <th className="px-5 py-3 text-right font-medium">Tokens</th>
                  <th className="px-5 py-3 text-right font-medium">Refunded</th>
                  <th className="px-5 py-3 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {data.loading && data.halts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-text-muted" />
                    </td>
                  </tr>
                )}

                {!data.loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <ShieldX className="mx-auto h-6 w-6 text-text-muted" />
                      <p className="mt-3 text-sm text-text-secondary">
                        {data.halts.length === 0
                          ? "No halts recorded yet — every agent has stayed inside budget."
                          : "No halts match this filter."}
                      </p>
                    </td>
                  </tr>
                )}

                {rows.map((halt, i) => (
                  <motion.tr
                    key={`${halt.agentId}-${halt.timestamp}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-subtle"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-text-primary">{halt.label}</span>
                      <span className="block font-mono text-[10px] text-text-muted">
                        {halt.agentId.slice(0, 14)}…
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={REASON_TONE[halt.reason]}>{REASON_LABEL[halt.reason]}</Badge>
                    </td>
                    <td className="max-w-[220px] truncate px-5 py-3.5 text-xs text-text-secondary">
                      {halt.message}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs text-text-secondary">
                      {formatNumber(halt.stepCount)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs text-text-secondary">
                      {formatNumber(halt.tokenCount)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs text-brand-emerald">
                      {Number(ethers.formatEther(halt.refunded)).toFixed(4)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-[11px] text-text-muted">
                      {timeAgo(halt.timestamp)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-surface-border px-5 py-3 text-[11px] text-text-muted">
            {rows.length} of {data.halts.length} halt proofs · polling BOT Chain every 10s
          </div>
        </Card>
      </div>
    </section>
  );
}
