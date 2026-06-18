import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

config({ override: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const name = process.env.SUPER_ADMIN_NAME;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error('SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, and SUPER_ADMIN_PASSWORD are required');
  }

  const passwordHash = await argon2.hash(password);

  await prisma.$transaction([
    prisma.callFeedback.deleteMany(),
    prisma.leadTimeline.deleteMany(),
    prisma.leadCall.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.job.deleteMany(),
    prisma.techStack.deleteMany(),
    prisma.user.deleteMany({ where: { email: { not: email } } }),
  ]);

  await prisma.user.upsert({
    where: { email },
    create: {
      name,
      email,
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    update: {
      name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      refreshTokenHash: null,
      invitationTokenHash: null,
      invitationSentAt: null,
      invitationExpiresAt: null,
      invitationAcceptedAt: null,
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
