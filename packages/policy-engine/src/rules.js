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

export function decideGate(mandate, quoteTotal, isFirstTimeMerchant) {
  if (isFirstTimeMerchant) {
    return { decision: 'pending', reason: 'first transaction with this merchant requires human approval', ruleId: 'gate_first_time' };
  }
  if (quoteTotal > mandate.autoApproveThreshold) {
    return { decision: 'pending', reason: `quote ₹${quoteTotal / 100} exceeds auto-approve threshold ₹${mandate.autoApproveThreshold / 100}`, ruleId: 'gate_threshold' };
  }
  return { decision: 'allow', reason: 'within auto-approve threshold', ruleId: 'gate_threshold' };
}