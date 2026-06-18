import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { FeedbackModule } from './feedback/feedback.module';
import { JobsModule } from './jobs/jobs.module';
import { LeadsModule } from './leads/leads.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { TechStacksModule } from './tech-stacks/tech-stacks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    JobsModule,
    LeadsModule,
    FeedbackModule,
    ReportsModule,
    TechStacksModule,
    AuditLogsModule,
  ],
})
export class AppModule {}
