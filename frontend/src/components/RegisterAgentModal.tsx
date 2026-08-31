import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ExternalLink, ShieldCheck, Wallet, X } from "lucide-react";
import { Badge, Button, Field, inputClass } from "@/components/ui";
import { txUrl } from "@/config/chain";
import { encodeAgentId, readableError, registerAgent } from "@/lib/contracts";
import type { WalletState } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

interface FormState {
  label: string;
  maxSteps: string;
  maxTokens: string;
  maxGas: string;
  durationMin: string;
  escrow: string;
}

const DEFAULTS: FormState = {
  label: "",
  maxSteps: "5",
  maxTokens: "1000",
  maxGas: "0",
  durationMin: "10",
  escrow: "0",
};

const PRESETS = [
  { name: "Demo run", maxSteps: "5", maxTokens: "1000", durationMin: "10" },
  { name: "Research agent", maxSteps: "40", maxTokens: "60000", durationMin: "30" },
  { name: "Long task", maxSteps: "200", maxTokens: "400000", durationMin: "180" },
];

export function RegisterAgentModal({
  open,
  onClose,
  wallet,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  wallet: WalletState;
  onRegistered: () => void;
}) {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Reset the form for the next registration once the modal is dismissed.
  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => {
      setForm(DEFAULTS);
      setError(null);
      setTxHash(null);
    }, 250);
    return () => window.clearTimeout(id);
  }, [open]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const labelBytes = new TextEncoder().encode(form.label).length;
  const labelTooLong = labelBytes > 31;
  const valid =
    form.label.trim().length > 0 &&
    !labelTooLong &&
    Number(form.maxSteps) > 0 &&
    Number(form.maxTokens) > 0 &&
    Number(form.durationMin) > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!wallet.signer) {
      await wallet.connect();
      return;
    }
    if (!wallet.isCorrectChain) {
      await wallet.switchNetwork();
      return;
    }

    setSubmitting(true);
    try {
      const { hash } = await registerAgent(wallet.signer, {
        label: form.label.trim(),
        maxSteps: Number(form.maxSteps),
        maxTokens: Number(form.maxTokens),
        maxGas: Number(form.maxGas || 0),
        durationSec: Math.round(Number(form.durationMin) * 60),
        escrowBot: Number(form.escrow) > 0 ? form.escrow : undefined,
      });
      setTxHash(hash);
      onRegistered();
      wallet.refreshBalance();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-surface-border bg-surface-elevated sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            aria-label="Register agent budget"
          >
            <div className="flex items-start justify-between border-b border-surface-border px-6 py-5">
              <div>
                <h2 className="text-base font-semibold">Register agent budget</h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  Ceilings are immutable once written on-chain.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {txHash ? (
              <Success hash={txHash} label={form.label} onClose={onClose} />
            ) : (
              <form onSubmit={submit} className="space-y-5 px-6 py-5">
                <Field
                  label="Agent ID"
                  hint="Packed into bytes32. The id your runner passes to checkLimits()."
                  suffix={`${labelBytes}/31 bytes`}
                >
                  <input
                    autoFocus
                    value={form.label}
                    onChange={set("label")}
                    placeholder="research-agent-01"
                    className={cn(inputClass, labelTooLong && "border-brand-red/60")}
                  />
                </Field>

                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          maxSteps: p.maxSteps,
                          maxTokens: p.maxTokens,
                          durationMin: p.durationMin,
                        }))
                      }
                      className="rounded-lg border border-surface-border px-2.5 py-1.5 text-[11px] text-text-secondary transition-colors hover:border-brand-emerald/40 hover:text-brand-emerald"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Max steps">
                    <input type="number" min={1} value={form.maxSteps} onChange={set("maxSteps")} className={inputClass} />
                  </Field>
                  <Field label="Max tokens">
                    <input type="number" min={1} value={form.maxTokens} onChange={set("maxTokens")} className={inputClass} />
                  </Field>
                  <Field label="Deadline" suffix="minutes">
                    <input type="number" min={1} value={form.durationMin} onChange={set("durationMin")} className={inputClass} />
                  </Field>
                  <Field label="Max gas" hint="0 disables the gas ceiling.">
                    <input type="number" min={0} value={form.maxGas} onChange={set("maxGas")} className={inputClass} />
                  </Field>
                </div>

                <Field
                  label="Escrow"
                  suffix="BOT"
                  hint="Optional. Locked at registration and refunded automatically when the breaker trips."
                >
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={form.escrow}
                    onChange={set("escrow")}
                    className={inputClass}
                  />
                </Field>

                {error && (
                  <p className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-3.5 py-2.5 text-xs text-brand-red">
                    {error}
                  </p>
                )}

                <div className="rounded-xl border border-surface-border bg-surface-subtle px-3.5 py-3">
                  <p className="font-mono text-[10px] text-text-muted">agentId preview</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-brand-emerald">
                    {form.label && !labelTooLong ? encodeAgentId(form.label.trim()) : "-"}
                  </p>
                </div>

                {!wallet.address ? (
                  <Button type="submit" size="lg" className="w-full" loading={wallet.connecting}>
                    <Wallet className="h-4 w-4" />
                    Connect wallet to continue
                  </Button>
                ) : !wallet.isCorrectChain ? (
                  <Button type="submit" size="lg" variant="danger" className="w-full">
                    Switch to BOT Chain Mainnet
                  </Button>
                ) : (
                  <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!valid}>
                    <ShieldCheck className="h-4 w-4" />
                    {submitting ? "Arming breaker…" : "Arm the circuit breaker"}
                  </Button>
                )}
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Success({ hash, label, onClose }: { hash: string; label: string; onClose: () => void }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-emerald/30 bg-brand-emerald/10">
        <CheckCircle2 className="h-6 w-6 text-brand-emerald" />
      </div>
      <h3 className="mt-5 text-base font-semibold">Breaker armed</h3>
      <p className="mt-2 text-sm text-text-secondary">
        <span className="font-mono text-brand-emerald">{label}</span> is now under on-chain
        budget control.
      </p>

      <Badge tone="emerald" className="mt-5">
        registered on BOT Chain
      </Badge>

      <a
        href={txUrl(hash)}
        target="_blank"
        rel="noreferrer"
        className="mt-5 flex items-center justify-center gap-1.5 font-mono text-[11px] text-text-muted transition-colors hover:text-brand-emerald"
      >
        {hash.slice(0, 18)}…{hash.slice(-8)}
        <ExternalLink className="h-3 w-3" />
      </a>

      <Button className="mt-6 w-full" size="lg" onClick={onClose}>
        Back to dashboard
      </Button>
    </div>
  );
}
