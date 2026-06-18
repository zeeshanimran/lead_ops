import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ScheduleLeadDto {
  @ApiProperty()
  @IsString()
  closerId!: string;

  @ApiProperty({ example: '2026-06-20' })
  @IsDateString()
  scheduledDate!: string;

  @ApiProperty({ example: '14:30' })
  @IsString()
  scheduledTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inviteNotes?: string;
}
