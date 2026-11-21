// Backup & Restore admin API. Super-Admin only (requireCap('backups.manage')).
//
//   GET    /api/admin/backups                list + dashboard stats
//   POST   /api/admin/backups                start a manual backup now
//   GET    /api/admin/backups/settings       schedule + retention
//   PUT    /api/admin/backups/settings       update schedule + retention
//   GET    /api/admin/backups/:id            one backup's details
//   GET    /api/admin/backups/:id/download   download the archive
//   POST   /api/admin/backups/:id/restore    restore the whole site from it
//   DELETE /api/admin/backups/:id            delete the archive

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { logActivity } from '../lib/activity.ts';
import { requireCap } from '../lib/auth.ts';
import {
  prepareBackupDownload,
  appendBackupUpload,
  backupUploadStatus,
  backupStats,
  backupToJson,
  cancelBackupUpload,
  deleteBackup,
  finishBackupUpload,
  getBackupSettings,
  restoreBackup,
  saveBackupSettings,
  startBackup,
  startBackupUpload,
} from '../lib/backup.ts';
import { badRequest, notFound, parse } from '../lib/http.ts';
import { MAX_BACKUP_UPLOAD_BYTES } from '../lib/backup-archive.ts';
import { uploadAdmission } from '../lib/uploads.ts';
import { limiter } from '../lib/rate.ts';

export const backupRouter = Router();
backupRouter.use(requireCap('backups.manage'));

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY', 'PRE_RESTORE']).optional(),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']).optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'largest', 'smallest']).default('newest'),
});

backupRouter.get('/', async (req, res) => {
  const { page, pageSize, type, status, q, sort } = parse(listQuery, req.query);
  const where = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(q ? { name: { contains: q } } : {}),
  };
  const orderBy =
    sort === 'oldest' ? { createdAt: 'asc' as const }
    : sort === 'largest' ? { sizeBytes: 'desc' as const }
    : sort === 'smallest' ? { sizeBytes: 'asc' as const }
    : { createdAt: 'desc' as const };

  const [rows, total, stats] = await Promise.all([
    db.backup.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    db.backup.count({ where }),
    backupStats(),
  ]);
  res.json({
    items: rows.map(backupToJson),
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    stats,
  });
});

backupRouter.get('/settings', async (_req, res) => {
  res.json({ settings: await getBackupSettings() });
});

backupRouter.put('/settings', async (req, res) => {
  const settings = await saveBackupSettings(req.body);
  logActivity(req, 'update', 'backup-settings', `Updated backup schedule (${settings.enabled ? settings.frequency : 'disabled'})`);
  res.json({ settings });
});

const createSchema = z.object({
  name: z.string().trim().max(255).optional(),
  includeDb: z.boolean().default(true),
  includeFiles: z.boolean().default(true),
  includeCode: z.boolean().default(false),
});

backupRouter.post('/', async (req, res) => {
  const input = parse(createSchema, req.body);
  if (!input.includeDb && !input.includeFiles && !input.includeCode) throw badRequest('Choose at least one part to back up.', { includeDb: 'Select at least one.' });
  const row = await startBackup({
    type: 'MANUAL',
    name: input.name,
    includeDb: input.includeDb,
    includeFiles: input.includeFiles,
    includeCode: input.includeCode,
    createdById: req.user!.id,
  });
  logActivity(req, 'create', 'backup', `Started a manual backup "${row.name}"`, row.id);
  res.status(201).json({ item: backupToJson(row) });
});

const uploadStartSchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_BACKUP_UPLOAD_BYTES, 'The backup must be no larger than 5 GB.'),
});

backupRouter.post('/upload/start', limiter({ windowMinutes: 15, limit: 10, message: 'Too many backup uploads. Try again later.' }), async (req, res) => {
  const input = parse(uploadStartSchema, req.body);
  const row = await startBackupUpload(input.name, input.size, req.user!.id);
  logActivity(req, 'upload', 'backup', 'Started a chunked backup upload', row.id);
  res.status(201).json({ item: backupToJson(row) });
});

backupRouter.get('/upload/:id/status', async (req, res) => {
  res.json(await backupUploadStatus(String(req.params.id), req.user!.id));
});

backupRouter.post('/upload/:id/chunk', uploadAdmission, async (req, res) => {
  if (!req.is('application/octet-stream')) throw badRequest('Backup chunks must use application/octet-stream.');
  const offsetText = req.get('X-Upload-Offset');
  if (!offsetText || !/^\d+$/.test(offsetText)) throw badRequest('A valid X-Upload-Offset header is required.');
  const lengthText = req.get('Content-Length');
  const length = lengthText && /^\d+$/.test(lengthText) ? Number(lengthText) : undefined;
  const result = await appendBackupUpload(String(req.params.id), req.user!.id, Number(offsetText), req, length);
  res.json(result);
});

backupRouter.post('/upload/:id/finish', async (req, res) => {
  const row = await finishBackupUpload(String(req.params.id), req.user!.id);
  logActivity(req, 'upload', 'backup', 'Finished receiving a backup; archive validation started', row.id);
  res.status(202).json({ item: backupToJson(row) });
});

backupRouter.delete('/upload/:id', async (req, res) => {
  const row = await cancelBackupUpload(String(req.params.id), req.user!.id);
  logActivity(req, 'cancel', 'backup', 'Cancelled a backup upload', row.id);
  res.json({ ok: true });
});

backupRouter.get('/:id', async (req, res) => {
  const row = await db.backup.findUnique({ where: { id: req.params.id } });
  if (!row) throw notFound('Backup');
  res.json({ item: backupToJson(row) });
});

backupRouter.get('/:id/download', async (req, res, next) => {
  try {
    const file = await prepareBackupDownload(req.params.id);
    if (!file) throw notFound('Backup archive');
    logActivity(req, 'download', 'backup', `Downloaded backup`, req.params.id);
    res.download(file.path, file.name, error => {
      void file.cleanup().catch(() => console.warn('[backup] temporary download cleanup failed'));
      if (error) next(error);
    });
  } catch (error) {
    next(error);
  }
});

backupRouter.post('/:id/restore', async (req, res) => {
  const result = await restoreBackup(req.params.id, req.user!.id);
  logActivity(req, 'restore', 'backup', `Restored the website from a backup`, req.params.id);
  res.json(result);
});

backupRouter.delete('/:id', async (req, res) => {
  await deleteBackup(req.params.id);
  logActivity(req, 'delete', 'backup', `Deleted a backup`, req.params.id);
  res.json({ ok: true });
});
