import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../email/email.service';
import { requireConfig } from '../config/required-env';
import { GOOGLE_CALENDAR_QUEUE, GOOGLE_CALENDAR_SYNC_JOB } from './google-calendar.config';
import { GoogleCalendarService } from './google-calendar.service';

@Injectable()
export class CalendarQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CalendarQueueService.name);
  private queue: Queue | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly googleCalendar: GoogleCalendarService,
  ) {}

  onModuleInit() {
    if (!this.googleCalendar.isEnabled()) return;
    this.queue = new Queue(GOOGLE_CALENDAR_QUEUE, {
      connection: redisConnectionOptions(requireConfig(this.config, 'REDIS_URL'), 2),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    });
    this.logger.log(`Calendar queue ready: ${GOOGLE_CALENDAR_QUEUE}`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  async enqueueSync(callId: string) {
    if (!this.queue) return;
    await this.queue.add(GOOGLE_CALENDAR_SYNC_JOB, { callId }, { jobId: `lead-call:${callId}:${Date.now()}` });
  }
}
