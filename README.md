# Sent — On-Chain Agent Circuit Breaker

> Stop runaway AI agents with a kill switch they don't control.

**BOT Chain Builder Challenge #2 · AI Native Applications track · BOT Chain Mainnet**

Sent is a decentralized circuit breaker for AI agents. An agent registers an
execution budget — max steps, max tokens, cumulative gas, wall-clock deadline —
and calls the breaker before every step. The moment a ceiling is crossed, the
contract halts the run in the same transaction, refunds the escrowed budget, and
writes an immutable `HaltRecord` proving **why** it stopped.

---

## The problem

Reddit is full of the same complaint: agents are unreliable and expensive in a way
you only find out about afterwards.

> *"my agent looped 400 times overnight, $52 gone"*
> *"there's no kill switch I can trust"*
> *"it retried a hallucinated tool call until the key rate-limited"*

Today, every guard rail lives **inside** the agent process: a `max_iterations`
constant, a try/except that swallows the loop, a budget check that dies with the
crash that caused it. The thing being limited is also the thing enforcing the
limit.

Sent moves the limit somewhere the agent cannot reach — a contract it does not
control. The breaker reads the same for the operator, the auditor, and the user
paying the bill.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER / DEVELOPER                          │
│      Registers agent + budget → escrows BOT → runs the agent     │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       BOT CHAIN MAINNET                          │
│                                                                  │
│  ┌────────────────┐   ┌─────────────────┐   ┌─────────────────┐  │
│  │ AgentRegistry  │   │ CircuitBreaker  │   │  BudgetVault    │  │
│  │  profiles      │◀──│  checkLimits()  │──▶│  deposit()      │  │
│  │  stepCounts    │   │  manualHalt()   │   │  lock()         │  │
│  │  tokenCounts   │   │  completeAgent()│   │  release()      │  │
│  │  gasCounts     │   │  _halt()        │   │  withdraw()     │  │
│  │  incrementUsage│   └────────┬────────┘   └─────────────────┘  │
│  └────────────────┘            │                                 │
│      only the breaker          ▼                                 │
│      may write usage    ┌─────────────┐                          │
│                         │ HaltRecord  │  ← on-chain proof        │
│                         │  reason     │                          │
│                         │  timestamp  │                          │
│                         │  steps      │                          │
│                         │  tokens     │                          │
│                         │  refunded   │                          │
│                         └─────────────┘                          │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    AGENT RUNNER (Python)                         │
│  1. read budget from AgentRegistry                               │
│  2. run one step                                                 │
│  3. CircuitBreaker.checkLimits(agentId, tokensUsed)              │
│  4. halted → stop, read the proof, escrow already refunded       │
└──────────────────────────────────────────────────────────────────┘
```

### Halt reasons

| Code | Fires when |
|------|-----------|
| `MAX_STEPS` | The agent has already used its step ceiling |
| `MAX_TOKENS` | Tokens so far **plus this step** would exceed the ceiling |
| `MAX_GAS` | Cumulative on-chain gas for this agent exceeds `maxGas` (`0` disables) |
| `DEADLINE` | `block.timestamp` passed the registered deadline |
| `MANUAL` | The owner tripped the breaker themselves |

---

## Networks

Verified against
[dev-docs.botchain.ai](https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/).
Note the testnet RPC is on `bohr.life`, **not** `botchain.ai`.

| Network | Chain ID | RPC | Faucet |
|---------|----------|-----|--------|
| BOT Chain Testnet | `968` | `https://rpc.bohr.life` | [faucet.botchain.ai](https://faucet.botchain.ai/basic) |
| BOT Chain Mainnet | `677` | `https://rpc.botchain.ai` | — |

Explorers: [scan.bohr.life](https://scan.bohr.life) (testnet) ·
[scan.botchain.ai](https://scan.botchain.ai) (mainnet). Block time is ~0.75s on
both, which matters when choosing `getLogs` lookback windows.

> build.md quoted chainId `2017` for mainnet. That is incorrect — the live chain
> reports `677`. Deploying against 2017 would have had every transaction rejected.

## Contract addresses

### BOT Chain Testnet (chainId 968) — **live**

| Contract | Address |
|----------|---------|
| `CircuitBreaker` | `0x959A3B3d2856288E044136dAF3e7823f8dD7A449` |
| `AgentRegistry` | `0x521C15E3cF59a062204279EC715e81859d95B5AF` |
| `BudgetVault` | `0x3822E863D851DfC9CD0cfaF687195928461f72e4` |

**End-to-end verified on testnet — 40/40 assertions passing.** Reproduce with:

```bash
npm run e2e:testnet
```

| # | Checked on live testnet | Result |
|---|---|---|
| 1 | Deployment wiring + cross-contract references | pass |
| 2 | Register with escrow -> `MAX_TOKENS` halt -> auto-refund | pass |
| 3 | `MAX_STEPS` ceiling | pass |
| 4 | `DEADLINE` ceiling | pass |
| 5 | `MAX_GAS` ceiling | pass |
| 6 | Owner-only manual kill switch | pass |
| 7 | `completeAgent` releases escrow without a halt | pass |
| 8 | Withdraw refunded balance to wallet | pass |
| 9 | Access control holds against a stranger | pass |
| 10 | Halt history integrity, all 5 reasons present | pass |

The Python runner (`agent_runner.py`) was also run against testnet and halted on
`MAX_TOKENS` at step 5 —
[proof tx `0x0fa6df53…`](https://scan.bohr.life/tx/0x0fa6df538883572ca9d99bffcda85a27fbdd7f66027f1a246d732567e56e7c13).

### Frontend verified in a real browser — 15/15

`frontend/scripts/verify-ui.mjs` drives the production build in headless
Chromium against live testnet data:

```bash
cd frontend
VITE_RPC_URL=https://rpc.bohr.life VITE_CHAIN_ID=968 npm run build
npx vite preview --port 4173 &
node scripts/verify-ui.mjs
```

Asserts React mounts, agent labels and all 10 halt proofs render from chain, the
Recharts usage curve draws against its ceiling, Ctrl+K and the register modal
open, no runtime errors or failed requests, and no horizontal overflow at 390px.

### BOT Chain Mainnet (chainId 677) — **live**

| Contract | Address |
|----------|---------|
| `CircuitBreaker` | `0x959A3B3d2856288E044136dAF3e7823f8dD7A449` |
| `AgentRegistry` | `0x521C15E3cF59a062204279EC715e81859d95B5AF` |
| `BudgetVault` | `0x3822E863D851DfC9CD0cfaF687195928461f72e4` |

Mainnet and testnet share these addresses: the same deployer created all three
at nonces 0-2 on both chains, and a CREATE address derives only from the
deployer and nonce. Always check the chainId alongside the address.

Deployment cost 3,371,141 gas (0.0674 BOT at 20 gwei). Verified on-chain after
deploy: bytecode present at all three addresses, all three permission flags
set, and every cross-contract reference matching.

`scripts/deploy.ts` writes these into `deployments/<network>.json` and
`frontend/src/config/addresses.ts` automatically.

---

## Quick start

### 1. Contracts

```bash
npm install
cp .env.example .env          # add PRIVATE_KEY
npm run compile
npm test                      # 23 tests
```

### 2. Deploy

```bash
# local
npx hardhat node              # terminal 1
npm run deploy:local          # terminal 2
npm run seed -- --network localhost   # optional demo data

# BOT Chain Testnet  (get tBOT from faucet.botchain.ai/basic first)
npm run deploy:testnet
npm run seed -- --network botchain_testnet

# BOT Chain Mainnet
npm run deploy:botchain
```

Deploying writes contract addresses **and** ABIs into both the frontend and the
Python runner, so nothing has to be copied by hand.

> Apply for Gas Support (1 BOT) via the Google Form on the
> [Luma event page](https://luma.com/238et7cw) before the mainnet deploy.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Against a local chain, point the UI at it:

```bash
VITE_RPC_URL=http://127.0.0.1:8545 VITE_CHAIN_ID=31337 npm run dev
```

### 4. Runaway agent demo

```bash
# TypeScript version, no extra deps
npm run demo

# Python version — the reference integration
cd agent-runner
pip install -r requirements.txt
cp .env.example .env          # add PRIVATE_KEY
python agent_runner.py --label runaway-demo --max-steps 5 --max-tokens 1000
```

Expected output:

```
  step  1 ok  | +386 tokens | total 386
  step  2 ok  | +236 tokens | total 622
  step  3 ok  | +212 tokens | total 834

🛑 HALTED at step 4
   reason  : MAX_TOKENS
   message : Max tokens exceeded
   refunded: 0.01 BOT
   proof tx: 0x0563838…
```

---

## Deploying the frontend to Vercel

The frontend is a static SPA that reads BOT Chain directly from the browser.
There is no server, no API route and no database — so **there are no secrets to
configure.**

### Project settings

| Setting | Value |
|---------|-------|
| Root Directory | **`frontend`** (required — this is a monorepo) |
| Framework Preset | Vite |
| Build Command | `npm run build` (default) |
| Output Directory | `dist` (default) |

Everything except Root Directory is picked up from `frontend/vercel.json`.

### Environment variables

Set these three for **Production, Preview and Development**:

| Name | Testnet value | Mainnet value |
|------|---------------|---------------|
| `VITE_CHAIN_ID` | `968` | `677` |
| `VITE_RPC_URL` | `https://rpc.bohr.life` | `https://rpc.botchain.ai` |
| `VITE_EXPLORER_URL` | `https://scan.bohr.life` | `https://scan.botchain.ai` |

Optional — only if you want a hosted build pointed at a deployment other than
the one committed in `src/config/addresses.ts`:

| Name | Purpose |
|------|---------|
| `VITE_BUDGET_VAULT_ADDRESS` | Override the vault address |
| `VITE_AGENT_REGISTRY_ADDRESS` | Override the registry address |
| `VITE_CIRCUIT_BREAKER_ADDRESS` | Override the breaker address |

> **Never add `PRIVATE_KEY`, a mnemonic, or any secret to Vercel.**
> Vite inlines every `VITE_`-prefixed variable into the JavaScript bundle sent
> to browsers. Anything set here is readable by anyone who opens devtools. All
> six variables above are public by design — RPC URLs and on-chain addresses.
> The deployer key belongs only in the root `.env`, which is gitignored and used
> solely by Hardhat on your machine.

Vite requires the `VITE_` prefix; a variable named anything else is ignored at
build time. Env changes only take effect on a **redeploy**, since they are baked
in at build.

---

## Integrating Sent into your own agent

One call at the top of your loop is the whole integration:

```python
while not done:
    if not breaker.functions.checkLimits(agent_id, tokens_used).call():
        break          # the chain said stop — escrow is already refunded
    step()
```

`checkLimits` returns `false` instead of reverting, so your agent can read the
halt reason from the same transaction and shut down cleanly.

---

## Project layout

```
sent-botchain/
├── contracts/
│   ├── BudgetVault.sol       escrow, refunds, withdrawals
│   ├── AgentRegistry.sol     budget profiles + usage counters
│   └── CircuitBreaker.sol    the breaker itself
├── scripts/
│   ├── deploy.ts             deploys, wires permissions, exports ABIs
│   ├── demo.ts               runaway agent, TypeScript
│   └── seed.ts               populates a deployment with demo data
├── test/Sent.test.ts         23 tests
├── frontend/                 React + Vite + Tailwind + ethers v6
├── agent-runner/             Python + web3.py reference integration
├── PITCH.md
└── ROADMAP.md
```

---

## Security notes

The contracts follow the checklist for this submission:

- **Access control** — only the `CircuitBreaker` can write usage counters, so an
  agent cannot inflate its own accounting to dodge a limit, and a third party
  cannot burn someone else's budget. Only the owner can authorize a breaker.
- **ReentrancyGuard** on every path that moves native BOT out of the vault.
- **Refunds cannot block a halt** — `vault.release()` is wrapped in `try/catch`
  inside `_halt`, so a vault failure can never keep a runaway agent alive.
- **`call` over `transfer`** for payouts, so refunds don't break on gas repricing.
- **Custom errors** everywhere, and events on every state change.
- **No hardcoded keys** — everything comes from `.env`, which is gitignored.

Compiles with **zero warnings** under Solidity 0.8.20.

---

## Testing

```
23 passing
```

Coverage spans all five halt reasons, escrow lock/refund/withdraw, access
control on every privileged function, halt-history append-only behaviour, and
the read-only `wouldHalt` preview.

---

## Configuration

Network values default to mainnet (`https://rpc.botchain.ai` / `677`) and testnet
(`https://rpc.bohr.life` / `968`), overridable in `.env` (contracts) or with
`VITE_*` vars (frontend).

Point the frontend at the live testnet deployment:

```bash
cd frontend
VITE_RPC_URL=https://rpc.bohr.life VITE_CHAIN_ID=968 npm run dev
```

---

## Links

| Resource | Link |
|----------|------|
| Luma event page | https://luma.com/238et7cw |
| BOT Chain Builder Hub | https://t.me/BotChain_official/61 |
| BOT Chain | https://www.botchain.ai/en |
| Demo video | `<add before submission>` |
| Live demo | `<add Vercel/Netlify URL>` |

## Team

`<add team members + contact before submission>`

## License

MIT
