import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTechStackDto } from './dto/create-tech-stack.dto';
import { UpdateTechStackDto } from './dto/update-tech-stack.dto';

@Injectable()
export class TechStacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  findAll(user: AuthenticatedUser) {
    return this.prisma.techStack.findMany({
      where: user.role === Role.SUPER_ADMIN ? {} : { isActive: true, assignedBds: { some: { id: user.sub } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(actorId: string, dto: CreateTechStackDto) {
    const stack = await this.prisma.techStack.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive ?? true,
      },
    });
    await this.auditLogs.write(actorId, 'TECH_STACK_CREATED', 'TechStack', stack.id, { name: stack.name });
    return stack;
  }

  async update(actorId: string, id: string, dto: UpdateTechStackDto) {
    await this.ensureExists(id);
    const stack = await this.prisma.techStack.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
    });
    await this.auditLogs.write(actorId, 'TECH_STACK_UPDATED', 'TechStack', id, { name: stack.name, isActive: stack.isActive });
    return stack;
  }

  async remove(actorId: string, id: string) {
    await this.ensureExists(id);
    const stack = await this.prisma.techStack.delete({ where: { id } });
    await this.auditLogs.write(actorId, 'TECH_STACK_DELETED', 'TechStack', id, { name: stack.name });
    return stack;
  }

  private async ensureExists(id: string) {
    const stack = await this.prisma.techStack.findUnique({ where: { id } });
    if (!stack) throw new NotFoundException('Tech stack not found');
    return stack;
  }
}
