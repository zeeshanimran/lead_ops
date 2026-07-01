import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
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
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('leads')
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
  @Roles(Role.SUPER_ADMIN)
  schedule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ScheduleLeadDto) {
    return this.leads.schedule(user, id, dto);
  }

  @Patch(':id/manual-calendar')
  @Roles(Role.SUPER_ADMIN, Role.BD)
  updateManualCalendar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ManualCalendarDto) {
    return this.leads.updateManualCalendar(user, id, dto);
  }
}

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('admin-leads')
@Controller('admin')
export class AdminLeadController {
  constructor(private readonly leads: LeadsService) {}

  @Get('leads')
  @Roles(Role.SUPER_ADMIN)
  findLeads(@Query('status') status?: LeadStatus) {
    return this.leads.findAdminLeads(status);
  }

  @Get('leads/:id')
  @Roles(Role.SUPER_ADMIN)
  findLead(@Param('id') id: string) {
    return this.leads.findAdminLead(id);
  }

  @Patch('leads/:id/approve')
  @Roles(Role.SUPER_ADMIN)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApprovalDto) {
    return this.leads.approve(user.sub, id, dto);
  }

  @Patch('leads/:id/dismiss')
  @Roles(Role.SUPER_ADMIN)
  dismiss(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApprovalDto) {
    return this.leads.dismiss(user.sub, id, dto);
  }

  @Patch('leads/:id/reopen')
  @Roles(Role.SUPER_ADMIN)
  reopen(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApprovalDto) {
    return this.leads.reopen(user.sub, id, dto);
  }

  @Post('leads/:id/calls')
  @Roles(Role.SUPER_ADMIN)
  schedule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ScheduleLeadDto) {
    return this.leads.schedule(user, id, dto);
  }

  @Get('calls')
  @Roles(Role.SUPER_ADMIN)
  findCalls(@CurrentUser() user: AuthenticatedUser) {
    return this.leads.findCalls(user);
  }

  @Get('closers/:closerId/availability')
  @Roles(Role.SUPER_ADMIN)
  @ApiQuery({ name: 'date', example: '2026-07-06' })
  @ApiQuery({ name: 'durationMinutes', required: false, example: 60 })
  getCloserAvailability(@Param('closerId') closerId: string, @Query('date') date: string, @Query('durationMinutes') durationMinutes?: string) {
    return this.leads.getCloserAvailability(closerId, date, durationMinutes);
  }

  @Patch('calls/:id/reschedule')
  @Roles(Role.SUPER_ADMIN)
  rescheduleCall(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ScheduleLeadDto) {
    return this.leads.rescheduleCall(user, id, dto);
  }

  @Patch('calls/:id/cancel')
  @Roles(Role.SUPER_ADMIN)
  cancelCall(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leads.cancelCall(user, id);
  }
}

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('bd-leads')
@Controller('bd')
export class BdLeadController {
  constructor(private readonly leads: LeadsService) {}

  @Get('leads')
  @Roles(Role.BD)
  findLeads(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: LeadStatus) {
    return this.leads.findBdLeads(user.sub, status);
  }

  @Post('leads')
  @Roles(Role.BD)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeadDto) {
    return this.leads.create(user, dto);
  }

  @Get('leads/:id')
  @Roles(Role.BD)
  findLead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leads.findBdLead(user.sub, id);
  }

  @Post('leads/:id/calls')
  @Roles(Role.BD)
  schedule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ScheduleLeadDto) {
    return this.leads.schedule(user, id, dto);
  }

  @Patch('leads/:id/manual-calendar')
  @Roles(Role.BD)
  updateManualCalendar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ManualCalendarDto) {
    return this.leads.updateManualCalendar(user, id, dto);
  }

  @Get('calls')
  @Roles(Role.BD)
  findCalls(@CurrentUser() user: AuthenticatedUser) {
    return this.leads.findCalls(user);
  }
}

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('closer-calls')
@Controller('closer')
export class CloserCallsController {
  constructor(private readonly leads: LeadsService) {}

  @Get('calls')
  @Roles(Role.CLOSER)
  findCalls(@CurrentUser() user: AuthenticatedUser) {
    return this.leads.findCalls(user);
  }

  @Get('calls/:id')
  @Roles(Role.CLOSER)
  findCall(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leads.findCloserCall(user.sub, id);
  }

  @Patch('calls/:id/accept')
  @Roles(Role.CLOSER)
  acceptCall(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leads.acceptCall(user, id);
  }
}
