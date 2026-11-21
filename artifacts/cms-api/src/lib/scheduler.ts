// Publishes scheduled pages and posts when their time comes, and clears out
// expired sessions. Runs inside the API process once a minute.

import { db } from '../db.ts';
import { env } from '../env.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { runScheduledBackups } from './backup.ts';
import { emitEvent } from './webhooks.ts';
import { invalidateContent, snapshotOf } from './content.ts';
import { sendDueBroadcasts } from './newsletter.ts';
import { processDueWebhooks } from './webhooks.ts';
import { getSetting } from './settings.ts';
import { reviewVisual } from '@workspace/cms-content';
import { validateVisual } from './visual.ts';
import { snapshotForWorkflow } from './workflow.ts';
import { clearOtherFeatured } from './posts.ts';

export async function publishDue(now = new Date()) {
  let changed = 0;

  const pages = await db.page.findMany({ where: { status: 'SCHEDULED', workflowState: 'SCHEDULED', publishAt: { lte: now } } });
  for (const page of pages) {
    if (page.approvedVersion !== page.workflowVersion) continue;
    if(page.visualDraft){
      try{if(reviewVisual(validateVisual(page.visualDraft)).some(i=>i.severity==='error'))continue;}catch{continue;}
    }
    const guard = await db.page.updateMany({
      where: { id: page.id, status: 'SCHEDULED', workflowState: 'SCHEDULED', workflowVersion: page.workflowVersion, approvedVersion: page.workflowVersion },
      data: { status: 'PUBLISHED', publishedAt: page.publishAt ?? now, published: snapshotOf(page) as unknown as Prisma.InputJsonValue, hasChanges: false, workflowState: 'PUBLISHED' },
    });
    if (!guard.count) continue;
    await db.activityLog.create({
      data: { action: 'publish', entityType: 'page', entityId: page.id, summary: `Scheduled page "${page.title}" went live` },
    });
    emitEvent('page.published', { id: page.id, title: page.title, slug: page.slug, url: `${env.siteUrl}/${page.slug}`.replace(/\/+$/, '') });
    changed += 1;
  }

  const posts = await db.post.findMany({ where: { status: 'SCHEDULED', workflowState: 'SCHEDULED', publishAt: { lte: now } } });
  for (const post of posts) {
    if (post.approvedVersion !== post.workflowVersion) continue;
    const snapshot = await snapshotForWorkflow('post', post.id);
    const guard = await db.$transaction(async (tx) => {
      const result = await tx.post.updateMany({ where: { id: post.id, status: 'SCHEDULED', workflowState: 'SCHEDULED', workflowVersion: post.workflowVersion, approvedVersion: post.workflowVersion }, data: { status: 'PUBLISHED', publishedAt: post.publishAt ?? now, publishedSnapshot: snapshot, workflowState: 'PUBLISHED' } });
      if (result.count && post.featured) await clearOtherFeatured(tx, post.id);
      return result;
    });
    if (!guard.count) continue;
    await db.activityLog.create({
      data: { action: 'publish', entityType: 'post', entityId: post.id, summary: `Scheduled post "${post.title}" went live` },
    });
    emitEvent('post.published', { id: post.id, title: post.title, slug: post.slug });
    changed += 1;
  }

  if (changed) invalidateContent();
  return changed;
}

async function housekeeping(now = new Date()) {
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
  });
  const { retentionDays } = await getSetting('privacy');
  await db.consentRecord.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - retentionDays * 86_400_000) } } });
}

export function startScheduler() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const published = await publishDue();
      if (published) console.log(`[scheduler] published ${published} scheduled item(s)`);
      await housekeeping();
      await runScheduledBackups();
      await sendDueBroadcasts();
      await processDueWebhooks();
    } catch (error) {
      console.error('[scheduler]', (error as Error).message);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
