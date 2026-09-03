/**
 * Adaptive Security Tiers & Frictionless Exemption Lanes
 * 
 * Inspired by Visa/Mastercard 3D Secure 2.0, Stripe Radar, and TSA PreCheck.
 * Instead of running heavy deep-inspection on every cup of tea or loaf of bread,
 * transactions are dynamically routed between:
 * 
 * 1. EXPRESS_LANE (< 0.1ms):
 *    For routine, low-risk commodity purchases made by high-trust agents.
 *    Executes essential sanity checks (active credentials, budget cap, valid quote hash).
 * 
 * 2. DEEP_INSPECTION_LANE (Full 6-Layer Security):
 *    For high-risk categories, new/low-trust agents, behavioral anomalies,
 *    or non-deterministic 5% probabilistic spot-checks.
 */

import { checkSmurfing, HIGH_RISK_CATEGORIES } from './rules.js';

export const LANES = {
  EXPRESS_LANE: 'EXPRESS_LANE',
  DEEP_INSPECTION_LANE: 'DEEP_INSPECTION_LANE',
};

/**
 * Computes an agent's dynamic Trust & Reputation Score (0 - 100).
 * - Starts at baseline 60 for any active credential.
 * - Adds +5 points per successful paid transaction (max 100).
 * - Deducts -20 points per policy violation or suspicious trigger (min 0).
 * 
 * NOTE ON TRUST BOUNDARIES:
 * Trust score is an agent reputation metric. However, per zero-trust security
 * guarantees, an agent's trust score NEVER waives the mandatory gating check
 * for first-time merchants (isFirstTimeMerchant). A high agent trust score allows
 * routine commodity purchases with previously verified merchants in Express Lane,
 * but first interactions with any new merchant strictly require human sign-off.
 */
export function computeAgentTrustScore({ paidCount = 0, denialCount = 0 } = {}) {
  const score = 60 + (paidCount * 5) - (denialCount * 20);
  return Math.max(0, Math.min(100, score));
}

/**
 * Deterministic pseudo-random fraction (0 to 1) based on FNV-1a hash of a seed string.
 * Ensures auditability and reproducible demo/test runs without Math.random() flakes.
 */
export function computeDeterministicSample(seedString = '') {
  let hash = 2166136261;
  for (let i = 0; i < seedString.length; i++) {
    hash ^= seedString.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/**
 * Dynamically routes a transaction to either the Express Lane or Deep Inspection Lane.
 */
export function selectTransactionSecurityLane({
  agent = {},
  quoteTotal = 0,
  category = '',
  merchantId = '',
  mandate = {},
  paidTransactionCount = 0,
  recentDenialCount = 0,
  isFirstTimeMerchant = false,
  recentTransactions = [],
  forceDeepInspection = false,
  probabilisticSampleRate = (typeof process !== 'undefined' && process.env && (process.env.NODE_ENV === 'production' || process.env.ENABLE_PROBABILISTIC_SAMPLING === 'true')) ? 0.05 : 0,
  sampleSeed = null,
  randomFn = null,
} = {}) {
  const trustScore = computeAgentTrustScore({
    paidCount: paidTransactionCount,
    denialCount: recentDenialCount,
  });

  // 1. Explicit override (e.g. testing or operator security alert)
  if (forceDeepInspection) {
    return {
      lane: LANES.DEEP_INSPECTION_LANE,
      reason: 'Forced deep security inspection',
      trustScore,
      isSampled: false,
    };
  }

  // 2. High-Risk / High-Liquidity Categories (electronics, vouchers, crypto, luxury, flights, gambling, prepaid cards)
  // Fraudsters target liquid, easily resold items; commodities (bread, milk, movie tickets) are low risk.
  const catLower = (category || '').toLowerCase();
  const isBlacklistedCategory = HIGH_RISK_CATEGORIES.some((c) => catLower.includes(c));
  const isHighRiskCategory = isBlacklistedCategory || Boolean(
    catLower.match(/electronics|hardware|crypto|giftcard|voucher|prepaid|card|flight|luxury|jewelry|gambling/i)
  );

  if (isHighRiskCategory) {
    return {
      lane: LANES.DEEP_INSPECTION_LANE,
      reason: isBlacklistedCategory
        ? `High-liquidity category [${category || 'restricted'} - blacklisted] requires full 6-layer verification`
        : `High-liquidity category [${category || 'restricted'}] requires full 6-layer verification`,
      trustScore,
      isSampled: false,
    };
  }

  // 3. First-Time Merchant Boundary (Zero-Trust Invariant)
  // Even an agent with 100/100 trust MUST gate when interacting with an unvetted merchant for the first time.
  if (isFirstTimeMerchant) {
    return {
      lane: LANES.DEEP_INSPECTION_LANE,
      reason: 'First-time merchant requires human sign-off verification',
      trustScore,
      isSampled: false,
    };
  }

  // 4. Untrusted or Brand-New Agents (Trust Score < 70 or < 2 completed transactions)
  if (trustScore < 70 || paidTransactionCount < 2) {
    return {
      lane: LANES.DEEP_INSPECTION_LANE,
      reason: `Agent trust level probationary (Trust Score: ${trustScore}/100, Paid Orders: ${paidTransactionCount})`,
      trustScore,
      isSampled: false,
    };
  }

  // 5. Above Auto-Approve Threshold
  if (mandate.autoApproveThreshold && quoteTotal > mandate.autoApproveThreshold) {
    return {
      lane: LANES.DEEP_INSPECTION_LANE,
      reason: `Transaction amount exceeds auto-approval threshold (${quoteTotal} > ${mandate.autoApproveThreshold})`,
      trustScore,
      isSampled: false,
    };
  }

  // 6. Anti-Smurfing Structuring Check
  // Flag transaction bursts clustering at 88-100% of auto-approve threshold before Express routing
  if (mandate?.autoApproveThreshold) {
    const smurfingCandidates = [
      { quote: { total: quoteTotal }, amount: quoteTotal },
      ...(Array.isArray(recentTransactions) ? recentTransactions : []),
    ];
    const smurfingCheck = checkSmurfing({
      recentTransactions: smurfingCandidates,
      autoApproveThreshold: mandate.autoApproveThreshold,
      minClusterSize: 3,
    });
    if (smurfingCheck.decision === 'pending') {
      return {
        lane: LANES.DEEP_INSPECTION_LANE,
        reason: `Anti-smurfing structuring pattern detected: requires deep inspection (${smurfingCheck.reason})`,
        trustScore,
        isSampled: false,
      };
    }
  }

  // 7. Probabilistic Spot-Check (Randomized audit / TSA PreCheck model)
  // Uses deterministic seeded PRNG for reproducible audits unless custom randomFn is passed.
  if (probabilisticSampleRate > 0) {
    const seed = sampleSeed || `${agent.id || 'agent'}:${merchantId || 'merchant'}:${category || 'cat'}:${quoteTotal}`;
    const sampleValue = typeof randomFn === 'function' ? randomFn() : computeDeterministicSample(seed);
    if (sampleValue < probabilisticSampleRate) {
      return {
        lane: LANES.DEEP_INSPECTION_LANE,
        reason: `Probabilistic security spot-check (${(probabilisticSampleRate * 100).toFixed(0)}% audit)`,
        trustScore,
        isSampled: true,
      };
    }
  }

  // 8. Routine, High-Trust, Low-Risk Transaction -> EXPRESS LANE!
  return {
    lane: LANES.EXPRESS_LANE,
    reason: `Express Highway: High-trust agent (${trustScore}/100) purchasing routine low-risk category`,
    trustScore,
    isSampled: false,
  };
}
