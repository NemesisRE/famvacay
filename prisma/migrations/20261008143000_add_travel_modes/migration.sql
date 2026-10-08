-- AlterTable
ALTER TABLE "FamilyProfile" ADD COLUMN IF NOT EXISTS "travelModes" TEXT[] DEFAULT ARRAY['FLIGHT', 'CAR']::TEXT[];

