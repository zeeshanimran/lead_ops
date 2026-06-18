import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadNature, ProofType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateLeadDto {
  @ApiProperty()
  @IsString()
  companyName!: string;

  @ApiProperty()
  @IsString()
  profileName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  resumeUrl?: string;

  @ApiProperty({ enum: LeadNature })
  @IsEnum(LeadNature)
  nature!: LeadNature;

  @ApiProperty()
  @IsString()
  techStack!: string;

  @ApiProperty()
  @IsString()
  payrate!: string;

  @ApiProperty({ enum: ProofType })
  @IsEnum(ProofType)
  proofType!: ProofType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proofNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  proofUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;
}
