import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateJobDto } from './dto/create-job.dto';
import { JobsService } from './jobs.service';

@ApiBearerAuth()
@ApiTags('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.BD)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.jobs.findAll(user);
  }

  @Post()
  @Roles(Role.BD)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJobDto) {
    return this.jobs.create(user, dto);
  }

  @Patch(':id/apply')
  @Roles(Role.BD, Role.SUPER_ADMIN)
  apply(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobs.apply(user, id);
  }
}
