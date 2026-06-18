'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Eye, Plus, Save, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { label, shortDate } from '@/lib/format';
import { Job, Lead, LeadStatus, ManualInviteStatus, Role, TechStack, User } from '@/types/domain';
import { Badge, Button, Card, Field, inputClass, textareaClass } from './ui';

type DashboardReport = {
  totals: { users: number; jobs: number; leads: number; feedback: number; activeBds: number; activeClosers: number };
  leadStatuses: Array<{ status: LeadStatus; _count: number }>;
  jobStatuses: Array<{ status: string; _count: number }>;
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
  if (['APPROVED', 'SCHEDULED', 'ACTIVE', 'APPLIED', 'ACCEPTED', 'TAKEN'].includes(status)) return 'green';
  if (['PENDING_APPROVAL', 'MANUAL_INVITE_PENDING', 'REMINDER_DUE'].includes(status)) return 'yellow';
  if (['DISMISSED', 'DECLINED', 'RED_ALERT', 'NO_SHOW'].includes(status)) return 'red';
  return 'blue';
}

const TABLE_PAGE_SIZE = 10;

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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        Showing <strong>{from}</strong>-<strong>{to}</strong> of <strong>{totalItems}</strong>
      </span>
      <div className="flex items-center gap-2">
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
    ['Feedback', data?.totals.feedback],
    ['Active BDs', data?.totals.activeBds],
    ['Active Closers', data?.totals.activeClosers],
  ];

  return (
    <div className="grid gap-5">
      <section className="rounded-xl border border-red-900/20 bg-neutral-950 p-6 text-white shadow-panel">
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          CodeBricks lead operations command center for jobs, approvals, scheduling, manual calendar tracking, and post-call movement.
        </p>
      </section>
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([name, value]) => (
          <Card key={String(name)}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{name}</p>
            <p className="mt-2 text-3xl font-black">{value ?? 0}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-black">Lead Status Summary</h3>
          <div className="grid gap-3">
            {(data?.leadStatuses ?? []).map((row) => (
              <div key={row.status} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <Badge tone={statusTone(row.status)}>{label(row.status)}</Badge>
                <span className="font-black">{row._count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="mb-4 font-black">Apply Status</h3>
          <div className="grid gap-3">
            {(data?.jobStatuses ?? []).map((row) => (
              <div key={row.status} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <Badge tone={statusTone(row.status)}>{label(row.status)}</Badge>
                <span className="font-black">{row._count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function UsersPage({ roleFilter }: { roleFilter?: Role }) {
  const { data, error, reload } = useLoad<User[]>(`/users${roleFilter ? `?role=${roleFilter}` : ''}`);
  const [form, setForm] = useState({ name: '', email: '', role: roleFilter ?? 'BD' });
  const users = data ?? [];
  const userPagination = usePagination(users);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api('/users', { method: 'POST', body: JSON.stringify(form) });
    setForm({ name: '', email: '', role: roleFilter ?? 'BD' });
    await reload();
  };

  return (
    <div className="grid gap-5">
      <Card>
        <form onSubmit={submit} className={`grid gap-3 ${roleFilter ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
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
                  <td className="flex gap-2">
                    {user.role === 'SUPER_ADMIN' ? (
                      <span className="text-sm font-semibold text-slate-500">Protected</span>
                    ) : (
                      <>
                        <Button variant="light" onClick={async () => { await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }) }); await reload(); }}>
                          {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </Button>
                      <Button variant="danger" onClick={async () => { await api(`/users/${user.id}`, { method: 'DELETE' }); await reload(); }}>
                        <Trash2 size={14} /> Delete
                      </Button>
                      </>
                    )}
                  </td>
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
    <div className="grid gap-5">
      {bdMode ? (
        <Card>
          <form onSubmit={submit} className="grid gap-3 lg:grid-cols-5">
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
              <Field label="JD">
                <textarea
                  className={`${textareaClass} min-h-56`}
                  placeholder="Paste the full job description here..."
                  value={form.jobDescription}
                  onChange={(e) => setForm({ ...form, jobDescription: e.target.value })}
                  required
                />
              </Field>
            </div>
          </form>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
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
                <td className="flex gap-2">
                  <a className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-bold" href={job.jobLink} target="_blank"><ExternalLink size={14} /> Open</a>
                  {canApply ? <Button onClick={async () => { window.open(job.jobLink, '_blank'); await api(`/jobs/${job.id}/apply`, { method: 'PATCH' }); await reload(); }}><Check size={14} /> Apply</Button> : null}
                </td>
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
    techStack: '',
    payrate: '',
    proofType: 'EMAIL_LINK',
    proofNotes: '',
    proofUrl: '',
    jobId: '',
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api('/leads', { method: 'POST', body: JSON.stringify({ ...form, jobId: form.jobId || undefined, resumeUrl: form.resumeUrl || undefined, proofUrl: form.proofUrl || undefined }) });
    setForm({ companyName: '', profileName: '', resumeUrl: '', nature: 'CONTRACT', techStack: '', payrate: '', proofType: 'EMAIL_LINK', proofNotes: '', proofUrl: '', jobId: '' });
  };
  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
        <Field label="Company / Lead"><input className={inputClass} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required /></Field>
        <Field label="Profile Name"><input className={inputClass} value={form.profileName} onChange={(e) => setForm({ ...form, profileName: e.target.value })} required /></Field>
        <Field label="Resume/Profile URL"><input className={inputClass} type="url" value={form.resumeUrl} onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })} /></Field>
        <Field label="Nature"><select className={inputClass} value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })}><option value="W2">W2</option><option value="CONTRACT">Contract</option><option value="C2C">C2C</option></select></Field>
        <Field label="Tech Stack">
          <select className={inputClass} value={form.techStack} onChange={(e) => setForm({ ...form, techStack: e.target.value })} required>
            <option value="">Select stack</option>
            {(techStacks ?? []).map((stack) => <option key={stack.id} value={stack.name}>{stack.name}</option>)}
          </select>
        </Field>
        <Field label="Payrate / Value"><input className={inputClass} value={form.payrate} onChange={(e) => setForm({ ...form, payrate: e.target.value })} required /></Field>
        <Field label="Proof Type"><select className={inputClass} value={form.proofType} onChange={(e) => setForm({ ...form, proofType: e.target.value })}><option value="EMAIL_LINK">Email Link</option><option value="SCREENSHOT">Screenshot</option><option value="MANUAL_VERIFICATION">Manual Verification</option></select></Field>
        <Field label="Proof URL"><input className={inputClass} type="url" value={form.proofUrl} onChange={(e) => setForm({ ...form, proofUrl: e.target.value })} /></Field>
        <Field label="Related Job"><select className={inputClass} value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })}><option value="">None</option>{(jobs ?? []).map((job) => <option key={job.id} value={job.id}>{job.jobId} - {job.companyName}</option>)}</select></Field>
        <div className="md:col-span-3">
          <Field label="Proof Notes">
            <textarea
              className={`${textareaClass} min-h-40`}
              placeholder="Add proof context, verification details, or recruiter notes..."
              value={form.proofNotes}
              onChange={(e) => setForm({ ...form, proofNotes: e.target.value })}
            />
          </Field>
        </div>
        <div className="md:col-span-3"><Button type="submit"><Save size={16} /> Submit Lead</Button></div>
      </form>
    </Card>
  );
}

export function LeadsPage({ status, mode = 'list' }: { status?: LeadStatus; mode?: 'list' | 'approvals' | 'schedule' | 'calendar' | 'feedback' }) {
  const path = `/leads${status ? `?status=${status}` : ''}`;
  const { data, error, reload } = useLoad<Lead[]>(path);
  const { data: closers } = useLoad<User[]>('/users?role=CLOSER', mode === 'schedule');
  const [note, setNote] = useState('');
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);
  const leads = data ?? [];
  const leadPagination = usePagination(leads);
  return (
    <div className="grid gap-5">
      {error ? <Card className="text-sm font-semibold text-red-700">{error}</Card> : null}
      <Card className="p-0">
        <div className="table-wrap">
          <table className="lead-table">
            <thead><tr><th>Lead</th><th>Profile</th><th>Stack</th><th>BD</th><th>Closer</th><th>Status</th><th>Schedule</th><th>Details</th><th>Actions</th></tr></thead>
            <tbody>
              {leadPagination.items.map((lead) => (
                <tr key={lead.id}>
                  <td><strong>{lead.companyName}</strong><br /><span className="text-slate-500">{lead.payrate}</span></td>
                  <td>
                    <strong>{lead.profileName}</strong>
                    {lead.resumeUrl ? <><br /><a className="font-semibold text-red-700" href={lead.resumeUrl} target="_blank">Resume/Profile</a></> : null}
                  </td>
                  <td>{lead.techStack}</td>
                  <td>{lead.bd?.name ?? '-'}</td>
                  <td>{lead.closer?.name ?? '-'}</td>
                  <td><Badge tone={statusTone(lead.status)}>{label(lead.status)}</Badge></td>
                  <td>{shortDate(lead.scheduledDate)} {lead.scheduledTime ?? ''}</td>
                  <td>
                    <Button variant="light" className="px-2.5" title="View JD and notes" onClick={() => setDetailsLead(lead)}>
                      <Eye size={16} />
                    </Button>
                  </td>
                  <td><LeadActions lead={lead} mode={mode} closers={closers ?? []} note={note} setNote={setNote} reload={reload} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls {...leadPagination} />
      </Card>
      {detailsLead ? <LeadDetailsModal lead={detailsLead} onClose={() => setDetailsLead(null)} /> : null}
    </div>
  );
}

function LeadDetailsModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <section className="max-h-[86vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black tracking-tight">{lead.companyName}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{lead.profileName} · {lead.techStack}</p>
          </div>
          <Button variant="light" className="px-2.5" title="Close details" onClick={onClose}>
            <X size={16} />
          </Button>
        </header>
        <div className="grid gap-5 p-5">
          <section>
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Job Description</h3>
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {lead.job?.jobDescription || 'No JD attached to this lead.'}
            </p>
          </section>
          <section className="grid gap-3 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Proof Notes</h3>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">{lead.proofNotes || '-'}</p>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Approval Notes</h3>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">{lead.approvalNotes || '-'}</p>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Dismissal Reason</h3>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">{lead.dismissalReason || '-'}</p>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Invite Notes</h3>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">{lead.inviteNotes || '-'}</p>
            </div>
          </section>
          <section className="grid gap-3 text-sm md:grid-cols-3">
            <div><span className="font-bold text-slate-500">Proof Type:</span> {label(lead.proofType)}</div>
            <div><span className="font-bold text-slate-500">Nature:</span> {label(lead.nature)}</div>
            <div><span className="font-bold text-slate-500">Payrate:</span> {lead.payrate}</div>
          </section>
        </div>
      </section>
    </div>
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
    <div className="grid gap-5">
      <Card>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
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
                  <td className="flex gap-2">
                    <Button variant="light" onClick={async () => { await api(`/tech-stacks/${stack.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !stack.isActive }) }); await reload(); }}>
                      {stack.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="danger" onClick={async () => { await api(`/tech-stacks/${stack.id}`, { method: 'DELETE' }); await reload(); }}>
                      <Trash2 size={14} /> Delete
                    </Button>
                  </td>
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

function LeadActions({ lead, mode, closers, note, setNote, reload }: { lead: Lead; mode: string; closers: User[]; note: string; setNote: (value: string) => void; reload: () => Promise<void> }) {
  const [closerId, setCloserId] = useState(lead.closer?.id ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [inviteStatus, setInviteStatus] = useState<ManualInviteStatus>(lead.manualInviteStatus);
  if (mode === 'approvals') {
    return (
      <div className="grid min-w-72 gap-2">
        <textarea
          className={`${textareaClass} min-h-32`}
          placeholder="Add approval notes or dismissal reason..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <Button onClick={async () => { await api(`/leads/${lead.id}/approve`, { method: 'PATCH', body: JSON.stringify({ notes: note }) }); await reload(); }}>Approve</Button>
          <Button variant="danger" onClick={async () => { await api(`/leads/${lead.id}/dismiss`, { method: 'PATCH', body: JSON.stringify({ reason: note }) }); await reload(); }}>Dismiss</Button>
          <Button variant="light" onClick={async () => { await api(`/leads/${lead.id}/reopen`, { method: 'PATCH', body: JSON.stringify({ notes: note }) }); await reload(); }}>Reopen</Button>
        </div>
      </div>
    );
  }
  if (mode === 'schedule') {
    if (lead.status !== 'APPROVED') {
      return <span className="text-sm text-slate-500">Awaiting approval</span>;
    }
    return (
      <div className="grid min-w-72 gap-2">
        <select className={inputClass} value={closerId} onChange={(e) => setCloserId(e.target.value)}><option value="">Closer</option>{closers.map((closer) => <option key={closer.id} value={closer.id}>{closer.name}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} /><input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <Button onClick={async () => { await api(`/leads/${lead.id}/schedule`, { method: 'PATCH', body: JSON.stringify({ closerId, scheduledDate: date, scheduledTime: time }) }); await reload(); }}>Schedule</Button>
      </div>
    );
  }
  if (mode === 'calendar') {
    return (
      <div className="grid min-w-64 gap-2">
        <select className={inputClass} value={inviteStatus} onChange={(e) => setInviteStatus(e.target.value as ManualInviteStatus)}>
          {['MANUAL_INVITE_PENDING', 'MANUAL_INVITE_CREATED', 'ACCEPTED', 'DECLINED', 'REMINDER_DUE'].map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select>
        <Button onClick={async () => { await api(`/leads/${lead.id}/manual-calendar`, { method: 'PATCH', body: JSON.stringify({ manualInviteStatus: inviteStatus }) }); await reload(); }}>Update</Button>
      </div>
    );
  }
  return <span className="text-sm text-slate-500">Read-only</span>;
}

export function FeedbackPage() {
  const { data: leads, reload } = useLoad<Lead[]>('/leads?status=SCHEDULED');
  const { data: closers } = useLoad<User[]>('/users?role=CLOSER');
  const [form, setForm] = useState({ leadId: '', callStatus: 'TAKEN', secondaryCloserId: '', callStage: 'SCREENING', nature: 'PHONE_SCREENING', payrateDiscussed: '', importantNotes: '' });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api('/feedback', { method: 'POST', body: JSON.stringify({ ...form, secondaryCloserId: form.secondaryCloserId || undefined }) });
    setForm({ leadId: '', callStatus: 'TAKEN', secondaryCloserId: '', callStage: 'SCREENING', nature: 'PHONE_SCREENING', payrateDiscussed: '', importantNotes: '' });
    await reload();
  };
  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
        <Field label="Assigned Lead"><select className={inputClass} value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} required><option value="">Select lead</option>{(leads ?? []).map((lead) => <option key={lead.id} value={lead.id}>{lead.companyName} - {lead.profileName}</option>)}</select></Field>
        <Field label="Call Status"><select className={inputClass} value={form.callStatus} onChange={(e) => setForm({ ...form, callStatus: e.target.value })}><option value="TAKEN">Taken</option><option value="RESCHEDULED">Rescheduled</option><option value="NO_SHOW">No Show</option><option value="SHIFTED">Shifted</option></select></Field>
        <Field label="Secondary Closer"><select className={inputClass} value={form.secondaryCloserId} onChange={(e) => setForm({ ...form, secondaryCloserId: e.target.value })}><option value="">None</option>{(closers ?? []).map((closer) => <option key={closer.id} value={closer.id}>{closer.name}</option>)}</select></Field>
        <Field label="Call Stage"><select className={inputClass} value={form.callStage} onChange={(e) => setForm({ ...form, callStage: e.target.value })}>{['SCREENING','FIRST','SECOND','THIRD','FOURTH','FIFTH','FINAL','OFFERED'].map((v) => <option key={v} value={v}>{label(v)}</option>)}</select></Field>
        <Field label="Nature"><select className={inputClass} value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })}>{['PHONE_SCREENING','FIRST_INTERVIEW','TECHNICAL_ROUND','PANEL_INTERVIEW','CULTURE_FIT','FINAL_PANEL','OFFER_CALL'].map((v) => <option key={v} value={v}>{label(v)}</option>)}</select></Field>
        <Field label="Payrate Discussed"><input className={inputClass} value={form.payrateDiscussed} onChange={(e) => setForm({ ...form, payrateDiscussed: e.target.value })} required /></Field>
        <div className="md:col-span-3">
          <Field label="Important Notes">
            <textarea
              className={`${textareaClass} min-h-44`}
              placeholder="Capture call outcome, concerns, next steps, and client-specific details..."
              value={form.importantNotes}
              onChange={(e) => setForm({ ...form, importantNotes: e.target.value })}
              required
            />
          </Field>
        </div>
        <div className="md:col-span-3"><Button type="submit"><Save size={16} /> Save Feedback</Button></div>
      </form>
    </Card>
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
