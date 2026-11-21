import { useEffect, useRef, useState } from 'react';
import { Modal } from './dialog';
import { Button, TextField } from './ui';
import { errorMessage, post, setReauthenticationHandler } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function Reauthenticate() {
  const { user } = useAuth();
  const resolve = useRef<((value: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false), [password, setPassword] = useState(''), [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(''), [emailMethod, setEmailMethod] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    setReauthenticationHandler(() => new Promise<boolean>((done) => { resolve.current = done; setOpen(true); }));
    return () => { setReauthenticationHandler(null); resolve.current?.(false); };
  }, []);
  const finish = (ok: boolean) => {
    resolve.current?.(ok); resolve.current = null;
    setOpen(false); setPassword(''); setCode(''); setChallenge(''); setError('');
  };
  const submit = async () => {
    if (!user || busy) return;
    setBusy(true); setError('');
    try {
      if (challenge) { await post('/api/auth/login/totp', { challenge, code }); finish(true); }
      else {
        const result = await post<{ mfaRequired?: boolean; challenge?: string; methods?: { email: boolean } }>('/api/auth/login', { email: user.email, password });
        setPassword('');
        if (result.mfaRequired && result.challenge) { setChallenge(result.challenge); setEmailMethod(Boolean(result.methods?.email)); }
        else finish(true);
      }
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <Modal open={open} onClose={() => { if (!busy) finish(false); }} size="sm" title="Confirm your sign-in" description="Confirm your password and any enabled second factor before continuing." footer={<><Button disabled={busy} onClick={() => finish(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => void submit()}>Continue</Button></>}>
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      {challenge ? <TextField label="Authenticator, email, or recovery code" value={code} onChange={setCode} autoComplete="one-time-code" autoFocus /> : <TextField label="Current password" type="password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />}
      {challenge && emailMethod && <Button variant="ghost" disabled={busy} onClick={() => { void post('/api/auth/login/resend', { challenge }).catch((cause) => setError(errorMessage(cause))); }}>Resend email code</Button>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <button type="submit" hidden />
    </form>
  </Modal>;
}
