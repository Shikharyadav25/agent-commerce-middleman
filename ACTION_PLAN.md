# ACM (Agent Commerce Middleman) — Action Plan
### Razorpay AI Buildathon — Track 1: AI Growth & Agentic Commerce

Repo: `Shikharyadav25/agent-commerce-middleman`
Track: https://razorpay.com/buildathon/ (Track 01)

---

## 0. How to use this document

This is a working roadmap, not a spec. Each phase has checkbox tasks with a suggested
location in the existing monorepo. Work top to bottom — Phase 0 before Phase 1, etc. —
unless a task is explicitly marked `[parallel-ok]`. Check items off as they land. Add
notes/decisions in the "Open questions" section at the bottom rather than deleting
context.

Current monorepo layout (for reference while placing new code):

```text
acm/
├── apps/
│   ├── api/                     # Fastify REST API & webhook listener (:3000)
│   │   └── src/index.js, razorpay.js
│   ├── dashboard/                # Next.js operator UI (:3001)
│   │   └── app/approvals/, agents/, audit/, components/
│   └── mcp-server/                # stdio MCP server for Claude Desktop
│       └── src/index.js
├── packages/
│   ├── db/                       # Prisma schema + seed
│   │   └── prisma/schema.prisma, seed.js
│   └── policy-engine/            # Deterministic rules
│       └── src/rules.js, evaluate.js, rules.test.js
├── docker-compose.yml
├── APP_GUIDE.md
└── .env.example
```

---

## 1. Project snapshot (as of this plan)

**What exists:** a zero-trust gateway between an AI agent (via MCP) and Razorpay.
Deterministic policy engine (`per_txn_cap`, `daily_cap`, `mandate_coverage`,
`gate_threshold`, `gate_first_time`, `agent_valid`), 8 MCP tools, Fastify API, Next.js
human-approval dashboard, Postgres/Prisma, real Razorpay order/payment-link/refund
flow, HMAC-verified webhooks, correlation-ID audit trail. Single seeded merchant
(grocery store, ~5 SKUs). No LLM API keys or external integrations beyond Razorpay —
the money path is intentionally deterministic ("zero-LLM-trust"), which is a good
design choice, not a gap.

**Estimated state:**
- Core guardrail plumbing: solid MVP, ~70% there.
- "Growth" mechanics (the track's actual headline ask): thin — static `suggest_addons`
  pairing table, no measured impact, no campaigns.
- Protocol/scale/differentiation depth: minimal — single merchant, single agent type,
  agent identity trusted via plain headers, no alignment to AP2/ACP/x402/UAP.
- Demo/pitch package: not yet evidenced (no deploy link, no video, no metrics).

---

## 2. Track 1 fit

Track 1 bar: **"Every money action explainable, bounded and gated. Show the audit
trail and one failure handled gracefully."** — the project's core already matches
this almost literally (bounded = caps, gated = threshold/first-time + human approval,
explainable = audit trail, graceful failure = the policy-rejection demo). This is the
strongest asset — the pitch should lead with it.

Track 1 headline: **"Grow the merchant's revenue... or make them sellable to AI
buyers."** Named example directions: conversational in-app checkout, agent-readable
catalog, upsell & cross-sell agent, campaign orchestrator. The project answers
"transactable end-to-end" well but has not yet answered "grow revenue" with any
measured evidence — that is the single biggest scoring gap and Phase 1 below.

Relevant context for the pitch: the "why now" language points at NPCI's Unified
Agent Protocol (UAP) and the broader ACP/AP2/x402 protocol stack. NPCI's UAP is
reportedly built on UPI Circle's delegated-payments model with agent registration,
spend limits, and consent controls — conceptually close to this project's existing
`Mandate` model. Google's AP2 formalizes this as signed Intent/Cart/Payment mandates;
Stripe/OpenAI's ACP defines a scoped-token checkout flow; Coinbase's x402 handles
machine-to-machine settlement over HTTP 402. None of these are implemented today —
Phase 2 closes part of that gap for differentiation.

---

## 3. Phase 0 — Lock the existing bar

Goal: prove what's already built actually works end to end, under test, before
building anything new.

- [x] Run all 7 `APP_GUIDE.md` demo scenarios end to end; capture terminal output
      and dashboard screenshots/clips for each.
- [x] Add integration tests hitting the live Fastify API against a test DB
      (`apps/api/test/api.integration.test.js`), not just `packages/policy-engine/src/rules.test.js`.
      Cover: auto-approve path, gated path, denied path, refund, webhook receipt.
- [x] Audit `daily_cap` / `per_txn_cap` for race conditions — fire two concurrent
      `initiate_payment` calls for the same agent near the cap and confirm only one
      can pass (committed state tracking and idempotency guards).
- [x] Confirm Fastify JSON-schema validation exists on every route in
      `apps/api/src/index.js`; add where missing.
- [x] Confirm `.env` / secrets hygiene (no leaked test keys in git history).
- [x] Add a "Known limitations" section to `README.md`.
- [x] Set up a basic CI workflow (GitHub Actions in `.github/workflows/ci.yml`) running `npm test` on push.

**Exit criteria:** every documented demo scenario reproducibly works, policy engine
has integration-level test coverage (22/22 tests passing), no obvious race condition on spend caps.

---

## 4. Phase 1 — Prove the "growth" ask (highest scoring priority)

Goal: turn the track's headline requirement — revenue growth — from a claim into a
measured result.

- [ ] Replace the static `suggest_addons` pairing table (in
      `apps/api/src/index.js` / wherever it lives) with a co-purchase-frequency
      model computed from seeded/synthetic order history in `packages/db`.
- [ ] Build a batch simulation script (`apps/api/test-order.js` style, or a new
      `scripts/simulate-agents.js`) that runs N synthetic buyer agents through the
      MCP/API path twice — cross-sell on vs off — and outputs a real number:
      average order value delta (%).
- [ ] Add a minimal campaign/nudge orchestrator: e.g. a `run_campaign` tool/endpoint
      that offers a bounded discount to agents inactive for >24h, enforced through
      the existing policy engine (discount ceiling as a new deterministic rule in
      `packages/policy-engine/src/rules.js`).
- [ ] Add a "Growth" panel to `apps/dashboard/app/` showing: revenue over time, AOV
      with/without add-on suggestions, gated-vs-auto-approved ratio, quote→pay
      conversion funnel.
- [ ] Add a second seeded merchant vertical (e.g. electronics or pharmacy) via
      `packages/db/prisma/seed.js`, plus a one-command catalog-onboarding script
      (CSV/JSON feed → merchant + catalog + starter mandate) to show any merchant
      can be onboarded, not just the one hardcoded grocery store.

**Exit criteria:** README/demo can state a concrete growth number (e.g. "+X% AOV
from cross-sell across a 100-agent simulated batch") and show a working campaign
flow and a second merchant onboarded in under a minute.

---

## 5. Phase 2 — Protocol alignment & scale depth

Goal: differentiate on technical depth by engaging directly with the "why now"
protocol race called out in the track description.

- [ ] Extend the `Mandate` model (`packages/db/prisma/schema.prisma`) toward
      AP2-style structure — Intent Mandate fields (max price, allowed merchants,
      expiry/TTL) — and sign mandates (HMAC or ECDSA over canonical JSON) so a
      mandate becomes a portable, verifiable artifact, not just a DB row. Document
      this explicitly as "AP2-shaped" in the README.
- [ ] Replace agent identity trust (currently plain `x-agent-id` / `x-agent-name`
      headers per the README) with signed agent identity — require a signed
      assertion before an agent is auto-provisioned in `apps/api/src/index.js`.
      Frame this in the pitch against NPCI's UAP direction (verifiable agents, not
      self-declared ones).
- [ ] Add a minimal ACP-shaped checkout adapter endpoint (scoped payment token
      pattern) in `apps/api/src/` to show the gateway is protocol-agnostic, not
      Claude/MCP-locked.
- [ ] Build a multi-agent concurrent simulation for the live demo: one aggressive
      high-spender (repeatedly gated), one well-behaved low-spender (auto-approved),
      one revoked agent (denied) — all firing at once, visible together on
      `apps/dashboard/app/agents/`.
- [ ] `[parallel-ok]` Add lightweight rate/velocity anomaly detection on top of the
      deterministic engine (rolling-window request-rate check) as an additional
      gate rule — nods toward risk without diluting Track 1 focus.
- [ ] `[parallel-ok]` Add structured per-transaction tracing (correlationId +
      timing) exportable as JSON/OpenTelemetry-style spans for the audit explorer.

**Exit criteria:** README/pitch can credibly say "our mandate model aligns with
AP2, our identity model anticipates UAP-style agent verification, and the gateway
is protocol-agnostic (MCP + ACP-shaped adapter)."

---

## 6. Phase 3 — Demo & submission polish

- [ ] Deploy live: API + Postgres on Railway/Render/Fly.io, dashboard on Vercel —
      judges should be able to click, not clone.
- [ ] Render the architecture diagram as an actual image in `README.md` (not raw
      mermaid text).
- [ ] Record the 5-minute pitch video:
      1. Hook (30s) — risk of giving an LLM unrestricted payment access.
      2. Architecture (60–90s) — the diagram, the four layers.
      3. Live demo (2 min) — auto-approve, gated + human approval, denied, refund,
         audit trail drilldown.
      4. Growth reveal (45s) — the AOV/campaign number from Phase 1.
      5. Protocol-awareness close (30s) — AP2/ACP/UAP positioning + roadmap.
- [ ] Add badges: CI status, test coverage, a one-line load-test result
      (autocannon/k6 — concurrent requests handled, p95 latency).

---

## 7. Feature backlog (beyond the track description, for extra depth)

Pick opportunistically once Phases 0–1 are done; ⭐ = highest ROI for judge impact.

**Resilience (show more than one graceful failure)**
- [ ] Simulate Razorpay API timeout → automatic retry → fallback to manual payment
      link.
- [ ] Simulate duplicate/out-of-order webhook delivery → idempotent handling (no
      double state transition, no double refund).
- [ ] ⭐ Simulate mid-transaction agent revocation → prove in-flight order is
      handled safely, not silently completed.

**Security**
- [ ] ⭐ Signed agent identity (see Phase 2).
- [ ] Replay protection on webhooks beyond HMAC (nonce/timestamp check).
- [ ] Kill-switch propagation test — revoke an agent, prove no further spend is
      possible within milliseconds, show it live.

**AI layered on top of the deterministic core (not replacing it)**
- [ ] ⭐⭐ Natural-language merchant policy authoring: merchant types a plain-English
      policy ("allow up to ₹2000/day, gate anything over ₹500, block electronics"),
      an LLM compiles it into the deterministic rule JSON, a human confirms the
      compiled config before it goes live.
- [ ] ⭐ "Explain this decision" generator: turn each structured policy-engine
      decision into a plain-English sentence on the dashboard (e.g. "Denied — ₹3,250
      exceeds Agent Alpha's ₹2,000 per-transaction cap").
- [ ] Bounded LLM-negotiated bundle discounts — Claude proposes a discount, the
      policy engine enforces a hard ceiling regardless.

**Scale**
- [ ] Multi-merchant, multi-catalog support with one onboarding script (see Phase 1).
- [ ] Load test with real numbers in the README (autocannon/k6).
- [ ] Note/document that the policy engine is pure/stateless — could run as a
      serverless function; mention as an architecture strength.

**Analytics**
- [ ] Exportable audit/compliance report (PDF/CSV) per agent or time range.
- [ ] Cohort view: spend and approval-rate breakdown across agent types.

---

## 8. Top 5 if time is short

1. Real cross-sell lift measurement with a number in the README (Phase 1).
2. Signed, AP2-shaped mandates + explicit protocol positioning (Phase 2).
3. Multi-agent concurrent live demo — aggressive / well-behaved / revoked, side by
   side (Phase 2).
4. "Explain this decision" natural-language layer on the audit trail (backlog ⭐).
5. A second graceful-failure scenario beyond the one already documented — webhook
   duplication or mid-flight agent revocation (backlog ⭐).

---

## 9. Open questions / decisions needed

- [ ] Confirm buildathon submission deadline and time budget available — re-prioritize
      phases accordingly if the timeline is tight (Phase 0 + top-5 list only).
- [ ] Decide whether to pursue the ACP adapter and AP2 mandate signing both, or pick
      one — both is stronger for the pitch but costs more time.
- [ ] Decide hosting provider for Phase 3 deploy (cost/free-tier constraints).
- [ ] Decide second seeded merchant vertical for Phase 1 (electronics vs pharmacy
      vs something else with clearer cross-sell logic to demo).
