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
  Menu,
  MessageSquareText,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { FormEvent } from 'react';
import { api, getSession, roleHome, setSession, type Session } from '@/lib/api';
import { Button, Card, Field, inputClass, Skeleton } from './ui';

type DashboardBadgeReport = {
  totals: {
    pendingApprovals: number;
  };
};

const nav = {
  SUPER_ADMIN: [
    ['/admin/dashboard', 'Dashboard', LayoutDashboard],
    ['/admin/bds', 'BDs', Users],
    ['/admin/closers', 'Closers', ShieldCheck],
    ['/admin/tech-stacks', 'Tech Stacks', BriefcaseBusiness],
    ['/admin/jobs', 'Jobs', BriefcaseBusiness],
    ['/admin/pending-approvals', 'Pending Approvals', ClipboardCheck],
    ['/admin/schedule-ready', 'Schedule Ready', CalendarClock],
    ['/admin/lead-progress', 'Lead Progress', FileCheck2],
    ['/admin/calls', 'Calls', MessageSquareText],
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
    ['/closer/assigned-leads', 'Assigned Calls', FileCheck2],
    ['/closer/feedback', 'Feedback', MessageSquareText],
  ],
} as const;

export function AppShell({ children, role }: { children: ReactNode; role: Session['user']['role'] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setCurrentSession] = useState<Session | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      setCurrentSession(null);

      const existing = getSession();
      if (!existing) {
        router.replace('/login');
        return;
      }

      try {
        const verifiedUser = await api<Session['user']>('/users/me');
        if (cancelled) return;

        const latest = getSession() ?? existing;
        const nextSession = { ...latest, user: verifiedUser };
        setSession(nextSession);

        if (verifiedUser.role !== role) {
          router.replace(roleHome(verifiedUser.role));
          return;
        }

        setCurrentSession(nextSession);
      } catch {
        // The shared API helper handles 401 by clearing the session, showing a toast,
        // and redirecting to login. Keep this shell in its loading state while that happens.
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [role, router]);

  useEffect(() => {
    const existing = getSession();
    if (!existing && session) {
      setCurrentSession(null);
    }
  }, [pathname, session]);

  useEffect(() => {
    let cancelled = false;
    if (!session || role !== 'SUPER_ADMIN') {
      setPendingApprovalCount(0);
      return;
    }

    async function loadPendingApprovals() {
      try {
        const report = await api<DashboardBadgeReport>('/reports/dashboard', { suppressToast: true });
        if (!cancelled) setPendingApprovalCount(report.totals.pendingApprovals);
      } catch {
        if (!cancelled) setPendingApprovalCount(0);
      }
    }

    void loadPendingApprovals();

    return () => {
      cancelled = true;
    };
  }, [pathname, role, session]);

  useEffect(() => {
    if (!session || role !== 'SUPER_ADMIN') return;
    const socket = new WebSocket(pendingApprovalsSocketUrl(session.accessToken));
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; count?: number };
        if (payload.type === 'pendingApprovals' && typeof payload.count === 'number') {
          setPendingApprovalCount(payload.count);
        }
      } catch {
        // Ignore malformed websocket messages; the REST fallback still keeps the badge usable.
      }
    };
    return () => {
      socket.close();
    };
  }, [role, session]);

  const title = useMemo(() => nav[role].find(([href]) => href === pathname)?.[1] ?? 'LeadOps CRM', [pathname, role]);
  useEffect(() => {
    setMobileNavOpen(false);
    setSettingsOpen(false);
  }, [pathname]);

  if (!session) return <AppShellSkeleton />;

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
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
            const badge = role === 'SUPER_ADMIN' && href === '/admin/pending-approvals' ? pendingApprovalCount : 0;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
                  active ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={17} />
                <span className="min-w-0 flex-1 truncate">{labelText}</span>
                {badge > 0 ? <span className="rounded-full bg-brand-red px-2 py-0.5 text-xs font-black text-white">{badge}</span> : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden lg:pl-72">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-white hover:bg-neutral-800 lg:hidden"
              title="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight sm:text-xl">{title}</h1>
              <p className="text-xs font-semibold text-slate-500">{session.user.role.replaceAll('_', ' ')}</p>
            </div>
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
        <div className="min-w-0 p-3 sm:p-5">{children}</div>
      </main>
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/60" title="Close navigation" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative z-10 h-full w-[min(20rem,86vw)] overflow-y-auto border-r border-red-900/30 bg-neutral-950 px-4 py-5 text-white shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="rounded-lg bg-white px-3 py-2 text-lg font-black tracking-tight text-neutral-950">
                CodeBricks <span className="text-brand-red">LeadOps</span>
              </div>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
                title="Close navigation"
                onClick={() => setMobileNavOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="truncate text-sm font-bold">{session.user.name}</p>
              <p className="mt-1 break-all text-xs text-slate-300">{session.user.email}</p>
            </div>
            <nav className="grid gap-1">
              {nav[role].map(([href, labelText, Icon]) => {
                const active = pathname === href;
                const badge = role === 'SUPER_ADMIN' && href === '/admin/pending-approvals' ? pendingApprovalCount : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition ${
                      active ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={17} />
                    <span className="min-w-0 flex-1 truncate">{labelText}</span>
                    {badge > 0 ? <span className="rounded-full bg-brand-red px-2 py-0.5 text-xs font-black text-white">{badge}</span> : null}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
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

function pendingApprovalsSocketUrl(accessToken: string) {
  const configuredApiUrl =
    (typeof window !== 'undefined' ? window.__LEADOPS_CONFIG__?.apiUrl : undefined) || process.env.NEXT_PUBLIC_API_URL || '';
  const apiRoot = configuredApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  const wsRoot = apiRoot.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  return `${wsRoot}/ws/pending-approvals?token=${encodeURIComponent(accessToken)}`;
}

function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-slate-50">
      <aside className="hidden w-72 shrink-0 border-r border-red-900/30 bg-neutral-950 px-4 py-5 lg:block">
        <Skeleton className="mb-6 h-11 w-44 bg-white/20" />
        <Skeleton className="mb-4 h-20 w-full bg-white/10" />
        <div className="grid gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full bg-white/10" />
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-10 w-10 lg:hidden" />
            <div>
              <p className="text-sm font-black text-slate-800">Preparing your workspace</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Checking your session and loading LeadOps</p>
            </div>
          </div>
          <Skeleton className="h-10 w-10" />
        </header>
        <div className="grid min-w-0 gap-5 p-3 sm:p-5">
          <Card>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-3 h-4 w-80 max-w-full" />
          </Card>
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-9 w-16" />
              </Card>
            ))}
          </div>
        </div>
      </main>
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
    <div className="fixed inset-0 z-50 grid place-items-center overflow-x-hidden bg-slate-950/60 p-3 sm:p-4">
      <section className="max-h-[92vh] w-full max-w-lg min-w-0 overflow-auto rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-black tracking-tight">Profile</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{session.user.role.replaceAll('_', ' ')}</p>
          </div>
          <Button variant="light" className="px-2.5" title="Close profile" onClick={onClose}>
            <X size={16} />
          </Button>
        </header>
        <form onSubmit={submit} className="grid min-w-0 gap-4 p-4 sm:p-5">
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
