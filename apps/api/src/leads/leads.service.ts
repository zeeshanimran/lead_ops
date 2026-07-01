import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CalendarEventStatus, CallStage, LeadCallStatus, LeadStatus, ManualInviteStatus, Prisma, Role } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CalendarQueueService } from '../calendar/calendar-queue.service';
import { GoogleCalendarService } from '../calendar/google-calendar.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { PendingApprovalsGateway } from '../realtime/pending-approvals.gateway';
import { ApprovalDto } from './dto/approval.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ManualCalendarDto } from './dto/manual-calendar.dto';
import { ScheduleLeadDto } from './dto/schedule-lead.dto';

const publicUser = { id: true, name: true, email: true, role: true, status: true } as const;

const includeLead = {
  createdByBd: { select: publicUser },
  assignedBd: { select: publicUser },
  approvedByAdmin: { select: publicUser },
  job: { include: { bd: { select: publicUser } } },
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
      job: { include: { bd: { select: publicUser } } },
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
    private readonly pendingApprovals: PendingApprovalsGateway,
    private readonly calendarQueue: CalendarQueueService,
    private readonly googleCalendar: GoogleCalendarService,
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

  async findBdLeads(bdId: string, status?: LeadStatus) {
    const assignedStackIds = await this.assignedTechStackIds(bdId);
    return this.prisma.lead.findMany({
      where: {
        ...(status ? { status } : {}),
        techStackId: { in: assignedStackIds },
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
    const assignedStackIds = await this.assignedTechStackIds(bdId);
    const lead = await this.prisma.lead.findFirst({
      where: { id, techStackId: { in: assignedStackIds } },
      include: includeLead,
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(user: AuthenticatedUser, dto: CreateLeadDto) {
    if (user.role !== Role.BD) throw new ForbiddenException('Only BD users can submit leads');
    const stack = await this.prisma.techStack.findFirst({
      where: { id: dto.techStackId, isActive: true, assignedBds: { some: { id: user.sub } } },
    });
    if (!stack) throw new BadRequestException('Select a tech stack assigned to this BD');
    if (dto.jobId) {
      const job = await this.prisma.job.findFirst({ where: { id: dto.jobId, techStack: stack.name } });
      if (!job) throw new BadRequestException('Related job must belong to the selected tech stack');
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
    await this.pendingApprovals.broadcastPendingApprovals();
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
      where: {
        id: assignedBdId,
        role: Role.BD,
        status: 'ACTIVE',
        deletedAt: null,
        assignedTechStacks: { some: { id: existing.techStackId } },
      },
    });
    if (!assignedBd) throw new BadRequestException('Assign the lead to an active BD with this tech stack');

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
    await this.notifyBdLeadDecision(lead, assignedBd.email, 'APPROVED');
    await this.pendingApprovals.broadcastPendingApprovals();
    return lead;
  }

  async dismiss(actorId: string, id: string, dto: ApprovalDto) {
    const lead = await this.transition(actorId, id, LeadStatus.DISMISSED, 'LEAD_DISMISSED', 'Lead dismissed', {
      adminNotes: dto.notes,
      dismissalReason: dto.reason ?? dto.notes,
    });
    await this.notifyBdLeadDecision(lead, lead.assignedBd?.email ?? lead.createdByBd.email, 'DISMISSED');
    await this.pendingApprovals.broadcastPendingApprovals();
    return lead;
  }

  async reopen(actorId: string, id: string, dto: ApprovalDto) {
    const lead = await this.transition(actorId, id, LeadStatus.PENDING_APPROVAL, 'LEAD_REOPENED', 'Lead reopened for review', {
      adminNotes: dto.notes,
      dismissalReason: null,
      approvedAt: null,
      approvedByAdmin: { disconnect: true },
    });
    await this.pendingApprovals.broadcastPendingApprovals();
    return lead;
  }

  addNotes(actorId: string, id: string, dto: ApprovalDto) {
    return this.transition(actorId, id, undefined, 'LEAD_NOTED', 'Admin notes updated', { adminNotes: dto.notes });
  }

  async schedule(user: AuthenticatedUser, id: string, dto: ScheduleLeadDto) {
    if (user.role !== Role.SUPER_ADMIN) throw new ForbiddenException('Only Admin users can schedule calls');
    const closer = await this.prisma.user.findFirst({
      where: {
        id: dto.closerId,
        role: Role.CLOSER,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    if (!closer) throw new BadRequestException('Active closer is required');
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        calls: true,
        createdByBd: { select: publicUser },
        assignedBd: { select: publicUser },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    const bdOwner = lead.assignedBd ?? lead.createdByBd;
    if (!bdOwner) throw new BadRequestException('Lead does not have a BD owner');
    if (!(await this.hasAssignedTechStack(dto.closerId, lead.techStackId))) {
      throw new BadRequestException('Assign a closer with this tech stack');
    }
    if (!(await this.hasAssignedTechStack(bdOwner.id, lead.techStackId))) {
      throw new BadRequestException('Assigned BD must have this tech stack');
    }
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
    const scheduledAt = parseScheduledAt(dto.scheduledAt);
    const calendarEnabled = this.googleCalendar.isEnabled();
    const result = await this.prisma.$transaction(async (tx) => {
      const call = await tx.leadCall.create({
        data: {
          leadId: id,
          callNumber,
          callStage: dto.callStage,
          scheduledByBdId: bdOwner.id,
          closerId: dto.closerId,
          scheduledAt,
          durationMinutes: dto.durationMinutes ?? this.googleCalendar.defaultDurationMinutes(),
          manualInviteStatus: ManualInviteStatus.MANUAL_INVITE_PENDING,
          clientJoinLink: dto.clientJoinLink,
          candidateEmail: dto.candidateEmail,
          interviewerName: dto.interviewerName,
          interviewerEmail: dto.interviewerEmail,
          optionalGuestEmails: dto.optionalGuestEmails ?? [],
          calendarStatus: calendarEnabled ? CalendarEventStatus.QUEUED : undefined,
          calendarQueuedAt: calendarEnabled ? new Date() : undefined,
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
          description: `Admin scheduled Call #${callNumber} (${labelStage(dto.callStage)}) with ${closer.name}`,
          metadata: {
            callId: call.id,
            closerId: dto.closerId,
            scheduledAt: scheduledAt.toISOString(),
            durationMinutes: dto.durationMinutes ?? this.googleCalendar.defaultDurationMinutes(),
            bdOwnerId: bdOwner.id,
            calendarStatus: calendarEnabled ? CalendarEventStatus.QUEUED : null,
          },
        },
      });
      await tx.leadTimeline.create({
        data: {
          leadId: id,
          actorId: user.sub,
          action: 'CLOSER_ASSIGNED',
          description: `${closer.name} assigned to call #${callNumber} by Admin`,
          metadata: { callId: call.id, closerId: dto.closerId, callStage: dto.callStage },
        },
      });
      return call;
    });

    await this.calendarQueue.enqueueSync(result.id);
    await this.auditLogs.write(user.sub, 'CALL_SCHEDULED', 'LeadCall', result.id, { leadId: id, closerId: dto.closerId, bdOwnerId: bdOwner.id });
    await this.notifyCallScheduled(result);
    await this.notifyBdCallScheduled(result);
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
      clientJoinLink: result.clientJoinLink,
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

  async rescheduleCall(user: AuthenticatedUser, id: string, dto: ScheduleLeadDto) {
    if (user.role !== Role.SUPER_ADMIN) throw new ForbiddenException('Only Admin users can reschedule calls');
    const call = await this.prisma.leadCall.findUnique({ where: { id }, include: { lead: true } });
    if (!call) throw new NotFoundException('Call not found');
    const scheduledAt = parseScheduledAt(dto.scheduledAt);
    const calendarEnabled = this.googleCalendar.isEnabled();
    const updated = await this.prisma.leadCall.update({
      where: { id },
      data: {
        callStage: dto.callStage,
        closerId: dto.closerId,
        scheduledAt,
        durationMinutes: dto.durationMinutes ?? call.durationMinutes,
        candidateEmail: dto.candidateEmail,
        interviewerName: dto.interviewerName,
        interviewerEmail: dto.interviewerEmail,
        clientJoinLink: dto.clientJoinLink,
        optionalGuestEmails: dto.optionalGuestEmails ?? [],
        bdNotes: dto.bdNotes ?? call.bdNotes,
        calendarStatus: calendarEnabled ? CalendarEventStatus.QUEUED : call.calendarStatus,
        calendarQueuedAt: calendarEnabled ? new Date() : call.calendarQueuedAt,
        calendarError: null,
      },
      include: includeCall,
    });
    await this.writeTimeline(call.leadId, user.sub, 'CALL_RESCHEDULED', `Admin rescheduled call #${call.callNumber}`, {
      callId: id,
      scheduledAt: scheduledAt.toISOString(),
      calendarStatus: calendarEnabled ? CalendarEventStatus.QUEUED : call.calendarStatus,
    });
    await this.auditLogs.write(user.sub, 'CALL_RESCHEDULED', 'LeadCall', id, { leadId: call.leadId });
    await this.calendarQueue.enqueueSync(id);
    return updated;
  }

  async cancelCall(user: AuthenticatedUser, id: string) {
    if (user.role !== Role.SUPER_ADMIN) throw new ForbiddenException('Only Admin users can cancel calls');
    const call = await this.prisma.leadCall.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    const updated = await this.prisma.leadCall.update({
      where: { id },
      data: {
        status: LeadCallStatus.CANCELLED,
        calendarStatus: call.calendarEventId && this.googleCalendar.isEnabled() ? CalendarEventStatus.CANCELLED : call.calendarStatus,
        calendarSyncedAt: call.calendarEventId && this.googleCalendar.isEnabled() ? new Date() : call.calendarSyncedAt,
      },
      include: includeCall,
    });
    if (call.calendarEventId && this.googleCalendar.isEnabled()) {
      await this.googleCalendar.cancelLeadCallEvent(call.calendarEventId);
    }
    await this.writeTimeline(call.leadId, user.sub, 'CALL_CANCELLED', `Admin cancelled call #${call.callNumber}`, { callId: id });
    await this.auditLogs.write(user.sub, 'CALL_CANCELLED', 'LeadCall', id, { leadId: call.leadId });
    return updated;
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
    await this.notifyCallAccepted(call);
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
    if (user.role === Role.BD && !(await this.hasAssignedTechStack(user.sub, call.lead.techStackId))) {
      throw new ForbiddenException('Call is outside assigned tech stacks');
    }
    if (user.role === Role.CLOSER) throw new ForbiddenException('Closers cannot update client responses');

    const updated = await this.prisma.leadCall.update({
      where: { id: dto.leadCallId },
      data: {
        manualInviteStatus: dto.manualInviteStatus,
        manualInviteLink: dto.manualInviteLink,
        bdNotes: dto.bdNotes ?? call.bdNotes,
      },
      include: includeCall,
    });
    await this.writeTimeline(id, user.sub, 'CLIENT_RESPONSE_UPDATED', `Client response marked ${clientResponseLabel(dto.manualInviteStatus)}`, {
      callId: dto.leadCallId,
      manualInviteStatus: dto.manualInviteStatus,
    });
    await this.auditLogs.write(user.sub, 'CLIENT_RESPONSE_UPDATED', 'LeadCall', dto.leadCallId, { leadId: id });
    await this.notifyManualInviteUpdated(updated);
    return updated;
  }

  findCalls(user: AuthenticatedUser) {
    return this.prisma.leadCall.findMany({
      where:
        user.role === Role.SUPER_ADMIN
          ? {}
          : user.role === Role.BD
            ? { lead: { techStack: { assignedBds: { some: { id: user.sub } } } } }
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

  private async assignedTechStackIds(bdId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: bdId },
      select: { assignedTechStacks: { where: { isActive: true }, select: { id: true } } },
    });
    return user?.assignedTechStacks.map((stack) => stack.id) ?? [];
  }

  private async hasAssignedTechStack(bdId: string, techStackId: string) {
    const count = await this.prisma.techStack.count({
      where: { id: techStackId, isActive: true, assignedBds: { some: { id: bdId } } },
    });
    return count > 0;
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

  private async notifyCallScheduled(call: Prisma.LeadCallGetPayload<{ include: typeof includeCall }>) {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: 'ACTIVE', deletedAt: null },
      select: { email: true },
    });
    await this.email.sendAdminCallScheduled({
      to: superAdmins.map((admin) => admin.email),
      leadId: call.leadId,
      closerEmail: call.closer.email,
      closerName: call.closer.name,
      bdName: call.scheduledByBd.name,
      bdEmail: call.scheduledByBd.email,
      callId: call.id,
      callNumber: call.callNumber,
      callStage: call.callStage,
      scheduledAt: call.scheduledAt,
      manualInviteStatus: call.manualInviteStatus,
      manualInviteLink: call.manualInviteLink,
      clientJoinLink: call.clientJoinLink,
      bdNotes: call.bdNotes,
      lead: {
        companyName: call.lead.companyName,
        profileName: call.lead.profileName,
        nature: call.lead.nature,
        techStackName: call.lead.techStack.name,
        payrate: call.lead.payrate,
        proofType: call.lead.proofType,
        proofNotes: call.lead.proofNotes,
        proofUrl: call.lead.proofUrl,
        resumeUrl: call.lead.resumeUrl,
        adminNotes: call.lead.adminNotes,
        job: call.lead.job
          ? {
              jobId: call.lead.job.jobId,
              platform: call.lead.job.platform,
              companyName: call.lead.job.companyName,
              jobLink: call.lead.job.jobLink,
              jobDescription: call.lead.job.jobDescription,
            }
          : null,
      },
    });
  }

  private async notifyBdCallScheduled(call: Prisma.LeadCallGetPayload<{ include: typeof includeCall }>) {
    await this.email.sendBdCallScheduled({
      leadId: call.leadId,
      closerEmail: call.closer.email,
      closerName: call.closer.name,
      bdName: call.scheduledByBd.name,
      bdEmail: call.scheduledByBd.email,
      callId: call.id,
      callNumber: call.callNumber,
      callStage: call.callStage,
      scheduledAt: call.scheduledAt,
      manualInviteStatus: call.manualInviteStatus,
      manualInviteLink: call.manualInviteLink,
      clientJoinLink: call.clientJoinLink,
      bdNotes: call.bdNotes,
      lead: {
        companyName: call.lead.companyName,
        profileName: call.lead.profileName,
        nature: call.lead.nature,
        techStackName: call.lead.techStack.name,
        payrate: call.lead.payrate,
        proofType: call.lead.proofType,
        proofNotes: call.lead.proofNotes,
        proofUrl: call.lead.proofUrl,
        resumeUrl: call.lead.resumeUrl,
        adminNotes: call.lead.adminNotes,
        job: call.lead.job
          ? {
              jobId: call.lead.job.jobId,
              platform: call.lead.job.platform,
              companyName: call.lead.job.companyName,
              jobLink: call.lead.job.jobLink,
              jobDescription: call.lead.job.jobDescription,
            }
          : null,
      },
    });
  }

  private async notifyCallAccepted(call: Prisma.LeadCallGetPayload<{ include: typeof includeCall }>) {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: 'ACTIVE', deletedAt: null },
      select: { email: true },
    });
    await this.email.sendAdminCallAccepted({
      to: superAdmins.map((admin) => admin.email),
      leadId: call.leadId,
      closerEmail: call.closer.email,
      closerName: call.closer.name,
      bdName: call.scheduledByBd.name,
      bdEmail: call.scheduledByBd.email,
      callId: call.id,
      callNumber: call.callNumber,
      callStage: call.callStage,
      scheduledAt: call.scheduledAt,
      manualInviteStatus: call.manualInviteStatus,
      manualInviteLink: call.manualInviteLink,
      bdNotes: call.bdNotes,
      lead: this.callEmailLead(call),
    });
  }

  private async notifyManualInviteUpdated(call: Prisma.LeadCallGetPayload<{ include: typeof includeCall }>) {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: 'ACTIVE', deletedAt: null },
      select: { email: true },
    });
    await this.email.sendAdminManualInviteUpdated({
      to: superAdmins.map((admin) => admin.email),
      leadId: call.leadId,
      closerEmail: call.closer.email,
      closerName: call.closer.name,
      bdName: call.scheduledByBd.name,
      bdEmail: call.scheduledByBd.email,
      callId: call.id,
      callNumber: call.callNumber,
      callStage: call.callStage,
      scheduledAt: call.scheduledAt,
      manualInviteStatus: call.manualInviteStatus,
      manualInviteLink: call.manualInviteLink,
      bdNotes: call.bdNotes,
      lead: this.callEmailLead(call),
    });
  }

  private async notifyBdLeadDecision(lead: Prisma.LeadGetPayload<{ include: typeof includeLead }>, to: string, decision: 'APPROVED' | 'DISMISSED') {
    await this.email.sendLeadDecision({
      to,
      decision,
      leadId: lead.id,
      companyName: lead.companyName,
      profileName: lead.profileName,
      nature: lead.nature,
      techStackName: lead.techStack.name,
      payrate: lead.payrate,
      proofType: lead.proofType,
      adminNotes: lead.adminNotes,
      dismissalReason: lead.dismissalReason,
      assignedBdName: lead.assignedBd?.name,
      job: lead.job
        ? {
            jobId: lead.job.jobId,
            platform: lead.job.platform,
            companyName: lead.job.companyName,
            jobLink: lead.job.jobLink,
            status: lead.job.status,
          }
        : null,
    });
  }

  private callEmailLead(call: Prisma.LeadCallGetPayload<{ include: typeof includeCall }>) {
    return {
      companyName: call.lead.companyName,
      profileName: call.lead.profileName,
      nature: call.lead.nature,
      techStackName: call.lead.techStack.name,
      payrate: call.lead.payrate,
      proofType: call.lead.proofType,
      proofNotes: call.lead.proofNotes,
      proofUrl: call.lead.proofUrl,
      resumeUrl: call.lead.resumeUrl,
      adminNotes: call.lead.adminNotes,
      job: call.lead.job
        ? {
            jobId: call.lead.job.jobId,
            platform: call.lead.job.platform,
            companyName: call.lead.job.companyName,
            jobLink: call.lead.job.jobLink,
            jobDescription: call.lead.job.jobDescription,
          }
        : null,
    };
  }
}

function labelStage(stage: CallStage) {
  return stage.toLowerCase().replace(/_/g, ' ');
}

function parseScheduledAt(value: string) {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return new Date(value);
  const [, year, month, day, hour, minute, second = '0'] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 5, Number(minute), Number(second)));
}

function labelStatus(status: string) {
  return status.toLowerCase().replace(/_/g, ' ');
}

function clientResponseLabel(status: string) {
  if (status === 'MANUAL_INVITE_PENDING') return 'awaiting client response';
  if (status === 'MANUAL_INVITE_CREATED') return 'client response requested';
  if (status === 'ACCEPTED') return 'client accepted';
  if (status === 'DECLINED') return 'client declined';
  if (status === 'REMINDER_DUE') return 'reminder due';
  return labelStatus(status);
}
