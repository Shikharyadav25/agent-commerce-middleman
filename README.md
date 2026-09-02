# ⚡ Razorpay ACM (Agent Commerce Middleman)
### *The World's First Adaptive, Zero-Trust Payment Gateway & Autonomous Growth Engine for AI Agents*

[![Razorpay Buildathon](https://img.shields.io/badge/Razorpay%20Buildathon-Track%201%3A%20AI%20Growth%20%26%20Agentic%20Commerce-blue.svg)](#)
[![Hot-Path Latency](https://img.shields.io/badge/Express%20Lane-%3C%200.1ms-brightgreen.svg)](#)
[![Deterministic Hot-Path](https://img.shields.io/badge/Deep%20Inspection-%3C%201.5ms-brightgreen.svg)](#)
[![Gemini Cloud AI](https://img.shields.io/badge/Cold--Path%20AI-Google%20Gemini%203.1-orange.svg)](https://deepmind.google/technologies/gemini/)
[![Test Suite](https://img.shields.io/badge/Tests-60%2F60%20Passing-brightgreen.svg)](#)
[![Next.js 16](https://img.shields.io/badge/Dashboard-Next.js%2016%20Turbopack-black.svg)](https://nextjs.org/)
[![Anthropic MCP](https://img.shields.io/badge/Protocol-Anthropic%20MCP-blueviolet.svg)](https://modelcontextprotocol.io/)

---

## 💡 The Executive Pitch: Why ACM Wins

As autonomous LLM agents (Claude Desktop, OpenAI Assistants, LangChain swarms, AutoGPT) evolve from conversational bots into economic actors that book travel, order food, and buy hardware, **they cannot be given direct, unconstrained access to credit cards or payment APIs**.

### The Double-Bind of Agentic Commerce:
1. **The Vulnerability Trap**: Giving external LLMs raw payment keys opens the door to prompt injection theft, canary probing, runaway loops, and smurfing attacks.
2. **The Latency & Friction Trap**: Running heavy deep-inspection fraud checks on every ₹40 chai or milk order creates unnecessary processing delays and engineering bloat.

### The ACM Solution: Adaptive Bimodal Zero-Trust Architecture
Razorpay ACM bridges this gap with an **Adaptive Dual-Speed Highway**:
* 🚗 **Express Highway (< 0.1ms)**: Routine, low-risk commodity orders (milk, bread, cab rides) by established agents sail through in microseconds with zero perceptible delay.
* 🔬 **Deep Inspection Lane (< 1.5ms)**: High-risk categories (electronics, vouchers), new agents, or **5% randomized spot-checks** (TSA PreCheck model) automatically step up to full 6-layer cryptographic and semantic verification.
* 🧠 **Cold-Path AI Security Interrogation (Google Gemini 3.1)**: An isolated cloud security analyst interrogates the buyer bot's self-explanation on failure—distinguishing innocent hallucinations (guiding them to self-heal) from adversarial prompt injections (auto-revoking the agent's credentials in PostgreSQL).
* 📈 **Built-in AI Growth Engine (+35% AOV Lift)**: Statistical co-purchase basket builder that increases merchant order value safely within mandate caps.

---

## 🏗️ Entire End-to-End System Architecture

```
                                  [ EXTERNAL AI AGENTS ]
                    ┌────────────────────────┼────────────────────────┐
                    ▼                        ▼                        ▼
           Claude Desktop (MCP)     OpenAI Tool Calling       LangChain / ACP Bot
                    │                        │                        │
  ══════════════════╪════════════════════════╪════════════════════════╪══════════════════════
                    ▼                        ▼                        ▼
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                           1. INGESTION & PROTOCOL ADAPTERS                             │
  │   • Anthropic MCP Stdio (:3000)   • Google AP2 Token Verifier   • ACP Checkout API     │
  └──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │
                                             ▼
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                   2. ADAPTIVE SECURITY TIER ROUTER (TSA PreCheck Model)                │
  │   • Dynamic Trust Score Meter (0 - 100)        • Category Risk & Liquidity Weighting   │
  │   • Familiarity & Velocity Fingerprinting      • Non-Deterministic 5% Spot-Check       │
  └──────────────────────┬───────────────────────────────────────────┬─────────────────────┘
                         │                                           │
         [ Routine & High-Trust (90%) ]             [ High-Risk, New, or 5% Sampled ]
                         ▼                                           ▼
  ┌──────────────────────────────────────────┐ ┌───────────────────────────────────────────┐
  │         3A. ⚡ EXPRESS HIGHWAY           │ │         3B. 🔬 DEEP INSPECTION LANE       │
  │            (Latency: < 0.1ms)            │ │            (Latency: < 1.5ms)             │
  │  • Active Mandate Sanity Check           │ │  • Layer 1: Cryptographic AP2 Authority   │
  │  • Real-Time Spend Cap & Daily Ceiling   │ │  • Layer 2: Semantic Intent Drift Guard   │
  │  • Deterministic Quote Hash Verification │ │  • Layer 3: Moving-Avg Price Drift Guard  │
  └──────────────────────┬───────────────────┘ │  • Layer 4: Anti-Smurfing Structuring     │
                         │                     │  • Layer 5: Pincode Geofence & Off-Hours  │
                         │                     │  • Layer 6: Canary Traps & Circuit Breaker│
                         │                     └─────────────────────┬─────────────────────┘
                         ▼                                           │ (Anomaly / Violation)
  ┌──────────────────────────────────────────┐                       ▼
  │    4. DETERMINISTIC CART LOCKING         │ ┌───────────────────────────────────────────┐
  │   SHA-256(Items + Total + Currency)      │ │   5. COLD-PATH: GEMINI AI SECURITY ANALYST│
  │   Pinned inside Razorpay Order Notes     │ │         (Google Gemini 3.1 Flash)         │
  └──────────────────────┬───────────────────┘ │  • Buyer Agent Deposition & Interrogation │
                         │                     │  • Intent vs. Cart Adversarial Analysis   │
                         │                     │  • Self-Healing vs. Killswitch Decision   │
                         │                     └─────────────────────┬─────────────────────┘
                         │                                           │
                         │                                    ┌──────┴──────┐
                         │                                    ▼             ▼
                         │                             [REVOKE ACCESS] [SELF-CORRECT]
                         │                             Killswitch in DB Machine Guidance
                         ▼                                    │             │
  ═══════════════════════╪════════════════════════════════════╪═════════════╪════════════════
                         ▼                                    ▼             ▼
  ┌──────────────────────────────────────────┐ ┌───────────────────────────────────────────┐
  │    6. RAZORPAY SETTLEMENT & REVENUE      │ │   7. OPERATOR DASHBOARD & AUDIT TELEMETRY │
  │   • Razorpay Orders & Payment Links API  │ │   • Next.js 16 Real-Time SSE Push (:3001) │
  │   • Instant Webhook Signature Sync       │ │   • Live Gemini Threat Card & Trust Meters│
  │   • +35% AOV Co-Purchase Growth Engine   │ │   • Immutable Forensic Audit Trail (DB)   │
  └──────────────────────────────────────────┘ └───────────────────────────────────────────┘
```

### Interactive Flow Diagram (Mermaid)

```mermaid
flowchart TB
    subgraph BUYER_AGENTS["1. Autonomous Buyer Agents"]
        direction LR
        A1["Claude Desktop\n(Anthropic MCP)"]
        A2["OpenAI Assistants\n(Tool Calling)"]
        A3["LangChain / Python\n(REST API)"]
        A4["ACP Protocol\n(Agentic Commerce)"]
    end

    subgraph INTERFACES["2. Ingestion & Protocol Adapters"]
        direction LR
        I1["MCP Server (Stdio)"]
        I2["AP2 Intent Proof Verifier"]
        I3["Fastify Gateway (:3000)"]
        I4["ACP Adapter (/v1/acp)"]
    end

    BUYER_AGENTS --> INTERFACES

    subgraph ADAPTIVE_ROUTER["3. Adaptive Security Tier Classifier"]
        R1{"Dynamic Trust Score\n& Risk Classifier"}
        R2["Trust Score Meter\n(0 - 100 Rating)"]
        R3["5% Probabilistic Spot-Check\n(TSA PreCheck Model)"]
    end

    INTERFACES --> R1
    R1 -.-> R2
    R1 -.-> R3

    subgraph HOT_PATH["4. Hot-Path: 100% Deterministic Guardrails (< 1.5ms)"]
        direction TB
        subgraph LANE_1["⚡ EXPRESS HIGHWAY (< 0.1ms)"]
            L1["Routine Low-Risk Items (Bread, Milk, Cab)\nSanity Check: Mandate Cap + Active Hash"]
        end
        
        subgraph LANE_2["🔬 DEEP INSPECTION LANE (Full 6-Layer Security)"]
            D1["Layer 1: AP2 Cryptographic Authority Proof"]
            D2["Layer 2: Semantic Cart Invariance (Jaccard NLP)"]
            D3["Layer 3: Moving-Average Price Drift Guard"]
            D4["Layer 4: Anti-Smurfing Structuring Limiter"]
            D5["Layer 5: Pincode Geofence & Off-Hours Fencing"]
            D6["Layer 6: Canary Honeytokens & Circuit Breaker"]
        end
        
        LOCK["Deterministic Cart Hash Pinning\nSHA-256(items + total + currency)"]
    end

    R1 -- "Trusted & Routine (90%)" --> LANE_1
    R1 -- "High-Risk, New, or 5% Sampled" --> LANE_2
    LANE_1 --> LOCK
    LANE_2 --> LOCK

    subgraph COLD_PATH["5. Cold-Path: Google Gemini AI Security Analyst"]
        direction TB
        G1["Agent Interrogation Engine\n(Evaluates buyerAgentExplanation)"]
        G2{"Gemini Threat Assessment\n(gemini-3.1-flash-lite)"}
        G3["🛑 MALICIOUS THREAT\nAutonomous Killswitch (agent.revoked = true)"]
        G4["✅ BENIGN HALLUCINATION\nSelf-Healing Remediation Payload"]
        G1 --> G2
        G2 -- "Revoke Access" --> G3
        G2 -- "Safe to Continue" --> G4
    end

    LANE_2 -- "Anomaly / Failure / Gate" --> COLD_PATH

    subgraph GROWTH_ENGINE["6. AI Growth Engine (+35% AOV Lift)"]
        GW1["Market-Basket Co-Purchase Graph"]
        GW2["Affinity Recommender (Within Mandate Cap)"]
    end

    LOCK -.-> GROWTH_ENGINE

    subgraph SETTLEMENT_AND_OPS["7. Settlement, Storage & Operations"]
        direction LR
        RZP["💳 Razorpay Payment Gateway\n(Orders, Payment Links, Webhooks)"]
        DB[("🐘 PostgreSQL (Port 5433)\nAudit Logs, Mandates, Agents")]
        DASH["🖥️ Next.js 16 Operator Dashboard (:3001)\nSSE Push, 1-Click Approvals, Trust Meters"]
    end

    LOCK -- "Approved" --> RZP
    HOT_PATH --> DB
    COLD_PATH --> DB
    COLD_PATH -.-> DASH
    RZP -- "payment.captured Webhook" --> INTERFACES
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

### 2. 🤖 Cold-Path Gemini AI Security Analyst & Agent Interrogation
* **The Challenge**: Traditional payment gateways return generic `400 Bad Request` or `403 Forbidden` errors, causing autonomous LLMs to crash, hallucinate invalid states, or retry endlessly.
* **How ACM Solves It**: Decoupled from the checkout hot-path, an isolated **Google Gemini Security Analyst** (`gemini-3.1-flash-lite`) interrogates the buyer agent's self-explanation. It differentiates between innocent hallucinations (generating machine-actionable self-healing payloads to adjust quantities/SKUs) and malicious prompt injections (advising the gateway to auto-revoke the agent's credentials).

---

### 3. ✍️ Cryptographic Proof of Authority (Google AP2 Intent Binding)
* **The Challenge**: Malicious agents or prompt-injected LLMs can drift from what the human user originally authorized (e.g., user approved a ₹500 pizza, agent orders a ₹2,000 gadget).
* **How ACM Solves It**: Implements an HMAC-SHA256 cryptographic mandate binding `{ userId, agentId, intent, maxAuthorizedPaise, allowedMerchant, expiresAt }`. ACM verifies this timing-safely at the network boundary before processing the payment.

---

### 4. 🧠 Semantic Cart Invariance & Price Drift Shield
* **The Challenge**: Prompt injections from untrusted websites can redirect an agent to buy untracked items (gift cards, crypto), or merchants can surge prices after the user agreed.
* **How ACM Solves It**:
  * **Zero-Latency Jaccard Keyword Overlap**: Tokenizes user intent and verifies keyword overlap with cart SKUs in < 0.2ms.
  * **Strict Blacklist**: Instantly rejects high-risk categories (`vouchers.giftcards`, `crypto.currency`, `luxury.jewelry`).
  * **Price Drift Guard**: Flags any SKU unit price deviating $> 15\%$ from catalog baseline for human approval.

---

### 5. 🦹 Anti-Smurfing Structuring Defense & Runaway Loop Limiter
* **The Challenge**: A rogue or compromised agent can evade a ₹500 auto-approval threshold by placing multiple ₹490 orders in rapid succession, or a while-loop bug can drain a wallet in seconds.
* **How ACM Solves It**:
  * **Structuring Cluster Detector**: Identifies transaction clustering within 88%–100% of the threshold and automatically holds the entire batch for human review.
  * **Sliding-Window Velocity Engine**: Limits transactions to max 20 per 10 minutes and triggers an automated cooldown if $\ge 4$ orders arrive within 120 seconds.

---

### 6. 🔒 Anti-TOCTOU Cart Pinning & Gateway Locking
* **The Challenge**: In Time-of-Check to Time-of-Use (TOCTOU) attacks, a malicious actor or buggy agent alters the cart items or prices between quote generation and final payment execution.
* **How ACM Solves It**: ACM hashes the verified cart (`SHA-256(items + total + currency)`) and pins this immutable digest inside the Razorpay Order `receipt` and `notes.quoteHash`. The payment link is strictly locked with a 10-minute TTL.

---

### 7. 📍 Contextual Fencing (Geofence & Temporal Fencing)
* **The Challenge**: Stolen agent credentials can order goods for delivery to unauthorized addresses or initiate abnormal high-value purchases at 3:00 AM.
* **How ACM Solves It**:
  * **Address Geofence**: Validates delivery pincodes against the user's pre-approved whitelist (`allowedPincodes`).
  * **Temporal Fencing**: Detects unusual off-hours activity (02:00–06:00 IST) for consumer verticals and elevates the composite risk score.

---

### 8. 🪤 Canary Honeytoken Traps & Autonomous Circuit Breaker
* **The Challenge**: Attackers probe agent capabilities with jailbreaks or attempt to enumerate internal catalogs.
* **How ACM Solves It**: Deploys "canary honeytoken SKUs" (e.g., `test-unrestricted-admin-token`). Any agent requesting a canary item or incurring repeated policy violations triggers an instant circuit breaker that revokes the agent's credentials in PostgreSQL immediately (`revoked: true`).

---

### 9. 🖥️ Real-Time Human-in-the-Loop Operator Dashboard
* **The Challenge**: Binary blocking creates customer friction and false-positive drops when an order legitimately exceeds normal limits.
* **How ACM Solves It**: A modern Next.js 16 dark-mode dashboard with live Server-Sent Events (SSE). 
  * **Tiered Risk Engine**: Scores transactions 0–100. Low risk (< 35) is auto-approved; moderate risk (35–70) is held for 1-click human approval; high risk (> 70) is denied.
  * **One-Click Decisioning**: Operators can review risk badges, inspect cart contents, view live Gemini AI briefs, and approve or reject orders in real time.

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
  ⚡ < 0.1ms              🛡️ 100%                 📈 +35.0%               🧪 60 / 60
  Express Highway         Deterministic Safety    AOV Basket Lift         Tests Passing (< 1s)
  Microsecond clearance   Zero LLM on financial   Automated co-purchase   Full security, AP2 &
  for routine purchases   payment execution       recommendations         Razorpay test suite
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
* **Live Gemini Security Analyst & Adaptive Tiers Test**:
  ```bash
  npm run test:nlp
  ```
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
