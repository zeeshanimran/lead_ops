-- CreateTable
CREATE TABLE "_BdTechStacks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_BdTechStacks_AB_unique" ON "_BdTechStacks"("A", "B");

-- CreateIndex
CREATE INDEX "_BdTechStacks_B_index" ON "_BdTechStacks"("B");

-- AddForeignKey
ALTER TABLE "_BdTechStacks" ADD CONSTRAINT "_BdTechStacks_A_fkey" FOREIGN KEY ("A") REFERENCES "TechStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BdTechStacks" ADD CONSTRAINT "_BdTechStacks_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
