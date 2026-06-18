'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { FormEvent } from 'react';
import { api, getSession, roleHome, setSession, type Session } from '@/lib/api';
import { Button, Field, inputClass } from './ui';

const nav = {
  SUPER_ADMIN: [
    ['/admin/dashboard', 'Dashboard', LayoutDashboard],
    ['/admin/users', 'Users', Users],
    ['/admin/bds', 'BDs', Users],
    ['/admin/closers', 'Closers', ShieldCheck],
    ['/admin/tech-stacks', 'Tech Stacks', BriefcaseBusiness],
    ['/admin/jobs', 'Jobs', BriefcaseBusiness],
    ['/admin/pending-approvals', 'Pending Approvals', ClipboardCheck],
    ['/admin/schedule-ready', 'Schedule Ready', CalendarClock],
    ['/admin/lead-progress', 'Lead Progress', FileCheck2],
    ['/admin/reports', 'Reports', BarChart3],
    ['/admin/audit-logs', 'Audit Logs', ShieldCheck],
  ],
  BD: [
    ['/bd/dashboard', 'Dashboard', LayoutDashboard],
    ['/bd/jobs', 'Jobs', BriefcaseBusiness],
    ['/bd/lead-submission', 'Lead Submission', ClipboardCheck],
    ['/bd/my-leads', 'My Leads', FileCheck2],
  ],
  CLOSER: [
    ['/closer/dashboard', 'Dashboard', LayoutDashboard],
    ['/closer/desk', 'Closer Desk', ShieldCheck],
    ['/closer/assigned-leads', 'Assigned Leads', FileCheck2],
    ['/closer/feedback', 'Feedback', MessageSquareText],
  ],
} as const;

export function AppShell({ children, role }: { children: ReactNode; role: Session['user']['role'] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setCurrentSession] = useState<Session | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const existing = getSession();
    if (!existing) {
      router.replace('/login');
      return;
    }
    if (existing.user.role !== role) {
      router.replace(roleHome(existing.user.role));
      return;
    }
    setCurrentSession(existing);
  }, [role, router]);

  const title = useMemo(() => nav[role].find(([href]) => href === pathname)?.[1] ?? 'LeadOps CRM', [pathname, role]);

  if (!session) return <div className="grid min-h-screen place-items-center text-sm font-semibold text-slate-600">Loading CRM...</div>;

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 overflow-y-auto border-r border-red-900/30 bg-neutral-950 px-4 py-5 text-white lg:block">
        <div className="mb-6 rounded-lg bg-white px-3 py-2 text-xl font-black tracking-tight text-neutral-950">
          CodeBricks <span className="text-brand-red">LeadOps</span>
        </div>
        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-bold">{session.user.name}</p>
          <p className="mt-1 text-xs text-slate-300">{session.user.email}</p>
        </div>
        <nav className="grid gap-1">
          {nav[role].map(([href, labelText, Icon]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
                  active ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={17} />
                {labelText}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 lg:pl-72">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur">
          <div>
            <h1 className="text-xl font-black tracking-tight">{title}</h1>
            <p className="text-xs font-semibold text-slate-500">{session.user.role.replaceAll('_', ' ')}</p>
          </div>
          <div className="relative">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
              title="Settings"
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <Settings size={18} />
            </button>
            {settingsOpen ? (
              <div className="absolute right-0 top-12 z-30 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setSettingsOpen(false);
                    setProfileOpen(true);
                  }}
                >
                  <UserCircle size={16} />
                  Profile
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setSession(null);
                    router.replace('/login');
                  }}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <div className="p-5">{children}</div>
      </main>
      {profileOpen ? (
        <ProfileModal
          session={session}
          onClose={() => setProfileOpen(false)}
          onSaved={(updatedUser) => {
            const nextSession = { ...session, user: { ...session.user, ...updatedUser } };
            setSession(nextSession);
            setCurrentSession(nextSession);
            setProfileOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ProfileModal({
  session,
  onClose,
  onSaved,
}: {
  session: Session;
  onClose: () => void;
  onSaved: (user: Session['user']) => void;
}) {
  const [name, setName] = useState(session.user.name);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password || confirmPassword) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Password and confirm password do not match.');
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const user = await api<Session['user']>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, password: password || undefined }),
      });
      onSaved(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <section className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black tracking-tight">Profile</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{session.user.role.replaceAll('_', ' ')}</p>
          </div>
          <Button variant="light" className="px-2.5" title="Close profile" onClick={onClose}>
            <X size={16} />
          </Button>
        </header>
        <form onSubmit={submit} className="grid gap-4 p-5">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Email">
            <input className={`${inputClass} bg-slate-50 text-slate-500`} value={session.user.email} disabled readOnly />
          </Field>
          <Field label="New Password">
            <input
              className={inputClass}
              type="password"
              minLength={8}
              placeholder="Leave blank to keep current password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field label="Confirm Password">
            <input
              className={inputClass}
              type="password"
              minLength={8}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
