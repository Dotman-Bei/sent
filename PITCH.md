# Sent — Pitch

**On-chain circuit breaker for AI agents.**
BOT Chain Builder Challenge #2 · AI Native Applications

---

## Slide 1 — The Problem

### Agents fail expensively, and you find out afterwards.

> *"my agent looped 400 times overnight, $52 gone"*
> *"I woke up to a $200 bill from one bad prompt"*
> *"there's no kill switch I can trust"*
> — r/LocalLLaMA, r/AI_Agents, r/LangChain

Every guard rail today lives **inside** the agent process:

- `max_iterations` — a constant the model can reason its way past
- `try/except` — swallows the exact loop it was meant to catch
- a budget counter — dies in the same crash that caused the runaway

**The thing being limited is also the thing enforcing the limit.**

---

## Slide 2 — The Solution

### Sent puts the limit somewhere the agent can't reach.

```
register budget  →  agent calls checkLimits() each step  →  ceiling crossed
                                                                  ↓
                          agent deactivated · escrow refunded · proof written
```

Three contracts on BOT Chain Mainnet:

| Contract | Job |
|----------|-----|
| `AgentRegistry` | Immutable budget profiles + usage counters only the breaker can write |
| `CircuitBreaker` | Trips on steps, tokens, gas or deadline — in the same transaction |
| `BudgetVault` | Escrows the run's budget, refunds it automatically on halt |

Five halt reasons, every one of them a public record:
`MAX_STEPS` · `MAX_TOKENS` · `MAX_GAS` · `DEADLINE` · `MANUAL`

**Integration is one line at the top of your loop.**

---

## Slide 3 — Live Demo (60 seconds)

1. **Register** — `runaway-demo`, 5 steps / 1,000 tokens / 0.01 BOT escrowed
2. **Run** — `agent_runner.py`, a loop with no local guard rails at all
3. **Trip** — step 4 crosses the token ceiling; the chain stops it mid-run
4. **Proof** — `HaltRecord` on the explorer: reason, steps, tokens, refund, tx hash
5. **Refund** — 0.01 BOT already back in the owner's vault balance

Nothing in that flow is trusted. Nothing is written by a server.

---

## Slide 4 — Why BOT Chain

- **EVM-compatible** — Solidity 0.8.20, Hardhat, ethers, MetaMask, day one
- **AI-native ecosystem** — agent safety is infrastructure other BOT Chain AI
  projects can depend on, not a standalone app
- **Cheap enough to be per-step** — a breaker only works if checking it is
  affordable on every iteration
- **Native BOT** — gas, budget escrow and refunds all denominated in BOT
- Gas Support applied for via the official form

---

## Slide 5 — Roadmap & Ask

| Version | What ships |
|---------|-----------|
| **v0.1** *(today)* | Circuit breaker, registry, vault — live on Mainnet |
| **v0.2** | **AgentWatch** — monitoring dashboard, alerts before the trip |
| **v0.3** | **AgentGuard** — reputation registry + validator staking on halt conditions |
| **v0.4** | **AgentBudget** — DeFi vaults for agent cost management |
| **v1.0** | SDK for LangChain / LangGraph / AutoGen / CrewAI |

**The ask:** ecosystem support to make Sent the default safety layer every AI
agent on BOT Chain registers against — so "did it halt, and why" has one
answer everyone can read.

---

### One-liner

> Sent is a decentralized circuit breaker that stops AI agents from looping
> forever or burning through budget — enforced on-chain, refunded automatically,
> with immutable proof of why it stopped.
