ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
CREATE TYPE "LeadStatus" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'READY_TO_SCHEDULE',
  'CALL_SCHEDULED',
  'IN_PROGRESS',
  'NEXT_CALL_REQUIRED',
  'OFFERED',
  'REJECTED',
  'CLOSED',
  'DISMISSED'
);
ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus" USING "status"::TEXT::"LeadStatus";
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';
DROP TYPE "LeadStatus_old";

ALTER TYPE "ManualInviteStatus" RENAME TO "ManualInviteStatus_old";
CREATE TYPE "ManualInviteStatus" AS ENUM (
  'MANUAL_INVITE_PENDING',
  'MANUAL_INVITE_CREATED',
  'ACCEPTED',
  'DECLINED',
  'REMINDER_DUE'
);
ALTER TABLE "LeadCall" ALTER COLUMN "manualInviteStatus" DROP DEFAULT;
ALTER TABLE "LeadCall" ALTER COLUMN "manualInviteStatus" TYPE "ManualInviteStatus" USING "manualInviteStatus"::TEXT::"ManualInviteStatus";
ALTER TABLE "LeadCall" ALTER COLUMN "manualInviteStatus" SET DEFAULT 'MANUAL_INVITE_PENDING';
DROP TYPE "ManualInviteStatus_old";
