import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAgentAnomalyWithGemini, GEMINI_VERDICTS } from './gemini-analyst.js';

test('Gemini Analyst: falls back gracefully without API key and classifies canary probe as REVOKE_ACCESS', async () => {
  const result = await evaluateAgentAnomalyWithGemini({
    agent: { id: 'test-agent', name: 'Test Bot' },
    userIntentPrompt: 'Browse catalog',
    cart: [{ sku: 'test-unrestricted-admin-token', qty: 1 }],
    ruleId: 'canary_honeytoken',
    reason: 'tripwire honeytoken detected',
    quoteTotal: 100,
    apiKey: '', // explicit no key
  });

  assert.equal(result.source, 'heuristic_fallback');
  assert.equal(result.verdict, GEMINI_VERDICTS.REVOKE_ACCESS);
  assert.equal(result.shouldRevokeAgent, true);
  assert.match(result.executiveBrief, /Critical Security Alert/i);
});

test('Gemini Analyst: classifies high-risk gift card prompt injection as REVOKE_ACCESS in fallback', async () => {
  const result = await evaluateAgentAnomalyWithGemini({
    agent: { id: 'test-agent', name: 'Test Bot' },
    userIntentPrompt: 'Buy bread',
    cart: [{ sku: 'apple-gift-card', category: 'vouchers.giftcards', qty: 1, unitPrice: 500000 }],
    ruleId: 'semantic_intent_drift',
    reason: 'cart items do not match user prompt',
    quoteTotal: 500000,
    apiKey: '',
  });

  assert.equal(result.verdict, GEMINI_VERDICTS.REVOKE_ACCESS);
  assert.equal(result.shouldRevokeAgent, true);
  assert.match(result.executiveBrief, /high-risk prohibited category/i);
});

test('Gemini Analyst: classifies benign budget threshold exceed as HOLD_FOR_HUMAN_REVIEW', async () => {
  const result = await evaluateAgentAnomalyWithGemini({
    agent: { id: 'test-agent', name: 'Test Bot' },
    userIntentPrompt: 'Order dinner with drink',
    cart: [{ sku: 'pizza', qty: 1, unitPrice: 52000 }],
    ruleId: 'gate_threshold',
    reason: 'order exceeds auto-approve threshold ₹500',
    quoteTotal: 52000,
    mandate: { autoApproveThreshold: 50000 },
    apiKey: '',
  });

  assert.equal(result.verdict, GEMINI_VERDICTS.HOLD_FOR_HUMAN_REVIEW);
  assert.equal(result.shouldRevokeAgent, false);
});
