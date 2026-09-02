import { performance } from 'perf_hooks';
import {
  checkAgentValid,
  checkCanarySKUs,
  checkRateAndVelocity,
  checkMandateCoverage,
  checkPerTransactionCap,
  checkDailyCap,
  checkSemanticCartInvariance,
  checkPriceDrift,
  checkSmurfing,
  checkBurstCooldown,
  computeQuoteHash,
  verifyQuoteIntegrity,
  checkTemporalBoundaries,
  checkDeliveryGeofence,
  checkCircuitBreaker,
  computeTieredRiskScore,
  decideGate,
} from './rules.js';
import { verifyUserIntentProof } from './mandate.js';
import { selectTransactionSecurityLane, LANES } from './adaptive.js';

// writeAuditRow is passed in so this package stays framework-agnostic (no direct DB import)
export async function evaluateTransaction({
  agent,
  mandate,
  merchantId,
  category,
  quoteTotal,
  todaysCumulativeSpend = 0,
  isFirstTimeMerchant = false,
  items = [],
  catalogPriceMap = {},
  recentTransactions = [],
  recentTimestamps = [],
  recentDenialCount = 0,
  paidTransactionCount = 0,
  forceDeepInspection = false,
  probabilisticSampleRate = 0.05,
  deliveryPincode = null,
  allowedPincodes = [],
  proofOfAuthority = null,
  userIntentPrompt = null,
  expectedQuoteHash = null,
  correlationId,
  writeAuditRow = async () => {},
}) {
  const startTime = performance.now();

  // 1. Compute Quote Hash for Deterministic Razorpay Gateway Pinning
  const quoteHash = computeQuoteHash(items, quoteTotal);

  // 2. Stage 1: In-Memory Fast-Fail & Circuit Breakers (< 0.2ms)
  const circuitCheck = checkCircuitBreaker({ recentDenialCount, threshold: 50 });
  if (circuitCheck.shouldTrip) {
    const elapsed = parseFloat((performance.now() - startTime).toFixed(2));
    await writeAuditRow({
      correlationId,
      step: 'circuit_breaker',
      decision: 'deny',
      reason: circuitCheck.reason,
      ruleId: circuitCheck.ruleId,
      actor: 'system',
    });
    return {
      finalDecision: 'deny',
      reason: circuitCheck.reason,
      ruleId: circuitCheck.ruleId,
      riskScore: 100,
      riskTier: 'high',
      quoteHash,
      latencyMs: elapsed,
      shouldRevokeAgent: true,
      lane: LANES.DEEP_INSPECTION_LANE,
      trustScore: 0,
      isSampled: false,
    };
  }

  // 3. Adaptive Security Tiers & Lane Selection (Express Lane vs Deep Inspection)
  const laneSelection = selectTransactionSecurityLane({
    agent,
    quoteTotal,
    category,
    merchantId,
    mandate,
    paidTransactionCount,
    recentDenialCount,
    forceDeepInspection,
    probabilisticSampleRate,
  });

  const { lane, trustScore, isSampled } = laneSelection;

  // FAST-TRACK HIGHWAY: Express Lane (< 0.1ms) for routine trusted purchases
  if (lane === LANES.EXPRESS_LANE) {
    const expressSanityChecks = [
      checkAgentValid(agent),
      checkCanarySKUs(items),
      checkPerTransactionCap(mandate, quoteTotal),
      checkDailyCap(mandate, todaysCumulativeSpend, quoteTotal),
      checkMandateCoverage(mandate, merchantId, category),
    ];

    let expressFailed = null;
    for (const check of expressSanityChecks) {
      await writeAuditRow({
        correlationId,
        step: 'policy_check',
        decision: check.decision,
        reason: check.reason,
        ruleId: check.ruleId,
        actor: 'system',
      });

      if (check.decision === 'deny') {
        expressFailed = check;
        const elapsed = parseFloat((performance.now() - startTime).toFixed(2));
        return {
          finalDecision: 'deny',
          reason: check.reason,
          ruleId: check.ruleId,
          riskScore: 100,
          riskTier: 'high',
          quoteHash,
          latencyMs: elapsed,
          lane: LANES.EXPRESS_LANE,
          trustScore,
          isSampled: false,
          isCanaryTriggered: check.isCanaryTriggered || false,
        };
      }
    }

    const elapsed = parseFloat((performance.now() - startTime).toFixed(2));
    await writeAuditRow({
      correlationId,
      step: 'express_lane_clearance',
      decision: 'allow',
      reason: `${laneSelection.reason} [Trust: ${trustScore}/100, Latency: ${elapsed}ms]`,
      ruleId: 'express_highway',
      actor: 'system',
    });
    return {
      finalDecision: 'allow',
      reason: laneSelection.reason,
      ruleId: 'express_highway',
      riskScore: 5,
      riskTier: 'low',
      quoteHash,
      latencyMs: elapsed,
      lane: LANES.EXPRESS_LANE,
      trustScore,
      isSampled: false,
    };
  }

  const stage1Checks = [
    checkAgentValid(agent),
    checkCanarySKUs(items),
    checkRateAndVelocity(recentTransactions.length, 50, 'last 10 minutes'),
    checkBurstCooldown({ recentTimestamps, maxOrders: 30, windowSeconds: 60 }),
    checkMandateCoverage(mandate, merchantId, category),
    checkPerTransactionCap(mandate, quoteTotal),
    checkDailyCap(mandate, todaysCumulativeSpend, quoteTotal),
  ];

  for (const check of stage1Checks) {
    await writeAuditRow({
      correlationId,
      step: 'policy_check',
      decision: check.decision,
      reason: check.reason,
      ruleId: check.ruleId,
      actor: 'system',
    });

    if (check.decision === 'deny') {
      const elapsed = parseFloat((performance.now() - startTime).toFixed(2));
      return {
        finalDecision: 'deny',
        reason: check.reason,
        ruleId: check.ruleId,
        riskScore: 100,
        riskTier: 'high',
        quoteHash,
        latencyMs: elapsed,
        isCanaryTriggered: check.isCanaryTriggered || false,
      };
    }
  }

  // 3. Stage 2: Proof of Authority (AP2) & Anti-TOCTOU Integrity (< 0.5ms)
  if (proofOfAuthority) {
    const poaCheck = verifyUserIntentProof(proofOfAuthority, { quoteTotal, merchantId });
    await writeAuditRow({
      correlationId,
      step: 'proof_of_authority',
      decision: poaCheck.decision,
      reason: poaCheck.reason,
      ruleId: poaCheck.ruleId,
      actor: 'system',
    });

    if (poaCheck.decision === 'deny') {
      const elapsed = parseFloat((performance.now() - startTime).toFixed(2));
      return {
        finalDecision: 'deny',
        reason: poaCheck.reason,
        ruleId: poaCheck.ruleId,
        riskScore: 100,
        riskTier: 'high',
        quoteHash,
        latencyMs: elapsed,
      };
    }
  }

  if (expectedQuoteHash) {
    const integrityCheck = verifyQuoteIntegrity({ items, total: quoteTotal }, expectedQuoteHash);
    await writeAuditRow({
      correlationId,
      step: 'integrity_check',
      decision: integrityCheck.decision,
      reason: integrityCheck.reason,
      ruleId: integrityCheck.ruleId,
      actor: 'system',
    });

    if (integrityCheck.decision === 'deny') {
      const elapsed = parseFloat((performance.now() - startTime).toFixed(2));
      return {
        finalDecision: 'deny',
        reason: integrityCheck.reason,
        ruleId: integrityCheck.ruleId,
        riskScore: 100,
        riskTier: 'high',
        quoteHash,
        latencyMs: elapsed,
      };
    }
  }

  // 4. Stage 3: Semantic Cart Invariance & Contextual Fencing (< 0.5ms)
  const semanticCheck = checkSemanticCartInvariance({ intentText: userIntentPrompt, items });
  if (semanticCheck.decision === 'deny') {
    const elapsed = parseFloat((performance.now() - startTime).toFixed(2));
    await writeAuditRow({
      correlationId,
      step: 'semantic_invariance',
      decision: 'deny',
      reason: semanticCheck.reason,
      ruleId: semanticCheck.ruleId,
      actor: 'system',
    });
    return {
      finalDecision: 'deny',
      reason: semanticCheck.reason,
      ruleId: semanticCheck.ruleId,
      riskScore: 100,
      riskTier: 'high',
      quoteHash,
      latencyMs: elapsed,
    };
  }

  const priceDriftCheck = checkPriceDrift(items, catalogPriceMap, 15);
  const smurfingCheck = checkSmurfing({ recentTransactions, autoApproveThreshold: mandate.autoApproveThreshold, minClusterSize: 3 });
  const geofenceCheck = checkDeliveryGeofence({ deliveryPincode, allowedPincodes });
  const temporalCheck = checkTemporalBoundaries(category);

  // 5. Stage 4: Composite Risk Engine & Smart Gating (< 0.5ms)
  const riskEval = computeTieredRiskScore({
    quoteTotal,
    mandate,
    isFirstTimeMerchant,
    recentTxCount: recentTransactions.length,
    isOffHours: temporalCheck.isOffHours,
    maxAllowedBurst: 20,
  });

  // Escalate to human review if secondary anomaly checks flagged
  let gateReasonOverride = null;
  let gateRuleOverride = null;

  if (semanticCheck.decision === 'pending') {
    gateReasonOverride = semanticCheck.reason;
    gateRuleOverride = semanticCheck.ruleId;
  } else if (smurfingCheck.decision === 'pending') {
    gateReasonOverride = smurfingCheck.reason;
    gateRuleOverride = smurfingCheck.ruleId;
  } else if (priceDriftCheck.decision === 'pending') {
    gateReasonOverride = priceDriftCheck.reason;
    gateRuleOverride = priceDriftCheck.ruleId;
  } else if (geofenceCheck.decision === 'pending') {
    gateReasonOverride = geofenceCheck.reason;
    gateRuleOverride = geofenceCheck.ruleId;
  }

  const standardGate = decideGate(mandate, quoteTotal, isFirstTimeMerchant, riskEval);
  const finalGateDecision = gateReasonOverride ? 'pending' : standardGate.decision;
  const finalGateReason = gateReasonOverride || standardGate.reason;
  const finalGateRule = gateRuleOverride || standardGate.ruleId;

  const elapsed = parseFloat((performance.now() - startTime).toFixed(2));

  await writeAuditRow({
    correlationId,
    step: 'gate_decision',
    decision: finalGateDecision,
    reason: `${finalGateReason} [Risk: ${riskEval.riskScore}/100, Latency: ${elapsed}ms]`,
    ruleId: finalGateRule,
    actor: 'system',
  });

  return {
    finalDecision: finalGateDecision,
    reason: finalGateReason,
    ruleId: finalGateRule,
    riskScore: riskEval.riskScore,
    riskTier: riskEval.riskTier,
    quoteHash,
    latencyMs: elapsed,
    lane,
    trustScore,
    isSampled,
  };
}