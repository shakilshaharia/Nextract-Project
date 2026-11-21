import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { broadcastStatuses } from '@workspace/cms-content';
import { Mail, Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialog';
import { StringListEditor } from '@/components/list-editor';
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorState, IconButton, Input, Notice, PageHeader, PageLoader, TextAreaField, TextField } from '@/components/ui';
import { del, errorMessage, get, post, put } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useUnsavedChanges } from '@/lib/hooks';

type Status = (typeof broadcastStatuses)[number];
type Summary = { id: string; subject: string; status: Status; scheduledAt: string | null; sentAt: string | null; recipients: number; sent: number; failed: number; opens: number; updatedAt: string };
type Detail = { id: string; subject: string; preheader: string; bodyHtml: string; status: Status; audienceTags: string[]; scheduledAt: string | null; sentAt: string | null; recipients: number; sent: number; failed: number; opens: number };

const statusTone: Record<Status, 'green' | 'amber' | 'blue' | undefined> = { DRAFT: undefined, SCHEDULED: 'amber', SENDING: 'blue', SENT: 'green' };
const statusLabel: Record<Status, string> = { DRAFT: 'Draft', SCHEDULED: 'Scheduled', SENDING: 'Sending…', SENT: 'Sent' };
const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

// ---------------------------------------------------------------------------

export function BroadcastsListPage() {
  const [, navigate] = useLocation();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['broadcasts'], queryFn: ({ signal }) => get<{ items: Summary[] }>('/api/admin/broadcasts', signal), refetchInterval: 15_000 });
  const [subject, setSubject] = useState('');
  const create = useMutation({ mutationFn: () => post<{ broadcast: { id: string } }>('/api/admin/broadcasts', { subject }), onSuccess: (r) => navigate(`/broadcasts/${r.broadcast.id}`), onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/admin/broadcasts/${id}`), onSuccess: () => { toast.success('Broadcast deleted.'); queryClient.invalidateQueries({ queryKey: ['broadcasts'] }); } });

  return (
    <>
      <PageHeader title="Broadcasts" description="Email campaigns sent to your subscribers." actions={<ButtonLink href="/subscribers" variant="subtle" size="sm">Manage subscribers</ButtonLink>} />
      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-48"><label className="mb-1.5 block text-[13px] font-medium text-zinc-800">Subject</label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Product update — November" onKeyDown={(e) => e.key === 'Enter' && subject.trim() && create.mutate()} /></div>
        <Button variant="primary" icon={<Plus />} loading={create.isPending} disabled={!subject.trim()} onClick={() => create.mutate()}>New broadcast</Button>
      </Card>
      {list.isLoading ? <PageLoader /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (list.data?.items.length ? (
        <Card className="divide-y divide-zinc-100">
          {list.data.items.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <Link href={`/broadcasts/${b.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">{b.subject || 'Untitled broadcast'}</span>
                <span className="block text-[11px] text-zinc-500">{b.status === 'SENT' && b.sentAt ? `Sent ${formatDate(b.sentAt)}` : b.status === 'SCHEDULED' && b.scheduledAt ? `Scheduled ${formatDateTime(b.scheduledAt)}` : 'Not sent'}</span>
              </Link>
              <Badge tone={statusTone[b.status]}>{statusLabel[b.status]}</Badge>
              {(b.status === 'SENT' || b.status === 'SENDING') && <span className="text-xs text-zinc-500" title="Sent · Opens · Failed">{b.sent} · {b.opens} · {b.failed}</span>}
              <span className="w-24 text-right text-xs text-zinc-500">{formatDate(b.updatedAt)}</span>
              <ButtonLink href={`/broadcasts/${b.id}`} size="sm" variant="subtle">{b.status === 'SENT' ? 'View' : 'Edit'}</ButtonLink>
              <IconButton label="Delete" className="hover:text-red-600" onClick={async () => { if (await confirm({ title: `Delete “${b.subject || 'this broadcast'}”?`, message: 'This cannot be undone.', confirmLabel: 'Delete' })) remove.mutate(b.id); }}><Trash2 /></IconButton>
            </div>
          ))}
        </Card>
      ) : <EmptyState icon={<Mail />} title="No broadcasts yet" description="Create your first email broadcast above." />)}
    </>
  );
}

// ---------------------------------------------------------------------------

export function BroadcastEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['broadcasts', id],
    queryFn: ({ signal }) => get<{ broadcast: Detail }>(`/api/admin/broadcasts/${id}`, signal),
    refetchInterval: (q) => (q.state.data?.broadcast.status === 'SENDING' ? 3_000 : false),
  });
  const [item, setItem] = useState<Detail | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');

  useEffect(() => { if (query.data) { setItem(query.data.broadcast); setScheduleAt(toLocal(query.data.broadcast.scheduledAt)); } }, [query.data]);
  const locked = item?.status === 'SENDING' || item?.status === 'SENT';
  const dirty = Boolean(query.data && item && !locked && (item.subject !== query.data.broadcast.subject || item.preheader !== query.data.broadcast.preheader || item.bodyHtml !== query.data.broadcast.bodyHtml || JSON.stringify(item.audienceTags) !== JSON.stringify(query.data.broadcast.audienceTags)));
  useUnsavedChanges(dirty);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['broadcasts'] }); };
  const save = useMutation({
    mutationFn: () => put<{ broadcast: Detail }>(`/api/admin/broadcasts/${id}`, { subject: item!.subject, preheader: item!.preheader, bodyHtml: item!.bodyHtml, audienceTags: item!.audienceTags }),
    onSuccess: (r) => { toast.success('Saved.'); setItem(r.broadcast); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sendTest = useMutation({ mutationFn: () => post(`/api/admin/broadcasts/${id}/test`, { to: testEmail }), onSuccess: () => toast.success(`Test sent to ${testEmail}.`), onError: (e) => toast.error(errorMessage(e)) });
  const schedule = useMutation({
    mutationFn: (scheduledAt: string | null) => post(`/api/admin/broadcasts/${id}/schedule`, { scheduledAt }),
    onSuccess: () => { toast.success('Schedule updated.'); query.refetch(); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const send = useMutation({
    mutationFn: () => post(`/api/admin/broadcasts/${id}/send`),
    onSuccess: () => { toast.success('Sending started.'); query.refetch(); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (query.isLoading || !item) return query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : <PageLoader />;

  async function saveBeforeSend() {
    if (dirty) await save.mutateAsync();
  }

  return (
    <>
      <PageHeader title={item.subject || 'Broadcast'} description="Compose and send to your subscribers." back={<Link href="/broadcasts" className="text-sm text-brand-700 hover:underline">← Broadcasts</Link>} actions={
        <div className="flex items-center gap-3">
          <Badge tone={statusTone[item.status]}>{statusLabel[item.status]}</Badge>
          {!locked && <Button variant="primary" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>Save</Button>}
        </div>
      } />

      {locked && (
        <Notice tone={item.status === 'SENT' ? 'success' : 'info'} className="mb-4" title={item.status === 'SENT' ? 'This broadcast has been sent' : 'This broadcast is sending'}>
          {item.recipients} recipient{item.recipients === 1 ? '' : 's'} · {item.sent} sent · {item.opens} open{item.opens === 1 ? '' : 's'}{item.failed ? ` · ${item.failed} failed` : ''}{item.sentAt ? ` · ${formatDateTime(item.sentAt)}` : ''}
        </Notice>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <p className="text-sm font-semibold text-zinc-900">Email content</p>
            <TextField label="Subject" value={item.subject} onChange={(v) => setItem({ ...item, subject: v })} counter={300} disabled={locked} />
            <TextField label="Preheader" value={item.preheader} onChange={(v) => setItem({ ...item, preheader: v })} hint="Preview text shown after the subject in most inboxes." disabled={locked} />
            <TextAreaField label="Message (HTML)" value={item.bodyHtml} onChange={(v) => setItem({ ...item, bodyHtml: v })} rows={14} className="[&_textarea]:font-mono [&_textarea]:text-xs" hint="Basic HTML is supported. An unsubscribe link is added automatically." disabled={locked} />
          </Card>
          {item.bodyHtml.trim() && (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500">Preview</div>
              <div className="bg-zinc-50 p-6"><div className="mx-auto max-w-[600px] rounded-lg bg-white p-6 shadow-sm" dangerouslySetInnerHTML={{ __html: item.bodyHtml }} /></div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <p className="text-sm font-medium text-zinc-800">Audience</p>
            <StringListEditor label="Only subscribers with tags" values={item.audienceTags} onChange={(v) => setItem({ ...item, audienceTags: v })} placeholder="newsletter" addLabel="Add tag" hint="Leave empty to send to all active subscribers." />
          </Card>

          {!locked && (
            <>
              <Card className="space-y-3 p-5">
                <p className="text-sm font-medium text-zinc-800">Send a test</p>
                <Input type="email" value={testEmail} placeholder="you@company.com" onChange={(e) => setTestEmail(e.target.value)} />
                <Button size="sm" variant="secondary" loading={sendTest.isPending} disabled={!testEmail.trim()} onClick={async () => { await saveBeforeSend(); sendTest.mutate(); }}>Send test</Button>
              </Card>

              <Card className="space-y-3 p-5">
                <p className="text-sm font-medium text-zinc-800">Schedule</p>
                <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" loading={schedule.isPending} disabled={!scheduleAt} onClick={async () => { await saveBeforeSend(); schedule.mutate(scheduleAt); }}>{item.status === 'SCHEDULED' ? 'Reschedule' : 'Schedule'}</Button>
                  {item.status === 'SCHEDULED' && <Button size="sm" variant="subtle" loading={schedule.isPending} onClick={() => schedule.mutate(null)}>Cancel schedule</Button>}
                </div>
                {item.status === 'SCHEDULED' && item.scheduledAt && <p className="text-xs text-amber-700">Scheduled for {formatDateTime(item.scheduledAt)}.</p>}
              </Card>

              <Card className="space-y-3 p-5">
                <p className="text-sm font-medium text-zinc-800">Send now</p>
                <p className="text-xs text-zinc-500">Delivers immediately to all matching active subscribers.</p>
                <Button variant="primary" icon={<Send />} loading={send.isPending} onClick={async () => { if (await confirm({ title: 'Send this broadcast now?', message: 'It will be emailed to all matching active subscribers. This cannot be undone.', confirmLabel: 'Send now' })) { await saveBeforeSend(); send.mutate(); } }}>Send now</Button>
              </Card>
            </>
          )}

          {!locked && (
            <div className="flex justify-end">
              <IconButton label="Delete broadcast" className="hover:text-red-600" onClick={async () => { if (await confirm({ title: `Delete “${item.subject || 'this broadcast'}”?`, message: 'This cannot be undone.', confirmLabel: 'Delete' })) { await del(`/api/admin/broadcasts/${id}`); toast.success('Deleted.'); invalidate(); window.history.back(); } }}><Trash2 /></IconButton>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
