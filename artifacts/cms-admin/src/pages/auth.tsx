import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { Button, Field, Input, Notice } from '@/components/ui';
import { errorMessage, fieldErrors, get, post } from '@/lib/api';
import { assetUrl } from '@/lib/assets';
import { useAuth } from '@/lib/auth';

function AuthLayout({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden w-[44%] overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(0,130,251,.34),transparent_32%),radial-gradient(circle_at_78%_62%,rgba(34,211,238,.18),transparent_28%),linear-gradient(145deg,#11131b_0%,#090a10_70%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div className="w-fit rounded-xl bg-white px-3.5 py-2.5 shadow-xl shadow-black/20">
            <img src={assetUrl('/images/brand/nextract-logo.svg')} alt="Nextract" className="h-8 w-auto" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.15em] text-cyan-300 uppercase">Website admin</p>
            <p className="mt-3 max-w-sm text-3xl leading-tight font-semibold tracking-tight">Edit pages, publish resources and follow up on every lead.</p>
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <img src={assetUrl('/images/brand/nextract-logo.svg')} alt="Nextract" className="mb-8 h-9 w-auto" />
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{description}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, autoComplete, wiring }: { value: string; onChange: (value: string) => void; autoComplete: string; wiring: Record<string, unknown> }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...wiring} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className="pr-10" />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

type RecaptchaApi = {
  ready?: (callback: () => void) => void;
  render?: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => number;
  reset?: (id: number) => void;
};
const recaptchaApi = () => (window as typeof window & { grecaptcha?: RecaptchaApi }).grecaptcha;

function LoginRecaptcha({ siteKey, resetKey, onToken }: { siteKey: string; resetKey: number; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<number | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const render = () => {
      const api = recaptchaApi();
      if (!active || typeof api?.render !== 'function' || !container.current) return;
      // Render into a fresh child node. Google remembers rendered elements, so
      // reusing the outer container after React cleanup can be rejected.
      const mount = document.createElement('div');
      container.current.replaceChildren(mount);
      widget.current = api.render(mount, {
        sitekey: siteKey,
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    };
    // api.js creates window.grecaptcha before the localized widget runtime has
    // installed render(). The documented ready callback avoids racing that
    // second script, which otherwise leaves an empty CAPTCHA-sized gap.
    const renderWhenReady = () => {
      const api = recaptchaApi();
      if (!active || !api) return;
      if (typeof api.ready === 'function') api.ready(render);
      else render();
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-nextract-recaptcha]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.nextractRecaptcha = 'true';
      document.head.appendChild(script);
    }
    if (recaptchaApi()) renderWhenReady();
    else script.addEventListener('load', renderWhenReady, { once: true });
    return () => {
      active = false;
      script?.removeEventListener('load', renderWhenReady);
      widget.current = undefined;
      container.current?.replaceChildren();
    };
  }, [siteKey, onToken]);

  useEffect(() => {
    if (!resetKey || widget.current === undefined) return;
    const reset = recaptchaApi()?.reset;
    if (typeof reset === 'function') reset(widget.current);
  }, [resetKey]);
  return <div ref={container} className="min-h-[78px] overflow-hidden" aria-label="reCAPTCHA verification" />;
}

export function LoginPage() {
  const { signIn, verifyMfa } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  // When the account has 2FA, the first step hands back a challenge and we ask
  // for a code — from an authenticator app, an emailed code, or a backup code.
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [methods, setMethods] = useState<{ totp: boolean; email: boolean }>({ totp: false, email: false });
  const [emailHint, setEmailHint] = useState<string | undefined>();
  const [resent, setResent] = useState(false);
  const [recaptcha, setRecaptcha] = useState<{ loading: boolean; enabled: boolean; siteKey: string; error: boolean }>({ loading: true, enabled: false, siteKey: '', error: false });
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaReset, setRecaptchaReset] = useState(0);

  useEffect(() => {
    let active = true;
    void get<{ recaptchaEnabled: boolean; recaptchaSiteKey: string }>('/api/auth/config').then(
      (config) => { if (active) setRecaptcha({ loading: false, enabled: config.recaptchaEnabled, siteKey: config.recaptchaSiteKey, error: false }); },
      () => { if (active) setRecaptcha({ loading: false, enabled: false, siteKey: '', error: true }); },
    );
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (recaptcha.error) { setError('Sign-in protection could not be loaded. Refresh the page and try again.'); return; }
    if (recaptcha.enabled && !recaptchaToken) { setError('Complete the reCAPTCHA verification before signing in.'); return; }
    setBusy(true);
    setError('');
    setFields({});
    try {
      const result = await signIn(email, password, recaptchaToken || undefined);
      if (result.status === 'mfa') {
        setChallenge(result.challenge);
        setMethods(result.methods);
        setEmailHint(result.emailHint);
        setCode('');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(errorMessage(err));
      setFields(fieldErrors(err));
      if (recaptcha.enabled) { setRecaptchaToken(''); setRecaptchaReset((value) => value + 1); }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    try {
      const r = await post<{ challenge: string; emailHint?: string }>('/api/auth/login/resend', { challenge });
      setChallenge(r.challenge);
      setEmailHint(r.emailHint);
      setResent(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await verifyMfa(challenge, code.trim());
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (challenge) {
    const description = methods.email && methods.totp
      ? <>Enter the code from your authenticator app, or the code we emailed to <strong>{emailHint}</strong>.</>
      : methods.email
        ? <>Enter the 6-digit code we emailed to <strong>{emailHint}</strong>.</>
        : 'Enter the 6-digit code from your authenticator app, or one of your backup codes.';
    return (
      <AuthLayout title="Two-step verification" description={description}>
        <form onSubmit={submitCode} className="space-y-4" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          {resent && <Notice tone="success">A new code is on its way to {emailHint}.</Notice>}
          <Field label="Verification code">
            {(wiring) => (
              <Input
                {...wiring}
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
              />
            )}
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={busy}>Verify and sign in</Button>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => { setChallenge(''); setError(''); setPassword(''); setResent(false); }} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-ink">
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Start over
            </button>
            {methods.email && <button type="button" onClick={resend} className="text-[13px] font-medium text-brand-600 hover:underline">Resend email code</button>}
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Sign in" description="Use the email address your administrator invited.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && !Object.keys(fields).length && <Notice tone="error">{error}</Notice>}
        <Field label="Email" error={fields.email}>
          {(wiring) => <Input {...wiring} type="email" autoComplete="username" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />}
        </Field>
        <Field label="Password" error={fields.password}>
          {(wiring) => <PasswordInput wiring={wiring} autoComplete="current-password" value={password} onChange={setPassword} />}
        </Field>
        {recaptcha.enabled && <LoginRecaptcha siteKey={recaptcha.siteKey} resetKey={recaptchaReset} onToken={setRecaptchaToken} />}
        {recaptcha.loading && <p className="text-xs text-zinc-500">Loading sign-in protection…</p>}
        {recaptcha.error && <Notice tone="error">Sign-in protection could not be loaded. Refresh this page before trying again.</Notice>}
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-[13px] font-medium text-brand-600 hover:underline">Forgot your password?</Link>
        </div>
        <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={recaptcha.loading || recaptcha.error}>Sign in</Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await post<{ message: string }>('/api/auth/forgot-password', { email });
      setSent(result.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" description="Enter your email and we will send you a link to choose a new password.">
      {sent ? (
        <div className="space-y-5">
          <Notice tone="success">{sent}</Notice>
          <p className="text-sm text-zinc-500">The link works once and expires in one hour. Check your spam folder if it does not arrive.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Email">
            {(wiring) => <Input {...wiring} type="email" autoComplete="username" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />}
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
      <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to sign in
      </Link>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const search = useSearch();
  const token = new URLSearchParams(search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setFields({});
    if (password !== confirm) {
      setFields({ confirm: 'The two passwords do not match.' });
      return;
    }
    setBusy(true);
    try {
      const result = await post<{ message: string }>('/api/auth/reset-password', { token, password });
      setDone(result.message);
    } catch (err) {
      setError(errorMessage(err));
      setFields(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Link incomplete">
        <Notice tone="error">This reset link is missing its token. Open the link from your email again, or request a new one.</Notice>
        <Link href="/forgot-password" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">Request a new link</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" description="Use at least 15 characters. A long passphrase works well.">
      {done ? (
        <div className="space-y-5">
          <Notice tone="success">{done}</Notice>
          <Link href="/login" className="inline-flex text-sm font-medium text-brand-600 hover:underline">Go to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="New password" error={fields.password}>
            {(wiring) => <PasswordInput wiring={{ ...wiring, autoFocus: true }} autoComplete="new-password" value={password} onChange={setPassword} />}
          </Field>
          <Field label="Confirm new password" error={fields.confirm}>
            {(wiring) => <PasswordInput wiring={wiring} autoComplete="new-password" value={confirm} onChange={setConfirm} />}
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={busy}>Save password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
