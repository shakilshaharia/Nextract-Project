import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { consentCategories, type ConsentCategory, type ConsentChoices, type PrivacySettings, type SiteSettings } from '@workspace/cms-content';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, ErrorState, Notice, PageHeader, PageLoader, SelectField, Switch, TextAreaField, TextField } from '@/components/ui';
import { errorMessage, fieldErrors, get, put } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useUnsavedChanges } from '@/lib/hooks';

type Settings = { privacy: PrivacySettings; site: SiteSettings };
type RecordItem = { id: string; policyVersion: string; country: string; choices: ConsentChoices; action: string; createdAt: string };
const categoryOptions = consentCategories.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

export function PrivacyPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: ({ signal }) => get<Settings>('/api/admin/settings', signal) });
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const records = useQuery({ queryKey: ['consent-records', page], queryFn: ({ signal }) => get<{ items: RecordItem[]; total: number }>(`/api/admin/consent/records?page=${page}`, signal) });
  useEffect(() => { if (settings.data) { setPrivacy(settings.data.privacy); setSite(settings.data.site); } }, [settings.data]);
  const dirtyPrivacy = Boolean(privacy && settings.data && JSON.stringify(privacy) !== JSON.stringify(settings.data.privacy));
  const dirtySite = Boolean(site && settings.data && JSON.stringify(site) !== JSON.stringify(settings.data.site));
  useUnsavedChanges(dirtyPrivacy || dirtySite);

  const save = useMutation({
    mutationFn: async () => {
      if (dirtyPrivacy) await put('/api/admin/settings/privacy', privacy);
      if (dirtySite) await put('/api/admin/settings/site', site);
    },
    onSuccess: () => { toast.success('Privacy settings saved. Visitors will be asked again when the policy changes.'); setErrors({}); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e) => { setErrors(fieldErrors(e)); toast.error(errorMessage(e)); },
  });

  if (settings.isLoading || !privacy || !site) return settings.isError ? <ErrorState error={settings.error} onRetry={() => settings.refetch()} /> : <PageLoader />;
  const set = <K extends keyof PrivacySettings>(key: K) => (value: PrivacySettings[K]) => setPrivacy({ ...privacy, [key]: value });
  const selectCategory = (key: 'headerScriptsCategory' | 'footerScriptsCategory') => (value: string) => setSite({ ...site, [key]: value as ConsentCategory });

  return <>
    <PageHeader title="Privacy & cookie consent" description="Control the public preference center, script categories, and consent history." actions={<Button variant="primary" disabled={!dirtyPrivacy && !dirtySite} loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button>} />
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card className="p-5">
          <Switch
            checked={privacy.enabled}
            onChange={set('enabled')}
            label="Cookie consent banner"
            description={privacy.enabled ? 'On — visitors see the consent banner and optional scripts wait for their choice.' : 'Off — the banner is hidden and scripts load without asking for consent.'}
          />
        </Card>
        <Card className={`space-y-4 p-5 ${privacy.enabled ? '' : 'opacity-60'}`}>
          <h2 className="text-base font-semibold">Banner & policy</h2>
          <Notice tone="info">Optional categories start off everywhere, including when a visitor's region is unknown. A saved choice becomes invalid when policy copy, tracker IDs, or active scripts change.</Notice>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Policy version" value={privacy.policyVersion} onChange={set('policyVersion')} error={errors.policyVersion} hint="Increase this when your legal policy changes without other settings changing." />
            <SelectField label="Banner position" value={privacy.position} onChange={(v) => set('position')(v as PrivacySettings['position'])} options={[{ value: 'bottom', label: 'Bottom' }, { value: 'top', label: 'Top' }]} />
          </div>
          <TextField label="Banner title" value={privacy.title} onChange={set('title')} error={errors.title} />
          <TextAreaField label="Default message" value={privacy.message} onChange={set('message')} rows={3} error={errors.message} />
          <TextAreaField label="Canada message" value={privacy.canadaMessage} onChange={set('canadaMessage')} rows={2} error={errors.canadaMessage} hint="Used when a trusted country header identifies Canada." />
          <TextAreaField label="Europe and UK message" value={privacy.europeMessage} onChange={set('europeMessage')} rows={2} error={errors.europeMessage} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Privacy policy link" value={privacy.privacyPolicyUrl} onChange={set('privacyPolicyUrl')} error={errors.privacyPolicyUrl} />
            <TextField label="Cookie policy link" value={privacy.cookiePolicyUrl} onChange={set('cookiePolicyUrl')} error={errors.cookiePolicyUrl} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Background" type="color" value={privacy.backgroundColor} onChange={set('backgroundColor')} error={errors.backgroundColor} />
            <TextField label="Text" type="color" value={privacy.textColor} onChange={set('textColor')} error={errors.textColor} />
            <TextField label="Primary button" type="color" value={privacy.buttonColor} onChange={set('buttonColor')} error={errors.buttonColor} />
          </div>
          <div className="rounded-xl border p-4" style={{ background: privacy.backgroundColor, color: privacy.textColor }}><strong>{privacy.title}</strong><p className="mt-1 text-sm">{privacy.message}</p><span className="mt-3 inline-block rounded-md px-3 py-2 text-sm text-white" style={{ background: privacy.buttonColor }}>Accept all</span></div>
        </Card>
        <Card className="space-y-4 p-5">
          <h2 className="text-base font-semibold">Script enforcement</h2>
          <p className="text-sm text-zinc-600">Google Analytics loads with Analytics consent. Tag Manager waits for Marketing consent. Existing header and footer script fields default to Marketing until you classify them here. Code Snippets have their own category control.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Header scripts" value={site.headerScriptsCategory} onChange={selectCategory('headerScriptsCategory')} options={categoryOptions} />
            <SelectField label="Footer scripts" value={site.footerScriptsCategory} onChange={selectCategory('footerScriptsCategory')} options={categoryOptions} />
          </div>
          <Notice tone="warn">Mark code Essential only if it is required for core site operation and does not perform optional tracking.</Notice>
        </Card>
      </div>
      <Card className="space-y-4 p-5">
        <h2 className="text-base font-semibold">Consent records</h2>
        <TextField label="Keep records for days" type="number" value={String(privacy.retentionDays)} onChange={(v) => set('retentionDays')(Number(v))} error={errors.retentionDays} hint="30–1095 days. Old records are removed by scheduled cleanup." />
        {records.isLoading ? <PageLoader /> : records.isError ? <ErrorState error={records.error} onRetry={() => records.refetch()} /> : <>
          <p className="text-xs text-zinc-500">{records.data?.total ?? 0} decisions. No IP address or user agent is stored.</p>
          <div className="divide-y divide-zinc-100">
            {records.data?.items.map((record) => <div key={record.id} className="py-3 text-xs">
              <p className="font-medium">{record.action.replaceAll('_', ' ')} · {record.country || 'Region unknown'}</p>
              <p className="mt-1 text-zinc-500">{formatDateTime(record.createdAt)}</p>
              <p className="mt-1 text-zinc-500">Allowed: {(['functional', 'analytics', 'marketing'] as const).filter((c) => record.choices[c]).join(', ') || 'essential only'}</p>
              <p className="mt-1 font-mono text-[10px] text-zinc-400" title={record.policyVersion}>Policy {record.policyVersion.slice(0, 12)}</p>
            </div>)}
            {!records.data?.items.length && <p className="py-5 text-sm text-zinc-500">No consent decisions yet.</p>}
          </div>
          <div className="flex items-center justify-between"><Button size="sm" variant="subtle" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-xs">Page {page}</span><Button size="sm" variant="subtle" disabled={page * 25 >= (records.data?.total ?? 0)} onClick={() => setPage(page + 1)}>Next</Button></div>
        </>}
      </Card>
    </div>
  </>;
}
