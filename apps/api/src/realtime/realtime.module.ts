import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { requireConfig } from '../config/required-env';
import { PrismaModule } from '../prisma/prisma.module';
import { PendingApprovalsGateway } from './pending-approvals.gateway';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireConfig(config, 'JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [PendingApprovalsGateway],
  exports: [PendingApprovalsGateway],
})
export class RealtimeModule {}
