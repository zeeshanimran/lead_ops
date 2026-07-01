import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarEventStatus, Prisma } from '@prisma/client';
import { Job, Worker } from 'bullmq';
import { redisConnectionOptions } from '../email/email.service';
import { requireConfig } from '../config/required-env';
import { PrismaService } from '../prisma/prisma.service';
import { GOOGLE_CALENDAR_QUEUE, GOOGLE_CALENDAR_SYNC_JOB } from './google-calendar.config';
import { GoogleCalendarService } from './google-calendar.service';

const publicUser = { id: true, name: true, email: true, role: true, status: true } as const;

const includeCalendarCall = {
  lead: {
    include: {
      createdByBd: { select: publicUser },
      assignedBd: { select: publicUser },
      job: { include: { bd: { select: publicUser } } },
      techStack: true,
    },
  },
  closer: { select: publicUser },
  scheduledByBd: { select: publicUser },
} satisfies Prisma.LeadCallInclude;

@Injectable()
export class CalendarProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CalendarProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly googleCalendar: GoogleCalendarService,
  ) {}

  onModuleInit() {
    if (!this.googleCalendar.isEnabled()) return;
    this.worker = new Worker(
      GOOGLE_CALENDAR_QUEUE,
      (job: Job<{ callId: string }>) => this.sync(job.data.callId),
      { connection: redisConnectionOptions(requireConfig(this.config, 'REDIS_URL'), null), concurrency: 2 },
    );
    this.worker.on('completed', (job) => this.logger.log(`Calendar job completed: ${job.id}`));
    this.worker.on('failed', (job, error) => this.logger.warn(`Calendar job failed: ${job?.id ?? 'unknown'} ${error.name}: ${error.message}`));
    this.worker.on('error', (error) => this.logger.warn(`Calendar worker error: ${error.name}: ${error.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async sync(callId: string) {
    const processing = await this.prisma.leadCall.update({
      where: { id: callId },
      data: { calendarStatus: CalendarEventStatus.PROCESSING, calendarError: null },
      include: includeCalendarCall,
    });

    try {
      const event = await this.googleCalendar.upsertLeadCallEvent(processing);
      await this.prisma.leadCall.update({
        where: { id: callId },
        data: {
          calendarStatus: CalendarEventStatus.CREATED,
          calendarEventId: event.eventId,
          calendarEventUrl: event.eventUrl,
          calendarMeetUrl: event.meetUrl,
          calendarAttendees: event.attendees as Prisma.InputJsonValue,
          calendarOrganizer: event.organizer,
          calendarSyncedAt: new Date(),
          calendarFailedAt: null,
          calendarError: null,
          manualInviteStatus: 'MANUAL_INVITE_CREATED',
        },
      });
      await this.prisma.leadTimeline.create({
        data: {
          leadId: processing.leadId,
          actorId: null,
          action: 'GOOGLE_CALENDAR_EVENT_CREATED',
          description: `Google Calendar event synced for call #${processing.callNumber}`,
          metadata: { callId, eventId: event.eventId, meetUrl: event.meetUrl },
        },
      });
    } catch (error) {
      await this.prisma.leadCall.update({
        where: { id: callId },
        data: {
          calendarStatus: CalendarEventStatus.FAILED,
          calendarFailedAt: new Date(),
          calendarError: safeCalendarError(error),
        },
      });
      throw error;
    }
  }
}

function safeCalendarError(error: unknown) {
  if (!(error instanceof Error)) return 'Google Calendar sync failed';
  return error.message.includes('private_key') ? 'Google Calendar sync failed' : error.message.slice(0, 500);
}
