CREATE TYPE "CalendarEventStatus" AS ENUM ('QUEUED', 'PROCESSING', 'CREATED', 'FAILED', 'CANCELLED');

ALTER TABLE "LeadCall"
ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "candidateEmail" TEXT,
ADD COLUMN "interviewerName" TEXT,
ADD COLUMN "interviewerEmail" TEXT,
ADD COLUMN "optionalGuestEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "calendarStatus" "CalendarEventStatus",
ADD COLUMN "calendarEventId" TEXT,
ADD COLUMN "calendarEventUrl" TEXT,
ADD COLUMN "calendarMeetUrl" TEXT,
ADD COLUMN "calendarAttendees" JSONB,
ADD COLUMN "calendarOrganizer" TEXT,
ADD COLUMN "calendarQueuedAt" TIMESTAMP(3),
ADD COLUMN "calendarSyncedAt" TIMESTAMP(3),
ADD COLUMN "calendarFailedAt" TIMESTAMP(3),
ADD COLUMN "calendarError" TEXT;

CREATE UNIQUE INDEX "LeadCall_calendarEventId_key" ON "LeadCall"("calendarEventId");
CREATE INDEX "LeadCall_calendarStatus_idx" ON "LeadCall"("calendarStatus");
