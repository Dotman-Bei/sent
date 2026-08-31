import { ArrowRight, Github, Send, Zap } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Badge, Button } from "@/components/ui";
import { BOT_CHAIN, addressUrl } from "@/config/chain";
import { CONTRACT_ADDRESSES, isDeployed } from "@/lib/contracts";
import { shortAddress } from "@/lib/utils";

export function PreFooterCTA({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="relative overflow-hidden border-t border-surface-border py-24">
      <div className="pointer-events-none absolute inset-0 bg-radial-footer" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Badge tone="emerald" className="mb-6">
          <Zap className="h-3 w-3" />
          Ship agents you can actually leave alone
        </Badge>
        <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-[44px]">
          Put a ceiling on your next run.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-text-secondary">
          One transaction registers the budget. One call in your loop enforces it. The
          proof is public forever.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={onRegister}>
            Register agent budget
            <ArrowRight className="h-4 w-4" />
          </Button>
          <a
            href="#explorer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-surface-border-strong px-6 text-[15px] text-text-primary transition-colors hover:border-brand-emerald/50 hover:text-brand-emerald"
          >
            Read the halt log
          </a>
        </div>
      </div>
    </section>
  );
}

const CONTRACT_LINKS = [
  { name: "CircuitBreaker", address: CONTRACT_ADDRESSES.CircuitBreaker },
  { name: "AgentRegistry", address: CONTRACT_ADDRESSES.AgentRegistry },
  { name: "BudgetVault", address: CONTRACT_ADDRESSES.BudgetVault },
];

export function Footer() {
  return (
    <footer className="border-t border-surface-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <LogoMark className="h-8 w-8" />
              <span className="text-[17px] font-bold tracking-tight">Sent</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-secondary">
              An on-chain circuit breaker for AI agents. Built for the BOT Chain Builder
              Challenge #2, AI Native Applications track.
            </p>
            <div className="mt-5 flex gap-2">
              <a
                href="https://t.me/BotChain_official/61"
                target="_blank"
                rel="noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-text-muted transition-colors hover:border-brand-emerald/40 hover:text-brand-emerald"
                aria-label="BOT Chain Telegram"
              >
                <Send className="h-4 w-4" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-text-muted transition-colors hover:border-brand-emerald/40 hover:text-brand-emerald"
                aria-label="GitHub repository"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Contracts
            </h4>
            <ul className="mt-4 space-y-2.5">
              {CONTRACT_LINKS.map((c) => (
                <li key={c.name}>
                  {isDeployed ? (
                    <a
                      href={addressUrl(c.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between text-sm text-text-secondary transition-colors hover:text-brand-emerald"
                    >
                      {c.name}
                      <span className="font-mono text-[10px] text-text-muted group-hover:text-brand-emerald">
                        {shortAddress(c.address, 3)}
                      </span>
                    </a>
                  ) : (
                    <span className="flex items-center justify-between text-sm text-text-muted">
                      {c.name}
                      <span className="font-mono text-[10px]">not deployed</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Ecosystem
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                { label: "BOT Chain", href: "https://www.botchain.ai/en" },
                { label: "Builder Hub", href: "https://t.me/BotChain_official/61" },
                { label: "Block explorer", href: BOT_CHAIN.explorerUrl },
                { label: "Challenge page", href: "https://luma.com/238et7cw" },
              ].map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-text-secondary transition-colors hover:text-brand-emerald"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-surface-border pt-6 sm:flex-row">
          <p className="font-mono text-[11px] text-text-muted">
            MIT licensed · {BOT_CHAIN.name} · chainId {BOT_CHAIN.chainId}
          </p>
          <p className="font-mono text-[11px] text-text-muted">
            Sent. Your agent can't run forever.
          </p>
        </div>
      </div>
    </footer>
  );
}
