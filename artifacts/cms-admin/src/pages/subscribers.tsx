import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subscriberStatuses, type NewsletterSettings } from '@workspace/cms-content';
import { Download, Trash2, Upload, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialog';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, Input, PageHeader, PageLoader, Pagination, SelectField, Switch, TextAreaField, TextField } from '@/components/ui';
import { del, errorMessage, get, post, put, sensitiveDownload } from '@/lib/api';
import { formatDate } from '@/lib/format';

type Status = (typeof subscriberStatuses)[number];
type Subscriber = { id: string; email: string; name: string; status: Status; tags: string[]; source: string; createdAt: string };
type Stats = { active: number; pending: number; unsubscribed: number; total: number };
type Paged = { items: Subscriber[]; page: number; pages: number; total: number };

const statusTone: Record<Status, 'green' | 'amber' | undefined> = { ACTIVE: 'green', PENDING: 'amber', UNSUBSCRIBED: undefined };
const statusLabel: Record<Status, string> = { ACTIVE: 'Active', PENDING: 'Pending', UNSUBSCRIBED: 'Unsubscribed' };

export function SubscribersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['subscribers'] }); queryClient.invalidateQueries({ queryKey: ['subscriber-stats'] }); };

  const stats = useQuery({ queryKey: ['subscriber-stats'], queryFn: ({ signal }) => get<Stats>('/api/admin/subscribers/stats', signal) });
  const list = useQuery({ queryKey: ['subscribers', page, status, q], queryFn: ({ signal }) => get<Paged>(`/api/admin/subscribers?page=${page}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`, signal), placeholderData: (p) => p });

  const [newEmail, setNewEmail] = useState('');
  const add = useMutation({ mutationFn: () => post('/api/admin/subscribers', { email: newEmail, status: 'ACTIVE' }), onSuccess: () => { setNewEmail(''); toast.success('Subscriber added.'); invalidate(); }, onError: (e) => toast.error(errorMessage(e)) });
  const update = useMutation({ mutationFn: (s: Subscriber) => put(`/api/admin/subscribers/${s.id}`, { name: s.name, status: s.status, tags: s.tags }), onSuccess: invalidate, onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/admin/subscribers/${id}`), onSuccess: () => { toast.success('Removed.'); invalidate(); } });

  const [importText, setImportText] = useState('');
  const [importTags, setImportTags] = useState('');
  const doImport = useMutation({
    mutationFn: () => {
      const rows = importText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => { const [email, name] = line.split(/[,\t]/); return { email: email.trim(), name: (name ?? '').trim() }; });
      return post<{ added: number; skipped: number }>('/api/admin/subscribers/import', { rows, tags: importTags.split(',').map((t) => t.trim()).filter(Boolean) });
    },
    onSuccess: (r) => { toast.success(`Imported ${r.added} subscriber${r.added === 1 ? '' : 's'}${r.skipped ? `, skipped ${r.skipped}` : ''}.`); setImportText(''); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Subscribers" description="Your newsletter audience." actions={<a href="/api/admin/subscribers/export" onClick={(event) => void sensitiveDownload(event, '/api/admin/subscribers/export')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"><Download className="size-4" /> Export CSV</a>} />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {(['total', 'active', 'pending', 'unsubscribed'] as const).map((k) => (
          <Card key={k} className="p-4"><p className="text-2xl font-semibold text-zinc-900">{stats.data?.[k] ?? '—'}</p><p className="text-xs capitalize text-zinc-500">{k}</p></Card>
        ))}
      </div>

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-48"><label className="mb-1.5 block text-[13px] font-medium text-zinc-800">Add subscriber</label><Input type="email" value={newEmail} placeholder="name@company.com" onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newEmail && add.mutate()} /></div>
        <Button variant="primary" loading={add.isPending} disabled={!newEmail.trim()} onClick={() => add.mutate()}>Add</Button>
      </Card>

      <details className="mb-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700"><Upload className="mr-1 inline size-4" /> Import from CSV</summary>
        <Card className="mt-2 space-y-3 p-4">
          <TextAreaField label="Paste rows (email,name — one per line)" value={importText} onChange={setImportText} rows={5} className="[&_textarea]:font-mono [&_textarea]:text-xs" />
          <TextField label="Tags to apply (comma-separated)" value={importTags} onChange={setImportTags} placeholder="newsletter, webinar" />
          <Button size="sm" loading={doImport.isPending} disabled={!importText.trim()} onClick={() => doImport.mutate()}>Import</Button>
        </Card>
      </details>

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <SelectField label="Status" className="w-44" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'All statuses' }, ...subscriberStatuses.map((s) => ({ value: s, label: statusLabel[s] }))]} />
        <div className="flex-1 min-w-48"><label className="mb-1.5 block text-[13px] font-medium text-zinc-800">Search</label><Input value={q} placeholder="email or name" onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      </Card>

      {list.isLoading ? <PageLoader /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (list.data?.items.length ? (
        <>
          <Card className="divide-y divide-zinc-100">
            {list.data.items.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-zinc-900">{s.email}</span>{s.name && <span className="block truncate text-xs text-zinc-500">{s.name}</span>}</div>
                <Input className="w-56 text-xs" placeholder="tags (comma-separated)" defaultValue={(s.tags ?? []).join(', ')} onBlur={(e) => { const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean); if (JSON.stringify(tags) !== JSON.stringify(s.tags ?? [])) update.mutate({ ...s, tags }); }} />
                <select className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs" value={s.status} onChange={(e) => update.mutate({ ...s, status: e.target.value as Status })}>
                  {subscriberStatuses.map((st) => <option key={st} value={st}>{statusLabel[st]}</option>)}
                </select>
                {statusTone[s.status] ? <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge> : null}
                <span className="w-24 text-right text-xs text-zinc-500">{formatDate(s.createdAt)}</span>
                <IconButton label="Delete" className="hover:text-red-600" onClick={async () => { if (await confirm({ title: `Remove ${s.email}?`, message: 'They are permanently deleted.', confirmLabel: 'Remove' })) remove.mutate(s.id); }}><Trash2 /></IconButton>
              </div>
            ))}
          </Card>
          <Pagination page={list.data.page} pages={list.data.pages} onChange={setPage} />
        </>
      ) : <EmptyState icon={<Users />} title="No subscribers yet" description="Add one above, import a CSV, or add a signup form to your site." />)}

      <NewsletterSettingsCard />
    </>
  );
}

function NewsletterSettingsCard() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: ({ signal }) => get<{ newsletter: NewsletterSettings }>('/api/admin/settings', signal) });
  const [settings, setSettings] = useState<NewsletterSettings | null>(null);
  useEffect(() => { if (query.data) setSettings(query.data.newsletter); }, [query.data]);
  const dirty = Boolean(query.data && settings && JSON.stringify(settings) !== JSON.stringify(query.data.newsletter));
  const save = useMutation({ mutationFn: () => put('/api/admin/settings/newsletter', settings), onSuccess: () => { toast.success('Newsletter settings saved.'); queryClient.invalidateQueries({ queryKey: ['settings'] }); }, onError: (e) => toast.error(errorMessage(e)) });
  if (!settings) return null;
  const set = <K extends keyof NewsletterSettings>(k: K) => (v: NewsletterSettings[K]) => setSettings({ ...settings, [k]: v });
  return (
    <Card className="mt-6 max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-zinc-900">Newsletter settings</p>{dirty && <Button size="sm" variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}</div>
      <Switch checked={settings.enabled} onChange={set('enabled')} label="Signups enabled" />
      <Switch checked={settings.doubleOptIn} onChange={set('doubleOptIn')} label="Double opt-in" description="Require new subscribers to confirm by email before becoming active." />
      <TextField label="Sender name" value={settings.fromName} onChange={set('fromName')} placeholder="Falls back to Email settings" />
      <TextField label="Confirmation email subject" value={settings.confirmSubject} onChange={set('confirmSubject')} />
      <TextAreaField label="Confirmation email message" value={settings.confirmBody} onChange={set('confirmBody')} rows={2} />
      <TextField label="Message after signup (pending)" value={settings.successMessage} onChange={set('successMessage')} />
      <TextField label="Message when confirmed / subscribed" value={settings.welcomeMessage} onChange={set('welcomeMessage')} />
    </Card>
  );
}
