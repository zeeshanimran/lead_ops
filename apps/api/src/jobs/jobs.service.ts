import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(user: AuthenticatedUser) {
    return this.prisma.job.findMany({
      where: user.role === Role.BD ? { bdUserId: user.sub } : {},
      orderBy: { dateAdded: 'desc' },
      include: { bd: { select: { id: true, name: true, email: true } } },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateJobDto) {
    if (user.role !== Role.BD) throw new ForbiddenException('Only BD users can add jobs');
    const stack = await this.prisma.techStack.findFirst({
      where: { name: dto.techStack, isActive: true },
    });
    if (!stack) throw new ForbiddenException('Select an active tech stack');
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

  async apply(user: AuthenticatedUser, id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    if (user.role === Role.BD && job.bdUserId !== user.sub) throw new ForbiddenException('Cannot apply to another BD job');

    const updated = await this.prisma.job.update({
      where: { id },
      data: { status: 'APPLIED', appliedAt: new Date() },
    });
    await this.auditLogs.write(user.sub, 'JOB_APPLIED', 'Job', id);
    return updated;
  }
}
