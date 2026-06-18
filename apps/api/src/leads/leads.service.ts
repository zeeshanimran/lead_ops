import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus, Prisma, Role } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalDto } from './dto/approval.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ManualCalendarDto } from './dto/manual-calendar.dto';
import { ScheduleLeadDto } from './dto/schedule-lead.dto';

const includeLead = {
  bd: { select: { id: true, name: true, email: true } },
  closer: { select: { id: true, name: true, email: true } },
  job: true,
  feedback: { orderBy: { createdAt: 'desc' as const } },
};

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly email: EmailService,
  ) {}

  async findAll(user: AuthenticatedUser, status?: LeadStatus) {
    await this.markOverdueFeedback();
    return this.prisma.lead.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(user.role === Role.BD ? { bdUserId: user.sub } : {}),
        ...(user.role === Role.CLOSER ? { closerId: user.sub } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: includeLead,
    });
  }

  private markOverdueFeedback() {
    return this.prisma.lead.updateMany({
      where: {
        status: LeadStatus.SCHEDULED,
        scheduledDate: { lt: new Date() },
        feedback: { none: {} },
        manualInviteStatus: { not: 'RED_ALERT' },
      },
      data: { manualInviteStatus: 'RED_ALERT' },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateLeadDto) {
    if (user.role !== Role.BD) throw new ForbiddenException('Only BD users can submit leads');
    const stack = await this.prisma.techStack.findFirst({
      where: { name: dto.techStack, isActive: true },
    });
    if (!stack) throw new BadRequestException('Select an active tech stack');
    if (dto.jobId) {
      const job = await this.prisma.job.findFirst({ where: { id: dto.jobId, bdUserId: user.sub } });
      if (!job) throw new BadRequestException('Related job does not belong to this BD');
    }
    const lead = await this.prisma.lead.create({
      data: { ...dto, bdUserId: user.sub },
      include: includeLead,
    });
    const superAdmins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: 'ACTIVE', deletedAt: null },
      select: { email: true },
    });
    await this.email.sendNotification(
      superAdmins.map((admin) => admin.email),
      'New lead pending approval',
      `${lead.bd.name} submitted a lead for ${lead.companyName}.`,
    );
    await this.auditLogs.write(user.sub, 'LEAD_SUBMITTED', 'Lead', lead.id);
    return lead;
  }

  approve(actorId: string, id: string, dto: ApprovalDto) {
    return this.transition(actorId, id, LeadStatus.APPROVED, 'LEAD_APPROVED', { approvalNotes: dto.notes });
  }

  dismiss(actorId: string, id: string, dto: ApprovalDto) {
    return this.transition(actorId, id, LeadStatus.DISMISSED, 'LEAD_DISMISSED', {
      dismissalReason: dto.reason ?? dto.notes,
      approvalNotes: dto.notes,
    });
  }

  reopen(actorId: string, id: string, dto: ApprovalDto) {
    return this.transition(actorId, id, LeadStatus.PENDING_APPROVAL, 'LEAD_REOPENED', {
      approvalNotes: dto.notes,
      dismissalReason: null,
    });
  }

  addNotes(actorId: string, id: string, dto: ApprovalDto) {
    return this.transition(actorId, id, undefined, 'LEAD_NOTED', { approvalNotes: dto.notes });
  }

  async schedule(user: AuthenticatedUser, id: string, dto: ScheduleLeadDto) {
    const closer = await this.prisma.user.findFirst({ where: { id: dto.closerId, role: Role.CLOSER, status: 'ACTIVE', deletedAt: null } });
    if (!closer) throw new BadRequestException('Active closer is required');
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead not found');
    if (existing.bdUserId !== user.sub) throw new ForbiddenException('Cannot assign another BD lead');
    if (existing.status !== LeadStatus.APPROVED) throw new BadRequestException('Only approved leads can be assigned to closers');
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        closerId: dto.closerId,
        scheduledDate: new Date(dto.scheduledDate),
        scheduledTime: dto.scheduledTime,
        inviteNotes: dto.inviteNotes,
        status: LeadStatus.SCHEDULED,
        manualInviteStatus: 'MANUAL_INVITE_PENDING',
      },
      include: includeLead,
    });
    await this.email.sendNotification(
      closer.email,
      'New lead assigned to you',
      `${lead.bd.name} assigned ${lead.companyName} to you for ${lead.scheduledDate?.toDateString()}${lead.scheduledTime ? ` at ${lead.scheduledTime}` : ''}.`,
    );
    await this.auditLogs.write(user.sub, 'LEAD_ASSIGNED_TO_CLOSER', 'Lead', id, { closerId: dto.closerId });
    return lead;
  }

  async updateManualCalendar(actorId: string, id: string, dto: ManualCalendarDto) {
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        manualInviteStatus: dto.manualInviteStatus,
        manualInviteLink: dto.manualInviteLink,
        inviteNotes: dto.inviteNotes,
      },
      include: includeLead,
    });
    await this.auditLogs.write(actorId, 'MANUAL_CALENDAR_UPDATED', 'Lead', id, { manualInviteStatus: dto.manualInviteStatus });
    return lead;
  }

  private async transition(actorId: string, id: string, status: LeadStatus | undefined, action: string, data: Prisma.LeadUpdateInput) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
      include: { bd: { select: { email: true, name: true } } },
    });
    if (!existing) throw new NotFoundException('Lead not found');
    const lead = await this.prisma.lead.update({
      where: { id },
      data: { ...data, ...(status ? { status } : {}) },
      include: includeLead,
    });
    if (['LEAD_APPROVED', 'LEAD_DISMISSED', 'LEAD_REOPENED'].includes(action)) {
      await this.email.sendNotification(
        existing.bd.email,
        labelLeadAction(action),
        `${lead.companyName} has been ${labelLeadStatus(lead.status)}.`,
      );
    }
    await this.auditLogs.write(actorId, action, 'Lead', id, data);
    return lead;
  }
}

function labelLeadAction(action: string) {
  if (action === 'LEAD_APPROVED') return 'Lead approved';
  if (action === 'LEAD_DISMISSED') return 'Lead dismissed';
  return 'Lead reopened';
}

function labelLeadStatus(status: LeadStatus) {
  return status.toLowerCase().replace(/_/g, ' ');
}
