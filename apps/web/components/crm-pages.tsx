'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, ExternalLink, Eye, Plus, Save, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { label, shortDate } from '@/lib/format';
import {
  CallFeedback,
  CallStage,
  FeedbackCallStatus,
  FeedbackResult,
  Job,
  Lead,
  LeadCall,
  LeadStatus,
  ManualInviteStatus,
  Role,
  TechStack,
  User,
} from '@/types/domain';
import { Badge, Button, Card, Field, inputClass, textareaClass } from './ui';

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
  const load = async () => {
    try {
      setData(await api<T>(path));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  };
  useEffect(() => {
    if (enabled) void load();
  }, [path, enabled]);
  return { data, error, reload: load };
}

function statusTone(status?: string): 'red' | 'green' | 'yellow' | 'slate' | 'blue' {
  if (!status) return 'slate';
  if (['READY_TO_SCHEDULE', 'COMPLETED', 'ACCEPTED', 'TAKEN', 'PASSED', 'OFFERED', 'APPLIED'].includes(status)) return 'green';
  if (['PENDING_APPROVAL', 'MANUAL_INVITE_PENDING', 'PENDING_FEEDBACK', 'NEXT_CALL_REQUIRED'].includes(status)) return 'yellow';
  if (['DISMISSED', 'DECLINED', 'NO_SHOW', 'REJECTED', 'FAILED', 'CANCELLED', 'CLOSED'].includes(status)) return 'red';
  return 'blue';
}

const TABLE_PAGE_SIZE = 10;
const callStages: CallStage[] = ['SCREENING', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'FINAL', 'OFFERED'];
const manualStatuses: ManualInviteStatus[] = ['MANUAL_INVITE_PENDING', 'MANUAL_INVITE_CREATED', 'ACCEPTED', 'DECLINED', 'REMINDER_DUE'];

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

export function DashboardPage({ role }: { role: Role }) {
  const { data, error } = useLoad<DashboardReport>('/reports/dashboard');
  const title = role === 'SUPER_ADMIN' ? 'Executive Dashboard' : role === 'BD' ? 'BD Dashboard' : 'Closer Dashboard';
  const cards = [
    ['Users', data?.totals.users],
    ['Jobs', data?.totals.jobs],
    ['Leads', data?.totals.leads],
    ['Calls', data?.totals.calls],
    ['Feedback', data?.totals.feedback],
    ['Pending Feedback', data?.totals.pendingFeedbackCalls],
  ];

  return (
    <div className="grid min-w-0 gap-5">
      <section className="rounded-lg border border-red-900/20 bg-neutral-950 p-4 text-white shadow-panel sm:p-6">
        <h2 className="text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Lead operations by parent lead, scheduled calls, closer feedback, and timeline movement.
        </p>
      </section>
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      <div className="grid min-w-0 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([name, value]) => (
          <Card key={String(name)}>
            <p className="text-xs font-bold uppercase text-slate-500">{name}</p>
            <p className="mt-2 text-3xl font-black">{value ?? 0}</p>
          </Card>
        ))}
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <SummaryCard title="Lead Status Summary" rows={(data?.leadStatuses ?? []).map((row) => [row.status, row._count])} />
        <SummaryCard title="Call Status Summary" rows={(data?.callStatuses ?? []).map((row) => [row.status, row._count])} />
        <SummaryCard title="Call Stage Summary" rows={(data?.callStages ?? []).map((row) => [row.callStage, row._count])} />
      </div>
    </div>
  );
}

function SummaryCard({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <Card>
      <h3 className="mb-4 font-black">{title}</h3>
      <div className="grid gap-3">
        {rows.length ? rows.map(([name, count]) => (
          <div key={name} className="flex items-center justify-between border-b border-slate-100 pb-2">
            <Badge tone={statusTone(name)}>{label(name)}</Badge>
            <span className="font-black">{count}</span>
          </div>
        )) : <p className="text-sm text-slate-500">No data yet.</p>}
      </div>
    </Card>
  );
}

export function UsersPage({ roleFilter }: { roleFilter?: Role }) {
  const { data, error, reload } = useLoad<User[]>(`/users${roleFilter ? `?role=${roleFilter}` : ''}`);
  const [form, setForm] = useState({ name: '', email: '', role: roleFilter ?? 'BD' });
  const [inviteUrl, setInviteUrl] = useState('');
  const users = data ?? [];
  const userPagination = usePagination(users);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const user = await api<User & { invitationUrl?: string }>('/users', { method: 'POST', body: JSON.stringify(form) });
    setInviteUrl(user.invitationUrl ?? '');
    setForm({ name: '', email: '', role: roleFilter ?? 'BD' });
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
              <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="BD">BD</option>
                <option value="CLOSER">Closer</option>
              </select>
            </Field>
          ) : null}
          <div className="flex items-end"><Button className="w-full" type="submit"><Plus size={16} /> Send Invite</Button></div>
        </form>
      </Card>
      {inviteUrl ? (
        <Card className="border-amber-200 bg-amber-50 text-sm">
          <p className="font-black text-amber-900">Invite link:</p>
          <p className="mt-1 text-amber-900">Use this if the email does not arrive, or send it manually to the user.</p>
          <a className="mt-2 block break-all font-bold text-red-700" href={inviteUrl} target="_blank">{inviteUrl}</a>
        </Card>
      ) : null}
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      <Card className="p-0">
        <div className="table-wrap">
          <table className="lead-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {userPagination.items.map((user) => (
                <tr key={user.id}>
                  <td className="font-bold">{user.name}</td>
                  <td>{user.email}</td>
                  <td><Badge>{label(user.role)}</Badge></td>
                  <td><Badge tone={user.status === 'ACTIVE' ? 'green' : 'red'}>{label(user.status)}</Badge></td>
                  <td><div className="flex flex-wrap gap-2">
                    {user.role === 'SUPER_ADMIN' ? <span className="text-sm font-semibold text-slate-500">Protected</span> : (
                      <>
                        {user.status === 'INACTIVE' ? (
                          <Button variant="light" onClick={async () => {
                            const resent = await api<User & { invitationUrl?: string }>(`/users/${user.id}/resend-invite`, { method: 'POST' });
                            setInviteUrl(resent.invitationUrl ?? '');
                            await reload();
                          }}>
                            Resend Invite
                          </Button>
                        ) : null}
                        <Button variant="light" onClick={async () => { await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }) }); await reload(); }}>
                          {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button variant="danger" onClick={async () => { await api(`/users/${user.id}`, { method: 'DELETE' }); await reload(); }}>
                          <Trash2 size={14} /> Delete
                        </Button>
                      </>
                    )}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls {...userPagination} />
      </Card>
    </div>
  );
}

export function JobsPage({ bdMode = false }: { bdMode?: boolean }) {
  const { data, error, reload } = useLoad<Job[]>('/jobs');
  const { data: techStacks } = useLoad<TechStack[]>('/tech-stacks', bdMode);
  const [form, setForm] = useState({ platform: '', companyName: '', techStack: '', jobLink: '', jobDescription: '' });
  const appliedToday = useMemo(() => (data ?? []).filter((job) => job.status === 'APPLIED' && new Date(job.dateAdded).toDateString() === new Date().toDateString()).length, [data]);
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
      <div className="grid min-w-0 gap-4 md:grid-cols-3">
        <Card><p className="text-xs font-bold uppercase text-slate-500">Total Jobs</p><p className="mt-2 text-3xl font-black">{data?.length ?? 0}</p></Card>
        <Card><p className="text-xs font-bold uppercase text-slate-500">Applied Today</p><p className="mt-2 text-3xl font-black">{appliedToday}</p></Card>
        <Card><p className="text-xs font-bold uppercase text-slate-500">Not Applied</p><p className="mt-2 text-3xl font-black">{(data ?? []).filter((job) => job.status === 'NOT_APPLIED').length}</p></Card>
      </div>
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      <Card className="p-0"><JobsTable jobs={data ?? []} reload={reload} canApply={bdMode} /></Card>
    </div>
  );
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
                <td>{shortDate(job.dateAdded)}</td>
                <td>{job.platform}</td>
                <td>{job.companyName}</td>
                <td>{job.techStack}</td>
                <td><Badge tone={statusTone(job.status)}>{label(job.status)}</Badge></td>
                <td>{job.bd?.name ?? '-'}</td>
                <td><div className="flex flex-wrap gap-2">
                  <a className="inline-flex min-h-10 items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-bold" href={job.jobLink} target="_blank"><ExternalLink size={14} /> Open</a>
                  {canApply ? <Button onClick={async () => { window.open(job.jobLink, '_blank'); await api(`/jobs/${job.id}/apply`, { method: 'PATCH' }); await reload(); }}><Check size={14} /> Apply</Button> : null}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls {...jobPagination} />
    </>
  );
}

export function LeadSubmissionPage() {
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
  const { data, error, reload } = useLoad<Lead[]>(path);
  const leads = data ?? [];
  const leadPagination = usePagination(leads);
  return (
    <div className="grid min-w-0 gap-5">
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      <Card className="p-0">
        <div className="table-wrap">
          <table className="lead-table">
            <thead><tr><th>Lead</th><th>Stack</th><th>Created BD</th><th>Assigned BD</th><th>Status</th><th>Calls</th><th>Details</th><th>Actions</th></tr></thead>
            <tbody>
              {leadPagination.items.map((lead) => (
                <tr key={lead.id}>
                  <td><strong>{lead.companyName}</strong><br /><span className="text-slate-500">{lead.profileName} · {lead.payrate}</span></td>
                  <td>{lead.techStack?.name ?? '-'}</td>
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
        <PaginationControls {...leadPagination} />
      </Card>
    </div>
  );
}

function LeadActions({ lead, mode, reload }: { lead: Lead; mode: string; reload: () => Promise<void> }) {
  if (mode === 'approvals') return <ApprovalActions lead={lead} reload={reload} />;
  if (mode === 'schedule') return <ScheduleCallInline lead={lead} reload={reload} />;
  return <span className="text-sm text-slate-500">Read-only</span>;
}

function ApprovalActions({ lead, reload }: { lead: Lead; reload: () => Promise<void> }) {
  const { data: bds } = useLoad<User[]>('/users?role=BD');
  const [note, setNote] = useState('');
  const [assignedBdId, setAssignedBdId] = useState(lead.createdByBd?.id ?? '');
  const canReview = lead.status === 'PENDING_APPROVAL';
  const canReopen = ['DISMISSED', 'REJECTED', 'CLOSED'].includes(lead.status);
  return (
    <div className="grid min-w-0 max-w-sm gap-2 sm:min-w-64">
      {canReview ? (
        <select className={inputClass} value={assignedBdId} onChange={(e) => setAssignedBdId(e.target.value)}>
          <option value="">Assign BD</option>
          {(bds ?? []).map((bd) => <option key={bd.id} value={bd.id}>{bd.name}</option>)}
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
            <Button onClick={async () => { await api(`/admin/leads/${lead.id}/approve`, { method: 'PATCH', body: JSON.stringify({ notes: note, assignedBdId }) }); await reload(); }}>Approve</Button>
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
  return <ScheduleCallForm leadId={lead.id} compact onSaved={reload} />;
}

function ScheduleCallForm({ leadId, compact = false, onSaved }: { leadId: string; compact?: boolean; onSaved: () => Promise<void> }) {
  const { data: closers } = useLoad<User[]>('/users?role=CLOSER');
  const [form, setForm] = useState({ closerId: '', callStage: 'SCREENING' as CallStage, scheduledAt: '', manualInviteStatus: 'MANUAL_INVITE_PENDING' as ManualInviteStatus, manualInviteLink: '', bdNotes: '' });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api(`/bd/leads/${leadId}/calls`, { method: 'POST', body: JSON.stringify({ ...form, manualInviteLink: form.manualInviteLink || undefined, bdNotes: form.bdNotes || undefined }) });
    setForm({ closerId: '', callStage: 'SCREENING', scheduledAt: '', manualInviteStatus: 'MANUAL_INVITE_PENDING', manualInviteLink: '', bdNotes: '' });
    await onSaved();
  };
  return (
    <form onSubmit={submit} className={`grid min-w-0 gap-2 ${compact ? 'max-w-sm sm:min-w-64' : 'md:grid-cols-3'}`}>
      <select className={inputClass} value={form.closerId} onChange={(e) => setForm({ ...form, closerId: e.target.value })} required><option value="">Closer</option>{(closers ?? []).map((closer) => <option key={closer.id} value={closer.id}>{closer.name}</option>)}</select>
      <select className={inputClass} value={form.callStage} onChange={(e) => setForm({ ...form, callStage: e.target.value as CallStage })}>{callStages.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>
      <input className={inputClass} type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} required />
      {!compact ? (
        <>
          <select className={inputClass} value={form.manualInviteStatus} onChange={(e) => setForm({ ...form, manualInviteStatus: e.target.value as ManualInviteStatus })}>{manualStatuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>
          <input className={inputClass} type="url" placeholder="Manual invite link" value={form.manualInviteLink} onChange={(e) => setForm({ ...form, manualInviteLink: e.target.value })} />
          <input className={inputClass} placeholder="BD notes" value={form.bdNotes} onChange={(e) => setForm({ ...form, bdNotes: e.target.value })} />
        </>
      ) : null}
      <Button type="submit"><CalendarPlus size={16} /> Schedule Call</Button>
    </form>
  );
}

export function LeadDetailPage({ role, id }: { role: 'admin' | 'bd'; id: string }) {
  const endpoint = role === 'admin' ? `/admin/leads/${id}` : `/bd/leads/${id}`;
  const { data: lead, error, reload } = useLoad<Lead>(endpoint);
  if (error) return <Card className="text-sm font-semibold text-red-700">{error}</Card>;
  if (!lead) return <Card>Loading lead...</Card>;
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
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Card><h3 className="mb-3 font-black">Overview</h3><InfoRows rows={[['Created BD', lead.createdByBd?.name], ['Assigned BD', lead.assignedBd?.name], ['Approved By', lead.approvedByAdmin?.name], ['Current Stage', label(lead.currentStage)], ['Nature', label(lead.nature)]]} /></Card>
        <Card><h3 className="mb-3 font-black">Proof / Notes</h3><InfoRows rows={[['Proof Type', label(lead.proofType)], ['Proof URL', lead.proofUrl], ['Proof Notes', lead.proofNotes], ['Admin Notes', lead.adminNotes], ['Dismissal Reason', lead.dismissalReason]]} /></Card>
        <Card><h3 className="mb-3 font-black">Job</h3><InfoRows rows={[['Job ID', lead.job?.jobId], ['Company', lead.job?.companyName], ['Platform', lead.job?.platform], ['Status', label(lead.job?.status)]]} /></Card>
      </div>
      {role === 'bd' && ['READY_TO_SCHEDULE', 'NEXT_CALL_REQUIRED', 'CALL_SCHEDULED', 'IN_PROGRESS'].includes(lead.status) ? (
        <Card>
          <h3 className="mb-3 font-black">Schedule Call</h3>
          <ScheduleCallForm leadId={lead.id} onSaved={reload} />
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
              <p className="text-xs text-slate-500">{shortDate(event.createdAt)} · {event.actor?.name ?? 'System'}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
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
          <thead><tr><th>#</th><th>Stage</th><th>Scheduled</th><th>Closer</th><th>Status</th><th>Manual Invite</th><th>Feedback</th><th>Actions</th></tr></thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call.id}>
                <td className="font-bold">{call.callNumber}</td>
                <td>{label(call.callStage)}</td>
                <td>{shortDate(call.scheduledAt)}</td>
                <td>{call.closer?.name ?? '-'}</td>
                <td><Badge tone={statusTone(call.status)}>{label(call.status)}</Badge></td>
                <td><Badge tone={statusTone(call.manualInviteStatus)}>{label(call.manualInviteStatus)}</Badge>{call.manualInviteLink ? <><br /><a className="font-semibold text-red-700" href={call.manualInviteLink} target="_blank">Open invite</a></> : null}</td>
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
        <span>Date: {shortDate(feedback.createdAt)}</span>
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
      <select className={inputClass} value={manualInviteStatus} onChange={(e) => setManualInviteStatus(e.target.value as ManualInviteStatus)}>{manualStatuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>
      <Button onClick={async () => { await api(`/bd/leads/${call.leadId}/manual-calendar`, { method: 'PATCH', body: JSON.stringify({ leadCallId: call.id, manualInviteStatus }) }); await reload(); }}>Update</Button>
    </div>
  );
}

export function CallsPage({ role }: { role: Role }) {
  const endpoint = role === 'SUPER_ADMIN' ? '/admin/calls' : role === 'BD' ? '/bd/calls' : '/closer/calls';
  const { data, error, reload } = useLoad<LeadCall[]>(endpoint);
  const calls = data ?? [];
  const callPagination = usePagination(calls);
  return (
    <div className="grid min-w-0 gap-5">
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      <Card className="p-0">
        <div className="table-wrap">
          <table className="lead-table">
            <thead><tr><th>Lead</th><th>#</th><th>Stage</th><th>Scheduled</th><th>Closer</th><th>Status</th><th>Feedback</th><th>Details</th></tr></thead>
            <tbody>
              {callPagination.items.map((call) => (
                <tr key={call.id}>
                  <td><strong>{call.lead?.companyName}</strong><br /><span className="text-slate-500">{call.lead?.profileName}</span></td>
                  <td>{call.callNumber}</td>
                  <td>{label(call.callStage)}</td>
                  <td>{shortDate(call.scheduledAt)}</td>
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
      </Card>
    </div>
  );
}

export function FeedbackPage() {
  return <CallsPage role="CLOSER" />;
}

export function CloserCallDetailPage({ id }: { id: string }) {
  const { data: call, error, reload } = useLoad<LeadCall>(`/closer/calls/${id}`);
  if (error) return <Card className="text-sm font-semibold text-red-700">{error}</Card>;
  if (!call) return <Card>Loading call...</Card>;
  return (
    <div className="grid min-w-0 gap-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{call.lead?.companyName}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Call #{call.callNumber} · {label(call.callStage)} · {shortDate(call.scheduledAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(call.manualInviteStatus)}>{label(call.manualInviteStatus)}</Badge>
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
        <Card><h3 className="mb-3 font-black">Invite</h3><InfoRows rows={[['Manual Status', label(call.manualInviteStatus)], ['Invite Link', call.manualInviteLink], ['BD Notes', call.bdNotes]]} /></Card>
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
  const { data, error, reload } = useLoad<TechStack[]>('/tech-stacks');
  const [form, setForm] = useState({ name: '', description: '' });
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
      <Card className="p-0">
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
                    <Button variant="danger" onClick={async () => { await api(`/tech-stacks/${stack.id}`, { method: 'DELETE' }); await reload(); }}><Trash2 size={14} /> Delete</Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls {...stackPagination} />
      </Card>
    </div>
  );
}

export function AuditLogsPage() {
  const { data, error } = useLoad<Array<{ id: string; action: string; entityType: string; entityId?: string; createdAt: string; actor?: User }>>('/audit-logs');
  const logs = data ?? [];
  const logPagination = usePagination(logs);
  return (
    <Card className="p-0">
      {error ? <p className="p-4 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="table-wrap">
        <table className="lead-table">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
          <tbody>{logPagination.items.map((log) => <tr key={log.id}><td>{shortDate(log.createdAt)}</td><td>{log.actor?.name ?? 'System'}</td><td><Badge>{label(log.action)}</Badge></td><td>{log.entityType} {log.entityId ?? ''}</td></tr>)}</tbody>
        </table>
      </div>
      <PaginationControls {...logPagination} />
    </Card>
  );
}
