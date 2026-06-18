import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedbackCallStatus, FeedbackResult } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateFeedbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadCallId?: string;

  @ApiProperty({ enum: FeedbackCallStatus })
  @IsEnum(FeedbackCallStatus)
  callStatus!: FeedbackCallStatus;

  @ApiProperty({ enum: FeedbackResult })
  @IsEnum(FeedbackResult)
  result!: FeedbackResult;

  @ApiProperty()
  @IsString()
  payrateDiscussed!: string;

  @ApiProperty()
  @IsString()
  comments!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextAction?: string;

  @ApiProperty()
  @IsBoolean()
  nextCallRequired!: boolean;
}
