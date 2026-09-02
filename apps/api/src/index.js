import Fastify from 'fastify';
import 'dotenv/config';
import crypto from 'crypto';
import rawBody from 'fastify-raw-body';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { createOrder, createPaymentLink, razorpay } from './razorpay.js';
import { evaluateTransaction } from '../../../packages/policy-engine/src/evaluate.js';
import { checkDiscountCeiling } from '../../../packages/policy-engine/src/rules.js';
import {
  generateNLPDiagnosticReport,
  generateIncidentForensicBrief,
} from '../../../packages/policy-engine/src/diagnostics.js';
import { getDynamicAddonSuggestions, computeGrowthMetrics } from './growth.js';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

// Helper to sync pending order directly with Razorpay API if webhook was not delivered locally
async function syncTransactionFromRazorpay(tx, cachedPayments = null) {
  if (!tx || !tx.razorpayOrderId || tx.state === 'paid' || tx.state === 'refunded') {
    return tx;
  }

  try {
    const paymentsList = cachedPayments || (await razorpay.payments.all({ count: 30 })).items;
    const matchedPayment = paymentsList.find(
      (p) =>
        p.status === 'captured' &&
        (p.notes?.transactionId === tx.id ||
          p.notes?.orderId === tx.razorpayOrderId ||
          p.order_id === tx.razorpayOrderId)
    );

    if (matchedPayment) {
      const updated = await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          state: 'paid',
          razorpayPaymentId: matchedPayment.id,
        },
      });

      await prisma.auditLogRow.create({
        data: {
          correlationId: tx.correlationId,
          transactionId: tx.id,
          step: 'webhook_received',
          decision: 'allow',
          reason: `Payment verified directly from Razorpay (${matchedPayment.id}). Order marked as PAID.`,
          actor: 'system',
        },
      });

      return { ...tx, ...updated };
    }

    const order = await razorpay.orders.fetch(tx.razorpayOrderId);
    if (order.status === 'paid' || (order.amount_paid && order.amount_paid > 0)) {
      const payments = await razorpay.orders.fetchPayments(tx.razorpayOrderId);
      const capturedPayment = payments?.items?.find((p) => p.status === 'captured') || payments?.items?.[0];
      const paymentId = capturedPayment?.id || null;

      const updated = await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          state: 'paid',
          razorpayPaymentId: paymentId || tx.razorpayPaymentId,
        },
      });

      await prisma.auditLogRow.create({
        data: {
          correlationId: tx.correlationId,
          transactionId: tx.id,
          step: 'webhook_received',
          decision: 'allow',
          reason: `Payment verified directly from Razorpay order (${paymentId || 'captured'}). Order marked as PAID.`,
          actor: 'system',
        },
      });

      return { ...tx, ...updated };
    }
  } catch (err) {
    // Ignore fetch errors if offline or test mode
  }

  return tx;
}

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

await app.register(rawBody, { field: 'rawBody', global: false, runFirst: true });

// ---- Agent Provisioning Helper ----
async function ensureAgentAndMandate({ agentId, agentName } = {}) {
  let agent = null;

  if (agentId) {
    agent = await prisma.agent.findUnique({ where: { id: agentId } });
  }

  if (!agent && agentName) {
    agent = await prisma.agent.findFirst({ where: { name: agentName } });
  }

  // Auto-provision if agent does not exist
  if (!agent) {
    const finalName = agentName || (agentId ? `Agent (${agentId})` : 'Claude Desktop');
    const finalId = agentId || undefined;
    const apiKeyHash = `key_${crypto.randomBytes(8).toString('hex')}`;

    agent = await prisma.agent.create({
      data: {
        ...(finalId ? { id: finalId } : {}),
        name: finalName,
        apiKeyHash,
        revoked: false,
      },
    });
  }

  // Find or create primary merchant
  let merchant = await prisma.merchant.findFirst();
  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        name: 'Demo Grocery Store',
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
        sellingPolicy: { refundWindowDays: 7 },
      },
    });
  }

  // Check mandate template
  let template = await prisma.mandateTemplate.findFirst({ where: { merchantId: merchant.id } });
  if (!template) {
    template = await prisma.mandateTemplate.create({
      data: {
        merchantId: merchant.id,
        maxPerTransaction: 200000,   // ₹2,000
        dailyCap: 200000,            // ₹2,000
        autoApproveThreshold: 50000, // ₹500
        allowedCategories: ['grocery.staples', 'grocery.dairy', 'grocery.bakery', 'unknown'],
      },
    });
  }

  // Find or create active mandate for this agent
  let mandate = await prisma.mandate.findFirst({
    where: { agentId: agent.id, merchantId: merchant.id, active: true },
  });

  if (!mandate) {
    mandate = await prisma.mandate.create({
      data: {
        agentId: agent.id,
        merchantId: merchant.id,
        signedPayload: JSON.stringify({ agentId: agent.id, merchantId: merchant.id, ...template }),
        active: true,
        maxPerTransaction: template.maxPerTransaction,
        dailyCap: template.dailyCap,
        autoApproveThreshold: template.autoApproveThreshold,
        allowedCategories: template.allowedCategories,
      },
    });
  }

  return { agent, mandate, merchant };
}

// ---- Health check ----
app.get('/health', async () => ({ status: 'ok' }));

// ---- Catalog & Quotes ----
app.get('/v1/catalog', async () => {
  return prisma.product.findMany();
});

// ---- Mandates ----
app.get('/v1/mandates', async (request) => {
  const queryAgentId = request.query?.agentId || request.headers['x-agent-id'];
  const queryAgentName = request.query?.agentName || request.headers['x-agent-name'];

  if (queryAgentId || queryAgentName) {
    const { mandate } = await ensureAgentAndMandate({
      agentId: queryAgentId,
      agentName: queryAgentName,
    });
    const found = await prisma.mandate.findMany({
      where: { id: mandate.id, active: true },
      include: { agent: true },
    });
    return found;
  }

  return prisma.mandate.findMany({
    where: { active: true },
    include: { agent: true },
  });
});

// ---- Multi-Protocol Agent Routes (OpenAI, LangChain, CrewAI, AutoGen) ----
app.get('/v1/agent-tools', async () => {
  return {
    description: 'ACM Universal Multi-Protocol Tool Definitions for Autonomous AI Agents',
    supported_protocols: [
      'Model Context Protocol (MCP)',
      'OpenAI Function Calling (ChatGPT / Assistants API)',
      'LangChain / LangGraph Python & JS Tools',
      'Agentic Commerce Protocol (ACP - /v1/acp/checkout)',
      'Google AP2 Signed Intent Mandates',
      'REST / OpenAPI 3.0 Standard Endpoints',
    ],
    openai_tools: [
      {
        type: 'function',
        function: {
          name: 'order_product',
          description: 'Search store catalog, generate deterministic quote, and execute order under active zero-trust mandate.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Item name or SKU (e.g. "pvr imax ticket", "paneer pizza", "bread")' },
              quantity: { type: 'number', description: 'Quantity to purchase (default: 1)' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_quote',
          description: 'Get deterministic price quote, item breakdown, and cryptographic SHA-256 quote hash.',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    sku: { type: 'string' },
                    qty: { type: 'number' },
                  },
                  required: ['sku', 'qty'],
                },
              },
            },
            required: ['items'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'initiate_payment',
          description: 'Submit quote to 6-stage in-flight security pipeline and create Razorpay payment order.',
          parameters: {
            type: 'object',
            properties: {
              quoteId: { type: 'string', description: 'Quote ID from get_quote' },
              deliveryPincode: { type: 'string', description: 'Delivery pincode' },
              proofOfAuthority: { type: 'string', description: 'Optional AP2 cryptographic user authorization token' },
            },
            required: ['quoteId'],
          },
        },
      },
    ],
  };
});

// ---- Agents Management & Analytics ----
app.post('/v1/agents/ensure', async (request) => {
  const { id, name } = request.body || {};
  const result = await ensureAgentAndMandate({ agentId: id, agentName: name });
  return { success: true, ...result };
});

app.get('/v1/agents', async () => {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      mandates: {
        where: { active: true },
      },
    },
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const agentsWithStats = await Promise.all(
    agents.map(async (agent) => {
      const mandateIds = agent.mandates.map((m) => m.id);

      // All transactions for this agent
      const rawTransactions = await prisma.transaction.findMany({
        where: { mandateId: { in: mandateIds } },
        include: { quote: true },
        orderBy: { createdAt: 'desc' },
      });

      // Synchronize any pending orders with Razorpay
      const transactions = await Promise.all(
        rawTransactions.map(async (t) => {
          if (t.state === 'order_created' && t.razorpayOrderId) {
            return syncTransactionFromRazorpay(t);
          }
          return t;
        })
      );

      const totalTransactions = transactions.length;
      const paidTransactions = transactions.filter((t) => t.state === 'paid');
      const totalSpentPaise = paidTransactions.reduce((sum, t) => sum + (t.quote?.total || 0), 0);

      const todayPaid = paidTransactions.filter((t) => new Date(t.createdAt) >= startOfDay);
      const todaySpentPaise = todayPaid.reduce((sum, t) => sum + (t.quote?.total || 0), 0);

      const pendingApprovalsCount = await prisma.pendingApproval.count({
        where: {
          decision: null,
          transaction: { mandateId: { in: mandateIds } },
        },
      });

      const primaryMandate = agent.mandates[0] || null;
      const lastActiveAt = transactions[0]?.createdAt || agent.createdAt;

      return {
        id: agent.id,
        name: agent.name,
        revoked: agent.revoked,
        createdAt: agent.createdAt,
        mandate: primaryMandate,
        stats: {
          totalTransactions,
          totalSpentPaise,
          todaySpentPaise,
          dailyCapPaise: primaryMandate?.dailyCap || 200000,
          perTxnCapPaise: primaryMandate?.maxPerTransaction || 200000,
          autoApproveThresholdPaise: primaryMandate?.autoApproveThreshold || 50000,
          pendingApprovals: pendingApprovalsCount,
          lastActiveAt,
          recentTransactions: transactions.slice(0, 5),
        },
      };
    })
  );

  return agentsWithStats;
});

app.get('/v1/agents/:id', async (request, reply) => {
  const { id } = request.params;
  const agent = await prisma.agent.findFirst({
    where: { OR: [{ id }, { name: id }] },
    include: {
      mandates: {
        include: {
          transactions: {
            include: {
              quote: true,
              pendingApproval: true,
              auditLogs: { orderBy: { createdAt: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!agent) {
    return reply.code(404).send({ error: 'Agent not found' });
  }

  const rawTransactions = agent.mandates.flatMap((m) => m.transactions);

  // Sync any pending orders with Razorpay in real-time
  const allTransactions = await Promise.all(
    rawTransactions.map(async (t) => {
      if (t.state === 'order_created' && t.razorpayOrderId) {
        return syncTransactionFromRazorpay(t);
      }
      return t;
    })
  );

  allTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const paidTxns = allTransactions.filter((t) => t.state === 'paid');
  const totalSpentPaise = paidTxns.reduce((sum, t) => sum + (t.quote?.total || 0), 0);
  const todaySpentPaise = paidTxns
    .filter((t) => new Date(t.createdAt) >= startOfDay)
    .reduce((sum, t) => sum + (t.quote?.total || 0), 0);

  const primaryMandate = agent.mandates[0] || null;

  return {
    ...agent,
    stats: {
      totalTransactions: allTransactions.length,
      totalSpentPaise,
      todaySpentPaise,
      dailyCapPaise: primaryMandate?.dailyCap || 200000,
      perTxnCapPaise: primaryMandate?.maxPerTransaction || 200000,
      autoApproveThresholdPaise: primaryMandate?.autoApproveThreshold || 50000,
      pendingApprovals: allTransactions.filter((t) => t.pendingApproval && !t.pendingApproval.decision).length,
    },
    transactions: allTransactions,
  };
});

app.post('/v1/transactions/:id/sync', async (request, reply) => {
  const { id } = request.params;
  const tx = await prisma.transaction.findFirst({
    where: { OR: [{ id }, { correlationId: id }, { razorpayOrderId: id }] },
  });
  if (!tx) {
    return reply.code(404).send({ error: 'Transaction not found' });
  }
  const synced = await syncTransactionFromRazorpay(tx);
  return { success: true, transaction: synced };
});

app.patch('/v1/agents/:id/status', async (request, reply) => {
  const { id } = request.params;
  const { revoked } = request.body || {};

  const agent = await prisma.agent.findFirst({
    where: { OR: [{ id }, { name: id }] },
  });

  if (!agent) {
    return reply.code(404).send({ error: 'Agent not found' });
  }

  const updated = await prisma.agent.update({
    where: { id: agent.id },
    data: { revoked: Boolean(revoked) },
  });

  return { success: true, agent: updated };
});

app.post('/v1/quotes', async (request, reply) => {
  const { items } = request.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return reply.code(400).send({ error: 'items array is required and must not be empty' });
  }
  const products = await prisma.product.findMany({ where: { sku: { in: items.map(i => i.sku) } } });
  if (products.length === 0) {
    return reply.code(404).send({ error: 'No matching products found for the provided SKUs' });
  }
  const total = items.reduce((sum, item) => {
    const product = products.find(p => p.sku === item.sku);
    return sum + (product ? product.price * (Number(item.qty) || 1) : 0);
  }, 0);
  const quote = await prisma.quote.create({
    data: { items, total, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  return quote;
});

// ---- Pending Approvals ----
app.get('/v1/pending-approvals', async (request) => {
  const { status, agentId } = request.query || {};
  let where = {};
  if (status === 'pending' || !status) {
    where = { decision: null };
  } else if (status === 'decided') {
    where = { decision: { not: null } };
  }

  if (agentId) {
    where.transaction = {
      mandate: {
        agentId,
      },
    };
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

app.get('/v1/audit/:correlationId/report', async (request, reply) => {
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

  const tx =
    logs[0]?.transaction ||
    (await prisma.transaction.findUnique({
      where: { correlationId },
      include: {
        quote: true,
        mandate: { include: { agent: true } },
        pendingApproval: true,
      },
    }));

  if (!logs || logs.length === 0) {
    if (!tx) {
      return reply.code(404).send({ error: 'No audit records found for correlationId: ' + correlationId });
    }
  }

  const forensicBrief = generateIncidentForensicBrief(logs, tx);
  const primaryStep = logs.find((l) => l.decision === 'deny') || logs.find((l) => l.decision === 'pending');

  let diagnosis = null;
  if (primaryStep) {
    diagnosis = generateNLPDiagnosticReport({
      ruleId: primaryStep.ruleId,
      decision: primaryStep.decision,
      reason: primaryStep.reason,
      quoteTotal: tx?.quote?.total,
      items: tx?.quote?.items || [],
      mandate: tx?.mandate,
      agent: tx?.mandate?.agent,
    });
  }

  return {
    correlationId,
    transactionId: tx?.id || null,
    forensicBrief,
    diagnosis,
    stepCount: logs.length,
    currentState: tx?.state || (primaryStep?.decision === 'deny' ? 'failed' : 'unknown'),
  };
});

app.post('/v1/diagnostics/resolve', async (request, reply) => {
  const {
    correlationId,
    quoteId,
    userIntentPrompt,
    ruleId,
    errorReason,
    deliveryPincode,
  } = request.body || {};

  let items = [];
  let quoteTotal = 0;
  let mandate = {};
  let agent = {};
  let targetRuleId = ruleId;
  let targetReason = errorReason;
  let targetDecision = 'deny';

  if (correlationId) {
    const logs = await prisma.auditLogRow.findMany({
      where: { correlationId },
      orderBy: { createdAt: 'desc' },
      include: {
        transaction: {
          include: {
            quote: true,
            mandate: { include: { agent: true } },
          },
        },
      },
    });

    const culprit = logs.find((l) => l.decision === 'deny' || l.decision === 'pending');
    if (culprit) {
      targetRuleId = targetRuleId || culprit.ruleId;
      targetReason = targetReason || culprit.reason;
      targetDecision = culprit.decision;
    }

    const tx = logs[0]?.transaction;
    if (tx) {
      items = tx.quote?.items || [];
      quoteTotal = tx.quote?.total || 0;
      mandate = tx.mandate || {};
      agent = tx.mandate?.agent || {};
    }
  } else if (quoteId) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (quote) {
      items = quote.items || [];
      quoteTotal = quote.total || 0;
    }
  }

  const diagnosis = generateNLPDiagnosticReport({
    ruleId: targetRuleId || 'policy_check',
    decision: targetDecision,
    reason: targetReason || 'Transaction resolution requested',
    quoteTotal,
    items,
    userIntentPrompt,
    mandate,
    agent,
    deliveryPincode,
    allowedPincodes: ['560001', '560038', '110001', '400001'],
  });

  return {
    status: 'resolved',
    correlationId: correlationId || null,
    diagnosis,
    agentActionableInstructions: diagnosis.agentActionableInstructions,
    suggestedRemediation: diagnosis.suggestedRemediation,
    forensicSummary: diagnosis.forensicSummary,
  };
});

// ---- Transactions ----
app.get('/v1/transactions', async (request) => {
  const { agentId, state, limit = 50 } = request.query || {};
  let where = {};
  if (agentId) {
    where.mandate = { agentId };
  }
  if (state) {
    where.state = state;
  }

  return prisma.transaction.findMany({
    where,
    take: Number(limit),
    orderBy: { createdAt: 'desc' },
    include: {
      quote: true,
      mandate: { include: { agent: true } },
      pendingApproval: true,
      auditLogs: { orderBy: { createdAt: 'asc' } },
    },
  });
});

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
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  if (!receivedSignature || !request.rawBody) {
    return reply.code(400).send({ error: 'missing signature or raw body' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(request.rawBody)
    .digest('hex');

  const receivedBuf = Buffer.from(receivedSignature);
  const expectedBuf = Buffer.from(expectedSignature);
  const isValid = receivedBuf.length === expectedBuf.length && crypto.timingSafeEqual(receivedBuf, expectedBuf);

  if (!isValid) {
    console.warn('Webhook rejected: signature mismatch');
    return reply.code(400).send({ error: 'invalid signature' });
  }

  const event = request.body;
  console.log('Verified webhook event:', event.event);

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const paymentEntity = event.payload.payment?.entity;
    const orderEntity = event.payload.order?.entity;

    const notesTxId = paymentEntity?.notes?.transactionId;
    const notesOrderId = paymentEntity?.notes?.orderId;
    const paymentOrderId = paymentEntity?.order_id;
    const orderId = orderEntity?.id;
    const paymentId = paymentEntity?.id;

    const matchingTx = await prisma.transaction.findFirst({
      where: {
        OR: [
          ...(notesTxId ? [{ id: notesTxId }] : []),
          ...(notesOrderId ? [{ razorpayOrderId: notesOrderId }] : []),
          ...(orderId ? [{ razorpayOrderId: orderId }] : []),
          ...(paymentOrderId ? [{ razorpayOrderId: paymentOrderId }] : []),
        ],
      },
    });

    if (matchingTx) {
      const transaction = await prisma.transaction.update({
        where: { id: matchingTx.id },
        data: { state: 'paid', razorpayPaymentId: paymentId || matchingTx.razorpayPaymentId },
      });

      await prisma.auditLogRow.create({
        data: {
          correlationId: transaction.correlationId,
          transactionId: transaction.id,
          step: 'webhook_received',
          decision: 'allow',
          reason: `Payment captured and verified (${paymentId || 'payment.captured'}).`,
          actor: 'system',
        },
      });
    }
  }

  if (event.event === 'payment.failed') {
    const paymentEntity = event.payload.payment?.entity;
    const notesTxId = paymentEntity?.notes?.transactionId;
    const notesOrderId = paymentEntity?.notes?.orderId;
    const paymentOrderId = paymentEntity?.order_id;
    const errorReason = paymentEntity?.error_reason || 'unknown_reason';

    const matchingTx = await prisma.transaction.findFirst({
      where: {
        OR: [
          ...(notesTxId ? [{ id: notesTxId }] : []),
          ...(notesOrderId ? [{ razorpayOrderId: notesOrderId }] : []),
          ...(paymentOrderId ? [{ razorpayOrderId: paymentOrderId }] : []),
        ],
      },
    });

    if (matchingTx) {
      const transaction = await prisma.transaction.update({
        where: { id: matchingTx.id },
        data: { state: 'failed' },
      });

      await prisma.auditLogRow.create({
        data: {
          correlationId: transaction.correlationId,
          transactionId: transaction.id,
          step: 'webhook_received',
          decision: 'deny',
          reason: `Payment declined: ${errorReason}. No charge was made.`,
          actor: 'system',
        },
      });
    }
  }

  return reply.code(200).send({ received: true });
});

// ---- Growth, Add-ons & Campaigns ----
app.get('/v1/growth/metrics', async () => {
  return await computeGrowthMetrics();
});

app.post('/v1/growth/simulate', async (request) => {
  const { count = 50 } = request.body || {};
  const { runAgentGrowthSimulation } = await import('../../scripts/simulate-agents.js');
  return await runAgentGrowthSimulation({ agentCount: Number(count) || 50 });
});

app.post('/v1/suggest-addons', async (request, reply) => {
  const { skus, merchantId } = request.body || {};
  if (!Array.isArray(skus) || skus.length === 0) {
    return [];
  }
  return await getDynamicAddonSuggestions({ skus, merchantId });
});

app.post('/v1/campaigns/apply', async (request, reply) => {
  const { quoteId, discountPercent = 10, campaignCode = 'AGENT_WELCOME' } = request.body || {};
  if (!quoteId) {
    return reply.code(400).send({ error: 'quoteId is required' });
  }

  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) {
    return reply.code(404).send({ error: 'quote not found' });
  }

  const discountPaise = Math.round((quote.total * discountPercent) / 100);
  const check = checkDiscountCeiling(quote.total, discountPaise, 20); // max 20% cap

  if (check.decision === 'deny') {
    return reply.code(400).send({
      error: 'Campaign discount exceeds authorized policy ceiling',
      reason: check.reason,
    });
  }

  const discountedTotal = Math.max(100, quote.total - discountPaise);
  const updatedQuote = await prisma.quote.update({
    where: { id: quote.id },
    data: {
      total: discountedTotal,
    },
  });

  return {
    success: true,
    campaignCode,
    originalTotal: quote.total,
    discountPaise,
    finalTotal: discountedTotal,
    formattedSavings: `₹${(discountPaise / 100).toFixed(2)}`,
    quote: updatedQuote,
  };
});

app.post('/v1/transactions/:id/refund', async (request, reply) => {
  const { id } = request.params;
  const { reason } = request.body || {};
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { quote: true },
  });
  if (!transaction || transaction.state !== 'paid') {
    return reply.code(400).send({ error: 'transaction not found or not eligible for refund' });
  }
  const { refundPayment } = await import('./razorpay.js');
  const refund = await refundPayment(transaction.razorpayPaymentId || 'pay_mock', transaction.quote.total);
  await prisma.transaction.update({ where: { id }, data: { state: 'refunded' } });
  await prisma.auditLogRow.create({
    data: { correlationId: transaction.correlationId, transactionId: id, step: 'refund', decision: 'allow', reason: reason || 'refund requested', actor: 'system' },
  });
  return refund;
});

app.post('/v1/payments', async (request, reply) => {
  const {
    quoteId,
    proofOfAuthority,
    userIntentPrompt,
    deliveryPincode,
  } = request.body || {};
  let { mandateId, agentId, agentName } = request.body || {};

  if (!quoteId) {
    return reply.code(400).send({ error: 'quoteId is required' });
  }

  // Check headers if not in body
  if (!agentId) agentId = request.headers['x-agent-id'];
  if (!agentName) agentName = request.headers['x-agent-name'];

  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) return reply.code(404).send({ error: 'quote not found' });

  // Expiration check
  if (new Date() > new Date(quote.expiresAt)) {
    return reply.code(400).send({ error: 'quote has expired', expiresAt: quote.expiresAt });
  }

  // Idempotency check: quote cannot be reused for multiple payment attempts
  const existingTx = await prisma.transaction.findUnique({ where: { quoteId } });
  if (existingTx) {
    return reply.code(409).send({
      error: 'Quote has already been processed in a transaction',
      transactionId: existingTx.id,
      state: existingTx.state,
    });
  }

  const items = quote.items;
  const productSkus = items.map((i) => i.sku);
  const products = await prisma.product.findMany({ where: { sku: { in: productSkus } } });
  const catalogPriceMap = {};
  for (const p of products) {
    catalogPriceMap[p.sku] = p.price;
  }

  const firstProduct = products[0] || (await prisma.product.findFirst({ where: { sku: items[0]?.sku } }));
  const category = firstProduct?.category || 'grocery.staples';

  // Dynamically ensure agent and mandate if mandateId is omitted or agent is provided
  let mandate = null;
  let agent = null;

  if (mandateId) {
    mandate = await prisma.mandate.findUnique({ where: { id: mandateId } });
    if (mandate) {
      agent = await prisma.agent.findUnique({ where: { id: mandate.agentId } });
    }
  }

  if (!mandate || !agent) {
    const ensured = await ensureAgentAndMandate({ agentId, agentName });
    agent = ensured.agent;

    // If merchantId is present on product, search for merchant-specific mandate first
    if (firstProduct?.merchantId) {
      const merchantMandate = await prisma.mandate.findFirst({
        where: { agentId: agent.id, merchantId: firstProduct.merchantId, active: true },
      });
      if (merchantMandate) {
        mandate = merchantMandate;
      }
    }

    if (!mandate) {
      mandate = ensured.mandate;
    }
    mandateId = mandate.id;
  }

  // Sum today's committed spend for this mandate (paid + in-flight order_created/approved/policy_checked)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todaysTxns = await prisma.transaction.findMany({
    where: {
      mandateId,
      state: { in: ['paid', 'order_created', 'approved', 'policy_checked'] },
      createdAt: { gte: startOfDay },
    },
    include: { quote: true },
  });
  const todaysCumulativeSpend = todaysTxns.reduce((sum, t) => sum + (t.quote?.total || 0), 0);

  // Fetch recent transactions in past 10 mins for velocity & anti-smurfing
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentTransactions = await prisma.transaction.findMany({
    where: {
      mandate: { agentId: agent.id },
      createdAt: { gte: tenMinutesAgo },
    },
    include: { quote: true },
    orderBy: { createdAt: 'desc' },
  });

  const recentTimestamps = recentTransactions.map((t) => t.createdAt);

  // Fetch recent policy denials in past 5 mins for autonomous circuit breaker
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentDenials = await prisma.auditLogRow.count({
    where: {
      decision: 'deny',
      createdAt: { gte: fiveMinutesAgo },
      transaction: { mandate: { agentId: agent.id } },
    },
  });

  // Check if merchant has had prior approved/paid transactions with this mandate
  const priorApprovedCount = await prisma.transaction.count({
    where: {
      mandateId,
      state: { in: ['paid', 'order_created', 'approved'] },
    },
  });
  const isFirstTimeMerchant = priorApprovedCount === 0;

  const correlationId = quote.id + '-' + Date.now();

  const result = await evaluateTransaction({
    agent,
    mandate,
    merchantId: mandate.merchantId,
    category,
    quoteTotal: quote.total,
    todaysCumulativeSpend,
    isFirstTimeMerchant,
    items: quote.items,
    catalogPriceMap,
    recentTransactions,
    recentTimestamps,
    recentDenialCount: recentDenials,
    deliveryPincode,
    allowedPincodes: ['560001', '560038', '110001', '400001'],
    proofOfAuthority: proofOfAuthority || request.headers['x-proof-of-authority'] || null,
    userIntentPrompt: userIntentPrompt || request.headers['x-intent-prompt'] || null,
    expectedQuoteHash: request.body?.quoteHash || null,
    correlationId,
    writeAuditRow: (row) => prisma.auditLogRow.create({ data: row }),
  });

  if (result.finalDecision === 'deny') {
    if (result.shouldRevokeAgent || result.isCanaryTriggered) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { revoked: true },
      });
    }

    const diagnosis = generateNLPDiagnosticReport({
      ruleId: result.ruleId,
      decision: 'deny',
      reason: result.reason,
      quoteTotal: quote.total,
      items: quote.items,
      userIntentPrompt: userIntentPrompt || request.headers['x-intent-prompt'] || null,
      mandate,
      agent,
      deliveryPincode,
      allowedPincodes: ['560001', '560038', '110001', '400001'],
      riskScore: result.riskScore,
      latencyMs: result.latencyMs,
    });

    return {
      status: 'denied',
      reason: result.reason,
      ruleId: result.ruleId,
      riskScore: result.riskScore,
      riskTier: result.riskTier,
      latencyMs: result.latencyMs,
      correlationId,
      diagnosis,
    };
  }

  const transaction = await prisma.transaction.create({
    data: {
      correlationId,
      mandateId,
      quoteId,
      state: result.finalDecision === 'pending' ? 'gated' : 'policy_checked',
    },
  });

  // Link initial audit rows written during evaluation to this transaction record
  await prisma.auditLogRow.updateMany({
    where: { correlationId, transactionId: null },
    data: { transactionId: transaction.id },
  });

  if (result.finalDecision === 'pending') {
    await prisma.pendingApproval.create({
      data: {
        transactionId: transaction.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const diagnosis = generateNLPDiagnosticReport({
      ruleId: result.ruleId,
      decision: 'pending',
      reason: result.reason,
      quoteTotal: quote.total,
      items: quote.items,
      userIntentPrompt: userIntentPrompt || request.headers['x-intent-prompt'] || null,
      mandate,
      agent,
      deliveryPincode,
      allowedPincodes: ['560001', '560038', '110001', '400001'],
      riskScore: result.riskScore,
      latencyMs: result.latencyMs,
    });

    return {
      status: 'awaiting_human_approval',
      reason: result.reason,
      ruleId: result.ruleId,
      transactionId: transaction.id,
      correlationId,
      riskScore: result.riskScore,
      riskTier: result.riskTier,
      latencyMs: result.latencyMs,
      quoteHash: result.quoteHash,
      diagnosis,
    };
  }

  const order = await createOrder({
    quoteId: quote.id,
    amountPaise: quote.total,
    notes: { transactionId: transaction.id, agentId: agent.id, mandateId, quoteHash: result.quoteHash },
  });

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { state: 'order_created', razorpayOrderId: order.id },
  });

  const link = await createPaymentLink({
    amountPaise: quote.total,
    description: `ACM purchase by ${agent.name}`,
    notes: { orderId: order.id, agentId: agent.id, quoteHash: result.quoteHash },
  });

  await prisma.auditLogRow.create({
    data: {
      correlationId,
      transactionId: transaction.id,
      step: 'order_created',
      decision: 'allow',
      reason: `Razorpay Order ${order.id} created for ${agent.name}. Payment link generated: ${link.short_url}`,
      ruleId: null,
      actor: 'system',
    },
  });

  return {
    status: 'payment_link_created',
    paymentLink: link.short_url,
    transactionId: transaction.id,
    correlationId,
    riskScore: result.riskScore,
    riskTier: result.riskTier,
    latencyMs: result.latencyMs,
    quoteHash: result.quoteHash,
  };
});

// ---- ACP (Agentic Commerce Protocol) Adapter ----
app.post('/v1/acp/checkout', async (request, reply) => {
  const { agent_token, agent_id, merchant_id, items, metadata } = request.body || {};

  const effectiveAgentId = agent_id || (agent_token ? `agent-${agent_token.substring(0, 8)}` : request.headers['x-agent-id'] || 'acp-client');
  const ensured = await ensureAgentAndMandate({ agentId: effectiveAgentId });
  const agent = ensured.agent;
  const mandate = ensured.mandate;

  if (!Array.isArray(items) || items.length === 0) {
    return reply.code(400).send({ error: 'items array is required' });
  }

  const products = await prisma.product.findMany({ where: { sku: { in: items.map((i) => i.sku) } } });
  if (products.length === 0) {
    return reply.code(404).send({ error: 'No matching items found in merchant catalog' });
  }

  const total = items.reduce((sum, item) => {
    const product = products.find((p) => p.sku === item.sku);
    return sum + (product ? product.price * (Number(item.qty) || 1) : 0);
  }, 0);

  const quote = await prisma.quote.create({
    data: { items, total, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  // Evaluate through deterministic payment gateway
  const payRes = await app.inject({
    method: 'POST',
    url: '/v1/payments',
    headers: { 'x-agent-id': agent.id, 'x-agent-name': agent.name },
    payload: { quoteId: quote.id, mandateId: mandate.id },
  });

  const payData = JSON.parse(payRes.payload);

  return {
    acp_protocol_version: '2026-04-preview',
    session_id: `acp_sess_${quote.id}`,
    status: payData.status,
    reason: payData.reason || null,
    transaction_id: payData.transactionId || null,
    correlation_id: payData.correlationId || null,
    order: {
      quote_id: quote.id,
      currency: 'INR',
      amount_paise: quote.total,
      formatted_total: `₹${(quote.total / 100).toFixed(2)}`,
      items,
    },
    payment: {
      provider: 'razorpay',
      payment_link: payData.paymentLink || null,
      status: payData.status === 'payment_link_created' ? 'ready_to_pay' : 'pending_operator_approval',
    },
    metadata: metadata || {},
  };
});

// ---- Start server & Exports ----
export { app, prisma, ensureAgentAndMandate };

if (process.env.NODE_ENV !== 'test') {
  app.listen({ port: process.env.PORT || 3000 }, (err, address) => {
    if (err) { console.error(err); process.exit(1); }
    console.log(`API running at ${address}`);
  });
}