/**
 * Drives the built frontend in a real browser and asserts it renders live
 * on-chain data from whichever BOT Chain network the build targets.
 *
 *   npx vite preview --port 4173      # in another terminal
 *   node scripts/verify-ui.mjs
 */
import { chromium } from "playwright";
import { ethers } from "ethers";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Ground truth: what the target chain actually holds right now. The UI is
// then asserted to match this, so the same checks hold on a freshly deployed
// network, a seeded testnet, or mainnet with a single proof.
const NET = process.env.UI_NETWORK ?? "botchain";
const deployment = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "deployments", `${NET}.json`), "utf8")
);
const RPC = process.env.UI_RPC ?? (NET === "botchain" ? "https://rpc.botchain.ai" : "https://rpc.bohr.life");
const provider = new ethers.JsonRpcProvider(RPC, deployment.chainId, { staticNetwork: true });
// A single transient RPC blip should not fail an entire UI run, so retry.
const onChain = await (async () => {
  const reg = new ethers.Contract(deployment.contracts.AgentRegistry,
    ["function agentCount() view returns (uint256)"], provider);
  const brk = new ethers.Contract(deployment.contracts.CircuitBreaker,
    ["function haltCount() view returns (uint256)"], provider);
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return { agents: Number(await reg.agentCount()), halts: Number(await brk.haltCount()) };
    } catch (err) {
      last = err;
      console.log(`   chain read attempt ${attempt} failed (${err.code ?? err.name}), retrying`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw last;
})();
console.log(`chain ${NET} (${deployment.chainId}): ${onChain.agents} agents, ${onChain.halts} halts`);

const URL = process.env.UI_URL ?? "http://localhost:4173/";
const OUT = process.env.OUT_DIR ?? ".";

let pass = 0;
let fail = 0;
const check = (label, ok, detail = "") => {
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const consoleErrors = [];
const failedRequests = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
page.on("requestfailed", (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));

console.log(`\nDriving ${URL} in headless Chromium\n`);
await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });

console.log("1. App mounts");
const rootHtml = await page.locator("#root").innerHTML();
check("React mounted (#root not empty)", rootHtml.length > 1000, `${rootHtml.length} chars`);
check("hero headline rendered", await page.locator("h1").first().isVisible());

console.log("\n2. Live chain data reaches the UI");
// The dock polls the chain; wait for the halt counter to leave its 0 state.
await page
  .waitForFunction(
    () => {
      const t = document.body.innerText;
      return /Halts fired/i.test(t) && !/Connecting to BOT Chain/i.test(t);
    },
    { timeout: 45_000 }
  )
  .catch(() => {});

const body = await page.locator("body").innerText();
const notDeployedBanner = /Contracts are not deployed yet/i.test(body);
check("no 'not deployed' banner", !notDeployedBanner);
check("refreshed-from-chain timestamp shown", /refreshed/i.test(body));

// What the UI renders must match what the chain actually holds. A freshly
// deployed network legitimately has no agents and no halts, so assert the
// empty states there rather than pretending the UI is broken.
const rows = await page.locator("#explorer table tbody tr").count();
const agentNames = ["research-", "summarizer-", "runaway-", "looper-", "rogue-tool-", "e2e-", "sent-demo-"];
const found = agentNames.filter((n) => body.includes(n));
// The empty state renders AS a table row, and the Spotlight terminal is a
// scripted mock containing agent-like labels, so neither proves the chain has
// data. The empty-state copy is the only unambiguous signal.
const chainHasData = onChain.agents > 0 || onChain.halts > 0;

if (chainHasData) {
  check("agent label from chain rendered", found.length >= 1, `found: ${found.join(" ")}`);
  check(
    "halt explorer row count matches chain",
    rows === onChain.halts,
    `${rows} rows vs ${onChain.halts} halts on chain`
  );
  const reasonsShown = ["Token ceiling", "Step ceiling", "Manual halt", "Deadline", "Gas ceiling"]
    .filter((r) => body.includes(r));
  check("halt reason rendered", reasonsShown.length >= 1, reasonsShown.join(", "));
} else {
  console.log("   (chain is empty, asserting empty states instead)");
  check(
    "empty agent state rendered",
    /No agents registered yet/i.test(body),
    "expected the watchlist empty state"
  );
  check(
    "empty halt state rendered",
    /No halts recorded yet/i.test(body),
    "expected the explorer empty state"
  );
  // Read the metric tile itself rather than regexing the whole page, where
  // a stray "0" anywhere would satisfy the assertion.
  const haltTile = page.locator("#dashboard", { hasText: "Halts fired" })
    .locator("text=Halts fired")
    .first();
  const tileText = await haltTile.locator("xpath=../..").innerText().catch(() => "");
  check("halt counter tile reads 0", /(^|\s)0(\s|$)/.test(tileText), JSON.stringify(tileText));
}

console.log("\n3. Chart + interactive pieces");
if (chainHasData) {
  check("Recharts SVG rendered", (await page.locator("#dashboard svg.recharts-surface").count()) > 0);
  check(
    "circuit ceiling reference line",
    body.includes("circuit ceiling") || (await page.locator("text=circuit ceiling").count()) > 0
  );
} else {
  // A fresh chain has nothing to plot; the empty state stands in for the chart.
  check("no chart artefacts on an empty chain", !/NaN|Infinity|undefined/i.test(body));
}

// ⌘K palette
await page.keyboard.press("Control+K");
await page.waitForTimeout(600);
const paletteOpen = await page.getByPlaceholder("Halt an agent you own…").first().isVisible().catch(() => false);
check("Ctrl+K opens kill switch", paletteOpen);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// Register modal
await page.getByRole("button", { name: /Register agent budget/i }).first().click();
await page.waitForTimeout(700);
const modalOpen = await page.getByText("Ceilings are immutable once written on-chain.").first().isVisible().catch(() => false);
check("register modal opens", modalOpen);
if (modalOpen) {
  await page.getByPlaceholder("research-agent-01").first().fill("ui-check-agent");
  await page.waitForTimeout(400);
  const preview = await page.locator("text=/^0x[0-9a-f]{64}$/i").count();
  check("bytes32 agentId preview computed", preview > 0);
}
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

console.log("\n4. Runtime health");
const realErrors = consoleErrors.filter(
  (e) => !/favicon|fonts\.g|Download the React DevTools/i.test(e)
);
check("no uncaught runtime errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
const realFailed = failedRequests.filter((r) => !/favicon|fonts\.g/i.test(r));
check("no failed network requests", realFailed.length === 0, realFailed.slice(0, 3).join(" | "));

console.log("\n5. Responsive");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
check("no horizontal overflow at 390px", overflow <= 1, `${overflow}px`);
await page.screenshot({ path: `${OUT}/ui-mobile.png` });

await page.setViewportSize({ width: 1440, height: 1000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/ui-hero.png` });
await page.locator("#dashboard").scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/ui-dashboard.png` });
await page.locator("#explorer").scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/ui-explorer.png` });
await page.screenshot({ path: `${OUT}/ui-full.png`, fullPage: true });

console.log(`\n${"=".repeat(48)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`  screenshots: ui-hero / ui-dashboard / ui-explorer / ui-mobile / ui-full`);
console.log(`${"=".repeat(48)}\n`);

await browser.close();
process.exit(fail > 0 ? 1 : 0);
