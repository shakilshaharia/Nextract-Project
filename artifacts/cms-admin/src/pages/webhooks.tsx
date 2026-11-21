import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { webhookDeliveryStatuses, webhookEventLabels, webhookEvents, webhookFormats, type WebhookEvent, type WebhookFormat } from '@workspace/cms-content';
import { Check, Copy, Plus, RefreshCw, Send, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialog';
import { Badge, Button, ButtonLink, Card, Checkbox, EmptyState, ErrorState, IconButton, Input, Notice, PageHeader, PageLoader, SelectField, Switch, TextField } from '@/components/ui';
import { del, errorMessage, fieldErrors, get, post, put } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useUnsavedChanges } from '@/lib/hooks';

type Summary = { id: string; name: string; url: string; format: WebhookFormat; events: WebhookEvent[]; enabled: boolean; updatedAt: string };
type Detail = Summary & { secret: string };
type Delivery = { id: string; event: string; status: (typeof webhookDeliveryStatuses)[number]; statusCode: number | null; attempts: number; error: string; response: string; nextAttempt: string | null; createdAt: string; deliveredAt: string | null };

const formatLabels: Record<WebhookFormat, string> = { JSON: 'JSON (signed payload)', SLACK: 'Slack message' };
const statusTone: Record<Delivery['status'], 'green' | 'amber' | 'red'> = { SUCCESS: 'green', PENDING: 'amber', FAILED: 'red' };

// ---------------------------------------------------------------------------

export function WebhooksListPage() {
  const [, navigate] = useLocation();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['webhooks'], queryFn: ({ signal }) => get<{ items: Summary[] }>('/api/admin/webhooks', signal) });
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const create = useMutation({ mutationFn: () => post<{ webhook: { id: string } }>('/api/admin/webhooks', { name, url }), onSuccess: (r) => navigate(`/webhooks/${r.webhook.id}`), onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/admin/webhooks/${id}`), onSuccess: () => { toast.success('Webhook deleted.'); queryClient.invalidateQueries({ queryKey: ['webhooks'] }); } });

  return (
    <>
      <PageHeader title="Webhooks & integrations" description="Send signed events to Slack, Zapier, Make, or any endpoint when things happen on your site." />
      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-40"><label className="mb-1.5 block text-[13px] font-medium text-zinc-800">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slack #leads" /></div>
        <div className="flex-1 min-w-56"><label className="mb-1.5 block text-[13px] font-medium text-zinc-800">Endpoint URL</label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.slack.com/…" /></div>
        <Button variant="primary" icon={<Plus />} loading={create.isPending} disabled={!name.trim() || !url.trim()} onClick={() => create.mutate()}>Add</Button>
      </Card>
      {list.isLoading ? <PageLoader /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (list.data?.items.length ? (
        <Card className="divide-y divide-zinc-100">
          {list.data.items.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <Link href={`/webhooks/${w.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">{w.name}</span>
                <span className="block truncate font-mono text-[11px] text-zinc-500">{w.url}</span>
              </Link>
              <Badge>{w.format}</Badge>
              <span className="text-xs text-zinc-500">{w.events.length} event{w.events.length === 1 ? '' : 's'}</span>
              {w.enabled ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}
              <ButtonLink href={`/webhooks/${w.id}`} size="sm" variant="subtle">Edit</ButtonLink>
              <IconButton label="Delete" className="hover:text-red-600" onClick={async () => { if (await confirm({ title: `Delete “${w.name}”?`, message: 'It stops receiving events immediately.', confirmLabel: 'Delete' })) remove.mutate(w.id); }}><Trash2 /></IconButton>
            </div>
          ))}
        </Card>
      ) : <EmptyState icon={<WebhookIcon />} title="No webhooks yet" description="Add an endpoint above to start sending events." />)}
    </>
  );
}

// ---------------------------------------------------------------------------

export function WebhookEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['webhooks', id], queryFn: ({ signal }) => get<{ webhook: Detail }>(`/api/admin/webhooks/${id}`, signal) });
  const deliveries = useQuery({ queryKey: ['webhooks', id, 'deliveries'], queryFn: ({ signal }) => get<{ items: Delivery[] }>(`/api/admin/webhooks/${id}/deliveries`, signal) });
  const [item, setItem] = useState<Detail | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (query.data) setItem(query.data.webhook); }, [query.data]);
  const dirty = Boolean(query.data && item && JSON.stringify(item) !== JSON.stringify(query.data.webhook));
  useUnsavedChanges(dirty);

  const save = useMutation({
    mutationFn: () => put<{ webhook: Detail }>(`/api/admin/webhooks/${id}`, { name: item!.name, url: item!.url, format: item!.format, events: item!.events, enabled: item!.enabled }),
    onSuccess: (r) => { toast.success('Webhook saved.'); setErrors({}); setItem(r.webhook); queryClient.invalidateQueries({ queryKey: ['webhooks'] }); },
    onError: (e) => { setErrors(fieldErrors(e)); toast.error(errorMessage(e)); },
  });
  const regenerate = useMutation({
    mutationFn: () => post<{ secret: string }>(`/api/admin/webhooks/${id}/regenerate-secret`),
    onSuccess: (r) => { toast.success('New signing secret generated.'); setItem((p) => (p ? { ...p, secret: r.secret } : p)); queryClient.setQueryData(['webhooks', id], (d: { webhook: Detail } | undefined) => (d ? { webhook: { ...d.webhook, secret: r.secret } } : d)); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const test = useMutation({
    mutationFn: () => post<{ ok: boolean; status: string; statusCode: number | null; error: string }>(`/api/admin/webhooks/${id}/test`),
    onSuccess: (r) => { r.ok ? toast.success(`Test delivered (HTTP ${r.statusCode}).`) : toast.error(`Test failed: ${r.error || r.status}`); deliveries.refetch(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (query.isLoading || !item) return query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : <PageLoader />;

  const toggleEvent = (event: WebhookEvent, on: boolean) => setItem({ ...item, events: on ? [...item.events, event] : item.events.filter((e) => e !== event) });
  const copySecret = async () => { try { await navigator.clipboard.writeText(item.secret); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toast.error('Could not copy.'); } };

  return (
    <>
      <PageHeader title={item.name || 'Webhook'} description="Where events go and which ones to send." back={<Link href="/webhooks" className="text-sm text-brand-700 hover:underline">← Webhooks</Link>} actions={
        <div className="flex items-center gap-3">{dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}<Button variant="primary" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>Save</Button></div>
      } />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <TextField label="Name" value={item.name} onChange={(v) => setItem({ ...item, name: v })} error={errors.name} />
            <TextField label="Endpoint URL" value={item.url} onChange={(v) => setItem({ ...item, url: v })} error={errors.url} hint="Must be a public https:// URL. Internal and private addresses are blocked." />
            <SelectField label="Payload format" value={item.format} onChange={(v) => setItem({ ...item, format: v as WebhookFormat })} options={webhookFormats.map((f) => ({ value: f, label: formatLabels[f] }))} />
            {item.format === 'SLACK' && <Notice tone="info">Slack format sends a short human-readable message as <code>{'{ text }'}</code> — paste a Slack “Incoming Webhook” URL.</Notice>}
          </Card>

          <Card className="space-y-3 p-5">
            <p className="text-sm font-semibold text-zinc-900">Events to send</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {webhookEvents.map((event) => (
                <Checkbox key={event} checked={item.events.includes(event)} onChange={(on) => toggleEvent(event, on)} label={webhookEventLabels[event]} />
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3"><p className="text-sm font-semibold text-zinc-900">Recent deliveries</p><Button size="sm" variant="subtle" onClick={() => deliveries.refetch()}>Refresh</Button></div>
            {deliveries.isLoading ? <div className="p-5"><PageLoader /></div> : deliveries.data?.items.length ? (
              <div className="divide-y divide-zinc-100">
                {deliveries.data.items.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-xs">
                    <Badge tone={statusTone[d.status]}>{d.status}</Badge>
                    <span className="font-mono text-zinc-700">{d.event}</span>
                    {d.statusCode ? <span className="text-zinc-500">HTTP {d.statusCode}</span> : null}
                    {d.attempts > 1 ? <span className="text-zinc-400">{d.attempts} attempts</span> : null}
                    <span className="ml-auto text-zinc-400">{formatDateTime(d.deliveredAt ?? d.createdAt)}</span>
                    {d.error ? <span className="w-full truncate text-red-600" title={d.error}>{d.error}</span> : null}
                  </div>
                ))}
              </div>
            ) : <div className="px-5 py-8 text-center text-sm text-zinc-500">No deliveries yet. Save the webhook, then send a test.</div>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <Switch checked={item.enabled} onChange={(v) => setItem({ ...item, enabled: v })} label="Enabled" description="Turn off to pause without deleting." />
          </Card>

          <Card className="space-y-3 p-5">
            <p className="text-sm font-medium text-zinc-800">Signing secret</p>
            <p className="text-xs text-zinc-500">For JSON payloads we add an <code>X-Nextract-Signature: sha256=…</code> header (HMAC of the body). Verify it on your receiver with this secret.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-50 px-3 py-2 font-mono text-[11px] text-zinc-700 ring-1 ring-zinc-200" title={item.secret}>{item.secret}</code>
              <IconButton label="Copy secret" onClick={copySecret}>{copied ? <Check /> : <Copy />}</IconButton>
            </div>
            <Button size="sm" variant="subtle" icon={<RefreshCw />} loading={regenerate.isPending} onClick={async () => { if (await confirm({ title: 'Regenerate signing secret?', message: 'The old secret stops working immediately — update your receiver.', confirmLabel: 'Regenerate' })) regenerate.mutate(); }}>Regenerate</Button>
          </Card>

          <Card className="space-y-3 p-5">
            <p className="text-sm font-medium text-zinc-800">Test</p>
            <p className="text-xs text-zinc-500">Sends a sample delivery to the saved URL right now.</p>
            <Button variant="secondary" icon={<Send />} loading={test.isPending} disabled={dirty || !item.enabled} onClick={() => test.mutate()}>Send test</Button>
            {dirty && <p className="text-xs text-amber-700">Save your changes first.</p>}
            {!item.enabled && <p className="text-xs text-amber-700">Enable this webhook to send a test.</p>}
          </Card>

          <div className="flex justify-end">
            <IconButton label="Delete webhook" className="hover:text-red-600" onClick={async () => { if (await confirm({ title: `Delete “${item.name}”?`, message: 'It stops receiving events immediately.', confirmLabel: 'Delete' })) { await del(`/api/admin/webhooks/${id}`); toast.success('Deleted.'); queryClient.invalidateQueries({ queryKey: ['webhooks'] }); window.history.back(); } }}><Trash2 /></IconButton>
          </div>
        </div>
      </div>
    </>
  );
}
