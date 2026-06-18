import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CallStatus, LeadStatus, Role } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  findAll(user: AuthenticatedUser) {
    return this.prisma.feedback.findMany({
      where: user.role === Role.CLOSER ? { closerId: user.sub } : {},
      include: {
        lead: true,
        closer: { select: { id: true, name: true, email: true } },
        secondaryCloser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateFeedbackDto) {
    if (user.role !== Role.CLOSER) throw new ForbiddenException('Only closers can submit feedback');
    const lead = await this.prisma.lead.findUnique({ where: { id: dto.leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.closerId !== user.sub) throw new ForbiddenException('Lead is not assigned to this closer');
    if (dto.secondaryCloserId) {
      const secondary = await this.prisma.user.findFirst({
        where: { id: dto.secondaryCloserId, role: Role.CLOSER, status: 'ACTIVE', deletedAt: null },
      });
      if (!secondary) throw new BadRequestException('Secondary closer must be an active closer');
    }

    const feedback = await this.prisma.feedback.create({
      data: { ...dto, closerId: user.sub },
      include: { lead: true },
    });

    await this.prisma.lead.update({
      where: { id: dto.leadId },
      data: {
        status: dto.callStatus === CallStatus.TAKEN ? LeadStatus.ACTIVE : LeadStatus.SCHEDULED,
        manualInviteStatus: dto.callStatus === CallStatus.NO_SHOW ? 'REMINDER_DUE' : lead.manualInviteStatus,
      },
    });
    await this.auditLogs.write(user.sub, 'FEEDBACK_SUBMITTED', 'Feedback', feedback.id, { leadId: dto.leadId });
    return feedback;
  }
}
