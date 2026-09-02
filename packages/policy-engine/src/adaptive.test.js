import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAgentTrustScore,
  selectTransactionSecurityLane,
  LANES,
} from './adaptive.js';

test('Adaptive: computes trust score accurately based on history', () => {
  // New agent: 60
  assert.equal(computeAgentTrustScore({ paidCount: 0, denialCount: 0 }), 60);

  // Established agent (5 paid, 0 denials): 60 + 25 = 85
  assert.equal(computeAgentTrustScore({ paidCount: 5, denialCount: 0 }), 85);

  // Compromised / warned agent (2 paid, 2 denials): 60 + 10 - 40 = 30
  assert.equal(computeAgentTrustScore({ paidCount: 2, denialCount: 2 }), 30);

  // Maximum cap is 100
  assert.equal(computeAgentTrustScore({ paidCount: 20, denialCount: 0 }), 100);

  // Minimum floor is 0
  assert.equal(computeAgentTrustScore({ paidCount: 0, denialCount: 10 }), 0);
});

test('Adaptive: routes trusted agent grocery purchase to EXPRESS_LANE', () => {
  const routing = selectTransactionSecurityLane({
    agent: { id: 'agent-1' },
    quoteTotal: 15000, // ₹150
    category: 'grocery.staples',
    mandate: { autoApproveThreshold: 50000 },
    paidTransactionCount: 4, // Trust score: 60 + 20 = 80 >= 70
    recentDenialCount: 0,
    probabilisticSampleRate: 0, // Disable random spot check for deterministic test
  });

  assert.equal(routing.lane, LANES.EXPRESS_LANE);
  assert.equal(routing.trustScore, 80);
  assert.match(routing.reason, /Express Highway/i);
});

test('Adaptive: routes high-risk category (electronics) to DEEP_INSPECTION_LANE', () => {
  const routing = selectTransactionSecurityLane({
    agent: { id: 'agent-1' },
    quoteTotal: 40000,
    category: 'consumer.electronics',
    mandate: { autoApproveThreshold: 50000 },
    paidTransactionCount: 10,
    recentDenialCount: 0,
  });

  assert.equal(routing.lane, LANES.DEEP_INSPECTION_LANE);
  assert.match(routing.reason, /High-liquidity category/i);
});

test('Adaptive: routes new agent (< 2 transactions) to DEEP_INSPECTION_LANE', () => {
  const routing = selectTransactionSecurityLane({
    agent: { id: 'agent-new' },
    quoteTotal: 10000,
    category: 'food.dining',
    mandate: { autoApproveThreshold: 50000 },
    paidTransactionCount: 0, // New agent
    recentDenialCount: 0,
  });

  assert.equal(routing.lane, LANES.DEEP_INSPECTION_LANE);
  assert.match(routing.reason, /probationary/i);
});

test('Adaptive: routes transactions over auto-approve threshold to DEEP_INSPECTION_LANE', () => {
  const routing = selectTransactionSecurityLane({
    agent: { id: 'agent-1' },
    quoteTotal: 60000, // ₹600 > ₹500
    category: 'grocery.staples',
    mandate: { autoApproveThreshold: 50000 },
    paidTransactionCount: 5,
    recentDenialCount: 0,
  });

  assert.equal(routing.lane, LANES.DEEP_INSPECTION_LANE);
  assert.match(routing.reason, /exceeds auto-approval threshold/i);
});

test('Adaptive: probabilistic spot-check forces DEEP_INSPECTION_LANE on routine order', () => {
  const routing = selectTransactionSecurityLane({
    agent: { id: 'agent-1' },
    quoteTotal: 10000,
    category: 'grocery.staples',
    mandate: { autoApproveThreshold: 50000 },
    paidTransactionCount: 5,
    recentDenialCount: 0,
    probabilisticSampleRate: 1.0, // 100% sample rate to guarantee trigger
  });

  assert.equal(routing.lane, LANES.DEEP_INSPECTION_LANE);
  assert.equal(routing.isSampled, true);
  assert.match(routing.reason, /Probabilistic security spot-check/i);
});
