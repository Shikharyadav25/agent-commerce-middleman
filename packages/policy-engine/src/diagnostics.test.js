import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIssueType,
  generateNLPDiagnosticReport,
  generateIncidentForensicBrief,
  ISSUE_TYPES,
  SEVERITY_LEVELS,
} from './diagnostics.js';

test('Diagnostics: classifies canary honeypot probe as malicious critical threat', () => {
  const classification = classifyIssueType('canary_honeytoken', 'deny', {
    isCanaryTriggered: true,
    reason: 'tripwire honeytoken detected: SKU "canary-exploit-sku" is a restricted canary token',
  });

  assert.equal(classification.type, ISSUE_TYPES.MALICIOUS_ADVERSARIAL);
  assert.equal(classification.severity, SEVERITY_LEVELS.CRITICAL_THREAT);

  const report = generateNLPDiagnosticReport({
    ruleId: 'canary_honeytoken',
    decision: 'deny',
    reason: 'tripwire honeytoken detected: SKU "canary-exploit-sku"',
    agent: { name: 'ReconAgent-99' },
  });

  assert.equal(report.issueType, ISSUE_TYPES.MALICIOUS_ADVERSARIAL);
  assert.equal(report.severity, SEVERITY_LEVELS.CRITICAL_THREAT);
  assert.match(report.forensicSummary, /Critical Security Alert/);
  assert.match(report.agentActionableInstructions, /HALT EXECUTION IMMEDIATELY/);
  assert.equal(report.suggestedRemediation?.agentRevoked, true);
});

test('Diagnostics: classifies semantic intent drift as hallucination with remediation', () => {
  const classification = classifyIssueType('semantic_intent_drift', 'pending', {
    reason: 'semantic intent drift detected: cart items do not correlate with user prompt "buy milk and bread"',
  });

  assert.equal(classification.type, ISSUE_TYPES.HALLUCINATION);
  assert.equal(classification.severity, SEVERITY_LEVELS.HIGH_RISK);

  const report = generateNLPDiagnosticReport({
    ruleId: 'semantic_intent_drift',
    decision: 'pending',
    reason: 'semantic intent drift detected: cart items do not correlate with user prompt "buy milk and bread"',
    userIntentPrompt: 'buy milk and bread',
    items: [{ sku: 'drone-quadcopter-v2', qty: 1 }],
    quoteTotal: 1500000,
  });

  assert.equal(report.issueType, ISSUE_TYPES.HALLUCINATION);
  assert.match(report.forensicSummary, /Semantic Drift Warning/);
  assert.match(report.agentActionableInstructions, /Cross-reference your cart against the user's original request/);
  assert.equal(report.suggestedRemediation?.action, 'realign_intent');
  assert.equal(report.suggestedRemediation?.userPrompt, 'buy milk and bread');
});

test('Diagnostics: classifies anti-smurfing structuring clusters with remediation', () => {
  const classification = classifyIssueType('smurfing_structuring_detected', 'pending', {
    reason: 'anti-smurfing structuring detected: 3 transactions clustered between ₹440 and ₹500',
  });

  assert.equal(classification.type, ISSUE_TYPES.MALICIOUS_ADVERSARIAL);
  assert.equal(classification.severity, SEVERITY_LEVELS.HIGH_RISK);

  const report = generateNLPDiagnosticReport({
    ruleId: 'smurfing_structuring_detected',
    decision: 'pending',
    reason: 'anti-smurfing structuring detected: 3 transactions clustered between ₹440 and ₹500',
    mandate: { autoApproveThreshold: 50000, maxPerTransaction: 100000 },
  });

  assert.equal(report.issueType, ISSUE_TYPES.MALICIOUS_ADVERSARIAL);
  assert.match(report.forensicSummary, /Anti-Smurfing Structuring Detected/);
  assert.match(report.agentActionableInstructions, /Do not attempt to fragment purchases/);
  assert.equal(report.suggestedRemediation?.action, 'consolidate_orders');
});

test('Diagnostics: provides safe adjusted quantity calculation on per-transaction cap exceed', () => {
  const report = generateNLPDiagnosticReport({
    ruleId: 'per_txn_cap',
    decision: 'deny',
    reason: 'quote ₹1,500 exceeds per-transaction cap ₹1,000',
    quoteTotal: 150000, // ₹1,500
    items: [{ sku: 'pvr-imax-ticket', unitPrice: 50000, qty: 3 }],
    mandate: { maxPerTransaction: 100000, autoApproveThreshold: 50000 }, // ₹1,000 cap
  });

  assert.equal(report.issueType, ISSUE_TYPES.POLICY_VIOLATION);
  assert.match(report.forensicSummary, /Budget Cap Exceeded/);
  assert.match(report.agentActionableInstructions, /Reduce order quantity/);
  assert.equal(report.suggestedRemediation?.action, 'adjust_quantity_or_items');
  assert.equal(report.suggestedRemediation?.suggestedQuantity, 2); // 100000 / 50000 = 2
});

test('Diagnostics: generates executive incident forensic brief from audit log history', () => {
  const auditLogs = [
    { step: 'circuit_breaker', decision: 'allow', reason: 'circuit breaker healthy', ruleId: 'circuit_breaker' },
    { step: 'policy_check', decision: 'allow', reason: 'agent credential is valid', ruleId: 'agent_valid' },
    {
      step: 'policy_check',
      decision: 'deny',
      reason: 'tripwire honeytoken detected: SKU "canary-exploit-sku" is a restricted canary token',
      ruleId: 'canary_honeytoken',
    },
  ];

  const brief = generateIncidentForensicBrief(auditLogs, { quote: { total: 9900 } });

  assert.equal(brief.verdict, 'SECURITY_THREAT_BLOCKED');
  assert.equal(brief.issueType, ISSUE_TYPES.MALICIOUS_ADVERSARIAL);
  assert.equal(brief.severity, SEVERITY_LEVELS.CRITICAL_THREAT);
  assert.match(brief.executiveSummary, /Transaction for ₹99\.00 was blocked by in-flight safety rule \[canary_honeytoken\]/);
  assert.equal(brief.culpritRule, 'canary_honeytoken');
  assert.equal(brief.stepsEvaluated, 3);
});
