import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../src/app.ts';
import { db } from '../src/db.ts';
import { sha256 } from '../src/lib/auth.ts';
import { publishDue } from '../src/lib/scheduler.ts';

const server = createApp().listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No test server');
const base = `http://127.0.0.1:${address.port}`;
const suffix = randomBytes(6).toString('hex');
const userIds: string[] = [];
const sessionIds: string[] = [];
const postIds: string[] = [];
const pageIds: string[] = [];
const categorySlugs: string[] = [];
const mediaUrls: string[] = [];
const metricLabels: string[] = [];

async function session(role: 'AUTHOR' | 'EDITOR' | 'SUPER_ADMIN') {
  const user = await db.user.create({ data: { email: `workflow-${role.toLowerCase()}-${suffix}@example.invalid`, name: `${role} integration`, passwordHash: 'test-only', role } });
  userIds.push(user.id);
  const token = randomBytes(32).toString('base64url');
  const id = sha256(token);
  await db.session.create({ data: { id, userId: user.id, expiresAt: new Date(Date.now() + 600_000) } });
  sessionIds.push(id);
  return { user, cookie: `nextract_session=${token}` };
}

async function call(method: string, path: string, cookie = '', body?: unknown) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'X-Nextract-CSRF': '1', ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  let data: Record<string, any> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { text }; }
  return { status: response.status, data };
}

async function upload(path: string, cookie: string, content: string, extra: Record<string, string> = {}, filename = 'import.md') {
  const form = new FormData();
  form.append('files', new Blob([content]), filename);
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { cookie, 'X-Nextract-CSRF': '1' }, body: form });
  return { status: response.status, data: await response.json() as Record<string, any> };
}

try {
  const author = await session('AUTHOR');
  const editor = await session('EDITOR');
  const admin = await session('SUPER_ADMIN');
  const title = `Workflow story ${suffix}`;
  const created = await call('POST', '/api/admin/posts', author.cookie, { title, type: 'BLOG' });
  assert.equal(created.status, 201);
  const postId = created.data.post.id as string;
  postIds.push(postId);
  const slug = created.data.post.slug as string;
  assert.equal((await call('PATCH', `/api/admin/posts/${postId}`, author.cookie, { excerpt: 'Review test summary', contentHtml: '<p>Original approved body</p>' })).status, 200);
  assert.equal((await call('POST', `/api/admin/posts/${postId}/publish`, author.cookie)).status, 403);
  assert.equal((await call('POST', `/api/admin/posts/${postId}/publish`, editor.cookie)).status, 403);
  assert.equal((await call('POST', `/api/admin/workflow/post/${postId}`, author.cookie, { action: 'submit', reviewerId: editor.user.id, comment: 'Ready to review' })).status, 200);
  const queue = await call('GET', '/api/admin/workflow/queue', editor.cookie);
  assert.ok(queue.data.items.some((item: { id: string }) => item.id === postId));
  assert.equal((await call('POST', `/api/admin/workflow/post/${postId}`, editor.cookie, { action: 'start-review' })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/post/${postId}`, editor.cookie, { action: 'approve', comment: 'Looks good' })).status, 200);
  const firstPublish = await call('POST', `/api/admin/posts/${postId}/publish`, editor.cookie);
  assert.equal(firstPublish.status, 200, JSON.stringify(firstPublish.data));
  assert.equal((await call('POST', `/api/admin/posts/${postId}/unpublish`, author.cookie)).status, 403);
  assert.equal((await call('POST', `/api/admin/posts/${postId}/archive`, author.cookie)).status, 403);
  const publicPath = `/api/public/resources/resources/${slug}`;
  assert.match((await call('GET', publicPath)).data.resource.html, /Original approved body/);

  assert.equal((await call('PATCH', `/api/admin/posts/${postId}`, author.cookie, { contentHtml: '<p>Unapproved new body</p>' })).status, 200);
  assert.match((await call('GET', publicPath)).data.resource.html, /Original approved body/);
  assert.equal((await call('POST', `/api/admin/posts/${postId}/publish`, editor.cookie)).status, 403);
  assert.equal((await call('POST', `/api/admin/workflow/post/${postId}`, author.cookie, { action: 'submit', reviewerId: editor.user.id })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/post/${postId}`, editor.cookie, { action: 'start-review' })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/post/${postId}`, editor.cookie, { action: 'request-revisions', comment: 'Check the claim' })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/post/${postId}`, author.cookie, { action: 'submit', reviewerId: editor.user.id })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/post/${postId}`, editor.cookie, { action: 'start-review' })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/post/${postId}`, editor.cookie, { action: 'approve' })).status, 200);
  assert.equal((await call('POST', `/api/admin/posts/${postId}/publish`, editor.cookie)).status, 200);
  assert.match((await call('GET', publicPath)).data.resource.html, /Unapproved new body/);
  const history = await call('GET', `/api/admin/workflow/post/${postId}`, author.cookie);
  assert.ok(history.data.revisions.length >= 5);
  const notifications = await call('GET', '/api/admin/workflow/notifications', author.cookie);
  assert.ok(notifications.data.unread > 0);

  assert.equal((await call('GET', '/api/admin/portability/export?format=json&scope=posts', editor.cookie)).status, 403);
  const exported = await call('GET', '/api/admin/portability/export?format=json&scope=posts', admin.cookie);
  assert.equal(exported.status, 200);
  assert.ok(exported.data.posts.some((item: { slug: string }) => item.slug === slug));
  const markdown = `---\ntitle: Imported ${suffix}\nslug: imported-${suffix}\n---\n\n# Imported ${suffix}\n\nA **portable** draft.`;
  const preview = await upload('/api/admin/portability/preview', admin.cookie, markdown, { strategy: 'skip' });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.items.length, 1);
  assert.equal(preview.data.items[0].duplicate, false);
  const imported = await upload('/api/admin/portability/commit', admin.cookie, markdown, { strategy: 'skip', selected: '[0]', includeSiteData: 'false' });
  assert.equal(imported.status, 200);
  assert.equal(imported.data.report.created, 1);
  const importedPost = await db.post.findUniqueOrThrow({ where: { slug: `imported-${suffix}` } });
  postIds.push(importedPost.id);
  assert.equal(importedPost.status, 'DRAFT');
  assert.equal(importedPost.workflowState, 'DRAFT');
  const renamed = await upload('/api/admin/portability/commit', admin.cookie, markdown, { strategy: 'rename', selected: '[0]', includeSiteData: 'false' });
  assert.equal(renamed.data.report.created, 1);
  const renamedPost = await db.post.findUniqueOrThrow({ where: { slug: `imported-${suffix}-2` } });
  postIds.push(renamedPost.id);

  const jsonCategory = `portable-${suffix}`;
  const jsonMetric = `Portable metric ${suffix}`;
  const jsonMedia = `https://example.com/portable-${suffix}.jpg`;
  const jsonFirst = `linked-${suffix}`;
  const jsonSecond = `linked-${suffix}-other`;
  categorySlugs.push(jsonCategory);
  metricLabels.push(jsonMetric);
  mediaUrls.push(jsonMedia);
  const packageJson = JSON.stringify({ format: 'nextract-content', version: 1,
    taxonomy: { categories: [{ name: `Portable ${suffix}`, slug: jsonCategory }] },
    collections: { metrics: [{ value: '42', label: jsonMetric, order: 7, published: true }] },
    media: [{ url: jsonMedia, filename: 'portable.jpg', kind: 'image', width: 800, height: 600 }],
    posts: [
      { title: 'Linked first', slug: jsonFirst, type: 'BLOG', contentHtml: '<p>Linked content</p>', categorySlugs: [jsonCategory], relatedSlugs: [jsonSecond] },
      { title: 'Linked second', slug: jsonSecond, type: 'BLOG', contentHtml: '<p>Related content</p>' },
    ],
  });
  const jsonPreview = await upload('/api/admin/portability/preview', admin.cookie, packageJson, {}, 'package.json');
  assert.equal(jsonPreview.status, 200);
  assert.equal(jsonPreview.data.items.length, 5);
  assert.deepEqual(jsonPreview.data.errors, []);
  const jsonImport = await upload('/api/admin/portability/commit', admin.cookie, packageJson, { selected: '[0,1,2,3,4]' }, 'package.json');
  assert.equal(jsonImport.status, 200);
  assert.equal(jsonImport.data.report.created, 5, JSON.stringify(jsonImport.data.report));
  const linkedFirst = await db.post.findUniqueOrThrow({ where: { slug: jsonFirst }, include: { categories: true } });
  const linkedSecond = await db.post.findUniqueOrThrow({ where: { slug: jsonSecond } });
  postIds.push(linkedFirst.id, linkedSecond.id);
  assert.equal(linkedFirst.status, 'DRAFT');
  assert.ok(linkedFirst.categories.some((category) => category.slug === jsonCategory));
  assert.deepEqual(linkedFirst.relatedIds, [linkedSecond.id]);
  const importedMetric = await db.metric.findFirstOrThrow({ where: { label: jsonMetric } });
  assert.equal(importedMetric.published, true);
  assert.equal(importedMetric.order, 7);
  const importedMedia = await db.mediaAsset.findFirstOrThrow({ where: { url: jsonMedia } });
  assert.equal(importedMedia.driver, 'external');
  assert.equal(importedMedia.width, 800);

  const page = await call('POST', '/api/admin/pages', editor.cookie, { title: `Review page ${suffix}` });
  assert.equal(page.status, 201);
  const pageId = page.data.page.id as string;
  pageIds.push(pageId);
  assert.equal((await call('POST', `/api/admin/pages/${pageId}/publish`, editor.cookie)).status, 403);
  assert.equal((await call('POST', `/api/admin/workflow/page/${pageId}`, editor.cookie, { action: 'submit', reviewerId: admin.user.id })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/page/${pageId}`, admin.cookie, { action: 'start-review' })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/page/${pageId}`, admin.cookie, { action: 'approve' })).status, 200);
  assert.equal((await call('POST', `/api/admin/pages/${pageId}/publish`, editor.cookie)).status, 200);
  assert.equal((await call('PATCH', `/api/admin/pages/${pageId}`, editor.cookie, { excerpt: 'Scheduled approved revision' })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/page/${pageId}`, editor.cookie, { action: 'submit', reviewerId: admin.user.id })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/page/${pageId}`, admin.cookie, { action: 'start-review' })).status, 200);
  assert.equal((await call('POST', `/api/admin/workflow/page/${pageId}`, admin.cookie, { action: 'approve' })).status, 200);
  const due = new Date(Date.now() + 120_000);
  assert.equal((await call('POST', `/api/admin/pages/${pageId}/schedule`, editor.cookie, { publishAt: due.toISOString() })).status, 200);
  assert.equal((await db.page.findUniqueOrThrow({ where: { id: pageId } })).status, 'SCHEDULED');
  await publishDue(new Date(due.getTime() + 1000));
  const scheduledPage = await db.page.findUniqueOrThrow({ where: { id: pageId } });
  assert.equal(scheduledPage.status, 'PUBLISHED');
  assert.equal((scheduledPage.published as { excerpt: string }).excerpt, 'Scheduled approved revision');
  console.log('PASS: editorial review, private draft edits, scheduled publishing, permissions, notifications, export, Markdown and JSON import, relationships, slug conflicts.');
} finally {
  for (const id of postIds.reverse()) { await db.contentRevision.deleteMany({ where: { entityType: 'post', entityId: id } }); await db.post.deleteMany({ where: { id } }); }
  for (const id of pageIds) { await db.contentRevision.deleteMany({ where: { entityType: 'page', entityId: id } }); await db.page.deleteMany({ where: { id } }); }
  await db.category.deleteMany({ where: { slug: { in: categorySlugs } } });
  await db.metric.deleteMany({ where: { label: { in: metricLabels } } });
  await db.mediaAsset.deleteMany({ where: { url: { in: mediaUrls } } });
  await db.workflowNotification.deleteMany({ where: { userId: { in: userIds } } });
  for (const id of sessionIds) await db.session.deleteMany({ where: { id } });
  for (const id of userIds) await db.user.deleteMany({ where: { id } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
}
