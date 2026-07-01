import { config } from 'dotenv';
import { google, calendar_v3 } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { readGoogleCalendarConfig, validateGoogleCalendarConfig } from '../src/calendar/google-calendar.config';

config();

async function main() {
  if (process.env.RUN_GOOGLE_CALENDAR_INTEGRATION_TEST !== 'true') {
    console.log('Skipping Google Calendar integration test. Set RUN_GOOGLE_CALENDAR_INTEGRATION_TEST=true to run it.');
    return;
  }

  const configService = new ConfigService(process.env);
  await validateGoogleCalendarConfig(configService);
  const cfg = readGoogleCalendarConfig(configService);
  if (!cfg.enabled) throw new Error('GOOGLE_CALENDAR_ENABLED must be true for the integration test');

  const calendar = google.calendar({
    version: 'v3',
    auth: new google.auth.GoogleAuth({
      keyFile: cfg.credentialsPath,
      scopes: ['https://www.googleapis.com/auth/calendar'],
      clientOptions: { subject: cfg.impersonatedUser },
    }),
  });

  const start = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const keepEvent = process.env.KEEP_GOOGLE_CALENDAR_INTEGRATION_TEST_EVENT === 'true';
  const eventIdToUpdate = process.env.GOOGLE_CALENDAR_TEST_EVENT_ID_TO_UPDATE;
  let eventId: string | undefined;

  try {
    if (eventIdToUpdate) {
      const updated = await calendar.events.patch({
        calendarId: cfg.calendarId,
        eventId: eventIdToUpdate,
        sendUpdates: 'all',
        requestBody: {
          summary: 'LeadOps Google Calendar Integration Test - Details Added',
          description: detailedTestDescription(),
        },
      });
      const event = await waitForMeet(calendar, cfg.calendarId, eventIdToUpdate);
      assertValue(updated.data.id, 'event ID exists');
      assertValue(event.htmlLink, 'event link exists');
      assertEqual(event.organizer?.email, cfg.impersonatedUser, 'organizer is meetings@codebricks.co');
      assert(event.attendees?.some((attendee) => attendee.email === 'bilal.abbas@codebricks.co'), 'attendee exists');
      assertValue(getMeetLink(event), 'Meet link exists');
      console.log(JSON.stringify({ ok: true, updated: true, eventId: eventIdToUpdate, eventLink: event.htmlLink, organizer: event.organizer?.email, meetLink: getMeetLink(event) }, null, 2));
      return;
    }

    const created = await calendar.events.insert({
      calendarId: cfg.calendarId,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        summary: 'LeadOps Google Calendar Integration Test',
        description: detailedTestDescription(),
        start: { dateTime: start.toISOString(), timeZone: cfg.timezone },
        end: { dateTime: end.toISOString(), timeZone: cfg.timezone },
        attendees: [{ email: 'bilal.abbas@codebricks.co' }],
        conferenceData: {
          createRequest: {
            requestId: `leadops-calendar-test-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });
    eventId = assertValue(created.data.id, 'event ID exists');
    const event = await waitForMeet(calendar, cfg.calendarId, eventId);
    assertValue(event.htmlLink, 'event link exists');
    assertEqual(event.organizer?.email, cfg.impersonatedUser, 'organizer is meetings@codebricks.co');
    assert(event.attendees?.some((attendee) => attendee.email === 'bilal.abbas@codebricks.co'), 'attendee exists');
    assertValue(getMeetLink(event), 'Meet link exists');
    console.log(JSON.stringify({ ok: true, eventId, eventLink: event.htmlLink, organizer: event.organizer?.email, meetLink: getMeetLink(event) }, null, 2));
  } finally {
    if (eventId) {
      if (keepEvent) {
        console.log(`Keeping Google Calendar test event for manual review: ${eventId}`);
        return;
      }
      try {
        await calendar.events.delete({ calendarId: cfg.calendarId, eventId, sendUpdates: 'all' });
        console.log(`Cleaned up Google Calendar test event: ${eventId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown cleanup error';
        console.error(`Google Calendar test cleanup failed for event ${eventId}: ${message}`);
        process.exitCode = 1;
      }
    }
  }
}

async function waitForMeet(calendar: calendar_v3.Calendar, calendarId: string, eventId: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await calendar.events.get({ calendarId, eventId });
    if (getMeetLink(response.data)) return response.data;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  const response = await calendar.events.get({ calendarId, eventId });
  return response.data;
}

function getMeetLink(event: calendar_v3.Schema$Event) {
  return event.hangoutLink ?? event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri;
}

function detailedTestDescription() {
  return [
    'LeadOps:',
    'Call: #1 - Screening',
    'LeadOps lead: http://localhost:3000/admin/leads/example-lead',
    'Closer call page: http://localhost:3000/closer/calls/example-call',
    '',
    'Lead:',
    'Company: Example Client Inc.',
    'Profile/Candidate: Bilal Abbas Calendar Test Candidate',
    'Tech stack: Full Stack / NestJS / Next.js',
    'Nature: Contract',
    'Payrate: $70/hr',
    'Resume/Profile URL: https://example.com/resume-bilal-calendar-test.pdf',
    'Proof type: Email Link',
    'Proof URL: https://example.com/proof-email-thread',
    'Proof notes: Candidate profile and client confirmation were validated before scheduling.',
    'Admin notes: This is a local Google Calendar details test.',
    'Created by BD: E2E BD (bd@example.com)',
    'Assigned BD: E2E BD (bd@example.com)',
    '',
    'Job:',
    'Job ID: JOB-CALENDAR-TEST',
    'Platform: LinkedIn',
    'Company: Example Client Inc.',
    'Tech stack: Full Stack / NestJS / Next.js',
    'Status: Approved By Admin',
    'Job link: https://example.com/job-posting',
    'Job description: Build and maintain APIs, dashboards, integrations, and customer-facing workflow tools.',
    'Job BD: E2E BD (bd@example.com)',
    'Admin notes: Approved for calendar details verification.',
    '',
    'Meeting:',
    'Duration: 30 minutes',
    'Closer: E2E Closer (closer@example.com)',
    'Calendar owner/BD: E2E BD (bd@example.com)',
    'Candidate email: candidate@example.com',
    'Interviewer: Calendar Test Interviewer',
    'Interviewer email: interviewer@example.com',
    'Optional guests: guest@example.com',
    'Scheduling notes: Please review the resume/profile URL, proof URL, job link, and job description before the call.',
  ].join('\n');
}

function assertValue<T>(value: T | null | undefined, message: string): T {
  if (!value) throw new Error(message);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown Google Calendar integration test failure';
  console.error(message);
  process.exit(1);
});
