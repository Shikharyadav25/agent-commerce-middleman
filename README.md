# Razorpay Agentic AI Commerce Tool (Agent Commerce Gateway / Middleman)

> **Deterministic Guardrails, Policy Engine, and Razorpay Payment Gateway for Autonomous AI Agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black.svg)](https://nextjs.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.x-1B222D.svg)](https://www.prisma.io/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black.svg)](https://fastify.dev/)

---

## Overview

**Agent Commerce Middleman (ACM)** acts as a secure, zero-trust intermediary layer between autonomous AI agents (e.g., Claude Desktop, custom LLM agents) and payment processors (Razorpay). Rather than giving LLMs unchecked access to payment credentials or cards, the gateway enforces deterministic financial boundaries, strict spending caps, cryptographic webhook verification, and human-in-the-loop approval gates.

```mermaid
flowchart LR
    Agent["AI Agent / MCP Client<br>(e.g. Claude Desktop)"] -->|Catalog, Quotes & Pay| MCP["ACM MCP Server<br>(apps/mcp-server)"]
    MCP -->|REST API| API["Fastify API Layer<br>(apps/api :3000)"]
    API -->|Evaluate Constraints| PolicyEngine["Policy & Mandate Engine<br>(Deterministic Rules)"]
    PolicyEngine -->|Audit Trail & State| DB[("PostgreSQL DB<br>(localhost:5433)")]
    PolicyEngine -->|Auto-Approved| Razorpay["Razorpay Payments API"]
    PolicyEngine -->|Gated / High Value| Dashboard["Human Approval Dashboard<br>(apps/dashboard :3001)"]
    Dashboard -->|Manual Approve| Razorpay
    Razorpay -->|Signed Webhooks| WebhookListener["Webhook Listener<br>(/webhooks/razorpay)"]
    WebhookListener -->|State Update (paid/failed)| DB
```

---

## Core Capabilities

- **Zero-LLM Deterministic Policy Engine**: Pure deterministic JavaScript rules for financial boundaries — per-transaction caps, daily cumulative spend limits, allowed merchant categories, and first-time merchant gates.
- **Model Context Protocol (MCP)**: Native integration for **Claude Desktop** and agent frameworks (`browse_catalog`, `get_quote`, `initiate_payment`, `check_status`, `suggest_addons`, `request_refund`).
- **Human-in-the-Loop Next.js Dashboard**: Real-time management interface to review, approve, or reject gated transactions, and inspect interactive visual audit timelines.
- **Razorpay Integration**: Idempotent order creation, payment link generation, payment verification, and automated refund handling.
- **Secure Webhook Pipeline**: Raw body buffer capture and constant-time HMAC-SHA256 signature verification for `payment.captured`, `order.paid`, and `payment.failed`.
- **Immutable Audit Trail**: Every decision, policy pass/fail, and webhook event is recorded in PostgreSQL with correlation IDs and human-readable explanations.

---

## Architecture & Monorepo Structure

```text
acm/
├── apps/
│   ├── api/                 # Fastify REST API & Razorpay Webhook listener (Port 3000)
│   │   ├── src/
│   │   │   ├── index.js     # Server entrypoint & webhook verification
│   │   │   └── razorpay.js  # Razorpay SDK client & payment helpers
│   │   └── test-order.js    # Integration test script for orders & payment links
│   ├── dashboard/           # Next.js Human-in-the-Loop & Audit UI (Port 3001)
│   │   └── app/
│   │       ├── approvals/   # Live approval & rejection queue for gated orders
│   │       └── audit/       # Visual audit trail & timeline explorer
│   └── mcp-server/          # Model Context Protocol (MCP) server for Claude Desktop
│       └── src/index.js     # Stdio MCP tool definitions
├── packages/
│   ├── db/                  # Prisma schema, migrations, and seed scripts
│   │   └── prisma/
│   │       ├── schema.prisma # PostgreSQL data models
│   │       └── seed.js       # Demo merchant, catalog, and agent mandates
│   └── policy-engine/       # Deterministic policy rules & orchestrator
│       └── src/
│           ├── rules.js      # Individual deterministic validation rules
│           ├── evaluate.js   # Rule orchestrator with audit logging
│           └── rules.test.js # Unit test suite
├── docker-compose.yml       # Containerized PostgreSQL instance (Port 5433)
├── .env.example             # Template for required environment variables
└── package.json             # Root workspace configuration & scripts
```

---

## Quickstart Guide

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

### 3. Start Database & Run Migrations

1. Start the PostgreSQL Docker container:
   ```bash
   docker compose up -d
   ```

2. Push Prisma schema to the database:
   ```bash
   npm run db:push
   ```

3. Seed demo merchants, catalog items, and agent mandates:
   ```bash
   npm run db:seed
   ```

*(Optional: Run `npm run db:studio` to visually explore database tables).*

---

### 4. Start the Backend API

Start the Fastify API (runs on `http://localhost:3000`):
```bash
npm run dev:api
# or
npm run api:dev
```

Test the health check endpoint:
```bash
curl http://localhost:3000/health
# Response: {"status":"ok"}
```

---

### 5. Start the Human-in-the-Loop Dashboard

The dashboard provides a visual interface for managing approvals and inspecting audit logs.

```bash
npm run dev:dashboard
# or
npm run dashboard:dev
```

Open your browser at **`http://localhost:3001`**:

- **Approvals Queue (`http://localhost:3001/approvals`)**:
  - Live list of transactions held for human review (due to `gate_threshold` or `gate_first_time`).
  - Allows single-click **Approve** (generates Razorpay order & payment link) or **Decline**.
- **Audit Explorer (`http://localhost:3001/audit/[correlationId]`)**:
  - Visual timeline of policy evaluations, state changes, actor details, and webhook events for any transaction.

---

### 6. Connect Claude Desktop (MCP Integration)

To allow Claude Desktop to use your commerce gateway:

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
         ]
       }
     }
   }
   ```
   *(Replace `/ABSOLUTE/PATH/TO/acm` with your full workspace path, e.g. `/Users/shikharyadav/Desktop/Razorpay/acm`).*

3. Restart Claude Desktop. Claude now has access to:
   - `browse_catalog`: Search and list available products.
   - `suggest_addons`: Recommend complementary items.
   - `get_quote`: Generate deterministic price quotes.
   - `initiate_payment`: Submit quotes subject to mandate checks.
   - `check_status`: Check transaction state.
   - `request_refund`: Trigger refunds for completed orders.

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
| `agent_valid` | Verifies agent credentials and active status | `deny` |
| `mandate_coverage` | Validates merchant ID and product category scoping | `deny` |
| `per_txn_cap` | Ensures quote does not exceed mandate transaction ceiling | `deny` |
| `daily_cap` | Enforces 24-hour cumulative spending limit | `deny` |
| `gate_threshold` | Routes high-value transactions to human approval | `pending` (Routes to Dashboard) |
| `gate_first_time` | Requires human verification for newly encountered merchants | `pending` (Routes to Dashboard) |

---

## Available NPM Scripts

From the root `acm` directory:

| Command | Description |
|---|---|
| `npm run dev:api` | Start Fastify REST API (`http://localhost:3000`) |
| `npm run dev:dashboard` | Start Next.js Dashboard UI (`http://localhost:3001`) |
| `npm run mcp:start` | Run MCP server via stdio transport |
| `npm test` | Run policy engine unit tests |
| `npm run db:push` | Sync Prisma schema with PostgreSQL database |
| `npm run db:seed` | Seed initial database data |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run api:test-order` | Run end-to-end integration test order script |

---

## License

MIT
