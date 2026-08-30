# Razorpay Agent Commerce Middleman (ACG / ACM)

> **Deterministic Guardrails, Policy Engine, and Razorpay Payment Gateway for Autonomous AI Agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.x-1B222D.svg)](https://www.prisma.io/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black.svg)](https://fastify.dev/)

---

## Overview

**Agent Commerce Middleman** acts as a secure, zero-trust intermediary layer between autonomous AI agents and payment processors (Razorpay). Rather than giving LLMs unchecked access to payment credentials or credit cards, the gateway enforces deterministic financial boundaries, strict spending caps, cryptographic webhook verification, and human-in-the-loop approval gates.

```mermaid
flowchart LR
    Agent["AI Agent / MCP Client<br>(e.g. Claude Desktop)"] -->|Catalog & Quotes| API["Fastify API Layer"]
    API -->|Evaluate Constraints| PolicyEngine["Policy & Mandate Engine<br>(Deterministic Rules)"]
    PolicyEngine -->|Audit Trail & State| DB[("PostgreSQL DB<br>(Prisma ORM)")]
    PolicyEngine -->|Approved Transaction| Razorpay["Razorpay Payments API"]
    Razorpay -->|Signed Webhooks| WebhookListener["Webhook Verification<br>(HMAC-SHA256)"]
    WebhookListener -->|State Update| DB
```

---

## Core Capabilities

- **Zero-LLM Deterministic Policy Engine**: Pure deterministic JavaScript rules for financial boundaries — per-transaction caps, daily cumulative spend limits, allowed merchant categories, and first-time merchant gates.
- **Razorpay Integration**: Idempotent order creation, payment link generation, payment verification, and refund management.
- **Secure Webhook Pipeline**: Raw body buffer capture and constant-time HMAC-SHA256 signature verification for `payment.captured`, `order.paid`, and `payment.failed`.
- **Immutable Audit Trail**: Every decision, policy pass/fail, and webhook event is recorded in PostgreSQL with correlation IDs and human-readable explanations.
- **Model Context Protocol (MCP)**: Native tool integration for Claude Desktop and agent frameworks (`browse_catalog`, `get_quote`, `initiate_payment`, `check_status`).

---

## Architecture & Monorepo Structure

```text
agent-commerce-middleman/
├── apps/
│   ├── api/                 # Fastify REST API & Razorpay Webhook listener
│   │   ├── src/
│   │   │   ├── index.js     # Server entrypoint & webhook verification
│   │   │   └── razorpay.js  # Razorpay SDK client & payment helpers
│   │   └── test-order.js    # Integration test script for orders & payment links
│   ├── mcp-server/          # Model Context Protocol (MCP) server for agents
│   └── dashboard/           # Human-in-the-loop approval & audit log dashboard
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
├── docker-compose.yml       # Containerized PostgreSQL instance
├── .env.example             # Template for required environment variables
└── package.json             # Root workspace configuration
```

---

## Quickstart Guide

### 1. Clone the Repository
```bash
git clone https://github.com/Shikharyadav25/agent-commerce-middleman.git
cd agent-commerce-middleman
```

### 2. Prerequisites
- **Node.js**: v20+ or v22+ (`node -v`)
- **Docker Desktop**: For running PostgreSQL (`docker --version`)
- **Razorpay Account**: Test mode credentials from [Razorpay Dashboard](https://dashboard.razorpay.com/#/app/keys)

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Razorpay Test Mode credentials in `.env`:
```env
RAZORPAY_KEY_ID=rzp_test_YourKeyId
RAZORPAY_KEY_SECRET=YourKeySecret
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecret
DATABASE_URL=postgresql://acg:acg_dev_password@localhost:5433/acg
PORT=3000
```

### 4. Start Database & Run Migrations
Start the PostgreSQL container:
```bash
docker compose up -d
```

Apply database migrations and generate Prisma Client:
```bash
cd packages/db
npx prisma db push
```

Seed initial merchant, catalog, and agent mandate data:
```bash
node prisma/seed.js
```

### 5. Run Policy Engine Tests
Execute unit tests using the native Node.js test runner:
```bash
node --test packages/policy-engine/src/rules.test.js
```

### 6. Start the API Server
```bash
node apps/api/src/index.js
```
The server will start listening at `http://localhost:3000`. Test the health check endpoint:
```bash
curl http://localhost:3000/health
# Response: {"status":"ok"}
```

### 7. Public Webhook Tunnel (ngrok)
To allow Razorpay to deliver webhooks locally:
```bash
ngrok http 3000
```
Register the webhook in **Razorpay Dashboard > Settings > Webhooks**:
- **Webhook URL**: `https://<your-ngrok-subdomain>.ngrok-free.dev/webhooks/razorpay`
- **Secret**: Value configured in `RAZORPAY_WEBHOOK_SECRET`
- **Active Events**: `payment.captured`, `payment.failed`, `order.paid`

---

## Policy Engine Rules

All policy checks are deterministic and explainable:

| Rule | Description | Decision on Violation |
|---|---|---|
| `agent_valid` | Verifies agent credentials and active status | `deny` |
| `mandate_coverage` | Validates merchant ID and product category scoping | `deny` |
| `per_txn_cap` | Ensures quote does not exceed mandate transaction ceiling | `deny` |
| `daily_cap` | Enforces 24-hour cumulative spending limit | `deny` |
| `gate_threshold` | Routes high-value transactions to human approval | `pending` |
| `gate_first_time` | Requires human verification for newly encountered merchants | `pending` |

---

## Security & Best Practices

- **Strict `.gitignore`**: Environment files (`.env`), credentials, and private keys are strictly excluded from version control.
- **Constant-Time Verification**: Webhook signatures are compared using `crypto.timingSafeEqual` with buffer length validation to guard against timing attacks and buffer exceptions.
- **Idempotency**: All payment transactions require idempotency keys / quote IDs to prevent duplicate charges.

---

## License

MIT
