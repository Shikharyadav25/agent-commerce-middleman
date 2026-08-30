import { test } from 'node:test';
import assert from 'node:assert';
import { checkPerTransactionCap, decideGate } from './rules.js';

const mandate = { id: 'mnd_1', maxPerTransaction: 200000, dailyCap: 200000, autoApproveThreshold: 50000 };

test('quote under cap passes', () => {
  const result = checkPerTransactionCap(mandate, 40000);
  assert.equal(result.decision, 'allow');
});

test('quote over cap is denied', () => {
  const result = checkPerTransactionCap(mandate, 250000);
  assert.equal(result.decision, 'deny');
});

test('quote exactly at cap passes (boundary case)', () => {
  const result = checkPerTransactionCap(mandate, 200000);
  assert.equal(result.decision, 'allow');
});

test('quote under auto-approve threshold auto-allows', () => {
  const result = decideGate(mandate, 30000, false);
  assert.equal(result.decision, 'allow');
});

test('quote over threshold gets gated', () => {
  const result = decideGate(mandate, 60000, false);
  assert.equal(result.decision, 'pending');
});

test('first-time merchant always gates, even under threshold', () => {
  const result = decideGate(mandate, 10000, true);
  assert.equal(result.decision, 'pending');
});