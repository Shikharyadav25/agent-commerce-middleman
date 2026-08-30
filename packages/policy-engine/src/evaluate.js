import { checkAgentValid, checkMandateCoverage, checkPerTransactionCap, checkDailyCap, decideGate } from './rules.js';

// writeAuditRow is passed in so this package stays framework-agnostic (no direct DB import)
export async function evaluateTransaction({ agent, mandate, merchantId, category, quoteTotal, todaysCumulativeSpend, isFirstTimeMerchant, correlationId, writeAuditRow }) {
  const checks = [
    checkAgentValid(agent),
    checkMandateCoverage(mandate, merchantId, category),
    checkPerTransactionCap(mandate, quoteTotal),
    checkDailyCap(mandate, todaysCumulativeSpend, quoteTotal),
  ];

  for (const check of checks) {
    await writeAuditRow({ correlationId, step: 'policy_check', decision: check.decision, reason: check.reason, ruleId: check.ruleId, actor: 'system' });
    if (check.decision === 'deny') {
      return { finalDecision: 'deny', reason: check.reason, ruleId: check.ruleId };
    }
  }

  const gate = decideGate(mandate, quoteTotal, isFirstTimeMerchant);
  await writeAuditRow({ correlationId, step: 'gate_decision', decision: gate.decision, reason: gate.reason, ruleId: gate.ruleId, actor: 'system' });

  return { finalDecision: gate.decision, reason: gate.reason, ruleId: gate.ruleId };
}