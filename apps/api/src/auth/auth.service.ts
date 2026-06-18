import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { LoginDto } from './dto/login.dto';

type TokenPayload = { sub: string; email: string; role: Role };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.deletedAt) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new ForbiddenException('Account is inactive');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.signTokens({ sub: user.id, email: user.email, role: user.role });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await argon2.hash(tokens.refreshToken) },
    });

    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret',
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user?.refreshTokenHash || user.status !== 'ACTIVE' || user.deletedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const valid = await argon2.verify(user.refreshTokenHash, refreshToken);
      if (!valid) throw new UnauthorizedException('Invalid refresh token');
      const tokens = await this.signTokens({ sub: user.id, email: user.email, role: user.role });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: await argon2.hash(tokens.refreshToken) },
      });
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        invitationTokenHash: tokenHash,
        invitationExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
    });
    if (!user) throw new UnauthorizedException('Invalid or expired invite');

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(dto.password),
        status: UserStatus.ACTIVE,
        invitationTokenHash: null,
        invitationAcceptedAt: new Date(),
        refreshTokenHash: null,
      },
    });

    const tokens = await this.signTokens({ sub: updated.id, email: updated.email, role: updated.role });
    await this.prisma.user.update({
      where: { id: updated.id },
      data: { refreshTokenHash: await argon2.hash(tokens.refreshToken) },
    });

    return {
      ...tokens,
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, status: updated.status },
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
    return { ok: true };
  }

  private async signTokens(payload: TokenPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret',
        expiresIn: Number(this.config.get<string>('JWT_REFRESH_EXPIRES_IN_SECONDS') ?? 604800),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
