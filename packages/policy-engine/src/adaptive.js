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

export const LANES = {
  EXPRESS_LANE: 'EXPRESS_LANE',
  DEEP_INSPECTION_LANE: 'DEEP_INSPECTION_LANE',
};

/**
 * Computes an agent's dynamic Trust & Reputation Score (0 - 100).
 * - Starts at baseline 60 for any active credential.
 * - Adds +5 points per successful paid transaction (max 100).
 * - Deducts -20 points per policy violation or suspicious trigger (min 0).
 */
export function computeAgentTrustScore({ paidCount = 0, denialCount = 0 } = {}) {
  const score = 60 + (paidCount * 5) - (denialCount * 20);
  return Math.max(0, Math.min(100, score));
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
  forceDeepInspection = false,
  probabilisticSampleRate = 0.05, // 5% randomized spot-checks (TSA PreCheck model)
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

  // 2. High-Risk / High-Liquidity Categories (electronics, vouchers, crypto, luxury, flights)
  // Fraudsters target liquid, easily resold items; commodities (bread, milk, movie tickets) are low risk.
  const isHighRiskCategory = Boolean(
    (category || '').match(/electronics|hardware|crypto|giftcard|voucher|flight|luxury|jewelry/i)
  );

  if (isHighRiskCategory) {
    return {
      lane: LANES.DEEP_INSPECTION_LANE,
      reason: `High-liquidity category [${category || 'restricted'}] requires full 6-layer verification`,
      trustScore,
      isSampled: false,
    };
  }

  // 3. Untrusted or Brand-New Agents (Trust Score < 70 or < 2 completed transactions)
  if (trustScore < 70 || paidTransactionCount < 2) {
    return {
      lane: LANES.DEEP_INSPECTION_LANE,
      reason: `Agent trust level probationary (Trust Score: ${trustScore}/100, Paid Orders: ${paidTransactionCount})`,
      trustScore,
      isSampled: false,
    };
  }

  // 4. Above Auto-Approve Threshold
  if (mandate.autoApproveThreshold && quoteTotal > mandate.autoApproveThreshold) {
    return {
      lane: LANES.DEEP_INSPECTION_LANE,
      reason: `Transaction amount exceeds auto-approval threshold (${quoteTotal} > ${mandate.autoApproveThreshold})`,
      trustScore,
      isSampled: false,
    };
  }

  // 5. Probabilistic Spot-Check (5% randomized audit)
  // Prevents malicious agents from reverse-engineering fixed thresholds.
  if (Math.random() < probabilisticSampleRate) {
    return {
      lane: LANES.DEEP_INSPECTION_LANE,
      reason: 'Probabilistic security spot-check (5% non-deterministic audit)',
      trustScore,
      isSampled: true,
    };
  }

  // 6. Routine, High-Trust, Low-Risk Transaction -> EXPRESS LANE!
  return {
    lane: LANES.EXPRESS_LANE,
    reason: `Express Highway: High-trust agent (${trustScore}/100) purchasing routine low-risk category`,
    trustScore,
    isSampled: false,
  };
}
