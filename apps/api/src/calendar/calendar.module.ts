import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CalendarProcessor } from './calendar.processor';
import { CalendarQueueService } from './calendar-queue.service';
import { GoogleCalendarService } from './google-calendar.service';

@Module({
  imports: [PrismaModule],
  providers: [GoogleCalendarService, CalendarQueueService, CalendarProcessor],
  exports: [GoogleCalendarService, CalendarQueueService],
})
export class CalendarModule {}
