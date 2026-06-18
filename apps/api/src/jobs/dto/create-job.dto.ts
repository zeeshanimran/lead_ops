import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class CreateJobDto {
  @ApiProperty()
  @IsString()
  platform!: string;

  @ApiProperty()
  @IsString()
  companyName!: string;

  @ApiProperty()
  @IsString()
  techStack!: string;

  @ApiProperty()
  @IsUrl({ require_protocol: true })
  jobLink!: string;

  @ApiProperty()
  @IsString()
  jobDescription!: string;
}
