import Fastify from 'fastify';
import 'dotenv/config';
import crypto from 'crypto';
import rawBody from 'fastify-raw-body';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { createOrder, createPaymentLink } from './razorpay.js';
import { evaluateTransaction } from '../../../packages/policy-engine/src/evaluate.js';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

await app.register(rawBody, { field: 'rawBody', global: false, runFirst: true });

// ---- Health check ----
app.get('/health', async () => ({ status: 'ok' }));

// ---- Catalog & Quotes ----
app.get('/v1/catalog', async () => {
  return prisma.product.findMany();
});

app.post('/v1/quotes', async (request) => {
  const { items } = request.body;
  const products = await prisma.product.findMany({ where: { sku: { in: items.map(i => i.sku) } } });
  const total = items.reduce((sum, item) => {
    const product = products.find(p => p.sku === item.sku);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);
  const quote = await prisma.quote.create({
    data: { items, total, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  return quote;
});

// ---- Pending Approvals ----
app.get('/v1/pending-approvals', async (request) => {
  const { status } = request.query || {};
  let where = {};
  if (status === 'pending' || !status) {
    where = { decision: null };
  } else if (status === 'decided') {
    where = { decision: { not: null } };
  }

  const approvals = await prisma.pendingApproval.findMany({
    where,
    include: {
      transaction: {
        include: {
          quote: true,
          mandate: {
            include: {
              agent: true,
            },
          },
          auditLogs: {
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return approvals;
});

app.post('/v1/pending-approvals/:id/decide', async (request, reply) => {
  const { id } = request.params;
  const { decision, decidedBy = 'human:admin', reason } = request.body || {};

  const normalizedDecision = String(decision || '').toLowerCase();
  const isApproved = normalizedDecision === 'approve' || normalizedDecision === 'approved' || normalizedDecision === 'allow';
  const isDeclined = normalizedDecision === 'decline' || normalizedDecision === 'declined' || normalizedDecision === 'deny' || normalizedDecision === 'reject' || normalizedDecision === 'rejected';

  if (!isApproved && !isDeclined) {
    return reply.code(400).send({ error: "Invalid decision. Must be 'approved' or 'declined'." });
  }

  // Find approval record either by pendingApproval.id or transactionId
  const pending = await prisma.pendingApproval.findFirst({
    where: {
      OR: [{ id }, { transactionId: id }],
    },
    include: {
      transaction: {
        include: {
          quote: true,
          mandate: true,
        },
      },
    },
  });

  if (!pending) {
    return reply.code(404).send({ error: 'Pending approval record not found.' });
  }

  const newDecision = isApproved ? 'approved' : 'declined';
  const newTxState = isApproved ? 'approved' : 'failed';

  let razorpayOrderId = pending.transaction.razorpayOrderId;
  let paymentLinkUrl = null;

  if (isApproved && !razorpayOrderId) {
    try {
      const order = await createOrder({
        quoteId: pending.transaction.quoteId,
        amountPaise: pending.transaction.quote.total,
        notes: {
          transactionId: pending.transaction.id,
          correlationId: pending.transaction.correlationId,
          mandateId: pending.transaction.mandateId,
        },
      });
      razorpayOrderId = order.id;

      const link = await createPaymentLink({
        amountPaise: pending.transaction.quote.total,
        description: `Order ${order.id}`,
        notes: { orderId: order.id, transactionId: pending.transaction.id },
      });
      paymentLinkUrl = link.short_url;
    } catch (err) {
      console.warn('Razorpay order creation on approval notice:', err.message);
    }
  }

  const updatedApproval = await prisma.pendingApproval.update({
    where: { id: pending.id },
    data: {
      decision: newDecision,
      decidedBy,
    },
  });

  const updatedTransaction = await prisma.transaction.update({
    where: { id: pending.transactionId },
    data: {
      state: razorpayOrderId ? 'order_created' : newTxState,
      razorpayOrderId: razorpayOrderId || pending.transaction.razorpayOrderId,
    },
  });

  const auditReason = reason || (isApproved
    ? `Transaction approved by ${decidedBy}.${paymentLinkUrl ? ` Payment link: ${paymentLinkUrl}` : ''}`
    : `Transaction declined by ${decidedBy}`);

  const auditLog = await prisma.auditLogRow.create({
    data: {
      correlationId: pending.transaction.correlationId,
      transactionId: pending.transactionId,
      step: 'approval_decision',
      decision: isApproved ? 'allow' : 'deny',
      reason: auditReason,
      ruleId: 'human_review',
      actor: decidedBy,
    },
  });

  if (isApproved && paymentLinkUrl) {
    await prisma.auditLogRow.create({
      data: {
        correlationId: pending.transaction.correlationId,
        transactionId: pending.transactionId,
        step: 'order_created',
        decision: 'allow',
        reason: `Razorpay Order ${razorpayOrderId} created. Payment link generated: ${paymentLinkUrl}`,
        ruleId: null,
        actor: 'system',
      },
    });
  }

  return {
    success: true,
    decision: newDecision,
    pendingApproval: updatedApproval,
    transaction: updatedTransaction,
    auditLog,
    paymentLinkUrl,
  };
});

// ---- Audit Logs ----
app.get('/v1/audit/:correlationId', async (request, reply) => {
  const { correlationId } = request.params;
  const logs = await prisma.auditLogRow.findMany({
    where: { correlationId },
    orderBy: { createdAt: 'asc' },
    include: {
      transaction: {
        include: {
          quote: true,
          mandate: {
            include: { agent: true },
          },
          pendingApproval: true,
        },
      },
    },
  });

  if (!logs || logs.length === 0) {
    // Check if correlationId exists on a transaction directly
    const tx = await prisma.transaction.findUnique({
      where: { correlationId },
      include: {
        quote: true,
        mandate: { include: { agent: true } },
        pendingApproval: true,
      },
    });

    if (!tx) {
      return reply.code(404).send({ error: 'No audit records found for correlationId: ' + correlationId });
    }
  }

  return logs;
});

// ---- Transactions ----
app.get('/v1/transactions/:id', async (request, reply) => {
  const { id } = request.params;
  const transaction = await prisma.transaction.findFirst({
    where: {
      OR: [{ id }, { correlationId: id }],
    },
    include: {
      quote: true,
      mandate: { include: { agent: true } },
      pendingApproval: true,
      auditLogs: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!transaction) {
    return reply.code(404).send({ error: 'Transaction not found' });
  }

  return transaction;
});

// ---- Webhook ----
app.post('/webhooks/razorpay', { config: { rawBody: true } }, async (request, reply) => {
  const receivedSignature = request.headers['x-razorpay-signature'];
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(request.rawBody)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));

  if (!isValid) {
    console.warn('Webhook rejected: signature mismatch');
    return reply.code(400).send({ error: 'invalid signature' });
  }

  const event = request.body;
  console.log('Verified webhook event:', event.event);

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const razorpayOrderId = event.payload.order.entity.id;
    const razorpayPaymentId = event.payload.payment?.entity?.id;

    const transaction = await prisma.transaction.update({
      where: { razorpayOrderId },
      data: { state: 'paid', razorpayPaymentId },
    });

    await prisma.auditLogRow.create({
      data: {
        correlationId: transaction.correlationId,
        transactionId: transaction.id,
        step: 'webhook_received',
        decision: 'allow',
        reason: 'payment captured and verified',
        actor: 'system',
      },
    });
  }

  if (event.event === 'payment.failed') {
    const razorpayOrderId = event.payload.payment.entity.order_id;
    const errorReason = event.payload.payment.entity.error_reason || 'unknown_reason';

    const transaction = await prisma.transaction.update({
      where: { razorpayOrderId },
      data: { state: 'failed' },
    });

    await prisma.auditLogRow.create({
      data: {
        correlationId: transaction.correlationId,
        transactionId: transaction.id,
        step: 'webhook_received',
        decision: 'deny',
        reason: `payment declined: ${errorReason}. no charge was made.`,
        actor: 'system',
      },
    });
  }

  return reply.code(200).send({ received: true });
});

// ---- Add-ons & Refunds ----
app.post('/v1/suggest-addons', async (request) => {
  const { skus } = request.body;
  const cartItems = await prisma.product.findMany({ where: { sku: { in: skus } } });
  const pairedSkus = [...new Set(cartItems.flatMap(p => p.pairsWith))];
  const suggestions = await prisma.product.findMany({ where: { sku: { in: pairedSkus } } });
  return suggestions;
});

app.post('/v1/transactions/:id/refund', async (request) => {
  const { id } = request.params;
  const { reason } = request.body;
  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.state !== 'paid') {
    return { error: 'transaction not found or not eligible for refund' };
  }
  const { refundPayment } = await import('./razorpay.js');
  const refund = await refundPayment(transaction.razorpayPaymentId, transaction.quote.total);
  await prisma.transaction.update({ where: { id }, data: { state: 'refunded' } });
  await prisma.auditLogRow.create({
    data: { correlationId: transaction.correlationId, transactionId: id, step: 'refund', decision: 'allow', reason: reason || 'refund requested', actor: 'system' },
  });
  return refund;
});

app.post('/v1/payments', async (request, reply) => {
  const { quoteId, mandateId } = request.body;
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) return reply.code(404).send({ error: 'quote not found' });
  const mandate = await prisma.mandate.findUnique({ where: { id: mandateId } });
  if (!mandate) return reply.code(404).send({ error: 'mandate not found' });
  const agent = await prisma.agent.findUnique({ where: { id: mandate.agentId } });
  const items = quote.items;
  const firstProduct = await prisma.product.findFirst({ where: { sku: items[0].sku } });
  const category = firstProduct?.category || 'unknown';

  // sum today's paid transactions for this mandate
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todaysTxns = await prisma.transaction.findMany({
    where: { mandateId, state: 'paid', createdAt: { gte: startOfDay } },
    include: { quote: true },
  });
  const todaysCumulativeSpend = todaysTxns.reduce((sum, t) => sum + t.quote.total, 0);
  const correlationId = quote.id + '-' + Date.now();

  const result = await evaluateTransaction({
    agent,
    mandate,
    merchantId: mandate.merchantId,
    category,
    quoteTotal: quote.total,
    todaysCumulativeSpend,
    isFirstTimeMerchant: todaysTxns.length === 0,
    correlationId,
    writeAuditRow: (row) => prisma.auditLogRow.create({ data: row }),
  });

  if (result.finalDecision === 'deny') {
    return { status: 'denied', reason: result.reason };
  }

  const transaction = await prisma.transaction.create({
    data: {
      correlationId,
      mandateId,
      quoteId,
      state: result.finalDecision === 'pending' ? 'gated' : 'policy_checked',
    },
  });

  if (result.finalDecision === 'pending') {
    await prisma.pendingApproval.create({
      data: {
        transactionId: transaction.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return {
      status: 'awaiting_human_approval',
      reason: result.reason,
      transactionId: transaction.id,
    };
  }

  const order = await createOrder({
    quoteId: quote.id,
    amountPaise: quote.total,
    notes: { transactionId: transaction.id, agentId: agent.id, mandateId },
  });

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { state: 'order_created', razorpayOrderId: order.id },
  });

  const link = await createPaymentLink({
    amountPaise: quote.total,
    description: 'ACM purchase',
    notes: { orderId: order.id },
  });

  await prisma.auditLogRow.create({
    data: {
      correlationId,
      transactionId: transaction.id,
      step: 'order_created',
      decision: 'allow',
      reason: `Razorpay Order ${order.id} created. Payment link generated: ${link.short_url}`,
      ruleId: null,
      actor: 'system',
    },
  });

  return {
    status: 'payment_link_created',
    paymentLink: link.short_url,
    transactionId: transaction.id,
  };
});

// ---- Start server ----
app.listen({ port: process.env.PORT || 3000 }, (err, address) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`API running at ${address}`);
});