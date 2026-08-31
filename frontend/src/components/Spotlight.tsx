import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Terminal } from "lucide-react";
import { Badge, Card, CardHeader, ProgressBar } from "@/components/ui";
import type { SentData } from "@/hooks/useSentData";
import { pct } from "@/lib/utils";

/** Scripted output of agent_runner.py, replayed as a live terminal. */
const TERMINAL_SCRIPT: { text: string; tone?: "ok" | "warn" | "halt" | "dim" }[] = [
  { text: "$ python agent_runner.py --label runaway-demo", tone: "dim" },
  { text: "Registering 'runaway-demo' | 5 steps | 1000 tokens | 600s deadline", tone: "dim" },
  { text: "  registered in block 4821903", tone: "dim" },
  { text: "Running agent against the on-chain breaker", tone: "dim" },
  { text: "  step  1 ok  | +284 tokens | total 284", tone: "ok" },
  { text: "  step  2 ok  | +197 tokens | total 481", tone: "ok" },
  { text: "  step  3 ok  | +342 tokens | total 823", tone: "warn" },
  { text: "  step  4 ok  | +121 tokens | total 944", tone: "warn" },
  { text: "", tone: "dim" },
  { text: "========================================================", tone: "halt" },
  { text: "  HALTED at step 5", tone: "halt" },
  { text: "========================================================", tone: "halt" },
  { text: "  reason   : MAX_TOKENS", tone: "halt" },
  { text: "  message  : Max tokens exceeded", tone: "halt" },
  { text: "  steps    : 4", tone: "halt" },
  { text: "  tokens   : 944", tone: "halt" },
  { text: "  refunded : 0.01 BOT", tone: "halt" },
  { text: "  proof tx : 0x7f3a…e91c", tone: "halt" },
  { text: "  This halt is now immutable on BOT Chain.", tone: "halt" },
];

export function Spotlight({ data }: { data: SentData }) {
  return (
    <section className="relative py-8 pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <ThresholdCard data={data} />
          <TerminalCard />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- threshold warnings */

function ThresholdCard({ data }: { data: SentData }) {
  // Agents burning ≥70% of any ceiling — the warning band before a trip.
  const atRisk = data.agents
    .filter((a) => a.active && !a.halted)
    .map((a) => ({
      agent: a,
      worst: Math.max(pct(a.steps, a.maxSteps), pct(a.tokens, a.maxTokens)),
    }))
    .filter((x) => x.worst >= 70)
    .sort((a, b) => b.worst - a.worst);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full">
        <CardHeader
          icon={<AlertTriangle className="h-4 w-4 text-brand-amber" />}
          title="Threshold warnings"
          subtitle="Agents inside the amber band, before the breaker trips"
          action={
            <Badge tone={atRisk.length ? "amber" : "neutral"} dot={atRisk.length > 0}>
              {atRisk.length} at risk
            </Badge>
          }
        />
        <div className="space-y-3 p-5">
          {atRisk.length === 0 && (
            <div className="rounded-xl border border-dashed border-surface-border px-4 py-10 text-center">
              <p className="text-sm text-text-secondary">Every armed agent is inside budget.</p>
              <p className="mt-1 text-xs text-text-muted">
                Warnings appear here at 70% of any ceiling.
              </p>
            </div>
          )}

          {atRisk.map(({ agent, worst }) => (
            <div
              key={agent.id}
              className="rounded-xl border border-brand-amber/25 bg-brand-amber/5 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{agent.label}</span>
                <span className="font-mono text-xs text-brand-amber">{worst.toFixed(0)}%</span>
              </div>
              <ProgressBar value={worst} tone={worst >= 90 ? "red" : "amber"} className="mt-2.5" />
              <p className="mt-2 font-mono text-[10px] text-text-muted">
                {agent.steps}/{agent.maxSteps} steps · {agent.tokens}/{agent.maxTokens} tokens
              </p>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------ live terminal */

function TerminalCard() {
  const [lines, setLines] = useState<typeof TERMINAL_SCRIPT>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Replay the script on a loop; respect reduced-motion by showing it all.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setLines(TERMINAL_SCRIPT);
      return;
    }

    let index = 0;
    const tick = () => {
      index += 1;
      if (index > TERMINAL_SCRIPT.length) {
        index = 0;
        setLines([]);
        return;
      }
      setLines(TERMINAL_SCRIPT.slice(0, index));
    };

    const id = window.setInterval(tick, 700);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const toneClass = {
    ok: "text-brand-emerald",
    warn: "text-brand-amber",
    halt: "text-brand-red",
    dim: "text-text-muted",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.08 }}
    >
      <Card className="h-full">
        <CardHeader
          icon={<Terminal className="h-4 w-4" />}
          title="agent_runner.py"
          subtitle="A runaway loop with no local guard rails"
          action={<Badge tone="violet">simulation</Badge>}
        />
        <div
          ref={scrollRef}
          className="h-[340px] overflow-y-auto bg-[#05070A] p-5 font-mono text-[11.5px] leading-relaxed break-all"
        >
          {lines.map((line, i) => (
            <div key={i} className={toneClass[line.tone ?? "dim"]}>
              {line.text || " "}
            </div>
          ))}
          <span className="inline-block h-3.5 w-2 animate-pulse bg-brand-emerald align-middle" />
        </div>
      </Card>
    </motion.div>
  );
}
