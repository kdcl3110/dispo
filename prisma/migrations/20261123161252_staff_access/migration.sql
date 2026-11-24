-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- Ajouté à la main. L'accès passe d'un contrôle par domaine à une liste
-- d'adresses tenue par l'admin : les comptes du personnel déjà créés à leur
-- première connexion perdent l'accès, l'admin le rétablit (ou l'import de la
-- liste le fait pour les adresses qui y figurent). Ils se sont connectés au
-- moins une fois : leur date de création tient lieu de dernière connexion.
UPDATE "User" SET "disabledAt" = CURRENT_TIMESTAMP, "lastLoginAt" = "createdAt" WHERE "role" = 'USER';
