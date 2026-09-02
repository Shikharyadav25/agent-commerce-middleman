import crypto from 'crypto';

/**
 * AP2 (Agent Payment Protocol) Signed Intent Mandate Helper
 * Generates and cryptographically verifies tamper-proof, portable agent mandates.
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

export function signMandate(mandateData, secretKey = process.env.ACM_MANDATE_SECRET || 'acm_ap2_mandate_secret_key') {
  const canonical = canonicalizeMandate(mandateData);
  const signature = crypto.createHmac('sha256', secretKey).update(canonical).digest('hex');
  return {
    payload: canonical,
    signature,
    signedPayload: JSON.stringify({ payload: JSON.parse(canonical), signature, standard: 'AP2-IntentMandate-v1' }),
  };
}

export function verifyMandate(signedPayloadStr, secretKey = process.env.ACM_MANDATE_SECRET || 'acm_ap2_mandate_secret_key') {
  try {
    const parsed = typeof signedPayloadStr === 'string' ? JSON.parse(signedPayloadStr) : signedPayloadStr;
    const { payload, signature } = parsed;

    if (!payload || !signature) {
      return { valid: false, reason: 'Missing mandate payload or signature' };
    }

    const canonical = canonicalizeMandate(payload);
    const expectedSig = crypto.createHmac('sha256', secretKey).update(canonical).digest('hex');

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
