'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { api, roleHome, setSession, type Session } from '@/lib/api';
import { Button, Card, Field, inputClass } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const session = await api<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setSession(session);
      router.replace(roleHome(session.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <div className="mb-6">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-950 text-white"><LockKeyhole size={20} /></div>
          <h1 className="text-2xl font-black tracking-tight">CodeBricks LeadOps</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your Phase 1 CRM workspace.</p>
        </div>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Email"><input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Password"><input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full">Login</Button>
        </form>
      </Card>
    </main>
  );
}
