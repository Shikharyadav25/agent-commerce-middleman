# ACM Human-in-the-Loop & Audit Dashboard

This is the Next.js frontend for **Agent Commerce Middleman (ACM)**.

## Features

- **Live Approvals Queue (`/approvals`)**: Review gated transactions that exceed threshold limits or involve first-time merchants. Approve or decline with real-time Razorpay order and payment link generation.
- **Visual Audit Explorer (`/audit/[correlationId]`)**: Inspect deterministic rule evaluations, timestamped events, and actor decisions along the transaction lifecycle.

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
