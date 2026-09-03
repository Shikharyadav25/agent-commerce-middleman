# ACM Human-in-the-Loop & Audit Dashboard

This is the Next.js frontend for **Agent Commerce Middleman (ACM)**.

## Features

- **Live Approvals Queue (`/approvals`)**: Review gated transactions that exceed threshold limits or involve first-time merchants. Approve or decline with real-time Razorpay order and payment link generation.
- **Visual Audit Explorer (`/audit/[correlationId]`)**: Inspect deterministic rule evaluations, timestamped events, and actor decisions along the transaction lifecycle.

## Environment Variables

Configure the following in the repository root `.env`:

| Variable | Description | Default / Fallback |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini AI API key for cold-path security analysis | Optional. If omitted, ACM executes the offline **Deterministic Heuristic Diagnostic Engine** (`deterministic-rules-engine`). |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://acm:acm_dev_password@localhost:5433/acm` |
| `PORT` | Backend API port | `3000` |

### Security Invariants & Human-in-the-Loop Gating:
- **First-Time Merchant Guarantee**: Regardless of an agent's trust score (even 100/100), any initial transaction with an unvetted merchant triggers the Deep Inspection Lane and gates for human sign-off.
- **AI Analyst Context**: When transactions are held for human review (`pending`), AI security analyst reports provide operator context and **never** auto-revoke agents out of the approval queue. Auto-revocation is strictly reserved for corroborated deterministic denials (`deny`).

## Running the Dashboard

### From Root Repository (`/acm`):
```bash
npm run dev:dashboard
```

### From This Directory (`/acm/apps/dashboard`):
```bash
npm run dev
```

The dashboard will start on [http://localhost:3001](http://localhost:3001).

> **Note**: Ensure the backend API is running at `http://localhost:3000` (`npm run dev:api`).
