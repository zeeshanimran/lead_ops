import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CalendarModule } from '../calendar/calendar.module';
import { EmailModule } from '../email/email.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AdminLeadController, BdLeadController, CloserCallsController, LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [AuditLogsModule, CalendarModule, EmailModule, RealtimeModule],
  controllers: [LeadsController, AdminLeadController, BdLeadController, CloserCallsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
