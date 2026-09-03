import crypto from 'crypto';

/**
 * 🛡️ LAYER 1: CRYPTOGRAPHIC USER INTENT BINDING (Google AP2 Protocol & Proof of Authority)
 * Generates and cryptographically verifies tamper-proof portable mandates and user intent proofs.
 */

export function canonicalizeMandate(mandateData) {
  const sorted = {
    agentId: mandateData.agentId,
    merchantId: mandateData.merchantId,
    maxPerTransaction: mandateData.maxPerTransaction,
    dailyCap: mandateData.dailyCap,
    autoApproveThreshold: mandateData.autoApproveThreshold,
    allowedCategories: [...(mandateData.allowedCategories || [])].sort(),
    issuedAt: mandateData.issuedAt || new Date().toISOString(),
    expiresAt: mandateData.expiresAt || null,
  };
  return JSON.stringify(sorted);
}

export function getMandateSecret(providedSecret) {
  if (providedSecret) return providedSecret;
  if (process.env.ACM_MANDATE_SECRET) return process.env.ACM_MANDATE_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY FATAL: ACM_MANDATE_SECRET environment variable must be explicitly configured in production');
  }
  return 'acm_ap2_mandate_secret_key';
}

export function signMandate(mandateData, secretKey = null) {
  const secret = getMandateSecret(secretKey);
  const canonical = canonicalizeMandate(mandateData);
  const signature = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  return {
    payload: canonical,
    signature,
    signedPayload: JSON.stringify({ payload: JSON.parse(canonical), signature, standard: 'AP2-IntentMandate-v1' }),
  };
}

export function verifyMandate(signedPayloadStr, secretKey = null) {
  try {
    const secret = getMandateSecret(secretKey);
    const parsed = typeof signedPayloadStr === 'string' ? JSON.parse(signedPayloadStr) : signedPayloadStr;
    const { payload, signature } = parsed;

    if (!payload || !signature) {
      return { valid: false, reason: 'Missing mandate payload or signature' };
    }

    const canonical = canonicalizeMandate(payload);
    const expectedSig = crypto.createHmac('sha256', secret).update(canonical).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    const isValidSig = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    if (!isValidSig) {
      return { valid: false, reason: 'Cryptographic signature verification failed (tampered mandate)' };
    }

    // Check expiration if present
    if (payload.expiresAt && new Date() > new Date(payload.expiresAt)) {
      return { valid: false, reason: 'Mandate has expired (TTL exceeded)' };
    }

    return { valid: true, payload, reason: 'Verified authentic AP2 signed mandate' };
  } catch (err) {
    return { valid: false, reason: `Malformed signed mandate: ${err.message}` };
  }
}

/**
 * Signs a user-authorized Proof of Authority (PoA) binding an agent to a specific intent statement & budget.
 */
export function signUserIntentProof(intentData, userSecret = null) {
  const secret = getMandateSecret(userSecret);
  const canonical = JSON.stringify({
    userId: intentData.userId || 'user-default',
    agentId: intentData.agentId,
    intent: intentData.intent,
    maxAuthorizedPaise: intentData.maxAuthorizedPaise,
    allowedMerchant: intentData.allowedMerchant || null,
    expiresAt: intentData.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    nonce: intentData.nonce || crypto.randomBytes(8).toString('hex'),
  });
  const signature = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  return {
    proof: JSON.parse(canonical),
    signature,
    signedProofToken: Buffer.from(JSON.stringify({ proof: JSON.parse(canonical), signature })).toString('base64'),
  };
}

/**
 * Cryptographically verifies that the user authorized this specific checkout scope before the agent hit the gateway.
 */
export function verifyUserIntentProof(
  signedProofToken,
  { quoteTotal = 0, merchantId = null, requireProof = false } = {},
  userSecret = null
) {
  if (!signedProofToken) {
    if (requireProof) {
      return { valid: false, decision: 'deny', reason: 'mandatory proof of authority token missing for this mandate', ruleId: 'proof_of_authority_required' };
    }
    return { valid: true, decision: 'allow', reason: 'no intent proof attached (standard mandate path)' };
  }

  try {
    const secret = getMandateSecret(userSecret);
    const raw = Buffer.from(signedProofToken, 'base64').toString('utf8');
    const { proof, signature } = JSON.parse(raw);

    if (!proof || !signature) {
      return { valid: false, decision: 'deny', reason: 'proof of authority token missing proof or signature', ruleId: 'proof_of_authority' };
    }

    const canonical = JSON.stringify({
      userId: proof.userId || 'user-default',
      agentId: proof.agentId,
      intent: proof.intent,
      maxAuthorizedPaise: proof.maxAuthorizedPaise,
      allowedMerchant: proof.allowedMerchant || null,
      expiresAt: proof.expiresAt,
      nonce: proof.nonce,
    });

    const expectedSig = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, decision: 'deny', reason: 'proof of authority signature tampered or invalid', ruleId: 'proof_of_authority' };
    }

    if (proof.expiresAt && new Date() > new Date(proof.expiresAt)) {
      return { valid: false, decision: 'deny', reason: 'proof of authority token has expired', ruleId: 'proof_of_authority' };
    }

    if (quoteTotal > proof.maxAuthorizedPaise) {
      return {
        valid: false,
        decision: 'deny',
        reason: `quote total ₹${quoteTotal / 100} exceeds user-authorized limit ₹${proof.maxAuthorizedPaise / 100} in proof token`,
        ruleId: 'proof_of_authority',
      };
    }

    if (proof.allowedMerchant && merchantId && proof.allowedMerchant !== merchantId) {
      return {
        valid: false,
        decision: 'deny',
        reason: `merchant ${merchantId} does not match allowed merchant ${proof.allowedMerchant} in proof of authority`,
        ruleId: 'proof_of_authority',
      };
    }

    return {
      valid: true,
      decision: 'allow',
      reason: `verified authentic Proof of Authority for intent: "${proof.intent}"`,
      intent: proof.intent,
      ruleId: 'proof_of_authority',
    };
  } catch (err) {
    return { valid: false, decision: 'deny', reason: `malformed proof of authority token: ${err.message}`, ruleId: 'proof_of_authority' };
  }
}
