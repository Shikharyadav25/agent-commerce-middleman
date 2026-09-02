import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_key_123';

const { app, prisma } = await import('../src/index.js');

describe('ACM API Integration Test Suite', () => {
  let testAgent;
  let testMerchant;
  let testMandate;
  let testProduct;

  before(async () => {
    await app.ready();

    // Ensure baseline seed / test entities exist
    testMerchant = await prisma.merchant.upsert({
      where: { id: 'test-merchant-integration' },
      update: {},
      create: {
        id: 'test-merchant-integration',
        name: 'Daily Fresh Mart',
        razorpayKeyId: 'rzp_test_IntegrationKey',
        sellingPolicy: { maxDailyOrders: 100 },
      },
    });

    testProduct = await prisma.product.upsert({
      where: {
        merchantId_sku: {
          merchantId: testMerchant.id,
          sku: 'bread-white-test',
        },
      },
      update: { price: 4000, stock: 100 },
      create: {
        merchantId: testMerchant.id,
        sku: 'bread-white-test',
        name: 'Fresh White Bread',
        price: 4000, // ₹40.00
        category: 'grocery.bakery',
        pairsWith: ['butter-salted-test'],
        tags: ['bakery', 'breakfast'],
        stock: 100,
      },
    });

    await prisma.product.upsert({
      where: {
        merchantId_sku: {
          merchantId: testMerchant.id,
          sku: 'butter-salted-test',
        },
      },
      update: { price: 6000, stock: 50 },
      create: {
        merchantId: testMerchant.id,
        sku: 'butter-salted-test',
        name: 'Salted Butter 100g',
        price: 6000, // ₹60.00
        category: 'grocery.dairy',
        pairsWith: ['bread-white-test'],
        tags: ['dairy'],
        stock: 50,
      },
    });

    testAgent = await prisma.agent.upsert({
      where: { id: 'test-agent-alpha' },
      update: { revoked: false },
      create: {
        id: 'test-agent-alpha',
        name: 'Agent Alpha Integration Test',
        apiKeyHash: 'hash_test_agent_alpha_key',
        revoked: false,
      },
    });

    testMandate = await prisma.mandate.upsert({
      where: { id: 'mandate-test-alpha' },
      update: {
        active: true,
        maxPerTransaction: 200000, // ₹2000
        dailyCap: 500000,          // ₹5000
        autoApproveThreshold: 50000, // ₹500
        allowedCategories: ['grocery.bakery', 'grocery.dairy', 'grocery.staples'],
      },
      create: {
        id: 'mandate-test-alpha',
        agentId: testAgent.id,
        merchantId: testMerchant.id,
        signedPayload: 'test_signed_payload',
        active: true,
        maxPerTransaction: 200000, // ₹2000
        dailyCap: 500000,          // ₹5000
        autoApproveThreshold: 50000, // ₹500
        allowedCategories: ['grocery.bakery', 'grocery.dairy', 'grocery.staples'],
      },
    });
  });

  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  test('GET /health returns 200 ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, 'ok');
  });

  test('GET /v1/catalog lists products', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/catalog',
    });
    assert.equal(res.statusCode, 200);
    const items = JSON.parse(res.payload);
    assert.ok(Array.isArray(items));
    assert.ok(items.some((p) => p.sku === 'bread-white-test'));
  });

  test('POST /v1/suggest-addons returns recommendations', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/suggest-addons',
      payload: { skus: ['bread-white-test'] },
    });
    assert.equal(res.statusCode, 200);
    const addons = JSON.parse(res.payload);
    assert.ok(Array.isArray(addons));
    assert.ok(addons.some((a) => a.sku === 'butter-salted-test'));
  });

  test('POST /v1/quotes generates valid price quote', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        items: [
          { sku: 'bread-white-test', qty: 2 }, // 2 * 4000 = 8000 paise (₹80)
        ],
      },
    });
    assert.equal(res.statusCode, 200);
    const quote = JSON.parse(res.payload);
    assert.ok(quote.id);
    assert.equal(quote.total, 8000);
    assert.ok(quote.expiresAt);
  });

  test('POST /v1/quotes rejects empty items array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [] },
    });
    assert.equal(res.statusCode, 400);
  });

  test('POST /v1/payments: Auto-approve path (< autoApproveThreshold)', async () => {
    // 1. Create quote under ₹500 (8000 paise = ₹80)
    const quoteRes = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'bread-white-test', qty: 1 }] },
    });
    const quote = JSON.parse(quoteRes.payload);

    // 2. Initiate payment
    const payRes = await app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: {
        'x-agent-id': testAgent.id,
        'x-agent-name': testAgent.name,
      },
      payload: {
        quoteId: quote.id,
        mandateId: testMandate.id,
      },
    });

    assert.equal(payRes.statusCode, 200);
    const payData = JSON.parse(payRes.payload);
    assert.equal(payData.status, 'payment_link_created');
    assert.ok(payData.paymentLink);
    assert.ok(payData.transactionId);

    // 3. Verify transaction state in DB
    const tx = await prisma.transaction.findUnique({
      where: { id: payData.transactionId },
    });
    assert.equal(tx.state, 'order_created');
    assert.ok(tx.razorpayOrderId);
  });

  test('POST /v1/payments: Quote reuse is rejected (Idempotency guard)', async () => {
    // Attempting to pay again with the same quote
    const quoteRes = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'bread-white-test', qty: 1 }] },
    });
    const quote = JSON.parse(quoteRes.payload);

    // First attempt succeeds
    const firstPay = await app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': testAgent.id },
      payload: { quoteId: quote.id, mandateId: testMandate.id },
    });
    assert.equal(firstPay.statusCode, 200);

    // Second attempt fails with 409 Conflict
    const secondPay = await app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': testAgent.id },
      payload: { quoteId: quote.id, mandateId: testMandate.id },
    });
    assert.equal(secondPay.statusCode, 409);
  });

  test('POST /v1/payments: Gated path (> autoApproveThreshold) & Human Approval Flow', async () => {
    // 1. Create quote exceeding ₹500 (15 * ₹40 = ₹600 = 60000 paise)
    const quoteRes = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'bread-white-test', qty: 15 }] },
    });
    const quote = JSON.parse(quoteRes.payload);
    assert.equal(quote.total, 60000);

    // 2. Initiate payment -> Should be gated
    const payRes = await app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': testAgent.id },
      payload: { quoteId: quote.id, mandateId: testMandate.id },
    });
    assert.equal(payRes.statusCode, 200);
    const payData = JSON.parse(payRes.payload);
    assert.equal(payData.status, 'awaiting_human_approval');
    assert.ok(payData.transactionId);

    // 3. Human Approval via /v1/pending-approvals/:id/decide
    const decideRes = await app.inject({
      method: 'POST',
      url: `/v1/pending-approvals/${payData.transactionId}/decide`,
      payload: {
        decision: 'approved',
        decidedBy: 'human:supervisor',
      },
    });
    assert.equal(decideRes.statusCode, 200);
    const decideData = JSON.parse(decideRes.payload);
    assert.equal(decideData.success, true);
    assert.equal(decideData.decision, 'approved');

    // 4. Verify transaction state updated to order_created with payment link
    const tx = await prisma.transaction.findUnique({
      where: { id: payData.transactionId },
    });
    assert.equal(tx.state, 'order_created');
  });

  test('POST /v1/payments: Policy Deny on Per-Transaction Cap', async () => {
    // Create quote exceeding mandate maxPerTransaction (₹2000 = 200000 paise)
    // 60 * ₹40 = ₹2400 = 240000 paise
    const quoteRes = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'bread-white-test', qty: 60 }] },
    });
    const quote = JSON.parse(quoteRes.payload);

    const payRes = await app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': testAgent.id },
      payload: { quoteId: quote.id, mandateId: testMandate.id },
    });
    assert.equal(payRes.statusCode, 200);
    const payData = JSON.parse(payRes.payload);
    assert.equal(payData.status, 'denied');
    assert.ok(payData.reason.includes('exceeds'));
  });

  test('POST /v1/payments: Policy Deny when Agent is Revoked', async () => {
    // 1. Create a revoked agent
    const revokedAgent = await prisma.agent.create({
      data: {
        name: 'Revoked Rogue Agent',
        apiKeyHash: `hash_${Date.now()}`,
        revoked: true,
      },
    });

    const quoteRes = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'bread-white-test', qty: 1 }] },
    });
    const quote = JSON.parse(quoteRes.payload);

    const payRes = await app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': revokedAgent.id },
      payload: { quoteId: quote.id },
    });
    assert.equal(payRes.statusCode, 200);
    const payData = JSON.parse(payRes.payload);
    assert.equal(payData.status, 'denied');
    assert.ok(payData.reason.includes('revoked'));
  });

  test('POST /webhooks/razorpay: HMAC Verification & State Transition to PAID', async () => {
    // 1. Create a transaction
    const quoteRes = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: { items: [{ sku: 'bread-white-test', qty: 1 }] },
    });
    const quote = JSON.parse(quoteRes.payload);

    const payRes = await app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': testAgent.id },
      payload: { quoteId: quote.id, mandateId: testMandate.id },
    });
    const payData = JSON.parse(payRes.payload);
    const txId = payData.transactionId;

    const tx = await prisma.transaction.findUnique({ where: { id: txId } });

    // 2. Build signed webhook payload
    const eventPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_test_${Date.now()}`,
            order_id: tx.razorpayOrderId,
            amount: 4000,
            status: 'captured',
            notes: { transactionId: tx.id },
          },
        },
      },
    };

    const rawBodyStr = JSON.stringify(eventPayload);
    const validSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBodyStr)
      .digest('hex');

    // 3. Send valid webhook
    const webhookRes = await app.inject({
      method: 'POST',
      url: '/webhooks/razorpay',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': validSignature,
      },
      payload: rawBodyStr,
    });
    assert.equal(webhookRes.statusCode, 200);

    // 4. Verify transaction state transitioned to 'paid'
    const updatedTx = await prisma.transaction.findUnique({ where: { id: txId } });
    assert.equal(updatedTx.state, 'paid');
    assert.ok(updatedTx.razorpayPaymentId);
  });

  test('POST /webhooks/razorpay: Invalid signature rejected with 400', async () => {
    const webhookRes = await app.inject({
      method: 'POST',
      url: '/webhooks/razorpay',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': 'invalid_signature_hash_123',
      },
      payload: JSON.stringify({ event: 'payment.captured' }),
    });
    assert.equal(webhookRes.statusCode, 400);
  });

  test('POST /v1/transactions/:id/refund: Refunds a paid transaction', async () => {
    // 1. Create and mark transaction as paid
    const quote = await prisma.quote.create({
      data: {
        items: [{ sku: 'bread-white-test', qty: 1 }],
        total: 4000,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    const tx = await prisma.transaction.create({
      data: {
        mandateId: testMandate.id,
        quoteId: quote.id,
        state: 'paid',
        razorpayPaymentId: `pay_mock_refund_${Date.now()}`,
      },
    });

    // 2. Request refund
    const refundRes = await app.inject({
      method: 'POST',
      url: `/v1/transactions/${tx.id}/refund`,
      payload: { reason: 'Customer cancelled delivery' },
    });
    assert.equal(refundRes.statusCode, 200);

    // 3. Verify state is updated to 'refunded'
    const updatedTx = await prisma.transaction.findUnique({ where: { id: tx.id } });
    assert.equal(updatedTx.state, 'refunded');
  });

  test('GET /v1/audit/:correlationId: Returns audit timeline', async () => {
    const quote = await prisma.quote.create({
      data: {
        items: [{ sku: 'bread-white-test', qty: 1 }],
        total: 4000,
        expiresAt: new Date(Date.now() + 600000),
      },
    });

    const payRes = await app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': testAgent.id },
      payload: { quoteId: quote.id, mandateId: testMandate.id },
    });
    const payData = JSON.parse(payRes.payload);

    const auditRes = await app.inject({
      method: 'GET',
      url: `/v1/audit/${payData.correlationId}`,
    });
    assert.equal(auditRes.statusCode, 200);
    const logs = JSON.parse(auditRes.payload);
    assert.ok(Array.isArray(logs));
    assert.ok(logs.length > 0);
    assert.ok(logs.some((l) => l.step === 'policy_check'));
  });

  test('GET /v1/agents and /v1/agents/:id return metrics', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/agents',
    });
    assert.equal(listRes.statusCode, 200);
    const agents = JSON.parse(listRes.payload);
    assert.ok(Array.isArray(agents));

    const agentRes = await app.inject({
      method: 'GET',
      url: `/v1/agents/${testAgent.id}`,
    });
    assert.equal(agentRes.statusCode, 200);
    const agentData = JSON.parse(agentRes.payload);
    assert.equal(agentData.id, testAgent.id);
    assert.ok(agentData.stats);
  });

  test('Concurrency test: daily spend cap is protected against double-spending', async () => {
    // 1. Create an agent and mandate with a tight daily cap: ₹150 (15000 paise)
    const tightAgent = await prisma.agent.create({
      data: {
        name: 'Tight Cap Agent',
        apiKeyHash: `hash_tight_${Date.now()}`,
      },
    });
    const tightMandate = await prisma.mandate.create({
      data: {
        agentId: tightAgent.id,
        merchantId: testMerchant.id,
        signedPayload: 'payload',
        active: true,
        maxPerTransaction: 15000, // ₹150
        dailyCap: 15000,          // ₹150
        autoApproveThreshold: 15000,
        allowedCategories: ['grocery.bakery', 'grocery.dairy'],
      },
    });

    // 2. Establish first approved transaction to clear first-time merchant gate
    const initQuote = await prisma.quote.create({
      data: {
        items: [{ sku: 'bread-white-test', qty: 1 }],
        total: 1000, // ₹10
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    await prisma.transaction.create({
      data: {
        mandateId: tightMandate.id,
        quoteId: initQuote.id,
        state: 'paid',
        razorpayPaymentId: `pay_mock_init_${Date.now()}`,
      },
    });

    // 3. Create two quotes for ₹80 each (8000 paise each).
    // Today's spend = ₹10.
    // Q1 (₹80) + Previous (₹10) = ₹90 <= ₹150 cap (PASSES)
    // Q2 (₹80) + Q1 (₹80) + Previous (₹10) = ₹170 > ₹150 cap (DENIED)
    const q1 = await prisma.quote.create({
      data: {
        items: [{ sku: 'butter-salted-test', qty: 1 }],
        total: 8000,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    const q2 = await prisma.quote.create({
      data: {
        items: [{ sku: 'butter-salted-test', qty: 1 }],
        total: 8000,
        expiresAt: new Date(Date.now() + 600000),
      },
    });

    // 4. Fire first payment (succeeds, takes ₹80)
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': tightAgent.id },
      payload: { quoteId: q1.id, mandateId: tightMandate.id },
    });
    const data1 = JSON.parse(res1.payload);
    assert.equal(data1.status, 'payment_link_created');

    // 5. Fire second payment (must be DENIED because ₹10 + ₹80 + ₹80 = ₹170 > ₹150 daily cap)
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: { 'x-agent-id': tightAgent.id },
      payload: { quoteId: q2.id, mandateId: tightMandate.id },
    });
    const data2 = JSON.parse(res2.payload);
    assert.equal(data2.status, 'denied');
    assert.ok(data2.reason.includes('daily cap'));
  });

  test('GET /v1/growth/metrics returns AOV lift statistics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/growth/metrics',
    });
    assert.equal(res.statusCode, 200);
    const metrics = JSON.parse(res.payload);
    assert.ok(typeof metrics.aovLiftPct === 'number');
    assert.ok(metrics.formattedRevenue);
    assert.ok(metrics.formattedAov);
  });

  test('POST /v1/acp/checkout executes Agentic Commerce Protocol session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/acp/checkout',
      payload: {
        agent_id: 'claude-desktop',
        items: [{ sku: 'bread-white-test', qty: 1 }],
        metadata: { client: 'ACP-Test-Runner' },
      },
    });
    assert.equal(res.statusCode, 200);
    const acpData = JSON.parse(res.payload);
    assert.equal(acpData.acp_protocol_version, '2026-04-preview');
    assert.ok(acpData.session_id.startsWith('acp_sess_'));
    assert.ok(acpData.order);
    assert.ok(acpData.payment);
  });

  test('POST /v1/campaigns/apply applies bounded promotional discount', async () => {
    const quote = await prisma.quote.create({
      data: {
        items: [{ sku: 'bread-white-test', qty: 1 }],
        total: 10000, // ₹100
        expiresAt: new Date(Date.now() + 600000),
      },
    });

    // 10% discount on ₹100 is ₹10 (within 20% cap)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/campaigns/apply',
      payload: {
        quoteId: quote.id,
        discountPercent: 10,
        campaignCode: 'SPRING_SAVINGS',
      },
    });
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.equal(data.success, true);
    assert.equal(data.finalTotal, 9000); // ₹90
  });

  test('POST /v1/campaigns/apply rejects discount exceeding 20% policy cap', async () => {
    const quote = await prisma.quote.create({
      data: {
        items: [{ sku: 'bread-white-test', qty: 1 }],
        total: 10000,
        expiresAt: new Date(Date.now() + 600000),
      },
    });

    // 30% discount on ₹100 exceeds 20% ceiling
    const res = await app.inject({
      method: 'POST',
      url: '/v1/campaigns/apply',
      payload: {
        quoteId: quote.id,
        discountPercent: 30,
      },
    });
    assert.equal(res.statusCode, 400);
    const data = JSON.parse(res.payload);
    assert.ok(data.reason.includes('exceeds maximum'));
  });
});
