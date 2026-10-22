-- AlterTable FamilyMember: per-child school region (ISO 3166-2). NULL = follows the family's home region.
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "schoolSubdivision" TEXT;
