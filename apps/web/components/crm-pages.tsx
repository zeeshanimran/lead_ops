'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarPlus, Check, ExternalLink, Eye, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { label, shortDateTime } from '@/lib/format';
import {
  CallFeedback,
  CallStage,
  FeedbackCallStatus,
  FeedbackResult,
  Job,
  Lead,
  LeadCall,
  LeadCallStatus,
  LeadStatus,
  ManualInviteStatus,
  Role,
  TechStack,
  User,
} from '@/types/domain';
import { Badge, Button, Card, DetailSkeleton, Field, inputClass, MetricSkeletonGrid, Skeleton, TableSkeleton, textareaClass } from './ui';

type DashboardReport = {
  totals: {
    users: number;
    jobs: number;
    leads: number;
    feedback: number;
    calls: number;
    activeBds: number;
    activeClosers: number;
    pendingApprovals: number;
    approvedLeads: number;
    scheduledCalls: number;
    completedCalls: number;
    pendingFeedbackCalls: number;
  };
  leadStatuses: Array<{ status: LeadStatus; _count: number }>;
  jobStatuses: Array<{ status: string; _count: number }>;
  callStatuses: Array<{ status: string; _count: number }>;
  callStages: Array<{ callStage: string; _count: number }>;
};

function useLoad<T>(path: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(enabled);
  const load = async () => {
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (enabled) void load();
    else setLoading(false);
  }, [path, enabled]);
  return { data, error, loading, reload: load };
}

function statusTone(status?: string): 'red' | 'green' | 'yellow' | 'slate' | 'blue' {
  if (!status) return 'slate';
  if (['READY_TO_SCHEDULE', 'COMPLETED', 'ACCEPTED', 'TAKEN', 'PASSED', 'OFFERED', 'APPLIED', 'APPROVED_BY_ADMIN'].includes(status)) return 'green';
  if (['PENDING_APPROVAL', 'MANUAL_INVITE_PENDING', 'PENDING_FEEDBACK', 'NEXT_CALL_REQUIRED', 'NOT_APPLIED'].includes(status)) return 'yellow';
  if (['DISMISSED', 'DECLINED', 'NO_SHOW', 'REJECTED', 'REJECTED_BY_ADMIN', 'FAILED', 'CANCELLED', 'CLOSED'].includes(status)) return 'red';
  return 'blue';
}

const TABLE_PAGE_SIZE = 10;
const callStages: CallStage[] = ['SCREENING', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'FINAL', 'OFFERED'];
const manualStatuses: ManualInviteStatus[] = ['MANUAL_INVITE_PENDING', 'MANUAL_INVITE_CREATED', 'ACCEPTED', 'DECLINED', 'REMINDER_DUE'];

function clientResponseLabel(value?: ManualInviteStatus | string | null) {
  if (value === 'MANUAL_INVITE_PENDING') return 'Awaiting Client Response';
  if (value === 'MANUAL_INVITE_CREATED') return 'Client Response Requested';
  if (value === 'ACCEPTED') return 'Client Accepted';
  if (value === 'DECLINED') return 'Client Declined';
  if (value === 'REMINDER_DUE') return 'Reminder Due';
  return label(value);
}

function usePagination<T>(items: T[], pageSize = TABLE_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalItems: items.length,
    totalPages,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
    setPage,
  };
}

function PaginationControls({
  page,
  pageSize,
  totalItems,
  totalPages,
  from,
  to,
  setPage,
}: ReturnType<typeof usePagination>) {
  if (totalItems <= pageSize) return null;
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center">
      <span>
        Showing <strong>{from}</strong>-<strong>{to}</strong> of <strong>{totalItems}</strong>
      </span>
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <Button variant="light" disabled={page === 1} className={page === 1 ? 'opacity-50' : ''} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <span className="font-bold text-slate-700">
          {page} / {totalPages}
        </span>
        <Button variant="light" disabled={page === totalPages} className={page === totalPages ? 'opacity-50' : ''} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!open) setSubmitting(false);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="grid w-full max-w-md gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div>
          <h3 className="text-lg font-black text-slate-950">{title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{message}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="light" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button
            variant="danger"
            disabled={submitting}
            className={submitting ? 'opacity-50' : undefined}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm();
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Trash2 size={14} /> {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({ role }: { role: Role }) {
  const { data, error, loading } = useLoad<DashboardReport>('/reports/dashboard');
  const title = role === 'SUPER_ADMIN' ? 'Executive Dashboard' : role === 'BD' ? 'BD Dashboard' : 'Closer Dashboard';
  const cards: Array<[string, number | undefined, string | undefined]> = [
    ['Active BDs', data?.totals.activeBds, role === 'SUPER_ADMIN' ? '/admin/bds' : undefined],
    ['Active Closers', data?.totals.activeClosers, role === 'SUPER_ADMIN' ? '/admin/closers' : undefined],
    ['Jobs', data?.totals.jobs, role === 'SUPER_ADMIN' ? '/admin/jobs' : undefined],
    ['Leads', data?.totals.leads, role === 'SUPER_ADMIN' ? '/admin/lead-progress' : undefined],
    ['Calls', data?.totals.calls, role === 'SUPER_ADMIN' ? '/admin/calls' : undefined],
    ['Pending Feedback', data?.totals.pendingFeedbackCalls, role === 'SUPER_ADMIN' ? '/admin/calls?status=PENDING_FEEDBACK' : undefined],
  ];
  const leadSummaryHref = role === 'SUPER_ADMIN' ? '/admin/lead-progress' : undefined;
  const callSummaryHref = role === 'SUPER_ADMIN' ? '/admin/calls' : undefined;

  return (
    <div className="grid min-w-0 gap-5">
      <section className="rounded-lg border border-red-900/20 bg-neutral-950 p-4 text-white shadow-panel sm:p-6">
        <h2 className="text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Lead operations by parent lead, scheduled calls, closer feedback, and timeline movement.
        </p>
      </section>
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      {loading && !data ? <MetricSkeletonGrid count={6} /> : (
        <div className="grid min-w-0 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {cards.map(([name, value, href]) => <MetricCard key={name} title={name} value={value ?? 0} href={href} />)}
        </div>
      )}
      {loading && !data ? <SummarySkeletonGrid /> : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          <SummaryCard title="Lead Status Summary" href={leadSummaryHref} rows={(data?.leadStatuses ?? []).map((row) => [row.status, row._count])} />
          <SummaryCard title="Call Status Summary" href={callSummaryHref} rows={(data?.callStatuses ?? []).map((row) => [row.status, row._count])} />
          <SummaryCard title="Call Stage Summary" href={callSummaryHref} rows={(data?.callStages ?? []).map((row) => [row.callStage, row._count])} />
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, href }: { title: string; value: number; href?: string }) {
  const content = (
    <Card className={href ? 'h-full cursor-pointer transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-lg' : undefined}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase text-slate-500">{title}</p>
        {href ? <ArrowRight size={16} className="mt-0.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-red" /> : null}
      </div>
      <p className="mt-2 text-3xl font-black">{value}</p>
      {href ? <p className="mt-3 text-xs font-bold uppercase text-brand-red">View</p> : null}
    </Card>
  );
  if (!href) return content;
  return (
    <Link href={href} className="group block min-w-0 rounded-lg outline-none ring-brand-red/20 focus:ring-4" aria-label={`Open ${title}`}>
      {content}
    </Link>
  );
}

function SummarySkeletonGrid() {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <Skeleton className="mb-5 h-5 w-40" />
          <div className="grid gap-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function SummaryCard({ title, rows, href }: { title: string; rows: Array<[string, number]>; href?: string }) {
  const content = (
    <Card className={href ? 'h-full cursor-pointer transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-lg' : undefined}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="font-black">{title}</h3>
        {href ? <ArrowRight size={16} className="mt-1 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-red" /> : null}
      </div>
      <div className="grid gap-3">
        {rows.length ? rows.map(([name, count]) => (
          <div key={name} className="flex items-center justify-between border-b border-slate-100 pb-2">
            <Badge tone={statusTone(name)}>{label(name)}</Badge>
            <span className="font-black">{count}</span>
          </div>
        )) : <p className="text-sm text-slate-500">No data yet.</p>}
      </div>
      {href ? <p className="mt-4 text-xs font-bold uppercase text-brand-red">View listing</p> : null}
    </Card>
  );
  if (!href) return content;
  return (
    <Link href={href} className="group block min-w-0 rounded-lg outline-none ring-brand-red/20 focus:ring-4" aria-label={`Open ${title}`}>
      {content}
    </Link>
  );
}

export function UsersPage({ roleFilter }: { roleFilter?: Role }) {
  const { data, error, loading, reload } = useLoad<User[]>(`/users${roleFilter ? `?role=${roleFilter}` : ''}`);
  const { data: techStacks, reload: reloadTechStacks } = useLoad<TechStack[]>('/tech-stacks', roleFilter === 'BD' || roleFilter === 'CLOSER' || !roleFilter);
  const initialRole = roleFilter ?? 'BD';
  const [form, setForm] = useState<{ name: string; email: string; role: Role; techStackIds: string[] }>({
    name: '',
    email: '',
    role: initialRole,
    techStackIds: [],
  });
  const users = data ?? [];
  const userPagination = usePagination(users);
  const creatingStackUser = form.role === 'BD' || form.role === 'CLOSER';
  const [expandedStackUserId, setExpandedStackUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api<User>('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        role: form.role,
        ...(creatingStackUser ? { techStackIds: form.techStackIds } : {}),
      }),
    });
    setForm({ name: '', email: '', role: initialRole, techStackIds: [] });
    await reload();
  };

  return (
    <div className="grid min-w-0 gap-5">
      <Card>
        <form onSubmit={submit} className={`grid min-w-0 gap-3 ${roleFilter ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          <Field label="Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Email"><input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          {!roleFilter ? (
            <Field label="Role">
              <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role, techStackIds: [] })}>
                <option value="BD">BD</option>
                <option value="CLOSER">Closer</option>
              </select>
            </Field>
          ) : null}
          <div className="flex items-end">
            <Button
              className={`w-full ${creatingStackUser && !form.techStackIds.length ? 'opacity-50' : ''}`}
              type="submit"
              disabled={creatingStackUser && !form.techStackIds.length}
            >
              <Plus size={16} /> Send Invite
            </Button>
          </div>
          {creatingStackUser ? (
            <div className={roleFilter ? 'md:col-span-3' : 'md:col-span-4'}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">Tech Stacks</p>
                <p className="text-xs font-bold text-slate-500">{form.techStackIds.length} / 3 selected</p>
              </div>
              <TechStackPicker
                techStacks={techStacks ?? []}
                selectedIds={form.techStackIds}
                onChange={(techStackIds) => setForm((current) => ({ ...current, techStackIds }))}
                onCreated={reloadTechStacks}
              />
              <p className="mt-2 text-xs font-semibold text-slate-500">BD and closer invites require 1 to 3 assigned tech stacks.</p>
            </div>
          ) : null}
        </form>
      </Card>
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      {loading && !data ? <TableSkeleton columns={roleFilter === 'BD' || roleFilter === 'CLOSER' ? 6 : 5} /> : <Card className="p-0">
        <div className="table-wrap">
          <table className="lead-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th>{roleFilter === 'BD' || roleFilter === 'CLOSER' ? <th>Assigned tech stack</th> : null}<th>Actions</th></tr></thead>
            <tbody>
              {userPagination.items.map((user) => {
                const showStackColumn = roleFilter === 'BD' || roleFilter === 'CLOSER';
                const isEditing = editingUserId === user.id;
                return (
                  <Fragment key={user.id}>
                    <tr>
                      <td className="font-bold">{user.name}</td>
                      <td>{user.email}</td>
                      <td><Badge>{label(user.role)}</Badge></td>
                      <td><Badge tone={user.status === 'ACTIVE' ? 'green' : 'red'}>{label(user.status)}</Badge></td>
                      {showStackColumn ? (
                        <td>
                          <AssignedTechStackSummary
                            user={user}
                            expanded={expandedStackUserId === user.id}
                            onToggle={() => setExpandedStackUserId((current) => current === user.id ? null : user.id)}
                          />
                        </td>
                      ) : null}
                      <td><div className="flex flex-wrap gap-2">
                        {user.role === 'SUPER_ADMIN' ? <span className="text-sm font-semibold text-slate-500">Protected</span> : (
                          <>
                            {user.status === 'INACTIVE' ? (
                              <Button variant="light" onClick={async () => {
                                await api<User>(`/users/${user.id}/resend-invite`, { method: 'POST' });
                                await reload();
                              }}>
                                Resend Invite
                              </Button>
                            ) : null}
                            <Button variant="light" onClick={() => setEditingUserId((current) => current === user.id ? null : user.id)}>
                              <Pencil size={14} /> Edit
                            </Button>
                            <Button variant="danger" onClick={() => setDeleteUser(user)}>
                              <Trash2 size={14} /> Delete
                            </Button>
                          </>
                        )}
                      </div></td>
                    </tr>
                    {isEditing ? (
                      <tr>
                        <td colSpan={showStackColumn ? 6 : 5}>
                          <UserEditPanel
                            user={user}
                            techStacks={techStacks ?? []}
                            onCancel={() => setEditingUserId(null)}
                            onSaved={async () => {
                              setEditingUserId(null);
                              await reload();
                            }}
                            onCreatedStack={reloadTechStacks}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <PaginationControls {...userPagination} />
      </Card>}
      <ConfirmDialog
        open={Boolean(deleteUser)}
        title="Delete user?"
        message={deleteUser ? `This will delete ${deleteUser.name}. This action cannot be undone.` : ''}
        confirmLabel="Delete"
        onCancel={() => setDeleteUser(null)}
        onConfirm={async () => {
          if (!deleteUser) return;
          await api(`/users/${deleteUser.id}`, { method: 'DELETE' });
          setDeleteUser(null);
          await reload();
        }}
      />
    </div>
  );
}

function AssignedTechStackSummary({ user, expanded, onToggle }: { user: User; expanded: boolean; onToggle: () => void }) {
  const assignedStacks = user.assignedTechStacks ?? [];

  return (
    <div className="grid min-w-40 gap-2">
      <button
        type="button"
        className="inline-flex min-h-9 w-fit items-center rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-200"
        onClick={onToggle}
      >
        {assignedStacks.length} assigned
      </button>
      {expanded ? (
        <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-2">
          {assignedStacks.length ? assignedStacks.map((stack) => (
            <span key={stack.id} className="text-sm font-semibold text-slate-700">{stack.name}</span>
          )) : <span className="text-sm text-slate-500">No stacks assigned.</span>}
        </div>
      ) : null}
    </div>
  );
}

function UserEditPanel({
  user,
  techStacks,
  onCancel,
  onSaved,
  onCreatedStack,
}: {
  user: User;
  techStacks: TechStack[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onCreatedStack: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    status: user.status,
    techStackIds: (user.assignedTechStacks ?? []).map((stack) => stack.id),
  });

  useEffect(() => {
    setForm({
      name: user.name,
      email: user.email,
      status: user.status,
      techStackIds: (user.assignedTechStacks ?? []).map((stack) => stack.id),
    });
  }, [user]);

  const needsTechStack = user.role === 'BD' || user.role === 'CLOSER';
  const canSave = form.name.trim() && form.email.trim() && (!needsTechStack || form.techStackIds.length > 0);
  const save = async () => {
    if (!canSave) return;
    await api(`/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        status: form.status,
        ...(needsTechStack ? { techStackIds: form.techStackIds } : {}),
      }),
    });
    await onSaved();
  };

  return (
    <div className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        <Field label="Name"><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Email"><input className={inputClass} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Status">
          <select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as User['status'] })}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </Field>
      </div>
      {needsTechStack ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">Assigned tech stack</p>
            <p className="text-xs font-bold text-slate-500">{form.techStackIds.length} / 3 selected</p>
          </div>
          <TechStackPicker
            techStacks={techStacks}
            selectedIds={form.techStackIds}
            onChange={(techStackIds) => setForm((current) => ({ ...current, techStackIds }))}
            onCreated={onCreatedStack}
          />
          <p className="mt-2 text-xs font-semibold text-slate-500">BD and closer users require 1 to 3 assigned tech stacks.</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!canSave} className={!canSave ? 'opacity-50' : undefined}>
          <Save size={14} /> Save
        </Button>
        <Button variant="light" onClick={onCancel}>
          <X size={14} /> Cancel
        </Button>
      </div>
    </div>
  );
}

function TechStackPicker({
  techStacks,
  selectedIds,
  onChange,
  onCreated,
}: {
  techStacks: TechStack[];
  selectedIds: string[];
  onChange: (stackIds: string[]) => void;
  onCreated: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const activeStacks = techStacks.filter((stack) => stack.isActive);
  const selected = techStacks.filter((stack) => selectedIds.includes(stack.id));
  const selectedSet = new Set(selectedIds);
  const filteredStacks = activeStacks
    .filter((stack) => !selectedSet.has(stack.id))
    .filter((stack) => !normalizedQuery || stack.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 8);
  const exactMatch = techStacks.find((stack) => stack.name.toLowerCase() === normalizedQuery);
  const canAddNew = normalizedQuery.length > 0 && !exactMatch && selectedIds.length < 3;

  const selectStack = (stackId: string) => {
    if (selectedSet.has(stackId) || selectedIds.length >= 3) return;
    onChange([...selectedIds, stackId]);
    setQuery('');
  };
  const removeStack = (stackId: string) => {
    onChange(selectedIds.filter((id) => id !== stackId));
  };
  const createAndSelect = async () => {
    const name = query.trim();
    if (!name || selectedIds.length >= 3) return;
    setCreating(true);
    try {
      const stack = await api<TechStack>('/tech-stacks', {
        method: 'POST',
        body: JSON.stringify({ name, isActive: true }),
        successMessage: 'Tech stack created.',
      });
      onChange([...selectedIds, stack.id]);
      setQuery('');
      await onCreated();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="grid min-w-0 gap-2">
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((stack) => (
            <span key={stack.id} className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-bold text-brand-red">
              <span className="truncate">{stack.name}</span>
              <button type="button" className="rounded p-0.5 hover:bg-red-100" onClick={() => removeStack(stack.id)} aria-label={`Remove ${stack.name}`}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
        <input
          className={inputClass}
          placeholder={selectedIds.length >= 3 ? 'Maximum 3 tech stacks selected' : 'Search or add tech stack'}
          value={query}
          disabled={selectedIds.length >= 3}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (canAddNew) void createAndSelect();
              else if (filteredStacks[0]) selectStack(filteredStacks[0].id);
            }
          }}
        />
        <div className="grid max-h-40 gap-1 overflow-auto">
          {filteredStacks.map((stack) => (
            <button
              key={stack.id}
              type="button"
              className="flex min-h-9 items-center justify-between gap-2 rounded-md px-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-white"
              onClick={() => selectStack(stack.id)}
            >
              <span className="truncate">{stack.name}</span>
              <Plus size={14} className="shrink-0 text-slate-400" />
            </button>
          ))}
          {canAddNew ? (
            <button
              type="button"
              className="flex min-h-9 items-center justify-between gap-2 rounded-md px-2 text-left text-sm font-bold text-brand-red transition hover:bg-white disabled:opacity-50"
              disabled={creating}
              onClick={createAndSelect}
            >
              <span className="truncate">Add "{query.trim()}"</span>
              <Plus size={14} className="shrink-0" />
            </button>
          ) : null}
          {!filteredStacks.length && !canAddNew ? (
            <span className="px-2 py-1 text-sm text-slate-500">{activeStacks.length ? 'No matching active tech stacks.' : 'No active stacks available.'}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function JobsPage({ bdMode = false }: { bdMode?: boolean }) {
  const { data, error, loading, reload } = useLoad<Job[]>('/jobs');
  const { data: techStacks } = useLoad<TechStack[]>('/tech-stacks');
  const [form, setForm] = useState({ platform: '', companyName: '', techStack: '', jobLink: '', jobDescription: '' });
  const [filters, setFilters] = useState({ date: '', platform: '', company: '', stack: '', status: '', bd: '' });
  const jobs = data ?? [];
  const stackOptions = useMemo(() => {
    const stackNames = (techStacks ?? []).filter((stack) => stack.isActive).map((stack) => stack.name);
    return stackNames.length ? stackNames : uniqueSorted(jobs.map((job) => job.techStack).filter(Boolean));
  }, [jobs, techStacks]);
  const filteredJobs = useMemo(() => {
    const platform = filters.platform.trim().toLowerCase();
    const company = filters.company.trim().toLowerCase();
    const bd = filters.bd.trim().toLowerCase();
    return jobs.filter((job) => {
      const jobDate = dateInputValue(job.dateAdded);
      return (
        (!filters.date || jobDate === filters.date) &&
        (!platform || job.platform.toLowerCase().includes(platform)) &&
        (!company || job.companyName.toLowerCase().includes(company)) &&
        (!filters.stack || job.techStack === filters.stack) &&
        (!filters.status || job.status === filters.status) &&
        (!bd || (job.bd?.name ?? '').toLowerCase().includes(bd))
      );
    });
  }, [filters, jobs]);
  const hasFilters = Object.values(filters).some(Boolean);
  const approvedJobs = useMemo(() => jobs.filter((job) => job.status === 'APPROVED_BY_ADMIN' || job.status === 'APPLIED').length, [jobs]);
  const pendingJobs = useMemo(() => jobs.filter((job) => job.status === 'PENDING_APPROVAL' || job.status === 'NOT_APPLIED').length, [jobs]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api('/jobs', { method: 'POST', body: JSON.stringify(form) });
    setForm({ platform: '', companyName: '', techStack: '', jobLink: '', jobDescription: '' });
    await reload();
  };

  return (
    <div className="grid min-w-0 gap-5">
      {bdMode ? (
        <Card>
          <form onSubmit={submit} className="grid min-w-0 gap-3 lg:grid-cols-5">
            <Field label="Platform"><input className={inputClass} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} required /></Field>
            <Field label="Company"><input className={inputClass} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required /></Field>
            <Field label="Tech Stack">
              <select className={inputClass} value={form.techStack} onChange={(e) => setForm({ ...form, techStack: e.target.value })} required>
                <option value="">Select stack</option>
                {(techStacks ?? []).map((stack) => <option key={stack.id} value={stack.name}>{stack.name}</option>)}
              </select>
            </Field>
            <Field label="Job Link"><input className={inputClass} type="url" value={form.jobLink} onChange={(e) => setForm({ ...form, jobLink: e.target.value })} required /></Field>
            <div className="flex items-end"><Button className="w-full" type="submit"><Plus size={16} /> Add Job</Button></div>
            <div className="lg:col-span-5">
              <Field label="JD"><textarea className={`${textareaClass} min-h-56`} value={form.jobDescription} onChange={(e) => setForm({ ...form, jobDescription: e.target.value })} required /></Field>
            </div>
          </form>
        </Card>
      ) : null}
      {loading && !data ? <MetricSkeletonGrid count={3} /> : (
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          <Card><p className="text-xs font-bold uppercase text-slate-500">Total Jobs</p><p className="mt-2 text-3xl font-black">{data?.length ?? 0}</p></Card>
          <Card><p className="text-xs font-bold uppercase text-slate-500">Pending Approval</p><p className="mt-2 text-3xl font-black">{pendingJobs}</p></Card>
          <Card><p className="text-xs font-bold uppercase text-slate-500">Approved By Admin</p><p className="mt-2 text-3xl font-black">{approvedJobs}</p></Card>
        </div>
      )}
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      {!bdMode ? (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-black">Filter Jobs</h3>
            <p className="text-xs font-bold text-slate-500">{filteredJobs.length} of {jobs.length} jobs</p>
          </div>
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Field label="Date"><input className={inputClass} type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} /></Field>
            <Field label="Platform"><input className={inputClass} placeholder="Search platform" value={filters.platform} onChange={(e) => setFilters({ ...filters, platform: e.target.value })} /></Field>
            <Field label="Company"><input className={inputClass} placeholder="Search company" value={filters.company} onChange={(e) => setFilters({ ...filters, company: e.target.value })} /></Field>
            <Field label="Stack">
              <select className={inputClass} value={filters.stack} onChange={(e) => setFilters({ ...filters, stack: e.target.value })}>
                <option value="">All stacks</option>
                {stackOptions.map((stack) => <option key={stack} value={stack}>{stack}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED_BY_ADMIN">Approved By Admin</option>
                <option value="REJECTED_BY_ADMIN">Rejected By Admin</option>
              </select>
            </Field>
            <Field label="BD"><input className={inputClass} placeholder="Search BD" value={filters.bd} onChange={(e) => setFilters({ ...filters, bd: e.target.value })} /></Field>
          </div>
          {hasFilters ? (
            <div className="mt-3">
              <Button variant="light" onClick={() => setFilters({ date: '', platform: '', company: '', stack: '', status: '', bd: '' })}>
                <X size={14} /> Clear Filters
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
      {loading && !data ? <TableSkeleton columns={8} /> : <Card className="p-0"><JobsTable jobs={bdMode ? jobs : filteredJobs} reload={reload} canApply={bdMode} /></Card>}
    </div>
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function dateInputValue(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function JobsTable({ jobs, reload, canApply }: { jobs: Job[]; reload: () => Promise<void>; canApply: boolean }) {
  const jobPagination = usePagination(jobs);
  return (
    <>
      <div className="table-wrap">
        <table className="lead-table">
          <thead><tr><th>Job ID</th><th>Date</th><th>Platform</th><th>Company</th><th>Stack</th><th>Status</th><th>BD</th><th>Actions</th></tr></thead>
          <tbody>
            {jobPagination.items.map((job) => (
              <tr key={job.id}>
                <td className="font-bold">{job.jobId}</td>
                <td>{shortDateTime(job.dateAdded)}</td>
                <td>{job.platform}</td>
                <td>{job.companyName}</td>
                <td>{job.techStack}</td>
                <td><Badge tone={statusTone(job.status)}>{label(job.status)}</Badge></td>
                <td>{job.bd?.name ?? '-'}</td>
                <td><JobActions job={job} reload={reload} canApply={canApply} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls {...jobPagination} />
    </>
  );
}

function JobActions({ job, reload, canApply }: { job: Job; reload: () => Promise<void>; canApply: boolean }) {
  const [decision, setDecision] = useState<'accept' | 'reject' | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  if (canApply) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="light" onClick={() => setShowDetails(true)} aria-label={`View ${job.jobId}`}>
          <Eye size={14} />
        </Button>
        <a className="inline-flex min-h-10 items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-bold" href={job.jobLink} target="_blank"><ExternalLink size={14} /> Open</a>
        <JobDetailsDialog job={job} open={showDetails} onClose={() => setShowDetails(false)} />
      </div>
    );
  }

  return (
    <div className="grid min-w-52 gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="light" onClick={() => setShowDetails(true)} aria-label={`View ${job.jobId}`}>
          <Eye size={14} />
        </Button>
        <a className="inline-flex min-h-10 items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-bold" href={job.jobLink} target="_blank"><ExternalLink size={14} /> Open</a>
        {job.status === 'APPROVED_BY_ADMIN' || job.status === 'APPLIED' ? null : job.status === 'REJECTED_BY_ADMIN' || job.status === 'REJECTED' ? (
          <Button onClick={async () => { await api(`/jobs/${job.id}/reopen`, { method: 'PATCH', body: JSON.stringify({ notes: job.adminNotes || undefined }) }); await reload(); }}>
            Reopen
          </Button>
        ) : (
          <>
            <Button onClick={() => setDecision('accept')}><Check size={14} /> Accept</Button>
            <Button variant="danger" onClick={() => setDecision('reject')}><X size={14} /> Reject</Button>
          </>
        )}
      </div>
      <JobDecisionDialog
        job={job}
        decision={decision}
        onCancel={() => setDecision(null)}
        onSaved={async () => {
          setDecision(null);
          await reload();
        }}
      />
      <JobDetailsDialog job={job} open={showDetails} onClose={() => setShowDetails(false)} />
    </div>
  );
}

function JobDetailsDialog({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="grid max-h-[86vh] w-full max-w-2xl gap-4 overflow-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-950">{job.jobId}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">{job.companyName} · {job.platform}</p>
          </div>
          <Button variant="light" onClick={onClose} aria-label="Close job details"><X size={14} /></Button>
        </div>
        <InfoRows rows={[
          ['Date', shortDateTime(job.dateAdded)],
          ['Stack', job.techStack],
          ['Status', label(job.status)],
          ['BD', job.bd?.name],
          ['Admin Notes', job.adminNotes],
          ['Rejection Reason', job.rejectionReason],
        ]} />
        <div>
          <p className="mb-2 text-sm font-bold text-slate-700">Description</p>
          <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">{job.jobDescription || '-'}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <a className="inline-flex min-h-10 items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-bold" href={job.jobLink} target="_blank"><ExternalLink size={14} /> Open Job</a>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function JobDecisionDialog({
  job,
  decision,
  onCancel,
  onSaved,
}: {
  job: Job;
  decision: 'accept' | 'reject' | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isReject = decision === 'reject';
  const canSubmit = !isReject || notes.trim().length > 0;

  useEffect(() => {
    if (decision) setNotes('');
  }, [decision, job.id]);

  if (!decision) return null;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isReject) {
        await api(`/jobs/${job.id}/reject`, { method: 'PATCH', body: JSON.stringify({ notes, reason: notes }) });
      } else {
        await api(`/jobs/${job.id}/approve`, { method: 'PATCH', body: JSON.stringify({ notes: notes || undefined }) });
      }
      await onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="grid w-full max-w-lg gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div>
          <h3 className="text-lg font-black text-slate-950">{isReject ? 'Reject job' : 'Accept job'}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{job.jobId} · {job.companyName}</p>
        </div>
        <Field label={isReject ? 'Rejection notes' : 'Notes'}>
          <textarea
            className={`${textareaClass} min-h-32`}
            placeholder={isReject ? 'Notes are required to reject this job.' : 'Optional notes for accepting this job.'}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        {isReject && !notes.trim() ? <p className="text-xs font-bold text-red-700">Rejection notes are required.</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="light" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button
            variant={isReject ? 'danger' : 'primary'}
            disabled={!canSubmit || submitting}
            className={!canSubmit || submitting ? 'opacity-50' : undefined}
            onClick={submit}
          >
            {isReject ? <X size={14} /> : <Check size={14} />} {isReject ? 'Reject' : 'Accept'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LeadSubmissionPage() {
  const router = useRouter();
  const { data: jobs } = useLoad<Job[]>('/jobs');
  const { data: techStacks } = useLoad<TechStack[]>('/tech-stacks');
  const [form, setForm] = useState({
    companyName: '',
    profileName: '',
    resumeUrl: '',
    nature: 'CONTRACT',
    techStackId: '',
    payrate: '',
    proofType: 'EMAIL_LINK',
    proofNotes: '',
    proofUrl: '',
    jobId: '',
  });
  const reset = { companyName: '', profileName: '', resumeUrl: '', nature: 'CONTRACT', techStackId: '', payrate: '', proofType: 'EMAIL_LINK', proofNotes: '', proofUrl: '', jobId: '' };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api('/bd/leads', { method: 'POST', body: JSON.stringify({ ...form, jobId: form.jobId || undefined, resumeUrl: form.resumeUrl || undefined, proofUrl: form.proofUrl || undefined }) });
    setForm(reset);
    router.push('/bd/my-leads');
  };
  return (
    <Card>
      <form onSubmit={submit} className="grid min-w-0 gap-3 md:grid-cols-3">
        <Field label="Company / Lead"><input className={inputClass} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required /></Field>
        <Field label="Profile Name"><input className={inputClass} value={form.profileName} onChange={(e) => setForm({ ...form, profileName: e.target.value })} required /></Field>
        <Field label="Resume/Profile URL"><input className={inputClass} type="url" value={form.resumeUrl} onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })} /></Field>
        <Field label="Nature"><select className={inputClass} value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })}><option value="W2">W2</option><option value="CONTRACT">Contract</option><option value="C2C">C2C</option></select></Field>
        <Field label="Tech Stack">
          <select className={inputClass} value={form.techStackId} onChange={(e) => setForm({ ...form, techStackId: e.target.value })} required>
            <option value="">Select stack</option>
            {(techStacks ?? []).map((stack) => <option key={stack.id} value={stack.id}>{stack.name}</option>)}
          </select>
        </Field>
        <Field label="Payrate / Value"><input className={inputClass} value={form.payrate} onChange={(e) => setForm({ ...form, payrate: e.target.value })} required /></Field>
        <Field label="Proof Type"><select className={inputClass} value={form.proofType} onChange={(e) => setForm({ ...form, proofType: e.target.value })}><option value="EMAIL_LINK">Email Link</option><option value="SCREENSHOT">Screenshot</option><option value="MANUAL_VERIFICATION">Manual Verification</option></select></Field>
        <Field label="Proof URL"><input className={inputClass} type="url" value={form.proofUrl} onChange={(e) => setForm({ ...form, proofUrl: e.target.value })} /></Field>
        <Field label="Related Job"><select className={inputClass} value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })}><option value="">None</option>{(jobs ?? []).map((job) => <option key={job.id} value={job.id}>{job.jobId} - {job.companyName}</option>)}</select></Field>
        <div className="md:col-span-3">
          <Field label="Proof Notes"><textarea className={`${textareaClass} min-h-40`} value={form.proofNotes} onChange={(e) => setForm({ ...form, proofNotes: e.target.value })} /></Field>
        </div>
        <div className="md:col-span-3"><Button type="submit"><Save size={16} /> Submit Lead</Button></div>
      </form>
    </Card>
  );
}

export function LeadsPage({ status, mode = 'list' }: { status?: LeadStatus; mode?: 'list' | 'approvals' | 'schedule' | 'calendar' | 'feedback' }) {
  const path = `${mode === 'schedule' ? '/bd/leads' : '/leads'}${status ? `?status=${status}` : ''}`;
  const { data, error, loading, reload } = useLoad<Lead[]>(path);
  const leads = data ?? [];
  const leadPagination = usePagination(leads);
  const showAdminLeadTable = mode === 'list';
  return (
    <div className="grid min-w-0 gap-5">
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      {loading && !data ? <TableSkeleton columns={8} /> : <Card className="p-0">
        {showAdminLeadTable ? <ReadyScheduleTable leads={leadPagination.items} canAssignCloser={status === 'READY_TO_SCHEDULE'} reload={reload} /> : <GenericLeadsTable leads={leadPagination.items} mode={mode} status={status} reload={reload} />}
        <PaginationControls {...leadPagination} />
      </Card>}
    </div>
  );
}

function GenericLeadsTable({ leads, mode, status, reload }: { leads: Lead[]; mode: string; status?: LeadStatus; reload: () => Promise<void> }) {
  const showNature = mode === 'approvals' && status === 'PENDING_APPROVAL';
  return (
    <div className="table-wrap">
      <table className="lead-table">
        <thead><tr><th>Lead</th><th>Stack</th>{showNature ? <th>Nature</th> : null}<th>Created BD</th><th>Assigned BD</th><th>Status</th><th>Calls</th><th>Details</th><th>Actions</th></tr></thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td><strong>{lead.companyName}</strong><br /><span className="text-slate-500">{lead.profileName} · {lead.payrate}</span></td>
              <td>{lead.techStack?.name ?? '-'}</td>
              {showNature ? <td><Badge>{label(lead.nature)}</Badge></td> : null}
              <td>{lead.createdByBd?.name ?? '-'}</td>
              <td>{lead.assignedBd?.name ?? '-'}</td>
              <td><Badge tone={statusTone(lead.status)}>{label(lead.status)}</Badge></td>
              <td>{lead.calls?.length ?? 0}</td>
              <td>
                <Link className="inline-flex rounded-md bg-slate-100 px-2.5 py-2 text-sm font-bold" href={mode === 'schedule' ? `/bd/leads/${lead.id}` : `/admin/leads/${lead.id}`}><Eye size={16} /></Link>
              </td>
              <td><LeadActions lead={lead} mode={mode} reload={reload} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReadyScheduleTable({ leads, canAssignCloser, reload }: { leads: Lead[]; canAssignCloser: boolean; reload: () => Promise<void> }) {
  const [jobDetails, setJobDetails] = useState<Job | null>(null);

  return (
    <>
      <div className="table-wrap">
        <table className="lead-table">
          <thead><tr><th>Lead</th><th>Job</th><th>Stack</th><th>Assigned BD</th><th>Resume</th><th>Status</th><th>Calls</th>{canAssignCloser ? <th>Assign Closer</th> : null}</tr></thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <Link className="font-bold text-brand-red hover:underline" href={`/admin/leads/${lead.id}`}>{lead.companyName}</Link>
                  <br />
                  <span className="text-slate-500">{lead.profileName} · {lead.payrate}</span>
                </td>
                <td>
                  {lead.job ? (
                    <Button variant="light" className="px-2.5" title="View job details" onClick={() => setJobDetails(lead.job ?? null)}>
                      <Eye size={16} />
                      <span>{lead.job.jobId}</span>
                    </Button>
                  ) : <span className="text-sm text-slate-500">-</span>}
                </td>
                <td>{lead.techStack?.name ?? '-'}</td>
                <td>{lead.assignedBd?.name ?? lead.createdByBd?.name ?? '-'}</td>
                <td>
                  {lead.resumeUrl ? <a className="font-bold text-brand-red hover:underline" href={lead.resumeUrl} target="_blank">Resume</a> : '-'}
                </td>
                <td><Badge tone={statusTone(lead.status)}>{label(lead.status)}</Badge></td>
                <td>{lead.calls?.length ?? 0}</td>
                {canAssignCloser ? (
                  <td>
                    <ScheduleCallForm leadId={lead.id} leadTechStackId={lead.techStackId} compact adminMode onSaved={reload} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {jobDetails ? <JobDetailsDialog job={jobDetails} open={Boolean(jobDetails)} onClose={() => setJobDetails(null)} /> : null}
    </>
  );
}

function LeadActions({ lead, mode, reload }: { lead: Lead; mode: string; reload: () => Promise<void> }) {
  if (mode === 'approvals') return <ApprovalActions lead={lead} reload={reload} />;
  if (mode === 'schedule') return <ScheduleCallInline lead={lead} reload={reload} />;
  return <span className="text-sm text-slate-500">Read-only</span>;
}

function ApprovalActions({ lead, reload }: { lead: Lead; reload: () => Promise<void> }) {
  const { data: bds } = useLoad<User[]>('/users?role=BD');
  const eligibleBds = (bds ?? []).filter((bd) => bd.assignedTechStacks?.some((stack) => stack.id === lead.techStackId));
  const [note, setNote] = useState('');
  const [assignedBdId, setAssignedBdId] = useState(lead.createdByBd?.id ?? '');
  const canReview = lead.status === 'PENDING_APPROVAL';
  const canReopen = ['DISMISSED', 'REJECTED', 'CLOSED'].includes(lead.status);
  useEffect(() => {
    if (!canReview || !bds) return;
    if (assignedBdId && eligibleBds.some((bd) => bd.id === assignedBdId)) return;
    setAssignedBdId(eligibleBds[0]?.id ?? '');
  }, [assignedBdId, bds, canReview, eligibleBds]);
  return (
    <div className="grid min-w-0 max-w-sm gap-2 sm:min-w-64">
      {canReview ? (
        <select className={inputClass} value={assignedBdId} onChange={(e) => setAssignedBdId(e.target.value)}>
          <option value="">Assign BD</option>
          {eligibleBds.map((bd) => <option key={bd.id} value={bd.id}>{bd.name}</option>)}
        </select>
      ) : null}
      <textarea
        className={`${textareaClass} min-h-24`}
        placeholder={canReopen ? 'Reason for reopening this lead...' : 'Approval notes or dismissal reason...'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {canReview ? (
          <>
            <Button onClick={async () => { await api(`/admin/leads/${lead.id}/approve`, { method: 'PATCH', body: JSON.stringify({ notes: note, assignedBdId: assignedBdId || undefined }) }); await reload(); }}>Approve</Button>
            <Button variant="danger" onClick={async () => { await api(`/admin/leads/${lead.id}/dismiss`, { method: 'PATCH', body: JSON.stringify({ reason: note }) }); await reload(); }}>Dismiss</Button>
          </>
        ) : null}
        {canReopen ? (
          <Button variant="light" onClick={async () => { await api(`/admin/leads/${lead.id}/reopen`, { method: 'PATCH', body: JSON.stringify({ notes: note }) }); await reload(); }}>Reopen to Pending Approval</Button>
        ) : null}
        {!canReview && !canReopen ? <span className="text-sm font-semibold text-slate-500">No review action available</span> : null}
      </div>
    </div>
  );
}

function ScheduleCallInline({ lead, reload }: { lead: Lead; reload: () => Promise<void> }) {
  const canSchedule = ['READY_TO_SCHEDULE', 'NEXT_CALL_REQUIRED', 'CALL_SCHEDULED', 'IN_PROGRESS'].includes(lead.status);
  if (!canSchedule) return <span className="text-sm text-slate-500">Awaiting approval</span>;
  return <span className="text-sm font-semibold text-slate-500">Admin assigns closer</span>;
}

function ScheduleCallForm({ leadId, leadTechStackId, compact = false, adminMode = false, onSaved }: { leadId: string; leadTechStackId?: string; compact?: boolean; adminMode?: boolean; onSaved: () => Promise<void> }) {
  const { data: closers } = useLoad<User[]>('/users?role=CLOSER');
  const eligibleClosers = (closers ?? []).filter((closer) => !leadTechStackId || closer.assignedTechStacks?.some((stack) => stack.id === leadTechStackId));
  const [form, setForm] = useState({ closerId: '', callStage: 'SCREENING' as CallStage, scheduledAt: '', manualInviteStatus: 'MANUAL_INVITE_PENDING' as ManualInviteStatus, manualInviteLink: '', bdNotes: '' });
  useEffect(() => {
    if (!form.closerId || eligibleClosers.some((closer) => closer.id === form.closerId)) return;
    setForm((current) => ({ ...current, closerId: '' }));
  }, [eligibleClosers, form.closerId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api(`${adminMode ? '/admin' : '/bd'}/leads/${leadId}/calls`, { method: 'POST', body: JSON.stringify({ ...form, manualInviteLink: form.manualInviteLink || undefined, bdNotes: form.bdNotes || undefined }) });
    setForm({ closerId: '', callStage: 'SCREENING', scheduledAt: '', manualInviteStatus: 'MANUAL_INVITE_PENDING', manualInviteLink: '', bdNotes: '' });
    await onSaved();
  };
  return (
    <form onSubmit={submit} className={`grid min-w-0 gap-2 ${compact ? 'max-w-sm sm:min-w-64' : 'md:grid-cols-3'}`}>
      <select className={inputClass} value={form.closerId} onChange={(e) => setForm({ ...form, closerId: e.target.value })} required>
        <option value="">Closer</option>
        {eligibleClosers.map((closer) => <option key={closer.id} value={closer.id}>{closer.name}</option>)}
      </select>
      <select className={inputClass} value={form.callStage} onChange={(e) => setForm({ ...form, callStage: e.target.value as CallStage })}>{callStages.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>
      <input className={inputClass} type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} required />
      {!compact ? (
        <>
          <select className={inputClass} value={form.manualInviteStatus} onChange={(e) => setForm({ ...form, manualInviteStatus: e.target.value as ManualInviteStatus })}>{manualStatuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>
          <input className={inputClass} type="url" placeholder="Client response link" value={form.manualInviteLink} onChange={(e) => setForm({ ...form, manualInviteLink: e.target.value })} />
          <input className={inputClass} placeholder="BD notes" value={form.bdNotes} onChange={(e) => setForm({ ...form, bdNotes: e.target.value })} />
        </>
      ) : null}
      <Button type="submit"><CalendarPlus size={16} /> Schedule Call</Button>
    </form>
  );
}

export function LeadDetailPage({ role, id }: { role: 'admin' | 'bd'; id: string }) {
  const endpoint = role === 'admin' ? `/admin/leads/${id}` : `/bd/leads/${id}`;
  const { data: lead, error, loading, reload } = useLoad<Lead>(endpoint);
  if (error) return <Card className="text-sm font-semibold text-red-700">{error}</Card>;
  if (loading && !lead) return <DetailSkeleton />;
  if (!lead) return <Card>No lead found.</Card>;
  return (
    <div className="grid min-w-0 gap-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{lead.companyName}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{lead.profileName} · {lead.techStack?.name ?? '-'} · {lead.payrate}</p>
          </div>
          <Badge tone={statusTone(lead.status)}>{label(lead.status)}</Badge>
        </div>
      </Card>
      {role === 'admin' && ['PENDING_APPROVAL', 'DISMISSED', 'REJECTED', 'CLOSED'].includes(lead.status) ? (
        <Card>
          <h3 className="mb-3 font-black">Admin Review</h3>
          <ApprovalActions lead={lead} reload={reload} />
        </Card>
      ) : null}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Card><h3 className="mb-3 font-black">Overview</h3><InfoRows rows={[['Created BD', lead.createdByBd?.name], ['Assigned BD', lead.assignedBd?.name], ['Approved By', lead.approvedByAdmin?.name], ['Current Stage', label(lead.currentStage)], ['Nature', label(lead.nature)]]} /></Card>
        <Card><h3 className="mb-3 font-black">Proof / Notes</h3><InfoRows rows={[['Proof Type', label(lead.proofType)], ['Proof URL', lead.proofUrl], ['Proof Notes', lead.proofNotes], ['Admin Notes', lead.adminNotes], ['Dismissal Reason', lead.dismissalReason]]} /></Card>
        <RelatedJobCard job={lead.job} />
      </div>
      {role === 'bd' && ['READY_TO_SCHEDULE', 'NEXT_CALL_REQUIRED', 'CALL_SCHEDULED', 'IN_PROGRESS'].includes(lead.status) ? (
        <Card>
          <h3 className="mb-3 font-black">Closer Assignment</h3>
          <p className="text-sm font-semibold text-slate-500">Admin will assign the closer and notify this BD.</p>
        </Card>
      ) : null}
      <Card className="p-0">
        <h3 className="px-5 pt-5 font-black">Calls</h3>
        <CallsTable calls={lead.calls ?? []} role={role} reload={reload} />
      </Card>
      <Card>
        <h3 className="mb-4 font-black">Timeline</h3>
        <div className="grid gap-3">
          {(lead.timeline ?? []).map((event) => (
            <div key={event.id} className="border-l-4 border-slate-200 pl-3">
              <p className="font-bold">{label(event.action)}</p>
              <p className="text-sm text-slate-600">{event.description}</p>
              <p className="text-xs text-slate-500">{shortDateTime(event.createdAt)} · {event.actor?.name ?? 'System'}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RelatedJobCard({ job }: { job?: Job }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-black">Parent Job</h3>
        {job ? (
          <Button variant="light" className="px-2.5" title="View job details" onClick={() => setShowDetails(true)}>
            <Eye size={16} />
          </Button>
        ) : null}
      </div>
      <InfoRows rows={[
        ['Job ID', job?.jobId],
        ['Company', job?.companyName],
        ['Platform', job?.platform],
        ['Stack', job?.techStack],
        ['Status', label(job?.status)],
      ]} />
      {job ? <JobDetailsDialog job={job} open={showDetails} onClose={() => setShowDetails(false)} /> : null}
    </Card>
  );
}

function InfoRows({ rows }: { rows: Array<[string, string | undefined | null]> }) {
  return <div className="grid gap-2 text-sm">{rows.map(([name, value]) => <p key={name}><span className="font-bold text-slate-500">{name}:</span> {value || '-'}</p>)}</div>;
}

function CallsTable({ calls, role, reload }: { calls: LeadCall[]; role: 'admin' | 'bd'; reload: () => Promise<void> }) {
  const [feedbackCall, setFeedbackCall] = useState<LeadCall | null>(null);
  return (
    <>
      <div className="table-wrap">
        <table className="lead-table">
          <thead><tr><th>#</th><th>Stage</th><th>Scheduled</th><th>Closer</th><th>Status</th><th>Client Response</th><th>Feedback</th><th>Actions</th></tr></thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call.id}>
                <td className="font-bold">{call.callNumber}</td>
                <td>{label(call.callStage)}</td>
                <td>{shortDateTime(call.scheduledAt)}</td>
                <td>{call.closer?.name ?? '-'}</td>
                <td><Badge tone={statusTone(call.status)}>{label(call.status)}</Badge></td>
                <td><Badge tone={statusTone(call.manualInviteStatus)}>{clientResponseLabel(call.manualInviteStatus)}</Badge>{call.manualInviteLink ? <><br /><a className="font-semibold text-red-700" href={call.manualInviteLink} target="_blank">Open link</a></> : null}</td>
                <td>
                  <Button variant="light" className="px-2.5" title="View closer feedback" onClick={() => setFeedbackCall(call)}>
                    <Eye size={16} />
                    <span>{call.feedback?.length ?? 0}</span>
                  </Button>
                </td>
                <td>{role === 'bd' ? <ManualInviteAction call={call} reload={reload} /> : <span className="text-sm text-slate-500">Read-only</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {feedbackCall ? <FeedbackModal call={feedbackCall} onClose={() => setFeedbackCall(null)} /> : null}
    </>
  );
}

function FeedbackModal({ call, onClose }: { call: LeadCall; onClose: () => void }) {
  const feedback = call.feedback ?? [];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-x-hidden bg-slate-950/60 p-3 sm:p-4">
      <section className="max-h-[86vh] w-full max-w-3xl min-w-0 overflow-auto rounded-lg bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-black tracking-tight">Closer Feedback</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Call #{call.callNumber} · {label(call.callStage)} · {call.closer?.name ?? 'Closer'}
            </p>
          </div>
          <Button variant="light" className="px-2.5" title="Close feedback" onClick={onClose}>
            <X size={16} />
          </Button>
        </header>
        <div className="grid min-w-0 gap-4 p-4 sm:p-5">
          {feedback.length ? feedback.map((item) => <FeedbackLine key={item.id} feedback={item} />) : (
            <div className="rounded-md bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              No closer feedback submitted yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FeedbackLine({ feedback }: { feedback: CallFeedback }) {
  return (
    <div className="rounded-md bg-slate-50 p-4 text-sm">
      <div className="flex flex-wrap gap-2"><Badge tone={statusTone(feedback.callStatus)}>{label(feedback.callStatus)}</Badge><Badge tone={statusTone(feedback.result)}>{label(feedback.result)}</Badge></div>
      <p className="mt-3 whitespace-pre-wrap leading-6 text-slate-700">{feedback.comments}</p>
      <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-500 md:grid-cols-3">
        <span>Closer: {feedback.closer?.name ?? 'Closer'}</span>
        <span>Payrate: {feedback.payrateDiscussed}</span>
        <span>Date: {shortDateTime(feedback.createdAt)}</span>
      </div>
      {feedback.nextAction ? <p className="mt-2 text-sm font-semibold text-slate-700">Next action: {feedback.nextAction}</p> : null}
      {feedback.nextCallRequired ? <p className="mt-1 text-sm font-semibold text-amber-700">Next call required</p> : null}
    </div>
  );
}

function ManualInviteAction({ call, reload }: { call: LeadCall; reload: () => Promise<void> }) {
  const [manualInviteStatus, setManualInviteStatus] = useState<ManualInviteStatus>(call.manualInviteStatus);
  return (
    <div className="grid min-w-0 max-w-xs gap-2 sm:min-w-48">
      <select className={inputClass} value={manualInviteStatus} onChange={(e) => setManualInviteStatus(e.target.value as ManualInviteStatus)}>{manualStatuses.map((value) => <option key={value} value={value}>{clientResponseLabel(value)}</option>)}</select>
      <Button onClick={async () => { await api(`/bd/leads/${call.leadId}/manual-calendar`, { method: 'PATCH', body: JSON.stringify({ leadCallId: call.id, manualInviteStatus }) }); await reload(); }}>Update Response</Button>
    </div>
  );
}

export function CallsPage({ role, status, stage }: { role: Role; status?: LeadCallStatus; stage?: CallStage }) {
  const endpoint = role === 'SUPER_ADMIN' ? '/admin/calls' : role === 'BD' ? '/bd/calls' : '/closer/calls';
  const { data, error, loading, reload } = useLoad<LeadCall[]>(endpoint);
  const calls = (data ?? []).filter((call) => (!status || call.status === status) && (!stage || call.callStage === stage));
  const callPagination = usePagination(calls);
  return (
    <div className="grid min-w-0 gap-5">
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      {loading && !data ? <TableSkeleton columns={8} /> : <Card className="p-0">
        <div className="table-wrap">
          <table className="lead-table">
            <thead><tr><th>Lead</th><th>#</th><th>Stage</th><th>Scheduled</th><th>Closer</th><th>Status</th><th>Feedback</th><th>Details</th></tr></thead>
            <tbody>
              {callPagination.items.map((call) => (
                <tr key={call.id}>
                  <td><strong>{call.lead?.companyName}</strong><br /><span className="text-slate-500">{call.lead?.profileName}</span></td>
                  <td>{call.callNumber}</td>
                  <td>{label(call.callStage)}</td>
                  <td>{shortDateTime(call.scheduledAt)}</td>
                  <td>{call.closer?.name ?? '-'}</td>
                  <td><Badge tone={statusTone(call.status)}>{label(call.status)}</Badge></td>
                  <td>{call.feedback?.length ?? 0}</td>
                  <td>{role === 'CLOSER' ? <Link className="inline-flex rounded-md bg-slate-100 px-2.5 py-2 text-sm font-bold" href={`/closer/calls/${call.id}`}><Eye size={16} /></Link> : <Button variant="light" onClick={reload}>Refresh</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls {...callPagination} />
      </Card>}
    </div>
  );
}

export function FeedbackPage() {
  return <CallsPage role="CLOSER" />;
}

export function CloserCallDetailPage({ id }: { id: string }) {
  const { data: call, error, loading, reload } = useLoad<LeadCall>(`/closer/calls/${id}`);
  if (error) return <Card className="text-sm font-semibold text-red-700">{error}</Card>;
  if (loading && !call) return <DetailSkeleton />;
  if (!call) return <Card>No call found.</Card>;
  return (
    <div className="grid min-w-0 gap-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{call.lead?.companyName}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Call #{call.callNumber} · {label(call.callStage)} · {shortDateTime(call.scheduledAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(call.manualInviteStatus)}>{clientResponseLabel(call.manualInviteStatus)}</Badge>
            <Badge tone={statusTone(call.status)}>{label(call.status)}</Badge>
            {call.manualInviteStatus !== 'ACCEPTED' ? (
              <Button onClick={async () => { await api(`/closer/calls/${call.id}/accept`, { method: 'PATCH' }); await reload(); }}>
                <Check size={16} /> Accept Call
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card><h3 className="mb-3 font-black">Lead</h3><InfoRows rows={[['Profile', call.lead?.profileName], ['Tech Stack', call.lead?.techStack?.name], ['Payrate', call.lead?.payrate], ['BD', call.lead?.assignedBd?.name]]} /></Card>
        <Card><h3 className="mb-3 font-black">Client Response</h3><InfoRows rows={[['Status', clientResponseLabel(call.manualInviteStatus)], ['Response Link', call.manualInviteLink], ['BD Notes', call.bdNotes]]} /></Card>
      </div>
      <Card>
        <h3 className="mb-3 font-black">Submit Feedback</h3>
        <CallFeedbackForm callId={call.id} onSaved={reload} />
      </Card>
      <Card>
        <h3 className="mb-3 font-black">Feedback History</h3>
        <div className="grid gap-3">{(call.feedback ?? []).map((item) => <FeedbackLine key={item.id} feedback={item} />)}</div>
      </Card>
    </div>
  );
}

function CallFeedbackForm({ callId, onSaved }: { callId: string; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ callStatus: 'TAKEN' as FeedbackCallStatus, result: 'NO_DECISION' as FeedbackResult, comments: '', payrateDiscussed: '', nextAction: '', nextCallRequired: false });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api(`/closer/calls/${callId}/feedback`, { method: 'POST', body: JSON.stringify({ ...form, nextAction: form.nextAction || undefined }) });
    setForm({ callStatus: 'TAKEN', result: 'NO_DECISION', comments: '', payrateDiscussed: '', nextAction: '', nextCallRequired: false });
    await onSaved();
  };
  return (
    <form onSubmit={submit} className="grid min-w-0 gap-3 md:grid-cols-3">
      <Field label="Call Status"><select className={inputClass} value={form.callStatus} onChange={(e) => setForm({ ...form, callStatus: e.target.value as FeedbackCallStatus })}>{['TAKEN','RESCHEDULED','NO_SHOW','SHIFTED'].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Field>
      <Field label="Result"><select className={inputClass} value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as FeedbackResult })}>{['PASSED','FAILED','NEED_NEXT_CALL','OFFERED','REJECTED','NO_DECISION'].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Field>
      <Field label="Payrate Discussed"><input className={inputClass} value={form.payrateDiscussed} onChange={(e) => setForm({ ...form, payrateDiscussed: e.target.value })} required /></Field>
      <div className="md:col-span-3"><Field label="Comments"><textarea className={`${textareaClass} min-h-36`} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} required /></Field></div>
      <Field label="Next Action"><input className={inputClass} value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} /></Field>
      <label className="flex items-center gap-2 pt-7 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.nextCallRequired} onChange={(e) => setForm({ ...form, nextCallRequired: e.target.checked })} /> Next call required</label>
      <div className="flex items-end"><Button type="submit"><Save size={16} /> Save Feedback</Button></div>
    </form>
  );
}

export function TechStacksPage() {
  const { data, error, loading, reload } = useLoad<TechStack[]>('/tech-stacks');
  const [form, setForm] = useState({ name: '', description: '' });
  const [deleteStack, setDeleteStack] = useState<TechStack | null>(null);
  const stacks = data ?? [];
  const stackPagination = usePagination(stacks);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api('/tech-stacks', { method: 'POST', body: JSON.stringify(form) });
    setForm({ name: '', description: '' });
    await reload();
  };

  return (
    <div className="grid min-w-0 gap-5">
      <Card>
        <form onSubmit={submit} className="grid min-w-0 gap-3 md:grid-cols-[1fr_2fr_auto]">
          <Field label="Stack Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Description"><input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="flex items-end"><Button type="submit"><Plus size={16} /> Add Stack</Button></div>
        </form>
      </Card>
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      {loading && !data ? <TableSkeleton columns={4} /> : <Card className="p-0">
        <div className="table-wrap">
          <table className="lead-table">
            <thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {stackPagination.items.map((stack) => (
                <tr key={stack.id}>
                  <td className="font-bold">{stack.name}</td>
                  <td>{stack.description ?? '-'}</td>
                  <td><Badge tone={stack.isActive ? 'green' : 'red'}>{stack.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td><div className="flex flex-wrap gap-2">
                    <Button variant="light" onClick={async () => { await api(`/tech-stacks/${stack.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !stack.isActive }) }); await reload(); }}>{stack.isActive ? 'Deactivate' : 'Activate'}</Button>
                    <Button variant="danger" onClick={() => setDeleteStack(stack)}><Trash2 size={14} /> Delete</Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls {...stackPagination} />
      </Card>}
      <ConfirmDialog
        open={Boolean(deleteStack)}
        title="Delete tech stack?"
        message={deleteStack ? `This will delete ${deleteStack.name}. This action cannot be undone.` : ''}
        confirmLabel="Delete"
        onCancel={() => setDeleteStack(null)}
        onConfirm={async () => {
          if (!deleteStack) return;
          await api(`/tech-stacks/${deleteStack.id}`, { method: 'DELETE' });
          setDeleteStack(null);
          await reload();
        }}
      />
    </div>
  );
}

export function AuditLogsPage() {
  const { data, error, loading } = useLoad<Array<{ id: string; action: string; entityType: string; entityId?: string; createdAt: string; actor?: User }>>('/audit-logs');
  const logs = data ?? [];
  const logPagination = usePagination(logs);
  if (loading && !data) return <TableSkeleton columns={4} />;
  return (
    <Card className="p-0">
      {error ? <p className="p-4 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="table-wrap">
        <table className="lead-table">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
          <tbody>{logPagination.items.map((log) => <tr key={log.id}><td>{shortDateTime(log.createdAt)}</td><td>{log.actor?.name ?? 'System'}</td><td><Badge>{label(log.action)}</Badge></td><td>{log.entityType} {log.entityId ?? ''}</td></tr>)}</tbody>
        </table>
      </div>
      <PaginationControls {...logPagination} />
    </Card>
  );
}
