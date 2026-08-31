import { motion } from "framer-motion";
import { SectionLabel } from "@/components/ui";

const REDDIT_QUOTES = [
  "my agent looped 400 times overnight, $52 gone",
  "no way to cap spend per run",
  "it retried a hallucinated tool call until the key rate-limited",
  "I woke up to a $200 bill from one bad prompt",
  "there's no kill switch I can trust",
];

export function ValueBanner() {
  return (
    <section className="relative border-y border-surface-border bg-surface/40 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SectionLabel>The problem</SectionLabel>
            <h2 className="mt-5 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-[42px]">
              Who said agent safety
              <br />
              had to be <span className="text-gradient">manual?</span>
            </h2>
            <p className="mt-5 max-w-lg text-pretty leading-relaxed text-text-secondary">
              Today every guard rail lives inside the agent process, a `max_iterations`
              constant the model can talk its way around, a try/except that swallows the
              loop, a budget check that dies with the crash that caused it.
            </p>
            <p className="mt-4 max-w-lg text-pretty leading-relaxed text-text-secondary">
              Sent moves the limit somewhere the agent cannot reach:{" "}
              <span className="text-text-primary">a contract it does not control.</span> The
              breaker is the same for the operator, the auditor, and the user paying the
              bill.
            </p>
          </motion.div>

          {/* Scrolling wall of the complaints this protocol exists for. */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface p-1"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-surface to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-surface to-transparent" />
            <div className="space-y-2 p-4">
              {[...REDDIT_QUOTES, ...REDDIT_QUOTES.slice(0, 2)].map((quote, i) => (
                <div
                  key={`${quote}-${i}`}
                  className="rounded-xl border border-surface-border bg-surface-subtle px-4 py-3"
                >
                  <p className="text-sm leading-snug text-text-secondary">"{quote}"</p>
                  <p className="mt-1.5 font-mono text-[10px] text-text-muted">
                    r/LocalLLaMA · r/AI_Agents · r/LangChain
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
