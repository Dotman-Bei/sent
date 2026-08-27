# Sent — Roadmap

Sent v0.1 is the smallest thing that is actually trustworthy: a breaker an agent
cannot talk its way past, and a receipt anyone can read. Everything below builds
on that same primitive.

---

## v0.1 — Circuit Breaker *(shipped)*

- `AgentRegistry`, `CircuitBreaker`, `BudgetVault` on BOT Chain Mainnet
- Four budget ceilings: steps, tokens, cumulative gas, wall-clock deadline
- Automatic escrow refund on halt, plus an owner kill switch
- Immutable `HaltRecord` per halt — reason, timestamp, usage, refund
- React dashboard + halt explorer reading directly from chain
- Python reference integration (`agent_runner.py`)

## v0.2 — AgentWatch — *Sep 2026*

Monitoring, so operators see the trip coming.

- Live per-agent burn-rate charts sourced from `StepApproved` events
- Threshold alerts at 70% / 90% of any ceiling
- Discord + Telegram webhooks on halt and near-halt
- Historical analytics: which reason trips most, cost saved per halt

## v0.3 — AgentGuard — *Oct 2026*

Reputation, so budgets can be earned rather than guessed.

- Public reputation score per agent id, derived from halt history
- Validator staking on halt conditions, with slashing for false attestations
- Multi-signer budgets — halts requiring operator quorum
- Allowlist/denylist registry other protocols can query before calling an agent

## v0.4 — AgentBudget — *Nov 2026*

Treasury, so teams can manage agent spend the way they manage any other spend.

- Shared budget pools across a fleet of agents
- Yield on idle escrow while agents are between runs
- Per-team spend caps and delegated budget grants
- Cost attribution export for finance

## v1.0 — SDK — *Q1 2027*

Integration in one import.

- First-class wrappers for LangChain, LangGraph, AutoGen, CrewAI
- TypeScript SDK matching the Python runner
- Local simulation mode — test budget logic without spending gas
- Audited contracts, versioned and upgrade-safe

---

## Out of scope (deliberately)

- **Full oracle network** — the breaker is deterministic on-chain state; adding
  an oracle would add trust, not remove it.
- **Cross-chain breakers** — worth doing only once single-chain semantics are
  settled and audited.
- **Model-specific integrations** — Sent counts tokens and steps; it does not
  need to know which model produced them.
