import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signMandate, verifyMandate } from './mandate.js';

test('AP2 Mandate: signs and verifies authentic mandate', () => {
  const mandateData = {
    agentId: 'claude-desktop',
    merchantId: 'merchant-grocery-01',
    maxPerTransaction: 200000,
    dailyCap: 500000,
    autoApproveThreshold: 50000,
    allowedCategories: ['grocery.bakery', 'grocery.dairy'],
    issuedAt: new Date().toISOString(),
  };

  const signed = signMandate(mandateData, 'secret_test_key');
  assert.ok(signed.signature);

  const verification = verifyMandate(signed.signedPayload, 'secret_test_key');
  assert.equal(verification.valid, true);
  assert.equal(verification.payload.agentId, 'claude-desktop');
});

test('AP2 Mandate: rejects tampered mandate signature', () => {
  const mandateData = {
    agentId: 'claude-desktop',
    merchantId: 'merchant-grocery-01',
    maxPerTransaction: 200000,
    dailyCap: 500000,
    autoApproveThreshold: 50000,
    allowedCategories: ['grocery.bakery'],
    issuedAt: new Date().toISOString(),
  };

  const signed = signMandate(mandateData, 'secret_test_key');
  const parsed = JSON.parse(signed.signedPayload);
  parsed.payload.maxPerTransaction = 99999999; // Attacker tries to tamper max limit

  const verification = verifyMandate(JSON.stringify(parsed), 'secret_test_key');
  assert.equal(verification.valid, false);
  assert.ok(verification.reason.includes('tampered'));
});

test('AP2 Mandate: rejects expired mandate (TTL exceeded)', () => {
  const mandateData = {
    agentId: 'claude-desktop',
    merchantId: 'merchant-grocery-01',
    maxPerTransaction: 200000,
    dailyCap: 500000,
    autoApproveThreshold: 50000,
    allowedCategories: ['grocery.bakery'],
    issuedAt: new Date(Date.now() - 3600000).toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
  };

  const signed = signMandate(mandateData, 'secret_test_key');
  const verification = verifyMandate(signed.signedPayload, 'secret_test_key');
  assert.equal(verification.valid, false);
  assert.ok(verification.reason.includes('expired'));
});
