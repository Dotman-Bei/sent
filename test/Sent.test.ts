import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { AgentRegistry, BudgetVault, CircuitBreaker } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const HaltReason = {
  NONE: 0n,
  MAX_STEPS: 1n,
  MAX_TOKENS: 2n,
  MAX_GAS: 3n,
  DEADLINE: 4n,
  MANUAL: 5n,
};

describe("Sent — On-Chain Agent Circuit Breaker", () => {
  let vault: BudgetVault;
  let registry: AgentRegistry;
  let breaker: CircuitBreaker;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const agentId = ethers.encodeBytes32String("demo-agent-1");

  beforeEach(async () => {
    [owner, user, stranger] = await ethers.getSigners();

    vault = await (await ethers.getContractFactory("BudgetVault")).deploy();
    registry = await (
      await ethers.getContractFactory("AgentRegistry")
    ).deploy(await vault.getAddress());
    breaker = await (
      await ethers.getContractFactory("CircuitBreaker")
    ).deploy(await registry.getAddress(), await vault.getAddress());

    await vault.setBreaker(await breaker.getAddress(), true);
    await vault.setBreaker(await registry.getAddress(), true);
    await registry.setAuthorized(await breaker.getAddress(), true);
  });

  async function register(
    overrides: Partial<{
      maxSteps: number;
      maxTokens: number;
      maxGas: number;
      duration: number;
      value: bigint;
    }> = {}
  ) {
    const {
      maxSteps = 5,
      maxTokens = 1000,
      maxGas = 0,
      duration = 3600,
      value = 0n,
    } = overrides;
    return registry
      .connect(user)
      .registerAgent(agentId, maxSteps, maxTokens, maxGas, duration, { value });
  }

  describe("AgentRegistry", () => {
    it("registers an agent with its budget profile", async () => {
      await expect(register())
        .to.emit(registry, "AgentRegistered")
        .withArgs(agentId, user.address);

      const profile = await registry.getProfile(agentId);
      expect(profile.maxSteps).to.equal(5n);
      expect(profile.maxTokens).to.equal(1000n);
      expect(profile.active).to.equal(true);
      expect(await registry.owners(agentId)).to.equal(user.address);
      expect(await registry.agentCount()).to.equal(1n);
    });

    it("rejects a duplicate agent id", async () => {
      await register();
      await expect(register()).to.be.revertedWithCustomError(registry, "AgentExists");
    });

    it("rejects a zero budget", async () => {
      await expect(register({ maxSteps: 0 })).to.be.revertedWithCustomError(
        registry,
        "InvalidBudget"
      );
    });

    it("blocks unauthorized callers from inflating usage counters", async () => {
      await register();
      await expect(
        registry.connect(stranger).incrementUsage(agentId, 999, 0)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("indexes agents by owner", async () => {
      await register();
      expect(await registry.getAgentsByOwner(user.address)).to.deep.equal([agentId]);
    });
  });

  describe("BudgetVault", () => {
    it("escrows value sent at registration and refunds it on halt", async () => {
      const escrow = ethers.parseEther("1");
      await register({ maxSteps: 1, value: escrow });

      expect((await vault.getEscrow(agentId)).amount).to.equal(escrow);
      expect(await vault.totalLocked()).to.equal(escrow);
      expect(await vault.balances(user.address)).to.equal(0n);

      await breaker.connect(user).checkLimits(agentId, 10); // step 1 -> approved
      await breaker.connect(user).checkLimits(agentId, 10); // step 2 -> trips

      expect(await vault.balances(user.address)).to.equal(escrow);
      expect(await vault.totalLocked()).to.equal(0n);
      expect((await breaker.haltRecords(agentId)).refunded).to.equal(escrow);
    });

    it("lets a user withdraw a refunded balance", async () => {
      const escrow = ethers.parseEther("1");
      await register({ maxSteps: 1, value: escrow });
      await breaker.connect(user).manualHalt(agentId, "done");

      await expect(vault.connect(user).withdraw(escrow)).to.changeEtherBalance(user, escrow);
    });

    it("blocks withdrawals larger than the free balance", async () => {
      await vault.connect(user).deposit({ value: ethers.parseEther("1") });
      await expect(
        vault.connect(user).withdraw(ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("only lets the owner authorize a breaker", async () => {
      await expect(
        vault.connect(stranger).setBreaker(stranger.address, true)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("only lets an authorized breaker refund", async () => {
      await expect(
        vault.connect(stranger).refund(user.address, 1)
      ).to.be.revertedWithCustomError(vault, "Unauthorized");
    });

    it("credits the fallback receive() as a deposit", async () => {
      await user.sendTransaction({
        to: await vault.getAddress(),
        value: ethers.parseEther("0.5"),
      });
      expect(await vault.balances(user.address)).to.equal(ethers.parseEther("0.5"));
    });
  });

  describe("CircuitBreaker", () => {
    it("approves steps while inside budget", async () => {
      await register({ maxSteps: 5, maxTokens: 1000 });
      await expect(breaker.connect(user).checkLimits(agentId, 100)).to.emit(
        breaker,
        "StepApproved"
      );
      expect(await registry.stepCounts(agentId)).to.equal(1n);
      expect(await registry.tokenCounts(agentId)).to.equal(100n);
      expect(await breaker.halted(agentId)).to.equal(false);
    });

    it("halts on MAX_STEPS", async () => {
      await register({ maxSteps: 3, maxTokens: 1_000_000 });
      for (let i = 0; i < 3; i++) {
        await breaker.connect(user).checkLimits(agentId, 1);
      }
      await expect(breaker.connect(user).checkLimits(agentId, 1))
        .to.emit(breaker, "AgentHalted")
        .withArgs(agentId, HaltReason.MAX_STEPS, anyValue);

      const record = await breaker.haltRecords(agentId);
      expect(record.reason).to.equal(HaltReason.MAX_STEPS);
      expect(record.stepCount).to.equal(3n);
      expect(record.message).to.equal("Max steps exceeded");
      expect(record.timestamp).to.equal(await time.latest());
    });

    it("halts on MAX_TOKENS", async () => {
      await register({ maxSteps: 100, maxTokens: 500 });
      await breaker.connect(user).checkLimits(agentId, 400);
      await breaker.connect(user).checkLimits(agentId, 500); // 900 > 500 trips

      const record = await breaker.haltRecords(agentId);
      expect(record.reason).to.equal(HaltReason.MAX_TOKENS);
      expect(record.tokenCount).to.equal(400n);
    });

    it("halts on DEADLINE", async () => {
      await register({ maxSteps: 100, maxTokens: 1_000_000, duration: 60 });
      await breaker.connect(user).checkLimits(agentId, 1);
      await time.increase(120);
      await breaker.connect(user).checkLimits(agentId, 1);

      expect((await breaker.haltRecords(agentId)).reason).to.equal(HaltReason.DEADLINE);
    });

    it("halts on MAX_GAS once the cumulative gas budget is spent", async () => {
      await register({ maxSteps: 100, maxTokens: 1_000_000, maxGas: 1000 });
      await breaker.connect(user).checkLimits(agentId, 1); // records real gas > 1000
      await breaker.connect(user).checkLimits(agentId, 1); // trips

      expect((await breaker.haltRecords(agentId)).reason).to.equal(HaltReason.MAX_GAS);
    });

    it("ignores the gas ceiling when maxGas is 0", async () => {
      await register({ maxSteps: 10, maxTokens: 1_000_000, maxGas: 0 });
      for (let i = 0; i < 5; i++) await breaker.connect(user).checkLimits(agentId, 1);
      expect(await breaker.halted(agentId)).to.equal(false);
    });

    it("supports an owner-triggered manual halt", async () => {
      await register();
      await expect(breaker.connect(user).manualHalt(agentId, "operator kill switch"))
        .to.emit(breaker, "AgentHalted")
        .withArgs(agentId, HaltReason.MANUAL, anyValue);
      expect((await breaker.haltRecords(agentId)).message).to.equal("operator kill switch");
    });

    it("rejects a manual halt from a non-owner", async () => {
      await register();
      await expect(
        breaker.connect(stranger).manualHalt(agentId, "nope")
      ).to.be.revertedWithCustomError(breaker, "NotOwner");
    });

    it("deactivates the agent and blocks further steps after a halt", async () => {
      await register({ maxSteps: 1 });
      await breaker.connect(user).checkLimits(agentId, 1);
      await breaker.connect(user).checkLimits(agentId, 1); // trips
      expect((await registry.getProfile(agentId)).active).to.equal(false);
      await expect(
        breaker.connect(user).checkLimits(agentId, 1)
      ).to.be.revertedWithCustomError(breaker, "AlreadyHalted");
    });

    it("records every halt in an append-only history", async () => {
      const second = ethers.encodeBytes32String("demo-agent-2");
      await register();
      await registry.connect(user).registerAgent(second, 5, 1000, 0, 3600);

      await breaker.connect(user).manualHalt(agentId, "one");
      await breaker.connect(user).manualHalt(second, "two");

      expect(await breaker.getHaltHistory()).to.deep.equal([agentId, second]);
      expect(await breaker.haltCount()).to.equal(2n);

      const records = await breaker.getHaltRecords();
      expect(records.length).to.equal(2);
      expect(records[1].message).to.equal("two");
    });

    it("previews a halt without changing state via wouldHalt", async () => {
      await register({ maxSteps: 100, maxTokens: 500 });
      const [willHalt, reason] = await breaker.wouldHalt(agentId, 600);
      expect(willHalt).to.equal(true);
      expect(reason).to.equal(HaltReason.MAX_TOKENS);
      expect(await registry.stepCounts(agentId)).to.equal(0n);
    });

    it("releases escrow on a clean completion without a halt", async () => {
      const escrow = ethers.parseEther("2");
      await register({ value: escrow });
      await expect(breaker.connect(user).completeAgent(agentId))
        .to.emit(breaker, "AgentCompleted")
        .withArgs(agentId, escrow);
      expect(await breaker.halted(agentId)).to.equal(false);
      expect(await vault.balances(user.address)).to.equal(escrow);
    });
  });
});
