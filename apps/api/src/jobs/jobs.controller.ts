import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateJobDto } from './dto/create-job.dto';
import { JobDecisionDto } from './dto/job-decision.dto';
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

  @Patch(':id/approve')
  @Roles(Role.SUPER_ADMIN)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: JobDecisionDto) {
    return this.jobs.approve(user.sub, id, dto);
  }

  @Patch(':id/reject')
  @Roles(Role.SUPER_ADMIN)
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: JobDecisionDto) {
    return this.jobs.reject(user.sub, id, dto);
  }

  @Patch(':id/reopen')
  @Roles(Role.SUPER_ADMIN)
  reopen(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: JobDecisionDto) {
    return this.jobs.reopen(user.sub, id, dto);
  }

  @Patch(':id/notes')
  @Roles(Role.SUPER_ADMIN)
  addNotes(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: JobDecisionDto) {
    return this.jobs.addNotes(user.sub, id, dto);
  }
}
