import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignFrequencies, campaignTriggers, campaignTypes, type CampaignConfig } from '@workspace/cms-content';
import { Megaphone, MousePointerClick, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialog';
import { StringListEditor } from '@/components/list-editor';
import { Badge, Button, ButtonLink, Card, Checkbox, EmptyState, ErrorState, IconButton, Input, Notice, PageHeader, PageLoader, SelectField, Switch, TextAreaField, TextField } from '@/components/ui';
import { del, errorMessage, fieldErrors, get, post, put } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useUnsavedChanges } from '@/lib/hooks';

type CampaignType = (typeof campaignTypes)[number];
type Summary = { id: string; name: string; type: CampaignType; enabled: boolean; startAt: string | null; endAt: string | null; views: number; clicks: number; dismissals: number; updatedAt: string };
type Detail = { id: string; name: string; type: CampaignType; enabled: boolean; priority: number; startAt: string | null; endAt: string | null; config: CampaignConfig };

const typeLabels: Record<CampaignType, string> = { BAR: 'Announcement bar', POPUP: 'Popup' };
const freqLabels: Record<(typeof campaignFrequencies)[number], string> = { always: 'Every page view', session: 'Once per visit', once: 'Once ever', days: 'Every N days' };
const triggerLabels: Record<(typeof campaignTriggers)[number], string> = { immediate: 'Immediately', delay: 'After a delay', scroll: 'After scrolling', exit: 'On exit intent' };
const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-700">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#1f3f5c'} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-zinc-200 bg-white p-0.5" />
        <input type="text" value={value} placeholder="Theme default" onChange={(e) => onChange(e.target.value)} className="w-28 rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs" />
        {value ? <button type="button" className="text-[11px] text-zinc-500 underline" onClick={() => onChange('')}>Reset</button> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function CampaignsListPage() {
  const [, navigate] = useLocation();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['campaigns'], queryFn: ({ signal }) => get<{ items: Summary[] }>('/api/admin/campaigns', signal) });
  const [name, setName] = useState('');
  const [type, setType] = useState<CampaignType>('BAR');
  const create = useMutation({ mutationFn: () => post<{ campaign: { id: string } }>('/api/admin/campaigns', { name, type }), onSuccess: (r) => navigate(`/campaigns/${r.campaign.id}`), onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/admin/campaigns/${id}`), onSuccess: () => { toast.success('Campaign deleted.'); queryClient.invalidateQueries({ queryKey: ['campaigns'] }); } });

  return (
    <>
      <PageHeader title="Campaigns" description="Announcement bars and popups across the site." />
      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-48"><label className="mb-1.5 block text-[13px] font-medium text-zinc-800">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring promo" /></div>
        <SelectField label="Type" className="w-44" value={type} onChange={(v) => setType(v as CampaignType)} options={campaignTypes.map((t) => ({ value: t, label: typeLabels[t] }))} />
        <Button variant="primary" icon={<Plus />} loading={create.isPending} disabled={!name.trim()} onClick={() => create.mutate()}>Create</Button>
      </Card>
      {list.isLoading ? <PageLoader /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (list.data?.items.length ? (
        <Card className="divide-y divide-zinc-100">
          {list.data.items.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <Link href={`/campaigns/${c.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">{c.name}</span>
                <span className="block text-[11px] text-zinc-500">{typeLabels[c.type]}</span>
              </Link>
              {c.enabled ? <Badge tone="green">Live</Badge> : <Badge>Off</Badge>}
              <span className="text-xs text-zinc-500" title="Views · Clicks · Dismissals">{c.views} · {c.clicks} · {c.dismissals}</span>
              <span className="w-24 text-right text-xs text-zinc-500">{formatDate(c.updatedAt)}</span>
              <ButtonLink href={`/campaigns/${c.id}`} size="sm" variant="subtle">Edit</ButtonLink>
              <IconButton label="Delete" className="hover:text-red-600" onClick={async () => { if (await confirm({ title: `Delete “${c.name}”?`, message: 'It stops showing on the site immediately.', confirmLabel: 'Delete' })) remove.mutate(c.id); }}><Trash2 /></IconButton>
            </div>
          ))}
        </Card>
      ) : <EmptyState icon={<Megaphone />} title="No campaigns yet" description="Create an announcement bar or popup above." />)}
    </>
  );
}

// ---------------------------------------------------------------------------

export function CampaignEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['campaigns', id], queryFn: ({ signal }) => get<{ campaign: Detail }>(`/api/admin/campaigns/${id}`, signal) });
  const [item, setItem] = useState<Detail | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (query.data) setItem(query.data.campaign); }, [query.data]);
  const dirty = Boolean(query.data && item && JSON.stringify(item) !== JSON.stringify(query.data.campaign));
  useUnsavedChanges(dirty);

  const save = useMutation({
    mutationFn: () => put<{ campaign: Detail }>(`/api/admin/campaigns/${id}`, item),
    onSuccess: (r) => { toast.success('Campaign saved. It is live on the site.'); setErrors({}); setItem(r.campaign); queryClient.invalidateQueries({ queryKey: ['campaigns'] }); },
    onError: (e) => { setErrors(fieldErrors(e)); toast.error(errorMessage(e)); },
  });

  if (query.isLoading || !item) return query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : <PageLoader />;
  const c = item.config;
  const setCfg = <K extends keyof CampaignConfig>(key: K) => (value: CampaignConfig[K]) => setItem({ ...item, config: { ...c, [key]: value } });
  const isPopup = item.type === 'POPUP';
  const placements = isPopup ? [{ value: 'center', label: 'Center modal' }, { value: 'corner-br', label: 'Bottom-right corner' }, { value: 'corner-bl', label: 'Bottom-left corner' }] : [{ value: 'top', label: 'Top of page' }, { value: 'bottom', label: 'Bottom of page' }];

  return (
    <>
      <PageHeader title={item.name || 'Campaign'} description="Configure what shows, where, when and to whom." actions={
        <div className="flex items-center gap-3">{dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}<Button variant="primary" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>Save campaign</Button></div>
      } />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <p className="text-sm font-semibold text-zinc-900">Content</p>
            <TextField label="Heading" value={c.heading} onChange={setCfg('heading')} error={errors['config.heading']} />
            <TextAreaField label="Message" value={c.body} onChange={setCfg('body')} rows={2} error={errors['config.body']} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Button text" value={c.ctaLabel} onChange={setCfg('ctaLabel')} placeholder="Optional" />
              <TextField label="Button link" value={c.ctaHref} onChange={setCfg('ctaHref')} placeholder="/pricing or https://…" error={errors['config.ctaHref']} />
            </div>
            <div className="flex flex-wrap gap-5">
              <Checkbox checked={c.ctaNewTab} onChange={setCfg('ctaNewTab')} label="Open link in new tab" />
              <Checkbox checked={c.dismissible} onChange={setCfg('dismissible')} label="Allow visitors to close it" />
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <p className="text-sm font-semibold text-zinc-900">Display</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Placement" value={c.placement} onChange={(v) => setCfg('placement')(v as CampaignConfig['placement'])} options={placements} />
              {isPopup && <SelectField label="Show popup" value={c.trigger} onChange={(v) => setCfg('trigger')(v as CampaignConfig['trigger'])} options={campaignTriggers.map((t) => ({ value: t, label: triggerLabels[t] }))} />}
            </div>
            {isPopup && (c.trigger === 'delay' || c.trigger === 'scroll') && (
              <TextField label={c.trigger === 'delay' ? 'Delay (seconds)' : 'Scroll depth (%)'} type="number" value={String(c.triggerValue)} onChange={(v) => setCfg('triggerValue')(Number(v) || 0)} className="max-w-[200px]" />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="How often" value={c.frequency} onChange={(v) => setCfg('frequency')(v as CampaignConfig['frequency'])} options={campaignFrequencies.map((f) => ({ value: f, label: freqLabels[f] }))} />
              {c.frequency === 'days' && <TextField label="Every N days" type="number" value={String(c.frequencyDays)} onChange={(v) => setCfg('frequencyDays')(Number(v) || 7)} />}
            </div>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-zinc-800">Devices</legend>
              <div className="flex gap-5">
                <Checkbox checked={c.devices.desktop} onChange={(v) => setCfg('devices')({ ...c.devices, desktop: v })} label="Desktop" />
                <Checkbox checked={c.devices.mobile} onChange={(v) => setCfg('devices')({ ...c.devices, mobile: v })} label="Mobile" />
              </div>
            </fieldset>
            <SelectField label="Where it shows" value={c.scope} onChange={(v) => setCfg('scope')(v as CampaignConfig['scope'])} options={[{ value: 'everywhere', label: 'Every page' }, { value: 'specific', label: 'Specific pages only' }]} />
            {c.scope === 'specific' && <StringListEditor label="Pages (paths)" values={c.paths} onChange={setCfg('paths')} placeholder="/pricing" addLabel="Add path" hint="A path like /pricing. Trailing * matches a prefix, e.g. /blog/*." />}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <Switch checked={item.enabled} onChange={(v) => setItem({ ...item, enabled: v })} label="Enabled" description="Turn on to show it on the site." />
            <TextField label="Priority" type="number" value={String(item.priority)} onChange={(v) => setItem({ ...item, priority: Number(v) || 0 })} hint="Higher shows first when several apply." />
          </Card>
          <Card className="space-y-3 p-5">
            <p className="text-sm font-medium text-zinc-800">Schedule (optional)</p>
            <div><label className="mb-1 block text-xs font-medium text-zinc-700">Start</label><input type="datetime-local" value={toLocal(item.startAt)} onChange={(e) => setItem({ ...item, startAt: e.target.value || null })} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs font-medium text-zinc-700">End</label><input type="datetime-local" value={toLocal(item.endAt)} onChange={(e) => setItem({ ...item, endAt: e.target.value || null })} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" /></div>
          </Card>
          <Card className="space-y-3 p-5">
            <p className="text-sm font-medium text-zinc-800">Styling</p>
            <Notice tone="info">Leave empty to use the site theme.</Notice>
            <div className="grid grid-cols-2 gap-3">
              <ColorRow label="Background" value={c.style.bgColor} onChange={(v) => setCfg('style')({ ...c.style, bgColor: v })} />
              <ColorRow label="Text" value={c.style.textColor} onChange={(v) => setCfg('style')({ ...c.style, textColor: v })} />
              <ColorRow label="Button bg" value={c.style.ctaBgColor} onChange={(v) => setCfg('style')({ ...c.style, ctaBgColor: v })} />
              <ColorRow label="Button text" value={c.style.ctaTextColor} onChange={(v) => setCfg('style')({ ...c.style, ctaTextColor: v })} />
            </div>
          </Card>
          <div className="flex justify-end">
            <IconButton label="Delete campaign" className="hover:text-red-600" onClick={async () => { if (await confirm({ title: `Delete “${item.name}”?`, message: 'It stops showing on the site immediately.', confirmLabel: 'Delete' })) { await del(`/api/admin/campaigns/${id}`); toast.success('Deleted.'); queryClient.invalidateQueries({ queryKey: ['campaigns'] }); window.history.back(); } }}><Trash2 /></IconButton>
          </div>
        </div>
      </div>
      <CampaignPreview type={item.type} config={c} />
    </>
  );
}

function CampaignPreview({ type, config: c }: { type: CampaignType; config: CampaignConfig }) {
  const style: React.CSSProperties = { background: c.style.bgColor || '#1f3f5c', color: c.style.textColor || '#ffffff' };
  const btn: React.CSSProperties = { background: c.style.ctaBgColor || '#0082fb', color: c.style.ctaTextColor || '#ffffff' };
  return (
    <Card className="mt-4 overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500"><MousePointerClick className="size-3.5" /> Preview</div>
      <div className="bg-zinc-50 p-6">
        {type === 'BAR' ? (
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm" style={style}>
            <span className="font-medium">{c.heading || 'Your announcement'}</span>
            {c.body && <span className="opacity-90">{c.body}</span>}
            {c.ctaLabel && <span className="rounded-full px-3 py-1 text-xs font-semibold" style={btn}>{c.ctaLabel}</span>}
          </div>
        ) : (
          <div className="mx-auto max-w-sm rounded-2xl p-6 text-center shadow-lg" style={style}>
            <p className="text-lg font-semibold">{c.heading || 'Your popup heading'}</p>
            {c.body && <p className="mt-2 text-sm opacity-90">{c.body}</p>}
            {c.ctaLabel && <button className="mt-4 rounded-full px-5 py-2 text-sm font-semibold" style={btn}>{c.ctaLabel}</button>}
          </div>
        )}
      </div>
    </Card>
  );
}
