/**
 * Google Gemini AI Security Analyst & Agent Copilot
 * 
 * Intercepts anomalous, suspicious, or policy-violating paying agent telemetry,
 * sends it to Google Gemini (Free Tier: gemini-1.5-flash) for threat analysis,
 * and advises the gateway whether to revoke the agent's payment credentials
 * (REVOKE_ACCESS) or mark it safe (SAFE_TO_CONTINUE).
 */

import { classifyIssueType, generateNLPDiagnosticReport, ISSUE_TYPES, SEVERITY_LEVELS } from './diagnostics.js';

export const GEMINI_VERDICTS = {
  REVOKE_ACCESS: 'REVOKE_ACCESS',
  SAFE_TO_CONTINUE: 'SAFE_TO_CONTINUE',
  HOLD_FOR_HUMAN_REVIEW: 'HOLD_FOR_HUMAN_REVIEW',
};

/**
 * Evaluates an anomalous agent transaction using Google Gemini.
 * Falls back gracefully to deterministic heuristics if no GEMINI_API_KEY is configured.
 */
export async function evaluateAgentAnomalyWithGemini({
  agent = {},
  userIntentPrompt = null,
  buyerAgentExplanation = null,
  cart = [],
  ruleId = null,
  reason = null,
  quoteTotal = 0,
  mandate = {},
  deliveryPincode = null,
  recentTransactions = [],
  apiKey = process.env.GEMINI_API_KEY,
} = {}) {
  // 1. Fallback if no Gemini API Key is provided
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    const hasDisallowedCategory = cart.some((it) => (it.category || '').match(/giftcard|crypto|prepaid|voucher/i));
    const effectiveRule = hasDisallowedCategory ? 'disallowed_category_blacklist' : ruleId;

    const heuristicReport = generateNLPDiagnosticReport({
      ruleId: effectiveRule,
      decision: effectiveRule === 'canary_honeytoken' || effectiveRule === 'disallowed_category_blacklist' ? 'deny' : 'pending',
      reason,
      quoteTotal,
      items: cart,
      userIntentPrompt,
      mandate,
      agent,
      deliveryPincode,
    });

    const isHighThreat =
      heuristicReport.issueType === ISSUE_TYPES.MALICIOUS_ADVERSARIAL ||
      heuristicReport.severity === SEVERITY_LEVELS.CRITICAL_THREAT;

    return {
      source: 'heuristic_fallback',
      model: 'deterministic-rules-engine',
      verdict: isHighThreat ? GEMINI_VERDICTS.REVOKE_ACCESS : GEMINI_VERDICTS.HOLD_FOR_HUMAN_REVIEW,
      confidence: 0.9,
      threatLevel: heuristicReport.severity,
      primaryThreat: heuristicReport.issueType,
      executiveBrief: heuristicReport.forensicSummary,
      recommendedAction: heuristicReport.agentActionableInstructions,
      suggestedRemediation: heuristicReport.suggestedRemediation,
      shouldRevokeAgent: isHighThreat,
      timestamp: new Date().toISOString(),
    };
  }

  // 2. Prepare payload for Google Gemini API
  const promptContext = {
    agent: {
      id: agent.id || 'external-ai-agent',
      name: agent.name || 'External LLM Agent',
      isRevoked: Boolean(agent.revoked),
    },
    userIntent: userIntentPrompt || 'Not specified by user',
    buyerAgentExplanation: buyerAgentExplanation || 'No self-explanation provided by agent',
    cartItems: cart.map((it) => ({
      sku: it.sku,
      name: it.name || it.sku,
      qty: it.qty,
      unitPrice: it.unitPrice ? `₹${it.unitPrice / 100}` : undefined,
      category: it.category || 'unknown',
    })),
    orderTotal: `₹${(quoteTotal / 100).toFixed(2)}`,
    anomalySignal: {
      ruleTriggered: ruleId,
      reason: reason || 'Suspicious activity detected',
    },
    spendingMandate: {
      maxPerTransaction: mandate.maxPerTransaction ? `₹${mandate.maxPerTransaction / 100}` : 'Uncapped',
      autoApproveThreshold: mandate.autoApproveThreshold ? `₹${mandate.autoApproveThreshold / 100}` : 'None',
      allowedMerchant: mandate.merchantId || 'All',
    },
    deliveryPincode: deliveryPincode || 'None',
  };

  const systemInstruction = `You are the Zero-Trust AI Security Analyst for the Razorpay Agent Commerce Gateway.
Your duty is to investigate autonomous AI agents that exhibit anomalous, suspicious, or policy-violating purchasing behavior.
You evaluate the original user intent, what the agent carted, the policy violation signal, and the buyer agent's self-explanation/defense.

Interrogate and analyze:
1. Did the buyer agent give a credible, innocent explanation (e.g., prompt ambiguity, benign misunderstanding, reasonable cross-sell) where self-correction guidance can resolve it safely?
2. Or is this a MALICIOUS THREAT, DECEPTIVE PROMPT INJECTION, CANARY RECONNAISSANCE, or RUNAWAY LOOP where the agent should be permanently revoked?

You MUST reply with valid JSON only matching this schema:
{
  "verdict": "REVOKE_ACCESS" | "SAFE_TO_CONTINUE" | "HOLD_FOR_HUMAN_REVIEW",
  "confidence": number between 0.0 and 1.0,
  "threatLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "primaryThreat": "PROMPT_INJECTION" | "HONEYPOT_PROBE" | "SMURFING" | "RUNAWAY_LOOP" | "UNAUTHORIZED_CATEGORY" | "BENIGN_VARIATION" | "PRICE_DRIFT",
  "executiveBrief": "A 1-3 sentence plain English explanation of the threat or benign behavior.",
  "recommendedAction": "Concrete action for the gateway operator.",
  "shouldRevokeAgent": boolean (true ONLY if verdict is REVOKE_ACCESS and confidence >= 0.75),
  "suggestedRemediation": {
    "action": string,
    "guidanceForAgent": string
  }
}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${systemInstruction}\n\nTRANSACTION CONTEXT TO ANALYZE:\n${JSON.stringify(promptContext, null, 2)}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const candidateModels = [
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-flash-latest',
  ];

  let candidateText = null;
  let usedModel = 'gemini-3.1-flash-lite';

  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = await response.json();
        candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          usedModel = model;
          break;
        }
      } else {
        const errText = await response.text();
        console.warn(`[Gemini Analyst ${model}] HTTP ${response.status}: ${errText}`);
      }
    } catch (e) {
      console.warn(`[Gemini Analyst ${model}] Error: ${e.message}`);
    }
  }

  try {
    if (!candidateText) {
      throw new Error('All candidate Gemini models failed or returned empty response');
    }

    const parsed = JSON.parse(candidateText);

    return {
      source: 'gemini_api_live',
      model: usedModel,
      verdict: parsed.verdict || GEMINI_VERDICTS.HOLD_FOR_HUMAN_REVIEW,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
      threatLevel: parsed.threatLevel || 'HIGH',
      primaryThreat: parsed.primaryThreat || 'SUSPICIOUS_ACTIVITY',
      executiveBrief: parsed.executiveBrief || 'Automated analysis performed by Gemini.',
      recommendedAction: parsed.recommendedAction || 'Review transaction on operator dashboard.',
      suggestedRemediation: parsed.suggestedRemediation || null,
      shouldRevokeAgent: Boolean(parsed.shouldRevokeAgent && parsed.verdict === GEMINI_VERDICTS.REVOKE_ACCESS),
      rawResponse: parsed,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[Gemini Analyst] Error contacting Gemini, falling back to local diagnostics:', err.message);

    // Fallback to local heuristic engine
    const heuristicReport = generateNLPDiagnosticReport({
      ruleId,
      decision: 'pending',
      reason,
      quoteTotal,
      items: cart,
      userIntentPrompt,
      mandate,
      agent,
      deliveryPincode,
    });

    return {
      source: 'heuristic_fallback_on_error',
      model: 'deterministic-rules-engine',
      error: err.message,
      verdict: GEMINI_VERDICTS.HOLD_FOR_HUMAN_REVIEW,
      confidence: 0.8,
      threatLevel: heuristicReport.severity,
      primaryThreat: heuristicReport.issueType,
      executiveBrief: heuristicReport.forensicSummary,
      recommendedAction: heuristicReport.agentActionableInstructions,
      suggestedRemediation: heuristicReport.suggestedRemediation,
      shouldRevokeAgent: false,
      timestamp: new Date().toISOString(),
    };
  }
}
