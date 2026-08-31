import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * End-to-end demo: register a deliberately under-budgeted agent, run it until
 * the circuit breaker trips, and print the on-chain halt proof.
 *
 *   npx hardhat node                       # terminal 1
 *   npm run demo                           # terminal 2
 */

const REASONS = ["NONE", "MAX_STEPS", "MAX_TOKENS", "MAX_GAS", "DEADLINE", "MANUAL"];

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment for "${network.name}". Run the deploy script first.`);
  }
  const { contracts } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const [operator] = await ethers.getSigners();
  const registry = await ethers.getContractAt("AgentRegistry", contracts.AgentRegistry, operator);
  const breaker = await ethers.getContractAt("CircuitBreaker", contracts.CircuitBreaker, operator);
  const vault = await ethers.getContractAt("BudgetVault", contracts.BudgetVault, operator);

  const label = `runaway-${Date.now().toString().slice(-6)}`;
  const agentId = ethers.encodeBytes32String(label);
  const escrow = ethers.parseEther("0.01");

  console.log("\n🤖 Sent, runaway agent demo");
  console.log("   agent :", label);
  console.log("   budget: 5 steps · 1000 tokens · 10 min deadline");
  console.log("   escrow:", ethers.formatEther(escrow), "BOT\n");

  await (
    await registry.registerAgent(agentId, 5, 1000, 0, 600, { value: escrow })
  ).wait();
  console.log("✅ registered, budget escrowed on-chain\n");

  let step = 0;
  // The "runaway" loop: no local guard rail at all. Only the chain can stop it.
  while (step < 50) {
    step += 1;
    const tokensUsed = 150 + Math.floor(Math.random() * 250);

    const receipt = await (await breaker.checkLimits(agentId, tokensUsed)).wait();

    if (await breaker.halted(agentId)) {
      const record = await breaker.haltRecords(agentId);
      console.log(`\n🛑 HALTED at step ${step}`);
      console.log("   reason  :", REASONS[Number(record.reason)]);
      console.log("   message :", record.message);
      console.log("   steps   :", record.stepCount.toString());
      console.log("   tokens  :", record.tokenCount.toString());
      console.log("   refunded:", ethers.formatEther(record.refunded), "BOT");
      console.log("   proof tx:", receipt?.hash);
      console.log(
        "   vault balance now:",
        ethers.formatEther(await vault.balances(operator.address)),
        "BOT"
      );
      return;
    }

    console.log(
      `   step ${String(step).padStart(2)} ok  | +${tokensUsed} tokens ` +
        `| total ${(await registry.tokenCounts(agentId)).toString()}`
    );
  }

  console.log("\nAgent finished inside budget (unexpected for this demo).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
