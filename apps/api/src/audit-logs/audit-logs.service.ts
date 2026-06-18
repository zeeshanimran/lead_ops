import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  write(actorId: string | undefined, action: string, entityType: string, entityId?: string, metadata?: unknown) {
    return this.prisma.auditLog.create({
      data: { actorId, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue },
    });
  }

  findAll() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    });
  }
}
