import { test } from 'node:test';
import assert from 'node:assert';
import {
  checkPerTransactionCap,
  decideGate,
  checkDiscountCeiling,
  checkCanarySKUs,
  checkRateAndVelocity,
  computeQuoteHash,
  verifyQuoteIntegrity,
  computeTieredRiskScore,
  checkSemanticCartInvariance,
  checkPriceDrift,
  checkSmurfing,
  checkBurstCooldown,
  checkDeliveryGeofence,
  checkCircuitBreaker,
} from './rules.js';
import { signUserIntentProof, verifyUserIntentProof } from './mandate.js';

const mandate = { id: 'mnd_1', maxPerTransaction: 200000, dailyCap: 200000, autoApproveThreshold: 50000 };

test('quote under cap passes', () => {
  const result = checkPerTransactionCap(mandate, 40000);
  assert.equal(result.decision, 'allow');
});

test('quote over cap is denied', () => {
  const result = checkPerTransactionCap(mandate, 250000);
  assert.equal(result.decision, 'deny');
});

test('quote exactly at cap passes (boundary case)', () => {
  const result = checkPerTransactionCap(mandate, 200000);
  assert.equal(result.decision, 'allow');
});

test('quote under auto-approve threshold auto-allows', () => {
  const result = decideGate(mandate, 30000, false);
  assert.equal(result.decision, 'allow');
});

test('quote over threshold gets gated', () => {
  const result = decideGate(mandate, 60000, false);
  assert.equal(result.decision, 'pending');
});

test('first-time merchant always gates, even under threshold', () => {
  const result = decideGate(mandate, 10000, true);
  assert.equal(result.decision, 'pending');
});

test('discount under cap passes', () => {
  const result = checkDiscountCeiling(10000, 1000, 20);
  assert.equal(result.decision, 'allow');
});

test('discount over cap is denied', () => {
  const result = checkDiscountCeiling(10000, 2500, 20);
  assert.equal(result.decision, 'deny');
  assert.ok(result.reason.includes('exceeds maximum'));
});

// =========================================================================
// 🛡️ LAYER 1: Proof of Authority (AP2) Tests
// =========================================================================
test('Layer 1: authentic user intent proof of authority passes', () => {
  const signed = signUserIntentProof({
    userId: 'user-shikhar',
    agentId: 'movie-ticket-agent',
    intent: 'Book 2 PVR tickets for Interstellar',
    maxAuthorizedPaise: 100000,
    allowedMerchant: 'merchant-pvr-inox',
  });

  const check = verifyUserIntentProof(signed.signedProofToken, {
    quoteTotal: 90000,
    merchantId: 'merchant-pvr-inox',
  });

  assert.equal(check.valid, true);
  assert.equal(check.decision, 'allow');
});

test('Layer 1: tampered or over-budget intent proof is rejected', () => {
  const signed = signUserIntentProof({
    userId: 'user-shikhar',
    agentId: 'movie-ticket-agent',
    intent: 'Book 2 PVR tickets for Interstellar',
    maxAuthorizedPaise: 50000,
    allowedMerchant: 'merchant-pvr-inox',
  });

  const check = verifyUserIntentProof(signed.signedProofToken, {
    quoteTotal: 80000, // exceeds ₹500 limit in proof
    merchantId: 'merchant-pvr-inox',
  });

  assert.equal(check.valid, false);
  assert.equal(check.decision, 'deny');
  assert.ok(check.reason.includes('exceeds user-authorized limit'));
});

// =========================================================================
// 🧠 LAYER 2: Semantic Item Invariance & Price Drift Tests
// =========================================================================
test('Layer 2: high-risk categories (gift cards, crypto) are strictly denied', () => {
  const items = [{ sku: 'gift-card-500', name: 'Amazon Gift Card ₹500', category: 'vouchers.giftcards' }];
  const result = checkSemanticCartInvariance({ intentText: 'buy birthday gift', items });
  assert.equal(result.decision, 'deny');
  assert.ok(result.reason.includes('restricted high-risk category'));
});

test('Layer 2: semantic intent drift triggers human review', () => {
  const items = [{ sku: 'gold-chain-24k', name: 'Luxury 24K Gold Chain', category: 'jewelry.luxury' }];
  const result = checkSemanticCartInvariance({ intentText: 'order milk and bread for breakfast', items });
  assert.equal(result.decision, 'pending');
  assert.ok(result.reason.includes('semantic intent drift detected'));
});

test('Layer 2: unit price drift > 15% triggers human review', () => {
  const items = [{ sku: 'pvr-imax-3d-ticket', unitPrice: 60000 }]; // 600 vs catalog 450 (+33%)
  const result = checkPriceDrift(items, { 'pvr-imax-3d-ticket': 45000 }, 15);
  assert.equal(result.decision, 'pending');
  assert.ok(result.reason.includes('unit price drift'));
});

// =========================================================================
// ⚡ LAYER 3: Velocity & Anti-Smurfing Tests
// =========================================================================
test('Layer 3: anti-smurfing structuring clusters are detected and gated', () => {
  const recentTransactions = [
    { quote: { total: 49000 } },
    { quote: { total: 48000 } },
    { quote: { total: 49500 } },
  ];
  const result = checkSmurfing({ recentTransactions, autoApproveThreshold: 50000, minClusterSize: 3 });
  assert.equal(result.decision, 'pending');
  assert.ok(result.reason.includes('anti-smurfing structuring detected'));
});

test('Layer 3: burst cooldown trips when orders exceed rate', () => {
  const now = Date.now();
  const timestamps = [new Date(now - 10000), new Date(now - 20000), new Date(now - 30000), new Date(now - 40000)];
  const result = checkBurstCooldown({ recentTimestamps: timestamps, maxOrders: 3, windowSeconds: 120 });
  assert.equal(result.decision, 'deny');
  assert.ok(result.reason.includes('burst velocity limit tripped'));
});

// =========================================================================
// 🔒 LAYER 4: Anti-TOCTOU Quote Hashing Tests
// =========================================================================
test('Layer 4: quote hash computation and anti-tampering verification', () => {
  const items = [{ sku: 'blinkit-artisan-bread', qty: 2, unitPrice: 4500 }];
  const hash = computeQuoteHash(items, 9000);
  assert.ok(hash && typeof hash === 'string' && hash.length === 64);

  const validCheck = verifyQuoteIntegrity({ items, total: 9000 }, hash);
  assert.equal(validCheck.valid, true);

  const tamperedCheck = verifyQuoteIntegrity({ items, total: 10000 }, hash);
  assert.equal(tamperedCheck.valid, false);
  assert.equal(tamperedCheck.decision, 'deny');
});

// =========================================================================
// 📍 LAYER 5: Contextual Fencing (Geofence & Temporal) Tests
// =========================================================================
test('Layer 5: delivery pincode outside approved whitelist is gated', () => {
  const result = checkDeliveryGeofence({
    deliveryPincode: '999999',
    allowedPincodes: ['560001', '560038', '110001'],
  });
  assert.equal(result.decision, 'pending');
  assert.ok(result.reason.includes('does not match user pre-approved address whitelist'));
});

test('Layer 5: delivery pincode inside approved whitelist passes', () => {
  const result = checkDeliveryGeofence({
    deliveryPincode: '560038',
    allowedPincodes: ['560001', '560038', '110001'],
  });
  assert.equal(result.decision, 'allow');
});

// =========================================================================
// 🪤 LAYER 6: Canary Honeytokens & Autonomous Circuit Breaker Tests
// =========================================================================
test('Layer 6: canary honeytoken SKU triggers instant denial', () => {
  const items = [{ sku: 'pvr-imax-3d-ticket', qty: 1 }, { sku: 'canary-exploit-sku', qty: 1 }];
  const result = checkCanarySKUs(items);
  assert.equal(result.decision, 'deny');
  assert.ok(result.reason.includes('tripwire honeytoken'));
});

test('Layer 6: circuit breaker trips after repeated policy violations', () => {
  const result = checkCircuitBreaker({ recentDenialCount: 2, threshold: 2 });
  assert.equal(result.shouldTrip, true);
  assert.equal(result.decision, 'deny');
  assert.ok(result.reason.includes('autonomous circuit breaker tripped'));
});

// =========================================================================
// 🎛️ LAYER 7: Configurable Merchant Risk Appetite Profiles
// =========================================================================
test('Merchant Risk Appetite: Conservative profile denies when riskScore > 60', () => {
  const mandate = { autoApproveThreshold: 10000 };
  const conservativeConfig = { riskTolerance: 'conservative' };

  // Score 65 is under default 70, but exceeds conservative ceiling 60
  const result = decideGate(mandate, 5000, false, { riskScore: 65 }, conservativeConfig);
  assert.equal(result.decision, 'deny');
  assert.equal(result.ruleId, 'risk_tier_high_denial');
  assert.ok(result.reason.includes('security ceiling (60)'));
});

test('Merchant Risk Appetite: Aggressive profile allows moderate risk (< 50) without hold', () => {
  const mandate = { autoApproveThreshold: 10000 };
  const aggressiveConfig = { riskTolerance: 'aggressive' };

  // Score 40 gates under balanced review floor (35), but passes under aggressive floor (50)
  const result = decideGate(mandate, 5000, false, { riskScore: 40 }, aggressiveConfig);
  assert.equal(result.decision, 'allow');
});

test('Merchant Risk Appetite: Custom thresholds are strictly enforced', () => {
  const mandate = { autoApproveThreshold: 10000 };
  const customConfig = { denyThreshold: 80, reviewThreshold: 45 };

  const reviewResult = decideGate(mandate, 5000, false, { riskScore: 48 }, customConfig);
  assert.equal(reviewResult.decision, 'pending');
  assert.equal(reviewResult.ruleId, 'risk_tier_medium_review');

  const denyResult = decideGate(mandate, 5000, false, { riskScore: 82 }, customConfig);
  assert.equal(denyResult.decision, 'deny');
  assert.equal(denyResult.ruleId, 'risk_tier_high_denial');
});