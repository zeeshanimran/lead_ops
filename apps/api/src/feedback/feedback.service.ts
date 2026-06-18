import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FeedbackCallStatus, FeedbackResult, LeadCallStatus, LeadStatus, Role } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

const publicUser = { id: true, name: true, email: true, role: true, status: true } as const;

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  findAll(user: AuthenticatedUser) {
    return this.prisma.callFeedback.findMany({
      where: user.role === Role.CLOSER ? { closerId: user.sub } : {},
      include: {
        closer: { select: publicUser },
        leadCall: {
          include: {
            lead: {
              include: {
                createdByBd: { select: publicUser },
                assignedBd: { select: publicUser },
                techStack: true,
                job: true,
              },
            },
            closer: { select: publicUser },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateFeedbackDto) {
    if (user.role !== Role.CLOSER) throw new ForbiddenException('Only closers can submit feedback');
    if (!dto.leadCallId) throw new BadRequestException('leadCallId is required');
    const leadCallId = dto.leadCallId;
    const call = await this.prisma.leadCall.findUnique({
      where: { id: leadCallId },
      include: { lead: true },
    });
    if (!call) throw new NotFoundException('Call not found');
    if (call.closerId !== user.sub) throw new ForbiddenException('Call is not assigned to this closer');

    const nextLeadStatus = deriveLeadStatus(dto.result, dto.nextCallRequired);
    const nextCallStatus = deriveCallStatus(dto.callStatus);
    const feedback = await this.prisma.$transaction(async (tx) => {
      const created = await tx.callFeedback.create({
        data: { ...dto, leadCallId, closerId: user.sub },
        include: { leadCall: { include: { lead: true } }, closer: { select: publicUser } },
      });
      await tx.leadCall.update({
        where: { id: leadCallId },
        data: { status: nextCallStatus, closerNotes: dto.comments },
      });
      await tx.lead.update({
        where: { id: call.leadId },
        data: { status: nextLeadStatus, currentStage: call.callStage },
      });
      await tx.leadTimeline.create({
        data: {
          leadId: call.leadId,
          actorId: user.sub,
          action: 'FEEDBACK_SUBMITTED',
          description: `Feedback submitted for call #${call.callNumber}`,
          metadata: {
            callId: leadCallId,
            callStatus: dto.callStatus,
            result: dto.result,
            nextCallRequired: dto.nextCallRequired,
          },
        },
      });
      if (dto.nextCallRequired) {
        await tx.leadTimeline.create({
          data: {
            leadId: call.leadId,
            actorId: user.sub,
            action: 'NEXT_CALL_REQUIRED',
            description: 'Closer marked that another call is required',
            metadata: { callId: leadCallId, nextAction: dto.nextAction },
          },
        });
      }
      return created;
    });

    await this.auditLogs.write(user.sub, 'FEEDBACK_SUBMITTED', 'CallFeedback', feedback.id, {
      leadId: call.leadId,
      leadCallId,
      result: dto.result,
    });
    return feedback;
  }
}

function deriveCallStatus(callStatus: FeedbackCallStatus) {
  if (callStatus === FeedbackCallStatus.TAKEN) return LeadCallStatus.COMPLETED;
  if (callStatus === FeedbackCallStatus.NO_SHOW) return LeadCallStatus.NO_SHOW;
  if (callStatus === FeedbackCallStatus.RESCHEDULED) return LeadCallStatus.RESCHEDULED;
  return LeadCallStatus.PENDING_FEEDBACK;
}

function deriveLeadStatus(result: FeedbackResult, nextCallRequired: boolean) {
  if (nextCallRequired || result === FeedbackResult.NEED_NEXT_CALL) return LeadStatus.NEXT_CALL_REQUIRED;
  if (result === FeedbackResult.OFFERED) return LeadStatus.OFFERED;
  if (result === FeedbackResult.REJECTED) return LeadStatus.REJECTED;
  if (result === FeedbackResult.FAILED) return LeadStatus.CLOSED;
  return LeadStatus.IN_PROGRESS;
}
