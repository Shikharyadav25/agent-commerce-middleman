import crypto from 'crypto';

/**
 * =========================================================================
 * 🛡️ LAYER 1: IN-MEMORY FAST CHECKS & KILLSWITCH (< 0.2ms)
 * =========================================================================
 */

export function checkAgentValid(agent) {
  if (!agent || agent.revoked) {
    return { decision: 'deny', reason: 'agent credential is revoked or invalid', ruleId: 'agent_valid' };
  }
  return { decision: 'allow', reason: 'agent credential is valid', ruleId: 'agent_valid' };
}

export function checkMandateCoverage(mandate, merchantId, category) {
  if (!mandate.active) {
    return { decision: 'deny', reason: 'mandate is not active', ruleId: 'mandate_active' };
  }
  if (mandate.merchantId !== merchantId) {
    return { decision: 'deny', reason: `mandate does not cover merchant ${merchantId}`, ruleId: 'mandate_merchant_scope' };
  }
  if (!mandate.allowedCategories.includes(category)) {
    return { decision: 'deny', reason: `category "${category}" is not in the mandate's allowed list`, ruleId: 'mandate_category_scope' };
  }
  return { decision: 'allow', reason: 'mandate covers this merchant and category', ruleId: 'mandate_coverage' };
}

export function checkPerTransactionCap(mandate, quoteTotal) {
  if (quoteTotal > mandate.maxPerTransaction) {
    return { decision: 'deny', reason: `quote ₹${quoteTotal / 100} exceeds per-transaction cap ₹${mandate.maxPerTransaction / 100} on mandate ${mandate.id}`, ruleId: 'per_txn_cap' };
  }
  return { decision: 'allow', reason: 'within per-transaction cap', ruleId: 'per_txn_cap' };
}

export function checkDailyCap(mandate, todaysCumulativeSpend, quoteTotal) {
  const projected = todaysCumulativeSpend + quoteTotal;
  if (projected > mandate.dailyCap) {
    return { decision: 'deny', reason: `today's spend ₹${todaysCumulativeSpend / 100} + this quote ₹${quoteTotal / 100} would exceed daily cap ₹${mandate.dailyCap / 100}`, ruleId: 'daily_cap' };
  }
  return { decision: 'allow', reason: 'within daily cap', ruleId: 'daily_cap' };
}

/**
 * =========================================================================
 * 🧠 LAYER 2: SEMANTIC CART INVARIANCE & ANTI-PROMPT INJECTION (< 0.5ms)
 * =========================================================================
 */

const HIGH_RISK_CATEGORIES = ['vouchers.giftcards', 'crypto.currency', 'prepaid.cards', 'luxury.jewelry', 'gambling'];

export function checkSemanticCartInvariance({
  intentText = null,
  items = [],
  disallowedCategories = HIGH_RISK_CATEGORIES,
} = {}) {
  // 1. Strict blacklist on high-risk categories
  for (const it of items) {
    const cat = (it.category || '').toLowerCase();
    if (disallowedCategories.some((dc) => cat.includes(dc))) {
      return {
        decision: 'deny',
        reason: `restricted high-risk category detected: "${it.category}" (gift cards, crypto, and prepaid vouchers are strictly prohibited for autonomous agents)`,
        ruleId: 'disallowed_category_blacklist',
      };
    }
  }

  // 2. Intent-to-Cart Token Similarity (Anti-Prompt Injection Drift)
  if (intentText && typeof intentText === 'string' && intentText.trim().length > 3) {
    const cleanWords = (str) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'under', 'buy', 'order', 'get', 'book', 'please'].includes(w));

    const intentTokens = new Set(cleanWords(intentText));
    const cartText = items.map((i) => `${i.sku} ${i.name || ''} ${i.category || ''}`).join(' ');
    const cartTokens = cleanWords(cartText);

    if (intentTokens.size > 0 && cartTokens.length > 0) {
      let matches = 0;
      for (const t of cartTokens) {
        if (intentTokens.has(t) || Array.from(intentTokens).some((it) => it.includes(t) || t.includes(it))) {
          matches++;
        }
      }

      // If there are specific intent keywords but zero overlap with cart items, flag intent drift
      if (matches === 0 && intentTokens.size >= 2) {
        return {
          decision: 'pending',
          reason: `semantic intent drift detected: cart items do not correlate with user prompt "${intentText}"`,
          ruleId: 'semantic_intent_drift',
        };
      }
    }
  }

  return { decision: 'allow', reason: 'cart items verified within semantic scope', ruleId: 'semantic_invariance' };
}

export function checkPriceDrift(items = [], catalogPriceMap = {}, maxDeviationPercent = 15) {
  for (const it of items) {
    const expected = catalogPriceMap[it.sku];
    if (expected && it.unitPrice) {
      const deviation = Math.abs((it.unitPrice - expected) / expected) * 100;
      if (deviation > maxDeviationPercent) {
        return {
          decision: 'pending',
          reason: `unit price drift of ${deviation.toFixed(1)}% detected on SKU "${it.sku}" (catalog ₹${expected / 100} vs quoted ₹${it.unitPrice / 100})`,
          ruleId: 'price_drift_detected',
        };
      }
    }
  }
  return { decision: 'allow', reason: 'unit prices match catalog baseline', ruleId: 'price_drift_detected' };
}

/**
 * =========================================================================
 * ⚡ LAYER 3: VELOCITY ANOMALY DETECTION & ANTI-SMURFING (< 0.3ms)
 * =========================================================================
 */

export function checkRateAndVelocity(recentTxCount = 0, maxAllowedBurst = 20, windowDescription = 'past 10 minutes') {
  if (recentTxCount >= maxAllowedBurst) {
    return {
      decision: 'deny',
      reason: `velocity threshold exceeded: ${recentTxCount} transactions initiated in ${windowDescription} (max allowed: ${maxAllowedBurst})`,
      ruleId: 'velocity_rate_limit',
    };
  }
  return { decision: 'allow', reason: `velocity within limits (${recentTxCount}/${maxAllowedBurst})`, ruleId: 'velocity_rate_limit' };
}

export function checkSmurfing({ recentTransactions = [], autoApproveThreshold = 50000, minClusterSize = 3 } = {}) {
  if (!Array.isArray(recentTransactions) || recentTransactions.length < minClusterSize) {
    return { decision: 'allow', reason: 'no smurfing detected', ruleId: 'smurfing_defense' };
  }

  // Check if multiple recent transactions hover right below threshold (88% to 100%)
  const lowerBound = Math.floor(autoApproveThreshold * 0.88);
  const nearThresholdTxns = recentTransactions.filter((t) => {
    const total = t.quote?.total || t.amount || 0;
    return total >= lowerBound && total <= autoApproveThreshold;
  });

  if (nearThresholdTxns.length >= minClusterSize) {
    return {
      decision: 'pending',
      reason: `anti-smurfing structuring detected: ${nearThresholdTxns.length} transactions clustered between ₹${lowerBound / 100} and ₹${autoApproveThreshold / 100} in short succession`,
      ruleId: 'smurfing_structuring_detected',
    };
  }

  return { decision: 'allow', reason: 'transaction amounts exhibit normal distribution', ruleId: 'smurfing_defense' };
}

export function checkBurstCooldown({ recentTimestamps = [], maxOrders = 30, windowSeconds = 60 } = {}) {
  if (!Array.isArray(recentTimestamps) || recentTimestamps.length < maxOrders) {
    return { decision: 'allow', reason: 'burst rate normal', ruleId: 'burst_cooldown' };
  }
  const now = Date.now();
  const recentCount = recentTimestamps.filter((ts) => now - new Date(ts).getTime() < windowSeconds * 1000).length;
  if (recentCount >= maxOrders) {
    return {
      decision: 'deny',
      reason: `burst velocity limit tripped: ${recentCount} orders placed within ${windowSeconds} seconds. Cooldown active.`,
      ruleId: 'burst_cooldown',
    };
  }
  return { decision: 'allow', reason: 'burst velocity within limits', ruleId: 'burst_cooldown' };
}

/**
 * =========================================================================
 * 🔒 LAYER 4: GATEWAY LOCKING & ANTI-TOCTOU (< 0.2ms)
 * =========================================================================
 */

export function computeQuoteHash(items = [], quoteTotal = 0, currency = 'INR') {
  const normalizedItems = (items || []).map((it) => ({
    sku: it.sku,
    qty: it.qty,
    unitPrice: it.unitPrice || 0,
  }));
  const payload = JSON.stringify({ items: normalizedItems, total: quoteTotal, currency });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function verifyQuoteIntegrity(quote, expectedHash) {
  if (!expectedHash) return { valid: true, decision: 'allow', reason: 'no expected hash provided', ruleId: 'quote_hash_integrity' };
  const computed = computeQuoteHash(quote.items, quote.total, quote.currency || 'INR');
  if (computed !== expectedHash) {
    return {
      valid: false,
      decision: 'deny',
      reason: 'anti-tampering failure: quote hash mismatch (possible price/item drift in transit)',
      ruleId: 'quote_hash_integrity',
    };
  }
  return { valid: true, decision: 'allow', reason: 'quote hash verified authentic and untampered', ruleId: 'quote_hash_integrity' };
}

/**
 * =========================================================================
 * 📍 LAYER 5: CONTEXTUAL FENCING (TEMPORAL & GEOLOCATION) (< 0.2ms)
 * =========================================================================
 */

export function checkTemporalBoundaries(merchantCategory = '', currentHour = new Date().getHours()) {
  const isOffHours = currentHour >= 2 && currentHour < 6;
  if (isOffHours) {
    return {
      isOffHours: true,
      decision: 'allow',
      reason: `transaction initiated during off-hours (${currentHour}:00 hrs)`,
      ruleId: 'temporal_boundary',
    };
  }
  return { isOffHours: false, decision: 'allow', reason: 'within normal operating hours', ruleId: 'temporal_boundary' };
}

export function checkDeliveryGeofence({ deliveryPincode = null, allowedPincodes = [] } = {}) {
  if (!deliveryPincode || !Array.isArray(allowedPincodes) || allowedPincodes.length === 0) {
    return { decision: 'allow', reason: 'geofence check bypassed (no pin code restriction)', ruleId: 'geofence_boundary' };
  }
  const cleanPin = String(deliveryPincode).trim();
  if (!allowedPincodes.includes(cleanPin)) {
    return {
      decision: 'pending',
      reason: `delivery pincode "${cleanPin}" does not match user pre-approved address whitelist [${allowedPincodes.join(', ')}]`,
      ruleId: 'geofence_boundary',
    };
  }
  return { decision: 'allow', reason: `delivery pincode "${cleanPin}" verified within geofence`, ruleId: 'geofence_boundary' };
}

/**
 * =========================================================================
 * 🪤 LAYER 6: CANARY HONEYTOKENS & CIRCUIT BREAKERS (< 0.1ms)
 * =========================================================================
 */

export function checkCanarySKUs(items = [], canaryBlacklist = ['test-unrestricted-admin-token', 'canary-exploit-sku', 'honeytoken-root-sku']) {
  if (!Array.isArray(items)) return { decision: 'allow', reason: 'valid items array', ruleId: 'canary_honeytoken' };
  for (const it of items) {
    const sku = (it.sku || '').toLowerCase();
    if (canaryBlacklist.some((c) => sku.includes(c))) {
      return {
        decision: 'deny',
        reason: `tripwire honeytoken detected: SKU "${it.sku}" is a restricted canary token`,
        ruleId: 'canary_honeytoken',
        isCanaryTriggered: true,
      };
    }
  }
  return { decision: 'allow', reason: 'no canary honeytokens triggered', ruleId: 'canary_honeytoken', isCanaryTriggered: false };
}

export function checkCircuitBreaker({ recentDenialCount = 0, threshold = 2 } = {}) {
  if (recentDenialCount >= threshold) {
    return {
      shouldTrip: true,
      decision: 'deny',
      reason: `autonomous circuit breaker tripped: agent recorded ${recentDenialCount} policy violations in past 5 minutes. Auto-revoking agent credential.`,
      ruleId: 'circuit_breaker_tripped',
    };
  }
  return { shouldTrip: false, decision: 'allow', reason: 'circuit breaker healthy', ruleId: 'circuit_breaker' };
}

/**
 * =========================================================================
 * 🎯 COMPOSITE RISK ENGINE & SMART GATING (< 0.5ms)
 * =========================================================================
 */

export function computeTieredRiskScore({
  quoteTotal = 0,
  mandate = {},
  isFirstTimeMerchant = false,
  recentTxCount = 0,
  isOffHours = false,
  maxAllowedBurst = 20,
} = {}) {
  const threshold = mandate.autoApproveThreshold || 50000;
  
  const amountRatio = threshold > 0 ? quoteTotal / threshold : 1;
  const amountWeight = Math.min(40, Math.round(amountRatio * 20));
  const velocityWeight = Math.min(25, Math.round((recentTxCount / maxAllowedBurst) * 25));
  const merchantWeight = isFirstTimeMerchant ? 25 : 0;
  const temporalWeight = isOffHours ? 15 : 0;

  const totalRiskScore = Math.min(100, amountWeight + velocityWeight + merchantWeight + temporalWeight);
  const riskTier = totalRiskScore >= 70 ? 'high' : totalRiskScore >= 35 ? 'medium' : 'low';

  return {
    riskScore: totalRiskScore,
    riskTier,
    breakdown: {
      amountWeight,
      velocityWeight,
      merchantWeight,
      temporalWeight,
    },
  };
}

export function decideGate(mandate, quoteTotal, isFirstTimeMerchant, riskEvaluation = null) {
  const riskScore = typeof riskEvaluation === 'object' && riskEvaluation !== null ? riskEvaluation.riskScore : (typeof riskEvaluation === 'number' ? riskEvaluation : null);

  if (isFirstTimeMerchant) {
    return { decision: 'pending', reason: 'first transaction with this merchant requires human approval', ruleId: 'gate_first_time', riskScore: riskScore || 30 };
  }
  if (quoteTotal > mandate.autoApproveThreshold) {
    return { decision: 'pending', reason: `quote ₹${quoteTotal / 100} exceeds auto-approve threshold ₹${mandate.autoApproveThreshold / 100}`, ruleId: 'gate_threshold', riskScore: riskScore || 45 };
  }

  return { decision: 'allow', reason: 'within auto-approve threshold', ruleId: 'gate_threshold', riskScore: riskScore || 15 };
}

export function checkDiscountCeiling(originalTotal, discountPaise, maxDiscountPercent = 20) {
  if (!discountPaise || discountPaise <= 0) {
    return { decision: 'allow', reason: 'no discount requested', ruleId: 'discount_ceiling' };
  }
  const maxAllowedDiscount = Math.floor((originalTotal * maxDiscountPercent) / 100);
  if (discountPaise > maxAllowedDiscount) {
    return {
      decision: 'deny',
      reason: `discount ₹${discountPaise / 100} exceeds maximum authorized campaign discount cap of ${maxDiscountPercent}% (₹${maxAllowedDiscount / 100})`,
      ruleId: 'discount_ceiling',
    };
  }
  return { decision: 'allow', reason: 'discount within authorized campaign ceiling', ruleId: 'discount_ceiling' };
}