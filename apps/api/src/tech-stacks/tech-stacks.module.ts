import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TechStacksController } from './tech-stacks.controller';
import { TechStacksService } from './tech-stacks.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [TechStacksController],
  providers: [TechStacksService],
  exports: [TechStacksService],
})
export class TechStacksModule {}
