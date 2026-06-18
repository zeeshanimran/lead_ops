import { PartialType } from '@nestjs/swagger';
import { CreateTechStackDto } from './create-tech-stack.dto';

export class UpdateTechStackDto extends PartialType(CreateTechStackDto) {}
