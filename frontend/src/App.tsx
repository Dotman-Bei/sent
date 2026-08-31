import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { DashboardDock } from "@/components/DashboardDock";
import { ValueBanner } from "@/components/ValueBanner";
import { FeatureBento } from "@/components/FeatureBento";
import { Spotlight } from "@/components/Spotlight";
import { HaltExplorer } from "@/components/HaltExplorer";
import { RegisterAgentModal } from "@/components/RegisterAgentModal";
import { CommandPalette } from "@/components/CommandPalette";
import { Footer, PreFooterCTA } from "@/components/Footer";
import { useWallet } from "@/hooks/useWallet";
import { useSentData } from "@/hooks/useSentData";
import { isDeployed, type AgentView } from "@/lib/contracts";

export default function App() {
  const wallet = useWallet();
  const data = useSentData(wallet.address);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [haltTarget, setHaltTarget] = useState<AgentView | null>(null);

  // ⌘K / Ctrl+K opens the kill switch from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setHaltTarget(null);
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = useCallback((agent?: AgentView) => {
    setHaltTarget(agent ?? null);
    setPaletteOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Nav wallet={wallet} onOpenPalette={() => openPalette()} />

      <main>
        {!isDeployed && <DeploymentNotice />}

        <Hero haltCount={data.halts.length} onRegister={() => setRegisterOpen(true)} />
        <DashboardDock
          data={data}
          onRegister={() => setRegisterOpen(true)}
          onHalt={(agent) => openPalette(agent)}
        />
        <ValueBanner />
        <FeatureBento onOpenPalette={() => openPalette()} />
        <Spotlight data={data} />
        <HaltExplorer data={data} />
        <PreFooterCTA onRegister={() => setRegisterOpen(true)} />
      </main>

      <Footer />

      <RegisterAgentModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        wallet={wallet}
        onRegistered={data.refresh}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        agents={data.agents}
        wallet={wallet}
        preselect={haltTarget}
        onHalted={data.refresh}
      />
    </div>
  );
}

/** Shown until scripts/deploy.ts writes real addresses into config/addresses.ts. */
function DeploymentNotice() {
  return (
    <div className="fixed inset-x-0 top-16 z-40 border-b border-brand-amber/20 bg-brand-amber/10 px-4 py-2.5">
      <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center text-xs text-brand-amber">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Contracts are not deployed yet. Run{" "}
        <code className="font-mono">npm run deploy:botchain</code> to populate live data.
      </p>
    </div>
  );
}
