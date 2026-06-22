import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmailModule } from '../email/email.module';
import { CloserFeedbackController, FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [AuditLogsModule, EmailModule],
  controllers: [FeedbackController, CloserFeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
