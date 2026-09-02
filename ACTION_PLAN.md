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

- [x] Replace the static `suggest_addons` pairing table with statistical
      co-purchase-frequency mining in `apps/api/src/growth.js` computed from
      order history and catalog synergy priors.
- [x] Build batch simulation script (`scripts/simulate-agents.js` & `npm run simulate:growth`)
      that benchmarks synthetic buyer agents with cross-sell ON vs OFF and outputs
      concrete measured results (+17.95% to +35% AOV lift).
- [x] Add campaign orchestrator (`/v1/campaigns/apply`) with deterministic discount
      ceiling enforcement (`checkDiscountCeiling` in `packages/policy-engine/src/rules.js`).
- [x] Add a dedicated "Growth & AOV" panel to `apps/dashboard/app/growth/page.tsx`
      with live AOV lift metrics, interactive in-browser simulation runner, and affinity matrix.
- [x] Add multiple merchant verticals (Daily Fresh Mart, VoltTech Electronics, QuickMed Pharmacy)
      in `packages/db/prisma/seed.js` plus 1-command merchant onboarding CLI (`scripts/onboard-merchant.js`).

**Exit criteria:** README/demo states concrete growth numbers (+17.95% to +35% AOV from cross-sell across simulated agent batches), working campaign discount ceilings, and multi-merchant onboarding in under 1 second.

---

## 5. Phase 2 — Protocol alignment & scale depth

Goal: differentiate on technical depth by engaging directly with the "why now"
protocol race called out in the track description.

- [x] Extend the `Mandate` model toward AP2-style signed Intent Mandates
      (`packages/policy-engine/src/mandate.js`) with HMAC/SHA-256 canonical signing,
      TTL expiration, and cryptographic non-tampering verification.
- [x] Implement NPCI UAP-aligned verifiable agent identity and dynamic mandate resolution.
- [x] Add ACP-shaped checkout adapter endpoint (`POST /v1/acp/checkout`) in `apps/api/src/index.js`
      demonstrating protocol-agnostic execution (MCP, ACP, and REST).
- [x] Build multi-agent concurrent live demo script (`scripts/demo-concurrent-agents.js` & `npm run demo:concurrent`)
      simultaneously firing low-spender (auto-approved), high-value buyer (gated), and revoked agent (denied).
- [x] Add natural-language "Explain This Decision" reasoning layer (`packages/policy-engine/src/explain.js`).

**Exit criteria:** README and live demo credibly prove AP2 signed mandates, ACP-shaped checkout adapter, multi-agent concurrency, and instant plain-English decision reasoning.

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
