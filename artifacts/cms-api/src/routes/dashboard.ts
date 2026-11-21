import { Router } from 'express';
import { db } from '../db.ts';
import { requireCap, userCan } from '../lib/auth.ts';
import { parse } from '../lib/http.ts';
import { pageArgs, paged, pagingSchema } from '../lib/paging.ts';
import { getSetting } from '../lib/settings.ts';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', requireCap('dashboard.view'), async (req, res) => {
  const me = req.user!;
  // Authors see figures for their own posts only.
  const postScope = userCan(req, 'posts.editAll') ? {} : { authorId: me.id };
  const canForms = userCan(req, 'forms.view');
  const canPages = userCan(req, 'pages.edit');
  const presenceCheckedAt = new Date();
  const activeSince = new Date(presenceCheckedAt.getTime() - 10 * 60_000);

  const [pages, pagesPublished, posts, postsPublished, postsDraft, postsScheduled, media, submissionsNew, scheduledPages, scheduledPosts, drafts, activity, submissions, site, activeSessions] =
    await Promise.all([
      canPages ? db.page.count() : 0,
      canPages ? db.page.count({ where: { status: 'PUBLISHED' } }) : 0,
      db.post.count({ where: postScope }),
      db.post.count({ where: { ...postScope, status: 'PUBLISHED' } }),
      db.post.count({ where: { ...postScope, status: 'DRAFT' } }),
      db.post.count({ where: { ...postScope, status: 'SCHEDULED' } }),
      db.mediaAsset.count(),
      canForms ? db.formSubmission.count({ where: { status: 'NEW' } }) : 0,
      canPages
        ? db.page.findMany({ where: { status: 'SCHEDULED' }, select: { id: true, title: true, publishAt: true }, orderBy: { publishAt: 'asc' }, take: 5 })
        : [],
      db.post.findMany({ where: { ...postScope, status: 'SCHEDULED' }, select: { id: true, title: true, publishAt: true }, orderBy: { publishAt: 'asc' }, take: 5 }),
      db.post.findMany({ where: { ...postScope, status: 'DRAFT' }, select: { id: true, title: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      userCan(req, 'activity.view')
        ? db.activityLog.findMany({ include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 10 })
        : db.activityLog.findMany({ where: { userId: me.id }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      canForms
        ? db.formSubmission.findMany({ select: { id: true, type: true, name: true, company: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 })
        : [],
      getSetting('site'),
      db.session.findMany({
        where: {
          expiresAt: { gt: presenceCheckedAt },
          ...(req.sessionId
            ? { OR: [{ lastSeenAt: { gte: activeSince } }, { id: req.sessionId }] }
            : { lastSeenAt: { gte: activeSince } }),
        },
        select: {
          id: true,
          lastSeenAt: true,
          user: { select: { id: true, name: true, role: true, active: true } },
        },
        orderBy: { lastSeenAt: 'desc' },
      }),
    ]);

  // One person can be signed in on several devices. Show each active member
  // once, using their most recent session, and never expose IP/user-agent data.
  const activeByUser = new Map<string, { id: string; name: string; role: string; lastSeenAt: Date; isCurrentUser: boolean }>();
  for (const session of activeSessions) {
    if (!session.user.active) continue;
    const isCurrentUser = session.id === req.sessionId;
    const existing = activeByUser.get(session.user.id);
    if (existing) {
      if (isCurrentUser) {
        existing.isCurrentUser = true;
        existing.lastSeenAt = presenceCheckedAt;
      }
      continue;
    }
    activeByUser.set(session.user.id, {
      id: session.user.id,
      name: session.user.name,
      role: session.user.role,
      lastSeenAt: isCurrentUser ? presenceCheckedAt : session.lastSeenAt,
      isCurrentUser,
    });
  }

  res.json({
    counts: { pages, pagesPublished, posts, postsPublished, postsDraft, postsScheduled, media, submissionsNew },
    scheduled: [
      ...scheduledPages.map((page) => ({ type: 'page' as const, ...page })),
      ...scheduledPosts.map((post) => ({ type: 'post' as const, ...post })),
    ].sort((a, b) => (a.publishAt?.getTime() ?? 0) - (b.publishAt?.getTime() ?? 0)),
    drafts,
    activity: activity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      user: entry.user?.name ?? 'System',
      createdAt: entry.createdAt,
    })),
    submissions,
    analytics: {
      googleAnalyticsId: site.googleAnalyticsId,
      googleTagManagerId: site.googleTagManagerId,
    },
    activeMembers: [...activeByUser.values()],
    presenceCheckedAt,
  });
});

dashboardRouter.get('/activity', requireCap('activity.view'), async (req, res) => {
  const paging = parse(pagingSchema, req.query);
  const [items, total] = await Promise.all([
    db.activityLog.findMany({ include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, ...pageArgs(paging) }),
    db.activityLog.count(),
  ]);
  res.json(
    paged(
      items.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        summary: entry.summary,
        user: entry.user?.name ?? 'System',
        createdAt: entry.createdAt,
      })),
      total,
      paging,
    ),
  );
});
