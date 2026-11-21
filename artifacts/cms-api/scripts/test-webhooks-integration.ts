import assert from 'node:assert/strict';
import { db } from '../src/db.ts';
import { deliverWebhook, newSecret } from '../src/lib/webhooks.ts';

const hook = await db.webhook.create({
  data: {
    name: 'Webhook delivery integration test',
    // An internal address can only be inserted directly for this guard test.
    url: 'http://127.0.0.1:9/blocked',
    format: 'JSON',
    secret: newSecret(),
    events: ['form.submission'],
    enabled: true,
  },
});

try {
  const delivery = await db.webhookDelivery.create({
    data: { webhookId: hook.id, event: 'form.submission', payload: { event: 'form.submission', data: {} }, response: '', nextAttempt: new Date() },
  });
  await Promise.all([deliverWebhook(delivery.id), deliverWebhook(delivery.id)]);
  const first = await db.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
  assert.equal(first.status, 'FAILED');
  assert.equal(first.attempts, 1, 'concurrent workers must claim only once');
  assert.match(first.error, /not allowed/i);

  await db.webhook.update({ where: { id: hook.id }, data: { enabled: false } });
  await db.webhookDelivery.update({ where: { id: delivery.id }, data: { nextAttempt: new Date(Date.now() - 1000) } });
  await deliverWebhook(delivery.id);
  const paused = await db.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
  assert.equal(paused.attempts, 1, 'disabled hooks must not retry');

  await db.webhook.update({ where: { id: hook.id }, data: { enabled: true } });
  await deliverWebhook(delivery.id);
  const resumed = await db.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
  assert.equal(resumed.attempts, 2, 'enabled hooks resume their queued delivery');
  console.log('PASS: atomic delivery claim, SSRF rejection, pause and resume.');
} finally {
  await db.webhook.delete({ where: { id: hook.id } });
  await db.$disconnect();
}
