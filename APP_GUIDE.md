# Agent Commerce Middleman (ACM) — Complete Operating & Demo Guide

> **A Comprehensive Guide to Architecture, Multi-Protocol Agent Connectivity, and Full In-Flight Zero-Trust Demonstration Flows across 5 Real-World Consumer Tracks.**

---

## Table of Contents

1. [How the App Works (System Architecture)](#1-how-the-app-works-system-architecture)
2. [Sequential Startup Runbook](#2-sequential-startup-runbook)
3. [The 5 Multi-Protocol Agent Connectivity Routes](#3-the-5-multi-protocol-agent-connectivity-routes)
4. [5 Real-World Consumer Tracks & Catalog](#4-5-real-world-consumer-tracks--catalog)
5. [Step-by-Step Complete Demo Walkthrough](#5-step-by-step-complete-demo-walkthrough)
   - [Demo 1: Multi-Agent Concurrent Execution (Normal vs. Gated vs. Rogue)](#demo-1-multi-agent-concurrent-execution)
   - [Demo 2: Real-World Movie Ticket Booking (PVR & IMAX)](#demo-2-real-world-movie-ticket-booking-pvr--imax)
   - [Demo 3: Food Delivery Booking with Co-Purchase Upsell (Zomato & Swiggy)](#demo-3-food-delivery-booking-with-co-purchase-upsell)
   - [Demo 4: In-Flight Honeytoken Attack & Autonomous Circuit Breaker](#demo-4-in-flight-honeytoken-attack--autonomous-circuit-breaker)
   - [Demo 5: Operator Review Queue & One-Click Approval Flow](#demo-5-operator-review-queue--one-click-approval-flow)
   - [Demo 6: Simulating Payment Settlement via Razorpay Webhooks](#demo-6-simulating-payment-settlement-via-razorpay-webhooks)
   - [Demo 7: Visual Audit Trail & High-Resolution Telemetry](#demo-7-visual-audit-trail--high-resolution-telemetry)
6. [Connecting Claude Desktop via MCP](#6-connecting-claude-desktop-via-mcp)
7. [Connecting OpenAI / ChatGPT / LangChain Agents](#7-connecting-openai--chatgpt--langchain-agents)

---

## 1. How the App Works (System Architecture)

**Agent Commerce Middleman (ACM)** is an in-flight, zero-trust financial guardrail gateway for autonomous AI agents. Rather than giving LLMs direct access to credit cards or unchecked payment APIs, ACM intercepts transactions in real time, executing a 6-stage deterministic security pipeline in **< 1.5ms** before contacting Razorpay.

```
                              THE ZERO-TRUST 6-STAGE PIPELINE
                                   (Total Latency: < 1.5ms)

   [Autonomous Agent Request]
              │
              ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 🪤 Layer 6: Canary Honeytoken & Circuit Breaker Check (< 0.1ms)        │
   │ ├── `checkCanarySKUs` — Detects tripwire honeypot tokens               │
   │ └── `checkCircuitBreaker` — Auto-revokes agent if violations repeat    │
   └────────────────────────────────────────────────────────────────────────┘
              │ (Pass)
              ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ ⚡ Layer 3: Velocity & Anti-Smurfing Structuring Defense (< 0.2ms)      │
   │ ├── `checkRateAndVelocity` — Token-bucket burst rate limiter           │
   │ ├── `checkBurstCooldown` — Trips cooldown on rapid-fire loops          │
   │ └── `checkSmurfing` — Detects clustering right below auto-approve limit│
   └────────────────────────────────────────────────────────────────────────┘
              │ (Pass)
              ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ ✍️ Layer 1: Cryptographic User Intent Binding (Google AP2) (< 0.3ms)   │
   │ ├── `verifyUserIntentProof` — Cryptographic Proof of Authority (PoA)   │
   │ └── Validates user signature, authorized max amount, and expiration    │
   └────────────────────────────────────────────────────────────────────────┘
              │ (Pass)
              ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 🧠 Layer 2: Semantic Cart Invariance & Price Drift (< 0.3ms)           │
   │ ├── `checkSemanticCartInvariance` — Strict blacklist on gift cards/    │
   │ │   crypto/prepaid vouchers + Jaccard intent-to-cart keyword overlap   │
   │ └── `checkPriceDrift` — Flags SKU unit prices deviating > 15% from base│
   └────────────────────────────────────────────────────────────────────────┘
              │ (Pass)
              ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 📍 Layer 5: Contextual Fencing (< 0.2ms)                               │
   │ ├── `checkDeliveryGeofence` — Restricts deliveries to approved pincodes│
   │ └── `checkTemporalBoundaries` — Flags off-hours activity (2 AM - 6 AM) │
   └────────────────────────────────────────────────────────────────────────┘
              │ (Pass)
              ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 🔒 Layer 4: Gateway Locking & Anti-TOCTOU (< 0.2ms)                    │
   │ ├── `computeQuoteHash` — SHA-256 hash pinned in Razorpay order receipt │
   │ └── `verifyQuoteIntegrity` — Blocks checkout if amount/SKU was tampered│
   └────────────────────────────────────────────────────────────────────────┘
              │ (Pass)
              ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 🎯 Tiered Composite Risk Engine & Smart Gating (< 0.2ms)               │
   │ ├── 🟢 Low Risk (Score < 35)   ──> ⚡ Fast-Track Auto-Approval (< 2ms)  │
   │ ├── 🟡 Med Risk (Score 35–70)  ──> 🛡️ Gated for Operator Review (UI)   │
   │ └── 🔴 High Risk (Score > 70)  ──> 🛑 Instant Denial & Circuit Breaker │
   └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Sequential Startup Runbook

### Step 1: Initialize Database & Seed Demo Catalog
```bash
npm run setup
```
*Starts Docker PostgreSQL on port 5433, syncs Prisma schemas, and seeds 5 real-world tracks, products, mandates, and historical transactions.*

### Step 2: Launch Backend & Dashboard
```bash
npm run dev
```
*Starts Fastify API (`http://localhost:3000`) and Next.js Dashboard (`http://localhost:3001`).*

---

## 3. The 5 Multi-Protocol Agent Connectivity Routes

| Route | Protocol / Format | Target Agent Type | Implementation Endpoint |
|---|---|---|---|
| **1. Claude Desktop** | Model Context Protocol (MCP) | Anthropic Desktop Assistant | `apps/mcp-server/src/index.js` |
| **2. OpenAI / ChatGPT** | OpenAI Function Calling | ChatGPT, Assistants API, OpenPipe | `GET /v1/agent-tools` |
| **3. Python Swarms** | REST API & Custom Headers | LangChain, CrewAI, AutoGen | `POST /v1/quotes`, `POST /v1/payments` |
| **4. E-Commerce Agents** | Agentic Commerce Protocol (ACP) | Standard E-Commerce Checkout | `POST /v1/acp/checkout` |
| **5. Google AP2** | Cryptographic Intent Tokens | Proof-of-Authority Clients | `x-proof-of-authority` header |

---

## 4. 5 Real-World Consumer Tracks & Catalog

1. **🎬 Movie & Entertainment** (`PVR INOX & IMAX Cinemas`):
   - `pvr-imax-3d-ticket` (₹450), `pvr-jumbo-caramel-popcorn` (₹280), `pvr-twin-pepsi-cup` (₹180), `pvr-crispy-nachos-cheese` (₹240)
2. **🍕 Food Delivery & Dining** (`Zomato & Swiggy Kitchen`):
   - `swiggy-smoky-paneer-pizza` (₹399), `zomato-garlic-breadsticks` (₹149), `swiggy-choco-lava-cake` (₹109), `zomato-cold-coffee-frappe` (₹129)
3. **🛒 Quick Commerce & Grocery** (`Blinkit & Instamart Superstore`):
   - `blinkit-artisan-bread` (₹45), `blinkit-salted-butter-200g` (₹65), `blinkit-fresh-milk-1l` (₹68), `blinkit-farm-eggs-12pack` (₹95)
4. **⚡ Electronics & Hardware** (`Amazon & Croma Hub`):
   - `voltcharge-gan-65w` (₹1,899), `amazonbasics-type-c-100w` (₹499), `croma-20000mah-powerbank` (₹2,499), `acousticair-pro-earbuds` (₹3,499)
5. **✈️ Travel & Cab Mobility** (`MakeMyTrip & Uber Mobility`):
   - `uber-premier-airport-cab` (₹650), `mmt-trip-delay-protection` (₹199), `air-flight-meal-selection` (₹350)

---

## 5. Step-by-Step Complete Demo Walkthrough

### Demo 1: Multi-Agent Concurrent Execution
Demonstrates 3 autonomous agents simultaneously firing requests with different risk profiles:
```bash
npm run demo:concurrent
```
* **Food Delivery Booking Agent (Zomato)** (₹258) ➔ **Auto-Approved (< ₹500 limit)**.
* **Movie Ticket Booking Agent (PVR)** (₹1,080) ➔ **Gated for Human Review (> ₹600 limit)**.
* **Rogue Ticket Scalper Bot** (Revoked credential) ➔ **Denied by Zero-Trust Gatekeeper**.

---

### Demo 2: Real-World Movie Ticket Booking (PVR & IMAX)
Simulate an agent booking 1 PVR IMAX ticket:
```bash
curl -s -X POST http://localhost:3000/v1/quotes \
  -H "Content-Type: application/json" \
  -d '{"items": [{"sku": "pvr-imax-3d-ticket", "qty": 1}]}' | jq .
```
Then initiate payment under `movie-ticket-agent`:
```bash
curl -s -X POST http://localhost:3000/v1/payments \
  -H "Content-Type: application/json" \
  -H "x-agent-id: movie-ticket-agent" \
  -d '{"quoteId": "<QUOTE_ID_FROM_ABOVE>"}' | jq .
```
**Outcome**: Auto-approved (`status: "payment_link_created"`) because ₹450 < ₹600 auto-approve threshold.

---

### Demo 3: Food Delivery Booking with Co-Purchase Upsell
1. Check complementary pairings for Smoky Paneer Pizza:
```bash
curl -s -X POST http://localhost:3000/v1/suggest-addons \
  -H "Content-Type: application/json" \
  -d '{"skus": ["swiggy-smoky-paneer-pizza"]}' | jq .
```
*Returns Garlic Breadsticks and Choco Lava Cake (+35% AOV Lift).*

---

### Demo 4: In-Flight Honeytoken Attack & Autonomous Circuit Breaker
Simulate a rogue agent attempting to order a restricted honeypot SKU:
```bash
node -e "
async function testHoneytoken() {
  const quoteRes = await fetch('http://localhost:3000/v1/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ sku: 'test-unrestricted-admin-token', qty: 1 }] })
  });
  const quote = await quoteRes.json();
  const payRes = await fetch('http://localhost:3000/v1/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-id': 'probe-bot' },
    body: JSON.stringify({ quoteId: quote.id })
  });
  console.log(await payRes.json());
}
testHoneytoken();
"
```
**Outcome**:
* `status: "denied"`
* `reason: "tripwire honeytoken detected: SKU test-unrestricted-admin-token is a restricted canary token"`
* Agent credential is automatically revoked in database.

---

### Demo 5: Operator Review Queue & One-Click Approval Flow
1. Open the Operator Dashboard at `http://localhost:3001/approvals`.
2. High-value orders (> autoApproveThreshold) appear instantly in the queue.
3. Click **Approve** ➔ Razorpay Order and Payment Link are created in real time.

---

### Demo 6: Simulating Payment Settlement via Razorpay Webhooks
```bash
curl -s -X POST http://localhost:3000/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: <SIGNATURE>" \
  -d '{"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_live_001", "order_id": "<RAZORPAY_ORDER_ID>", "amount": 45000}}}}'
```

---

### Demo 7: Visual Audit Trail & High-Resolution Telemetry
Open `http://localhost:3001/audit/<CORRELATION_ID>` to inspect:
* Execution latency (`< 1.5ms`)
* Pinned SHA-256 Quote Hash
* Decision logs across all 6 defense stages

---

## 6. Connecting Claude Desktop via MCP

Add ACM to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "acm-commerce-gateway": {
      "command": "node",
      "args": ["/Users/shikharyadav/Desktop/Razorpay/acm/apps/mcp-server/src/index.js"],
      "env": {
        "ACM_API_URL": "http://localhost:3000",
        "ACM_AGENT_NAME": "Claude Desktop"
      }
    }
  }
}
```

---

## 7. Connecting OpenAI / ChatGPT / LangChain Agents

Fetch tool schemas in 1 line:
```python
import requests, openai

# Fetch standard OpenAI tools from ACM
tools = requests.get("http://localhost:3000/v1/agent-tools").json()["openai_tools"]

response = openai.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Order 2 PVR IMAX tickets"}],
    tools=tools,
)
```
