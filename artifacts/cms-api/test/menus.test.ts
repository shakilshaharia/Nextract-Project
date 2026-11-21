import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveMenu } from '../src/lib/menus.ts';

test('legacy deployments retain the home header and complete page footer', () => {
  const homeHeader = { location:'home-header', items:['Services','Features'] };
  const pageHeader = { location:'page-header', items:['Other'] };
  const homeFooter = { location:'home-footer', items:['Pricing'] };
  const pageFooter = { location:'page-footer', items:['Home','Pricing','Contact'] };
  const menus = [homeFooter,pageHeader,homeHeader,pageFooter];
  assert.equal(resolveMenu(menus,'header'),homeHeader);
  assert.equal(resolveMenu(menus,'footer'),pageFooter);
  assert.equal(resolveMenu([pageHeader],'header'),pageHeader);
  assert.equal(resolveMenu([homeFooter],'footer'),homeFooter);
});

test('saved canonical menus take precedence, including intentionally empty menus', () => {
  const canonical = { location:'header', items:[] };
  const legacy = { location:'home-header', items:['Services'] };
  assert.equal(resolveMenu([legacy,canonical],'header'),canonical);
  assert.deepEqual(legacy.items,['Services']);
  assert.equal(resolveMenu([],'footer'),undefined);
});
