import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { ConnectionOptions, Job, Queue, Worker } from 'bullmq';
import { requireConfig } from '../config/required-env';

type EmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
};

type CallAssignmentEmailInput = {
  closerEmail: string;
  closerName: string;
  bdName: string;
  bdEmail: string;
  callId: string;
  callNumber: number;
  callStage: string;
  scheduledAt: Date;
  manualInviteStatus: string;
  manualInviteLink?: string | null;
  bdNotes?: string | null;
  lead: {
    companyName: string;
    profileName: string;
    nature: string;
    techStackName: string;
    payrate: string;
    proofType: string;
    proofNotes?: string | null;
    proofUrl?: string | null;
    resumeUrl?: string | null;
    adminNotes?: string | null;
    job?: {
      jobId: string;
      platform: string;
      companyName: string;
      jobLink: string;
      jobDescription: string;
    } | null;
  };
};

type CallAcceptedEmailInput = {
  bdEmail: string;
  bdName: string;
  closerName: string;
  callId: string;
  callNumber: number;
  callStage: string;
  scheduledAt: Date;
  leadCompanyName: string;
  leadProfileName: string;
};

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: SESClient | null;
  private readonly fromEmail: string;
  private readonly appUrl: string;
  private readonly redisUrl: string;
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION') ?? this.config.get<string>('AWS_SES_REGION');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.fromEmail = requireConfig(this.config, 'SES_FROM_EMAIL');
    this.appUrl = requireConfig(this.config, 'APP_URL').replace(/\/$/, '');
    this.redisUrl = requireConfig(this.config, 'REDIS_URL');

    this.client =
      region && accessKeyId && secretAccessKey
        ? new SESClient({
            region,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  onModuleInit() {
    const queueConnection = redisConnectionOptions(this.redisUrl, 1);
    const workerConnection = redisConnectionOptions(this.redisUrl, null);
    this.queue = new Queue('leadops-email', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    });
    this.worker = new Worker(
      'leadops-email',
      (job: Job<EmailInput>) => this.deliver(job.data),
      { connection: workerConnection, concurrency: 5 },
    );
    this.worker.on('completed', (job) => this.logger.log(`Email job completed: ${job.id} ${job.data.subject}`));
    this.worker.on('failed', (job, error) => this.logger.warn(`Email job failed: ${job?.id ?? 'unknown'} ${error.name}: ${error.message}`));
    this.worker.on('error', (error) => this.logger.warn(`Email worker error: ${error.name}: ${error.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  inviteLink(token: string) {
    return `${this.appUrl}/accept-invite?token=${encodeURIComponent(token)}`;
  }

  closerCallLink(callId: string) {
    return `${this.appUrl}/closer/calls/${encodeURIComponent(callId)}`;
  }

  bdLeadLink(leadId: string) {
    return `${this.appUrl}/bd/leads/${encodeURIComponent(leadId)}`;
  }

  adminLeadLink(leadId: string) {
    return `${this.appUrl}/admin/leads/${encodeURIComponent(leadId)}`;
  }

  async sendInvite(to: string, name: string, role: string, token: string) {
    const link = this.inviteLink(token);
    const roleLabel = role === 'BD' ? 'BD' : 'Closer';
    const rows: Array<[string, string]> = [
      ['Account role', roleLabel],
      ['Invite expiry', '7 days'],
      ['Workspace', 'CodeBricks LeadOps'],
    ];
    return this.send({
      to,
      subject: `You're invited to CodeBricks LeadOps`,
      text: [
        `Hi ${name},`,
        '',
        `You have been invited as a ${roleLabel} in CodeBricks LeadOps.`,
        'Set your password and activate your account using the link below.',
        '',
        `Set password: ${link}`,
        '',
        'This link expires in 7 days.',
      ].join('\n'),
      html: emailShell({
        eyebrow: 'Account invitation',
        title: 'You have been invited to LeadOps',
        content: `
          <p style="margin:0 0 12px;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 18px;">You have been invited as a <strong>${escapeHtml(roleLabel)}</strong> in CodeBricks LeadOps. Set your password to activate your account.</p>
          ${actionButton(link, 'Set password')}
          ${detailsTable(rows)}
        `,
      }),
    });
  }

  async sendNotification(to: string | string[], subject: string, message: string, actionUrl?: string) {
    const textCta = actionUrl ? `\n\nOpen LeadOps: ${actionUrl}` : '';
    return this.send({
      to,
      subject,
      text: `${message}${textCta}`,
      html: emailShell({
        eyebrow: 'LeadOps notification',
        title: subject,
        content: `
          <p style="margin:0 0 18px;">${escapeHtml(message)}</p>
          ${actionUrl ? actionButton(actionUrl, 'Open LeadOps') : ''}
        `,
      }),
    });
  }

  async sendCallAssignment(input: CallAssignmentEmailInput) {
    const callUrl = this.closerCallLink(input.callId);
    const scheduled = formatDateTime(input.scheduledAt);
    const rows: Array<[string, string | undefined | null]> = [
      ['Lead company', input.lead.companyName],
      ['Profile', input.lead.profileName],
      ['Tech stack', input.lead.techStackName],
      ['Nature', label(input.lead.nature)],
      ['Payrate', input.lead.payrate],
      ['Call', `#${input.callNumber} - ${label(input.callStage)}`],
      ['Scheduled time', scheduled],
      ['BD owner', `${input.bdName} (${input.bdEmail})`],
      ['Manual invite status', label(input.manualInviteStatus)],
      ['Manual invite link', input.manualInviteLink],
      ['BD notes', input.bdNotes],
      ['Proof type', label(input.lead.proofType)],
      ['Proof notes', input.lead.proofNotes],
      ['Proof URL', input.lead.proofUrl],
      ['Resume/Profile URL', input.lead.resumeUrl],
      ['Admin notes', input.lead.adminNotes],
    ];
    const jobRows: Array<[string, string | undefined | null]> = input.lead.job
      ? [
          ['Job ID', input.lead.job.jobId],
          ['Job platform', input.lead.job.platform],
          ['Job company', input.lead.job.companyName],
          ['Job link', input.lead.job.jobLink],
          ['Job description', input.lead.job.jobDescription],
        ]
      : [];

    return this.send({
      to: input.closerEmail,
      subject: `Call #${input.callNumber} assigned: ${input.lead.companyName} - ${label(input.callStage)}`,
      text: [
        `Hi ${input.closerName},`,
        '',
        `${input.bdName} scheduled a call for you in LeadOps.`,
        '',
        ...rows.map(([name, value]) => `${name}: ${value || '-'}`),
        ...(jobRows.length ? ['', 'Job details:', ...jobRows.map(([name, value]) => `${name}: ${value || '-'}`)] : []),
        '',
        `Accept and open the call here: ${callUrl}`,
      ].join('\n'),
      html: emailShell({
        eyebrow: 'Call assignment',
        title: `Call #${input.callNumber} assigned`,
        content: `
        <p>Hi ${escapeHtml(input.closerName)},</p>
        <p><strong>${escapeHtml(input.bdName)}</strong> scheduled a call for you in LeadOps. Please review the details and accept the call.</p>
        ${actionButton(callUrl, 'Review and accept call')}
        ${detailsTable(rows)}
        ${
          jobRows.length
            ? `<h3 style="margin:24px 0 8px;font-size:16px;color:#111827;">Related job</h3>${detailsTable(jobRows)}`
            : ''
        }
      `,
      }),
    });
  }

  async sendCallAccepted(input: CallAcceptedEmailInput) {
    const callUrl = this.closerCallLink(input.callId);
    return this.send({
      to: input.bdEmail,
      subject: `${input.closerName} accepted Call #${input.callNumber}`,
      text: [
        `Hi ${input.bdName},`,
        '',
        `${input.closerName} accepted Call #${input.callNumber} (${label(input.callStage)}) for ${input.leadCompanyName} / ${input.leadProfileName}.`,
        `Scheduled time: ${formatDateTime(input.scheduledAt)}`,
        '',
        `Open call: ${callUrl}`,
      ].join('\n'),
      html: emailShell({
        eyebrow: 'Call accepted',
        title: `${input.closerName} accepted Call #${input.callNumber}`,
        content: `
        <p>Hi ${escapeHtml(input.bdName)},</p>
        <p><strong>${escapeHtml(input.closerName)}</strong> accepted Call #${input.callNumber} (${escapeHtml(label(input.callStage))}) for <strong>${escapeHtml(input.leadCompanyName)}</strong>.</p>
        ${detailsTable([
          ['Profile', input.leadProfileName],
          ['Scheduled time', formatDateTime(input.scheduledAt)],
        ])}
        ${actionButton(callUrl, 'Open call')}
      `,
      }),
    });
  }

  private async send(input: EmailInput): Promise<boolean> {
    const recipients = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to].filter(Boolean);
    if (!recipients.length) return false;

    if (!this.queue) {
      this.logger.warn(`Email skipped because queue is not ready: ${input.subject} -> ${recipients.join(', ')}`);
      return false;
    }

    try {
      await this.queue.add('send-email', { ...input, to: recipients });
      this.logger.log(`Email queued: ${input.subject} -> ${recipients.join(', ')}`);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'UnknownQueueError';
      this.logger.warn(`Email queue failed (${reason}): ${input.subject} -> ${recipients.join(', ')}`);
      return false;
    }
  }

  private async deliver(input: EmailInput): Promise<boolean> {
    const recipients = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to].filter(Boolean);
    if (!recipients.length) return false;

    if (!this.client) {
      this.logger.warn(`Email skipped because SES is not configured: ${input.subject} -> ${recipients.join(', ')}`);
      return false;
    }

    try {
      await this.client.send(
        new SendEmailCommand({
          Source: this.fromEmail,
          Destination: { ToAddresses: recipients },
          Message: {
            Subject: { Data: input.subject },
            Body: {
              Text: { Data: input.text },
              Html: { Data: input.html },
            },
          },
        }),
      );
      return true;
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'UnknownEmailError';
      this.logger.warn(`Email delivery failed (${reason}): ${input.subject} -> ${recipients.join(', ')}`);
      throw error;
    }
  }
}

function emailShell({ eyebrow, title, content }: { eyebrow: string; title: string; content: string }) {
  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(title)}</div>
        <div style="padding:24px;">
          <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="padding:18px 24px;background:#0a0a0a;color:#ffffff;">
              <div style="font-size:20px;font-weight:800;">CodeBricks <span style="color:#dc2626;">LeadOps</span></div>
            </div>
            <div style="padding:24px 24px 8px;">
              <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#dc2626;">${escapeHtml(eyebrow)}</div>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;color:#111827;">${escapeHtml(title)}</h1>
            </div>
            <div style="padding:16px 24px 24px;font-size:14px;line-height:1.6;color:#0f172a;">
              ${content}
            </div>
            <div style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:12px;line-height:1.5;color:#64748b;">
              This message was sent by CodeBricks LeadOps. If you were not expecting this, contact your LeadOps administrator.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function detailsTable(rows: Array<[string, string | undefined | null]>) {
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <tbody>
        ${rows
          .map(
            ([name, value]) => `
              <tr>
                <td style="width:190px;padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;color:#475569;vertical-align:top;">${escapeHtml(name)}</td>
                <td style="padding:10px;border:1px solid #e2e8f0;color:#0f172a;white-space:pre-wrap;">${linkify(value)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function linkify(value?: string | null) {
  if (!value) return '-';
  if (/^https?:\/\//.test(value)) return `<a href="${escapeHtml(value)}" style="color:#b91c1c;font-weight:700;">${escapeHtml(value)}</a>`;
  return escapeHtml(value);
}

function actionButton(url: string, text: string) {
  return `
    <p style="margin:24px 0;">
      <a href="${escapeHtml(url)}" style="${buttonStyle()}">${escapeHtml(text)}</a>
    </p>
  `;
}

function buttonStyle() {
  return 'display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:800;padding:12px 16px;border-radius:8px;';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function label(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

function redisConnectionOptions(redisUrl: string, maxRetriesPerRequest: number | null): ConnectionOptions {
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : 0,
    maxRetriesPerRequest,
  };
}
