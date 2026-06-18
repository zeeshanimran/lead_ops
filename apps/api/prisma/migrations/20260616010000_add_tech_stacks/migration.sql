CREATE TABLE "TechStack" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TechStack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TechStack_name_key" ON "TechStack"("name");
