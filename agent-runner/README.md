# Sent — Agent Runner

Simulated runaway AI agent. No local guard rails: every step asks the on-chain
`CircuitBreaker` for permission, and the chain is what stops it.

```bash
pip install -r requirements.txt
cp .env.example .env      # add PRIVATE_KEY
python agent_runner.py --label runaway-demo --max-steps 5 --max-tokens 1000
```

Against a local Hardhat node:

```bash
python agent_runner.py --network localhost --rpc http://127.0.0.1:8545 --chain-id 31337
```

| Flag | Meaning |
|------|---------|
| `--label` | Agent id, packed into `bytes32` (≤31 chars) |
| `--max-steps` / `--max-tokens` | The budget registered on-chain |
| `--max-gas` | Cumulative on-chain gas ceiling (`0` disables) |
| `--duration` | Deadline in seconds from registration |
| `--steps` | How many times the runaway loop will try to run |
| `--skip-register` | Reuse an agent that is already registered |

ABIs in `abis/` are written by `scripts/deploy.ts`.
