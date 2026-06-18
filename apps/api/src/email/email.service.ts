import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

type EmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: SESClient | null;
  private readonly fromEmail: string;
  private readonly appUrl: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION') ?? this.config.get<string>('AWS_SES_REGION');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.fromEmail = this.config.get<string>('SES_FROM_EMAIL') ?? 'no-reply@codebricks.co';
    this.appUrl = (this.config.get<string>('APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '');

    this.client =
      region && accessKeyId && secretAccessKey
        ? new SESClient({
            region,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  inviteLink(token: string) {
    return `${this.appUrl}/accept-invite?token=${encodeURIComponent(token)}`;
  }

  async sendInvite(to: string, name: string, role: string, token: string) {
    const link = this.inviteLink(token);
    const roleLabel = role === 'BD' ? 'BD' : 'Closer';
    return this.send({
      to,
      subject: `You're invited to CodeBricks LeadOps`,
      text: `Hi ${name},\n\nYou have been invited as a ${roleLabel} in CodeBricks LeadOps.\n\nSet your password here: ${link}\n\nThis link expires in 7 days.`,
      html: `
        <p>Hi ${name},</p>
        <p>You have been invited as a <strong>${roleLabel}</strong> in CodeBricks LeadOps.</p>
        <p><a href="${link}">Set your password</a></p>
        <p>This link expires in 7 days.</p>
      `,
    });
  }

  async sendNotification(to: string | string[], subject: string, message: string, actionUrl?: string) {
    const cta = actionUrl ? `<p><a href="${actionUrl}">Open LeadOps</a></p>` : '';
    const textCta = actionUrl ? `\n\nOpen LeadOps: ${actionUrl}` : '';
    return this.send({
      to,
      subject,
      text: `${message}${textCta}`,
      html: `<p>${message}</p>${cta}`,
    });
  }

  private async send(input: EmailInput) {
    const recipients = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to].filter(Boolean);
    if (!recipients.length) return;

    if (!this.client) {
      this.logger.warn(`Email skipped because SES is not configured: ${input.subject} -> ${recipients.join(', ')}`);
      return;
    }

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
  }
}
