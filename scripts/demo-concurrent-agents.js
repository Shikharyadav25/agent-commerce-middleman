import { PrismaClient } from '@prisma/client';
import { app } from '../apps/api/src/index.js';

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
  } catch {
    // In-memory Fastify injection fallback when standalone script is run without open server
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
  console.log(`   1. Agent Alpha   (Claude Desktop - Low Spender)    -> Expected: AUTO-APPROVED`);
  console.log(`   2. Agent Beta    (ChatGPT - High-Value Tech Buyer)  -> Expected: GATED FOR HUMAN APPROVAL`);
  console.log(`   3. Rogue Agent   (Revoked Infiltrator)              -> Expected: DENIED BY ZERO-TRUST`);
  console.log(`=========================================================================\n`);

  // Ensure revoked agent exists
  await prisma.agent.upsert({
    where: { id: 'rogue-revoked-bot' },
    update: { revoked: true },
    create: {
      id: 'rogue-revoked-bot',
      name: 'Rogue Infiltrator Bot',
      apiKeyHash: 'hash-rogue-key-999',
      revoked: true,
    },
  });

  // Step 1: Create quotes in parallel
  console.log('📦 Step 1: Generating Quotes for all 3 agents simultaneously in parallel...');

  const [q1, q2, q3] = await Promise.all([
    executeRequest({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'bread-white', qty: 1 }, { sku: 'butter-salted', qty: 1 }] },
    }),
    executeRequest({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'fast-charger-65w', qty: 1 }, { sku: 'powerbank-20000mah', qty: 1 }] },
    }),
    executeRequest({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'bread-white', qty: 1 }] },
    }),
  ]);

  console.log(`   • Agent Alpha Quote: ₹${(q1.total / 100).toFixed(2)} (ID: ${q1.id})`);
  console.log(`   • Agent Beta  Quote: ₹${(q2.total / 100).toFixed(2)} (ID: ${q2.id})`);
  console.log(`   • Rogue Agent Quote: ₹${(q3.total / 100).toFixed(2)} (ID: ${q3.id})`);

  // Step 2: Fire concurrent payment evaluations
  console.log('\n💳 Step 2: Firing Simultaneous Payment Submissions to Gateway...');

  const startTime = Date.now();
  const [p1, p2, p3] = await Promise.all([
    executeRequest({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': 'claude-desktop', 'x-agent-name': 'Claude Desktop' },
      payload: { quoteId: q1.id },
    }),
    executeRequest({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': 'chatgpt-agent', 'x-agent-name': 'ChatGPT Assistant' },
      payload: { quoteId: q2.id },
    }),
    executeRequest({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': 'rogue-revoked-bot', 'x-agent-name': 'Rogue Infiltrator Bot' },
      payload: { quoteId: q3.id },
    }),
  ]);

  const elapsedMs = Date.now() - startTime;

  console.log(`\n🎯 CONCURRENT EXECUTION OUTCOME (Resolved in ${elapsedMs}ms):`);
  console.log(`-------------------------------------------------------------------------`);
  console.log(`1. Agent Alpha (Claude Desktop):`);
  console.log(`   Status   : \x1b[32m\x1b[1m${p1.status}\x1b[0m`);
  console.log(`   Pay Link : ${p1.paymentLink || 'N/A'}`);
  console.log(`   Decision : Permitted autonomously (< ₹500 auto-approve threshold)\n`);

  console.log(`2. Agent Beta (ChatGPT Assistant):`);
  console.log(`   Status   : \x1b[33m\x1b[1m${p2.status}\x1b[0m`);
  console.log(`   Reason   : ${p2.reason}`);
  console.log(`   Decision : Gated for Human Review (Transaction: ${p2.transactionId})\n`);

  console.log(`3. Rogue Agent (Revoked Infiltrator):`);
  console.log(`   Status   : \x1b[31m\x1b[1m${p3.status}\x1b[0m`);
  console.log(`   Reason   : ${p3.reason}`);
  console.log(`   Decision : Blocked by deterministic zero-trust policy engine\n`);
  console.log(`-------------------------------------------------------------------------`);
  console.log(`✨ Open http://localhost:3001/approvals to approve/decline Agent Beta's order!`);
  console.log(`✨ Open http://localhost:3001/agents to inspect live agent balances.\n`);
}

main()
  .catch((err) => console.error('Demo error:', err))
  .finally(async () => {
    await app.close();
    await prisma.$disconnect();
  });
