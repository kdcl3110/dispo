-- DropIndex
DROP INDEX "Resource_type_name_key";

-- CreateIndex
CREATE INDEX "Resource_type_name_idx" ON "Resource"("type", "name");
