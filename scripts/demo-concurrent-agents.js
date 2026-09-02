import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = process.env.ACM_API_URL || 'http://localhost:3000';

async function executeRequest({ method, url, headers = {}, payload = null }) {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return await res.json();
  } catch (err) {
    // In-memory fallback if standalone without running server
    process.env.NODE_ENV = 'test';
    const { app } = await import('../apps/api/src/index.js');
    await app.ready();
    const injected = await app.inject({
      method,
      url,
      headers,
      payload,
    });
    return JSON.parse(injected.payload);
  }
}

async function main() {
  console.log(`\n⚡ =========================================================================`);
  console.log(`🚀 MULTI-AGENT CONCURRENT TRANSACTIONS DEMO (Track 1 Live Proof)`);
  console.log(`   Simultaneously firing 3 autonomous agents with different risk profiles:`);
  console.log(`   1. Food Delivery Booking Agent (Low Spender: ₹258)       -> Expected: AUTO-APPROVED`);
  console.log(`   2. Movie Ticket Booking Agent  (Group IMAX + Snacks: ₹970) -> Expected: GATED FOR HUMAN REVIEW`);
  console.log(`   3. Rogue Ticket Scalper Bot   (Revoked Fraud Infiltrator) -> Expected: DENIED BY ZERO-TRUST`);
  console.log(`=========================================================================\n`);

  // Ensure revoked agent exists
  await prisma.agent.upsert({
    where: { id: 'rogue-ticket-scalper' },
    update: { revoked: true },
    create: {
      id: 'rogue-ticket-scalper',
      name: 'Rogue Ticket Scalper Bot',
      apiKeyHash: 'hash-scalper-key-999',
      revoked: true,
    },
  });

  // Step 1: Create quotes in parallel
  console.log('📦 Step 1: Generating Quotes for all 3 agents simultaneously in parallel...');

  const [q1, q2, q3] = await Promise.all([
    executeRequest({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'zomato-garlic-breadsticks', qty: 1 }, { sku: 'swiggy-choco-lava-cake', qty: 1 }] },
    }),
    executeRequest({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'pvr-imax-3d-ticket', qty: 2 }, { sku: 'pvr-pepsi-twin-fountain', qty: 1 }] },
    }),
    executeRequest({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'pvr-imax-3d-ticket', qty: 1 }] },
    }),
  ]);

  console.log(`   • Food Delivery Agent (Zomato/Swiggy) Quote: ₹${(q1.total / 100).toFixed(2)} (ID: ${q1.id})`);
  console.log(`   • Movie Ticket Agent  (PVR & IMAX)    Quote: ₹${(q2.total / 100).toFixed(2)} (ID: ${q2.id})`);
  console.log(`   • Rogue Scalper Bot   (Unauthorized)  Quote: ₹${(q3.total / 100).toFixed(2)} (ID: ${q3.id})`);

  // Step 2: Fire concurrent payment evaluations
  console.log('\n💳 Step 2: Firing Simultaneous Payment Submissions to Gateway...');

  const startTime = Date.now();
  const [p1, p2, p3] = await Promise.all([
    executeRequest({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': 'food-delivery-agent', 'x-agent-name': 'Food Delivery Booking Agent (Zomato / Swiggy)' },
      payload: { quoteId: q1.id },
    }),
    executeRequest({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': 'movie-ticket-agent', 'x-agent-name': 'Movie Ticket Booking Agent (PVR INOX & BookMyShow)' },
      payload: { quoteId: q2.id },
    }),
    executeRequest({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': 'rogue-ticket-scalper', 'x-agent-name': 'Rogue Ticket Scalper Bot' },
      payload: { quoteId: q3.id },
    }),
  ]);

  const elapsedMs = Date.now() - startTime;

  console.log(`\n🎯 CONCURRENT EXECUTION OUTCOME (Resolved in ${elapsedMs}ms):`);
  console.log(`-------------------------------------------------------------------------`);
  console.log(`1. Food Delivery Booking Agent (Zomato / Swiggy):`);
  console.log(`   Status   : \x1b[32m\x1b[1m${p1.status}\x1b[0m`);
  console.log(`   Pay Link : ${p1.paymentLink || 'N/A'}`);
  console.log(`   Decision : Permitted autonomously (< ₹500 auto-approve threshold)\n`);

  console.log(`2. Movie Ticket Booking Agent (PVR INOX & BookMyShow):`);
  console.log(`   Status   : \x1b[33m\x1b[1m${p2.status}\x1b[0m`);
  console.log(`   Reason   : ${p2.reason}`);
  console.log(`   Decision : Gated for Human Review (Transaction: ${p2.transactionId})\n`);

  console.log(`3. Rogue Ticket Scalper Bot:`);
  console.log(`   Status   : \x1b[31m\x1b[1m${p3.status}\x1b[0m`);
  console.log(`   Reason   : ${p3.reason}`);
  console.log(`   Decision : Blocked by deterministic zero-trust policy engine\n`);
  console.log(`-------------------------------------------------------------------------`);
  console.log(`✨ Open http://localhost:3001/approvals to approve/decline the Movie Ticket order!`);
  console.log(`✨ Open http://localhost:3001/agents to inspect live agent balances.\n`);
}

main()
  .catch((err) => console.error('Demo error:', err))
  .finally(async () => {
    await prisma.$disconnect();
  });
