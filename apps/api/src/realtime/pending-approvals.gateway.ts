import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { requireConfig } from '../config/required-env';
import { PrismaService } from '../prisma/prisma.service';

type AccessTokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

@Injectable()
export class PendingApprovalsGateway {
  private readonly clients = new Set<WebSocket>();
  private server?: WebSocketServer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  attach(server: HttpServer) {
    if (this.server) return;
    this.server = new WebSocketServer({ server, path: '/ws/pending-approvals' });
    this.server.on('connection', (socket, request) => {
      void this.handleConnection(socket, request);
    });
  }

  async broadcastPendingApprovals() {
    const count = await this.pendingApprovalCount();
    const message = JSON.stringify({ type: 'pendingApprovals', count });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }

  private async handleConnection(socket: WebSocket, request: IncomingMessage) {
    try {
      const user = await this.authenticate(request);
      if (user.role !== Role.SUPER_ADMIN) {
        socket.close(1008, 'Admin role required');
        return;
      }
      this.clients.add(socket);
      socket.on('close', () => this.clients.delete(socket));
      socket.on('error', () => this.clients.delete(socket));
      socket.send(JSON.stringify({ type: 'pendingApprovals', count: await this.pendingApprovalCount() }));
    } catch {
      socket.close(1008, 'Unauthorized');
    }
  }

  private async authenticate(request: IncomingMessage) {
    const token = this.accessToken(request);
    if (!token) throw new Error('Missing token');
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: requireConfig(this.config, 'JWT_ACCESS_SECRET'),
    });
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, status: 'ACTIVE', deletedAt: null },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new Error('Inactive user');
    return { sub: user.id, email: user.email, role: user.role };
  }

  private accessToken(request: IncomingMessage) {
    const url = new URL(request.url ?? '', 'http://localhost');
    return url.searchParams.get('token');
  }

  private pendingApprovalCount() {
    return this.prisma.lead.count({ where: { status: 'PENDING_APPROVAL' } });
  }
}
