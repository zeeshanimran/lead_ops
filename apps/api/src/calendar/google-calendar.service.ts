import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendar_v3, google } from 'googleapis';
import { Prisma } from '@prisma/client';
import { readGoogleCalendarConfig, validateGoogleCalendarConfig } from './google-calendar.config';

const publicUser = { id: true, name: true, email: true, role: true, status: true } as const;

type CalendarCall = Prisma.LeadCallGetPayload<{
  include: {
    lead: {
      include: {
        createdByBd: { select: typeof publicUser };
        assignedBd: { select: typeof publicUser };
        job: { include: { bd: { select: typeof publicUser } } };
        techStack: true;
      };
    };
    closer: { select: typeof publicUser };
    scheduledByBd: { select: typeof publicUser };
  };
}>;

@Injectable()
export class GoogleCalendarService implements OnModuleInit {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private calendar: calendar_v3.Calendar | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await validateGoogleCalendarConfig(this.config);
    const calendarConfig = readGoogleCalendarConfig(this.config);
    if (!calendarConfig.enabled) {
      this.logger.log('Google Calendar integration disabled');
      return;
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: calendarConfig.credentialsPath,
      scopes: ['https://www.googleapis.com/auth/calendar'],
      clientOptions: { subject: calendarConfig.impersonatedUser },
    });
    this.calendar = google.calendar({ version: 'v3', auth });
    this.logger.log(`Google Calendar integration enabled for ${calendarConfig.impersonatedUser}`);
  }

  isEnabled() {
    return readGoogleCalendarConfig(this.config).enabled;
  }

  defaultDurationMinutes() {
    return readGoogleCalendarConfig(this.config).defaultDurationMinutes;
  }

  async upsertLeadCallEvent(call: CalendarCall) {
    const calendar = this.requireCalendar();
    const cfg = readGoogleCalendarConfig(this.config);
    const requestBody = this.toEvent(call, cfg);

    const response = call.calendarEventId
      ? await calendar.events.patch({
          calendarId: cfg.calendarId,
          eventId: call.calendarEventId,
          conferenceDataVersion: 1,
          sendUpdates: 'all',
          requestBody,
        })
      : await calendar.events.insert({
          calendarId: cfg.calendarId,
          conferenceDataVersion: 1,
          sendUpdates: 'all',
          requestBody,
        });

    const event = await this.waitForConferenceData(response.data.id ?? call.calendarEventId);
    return this.toStoredEvent(event);
  }

  async cancelLeadCallEvent(eventId: string) {
    const calendar = this.requireCalendar();
    const cfg = readGoogleCalendarConfig(this.config);
    await calendar.events.delete({ calendarId: cfg.calendarId, eventId, sendUpdates: 'all' });
  }

  private toEvent(call: CalendarCall, cfg: ReturnType<typeof readGoogleCalendarConfig>): calendar_v3.Schema$Event {
    const start = call.scheduledAt;
    const end = new Date(start.getTime() + call.durationMinutes * 60 * 1000);
    const attendees = attendeeEmails(call, cfg.includeBd).map((email) => ({ email }));
    const summary = `${call.lead.companyName} - ${label(call.callStage)} with ${call.closer.name}`;
    const description = buildEventDescription(call, this.appUrl());

    return {
      summary,
      description,
      start: { dateTime: start.toISOString(), timeZone: cfg.timezone },
      end: { dateTime: end.toISOString(), timeZone: cfg.timezone },
      attendees,
      location: call.clientJoinLink ?? undefined,
      guestsCanInviteOthers: true,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: true,
      conferenceData: {
        createRequest: {
          requestId: call.id,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };
  }

  private async waitForConferenceData(eventId?: string | null) {
    if (!eventId) throw new Error('Google Calendar event was created without an event ID');
    const calendar = this.requireCalendar();
    const cfg = readGoogleCalendarConfig(this.config);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await calendar.events.get({ calendarId: cfg.calendarId, eventId });
      if (response.data.hangoutLink || response.data.conferenceData?.entryPoints?.some((entry) => entry.entryPointType === 'video' && entry.uri)) {
        return response.data;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const response = await calendar.events.get({ calendarId: cfg.calendarId, eventId });
    return response.data;
  }

  private toStoredEvent(event: calendar_v3.Schema$Event) {
    const meetUrl = event.hangoutLink ?? event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri ?? null;
    return {
      eventId: required(event.id, 'Google Calendar event was created without an event ID'),
      eventUrl: event.htmlLink ?? null,
      meetUrl,
      organizer: event.organizer?.email ?? null,
      attendees: event.attendees?.map((attendee) => ({
        email: attendee.email,
        responseStatus: attendee.responseStatus,
        displayName: attendee.displayName,
      })) ?? [],
    };
  }

  private requireCalendar() {
    if (!this.calendar) throw new Error('Google Calendar integration is disabled');
    return this.calendar;
  }

  private appUrl() {
    return (this.config.get<string>('APP_WEB_URL') ?? this.config.get<string>('APP_URL') ?? '').replace(/\/$/, '');
  }
}

function buildEventDescription(call: CalendarCall, appUrl: string) {
  const leadUrl = appUrl ? `${appUrl}/admin/leads/${encodeURIComponent(call.leadId)}` : null;
  const closerCallUrl = appUrl ? `${appUrl}/closer/calls/${encodeURIComponent(call.id)}` : null;
  const rows = [
    section('LeadOps', [
      pair('Call', `#${call.callNumber} - ${titleLabel(call.callStage)}`),
      pair('LeadOps lead', leadUrl),
      pair('Closer call page', closerCallUrl),
    ]),
    section('Lead', [
      pair('Company', call.lead.companyName),
      pair('Profile/Candidate', call.lead.profileName),
      pair('Tech stack', call.lead.techStack.name),
      pair('Nature', titleLabel(call.lead.nature)),
      pair('Payrate', call.lead.payrate),
      pair('Resume/Profile URL', call.lead.resumeUrl),
      pair('Proof type', titleLabel(call.lead.proofType)),
      pair('Proof URL', call.lead.proofUrl),
      pair('Proof notes', call.lead.proofNotes),
      pair('Admin notes', call.lead.adminNotes),
      pair('Created by BD', userLine(call.lead.createdByBd)),
      pair('Assigned BD', userLine(call.lead.assignedBd)),
    ]),
    section('Job', call.lead.job
      ? [
          pair('Job ID', call.lead.job.jobId),
          pair('Platform', call.lead.job.platform),
          pair('Company', call.lead.job.companyName),
          pair('Tech stack', call.lead.job.techStack),
          pair('Status', titleLabel(call.lead.job.status)),
          pair('Job link', call.lead.job.jobLink),
          pair('Job description', call.lead.job.jobDescription),
          pair('Job BD', userLine(call.lead.job.bd)),
          pair('Admin notes', call.lead.job.adminNotes),
          pair('Rejection reason', call.lead.job.rejectionReason),
        ]
      : [pair('Linked job', 'No job linked')]),
    section('Meeting', [
      pair('Scheduled time', call.scheduledAt.toISOString()),
      pair('Duration', `${call.durationMinutes} minutes`),
      pair('Client join link', call.clientJoinLink),
      pair('Google Meet link', call.calendarMeetUrl),
      pair('Closer', userLine(call.closer)),
      pair('Calendar owner/BD', userLine(call.scheduledByBd)),
      pair('Candidate email', call.candidateEmail),
      pair('Interviewer', call.interviewerName),
      pair('Interviewer email', call.interviewerEmail),
      pair('Optional guests', call.optionalGuestEmails.length ? call.optionalGuestEmails.join(', ') : null),
      pair('Scheduling notes', call.bdNotes),
    ]),
  ];
  return rows.filter(Boolean).join('\n\n');
}

function section(title: string, lines: Array<string | null>) {
  const body = lines.filter(Boolean);
  if (!body.length) return null;
  return [`${title}:`, ...body].join('\n');
}

function pair(labelText: string, value?: string | null) {
  const clean = value?.trim();
  return clean ? `${labelText}: ${clean}` : null;
}

function userLine(user?: { name: string; email: string } | null) {
  return user ? `${user.name} (${user.email})` : null;
}

function attendeeEmails(call: CalendarCall, includeBd: boolean) {
  return Array.from(
    new Set(
      [
        call.candidateEmail,
        call.interviewerEmail,
        call.closer.email,
        includeBd ? call.scheduledByBd.email : null,
        ...call.optionalGuestEmails,
      ]
        .filter((email): email is string => Boolean(email))
        .map((email) => email.trim().toLowerCase()),
    ),
  );
}

function label(value: string) {
  return value.toLowerCase().replace(/_/g, ' ');
}

function titleLabel(value?: string | null) {
  return value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : null;
}

function required(value: string | null | undefined, message: string) {
  if (!value) throw new Error(message);
  return value;
}
