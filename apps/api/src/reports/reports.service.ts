import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: AuthenticatedUser) {
    const leadWhere = {
      ...(user.role === Role.BD ? { OR: [{ createdByBdId: user.sub }, { assignedBdId: user.sub }] } : {}),
      ...(user.role === Role.CLOSER ? { calls: { some: { closerId: user.sub } } } : {}),
    };
    const callWhere = {
      ...(user.role === Role.BD ? { scheduledByBdId: user.sub } : {}),
      ...(user.role === Role.CLOSER ? { closerId: user.sub } : {}),
    };
    const [users, jobs, leads, feedback, calls, leadStatuses, jobStatuses, callStatuses, callStages, activeBds, activeClosers, callsByCloser, callsByBd] = await Promise.all([
      user.role === Role.SUPER_ADMIN ? this.prisma.user.count({ where: { deletedAt: null } }) : Promise.resolve(0),
      this.prisma.job.count({ where: user.role === Role.BD ? { bdUserId: user.sub } : {} }),
      this.prisma.lead.count({ where: leadWhere }),
      this.prisma.callFeedback.count({ where: user.role === Role.CLOSER ? { closerId: user.sub } : {} }),
      this.prisma.leadCall.count({ where: callWhere }),
      this.prisma.lead.groupBy({ by: ['status'], where: leadWhere, _count: { _all: true } }),
      this.prisma.job.groupBy({ by: ['status'], where: user.role === Role.BD ? { bdUserId: user.sub } : {}, _count: { _all: true } }),
      this.prisma.leadCall.groupBy({ by: ['status'], where: callWhere, _count: { _all: true } }),
      this.prisma.leadCall.groupBy({ by: ['callStage'], where: callWhere, _count: { _all: true } }),
      this.prisma.user.count({ where: { role: Role.BD, status: 'ACTIVE', deletedAt: null } }),
      this.prisma.user.count({ where: { role: Role.CLOSER, status: 'ACTIVE', deletedAt: null } }),
      this.prisma.leadCall.groupBy({ by: ['closerId'], where: callWhere, _count: { _all: true } }),
      this.prisma.leadCall.groupBy({ by: ['scheduledByBdId'], where: callWhere, _count: { _all: true } }),
    ]);

    return {
      totals: {
        users,
        jobs,
        leads,
        feedback,
        calls,
        activeBds,
        activeClosers,
        pendingApprovals: leadStatuses.find((row) => row.status === 'PENDING_APPROVAL')?._count._all ?? 0,
        approvedLeads: leadStatuses.find((row) => row.status === 'READY_TO_SCHEDULE')?._count._all ?? 0,
        scheduledCalls: callStatuses.find((row) => row.status === 'SCHEDULED')?._count._all ?? 0,
        completedCalls: callStatuses.find((row) => row.status === 'COMPLETED')?._count._all ?? 0,
        pendingFeedbackCalls: callStatuses.find((row) => row.status === 'PENDING_FEEDBACK')?._count._all ?? 0,
      },
      leadStatuses: leadStatuses.map((row) => ({ status: row.status, _count: row._count._all })),
      jobStatuses: jobStatuses.map((row) => ({ status: row.status, _count: row._count._all })),
      callStatuses: callStatuses.map((row) => ({ status: row.status, _count: row._count._all })),
      callStages: callStages.map((row) => ({ callStage: row.callStage, _count: row._count._all })),
      callsByCloser: callsByCloser.map((row) => ({ closerId: row.closerId, _count: row._count._all })),
      callsByBd: callsByBd.map((row) => ({ bdId: row.scheduledByBdId, _count: row._count._all })),
    };
  }
}
