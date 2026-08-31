"""
Sent, simulated runaway agent runner.

A deliberately unbounded agent loop with no local guard rails. Before every
step it asks the on-chain CircuitBreaker for permission. When the budget is
breached the breaker trips, the loop stops, and the halt proof is read back
from the chain.

Usage:
    pip install -r requirements.txt
    cp .env.example .env      # fill in PRIVATE_KEY + addresses
    python agent_runner.py --steps 50 --label runaway-demo
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3
from web3.exceptions import ContractLogicError

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

HALT_REASONS = ["NONE", "MAX_STEPS", "MAX_TOKENS", "MAX_GAS", "DEADLINE", "MANUAL"]

RPC_URL = os.getenv("BOTCHAIN_RPC_URL", "https://rpc.botchain.ai")
CHAIN_ID = int(os.getenv("BOTCHAIN_CHAIN_ID", "677"))
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")


def load_abi(name: str) -> list:
    """ABIs are exported by scripts/deploy.ts into agent-runner/abis/."""
    path = ROOT / "abis" / f"{name}.json"
    if not path.exists():
        sys.exit(f"Missing ABI {path}. Run the Hardhat deploy script first.")
    return json.loads(path.read_text(encoding="utf-8"))


def load_addresses(network: str) -> dict:
    """Prefer deployments/<network>.json, fall back to env vars."""
    path = ROOT.parent / "deployments" / f"{network}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))["contracts"]

    addresses = {
        "AgentRegistry": os.getenv("AGENT_REGISTRY_ADDRESS", ""),
        "CircuitBreaker": os.getenv("CIRCUIT_BREAKER_ADDRESS", ""),
        "BudgetVault": os.getenv("BUDGET_VAULT_ADDRESS", ""),
    }
    if not all(addresses.values()):
        sys.exit(f"No deployment at {path} and contract addresses are not set in .env.")
    return addresses


class Runner:
    def __init__(self, args: argparse.Namespace) -> None:
        if not PRIVATE_KEY:
            sys.exit("PRIVATE_KEY is not set. Copy .env.example to .env and fill it in.")

        self.w3 = Web3(Web3.HTTPProvider(args.rpc))
        if not self.w3.is_connected():
            sys.exit(f"Cannot reach RPC at {args.rpc}")

        self.account = self.w3.eth.account.from_key(PRIVATE_KEY)
        self.chain_id = args.chain_id
        addresses = load_addresses(args.network)

        self.registry = self.w3.eth.contract(
            address=Web3.to_checksum_address(addresses["AgentRegistry"]),
            abi=load_abi("AgentRegistry"),
        )
        self.breaker = self.w3.eth.contract(
            address=Web3.to_checksum_address(addresses["CircuitBreaker"]),
            abi=load_abi("CircuitBreaker"),
        )
        # bytes32 id, matching ethers.encodeBytes32String on the frontend.
        self.agent_id = args.label.encode("utf-8").ljust(32, b"\x00")
        self.label = args.label

    # ------------------------------------------------------------------ chain

    def send(self, fn, value: int = 0) -> dict:
        """Build, sign and mine one transaction."""
        params = {
            "from": self.account.address,
            "nonce": self.w3.eth.get_transaction_count(self.account.address),
            "gas": 400_000,
            "gasPrice": self.w3.eth.gas_price,
            "chainId": self.chain_id,
        }
        if value:
            params["value"] = value
        tx = fn.build_transaction(params)
        signed = self.account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
        tx_hash = self.w3.eth.send_raw_transaction(raw)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def register(self, args: argparse.Namespace) -> None:
        if self.registry.functions.owners(self.agent_id).call() != (
            "0x" + "0" * 40
        ):
            print(f"Agent '{self.label}' already registered, reusing it.")
            return

        print(
            f"Registering '{self.label}' | {args.max_steps} steps "
            f"| {args.max_tokens} tokens | {args.duration}s deadline"
        )
        escrow_wei = self.w3.to_wei(str(args.escrow), "ether") if args.escrow else 0
        if escrow_wei:
            print(f"  escrowing {args.escrow} BOT - refunded to the vault on halt")
        receipt = self.send(
            self.registry.functions.registerAgent(
                self.agent_id,
                args.max_steps,
                args.max_tokens,
                args.max_gas,
                args.duration,
            ),
            value=escrow_wei,
        )
        print(f"  registered in block {receipt['blockNumber']}\n")

    # ------------------------------------------------------------------- loop

    def run(self, args: argparse.Namespace) -> int:
        print(f"Running agent 0x{self.agent_id.hex()} against the on-chain breaker\n")
        step = 0

        while step < args.steps:
            step += 1
            tokens_used = random.randint(args.min_tokens, args.max_tokens_per_step)

            try:
                receipt = self.send(
                    self.breaker.functions.checkLimits(self.agent_id, tokens_used)
                )
            except ContractLogicError as exc:
                print(f"\nBreaker rejected the call: {exc}")
                return 1

            if self.breaker.functions.halted(self.agent_id).call():
                self.report_halt(step, receipt)
                return 0

            total = self.registry.functions.tokenCounts(self.agent_id).call()
            print(f"  step {step:>2} ok  | +{tokens_used} tokens | total {total}")
            time.sleep(args.delay)

        print("\nAgent completed inside budget, the breaker never tripped.")
        return 0

    def report_halt(self, step: int, receipt: dict) -> None:
        record = self.breaker.functions.haltRecords(self.agent_id).call()
        agent_id, reason, timestamp, steps, tokens, refunded, message = record

        print(f"\n{'=' * 56}")
        print(f"  HALTED at step {step}")
        print(f"{'=' * 56}")
        print(f"  reason   : {HALT_REASONS[reason]}")
        print(f"  message  : {message}")
        print(f"  steps    : {steps}")
        print(f"  tokens   : {tokens}")
        print(f"  refunded : {Web3.from_wei(refunded, 'ether')} BOT")
        print(f"  timestamp: {timestamp}")
        tx_hash = receipt["transactionHash"].hex()
        if not tx_hash.startswith("0x"):
            tx_hash = "0x" + tx_hash  # web3 v7 drops the prefix
        print(f"  proof tx : {tx_hash}")
        print(f"  block    : {receipt['blockNumber']}")
        print(f"{'=' * 56}")
        print("  This halt is now immutable on BOT Chain.")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Sent, runaway agent simulator")
    p.add_argument("--label", default="demo-agent-1", help="agent id (max 31 chars)")
    p.add_argument("--network", default="botchain", help="deployments/<network>.json")
    p.add_argument("--rpc", default=RPC_URL)
    p.add_argument("--chain-id", type=int, default=CHAIN_ID)
    p.add_argument("--steps", type=int, default=50, help="max loop iterations")
    p.add_argument("--delay", type=float, default=1.5, help="seconds between steps")
    p.add_argument("--max-steps", type=int, default=5, help="budget: max steps")
    p.add_argument("--max-tokens", type=int, default=1000, help="budget: max tokens")
    p.add_argument("--max-gas", type=int, default=0, help="budget: max gas (0 = off)")
    p.add_argument("--duration", type=int, default=600, help="budget: seconds")
    p.add_argument("--min-tokens", type=int, default=100)
    p.add_argument("--max-tokens-per-step", type=int, default=500)
    p.add_argument(
        "--escrow",
        default="0",
        help="BOT to escrow against the agent; refunded automatically on halt",
    )
    p.add_argument("--skip-register", action="store_true")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if len(args.label) > 31:
        sys.exit("--label must be 31 characters or fewer (it is packed into bytes32).")

    runner = Runner(args)
    if not args.skip_register:
        runner.register(args)
    sys.exit(runner.run(args))
