ALTER TABLE "Lead"
ADD COLUMN "techStackId" TEXT,
ADD COLUMN "createdByBdId" TEXT,
ADD COLUMN "assignedBdId" TEXT,
ADD COLUMN "approvedByAdminId" TEXT,
ADD COLUMN "currentStage" "CallStage",
ADD COLUMN "adminNotes" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3);

INSERT INTO "TechStack" ("id", "name", "description", "isActive", "createdAt", "updatedAt")
SELECT CONCAT('migrated_', md5("techStack")), "techStack", 'Migrated from legacy lead tech stack', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Lead"
WHERE "techStack" IS NOT NULL
ON CONFLICT ("name") DO NOTHING;

UPDATE "Lead"
SET
  "techStackId" = "TechStack"."id",
  "createdByBdId" = "Lead"."bdUserId",
  "assignedBdId" = CASE
    WHEN "Lead"."status" IN ('APPROVED', 'SCHEDULED', 'ACTIVE', 'CLOSED') THEN "Lead"."bdUserId"
    ELSE NULL
  END,
  "adminNotes" = "Lead"."approvalNotes",
  "approvedAt" = CASE
    WHEN "Lead"."status" IN ('APPROVED', 'SCHEDULED', 'ACTIVE', 'CLOSED') THEN COALESCE("Lead"."updatedAt", CURRENT_TIMESTAMP)
    ELSE NULL
  END,
  "currentStage" = CASE
    WHEN "Lead"."status" IN ('SCHEDULED', 'ACTIVE') THEN 'SCREENING'::"CallStage"
    ELSE NULL
  END
FROM "TechStack"
WHERE "TechStack"."name" = "Lead"."techStack";

UPDATE "Lead" SET "status" = 'READY_TO_SCHEDULE' WHERE "status" = 'APPROVED';
UPDATE "Lead" SET "status" = 'CALL_SCHEDULED' WHERE "status" = 'SCHEDULED';
UPDATE "Lead" SET "status" = 'IN_PROGRESS' WHERE "status" = 'ACTIVE';

ALTER TABLE "Lead" ALTER COLUMN "techStackId" SET NOT NULL;
ALTER TABLE "Lead" ALTER COLUMN "createdByBdId" SET NOT NULL;

CREATE TABLE "LeadCall" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "callNumber" INTEGER NOT NULL,
  "callStage" "CallStage" NOT NULL,
  "scheduledByBdId" TEXT NOT NULL,
  "closerId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" "LeadCallStatus" NOT NULL DEFAULT 'SCHEDULED',
  "manualInviteStatus" "ManualInviteStatus" NOT NULL DEFAULT 'MANUAL_INVITE_PENDING',
  "manualInviteLink" TEXT,
  "bdNotes" TEXT,
  "closerNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallFeedback" (
  "id" TEXT NOT NULL,
  "leadCallId" TEXT NOT NULL,
  "closerId" TEXT NOT NULL,
  "callStatus" "FeedbackCallStatus" NOT NULL,
  "result" "FeedbackResult" NOT NULL,
  "comments" TEXT NOT NULL,
  "payrateDiscussed" TEXT NOT NULL,
  "nextAction" TEXT,
  "nextCallRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadTimeline" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadTimeline_pkey" PRIMARY KEY ("id")
);

INSERT INTO "LeadCall" (
  "id", "leadId", "callNumber", "callStage", "scheduledByBdId", "closerId", "scheduledAt", "status",
  "manualInviteStatus", "manualInviteLink", "bdNotes", "createdAt", "updatedAt"
)
SELECT
  CONCAT('migrated_call_', l."id"),
  l."id",
  1,
  COALESCE(l."currentStage", 'SCREENING'::"CallStage"),
  l."createdByBdId",
  l."closerId",
  COALESCE(l."scheduledDate", l."updatedAt", CURRENT_TIMESTAMP),
  CASE WHEN EXISTS (SELECT 1 FROM "Feedback" f WHERE f."leadId" = l."id") THEN 'COMPLETED'::"LeadCallStatus" ELSE 'SCHEDULED'::"LeadCallStatus" END,
  CASE WHEN l."manualInviteStatus" = 'RED_ALERT' THEN 'REMINDER_DUE'::"ManualInviteStatus" ELSE l."manualInviteStatus" END,
  l."manualInviteLink",
  l."inviteNotes",
  COALESCE(l."scheduledDate", l."updatedAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "Lead" l
WHERE l."closerId" IS NOT NULL;

INSERT INTO "CallFeedback" (
  "id", "leadCallId", "closerId", "callStatus", "result", "comments", "payrateDiscussed",
  "nextAction", "nextCallRequired", "createdAt", "updatedAt"
)
SELECT
  f."id",
  CONCAT('migrated_call_', f."leadId"),
  f."closerId",
  f."callStatus"::TEXT::"FeedbackCallStatus",
  CASE WHEN f."callStatus" = 'TAKEN' THEN 'PASSED'::"FeedbackResult" ELSE 'NO_DECISION'::"FeedbackResult" END,
  f."importantNotes",
  f."payrateDiscussed",
  NULL,
  false,
  f."createdAt",
  f."updatedAt"
FROM "Feedback" f
WHERE EXISTS (SELECT 1 FROM "LeadCall" lc WHERE lc."id" = CONCAT('migrated_call_', f."leadId"));

INSERT INTO "LeadTimeline" ("id", "leadId", "actorId", "action", "description", "metadata", "createdAt")
SELECT CONCAT('timeline_created_', "id"), "id", "createdByBdId", 'LEAD_CREATED', CONCAT('Lead submitted for ', "companyName"), NULL, "createdAt"
FROM "Lead";

INSERT INTO "LeadTimeline" ("id", "leadId", "actorId", "action", "description", "metadata", "createdAt")
SELECT CONCAT('timeline_call_', "id"), "leadId", "scheduledByBdId", 'CALL_SCHEDULED', CONCAT('Call #', "callNumber", ' scheduled'), jsonb_build_object('closerId', "closerId", 'callStage', "callStage"), "createdAt"
FROM "LeadCall";

INSERT INTO "LeadTimeline" ("id", "leadId", "actorId", "action", "description", "metadata", "createdAt")
SELECT CONCAT('timeline_feedback_', cf."id"), lc."leadId", cf."closerId", 'FEEDBACK_SUBMITTED', 'Closer feedback submitted', jsonb_build_object('result', cf."result", 'callStatus', cf."callStatus"), cf."createdAt"
FROM "CallFeedback" cf
JOIN "LeadCall" lc ON lc."id" = cf."leadCallId";

CREATE UNIQUE INDEX "LeadCall_leadId_callNumber_key" ON "LeadCall"("leadId", "callNumber");
CREATE INDEX "LeadCall_leadId_idx" ON "LeadCall"("leadId");
CREATE INDEX "LeadCall_scheduledByBdId_idx" ON "LeadCall"("scheduledByBdId");
CREATE INDEX "LeadCall_closerId_idx" ON "LeadCall"("closerId");
CREATE INDEX "LeadCall_status_idx" ON "LeadCall"("status");
CREATE INDEX "CallFeedback_leadCallId_idx" ON "CallFeedback"("leadCallId");
CREATE INDEX "CallFeedback_closerId_idx" ON "CallFeedback"("closerId");
CREATE INDEX "LeadTimeline_leadId_idx" ON "LeadTimeline"("leadId");
CREATE INDEX "LeadTimeline_actorId_idx" ON "LeadTimeline"("actorId");
CREATE INDEX "LeadTimeline_createdAt_idx" ON "LeadTimeline"("createdAt");
CREATE INDEX "Lead_createdByBdId_idx" ON "Lead"("createdByBdId");
CREATE INDEX "Lead_assignedBdId_idx" ON "Lead"("assignedBdId");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdByBdId_fkey" FOREIGN KEY ("createdByBdId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedBdId_fkey" FOREIGN KEY ("assignedBdId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_techStackId_fkey" FOREIGN KEY ("techStackId") REFERENCES "TechStack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadCall" ADD CONSTRAINT "LeadCall_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadCall" ADD CONSTRAINT "LeadCall_scheduledByBdId_fkey" FOREIGN KEY ("scheduledByBdId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadCall" ADD CONSTRAINT "LeadCall_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CallFeedback" ADD CONSTRAINT "CallFeedback_leadCallId_fkey" FOREIGN KEY ("leadCallId") REFERENCES "LeadCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallFeedback" ADD CONSTRAINT "CallFeedback_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadTimeline" ADD CONSTRAINT "LeadTimeline_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadTimeline" ADD CONSTRAINT "LeadTimeline_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_bdUserId_fkey";
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_closerId_fkey";
ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_leadId_fkey";
ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_closerId_fkey";
ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_secondaryCloserId_fkey";
DROP INDEX IF EXISTS "Lead_bdUserId_idx";
DROP INDEX IF EXISTS "Lead_closerId_idx";
DROP INDEX IF EXISTS "Feedback_leadId_idx";
DROP INDEX IF EXISTS "Feedback_closerId_idx";
DROP TABLE "Feedback";
ALTER TABLE "Lead"
DROP COLUMN "techStack",
DROP COLUMN "approvalNotes",
DROP COLUMN "manualInviteStatus",
DROP COLUMN "manualInviteLink",
DROP COLUMN "inviteNotes",
DROP COLUMN "scheduledDate",
DROP COLUMN "scheduledTime",
DROP COLUMN "bdUserId",
DROP COLUMN "closerId";
