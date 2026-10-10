-- DropIndex
DROP INDEX "Availability_resourceId_date_start_key";

-- CreateIndex
CREATE UNIQUE INDEX "Availability_calendarId_resourceId_date_start_key" ON "Availability"("calendarId", "resourceId", "date", "start");

