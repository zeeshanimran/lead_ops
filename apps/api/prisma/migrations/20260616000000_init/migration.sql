CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'BD', 'CLOSER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "JobStatus" AS ENUM ('NOT_APPLIED', 'APPLIED');
CREATE TYPE "LeadNature" AS ENUM ('W2', 'CONTRACT', 'C2C');
CREATE TYPE "ProofType" AS ENUM ('EMAIL_LINK', 'SCREENSHOT', 'MANUAL_VERIFICATION');
CREATE TYPE "LeadStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'DISMISSED', 'SCHEDULED', 'ACTIVE', 'CLOSED');
CREATE TYPE "ManualInviteStatus" AS ENUM ('MANUAL_INVITE_PENDING', 'MANUAL_INVITE_CREATED', 'ACCEPTED', 'DECLINED', 'REMINDER_DUE', 'RED_ALERT');
CREATE TYPE "CallStatus" AS ENUM ('TAKEN', 'RESCHEDULED', 'NO_SHOW', 'SHIFTED');
CREATE TYPE "CallStage" AS ENUM ('SCREENING', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'FINAL', 'OFFERED');
CREATE TYPE "CallNature" AS ENUM ('PHONE_SCREENING', 'FIRST_INTERVIEW', 'TECHNICAL_ROUND', 'PANEL_INTERVIEW', 'CULTURE_FIT', 'FINAL_PANEL', 'OFFER_CALL');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "refreshTokenHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Job" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "platform" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "techStack" TEXT NOT NULL,
  "jobLink" TEXT NOT NULL,
  "jobDescription" TEXT NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'NOT_APPLIED',
  "appliedAt" TIMESTAMP(3),
  "bdUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "profileName" TEXT NOT NULL,
  "resumeUrl" TEXT,
  "nature" "LeadNature" NOT NULL,
  "techStack" TEXT NOT NULL,
  "payrate" TEXT NOT NULL,
  "proofType" "ProofType" NOT NULL,
  "proofNotes" TEXT,
  "proofUrl" TEXT,
  "approvalNotes" TEXT,
  "dismissalReason" TEXT,
  "status" "LeadStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "manualInviteStatus" "ManualInviteStatus" NOT NULL DEFAULT 'MANUAL_INVITE_PENDING',
  "manualInviteLink" TEXT,
  "inviteNotes" TEXT,
  "scheduledDate" TIMESTAMP(3),
  "scheduledTime" TEXT,
  "bdUserId" TEXT NOT NULL,
  "jobId" TEXT,
  "closerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Feedback" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "closerId" TEXT NOT NULL,
  "secondaryCloserId" TEXT,
  "callStatus" "CallStatus" NOT NULL,
  "callStage" "CallStage" NOT NULL,
  "nature" "CallNature" NOT NULL,
  "payrateDiscussed" TEXT NOT NULL,
  "importantNotes" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Job_jobId_key" ON "Job"("jobId");
CREATE INDEX "Job_bdUserId_idx" ON "Job"("bdUserId");
CREATE INDEX "Job_dateAdded_idx" ON "Job"("dateAdded");
CREATE INDEX "Lead_bdUserId_idx" ON "Lead"("bdUserId");
CREATE INDEX "Lead_closerId_idx" ON "Lead"("closerId");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Feedback_leadId_idx" ON "Feedback"("leadId");
CREATE INDEX "Feedback_closerId_idx" ON "Feedback"("closerId");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "Job" ADD CONSTRAINT "Job_bdUserId_fkey" FOREIGN KEY ("bdUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_bdUserId_fkey" FOREIGN KEY ("bdUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_secondaryCloserId_fkey" FOREIGN KEY ("secondaryCloserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
