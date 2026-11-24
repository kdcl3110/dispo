-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "building" TEXT,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "roomTypeId" TEXT;

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceFeature" (
    "resourceId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ResourceFeature_pkey" PRIMARY KEY ("resourceId","featureId")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_name_key" ON "RoomType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Feature_name_key" ON "Feature"("name");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceFeature" ADD CONSTRAINT "ResourceFeature_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceFeature" ADD CONSTRAINT "ResourceFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ajouté à la main (Prisma ne décrit pas les CHECK, il les conserve) :
-- capacité, bâtiment et type de local n'existent que pour un LOCAL.
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_room_fields_local_only"
  CHECK ("type" = 'LOCAL' OR ("capacity" IS NULL AND "building" IS NULL AND "roomTypeId" IS NULL));
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "ResourceFeature" ADD CONSTRAINT "ResourceFeature_quantity_positive" CHECK ("quantity" > 0);
