import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CallStage,
  FeedbackCallStatus,
  FeedbackResult,
  LeadCallStatus,
  LeadNature,
  LeadStatus,
  ManualInviteStatus,
  PrismaClient,
  ProofType,
  Role,
  UserStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

config({ override: true });

const API_URL = requireEnv('E2E_API_URL');
const WEB_URL = requireEnv('E2E_WEB_URL');
const password = requireEnv('E2E_PASSWORD');
const runId = process.env.E2E_RUN_ID ?? new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
});

type Session = {
  accessToken: string;
  user: { id: string; email: string; role: Role };
};

const ids: Record<string, string> = {};

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

async function main() {
  const users = await ensureUsers();
  const techStack = await ensureTechStack();

  await assertPage('/login', 'login page');
  await assertPage('/admin/pending-approvals', 'admin pending approvals page');
  await assertPage('/bd/my-leads', 'BD my leads page');
  await assertPage('/closer/assigned-leads', 'closer assigned calls page');

  const admin = await login(users.admin.email);
  const bd = await login(users.bd.email);
  const otherBd = await login(users.otherBd.email);
  const closer = await login(users.closer.email);
  const otherCloser = await login(users.otherCloser.email);

  assertEqual(admin.user.role, Role.SUPER_ADMIN, 'admin role');
  assertEqual(bd.user.role, Role.BD, 'BD role');
  assertEqual(closer.user.role, Role.CLOSER, 'closer role');

  const bds = await api<Array<{ id: string; email: string; status: string }>>(admin, '/users?role=BD');
  assert(bds.some((user) => user.id === users.bd.id && user.status === UserStatus.ACTIVE), 'active BD exists');
  const closers = await api<Array<{ id: string; email: string; status: string }>>(admin, '/users?role=CLOSER');
  assert(closers.some((user) => user.id === users.closer.id && user.status === UserStatus.ACTIVE), 'active closer exists');

  const job = await api<any>(bd, '/jobs', {
    method: 'POST',
    body: {
      platform: 'LinkedIn',
      companyName: `E2E Test Company ${runId}`,
      techStack: techStack.name,
      jobLink: 'https://example.com/e2e-job',
      jobDescription: 'Sample screening/interview JD for E2E lifecycle verification.',
    },
  });
  ids.jobId = job.id;

  const appliedJob = await api<any>(bd, `/jobs/${job.id}/apply`, { method: 'PATCH' });
  assertEqual(appliedJob.status, 'APPLIED', 'job status after apply');

  const lead = await api<any>(bd, '/bd/leads', {
    method: 'POST',
    body: {
      companyName: `E2E Test Company ${runId}`,
      profileName: `E2E Candidate ${runId}`,
      nature: LeadNature.CONTRACT,
      techStackId: techStack.id,
      payrate: '$70/hr',
      proofType: ProofType.MANUAL_VERIFICATION,
      proofNotes: 'E2E proof notes',
      jobId: job.id,
    },
  });
  ids.leadId = lead.id;
  assertEqual(lead.status, LeadStatus.PENDING_APPROVAL, 'lead starts pending approval');
  assertEqual(lead.job.id, job.id, 'lead is linked to created job');

  await expectForbidden(otherBd, `/bd/leads/${lead.id}`, 'other BD cannot access lead before assignment');

  const approved = await api<any>(admin, `/admin/leads/${lead.id}/approve`, {
    method: 'PATCH',
    body: { notes: 'E2E admin approval', assignedBdId: users.bd.id },
  });
  assertEqual(approved.status, LeadStatus.READY_TO_SCHEDULE, 'lead ready to schedule after approval');
  assertEqual(approved.assignedBd.id, users.bd.id, 'lead assigned back to same BD');

  await expectForbidden(otherBd, `/bd/leads/${lead.id}`, 'other BD cannot access assigned lead');

  const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const call = await api<any>(bd, `/bd/leads/${lead.id}/calls`, {
    method: 'POST',
    body: {
      closerId: users.closer.id,
      callStage: CallStage.SCREENING,
      scheduledAt: future,
      manualInviteStatus: ManualInviteStatus.MANUAL_INVITE_CREATED,
      manualInviteLink: 'https://meet.example.com/e2e-test',
      bdNotes: 'E2E screening call scheduled',
    },
  });
  ids.callId = call.id;
  assertEqual(call.callNumber, 1, 'call number auto-generated');
  assertEqual(call.callStage, CallStage.SCREENING, 'screening call stage');
  assertEqual(call.closer.id, users.closer.id, 'call assigned to closer');

  const bdLeadDetail = await api<any>(bd, `/bd/leads/${lead.id}`);
  assertEqual(bdLeadDetail.status, LeadStatus.CALL_SCHEDULED, 'lead status after first scheduled call');
  assertEqual(bdLeadDetail.calls.length, 1, 'BD lead detail shows scheduled call');
  assertEqual(bdLeadDetail.calls[0].manualInviteLink, 'https://meet.example.com/e2e-test', 'BD detail shows manual invite link');

  const closerCalls = await api<any[]>(closer, '/closer/calls');
  assert(closerCalls.some((item) => item.id === call.id), 'assigned call appears for closer');
  await expectForbidden(otherCloser, `/closer/calls/${call.id}`, 'unassigned closer cannot access call detail');

  const closerCallDetail = await api<any>(closer, `/closer/calls/${call.id}`);
  assertEqual(closerCallDetail.lead.id, lead.id, 'closer call detail includes lead');
  assertEqual(closerCallDetail.bdNotes, 'E2E screening call scheduled', 'closer sees BD notes');

  const acceptedCall = await api<any>(closer, `/closer/calls/${call.id}/accept`, { method: 'PATCH' });
  assertEqual(acceptedCall.manualInviteStatus, ManualInviteStatus.ACCEPTED, 'closer accept updates invite status');

  const feedback = await api<any>(closer, `/closer/calls/${call.id}/feedback`, {
    method: 'POST',
    body: {
      leadCallId: call.id,
      callStatus: FeedbackCallStatus.TAKEN,
      result: FeedbackResult.NEED_NEXT_CALL,
      comments: 'Closer completed screening call and candidate looks good.',
      payrateDiscussed: '$70/hr',
      nextAction: 'Schedule technical round',
      nextCallRequired: true,
    },
  });
  ids.feedbackId = feedback.id;
  assertEqual(feedback.leadCall.id, call.id, 'feedback belongs to call');

  const updatedCall = await api<any>(closer, `/closer/calls/${call.id}`);
  assertEqual(updatedCall.status, LeadCallStatus.COMPLETED, 'call status after taken feedback');
  assert(updatedCall.feedback.some((item: any) => item.id === feedback.id), 'feedback saved on call detail');

  const adminLead = await api<any>(admin, `/admin/leads/${lead.id}`);
  assertEqual(adminLead.status, LeadStatus.NEXT_CALL_REQUIRED, 'lead status after next-call feedback');
  assertEqual(adminLead.createdByBd.id, users.bd.id, 'admin sees created BD');
  assertEqual(adminLead.assignedBd.id, users.bd.id, 'admin sees assigned BD');
  assertEqual(adminLead.job.id, job.id, 'admin sees related job');
  assertEqual(adminLead.calls[0].closer.id, users.closer.id, 'admin sees assigned closer');
  assertEqual(adminLead.calls[0].manualInviteLink, 'https://meet.example.com/e2e-test', 'admin sees manual invite link');
  assert(adminLead.calls[0].feedback.some((item: any) => item.comments === 'Closer completed screening call and candidate looks good.'), 'admin sees closer comments');

  const actions = adminLead.timeline.map((event: any) => event.action);
  for (const action of [
    'LEAD_CREATED',
    'JOB_LINKED',
    'LEAD_APPROVED',
    'LEAD_ASSIGNED_TO_BD',
    'CALL_SCHEDULED',
    'CLOSER_ASSIGNED',
    'CALL_ACCEPTED',
    'FEEDBACK_SUBMITTED',
    'NEXT_CALL_REQUIRED',
  ]) {
    assert(actions.includes(action), `timeline includes ${action}`);
  }

  await expectForbidden(otherCloser, `/closer/calls/${call.id}/feedback`, 'unassigned closer cannot submit feedback', {
    method: 'POST',
    body: {
      leadCallId: call.id,
      callStatus: FeedbackCallStatus.TAKEN,
      result: FeedbackResult.PASSED,
      comments: 'Unauthorized feedback attempt',
      payrateDiscussed: '$70/hr',
      nextCallRequired: false,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        credentials: {
          admin: users.admin.email,
          bd: users.bd.email,
          otherBd: users.otherBd.email,
          closer: users.closer.email,
          otherCloser: users.otherCloser.email,
          password,
        },
        ids,
      },
      null,
      2,
    ),
  );
}

async function ensureUsers() {
  const passwordHash = await argon2.hash(password);
  const admin = await upsertUser(`e2e.admin.${runId}@codebricks.test`, 'E2E Admin', Role.SUPER_ADMIN, passwordHash);
  const bd = await upsertUser(`e2e.bd.${runId}@codebricks.test`, 'E2E BD', Role.BD, passwordHash);
  const otherBd = await upsertUser(`e2e.otherbd.${runId}@codebricks.test`, 'E2E Other BD', Role.BD, passwordHash);
  const closer = await upsertUser(`e2e.closer.${runId}@codebricks.test`, 'E2E Closer', Role.CLOSER, passwordHash);
  const otherCloser = await upsertUser(`e2e.othercloser.${runId}@codebricks.test`, 'E2E Other Closer', Role.CLOSER, passwordHash);
  return { admin, bd, otherBd, closer, otherCloser };
}

function upsertUser(email: string, name: string, role: Role, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    create: { email, name, role, passwordHash, status: UserStatus.ACTIVE },
    update: { name, role, passwordHash, status: UserStatus.ACTIVE, deletedAt: null, refreshTokenHash: null },
  });
}

function ensureTechStack() {
  return prisma.techStack.upsert({
    where: { name: 'E2E Full Stack' },
    create: { name: 'E2E Full Stack', description: 'E2E active tech stack', isActive: true },
    update: { isActive: true },
  });
}

async function login(email: string): Promise<Session> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed for ${email}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<Session>;
}

async function api<T>(session: Session, path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function expectForbidden(session: Session, path: string, message: string, options: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  assert(response.status === 403 || response.status === 404, `${message} expected 403/404, got ${response.status}`);
}

async function assertPage(path: string, label: string) {
  const response = await fetch(`${WEB_URL}${path}`);
  assert(response.ok, `${label} renders, got ${response.status}`);
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
