import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallNature, CallStage, CallStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty()
  @IsString()
  leadId!: string;

  @ApiProperty({ enum: CallStatus })
  @IsEnum(CallStatus)
  callStatus!: CallStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondaryCloserId?: string;

  @ApiProperty({ enum: CallStage })
  @IsEnum(CallStage)
  callStage!: CallStage;

  @ApiProperty({ enum: CallNature })
  @IsEnum(CallNature)
  nature!: CallNature;

  @ApiProperty()
  @IsString()
  payrateDiscussed!: string;

  @ApiProperty()
  @IsString()
  importantNotes!: string;
}
