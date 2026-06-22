import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CallStage, LeadCallStatus, LeadStatus, ManualInviteStatus, Prisma, Role } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalDto } from './dto/approval.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ManualCalendarDto } from './dto/manual-calendar.dto';
import { ScheduleLeadDto } from './dto/schedule-lead.dto';

const publicUser = { id: true, name: true, email: true, role: true, status: true } as const;

const includeLead = {
  createdByBd: { select: publicUser },
  assignedBd: { select: publicUser },
  approvedByAdmin: { select: publicUser },
  job: true,
  techStack: true,
  calls: {
    orderBy: [{ callNumber: 'asc' as const }],
    include: {
      scheduledByBd: { select: publicUser },
      closer: { select: publicUser },
      feedback: { orderBy: { createdAt: 'desc' as const }, include: { closer: { select: publicUser } } },
    },
  },
  timeline: { orderBy: { createdAt: 'desc' as const }, include: { actor: { select: publicUser } } },
};

const includeCall = {
  lead: {
    include: {
      createdByBd: { select: publicUser },
      assignedBd: { select: publicUser },
      job: true,
      techStack: true,
    },
  },
  scheduledByBd: { select: publicUser },
  closer: { select: publicUser },
  feedback: { orderBy: { createdAt: 'desc' as const }, include: { closer: { select: publicUser } } },
};

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly email: EmailService,
  ) {}

  findAll(user: AuthenticatedUser, status?: LeadStatus) {
    if (user.role === Role.SUPER_ADMIN) return this.findAdminLeads(status);
    if (user.role === Role.BD) return this.findBdLeads(user.sub, status);
    return this.findCloserLeads(user.sub, status);
  }

  findAdminLeads(status?: LeadStatus) {
    return this.prisma.lead.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: includeLead,
    });
  }

  findBdLeads(bdId: string, status?: LeadStatus) {
    return this.prisma.lead.findMany({
      where: {
        ...(status ? { status } : {}),
        OR: [{ createdByBdId: bdId }, { assignedBdId: bdId }],
      },
      orderBy: { createdAt: 'desc' },
      include: includeLead,
    });
  }

  findCloserLeads(closerId: string, status?: LeadStatus) {
    return this.prisma.lead.findMany({
      where: {
        ...(status ? { status } : {}),
        calls: { some: { closerId } },
      },
      orderBy: { createdAt: 'desc' },
      include: includeLead,
    });
  }

  async findAdminLead(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id }, include: includeLead });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async findBdLead(bdId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, OR: [{ createdByBdId: bdId }, { assignedBdId: bdId }] },
      include: includeLead,
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(user: AuthenticatedUser, dto: CreateLeadDto) {
    if (user.role !== Role.BD) throw new ForbiddenException('Only BD users can submit leads');
    const stack = await this.prisma.techStack.findFirst({
      where: { id: dto.techStackId, isActive: true },
    });
    if (!stack) throw new BadRequestException('Select an active tech stack');
    if (dto.jobId) {
      const job = await this.prisma.job.findFirst({ where: { id: dto.jobId, bdUserId: user.sub } });
      if (!job) throw new BadRequestException('Related job does not belong to this BD');
    }

    const lead = await this.prisma.lead.create({
      data: { ...dto, createdByBdId: user.sub },
      include: includeLead,
    });
    await this.writeTimeline(lead.id, user.sub, 'LEAD_CREATED', `${lead.companyName} submitted for approval`, {
      techStackId: dto.techStackId,
    });
    if (dto.jobId) {
      await this.writeTimeline(lead.id, user.sub, 'JOB_LINKED', `Job linked to ${lead.companyName}`, {
        jobId: dto.jobId,
      });
    }
    await this.notifyLeadSubmitted(lead);
    await this.auditLogs.write(user.sub, 'LEAD_CREATED', 'Lead', lead.id);
    return lead;
  }

  async approve(actorId: string, id: string, dto: ApprovalDto) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
      include: { createdByBd: { select: publicUser } },
    });
    if (!existing) throw new NotFoundException('Lead not found');
    const assignedBdId = dto.assignedBdId ?? existing.createdByBdId;
    const assignedBd = await this.prisma.user.findFirst({
      where: { id: assignedBdId, role: Role.BD, status: 'ACTIVE', deletedAt: null },
    });
    if (!assignedBd) throw new BadRequestException('Assign the lead to an active BD');

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        status: LeadStatus.READY_TO_SCHEDULE,
        assignedBdId,
        approvedByAdminId: actorId,
        approvedAt: new Date(),
        adminNotes: dto.notes,
        dismissalReason: null,
      },
      include: includeLead,
    });
    await this.writeTimeline(id, actorId, 'LEAD_APPROVED', `Lead approved and assigned to ${assignedBd.name}`, {
      assignedBdId,
      notes: dto.notes,
    });
    await this.writeTimeline(id, actorId, 'LEAD_ASSIGNED_TO_BD', `Lead assigned back to ${assignedBd.name}`, {
      assignedBdId,
    });
    await this.auditLogs.write(actorId, 'LEAD_APPROVED', 'Lead', id, { assignedBdId });
    await this.email.sendNotification(assignedBd.email, 'Lead ready to schedule', `${lead.companyName} is ready to schedule.`);
    return lead;
  }

  dismiss(actorId: string, id: string, dto: ApprovalDto) {
    return this.transition(actorId, id, LeadStatus.DISMISSED, 'LEAD_DISMISSED', 'Lead dismissed', {
      adminNotes: dto.notes,
      dismissalReason: dto.reason ?? dto.notes,
    });
  }

  reopen(actorId: string, id: string, dto: ApprovalDto) {
    return this.transition(actorId, id, LeadStatus.PENDING_APPROVAL, 'LEAD_REOPENED', 'Lead reopened for review', {
      adminNotes: dto.notes,
      dismissalReason: null,
      approvedAt: null,
      approvedByAdmin: { disconnect: true },
    });
  }

  addNotes(actorId: string, id: string, dto: ApprovalDto) {
    return this.transition(actorId, id, undefined, 'LEAD_NOTED', 'Admin notes updated', { adminNotes: dto.notes });
  }

  async schedule(user: AuthenticatedUser, id: string, dto: ScheduleLeadDto) {
    if (user.role !== Role.BD) throw new ForbiddenException('Only BD users can schedule calls');
    const closer = await this.prisma.user.findFirst({
      where: { id: dto.closerId, role: Role.CLOSER, status: 'ACTIVE', deletedAt: null },
    });
    if (!closer) throw new BadRequestException('Active closer is required');
    const lead = await this.prisma.lead.findUnique({ where: { id }, include: { calls: true } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.assignedBdId !== user.sub) throw new ForbiddenException('Lead is not assigned to this BD');
    const schedulableStatuses: LeadStatus[] = [
      LeadStatus.READY_TO_SCHEDULE,
      LeadStatus.NEXT_CALL_REQUIRED,
      LeadStatus.CALL_SCHEDULED,
      LeadStatus.IN_PROGRESS,
    ];
    if (!schedulableStatuses.includes(lead.status)) {
      throw new BadRequestException('Lead is not ready for call scheduling');
    }

    const callNumber = lead.calls.length + 1;
    const scheduledAt = new Date(dto.scheduledAt);
    const result = await this.prisma.$transaction(async (tx) => {
      const call = await tx.leadCall.create({
        data: {
          leadId: id,
          callNumber,
          callStage: dto.callStage,
          scheduledByBdId: user.sub,
          closerId: dto.closerId,
          scheduledAt,
          manualInviteStatus: dto.manualInviteStatus ?? ManualInviteStatus.MANUAL_INVITE_PENDING,
          manualInviteLink: dto.manualInviteLink,
          bdNotes: dto.bdNotes,
          status: LeadCallStatus.SCHEDULED,
        },
        include: includeCall,
      });
      await tx.lead.update({
        where: { id },
        data: {
          status: callNumber === 1 ? LeadStatus.CALL_SCHEDULED : LeadStatus.IN_PROGRESS,
          currentStage: dto.callStage,
        },
      });
      await tx.leadTimeline.create({
        data: {
          leadId: id,
          actorId: user.sub,
          action: 'CALL_SCHEDULED',
          description: `Call #${callNumber} (${labelStage(dto.callStage)}) scheduled with ${closer.name}`,
          metadata: { callId: call.id, closerId: dto.closerId, scheduledAt: scheduledAt.toISOString() },
        },
      });
      await tx.leadTimeline.create({
        data: {
          leadId: id,
          actorId: user.sub,
          action: 'CLOSER_ASSIGNED',
          description: `${closer.name} assigned to call #${callNumber}`,
          metadata: { callId: call.id, closerId: dto.closerId, callStage: dto.callStage },
        },
      });
      return call;
    });

    await this.auditLogs.write(user.sub, 'CALL_SCHEDULED', 'LeadCall', result.id, { leadId: id, closerId: dto.closerId });
    await this.notifySuperAdmins(
      `Call #${result.callNumber} scheduled`,
      `${result.scheduledByBd.name} scheduled ${labelStage(result.callStage)} for ${result.lead.companyName} with ${result.closer.name}.`,
      result.leadId,
    );
    await this.email.sendCallAssignment({
      closerEmail: closer.email,
      closerName: closer.name,
      bdName: result.scheduledByBd.name,
      bdEmail: result.scheduledByBd.email,
      callId: result.id,
      callNumber: result.callNumber,
      callStage: result.callStage,
      scheduledAt: result.scheduledAt,
      manualInviteStatus: result.manualInviteStatus,
      manualInviteLink: result.manualInviteLink,
      bdNotes: result.bdNotes,
      lead: {
        companyName: result.lead.companyName,
        profileName: result.lead.profileName,
        nature: result.lead.nature,
        techStackName: result.lead.techStack.name,
        payrate: result.lead.payrate,
        proofType: result.lead.proofType,
        proofNotes: result.lead.proofNotes,
        proofUrl: result.lead.proofUrl,
        resumeUrl: result.lead.resumeUrl,
        adminNotes: result.lead.adminNotes,
        job: result.lead.job
          ? {
              jobId: result.lead.job.jobId,
              platform: result.lead.job.platform,
              companyName: result.lead.job.companyName,
              jobLink: result.lead.job.jobLink,
              jobDescription: result.lead.job.jobDescription,
            }
          : null,
      },
    });
    return result;
  }

  async acceptCall(user: AuthenticatedUser, id: string) {
    if (user.role !== Role.CLOSER) throw new ForbiddenException('Only closers can accept calls');
    const call = await this.prisma.leadCall.findFirst({
      where: { id, closerId: user.sub },
      include: includeCall,
    });
    if (!call) throw new NotFoundException('Call not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const accepted = await tx.leadCall.update({
        where: { id },
        data: { manualInviteStatus: ManualInviteStatus.ACCEPTED },
        include: includeCall,
      });
      await tx.leadTimeline.create({
        data: {
          leadId: call.leadId,
          actorId: user.sub,
          action: 'CALL_ACCEPTED',
          description: `${call.closer.name} accepted call #${call.callNumber}`,
          metadata: { callId: id, closerId: user.sub },
        },
      });
      return accepted;
    });

    await this.auditLogs.write(user.sub, 'CALL_ACCEPTED', 'LeadCall', id, { leadId: call.leadId });
    await this.notifySuperAdmins(
      `Call #${call.callNumber} accepted`,
      `${call.closer.name} accepted ${labelStage(call.callStage)} for ${call.lead.companyName}.`,
      call.leadId,
    );
    await this.email.sendCallAccepted({
      bdEmail: call.scheduledByBd.email,
      bdName: call.scheduledByBd.name,
      closerName: call.closer.name,
      callId: call.id,
      callNumber: call.callNumber,
      callStage: call.callStage,
      scheduledAt: call.scheduledAt,
      leadCompanyName: call.lead.companyName,
      leadProfileName: call.lead.profileName,
    });
    return updated;
  }

  async updateManualCalendar(user: AuthenticatedUser, id: string, dto: ManualCalendarDto) {
    const call = await this.prisma.leadCall.findFirst({
      where: { id: dto.leadCallId, leadId: id },
      include: { lead: true },
    });
    if (!call) throw new NotFoundException('Call not found');
    if (user.role === Role.BD && call.scheduledByBdId !== user.sub) {
      throw new ForbiddenException('Cannot update another BD call');
    }
    if (user.role === Role.CLOSER) throw new ForbiddenException('Closers cannot update manual invites');

    const updated = await this.prisma.leadCall.update({
      where: { id: dto.leadCallId },
      data: {
        manualInviteStatus: dto.manualInviteStatus,
        manualInviteLink: dto.manualInviteLink,
        bdNotes: dto.bdNotes ?? call.bdNotes,
      },
      include: includeCall,
    });
    await this.writeTimeline(id, user.sub, 'MANUAL_INVITE_UPDATED', `Manual invite marked ${labelStatus(dto.manualInviteStatus)}`, {
      callId: dto.leadCallId,
      manualInviteStatus: dto.manualInviteStatus,
    });
    await this.auditLogs.write(user.sub, 'MANUAL_INVITE_UPDATED', 'LeadCall', dto.leadCallId, { leadId: id });
    await this.notifySuperAdmins(
      `Manual invite updated for Call #${updated.callNumber}`,
      `${updated.scheduledByBd.name} marked the manual invite ${labelStatus(updated.manualInviteStatus)} for ${updated.lead.companyName}.`,
      id,
    );
    return updated;
  }

  findCalls(user: AuthenticatedUser) {
    return this.prisma.leadCall.findMany({
      where:
        user.role === Role.SUPER_ADMIN
          ? {}
          : user.role === Role.BD
            ? { scheduledByBdId: user.sub }
            : { closerId: user.sub },
      orderBy: { scheduledAt: 'desc' },
      include: includeCall,
    });
  }

  async findCloserCall(closerId: string, id: string) {
    const call = await this.prisma.leadCall.findFirst({
      where: { id, closerId },
      include: includeCall,
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  private async transition(
    actorId: string,
    id: string,
    status: LeadStatus | undefined,
    action: string,
    description: string,
    data: Prisma.LeadUpdateInput,
  ) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead not found');
    const lead = await this.prisma.lead.update({
      where: { id },
      data: { ...data, ...(status ? { status } : {}) },
      include: includeLead,
    });
    await this.writeTimeline(id, actorId, action, description);
    await this.auditLogs.write(actorId, action, 'Lead', id, data);
    return lead;
  }

  private writeTimeline(leadId: string, actorId: string | null, action: string, description: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.leadTimeline.create({
      data: {
        leadId,
        actorId,
        action,
        description,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  }

  private async notifySuperAdmins(subject: string, message: string, leadId?: string) {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: 'ACTIVE', deletedAt: null },
      select: { email: true },
    });
    await this.email.sendNotification(
      superAdmins.map((admin) => admin.email),
      subject,
      message,
      leadId ? this.email.adminLeadLink(leadId) : undefined,
    );
  }

  private async notifyLeadSubmitted(lead: Prisma.LeadGetPayload<{ include: typeof includeLead }>) {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: 'ACTIVE', deletedAt: null },
      select: { email: true },
    });
    await this.email.sendLeadSubmission({
      to: superAdmins.map((admin) => admin.email),
      leadId: lead.id,
      bdName: lead.createdByBd.name,
      bdEmail: lead.createdByBd.email,
      companyName: lead.companyName,
      profileName: lead.profileName,
      nature: lead.nature,
      techStackName: lead.techStack.name,
      payrate: lead.payrate,
      proofType: lead.proofType,
      proofNotes: lead.proofNotes,
      proofUrl: lead.proofUrl,
      resumeUrl: lead.resumeUrl,
      job: lead.job
        ? {
            jobId: lead.job.jobId,
            platform: lead.job.platform,
            companyName: lead.job.companyName,
            jobLink: lead.job.jobLink,
            jobDescription: lead.job.jobDescription,
            status: lead.job.status,
          }
        : null,
    });
  }
}

function labelStage(stage: CallStage) {
  return stage.toLowerCase().replace(/_/g, ' ');
}

function labelStatus(status: string) {
  return status.toLowerCase().replace(/_/g, ' ');
}
