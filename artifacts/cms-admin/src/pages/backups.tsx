import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CheckCircle2,
  Clock,
  Code2,
  Database,
  Download,
  HardDrive,
  Loader2,
  Play,
  RotateCcw,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Modal, useConfirm } from '@/components/dialog';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  IconButton,
  Notice,
  PageHeader,
  PageLoader,
  Pagination,
  SelectField,
  Switch,
  Tabs,
  TextField,
} from '@/components/ui';
import { api, del, errorMessage, get, post, put, qs, sensitiveDownload } from '@/lib/api';
import { COMMON_TIME_ZONES } from '@/lib/datetime';
import { formatBytes, formatDateTime, timeAgo } from '@/lib/format';

type BackupRow = {
  id: string;
  name: string;
  type: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PRE_RESTORE';
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  includesDb: boolean;
  includesFiles: boolean;
  includesCode: boolean;
  sizeBytes: number;
  checksum: string;
  error: string;
  restoring: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

type Stats = {
  total: number;
  success: number;
  failed: number;
  running: number;
  totalSize: number;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
  scheduleEnabled: boolean;
};

type ListResponse = { items: BackupRow[]; page: number; pages: number; total: number; stats: Stats };

type Settings = {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  weekday: number;
  monthday: number;
  timezone: string;
  includeDb: boolean;
  includeFiles: boolean;
  includeCode: boolean;
  retentionDaily: number;
  retentionWeekly: number;
  retentionMonthly: number;
  retentionManual: number;
};

const typeTone: Record<BackupRow['type'], Parameters<typeof Badge>[0]['tone']> = {
  MANUAL: 'blue',
  DAILY: 'green',
  WEEKLY: 'violet',
  MONTHLY: 'amber',
  PRE_RESTORE: 'neutral',
};
const typeLabel: Record<BackupRow['type'], string> = {
  MANUAL: 'Manual',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  PRE_RESTORE: 'Pre-restore',
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_BACKUP_UPLOAD_BYTES = 5 * 1024 ** 3;
const BACKUP_UPLOAD_CHUNK_BYTES = 16 * 1024 ** 2;

function StatusBadge({ row }: { row: BackupRow }) {
  if (row.restoring) return <Badge tone="amber">Restoring…</Badge>;
  if (row.status === 'SUCCESS') return <Badge tone="green">Completed</Badge>;
  if (row.status === 'FAILED') return <Badge tone="red">Failed</Badge>;
  return (
    <Badge tone="blue">
      <Loader2 className="mr-1 inline size-3 animate-spin" />
      Running…
    </Badge>
  );
}

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        <span className="text-brand-600">{icon}</span>
        <span className="text-[12px] font-medium tracking-wide uppercase">{label}</span>
      </div>
      <div className="mt-1.5 text-xl font-semibold text-zinc-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </Card>
  );
}

export function BackupsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'history' | 'schedule'>('history');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [backupModal, setBackupModal] = useState(false);
  const [includeDb, setIncludeDb] = useState(true);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [includeCode, setIncludeCode] = useState(false);
  const [name, setName] = useState('');
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const query = `/api/admin/backups${qs({ page, pageSize: 20, type: typeFilter, status: statusFilter, sort })}`;
  const list = useQuery({
    queryKey: ['backups', query],
    queryFn: ({ signal }) => get<ListResponse>(query, signal),
    // Keep polling while something is being created or restored.
    refetchInterval: (q) => (q.state.data?.items.some((b) => b.status === 'RUNNING' || b.restoring) ? 3000 : false),
  });

  const settingsQuery = useQuery({ queryKey: ['backup-settings'], queryFn: ({ signal }) => get<{ settings: Settings }>('/api/admin/backups/settings', signal) });

  const createBackup = useMutation({
    mutationFn: () => post('/api/admin/backups', { name: name.trim() || undefined, includeDb, includeFiles, includeCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup started. It will appear below and update when it finishes.');
      setBackupModal(false);
      setName('');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const restore = useMutation({
    mutationFn: (id: string) => post(`/api/admin/backups/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Website restored. A safety backup of the previous state was saved first.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/admin/backups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup deleted');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const uploadBackup = useMutation({
    mutationFn: async () => {
      const file = uploadFile!;
      const started = await post<{ item: BackupRow }>('/api/admin/backups/upload/start', { name: file.name, size: file.size });
      const uploadId = started.item.id;
      let offset = 0;
      try {
        while (offset < file.size) {
          const end = Math.min(offset + BACKUP_UPLOAD_CHUNK_BYTES, file.size);
          let sent = false;
          for (let attempt = 0; attempt < 3 && !sent; attempt++) {
            try {
              const result = await api<{ received: number }>(`/api/admin/backups/upload/${uploadId}/chunk`, {
                method: 'POST', rawBody: file.slice(offset, end),
                headers: { 'Content-Type': 'application/octet-stream', 'X-Upload-Offset': String(offset) },
              });
              offset = result.received;
              sent = true;
            } catch (error) {
              const status = await get<{ received: number }>(`/api/admin/backups/upload/${uploadId}/status`).catch(() => null);
              if (status?.received === end) { offset = end; sent = true; }
              else if (status?.received === offset && attempt < 2) continue;
              else throw error;
            }
          }
          setUploadProgress(Math.min(100, Math.round((offset / file.size) * 100)));
        }
        return await post(`/api/admin/backups/upload/${uploadId}/finish`);
      } catch (error) {
        await del(`/api/admin/backups/upload/${uploadId}`).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      setPage(1); setTypeFilter(''); setStatusFilter(''); setTab('history');
      setUploadModal(false); setUploadFile(null); setUploadProgress(null);
      toast.success('Upload complete. The archive is being checked and will update in backup history.');
    },
    onError: error => { setUploadProgress(null); toast.error(errorMessage(error)); },
  });

  const stats = list.data?.stats;

  return (
    <>
      <PageHeader
        title="Backup & Restore"
        description="Create full backups of the database and files, schedule automatic backups, and restore the whole website from any backup."
        actions={<div className="flex flex-wrap gap-2"><Button icon={<Upload />} onClick={() => setUploadModal(true)}>Upload backup</Button><Button variant="primary" icon={<Play />} onClick={() => setBackupModal(true)}>Backup now</Button></div>}
      />

      {/* Dashboard tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={<Archive className="size-4" />} label="Backups" value={stats?.total ?? '—'} sub={stats ? `${stats.success} ok · ${stats.failed} failed` : undefined} />
        <StatTile icon={<Clock className="size-4" />} label="Latest" value={stats?.lastBackupAt ? timeAgo(stats.lastBackupAt) : 'None yet'} sub={stats?.lastBackupAt ? formatDateTime(stats.lastBackupAt) : undefined} />
        <StatTile icon={<CalendarClock className="size-4" />} label="Next run" value={stats?.nextBackupAt ? timeAgo(stats.nextBackupAt) : 'Off'} sub={stats?.nextBackupAt ? formatDateTime(stats.nextBackupAt) : 'Scheduling disabled'} />
        <StatTile icon={<HardDrive className="size-4" />} label="Storage" value={stats ? formatBytes(stats.totalSize) : '—'} />
        <StatTile icon={stats?.scheduleEnabled ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} label="Scheduler" value={stats?.scheduleEnabled ? 'Active' : 'Inactive'} />
        <StatTile icon={<Loader2 className="size-4" />} label="In progress" value={stats?.running ?? 0} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'history', label: 'Backup history' }, { value: 'schedule', label: 'Schedule & retention' }]} className="mb-4" />

      {tab === 'history' ? (
        <Card>
          <CardHeader
            title="Backups"
            description="Download, restore, or delete any backup."
            actions={
              <div className="flex flex-wrap gap-2">
                <SelectField label="" value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={[{ value: '', label: 'All types' }, { value: 'MANUAL', label: 'Manual' }, { value: 'DAILY', label: 'Daily' }, { value: 'WEEKLY', label: 'Weekly' }, { value: 'MONTHLY', label: 'Monthly' }, { value: 'PRE_RESTORE', label: 'Pre-restore' }]} />
                <SelectField label="" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={[{ value: '', label: 'All statuses' }, { value: 'SUCCESS', label: 'Completed' }, { value: 'RUNNING', label: 'Running' }, { value: 'FAILED', label: 'Failed' }]} />
                <SelectField label="" value={sort} onChange={setSort} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'largest', label: 'Largest' }, { value: 'smallest', label: 'Smallest' }]} />
              </div>
            }
          />
          {list.isLoading ? (
            <PageLoader />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : !list.data?.items.length ? (
            <EmptyState icon={<Archive />} title="No backups yet" description="Click “Backup now” to create your first backup." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-[12px] tracking-wide text-zinc-500 uppercase">
                      <th className="px-5 py-2.5 font-medium">Backup</th>
                      <th className="px-3 py-2.5 font-medium">Type</th>
                      <th className="px-3 py-2.5 font-medium">Contents</th>
                      <th className="px-3 py-2.5 font-medium">Size</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Created</th>
                      <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {list.data.items.map((b) => (
                      <tr key={b.id} className="align-middle">
                        <td className="max-w-xs px-5 py-3">
                          <div className="truncate font-medium text-zinc-900">{b.name}</div>
                          {b.status === 'FAILED' && b.error && <div className="mt-0.5 flex items-start gap-1 text-xs text-red-600"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{b.error}</div>}
                        </td>
                        <td className="px-3 py-3"><Badge tone={typeTone[b.type]}>{typeLabel[b.type]}</Badge></td>
                        <td className="px-3 py-3 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-2">
                            {b.includesDb && <span className="inline-flex items-center gap-1"><Database className="size-3.5" />DB</span>}
                            {b.includesFiles && <span className="inline-flex items-center gap-1"><HardDrive className="size-3.5" />Files</span>}
                            {b.includesCode && <span className="inline-flex items-center gap-1"><Code2 className="size-3.5" />Code</span>}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-zinc-600 tabular-nums">{b.status === 'SUCCESS' ? formatBytes(b.sizeBytes) : '—'}</td>
                        <td className="px-3 py-3"><StatusBadge row={b} /></td>
                        <td className="px-3 py-3 text-xs text-zinc-500" title={formatDateTime(b.createdAt)}>{timeAgo(b.createdAt)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {b.status === 'SUCCESS' && (
                              <a href={`/api/admin/backups/${b.id}/download`} onClick={(event) => void sensitiveDownload(event, `/api/admin/backups/${b.id}/download`)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" title="Download" aria-label="Download backup"><Download className="size-4" /></a>
                            )}
                            <IconButton
                              label="Restore from this backup"
                              className="hover:text-brand-700"
                              disabled={b.status !== 'SUCCESS' || restore.isPending}
                              onClick={async () => {
                                if (
                                  await confirm({
                                    title: 'Restore the website from this backup?',
                                    message: `This replaces the current ${b.includesDb ? 'database' : ''}${b.includesDb && b.includesFiles ? ' and ' : ''}${b.includesFiles ? 'uploaded files' : ''} with the contents of “${b.name}”. A safety backup of the current state is taken automatically first. This cannot be undone except by restoring that safety backup.`,
                                    confirmLabel: 'Restore now',
                                    tone: 'danger',
                                  })
                                )
                                  restore.mutate(b.id);
                              }}
                            >
                              <RotateCcw className="size-4" />
                            </IconButton>
                            <IconButton
                              label="Delete backup"
                              className="hover:text-red-600"
                              disabled={b.status === 'RUNNING' || b.restoring}
                              onClick={async () => {
                                if (await confirm({ title: 'Delete this backup?', message: `“${b.name}” will be permanently removed from storage.`, confirmLabel: 'Delete', tone: 'danger' })) remove.mutate(b.id);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {list.data.pages > 1 && <div className="border-t border-zinc-100 p-4"><Pagination page={page} pages={list.data.pages} onChange={setPage} /></div>}
            </>
          )}
        </Card>
      ) : (
        <ScheduleCard initial={settingsQuery.data?.settings} loading={settingsQuery.isLoading} />
      )}

      {/* Backup now modal */}
      <Modal
        open={uploadModal}
        onClose={() => { if (!uploadBackup.isPending) { setUploadModal(false); setUploadFile(null); setUploadProgress(null); } }}
        size="sm"
        title="Upload a backup"
        footer={<><Button disabled={uploadBackup.isPending} onClick={() => { setUploadModal(false); setUploadFile(null); setUploadProgress(null); }}>Cancel</Button><Button variant="primary" icon={<Upload />} disabled={!uploadFile || uploadFile.size > MAX_BACKUP_UPLOAD_BYTES} loading={uploadBackup.isPending} onClick={() => uploadBackup.mutate()}>{uploadProgress === null ? 'Upload backup' : `Uploading ${uploadProgress}%`}</Button></>}
      >
        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-medium text-zinc-700">
            <span>Backup archive</span>
            <input type="file" accept=".gz,.enc" disabled={uploadBackup.isPending} onChange={event => setUploadFile(event.target.files?.[0] ?? null)} className="block w-full rounded-lg border border-zinc-200 p-2 text-sm" />
          </label>
          <p className="text-sm text-zinc-500">Choose a Nextract .tar.gz backup, up to 5 GB. Large files are uploaded in secure 16 MB chunks. Older .tar.gz.enc backups from this website are also supported.</p>
          {uploadFile && <p className="text-sm text-zinc-600">{uploadFile.name} · {formatBytes(uploadFile.size)}</p>}
          {uploadFile && uploadFile.size > MAX_BACKUP_UPLOAD_BYTES && <Notice tone="warn">The backup must be no larger than 5 GB.</Notice>}
          <Notice tone="info">The archive is checked and added to your backup history. To apply it, select Restore after uploading. A safety backup is created before restoration.</Notice>
        </div>
      </Modal>
      <Modal
        open={backupModal}
        onClose={() => setBackupModal(false)}
        size="sm"
        title="Create a backup now"
        footer={<><Button onClick={() => setBackupModal(false)}>Cancel</Button><Button variant="primary" icon={<Play />} loading={createBackup.isPending} onClick={() => createBackup.mutate()}>Start backup</Button></>}
      >
        <div className="space-y-4">
          <TextField label="Name (optional)" value={name} onChange={setName} placeholder="e.g. Before big update" />
          <div className="space-y-2">
            <Checkbox checked={includeDb} onChange={setIncludeDb} label="Database — all content, settings, users" />
            <Checkbox checked={includeFiles} onChange={setIncludeFiles} label="Website files — media library, images & videos" />
            <Checkbox checked={includeCode} onChange={setIncludeCode} label="Source code — a self-contained copy of the whole site (larger)" />
          </div>
          <Notice tone="info" title="Recommended">Keep Database + Website files on for a complete content backup you can fully restore. Add Source code for a full disaster-recovery copy.</Notice>
          {!includeDb && !includeFiles && !includeCode && <Notice tone="warn" title="Choose at least one">Select at least one part to back up.</Notice>}
        </div>
      </Modal>
    </>
  );
}

function ScheduleCard({ initial, loading }: { initial?: Settings; loading: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Settings | null>(null);
  const current = draft ?? initial ?? null;

  const save = useMutation({
    mutationFn: (settings: Settings) => put('/api/admin/backups/settings', settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-settings'] });
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup schedule saved');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (loading || !current) return <Card><PageLoader /></Card>;
  const set = (patch: Partial<Settings>) => setDraft({ ...current, ...patch });
  const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Number(v) || min));

  return (
    <Card className="p-6">
      <div className="max-w-2xl space-y-6">
        <Switch
          checked={current.enabled}
          onChange={(enabled) => set({ enabled })}
          label="Automatic backups"
          description="Run backups on a schedule without anyone signing in. The server performs them in the background."
        />

        <div className={current.enabled ? 'space-y-5' : 'pointer-events-none space-y-5 opacity-50'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="How often" value={current.frequency} onChange={(v) => set({ frequency: v as Settings['frequency'] })} options={[{ value: 'daily', label: 'Every day' }, { value: 'weekly', label: 'Every week' }, { value: 'monthly', label: 'Every month' }]} />
            <TextField label="Time of day" type="time" value={current.time} onChange={(time) => set({ time })} />
            {current.frequency === 'weekly' && (
              <SelectField label="Day of week" value={String(current.weekday)} onChange={(v) => set({ weekday: Number(v) })} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} />
            )}
            {current.frequency === 'monthly' && (
              <SelectField label="Day of month" value={String(current.monthday)} onChange={(v) => set({ monthday: num(v, 1, 28) })} options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
            )}
            <SelectField label="Timezone" value={current.timezone} onChange={(timezone) => set({ timezone })} options={[current.timezone, ...COMMON_TIME_ZONES.filter((z) => z !== current.timezone)].map((z) => ({ value: z, label: z }))} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">What to include</p>
            <div className="space-y-2">
              <Checkbox checked={current.includeDb} onChange={(includeDb) => set({ includeDb })} label="Database — all content, settings, users" />
              <Checkbox checked={current.includeFiles} onChange={(includeFiles) => set({ includeFiles })} label="Website files — media library, images & videos" />
              <Checkbox checked={current.includeCode} onChange={(includeCode) => set({ includeCode })} label="Source code — full self-contained copy (larger)" />
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-zinc-700">Retention — how many to keep</p>
            <p className="mb-3 text-xs text-zinc-500">Older backups beyond these counts are removed automatically. A backup being created or restored is never deleted.</p>
            <div className="grid gap-4 sm:grid-cols-4">
              <TextField label="Daily" type="number" value={String(current.retentionDaily)} onChange={(v) => set({ retentionDaily: num(v, 1, 365) })} />
              <TextField label="Weekly" type="number" value={String(current.retentionWeekly)} onChange={(v) => set({ retentionWeekly: num(v, 1, 260) })} />
              <TextField label="Monthly" type="number" value={String(current.retentionMonthly)} onChange={(v) => set({ retentionMonthly: num(v, 1, 120) })} />
              <TextField label="Manual" type="number" value={String(current.retentionManual)} onChange={(v) => set({ retentionManual: num(v, 1, 500) })} />
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-zinc-100 pt-4">
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(current)}>Save schedule</Button>
        </div>
      </div>
    </Card>
  );
}
