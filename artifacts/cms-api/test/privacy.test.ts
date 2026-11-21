import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consentChoicesSchema, privacySettingsSchema, snippetSchema } from '@workspace/cms-content';
import { acceptAll, regionFor, rejectOptional, signVisitorId, visitorIdFromCookie } from '../src/lib/privacy.ts';

test('optional categories default off and essential cannot be disabled', () => {
  assert.deepEqual(rejectOptional, { essential: true, functional: false, analytics: false, marketing: false });
  assert.equal(consentChoicesSchema.safeParse({ ...acceptAll, essential: false }).success, false);
  assert.equal(consentChoicesSchema.safeParse({ ...rejectOptional, marketing: true }).success, true);
});

test('privacy links and colors are validated, and legacy snippets require marketing consent', () => {
  assert.equal(privacySettingsSchema.safeParse({ privacyPolicyUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(privacySettingsSchema.safeParse({ backgroundColor: 'red' }).success, false);
  const snippet = snippetSchema.parse({ name: 'Legacy', language: 'js', code: 'console.log(1)' });
  assert.equal(snippet.consentCategory, 'marketing');
});

test('visitor token is signed and region copy has a safe global fallback', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.equal(visitorIdFromCookie(signVisitorId(id)), id);
  const signed = signVisitorId(id);
  assert.equal(visitorIdFromCookie(signed.slice(0, -1) + (signed.endsWith('0') ? '1' : '0')), null);
  assert.equal(regionFor('CA'), 'canada');
  assert.equal(regionFor('FR'), 'europe');
  assert.equal(regionFor(''), 'global');
});
