/// <reference types="vite/client" />

// Every VITE_* var is inlined into the client bundle at build time and is
// therefore PUBLIC. Never put a private key or any secret here.
interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_EXPLORER_URL?: string;
  readonly VITE_BUDGET_VAULT_ADDRESS?: string;
  readonly VITE_AGENT_REGISTRY_ADDRESS?: string;
  readonly VITE_CIRCUIT_BREAKER_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
