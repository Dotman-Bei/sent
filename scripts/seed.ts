import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Seeds a deployment with a spread of agents so the dashboard and halt
 * explorer have real data to render during a demo. Every state below is
 * produced by genuine on-chain activity, nothing is mocked.
 *
 *   npx hardhat run scripts/seed.ts --network localhost
 */

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment for "${network.name}". Deploy first.`);
  }
  const { contracts } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const [operator] = await ethers.getSigners();
  const registry = await ethers.getContractAt("AgentRegistry", contracts.AgentRegistry, operator);
  const breaker = await ethers.getContractAt("CircuitBreaker", contracts.CircuitBreaker, operator);

  const stamp = Date.now().toString().slice(-5);
  const id = (name: string) => ethers.encodeBytes32String(`${name}-${stamp}`);

  // 1. Healthy agent, well inside budget.
  const healthy = id("research");
  await (await registry.registerAgent(healthy, 40, 60_000, 0, 3600)).wait();
  for (let i = 0; i < 6; i++) await (await breaker.checkLimits(healthy, 1200)).wait();
  console.log("✔ healthy agent registered and running");

  // 2. Agent in the amber band (>70% of its token ceiling).
  const amber = id("summarizer");
  await (await registry.registerAgent(amber, 20, 5_000, 0, 3600)).wait();
  for (let i = 0; i < 4; i++) await (await breaker.checkLimits(amber, 950)).wait();
  console.log("✔ amber-band agent at ~76% of token ceiling");

  // 3. Agent halted on MAX_TOKENS, with escrow refunded.
  const tokenHalt = id("runaway");
  await (
    await registry.registerAgent(tokenHalt, 50, 800, 0, 3600, {
      value: ethers.parseEther("0.02"),
    })
  ).wait();
  await (await breaker.checkLimits(tokenHalt, 500)).wait();
  await (await breaker.checkLimits(tokenHalt, 500)).wait(); // trips
  console.log("✔ MAX_TOKENS halt recorded");

  // 4. Agent halted on MAX_STEPS.
  const stepHalt = id("looper");
  await (await registry.registerAgent(stepHalt, 3, 1_000_000, 0, 3600)).wait();
  for (let i = 0; i < 4; i++) await (await breaker.checkLimits(stepHalt, 10)).wait();
  console.log("✔ MAX_STEPS halt recorded");

  // 5. Agent stopped by the operator kill switch.
  const manual = id("rogue-tool");
  await (await registry.registerAgent(manual, 30, 20_000, 0, 3600)).wait();
  await (await breaker.checkLimits(manual, 400)).wait();
  await (await breaker.manualHalt(manual, "Operator killed: unsafe tool call")).wait();
  console.log("✔ MANUAL halt recorded");

  const halts = await breaker.haltCount();
  console.log(`\nSeed complete, ${await registry.agentCount()} agents, ${halts} halt proofs.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
