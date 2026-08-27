# Sent — On-Chain Agent Circuit Breaker
## BOT Chain Builder Challenge #2 | AI Native Applications Track

> **Project Name:** Sent  
> **Track:** AI Native Applications  
> **Chain:** BOT Chain Mainnet  
> **Build Period:** Aug 10 – Aug 24  
> **Submission Deadline:** Aug 22, 21:59 UTC+8

---

## 1. Elevator Pitch

**Sent** is a decentralized circuit breaker protocol that stops AI agents from entering infinite loops, burning through tokens, or executing runaway tasks. Agents register execution budgets (max steps, max tokens, max time). If limits are exceeded, Sent’s smart contract auto-halts execution and refunds the user — with on-chain proof of *why* it stopped.

**The Problem:** Reddit is full of developers complaining that AI agents are "too unreliable" — infinite loops, hallucinated retries, and unpredictable API costs that spike to $50+ per run.  
**The Solution:** Sent puts guardrails on-chain. Transparent. Immutable. Trustless.

---

## 2. Judging Criteria Alignment

Based on the BOT Chain Builder Challenge #2 evaluation framework, Sent is shaped to score high across all dimensions:

| Criteria | How Sent Delivers |
|----------|-------------------|
| **Real User Value** | Directly solves the #1 Reddit complaint: agent unreliability & runaway costs. Every AI agent builder needs this. |
| **BOT Chain Mainnet Integration** | Core logic lives in 3+ smart contracts deployed on Mainnet. Native BOT token usage for gas, staking, and refunds. |
| **Technical Execution** | Clean contract architecture, on-chain circuit breaker, event-driven monitoring, verifiable halt proofs. |
| **Innovation** | First on-chain circuit breaker for AI agents. Not just a wrapper — a protocol layer. |
| **Long-Term Ecosystem Potential** | Becomes infrastructure other BOT Chain AI projects depend on. AgentGuard → AgentWatch → AgentBudget pipeline. |
| **Demo Quality** | Live demo with a simulated runaway agent being halted on-chain in real-time. |

---

## 3. MVP Scope (What to Build)

### Must-Have (MVP)
1. **CircuitBreaker.sol** — Core smart contract on BOT Chain Mainnet
2. **AgentRegistry.sol** — Register agents with budget profiles
3. **Simple frontend** — React app to create budgets, monitor agents, view halt events
4. **Simulated agent runner** — Python script that demonstrates a runaway agent being stopped
5. **On-chain event logs** — Every halt is logged immutably with reason code

### Nice-to-Have (If Time Permits)
- Staking/slashing for validator nodes that verify halt conditions
- Multi-agent budget pools
- Discord/Telegram bot notifications on halt events
- Integration with LangChain/LangGraph agent frameworks

### Out of Scope (Post-Hackathon)
- Full oracle network
- Cross-chain circuit breakers
- AI model-specific integrations

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER / DEVELOPER                        │
│  Creates budget → Deposits BOT → Registers Agent               │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    BOT CHAIN MAINNET                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ AgentRegistry   │  │ CircuitBreaker  │  │ BudgetVault     │ │
│  │  - agent ID     │  │  - checkLimits()│  │  - deposit()    │ │
│  │  - owner        │  │  - halt()       │  │  - withdraw()   │ │
│  │  - budget profile│  │  - logHalt()    │  │  - refund()     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                       │                                        │
│                       ▼                                        │
│              ┌─────────────────┐                               │
│              │ HaltEventEmitter│  ← On-chain proof of stop     │
│              │  - reason code  │                               │
│              │  - timestamp    │                               │
│              │  - gas used     │                               │
│              └─────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    SIMULATED AGENT RUNNER                     │
│  Python script that:                                          │
│  1. Reads budget from AgentRegistry                           │
│  2. Runs agent steps                                          │
│  3. Calls CircuitBreaker.checkLimits() each step              │
│  4. Gets halted if limits exceeded                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Tech Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | BOT Chain (EVM-compatible L1) |
| **Smart Contracts** | Solidity ^0.8.20 |
| **Framework** | Hardhat or Foundry |
| **Frontend** | React + Vite + ethers.js/viem |
| **Agent Simulation** | Python + web3.py |
| **Wallet** | MetaMask (BOT Chain Mainnet config) |
| **Deployment** | BOT Chain Mainnet (apply for Gas Support: 1 BOT) |

---

## 6. Step-by-Step Build Guide

### Phase 0: Environment Setup (30 min)

```bash
# 1. Create project
mkdir sent-botchain && cd sent-botchain

# 2. Init Hardhat
npx hardhat init
# → Select: Create a TypeScript project

# 3. Install deps
npm install @openzeppelin/contracts ethers dotenv
npm install -D @nomicfoundation/hardhat-toolbox

# 4. Add BOT Chain to hardhat.config.ts
```

**`hardhat.config.ts`**
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    botchain: {
      url: "https://rpc.botchain.ai", // verify official RPC
      chainId: 2017, // verify official chainId
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
export default config;
```

> **Apply for Gas Support:** Fill the Gas Support Google Form linked on the Luma page to receive 1 BOT for Mainnet deployment.

---

### Phase 1: Smart Contracts (3-4 hours)

#### Contract 1: `BudgetVault.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BudgetVault {
    mapping(address => uint256) public balances;
    mapping(address => bool) public authorizedBreakers;

    event Deposited(address indexed user, uint256 amount);
    event Refunded(address indexed user, uint256 amount);

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function authorizeBreaker(address breaker) external {
        authorizedBreakers[breaker] = true;
    }

    function refund(address user, uint256 amount) external {
        require(authorizedBreakers[msg.sender], "Unauthorized");
        require(balances[user] >= amount, "Insufficient balance");
        balances[user] -= amount;
        payable(user).transfer(amount);
        emit Refunded(user, amount);
    }

    receive() external payable {
        deposit();
    }
}
```

#### Contract 2: `AgentRegistry.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct BudgetProfile {
    uint256 maxSteps;
    uint256 maxTokens;
    uint256 maxGas;
    uint256 deadline; // timestamp
    bool active;
}

contract AgentRegistry {
    mapping(bytes32 => BudgetProfile) public profiles;
    mapping(bytes32 => address) public owners;
    mapping(bytes32 => uint256) public stepCounts;
    mapping(bytes32 => uint256) public tokenCounts;

    event AgentRegistered(bytes32 indexed agentId, address owner);
    event BudgetUpdated(bytes32 indexed agentId);

    function registerAgent(
        bytes32 agentId,
        uint256 maxSteps,
        uint256 maxTokens,
        uint256 maxGas,
        uint256 durationSeconds
    ) external {
        require(owners[agentId] == address(0), "Agent exists");
        owners[agentId] = msg.sender;
        profiles[agentId] = BudgetProfile({
            maxSteps: maxSteps,
            maxTokens: maxTokens,
            maxGas: maxGas,
            deadline: block.timestamp + durationSeconds,
            active: true
        });
        emit AgentRegistered(agentId, msg.sender);
    }

    function incrementUsage(bytes32 agentId, uint256 tokensUsed, uint256 gasUsed) external {
        require(profiles[agentId].active, "Agent inactive");
        stepCounts[agentId] += 1;
        tokenCounts[agentId] += tokensUsed;
        // gas tracking handled by CircuitBreaker
    }

    function getProfile(bytes32 agentId) external view returns (BudgetProfile memory) {
        return profiles[agentId];
    }
}
```

#### Contract 3: `CircuitBreaker.sol` (Core)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentRegistry.sol";
import "./BudgetVault.sol";

contract CircuitBreaker {
    AgentRegistry public registry;
    BudgetVault public vault;

    enum HaltReason { NONE, MAX_STEPS, MAX_TOKENS, MAX_GAS, DEADLINE, MANUAL }

    struct HaltRecord {
        bytes32 agentId;
        HaltReason reason;
        uint256 timestamp;
        uint256 stepCount;
        uint256 tokenCount;
        string message;
    }

    mapping(bytes32 => bool) public halted;
    mapping(bytes32 => HaltRecord) public haltRecords;
    bytes32[] public haltHistory;

    event AgentHalted(bytes32 indexed agentId, HaltReason reason, uint256 timestamp);

    constructor(address _registry, address _vault) {
        registry = AgentRegistry(_registry);
        vault = BudgetVault(_vault);
    }

    function checkLimits(bytes32 agentId, uint256 tokensUsed) external returns (bool) {
        require(!halted[agentId], "Agent already halted");

        AgentRegistry.BudgetProfile memory profile = registry.getProfile(agentId);
        require(profile.active, "Agent not active");

        // Check deadline
        if (block.timestamp > profile.deadline) {
            _halt(agentId, HaltReason.DEADLINE, "Execution deadline exceeded");
            return false;
        }

        // Check steps
        uint256 steps = registry.stepCounts(agentId);
        if (steps >= profile.maxSteps) {
            _halt(agentId, HaltReason.MAX_STEPS, "Max steps exceeded");
            return false;
        }

        // Check tokens
        uint256 tokens = registry.tokenCounts(agentId) + tokensUsed;
        if (tokens > profile.maxTokens) {
            _halt(agentId, HaltReason.MAX_TOKENS, "Max tokens exceeded");
            return false;
        }

        // Check gas (tx gas limit)
        if (gasleft() < profile.maxGas) {
            _halt(agentId, HaltReason.MAX_GAS, "Gas limit approaching");
            return false;
        }

        registry.incrementUsage(agentId, tokensUsed, 0);
        return true;
    }

    function manualHalt(bytes32 agentId, string calldata reason) external {
        require(registry.owners(agentId) == msg.sender, "Not owner");
        _halt(agentId, HaltReason.MANUAL, reason);
    }

    function _halt(bytes32 agentId, HaltReason reason, string memory message) internal {
        halted[agentId] = true;
        HaltRecord memory record = HaltRecord({
            agentId: agentId,
            reason: reason,
            timestamp: block.timestamp,
            stepCount: registry.stepCounts(agentId),
            tokenCount: registry.tokenCounts(agentId),
            message: message
        });
        haltRecords[agentId] = record;
        haltHistory.push(agentId);
        emit AgentHalted(agentId, reason, block.timestamp);
    }

    function getHaltHistory() external view returns (bytes32[] memory) {
        return haltHistory;
    }
}
```

---

### Phase 2: Deploy to BOT Chain Mainnet (30 min)

```bash
# 1. Compile
npx hardhat compile

# 2. Deploy (ensure you have BOT tokens for gas)
npx hardhat run scripts/deploy.ts --network botchain
```

**`scripts/deploy.ts`**
```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const BudgetVault = await ethers.getContractFactory("BudgetVault");
  const vault = await BudgetVault.deploy();
  await vault.waitForDeployment();
  console.log("BudgetVault:", await vault.getAddress());

  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  console.log("AgentRegistry:", await registry.getAddress());

  const CircuitBreaker = await ethers.getContractFactory("CircuitBreaker");
  const breaker = await CircuitBreaker.deploy(
    await registry.getAddress(),
    await vault.getAddress()
  );
  await breaker.waitForDeployment();
  console.log("CircuitBreaker:", await breaker.getAddress());

  // Authorize breaker in vault
  await vault.authorizeBreaker(await breaker.getAddress());
  console.log("Breaker authorized in vault");
}

main().catch(console.error);
```

---

### Phase 3: Frontend MVP (3-4 hours)

**Stack:** React + Vite + ethers.js + Tailwind CSS

**Pages:**
1. **Home** — Hero + value prop + live halt counter
2. **Register Agent** — Form to set budget (max steps, tokens, gas, duration)
3. **Dashboard** — View registered agents, status (active/halted), halt history
4. **Halt Explorer** — Browse all on-chain halt events with reason codes

**Key Features:**
- Connect MetaMask (configured for BOT Chain)
- Read agent profiles from `AgentRegistry`
- Display halt events from `CircuitBreaker.getHaltHistory()`
- Real-time halt counter (polls every 10s)

---

### Phase 4: Simulated Agent Runner (1-2 hours)

**`agent_runner.py`**
```python
import time
import random
from web3 import Web3

# BOT Chain config
RPC_URL = "https://rpc.botchain.ai"
CHAIN_ID = 2017
PRIVATE_KEY = "your_key"
BREAKER_ADDRESS = "0x..."
AGENT_ID = Web3.keccak(text="demo-agent-1")

w3 = Web3(Web3.HTTPProvider(RPC_URL))
account = w3.eth.account.from_key(PRIVATE_KEY)

breaker_abi = [...]  # ABI from Hardhat artifacts
breaker = w3.eth.contract(address=BREAKER_ADDRESS, abi=breaker_abi)

print(f"Running agent {AGENT_ID.hex()}")
step = 0
while True:
    step += 1
    tokens_used = random.randint(100, 500)

    tx = breaker.functions.checkLimits(AGENT_ID, tokens_used).build_transaction({
        'from': account.address,
        'nonce': w3.eth.get_transaction_count(account.address),
        'gas': 200000,
        'gasPrice': w3.to_wei('1', 'gwei'),
        'chainId': CHAIN_ID
    })

    signed = account.sign_transaction(tx)
    receipt = w3.eth.send_raw_transaction(signed.rawTransaction)
    w3.eth.wait_for_transaction_receipt(receipt)

    # Check if halted
    if breaker.functions.halted(AGENT_ID).call():
        record = breaker.functions.haltRecords(AGENT_ID).call()
        print(f"🛑 HALTED at step {step}: {record[5]}")
        break

    print(f"Step {step} OK | Tokens: {tokens_used}")
    time.sleep(2)
```

**Demo Script:**
1. Register agent with `maxSteps=5`, `maxTokens=1000`
2. Run agent runner
3. Watch it halt at step ~3-5 with on-chain proof
4. Show halt record in frontend

---

### Phase 5: Polish & Submission Prep (2-3 hours)

- [ ] Add BOT Chain branding to frontend
- [ ] Record 2-min demo video (runaway agent → halt → on-chain proof)
- [ ] Write README with architecture diagram
- [ ] Verify contracts on BOT Chain explorer (if available)
- [ ] Test on Mainnet with real BOT gas
- [ ] Create pitch deck (5 slides max)

---

## 7. File Structure

```
sent-botchain/
├── contracts/
│   ├── BudgetVault.sol
│   ├── AgentRegistry.sol
│   └── CircuitBreaker.sol
├── scripts/
│   └── deploy.ts
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── utils/
│   └── package.json
├── agent-runner/
│   └── agent_runner.py
├── README.md
├── PITCH.md
└── hardhat.config.ts
```

---

## 8. Competitive Edge Checklist

### Submission Edge Factors

| Edge Factor | Implementation |
|-------------|----------------|
| **Mainnet Deployed** | All 3 contracts live on BOT Chain Mainnet (not testnet) |
| **Native BOT Token** | Gas paid in BOT. Budget deposits accepted in BOT. |
| **Real-Time Demo** | Live agent runner halting on-chain during Demo Day |
| **Open Source** | Repo public with MIT license + comprehensive README |
| **Video Demo** | 2-min Loom/YouTube showing end-to-end flow |
| **Pitch Deck** | 5 slides: Problem → Solution → Demo → Traction → Ask |
| **Post-Hackathon Roadmap** | Clear plan for AgentWatch & AgentBudget expansion |
| **Community Engagement** | Posted in BOT Chain Telegram, got feedback |
| **Gas Support Applied** | Used official Gas Support form (shows engagement) |
| **Clean Code** | Well-commented Solidity, test coverage, no warnings |

---

## 9. After-Build Hackathon Submission Checklist

> **Use this checklist in the 24 hours before submission to maximize your edge.**

### Smart Contracts (Critical)
- [ ] All contracts **compiled with 0 warnings**
- [ ] **Deployed on BOT Chain Mainnet** (not testnet)
- [ ] Contract addresses documented in README
- [ ] `verify` contracts on BOT Chain explorer (if supported)
- [ ] No hardcoded private keys in repo (use `.env`)
- [ ] ReentrancyGuard on `BudgetVault.refund()`
- [ ] Events emitted for all state changes
- [ ] Access control on admin functions

### Frontend
- [ ] MetaMask connects to BOT Chain Mainnet automatically
- [ ] All 3 contracts are readable from frontend
- [ ] Mobile responsive
- [ ] Loading states on all async actions
- [ ] Error handling with user-friendly messages
- [ ] Halt Explorer shows real on-chain data

### Demo & Video
- [ ] **2-minute demo video** recorded (Loom/YouTube unlisted)
- [ ] Video shows: register → run → halt → proof
- [ ] Voiceover or captions explaining the problem
- [ ] BOT Chain logo/mention in video
- [ ] Video link tested (not private/broken)

### Documentation
- [ ] `README.md` with:
  - [ ] Project name + one-liner
  - [ ] Problem statement
  - [ ] Architecture diagram
  - [ ] Contract addresses
  - [ ] Setup instructions
  - [ ] Demo video link
  - [ ] Team members
- [ ] `PITCH.md` with 5-slide narrative
- [ ] `ROADMAP.md` with post-hackathon plans

### Google Form Submission
- [ ] Project name: **Sent**
- [ ] Track: **AI Native Applications**
- [ ] GitHub repo link (public)
- [ ] Live demo URL (Vercel/Netlify)
- [ ] Demo video URL
- [ ] Contract addresses listed
- [ ] Team info + contact
- [ ] Short description (150 words max) — *use the elevator pitch above*
- [ ] Long description (500 words max) — *explain the Reddit problem + on-chain solution*
- [ ] BOT Chain integration details — *gas support applied, native BOT usage*

### Demo Day Prep (Aug 24)
- [ ] 5-minute pitch rehearsed
- [ ] Live demo flow scripted (register → run → halt)
- [ ] Backup: recorded video if live demo fails
- [ ] Prepare for Q&A:
  - *"How is this different from traditional rate limiting?"* → On-chain, immutable, trustless
  - *"Why BOT Chain?"* → EVM-compatible, low gas, AI-focused ecosystem
  - *"What's next?"* → AgentWatch monitoring, AgentBudget cost tracking

### Community & Visibility
- [ ] Posted project in [BOT Chain Telegram](https://t.me/BotChain_official/61)
- [ ] Tweeted about it with #BOTChain #AIAgents tags
- [ ] Reached out to 2-3 ecosystem partners for feedback

### Final 2-Hour Buffer
- [ ] Test full flow on Mainnet one more time
- [ ] Check all links in submission form
- [ ] Submit **before Aug 22, 21:59 UTC+8** (not at the last minute)
- [ ] Screenshot submission confirmation

---

## 10. Pitch Deck Outline (5 Slides)

1. **The Problem** — Reddit screenshots of devs complaining about runaway agents + cost spikes
2. **The Solution** — Sent: on-chain circuit breaker. One diagram.
3. **Live Demo** — 60 seconds. Register agent → run → halt → on-chain proof.
4. **Why BOT Chain** — EVM-compatible, AI-native ecosystem, gas support, long-term potential
5. **Roadmap** → AgentWatch (monitoring) → AgentGuard (reputation) → AgentBudget (cost control)

---

## 11. Post-Hackathon Roadmap

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| **v0.2** | Sep 2026 | AgentWatch — on-chain monitoring dashboard |
| **v0.3** | Oct 2026 | AgentGuard — reputation registry + validator staking |
| **v0.4** | Nov 2026 | AgentBudget — DeFi vaults for agent cost management |
| **v1.0** | Q1 2027 | Full SDK for LangChain/LangGraph integration |

---

## 12. Quick Reference

| Resource | Link |
|----------|------|
| Luma Event Page | [luma.com/238et7cw](https://luma.com/238et7cw) |
| BOT Chain Builder Hub | [t.me/BotChain_official/61](https://t.me/BotChain_official/61) |
| BOT Chain Website | [botchain.ai/en](https://www.botchain.ai/en) |
| Gas Support Form | Google Form (on Luma page) |
| Project Submission Form | Google Form (on Luma page) |

---

> **Ready to build?** Start with Phase 0 now. Deploy to Mainnet by Aug 21. Submit by Aug 22, 21:59 UTC+8. Demo Day is Aug 24. Winners announced Aug 31. 🚀

---
*Built for BOT Chain Builder Challenge #2 — AI Native Applications Track*
