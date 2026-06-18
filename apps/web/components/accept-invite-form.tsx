'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { api, roleHome, setSession, type Session } from '@/lib/api';
import { Button, Card, Field, inputClass } from './ui';

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password and confirm password do not match.');
      return;
    }

    try {
      const session = await api<Session>('/auth/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSession(session);
      router.replace(roleHome(session.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite could not be accepted');
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <div className="mb-6">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-950 text-white"><LockKeyhole size={20} /></div>
          <h1 className="text-2xl font-black tracking-tight">Set your password</h1>
          <p className="mt-1 text-sm text-slate-500">Complete your CodeBricks LeadOps account setup.</p>
        </div>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Password">
            <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
          <Field label="Confirm Password">
            <input className={inputClass} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </Field>
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={!token}>Activate Account</Button>
        </form>
      </Card>
    </main>
  );
}
