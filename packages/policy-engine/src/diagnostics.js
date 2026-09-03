/**
 * NLP Diagnostic, Self-Correction & Forensic Incident Engine
 * Translates deterministic policy violations, hallucinations, and adversarial telemetry
 * into machine-actionable instructions for paying agents and plain-English briefs for operators.
 */

export const ISSUE_TYPES = {
  HALLUCINATION: 'HALLUCINATION',
  MALICIOUS_ADVERSARIAL: 'MALICIOUS_ADVERSARIAL',
  POLICY_VIOLATION: 'POLICY_VIOLATION',
  OPERATIONAL_TECHNICAL: 'OPERATIONAL_TECHNICAL',
};

export const SEVERITY_LEVELS = {
  CRITICAL_THREAT: 'CRITICAL_THREAT',
  HIGH_RISK: 'HIGH_RISK',
  MODERATE_WARNING: 'MODERATE_WARNING',
  INFORMATIONAL: 'INFORMATIONAL',
};

/**
 * Classifies the root cause of an in-flight transaction issue.
 */
export function classifyIssueType(ruleId, decision, context = {}) {
  const r = (ruleId || '').toLowerCase();
  const reason = (context.reason || '').toLowerCase();

  // 1. Malicious or Adversarial Threats
  if (
    r.includes('canary') ||
    r.includes('honeytoken') ||
    context.isCanaryTriggered ||
    reason.includes('honeytoken') ||
    reason.includes('restricted canary')
  ) {
    return { type: ISSUE_TYPES.MALICIOUS_ADVERSARIAL, severity: SEVERITY_LEVELS.CRITICAL_THREAT };
  }

  if (
    r.includes('smurfing') ||
    reason.includes('smurfing') ||
    reason.includes('structuring')
  ) {
    return { type: ISSUE_TYPES.MALICIOUS_ADVERSARIAL, severity: SEVERITY_LEVELS.HIGH_RISK };
  }

  if (
    r.includes('disallowed_category') ||
    reason.includes('restricted high-risk category') ||
    reason.includes('gift cards, crypto')
  ) {
    return { type: ISSUE_TYPES.MALICIOUS_ADVERSARIAL, severity: SEVERITY_LEVELS.HIGH_RISK };
  }

  if (
    r.includes('burst_cooldown') ||
    r.includes('circuit_breaker') ||
    reason.includes('burst velocity') ||
    reason.includes('circuit breaker tripped')
  ) {
    return { type: ISSUE_TYPES.MALICIOUS_ADVERSARIAL, severity: SEVERITY_LEVELS.HIGH_RISK };
  }

  if (r.includes('quote_hash') || reason.includes('tampering') || reason.includes('hash mismatch')) {
    return { type: ISSUE_TYPES.MALICIOUS_ADVERSARIAL, severity: SEVERITY_LEVELS.HIGH_RISK };
  }

  // 2. Hallucinations & Autonomous Agent Drift
  if (
    r.includes('semantic_intent_drift') ||
    reason.includes('semantic intent drift') ||
    reason.includes('do not correlate with user prompt')
  ) {
    return { type: ISSUE_TYPES.HALLUCINATION, severity: SEVERITY_LEVELS.HIGH_RISK };
  }

  if (
    r.includes('price_drift') ||
    reason.includes('price drift')
  ) {
    return { type: ISSUE_TYPES.HALLUCINATION, severity: SEVERITY_LEVELS.MODERATE_WARNING };
  }

  if (
    r.includes('geofence') ||
    reason.includes('geofence') ||
    reason.includes('pincode')
  ) {
    return { type: ISSUE_TYPES.HALLUCINATION, severity: SEVERITY_LEVELS.MODERATE_WARNING };
  }

  if (r.includes('temporal') || reason.includes('off-hours')) {
    return { type: ISSUE_TYPES.HALLUCINATION, severity: SEVERITY_LEVELS.MODERATE_WARNING };
  }

  // Check if over-budget was caused by prompt hallucination (e.g. user asked for ₹500, agent carted ₹1,500)
  if (context.userIntentPrompt && (r.includes('per_txn_cap') || r.includes('gate_threshold'))) {
    const numbersInPrompt = context.userIntentPrompt.match(/(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]+)?)/gi);
    if (numbersInPrompt && numbersInPrompt.length > 0) {
      const parsedPromptValue = parseInt(numbersInPrompt[0].replace(/[^0-9]/g, ''), 10);
      if (parsedPromptValue && context.quoteTotal && context.quoteTotal / 100 > parsedPromptValue * 1.3) {
        return { type: ISSUE_TYPES.HALLUCINATION, severity: SEVERITY_LEVELS.MODERATE_WARNING };
      }
    }
  }

  // 3. Operational or Technical Issues
  if (
    reason.includes('expired') ||
    reason.includes('already been processed') ||
    reason.includes('timeout') ||
    reason.includes('network')
  ) {
    return { type: ISSUE_TYPES.OPERATIONAL_TECHNICAL, severity: SEVERITY_LEVELS.INFORMATIONAL };
  }

  // 4. Standard Policy Violations
  return { type: ISSUE_TYPES.POLICY_VIOLATION, severity: SEVERITY_LEVELS.MODERATE_WARNING };
}

/**
 * Generates an actionable NLP Diagnostic Report for an autonomous agent and operator.
 */
export function generateNLPDiagnosticReport({
  ruleId,
  decision,
  reason,
  quoteTotal,
  items = [],
  userIntentPrompt = null,
  mandate = {},
  agent = {},
  deliveryPincode = null,
  allowedPincodes = [],
  riskScore = 0,
  latencyMs = 0,
} = {}) {
  const { type: issueType, severity } = classifyIssueType(ruleId, decision, {
    reason,
    quoteTotal,
    userIntentPrompt,
    isCanaryTriggered: ruleId === 'canary_honeytoken',
  });

  const formattedTotal = quoteTotal ? `₹${(quoteTotal / 100).toFixed(2)}` : 'N/A';
  const autoApproveLimit = mandate?.autoApproveThreshold
    ? `₹${(mandate.autoApproveThreshold / 100).toFixed(2)}`
    : 'N/A';
  const perTxnLimit = mandate?.maxPerTransaction
    ? `₹${(mandate.maxPerTransaction / 100).toFixed(2)}`
    : 'N/A';

  let forensicSummary = '';
  let failureCause = reason || 'Transaction policy check failed';
  let agentActionableInstructions = '';
  let suggestedRemediation = null;
  let safetyWarning = null;

  switch (issueType) {
    case ISSUE_TYPES.MALICIOUS_ADVERSARIAL: {
      if (ruleId === 'canary_honeytoken' || reason?.includes('honeytoken')) {
        forensicSummary = `Critical Security Alert: Agent "${agent.name || 'External Agent'}" attempted to purchase a restricted canary honeytoken SKU. This pattern indicates unauthorized catalog reconnaissance, jailbreak testing, or prompt injection exploitation.`;
        agentActionableInstructions = `HALT EXECUTION IMMEDIATELY. Do not retry or probe internal/canary SKUs. The agent's authorization credential has been auto-revoked by ACM's autonomous circuit breaker.`;
        safetyWarning = `Agent credential auto-revoked (revoked: true). Operator must manually re-authorize this agent.`;
        suggestedRemediation = { action: 'quarantine', agentRevoked: true };
      } else if (ruleId === 'disallowed_category_blacklist' || reason?.includes('restricted high-risk category')) {
        forensicSummary = `Autonomous Policy Violation: The agent's cart contains items belonging to a high-risk prohibited category (gift cards, cryptocurrency, or prepaid vouchers). These categories are strictly barred from autonomous agent checkout.`;
        agentActionableInstructions = `Remove any gift cards, vouchers, or crypto items from your cart. You may only purchase merchandise and services explicitly permitted by the user's spending mandate.`;
        safetyWarning = `Attempting to circumvent category blacklists will result in agent credential suspension.`;
        suggestedRemediation = {
          action: 'modify_cart',
          disallowedItems: items.filter((i) => (i.category || '').match(/giftcard|crypto|prepaid|voucher/i)).map((i) => i.sku),
          allowedAlternativeCategories: mandate.allowedCategories || ['grocery.staples', 'consumer.tech', 'entertainment.movies'],
        };
      } else if (ruleId === 'smurfing_structuring_detected' || reason?.includes('smurfing')) {
        forensicSummary = `Anti-Smurfing Structuring Detected: Multiple orders were observed clustering right below the ₹${(mandate.autoApproveThreshold || 50000) / 100} auto-approval threshold in rapid succession. This pattern resembles intentional threshold evasion.`;
        agentActionableInstructions = `Do not attempt to fragment purchases into small consecutive orders to evade threshold limits. Consolidate your order into a single transaction and submit for operator approval.`;
        safetyWarning = `Automated batch clustering trips rate limits and escalates all transactions to human review.`;
        suggestedRemediation = { action: 'consolidate_orders', maxSingleBatchTotal: perTxnLimit };
      } else if (ruleId === 'burst_cooldown' || ruleId === 'circuit_breaker_tripped') {
        forensicSummary = `Runaway Loop Suppression: Agent "${agent.name || 'AI Agent'}" initiated rapid consecutive transactions exceeding the burst velocity ceiling. Circuit breaker triggered to prevent wallet depletion.`;
        agentActionableInstructions = `Enter backoff cooldown. Pause execution for at least 120 seconds. Check your while-loop or retry logic to prevent runaway duplicate API calls.`;
        safetyWarning = `Autonomous circuit breaker active. Repeated trips will trigger credential revocation.`;
        suggestedRemediation = { action: 'cooldown', waitSeconds: 120 };
      } else {
        forensicSummary = `Security Integrity Alert: Transaction rejected due to cryptographic or anti-tampering failure (${reason}).`;
        agentActionableInstructions = `Ensure quote hashes and HMAC signatures are computed honestly and that cart payloads are not modified after quote generation.`;
        suggestedRemediation = { action: 'regenerate_quote' };
      }
      break;
    }

    case ISSUE_TYPES.HALLUCINATION: {
      if (ruleId === 'semantic_intent_drift' || reason?.includes('semantic intent drift')) {
        forensicSummary = `Semantic Drift Warning: The agent attempted to purchase items (${items.map((i) => i.sku).join(', ')}) that have zero semantic keyword overlap with the user's prompt: "${userIntentPrompt || 'N/A'}". This indicates hallucination or prompt hijacking.`;
        agentActionableInstructions = `Cross-reference your cart against the user's original request "${userIntentPrompt || ''}". Discard unrelated items and query the catalog for items matching the user's explicit keywords.`;
        suggestedRemediation = {
          action: 'realign_intent',
          userPrompt: userIntentPrompt,
          flaggedItems: items.map((i) => i.sku),
        };
      } else if (ruleId === 'price_drift_detected') {
        forensicSummary = `Pricing Anomaly: One or more items in the quote have deviated significantly from baseline catalog pricing.`;
        agentActionableInstructions = `Refresh product catalog quotes to get updated merchant prices. Do not proceed with stale or skewed unit prices.`;
        suggestedRemediation = { action: 'refresh_catalog_prices' };
      } else if (ruleId === 'geofence_boundary' || reason?.includes('pincode')) {
        forensicSummary = `Geographic Fencing Restriction: Delivery pin code "${deliveryPincode}" is outside the user's pre-approved whitelist (${allowedPincodes.join(', ') || 'configured locations'}).`;
        agentActionableInstructions = `Confirm the delivery pin code with the user. Update the delivery address to one of the authorized pin codes: ${allowedPincodes.join(', ')}.`;
        suggestedRemediation = {
          action: 'update_delivery_address',
          allowedPincodes,
          currentPincode: deliveryPincode,
        };
      } else {
        forensicSummary = `Agent Intent Drift: The transaction parameters diverged from normal user instructions or operational windows (${reason}).`;
        agentActionableInstructions = `Review transaction timing and parameters before re-submitting.`;
        suggestedRemediation = { action: 'review_parameters' };
      }
      break;
    }

    case ISSUE_TYPES.POLICY_VIOLATION: {
      if (ruleId === 'per_txn_cap') {
        forensicSummary = `Budget Cap Exceeded: Quote total of ${formattedTotal} exceeds the agent's authorized per-transaction cap of ${perTxnLimit}.`;
        const excess = quoteTotal && mandate?.maxPerTransaction ? (quoteTotal - mandate.maxPerTransaction) / 100 : 0;
        agentActionableInstructions = `Reduce order quantity or choose a lower-priced alternative. The order exceeds the per-transaction limit by ₹${excess.toFixed(2)}. Alternatively, request human operator sign-off.`;
        
        // Calculate safe quantity if single item
        let safeQty = null;
        let suggestedTotalPaise = mandate?.maxPerTransaction || quoteTotal;
        if (items.length === 1 && items[0].unitPrice) {
          safeQty = Math.max(1, Math.floor(mandate.maxPerTransaction / items[0].unitPrice));
          suggestedTotalPaise = safeQty * items[0].unitPrice;
        }

        suggestedRemediation = {
          action: 'adjust_quantity_or_items',
          maxPermittedTotal: perTxnLimit,
          ...(safeQty !== null ? { suggestedQuantity: safeQty } : {}),
          suggestedTotalPaise,
        };
      } else if (ruleId === 'daily_cap') {
        forensicSummary = `Daily Budget Ceiling Reached: This purchase would exceed the agent's rolling 24-hour spending limit.`;
        agentActionableInstructions = `The daily spending cap has been reached. Wait until the 24-hour cycle resets or request an operator to increase your daily cap.`;
        suggestedRemediation = { action: 'wait_for_daily_reset', dailyLimit: `₹${(mandate.dailyCap || 0) / 100}` };
      } else if (ruleId === 'gate_threshold' && decision === 'pending') {
        forensicSummary = `Autonomous Threshold Safeguard: Total order of ${formattedTotal} is valid but exceeds the automatic checkout threshold (${autoApproveLimit}). Transaction held for human one-click sign-off.`;
        agentActionableInstructions = `Transaction held for human review. Advise the user that approval is pending on their ACM Operator Dashboard. If autonomous checkout is preferred, reduce the order total to under ${autoApproveLimit}.`;
        suggestedRemediation = {
          action: 'await_human_approval',
          autoApproveThreshold: autoApproveLimit,
          targetTotalToBypassHumanReview: Math.max(0, (mandate.autoApproveThreshold || 0) - 100),
        };
      } else if (ruleId === 'gate_first_time') {
        forensicSummary = `First-Time Merchant Safeguard: This is the first autonomous transaction with merchant "${mandate.merchantId || 'Merchant'}". Held for one-time operator verification.`;
        agentActionableInstructions = `First-time transactions require a one-time operator approval for security. No modification needed; wait for human confirmation.`;
        suggestedRemediation = { action: 'await_human_approval' };
      } else {
        forensicSummary = `Policy Constraint: Transaction does not satisfy merchant or category constraints (${reason}).`;
        agentActionableInstructions = `Verify that the product category is authorized in your mandate.`;
        suggestedRemediation = { action: 'check_mandate_scope' };
      }
      break;
    }

    case ISSUE_TYPES.OPERATIONAL_TECHNICAL:
    default: {
      forensicSummary = `Operational Status: ${reason || 'Technical processing constraint encountered.'}`;
      agentActionableInstructions = `Generate a fresh quote and re-attempt checkout. Ensure network connectivity to the ACM gateway.`;
      suggestedRemediation = { action: 'refresh_quote' };
      break;
    }
  }

  return {
    status: decision === 'deny' ? 'denied' : decision === 'pending' ? 'awaiting_human_approval' : 'flagged',
    issueType,
    severity,
    failureCause,
    forensicSummary,
    agentActionableInstructions,
    suggestedRemediation,
    safetyWarning,
    requiresHumanApproval: decision === 'pending',
    diagnosticsMeta: {
      ruleId,
      riskScore,
      latencyMs,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Synthesizes a chronological sequence of audit log steps into an executive forensic narrative.
 */
export function generateIncidentForensicBrief(auditLogs = [], transaction = {}) {
  if (!Array.isArray(auditLogs) || auditLogs.length === 0) {
    return {
      executiveSummary: 'No audit records available for this transaction.',
      verdict: 'UNKNOWN',
      keyThreatIndicators: [],
    };
  }

  const deniedSteps = auditLogs.filter((l) => l.decision === 'deny');
  const pendingSteps = auditLogs.filter((l) => l.decision === 'pending');
  const allowSteps = auditLogs.filter((l) => l.decision === 'allow');

  const primaryCulprit = deniedSteps[0] || pendingSteps[0] || auditLogs[auditLogs.length - 1];
  const culpritRule = primaryCulprit?.ruleId || 'policy_engine';

  const classification = classifyIssueType(culpritRule, primaryCulprit?.decision, {
    reason: primaryCulprit?.reason,
    quoteTotal: transaction?.quote?.total,
  });

  const threatIndicators = [];
  for (const log of auditLogs) {
    if (log.decision === 'deny') {
      threatIndicators.push(`Denied at ${log.step}: ${log.reason}`);
    } else if (log.decision === 'pending') {
      threatIndicators.push(`Gated at ${log.step}: ${log.reason}`);
    }
  }

  let verdict = 'CLEARED';
  if (deniedSteps.length > 0) verdict = 'DENIED_POLICY_VIOLATION';
  if (classification.type === ISSUE_TYPES.MALICIOUS_ADVERSARIAL) verdict = 'SECURITY_THREAT_BLOCKED';
  if (pendingSteps.length > 0 && deniedSteps.length === 0) verdict = 'HELD_FOR_OPERATOR_APPROVAL';

  const totalPaise = transaction?.quote?.total;
  const formattedTotal = totalPaise ? `₹${(totalPaise / 100).toFixed(2)}` : 'the order';

  const executiveSummary =
    deniedSteps.length > 0
      ? `Transaction for ${formattedTotal} was blocked by in-flight safety rule [${culpritRule}]. Root cause: ${primaryCulprit.reason}. Issue classified as ${classification.type} (${classification.severity}).`
      : pendingSteps.length > 0
      ? `Transaction for ${formattedTotal} completed deterministic safety checks with status PENDING. Held by rule [${culpritRule}] for human sign-off. Reason: ${primaryCulprit.reason}.`
      : `Transaction successfully cleared all ${allowSteps.length} in-flight safety guardrails and generated a Razorpay payment link.`;

  return {
    verdict,
    issueType: classification.type,
    severity: classification.severity,
    executiveSummary,
    primaryReason: primaryCulprit?.reason || 'Verified safe',
    culpritRule,
    keyThreatIndicators: threatIndicators,
    stepsEvaluated: auditLogs.length,
    timestamp: new Date().toISOString(),
  };
}
