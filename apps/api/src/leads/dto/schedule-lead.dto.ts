import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallStage } from '@prisma/client';
import { IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { Type } from 'class-transformer';

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

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'Jane Candidate' })
  @IsOptional()
  @IsString()
  candidateEmail?: string;

  @ApiPropertyOptional({ example: 'Hiring Manager' })
  @IsOptional()
  @IsString()
  interviewerName?: string;

  @ApiPropertyOptional({ example: 'Client panel interview details' })
  @IsOptional()
  @IsString()
  interviewerEmail?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  optionalGuestEmails?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  clientJoinLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bdNotes?: string;
}
