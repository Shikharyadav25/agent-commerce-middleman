import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTransaction } from './evaluate.js';
import { LANES, selectTransactionSecurityLane, computeDeterministicSample } from './adaptive.js';
import { evaluateAgentAnomalyWithGemini, GEMINI_VERDICTS } from './gemini-analyst.js';

test('Evaluate: High-trust agent purchasing from first-time merchant is gated (DEEP_INSPECTION_LANE)', async () => {
  const agent = { id: 'agent-high-trust-1', name: 'High Trust Agent', revoked: false };
  const mandate = {
    id: 'mnd_1',
    agentId: agent.id,
    merchantId: 'merchant-new',
    active: true,
    allowedCategories: ['food.mains'],
    maxPerTransaction: 200000,
    dailyCap: 500000,
    autoApproveThreshold: 50000,
  };

  const result = await evaluateTransaction({
    agent,
    mandate,
    merchantId: 'merchant-new',
    category: 'food.mains',
    quoteTotal: 25000, // ₹250 (well under ₹500 auto-approve threshold)
    isFirstTimeMerchant: true, // First time purchasing from this merchant!
    paidTransactionCount: 5, // Trust score: 60 + 25 = 85 (ordinarily Express Lane eligible)
    recentDenialCount: 0,
    probabilisticSampleRate: 0,
    items: [{ sku: 'paneer-butter-masala', name: 'Paneer Butter Masala', qty: 1, unitPrice: 25000, category: 'food.mains' }],
  });

  // Zero-trust invariant: Brand-new merchant MUST gate for human approval, NOT auto-allow in Express Lane!
  assert.equal(result.lane, LANES.DEEP_INSPECTION_LANE);
  assert.equal(result.finalDecision, 'pending');
  assert.equal(result.ruleId, 'gate_first_time');
  assert.match(result.reason, /first.*merchant/i);
});

test('Evaluate: High-trust agent attempting smurfing is gated (DEEP_INSPECTION_LANE)', async () => {
  const agent = { id: 'agent-high-trust-2', name: 'High Trust Agent', revoked: false };
  const mandate = {
    id: 'mnd_2',
    agentId: agent.id,
    merchantId: 'merchant-known',
    active: true,
    allowedCategories: ['food.mains'],
    maxPerTransaction: 200000,
    dailyCap: 500000,
    autoApproveThreshold: 50000, // ₹500 threshold; 88% is ₹440 (44000 paise)
  };

  // 2 prior transactions hovering right below threshold (₹490 each)
  const recentTransactions = [
    { quote: { total: 49000 }, amount: 49000 },
    { quote: { total: 48500 }, amount: 48500 },
  ];

  const result = await evaluateTransaction({
    agent,
    mandate,
    merchantId: 'merchant-known',
    category: 'food.mains',
    quoteTotal: 49500, // 3rd transaction hovering at 99% of threshold!
    isFirstTimeMerchant: false,
    paidTransactionCount: 10, // Trust score: 100/100
    recentDenialCount: 0,
    recentTransactions,
    probabilisticSampleRate: 0,
    items: [{ sku: 'thali-special', name: 'Special Thali', qty: 1, unitPrice: 49500, category: 'food.mains' }],
  });

  assert.equal(result.lane, LANES.DEEP_INSPECTION_LANE);
  assert.equal(result.finalDecision, 'pending');
  assert.equal(result.ruleId, 'smurfing_structuring_detected');
  assert.match(result.reason, /structuring|smurfing/i);
});

test('Evaluate: High-trust agent routine repeat purchase sails through EXPRESS_LANE', async () => {
  const agent = { id: 'agent-high-trust-3', name: 'High Trust Agent', revoked: false };
  const mandate = {
    id: 'mnd_3',
    agentId: agent.id,
    merchantId: 'merchant-known',
    active: true,
    allowedCategories: ['food.mains'],
    maxPerTransaction: 200000,
    dailyCap: 500000,
    autoApproveThreshold: 50000,
  };

  const result = await evaluateTransaction({
    agent,
    mandate,
    merchantId: 'merchant-known',
    category: 'food.mains',
    quoteTotal: 25000, // ₹250
    isFirstTimeMerchant: false,
    paidTransactionCount: 5, // Trust score 85
    recentDenialCount: 0,
    probabilisticSampleRate: 0,
    items: [{ sku: 'naan', name: 'Butter Naan', qty: 1, unitPrice: 25000, category: 'food.mains' }],
  });

  assert.equal(result.lane, LANES.EXPRESS_LANE);
  assert.equal(result.finalDecision, 'allow');
  assert.equal(result.ruleId, 'express_highway');
});

test('Adaptive: computeDeterministicSample is consistent and repeatable across runs', () => {
  const sample1 = computeDeterministicSample('agent-1:merchant-1:groceries:15000');
  const sample2 = computeDeterministicSample('agent-1:merchant-1:groceries:15000');
  assert.equal(sample1, sample2);
  assert.ok(sample1 >= 0 && sample1 < 1);
});

test('Gemini Analyst: Heuristic fallback never revokes on pending review decisions (e.g. smurfing)', async () => {
  const result = await evaluateAgentAnomalyWithGemini({
    agent: { id: 'agent-smurfer', name: 'Smurfing Agent' },
    userIntentPrompt: 'Order dinner',
    cart: [{ sku: 'dinner-order', qty: 1, unitPrice: 48000 }],
    ruleId: 'smurfing_structuring_detected',
    reason: 'Anti-smurfing structuring: 3 transactions hovering at 88-100% of threshold',
    quoteTotal: 48000,
    mandate: { autoApproveThreshold: 50000 },
    apiKey: '', // heuristic fallback
  });

  assert.equal(result.source, 'heuristic_fallback');
  assert.equal(result.verdict, GEMINI_VERDICTS.HOLD_FOR_HUMAN_REVIEW);
  assert.equal(result.shouldRevokeAgent, false); // CRITICAL: Never auto-revoke on pending review!
});

test('Evaluate: High-trust agent attempting to purchase prepaid.cards is strictly denied by category blacklist', async () => {
  const agent = { id: 'agent-trusted-prepaid', name: 'High Trust Agent', revoked: false };
  const mandate = {
    id: 'mnd_prepaid',
    agentId: agent.id,
    merchantId: 'merchant-known',
    active: true,
    allowedCategories: ['prepaid.cards', 'grocery.staples'],
    maxPerTransaction: 200000,
    dailyCap: 500000,
    autoApproveThreshold: 50000,
  };

  const result = await evaluateTransaction({
    agent,
    mandate,
    merchantId: 'merchant-known',
    category: 'prepaid.cards',
    quoteTotal: 15000, // ₹150 (well under auto-approve threshold)
    isFirstTimeMerchant: false,
    paidTransactionCount: 10, // Trust score: 100/100
    recentDenialCount: 0,
    probabilisticSampleRate: 0,
    items: [{ sku: 'prepaid-card-mastercard', name: 'Virtual Prepaid Card', qty: 1, unitPrice: 15000, category: 'prepaid.cards' }],
  });

  // Zero-trust invariant: Must be strictly denied by category blacklist regardless of lane or agent trust!
  assert.equal(result.finalDecision, 'deny');
  assert.equal(result.ruleId, 'disallowed_category_blacklist');
  assert.match(result.reason, /restricted high-risk category/i);
});

test('Evaluate: High-trust agent attempting to purchase gambling SKU is strictly denied by category blacklist', async () => {
  const agent = { id: 'agent-trusted-gambling', name: 'High Trust Agent', revoked: false };
  const mandate = {
    id: 'mnd_gambling',
    agentId: agent.id,
    merchantId: 'merchant-known',
    active: true,
    allowedCategories: ['gambling', 'entertainment.tickets'],
    maxPerTransaction: 200000,
    dailyCap: 500000,
    autoApproveThreshold: 50000,
  };

  const result = await evaluateTransaction({
    agent,
    mandate,
    merchantId: 'merchant-known',
    category: 'gambling',
    quoteTotal: 20000,
    isFirstTimeMerchant: false,
    paidTransactionCount: 8,
    recentDenialCount: 0,
    probabilisticSampleRate: 0,
    items: [{ sku: 'casino-roulette-chips', name: 'Casino Chips', qty: 1, unitPrice: 20000, category: 'gambling' }],
  });

  assert.equal(result.finalDecision, 'deny');
  assert.equal(result.ruleId, 'disallowed_category_blacklist');
  assert.match(result.reason, /restricted high-risk category/i);
});

test('Evaluate: Composite risk score > 70 triggers immediate denial (risk_tier_high_denial)', async () => {
  const agent = { id: 'agent-high-risk', name: 'High Risk Agent', revoked: false };
  const mandate = {
    id: 'mnd_risk',
    agentId: agent.id,
    merchantId: 'merchant-risky',
    active: true,
    allowedCategories: ['food.mains'],
    maxPerTransaction: 200000,
    dailyCap: 500000,
    autoApproveThreshold: 10000, // ₹100 threshold
  };

  // 18 recent transactions (under 20 velocity limit), quote 10x threshold -> risk score 88 > 70
  const recentTransactions = Array.from({ length: 18 }, () => ({ quote: { total: 10000 } }));

  const result = await evaluateTransaction({
    agent,
    mandate,
    merchantId: 'merchant-risky',
    category: 'food.mains',
    quoteTotal: 100000, // ₹1,000 on a ₹100 threshold (ratio = 10, max amount weight 40) + velocity 25 + first time 25 = 90
    isFirstTimeMerchant: true,
    paidTransactionCount: 1,
    recentDenialCount: 0,
    recentTransactions,
    probabilisticSampleRate: 0,
    items: [{ sku: 'luxury-dinner', name: 'Luxury Dinner', qty: 1, unitPrice: 100000, category: 'food.mains' }],
  });

  assert.equal(result.finalDecision, 'deny');
  assert.equal(result.ruleId, 'risk_tier_high_denial');
  assert.ok(result.riskScore > 70);
});
