import { useEffect, useState } from "react";
import { AlertTriangle, Command, Wallet, Zap } from "lucide-react";
import { Badge, Button, LiveDot } from "@/components/ui";
import { BOT_CHAIN } from "@/config/chain";
import { cn, shortAddress } from "@/lib/utils";
import type { WalletState } from "@/hooks/useWallet";

const LINKS = [
  { href: "#dashboard", label: "Dashboard" },
  { href: "#features", label: "Protocol" },
  { href: "#explorer", label: "Halt Explorer" },
];

export function Nav({
  wallet,
  onOpenPalette,
}: {
  wallet: WalletState;
  onOpenPalette: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const connected = Boolean(wallet.address);
  const wrongChain = connected && !wallet.isCorrectChain;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "glass border-b border-surface-border" : "border-b border-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-emerald to-brand-cyan">
            <Zap className="h-4 w-4 text-background" strokeWidth={2.5} />
          </span>
          <span className="text-[17px] font-bold tracking-tight">Sent</span>
          <Badge tone="cyan" className="hidden sm:inline-flex">
            <LiveDot />
            {BOT_CHAIN.name}
          </Badge>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPalette}
            className="hidden items-center gap-2 rounded-xl border border-surface-border bg-surface-subtle px-3 py-2 text-xs text-text-muted transition-colors hover:border-surface-border-strong hover:text-text-secondary sm:flex"
            aria-label="Open command palette"
          >
            <Command className="h-3.5 w-3.5" />
            Kill switch
            <span className="kbd">⌘K</span>
          </button>

          {wrongChain ? (
            <Button variant="danger" size="md" onClick={wallet.switchNetwork}>
              <AlertTriangle className="h-4 w-4" />
              Switch to BOT Chain
            </Button>
          ) : connected ? (
            <button
              onClick={wallet.disconnect}
              title="Disconnect"
              className="flex items-center gap-2 rounded-xl border border-brand-emerald/30 bg-brand-emerald/10 px-3 py-2 font-mono text-xs text-brand-emerald transition-colors hover:bg-brand-emerald/20"
            >
              <LiveDot />
              {shortAddress(wallet.address)}
            </button>
          ) : (
            <Button onClick={wallet.connect} loading={wallet.connecting} size="md">
              <Wallet className="h-4 w-4" />
              Connect
            </Button>
          )}
        </div>
      </nav>

      {wallet.error && (
        <div className="border-t border-brand-red/20 bg-brand-red/10 px-4 py-2 text-center text-xs text-brand-red">
          {wallet.error}
        </div>
      )}
    </header>
  );
}
