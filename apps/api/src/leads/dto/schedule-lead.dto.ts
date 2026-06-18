import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallStage, ManualInviteStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export class ScheduleLeadDto {
  @ApiProperty()
  @IsString()
  closerId!: string;

  @ApiProperty({ enum: CallStage })
  @IsEnum(CallStage)
  callStage!: CallStage;

  @ApiProperty({ example: '2026-06-20T14:30:00.000Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ enum: ManualInviteStatus })
  @IsOptional()
  @IsEnum(ManualInviteStatus)
  manualInviteStatus?: ManualInviteStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  manualInviteLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bdNotes?: string;
}
