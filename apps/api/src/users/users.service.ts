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
    const inviteToken = randomBytes(32).toString('base64url');
    const invitationTokenHash = createHash('sha256').update(inviteToken).digest('hex');
    const now = new Date();
    const invitationExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        status: UserStatus.INACTIVE,
        passwordHash: await argon2.hash(randomBytes(32).toString('base64url')),
        invitationTokenHash,
        invitationSentAt: now,
        invitationExpiresAt,
      },
      select: publicUser,
    });
    await this.email.sendInvite(user.email, user.name, user.role, inviteToken);
    await this.auditLogs.write(actorId, 'USER_CREATED', 'User', user.id, { role: user.role });
    return user;
  }

  async update(actorId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Super Admin cannot be managed from the users list');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        status: dto.status,
        ...(dto.password ? { passwordHash: await argon2.hash(dto.password), refreshTokenHash: null } : {}),
      },
      select: publicUser,
    });
    await this.auditLogs.write(actorId, 'USER_UPDATED', 'User', user.id, { status: user.status });
    return user;
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
