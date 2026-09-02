# Razorpay Agentic AI Commerce Tool (Agent Commerce Gateway / Middleman)

> **Deterministic Guardrails, Policy Engine, Multi-Agent Governance, and Razorpay Payment Gateway for Autonomous AI Agents.**

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](#license)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black.svg)](https://nextjs.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.x-1B222D.svg)](https://www.prisma.io/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black.svg)](https://fastify.dev/)

---

## Overview

**Agent Commerce Middleman (ACM)** acts as a secure, zero-trust intermediary layer between autonomous AI agents (e.g., Claude Desktop, custom LLM agents) and payment processors (Razorpay). Rather than giving LLMs unchecked access to payment credentials or cards, the gateway enforces deterministic financial boundaries, strict spending caps, multi-agent mandate management, cryptographic webhook verification, and human-in-the-loop approval gates.

```mermaid
flowchart TD
    subgraph AgentLayer ["1. Autonomous Agent Layer"]
        Claude["AI Agent / MCP Client<br>Claude Desktop / Custom LLMs"]
        MCP["ACM MCP Server<br>apps/mcp-server"]
    end

    subgraph GatewayLayer ["2. Gateway API and Policy Engine :3000"]
        API["Fastify API Server<br>apps/api"]
        PolicyEngine["Deterministic Policy Engine<br>packages/policy-engine"]
        DB[("PostgreSQL Database :5433<br>Prisma ORM")]
    end

    subgraph OperatorLayer ["3. Human-in-the-Loop Dashboard :3001"]
        Approvals["Pending Approvals Queue<br>/approvals"]
        Agents["Agent Registry and Mandates<br>/agents and /agents/:id"]
        Audit["Audit Trail Explorer<br>/audit/:correlationId"]
    end

    subgraph RazorpayLayer ["4. Payments and Webhook Pipeline"]
        Razorpay["Razorpay Payments API<br>Orders, Links and Refunds"]
        Webhook["Webhook Listener and Sync<br>/webhooks/razorpay"]
    end

    Claude -->|"Tool Calls (order_product, get_quote, etc.)"| MCP
    MCP -->|"HTTP REST with x-agent-id headers"| API
    API -->|"Evaluate Mandate and Caps"| PolicyEngine
    PolicyEngine -->|"Record Decisions and Logs"| DB
    PolicyEngine -->|"Auto-Approved (Under Limit)"| Razorpay
    PolicyEngine -->|"Gated (Exceeds Limit / First-Time)"| DB
    DB -.->|"Live Pending Queue"| Approvals
    DB -.->|"Live Spend and Status"| Agents
    DB -.->|"Audit Events"| Audit
    Approvals -->|"Human One-Click Approve"| API
    API -->|"Generate Order and Payment Link"| Razorpay
    Razorpay -->|"Signed HMAC Webhook"| Webhook
    Webhook -->|"Update State (paid / failed)"| DB
```

---

## Core Capabilities

- **Deterministic Policy Engine (Zero-LLM Trust)**: Pure deterministic JavaScript rules for financial boundaries — per-transaction caps, 24h cumulative spend limits, allowed merchant categories, and first-time merchant review gates.
- **Multi-Agent Governance & Spend Tracking**: Dynamic agent auto-provisioning via `x-agent-id` / `x-agent-name` headers, individual per-agent mandates, live 24h spend progress bars, and instant active/revoked killswitch controls.
- **Model Context Protocol (MCP)**: Native integration for **Claude Desktop** and autonomous agents (`order_product`, `browse_catalog`, `get_active_mandate`, `get_quote`, `initiate_payment`, `check_status`, `suggest_addons`, `request_refund`).
- **Human-in-the-Loop Operator Dashboard**: Next.js 16 real-time web interface to review and approve/reject gated transactions with interactive Razorpay payment link generation modals and visual audit timelines.
- **Razorpay Integration & Direct Order Sync**: Idempotent order creation, payment link generation, instant payment verification, automated refunds, and automatic direct Razorpay order polling fallback.
- **Secure Webhook Pipeline**: Raw body buffer capture and constant-time HMAC-SHA256 signature verification for `payment.captured`, `order.paid`, and `payment.failed` events.
- **Immutable Visual Audit Trail**: Every policy decision, rule evaluation, transaction state change, and webhook event is recorded in PostgreSQL with correlation IDs and human-readable explanations.

---

## Architecture & Monorepo Structure

```text
acm/
├── apps/
│   ├── api/                     # Fastify REST API & Webhook listener (Port 3000)
│   │   ├── src/
│   │   │   ├── index.js         # API routes, multi-agent endpoints, policy checks, webhooks
│   │   │   └── razorpay.js      # Razorpay SDK client & payment helpers
│   │   └── test-order.js        # Integration test script for orders & payment links
│   ├── dashboard/               # Next.js 16 Human-in-the-Loop & Governance UI (Port 3001)
│   │   └── app/
│   │       ├── approvals/       # Live human approval & rejection queue for gated orders
│   │       ├── agents/          # Multi-agent registry, spend analytics & status toggles
│   │       │   └── [agentId]/   # Per-agent deep dive, mandate configuration & history
│   │       ├── audit/           # Visual audit trail & timeline explorer
│   │       │   └── [correlationId]/ # Correlation ID drilldown with step-by-step logs
│   │       └── components/      # Reusable UI components (Navbar, PaymentModal, etc.)
│   └── mcp-server/              # Model Context Protocol (MCP) server for Claude Desktop
│       └── src/
│           └── index.js         # Stdio MCP tool definitions & automatic agent headers
├── packages/
│   ├── db/                      # Prisma ORM schema, migrations, and seed scripts
│   │   └── prisma/
│   │       ├── schema.prisma    # PostgreSQL data models (Agents, Mandates, Quotes, Audit)
│   │       └── seed.js          # Demo merchants, catalog items, and multi-agent mandates
│   └── policy-engine/           # Deterministic policy rules & orchestrator
│       └── src/
│           ├── rules.js         # Individual deterministic validation rules
│           ├── evaluate.js      # Rule orchestrator with audit logging
│           └── rules.test.js    # Unit test suite
├── docker-compose.yml           # Containerized PostgreSQL instance (Port 5433)
├── APP_GUIDE.md                 # Complete system operating & end-to-end demo guide
├── .env.example                 # Template for required environment variables
└── package.json                 # Root workspace configuration & scripts
```

---

## Quickstart Guide (Simplified 1-Command Startup)

### 1. Prerequisites
- **Node.js**: v20+ or v22+ (`node -v`)
- **Docker Desktop**: For running PostgreSQL (`docker --version`)
- **Razorpay Account**: Test mode credentials from [Razorpay Dashboard](https://dashboard.razorpay.com/#/app/keys)

---

### 2. Environment Configuration
Copy `.env.example` to `.env` in the root folder:
```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
RAZORPAY_KEY_ID=rzp_test_YourKeyId
RAZORPAY_KEY_SECRET=YourKeySecret
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecret
DATABASE_URL=postgresql://acm:acm_dev_password@localhost:5433/acm
PORT=3000
```

---

### 3. One-Click Setup (Docker + Database + Seed Data)

Run the automated setup command from either the workspace root or `acm/`:
```bash
npm run setup
```
*(This starts PostgreSQL in Docker on port 5433, synchronizes Prisma models, and seeds demo agents, merchants, and catalog items).*

---

### 4. Single-Command Dev Environment (API + Dashboard)

Start both the **Fastify Backend API (:3000)** and the **Next.js Dashboard (:3001)** simultaneously:
```bash
npm run dev
```

*Or launch API + Dashboard + Prisma Studio GUI simultaneously:*
```bash
npm run dev:all
```

---

### 5. Operator Dashboard Features

Open your browser at **`http://localhost:3001`**:

- **Approvals Queue (`http://localhost:3001/approvals`)**:
  - Live list of transactions held for human review (due to `gate_threshold` or `gate_first_time`).
  - Single-click **Approve** (generates Razorpay order & copyable payment link modal) or **Decline**.
- **Agent Governance (`http://localhost:3001/agents`)**:
  - Multi-agent registry with live 24h spend vs. daily limit progress bars.
  - Active / Revoked status toggle switch (instant emergency killswitch).
  - Individual agent view (`/agents/[agentId]`) with transaction history and mandate specs.
- **Audit Explorer (`http://localhost:3001/audit/[correlationId]`)**:
  - Visual timeline of policy evaluations, state changes, actor details, and webhook events for any transaction.

---

### 6. Connect Claude Desktop (MCP Integration)

To connect Claude Desktop to your commerce gateway:

1. Open (or create) the Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the `acm` MCP server configuration:
   ```json
   {
     "mcpServers": {
       "acm": {
         "command": "node",
         "args": [
           "/ABSOLUTE/PATH/TO/acm/apps/mcp-server/src/index.js"
         ],
         "env": {
           "ACM_API_URL": "http://localhost:3000",
           "ACM_AGENT_NAME": "Claude Desktop",
           "ACM_AGENT_ID": "claude-desktop"
         }
       }
     }
   }
   ```
   *(Replace `/ABSOLUTE/PATH/TO/acm` with your full workspace path, e.g. `/Users/shikharyadav/Desktop/Razorpay/acm`).*

3. Restart Claude Desktop.

---

## MCP Tools Reference

Claude and AI agents have access to 8 purpose-built MCP tools:

| Tool | Purpose | Primary Parameters |
|---|---|---|
| `order_product` | **Primary Autonomous Tool**: Searches catalog, creates quote, checks mandate, and initiates payment in 1 step | `query` (string), `quantity` (number) |
| `browse_catalog` | List all available merchant items, pricing, SKUs, and stock levels | none |
| `get_active_mandate` | View spending limits, per-transaction caps, and thresholds for the calling agent | none |
| `get_quote` | Generate a formal price quote before purchasing | `items` (array of `{ sku, qty }`) |
| `initiate_payment` | Submit a quote for policy evaluation and order creation | `quoteId` (string), `mandateId` (optional) |
| `check_status` | Check live status and state of a transaction | `transactionId` (string) |
| `suggest_addons` | AI smart cross-sell and complementary add-on suggestions | `skus` (array of strings) |
| `request_refund` | Request a Razorpay refund for a completed paid order | `transactionId` (string), `reason` (optional) |

---

### 7. Razorpay Webhooks (Local Tunnel with ngrok)

To receive real-time payment updates from Razorpay:

1. Start ngrok on port 3000:
   ```bash
   ngrok http 3000
   ```

2. Register the webhook in **Razorpay Dashboard > Settings > Webhooks**:
   - **Webhook URL**: `https://<your-ngrok-subdomain>.ngrok-free.dev/webhooks/razorpay`
   - **Secret**: The value set in `RAZORPAY_WEBHOOK_SECRET`
   - **Active Events**: `payment.captured`, `payment.failed`, `order.paid`

---

## Policy Engine Rules

All transactions are evaluated against deterministic policies before any money moves:

| Rule | Description | Decision on Violation |
|---|---|---|
| `agent_valid` | Verifies agent exists and is in `active` state (rejects `revoked` agents) | `deny` |
| `mandate_coverage` | Validates merchant ID and product category scoping | `deny` |
| `per_txn_cap` | Ensures quote does not exceed mandate per-transaction ceiling | `deny` |
| `daily_cap` | Enforces 24-hour cumulative spending limit | `deny` |
| `gate_threshold` | Routes high-value transactions to human approval | `pending` (Routes to Dashboard) |
| `gate_first_time` | Requires human verification for newly encountered merchants | `pending` (Routes to Dashboard) |

---

## Available NPM Scripts

From either root workspace or `acm/`:

| Command | Description |
|---|---|
| `npm run setup` | Start Docker PostgreSQL, push Prisma schema, and seed demo database |
| `npm run dev` | Run Fastify API and Next.js Dashboard concurrently |
| `npm run dev:all` | Run Fastify API, Dashboard, and Prisma Studio concurrently |
| `npm run dev:api` | Start Fastify REST API with live reload (`http://localhost:3000`) |
| `npm run dev:dashboard` | Start Next.js Dashboard UI (`http://localhost:3001`) |
| `npm run mcp:start` | Run MCP server via stdio transport |
| `npm test` | Run policy engine unit tests and full API integration test suite |
| `npm run test:unit` | Run deterministic policy engine unit tests |
| `npm run test:integration` | Run Fastify API and webhook integration tests |
| `npm run db:push` | Sync Prisma schema with PostgreSQL database |
| `npm run db:seed` | Seed initial database data |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run api:test-order` | Run end-to-end integration test order script |

---

## Known Limitations & Design Assumptions

1. **Deterministic vs. LLM-Evaluated Money Paths**: The money execution pipeline is deliberately 100% deterministic (zero-LLM trust) by design. LLMs only format requests via structured MCP schemas, while all financial guardrails and spending limits are strictly enforced by the backend engine.
2. **Local Webhook Tunnels**: In local development, webhooks require `ngrok` or the direct Razorpay API synchronization fallback (`/v1/transactions/:id/sync`) when a public tunnel is not active.
3. **Currency Precision**: All prices, quotes, and spending caps are handled exclusively in **paise** (integers) to prevent floating-point rounding errors.
4. **Idempotent Quotes**: Quotes expire after 10 minutes and can only be used once per transaction to guard against duplicate payment attempts and replay attacks.

---

## Documentation & Runbooks

For a comprehensive guide including step-by-step demo scripts, refund flows, and webhook simulations, see [APP_GUIDE.md](APP_GUIDE.md).

---

## License
 
Proprietary. All rights reserved.
