/**
 * Natural Language "Explain This Decision" Engine
 * Turns structured deterministic policy outcomes into plain-English reasoning cards.
 */

export function generateDecisionExplanation({
  ruleId,
  decision,
  agentName = 'AI Agent',
  quoteTotal,
  limitValue,
  category,
  merchantName = 'Merchant',
  actor = 'system',
}) {
  const formattedTotal = quoteTotal ? `₹${(quoteTotal / 100).toFixed(2)}` : 'N/A';
  const formattedLimit = limitValue ? `₹${(limitValue / 100).toFixed(2)}` : 'N/A';

  switch (ruleId) {
    case 'agent_valid':
      if (decision === 'deny') {
        return `Denied — Credential for ${agentName} has been revoked by the operator or is invalid.`;
      }
      return `Allowed — Verified active credential for ${agentName}.`;

    case 'mandate_category_scope':
      return `Denied — Product category "${category}" is outside ${agentName}'s authorized spending mandate.`;

    case 'per_txn_cap':
      if (decision === 'deny') {
        const excess = (quoteTotal - limitValue) / 100;
        return `Denied — Quote total ${formattedTotal} exceeds ${agentName}'s authorized per-transaction cap (${formattedLimit}) by ₹${excess.toFixed(2)}.`;
      }
      return `Allowed — Order total ${formattedTotal} is within the authorized per-transaction limit (${formattedLimit}).`;

    case 'daily_cap':
      if (decision === 'deny') {
        return `Denied — Cumulative spend for ${agentName} would exceed the 24-hour daily budget cap of ${formattedLimit}.`;
      }
      return `Allowed — Daily budget ceiling is healthy; within authorized 24h cap (${formattedLimit}).`;

    case 'gate_first_time':
      return `Gated for Review — First-time transaction between ${agentName} and ${merchantName}. Routing to Operator Inbox for human verification.`;

    case 'gate_threshold':
      if (decision === 'pending') {
        return `Gated for Review — Order total ${formattedTotal} exceeds the autonomous auto-approval threshold (${formattedLimit}). Held for human sign-off.`;
      }
      return `Auto-Approved — Order total ${formattedTotal} is below the auto-approve threshold (${formattedLimit}). Autonomous checkout permitted.`;

    case 'discount_ceiling':
      if (decision === 'deny') {
        return `Denied — Promotional discount exceeds maximum authorized merchant margin cap.`;
      }
      return `Allowed — Promotional discount is within merchant campaign boundaries.`;

    case 'human_review':
      if (decision === 'allow') {
        return `Manually Approved by ${actor} — Razorpay order and payment link generated.`;
      }
      return `Manually Declined by ${actor} — Transaction rejected. No funds transferred.`;

    default:
      return decision === 'allow'
        ? `Policy evaluation passed for ${agentName}.`
        : `Transaction held or denied under deterministic rule ${ruleId || 'default'}.`;
  }
}
