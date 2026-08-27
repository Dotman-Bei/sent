# Project Context & Frontend Specification for Sent

## Part 1: Project Scope (`build.md` Summary)
- **Project Name:** Sent (On-Chain Agent Circuit Breaker)
- **Track:** AI Native Applications | BOT Chain Mainnet
- **Core Problem:** AI agent unreliability, infinite loops, and runaway API costs ($50+ per run).
- **Solution:** On-chain circuit breaker protocol that registers execution budgets (max steps, max tokens, max gas, deadline) and auto-halts rogue agents with immutable on-chain proof and user refunds.
- **Tech Stack:** React, Vite, Tailwind CSS, Ethers.js, Solidity (^0.8.20), BOT Chain Mainnet (Chain ID: 2017).
- **Smart Contracts:** `AgentRegistry.sol`, `BudgetVault.sol`, `CircuitBreaker.sol`.

---

## Part 2: Complete `frontend.md` Specification

# frontend.md — Complete UI/UX Specification & Design System for Sent

This document provides the complete, production-ready frontend specification and design system for Sent (On-Chain Agent Circuit Breaker on BOT Chain Mainnet). It maps the Cobalt dark-mode fintech interface to an AI agent safety protocol dashboard, landing page, and Web3 integration layer.

## 1. Technical Stack & Dependencies
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "ethers": "^6.13.0",
    "lucide-react": "^0.400.0",
    "recharts": "^2.12.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0",
    "framer-motion": "^11.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.5",
    "vite": "^5.3.1"
  }
}// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#07090D', // Deep pitch black canvas
        surface: {
          DEFAULT: '#0D1117', // Base card surface
          subtle: '#131822',  // Hover states & secondary containers
          elevated: '#1A212D',// Modals, popovers, dropdown menus
          border: 'rgba(255, 255, 255, 0.08)',
          'border-strong': 'rgba(255, 255, 255, 0.16)'
        },
        brand: {
          emerald: '#00F5A0', // Primary accent (Cobalt green/teal)
          cyan: '#00D2FF',    // Secondary gradient accent
          amber: '#FFB800',   // Warning / Threshold alert
          red: '#FF4D4D',     // Circuit tripped / Halted
          violet: '#8B5CF6'   // Execution step indicator
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#94A3B8',
          muted: '#64748B'
        }
      },
      fontFamily: {
        sans: ['"Inter"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace']
      },
      boxShadow: {
        'glow-emerald': '0 0 50px -10px rgba(0, 245, 160, 0.15)',
        'glow-cyan': '0 0 50px -10px rgba(0, 210, 255, 0.15)',
        'card-border': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)'
      },
      backgroundImage: {
        'radial-hero': 'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(0, 245, 160, 0.18), rgba(0, 210, 255, 0.08), transparent 70%)',
        'radial-footer': 'radial-gradient(ellipse 50% 50% at 50% 120%, rgba(0, 245, 160, 0.12), transparent 70%)'
      }
    }
  },
  plugins: []

  4. Web3 Contract Integration Hooks (Ethers.js v6)
  
};export const CONTRACT_ADDRESSES = {
  BudgetVault: "0x...",
  AgentRegistry: "0x...",
  CircuitBreaker: "0x..."
};

export async function registerAgent(agentId: string, maxSteps: number, maxTokens: number, maxGas: number, durationSec: number) {
  const tx = await agentRegistry.registerAgent(ethers.encodeBytes32String(agentId), maxSteps, maxTokens, maxGas, durationSec);
  return tx.wait();
}

export async function getHaltHistory() {
  const ids = await circuitBreaker.getHaltHistory();
  return Promise.all(ids.map((id: string) => circuitBreaker.haltRecords(id)));
}

export async function manualHalt(agentId: string, reason: string) {
  const tx = await circuitBreaker.manualHalt(ethers.encodeBytes32String(agentId), reason);
  return tx.wait();
}

3. Page Layout & Component Hierarchy
Top Navigation Bar: Fixed top glassmorphism header with BOT Chain Mainnet badge and MetaMask connect button.

Hero Section: Ambient mesh glow, badge (⚡ BOT Chain Builder Challenge #2 Live), headline, and dual CTA buttons (Register Agent Budget & Explore Halt Proofs).

Dashboard Dock: Floating interactive preview featuring metrics row (Active Agents, Protected Tokens, Halt Counter, Vault Balance) and Recharts area graph tracking token consumption vs budget ceilings.

Value Statement Banner: "Who said agent safety had to be manual?" editorial copy layout.

Feature Bento Grid: 5-card layout covering Deterministic Budgets, Real-Time Tripping, Verifiable Halt Proofs, Framework Integrations (LangChain, LangGraph, AutoGen, CrewAI), and Instant Manual Control shortcuts (⌘K).

Spotlight Feature: Dual cards for threshold warning alerts and live Python runner terminal simulation (agent_runner.py).

Live Halt Explorer Table: Real-time data feed reading directly from CircuitBreaker.getHaltHistory().

Pre-Footer CTA & Minimalist Footer: Conversion banner and ecosystem navigation links.