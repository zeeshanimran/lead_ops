import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeadStatus, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ApprovalDto } from './dto/approval.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ManualCalendarDto } from './dto/manual-calendar.dto';
import { ScheduleLeadDto } from './dto/schedule-lead.dto';
import { LeadsService } from './leads.service';

@ApiBearerAuth()
@ApiTags('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.BD, Role.CLOSER)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: LeadStatus) {
    return this.leads.findAll(user, status);
  }

  @Post()
  @Roles(Role.BD)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeadDto) {
    return this.leads.create(user, dto);
  }

  @Patch(':id/approve')
  @Roles(Role.SUPER_ADMIN)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApprovalDto) {
    return this.leads.approve(user.sub, id, dto);
  }

  @Patch(':id/dismiss')
  @Roles(Role.SUPER_ADMIN)
  dismiss(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApprovalDto) {
    return this.leads.dismiss(user.sub, id, dto);
  }

  @Patch(':id/reopen')
  @Roles(Role.SUPER_ADMIN)
  reopen(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApprovalDto) {
    return this.leads.reopen(user.sub, id, dto);
  }

  @Patch(':id/notes')
  @Roles(Role.SUPER_ADMIN)
  addNotes(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApprovalDto) {
    return this.leads.addNotes(user.sub, id, dto);
  }

  @Patch(':id/schedule')
  @Roles(Role.BD)
  schedule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ScheduleLeadDto) {
    return this.leads.schedule(user, id, dto);
  }

  @Patch(':id/manual-calendar')
  @Roles(Role.SUPER_ADMIN)
  updateManualCalendar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ManualCalendarDto) {
    return this.leads.updateManualCalendar(user.sub, id, dto);
  }
}
