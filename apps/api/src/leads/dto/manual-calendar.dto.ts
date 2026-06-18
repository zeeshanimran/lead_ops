import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ManualInviteStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export class ManualCalendarDto {
  @ApiProperty()
  @IsString()
  leadCallId!: string;

  @ApiProperty({ enum: ManualInviteStatus })
  @IsEnum(ManualInviteStatus)
  manualInviteStatus!: ManualInviteStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  manualInviteLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bdNotes?: string;
}
