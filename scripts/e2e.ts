import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Full end-to-end lifecycle check against a live network.
 *
 *   npx hardhat run scripts/e2e.ts --network botchain_testnet
 *
 * Exercises every user-facing path, asserting real on-chain state at each
 * step. Exits non-zero on the first failed assertion.
 */

const REASONS = ["NONE", "MAX_STEPS", "MAX_TOKENS", "MAX_GAS", "DEADLINE", "MANUAL"];

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = String(actual) === String(expected);
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `  (got ${actual}, want ${expected})`));
  ok ? passed++ : failed++;
}

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const { contracts, chainId } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const [me] = await ethers.getSigners();
  const registry = await ethers.getContractAt("AgentRegistry", contracts.AgentRegistry, me);
  const breaker = await ethers.getContractAt("CircuitBreaker", contracts.CircuitBreaker, me);
  const vault = await ethers.getContractAt("BudgetVault", contracts.BudgetVault, me);

  const tag = Date.now().toString().slice(-6);
  const id = (n: string) => ethers.encodeBytes32String(`e2e-${n}-${tag}`);

  console.log(`\nSent, end-to-end on ${network.name} (chainId ${chainId})`);
  console.log(`Account: ${me.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(me.address))} BOT\n`);

  // ---------------------------------------------------------------- 1. wiring
  console.log("1. Deployment wiring");
  check("breaker authorized on vault", await vault.authorizedBreakers(contracts.CircuitBreaker), true);
  check("registry authorized on vault", await vault.authorizedBreakers(contracts.AgentRegistry), true);
  check("breaker authorized on registry", await registry.authorized(contracts.CircuitBreaker), true);
  check("breaker points at registry", await breaker.registry(), contracts.AgentRegistry);
  check("breaker points at vault", await breaker.vault(), contracts.BudgetVault);

  // ------------------------------------------- 2. register with escrow + halt
  console.log("\n2. Register with escrow -> MAX_TOKENS halt -> auto-refund");
  const a1 = id("tokens");
  const escrow = ethers.parseEther("0.005");
  const balBefore = await vault.balances(me.address);

  await (await registry.registerAgent(a1, 50, 800, 0, 3600, { value: escrow })).wait();
  check("escrow locked", (await vault.getEscrow(a1)).amount, escrow);
  check("agent owner", await registry.owners(a1), me.address);
  check("agent active", (await registry.getProfile(a1)).active, true);

  await (await breaker.checkLimits(a1, 500)).wait();
  check("step 1 recorded", await registry.stepCounts(a1), 1n);
  check("tokens recorded", await registry.tokenCounts(a1), 500n);
  check("not yet halted", await breaker.halted(a1), false);

  const [wouldTrip, previewReason] = await breaker.wouldHalt(a1, 500);
  check("wouldHalt predicts trip", wouldTrip, true);
  check("wouldHalt reason", REASONS[Number(previewReason)], "MAX_TOKENS");

  await (await breaker.checkLimits(a1, 500)).wait(); // trips
  const rec1 = await breaker.haltRecords(a1);
  check("halted", await breaker.halted(a1), true);
  check("halt reason", REASONS[Number(rec1.reason)], "MAX_TOKENS");
  check("halt message", rec1.message, "Max tokens exceeded");
  check("steps in proof", rec1.stepCount, 1n);
  check("tokens in proof", rec1.tokenCount, 500n);
  check("refund in proof", rec1.refunded, escrow);
  check("agent deactivated", (await registry.getProfile(a1)).active, false);
  check("escrow released", (await vault.getEscrow(a1)).released, true);
  check("balance credited", await vault.balances(me.address), balBefore + escrow);

  // further calls must revert
  let reverted = false;
  try {
    await (await breaker.checkLimits(a1, 1)).wait();
  } catch {
    reverted = true;
  }
  check("post-halt call reverts", reverted, true);

  // ------------------------------------------------------ 3. MAX_STEPS ceiling
  console.log("\n3. MAX_STEPS ceiling");
  const a2 = id("steps");
  await (await registry.registerAgent(a2, 2, 1_000_000, 0, 3600)).wait();
  await (await breaker.checkLimits(a2, 10)).wait();
  await (await breaker.checkLimits(a2, 10)).wait();
  await (await breaker.checkLimits(a2, 10)).wait(); // trips
  check("halt reason", REASONS[Number((await breaker.haltRecords(a2)).reason)], "MAX_STEPS");
  check("stopped at ceiling", await registry.stepCounts(a2), 2n);

  // ------------------------------------------------------- 4. DEADLINE ceiling
  console.log("\n4. DEADLINE ceiling");
  const a3 = id("deadline");
  await (await registry.registerAgent(a3, 100, 1_000_000, 0, 1)).wait(); // 1s window
  await new Promise((r) => setTimeout(r, 6000)); // let the chain move past it
  await (await breaker.checkLimits(a3, 1)).wait();
  check("halt reason", REASONS[Number((await breaker.haltRecords(a3)).reason)], "DEADLINE");

  // ------------------------------------------------------- 5. MAX_GAS ceiling
  console.log("\n5. MAX_GAS ceiling");
  const a4 = id("gas");
  await (await registry.registerAgent(a4, 100, 1_000_000, 1000, 3600)).wait();
  await (await breaker.checkLimits(a4, 1)).wait(); // burns > 1000 gas
  await (await breaker.checkLimits(a4, 1)).wait(); // trips
  check("halt reason", REASONS[Number((await breaker.haltRecords(a4)).reason)], "MAX_GAS");

  // ------------------------------------------------------ 6. manual kill switch
  console.log("\n6. Manual kill switch (owner only)");
  const a5 = id("manual");
  await (await registry.registerAgent(a5, 30, 20_000, 0, 3600)).wait();
  await (await breaker.manualHalt(a5, "e2e operator stop")).wait();
  const rec5 = await breaker.haltRecords(a5);
  check("halt reason", REASONS[Number(rec5.reason)], "MANUAL");
  check("custom message stored", rec5.message, "e2e operator stop");

  // --------------------------------------- 7. clean completion releases escrow
  console.log("\n7. completeAgent releases escrow without a halt");
  const a6 = id("complete");
  const esc6 = ethers.parseEther("0.003");
  const bal6 = await vault.balances(me.address);
  await (await registry.registerAgent(a6, 10, 5000, 0, 3600, { value: esc6 })).wait();
  await (await breaker.checkLimits(a6, 100)).wait();
  await (await breaker.completeAgent(a6)).wait();
  check("not halted", await breaker.halted(a6), false);
  check("deactivated", (await registry.getProfile(a6)).active, false);
  check("escrow returned", await vault.balances(me.address), bal6 + esc6);

  // ------------------------------------------------------------- 8. withdrawal
  console.log("\n8. Withdraw refunded balance to wallet");
  const vaultBal = await vault.balances(me.address);
  const walletBefore = await ethers.provider.getBalance(me.address);
  const rcpt = await (await vault.withdraw(vaultBal)).wait();
  const gasCost = rcpt!.gasUsed * rcpt!.gasPrice;
  const walletAfter = await ethers.provider.getBalance(me.address);
  check("vault balance zeroed", await vault.balances(me.address), 0n);
  check("BOT arrived in wallet", walletAfter, walletBefore + vaultBal - gasCost);

  // -------------------------------------------------------- 9. access control
  console.log("\n9. Access control holds against a stranger");
  const stranger = ethers.Wallet.createRandom().connect(ethers.provider);
  const asStranger = registry.connect(stranger);
  let blocked = false;
  try {
    await asStranger.incrementUsage.staticCall(a2, 999, 0);
  } catch {
    blocked = true;
  }
  check("stranger cannot write usage", blocked, true);

  let haltBlocked = false;
  try {
    await breaker.connect(stranger).manualHalt.staticCall(a2, "hijack");
  } catch {
    haltBlocked = true;
  }
  check("stranger cannot halt", haltBlocked, true);

  // ------------------------------------------------------ 10. history integrity
  console.log("\n10. Halt history");
  const history = await breaker.getHaltHistory();
  const records = await breaker.getHaltRecords();
  check("history length matches records", history.length, records.length);
  check("haltCount matches", await breaker.haltCount(), BigInt(history.length));
  const reasonsSeen = new Set(records.map((r: any) => REASONS[Number(r.reason)]));
  console.log(`   reasons on chain: ${[...reasonsSeen].join(", ")}`);
  check("all four automatic reasons present",
    ["MAX_STEPS", "MAX_TOKENS", "MAX_GAS", "DEADLINE"].every((r) => reasonsSeen.has(r)), true);
  check("manual reason present", reasonsSeen.has("MANUAL"), true);

  console.log(`\n${"=".repeat(52)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`  total halt proofs on chain: ${history.length}`);
  console.log(`  gas left: ${ethers.formatEther(await ethers.provider.getBalance(me.address))} BOT`);
  console.log(`${"=".repeat(52)}\n`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
