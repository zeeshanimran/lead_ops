import { existsSync, readFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { ConfigService } from '@nestjs/config';

export const GOOGLE_CALENDAR_QUEUE = 'leadops-google-calendar';
export const GOOGLE_CALENDAR_SYNC_JOB = 'sync-lead-call-calendar-event';

const expectedClientEmail = 'leadops-calendar-service@leadops-calendar.iam.gserviceaccount.com';
const expectedImpersonatedUser = 'meetings@codebricks.co';

export type GoogleCalendarConfig = {
  enabled: boolean;
  credentialsPath: string;
  impersonatedUser: string;
  calendarId: string;
  timezone: string;
  defaultDurationMinutes: number;
  includeBd: boolean;
};

export function readGoogleCalendarConfig(config: ConfigService): GoogleCalendarConfig {
  return {
    enabled: config.get<string>('GOOGLE_CALENDAR_ENABLED') === 'true',
    credentialsPath: config.get<string>('GOOGLE_APPLICATION_CREDENTIALS') ?? '',
    impersonatedUser: config.get<string>('GOOGLE_CALENDAR_IMPERSONATED_USER') ?? '',
    calendarId: config.get<string>('GOOGLE_CALENDAR_ID') ?? 'primary',
    timezone: config.get<string>('GOOGLE_CALENDAR_TIMEZONE') ?? 'Asia/Karachi',
    defaultDurationMinutes: Number(config.get<string>('GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES') ?? '30'),
    includeBd: config.get<string>('GOOGLE_CALENDAR_INCLUDE_BD') !== 'false',
  };
}

export async function validateGoogleCalendarConfig(config: ConfigService) {
  const calendar = readGoogleCalendarConfig(config);
  if (!calendar.enabled) return;
  if (!calendar.credentialsPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required when Google Calendar is enabled');
  if (!existsSync(calendar.credentialsPath)) throw new Error('Google Calendar credentials file was not found');
  try {
    await access(calendar.credentialsPath, constants.R_OK);
  } catch {
    throw new Error('Google Calendar credentials file is not readable');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(calendar.credentialsPath, 'utf8'));
  } catch {
    throw new Error('Google Calendar credentials file contains invalid JSON');
  }
  if (!isServiceAccount(parsed) || parsed.client_email !== expectedClientEmail) {
    throw new Error('Unexpected Google service-account identity');
  }
  if (calendar.impersonatedUser !== expectedImpersonatedUser) {
    throw new Error('Unexpected Google Calendar impersonated user');
  }
  if (!Number.isFinite(calendar.defaultDurationMinutes) || calendar.defaultDurationMinutes <= 0) {
    throw new Error('GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES must be a positive number');
  }
}

function isServiceAccount(value: unknown): value is { client_email: string } {
  return typeof value === 'object' && value !== null && 'client_email' in value && typeof (value as { client_email?: unknown }).client_email === 'string';
}
