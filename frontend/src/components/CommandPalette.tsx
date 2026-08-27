import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Search, ShieldOff } from "lucide-react";
import { Badge, Button, inputClass } from "@/components/ui";
import { manualHalt, readableError, type AgentView } from "@/lib/contracts";
import type { WalletState } from "@/hooks/useWallet";
import { cn, shortAddress } from "@/lib/utils";

/**
 * ⌘K kill switch. Lists the agents the connected wallet owns and fires
 * CircuitBreaker.manualHalt() against the chosen one.
 */
export function CommandPalette({
  open,
  onClose,
  agents,
  wallet,
  preselect,
  onHalted,
}: {
  open: boolean;
  onClose: () => void;
  agents: AgentView[];
  wallet: WalletState;
  preselect?: AgentView | null;
  onHalted: () => void;
}) {
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("Operator kill switch");
  const [target, setTarget] = useState<AgentView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const owned = useMemo(() => {
    if (!wallet.address) return [];
    const mine = agents.filter(
      (a) =>
        a.owner.toLowerCase() === wallet.address!.toLowerCase() && a.active && !a.halted
    );
    const q = query.trim().toLowerCase();
    return q ? mine.filter((a) => a.label.toLowerCase().includes(q)) : mine;
  }, [agents, wallet.address, query]);

  useEffect(() => {
    if (open) setTarget(preselect ?? null);
  }, [open, preselect]);

  useEffect(() => {
    if (!open) {
      const id = window.setTimeout(() => {
        setQuery("");
        setError(null);
        setTarget(null);
        setReason("Operator kill switch");
      }, 200);
      return () => window.clearTimeout(id);
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function fire() {
    if (!target) return;
    if (!wallet.signer) return wallet.connect();
    if (!wallet.isCorrectChain) return wallet.switchNetwork();

    setBusy(true);
    setError(null);
    try {
      await manualHalt(wallet.signer, target.id, reason.trim() || "Operator kill switch");
      onHalted();
      onClose();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated shadow-glow-red"
            role="dialog"
            aria-modal="true"
            aria-label="Kill switch"
          >
            <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Halt an agent you own…"
                className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <span className="kbd">esc</span>
            </div>

            <div className="max-h-[280px] overflow-y-auto p-2">
              {!wallet.address && (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm text-text-secondary">Connect a wallet to use the kill switch.</p>
                  <Button size="sm" className="mt-3" onClick={wallet.connect} loading={wallet.connecting}>
                    Connect wallet
                  </Button>
                </div>
              )}

              {wallet.address && owned.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-text-muted">
                  No active agents owned by {shortAddress(wallet.address)}.
                </p>
              )}

              {owned.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setTarget(agent)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors",
                    target?.id === agent.id
                      ? "bg-brand-red/10 ring-1 ring-brand-red/40"
                      : "hover:bg-surface-subtle"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldOff
                      className={cn(
                        "h-3.5 w-3.5",
                        target?.id === agent.id ? "text-brand-red" : "text-text-muted"
                      )}
                    />
                    <span className="font-mono text-xs">{agent.label}</span>
                  </span>
                  <span className="font-mono text-[10px] text-text-muted">
                    {agent.steps}/{agent.maxSteps} steps · {agent.tokens}/{agent.maxTokens} tok
                  </span>
                </button>
              ))}
            </div>

            {target && (
              <div className="space-y-3 border-t border-surface-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    Halting <span className="font-mono text-brand-red">{target.label}</span>
                  </span>
                  <Badge tone="red">MANUAL</Badge>
                </div>

                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason written on-chain"
                  className={cn(inputClass, "text-xs")}
                />

                {error && <p className="text-xs text-brand-red">{error}</p>}

                <Button variant="danger" className="w-full" onClick={fire} loading={busy}>
                  <ShieldOff className="h-4 w-4" />
                  Trip the breaker
                  <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />
                </Button>
                <p className="text-center text-[10px] text-text-muted">
                  Writes a MANUAL HaltRecord and releases the escrow. Irreversible.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
