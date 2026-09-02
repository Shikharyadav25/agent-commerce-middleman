# ACM (Agent Commerce Middleman) — Action Plan
### Razorpay AI Buildathon — Track 1: AI Growth & Agentic Commerce

Repo: `Shikharyadav25/agent-commerce-middleman`
Track: https://razorpay.com/buildathon/ (Track 01)

---

## 1. Project Snapshot & Completion Status

**Current Architecture:**
A protocol-agnostic, zero-trust in-flight financial guardrail gateway between autonomous external AI agents (Claude Desktop, OpenAI Assistants, Python/LangChain swarms, ACP clients) and Razorpay.

- [x] **Core Guardrails & In-Flight Security Pipeline**:
  - Stage 1: Active Killswitch, Canary Honeytoken Trap, Sliding-Window Velocity Rate Limiter, Deterministic Caps.
  - Stage 2: Google AP2 Cryptographic Proof of Authority & Anti-TOCTOU SHA-256 Quote Pinning.
  - Stage 3: Semantic Cart Invariance, Blacklisted Categories, Unit Price Drift Detector.
  - Stage 4: Contextual Geofence Pincode Matching & Temporal Time Boundaries.
  - Stage 5: Dynamic Autonomous Circuit Breakers (auto-revocation on repeated violations).
  - Stage 6: Tiered Weighted Composite Risk Engine (< 1.5ms hot-path execution).
- [x] **5 Real-World Consumer Tracks & Catalog**:
  - 🎬 Movie & Entertainment (PVR INOX & IMAX Cinemas)
  - 🍕 Food Delivery & Dining (Zomato & Swiggy Kitchen)
  - 🛒 Quick Commerce & Grocery (Blinkit & Instamart Superstore)
  - ⚡ Electronics & Hardware (Amazon & Croma Hub)
  - ✈️ Travel & Cab Mobility (MakeMyTrip & Uber Mobility)
- [x] **Universal Multi-Protocol Agent Connectivity**:
  - Route 1: Model Context Protocol (MCP) via `apps/mcp-server`
  - Route 2: OpenAI Function Calling & ChatGPT Assistants via `GET /v1/agent-tools`
  - Route 3: Python / LangChain / CrewAI REST Endpoints (`/v1/quotes`, `/v1/payments`)
  - Route 4: Agentic Commerce Protocol (`POST /v1/acp/checkout`)
  - Route 5: Google AP2 Signed Mandates (`packages/policy-engine/src/mandate.js`)
- [x] **Growth & Basket Building**:
  - Measured +30.5% to +35% AOV lift via statistical co-purchase affinity mining.
  - Campaign discount ceilings (20% policy cap enforcement).
- [x] **Live Testing & Verification**:
  - 46/46 unit & integration tests passing in < 850ms.
  - Next.js Turbopack governance dashboard running at `http://localhost:3001`.
  - Fastify REST API running at `http://localhost:3000`.
