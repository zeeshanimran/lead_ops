import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobDecisionDto } from './dto/job-decision.dto';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(user: AuthenticatedUser) {
    const assignedStackNames = user.role === Role.BD ? await this.assignedTechStackNames(user.sub) : [];
    return this.prisma.job.findMany({
      where: user.role === Role.BD ? { techStack: { in: assignedStackNames } } : {},
      orderBy: { dateAdded: 'desc' },
      include: { bd: { select: { id: true, name: true, email: true } } },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateJobDto) {
    if (user.role !== Role.BD) throw new ForbiddenException('Only BD users can add jobs');
    const stack = await this.prisma.techStack.findFirst({
      where: {
        name: dto.techStack,
        isActive: true,
        assignedBds: { some: { id: user.sub } },
      },
    });
    if (!stack) throw new ForbiddenException('Select a tech stack assigned to this BD');
    const count = await this.prisma.job.count();
    const job = await this.prisma.job.create({
      data: {
        ...dto,
        jobId: `JOB-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
        bdUserId: user.sub,
      },
    });
    await this.auditLogs.write(user.sub, 'JOB_CREATED', 'Job', job.id, { jobId: job.jobId });
    return job;
  }

  async approve(actorId: string, id: string, dto?: JobDecisionDto) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status === 'REJECTED_BY_ADMIN' || job.status === 'REJECTED') throw new BadRequestException('Rejected jobs cannot be approved');

    const updated = await this.prisma.job.update({
      where: { id },
      data: { status: 'APPROVED_BY_ADMIN', appliedAt: new Date(), adminNotes: dto?.notes?.trim(), rejectionReason: null },
    });
    await this.auditLogs.write(actorId, 'JOB_APPROVED', 'Job', id, { notes: dto?.notes });
    return updated;
  }

  async reject(actorId: string, id: string, dto: JobDecisionDto) {
    await this.ensureExists(id);
    const reason = dto.reason?.trim() || dto.notes?.trim() || undefined;
    if (!reason) throw new BadRequestException('Rejection notes are required');
    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        status: 'REJECTED_BY_ADMIN',
        adminNotes: dto.notes?.trim(),
        rejectionReason: reason,
      },
    });
    await this.auditLogs.write(actorId, 'JOB_REJECTED', 'Job', id, { reason });
    return updated;
  }

  async reopen(actorId: string, id: string, dto: JobDecisionDto) {
    await this.ensureExists(id);
    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        status: 'PENDING_APPROVAL',
        appliedAt: null,
        adminNotes: dto.notes?.trim(),
        rejectionReason: null,
      },
    });
    await this.auditLogs.write(actorId, 'JOB_REOPENED', 'Job', id, { notes: dto.notes });
    return updated;
  }

  async addNotes(actorId: string, id: string, dto: JobDecisionDto) {
    await this.ensureExists(id);
    const updated = await this.prisma.job.update({
      where: { id },
      data: { adminNotes: dto.notes?.trim() },
    });
    await this.auditLogs.write(actorId, 'JOB_NOTED', 'Job', id, { notes: dto.notes });
    return updated;
  }

  private async ensureExists(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private async assignedTechStackNames(bdId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: bdId },
      select: { assignedTechStacks: { where: { isActive: true }, select: { name: true } } },
    });
    return user?.assignedTechStacks.map((stack) => stack.name) ?? [];
  }
}
