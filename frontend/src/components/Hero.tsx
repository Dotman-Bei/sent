import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { compact } from "@/lib/utils";

export function Hero({
  haltCount,
  onRegister,
}: {
  haltCount: number;
  onRegister: () => void;
}) {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      {/* Ambient mesh glow + faint grid, per the Cobalt hero treatment. */}
      <div className="pointer-events-none absolute inset-0 bg-radial-hero" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-center"
        >
          <Badge tone="emerald" className="mb-6">
            <Sparkles className="h-3 w-3" />
            BOT Chain Builder Challenge #2 · Live
          </Badge>

          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-[68px]">
            Your AI agent
            <br />
            <span className="text-gradient">can't run forever.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-text-secondary sm:text-lg">
            Sent is an on-chain circuit breaker for AI agents. Register an execution
            budget — steps, tokens, gas, deadline — and the chain halts the run the
            moment it's breached, refunds the escrow, and writes immutable proof of{" "}
            <span className="text-text-primary">why</span> it stopped.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={onRegister} className="w-full sm:w-auto">
              Register agent budget
              <ArrowRight className="h-4 w-4" />
            </Button>
            <a
              href="#explorer"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-surface-border-strong px-6 text-[15px] text-text-primary transition-colors hover:border-brand-emerald/50 hover:text-brand-emerald sm:w-auto"
            >
              <ShieldCheck className="h-4 w-4" />
              Explore halt proofs
            </a>
          </div>

          <p className="mt-6 font-mono text-xs text-text-muted">
            <span className="text-brand-red">{compact(haltCount)}</span> runaway
            {haltCount === 1 ? " agent" : " agents"} stopped on-chain · no keeper, no
            oracle, no trust required
          </p>
        </motion.div>
      </div>
    </section>
  );
}
