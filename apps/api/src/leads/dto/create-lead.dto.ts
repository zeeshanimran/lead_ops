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
  @IsUrl({ require_protocol: true, require_tld: false })
  resumeUrl?: string;

  @ApiProperty({ enum: LeadNature })
  @IsEnum(LeadNature)
  nature!: LeadNature;

  @ApiProperty()
  @IsString()
  techStackId!: string;

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
  @IsUrl({ require_protocol: true, require_tld: false })
  proofUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;
}
