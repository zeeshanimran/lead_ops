import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmailModule } from '../email/email.module';
import { AdminLeadController, BdLeadController, CloserCallsController, LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [AuditLogsModule, EmailModule],
  controllers: [LeadsController, AdminLeadController, BdLeadController, CloserCallsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
