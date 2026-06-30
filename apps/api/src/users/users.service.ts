import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const publicUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  assignedTechStacks: { orderBy: { name: 'asc' as const } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly email: EmailService,
  ) {}

  findAll(role?: Role) {
    return this.prisma.user.findMany({
      where: { deletedAt: null, ...(role ? { role } : {}) },
      select: publicUser,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async findMe(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: publicUser,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(actorId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: actorId },
      data: {
        name: dto.name,
        ...(dto.password ? { passwordHash: await argon2.hash(dto.password), refreshTokenHash: null } : {}),
      },
      select: publicUser,
    });
    await this.auditLogs.write(actorId, 'PROFILE_UPDATED', 'User', actorId);
    return user;
  }

  async create(actorId: string, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.deletedAt && existing.role !== Role.SUPER_ADMIN) {
      return this.reinviteDeletedUser(actorId, existing.id, { ...dto, email });
    }
    if (existing) {
      throw new BadRequestException('Email is already in use');
    }

    const inviteToken = randomBytes(32).toString('base64url');
    const invitationTokenHash = createHash('sha256').update(inviteToken).digest('hex');
    const now = new Date();
    const invitationExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const techStackIds = await this.prepareTechStackAssignments(dto.role, dto.techStackIds, true);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        role: dto.role,
        status: UserStatus.INACTIVE,
        passwordHash: await argon2.hash(randomBytes(32).toString('base64url')),
        invitationTokenHash,
        invitationSentAt: now,
        invitationExpiresAt,
        ...(techStackIds
          ? { assignedTechStacks: { connect: techStackIds.map((stackId) => ({ id: stackId })) } }
          : {}),
      },
      select: publicUser,
    });
    const sent = await this.email.sendInvite(user.email, user.name, user.role, inviteToken);
    await this.auditLogs.write(actorId, 'USER_CREATED', 'User', user.id, { role: user.role, techStackIds: techStackIds ?? undefined });
    return this.withInviteFallback(user, inviteToken, sent);
  }

  private async reinviteDeletedUser(actorId: string, id: string, dto: CreateUserDto) {
    const inviteToken = randomBytes(32).toString('base64url');
    const invitationTokenHash = createHash('sha256').update(inviteToken).digest('hex');
    const now = new Date();
    const invitationExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const techStackIds = await this.prepareTechStackAssignments(dto.role, dto.techStackIds, true);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        status: UserStatus.INACTIVE,
        deletedAt: null,
        refreshTokenHash: null,
        passwordHash: await argon2.hash(randomBytes(32).toString('base64url')),
        invitationTokenHash,
        invitationSentAt: now,
        invitationExpiresAt,
        invitationAcceptedAt: null,
        assignedTechStacks: {
          set: this.canAssignTechStacks(dto.role) && techStackIds ? techStackIds.map((stackId) => ({ id: stackId })) : [],
        },
      },
      select: publicUser,
    });
    const sent = await this.email.sendInvite(user.email, user.name, user.role, inviteToken);
    await this.auditLogs.write(actorId, 'USER_REINVITED', 'User', user.id, { role: user.role, techStackIds: techStackIds ?? undefined });
    return this.withInviteFallback(user, inviteToken, sent);
  }

  async resendInvite(actorId: string, id: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.role === Role.SUPER_ADMIN) throw new BadRequestException('Super Admin does not use invites');
    if (existing.status === UserStatus.ACTIVE && existing.invitationAcceptedAt) {
      throw new BadRequestException('User has already accepted the invite');
    }

    const inviteToken = randomBytes(32).toString('base64url');
    const invitationTokenHash = createHash('sha256').update(inviteToken).digest('hex');
    const now = new Date();
    const invitationExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
        invitationTokenHash,
        invitationSentAt: now,
        invitationExpiresAt,
        invitationAcceptedAt: null,
        refreshTokenHash: null,
      },
      select: publicUser,
    });
    const sent = await this.email.sendInvite(user.email, user.name, user.role, inviteToken);
    await this.auditLogs.write(actorId, 'USER_INVITE_RESENT', 'User', user.id, { role: user.role });
    return this.withInviteFallback(user, inviteToken, sent);
  }

  private withInviteFallback<T extends object>(user: T, token: string, sent: boolean) {
    return { ...user, emailSent: sent, invitationUrl: this.email.inviteLink(token) };
  }

  async update(actorId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Super Admin cannot be managed from the users list');
    }
    const nextRole = dto.role ?? existing.role;
    if (dto.techStackIds !== undefined && !this.canAssignTechStacks(nextRole)) {
      throw new BadRequestException('Tech stacks can only be assigned to BD and Closer users');
    }
    const techStackIds = await this.prepareTechStackAssignments(nextRole, dto.techStackIds);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        status: dto.status,
        ...(dto.password ? { passwordHash: await argon2.hash(dto.password), refreshTokenHash: null } : {}),
        ...(techStackIds !== undefined || !this.canAssignTechStacks(nextRole)
          ? {
              assignedTechStacks: {
                set: this.canAssignTechStacks(nextRole) && techStackIds ? techStackIds.map((stackId) => ({ id: stackId })) : [],
              },
            }
          : {}),
      },
      select: publicUser,
    });
    await this.auditLogs.write(actorId, 'USER_UPDATED', 'User', user.id, {
      status: user.status,
      techStackIds: techStackIds ?? undefined,
    });
    return user;
  }

  private canAssignTechStacks(role: Role) {
    return role === Role.BD || role === Role.CLOSER;
  }

  private async prepareTechStackAssignments(role: Role, requestedIds?: string[], requireForRole = false) {
    if (requestedIds !== undefined && !this.canAssignTechStacks(role)) {
      throw new BadRequestException('Tech stacks can only be assigned to BD and Closer users');
    }
    if (requireForRole && this.canAssignTechStacks(role) && !requestedIds?.length) {
      throw new BadRequestException('Assign at least one tech stack');
    }
    if (requestedIds === undefined) return undefined;

    const techStackIds = Array.from(new Set(requestedIds));
    if (requireForRole && this.canAssignTechStacks(role) && !techStackIds.length) {
      throw new BadRequestException('Assign at least one tech stack');
    }
    if (!techStackIds.length) return [];

    const activeStacks = await this.prisma.techStack.findMany({
      where: { id: { in: techStackIds }, isActive: true },
      select: { id: true },
    });
    if (activeStacks.length !== techStackIds.length) {
      throw new BadRequestException('Assign only active tech stacks');
    }
    return techStackIds;
  }

  async remove(actorId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === Role.SUPER_ADMIN) throw new BadRequestException('Cannot delete Super Admin');
    const deleted = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: UserStatus.INACTIVE, refreshTokenHash: null },
      select: publicUser,
    });
    await this.auditLogs.write(actorId, 'USER_DELETED', 'User', id);
    return deleted;
  }
}
