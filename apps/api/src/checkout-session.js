import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { checkCategoryBlacklist, checkCanarySKUs } from '../../../packages/policy-engine/src/rules.js';
import { getDynamicAddonSuggestions } from './growth.js';

const prisma = new PrismaClient();

// In-memory checkout sessions store with 30-minute TTL
const sessions = new Map();

// Periodic cleanup of expired sessions every 10 minutes (unref so process can exit cleanly)
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt && new Date(session.expiresAt).getTime() < now) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

export function createCheckoutSession({ agentId = null, agentName = 'Autonomous Agent', merchantId = null } = {}) {
  const id = `cs_${crypto.randomBytes(12).toString('hex')}`;
  const session = {
    id,
    agentId: agentId || `agent-${crypto.randomBytes(4).toString('hex')}`,
    agentName,
    merchantId,
    status: 'cart_building', // cart_building | intent_attached | completed | cancelled
    items: [],
    totalPaise: 0,
    formattedTotal: '₹0.00',
    userIntentPrompt: null,
    deliveryPincode: null,
    proofOfAuthority: null,
    policyWarnings: [],
    recommendedAddons: [],
    quoteId: null,
    transactionId: null,
    paymentLinkUrl: null,
    razorpayOrderId: null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };

  sessions.set(id, session);
  return session;
}

export function getCheckoutSession(id) {
  const session = sessions.get(id);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

export async function addItemToSession(sessionId, { sku, qty = 1 }) {
  const session = getCheckoutSession(sessionId);
  if (!session) {
    throw new Error('Checkout session not found or expired');
  }
  if (session.status === 'completed') {
    throw new Error('Cannot modify a completed checkout session');
  }

  // 1. Pre-flight Fast-fail: Canary Honeytoken Trap & Category Blacklist (Intercepts rogue bots before DB query)
  const canaryCheck = checkCanarySKUs([{ sku }]);
  if (canaryCheck.decision === 'deny') {
    return {
      success: false,
      blocked: true,
      reason: canaryCheck.reason,
      ruleId: canaryCheck.ruleId,
      session,
    };
  }

  const fastCategoryCheck = checkCategoryBlacklist([{ sku }]);
  if (fastCategoryCheck.decision === 'deny') {
    return {
      success: false,
      blocked: true,
      reason: fastCategoryCheck.reason,
      ruleId: fastCategoryCheck.ruleId,
      session,
    };
  }

  // 2. Fetch product from catalog
  const product = await prisma.product.findFirst({
    where: { sku },
    include: { merchant: true },
  });

  if (!product) {
    throw new Error(`Product with SKU "${sku}" not found in catalog`);
  }

  // 2. Pre-flight Fast-fail: Category Blacklist & Canary Token
  const categoryCheck = checkCategoryBlacklist([{ sku, category: product.category }]);
  if (categoryCheck.decision === 'deny') {
    return {
      success: false,
      blocked: true,
      reason: categoryCheck.reason,
      ruleId: categoryCheck.ruleId,
      session,
    };
  }

  // 3. Upsert item into cart
  const quantity = Math.max(1, Number(qty) || 1);
  const existingIndex = session.items.findIndex((it) => it.sku === sku);

  if (existingIndex >= 0) {
    session.items[existingIndex].qty += quantity;
    session.items[existingIndex].lineTotal = session.items[existingIndex].qty * product.price;
  } else {
    session.items.push({
      sku: product.sku,
      name: product.name,
      category: product.category,
      unitPrice: product.price,
      qty: quantity,
      lineTotal: quantity * product.price,
    });
  }

  if (!session.merchantId) {
    session.merchantId = product.merchantId;
  }

  // 4. Recalculate cart totals
  session.totalPaise = session.items.reduce((sum, it) => sum + it.lineTotal, 0);
  session.formattedTotal = `₹${(session.totalPaise / 100).toFixed(2)}`;

  // 5. Query Bandit Addon Recommendations for this incremental cart
  try {
    const addons = await getDynamicAddonSuggestions({
      skus: session.items.map((i) => i.sku),
      merchantId: session.merchantId,
      limit: 2,
    });
    session.recommendedAddons = addons;
  } catch (err) {
    session.recommendedAddons = [];
  }

  return {
    success: true,
    addedItem: { sku: product.sku, name: product.name, qty: quantity, unitPrice: product.price },
    session,
  };
}

export function removeItemFromSession(sessionId, sku) {
  const session = getCheckoutSession(sessionId);
  if (!session) {
    throw new Error('Checkout session not found or expired');
  }
  if (session.status === 'completed') {
    throw new Error('Cannot modify a completed checkout session');
  }

  session.items = session.items.filter((it) => it.sku !== sku);
  session.totalPaise = session.items.reduce((sum, it) => sum + it.lineTotal, 0);
  session.formattedTotal = `₹${(session.totalPaise / 100).toFixed(2)}`;

  return {
    success: true,
    removedSku: sku,
    session,
  };
}

export function setSessionIntent(sessionId, { userIntentPrompt = null, deliveryPincode = null, proofOfAuthority = null }) {
  const session = getCheckoutSession(sessionId);
  if (!session) {
    throw new Error('Checkout session not found or expired');
  }
  if (session.status === 'completed') {
    throw new Error('Cannot modify a completed checkout session');
  }

  session.userIntentPrompt = userIntentPrompt || session.userIntentPrompt;
  session.deliveryPincode = deliveryPincode || session.deliveryPincode;
  session.proofOfAuthority = proofOfAuthority || session.proofOfAuthority;
  session.status = 'intent_attached';

  // Incremental policy pre-flight check
  session.policyWarnings = [];
  const allowedPincodes = ['560001', '560038', '110001', '400001'];
  if (session.deliveryPincode && !allowedPincodes.includes(String(session.deliveryPincode))) {
    session.policyWarnings.push({
      type: 'GEOFENCE_WARNING',
      message: `Delivery pincode "${session.deliveryPincode}" is outside standard pre-approved zones. May require supervisor review.`,
    });
  }

  return {
    success: true,
    session,
  };
}

export async function completeCheckoutSession(sessionId, { executeTransaction, createOrder, createPaymentLink }) {
  const session = getCheckoutSession(sessionId);
  if (!session) {
    throw new Error('Checkout session not found or expired');
  }
  if (session.status === 'completed') {
    throw new Error('Checkout session has already been finalized and paid');
  }
  if (session.items.length === 0) {
    throw new Error('Cannot checkout an empty basket');
  }

  // 1. Create durable Quote in DB
  const quote = await prisma.quote.create({
    data: {
      items: session.items,
      total: session.totalPaise,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  session.quoteId = quote.id;

  // 2. Execute Zero-Trust Policy Engine
  const evaluation = await executeTransaction({
    quoteId: quote.id,
    userIntentPrompt: session.userIntentPrompt,
    deliveryPincode: session.deliveryPincode,
    proofOfAuthority: session.proofOfAuthority,
    agentId: session.agentId,
    agentName: session.agentName,
  });

  session.status = 'completed';
  session.transactionId = evaluation.transactionId;
  session.paymentLinkUrl = evaluation.paymentLink || evaluation.paymentLinkUrl;
  session.razorpayOrderId = evaluation.orderId || evaluation.razorpayOrderId;
  session.finalDecision = evaluation.status;

  return {
    success: true,
    sessionId: session.id,
    quoteId: quote.id,
    transactionId: evaluation.transactionId,
    decision: evaluation.status,
    paymentLinkUrl: evaluation.paymentLink || evaluation.paymentLinkUrl,
    razorpayOrderId: evaluation.orderId || evaluation.razorpayOrderId,
    session,
  };
}
