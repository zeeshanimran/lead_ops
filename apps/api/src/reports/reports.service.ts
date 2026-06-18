import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: AuthenticatedUser) {
    const leadWhere = {
      ...(user.role === Role.BD ? { bdUserId: user.sub } : {}),
      ...(user.role === Role.CLOSER ? { closerId: user.sub } : {}),
    };
    const [users, jobs, leads, feedback, leadStatuses, jobStatuses, activeBds, activeClosers] = await Promise.all([
      user.role === Role.SUPER_ADMIN ? this.prisma.user.count({ where: { deletedAt: null } }) : Promise.resolve(0),
      this.prisma.job.count({ where: user.role === Role.BD ? { bdUserId: user.sub } : {} }),
      this.prisma.lead.count({ where: leadWhere }),
      this.prisma.feedback.count({ where: user.role === Role.CLOSER ? { closerId: user.sub } : {} }),
      this.prisma.lead.groupBy({ by: ['status'], where: leadWhere, _count: { _all: true } }),
      this.prisma.job.groupBy({ by: ['status'], where: user.role === Role.BD ? { bdUserId: user.sub } : {}, _count: { _all: true } }),
      this.prisma.user.count({ where: { role: Role.BD, status: 'ACTIVE', deletedAt: null } }),
      this.prisma.user.count({ where: { role: Role.CLOSER, status: 'ACTIVE', deletedAt: null } }),
    ]);

    return {
      totals: { users, jobs, leads, feedback, activeBds, activeClosers },
      leadStatuses: leadStatuses.map((row) => ({ status: row.status, _count: row._count._all })),
      jobStatuses: jobStatuses.map((row) => ({ status: row.status, _count: row._count._all })),
    };
  }
}
