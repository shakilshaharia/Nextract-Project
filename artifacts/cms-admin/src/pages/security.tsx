import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SecuritySettings } from '@workspace/cms-content';
import { Activity, KeyRound, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { StringListEditor } from '@/components/list-editor';
import { Badge, Button, Card, CardHeader, ErrorState, Notice, PageHeader, PageLoader, Switch, TextField } from '@/components/ui';
import { errorMessage, get, post, put } from '@/lib/api';

// Keep a number input within range; fall back when the field is cleared or bad.
function clampInt(raw: string, min: number, max: number, fallback: number) {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || raw.trim() === '') return fallback;
  return Math.min(max, Math.max(min, n));
}

type SettingsResponse = {
  security: SecuritySettings & { hasLoginRecaptchaSecret: boolean; adminUrl: string };
  site: { googleAnalyticsId: string; googleTagManagerId: string };
  environment: { mailConfigured: boolean; siteUrl: string; storageDriver: string; uptime?: { status: 'up' | 'down' | 'unknown'; lastCheckedAt: string | null; lastCode: number | null } };
};
type UserRow = { id: string; role: string; active: boolean; lockedUntil: string | null; totpEnabledAt: string | null; emailOtpEnabled: boolean };

function StatCard({ icon, label, value, tone = 'neutral', note }: { icon: ReactNode; label: string; value: string; tone?: 'green' | 'amber' | 'red' | 'neutral'; note?: string }) {
  const ring = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', neutral: 'text-zinc-500' }[tone];
  return (
    <Card className="p-4">
      <div className={`flex items-center gap-2 text-xs font-medium ${ring}`}>{icon}<span className="text-zinc-500">{label}</span></div>
      <p className="mt-1.5 text-lg font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-0.5 text-xs text-zinc-500">{note}</p>}
    </Card>
  );
}

export function SecurityPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: ({ signal }) => get<SettingsResponse>('/api/admin/settings', signal) });
  const users = useQuery({ queryKey: ['users'], queryFn: ({ signal }) => get<{ items: UserRow[] }>('/api/admin/users', signal) });

  const [form, setForm] = useState<SecuritySettings | null>(null);
  useEffect(() => { if (settings.data) setForm(settings.data.security); }, [settings.data]);

  const save = useMutation({
    mutationFn: (value: SecuritySettings) => put<{ security: SecuritySettings & { adminUrl: string } }>('/api/admin/settings/security', value),
    onSuccess: (result) => {
      toast.success('Security settings saved.');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      const currentBase = document.querySelector<HTMLMetaElement>('meta[name="cms-admin-base"]')?.content.replace(/\/+$/, '') || '/admin';
      const suffix = window.location.pathname.startsWith(currentBase) ? window.location.pathname.slice(currentBase.length) : '';
      const next = new URL(result.security.adminUrl);
      next.pathname = `${next.pathname.replace(/\/+$/, '')}${suffix}`;
      // Reload even when the path did not change: enabling reCAPTCHA changes
      // the document CSP, and the Google widget must be allowed immediately.
      window.location.assign(next.toString());
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const testAlert = useMutation({
    mutationFn: () => post<{ ok: boolean; message: string }>('/api/admin/settings/monitoring/test', { recipients: form?.uptimeMonitor.recipients ?? [] }),
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (settings.isLoading || users.isLoading) return <PageLoader />;
  if (settings.isError || !settings.data || !form) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;

  const env = settings.data.environment;
  const admins = users.data?.items ?? [];
  const adminCount = admins.filter((u) => u.active).length;
  const twoFaCount = admins.filter((u) => u.active && (u.totpEnabledAt || u.emailOtpEnabled)).length;
  const lockedCount = admins.filter((u) => u.lockedUntil && new Date(u.lockedUntil) > new Date()).length;
  const https = env.siteUrl.startsWith('https://');
  const cspStatus = !form.cspEnabled ? 'Off' : form.cspReportOnly ? 'Report-only' : 'Enforced';
  const set = <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const setMon = <K extends keyof SecuritySettings['uptimeMonitor']>(key: K, value: SecuritySettings['uptimeMonitor'][K]) =>
    setForm((f) => (f ? { ...f, uptimeMonitor: { ...f.uptimeMonitor, [key]: value } } : f));
  const uptime = env.uptime;

  return (
    <>
      <PageHeader title="Security" description="Two-factor policy, login alerts, security headers and a snapshot of the account's protection." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<ShieldCheck className="size-4" />} label="Two-factor adoption" value={`${twoFaCount} / ${adminCount}`} tone={twoFaCount === adminCount ? 'green' : 'amber'} note="active admins" />
        <StatCard icon={<Lock className="size-4" />} label="Content-Security-Policy" value={cspStatus} tone={form.cspEnabled && !form.cspReportOnly ? 'green' : 'amber'} />
        <StatCard icon={<KeyRound className="size-4" />} label="Transport" value={https ? 'HTTPS' : 'HTTP (dev)'} tone={https ? 'green' : 'amber'} note={https ? 'Secure cookies + HSTS' : 'Secure cookies off locally'} />
        <StatCard icon={<ShieldAlert className="size-4" />} label="Locked accounts" value={String(lockedCount)} tone={lockedCount ? 'amber' : 'green'} />
      </div>

      <div className="mt-6 grid max-w-3xl gap-6">
        <Card>
          <CardHeader title="Sign-in protection" />
          <div className="space-y-5 p-5">
            <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
              <div>
                <p className="text-sm font-medium text-zinc-800">Private admin URL</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">Add a hard-to-guess segment after <code>/admin/</code>. The old URL returns 404 to anonymous visitors and the private segment is not published in robots.txt.</p>
              </div>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1"><TextField label="Private path" value={form.adminPath} onChange={(v) => set('adminPath', v.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="secure-access" hint={form.adminPath ? `${env.siteUrl}/admin/${form.adminPath}` : `${env.siteUrl}/admin (current default)`} /></div>
                <Button variant="subtle" onClick={() => { const bytes = crypto.getRandomValues(new Uint8Array(12)); set('adminPath', `secure-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`); }}>Generate</Button>
              </div>
              <Notice tone="warn">Bookmark the new address before signing out. This hides the login page from casual scanning, but CAPTCHA, rate limits, strong passwords and two-factor authentication remain the real protection.</Notice>
            </div>
            <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
              <Switch
                checked={form.loginRecaptchaEnabled}
                onChange={(v) => set('loginRecaptchaEnabled', v)}
                label="Require Google reCAPTCHA on admin sign-in"
                description="Anonymous password attempts must pass reCAPTCHA before the server checks account credentials. Reauthentication inside an existing session is not interrupted."
              />
              <TextField label="reCAPTCHA site key" value={form.loginRecaptchaSiteKey} onChange={(v) => set('loginRecaptchaSiteKey', v.trim())} placeholder="Public site key" />
              <TextField label="reCAPTCHA secret key" type="password" value={form.loginRecaptchaSecret} onChange={(v) => set('loginRecaptchaSecret', v.trim())} placeholder={settings.data.security.hasLoginRecaptchaSecret ? 'Secret is saved — leave blank to keep it' : 'Private secret key'} hint="The secret is stored server-side and is never returned to the browser." />
              {form.loginRecaptchaEnabled && (!form.loginRecaptchaSiteKey || (!form.loginRecaptchaSecret && !settings.data.security.hasLoginRecaptchaSecret)) && <Notice tone="warn">Add both Google reCAPTCHA v2 keys before saving with this protection enabled.</Notice>}
            </div>
            <Switch
              checked={form.requireTwoFactor}
              onChange={(v) => set('requireTwoFactor', v)}
              label="Require two-factor authentication for all admins"
              description="Every admin must set up an authenticator app before using the dashboard. You will be asked to set up yours first if you have not already."
            />
            <Switch
              checked={form.alertOnNewDeviceLogin}
              onChange={(v) => set('alertOnNewDeviceLogin', v)}
              label="Email a warning on sign-in from a new device"
              description="Sends the account owner an email when their account is used from a device or location not seen before."
            />
            {form.alertOnNewDeviceLogin && !env.mailConfigured && <Notice tone="warn">Email is not configured yet, so alerts are written to the dev-mail folder. Set up SMTP in Settings → Email to send them.</Notice>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Uptime monitoring" description="The server checks your site every minute and emails the people below if it goes down — and again when it recovers." />
          <div className="space-y-5 p-5">
            <Switch
              checked={form.uptimeMonitor.enabled}
              onChange={(v) => setMon('enabled', v)}
              label="Email me when the site goes down"
              description="After a few failed checks in a row, each recipient gets a DOWN alert, then a RECOVERED email once the site is reachable again."
            />
            {form.uptimeMonitor.enabled && (
              <>
                <StringListEditor
                  label="Alert recipients (email)"
                  values={form.uptimeMonitor.recipients}
                  onChange={(v) => setMon('recipients', v)}
                  placeholder="name@example.com"
                  addLabel="Add recipient"
                  max={20}
                />
                <TextField
                  label="URL to check"
                  value={form.uptimeMonitor.url}
                  onChange={(v) => setMon('url', v.trim())}
                  placeholder={env.siteUrl}
                  hint={`Leave blank to check the site URL (${env.siteUrl}), or enter a specific http(s) URL.`}
                />
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    label="Failed checks before alert"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10}
                    value={String(form.uptimeMonitor.failThreshold)}
                    onChange={(v) => setMon('failThreshold', clampInt(v, 1, 10, 2))}
                    hint="Checks run once a minute."
                  />
                  <TextField
                    label="Repeat every (minutes) while down"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={1440}
                    value={String(form.uptimeMonitor.remindMinutes)}
                    onChange={(v) => setMon('remindMinutes', clampInt(v, 5, 1440, 60))}
                    hint="Reminder cadence during an outage."
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="subtle" loading={testAlert.isPending} disabled={!form.uptimeMonitor.recipients.length} onClick={() => testAlert.mutate()}>Send test alert</Button>
                  {uptime && uptime.status !== 'unknown' && (
                    <Badge tone={uptime.status === 'up' ? 'green' : 'red'}>
                      <Activity className="size-3" />
                      {uptime.status === 'up' ? 'Site reachable' : 'Site down'}{uptime.lastCheckedAt ? ` · checked ${new Date(uptime.lastCheckedAt).toLocaleTimeString()}` : ''}
                    </Badge>
                  )}
                </div>
                {!env.mailConfigured && <Notice tone="warn">Email is not configured yet, so alerts cannot be delivered. Set up SMTP in Settings → Email first.</Notice>}
                <Notice tone="info">This runs inside the CMS, so it catches the public site going down. If the whole server is offline it cannot email — an external monitor (e.g. UptimeRobot) is a good second layer.</Notice>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Security headers (Content-Security-Policy)" description="A strict policy is on by default and lets only first-party and listed scripts run. Change these only if a custom snippet or embed needs it." />
          <div className="space-y-5 p-5">
            <Switch checked={form.cspEnabled} onChange={(v) => set('cspEnabled', v)} label="Send the Content-Security-Policy" description="Turning this off removes the main defence against cross-site scripting. Leave it on unless you are debugging a problem." />
            <Switch checked={form.cspReportOnly} onChange={(v) => set('cspReportOnly', v)} disabled={!form.cspEnabled} label="Report-only (do not block)" description="Logs violations in the browser console without blocking anything. Useful to confirm nothing breaks before enforcing." />
            {!form.cspEnabled && <Notice tone="error">The Content-Security-Policy is off. Your site is more exposed to cross-site scripting until you turn it back on.</Notice>}

            <details className="rounded-lg border border-zinc-200 p-4">
              <summary className="cursor-pointer text-sm font-medium">Allow extra sources (advanced)</summary>
              <p className="mt-2 mb-4 text-xs text-zinc-500">Add a domain or scheme (e.g. <code>https://cdn.example.com</code>) when a snippet or widget loads from another origin and is being blocked. One entry per line.</p>
              <div className="space-y-4">
                <StringListEditor label="Script sources" values={form.cspScriptSrc} onChange={(v) => set('cspScriptSrc', v)} placeholder="https://cdn.example.com" addLabel="Add script source" max={40} />
                <StringListEditor label="Connect sources (fetch / XHR / websockets)" values={form.cspConnectSrc} onChange={(v) => set('cspConnectSrc', v)} placeholder="https://api.example.com" addLabel="Add connect source" max={40} />
                <StringListEditor label="Frame sources (embeds)" values={form.cspFrameSrc} onChange={(v) => set('cspFrameSrc', v)} placeholder="https://widget.example.com" addLabel="Add frame source" max={40} />
                <StringListEditor label="Image sources" values={form.cspImgSrc} onChange={(v) => set('cspImgSrc', v)} placeholder="https://images.example.com" addLabel="Add image source" max={40} />
                <StringListEditor label="Style sources" values={form.cspStyleSrc} onChange={(v) => set('cspStyleSrc', v)} placeholder="https://fonts.googleapis.com" addLabel="Add style source" max={40} />
                <StringListEditor label="Font sources" values={form.cspFontSrc} onChange={(v) => set('cspFontSrc', v)} placeholder="https://fonts.gstatic.com" addLabel="Add font source" max={40} />
              </div>
            </details>
          </div>
        </Card>

        <div>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(form)}>Save security settings</Button>
        </div>
      </div>
    </>
  );
}
