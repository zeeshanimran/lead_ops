# LeadOps CRM

Production-ready Phase 1 CRM scaffold converted from `index(5).html`.

## Stack

- `apps/web`: Next.js App Router, TypeScript, Tailwind CSS, role-protected pages
- `apps/api`: NestJS, Prisma, PostgreSQL, JWT access and refresh tokens, Swagger
- `apps/api/prisma`: schema, migrations, and Super Admin-only seed setup

## Phase 1 Roles

- Super Admin
- BD
- Closer

Organization owner, workspace owner, CEO, manager, public signup, organization management, workspace signup, and calendar invite automation are intentionally not implemented yet.

## Local Setup

```bash
cp apps/api/.env.example apps/api/.env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The seed creates only the Super Admin from `apps/api/.env`:

- `SUPER_ADMIN_NAME`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

BD and Closer users are created from the Super Admin UI.

API docs are available at `http://localhost:4000/docs`.
