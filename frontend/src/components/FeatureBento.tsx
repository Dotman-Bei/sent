import { motion } from "framer-motion";
import { Command, FileCheck2, Gauge, Plug, Zap } from "lucide-react";
import { Badge, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/utils";

const FRAMEWORKS = ["LangChain", "LangGraph", "AutoGen", "CrewAI"];

export function FeatureBento({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <SectionLabel>The protocol</SectionLabel>
          <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-[42px]">
            Five guarantees, enforced by a contract
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-text-secondary">
            Every budget lives in <span className="font-mono text-brand-emerald">AgentRegistry</span>,
            every trip goes through{" "}
            <span className="font-mono text-brand-emerald">CircuitBreaker</span>, and every
            halt leaves a receipt nobody can edit.
          </p>
        </div>

        <div className="grid auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-3">
          {/* 1 — deterministic budgets (wide) */}
          <BentoCard
            className="md:col-span-2"
            icon={<Gauge className="h-4 w-4" />}
            title="Deterministic budgets"
            body="Four ceilings, set once at registration and immutable after: max steps, max tokens, cumulative on-chain gas, and a wall-clock deadline. No config file the agent can rewrite mid-run."
            delay={0}
          >
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { k: "maxSteps", v: "5" },
                { k: "maxTokens", v: "1,000" },
                { k: "maxGas", v: "auto" },
                { k: "deadline", v: "10m" },
              ].map((f) => (
                <div
                  key={f.k}
                  className="rounded-xl border border-surface-border bg-surface-subtle px-3 py-2.5"
                >
                  <p className="font-mono text-[10px] text-text-muted">{f.k}</p>
                  <p className="mt-0.5 font-mono text-sm text-brand-emerald">{f.v}</p>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* 2 — real-time tripping */}
          <BentoCard
            icon={<Zap className="h-4 w-4" />}
            title="Real-time tripping"
            body="checkLimits() runs before every step. The moment a ceiling is crossed the agent is deactivated in the same transaction — and the escrow is refunded."
            delay={0.05}
            tone="cyan"
          />

          {/* 3 — verifiable proofs */}
          <BentoCard
            icon={<FileCheck2 className="h-4 w-4" />}
            title="Verifiable halt proofs"
            body="Each halt writes a HaltRecord: reason code, timestamp, step count, token count, refund. Anyone can read why a run stopped without trusting the operator."
            delay={0.1}
            tone="violet"
          />

          {/* 4 — framework integrations */}
          <BentoCard
            icon={<Plug className="h-4 w-4" />}
            title="Drops into your stack"
            body="One call at the top of your agent loop. The Python runner in this repo is the reference implementation."
            delay={0.15}
          >
            <div className="mt-4 flex flex-wrap gap-2">
              {FRAMEWORKS.map((f) => (
                <Badge key={f} tone="neutral">
                  {f}
                </Badge>
              ))}
            </div>
          </BentoCard>

          {/* 5 — manual kill switch */}
          <BentoCard
            icon={<Command className="h-4 w-4" />}
            title="Instant manual control"
            body="Owner-only kill switch, one keystroke away. Halts the run and releases the escrow immediately."
            delay={0.2}
            tone="red"
          >
            <button
              onClick={onOpenPalette}
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-surface-border bg-surface-subtle px-3 py-2.5 text-left transition-colors hover:border-brand-red/40"
            >
              <span className="font-mono text-xs text-text-secondary">manualHalt()</span>
              <span className="kbd">⌘K</span>
            </button>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  icon,
  title,
  body,
  children,
  className,
  delay = 0,
  tone = "emerald",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
  delay?: number;
  tone?: "emerald" | "cyan" | "violet" | "red";
}) {
  const accents = {
    emerald: "text-brand-emerald border-brand-emerald/20 bg-brand-emerald/10",
    cyan: "text-brand-cyan border-brand-cyan/20 bg-brand-cyan/10",
    violet: "text-brand-violet border-brand-violet/20 bg-brand-violet/10",
    red: "text-brand-red border-brand-red/20 bg-brand-red/10",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        "card-hairline group p-5 transition-colors hover:border-surface-border-strong",
        className
      )}
    >
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border", accents)}>
        {icon}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{body}</p>
      {children}
    </motion.div>
  );
}
