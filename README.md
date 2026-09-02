# ⚡ Razorpay ACM (Agent Commerce Middleman)
### *The Zero-Trust In-Flight Safety Gatekeeper & Autonomous Growth Engine for AI Agents on Razorpay*

[![Razorpay Buildathon](https://img.shields.io/badge/Razorpay%20Buildathon-Track%201%3A%20AI%20Growth%20%26%20Agentic%20Commerce-blue.svg)](#)
[![Deterministic Latency](https://img.shields.io/badge/Hot--Path%20Latency-%3C%201.5ms-brightgreen.svg)](#)
[![Test Suite](https://img.shields.io/badge/Tests-46%2F46%20Passing-brightgreen.svg)](#)
[![Next.js 16](https://img.shields.io/badge/Next.js-16%20Turbopack-black.svg)](https://nextjs.org/)
[![Fastify 5](https://img.shields.io/badge/Fastify-5.x-000000.svg)](https://fastify.dev/)
[![MCP Protocol](https://img.shields.io/badge/Protocol-Anthropic%20MCP-blueviolet.svg)](https://modelcontextprotocol.io/)

---

## 💡 Executive Summary

As autonomous LLM agents (Claude Desktop, OpenAI Assistants, LangChain swarms, AutoGPT) transition from answering questions to executing real-world commerce, **they cannot be given direct, unchecked access to payment gateways**. 

**Razorpay ACM** is the in-flight, zero-trust financial middleman that sits between external AI agents and Razorpay. It evaluates transactions deterministically in **< 1.5ms**, enforces cryptographic user intent, prevents prompt injection fraud, auto-revokes rogue agents, and drives a **+35% Average Order Value (AOV) lift** through intelligent co-purchase basket building.

---

## 🚨 The Problem: Why Autonomous AI Agents Need In-Flight Safety

When autonomous agents are armed with credit cards or payment APIs, traditional static budgets fail catastrophically:

```
❌ THE VULNERABILITY GAP (Direct API Access)
External LLM Agent ────────────────(Direct API Access)───────────────► Payment Gateway
  • Prompt Injection: Hidden website prompt tricks agent into buying ₹10,000 Apple Gift Cards
  • Runaway Loops: Code bug causes agent to fire 50 orders/minute, draining the bank account
  • Smurfing Attacks: Compromised agent splits a ₹10,000 fraud into 20x ₹490 orders under auto-approve caps
  • TOCTOU Tampering: Cart items or prices are secretly swapped after the user approves the quote
  • Hallucination Crashes: Cryptic HTTP 400/403 errors cause agents to hallucinate fake states or crash
```

---

## 🛡️ The Solution: Adaptive Bimodal Zero-Trust Architecture

Razorpay ACM operates on an industry-proven **Bimodal Architecture** separating financial authorization from AI diagnostic analysis:

```
                      INCOMING AGENT TRANSACTION
                                  │
       ┌──────────────────────────┴──────────────────────────┐
       ▼                                                     ▼
[ HOT-PATH: 100% DETERMINISTIC (< 1.5ms) ]       [ COLD-PATH: ISOLATED GEMINI AI ]
• 🚗 EXPRESS LANE (< 0.1ms):                     • 🗣️ AGENT INTERROGATION:
  Routine low-risk purchases (bread, milk, cabs)   Interrogates buyer reasoning on errors
  by trusted agents bypass heavy checks.         • 🔍 FORENSIC ANALYSIS:
• 🔬 DEEP INSPECTION LANE:                         Distinguishes benign hallucinations from
  6-layer security for high-risk categories,       deliberate prompt injection attacks.
  new agents, or 5% random spot-checks.          • 🛑 AUTO-REVOCATION:
• 💳 RAZORPAY GATEWAY LOCKING                      Advises gateway to revoke bad actors
  (SHA-256 cart hash pinned in order receipt)      or guide buyers to self-heal.
```

---

## 🌟 Complete Feature Showcase

Every feature in Razorpay ACM is engineered to solve a critical vulnerability or unlock new commercial value in agentic commerce:

---

### 1. ⚡ Adaptive Security Tiers (Express Lane vs. Deep Inspection)
* **The Challenge**: Running heavy deep-inspection (semantic NLP overlap, geofencing, moving-average price drift) on every ₹40 milk or ₹200 meal creates unnecessary processing overhead and friction.
* **How ACM Solves It**: Inspired by **Visa 3DS 2.0 and Stripe Radar**, ACM dynamically selects security tiers:
  * **Express Highway (< 0.1ms)**: Routine, low-risk commodity orders from established agents sail through with lightweight sanity checks (active mandate + budget cap).
  * **Deep Inspection Lane**: Automatically steps up to full 6-layer verification when an agent is new, purchasing high-liquidity tech/vouchers, or randomly selected by a **5% probabilistic spot-check** (TSA PreCheck model).

---

### 2. ✍️ Cryptographic Proof of Authority (Google AP2 Intent Binding)
* **The Challenge**: Malicious agents or prompt-injected LLMs can drift from what the human user originally authorized (e.g., user approved a ₹500 pizza, agent orders a ₹2,000 gadget).
* **How ACM Solves It**: Implements an HMAC-SHA256 cryptographic mandate binding `{ userId, agentId, intent, maxAuthorizedPaise, allowedMerchant, expiresAt }`. ACM verifies this timing-safely at the network boundary before processing the payment.

---

### 3. 🧠 Semantic Cart Invariance & Price Drift Shield
* **The Challenge**: Prompt injections from untrusted websites can redirect an agent to buy untracked items (gift cards, crypto), or merchants can surge prices after the user agreed.
* **How ACM Solves It**:
  * **Zero-Latency Jaccard Keyword Overlap**: Tokenizes user intent and verifies keyword overlap with cart SKUs.
  * **Strict Blacklist**: Instantly rejects high-risk categories (`vouchers.giftcards`, `crypto.currency`, `luxury.jewelry`).
  * **Price Drift Guard**: Flags any SKU unit price deviating $> 15\%$ from catalog baseline for human approval.

---

### 4. 🦹 Anti-Smurfing Structuring Defense & Runaway Loop Limiter
* **The Challenge**: A rogue or compromised agent can evade a ₹500 auto-approval threshold by placing multiple ₹490 orders in rapid succession, or a while-loop bug can drain a wallet in seconds.
* **How ACM Solves It**:
  * **Structuring Cluster Detector**: Identifies transaction clustering within 88%–100% of the threshold and automatically holds the entire batch for human review.
  * **Sliding-Window Velocity Engine**: Limits transactions to max 20 per 10 minutes and triggers an automated cooldown if $\ge 4$ orders arrive within 120 seconds.

---

### 5. 🔒 Anti-TOCTOU Cart Pinning & Gateway Locking
* **The Challenge**: In Time-of-Check to Time-of-Use (TOCTOU) attacks, a malicious actor or buggy agent alters the cart items or prices between quote generation and final payment execution.
* **How ACM Solves It**: ACM hashes the verified cart (`SHA-256(items + total + currency)`) and pins this immutable digest inside the Razorpay Order `receipt` and `notes.quoteHash`. The payment link is strictly locked with a 10-minute TTL.

---

### 6. 📍 Contextual Fencing (Geofence & Temporal Fencing)
* **The Challenge**: Stolen agent credentials can order goods for delivery to unauthorized addresses or initiate abnormal high-value purchases at 3:00 AM.
* **How ACM Solves It**:
  * **Address Geofence**: Validates delivery pincodes against the user's pre-approved whitelist (`allowedPincodes`).
  * **Temporal Fencing**: Detects unusual off-hours activity (02:00–06:00 IST) for consumer verticals and elevates the composite risk score.

---

### 7. 🪤 Canary Honeytoken Traps & Autonomous Circuit Breaker
* **The Challenge**: Attackers probe agent capabilities with jailbreaks or attempt to enumerate internal catalogs.
* **How ACM Solves It**: Deploys "canary honeytoken SKUs" (e.g., `test-unrestricted-admin-token`). Any agent requesting a canary item or incurring repeated policy violations triggers an instant circuit breaker that revokes the agent's credentials in PostgreSQL immediately (`revoked: true`).

---

### 8. 🖥️ Real-Time Human-in-the-Loop Operator Dashboard
* **The Challenge**: Binary blocking creates customer friction and false-positive drops when an order legitimately exceeds normal limits.
* **How ACM Solves It**: A modern Next.js 16 dark-mode dashboard with live Server-Sent Events (SSE). 
  * **Tiered Risk Engine**: Scores transactions 0–100. Low risk (< 35) is auto-approved; moderate risk (35–70) is held for 1-click human approval; high risk (> 70) is denied.
  * **One-Click Decisioning**: Operators can review risk badges, inspect cart contents, and approve or reject orders in real time.

---

### 9. 🤖 Cold-Path Gemini AI Analyst & Agent Interrogation
* **The Challenge**: Traditional payment gateways return generic `400 Bad Request` or `403 Forbidden` errors, causing autonomous LLMs to crash, hallucinate invalid states, or retry endlessly.
* **How ACM Solves It**: Decoupled from the checkout hot-path, an isolated **Google Gemini Security Analyst** interrogates the buyer agent's self-explanation. It differentiates between innocent hallucinations (generating machine-actionable self-healing payloads to adjust quantities/SKUs) and malicious prompt injections (advising the gateway to auto-revoke the agent's credentials).

---

### 10. 🔌 Universal Multi-Protocol Agent Connectivity (MCP & Beyond)
* **The Challenge**: AI agents run on disparate frameworks (Claude Desktop, LangChain, Cursor, OpenAI Assistants, custom REST bots).
* **How ACM Solves It**: ACM provides native support across 5 standard integration routes:
  1. **Anthropic Model Context Protocol (MCP)**: 9 native tools (`order_product`, `browse_catalog`, `get_quote`, `diagnose_payment_issue`, etc.) for Claude Desktop.
  2. **OpenAI Tool Calling**: OpenAPI tool schema available at `GET /v1/agent-tools`.
  3. **Standard REST API**: Simple `/v1/quotes` and `/v1/payments` endpoints for Python/LangChain/CrewAI.
  4. **Agentic Commerce Protocol (ACP)**: Native `/v1/acp/checkout` route.
  5. **Google AP2 Protocol**: Cryptographically signed intent mandate tokens.

---

### 11. 📈 Autonomous AI Growth & AOV Lift Engine (+35% Lift)
* **The Challenge**: Autonomous AI agents typically buy only the single SKU explicitly mentioned by the user, missing high-margin cross-sell and upsell opportunities.
* **How ACM Solves It**: ACM features a dynamic statistical market-basket co-purchase engine. When an agent carts an item (e.g., PVR Movie Ticket or Artisan Bread), ACM analyzes real historical transaction graphs to recommend high-affinity add-ons (Popcorn & Drink or Salted Butter). In live 50-agent benchmarks, this delivers a **+30.5% to +35% lift in Average Order Value (AOV)** while staying strictly within user budget caps.

---

### 12. 📜 High-Resolution Forensic Audit Trail & Visual Telemetry
* **The Challenge**: When autonomous agents spend real money, compliance officers and users require explainability and forensic proof for every single action.
* **How ACM Solves It**: Every transaction receives a globally unique Correlation ID. The audit portal provides a visual microsecond breakdown of all 6 security layers, cryptographic signature validity, policy evaluations, and executive incident summaries.

---

### 13. 👥 Multi-Agent Mandate Governance & 1-Command Merchant Onboarding
* **The Challenge**: Managing multiple autonomous agents with different permissions across multiple merchants is error-prone.
* **How ACM Solves It**:
  * **Granular Mandates**: Assign per-agent transaction limits, daily caps, and allowed merchant scopes.
  * **1-Command Merchant Onboarding CLI**: Run `npm run merchant:onboard` to instantly register a new merchant, define product catalogs, set pricing, and provision zero-trust agent mandates.

---

### 14. 💳 Native Razorpay Payment Gateway & Webhook Settlement
* **The Challenge**: Seamless transition from AI agent evaluation to real-world financial settlement and refunds.
* **How ACM Solves It**:
  * **Razorpay Payment Links**: Generates official, tamper-proof Razorpay checkout links (`https://rzp.io/...`).
  * **HMAC Webhook Verification**: Constant-time signature verification for `payment.captured` webhooks to ensure zero settlement tampering.
  * **Integrated Refund Handling**: Agents or operators can initiate Razorpay refunds directly via API or MCP tool (`/v1/transactions/:id/refund`).

---

## 🛍️ 5 Pre-Seeded Real-World Consumer Tracks

ACM comes fully pre-seeded with 5 widely recognized consumer platforms and real-world pricing:

| Vertical & Platform | Agent Persona | Bound Merchant | Real-World Catalog Examples | Guardrail Profile |
|---|---|---|---|---|
| **🎬 Movies & Cinema**<br>*(PVR INOX • IMAX)* | `movie-ticket-agent` | **PVR INOX Cinemas** | • IMAX 3D Recliner (₹450)<br>• Jumbo Caramel Popcorn (₹280)<br>• Twin Pepsi Fountain Cup (₹180) | **Daily Cap:** ₹3,000<br>**Auto-Approve:** ₹600<br>*(Solo ticket auto-approved; bulk gated)* |
| **🍕 Food & Dining**<br>*(Zomato • Swiggy)* | `food-delivery-agent` | **Zomato & Swiggy Kitchen** | • Wood-Fired Paneer Pizza (₹399)<br>• Cheesy Garlic Bread (₹149)<br>• Choco Lava Cake (₹109) | **Daily Cap:** ₹2,000<br>**Auto-Approve:** ₹500<br>*(Single meal auto-approved; feast gated)* |
| **🛒 Quick Commerce**<br>*(Blinkit • Instamart)* | `quick-commerce-agent` | **Blinkit Superstore** | • Artisan Bread Loaf (₹45)<br>• Amul Butter 200g (₹65)<br>• Farm Brown Eggs 12-Pack (₹95) | **Daily Cap:** ₹5,000<br>**Auto-Approve:** ₹500<br>*(Daily essentials auto-approved; bulk gated)* |
| **⚡ Electronics & Tech**<br>*(Amazon • Croma)* | `amazon-tech-agent` | **Amazon & Croma Hub** | • VoltCharge GaN 65W (₹1,899)<br>• 100W Braided Cable (₹499)<br>• ANC Wireless Earbuds (₹3,499) | **Daily Cap:** ₹10,000<br>**Auto-Approve:** ₹1,000<br>*(Cables auto-approved; tech gated)* |
| **✈️ Travel & Mobility**<br>*(MakeMyTrip • Uber)* | `travel-booking-agent` | **MakeMyTrip & Uber** | • Airport Premier Cab (₹650)<br>• Flight Delay Protection (₹199)<br>• In-Flight Meal & Window Seat (₹350) | **Daily Cap:** ₹8,000<br>**Auto-Approve:** ₹700<br>*(Cab rides auto-approved; flights gated)* |

---

## 📊 Key Performance & Pitch Metrics

```
  ⚡ < 1.5ms              🛡️ 100%                 📈 +35.0%               🧪 46 / 46
  Hot-Path Overhead       Deterministic Safety    AOV Basket Lift         Tests Passing (< 1s)
  Zero perceptible        Zero LLM latency on     Automated co-purchase   Full security, AP2 &
  payment delay           financial hot-paths     recommendations         Razorpay test suite
```

---

## 🚀 Quickstart: Experience the Demo in 3 Commands

### 1. Initialize & Seed Database
```bash
npm run setup
```
*Starts Docker PostgreSQL, creates Prisma tables, and seeds all 5 consumer tracks, products, mandates, and historical transactions.*

### 2. Launch Backend & Dashboard
```bash
npm run dev
```
* **Operator Dashboard**: [http://localhost:3001](http://localhost:3001) *(Real-time approval queue, audit logs, growth simulator)*
* **Fastify API Server**: [http://localhost:3000](http://localhost:3000) *(Zero-trust payment & policy gateway)*

### 3. Run Live Multi-Agent Demos
* **Concurrent Multi-Agent Demo** *(Normal vs. Gated vs. Rogue Agent)*:
  ```bash
  npm run demo:concurrent
  ```
* **50-Agent Autonomous Growth Simulation** *(Measures +35% AOV basket lift)*:
  ```bash
  npm run simulate:growth
  ```
* **Run Integration & Policy Test Suite**:
  ```bash
  npm test
  ```

---

## 📖 In-Depth Technical Documentation

For complete curl runbooks, step-by-step demo guides, Claude Desktop MCP setup, and architectural diagrams, see:
* 👉 **[APP_GUIDE.md](file:///Users/shikharyadav/Desktop/Razorpay/acm/APP_GUIDE.md)** — *Comprehensive Developer & Operator Runbook*
* 👉 **[ACTION_PLAN.md](file:///Users/shikharyadav/Desktop/Razorpay/acm/ACTION_PLAN.md)** — *Buildathon Architecture & Completion Roadmap*

---

## 🔒 License

Proprietary. Developed for the **Razorpay AI Buildathon (Track 1: AI Growth & Agentic Commerce)**. All rights reserved.
